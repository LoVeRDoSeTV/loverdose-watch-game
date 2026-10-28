import crypto from 'node:crypto';

export function validateDropSchedule(body){
  const {enabled,minMinutes,maxMinutes}=body||{};
  if(typeof enabled!=='boolean'||!Number.isSafeInteger(minMinutes)||!Number.isSafeInteger(maxMinutes)||minMinutes<5||maxMinutes>180||maxMinutes<minMinutes)throw Error('Choisis des délais entiers entre 5 et 180 minutes, avec un maximum supérieur ou égal au minimum.');
  return {enabled,minMinutes,maxMinutes};
}
export function randomDropDelay(min,max,random=crypto.randomInt){return random(min*60,max*60+1);}
export async function initDropSchedule(pool){
  await pool.query(`CREATE TABLE IF NOT EXISTS game_bot_drop_schedule(id SMALLINT PRIMARY KEY CHECK(id=1),enabled BOOLEAN NOT NULL DEFAULT TRUE,min_minutes INTEGER NOT NULL DEFAULT 20 CHECK(min_minutes BETWEEN 5 AND 180),max_minutes INTEGER NOT NULL DEFAULT 40 CHECK(max_minutes BETWEEN min_minutes AND 180),next_at TIMESTAMPTZ)`);
  await pool.query('INSERT INTO game_bot_drop_schedule(id) VALUES(1) ON CONFLICT DO NOTHING');
}
// Must run inside the caller's transaction. This row lock serializes workers and restarts.
export async function advanceDropSchedule(client,{live,chooseReward,random=crypto.randomInt}){
  const state=(await client.query('SELECT *,next_at<=CURRENT_TIMESTAMP due FROM game_bot_drop_schedule WHERE id=1 FOR UPDATE')).rows[0];
  if(!live){
    await client.query('UPDATE game_bot_drop_schedule SET next_at=NULL WHERE id=1 AND next_at IS NOT NULL');
    await client.query("UPDATE game_bot_drops SET status='cancelled',settled_at=CURRENT_TIMESTAMP WHERE status IN ('pending','open')");
    return;
  }
  const active=(await client.query("SELECT id FROM game_bot_drops WHERE status IN ('pending','open') LIMIT 1")).rowCount;
  if(!state.enabled||active){await client.query('UPDATE game_bot_drop_schedule SET next_at=NULL WHERE id=1 AND next_at IS NOT NULL');return;}
  if(!state.next_at){
    const seconds=randomDropDelay(state.min_minutes,state.max_minutes,random);
    await client.query("UPDATE game_bot_drop_schedule SET next_at=CURRENT_TIMESTAMP+$1*INTERVAL '1 second' WHERE id=1",[seconds]);
  }else if(state.due){
    await client.query('INSERT INTO game_bot_drops(reward_key) VALUES($1) ON CONFLICT DO NOTHING',[chooseReward().key]);
    await client.query('UPDATE game_bot_drop_schedule SET next_at=NULL WHERE id=1');
  }
}
