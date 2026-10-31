// Global restart keeps identities, authentication, configuration and audit history.
export const GLOBAL_RESET_PHRASE = 'REINITIALISER TOUT LE JEU';
export const GLOBAL_PROGRESS_TABLES = [
  'sessions_watch','user_badges','user_badge_celebrations','user_xp_rewards',
  'user_daily_challenge_state','user_daily_activity','user_global_lovys_xp_rewards',
  'user_global_xp_level_rewards','user_global_cash_level_rewards','user_live_attendance',
  'user_game_watch','user_reward_wheel_spins','user_reward_wheels','user_active_boosts',
  'user_pve_battles','user_pve_progress','user_combat_reports','user_incubator_eggs',
  'user_lovys','trade_wishes','trade_notifications','user_achievement_progress',
  'user_subscription_badge_state','user_achievement_event_watch','shop_inventory'
];

export async function resetAllGameProgress(client) {
  // Stop writes and row-locking reads until the complete restart commits.
  // Existing trades/drops finish first or the transaction safely rolls back.
  const tables=['player_trade_offers','trade_offers','game_bot_drops','game_bot_drop_schedule',
    'accounts','users',...GLOBAL_PROGRESS_TABLES,'wizebot_game_alerts'];
  await client.query(`LOCK TABLE ${tables.join(',')} IN EXCLUSIVE MODE`);
  const accounts=Number((await client.query('SELECT COUNT(*)::int total FROM accounts')).rows[0].total);
  const players=Number((await client.query('SELECT COUNT(*)::int total FROM users')).rows[0].total);
  // No refunds: every participant's inventory is reset in this same transaction.
  await client.query("UPDATE player_trade_offers SET status='cancelled',updated_at=CURRENT_TIMESTAMP WHERE status='open'");
  await client.query("UPDATE trade_offers SET status='cancelled',updated_at=CURRENT_TIMESTAMP WHERE status='open'");
  await client.query("UPDATE game_bot_drops SET status='cancelled',settled_at=CURRENT_TIMESTAMP WHERE status IN ('pending','open')");
  await client.query('UPDATE game_bot_drop_schedule SET next_at=NULL WHERE id=1');
  await client.query('UPDATE wizebot_game_alerts SET valid_until=CURRENT_TIMESTAMP WHERE user_id IS NOT NULL');
  for(const table of GLOBAL_PROGRESS_TABLES)await client.query(`DELETE FROM ${table}`);
  await client.query(`UPDATE users SET creature_id=NULL,xp=0,pending_xp=0,global_xp=0,prestige=0,
    egg_fragments=0,universal_lovys_fragments=0,points=0,lifetime_lovercash_earned=0,
    lifetime_lovercash_spent=0,watch_seconds=0,incubator_accelerated_seconds=0,
    total_lovys_hatched=0,last_live_seen_at=NULL,away_lovys_xp=0,away_global_xp=0,
    away_lovercash=0,away_watch_seconds=0,progress_reset_at=clock_timestamp(),updated_at=CURRENT_TIMESTAMP`);
  await client.query(`INSERT INTO user_badge_celebrations(user_id,seen_signatures) SELECT id,'{}' FROM users`);
  await client.query(`UPDATE accounts SET equipped_title_key=NULL,equipped_background_key=NULL,
    equipped_frame_key=NULL,equipped_avatar_frame_key=NULL,game_intro_seen=FALSE,
    community_intro_seen=FALSE,updated_at=CURRENT_TIMESTAMP`);
  return {accounts,players};
}

export function registerGlobalGameReset(app,{pool,getBroadcasterAccount,pushLiveUpdate}){
  app.post('/api/admin/reset-game',async(req,res)=>{
    let client,committed=false;
    try{
      const admin=await getBroadcasterAccount(req);
      if(!admin)return res.status(403).json({error:'Accès réservé au diffuseur.'});
      const requestId=String(req.body?.requestId||'');
      if(req.body?.confirmation!==GLOBAL_RESET_PHRASE||req.body?.confirmAll!==true||!/^\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(requestId))
        return res.status(400).json({error:'Recopie exactement REINITIALISER TOUT LE JEU pour confirmer.'});
      client=await pool.connect();await client.query('BEGIN');
      await client.query("SET LOCAL lock_timeout='8s'");
      await client.query("SET LOCAL statement_timeout='60s'");
      const lock=(await client.query('SELECT pg_try_advisory_xact_lock(245749,1) locked')).rows[0].locked;
      if(!lock){await client.query('ROLLBACK');return res.status(409).json({error:'Une réinitialisation est déjà en cours.'});}
      const previous=(await client.query("SELECT details_json FROM admin_audit_log WHERE action_key='reset_game_all' AND details_json->>'requestId'=$1 LIMIT 1",[requestId])).rows[0];
      if(previous){await client.query('COMMIT');return res.json({ok:true,...previous.details_json,alreadyApplied:true});}
      const counts=await resetAllGameProgress(client);
      // Audit failure must roll back the reset; do not use the best-effort logger.
      await client.query(`INSERT INTO admin_audit_log(admin_account_id,target_account_id,action_key,summary,details_json)
        VALUES($1,NULL,'reset_game_all',$2,$3::jsonb)`,[admin.id,`Jeu réinitialisé pour tous · ${counts.accounts} compte(s)`,JSON.stringify({requestId,...counts,identitiesPreserved:true})]);
      await client.query('COMMIT');committed=true;
      try{pushLiveUpdate('game-reset-all',{at:Date.now()});}catch{}
      res.json({ok:true,...counts,message:'Le jeu a été réinitialisé pour tout le monde. Les comptes et les liaisons sont conservés.'});
    }catch(error){
      if(client&&!committed)try{await client.query('ROLLBACK');}catch{}
      console.error('Réinitialisation globale du jeu :',error);
      res.status(500).json({error:'La réinitialisation a échoué. Aucune remise à zéro partielle n’a été conservée.'});
    }finally{client?.release();}
  });
}
