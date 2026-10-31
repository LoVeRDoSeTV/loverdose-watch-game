// Shared economy rules. Levels 1–25 and live rates stay unchanged.
export const LOVYS_MAX_XP = 25000;
const LEGACY_LOVYS_MAX_XP = 10000;
export const LIVE_ATTENDANCE_SECONDS = 3600;

export function globalThresholdForLevel(level) {
  const steps = Math.max(0, level - 1);
  return Math.round(steps * (100 + (steps - 1) * 10) / 2);
}

// Historical curve is retained only for migration and the fixed PvE reward budgets.
export function legacyLovysThresholdForLevel(level) {
  if (level <= 1) return 0;
  if (level <= 10) return (level - 1) * 1000 / 9;
  if (level <= 25) return 1000 + (level - 10) * 2500 / 15;
  return Math.min(LEGACY_LOVYS_MAX_XP, 3500 + (level - 25) * 260);
}

export function lovysThresholdForLevel(level) {
  if (level <= 25) return legacyLovysThresholdForLevel(level);
  const steps=Math.min(25,level-25);
  return 3500 + 260*steps + 25*steps*(steps-1);
}

// Evolution follows XP levels; fragments and stars belong only to rank.
export function lovysEvolutionFromLevel(level) {
  const value=Math.max(1,Math.min(50,Number(level)||1));
  const evolution=value>=50?3:value>=25?2:0;
  return {evolution,evolutionName:evolution===3?'Évolution maximale':evolution===2?'Forme évoluée':'Forme de départ',
    evolutionBonusPercent:evolution===3?30:evolution===2?15:0,nextEvolutionLevel:value<25?25:value<50?50:null};
}

export function lovysProgressionFromXp(xp) {
  const value=Math.max(0,Number(xp)||0);
  let low=1,high=50;
  while(low<high){
    const middle=Math.ceil((low+high)/2);
    if(value>=lovysThresholdForLevel(middle))low=middle;else high=middle-1;
  }
  const level=low;
  return {level,...lovysEvolutionFromLevel(level),
    currentThreshold:lovysThresholdForLevel(level),nextThreshold:lovysThresholdForLevel(Math.min(50,level+1)),maxLevel:level===50,maxXp:LOVYS_MAX_XP};
}

// Keep the exact level and fraction of the level earned under the old curve.
export function migrateLegacyLovysXp(xp) {
  const value=Math.max(0,Math.min(LEGACY_LOVYS_MAX_XP,Number(xp)||0));
  if(value<=3500)return value;
  if(value>=LEGACY_LOVYS_MAX_XP)return LOVYS_MAX_XP;
  const steps=Math.floor((value-3500)/260),fraction=(value-(3500+steps*260))/260;
  const current=lovysThresholdForLevel(25+steps),next=lovysThresholdForLevel(26+steps);
  return current+fraction*(next-current);
}

export function splitLovysXp(currentXp, earnedXp) {
  const current = Math.max(0, Number(currentXp) || 0);
  const earned = Math.max(0, Number(earnedXp) || 0);
  const xp = Math.min(LOVYS_MAX_XP, current + earned);
  return { xp, applied: Math.max(0, xp - Math.min(current, LOVYS_MAX_XP)), overflow: Math.max(0, current + earned - LOVYS_MAX_XP) };
}

// Potion overlap is measured on the credited interval, including a potion that
// expires between two polls. Raw watch time is never multiplied.
export const LIVE_TICK_SQL = `WITH rates AS (
  SELECT u.id,
    (CASE WHEN u.is_sub THEN $2 ELSE $1 END)::double precision * (1+COALESCE((
      SELECT GREATEST(0,EXTRACT(EPOCH FROM LEAST(b.expires_at,$10::timestamptz)-GREATEST(b.starts_at,$10::timestamptz-$5::double precision*INTERVAL '1 second')))/$5
      FROM user_active_boosts b WHERE b.user_id=u.id AND b.boost_key='boost_xp_x2'
    ),0)) AS lovys_gain,
    (CASE WHEN u.is_sub THEN $4 ELSE $3 END)::double precision * (1+COALESCE((
      SELECT GREATEST(0,EXTRACT(EPOCH FROM LEAST(b.expires_at,$10::timestamptz)-GREATEST(b.starts_at,$10::timestamptz-$5::double precision*INTERVAL '1 second')))/$5
      FROM user_active_boosts b WHERE b.user_id=u.id AND b.boost_key='boost_cash_x2'
    ),0)) AS cash_gain,
    (CASE WHEN u.is_sub THEN $8 ELSE $7 END)::double precision AS global_gain,
    NOT EXISTS(SELECT 1 FROM user_game_tabs t WHERE t.user_id=u.id AND t.last_seen_at>CURRENT_TIMESTAMP-INTERVAL '90 seconds') AS away
  FROM users u WHERE u.twitch_id=ANY($6::text[]) ORDER BY u.id FOR UPDATE OF u
) UPDATE users u SET
  xp=CASE WHEN u.creature_id IS NULL THEN 0 ELSE LEAST($9,u.xp+r.lovys_gain) END,
  pending_xp=u.pending_xp+CASE WHEN u.creature_id IS NULL THEN r.lovys_gain ELSE GREATEST(0,u.xp+r.lovys_gain-$9) END,
  points=u.points+r.cash_gain,lifetime_lovercash_earned=u.lifetime_lovercash_earned+r.cash_gain,
  global_xp=u.global_xp+r.global_gain,watch_seconds=u.watch_seconds+$5::bigint,
  away_lovys_xp=u.away_lovys_xp+CASE WHEN r.away THEN r.lovys_gain ELSE 0 END,
  away_global_xp=u.away_global_xp+CASE WHEN r.away THEN r.global_gain ELSE 0 END,
  away_lovercash=u.away_lovercash+CASE WHEN r.away THEN r.cash_gain ELSE 0 END,
  away_watch_seconds=u.away_watch_seconds+CASE WHEN r.away THEN $5::bigint ELSE 0 END,
  last_live_seen_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP
FROM rates r WHERE u.id=r.id RETURNING u.id,r.cash_gain,r.global_gain`;

export async function syncActiveLovysXp(client, userIds) {
  await client.query(`UPDATE user_lovys l SET xp=u.xp,updated_at=CURRENT_TIMESTAMP
    FROM users u WHERE l.user_id=u.id AND l.is_active=TRUE AND u.id=ANY($1::int[])`, [userIds]);
}

export async function recordDailyLiveActivity(client, dateKey, seconds, creditedRows) {
  await client.query(`INSERT INTO user_daily_activity(user_id,activity_date,watch_seconds,global_xp_earned,lovercash_earned,updated_at)
    SELECT r.user_id,$2::date,$3::bigint,r.global_gain,r.cash_gain,CURRENT_TIMESTAMP
    FROM jsonb_to_recordset($1::jsonb) AS r(user_id int,global_gain double precision,cash_gain double precision)
    ON CONFLICT(user_id,activity_date) DO UPDATE SET
      watch_seconds=user_daily_activity.watch_seconds+EXCLUDED.watch_seconds,
      global_xp_earned=user_daily_activity.global_xp_earned+EXCLUDED.global_xp_earned,
      lovercash_earned=user_daily_activity.lovercash_earned+EXCLUDED.lovercash_earned,updated_at=CURRENT_TIMESTAMP`,
    [JSON.stringify(creditedRows.map(row=>({user_id:row.id,global_gain:row.global_gain,cash_gain:row.cash_gain}))),dateKey,seconds]);
}

// The caller holds the users row lock. The active account XP and its collection
// entry are updated together; inactive fighters keep their own progression.
export async function creditLovysXp(client, userId, lovysId, earnedXp) {
  const user = (await client.query('SELECT id,creature_id,xp FROM users WHERE id=$1 FOR UPDATE', [userId])).rows[0];
  const lovys = (await client.query('SELECT id,xp,is_active FROM user_lovys WHERE id=$1 AND user_id=$2 FOR UPDATE', [lovysId,userId])).rows[0];
  if (!user || !lovys) throw new Error('Lovys introuvable pour cette récompense.');
  const result = splitLovysXp(lovys.is_active ? user.xp : lovys.xp, earnedXp);
  await client.query('UPDATE user_lovys SET xp=$2,updated_at=CURRENT_TIMESTAMP WHERE id=$1', [lovys.id,result.xp]);
  await client.query(`UPDATE users SET xp=CASE WHEN $4 THEN $2 ELSE xp END,
    pending_xp=pending_xp+$3,updated_at=CURRENT_TIMESTAMP WHERE id=$1`, [userId,result.xp,result.overflow,Boolean(lovys.is_active)]);
  return result;
}

// Caller holds the migration transaction. Lock users first, as for all XP credits.
async function reconcileLovysXpWithClient(client,maxXp) {
  await client.query('SELECT id FROM users ORDER BY id FOR UPDATE');
  await client.query(`UPDATE user_lovys l SET xp=GREATEST(l.xp,u.xp)
    FROM users u WHERE l.user_id=u.id AND l.is_active=TRUE AND l.creature_id=u.creature_id`);
  await client.query(`WITH excess AS (
    SELECT id,user_id,xp-$1 AS overflow FROM user_lovys WHERE xp>$1 FOR UPDATE
  ), capped AS (
    UPDATE user_lovys l SET xp=$1 FROM excess e WHERE l.id=e.id RETURNING l.user_id,e.overflow
  ), refunds AS (
    SELECT user_id,SUM(overflow) AS amount FROM capped GROUP BY user_id
  ) UPDATE users u SET pending_xp=u.pending_xp+r.amount FROM refunds r WHERE u.id=r.user_id`, [maxXp]);
  await client.query(`UPDATE users u SET creature_id=l.creature_id,xp=l.xp
    FROM user_lovys l WHERE l.user_id=u.id AND l.is_active=TRUE`);
}

// Restart-safe reconciliation. Overflow is recovered once, never discarded.
export async function reconcileLovysXp(pool) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await reconcileLovysXpWithClient(client,LOVYS_MAX_XP);
    await client.query('COMMIT');
  } catch (error) { await client.query('ROLLBACK'); throw error; }
  finally { client.release(); }
}

export async function migrateLovysProgressionCurve(pool) {
  const client=await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(`CREATE TABLE IF NOT EXISTS economy_migrations(version TEXT PRIMARY KEY,applied_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP)`);
    const marker=await client.query(`INSERT INTO economy_migrations(version) VALUES('v498-lovys-curve') ON CONFLICT DO NOTHING RETURNING version`);
    if(!marker.rowCount){await client.query('COMMIT');return {applied:false,migrated:0};}
    // Recover any historical overflow using the OLD cap before converting XP.
    await reconcileLovysXpWithClient(client,LEGACY_LOVYS_MAX_XP);
    const rows=(await client.query('SELECT id,xp FROM user_lovys WHERE xp>3500 ORDER BY id FOR UPDATE')).rows;
    const converted=rows.map(row=>({id:Number(row.id),xp:migrateLegacyLovysXp(row.xp)}));
    if(converted.length)await client.query(`UPDATE user_lovys l SET xp=m.xp,updated_at=CURRENT_TIMESTAMP
      FROM jsonb_to_recordset($1::jsonb) AS m(id int,xp double precision) WHERE l.id=m.id`,[JSON.stringify(converted)]);
    await client.query(`UPDATE users u SET xp=l.xp,updated_at=CURRENT_TIMESTAMP
      FROM user_lovys l WHERE l.user_id=u.id AND l.is_active=TRUE`);
    await client.query('COMMIT');
    return {applied:true,migrated:converted.length};
  } catch(error){await client.query('ROLLBACK');throw error;}
  finally{client.release();}
}
