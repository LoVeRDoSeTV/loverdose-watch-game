export const BETA_TESTER_TITLE={key:'reward_title_beta_tester',category:'title',subcategory:'violet',name:'Bêta testeur',price:0,color:'#c7a1ff',description:'Titre permanent des trois bêta-testeurs. Conservé après les réinitialisations du jeu.',rewardOnly:true,exclusive:true,permanent:true};
const campaign='beta-testers-v1';
const normalize=value=>String(value||'').toLowerCase().replace(/_/g,'');

// Resolve only authenticated Twitch logins; never trust a freely chosen game name.
export function resolveBetaTesters(accounts,broadcasterId=''){
  const players=accounts.filter(a=>a.twitch_id&&String(a.twitch_id)!==String(broadcasterId));
  const definitions=[
    {name:'LoVeRMiyu',matches:login=>['lovermiyu','lovermyiu'].includes(login)},
    {name:'LoVeRKiLLeR',matches:login=>login==='loverkiller'},
    {name:'lzk',matches:login=>login.startsWith('lzk')}
  ];
  const selected=[],unresolved=[];
  for(const definition of definitions){
    const found=players.filter(a=>definition.matches(normalize(a.login)));
    if(found.length!==1)unresolved.push(definition.name);
    else selected.push(found[0]);
  }
  // The owner explicitly named the three existing players. If the two full
  // logins match and only one other player exists, resolve the abbreviated lzk
  // by that unique existing account, even if its first letter was transcribed I/l.
  if(broadcasterId&&accounts.some(a=>String(a.twitch_id)===String(broadcasterId))&&players.length===3
    &&unresolved.length===1&&unresolved[0]==='lzk'&&selected.length===2){
    const third=players.filter(a=>!selected.some(s=>s.id===a.id));
    if(third.length===1)return {selected:[...selected,third[0]],unresolved:[]};
  }
  if(new Set(selected.map(a=>a.id)).size!==3&&unresolved.length===0)unresolved.push('Comptes distincts requis');
  return {selected:unresolved.length?[]:selected,unresolved};
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
      const rows=(await client.query(`SELECT a.id,a.twitch_id,u.login FROM accounts a JOIN users u ON u.twitch_id=a.twitch_id ORDER BY a.id FOR UPDATE OF a`)).rows;
      const result=resolveBetaTesters(rows,broadcasterId);unresolved=result.unresolved;
      if(!unresolved.length){
        for(const account of result.selected)await client.query(`INSERT INTO account_permanent_rewards(account_id,item_key,source,twitch_id)
          VALUES($1,$2,$3,$4) ON CONFLICT DO NOTHING`,[account.id,BETA_TESTER_TITLE.key,campaign,account.twitch_id]);
        await client.query('UPDATE permanent_reward_campaigns SET completed=TRUE,completed_at=CURRENT_TIMESTAMP WHERE key=$1',[campaign]);
      }
    }
    await client.query(`INSERT INTO shop_inventory(account_id,item_key,quantity)
      SELECT account_id,item_key,1 FROM account_permanent_rewards
      ON CONFLICT(account_id,item_key) DO UPDATE SET quantity=GREATEST(shop_inventory.quantity,1)`);
    await client.query('COMMIT');
    if(unresolved.length)console.warn('Titre Bêta testeur non attribué : compte absent ou ambigu pour '+unresolved.join(', '));
    return {completed:state.completed||!unresolved.length,unresolved};
  }catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
}
