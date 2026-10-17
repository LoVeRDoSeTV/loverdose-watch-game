// Commands commit immediately. The tracker integrates boost changes over its credited interval.
export async function initLiveBoostTimeline(pool) {
  await pool.query(`CREATE TABLE IF NOT EXISTS live_boost_history (
    id BIGSERIAL PRIMARY KEY,changed_at TIMESTAMPTZ NOT NULL,state JSONB NOT NULL)`);
  await pool.query('CREATE INDEX IF NOT EXISTS live_boost_history_time_idx ON live_boost_history(changed_at DESC,id DESC)');
  await pool.query(`INSERT INTO live_boost_history(changed_at,state)
    SELECT '1970-01-01'::timestamptz,to_jsonb(b) FROM admin_live_boosts b
    WHERE b.id=1 AND NOT EXISTS(SELECT 1 FROM live_boost_history)`);
}
export async function mutateLiveBoosts(pool, mutate) {
  const client=await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT id FROM admin_live_boosts WHERE id=1 FOR UPDATE');
    await mutate(client);
    await client.query(`INSERT INTO live_boost_history(changed_at,state)
      SELECT clock_timestamp(),to_jsonb(b) FROM admin_live_boosts b WHERE id=1`);
    await client.query('COMMIT');
  } catch(error) {try{await client.query('ROLLBACK');}catch{}throw error;}
  finally {client.release();}
}
export function integrateLiveBoosts(events,start,end) {
  const total={xp:0,cash:0,globalXp:0};
  if(!(end>start))return {xp:1,cash:1,globalXp:1};
  const ordered=events.map(e=>({...e,at:new Date(e.changed_at).getTime()})).sort((a,b)=>a.at-b.at||Number(a.id)-Number(b.id));
  let state={},position=start;
  const keys=[['xp','xp_multiplier','streamdeck_xp_expires_at'],['cash','cash_multiplier','streamdeck_cash_expires_at'],['globalXp','global_xp_multiplier','streamdeck_global_xp_expires_at']];
  function accumulate(until) {
    const cuts=[position,until,...['expires_at',...keys.map(k=>k[2])].map(k=>new Date(state[k]||0).getTime()).filter(t=>t>position&&t<until)].sort((a,b)=>a-b);
    for(let i=0;i<cuts.length-1;i++){
      const at=(cuts[i]+cuts[i+1])/2,seconds=cuts[i+1]-cuts[i];
      for(const [key,column,deck] of keys){
        const admin=new Date(state.expires_at||0).getTime()>at?Math.max(1,Math.min(3,Number(state[column])||1)):1;
        const personalDeck=new Date(state[deck]||0).getTime()>at?2:1;
        total[key]+=seconds*Math.max(admin,personalDeck);
      }
    }
    position=until;
  }
  for(const event of ordered){
    if(event.at<=start){state=event.state;continue;}
    if(event.at>end)break;
    accumulate(event.at);state=event.state;
  }
  accumulate(end);
  return Object.fromEntries(Object.entries(total).map(([key,value])=>[key,value/(end-start)]));
}
export async function averageLiveBoosts(pool,start,end) {
  const result=await pool.query(`(SELECT id,changed_at,state FROM live_boost_history WHERE changed_at<=$1 ORDER BY changed_at DESC,id DESC LIMIT 1)
    UNION ALL SELECT id,changed_at,state FROM live_boost_history WHERE changed_at>$1 AND changed_at<=$2`,[new Date(start),new Date(end)]);
  return integrateLiveBoosts(result.rows,start,end);
}
export function publicLiveBoostStatus(boosts,now=Date.now()) {
  const items=[
    {key:'xp',label:'XP Lovys',multiplier:boosts.xp,expiresAt:boosts.xpExpiresAt},
    {key:'cash',label:'LoVeR’Cash',multiplier:boosts.cash,expiresAt:boosts.cashExpiresAt},
    {key:'globalXp',label:'XP globale',multiplier:boosts.globalXp,expiresAt:boosts.globalXpExpiresAt}
  ].filter(item=>item.multiplier>1&&new Date(item.expiresAt||0).getTime()>now);
  return {active:items.length>0,items,multiplier:boosts.xp,expiresAt:boosts.xpExpiresAt,serverNow:now};
}
