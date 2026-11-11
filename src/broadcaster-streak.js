// Compteur privé du diffuseur. Aucune attribution de cadeau ici :
// seuls les événements Twitch EventSub de partage watch_streak validés donnent un cadeau.
export async function initBroadcasterStreak(pool, twitchId) {
  await pool.query(`CREATE TABLE IF NOT EXISTS broadcaster_watch_streak (
    twitch_id TEXT PRIMARY KEY,
    count INTEGER NOT NULL DEFAULT 200 CHECK(count >= 200),
    last_stream_started_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`);
  const id=String(twitchId||'').trim();
  if(!id)return;
  const client=await pool.connect();
  try {
    await client.query('BEGIN');
    const player=(await client.query('SELECT id FROM users WHERE twitch_id=$1 FOR UPDATE',[id])).rows[0];
    if(player){
      await client.query('INSERT INTO broadcaster_watch_streak(twitch_id) VALUES($1) ON CONFLICT DO NOTHING',[id]);
    }
    await client.query('COMMIT');
  }catch(e){await client.query('ROLLBACK');throw e}finally{client.release()}
}

export async function registerBroadcasterLive(pool,twitchId,startedAt){
  const id=String(twitchId||'').trim(),started=new Date(startedAt);
  if(!id||!Number.isFinite(started.getTime()))return false;
  const client=await pool.connect();
  try{
    await client.query('BEGIN');
    const player=(await client.query('SELECT id FROM users WHERE twitch_id=$1 FOR UPDATE',[id])).rows[0];
    if(!player){await client.query('COMMIT');return false}
    await client.query('INSERT INTO broadcaster_watch_streak(twitch_id) VALUES($1) ON CONFLICT DO NOTHING',[id]);
    const state=(await client.query('SELECT count,last_stream_started_at FROM broadcaster_watch_streak WHERE twitch_id=$1 FOR UPDATE',[id])).rows[0];
    if(state.last_stream_started_at&&started.getTime()<=new Date(state.last_stream_started_at).getTime()){
      await client.query('COMMIT');return false;
    }
    const next=Number(state.count)+1;
    // Démarrer un live ne distribue pas de récompense.
    await client.query('UPDATE broadcaster_watch_streak SET count=$2,last_stream_started_at=$3,updated_at=CURRENT_TIMESTAMP WHERE twitch_id=$1',[id,next,started]);
    await client.query('COMMIT');return true;
  }catch(e){await client.query('ROLLBACK');throw e}finally{client.release()}
}
