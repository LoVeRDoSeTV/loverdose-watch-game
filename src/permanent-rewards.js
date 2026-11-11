// Exclusive title: ownership is tied to the three original Twitch accounts.
// Never infer a recipient from a similar nickname or the number of players.
export const BETA_TESTER_TITLE={key:'reward_title_beta_tester',category:'title',subcategory:'violet',name:'Bêta testeur',price:0,color:'#c7a1ff',description:'Titre permanent réservé à LoVeRMiyu, LoVeRKiLLeR et lzkll3_. Conservé après les réinitialisations du jeu.',rewardOnly:true,exclusive:true,permanent:true};
const campaign='beta-testers-v2-exact';
const BETA_TWITCH_LOGINS=Object.freeze(['lovermiyu','loverkiller','lzkll3_']);
const normalize=value=>String(value||'').trim().toLowerCase();

// Resolve Twitch-linked accounts exclusively by exact authenticated Twitch login.
// Missing accounts may be granted later; never guess using similar names.
export function resolveBetaTesters(accounts,broadcasterId=''){
  const players=accounts.filter(a=>a.twitch_id&&String(a.twitch_id)!==String(broadcasterId));
  const selected=[],unresolved=[];
  for(const login of BETA_TWITCH_LOGINS){
    const found=players.filter(a=>normalize(a.login)===login);
    if(found.length!==1)unresolved.push(login);
    else selected.push(found[0]);
  }
  if(new Set(selected.map(a=>a.id)).size!==selected.length)throw new Error('Plusieurs pseudos Bêta testeur correspondent au même compte.');
  return {selected,unresolved};
}

export async function initPermanentRewards(pool,{broadcasterId=process.env.TWITCH_BROADCASTER_ID||''}={}){
  await pool.query(`CREATE TABLE IF NOT EXISTS account_permanent_rewards(
    account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    item_key TEXT NOT NULL,source TEXT NOT NULL,twitch_id TEXT NOT NULL,
    granted_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,PRIMARY KEY(account_id,item_key))`);
  await pool.query(`CREATE TABLE IF NOT EXISTS permanent_reward_campaigns(
    key TEXT PRIMARY KEY,completed BOOLEAN NOT NULL DEFAULT FALSE,completed_at TIMESTAMPTZ)`);
  const client=await pool.connect();
  try{
    await client.query('BEGIN');
    await client.query('INSERT INTO permanent_reward_campaigns(key) VALUES($1) ON CONFLICT DO NOTHING',[campaign]);
    const state=(await client.query('SELECT completed FROM permanent_reward_campaigns WHERE key=$1 FOR UPDATE',[campaign])).rows[0];
    let unresolved=[];
    if(!state.completed){
      const rows=(await client.query(`SELECT a.id,a.twitch_id,u.login FROM accounts a
        JOIN users u ON u.twitch_id=a.twitch_id ORDER BY a.id FOR UPDATE OF a`)).rows;
      const result=resolveBetaTesters(rows,broadcasterId);
      unresolved=result.unresolved;
      for(const account of result.selected){
        await client.query(`INSERT INTO account_permanent_rewards(account_id,item_key,source,twitch_id)
          VALUES($1,$2,$3,$4)
          ON CONFLICT(account_id,item_key) DO UPDATE
          SET source=EXCLUDED.source,twitch_id=EXCLUDED.twitch_id`,
        [account.id,BETA_TESTER_TITLE.key,campaign,account.twitch_id]);
      }
      const entitled=(await client.query('SELECT COUNT(*)::int total FROM account_permanent_rewards WHERE item_key=$1 AND source=$2',
        [BETA_TESTER_TITLE.key,campaign])).rows[0];
      if(Number(entitled?.total||0)===BETA_TWITCH_LOGINS.length){
        await client.query('UPDATE permanent_reward_campaigns SET completed=TRUE,completed_at=CURRENT_TIMESTAMP WHERE key=$1',[campaign]);
      }
    }

    // Reconcile the older permissive beta-test campaign: wrongly matched
    // accounts must not retain this exclusive title (even if equipped).
    // The exact grant remains attached to its original Twitch account after renames.
    const authorized=(await client.query('SELECT account_id FROM account_permanent_rewards WHERE item_key=$1 AND source=$2',
      [BETA_TESTER_TITLE.key,campaign])).rows.map(row=>Number(row.account_id));
    await client.query('UPDATE accounts SET equipped_title_key=NULL WHERE equipped_title_key=$1 AND NOT(id=ANY($2::int[]))',
      [BETA_TESTER_TITLE.key,authorized]);
    await client.query('DELETE FROM shop_inventory WHERE item_key=$1 AND NOT(account_id=ANY($2::int[]))',
      [BETA_TESTER_TITLE.key,authorized]);
    await client.query('DELETE FROM account_permanent_rewards WHERE item_key=$1 AND NOT(account_id=ANY($2::int[]))',
      [BETA_TESTER_TITLE.key,authorized]);

    // Restore permanent ownership after a player or global reset.
    await client.query(`INSERT INTO shop_inventory(account_id,item_key,quantity)
      SELECT account_id,item_key,1 FROM account_permanent_rewards
      ON CONFLICT(account_id,item_key) DO UPDATE SET quantity=GREATEST(shop_inventory.quantity,1)`);
    await client.query('COMMIT');
    if(unresolved.length)console.warn('Titre Bêta testeur : comptes Twitch exacts non encore liés : '+unresolved.join(', '));
    return {completed:unresolved.length===0,unresolved};
  }catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
}
