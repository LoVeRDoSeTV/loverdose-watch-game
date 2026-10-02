import express from 'express';
import crypto from 'crypto';

export function createPveRouter({ pool, zones, previousFight, fightByKey, creatureBattleStats, typeMultiplier, globalThresholdForLevel }) {
  const router = express.Router();

  router.get('/', async (req, res) => {
    try {
      if (!req.session.account || !req.session.user) return res.status(401).json({ error:'Connexion requise.' });
      const result = await pool.query(`SELECT id,creature_id,xp,egg_fragments FROM users WHERE twitch_id=$1`, [req.session.user.twitchId]);
      const user = result.rows[0];
      if (!user) return res.status(404).json({ error:'Joueur introuvable.' });
      const progress = await pool.query(`SELECT fight_key,wins,attempts FROM user_pve_progress WHERE user_id=$1`, [user.id]);
      const progressMap = new Map(progress.rows.map(row => [row.fight_key, row]));
      const publicZones = zones.map(zone => ({ ...zone, fights:zone.fights.map(fight => {
        const previous = previousFight(fight.key);
        return { ...fight, won:Number(progressMap.get(fight.key)?.wins || 0) > 0, unlocked:!previous || Number(progressMap.get(previous.key)?.wins || 0) > 0 };
      }) }));
      res.json({ ok:true, hasCreature:Boolean(user.creature_id), creature:user.creature_id ? creatureBattleStats(user) : null, eggFragments:Number(user.egg_fragments || 0), zones:publicZones });
    } catch (error) {
      console.error('Erreur chargement PvE :', error);
      res.status(500).json({ error:'Impossible de charger l’aventure.' });
    }
  });

  router.post('/fight', async (req, res) => {
    const client = await pool.connect();
    try {
      if (!req.session.account || !req.session.user) return res.status(401).json({ error:'Connexion requise.' });
      const fight = fightByKey(String(req.body?.fightKey || ''));
      if (!fight) return res.status(400).json({ error:'Combat introuvable.' });
      await client.query('BEGIN');
      const result = await client.query(`SELECT id,creature_id,xp,global_xp FROM users WHERE twitch_id=$1 FOR UPDATE`, [req.session.user.twitchId]);
      const user = result.rows[0];
      if (!user?.creature_id) { await client.query('ROLLBACK'); return res.status(400).json({ error:'Il te faut un Lovys éclos pour combattre.' }); }
      const previous = previousFight(fight.key);
      if (previous) {
        const previousResult = await client.query(`SELECT wins FROM user_pve_progress WHERE user_id=$1 AND fight_key=$2`, [user.id, previous.key]);
        if (!previousResult.rowCount || Number(previousResult.rows[0].wins) <= 0) { await client.query('ROLLBACK'); return res.status(400).json({ error:'Termine le combat précédent.' }); }
      }
      const stats = creatureBattleStats(user);
      const multiplier = typeMultiplier(stats.type, fight.type);
      const playerMaxHp = Number(stats.hp || 1), enemyMaxHp = Number(fight.hp || 1);
      let playerHp = playerMaxHp, enemyHp = enemyMaxHp, rounds = 0;
      const combatLog = [];
      while (playerHp > 0 && enemyHp > 0 && rounds < 20) {
        rounds += 1;
        const playerDamage = Math.max(8, Math.round(stats.power * multiplier * (.9 + crypto.randomInt(0, 21) / 100)));
        enemyHp -= playerDamage;
        const step = { round:rounds, playerDamage, enemyDamage:0, enemyHpAfter:Math.max(0, enemyHp), playerHpAfter:Math.max(0, playerHp) };
        if (enemyHp <= 0) { combatLog.push(step); break; }
        const enemyDamage = Math.max(6, Math.round(fight.power * (.9 + crypto.randomInt(0, 21) / 100)));
        playerHp -= enemyDamage;
        step.enemyDamage = enemyDamage;
        step.playerHpAfter = Math.max(0, playerHp);
        combatLog.push(step);
      }
      const victory = enemyHp <= 0;
      const oldProgress = await client.query(`SELECT wins FROM user_pve_progress WHERE user_id=$1 AND fight_key=$2`, [user.id, fight.key]);
      const firstWin = victory && Number(oldProgress.rows[0]?.wins || 0) <= 0;
      await client.query(`INSERT INTO user_pve_progress(user_id,fight_key,wins,attempts,first_won_at,last_fought_at) VALUES($1,$2,$3,1,$4,CURRENT_TIMESTAMP) ON CONFLICT(user_id,fight_key) DO UPDATE SET wins=user_pve_progress.wins+$3,attempts=user_pve_progress.attempts+1,first_won_at=COALESCE(user_pve_progress.first_won_at,$4),last_fought_at=CURRENT_TIMESTAMP`, [user.id, fight.key, victory ? 1 : 0, firstWin ? new Date() : null]);
      const reward = firstWin ? fight.rewards : { creatureXp:0, globalXp:0, fragments:0 };
      if (firstWin) await client.query(`UPDATE users SET xp=xp+$2,global_xp=LEAST(global_xp+$3,$5),egg_fragments=egg_fragments+$4,updated_at=CURRENT_TIMESTAMP WHERE id=$1`, [user.id, reward.creatureXp, reward.globalXp, reward.fragments, globalThresholdForLevel(56)]);
      const battle = {
        typeMultiplier:multiplier,
        player:{ name:stats.name || 'Lovys', level:stats.level, type:stats.type, power:stats.power, hp:playerMaxHp, maxHp:playerMaxHp },
        enemy:{ name:fight.name, level:fight.level, type:fight.type, power:fight.power, hp:enemyMaxHp, maxHp:enemyMaxHp, boss:Boolean(fight.boss) },
        log:combatLog,
        playerRemainingHp:Math.max(0, playerHp),
        enemyRemainingHp:Math.max(0, enemyHp)
      };
      await client.query(`INSERT INTO user_combat_reports(user_id,fight_key,result,creature_level,enemy_level,creature_power,enemy_power,reward_creature_xp,reward_global_xp,reward_fragments,report_json) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb)`, [user.id, fight.key, victory ? 'victory' : 'defeat', stats.level, fight.level, stats.power, fight.power, reward.creatureXp, reward.globalXp, reward.fragments, JSON.stringify({ rounds, playerRemainingHp:Math.max(0, playerHp), enemyRemainingHp:Math.max(0, enemyHp), typeMultiplier:multiplier, combatLog })]);
      await client.query('COMMIT');
      res.json({ ok:true, victory, firstWin, reward, rounds, battle });
    } catch (error) {
      try { await client.query('ROLLBACK'); } catch {}
      console.error('Erreur combat PvE :', error);
      res.status(500).json({ error:'Combat impossible.' });
    } finally { client.release(); }
  });

  return router;
}
