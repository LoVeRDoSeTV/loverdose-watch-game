import { randomInt } from 'node:crypto';

export function pveCashRange(fight) {
  return fight.boss || fight.miniBoss || fight.finalBoss ? {min:10,max:10} : {min:3,max:5};
}

export function pveVictoryReward(fight, {firstWin, firstLovysWin}, roll=randomInt) {
  if (!firstLovysWin) return {creatureXp:0,globalXp:0,fragments:0,cash:0};
  const {min,max}=pveCashRange(fight);
  return {creatureXp: fight.rewards.creatureXp, globalXp:firstWin?fight.rewards.globalXp:0,
    fragments:firstWin?fight.rewards.fragments:0, cash:min===max?min:roll(min,max+1)};
}

// Historical reports identify the species; each collection entry is matched to
// its own wins. No retrospective cash is paid and no other Lovys is marked won.
export async function initPveRewards(pool) {
  const client=await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(`CREATE TABLE IF NOT EXISTS user_pve_lovys_wins (
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      lovys_id INTEGER NOT NULL REFERENCES user_lovys(id) ON DELETE CASCADE,
      fight_key TEXT NOT NULL, first_won_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY(user_id,lovys_id,fight_key))`);
    const once=await client.query(`INSERT INTO economy_migrations(version) VALUES('pve-lovys-wins-v523') ON CONFLICT DO NOTHING RETURNING version`);
    if(once.rowCount) await client.query(`INSERT INTO user_pve_lovys_wins(user_id,lovys_id,fight_key,first_won_at)
      SELECT r.user_id,l.id,r.fight_key,MIN(r.created_at) FROM user_combat_reports r
      JOIN user_lovys l ON l.user_id=r.user_id AND l.creature_id=r.report_json->>'creatureId'
      WHERE r.result='victory' GROUP BY r.user_id,l.id,r.fight_key ON CONFLICT DO NOTHING`);
    await client.query('COMMIT');
  } catch(error) {await client.query('ROLLBACK');throw error;} finally {client.release();}
}
