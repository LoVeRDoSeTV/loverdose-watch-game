// Called only inside the administrator's transaction. Keep identities and trade history.
export async function resetPlayerProgress(client, target, { achievementService, changeTradeAsset }) {
  const userId = target.user_id;
  if (userId) {
    // Lock offers before users, as the exchange endpoints do. Refund only other creators.
    const incoming = await client.query(`SELECT * FROM player_trade_offers
      WHERE status='open' AND (creator_user_id=$1 OR target_user_id=$1) ORDER BY id FOR UPDATE`, [userId]);
    await client.query(`SELECT id FROM trade_offers WHERE creator_user_id=$1 AND status='open' ORDER BY id FOR UPDATE`, [userId]);
    const participants = [...new Set([Number(userId), ...incoming.rows.map(o => Number(o.creator_user_id))])].sort((a,b)=>a-b);
    await client.query('SELECT id FROM users WHERE id=ANY($1::int[]) ORDER BY id FOR UPDATE', [participants]);
    for (const offer of incoming.rows) {
      if (Number(offer.creator_user_id) !== Number(userId)) {
        const creator = { userId:Number(offer.creator_user_id), accountId:Number(offer.creator_account_id) };
        for (const asset of offer.offered) await changeTradeAsset(client, creator, asset, asset.quantity);
        await client.query(`INSERT INTO trade_notifications(user_id,message,event_type) VALUES($1,$2,'player_trade_cancelled')`,
          [creator.userId, `La proposition #${offer.id} a été annulée après la réinitialisation du destinataire. Tes objets ont été rendus.`]);
      }
    }
    await client.query(`UPDATE player_trade_offers SET status='cancelled',updated_at=CURRENT_TIMESTAMP
      WHERE status='open' AND (creator_user_id=$1 OR target_user_id=$1)`, [userId]);
    await client.query(`UPDATE trade_offers SET status='cancelled',updated_at=CURRENT_TIMESTAMP WHERE creator_user_id=$1 AND status='open'`, [userId]);
    const tables = ['sessions_watch','user_badges','user_badge_celebrations','user_xp_rewards',
      'user_daily_challenge_state','user_daily_activity','user_global_lovys_xp_rewards',
      'user_global_xp_level_rewards','user_global_cash_level_rewards','user_live_attendance',
      'user_game_watch','user_reward_wheel_spins','user_reward_wheels','user_active_boosts',
      'user_pve_battles','user_pve_progress','user_combat_reports','user_incubator_eggs',
      'user_lovys','trade_wishes','trade_notifications'];
    for (const table of tables) await client.query(`DELETE FROM ${table} WHERE user_id=$1`, [userId]);
    await achievementService.reset(client, userId);
    // Un reset commence un nouveau cycle : le premier badge doit être célébré.
    await client.query("INSERT INTO user_badge_celebrations(user_id,seen_signatures) VALUES($1,'{}') ON CONFLICT(user_id) DO UPDATE SET seen_signatures='{}'",[userId]);
    await client.query(`UPDATE users SET creature_id=NULL,xp=0,pending_xp=0,global_xp=0,prestige=0,
      egg_fragments=0,universal_lovys_fragments=0,points=0,lifetime_lovercash_earned=0,
      lifetime_lovercash_spent=0,watch_seconds=0,incubator_accelerated_seconds=0,
      total_lovys_hatched=0,last_live_seen_at=NULL,progress_reset_at=clock_timestamp(),updated_at=CURRENT_TIMESTAMP WHERE id=$1`, [userId]);
  }
  await client.query('DELETE FROM shop_inventory WHERE account_id=$1', [target.id]);
  await client.query(`UPDATE accounts SET equipped_title_key=NULL,equipped_background_key=NULL,
    equipped_frame_key=NULL,equipped_avatar_frame_key=NULL,game_intro_seen=FALSE,
    community_intro_seen=FALSE,updated_at=CURRENT_TIMESTAMP WHERE id=$1`, [target.id]);
}
