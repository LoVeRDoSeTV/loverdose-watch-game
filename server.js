import 'dotenv/config';
import { initLiveBoostTimeline, mutateLiveBoosts, averageLiveBoosts, publicLiveBoostStatus } from './src/live-boost-timeline.js';
import { initPlayerHistory, recordPlayerHistory, registerAdminPlayerHistory } from './src/player-history.js';
import { resetPlayerProgress } from './src/reset-player.js';
import { createAchievements, WATCH_STAGE_REWARDS, WATCH_HOUR_STAGES } from './src/achievements.js';
import express from 'express';
import session from 'express-session';
import pg from 'pg';
import connectPgSimple from 'connect-pg-simple';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import compression from 'compression';
import { getSessionSecret, isProduction, getPublicBaseUrl, twitchConfigurationIssues } from './src/config.js';
import { createHelmetMiddleware, createOriginGuard, loginRateLimit, registerRateLimit, feedbackRateLimit, economyWriteRateLimit, tradeWriteRateLimit, passwordChangeRateLimit, validOAuthCallback, regenerateSession } from './src/middleware/security.js';
import { createChangePasswordHandler, getDiscordInviteUrl } from './src/account-settings.js';
import { createStreamDeckRouter } from './src/routes/streamdeck.js';
import { PVE_ZONES, PVE_FIGHTS, pveFightByKey, pvePreviousFight } from './src/combat/zones.js';
import { createPveRouter } from './src/routes/pve.js';
import { createTwitchPanelRouter } from './src/routes/twitch-panel.js';
import { createFeedbackRouter } from './src/routes/feedback.js';
import { createWizebotAlerts, initWizebotAlerts } from './src/routes/wizebot.js';
import { buildLovysBattleStats, duplicateFragmentsForRarity, nextRankCost, LOVYS_MAX_RANK, LOVYS_RANK_COSTS, publicTalentDescription } from './src/combat/lovys.js';

const { Pool } = pg;


const app = express();
const SESSION_SECRET = getSessionSecret();

app.set('trust proxy', 1);

// V99 — Compresse HTML/CSS/JS/JSON avant envoi pour réduire la bande passante Render.
app.use(compression());
app.use(createHelmetMiddleware({ production: isProduction }));

const PORT = Number(process.env.PORT || 3000);

const BASE_URL = getPublicBaseUrl();
for (const issue of twitchConfigurationIssues()) console.warn(`[configuration Twitch] ${issue}`);

const CHANNEL =
  (process.env.TWITCH_CHANNEL || 'loverdosetv')
    .toLowerCase();

const XP_PER_MINUTE = 100 / 60;

const SUB_MULTIPLIER = 1.20;

const LOVERCASH_PER_MINUTE = 10 / 60;

const GLOBAL_XP_PER_HOUR = 50;
const GLOBAL_XP_SUB_PER_HOUR = 60;

// Récompenses des badges de temps de visionnage.
// L'XP Lovys de badge est stockée dans la réserve afin que le joueur
// choisisse ensuite le Lovys qui la recevra.
const BADGE_TIME_REWARDS = Object.freeze({
  25: { lovysXp: 250, globalXp: 125, cash: 25 },
  50: { lovysXp: 500, globalXp: 250, cash: 50 }
});

// Badges communautaires : récompenses simples mais utiles, obtenues une seule fois.
const BADGE_SOCIAL_REWARD = Object.freeze({ lovysXp: 100, globalXp: 50, cash: 25 });

// Badge d'abonnement : récompense plus marquée pour remercier le soutien Twitch.
const BADGE_SUB_REWARD = Object.freeze({ lovysXp: 500, globalXp: 250, cash: 100 });

// Les montants de visionnage sont versés une fois à chaque palier atteint.
const BADGE_GLOBAL_STAGE_REWARDS = WATCH_STAGE_REWARDS;

// Récompenses de niveau global : la plupart des niveaux donnent un petit bonus
// d'XP globale, mais tous les 5 niveaux ce bonus est remplacé par du LoVeR'Cash.
// Chaque récompense n'est versée qu'une seule fois par niveau et par Prestige.
const GLOBAL_LEVEL_CASH_REWARDS = Object.freeze([
  { level:5, cash:5 }, { level:10, cash:5 }, { level:15, cash:10 },
  { level:20, cash:10 }, { level:25, cash:15 }, { level:30, cash:15 },
  { level:35, cash:20 }, { level:40, cash:20 }, { level:45, cash:25 },
  { level:50, cash:30 }, { level:55, cash:40 }
]);
const GLOBAL_LEVEL_CASH_LEVELS = new Set(GLOBAL_LEVEL_CASH_REWARDS.map(reward => reward.level));
const GLOBAL_LEVEL_XP_REWARDS = Object.freeze(
  Array.from({ length: 54 }, (_, index) => {
    const level = index + 2;
    if (GLOBAL_LEVEL_CASH_LEVELS.has(level)) return null;
    const xp = level <= 10 ? 10
      : level <= 20 ? 15
      : level <= 30 ? 20
      : level <= 40 ? 25
      : level <= 50 ? 30
      : 40;
    return { level, xp };
  }).filter(Boolean)
);

// Badge progressif basé sur le nombre de lives Twitch distincts réellement suivis.
// Un même live ne peut compter qu'une fois, même après une déconnexion/reconnexion.
const LIVE_ATTENDANCE_STAGES = Object.freeze([
  { count:1,   nextCount:5,   image:'/badges/attendance-1.webp', tier:'attendance-1', evolution:'Premier rendez-vous', titleKey:'reward_title_live_1',   titleName:'Premier rendez-vous', rewards:{ lovysXp:25,   globalXp:10,  cash:5 } },
  { count:5,   nextCount:10,  image:'/badges/attendance-2.webp', tier:'attendance-2', evolution:'Habitué',             titleKey:'reward_title_live_5',   titleName:'Habitué du live',     rewards:{ lovysXp:50,   globalXp:25,  cash:10 } },
  { count:10,  nextCount:25,  image:'/badges/attendance-3.webp', tier:'attendance-3', evolution:'Fidèle',              titleKey:'reward_title_live_10',  titleName:'Fidèle du direct',    rewards:{ lovysXp:100,  globalXp:50,  cash:20 } },
  { count:25,  nextCount:50,  image:'/badges/attendance-4.webp', tier:'attendance-4', evolution:'Pilier',              titleKey:'reward_title_live_25',  titleName:'Pilier du live',      rewards:{ lovysXp:200,  globalXp:100, cash:40 } },
  { count:50,  nextCount:100, image:'/badges/attendance-5.webp', tier:'attendance-5', evolution:'Toujours présent',    titleKey:'reward_title_live_50',  titleName:'Toujours présent',    rewards:{ lovysXp:350,  globalXp:175, cash:70 } },
  { count:100, nextCount:250, image:'/badges/attendance-6.webp', tier:'attendance-6', evolution:'Vétéran',             titleKey:'reward_title_live_100', titleName:'Vétéran du live',     rewards:{ lovysXp:600,  globalXp:300, cash:120 } },
  { count:250, nextCount:null,image:'/badges/attendance-7.webp', tier:'attendance-7', evolution:'Légende des lives',   titleKey:'reward_title_live_250', titleName:'Légende des lives',   rewards:{ lovysXp:1000, globalXp:500, cash:250 } }
]);

// Défis journaliers : petites récompenses pour encourager la régularité
// sans accélérer excessivement la progression globale.
const DAILY_CHALLENGE_TIMEZONE = 'Europe/Paris';

const DAILY_CHALLENGE_LIBRARY = {
  watch_30: { key:'watch_30', type:'watch', icon:'⏱️', title:'Mise en route', description:'Regarder 30 minutes de live aujourd’hui.', goal:1800, rewardCash:3, rewardGlobalXp:8, rewardLovysXp:0 },
  watch_60: { key:'watch_60', type:'watch', icon:'🔥', title:'Présence active', description:'Regarder 1 heure de live aujourd’hui.', goal:3600, rewardCash:5, rewardGlobalXp:15, rewardLovysXp:10 },
  watch_120: { key:'watch_120', type:'watch', icon:'⭐', title:'Fidèle du jour', description:'Regarder 2 heures de live aujourd’hui.', goal:7200, rewardCash:8, rewardGlobalXp:25, rewardLovysXp:20 },
  cash_10: { key:'cash_10', type:'cash', icon:'💰', title:'Récolte du jour', description:"Gagner 10 LoVeR'Cash grâce au live aujourd’hui.", goal:10, rewardCash:4, rewardGlobalXp:10, rewardLovysXp:0 },
  global_xp_25: { key:'global_xp_25', type:'global_xp', icon:'📈', title:'Progression régulière', description:'Gagner 25 XP globale grâce au live aujourd’hui.', goal:25, rewardCash:4, rewardGlobalXp:10, rewardLovysXp:15 }
};

function dailyChallengeDateKey(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: DAILY_CHALLENGE_TIMEZONE, year:'numeric', month:'2-digit', day:'2-digit' }).formatToParts(date);
  const values = Object.fromEntries(parts.filter(part => part.type !== 'literal').map(part => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function dailyChallengesForDate(dateKey = dailyChallengeDateKey()) {
  const numericDay = Number(String(dateKey).replaceAll('-', '')) || 0;
  const sets = [ ['watch_30','watch_60','cash_10'], ['watch_30','global_xp_25','watch_120'], ['watch_60','cash_10','global_xp_25'] ];
  return sets[numericDay % sets.length].map(key => ({ ...DAILY_CHALLENGE_LIBRARY[key] }));
}

function dailyChallengeByKey(key, dateKey = dailyChallengeDateKey()) {
  return dailyChallengesForDate(dateKey).find(item => item.key === key) || null;
}


// Roues de récompenses : une roue quotidienne toutes les 24 h et une roue bonus
// après 7 lives Twitch distincts auxquels le joueur a réellement assisté.
// Les jours sans live ne cassent rien : la progression reste acquise.
// Les tirages et les gains sont validés côté serveur.
const DAILY_WHEEL_REWARDS = Object.freeze([
  { key:'cash_5',        icon:'💰', label:"+5 LoVeR'Cash",              chance:20, type:'cash',       amount:5 },
  { key:'global_xp_10',  icon:'⭐', label:'+10 XP globale',              chance:18, type:'global_xp',  amount:10 },
  { key:'lovys_xp_15',   icon:'🐉', label:'+15 XP Lovys en réserve',     chance:18, type:'lovys_xp',   amount:15 },
  { key:'fragment_1',    icon:'🥚', label:"+1 Fragment d'œuf",          chance:14, type:'fragments',  amount:1 },
  { key:'cash_10',       icon:'💰', label:"+10 LoVeR'Cash",             chance:12, type:'cash',       amount:10 },
  { key:'global_xp_20',  icon:'⭐', label:'+20 XP globale',              chance:7,  type:'global_xp',  amount:20 },
  { key:'lovys_xp_25',   icon:'🐉', label:'+25 XP Lovys en réserve',     chance:6,  type:'lovys_xp',   amount:25 },
  { key:'boost_xp_1h',   icon:'⚡', label:'Booster XP Lovys ×2 · 1 h',   chance:5,  type:'inventory',  itemKey:'boost_xp_x2', amount:1 }
]);

const WEEKLY_WHEEL_REWARDS = Object.freeze([
  { key:'cash_25',       icon:'💰', label:"+25 LoVeR'Cash",             chance:20, type:'cash',       amount:25 },
  { key:'global_xp_50',  icon:'⭐', label:'+50 XP globale',              chance:18, type:'global_xp',  amount:50 },
  { key:'lovys_xp_75',   icon:'🐉', label:'+75 XP Lovys en réserve',     chance:17, type:'lovys_xp',   amount:75 },
  { key:'fragment_3',    icon:'🥚', label:"+3 Fragments d'œuf",         chance:15, type:'fragments',  amount:3 },
  { key:'boost_xp_1h',   icon:'⚡', label:'Booster XP Lovys ×2 · 1 h',   chance:10, type:'inventory',  itemKey:'boost_xp_x2', amount:1 },
  { key:'boost_cash_1h', icon:'💰', label:"Booster LoVeR'Cash ×2 · 1 h",chance:8,  type:'inventory',  itemKey:'boost_cash_x2', amount:1 },
  { key:'cash_50',       icon:'💎', label:"+50 LoVeR'Cash",             chance:7,  type:'cash',       amount:50 },
  { key:'mystery_egg',   icon:'🥚', label:'1 Œuf mystère',               chance:5,  type:'inventory',  itemKey:'mystery_egg', amount:1 }
]);

function publicWheelReward(reward) {
  return { key:reward.key, icon:reward.icon, label:reward.label, chance:reward.chance };
}

function weightedWheelReward(rewards) {
  const roll = crypto.randomInt(100);
  let cursor = 0;
  for (const reward of rewards) {
    cursor += Number(reward.chance || 0);
    if (roll < cursor) return reward;
  }
  return rewards[rewards.length - 1];
}

// La roue premium progresse uniquement avec des lives Twitch distincts réellement suivis.
async function syncRewardWheelState(client, userId) {
  await client.query(
    `INSERT INTO user_reward_wheels (user_id) VALUES ($1) ON CONFLICT (user_id) DO NOTHING`,
    [userId]
  );

  const result = await client.query(
    `SELECT user_id, daily_last_spin_at, weekly_last_spin_at, weekly_ready,
            weekly_live_checkpoint
     FROM user_reward_wheels
     WHERE user_id=$1
     FOR UPDATE`,
    [userId]
  );
  const state = result.rows[0];

  const attendanceResult = await client.query(
    `SELECT COUNT(*)::int AS count FROM user_live_attendance WHERE user_id=$1`,
    [userId]
  );
  const totalLiveAttendance = Math.max(0, Number(attendanceResult.rows[0]?.count || 0));
  const checkpoint = Math.max(0, Number(state.weekly_live_checkpoint || 0));
  const rawProgress = Math.max(0, totalLiveAttendance - checkpoint);
  const weeklyLiveProgress = Math.min(7, rawProgress);
  const weeklyReady = rawProgress >= 7;

  if (Boolean(state.weekly_ready) !== weeklyReady) {
    await client.query(
      `UPDATE user_reward_wheels
       SET weekly_ready=$2, updated_at=CURRENT_TIMESTAMP
       WHERE user_id=$1`,
      [userId, weeklyReady]
    );
  }

  return {
    ...state,
    weekly_ready: weeklyReady,
    weekly_live_progress: weeklyLiveProgress,
    total_live_attendance: totalLiveAttendance,
    weekly_live_checkpoint: checkpoint
  };
}

async function applyWheelReward(client, userId, accountId, reward) {
  if (reward.type === 'cash') {
    await client.query(
      `UPDATE users SET points=points+$2, lifetime_lovercash_earned=lifetime_lovercash_earned+$2, updated_at=CURRENT_TIMESTAMP WHERE id=$1`,
      [userId, reward.amount]
    );
  } else if (reward.type === 'global_xp') {
    await client.query(
      `UPDATE users SET global_xp=LEAST(global_xp+$2,$3), updated_at=CURRENT_TIMESTAMP WHERE id=$1`,
      [userId, reward.amount, globalThresholdForLevel(56)]
    );
  } else if (reward.type === 'lovys_xp') {
    await client.query(
      `UPDATE users SET pending_xp=pending_xp+$2, updated_at=CURRENT_TIMESTAMP WHERE id=$1`,
      [userId, reward.amount]
    );
  } else if (reward.type === 'fragments') {
    await client.query(
      `UPDATE users SET egg_fragments=egg_fragments+$2, updated_at=CURRENT_TIMESTAMP WHERE id=$1`,
      [userId, reward.amount]
    );
  } else if (reward.type === 'inventory' && reward.itemKey) {
    await client.query(
      `INSERT INTO shop_inventory (account_id,item_key,quantity) VALUES($1,$2,$3)
       ON CONFLICT (account_id,item_key) DO UPDATE SET quantity=shop_inventory.quantity+$3,purchased_at=CURRENT_TIMESTAMP`,
      [accountId, reward.itemKey, reward.amount || 1]
    );
  }
}


// Tracker Twitch : présence dans le chat pendant que la chaîne est en live.
// Ce n'est pas une mesure certifiée de lecture vidéo individuelle.
const TRACKER_INTERVAL_MS = 15 * 1000;
const TRACKER_MAX_GAP_SECONDS = 5 * 60;
const TRACKER_MAX_CREDIT_SECONDS = 3 * 60;
const TRACKER_SUB_SYNC_MS = 60 * 1000;
const LIVE_UPDATE_CLIENTS = new Set();
const LIVE_XP_OVERLAY_CLIENTS = new Set();

function pushLiveUpdate(type = 'game-update', payload = {}) {
  const message = `event: ${type}\ndata: ${JSON.stringify(payload)}\n\n`;
  if (type === 'live-boost-update') {
    const overlayPayload=Array.isArray(payload.items)?{serverNow:Number(payload.serverNow)||Date.now(),items:payload.items.filter(item=>['xp','cash','globalXp'].includes(item.key)).map(({key,multiplier,expiresAt})=>({key,multiplier,expiresAt}))}:{};
    for (const client of [...LIVE_XP_OVERLAY_CLIENTS]) {
      try { client.write(`event: boost-change\ndata: ${JSON.stringify(overlayPayload)}\n\n:${' '.repeat(8192)}\n\n`);client.flush?.(); }
      catch { LIVE_XP_OVERLAY_CLIENTS.delete(client); }
    }
  }
  for (const client of [...LIVE_UPDATE_CLIENTS]) {
    try {
      client.write(message);
    } catch {
      LIVE_UPDATE_CLIENTS.delete(client);
    }
  }
}


/* =========================================
   BASE DE DONNÉES POSTGRESQL
========================================= */

if (!process.env.DATABASE_URL) {
  console.error(
    'ERREUR : DATABASE_URL est manquant.'
  );

  process.exit(1);
}


const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});


pool.on('error', error => {
  console.error(
    'Erreur PostgreSQL inattendue :',
    error
  );
});


/* =========================================
   PROGRESSION
========================================= */

const LEVEL_XP = [
  0,
  1000,
  3500,
  10000
];


function estimateLovysLiveSeconds(remainingXp, baseXpPerHour, boosts, now = Date.now()) {
  let remaining = Math.max(0, Number(remainingXp));
  if (!Number.isFinite(remaining) || !(baseXpPerHour > 0)) return null;
  const active = boosts.filter(b => b.multiplier > 1 && new Date(b.expiresAt).getTime() > now)
    .map(b => ({multiplier:b.multiplier, seconds:(new Date(b.expiresAt).getTime()-now)/1000}));
  const stops = [...new Set(active.map(b => b.seconds))].sort((a,b)=>a-b);
  let elapsed = 0;
  for (const stop of [...stops, Infinity]) {
    const rate = baseXpPerHour / 3600 * active.filter(b => b.seconds > elapsed).reduce((m,b)=>m*b.multiplier,1);
    const duration = stop - elapsed;
    if (remaining <= rate * duration) return Math.ceil(elapsed + remaining / rate);
    remaining -= rate * duration;
    elapsed = stop;
  }
  return null;
}

function progressionFromXp(xp) {

  const value =
    Math.max(0, Number(xp) || 0);

  let level = 1;


  if (value >= LEVEL_XP[3]) {

    level = 50;

  }

  else if (value >= LEVEL_XP[2]) {

    level =
      25 +
      Math.min(
        24,
        Math.floor(
          (value - LEVEL_XP[2]) /
          (
            (LEVEL_XP[3] - LEVEL_XP[2]) /
            25
          )
        )
      );

  }

  else if (value >= LEVEL_XP[1]) {

    level =
      10 +
      Math.min(
        14,
        Math.floor(
          (value - LEVEL_XP[1]) /
          (
            (LEVEL_XP[2] - LEVEL_XP[1]) /
            15
          )
        )
      );

  }

  else {

    level =
      1 +
      Math.min(
        8,
        Math.floor(
          value /
          (LEVEL_XP[1] / 9)
        )
      );

  }


  let currentThreshold = 0;

  let nextThreshold =
    LEVEL_XP[1];


  if (
    level >= 10 &&
    level < 25
  ) {

    currentThreshold =
      LEVEL_XP[1] +
      (level - 10) *
      (
        (LEVEL_XP[2] - LEVEL_XP[1]) /
        15
      );

    nextThreshold =
      currentThreshold +
      (
        (LEVEL_XP[2] - LEVEL_XP[1]) /
        15
      );

  }

  else if (
    level >= 25 &&
    level < 50
  ) {

    currentThreshold =
      LEVEL_XP[2] +
      (level - 25) *
      (
        (LEVEL_XP[3] - LEVEL_XP[2]) /
        25
      );

    nextThreshold =
      currentThreshold +
      (
        (LEVEL_XP[3] - LEVEL_XP[2]) /
        25
      );

  }

  else if (level < 10) {

    currentThreshold =
      (level - 1) *
      (LEVEL_XP[1] / 9);

    nextThreshold =
      level *
      (LEVEL_XP[1] / 9);

  }

  else {

    currentThreshold =
      LEVEL_XP[3];

    nextThreshold =
      LEVEL_XP[3];

  }


  const evolution =
    level >= 50
      ? 3
      : level >= 25
      ? 2
      : level >= 10
      ? 1
      : 0;


  const evolutionName = [
    'Forme de départ',
    'Évolution 1',
    'Évolution 2',
    'Forme finale'
  ][evolution];


  return {

    level,

    evolution,

    evolutionName,

    currentThreshold,

    nextThreshold,

    maxLevel:
      level >= 50

  };

}


function globalThresholdForLevel(targetLevel) {
  if (targetLevel <= 1) return 0;
  const steps = targetLevel - 1;
  return Math.round((steps * (500 + (steps - 1) * 50)) / 2);
}

function globalProgressionFromXp(xp) {
  const value = Math.max(0, Number(xp) || 0);
  const maxLevel = 55;
  let level = 1;
  while (level < maxLevel && value >= globalThresholdForLevel(level + 1)) level += 1;
  const currentThreshold = globalThresholdForLevel(level);
  const nextThreshold = level >= maxLevel ? globalThresholdForLevel(56) : globalThresholdForLevel(level + 1);
  return { level, currentThreshold, nextThreshold, maxLevel: level >= maxLevel, prestigeReady: level >= maxLevel && value >= nextThreshold,
    xpIntoLevel: Math.max(0, Math.min(value, nextThreshold) - currentThreshold), xpForNextLevel: Math.max(1, nextThreshold-currentThreshold), xpRemaining: Math.max(0,nextThreshold-value) };
}

const GLOBAL_LEVEL_GRADES = [
  {min:1,max:5,name:'Recrue',icon:'◆',color:'#9aa3b8',rewardKey:'reward_title_recrue'},
  {min:6,max:10,name:'Éclaireur',icon:'◇',color:'#67c7ff',rewardKey:'reward_title_eclaireur'},
  {min:11,max:15,name:'Veilleur',icon:'✦',color:'#7dd8d0',rewardKey:'reward_title_veilleur'},
  {min:16,max:20,name:'Gardien',icon:'⬟',color:'#6fe09b',rewardKey:'reward_title_gardien'},
  {min:21,max:25,name:'Vétéran',icon:'✪',color:'#c2a7ff',rewardKey:'reward_title_veteran'},
  {min:26,max:30,name:'Élite',icon:'✧',color:'#a878ff',rewardKey:'reward_title_elite'},
  {min:31,max:35,name:'Commandant',icon:'⬢',color:'#ff9c69',rewardKey:'reward_title_commandant'},
  {min:36,max:40,name:'Maître de terrain',icon:'✹',color:'#ff7b7b',rewardKey:'reward_title_maitre_terrain'},
  {min:41,max:45,name:'Champion',icon:'★',color:'#f3c85b',rewardKey:'reward_title_champion'},
  {min:46,max:50,name:'Légende',icon:'✶',color:'#ffd86b',rewardKey:'reward_title_legende_grade'},
  {min:51,max:55,name:'Mythique',icon:'♛',color:'#fff0a8',rewardKey:'reward_title_mythique'}
];
function globalGradeForLevel(level){ return GLOBAL_LEVEL_GRADES.find(g=>level>=g.min&&level<=g.max)||GLOBAL_LEVEL_GRADES[0]; }
const GLOBAL_LOVYS_XP_REWARDS = [
  {level:5,xp:50},
  {level:10,xp:75},
  {level:15,xp:100},
  {level:20,xp:125},
  {level:25,xp:150},
  {level:30,xp:175},
  {level:35,xp:200},
  {level:40,xp:225},
  {level:45,xp:250},
  {level:50,xp:300},
  {level:55,xp:400}
];
const CREATURE_MILESTONES=[{level:5,power:5,label:'Éveil'},{level:10,power:5,label:'Instinct'},{level:15,power:5,label:'Affinité'},{level:20,power:5,label:'Maîtrise'},{level:25,power:10,label:'Ascendant'},{level:30,power:10,label:'Harmonie'},{level:40,power:15,label:'Domination'},{level:50,power:20,label:'Apogée'}];
function creatureMilestonePower(level){return CREATURE_MILESTONES.filter(m=>level>=m.level).reduce((a,m)=>a+m.power,0);}

/* =========================================
   CRÉATURES
========================================= */

const EGG_HATCH_SECONDS = 6 * 60 * 60;

const RARITY_RATES = {
  Commun: 70,
  Rare: 22,
  'Épique': 7,
  Mythique: 1
};

const creatures = [
  {
    id: 'plant',
    name: 'Mossy',
    type: 'Verdance',
    rarity: 'Commun',
    dropRate: 17.5,
    dropWeight: 1750,
    description: 'Petit hybride écureuil et végétation, lié à la Verdance.'
  },
  {
    id: 'water',
    name: 'Nyméa',
    type: 'Abyssal',
    rarity: 'Commun',
    dropRate: 17.5,
    dropWeight: 1750,
    description: 'Petit Lovys mystique venu des profondeurs abyssales.'
  },
  {
    id: 'voltis',
    name: 'Voltis',
    type: 'Foudre',
    rarity: 'Commun',
    dropRate: 17.5,
    dropWeight: 1750,
    description: 'Petit Lovys vif parcouru d’une énergie électrique.'
  },
  {
    id: 'brumee',
    name: 'Brumee',
    type: 'Brume',
    rarity: 'Commun',
    dropRate: 17.5,
    dropWeight: 1750,
    description: 'Lovys léger et mystérieux qui se déplace dans la brume.'
  },
  {
    id: 'fire',
    name: 'Flamby',
    type: 'Cendre',
    rarity: 'Rare',
    dropRate: 8,
    dropWeight: 800,
    description: 'Petit renard-dragon marqué par une énergie de Cendre.'
  },
  {
    id: 'crysal',
    name: 'Crysal',
    type: 'Cristal',
    rarity: 'Rare',
    dropRate: 7,
    dropWeight: 700,
    description: 'Lovys minéral dont le corps reflète une lumière cristalline.'
  },
  {
    id: 'ferox',
    name: 'Ferox',
    type: 'Forge',
    rarity: 'Rare',
    dropRate: 7,
    dropWeight: 700,
    description: 'Lovys robuste façonné par la chaleur et le métal.'
  },
  {
    id: 'dark',
    name: 'Nocty',
    type: 'Néant',
    rarity: 'Épique',
    dropRate: 3.5,
    dropWeight: 350,
    description: 'Petit félin mystérieux lié aux profondeurs du Néant.'
  },
  {
    id: 'solka',
    name: 'Solka',
    type: 'Solaire',
    rarity: 'Épique',
    dropRate: 3.5,
    dropWeight: 350,
    description: 'Lovys rayonnant nourri par une énergie solaire intense.'
  },
  {
    id: 'dream',
    name: 'Mimo',
    type: 'Mirage',
    rarity: 'Mythique',
    dropRate: 1,
    dropWeight: 100,
    description: 'Lovys céleste extrêmement rare né d’un Mirage.'
  }
];

async function syncGlobalLevelRewards(clientOrPool, userId, accountId, globalXp) {
  if (!userId || !accountId) return { lovysXpGranted:0, pendingXpGranted:0, globalXpGranted:0, cashGranted:0, globalXp:Number(globalXp||0) };
  let effectiveGlobalXp = Math.max(0, Number(globalXp) || 0);
  let progression = globalProgressionFromXp(effectiveGlobalXp);
  const rewardKeys = GLOBAL_LEVEL_GRADES.filter(g => progression.level >= g.min).map(g => g.rewardKey);
  if (progression.level >= 55) rewardKeys.push('reward_bg_level55');
  for (const key of rewardKeys) {
    await clientOrPool.query(`INSERT INTO shop_inventory (account_id,item_key,quantity) VALUES ($1,$2,1) ON CONFLICT (account_id,item_key) DO NOTHING`, [accountId,key]);
  }

  const userStateResult = await clientOrPool.query(`SELECT creature_id, prestige FROM users WHERE id=$1 LIMIT 1`, [userId]);
  const userState = userStateResult.rows[0];
  if (!userState) return { lovysXpGranted:0, pendingXpGranted:0, globalXpGranted:0, cashGranted:0, globalXp:effectiveGlobalXp };

  // Récompense chaque niveau atteint une seule fois. Si le bonus fait franchir
  // un nouveau niveau, ce nouveau palier est lui aussi traité dans la même synchro.
  let globalXpGranted = 0;
  let changed = true;
  while (changed) {
    changed = false;
    progression = globalProgressionFromXp(effectiveGlobalXp);
    for (const reward of GLOBAL_LEVEL_XP_REWARDS) {
      if (reward.level > progression.level) continue;
      const inserted = await clientOrPool.query(
        `INSERT INTO user_global_xp_level_rewards (user_id,prestige,level,xp_amount)
         VALUES ($1,$2,$3,$4)
         ON CONFLICT (user_id,prestige,level) DO NOTHING
         RETURNING xp_amount`,
        [userId, Number(userState.prestige || 0), reward.level, reward.xp]
      );
      if (!inserted.rowCount) continue;
      const amount = Math.max(0, Number(inserted.rows[0]?.xp_amount || reward.xp || 0));
      if (!amount) continue;
      effectiveGlobalXp = Math.min(globalThresholdForLevel(56), effectiveGlobalXp + amount);
      globalXpGranted += amount;
      changed = true;
    }
  }
  if (globalXpGranted > 0) {
    await clientOrPool.query(
      `UPDATE users SET global_xp=$2, updated_at=CURRENT_TIMESTAMP WHERE id=$1`,
      [userId, effectiveGlobalXp]
    );
  }
  progression = globalProgressionFromXp(effectiveGlobalXp);

  // Tous les 5 niveaux, le bonus d'XP globale est remplacé par du LoVeR'Cash.
  let cashGranted = 0;
  for (const reward of GLOBAL_LEVEL_CASH_REWARDS) {
    if (progression.level < reward.level) continue;
    const inserted = await clientOrPool.query(
      `INSERT INTO user_global_cash_level_rewards (user_id,prestige,level,cash_amount)
       VALUES ($1,$2,$3,$4)
       ON CONFLICT (user_id,prestige,level) DO NOTHING
       RETURNING cash_amount`,
      [userId, Number(userState.prestige || 0), reward.level, reward.cash]
    );
    if (!inserted.rowCount) continue;
    cashGranted += Math.max(0, Number(inserted.rows[0]?.cash_amount || reward.cash || 0));
  }
  if (cashGranted > 0) {
    await clientOrPool.query(
      `UPDATE users SET points=points+$2, lifetime_lovercash_earned=lifetime_lovercash_earned+$2, updated_at=CURRENT_TIMESTAMP WHERE id=$1`,
      [userId, cashGranted]
    );
  }

  const finalRewardKeys = GLOBAL_LEVEL_GRADES.filter(g => progression.level >= g.min).map(g => g.rewardKey);
  if (progression.level >= 55) finalRewardKeys.push('reward_bg_level55');
  for (const key of finalRewardKeys) {
    await clientOrPool.query(
      `INSERT INTO shop_inventory (account_id,item_key,quantity) VALUES ($1,$2,1) ON CONFLICT (account_id,item_key) DO NOTHING`,
      [accountId,key]
    );
  }

  let lovysXpGranted = 0;
  let pendingXpGranted = 0;
  for (const reward of GLOBAL_LOVYS_XP_REWARDS) {
    if (progression.level < reward.level) continue;
    const inserted = await clientOrPool.query(
      `INSERT INTO user_global_lovys_xp_rewards (user_id,prestige,level,xp_amount)
       VALUES ($1,$2,$3,$4)
       ON CONFLICT (user_id,prestige,level) DO NOTHING
       RETURNING xp_amount`,
      [userId, Number(userState.prestige || 0), reward.level, reward.xp]
    );
    if (!inserted.rowCount) continue;
    const amount = Number(inserted.rows[0]?.xp_amount || reward.xp || 0);
    // Les bonus d'XP Lovys des niveaux globaux sont placés dans une réserve.
    // Le joueur choisit ensuite quand les transférer à son Lovys actif.
    pendingXpGranted += amount;
  }

  if (pendingXpGranted > 0) {
    await clientOrPool.query(
      `UPDATE users
       SET pending_xp=pending_xp+$2,
           updated_at=CURRENT_TIMESTAMP
       WHERE id=$1`,
      [userId, pendingXpGranted]
    );
  }

  return { lovysXpGranted:0, pendingXpGranted, globalXpGranted, cashGranted, globalXp:effectiveGlobalXp };
}


function typeMultiplier(attacker,defender){const beats={Verdance:'Abyssal',Abyssal:'Cendre',Cendre:'Verdance',Foudre:'Abyssal',Néant:'Mirage',Mirage:'Néant',Solaire:'Néant',Forge:'Cristal',Cristal:'Foudre'};if(beats[attacker]===defender)return 1.25;if(beats[defender]===attacker)return .8;return 1;}
function creatureBattleStats(user){const prog=progressionFromXp(Number(user.xp||0));const creature=creatures.find(c=>c.id===user.creature_id)||creatures[0];return buildLovysBattleStats({creature,level:prog.level,rank:Number(user.rank||1)});}

function eggState(user) {
  const watched = Math.max(0, Number(user?.watch_seconds) || 0);
  const hatched = Boolean(user?.creature_id);

  return {
    type: 'standard',
    name: 'Œuf en incubation',
    hatchSeconds: EGG_HATCH_SECONDS,
    watchedSeconds: Math.min(watched, EGG_HATCH_SECONDS),
    remainingSeconds: Math.max(0, EGG_HATCH_SECONDS - watched),
    progress: Math.min(100, (watched / EGG_HATCH_SECONDS) * 100),
    ready: !hatched && watched >= EGG_HATCH_SECONDS,
    hatched,
    rarityRates: RARITY_RATES
  };
}

function rollStandardEgg() {
  // 10 000 unités = 100 %. Le tirage est fait côté serveur.
  const roll = crypto.randomInt(10000);
  let cursor = 0;

  for (const creature of creatures) {
    cursor += creature.dropWeight;
    if (roll < cursor) return creature;
  }

  // Sécurité théorique si la table de poids est modifiée plus tard.
  return creatures[creatures.length - 1];
}

/* =========================================
   BOUTIQUE WATCH GAME
========================================= */
const SHOP_ITEMS = [
  { key:'title_noctambule', category:'title', subcategory:'violet', name:'Noctambule', price:100, color:'#b785ff', description:'Un titre violet pour les habitués des lives tardifs.' },
  { key:'title_collectionneur', category:'title', subcategory:'blue', name:'Collectionneuse', price:120, color:'#4fd1c5', description:'Un titre pour celles qui aiment compléter leur collection.' },
  { key:'title_gardien_live', category:'title', subcategory:'blue', name:'Gardien du live', price:150, color:'#62a8ff', description:'Un titre bleu pour les fidèles de la chaîne.' },
  { key:'title_legende', category:'title', subcategory:'gold', name:'Légende de LoVeR Watch Game', price:250, color:'#f3c85b', description:'Un titre doré pour se faire remarquer.' },
  { key:'title_agent_fantome', category:'title', subcategory:'silver', name:'Agent fantôme', price:170, color:'#e7edf8', description:'Un titre sobre et élégant inspiré des agents les plus discrets.' },
  { key:'title_commandant_chat', category:'title', subcategory:'blue', name:'Commandante du chat', price:190, color:'#7ab8ff', description:'Pour celles qui mènent la discussion pendant les lives.' },
  { key:'title_oracle_nocturne', category:'title', subcategory:'violet', name:'Oracle nocturne', price:220, color:'#c28cff', description:'Un titre mystique pour les viewers du soir.' },
  { key:'title_gardien_couvoir', category:'title', subcategory:'green', name:'Gardien du couvoir', price:230, color:'#69e3a7', description:'Parfait pour les passionnés d’œufs et de compagnons.' },
  { key:'title_icone_stream', category:'title', subcategory:'pink', name:'Icône du stream', price:280, color:'#ff8ad9', description:'Un titre flashy pour briller sur la carte joueur.' },
  { key:'title_veilleur_azur', category:'title', subcategory:'blue', name:'Veilleur azur', price:320, color:'#79c8ff', description:'Un titre céleste pour les fidèles de LoVeR Watch Game.' },
  { key:'title_chasseur_oeufs', category:'title', subcategory:'green', name:'Chasseuse d’œufs', price:340, color:'#8ce26b', description:'Pour les joueuses qui ne laissent jamais un incubateur vide.' },
  { key:'title_braise_royale', category:'title', subcategory:'red', name:'Braise royale', price:380, color:'#ff8a63', description:'Un titre rouge incandescent pour un profil qui se démarque.' },
  { key:'title_etoile_rose', category:'title', subcategory:'pink', name:'Étoile rose', price:400, color:'#ff95ef', description:'Un titre lumineux et pétillant pour les profils les plus stylés.' },
  { key:'title_roi_arene', category:'title', subcategory:'gold', name:'Reine de l’arène', price:500, color:'#f4cd67', description:"Un titre doré premium réservé aux plus grosses collectionneuses de LoVeR'Cash." },
  { key:'title_souverain_live', category:'title', subcategory:'gold', name:'Souverain du live', price:600, color:'#ffd86b', description:'Un grand titre doré pour les profils les plus prestigieux.' },
  { key:'reward_title_recrue', category:'title', subcategory:'silver', name:'Recrue de LoVeR Watch Game', price:0, color:'#9aa3b8', description:'Débloqué au niveau global 1.', rewardOnly:true },
  { key:'reward_title_eclaireur', category:'title', subcategory:'blue', name:'Éclaireur du Live', price:0, color:'#67c7ff', description:'Débloqué au niveau global 6.', rewardOnly:true },
  { key:'reward_title_veilleur', category:'title', subcategory:'blue', name:'Veilleur du Live', price:0, color:'#7dd8d0', description:'Débloqué au niveau global 11.', rewardOnly:true },
  { key:'reward_title_gardien', category:'title', subcategory:'green', name:'Gardien du Direct', price:0, color:'#6fe09b', description:'Débloqué au niveau global 16.', rewardOnly:true },
  { key:'reward_title_veteran', category:'title', subcategory:'violet', name:'Vétéran du Stream', price:0, color:'#c2a7ff', description:'Débloqué au niveau global 21.', rewardOnly:true },
  { key:'reward_title_elite', category:'title', subcategory:'violet', name:'Élite de LoVeR Watch Game', price:0, color:'#a878ff', description:'Débloqué au niveau global 26.', rewardOnly:true },
  { key:'reward_title_commandant', category:'title', subcategory:'red', name:'Commandant du Live', price:0, color:'#ff9c69', description:'Débloqué au niveau global 31.', rewardOnly:true },
  { key:'reward_title_maitre_terrain', category:'title', subcategory:'red', name:'Maître de terrain', price:0, color:'#ff7b7b', description:'Débloqué au niveau global 36.', rewardOnly:true },
  { key:'reward_title_champion', category:'title', subcategory:'gold', name:'Champion du Direct', price:0, color:'#f3c85b', description:'Débloqué au niveau global 41.', rewardOnly:true },
  { key:'reward_title_legende_grade', category:'title', subcategory:'gold', name:'Légende du Live', price:0, color:'#ffd86b', description:'Débloqué au niveau global 46.', rewardOnly:true },
  { key:'reward_title_mythique', category:'title', subcategory:'gold', name:'Mythique de LoVeR Watch Game', price:0, color:'#fff0a8', description:'Débloqué au niveau global 51.', rewardOnly:true },
  { key:'reward_title_live_1', category:'title', subcategory:'silver', name:'Premier rendez-vous', price:0, color:'#d9e2ef', description:'Débloqué en assistant à 1 live.', rewardOnly:true },
  { key:'reward_title_live_5', category:'title', subcategory:'blue', name:'Habitué du live', price:0, color:'#79c8ff', description:'Débloqué en assistant à 5 lives.', rewardOnly:true },
  { key:'reward_title_live_10', category:'title', subcategory:'green', name:'Fidèle du direct', price:0, color:'#69e3a7', description:'Débloqué en assistant à 10 lives.', rewardOnly:true },
  { key:'reward_title_live_25', category:'title', subcategory:'violet', name:'Pilier du live', price:0, color:'#b785ff', description:'Débloqué en assistant à 25 lives.', rewardOnly:true },
  { key:'reward_title_live_50', category:'title', subcategory:'pink', name:'Toujours présent', price:0, color:'#ff8ad9', description:'Débloqué en assistant à 50 lives.', rewardOnly:true },
  { key:'reward_title_live_100', category:'title', subcategory:'gold', name:'Vétéran du live', price:0, color:'#f3c85b', description:'Débloqué en assistant à 100 lives.', rewardOnly:true },
  { key:'reward_title_live_250', category:'title', subcategory:'gold', name:'Légende des lives', price:0, color:'#ffd86b', description:'Débloqué en assistant à 250 lives.', rewardOnly:true },
  { key:'reward_bg_level55', category:'background', subcategory:'special', name:'Ascension', price:0, preview:'level55', description:'Fond exclusif débloqué au niveau global 55.', rewardOnly:true },
  { key:'bg_nebula', category:'background', subcategory:'classic', name:'Nébuleuse violette', price:150, preview:'violet', description:'Fond violet profond pour ta carte de visite.' },
  { key:'bg_starry', category:'background', subcategory:'classic', name:'Nuit étoilée', price:220, preview:'starry', description:'Fond sombre avec une ambiance étoilée.' },
  { key:'bg_ember', category:'background', subcategory:'classic', name:'Braises', price:300, preview:'ember', description:'Fond chaud inspiré des braises et du feu.' },
  { key:'bg_dawn_violet', category:'background', subcategory:'classic', name:'Aube violette', price:150, preview:'dawn-violet', description:'Dégradé violet doux avec une lumière d’aube.' },
  { key:'bg_blue_twilight', category:'background', subcategory:'classic', name:'Crépuscule bleu', price:150, preview:'blue-twilight', description:'Bleu nuit profond traversé par une lueur froide.' },
  { key:'bg_dark_mist', category:'background', subcategory:'classic', name:'Brume sombre', price:150, preview:'dark-mist', description:'Brume gris-bleu sobre pour une carte discrète.' },
  { key:'bg_cosmic_glow', category:'background', subcategory:'classic', name:'Éclat cosmique', price:220, preview:'cosmic-glow', description:'Lueurs cosmiques et particules lumineuses.' },
  { key:'bg_purple_storm', category:'background', subcategory:'classic', name:'Tempête pourpre', price:220, preview:'purple-storm', description:'Énergie pourpre sombre avec éclats électriques.' },
  { key:'bg_constellation', category:'background', subcategory:'classic', name:'Constellation', price:220, preview:'constellation', description:'Ciel profond parsemé d’étoiles et de constellations.' },
  { key:'bg_royal_night', category:'background', subcategory:'classic', name:'Nuit royale', price:300, preview:'royal-night', description:'Bleu royal profond avec de subtils reflets dorés.' },
  { key:'bg_obsidian', category:'background', subcategory:'classic', name:'Obsidienne', price:300, preview:'obsidian', description:'Noir minéral premium avec reflets froids.' },
  { key:'bg_aurora', category:'background', subcategory:'classic', name:'Aurore boréale', price:300, preview:'aurora', description:'Fond vert et bleu inspiré des aurores polaires.' },
  { key:'bg_camo_kawaii', category:'background', subcategory:'classic', name:'Camouflage kawaii', price:220, preview:'camo-kawaii', description:'Camouflage rose pastel, blanc et gris doux, ponctué de petits cœurs.' },
  { key:'bg_rose_horizon', category:'background', subcategory:'classic', name:'Horizon rosé', price:220, preview:'rose-horizon', description:'Dégradé rose et violet doux pour une carte lumineuse.' },
  { key:'bg_sapphire_wave', category:'background', subcategory:'classic', name:'Vague saphir', price:250, preview:'sapphire-wave', description:'Reflets bleus profonds avec une touche océanique.' },
  { key:'bg_golden_sunset', category:'background', subcategory:'classic', name:'Coucher doré', price:300, preview:'golden-sunset', description:'Lueurs chaudes inspirées d’un coucher de soleil doré.' },
  { key:'frame_violet', category:'frame', subcategory:'classic', name:'Cadre violet', price:150, preview:'violet', description:'Encadrement violet lumineux.' },
  { key:'frame_cyan', category:'frame', subcategory:'classic', name:'Cadre cyan', price:200, preview:'cyan', description:'Encadrement cyan électrique.' },
  { key:'frame_silver', category:'frame', subcategory:'classic', name:'Cadre argenté', price:180, preview:'silver', description:'Encadrement argenté net et élégant.' },
  { key:'frame_crimson', category:'frame', subcategory:'classic', name:'Cadre crimson', price:200, preview:'crimson', description:'Encadrement rouge profond avec lueur énergique.' },
  { key:'frame_emerald', category:'frame', subcategory:'classic', name:'Cadre émeraude', price:200, preview:'emerald', description:'Encadrement vert lumineux et raffiné.' },
  { key:'frame_gold', category:'frame', subcategory:'classic', name:'Cadre doré', price:250, preview:'gold', description:'Encadrement doré premium.' },
  { key:'frame_rose', category:'frame', subcategory:'classic', name:'Cadre rose néon', price:220, preview:'rose', description:'Encadrement rose vif avec éclat néon.' },
  { key:'frame_obsidian', category:'frame', subcategory:'classic', name:'Cadre obsidienne', price:250, preview:'obsidian', description:'Encadrement sombre premium aux reflets froids.' },
  { key:'frame_royal', category:'frame', subcategory:'classic', name:'Cadre royal', price:300, preview:'royal', description:'Encadrement bleu royal aux accents dorés.' },
  { key:'frame_sapphire', category:'frame', subcategory:'classic', name:'Cadre saphir', price:230, preview:'sapphire', description:'Encadrement bleu saphir profond et lumineux.' },
  { key:'frame_amber', category:'frame', subcategory:'classic', name:'Cadre ambre', price:230, preview:'amber', description:'Encadrement ambré chaleureux avec une lueur dorée.' },
  { key:'frame_amethyst', category:'frame', subcategory:'classic', name:'Cadre améthyste', price:240, preview:'amethyst', description:'Encadrement violet gemme pour un rendu chic.' },
  { key:'frame_ruby', category:'frame', subcategory:'classic', name:'Cadre rubis', price:250, preview:'ruby', description:'Encadrement rubis brillant avec belle intensité.' },
  { key:'frame_ice', category:'frame', subcategory:'classic', name:'Cadre glace', price:250, preview:'ice', description:'Encadrement froid et lumineux inspiré des cristaux.' },
  { key:'frame_pearl', category:'frame', subcategory:'classic', name:'Cadre perle', price:280, preview:'pearl', description:'Encadrement clair et élégant avec reflets nacrés.' },
  { key:'avatarframe_violet', category:'avatar_frame', subcategory:'classic', name:'Cadre de profil violet', price:100, preview:'violet', description:'Contour violet lumineux autour de ta photo de profil.' },
  { key:'avatarframe_cyan', category:'avatar_frame', subcategory:'classic', name:'Cadre de profil cyan', price:120, preview:'cyan', description:'Contour cyan électrique pour ton avatar.' },
  { key:'avatarframe_silver', category:'avatar_frame', subcategory:'classic', name:'Cadre de profil argenté', price:140, preview:'silver', description:'Contour argenté propre et élégant.' },
  { key:'avatarframe_emerald', category:'avatar_frame', subcategory:'classic', name:'Cadre de profil émeraude', price:150, preview:'emerald', description:'Contour vert raffiné avec lueur douce.' },
  { key:'avatarframe_hearts', category:'avatar_frame', subcategory:'classic', name:'Petits cœurs', price:160, preview:'hearts', description:'Un contour rose fin et deux petits cœurs autour de ta photo de profil.' },
  { key:'avatarframe_rose', category:'avatar_frame', subcategory:'classic', name:'Cadre de profil rose néon', price:160, preview:'rose', description:'Contour rose vif pour un style flashy.' },
  { key:'avatarframe_gold', category:'avatar_frame', subcategory:'classic', name:'Cadre de profil doré', price:180, preview:'gold', description:'Contour doré premium pour mettre ton profil en valeur.' },
  { key:'avatarframe_crimson', category:'avatar_frame', subcategory:'classic', name:'Cadre de profil cramoisi', price:170, preview:'crimson', description:'Contour rouge intense pour un style plus agressif.' },
  { key:'avatarframe_royal', category:'avatar_frame', subcategory:'classic', name:'Cadre de profil royal', price:200, preview:'royal', description:'Contour bleu royal élégant et lumineux.' },
  { key:'avatarframe_obsidian', category:'avatar_frame', subcategory:'classic', name:'Cadre de profil obsidienne', price:200, preview:'obsidian', description:'Contour sombre et chic pour un profil sobre.' },
  { key:'avatarframe_sapphire', category:'avatar_frame', subcategory:'classic', name:'Cadre de profil saphir', price:210, preview:'sapphire', description:'Contour bleu saphir profond et éclatant.' },
  { key:'avatarframe_amber', category:'avatar_frame', subcategory:'classic', name:'Cadre de profil ambre', price:210, preview:'amber', description:'Contour ambré chaleureux avec une belle lueur.' },
  { key:'avatarframe_amethyst', category:'avatar_frame', subcategory:'classic', name:'Cadre de profil améthyste', price:220, preview:'amethyst', description:'Contour violet gemme pour un rendu premium.' },
  { key:'avatarframe_ruby', category:'avatar_frame', subcategory:'classic', name:'Cadre de profil rubis', price:230, preview:'ruby', description:'Contour rubis brillant pour un profil plus rare.' },
  { key:'avatarframe_ice', category:'avatar_frame', subcategory:'classic', name:'Cadre de profil glace', price:240, preview:'ice', description:'Contour froid et lumineux inspiré des cristaux.' },
  { key:'avatarframe_pearl', category:'avatar_frame', subcategory:'classic', name:'Cadre de profil perle', price:250, preview:'pearl', description:'Contour nacré élégant pour un profil lumineux.' },
  // Collections kawaii, arcade et ambiances PvE.
  {"key":"bg_tiny_hearts","category":"background","subcategory":"classic","name":"Cœurs pastel","price":180,"preview":"hearts","collection":"atelier","description":"De petits cœurs roses sur un fond prune doux."},
  {"key":"bg_soft_clouds","category":"background","subcategory":"classic","name":"Nuages lilas","price":200,"preview":"clouds","collection":"atelier","description":"Des nuages pastel discrets dans une ambiance lilas."},
  {"key":"bg_retro_grid","category":"background","subcategory":"classic","name":"Pixels du soir","price":220,"preview":"retro","collection":"atelier","description":"Une grille rétro violette avec des accents cyan."},
  {"key":"bg_forest_sparks","category":"background","subcategory":"classic","name":"Éclats de forêt","price":250,"preview":"forest","collection":"atelier","description":"Des feuilles sombres et quelques lucioles vertes."},
  {"key":"bg_volcanic_cracks","category":"background","subcategory":"classic","name":"Cœur volcanique","price":250,"preview":"volcano","collection":"atelier","description":"Des fissures de braise sur un fond charbon."},
  {"key":"bg_night_runes","category":"background","subcategory":"classic","name":"Runes nocturnes","price":250,"preview":"runes","collection":"atelier","description":"Des symboles géométriques lilas dans la nuit."},
  {"key":"frame_pastel","category":"frame","subcategory":"classic","name":"Rose poudré","price":180,"preview":"pastel","collection":"atelier","description":"Un encadrement fin assorti à la collection rose poudré."},
  {"key":"frame_arcade","category":"frame","subcategory":"classic","name":"Arcade cyan","price":220,"preview":"arcade","collection":"atelier","description":"Un encadrement fin assorti à la collection arcade cyan."},
  {"key":"frame_moss","category":"frame","subcategory":"classic","name":"Mousse enchantée","price":220,"preview":"moss","collection":"atelier","description":"Un encadrement fin assorti à la collection mousse enchantée."},
  {"key":"frame_cinder","category":"frame","subcategory":"classic","name":"Braise douce","price":220,"preview":"cinder","collection":"atelier","description":"Un encadrement fin assorti à la collection braise douce."},
  {"key":"avatarframe_stars","category":"avatar_frame","subcategory":"classic","name":"Petites étoiles","price":160,"preview":"stars","collection":"atelier","description":"Un contour fin avec deux accents discrets autour de ton avatar."},
  {"key":"avatarframe_crystals","category":"avatar_frame","subcategory":"classic","name":"Éclats de cristal","price":180,"preview":"crystals","collection":"atelier","description":"Un contour fin avec deux accents discrets autour de ton avatar."},
  {"key":"avatarframe_pixels","category":"avatar_frame","subcategory":"classic","name":"Pixels rétro","price":170,"preview":"pixels","collection":"atelier","description":"Un contour fin avec deux accents discrets autour de ton avatar."},
  {"key":"avatarframe_embers","category":"avatar_frame","subcategory":"classic","name":"Étincelles de braise","price":180,"preview":"embers","collection":"atelier","description":"Un contour fin avec deux accents discrets autour de ton avatar."},
  {"key":"title_coeur_tendre","category":"title","subcategory":"pink","name":"Cœur tendre","price":120,"color":"#f0b3cf","collection":"atelier","description":"Un titre cosmétique pour personnaliser ta carte de visite."},
  {"key":"title_esprit_kawaii","category":"title","subcategory":"pink","name":"Esprit kawaii","price":160,"color":"#edb8ed","collection":"atelier","description":"Un titre cosmétique pour personnaliser ta carte de visite."},
  {"key":"title_reveur_lilas","category":"title","subcategory":"violet","name":"Rêveur lilas","price":180,"color":"#ccb8ef","collection":"atelier","description":"Un titre cosmétique pour personnaliser ta carte de visite."},
  {"key":"title_ame_arcade","category":"title","subcategory":"blue","name":"Âme d’arcade","price":180,"color":"#92d8ed","collection":"atelier","description":"Un titre cosmétique pour personnaliser ta carte de visite."},
  {"key":"title_ami_sous_bois","category":"title","subcategory":"green","name":"Ami du sous-bois","price":180,"color":"#a4d5ae","collection":"atelier","description":"Un titre cosmétique pour personnaliser ta carte de visite."},
  {"key":"title_etincelle_nocturne","category":"title","subcategory":"violet","name":"Étincelle nocturne","price":200,"color":"#c1b7f2","collection":"atelier","description":"Un titre cosmétique pour personnaliser ta carte de visite."},
  { key:'boost_xp_x2', category:'object', name:'Booster XP x2', price:150, icon:'⚡', description:'Double l’XP de visionnage pendant 1 heure.', consumable:true },
  { key:'boost_cash_x2', category:'object', name:"Booster LoVeR'Cash x2", price:0, icon:'💰', description:"Récompense de la roue bonus : double le LoVeR'Cash gagné pendant 1 heure de live.", consumable:true, rewardOnly:true },
  { key:'incubator_skip_30', category:'object', name:'Accélérateur 30 min', price:120, icon:'⏱️', description:'Retire jusqu’à 30 minutes au temps restant de l’œuf de ton choix.', consumable:true },
  { key:'mystery_egg', category:'object', name:'Œuf mystère', price:200, icon:'🥚', description:'Un œuf supplémentaire à placer dans un emplacement libre de l’incubateur.', consumable:true }
];

const MASTER_TITLE = { key:'title_master_game', category:'title', subcategory:'gold', name:'Maître du jeu', price:0, color:'#f3c85b', description:'Titre exclusif réservé au diffuseur.', exclusive:true };
const TITLE_NONE_KEY = '__none__';

function shopItemByKey(key) {
  return SHOP_ITEMS.find(item => item.key === key) || null;
}

function titleCosmeticFor(twitchId, equippedTitleKey) {
  const broadcasterId = String(process.env.TWITCH_BROADCASTER_ID || '').trim();
  if (equippedTitleKey === TITLE_NONE_KEY) return null;
  if (equippedTitleKey) {
    if (equippedTitleKey === MASTER_TITLE.key && broadcasterId && String(twitchId || '') === broadcasterId) return MASTER_TITLE;
    const item = shopItemByKey(equippedTitleKey);
    if (item?.category === 'title') return item;
  }
  if (broadcasterId && String(twitchId || '') === broadcasterId) return MASTER_TITLE;
  return null;
}

function validCosmeticKey(key, category) {
  if (!key) return null;
  const item = shopItemByKey(key);
  return item?.category === category ? item.key : null;
}

/* =========================================
   CRÉATION DES TABLES
========================================= */

async function initDatabase() {

  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (

      id SERIAL PRIMARY KEY,

      twitch_id TEXT UNIQUE NOT NULL,

      login TEXT NOT NULL,

      display_name TEXT NOT NULL,

      is_sub BOOLEAN NOT NULL
        DEFAULT FALSE,

      creature_id TEXT,

      xp DOUBLE PRECISION NOT NULL
        DEFAULT 0,

      points DOUBLE PRECISION NOT NULL
        DEFAULT 0,

      watch_seconds BIGINT NOT NULL
        DEFAULT 0,

      created_at TIMESTAMPTZ NOT NULL
        DEFAULT CURRENT_TIMESTAMP,

      updated_at TIMESTAMPTZ NOT NULL
        DEFAULT CURRENT_TIMESTAMP

    );
  `);
    await pool.query(`
    ALTER TABLE users
    ADD COLUMN IF NOT EXISTS pending_xp DOUBLE PRECISION NOT NULL DEFAULT 0
  `);

  await pool.query(`
    ALTER TABLE users
    ADD COLUMN IF NOT EXISTS profile_image_url TEXT
  `);

  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS global_xp DOUBLE PRECISION NOT NULL DEFAULT 0`);
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS lifetime_lovercash_earned DOUBLE PRECISION NOT NULL DEFAULT 0`);
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS lifetime_lovercash_spent DOUBLE PRECISION NOT NULL DEFAULT 0`);
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS prestige INTEGER NOT NULL DEFAULT 0`);
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS total_lovys_hatched INTEGER NOT NULL DEFAULT 0`);
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS progress_reset_at TIMESTAMPTZ`);
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS egg_fragments INTEGER NOT NULL DEFAULT 0`);
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS universal_lovys_fragments INTEGER NOT NULL DEFAULT 0`);
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS last_live_seen_at TIMESTAMPTZ`);
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS away_lovys_xp DOUBLE PRECISION NOT NULL DEFAULT 0`);
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS away_global_xp DOUBLE PRECISION NOT NULL DEFAULT 0`);
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS away_lovercash DOUBLE PRECISION NOT NULL DEFAULT 0`);
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS away_watch_seconds BIGINT NOT NULL DEFAULT 0`);
  await pool.query(`CREATE TABLE IF NOT EXISTS user_game_tabs (
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    tab_id TEXT NOT NULL,
    last_seen_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY(user_id,tab_id)
  )`);
  await pool.query(`CREATE INDEX IF NOT EXISTS user_game_tabs_recent_idx ON user_game_tabs(user_id,last_seen_at)`);
  await pool.query(`DELETE FROM user_game_tabs WHERE last_seen_at < CURRENT_TIMESTAMP - INTERVAL '2 days'`);
  // Temps ajouté artificiellement au premier œuf : exclu du classement Visionnage.
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS incubator_accelerated_seconds BIGINT NOT NULL DEFAULT 0`);

  // Migration douce pour les joueurs déjà présents : le niveau global reprend
  // leur ancien temps de visionnage au taux de base de 50 XP globale / heure.
  await pool.query(`
    UPDATE users
    SET global_xp = (watch_seconds::double precision / 3600.0) * $1
    WHERE global_xp = 0 AND watch_seconds > 0
  `, [GLOBAL_XP_PER_HOUR]);


  // On initialise le total historique au minimum avec le solde actuel.
  // Les achats passés ne sont pas reconstructibles précisément, mais à partir
  // de cette version tous les gains et toutes les dépenses sont comptabilisés.
  await pool.query(`
    UPDATE users
    SET lifetime_lovercash_earned = points
    WHERE lifetime_lovercash_earned = 0 AND points > 0
  `);

  // Migration rétroactive : avant l'ajout de pending_xp, certaines récompenses
  // de badges pouvaient être stockées directement dans xp alors que l'œuf
  // n'était pas encore éclos. Le tracker ne crédite pas d'XP de visionnage
  // avant l'éclosion, donc toute XP présente ici peut être déplacée sans
  // perdre la progression. Cette migration est idempotente : après passage,
  // xp vaut 0 et ne sera pas déplacée une seconde fois.
  await pool.query(`
    UPDATE users
    SET pending_xp = pending_xp + xp,
        xp = 0,
        updated_at = CURRENT_TIMESTAMP
    WHERE creature_id IS NULL
      AND xp > 0
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS accounts (
      id SERIAL PRIMARY KEY,

      email TEXT UNIQUE NOT NULL,

      username TEXT UNIQUE NOT NULL,

      password_hash TEXT NOT NULL,

      twitch_id TEXT UNIQUE,

      created_at TIMESTAMPTZ NOT NULL
        DEFAULT CURRENT_TIMESTAMP,

      updated_at TIMESTAMPTZ NOT NULL
        DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await pool.query(`CREATE TABLE IF NOT EXISTS game_feedback (
    id BIGSERIAL PRIMARY KEY,
    account_id BIGINT REFERENCES accounts(id) ON DELETE SET NULL,
    player_name TEXT NOT NULL,
    kind TEXT NOT NULL CHECK(kind IN ('bug','idea')),
    page TEXT NOT NULL,
    description TEXT NOT NULL,
    screenshot BYTEA,
    screenshot_mime TEXT,
    status TEXT NOT NULL DEFAULT 'new' CHECK(status IN ('new','in_progress','resolved')),
    discord_status TEXT NOT NULL DEFAULT 'waiting',
    discord_sent_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`);
  await pool.query(`ALTER TABLE game_feedback ADD COLUMN IF NOT EXISTS discord_message_id TEXT`);
  await pool.query(`ALTER TABLE game_feedback ADD COLUMN IF NOT EXISTS discord_error TEXT`);
  await pool.query(`ALTER TABLE game_feedback ADD COLUMN IF NOT EXISTS platform TEXT NOT NULL DEFAULT 'unknown'`);
  await pool.query(`CREATE INDEX IF NOT EXISTS game_feedback_account_date ON game_feedback(account_id,created_at)`);

  await pool.query(`ALTER TABLE accounts ADD COLUMN IF NOT EXISTS community_intro_seen BOOLEAN NOT NULL DEFAULT FALSE`);
  await pool.query(`ALTER TABLE accounts ADD COLUMN IF NOT EXISTS twitch_panel_enabled BOOLEAN NOT NULL DEFAULT FALSE`);

  // Les comptes déjà existants sont considérés comme ayant déjà vu l'introduction.
  // Les nouvelles inscriptions passent explicitement cette valeur à FALSE.
  await pool.query(`
    ALTER TABLE accounts
    ADD COLUMN IF NOT EXISTS game_intro_seen BOOLEAN NOT NULL DEFAULT TRUE
  `);


  await pool.query(`
    ALTER TABLE accounts
    ADD COLUMN IF NOT EXISTS badge_showcase_public BOOLEAN NOT NULL DEFAULT TRUE
  `);

  await pool.query(`
    ALTER TABLE accounts
    ADD COLUMN IF NOT EXISTS badge_showcase_theme TEXT NOT NULL DEFAULT 'classic'
  `);

  // Liaison Discord pour la mission "Membre de la communauté".
  // Le badge reste acquis après une vérification réussie.
  await pool.query(`
    ALTER TABLE accounts
    ADD COLUMN IF NOT EXISTS discord_user_id TEXT
  `);

  await pool.query(`
    ALTER TABLE accounts
    ADD COLUMN IF NOT EXISTS discord_username TEXT
  `);

  await pool.query(`
    ALTER TABLE accounts
    ADD COLUMN IF NOT EXISTS discord_member_verified BOOLEAN NOT NULL DEFAULT FALSE
  `);

  await pool.query(`
    ALTER TABLE accounts
    ADD COLUMN IF NOT EXISTS discord_verified_at TIMESTAMPTZ
  `);

  await pool.query(`ALTER TABLE accounts ADD COLUMN IF NOT EXISTS equipped_title_key TEXT`);
  await pool.query(`ALTER TABLE accounts ADD COLUMN IF NOT EXISTS equipped_background_key TEXT`);
  await pool.query(`ALTER TABLE accounts ADD COLUMN IF NOT EXISTS equipped_frame_key TEXT`);
  await pool.query(`ALTER TABLE accounts ADD COLUMN IF NOT EXISTS equipped_avatar_frame_key TEXT`);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS shop_inventory (
      account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
      item_key TEXT NOT NULL,
      quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity >= 0),
      purchased_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (account_id, item_key)
    )
  `);


  await pool.query(`
    CREATE TABLE IF NOT EXISTS user_incubator_eggs (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      slot INTEGER NOT NULL CHECK (slot BETWEEN 1 AND 3),
      egg_key TEXT NOT NULL DEFAULT 'mystery_egg',
      watched_seconds BIGINT NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'incubating' CHECK (status IN ('incubating','ready')),
      placed_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE (user_id, slot)
    )
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS user_incubator_eggs_user_idx
    ON user_incubator_eggs (user_id)
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS user_lovys (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      creature_id TEXT NOT NULL,
      xp DOUBLE PRECISION NOT NULL DEFAULT 0,
      is_active BOOLEAN NOT NULL DEFAULT FALSE,
      origin TEXT NOT NULL DEFAULT 'egg',
      hatched_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS user_lovys_user_idx ON user_lovys (user_id)`);
  await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS user_lovys_one_active_idx ON user_lovys (user_id) WHERE is_active = TRUE`);
  // V153 — compteur total d'éclosions. On initialise les anciens comptes avec
  // le nombre de Lovys actuellement connus, puis chaque nouvelle éclosion l'incrémente.
  await pool.query(`UPDATE users u SET total_lovys_hatched = GREATEST(COALESCE(u.total_lovys_hatched,0), (SELECT COUNT(*)::int FROM user_lovys ul WHERE ul.user_id=u.id))`);

  // V105 — rangs et fragments propres à chaque Lovys.
  await pool.query(`ALTER TABLE user_lovys ADD COLUMN IF NOT EXISTS fragments INTEGER NOT NULL DEFAULT 0`);
  await pool.query(`ALTER TABLE user_lovys ADD COLUMN IF NOT EXISTS rank INTEGER NOT NULL DEFAULT 1`);
  await pool.query(`UPDATE user_lovys SET rank=GREATEST(1,LEAST(5,rank)), fragments=GREATEST(0,fragments)`);

  // Les anciennes collections pouvaient contenir plusieurs fois le même Lovys.
  // On garde l'exemplaire le plus pertinent et on convertit chaque doublon historique en fragments.
  await pool.query(`
    WITH grouped AS (
      SELECT user_id, creature_id,
             (ARRAY_AGG(id ORDER BY is_active DESC, xp DESC, id ASC))[1] AS keep_id,
             MAX(xp) AS max_xp,
             BOOL_OR(is_active) AS any_active,
             COUNT(*)::int AS copies
      FROM user_lovys
      GROUP BY user_id, creature_id
      HAVING COUNT(*) > 1
    )
    UPDATE user_lovys l
    SET xp=g.max_xp,
        is_active=g.any_active,
        fragments=l.fragments + (g.copies-1) * CASE l.creature_id
          WHEN 'fire' THEN 15 WHEN 'crysal' THEN 15 WHEN 'ferox' THEN 15
          WHEN 'dark' THEN 25 WHEN 'solka' THEN 25 WHEN 'dream' THEN 40
          ELSE 10 END,
        updated_at=CURRENT_TIMESTAMP
    FROM grouped g
    WHERE l.id=g.keep_id
  `);
  await pool.query(`
    WITH ranked AS (
      SELECT id, ROW_NUMBER() OVER(PARTITION BY user_id,creature_id ORDER BY is_active DESC,xp DESC,id ASC) AS rn
      FROM user_lovys
    )
    DELETE FROM user_lovys l USING ranked r WHERE l.id=r.id AND r.rn>1
  `);
  await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS user_lovys_unique_creature_idx ON user_lovys(user_id,creature_id)`);
  await pool.query(`UPDATE users u SET creature_id=l.creature_id,xp=l.xp,updated_at=CURRENT_TIMESTAMP FROM user_lovys l WHERE l.user_id=u.id AND l.is_active=TRUE AND (u.creature_id IS DISTINCT FROM l.creature_id OR u.xp IS DISTINCT FROM l.xp)`);

  // Migration douce : le Lovys actif historique rejoint la collection.
  await pool.query(`
    INSERT INTO user_lovys (user_id, creature_id, xp, is_active, origin)
    SELECT u.id, u.creature_id, u.xp, TRUE, 'legacy'
    FROM users u
    WHERE u.creature_id IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM user_lovys l WHERE l.user_id=u.id)
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS user_active_boosts (
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      boost_key TEXT NOT NULL,
      expires_at TIMESTAMPTZ NOT NULL,
      PRIMARY KEY (user_id, boost_key)
    )
  `);

  await pool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS accounts_discord_user_id_unique
    ON accounts (discord_user_id)
    WHERE discord_user_id IS NOT NULL
  `);

  // Le compte diffuseur garde le pseudo officiel LoVeRDoSe.
  // Cette mise à jour est sans effet si un autre compte utilise déjà ce pseudo.
  const broadcasterIdForProfile = String(process.env.TWITCH_BROADCASTER_ID || '').trim();
  if (broadcasterIdForProfile) {
    await pool.query(
      `
      UPDATE accounts a
      SET username = 'LoVeRDoSe',
          updated_at = CURRENT_TIMESTAMP
      WHERE a.twitch_id = $1
        AND NOT EXISTS (
          SELECT 1
          FROM accounts other
          WHERE other.id <> a.id
            AND LOWER(other.username) = LOWER('LoVeRDoSe')
        )
      `,
      [broadcasterIdForProfile]
    );

    await pool.query(
      `
      UPDATE users
      SET display_name = 'LoVeRDoSe',
          updated_at = CURRENT_TIMESTAMP
      WHERE twitch_id = $1
      `,
      [broadcasterIdForProfile]
    );

    // Mode test propriétaire : tant que le diffuseur n'a pas encore fait éclore
    // son premier Lovys, son œuf de départ est directement prêt à éclore.
    await pool.query(
      `UPDATE users
       SET watch_seconds = GREATEST(COALESCE(watch_seconds,0), $2),
           updated_at = CURRENT_TIMESTAMP
       WHERE twitch_id = $1 AND creature_id IS NULL`,
      [broadcasterIdForProfile, EGG_HATCH_SECONDS]
    );

  }


  await pool.query(`
    CREATE TABLE IF NOT EXISTS sessions_watch (

      user_id INTEGER PRIMARY KEY
        REFERENCES users(id)
        ON DELETE CASCADE,

      last_heartbeat BIGINT NOT NULL

    );
  `);


  await pool.query(`
    CREATE TABLE IF NOT EXISTS twitch_tracker_auth (
      id SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
      twitch_user_id TEXT NOT NULL,
      access_token_enc TEXT NOT NULL,
      refresh_token_enc TEXT NOT NULL,
      scopes TEXT NOT NULL DEFAULT '',
      expires_at TIMESTAMPTZ,
      last_poll_at TIMESTAMPTZ,
      last_success_at TIMESTAMPTZ,
      last_sub_sync_at TIMESTAMPTZ,
      last_live BOOLEAN NOT NULL DEFAULT FALSE,
      last_chatter_count INTEGER NOT NULL DEFAULT 0,
      last_matched_count INTEGER NOT NULL DEFAULT 0,
      last_error TEXT,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);


  await pool.query(`
    ALTER TABLE twitch_tracker_auth
    ADD COLUMN IF NOT EXISTS special_mode TEXT;
  `);
  await pool.query(`ALTER TABLE twitch_tracker_auth ADD COLUMN IF NOT EXISTS last_viewer_count INTEGER NOT NULL DEFAULT 0`);


  await pool.query(`
    CREATE TABLE IF NOT EXISTS user_game_watch (
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      game_id TEXT NOT NULL,
      game_name TEXT NOT NULL,
      watch_seconds BIGINT NOT NULL DEFAULT 0,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (user_id, game_id)
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS user_badges (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      badge_key TEXT NOT NULL,
      game_id TEXT NOT NULL,
      game_name TEXT NOT NULL,
      tier TEXT NOT NULL,
      threshold_hours INTEGER NOT NULL,
      equipped_slot INTEGER,
      unlocked_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE (user_id, badge_key),
      CHECK (equipped_slot IS NULL OR (equipped_slot BETWEEN 1 AND 6))
    );
  `);


  // Animations de badges déjà vues, partagées entre les appareils du joueur.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS user_badge_celebrations (
      user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      seen_signatures TEXT[] NOT NULL DEFAULT '{}'
    );
  `);

  await pool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS user_badges_equipped_slot_unique
    ON user_badges (user_id, equipped_slot)
    WHERE equipped_slot IS NOT NULL;
  `);


  await pool.query(`
    ALTER TABLE user_badges
    ADD COLUMN IF NOT EXISTS badge_name TEXT;
  `);

  await pool.query(`
    ALTER TABLE user_badges
    ADD COLUMN IF NOT EXISTS badge_image TEXT;
  `);


  await pool.query(`
    ALTER TABLE user_badges
    ADD COLUMN IF NOT EXISTS badge_challenge TEXT;
  `);

  await pool.query(`
    ALTER TABLE user_badges
    ADD COLUMN IF NOT EXISTS leaderboard_slot INTEGER;
  `);


  await pool.query(`
    CREATE TABLE IF NOT EXISTS user_xp_rewards (
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      reward_key TEXT NOT NULL,
      xp_amount DOUBLE PRECISION NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (user_id, reward_key)
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS user_daily_activity (
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      activity_date DATE NOT NULL,
      watch_seconds BIGINT NOT NULL DEFAULT 0,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (user_id, activity_date)
    );
  `);

  await pool.query(`ALTER TABLE user_daily_activity ADD COLUMN IF NOT EXISTS global_xp_earned DOUBLE PRECISION NOT NULL DEFAULT 0`);
  await pool.query(`ALTER TABLE user_daily_activity ADD COLUMN IF NOT EXISTS lovercash_earned DOUBLE PRECISION NOT NULL DEFAULT 0`);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS user_daily_challenge_state (
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      challenge_date DATE NOT NULL,
      challenge_key TEXT NOT NULL,
      completed_at TIMESTAMPTZ,
      claimed_at TIMESTAMPTZ,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (user_id, challenge_date, challenge_key)
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS user_global_xp_level_rewards (
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      prestige INTEGER NOT NULL DEFAULT 0,
      level INTEGER NOT NULL,
      xp_amount DOUBLE PRECISION NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (user_id, prestige, level)
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS user_global_cash_level_rewards (
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      prestige INTEGER NOT NULL DEFAULT 0,
      level INTEGER NOT NULL,
      cash_amount DOUBLE PRECISION NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (user_id, prestige, level)
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS user_live_attendance (
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      stream_id TEXT NOT NULL,
      attended_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (user_id, stream_id)
    );
  `);

  // Les anciens lives restent acquis ; les nouveaux doivent atteindre l'objectif de présence.
  await pool.query(`ALTER TABLE user_live_attendance ADD COLUMN IF NOT EXISTS badge_watch_seconds BIGINT NOT NULL DEFAULT 3600`);
  await pool.query(`ALTER TABLE user_live_attendance ALTER COLUMN badge_watch_seconds SET DEFAULT 0`);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS user_global_lovys_xp_rewards (
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      prestige INTEGER NOT NULL DEFAULT 0,
      level INTEGER NOT NULL,
      xp_amount DOUBLE PRECISION NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (user_id, prestige, level)
    );
  `);



  await pool.query(`
    CREATE TABLE IF NOT EXISTS user_reward_wheels (
      user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      daily_last_spin_at TIMESTAMPTZ,
      weekly_last_spin_at TIMESTAMPTZ,
      login_streak INTEGER NOT NULL DEFAULT 0 CHECK (login_streak BETWEEN 0 AND 7),
      last_connection_date DATE,
      weekly_live_checkpoint INTEGER NOT NULL DEFAULT 0,
      weekly_ready BOOLEAN NOT NULL DEFAULT FALSE,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await pool.query(`
    ALTER TABLE user_reward_wheels
    ADD COLUMN IF NOT EXISTS weekly_live_checkpoint INTEGER NOT NULL DEFAULT 0
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS user_reward_wheel_spins (
      id BIGSERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      wheel_type TEXT NOT NULL CHECK (wheel_type IN ('daily','weekly')),
      reward_key TEXT NOT NULL,
      reward_label TEXT NOT NULL,
      spun_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS user_reward_wheel_spins_user_idx ON user_reward_wheel_spins (user_id, spun_at DESC)`);

  await pool.query(`CREATE TABLE IF NOT EXISTS user_pve_progress (
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    fight_key TEXT NOT NULL, wins INTEGER NOT NULL DEFAULT 0, attempts INTEGER NOT NULL DEFAULT 0,
    first_won_at TIMESTAMPTZ, last_fought_at TIMESTAMPTZ, PRIMARY KEY (user_id,fight_key)
  )`);
  await pool.query(`CREATE TABLE IF NOT EXISTS user_pve_battles (
    user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    fight_key TEXT NOT NULL,
    state_json JSONB NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`);

  await pool.query(`CREATE TABLE IF NOT EXISTS user_combat_reports (
    id BIGSERIAL PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    fight_key TEXT NOT NULL, result TEXT NOT NULL, creature_level INTEGER NOT NULL, enemy_level INTEGER NOT NULL,
    creature_power INTEGER NOT NULL, enemy_power INTEGER NOT NULL, reward_creature_xp DOUBLE PRECISION NOT NULL DEFAULT 0,
    reward_global_xp DOUBLE PRECISION NOT NULL DEFAULT 0, reward_fragments INTEGER NOT NULL DEFAULT 0,
    report_json JSONB, created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`);


  // V107 — journal d'administration : toute correction sensible reste traçable.
  await pool.query(`CREATE TABLE IF NOT EXISTS admin_audit_log (
    id BIGSERIAL PRIMARY KEY,
    admin_account_id INTEGER,
    target_account_id INTEGER,
    action_key TEXT NOT NULL,
    summary TEXT NOT NULL,
    details_json JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`);
  await pool.query(`CREATE INDEX IF NOT EXISTS admin_audit_log_created_idx ON admin_audit_log(created_at DESC)`);
  await initWizebotAlerts(pool);
  await initPlayerHistory(pool);

  // V107 — boosts live globaux pilotés depuis le panneau Événements.
  await pool.query(`CREATE TABLE IF NOT EXISTS admin_live_boosts (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    xp_multiplier DOUBLE PRECISION NOT NULL DEFAULT 1,
    cash_multiplier DOUBLE PRECISION NOT NULL DEFAULT 1,
    global_xp_multiplier DOUBLE PRECISION NOT NULL DEFAULT 1,
    expires_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`);
  await pool.query('ALTER TABLE admin_live_boosts ADD COLUMN IF NOT EXISTS streamdeck_xp_expires_at TIMESTAMPTZ');
  await pool.query('ALTER TABLE admin_live_boosts ADD COLUMN IF NOT EXISTS streamdeck_cash_expires_at TIMESTAMPTZ, ADD COLUMN IF NOT EXISTS streamdeck_global_xp_expires_at TIMESTAMPTZ');
  await pool.query(`INSERT INTO admin_live_boosts(id) VALUES(1) ON CONFLICT(id) DO NOTHING`);

  // V108 — les statistiques de combat sont définies uniquement dans le code.
  // Nettoie l'ancienne table d'override V107 si elle existe.
  await initLiveBoostTimeline(pool);
  await pool.query(`DROP TABLE IF EXISTS admin_lovys_balance`);

  // V109 — Lobby communautaire et bourse d'échanges.
  // Les objets proposés sont retirés de l'inventaire dès la publication : ils sont donc réservés
  // jusqu'à acceptation, annulation ou expiration de l'offre.
  await pool.query(`CREATE TABLE IF NOT EXISTS trade_offers (
    id BIGSERIAL PRIMARY KEY,
    creator_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    creator_account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    offer_type TEXT NOT NULL CHECK (offer_type IN ('fragment','egg')),
    offer_creature_id TEXT,
    offer_quantity INTEGER NOT NULL CHECK (offer_quantity > 0),
    status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','completed','cancelled','expired')),
    expires_at TIMESTAMPTZ NOT NULL,
    accepted_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    accepted_option_id BIGINT,
    accepted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`);
  await pool.query(`CREATE INDEX IF NOT EXISTS trade_offers_status_idx ON trade_offers(status, expires_at, created_at DESC)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS trade_offers_creator_idx ON trade_offers(creator_user_id, created_at DESC)`);
  await pool.query(`CREATE TABLE IF NOT EXISTS trade_offer_options (
    id BIGSERIAL PRIMARY KEY,
    offer_id BIGINT NOT NULL REFERENCES trade_offers(id) ON DELETE CASCADE,
    receive_type TEXT NOT NULL CHECK (receive_type IN ('fragment','egg')),
    receive_creature_id TEXT,
    receive_quantity INTEGER NOT NULL CHECK (receive_quantity > 0),
    position INTEGER NOT NULL DEFAULT 1 CHECK (position BETWEEN 1 AND 3)
  )`);
  await pool.query(`CREATE INDEX IF NOT EXISTS trade_offer_options_offer_idx ON trade_offer_options(offer_id, position)`);
  // Échanges ciblés : tous les éléments des deux lots sont transférés ensemble.
  await pool.query(`CREATE TABLE IF NOT EXISTS player_trade_offers (
    id BIGSERIAL PRIMARY KEY,
    creator_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    creator_account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    target_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    offered JSONB NOT NULL CHECK (jsonb_typeof(offered)='array' AND jsonb_array_length(offered) BETWEEN 1 AND 3),
    requested JSONB NOT NULL CHECK (jsonb_typeof(requested)='array' AND jsonb_array_length(requested) BETWEEN 1 AND 3),
    status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','completed','cancelled','declined','expired')),
    expires_at TIMESTAMPTZ NOT NULL,
    accepted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`);
  await pool.query(`CREATE INDEX IF NOT EXISTS player_trade_participants_idx ON player_trade_offers(target_user_id,creator_user_id,status,expires_at)`);
  await pool.query(`CREATE TABLE IF NOT EXISTS trade_wishes (user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, creature_id TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY(user_id,creature_id))`);
  await pool.query(`CREATE TABLE IF NOT EXISTS trade_notifications (id BIGSERIAL PRIMARY KEY,user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,message TEXT NOT NULL,created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,read_at TIMESTAMPTZ)`);
  await pool.query(`ALTER TABLE trade_notifications ADD COLUMN IF NOT EXISTS event_type TEXT`);
  await pool.query(`ALTER TABLE trade_notifications ADD COLUMN IF NOT EXISTS offer_id BIGINT REFERENCES trade_offers(id) ON DELETE CASCADE`);
  await pool.query(`ALTER TABLE trade_notifications ADD COLUMN IF NOT EXISTS popup_seen_at TIMESTAMPTZ`);
  await pool.query(`ALTER TABLE trade_notifications ADD COLUMN IF NOT EXISTS player_trade_id BIGINT REFERENCES player_trade_offers(id) ON DELETE CASCADE`);
  await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS trade_notifications_expired_offer_idx ON trade_notifications(offer_id) WHERE event_type='offer_expired'`);


  await pool.query(`
    ALTER TABLE user_badges
    DROP CONSTRAINT IF EXISTS user_badges_leaderboard_slot_check;
  `);

  await pool.query(`
    ALTER TABLE user_badges
    ADD CONSTRAINT user_badges_leaderboard_slot_check
    CHECK (leaderboard_slot IS NULL OR leaderboard_slot BETWEEN 1 AND 2);
  `);

  await pool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS user_badges_leaderboard_slot_unique
    ON user_badges (user_id, leaderboard_slot)
    WHERE leaderboard_slot IS NOT NULL;
  `);

  // V424 — Tous les visuels de badges sont centralisés, sans toucher aux acquis.
  await pool.query(`
    UPDATE user_badges SET badge_image = CASE
      WHEN badge_key='challenge:dofus:gardien-emeraude:50h' THEN '/badges/watch-dofus-' ||
        CASE WHEN threshold_hours>=500 THEN '5' WHEN threshold_hours>=250 THEN '4' WHEN threshold_hours>=100 THEN '3' WHEN threshold_hours>=50 THEN '2' ELSE '1' END || '.webp'
      WHEN badge_key='challenge:palworld:maitre-des-spheres:50h' THEN '/badges/watch-palworld-' ||
        CASE WHEN threshold_hours>=500 THEN '5' WHEN threshold_hours>=250 THEN '4' WHEN threshold_hours>=100 THEN '3' WHEN threshold_hours>=50 THEN '2' ELSE '1' END || '.webp'
      WHEN badge_key='challenge:mw4:operateur-elite:50h' THEN '/badges/watch-mw4-' ||
        CASE WHEN threshold_hours>=500 THEN '5' WHEN threshold_hours>=250 THEN '4' WHEN threshold_hours>=100 THEN '3' WHEN threshold_hours>=50 THEN '2' ELSE '1' END || '.webp'
      WHEN badge_key='mission:zombie:maitre-des-morts:25h' THEN '/badges/watch-zombie-' ||
        CASE WHEN threshold_hours>=500 THEN '5' WHEN threshold_hours>=250 THEN '4' WHEN threshold_hours>=100 THEN '3' WHEN threshold_hours>=50 THEN '2' ELSE '1' END || '.webp'
      WHEN badge_key='mission:global:fidele-chaine' THEN '/badges/watch-global-' ||
        CASE WHEN threshold_hours>=500 THEN '5' WHEN threshold_hours>=250 THEN '4' WHEN threshold_hours>=100 THEN '3' WHEN threshold_hours>=50 THEN '2' ELSE '1' END || '.webp'
      WHEN badge_key='mission:attendance:lives-assistes' THEN '/badges/attendance-' ||
        CASE WHEN threshold_hours>=250 THEN '7' WHEN threshold_hours>=100 THEN '6' WHEN threshold_hours>=50 THEN '5' WHEN threshold_hours>=25 THEN '4' WHEN threshold_hours>=10 THEN '3' WHEN threshold_hours>=5 THEN '2' ELSE '1' END || '.webp'
      WHEN badge_key='mission:discord:membre-communaute' THEN '/badges/discord-1.webp'
      WHEN badge_key='mission:instagram:communaute' THEN '/badges/instagram-1.webp'
      WHEN badge_key='mission:tiktok:communaute' THEN '/badges/tiktok-1.webp'
      WHEN badge_key='mission:sub:soutien-absolu' THEN '/badges/subscription-1.webp'
      ELSE badge_image END
    WHERE badge_key IN ('challenge:dofus:gardien-emeraude:50h','challenge:palworld:maitre-des-spheres:50h',
      'challenge:mw4:operateur-elite:50h','mission:zombie:maitre-des-morts:25h','mission:global:fidele-chaine',
      'mission:attendance:lives-assistes','mission:discord:membre-communaute','mission:instagram:communaute',
      'mission:tiktok:communaute','mission:sub:soutien-absolu')
  `);

  console.log(
    'PostgreSQL connecté ✅'
  );

}


/* =========================================
   DISCORD OAUTH / VÉRIFICATION SERVEUR
========================================= */

function discordRedirectUri() {
  return `${BASE_URL}/auth/discord/callback`;
}

function discordAuthUrl(state) {
  const params = new URLSearchParams({
    client_id: String(process.env.DISCORD_CLIENT_ID || ''),
    response_type: 'code',
    redirect_uri: discordRedirectUri(),
    scope: 'identify guilds.members.read',
    state,
    prompt: 'consent'
  });
  return `https://discord.com/oauth2/authorize?${params.toString()}`;
}

async function discordApi(path, accessToken) {
  const response = await fetch(`https://discord.com/api/v10${path}`, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  return response;
}

/* =========================================
   TWITCH
========================================= */

function twitchAuthUrl(state) {

  const params =
    new URLSearchParams({

      client_id:
        process.env.TWITCH_CLIENT_ID,

      redirect_uri:
        `${BASE_URL}/auth/twitch/callback`,

      response_type:
        'code',

      scope:
        'user:read:subscriptions',

      state

    });


  return (
    'https://id.twitch.tv/oauth2/authorize?' +
    params
  );

}


async function twitchFetch(
  path,
  token,
  options = {}
) {

  const r =
    await fetch(
      `https://api.twitch.tv/helix${path}`,
      {

        ...options,

        headers: {

          'Client-Id':
            process.env.TWITCH_CLIENT_ID,

          Authorization:
            `Bearer ${token}`,

          ...(options.headers || {})

        }

      }
    );


  if (!r.ok) {

    throw new Error(
      `Twitch API ${r.status}: ` +
      await r.text()
    );

  }


  return r.json();

}



/* =========================================
   TRACKER TWITCH
========================================= */

function trackerRedirectUri() {
  return `${BASE_URL}/auth/twitch/tracker/callback`;
}

function trackerAuthUrl(state) {
  const params = new URLSearchParams({
    client_id: process.env.TWITCH_CLIENT_ID,
    redirect_uri: trackerRedirectUri(),
    response_type: 'code',
    scope: 'moderator:read:chatters channel:read:subscriptions',
    state
  });

  return 'https://id.twitch.tv/oauth2/authorize?' + params;
}

function trackerCryptoKey() {
  return crypto.createHash('sha256').update(SESSION_SECRET).digest();
}

function encryptTrackerSecret(value) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', trackerCryptoKey(), iv);
  const encrypted = Buffer.concat([
    cipher.update(String(value || ''), 'utf8'),
    cipher.final()
  ]);
  const tag = cipher.getAuthTag();

  return [
    'v1',
    iv.toString('base64url'),
    tag.toString('base64url'),
    encrypted.toString('base64url')
  ].join(':');
}

function decryptTrackerSecret(value) {
  const [version, ivText, tagText, encryptedText] = String(value || '').split(':');
  if (version !== 'v1' || !ivText || !tagText || !encryptedText) {
    throw new Error('Jeton tracker illisible. Reconnecte le tracker Twitch.');
  }

  const decipher = crypto.createDecipheriv(
    'aes-256-gcm',
    trackerCryptoKey(),
    Buffer.from(ivText, 'base64url')
  );
  decipher.setAuthTag(Buffer.from(tagText, 'base64url'));

  try {
    return Buffer.concat([
      decipher.update(Buffer.from(encryptedText, 'base64url')),
      decipher.final()
    ]).toString('utf8');
  } catch {
    throw new Error('Jeton tracker incompatible avec le secret de ce serveur. Reconnecte le tracker Twitch depuis Administration.');
  }
}

async function getTrackerAuthRow() {
  const result = await pool.query(`
    SELECT *
    FROM twitch_tracker_auth
    WHERE id = 1
  `);
  return result.rows[0] || null;
}


async function getActiveAdminLiveBoosts() {
  try {
    const result = await pool.query(`SELECT xp_multiplier,cash_multiplier,global_xp_multiplier,expires_at,streamdeck_xp_expires_at,streamdeck_cash_expires_at,streamdeck_global_xp_expires_at FROM admin_live_boosts WHERE id=1`);
    const row = result.rows[0] || {};
    const now = Date.now();
    const adminEnd = new Date(row.expires_at || 0).getTime();
    const active = adminEnd > now;
    const state = (multiplierColumn, deckColumn) => {
      const adminMultiplier = active ? Math.max(1, Math.min(3, Number(row[multiplierColumn] || 1))) : 1;
      const end = new Date(row[deckColumn] || 0).getTime();
      const deckActive = end > now;
      const expires = Math.max(adminMultiplier > 1 ? adminEnd : 0, deckActive ? end : 0);
      return { multiplier:deckActive ? Math.max(2, adminMultiplier) : adminMultiplier, expiresAt:expires ? new Date(expires).toISOString() : null };
    };
    const xp = state('xp_multiplier','streamdeck_xp_expires_at');
    const cash = state('cash_multiplier','streamdeck_cash_expires_at');
    const globalXp = state('global_xp_multiplier','streamdeck_global_xp_expires_at');
    const end = Math.max(...[xp,cash,globalXp].map(item=>new Date(item.expiresAt || 0).getTime()));
    return {
      xp:xp.multiplier, cash:cash.multiplier, globalXp:globalXp.multiplier,
      expiresAt:end ? new Date(end).toISOString() : null,
      xpExpiresAt:xp.expiresAt, cashExpiresAt:cash.expiresAt, globalXpExpiresAt:globalXp.expiresAt
    };
  } catch {
    return { xp:1, cash:1, globalXp:1, expiresAt:null, xpExpiresAt:null, cashExpiresAt:null, globalXpExpiresAt:null };
  }
}

async function saveTrackerTokens({ twitchUserId, accessToken, refreshToken, scopes, expiresIn }) {
  const expiresAt = Number(expiresIn) > 0
    ? new Date(Date.now() + Number(expiresIn) * 1000)
    : null;

  await pool.query(
    `
    INSERT INTO twitch_tracker_auth (
      id,
      twitch_user_id,
      access_token_enc,
      refresh_token_enc,
      scopes,
      expires_at,
      updated_at
    )
    VALUES (1, $1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
    ON CONFLICT (id)
    DO UPDATE SET
      twitch_user_id = EXCLUDED.twitch_user_id,
      access_token_enc = EXCLUDED.access_token_enc,
      refresh_token_enc = EXCLUDED.refresh_token_enc,
      scopes = EXCLUDED.scopes,
      expires_at = EXCLUDED.expires_at,
      last_error = NULL,
      updated_at = CURRENT_TIMESTAMP
    `,
    [
      twitchUserId,
      encryptTrackerSecret(accessToken),
      encryptTrackerSecret(refreshToken),
      Array.isArray(scopes) ? scopes.join(' ') : String(scopes || ''),
      expiresAt
    ]
  );
}

async function refreshTrackerAccessToken(row) {
  const refreshToken = decryptTrackerSecret(row.refresh_token_enc);

  const response = await fetch('https://id.twitch.tv/oauth2/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: new URLSearchParams({
      client_id: process.env.TWITCH_CLIENT_ID,
      client_secret: process.env.TWITCH_CLIENT_SECRET,
      grant_type: 'refresh_token',
      refresh_token: refreshToken
    })
  });

  if (!response.ok) {
    throw new Error(`Impossible de renouveler le jeton Twitch (${response.status}).`);
  }

  const tokens = await response.json();

  await saveTrackerTokens({
    twitchUserId: row.twitch_user_id,
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token || refreshToken,
    scopes: tokens.scope || String(row.scopes || '').split(' ').filter(Boolean),
    expiresIn: tokens.expires_in
  });

  return tokens.access_token;
}

async function trackerTwitchFetch(path, options = {}) {
  let row = await getTrackerAuthRow();
  if (!row) {
    throw new Error('Tracker Twitch non configuré.');
  }

  let token = decryptTrackerSecret(row.access_token_enc);

  const makeRequest = currentToken => fetch(
    `https://api.twitch.tv/helix${path}`,
    {
      ...options,
      headers: {
        'Client-Id': process.env.TWITCH_CLIENT_ID,
        Authorization: `Bearer ${currentToken}`,
        ...(options.headers || {})
      }
    }
  );

  let response = await makeRequest(token);

  if (response.status === 401) {
    row = await getTrackerAuthRow();
    token = await refreshTrackerAccessToken(row);
    response = await makeRequest(token);
  }

  if (!response.ok) {
    throw new Error(`Twitch API ${response.status}: ${await response.text()}`);
  }

  return response.json();
}

async function getAllChatters() {
  const broadcasterId = String(process.env.TWITCH_BROADCASTER_ID || '').trim();
  if (!broadcasterId) {
    throw new Error('TWITCH_BROADCASTER_ID est manquant.');
  }

  const chatters = [];
  let after = '';

  do {
    const params = new URLSearchParams({
      broadcaster_id: broadcasterId,
      moderator_id: broadcasterId,
      first: '1000'
    });
    if (after) params.set('after', after);

    const data = await trackerTwitchFetch(`/chat/chatters?${params}`);
    chatters.push(...(data.data || []));
    after = data.pagination?.cursor || '';
  } while (after);

  return chatters;
}

async function getAllSubscriberIds() {
  const broadcasterId = String(process.env.TWITCH_BROADCASTER_ID || '').trim();
  const ids = [];
  let after = '';

  do {
    const params = new URLSearchParams({
      broadcaster_id: broadcasterId,
      first: '100'
    });
    if (after) params.set('after', after);

    const data = await trackerTwitchFetch(`/subscriptions?${params}`);
    ids.push(...(data.data || []).map(item => item.user_id));
    after = data.pagination?.cursor || '';
  } while (after);

  return ids;
}

async function syncSubscriberStatus(row) {
  const last = row?.last_sub_sync_at ? new Date(row.last_sub_sync_at).getTime() : 0;
  if (last && Date.now() - last < TRACKER_SUB_SYNC_MS) return;

  const subscriberIds = await getAllSubscriberIds();
  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    await client.query(`UPDATE users SET is_sub = FALSE WHERE is_sub = TRUE`);

    if (subscriberIds.length > 0) {
      await client.query(
        `
        UPDATE users
        SET is_sub = TRUE,
            updated_at = CURRENT_TIMESTAMP
        WHERE twitch_id = ANY($1::text[])
        `,
        [subscriberIds]
      );
    }

    await client.query(
      `
      UPDATE twitch_tracker_auth
      SET last_sub_sync_at = CURRENT_TIMESTAMP,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = 1
      `
    );

    await achievementService.syncSubscriptionTransitions(client);
    await client.query('COMMIT');
  } catch (error) {
    try { await client.query('ROLLBACK'); } catch {}
    throw error;
  } finally {
    client.release();
  }
}

let trackerTickRunning = false;

async function awardBadgeXpOnce(userIds, badgeKey, xpAmount, rewardKey = badgeKey) {
  const ids = [...new Set((Array.isArray(userIds) ? userIds : [userIds])
    .map(Number)
    .filter(Number.isInteger))];

  if (!ids.length || !badgeKey || !(Number(xpAmount) > 0)) return 0;

  const result = await pool.query(
    `
    WITH eligible AS (
      SELECT DISTINCT ub.user_id
      FROM user_badges ub
      WHERE ub.user_id = ANY($1::int[])
        AND ub.badge_key = $2
    ),
    rewarded AS (
      INSERT INTO user_xp_rewards (user_id, reward_key, xp_amount)
      SELECT user_id, $3, $4
      FROM eligible
      ON CONFLICT (user_id, reward_key) DO NOTHING
      RETURNING user_id, xp_amount
    )
    UPDATE users u
    SET xp = u.xp + CASE WHEN u.creature_id IS NOT NULL THEN rewarded.xp_amount ELSE 0 END,
        pending_xp = u.pending_xp + CASE WHEN u.creature_id IS NULL THEN rewarded.xp_amount ELSE 0 END,
        updated_at = CURRENT_TIMESTAMP
    FROM rewarded
    WHERE u.id = rewarded.user_id
    RETURNING u.id
    `,
    [ids, badgeKey, String(rewardKey), Number(xpAmount)]
  );

  return result.rowCount || 0;
}

async function awardBadgeEconomyRewardsOnce(userIds, badgeKey, rewards, rewardVersion = 'economy-v1', legacyRewardKey = badgeKey, queryClient = pool) {
  const ids = [...new Set((Array.isArray(userIds) ? userIds : [userIds])
    .map(Number)
    .filter(Number.isInteger))];

  const lovysXp = Math.max(0, Number(rewards?.lovysXp) || 0);
  const globalXp = Math.max(0, Number(rewards?.globalXp) || 0);
  const cash = Math.max(0, Number(rewards?.cash) || 0);
  if (!ids.length || !badgeKey || (!lovysXp && !globalXp && !cash)) return 0;

  // Les anciennes versions donnaient déjà un petit montant d'XP Lovys à
  // certains badges. On le déduit du nouveau montant pour ne pas récompenser
  // deux fois les joueurs qui avaient déjà débloqué le badge.
  const result = await queryClient.query(
    `
    WITH eligible AS (
      SELECT DISTINCT ub.user_id
      FROM user_badges ub
      WHERE ub.user_id = ANY($1::int[])
        AND ub.badge_key = $2
    ),
    legacy AS (
      SELECT
        e.user_id,
        COALESCE((
          SELECT ux.xp_amount
          FROM user_xp_rewards ux
          WHERE ux.user_id = e.user_id
            AND ux.reward_key = $8
          LIMIT 1
        ), 0) AS legacy_lovys_xp
      FROM eligible e
    ),
    rewarded AS (
      INSERT INTO user_xp_rewards (user_id, reward_key, xp_amount)
      SELECT user_id, $3, $4
      FROM legacy
      ON CONFLICT (user_id, reward_key) DO NOTHING
      RETURNING user_id
    ),
    grants AS (
      SELECT
        r.user_id,
        GREATEST(0, $4 - LEAST($4, l.legacy_lovys_xp)) AS lovys_xp
      FROM rewarded r
      JOIN legacy l ON l.user_id = r.user_id
    )
    UPDATE users u
    SET pending_xp = u.pending_xp + grants.lovys_xp,
        global_xp = LEAST(u.global_xp + $5, $7),
        points = u.points + $6,
        lifetime_lovercash_earned = u.lifetime_lovercash_earned + $6,
        updated_at = CURRENT_TIMESTAMP
    FROM grants
    WHERE u.id = grants.user_id
    RETURNING u.id
    `,
    [
      ids,
      String(badgeKey),
      `${String(badgeKey)}:${String(rewardVersion)}`,
      lovysXp,
      globalXp,
      cash,
      globalThresholdForLevel(56),
      String(legacyRewardKey || badgeKey)
    ]
  );

  return result.rowCount || 0;
}

async function awardXpOnce(userId, rewardKey, xpAmount) {
  const id = Number(userId);
  if (!Number.isInteger(id) || !rewardKey || !(Number(xpAmount) > 0)) return false;

  const result = await pool.query(
    `
    WITH rewarded AS (
      INSERT INTO user_xp_rewards (user_id, reward_key, xp_amount)
      VALUES ($1, $2, $3)
      ON CONFLICT (user_id, reward_key) DO NOTHING
      RETURNING user_id, xp_amount
    )
    UPDATE users u
    SET xp = u.xp + CASE WHEN u.creature_id IS NOT NULL THEN rewarded.xp_amount ELSE 0 END,
        pending_xp = u.pending_xp + CASE WHEN u.creature_id IS NULL THEN rewarded.xp_amount ELSE 0 END,
        updated_at = CURRENT_TIMESTAMP
    FROM rewarded
    WHERE u.id = rewarded.user_id
    RETURNING u.id
    `,
    [id, String(rewardKey), Number(xpAmount)]
  );

  return Boolean(result.rowCount);
}

async function runTrackerTick() {
  if (trackerTickRunning) return { skipped: true, reason: 'busy' };
  trackerTickRunning = true;

  try {
    const broadcasterId = String(process.env.TWITCH_BROADCASTER_ID || '').trim();
    if (!broadcasterId) return { skipped: true, reason: 'missing_broadcaster_id' };

    let row = await getTrackerAuthRow();
    if (!row) return { skipped: true, reason: 'not_authorized' };

    if (row.twitch_user_id !== broadcasterId) {
      throw new Error('Le tracker n’est pas autorisé avec le compte diffuseur configuré.');
    }

    const now = Date.now();
    const previousPoll = row.last_poll_at ? new Date(row.last_poll_at).getTime() : 0;
    let deltaSeconds = previousPoll ? Math.floor((now - previousPoll) / 1000) : 0;

    if (deltaSeconds < 0 || deltaSeconds > TRACKER_MAX_GAP_SECONDS) {
      deltaSeconds = 0;
    }
    deltaSeconds = Math.min(deltaSeconds, TRACKER_MAX_CREDIT_SECONDS);

    const streamData = await trackerTwitchFetch(
      `/streams?user_id=${encodeURIComponent(broadcasterId)}`
    );
    const stream = streamData.data?.[0] || null;
    const isLive = Boolean(stream);

    const currentGameId = String(stream?.game_id || 'unknown');
    const currentGameName =
      String(stream?.game_name || 'Catégorie inconnue').trim() ||
      'Catégorie inconnue';

    await syncSubscriberStatus(row);
    row = await getTrackerAuthRow();

    const specialMode = String(row?.special_mode || '').trim().toLowerCase();
    const adminLiveBoosts = await averageLiveBoosts(pool,now-deltaSeconds*1000,now);

    if (!isLive) {
      // Si le live vient juste de se terminer, coupe automatiquement le mode spécial.
      // En revanche, si la chaîne est déjà hors ligne, on conserve un mode activé
      // manuellement depuis Stream Deck afin de pouvoir le préparer avant le live.
      const shouldDisableSpecialMode = Boolean(row?.last_live);

      await pool.query(
        `
        UPDATE twitch_tracker_auth
        SET last_poll_at = CURRENT_TIMESTAMP,
            last_success_at = CURRENT_TIMESTAMP,
            last_live = FALSE,
            last_chatter_count = 0,
            last_viewer_count = 0,
            last_matched_count = 0,
            special_mode = CASE WHEN $1 THEN NULL ELSE special_mode END,
            last_error = NULL,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = 1
        `,
        [shouldDisableSpecialMode]
      );

      return {
        ok: true,
        live: false,
        creditedSeconds: 0,
        chatters: 0,
        matched: 0,
        specialMode: shouldDisableSpecialMode ? null : specialMode
      };
    }

    const chatters = await getAllChatters();
    // La liste /chat/chatters contient aussi des bots de chat.
    // Les bots sont exclus. Le diffuseur reste éligible s'il possède lui-même
    // un compte Watch Game lié (comportement voulu pour le compte principal).
    const ignoredTrackerLogins = new Set([
      'nightbot', 'streamelements', 'streamlabs', 'moobot', 'fossabot',
      'wizebot', 'sery_bot', 'soundalerts', 'streamstickers'
    ]);
    const eligibleChatters = chatters.filter(item => {
      const id = String(item.user_id || '').trim();
      const login = String(item.user_login || item.user_name || '').trim().toLowerCase();
      return id && !ignoredTrackerLogins.has(login);
    });
    const chatterIds = [...new Set(eligibleChatters.map(item => String(item.user_id || '')).filter(Boolean))];
    const rawChatterCount = [...new Set(chatters.map(item => String(item.user_id || '')).filter(Boolean))].length;

    let matched = 0;

    // Toutes les récompenses et le curseur du Tracker doivent être validés ensemble.
    // Une erreur annule le passage complet, sans crédit partiel à rejouer.
    const trackerClient = await pool.connect();
    try {
      await trackerClient.query('BEGIN');

      if (deltaSeconds > 0 && chatterIds.length > 0) {
        const normalXp = deltaSeconds / 3600 * 100 * adminLiveBoosts.xp;
        const subXp = deltaSeconds / 3600 * 120 * adminLiveBoosts.xp;
        const normalLoverCash = deltaSeconds / 3600 * 10 * adminLiveBoosts.cash;
        const subLoverCash = deltaSeconds / 3600 * 12 * adminLiveBoosts.cash;
        const normalGlobalXp = deltaSeconds / 3600 * GLOBAL_XP_PER_HOUR * adminLiveBoosts.globalXp;
        const subGlobalXp = deltaSeconds / 3600 * GLOBAL_XP_SUB_PER_HOUR * adminLiveBoosts.globalXp;

        const result = await trackerClient.query(
          `
          UPDATE users
          SET
            xp = xp + (CASE
              WHEN creature_id IS NULL THEN 0
              WHEN is_sub THEN $2::double precision
              ELSE $1::double precision
            END) * (CASE WHEN EXISTS (
              SELECT 1 FROM user_active_boosts b
              WHERE b.user_id = users.id AND b.boost_key = 'boost_xp_x2' AND b.expires_at > CURRENT_TIMESTAMP
            ) THEN 2 ELSE 1 END),
            points = points + (CASE
              WHEN is_sub THEN $4::double precision
              ELSE $3::double precision
            END) * (CASE WHEN EXISTS (
              SELECT 1 FROM user_active_boosts b
              WHERE b.user_id = users.id AND b.boost_key = 'boost_cash_x2' AND b.expires_at > CURRENT_TIMESTAMP
            ) THEN 2 ELSE 1 END),
            lifetime_lovercash_earned = lifetime_lovercash_earned + (CASE
              WHEN is_sub THEN $4::double precision
              ELSE $3::double precision
            END) * (CASE WHEN EXISTS (
              SELECT 1 FROM user_active_boosts b
              WHERE b.user_id = users.id AND b.boost_key = 'boost_cash_x2' AND b.expires_at > CURRENT_TIMESTAMP
            ) THEN 2 ELSE 1 END),
            global_xp = LEAST(global_xp + (CASE WHEN is_sub THEN $8::double precision ELSE $7::double precision END), $9::double precision),
            watch_seconds = watch_seconds + $5::bigint,
            away_lovys_xp = away_lovys_xp + CASE WHEN NOT EXISTS (
              SELECT 1 FROM user_game_tabs t WHERE t.user_id=users.id
                AND t.last_seen_at > CURRENT_TIMESTAMP - INTERVAL '90 seconds'
            ) THEN (CASE WHEN creature_id IS NULL THEN 0 WHEN is_sub THEN $2::double precision ELSE $1::double precision END)
              * (CASE WHEN EXISTS (SELECT 1 FROM user_active_boosts b WHERE b.user_id=users.id
                AND b.boost_key='boost_xp_x2' AND b.expires_at>CURRENT_TIMESTAMP) THEN 2 ELSE 1 END) ELSE 0 END,
            away_global_xp = away_global_xp + CASE WHEN NOT EXISTS (
              SELECT 1 FROM user_game_tabs t WHERE t.user_id=users.id
                AND t.last_seen_at > CURRENT_TIMESTAMP - INTERVAL '90 seconds'
            ) THEN GREATEST(0,LEAST(global_xp + (CASE WHEN is_sub THEN $8::double precision ELSE $7::double precision END),$9::double precision)-global_xp) ELSE 0 END,
            away_lovercash = away_lovercash + CASE WHEN NOT EXISTS (
              SELECT 1 FROM user_game_tabs t WHERE t.user_id=users.id
                AND t.last_seen_at > CURRENT_TIMESTAMP - INTERVAL '90 seconds'
            ) THEN (CASE WHEN is_sub THEN $4::double precision ELSE $3::double precision END)
              * (CASE WHEN EXISTS (SELECT 1 FROM user_active_boosts b WHERE b.user_id=users.id
                AND b.boost_key='boost_cash_x2' AND b.expires_at>CURRENT_TIMESTAMP) THEN 2 ELSE 1 END) ELSE 0 END,
            away_watch_seconds = away_watch_seconds + CASE WHEN NOT EXISTS (
              SELECT 1 FROM user_game_tabs t WHERE t.user_id=users.id
                AND t.last_seen_at > CURRENT_TIMESTAMP - INTERVAL '90 seconds'
            ) THEN $5::bigint ELSE 0 END,
            last_live_seen_at = CURRENT_TIMESTAMP,
            updated_at = CURRENT_TIMESTAMP
          WHERE twitch_id = ANY($6::text[])
          RETURNING id
          `,
          [normalXp, subXp, normalLoverCash, subLoverCash, deltaSeconds, chatterIds, normalGlobalXp, subGlobalXp, globalThresholdForLevel(56)]
        );

        matched = result.rowCount || 0;

        const matchedUserIds = result.rows
          .map(item => Number(item.id))
          .filter(Number.isInteger);

        if (matchedUserIds.length > 0) {
          await achievementService.trackEvents(trackerClient,matchedUserIds,deltaSeconds);
          const currentStreamId = String(stream?.id || '').trim();
          if (currentStreamId) {
            await trackerClient.query(
              `INSERT INTO user_live_attendance (user_id, stream_id, badge_watch_seconds)
               SELECT user_id, $2, LEAST($3::bigint, $4::bigint) FROM unnest($1::int[]) AS user_id
               ON CONFLICT (user_id, stream_id) DO UPDATE SET
                 badge_watch_seconds = LEAST(user_live_attendance.badge_watch_seconds + EXCLUDED.badge_watch_seconds, $4::bigint)`,
              [matchedUserIds, currentStreamId, deltaSeconds, DAILY_CHALLENGE_LIBRARY.watch_60.goal]
            );
          }

          // Tous les œufs supplémentaires placés dans l'incubateur progressent
          // en parallèle pendant le live, quel que soit l'appareil utilisé.
          await trackerClient.query(
            `
            UPDATE user_incubator_eggs
            SET
              watched_seconds = LEAST(watched_seconds + $2::bigint, $3::bigint),
              status = CASE WHEN watched_seconds + $2::bigint >= $3::bigint THEN 'ready' ELSE 'incubating' END,
              updated_at = CURRENT_TIMESTAMP
            WHERE user_id = ANY($1::int[])
              AND status = 'incubating'
            `,
            [matchedUserIds, deltaSeconds, EGG_HATCH_SECONDS]
          );
          const activityDate = dailyChallengeDateKey();
          await trackerClient.query(
            `
            INSERT INTO user_daily_activity (user_id, activity_date, watch_seconds, global_xp_earned, lovercash_earned, updated_at)
            SELECT u.id, $2::date, $3::bigint, CASE WHEN u.is_sub THEN $5::double precision ELSE $4::double precision END, CASE WHEN u.is_sub THEN $7::double precision ELSE $6::double precision END, CURRENT_TIMESTAMP
            FROM users u WHERE u.id = ANY($1::int[])
            ON CONFLICT (user_id, activity_date) DO UPDATE SET
              watch_seconds = user_daily_activity.watch_seconds + EXCLUDED.watch_seconds,
              global_xp_earned = user_daily_activity.global_xp_earned + EXCLUDED.global_xp_earned,
              lovercash_earned = user_daily_activity.lovercash_earned + EXCLUDED.lovercash_earned,
              updated_at = CURRENT_TIMESTAMP
            `,
            [matchedUserIds, activityDate, deltaSeconds, normalGlobalXp, subGlobalXp, normalLoverCash, subLoverCash]
          );

          await trackerClient.query(
            `
            INSERT INTO user_game_watch (
              user_id,
              game_id,
              game_name,
              watch_seconds,
              updated_at
            )
            SELECT
              user_id,
              $2,
              $3,
              $4::bigint,
              CURRENT_TIMESTAMP
            FROM unnest($1::int[]) AS user_id
            ON CONFLICT (user_id, game_id)
            DO UPDATE SET
              game_name = EXCLUDED.game_name,
              watch_seconds = user_game_watch.watch_seconds + EXCLUDED.watch_seconds,
              updated_at = CURRENT_TIMESTAMP
            `,
            [matchedUserIds, currentGameId, currentGameName, deltaSeconds]
          );

          if (currentGameName.trim().toLowerCase() === 'dofus') {
            await trackerClient.query(
              `
              INSERT INTO user_badges (
                user_id,
                badge_key,
                game_id,
                game_name,
                badge_name,
                badge_image,
                badge_challenge,
                tier,
                threshold_hours
              )
              SELECT
                user_id,
                'challenge:dofus:gardien-emeraude:50h',
                game_id,
                game_name,
                'Gardien de l’Émeraude',
                '/badges/watch-dofus-1.webp',
                'Regarder 50 h de lives dans la catégorie Dofus',
                'special',
                50
              FROM user_game_watch
              WHERE user_id = ANY($1::int[])
                AND LOWER(TRIM(game_name)) = 'dofus'
                AND watch_seconds >= 180000
              ON CONFLICT (user_id, badge_key) DO NOTHING
              `,
              [matchedUserIds]
            );
          }

          if (currentGameName.trim().toLowerCase() === 'palworld') {
            await trackerClient.query(
              `
              INSERT INTO user_badges (
                user_id,
                badge_key,
                game_id,
                game_name,
                badge_name,
                badge_image,
                badge_challenge,
                tier,
                threshold_hours
              )
              SELECT
                user_id,
                'challenge:palworld:maitre-des-spheres:50h',
                game_id,
                game_name,
                'Maître des Sphères',
                '/badges/watch-palworld-1.webp',
                'Regarder 50 h de lives dans la catégorie Palworld',
                'special',
                50
              FROM user_game_watch
              WHERE user_id = ANY($1::int[])
                AND LOWER(TRIM(game_name)) = 'palworld'
                AND watch_seconds >= 180000
              ON CONFLICT (user_id, badge_key) DO NOTHING
              `,
              [matchedUserIds]
            );
          }


          if (currentGameName.trim().toLowerCase().includes('modern warfare 4')) {
            await trackerClient.query(
              `
              INSERT INTO user_badges (
                user_id,
                badge_key,
                game_id,
                game_name,
                badge_name,
                badge_image,
                badge_challenge,
                tier,
                threshold_hours
              )
              SELECT
                user_id,
                'challenge:mw4:operateur-elite:50h',
                game_id,
                game_name,
                'Opérateur d’Élite',
                '/badges/watch-mw4-1.webp',
                'Regarder 50 h de lives dans la catégorie Call of Duty: Modern Warfare 4',
                'special',
                50
              FROM user_game_watch
              WHERE user_id = ANY($1::int[])
                AND LOWER(TRIM(game_name)) LIKE '%modern warfare 4%'
                AND watch_seconds >= 180000
              ON CONFLICT (user_id, badge_key) DO NOTHING
              `,
              [matchedUserIds]
            );
          }

          if (specialMode === 'zombie') {
            await trackerClient.query(
              `
              INSERT INTO user_game_watch (
                user_id,
                game_id,
                game_name,
                watch_seconds,
                updated_at
              )
              SELECT
                user_id,
                'special:zombie',
                'Zombie',
                $2::bigint,
                CURRENT_TIMESTAMP
              FROM unnest($1::int[]) AS user_id
              ON CONFLICT (user_id, game_id)
              DO UPDATE SET
                game_name = EXCLUDED.game_name,
                watch_seconds = user_game_watch.watch_seconds + EXCLUDED.watch_seconds,
                updated_at = CURRENT_TIMESTAMP
              `,
              [matchedUserIds, deltaSeconds]
            );

            await trackerClient.query(
              `
              INSERT INTO user_badges (
                user_id,
                badge_key,
                game_id,
                game_name,
                badge_name,
                badge_image,
                badge_challenge,
                tier,
                threshold_hours
              )
              SELECT
                user_id,
                'mission:zombie:maitre-des-morts:25h',
                game_id,
                game_name,
                'Maître des morts',
                '/badges/watch-zombie-1.webp',
                'Regarder 25 h de lives en mode Zombie',
                'special',
                25
              FROM user_game_watch
              WHERE user_id = ANY($1::int[])
                AND game_id = 'special:zombie'
                AND watch_seconds >= 90000
              ON CONFLICT (user_id, badge_key) DO NOTHING
              `,
              [matchedUserIds]
            );
          }

        }
      } else if (chatterIds.length > 0) {
        const result = await trackerClient.query(
          `UPDATE users SET last_live_seen_at=CURRENT_TIMESTAMP, updated_at=CURRENT_TIMESTAMP
           WHERE twitch_id = ANY($1::text[]) RETURNING id`,
          [chatterIds]
        );
        matched = result.rowCount || 0;
      }

      await trackerClient.query(
        `
        UPDATE twitch_tracker_auth
        SET last_poll_at = CURRENT_TIMESTAMP,
            last_success_at = CURRENT_TIMESTAMP,
            last_live = TRUE,
            last_chatter_count = $1,
            last_matched_count = $2,
            last_viewer_count = $3,
            last_error = NULL,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = 1
        `,
        [rawChatterCount, matched, Math.max(0, Number(stream.viewer_count || 0))]
      );

      await trackerClient.query('COMMIT');
    } catch (error) {
      try {
        await trackerClient.query('ROLLBACK');
      } catch (rollbackError) {
        console.error('Rollback du Tracker impossible :', rollbackError);
      }
      throw error;
    } finally {
      trackerClient.release();
    }

    // Enregistrer les alertes avant de prévenir les navigateurs des œufs prêts.
    await wizebotAlerts.collect();
    if (deltaSeconds > 0 && matched > 0) {
      pushLiveUpdate('tracker-update', {
        matched,
        creditedSeconds: deltaSeconds,
        gameId: currentGameId,
        gameName: currentGameName,
        at: Date.now()
      });
    }

    return {
      ok: true,
      live: true,
      creditedSeconds: deltaSeconds,
      chatters: rawChatterCount,
      matched,
      gameId: currentGameId,
      gameName: currentGameName,
      specialMode: specialMode || null
    };
  } catch (error) {
    console.error('Erreur tracker Twitch :', error);

    try {
      await pool.query(
        `
        UPDATE twitch_tracker_auth
        SET last_error = $1,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = 1
        `,
        [String(error?.message || error).slice(0, 1000)]
      );
    } catch {}

    return { ok: false, error: String(error?.message || error) };
  } finally {
    trackerTickRunning = false;
  }
}

async function getBroadcasterAccount(req) {
  if (!req.session.account) return null;

  const result = await pool.query(
    `SELECT id, twitch_id FROM accounts WHERE id = $1`,
    [req.session.account.id]
  );

  const account = result.rows[0];
  const broadcasterId = String(process.env.TWITCH_BROADCASTER_ID || '').trim();

  if (!account?.twitch_id || !broadcasterId || account.twitch_id !== broadcasterId) {
    return null;
  }

  return account;
}


async function logAdminAction(adminAccountId, targetAccountId, actionKey, summary, details = null, clientOrPool = pool) {
  try {
    await clientOrPool.query(
      `INSERT INTO admin_audit_log(admin_account_id,target_account_id,action_key,summary,details_json)
       VALUES($1,$2,$3,$4,$5::jsonb)`,
      [adminAccountId || null, targetAccountId || null, String(actionKey || 'admin_action'), String(summary || 'Action admin'), JSON.stringify(details || {})]
    );
  } catch (error) {
    console.error('Journal admin indisponible :', error.message || error);
  }
}

/* =========================================
   EXPRESS
========================================= */

app.post('/api/feedback', feedbackRateLimit);
app.use('/api/feedback', express.json({ limit: '3mb' }));
app.use(express.json({ limit: '100kb' }));
app.use(createOriginGuard({ baseUrl: BASE_URL }));


/* =========================================
   SESSION POSTGRESQL
========================================= */

const PgSession =
  connectPgSimple(session);


app.use(
  session({

    store:
      new PgSession({

        pool,

        tableName:
          'user_sessions',

        createTableIfMissing:
          true

      }),

    secret:
      SESSION_SECRET,

    resave:
      false,

    saveUninitialized:
      false,

    cookie: {

      httpOnly:
        true,

      sameSite:
        'lax',

      secure:
        BASE_URL.startsWith(
          'https://'
        ),

      maxAge:
        1000 *
        60 *
        60 *
        24 *
        30

    }

  })
);


app.use('/api/twitch-panel', createTwitchPanelRouter({pool,baseUrl:BASE_URL,hatchSeconds:EGG_HATCH_SECONDS,creatureBattleStats,catalog:SHOP_ITEMS}));

// Présence récente sur le site (et non présence dans le chat Twitch).
const activeGameAccounts = new Map();
const PLAYER_ONLINE_WINDOW_MS = 2 * 60 * 1000;
app.use((req, res, next) => {
  if (req.path.startsWith('/api/')) {
    const accountId = Number(req.session?.account?.id);
    if (Number.isSafeInteger(accountId) && accountId > 0) activeGameAccounts.set(accountId, Date.now());
  }
  next();
});

// Ne jamais publier un ancien fichier serveur, même s'il reste sur le disque.
app.use((req, res, next) => {
  let path;
  try { path = decodeURIComponent(req.path); } catch { return res.sendStatus(400); }
  if (/^\/+server\.js(?:\/|$)/i.test(path)) {
    res.set('Cache-Control', 'no-store');
    return res.sendStatus(404);
  }
  next();
});

app.use(
  express.static('public', {
    etag: true,
    lastModified: true,
    setHeaders(res, filePath) {
      if (/service-worker\.js$/i.test(filePath) || /manifest\.webmanifest$/i.test(filePath)) {
        // V104 — le navigateur doit toujours vérifier les métadonnées PWA et le service worker.
        res.setHeader('Cache-Control', 'no-cache');
      } else if (/\.(?:webp|svg|ico|woff2?)$/i.test(filePath)) {
        // Assets statiques : cache navigateur 1 an.
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      } else if (/\.(?:css|js)$/i.test(filePath)) {
        // CSS/JS sont versionnés dans index.html (?v=104).
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      } else if (/\.html$/i.test(filePath)) {
        // Toujours vérifier l'HTML afin qu'un nouveau déploiement soit visible immédiatement.
        res.setHeader('Cache-Control', 'no-cache');
      }
    }
  })
);
// Les visuels en cours de création affichent une icône neutre, sans erreur d'image.
// express.static ci-dessus sert le vrai fichier dès qu'il est ajouté.
app.get('/badges/:filename', (req,res,next)=>{
  if(!/^[a-z0-9-]+\.webp$/i.test(req.params.filename))return next();
  res.set('Cache-Control','no-store');
  return res.sendFile('public/badges/placeholder.svg',{root:process.cwd()});
});


function saveSession(req) {
  return new Promise((resolve, reject) => {
    req.session.save(error => {
      if (error) reject(error);
      else resolve();
    });
  });
}
/* =========================================
   VALIDATION DES PSEUDOS
========================================= */

function normalizeUsernameForFilter(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/0/g, 'o')
    .replace(/1/g, 'i')
    .replace(/3/g, 'e')
    .replace(/4/g, 'a')
    .replace(/5/g, 's')
    .replace(/7/g, 't');
}

function validateGameUsername(value) {
  const username = String(value || '').trim();

  if (username.length < 3 || username.length > 24) {
    return 'Le pseudo doit contenir entre 3 et 24 caractères.';
  }

  if (!/^[A-Za-zÀ-ÖØ-öø-ÿ0-9 _.-]+$/u.test(username)) {
    return 'Le pseudo contient des caractères non autorisés.';
  }

  const normalized = normalizeUsernameForFilter(username);
  const words = normalized
    .replace(/[_ .-]+/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
  const compact = normalized.replace(/[^a-z0-9]/g, '');

  // Termes réservés pour éviter l'usurpation du staff / de la chaîne.
  const reserved = new Set([
    'admin', 'administrator', 'administrateur',
    'mod', 'moderator', 'moderateur',
    'staff', 'support', 'owner',
    'twitch', 'twitchstaff',
    'loverdose', 'loverdosetv'
  ]);

  if (words.some(word => reserved.has(word)) || reserved.has(compact)) {
    return 'Ce pseudo est réservé. Merci d’en choisir un autre.';
  }

  // Insultes, termes haineux ou sexuellement explicites.
  // "gay" n'est volontairement pas bloqué : ce mot n'est pas offensant en soi.
  const blockedWords = new Set([
    'connard', 'connasse', 'salope', 'pute', 'putain',
    'encule', 'enculee', 'batard', 'batarde', 'fdp',
    'nique', 'niquer', 'merde',
    'nazi', 'neonazi',
    'negro', 'negre',
    'pd', 'pede', 'tapette',
    'porno', 'porn', 'hentai', 'sex', 'sexe'
  ]);

  const blockedCompact = [
    'filsdepute',
    'niqueetamere',
    'niquetamere',
    'fuckyou',
    'motherfucker'
  ];

  if (
    words.some(word => blockedWords.has(word)) ||
    blockedWords.has(compact) ||
    blockedCompact.some(term => compact.includes(term))
  ) {
    return 'Ce pseudo contient un terme non autorisé. Merci d’en choisir un autre.';
  }

  return null;
}


/* =========================================
   SESSION JEU DEPUIS LE COMPTE
========================================= */

async function restoreGameSession(req, twitchId) {
  if (!twitchId) {
    delete req.session.user;
    return false;
  }

  const result = await pool.query(
    `
    SELECT twitch_id, login
    FROM users
    WHERE twitch_id = $1
    `,
    [twitchId]
  );

  const user = result.rows[0];

  if (!user) {
    delete req.session.user;
    return false;
  }

  req.session.user = {
    twitchId: user.twitch_id,
    login: user.login
  };

  return true;
}


/* =========================================
   COMPTE - INSCRIPTION
========================================= */

app.post('/api/register', registerRateLimit, async (req, res) => {
  try {
    let { email, username, password } = req.body;

    email = String(email || '').trim().toLowerCase();
    username = String(username || '').trim();
    password = String(password || '');

    if (!email || !username || !password) {
      return res.status(400).json({
        error: 'Tous les champs sont obligatoires.'
      });
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({
        error: 'Adresse e-mail invalide.'
      });
    }

    const usernameError = validateGameUsername(username);

    if (usernameError) {
      return res.status(400).json({
        error: usernameError
      });
    }

    if (password.length < 8 || password.length > 72) {
      return res.status(400).json({
        error: 'Le mot de passe doit contenir entre 8 et 72 caractères.'
      });
    }

    const existing = await pool.query(
      `
      SELECT id
      FROM accounts
      WHERE email = $1
         OR LOWER(username) = LOWER($2)
      `,
      [email, username]
    );

    if (existing.rows.length > 0) {
      return res.status(409).json({
        error: 'Cet e-mail ou ce pseudo est déjà utilisé.'
      });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const result = await pool.query(
      `
      INSERT INTO accounts (
        email,
        username,
        password_hash,
        game_intro_seen
      )
      VALUES ($1, $2, $3, FALSE)
      RETURNING id, email, username, twitch_id, game_intro_seen
      `,
      [email, username, passwordHash]
    );

    const account = result.rows[0];

    const preservedPanelIntent = req.session.twitchPanelIntent;
    await regenerateSession(req);
    if (preservedPanelIntent && Date.now()-preservedPanelIntent.createdAt<20*60*1000) req.session.twitchPanelIntent=preservedPanelIntent;

    req.session.account = {
      id: account.id,
      email: account.email,
      username: account.username
    };

    delete req.session.user;

    await saveSession(req);

    res.json({
      ok: true,
      account: {
        id: account.id,
        email: account.email,
        username: account.username,
        twitchConnected: Boolean(account.twitch_id)
      }
    });

  } catch (error) {
    console.error('Erreur inscription :', error);

    res.status(500).json({
      error: 'Impossible de créer le compte.'
    });
  }
});


/* =========================================
   COMPTE - CONNEXION
========================================= */

app.post('/api/account/login', loginRateLimit, async (req, res) => {
  try {
    let { email, password } = req.body;

    email = String(email || '').trim().toLowerCase();
    password = String(password || '');

    if (!email || !password) {
      return res.status(400).json({
        error: 'Adresse e-mail ou pseudo et mot de passe obligatoires.'
      });
    }

    const result = await pool.query(
      `
      SELECT
        id,
        email,
        username,
        password_hash,
        twitch_id,
        discord_user_id,
        discord_username,
        discord_member_verified,
        discord_verified_at
      FROM accounts
      WHERE LOWER(email) = $1 OR LOWER(username) = $1
      ORDER BY CASE WHEN LOWER(email) = $1 THEN 0 ELSE 1 END
      LIMIT 1
      `,
      [email]
    );

    const account = result.rows[0];

    if (!account) {
      return res.status(401).json({
        error: 'Identifiant ou mot de passe incorrect.'
      });
    }

    const passwordOk = await bcrypt.compare(
      password,
      account.password_hash
    );

    if (!passwordOk) {
      return res.status(401).json({
        error: 'Identifiant ou mot de passe incorrect.'
      });
    }

    const preservedPanelIntent = req.session.twitchPanelIntent;
    await regenerateSession(req);
    if (preservedPanelIntent && Date.now()-preservedPanelIntent.createdAt<20*60*1000) req.session.twitchPanelIntent=preservedPanelIntent;

    req.session.account = {
      id: account.id,
      email: account.email,
      username: account.username
    };

    const gameReady = await restoreGameSession(
      req,
      account.twitch_id
    );

    await saveSession(req);

    res.json({
      ok: true,
      account: {
        id: account.id,
        email: account.email,
        username: account.username,
        twitchConnected: Boolean(account.twitch_id),
        discordConnected: Boolean(account.discord_user_id),
        discordUsername: account.discord_username || null,
        discordMemberVerified: Boolean(account.discord_member_verified),
        discordVerifiedAt: account.discord_verified_at || null,
        gameReady,
        showGameIntro: Boolean(account.twitch_id) && !account.game_intro_seen,
        showCommunityIntro: !account.community_intro_seen,
        isBroadcaster: Boolean(account.twitch_id) && account.twitch_id === String(process.env.TWITCH_BROADCASTER_ID || '')
      }
    });

  } catch (error) {
    console.error('Erreur connexion compte :', error);

    res.status(500).json({
      error: 'Impossible de se connecter.'
    });
  }
});


/* =========================================
   COMPTE - ÉTAT
========================================= */

app.get('/api/account/me', async (req, res) => {
  try {
    if (!req.session.account) {
      return res.json({
        authenticated: false
      });
    }

    const result = await pool.query(
      `
      SELECT
        id,
        email,
        username,
        created_at,
        (password_hash IS NOT NULL AND password_hash <> '') AS has_password,
        twitch_id,
        game_intro_seen,
        community_intro_seen,
        discord_user_id,
        discord_username,
        discord_member_verified,
        discord_verified_at
      FROM accounts
      WHERE id = $1
      `,
      [req.session.account.id]
    );

    const account = result.rows[0];

    if (!account) {
      return res.json({
        authenticated: false
      });
    }

    const gameReady = await restoreGameSession(
      req,
      account.twitch_id
    );

    res.json({
      authenticated: true,
      account: {
        id: account.id,
        email: account.email,
        username: account.username,
        createdAt: account.created_at || null,
        hasPassword: Boolean(account.has_password),
        discordInviteUrl: getDiscordInviteUrl(process.env.DISCORD_INVITE_URL || 'https://discord.gg/loverdosetv'),
        twitchConnected: Boolean(account.twitch_id),
        discordConnected: Boolean(account.discord_user_id),
        discordUsername: account.discord_username || null,
        discordMemberVerified: Boolean(account.discord_member_verified),
        discordVerifiedAt: account.discord_verified_at || null,
        gameReady,
        showGameIntro: Boolean(account.twitch_id) && !account.game_intro_seen,
        showCommunityIntro: !account.community_intro_seen,
        isBroadcaster: Boolean(account.twitch_id) && account.twitch_id === String(process.env.TWITCH_BROADCASTER_ID || '')
      }
    });

  } catch (error) {
    console.error('Erreur compte :', error);

    res.status(500).json({
      error: 'Impossible de charger le compte.'
    });
  }
});


app.post('/api/account/password', passwordChangeRateLimit, createChangePasswordHandler({ pool, bcrypt }));

/* =========================================
   COMPTE - INTRODUCTION VUE
========================================= */

app.post('/api/account/community-intro-seen', async (req,res) => {
  try {
    if(!req.session.account)return res.status(401).json({error:'Connexion requise.'});
    await pool.query('UPDATE accounts SET community_intro_seen=TRUE,updated_at=CURRENT_TIMESTAMP WHERE id=$1',[req.session.account.id]);
    res.json({ok:true});
  }catch(error){console.error('Introduction communauté :',error);res.status(500).json({error:'Impossible de sauvegarder la présentation.'});}
});

app.post('/api/account/intro-seen', async (req, res) => {
  try {
    if (!req.session.account) {
      return res.status(401).json({ error: 'Connexion requise.' });
    }

    await pool.query(
      `
      UPDATE accounts
      SET game_intro_seen = TRUE,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
      `,
      [req.session.account.id]
    );

    res.json({ ok: true });
  } catch (error) {
    console.error('Erreur validation introduction :', error);
    res.status(500).json({ error: 'Impossible de sauvegarder l’introduction.' });
  }
});


/* =========================================
   COMPTE - MODIFIER LE PSEUDO
========================================= */

app.patch('/api/account/username', async (req, res) => {
  const client = await pool.connect();

  try {
    if (!req.session.account) {
      return res.status(401).json({ error: 'Connexion requise.' });
    }

    const username = String(req.body?.username || '').trim();

    const usernameError = validateGameUsername(username);

    if (usernameError) {
      return res.status(400).json({
        error: usernameError
      });
    }

    await client.query('BEGIN');

    const accountResult = await client.query(
      `
      SELECT id, username, twitch_id
      FROM accounts
      WHERE id = $1
      FOR UPDATE
      `,
      [req.session.account.id]
    );

    const account = accountResult.rows[0];

    if (!account) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Compte introuvable.' });
    }

    const duplicate = await client.query(
      `
      SELECT id
      FROM accounts
      WHERE LOWER(username) = LOWER($1)
        AND id <> $2
      LIMIT 1
      `,
      [username, account.id]
    );

    if (duplicate.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'Ce pseudo est déjà utilisé.' });
    }

    await client.query(
      `
      UPDATE accounts
      SET username = $1,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
      `,
      [username, account.id]
    );

    if (account.twitch_id) {
      await client.query(
        `
        UPDATE users
        SET display_name = $1,
            updated_at = CURRENT_TIMESTAMP
        WHERE twitch_id = $2
        `,
        [username, account.twitch_id]
      );
    }

    await client.query('COMMIT');

    req.session.account.username = username;
    await saveSession(req);

    res.json({ ok: true, username });
  } catch (error) {
    try { await client.query('ROLLBACK'); } catch {}
    console.error('Erreur modification pseudo :', error);
    res.status(500).json({ error: 'Impossible de modifier le pseudo.' });
  } finally {
    client.release();
  }
});


/* =========================================
   COMPTE - DÉCONNEXION
========================================= */

app.post('/api/account/logout', (req, res) => {
  if (!req.session) return res.json({ ok: true });
  req.session.destroy(error => {
    if (error) {
      console.error('Erreur déconnexion :', error);
      return res.status(500).json({ error: 'Déconnexion impossible.' });
    }
    res.clearCookie('connect.sid', { path: '/' });
    return res.json({ ok: true });
  });
});


/* =========================================
   COMPTE - RÉINITIALISER LE JEU
========================================= */

app.post('/api/account/reset-game', async(req,res)=>{
  const client=await pool.connect();
  try{
    if(!req.session.account)return res.status(401).json({error:'Connexion requise.'});
    await client.query('BEGIN');
    const target=(await client.query(`SELECT a.id,a.username,a.twitch_id,u.id user_id FROM accounts a
      LEFT JOIN users u ON u.twitch_id=a.twitch_id WHERE a.id=$1 FOR UPDATE OF a`,[req.session.account.id])).rows[0];
    if(!target){await client.query('ROLLBACK');return res.status(404).json({error:'Compte introuvable.'});}
    if(!target.twitch_id){await client.query('ROLLBACK');return res.status(400).json({error:'Aucun compte Twitch n’est lié.'});}
    if(!target.user_id){await client.query('ROLLBACK');return res.status(404).json({error:'Profil de jeu introuvable.'});}
    await resetPlayerProgress(client,target,{achievementService,changeTradeAsset});
    await logAdminAction(target.id,target.id,'self_reset','Progression remise à zéro par le joueur',{username:target.username},client);
    await client.query('COMMIT');
    pushLiveUpdate('account-reset',{twitchId:target.twitch_id,at:Date.now()});
    pushLiveUpdate('trade-update',{at:Date.now()});
    res.json({ok:true,message:'Progression du jeu réinitialisée, Prestige et badges compris.'});
  }catch(error){try{await client.query('ROLLBACK');}catch{}console.error('Erreur réinitialisation jeu :',error);res.status(500).json({error:'Impossible de réinitialiser la progression.'});}
  finally{client.release();}
});


/* =========================================
   COMPTE - SUPPRESSION DÉFINITIVE
========================================= */

app.delete('/api/account', async (req, res) => {
  const client = await pool.connect();

  try {
    if (!req.session.account) {
      return res.status(401).json({ error: 'Connexion requise.' });
    }

    await client.query('BEGIN');

    const accountResult = await client.query(
      `
      SELECT id, twitch_id
      FROM accounts
      WHERE id = $1
      FOR UPDATE
      `,
      [req.session.account.id]
    );

    const account = accountResult.rows[0];

    if (!account) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Compte introuvable.' });
    }

    if (account.twitch_id) {
      await client.query(
        `DELETE FROM users WHERE twitch_id = $1`,
        [account.twitch_id]
      );
    }

    await client.query(
      `DELETE FROM accounts WHERE id = $1`,
      [account.id]
    );

    await client.query('COMMIT');

    req.session.destroy(error => {
      if (error) {
        console.error('Erreur destruction session après suppression :', error);
      }

      res.json({
        ok: true,
        message: 'Compte supprimé définitivement.'
      });
    });
  } catch (error) {
    try { await client.query('ROLLBACK'); } catch {}
    console.error('Erreur suppression compte :', error);
    res.status(500).json({ error: 'Impossible de supprimer le compte.' });
  } finally {
    client.release();
  }
});


/* =========================================
   TRACKER TWITCH - CONFIGURATION DIFFUSEUR
========================================= */

app.get('/auth/twitch/tracker', async (req, res) => {
  try {
    const account = await getBroadcasterAccount(req);
    if (!account) {
      return res.status(403).send('Accès réservé au diffuseur de la chaîne.');
    }

    const state = crypto.randomBytes(24).toString('hex');
    req.session.trackerOauthState = state;
    req.session.trackerOauthStateStartedAt = Date.now();
    await saveSession(req);

    res.redirect(trackerAuthUrl(state));
  } catch (error) {
    console.error('Erreur démarrage OAuth tracker :', error);
    res.status(500).send('Impossible de démarrer la configuration du tracker.');
  }
});

app.get('/auth/twitch/tracker/callback', async (req, res) => {
  try {
    const account = await getBroadcasterAccount(req);
    if (!account) {
      return res.status(403).send('Accès réservé au diffuseur de la chaîne.');
    }

    if (!validOAuthCallback(req.query, req.session, 'trackerOauthState')) {
      return res.status(400).send('OAuth tracker invalide.');
    }

    delete req.session.trackerOauthState;
    delete req.session.trackerOauthStateStartedAt;
    await saveSession(req);

    const tokenRes = await fetch('https://id.twitch.tv/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        client_id: process.env.TWITCH_CLIENT_ID,
        client_secret: process.env.TWITCH_CLIENT_SECRET,
        code: req.query.code,
        grant_type: 'authorization_code',
        redirect_uri: trackerRedirectUri()
      })
    });

    if (!tokenRes.ok) {
      throw new Error(`Échange OAuth tracker impossible (${tokenRes.status}).`);
    }

    const tokens = await tokenRes.json();
    const me = await twitchFetch('/users', tokens.access_token);
    const twitchUser = me.data?.[0];
    const broadcasterId = String(process.env.TWITCH_BROADCASTER_ID || '').trim();

    if (!twitchUser || twitchUser.id !== broadcasterId) {
      return res.status(403).send('Autorise le tracker avec le compte Twitch du diffuseur.');
    }

    await saveTrackerTokens({
      twitchUserId: twitchUser.id,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      scopes: tokens.scope || [],
      expiresIn: tokens.expires_in
    });

    await saveSession(req);
    await runTrackerTick();

    res.redirect('/?tracker=connected');
  } catch (error) {
    console.error('Erreur callback tracker Twitch :', error);
    res.status(500).send('Impossible de configurer le tracker Twitch.');
  }
});


app.use('/api/streamdeck', createStreamDeckRouter({ pool, getTrackerAuthRow, runTrackerTick, pushLiveUpdate, getActiveAdminLiveBoosts, mutateLiveBoosts, publicLiveBoostStatus }));


// Panneau Événements du site : permet au diffuseur connecté de piloter
// les modes spéciaux sans exposer le token Stream Deck dans le navigateur.
app.post('/api/events/special-mode', async (req, res) => {
  try {
    const account = await getBroadcasterAccount(req);
    if (!account) {
      return res.status(403).json({ error: 'Accès réservé au diffuseur.' });
    }

    const requestedMode = req.body?.mode == null
      ? null
      : String(req.body.mode).trim().toLowerCase();

    const allowedModes = new Set(['zombie']);
    if (requestedMode && !allowedModes.has(requestedMode)) {
      return res.status(400).json({ error: 'Mode spécial inconnu.' });
    }

    const row = await getTrackerAuthRow();
    if (!row) {
      return res.status(409).json({ error: 'Tracker Twitch non configuré.' });
    }

    // Compte d'abord l'intervalle écoulé avec l'ancien mode avant de changer d'état.
    await runTrackerTick();

    await pool.query(
      `
      UPDATE twitch_tracker_auth
      SET special_mode = $1,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = 1
      `,
      [requestedMode]
    );

    const updated = await getTrackerAuthRow();
    pushLiveUpdate('special-mode-update', { specialMode: updated?.special_mode || null });
    res.json({
      ok: true,
      live: Boolean(updated?.last_live),
      specialMode: updated?.special_mode || null,
      updatedAt: updated?.updated_at || null
    });
  } catch (error) {
    console.error('Erreur panneau Événements :', error);
    res.status(500).json({ error: 'Impossible de modifier le mode spécial.' });
  }
});


// V107 — boosts live temporaires. Ils s'appliquent uniquement aux gains du tracker Twitch.
app.post('/api/admin/events/live-boost', async (req, res) => {
  try {
    const account = await getBroadcasterAccount(req);
    if (!account) return res.status(403).json({ error:'Accès réservé au diffuseur.' });
    const kind = String(req.body?.kind || 'off').trim().toLowerCase();
    const allowed = new Set(['off','xp','cash','global_xp','all']);
    if (!allowed.has(kind)) return res.status(400).json({ error:'Boost inconnu.' });
    let xp=1,cash=1,globalXp=1,expiresAt=null;
    if(kind!=='off'){
      const minutes=Math.max(15,Math.min(240,Math.floor(Number(req.body?.minutes||60))));
      if(kind==='xp'||kind==='all') xp=2;
      if(kind==='cash'||kind==='all') cash=2;
      if(kind==='global_xp'||kind==='all') globalXp=2;
      expiresAt=new Date(Date.now()+minutes*60000);
    }
    await mutateLiveBoosts(pool,client=>client.query(`UPDATE admin_live_boosts SET xp_multiplier=$1,cash_multiplier=$2,global_xp_multiplier=$3,expires_at=$4,streamdeck_xp_expires_at=CASE WHEN $5 THEN NULL ELSE streamdeck_xp_expires_at END,streamdeck_cash_expires_at=CASE WHEN $5 THEN NULL ELSE streamdeck_cash_expires_at END,streamdeck_global_xp_expires_at=CASE WHEN $5 THEN NULL ELSE streamdeck_global_xp_expires_at END,updated_at=CURRENT_TIMESTAMP WHERE id=1`,[xp,cash,globalXp,expiresAt,kind==='off']));
    await logAdminAction(account.id,null,'live_boost',kind==='off'?'Boost live désactivé':`Boost live ${kind} activé`,{kind,xp,cash,globalXp,expiresAt});
    const liveBoosts=await getActiveAdminLiveBoosts();
    pushLiveUpdate('live-boost-update',publicLiveBoostStatus(liveBoosts));
    res.json({ok:true,liveBoosts});
  } catch(error){
    console.error('Erreur boost live admin :',error);
    res.status(500).json({error:'Impossible de modifier le boost live.'});
  }
});

const GAME_STATUS_PRESENCE = new Map();

function connectedGamePlayerCount() {
  const now = Date.now();
  for (const [id, seenAt] of GAME_STATUS_PRESENCE) {
    if (now - seenAt > 90000) GAME_STATUS_PRESENCE.delete(id);
  }
  return new Set([...GAME_STATUS_PRESENCE.keys(), ...[...LIVE_UPDATE_CLIENTS]
    .filter(client => !client.destroyed && !client.writableEnded && client.gamePlayerId)
    .map(client => String(client.gamePlayerId))]).size;
}

// Présence sur le site : n'utilise pas les spectateurs du chat Twitch.
app.get('/api/game/online-players', async(req,res)=>{
  if(!req.session.account || !req.session.user)return res.status(401).json({error:'Connexion requise.'});
  const cutoff=Date.now()-PLAYER_ONLINE_WINDOW_MS;
  const ids=[...activeGameAccounts].filter(([,seen])=>seen>=cutoff).map(([id])=>id).slice(0,150);
  if(!ids.length)return res.json({ok:true,players:[]});
  try{
    const result=await pool.query(`SELECT a.id account_id,a.username,a.twitch_id,a.equipped_title_key,u.id user_id,u.profile_image_url FROM accounts a LEFT JOIN users u ON u.twitch_id=a.twitch_id WHERE a.id=ANY($1::integer[]) ORDER BY a.username LIMIT 100`,[ids]);
    res.setHeader('Cache-Control','no-store');
    res.json({ok:true,players:result.rows.map(p=>({accountId:Number(p.account_id),userId:p.user_id?Number(p.user_id):null,username:p.username,avatar:p.profile_image_url||null,title:cosmeticTitleForTwitchId(p.twitch_id,p.equipped_title_key)}))});
  }catch(error){console.error('Joueurs en ligne :',error);res.status(500).json({error:'Liste indisponible.'});}
});

// Lecture publique limitée au bonus XP : aucune commande ni clé exposée à OBS.
app.get('/api/game/live-xp-boost/events', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('X-Accel-Buffering', 'no');
  res.setHeader('Content-Encoding','identity');
  res.socket?.setNoDelay?.(true);
  res.flushHeaders?.();
  // Flux public dédié : il ne diffuse que le signal de changement du boost.
  LIVE_XP_OVERLAY_CLIENTS.add(res);
  // Les commentaires SSE forcent aussi l’envoi derrière les proxys qui tamponnent.
  res.write(`:${' '.repeat(8192)}\n\nevent: connected\ndata: {}\n\n`);res.flush?.();
  const heartbeat = setInterval(() => {
    try { res.write(': keepalive\n\n');res.flush?.(); } catch { cleanup(); }
  }, 25000);
  heartbeat.unref?.();
  function cleanup() {
    clearInterval(heartbeat);
    LIVE_XP_OVERLAY_CLIENTS.delete(res);
  }
  res.on('close', cleanup);
});

app.get('/api/game/live-xp-boost', async (req,res)=>{
  try{
    const boosts=await getActiveAdminLiveBoosts();
    res.setHeader('Cache-Control','no-store');
    res.json(publicLiveBoostStatus(boosts));
  }catch(error){res.status(503).json({error:'Boosts temporairement indisponibles.'});}
});

app.get('/api/game/live-status', async (req, res) => {
  if (!req.session.account || !req.session.user) return res.status(401).json({ error:'Connexion requise.' });
  if (req.session.user.twitchId) GAME_STATUS_PRESENCE.set(String(req.session.user.twitchId), Date.now());
  try {
    const tracker = (await pool.query('SELECT last_live, last_viewer_count, last_success_at, last_error FROM twitch_tracker_auth WHERE id=1')).rows[0];
    // Le tracker interroge Twitch toutes les 15 s ; éviter d'afficher un ancien chiffre en cas de panne.
    const viewersUpdatedRecently = tracker?.last_success_at && Date.now() - new Date(tracker.last_success_at).getTime() < 120000;
    const twitchViewerCount = !tracker ? null : tracker.last_live
      ? (!tracker.last_error && viewersUpdatedRecently ? Number(tracker.last_viewer_count) : null)
      : 0;
    res.setHeader('Cache-Control', 'no-store');
    const avatar=(await pool.query('SELECT profile_image_url FROM users WHERE twitch_id=$1 LIMIT 1',[String(process.env.TWITCH_BROADCASTER_ID||'')])).rows[0]?.profile_image_url||null;
    res.json({ live:tracker ? Boolean(tracker.last_live) : null, gamePlayerCount:[...activeGameAccounts.values()].filter(seen=>Date.now()-seen<PLAYER_ONLINE_WINDOW_MS).length, twitchViewerCount, broadcasterAvatar:avatar });
  } catch (error) {
    console.error('Erreur statut accueil :', error);
    res.status(500).json({ error:'Statut indisponible.' });
  }
});

// Le navigateur annonce sa présence uniquement quand l'onglet du jeu est visible.
// Les gains gagnés hors du jeu sont comptés par le Tracker dans la même transaction
// que l'XP réelle. Le récapitulatif est consommé une seule fois sous verrou joueur.
app.post('/api/game/return-summary', async (req,res)=>{
  if(!req.session.account || !req.session.user)return res.status(401).json({error:'Connexion requise.'});
  const tabId=String(req.body?.tabId||'');
  if(!/^[a-zA-Z0-9-]{8,80}$/.test(tabId))return res.status(400).json({error:'Onglet invalide.'});
  const client=await pool.connect();
  try{
    await client.query('BEGIN');
    const result=await client.query(`SELECT id,creature_id,away_lovys_xp,away_global_xp,away_lovercash,away_watch_seconds
      FROM users WHERE twitch_id=$1 FOR UPDATE`,[req.session.user.twitchId]);
    const player=result.rows[0];
    if(!player){await client.query('ROLLBACK');return res.status(404).json({error:'Joueur introuvable.'});}
    await client.query(`INSERT INTO user_game_tabs(user_id,tab_id,last_seen_at) VALUES($1,$2,CURRENT_TIMESTAMP)
      ON CONFLICT(user_id,tab_id) DO UPDATE SET last_seen_at=EXCLUDED.last_seen_at`,[player.id,tabId]);
    const summary={lovysXp:Number(player.away_lovys_xp||0),globalXp:Number(player.away_global_xp||0),loverCash:Number(player.away_lovercash||0),watchSeconds:Number(player.away_watch_seconds||0),hasLovy:Boolean(player.creature_id)};
    if(summary.watchSeconds>0){
      await client.query(`UPDATE users SET away_lovys_xp=0,away_global_xp=0,away_lovercash=0,away_watch_seconds=0 WHERE id=$1`,[player.id]);
    }
    await client.query('COMMIT');
    res.setHeader('Cache-Control','no-store');
    res.json({ok:true,summary});
  }catch(error){try{await client.query('ROLLBACK')}catch{};console.error('Récapitulatif retour au jeu :',error);res.status(500).json({error:'Récapitulatif indisponible.'});}
  finally{client.release();}
});
app.post('/api/game/presence/leave',async(req,res)=>{
  if(!req.session.account || !req.session.user)return res.status(401).json({error:'Connexion requise.'});
  const tabId=String(req.body?.tabId||'');
  if(!/^[a-zA-Z0-9-]{8,80}$/.test(tabId))return res.status(400).json({error:'Onglet invalide.'});
  try{
    await pool.query(`DELETE FROM user_game_tabs WHERE user_id=(SELECT id FROM users WHERE twitch_id=$1) AND tab_id=$2`,[req.session.user.twitchId,tabId]);
    res.setHeader('Cache-Control','no-store');res.json({ok:true});
  }catch(error){console.error('Départ du jeu :',error);res.status(500).json({error:'Présence indisponible.'});}
});

app.get('/api/live-updates', (req, res) => {
  if (!req.session.account) {
    return res.status(401).end();
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders?.();

  res.gamePlayerId = req.session.user?.twitchId || null;
  LIVE_UPDATE_CLIENTS.add(res);
  res.write(`event: connected\ndata: ${JSON.stringify({ ok: true })}\n\n`);

  const keepAlive = setInterval(() => {
    try {
      res.write(': keep-alive\n\n');
    } catch {}
  }, 25000);

  req.on('close', () => {
    clearInterval(keepAlive);
    LIVE_UPDATE_CLIENTS.delete(res);
  });
});

app.get('/api/tracker/status', async (req, res) => {
  try {
    const account = await getBroadcasterAccount(req);
    if (!account) {
      return res.status(403).json({ error: 'Accès réservé au diffuseur.' });
    }

    const row = await getTrackerAuthRow();

    if (!row) {
      return res.json({
        ok: true,
        authorized: false
      });
    }

    let viewerCount = 0;
    if (row.last_live) {
      try {
        const broadcasterId = String(process.env.TWITCH_BROADCASTER_ID || '').trim();
        const streamData = await trackerTwitchFetch(`/streams?user_id=${encodeURIComponent(broadcasterId)}`);
        viewerCount = Number(streamData.data?.[0]?.viewer_count || 0);
      } catch {}
    }

    res.json({
      ok: true,
      authorized: true,
      live: Boolean(row.last_live),
      viewerCount,
      lastPollAt: row.last_poll_at,
      lastSuccessAt: row.last_success_at,
      lastSubSyncAt: row.last_sub_sync_at,
      chatterCount: Number(row.last_chatter_count || 0),
      matchedCount: Number(row.last_matched_count || 0),
      specialMode: row.special_mode || null,
      liveBoosts: await getActiveAdminLiveBoosts(),
      error: row.last_error || null
    });
  } catch (error) {
    console.error('Erreur statut tracker :', error);
    res.status(500).json({ error: 'Impossible de charger le statut du tracker.' });
  }
});

app.get('/api/tracker/detected-accounts', async (req, res) => {
  try {
    const account = await getBroadcasterAccount(req);
    if (!account) return res.status(403).json({ error: 'Accès réservé au diffuseur.' });

    const broadcasterId = String(process.env.TWITCH_BROADCASTER_ID || '').trim();
    const streamData = await trackerTwitchFetch(`/streams?user_id=${encodeURIComponent(broadcasterId)}`);
    const stream = streamData.data?.[0] || null;
    if (!stream) return res.json({ ok: true, live: false, viewerCount: 0, chatters: [], matched: [] });

    const chatters = await getAllChatters();
    const ignored = new Set(['nightbot','streamelements','streamlabs','moobot','fossabot','wizebot','sery_bot','soundalerts','streamstickers']);
    const clean = chatters.filter(item => {
      const id = String(item.user_id || '').trim();
      const login = String(item.user_login || item.user_name || '').trim().toLowerCase();
      return id && !ignored.has(login);
    });
    const ids = [...new Set(clean.map(x => String(x.user_id || '')).filter(Boolean))];
    let linked = [];
    if (ids.length) {
      const q = await pool.query(`
        SELECT u.twitch_id, u.display_name AS watch_game_name, COALESCE(a.username, '') AS account_name
        FROM users u
        LEFT JOIN accounts a ON a.twitch_id = u.twitch_id
        WHERE u.twitch_id = ANY($1::text[])
      `, [ids]);
      linked = q.rows;
    }
    const byId = new Map(linked.map(x => [String(x.twitch_id), x]));
    const list = clean.map(x => {
      const m = byId.get(String(x.user_id || ''));
      return {
        twitchId: String(x.user_id || ''),
        twitchLogin: String(x.user_login || x.user_name || ''),
        twitchName: String(x.user_name || x.user_login || ''),
        linked: Boolean(m),
        watchGameName: m?.watch_game_name || m?.account_name || null
      };
    });
    res.json({
      ok: true,
      live: true,
      viewerCount: Number(stream.viewer_count || 0),
      chatterCount: chatters.length,
      eligibleChatterCount: list.length,
      matchedCount: list.filter(x => x.linked).length,
      chatters: list,
      matched: list.filter(x => x.linked)
    });
  } catch (error) {
    console.error('Erreur comptes détectés tracker :', error);
    res.status(500).json({ error: String(error?.message || 'Impossible de charger les comptes détectés.') });
  }
});

app.post('/api/tracker/run-now', async (req, res) => {
  try {
    const account = await getBroadcasterAccount(req);
    if (!account) {
      return res.status(403).json({ error: 'Accès réservé au diffuseur.' });
    }

    const result = await runTrackerTick();
    res.json(result);
  } catch (error) {
    console.error('Erreur test tracker :', error);
    res.status(500).json({ error: 'Impossible de tester le tracker.' });
  }
});

/* =========================================
   CONNEXION DISCORD / BADGE COMMUNAUTÉ
========================================= */

app.get('/auth/discord', (req, res) => {
  if (!req.session.account) return res.redirect('/');

  if (!process.env.DISCORD_CLIENT_ID || !process.env.DISCORD_CLIENT_SECRET || !process.env.DISCORD_GUILD_ID) {
    return res.status(500).send('Configure DISCORD_CLIENT_ID, DISCORD_CLIENT_SECRET et DISCORD_GUILD_ID dans le fichier .env du serveur.');
  }

  const state = crypto.randomBytes(24).toString('hex');
  req.session.discordOAuthState = state;
  req.session.discordOAuthStateStartedAt = Date.now();

  req.session.save(error => {
    if (error) {
      console.error('Erreur sauvegarde session Discord OAuth :', error);
      return res.status(500).send('Impossible de démarrer la connexion Discord.');
    }
    res.redirect(discordAuthUrl(state));
  });
});

app.get('/auth/discord/callback', async (req, res) => {
  try {
    if (!req.session.account) return res.redirect('/');

    if (!validOAuthCallback(req.query, req.session, 'discordOAuthState')) {
      return res.status(400).send('OAuth Discord invalide.');
    }

    delete req.session.discordOAuthState;
    delete req.session.discordOAuthStateStartedAt;
    await saveSession(req);

    const tokenRes = await fetch('https://discord.com/api/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: String(process.env.DISCORD_CLIENT_ID || ''),
        client_secret: String(process.env.DISCORD_CLIENT_SECRET || ''),
        grant_type: 'authorization_code',
        code: String(req.query.code),
        redirect_uri: discordRedirectUri()
      })
    });

    if (!tokenRes.ok) {
      console.error('Discord token exchange failed:', tokenRes.status, await tokenRes.text());
      return res.redirect('/?discord=error');
    }

    const tokenData = await tokenRes.json();
    const accessToken = tokenData.access_token;

    const userRes = await discordApi('/users/@me', accessToken);
    if (!userRes.ok) return res.redirect('/?discord=error');
    const discordUser = await userRes.json();

    const guildId = String(process.env.DISCORD_GUILD_ID || '').trim();
    const memberRes = await discordApi(
      `/users/@me/guilds/${encodeURIComponent(guildId)}/member`,
      accessToken
    );

    const isMember = memberRes.ok;

    await pool.query(
      `
      UPDATE accounts
      SET discord_user_id = $1,
          discord_username = $2,
          discord_member_verified = discord_member_verified OR $3,
          discord_verified_at = CASE
            WHEN $3 THEN COALESCE(discord_verified_at, CURRENT_TIMESTAMP)
            ELSE discord_verified_at
          END,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $4
      `,
      [
        String(discordUser.id || ''),
        String(discordUser.global_name || discordUser.username || 'Discord'),
        isMember,
        req.session.account.id
      ]
    );

    if (isMember && req.session.user?.twitchId) {
      const linkedUser = await pool.query(
        'SELECT id FROM users WHERE twitch_id = $1 LIMIT 1',
        [req.session.user.twitchId]
      );
      const userId = linkedUser.rows[0]?.id;
      if (userId) {
        await pool.query(
          `
          INSERT INTO user_badges (
            user_id, badge_key, game_id, game_name, badge_name, badge_image, badge_challenge, tier, threshold_hours
          ) VALUES (
            $1,
            'mission:discord:membre-communaute',
            'special-discord',
            'Discord',
            'Membre de la communauté',
            '/badges/discord-1.webp',
            'Rejoindre le serveur Discord de LoVeRDoSeTV',
            'special',
            0
          )
          ON CONFLICT (user_id, badge_key) DO UPDATE SET
            game_name = EXCLUDED.game_name,
            badge_name = EXCLUDED.badge_name,
            badge_image = EXCLUDED.badge_image,
            badge_challenge = EXCLUDED.badge_challenge
          `,
          [userId]
        );
        await awardBadgeEconomyRewardsOnce([userId], 'mission:discord:membre-communaute', BADGE_SOCIAL_REWARD);
      }
    }

    return res.redirect(isMember ? '/?discord=verified' : '/?discord=not-member');
  } catch (error) {
    console.error('Erreur callback Discord :', error);
    return res.redirect('/?discord=error');
  }
});

/* =========================================
   CONNEXION TWITCH
========================================= */

app.get(
  '/auth/twitch',
  (req, res) => {

    if (!req.session.account) {
      return res.redirect('/');
    }

    if (
      !process.env.TWITCH_CLIENT_ID ||
      !process.env.TWITCH_CLIENT_SECRET
    ) {

      return res
        .status(500)
        .send(
          'Configure TWITCH_CLIENT_ID et TWITCH_CLIENT_SECRET.'
        );

    }


    const state =
      crypto
        .randomBytes(24)
        .toString('hex');


    req.session.oauthState =
      state;
    req.session.oauthStateStartedAt = Date.now();

    req.session.save(error => {
      if (error) {
        console.error('Erreur sauvegarde session OAuth :', error);
        return res.status(500).send('Impossible de démarrer la connexion Twitch.');
      }

      res.redirect(
        twitchAuthUrl(state)
      );
    });

  }
);


/* =========================================
   CALLBACK TWITCH
========================================= */

app.get(
  '/auth/twitch/callback',
  async (req, res) => {

    try {

      if (!req.session.account) {
        return res.redirect('/');
      }

      if (
        !validOAuthCallback(req.query, req.session, 'oauthState')
      ) {

        return res
          .status(400)
          .send(
            'OAuth invalide.'
          );

      }

      delete req.session.oauthState;
      delete req.session.oauthStateStartedAt;
      await saveSession(req);

      const tokenRes =
        await fetch(
          'https://id.twitch.tv/oauth2/token',
          {

            method:
              'POST',

            headers: {

              'Content-Type':
                'application/x-www-form-urlencoded'

            },

            body:
              new URLSearchParams({

                client_id:
                  process.env
                    .TWITCH_CLIENT_ID,

                client_secret:
                  process.env
                    .TWITCH_CLIENT_SECRET,

                code:
                  req.query.code,

                grant_type:
                  'authorization_code',

                redirect_uri:
                  `${BASE_URL}/auth/twitch/callback`

              })

          }
        );


      if (!tokenRes.ok) {

        return res
          .status(400)
          .send(
            'Impossible de finaliser la connexion Twitch.'
          );

      }


      const tokens =
        await tokenRes.json();


      const me =
        await twitchFetch(
          '/users',
          tokens.access_token
        );


      const t =
        me.data[0];


      let isSub =
        false;


      try {

        const sub =
          await twitchFetch(

            `/subscriptions/user?broadcaster_id=${
              encodeURIComponent(
                process.env
                  .TWITCH_BROADCASTER_ID ||
                ''
              )
            }&user_id=${
              encodeURIComponent(t.id)
            }`,

            tokens.access_token

          );


        isSub =
          !!sub.data?.length;

      }

      catch {

        isSub =
          false;

      }


      const alreadyLinked = await pool.query(
        `
        SELECT id
        FROM accounts
        WHERE twitch_id = $1
          AND id <> $2
        `,
        [
          t.id,
          req.session.account.id
        ]
      );

      if (alreadyLinked.rows.length > 0) {
        return res
          .status(409)
          .send('Ce compte Twitch est déjà lié à un autre compte.');
      }

      await pool.query(
        `
        INSERT INTO users (
          twitch_id,
          login,
          display_name,
          is_sub,
          profile_image_url
        )

        VALUES (
          $1,
          $2,
          $3,
          $4,
          $5
        )

        ON CONFLICT (twitch_id)

        DO UPDATE SET

          login =
            EXCLUDED.login,

          display_name =
            EXCLUDED.display_name,

          is_sub =
            EXCLUDED.is_sub,

          profile_image_url =
            EXCLUDED.profile_image_url,

          updated_at =
            CURRENT_TIMESTAMP
        `,
        [
          t.id,
          t.login,
          req.session.account.username || t.display_name,
          isSub,
          t.profile_image_url || null
        ]
      );

      await pool.query(`INSERT INTO user_badge_celebrations(user_id,seen_signatures)
        SELECT id,'{}'::text[] FROM users WHERE twitch_id=$1 ON CONFLICT(user_id) DO NOTHING`,[t.id]);

await pool.query(
  `
  UPDATE accounts
  SET
    twitch_id = $1,
    updated_at = CURRENT_TIMESTAMP
  WHERE id = $2
  `,
  [
    t.id,
    req.session.account.id
  ]
);

      const authenticatedAccount = req.session.account;
      const preservedPanelIntent = req.session.twitchPanelIntent;
      await regenerateSession(req);
      if (preservedPanelIntent && Date.now()-preservedPanelIntent.createdAt<20*60*1000) req.session.twitchPanelIntent=preservedPanelIntent;
      req.session.account = authenticatedAccount;

      req.session.user = {

        twitchId:
          t.id,

        login:
          t.login

      };

      await saveSession(req);

      res.redirect('/');

    }

    catch (error) {

      console.error(
        'Erreur connexion Twitch :',
        error
      );


      res
        .status(500)
        .send(
          'Erreur de connexion Twitch.'
        );

    }

  }
);


/* =========================================
   DÉCONNEXION
========================================= */

app.post(
  '/api/logout',
  (req, res) => {

    req.session.destroy(
      () => {

        res.json({
          ok: true
        });

      }
    );

  }
);


/* =========================================
   TITRES COSMÉTIQUES
   Pour l'instant seul le diffuseur possède un titre spécial.
   La boutique pourra ensuite remplacer cette logique par le titre équipé.
========================================= */
function cosmeticTitleForTwitchId(twitchId, equippedTitleKey = null) {
  return titleCosmeticFor(twitchId, equippedTitleKey)?.name || null;
}

/* =========================================
   PROFIL JOUEUR
========================================= */

app.get(
  '/api/me',
  async (req, res) => {

    try {

      if (!req.session.account || !req.session.user) {

        return res.json({
          authenticated:
            false
        });

      }


      const result =
        await pool.query(
          `
          WITH ranked_users AS (
            SELECT
              twitch_id,
              ROW_NUMBER() OVER (
                ORDER BY
                  CASE WHEN creature_id IS NOT NULL THEN 1 ELSE 0 END DESC,
                  CASE WHEN creature_id IS NOT NULL THEN COALESCE(xp, 0) ELSE NULL END DESC NULLS LAST,
                  CASE WHEN creature_id IS NULL THEN COALESCE(watch_seconds, 0) ELSE NULL END DESC NULLS LAST,
                  COALESCE(watch_seconds, 0) DESC,
                  id ASC
              ) AS leaderboard_rank
            FROM users
            WHERE twitch_id IS NOT NULL
          )
          SELECT
            u.id,
            u.twitch_id,
            u.login,
            u.display_name,
            u.is_sub,
            u.profile_image_url,
            u.creature_id,
            u.xp,
            u.pending_xp,
            u.global_xp,
            u.prestige,
            u.egg_fragments,
            u.points,
            u.lifetime_lovercash_earned,
            u.lifetime_lovercash_spent,
            u.watch_seconds,
            u.created_at,
            r.leaderboard_rank,
            a.equipped_title_key,
            a.equipped_background_key,
            a.equipped_frame_key,
            a.equipped_avatar_frame_key
          FROM users u
          LEFT JOIN ranked_users r ON r.twitch_id = u.twitch_id
          LEFT JOIN accounts a ON a.twitch_id = u.twitch_id
          WHERE u.twitch_id = $1
          `,
          [
            req.session.user
              .twitchId
          ]
        );


      const u =
        result.rows[0];


      if (!u) {

        return res.json({
          authenticated:
            false
        });

      }


      const syncedGlobalRewards = await syncGlobalLevelRewards(pool, u.id, req.session.account.id, u.global_xp);
      u.xp = Number(u.xp || 0) + Number(syncedGlobalRewards.lovysXpGranted || 0);
      u.pending_xp = Number(u.pending_xp || 0) + Number(syncedGlobalRewards.pendingXpGranted || 0);
      u.global_xp = Number(syncedGlobalRewards.globalXp ?? u.global_xp ?? 0);
      u.points = Number(u.points || 0) + Number(syncedGlobalRewards.cashGranted || 0);
      u.lifetime_lovercash_earned = Number(u.lifetime_lovercash_earned || 0) + Number(syncedGlobalRewards.cashGranted || 0);

      res.json({

        authenticated:
          true,

        user: {

          ...u,

          game_username:
            req.session.account.username || u.display_name,

          cosmetic_title:
            cosmeticTitleForTwitchId(u.twitch_id, u.equipped_title_key),

          cosmetic_title_color:
            titleCosmeticFor(u.twitch_id, u.equipped_title_key)?.color || null,

          cosmetic_background:
            validCosmeticKey(u.equipped_background_key, 'background'),

          cosmetic_frame:
            validCosmeticKey(u.equipped_frame_key, 'frame'),

          cosmetic_avatar_frame:
            validCosmeticKey(u.equipped_avatar_frame_key, 'avatar_frame'),

          watch_seconds:
            Number(
              u.watch_seconds
            ),

          leaderboard_rank:
            Number(u.leaderboard_rank || 0),

          xp:
            Number(u.xp),

          pending_xp:
            Number(u.pending_xp || 0),

          global_xp:
            Number(u.global_xp || 0),

          prestige:
            Number(u.prestige || 0),

          egg_fragments:
            Number(u.egg_fragments || 0),

          points:
            Number(u.points),

          lifetime_lovercash_earned:
            Number(u.lifetime_lovercash_earned || 0),

          lifetime_lovercash_spent:
            Number(u.lifetime_lovercash_spent || 0),

          progression:
            progressionFromXp(
              u.xp
            ),

          global_progression:
            globalProgressionFromXp(
              u.global_xp
            ),

          global_grade:
            globalGradeForLevel(globalProgressionFromXp(u.global_xp).level),

          creature_milestones:
            CREATURE_MILESTONES,

          egg:
            eggState(u)

        },

        creatures

      });

    }

    catch (error) {

      console.error(
        'Erreur /api/me :',
        error
      );


      res.status(500).json({
        error:
          'Erreur profil'
      });

    }

  }
);


/* =========================================
   ÉCLOSION DE L'ŒUF STANDARD
========================================= */

app.post(
  '/api/egg/hatch',
  async (req, res) => {

    const client = await pool.connect();

    try {

      if (!req.session.account || !req.session.user) {
        return res
          .status(401)
          .json({ error: 'Connexion Twitch requise' });
      }

      await client.query('BEGIN');

      const result = await client.query(
        `
        SELECT
          id,
          twitch_id,
          creature_id,
          watch_seconds,
          pending_xp
        FROM users
        WHERE twitch_id = $1
        FOR UPDATE
        `,
        [req.session.user.twitchId]
      );

      const u = result.rows[0];

      if (!u) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'Joueur introuvable' });
      }

      if (u.creature_id) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'Ton œuf a déjà éclos.' });
      }

      if (Number(u.watch_seconds) < EGG_HATCH_SECONDS) {
        await client.query('ROLLBACK');
        return res.status(400).json({
          error: 'Ton œuf n’est pas encore prêt à éclore.',
          egg: eggState(u)
        });
      }

      const creature = rollStandardEgg();

      await client.query(
        `
        UPDATE users
        SET
          creature_id = $1,
          total_lovys_hatched = COALESCE(total_lovys_hatched, 0) + 1,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = $2
        `,
        [creature.id, u.id]
      );

      await client.query(`UPDATE user_lovys SET is_active=FALSE, updated_at=CURRENT_TIMESTAMP WHERE user_id=$1`, [u.id]);
      await client.query(
        `INSERT INTO user_lovys (user_id, creature_id, xp, is_active, origin) VALUES ($1,$2,0,TRUE,'starter_egg')`,
        [u.id, creature.id]
      );

      await client.query('COMMIT');

      res.json({
        ok: true,
        creature: {
          id: creature.id,
          name: creature.name,
          type: creature.type,
          rarity: creature.rarity,
          dropRate: creature.dropRate
        },
        pendingXpAvailable: Number(u.pending_xp || 0)
      });

    }

    catch (error) {
      try {
        await client.query('ROLLBACK');
      } catch {}

      console.error('Erreur éclosion œuf :', error);

      res.status(500).json({
        error: 'Impossible de faire éclore l’œuf.'
      });
    }

    finally {
      client.release();
    }

  }
);


/* =========================================
   ANCIEN HEARTBEAT DÉSACTIVÉ
========================================= */

app.post('/api/watch/heartbeat', (req, res) => {
  res.status(410).json({
    error: 'Ancien système désactivé. Le temps est désormais compté par le tracker Twitch.'
  });
});



/* =========================================
   BADGES / VITRINE
========================================= */

// =========================================
// DÉFIS JOURNALIERS
// =========================================

app.get('/api/daily-challenges', async (req, res) => {
  try {
    if (!req.session.account || !req.session.user) {
      return res.status(401).json({ error:'Connexion requise.' });
    }

    const userResult = await pool.query(
      `SELECT id FROM users WHERE twitch_id = $1 LIMIT 1`,
      [req.session.user.twitchId]
    );
    const userId = Number(userResult.rows[0]?.id);
    if (!Number.isInteger(userId)) return res.status(404).json({ error:'Joueur introuvable.' });

    const dateKey = dailyChallengeDateKey();
    const definitions = dailyChallengesForDate(dateKey);

    const [activityResult, stateResult] = await Promise.all([
      pool.query(
        `SELECT watch_seconds, global_xp_earned, lovercash_earned FROM user_daily_activity WHERE user_id = $1 AND activity_date = $2::date`,
        [userId, dateKey]
      ),
      pool.query(
        `SELECT challenge_key, completed_at, claimed_at FROM user_daily_challenge_state WHERE user_id = $1 AND challenge_date = $2::date`,
        [userId, dateKey]
      )
    ]);

    const watchSeconds = Math.max(0, Number(activityResult.rows[0]?.watch_seconds) || 0);
    const dailyGlobalXp = Math.max(0, Number(activityResult.rows[0]?.global_xp_earned) || 0);
    const dailyLoverCash = Math.max(0, Number(activityResult.rows[0]?.lovercash_earned) || 0);
    const states = new Map(stateResult.rows.map(row => [row.challenge_key, row]));

    const challenges = definitions.map(def => {
      const state = states.get(def.key);
      const progress = def.type === 'watch' ? Math.min(def.goal, watchSeconds) : def.type === 'cash' ? Math.min(def.goal, dailyLoverCash) : def.type === 'global_xp' ? Math.min(def.goal, dailyGlobalXp) : 0;
      const completed = progress >= def.goal;

      return {
        key:def.key,
        type:def.type,
        network:def.network || null,
        icon:def.icon,
        title:def.title,
        description:def.description,
        goal:def.goal,
        progress,
        completed,
        claimed:Boolean(state?.claimed_at),
        rewardCash:def.rewardCash,
        rewardGlobalXp:def.rewardGlobalXp,
        rewardLovysXp:def.rewardLovysXp || 0
      };
    });

    return res.json({
      ok:true,
      date:dateKey,
      timezone:DAILY_CHALLENGE_TIMEZONE,
      watchSeconds,
      completedCount:challenges.filter(item => item.completed).length,
      claimedCount:challenges.filter(item => item.claimed).length,
      challenges
    });
  } catch (error) {
    console.error('Erreur défis journaliers :', error);
    return res.status(500).json({ error:'Impossible de charger les défis journaliers.' });
  }
});

app.post('/api/daily-challenges/claim', async (req, res) => {
  const client = await pool.connect();
  try {
    if (!req.session.account || !req.session.user) return res.status(401).json({ error:'Connexion requise.' });

    const key = String(req.body?.challengeKey || '').trim();
    const dateKey = dailyChallengeDateKey();
    const challenge = dailyChallengeByKey(key, dateKey);
    if (!challenge) return res.status(400).json({ error:'Ce défi n’est pas actif aujourd’hui.' });

    await client.query('BEGIN');
    const userResult = await client.query(
      `SELECT id, points, global_xp, creature_id, xp, pending_xp FROM users WHERE twitch_id = $1 FOR UPDATE`,
      [req.session.user.twitchId]
    );
    const user = userResult.rows[0];
    if (!user) { await client.query('ROLLBACK'); return res.status(404).json({ error:'Joueur introuvable.' }); }

    await client.query(
      `
      INSERT INTO user_daily_challenge_state (user_id, challenge_date, challenge_key, updated_at)
      VALUES ($1,$2::date,$3,CURRENT_TIMESTAMP)
      ON CONFLICT (user_id, challenge_date, challenge_key) DO NOTHING
      `,
      [user.id, dateKey, key]
    );

    const stateResult = await client.query(
      `SELECT completed_at, claimed_at FROM user_daily_challenge_state WHERE user_id=$1 AND challenge_date=$2::date AND challenge_key=$3 FOR UPDATE`,
      [user.id, dateKey, key]
    );
    const state = stateResult.rows[0];
    if (state?.claimed_at) { await client.query('ROLLBACK'); return res.status(400).json({ error:'Récompense déjà réclamée.' }); }

    let completed = false;
    if (challenge.type === 'watch') {
      const activityResult = await client.query(
        `SELECT watch_seconds FROM user_daily_activity WHERE user_id=$1 AND activity_date=$2::date`,
        [user.id, dateKey]
      );
      completed = Math.max(0, Number(activityResult.rows[0]?.watch_seconds) || 0) >= challenge.goal;
    } else if (challenge.type === 'cash') {
      const ar = await client.query(`SELECT lovercash_earned FROM user_daily_activity WHERE user_id=$1 AND activity_date=$2::date`, [user.id, dateKey]);
      completed = Math.max(0, Number(ar.rows[0]?.lovercash_earned) || 0) >= challenge.goal;
    } else if (challenge.type === 'global_xp') {
      const ar = await client.query(`SELECT global_xp_earned FROM user_daily_activity WHERE user_id=$1 AND activity_date=$2::date`, [user.id, dateKey]);
      completed = Math.max(0, Number(ar.rows[0]?.global_xp_earned) || 0) >= challenge.goal;
    }

    if (!completed) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error:'Le défi n’est pas encore terminé.' });
    }

    await client.query(
      `UPDATE user_daily_challenge_state SET completed_at=COALESCE(completed_at,CURRENT_TIMESTAMP), claimed_at=CURRENT_TIMESTAMP, updated_at=CURRENT_TIMESTAMP WHERE user_id=$1 AND challenge_date=$2::date AND challenge_key=$3`,
      [user.id, dateKey, key]
    );

    const rewardLovysXp = Number(challenge.rewardLovysXp || 0);
    const rewardUpdateResult = await client.query(
      `
      UPDATE users
      SET points = points + $2,
          lifetime_lovercash_earned = lifetime_lovercash_earned + $2,
          global_xp = LEAST(global_xp + $3, $4),
          pending_xp = pending_xp + $5,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING points, global_xp, xp, pending_xp
      `,
      [user.id, Number(challenge.rewardCash || 0), Number(challenge.rewardGlobalXp || 0), globalThresholdForLevel(56), rewardLovysXp]
    );
    const updatedRewards = rewardUpdateResult.rows[0] || {};

    await client.query('COMMIT');
    pushLiveUpdate('challenge-update', { userId:Number(user.id), challengeKey:key, claimed:true, at:Date.now() });

    return res.json({
      ok:true,
      message:'Récompense récupérée !',
      rewardCash:Number(challenge.rewardCash || 0),
      rewardGlobalXp:Number(challenge.rewardGlobalXp || 0),
      rewardLovysXp,
      lovysXpPending:rewardLovysXp > 0,
      balance:Number(updatedRewards.points || 0),
      globalXp:Number(updatedRewards.global_xp || 0),
      creatureXp:Number(updatedRewards.xp || 0),
      pendingXp:Number(updatedRewards.pending_xp || 0)
    });
  } catch (error) {
    try { await client.query('ROLLBACK'); } catch {}
    console.error('Erreur récupération défi journalier :', error);
    return res.status(500).json({ error:'Impossible de récupérer la récompense.' });
  } finally {
    client.release();
  }
});



/* =========================================
   ROUES DE RÉCOMPENSES
========================================= */
app.get('/api/reward-wheels', async (req, res) => {
  const client = await pool.connect();
  try {
    if (!req.session.account || !req.session.user) return res.status(401).json({ error:'Connexion requise.' });
    await client.query('BEGIN');
    const userResult = await client.query(`SELECT id FROM users WHERE twitch_id=$1`, [req.session.user.twitchId]);
    const user = userResult.rows[0];
    if (!user) { await client.query('ROLLBACK'); return res.status(404).json({ error:'Joueur introuvable.' }); }
    const state = await syncRewardWheelState(client, user.id);
    await client.query('COMMIT');

    const lastDaily = state.daily_last_spin_at ? new Date(state.daily_last_spin_at) : null;
    const nextDailyAt = lastDaily ? new Date(lastDaily.getTime() + 24 * 60 * 60 * 1000) : null;
    const dailyAvailable = !nextDailyAt || nextDailyAt.getTime() <= Date.now();
    res.json({
      ok:true,
      daily:{ available:dailyAvailable, lastSpinAt:lastDaily?.toISOString() || null, nextSpinAt:dailyAvailable ? null : nextDailyAt.toISOString(), rewards:DAILY_WHEEL_REWARDS.map(publicWheelReward) },
      weekly:{ available:Boolean(state.weekly_ready), streak:Number(state.weekly_live_progress || 0), attendedLives:Number(state.weekly_live_progress || 0), totalLives:Number(state.total_live_attendance || 0), goal:7, lastSpinAt:state.weekly_last_spin_at ? new Date(state.weekly_last_spin_at).toISOString() : null, rewards:WEEKLY_WHEEL_REWARDS.map(publicWheelReward) }
    });
  } catch (error) {
    try { await client.query('ROLLBACK'); } catch {}
    console.error('Erreur roues de récompenses :', error);
    res.status(500).json({ error:'Impossible de charger les roues.' });
  } finally { client.release(); }
});

app.post('/api/reward-wheels/spin', async (req, res) => {
  const client = await pool.connect();
  try {
    if (!req.session.account || !req.session.user) return res.status(401).json({ error:'Connexion requise.' });
    const wheelType = String(req.body?.wheelType || '').trim();
    if (!['daily','weekly'].includes(wheelType)) return res.status(400).json({ error:'Roue invalide.' });

    await client.query('BEGIN');
    const userResult = await client.query(
      `SELECT id,points,global_xp,pending_xp,egg_fragments FROM users WHERE twitch_id=$1 FOR UPDATE`,
      [req.session.user.twitchId]
    );
    const user = userResult.rows[0];
    if (!user) { await client.query('ROLLBACK'); return res.status(404).json({ error:'Joueur introuvable.' }); }
    const state = await syncRewardWheelState(client, user.id);

    if (wheelType === 'daily' && state.daily_last_spin_at) {
      const nextSpin = new Date(state.daily_last_spin_at).getTime() + 24 * 60 * 60 * 1000;
      if (nextSpin > Date.now()) {
        await client.query('ROLLBACK');
        return res.status(409).json({ error:'La roue quotidienne n’est pas encore disponible.', nextSpinAt:new Date(nextSpin).toISOString() });
      }
    }
    if (wheelType === 'weekly' && !state.weekly_ready) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error:'Assiste à 7 lives différents pour débloquer cette roue.' });
    }

    const rewards = wheelType === 'daily' ? DAILY_WHEEL_REWARDS : WEEKLY_WHEEL_REWARDS;
    const reward = weightedWheelReward(rewards);
    await applyWheelReward(client, user.id, req.session.account.id, reward);

    if (wheelType === 'daily') {
      await client.query(`UPDATE user_reward_wheels SET daily_last_spin_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE user_id=$1`, [user.id]);
    } else {
      const nextCheckpoint = Math.min(
        Number(state.total_live_attendance || 0),
        Number(state.weekly_live_checkpoint || 0) + 7
      );
      const remainingLiveProgress = Math.max(0, Number(state.total_live_attendance || 0) - nextCheckpoint);
      await client.query(
        `UPDATE user_reward_wheels
         SET weekly_last_spin_at=CURRENT_TIMESTAMP,
             weekly_live_checkpoint=$2,
             weekly_ready=$3,
             updated_at=CURRENT_TIMESTAMP
         WHERE user_id=$1`,
        [user.id, nextCheckpoint, remainingLiveProgress >= 7]
      );
    }
    await client.query(
      `INSERT INTO user_reward_wheel_spins (user_id,wheel_type,reward_key,reward_label) VALUES($1,$2,$3,$4)`,
      [user.id, wheelType, reward.key, reward.label]
    );
    const balances = await client.query(`SELECT points,global_xp,pending_xp,egg_fragments FROM users WHERE id=$1`, [user.id]);
    await client.query('COMMIT');
    pushLiveUpdate('shop-update', { twitchId:req.session.user.twitchId });
    res.json({ ok:true, wheelType, reward:publicWheelReward(reward), balances:balances.rows[0] || {} });
  } catch (error) {
    try { await client.query('ROLLBACK'); } catch {}
    console.error('Erreur lancement roue :', error);
    res.status(500).json({ error:'Impossible de lancer la roue.' });
  } finally { client.release(); }
});

app.get('/api/progression', async (req,res)=>{
  try{
    if(!req.session.account||!req.session.user) return res.status(401).json({error:'Connexion requise.'});
    const r=await pool.query(`SELECT id,creature_id,xp,pending_xp,global_xp,prestige,egg_fragments FROM users WHERE twitch_id=$1`,[req.session.user.twitchId]);
    const u=r.rows[0]; if(!u) return res.status(404).json({error:'Joueur introuvable.'});
    const syncedRewards=await syncGlobalLevelRewards(pool,u.id,req.session.account.id,u.global_xp);
    u.xp=Number(u.xp||0)+Number(syncedRewards.lovysXpGranted||0);
    u.global_xp=Number(syncedRewards.globalXp??u.global_xp??0);
    const refreshedXp=await pool.query(`SELECT xp,pending_xp,global_xp FROM users WHERE id=$1`,[u.id]);
    const xpState=refreshedXp.rows[0]||{xp:u.xp,pending_xp:0,global_xp:u.global_xp};
    u.global_xp=Number(xpState.global_xp??u.global_xp??0);
    const gp=globalProgressionFromXp(u.global_xp), cp=progressionFromXp(xpState.xp);
    const reports=await pool.query(`SELECT fight_key,result,reward_creature_xp,reward_global_xp,reward_fragments,created_at FROM user_combat_reports WHERE user_id=$1 ORDER BY id DESC LIMIT 8`,[u.id]);
    res.json({ok:true,globalXp:Number(u.global_xp||0),prestige:Number(u.prestige||0),eggFragments:Number(u.egg_fragments||0),globalProgression:gp,grade:globalGradeForLevel(gp.level),grades:GLOBAL_LEVEL_GRADES,globalLevelXpRewards:GLOBAL_LEVEL_XP_REWARDS,globalLevelCashRewards:GLOBAL_LEVEL_CASH_REWARDS,globalLovysXpRewards:GLOBAL_LOVYS_XP_REWARDS,creatureXp:Number(xpState.xp||0),pendingCreatureXp:Number(xpState.pending_xp||0),creatureProgression:cp,creatureMilestones:CREATURE_MILESTONES,recentReports:reports.rows});
  }catch(e){console.error(e);res.status(500).json({error:'Impossible de charger la progression.'});}
});

app.post('/api/progression/transfer-lovys-xp', async (req,res)=>{
  const client=await pool.connect();
  try{
    if(!req.session.account||!req.session.user) return res.status(401).json({error:'Connexion requise.'});
    const lovysId=Number(req.body?.lovysId);
    await client.query('BEGIN');
    const result=await client.query(`SELECT id,creature_id,xp,pending_xp FROM users WHERE twitch_id=$1 FOR UPDATE`,[req.session.user.twitchId]);
    const user=result.rows[0];
    if(!user){await client.query('ROLLBACK');return res.status(404).json({error:'Joueur introuvable.'});}
    if(!Number.isInteger(lovysId)||lovysId<=0){await client.query('ROLLBACK');return res.status(400).json({error:'Choisis un Lovys de ta collection.'});}
    if(user.creature_id) await client.query(`UPDATE user_lovys SET xp=$2,updated_at=CURRENT_TIMESTAMP WHERE user_id=$1 AND is_active=TRUE`,[user.id,Number(user.xp||0)]);
    const target=(await client.query(`SELECT id,creature_id,xp,is_active FROM user_lovys WHERE id=$1 AND user_id=$2 FOR UPDATE`,[lovysId,user.id])).rows[0];
    if(!target){await client.query('ROLLBACK');return res.status(404).json({error:'Lovys introuvable dans ta collection.'});}
    const reserve=Math.max(0,Math.floor(Number(user.pending_xp||0)));
    const requested=Math.floor(Number(req.body?.amount||reserve));
    const amount=Math.max(0,Math.min(reserve,requested));
    if(amount<=0){await client.query('ROLLBACK');return res.status(400).json({error:'Aucune XP Lovys disponible à transférer.'});}
    await client.query(`UPDATE user_lovys SET xp=xp+$2,updated_at=CURRENT_TIMESTAMP WHERE id=$1`,[target.id,amount]);
    if(target.is_active) await client.query(`UPDATE users SET xp=xp+$2,pending_xp=pending_xp-$2,updated_at=CURRENT_TIMESTAMP WHERE id=$1`,[user.id,amount]);
    else await client.query(`UPDATE users SET pending_xp=pending_xp-$2,updated_at=CURRENT_TIMESTAMP WHERE id=$1`,[user.id,amount]);
    await client.query('COMMIT');
    pushLiveUpdate('game-update',{userId:Number(user.id),at:Date.now()});
    res.json({ok:true,message:`${amount} XP transférée à ton Lovys !`,transferredXp:amount,pendingXp:reserve-amount});
  }catch(error){try{await client.query('ROLLBACK')}catch{};console.error('Erreur transfert XP Lovys :',error);res.status(500).json({error:'Impossible de transférer l’XP au Lovys.'});}finally{client.release();}
});

app.post('/api/prestige', async (req,res)=>{
 const c=await pool.connect(); try{if(!req.session.account||!req.session.user)return res.status(401).json({error:'Connexion requise.'}); await c.query('BEGIN'); const r=await c.query(`SELECT id,global_xp,prestige FROM users WHERE twitch_id=$1 FOR UPDATE`,[req.session.user.twitchId]); const u=r.rows[0]; if(!u){await c.query('ROLLBACK');return res.status(404).json({error:'Joueur introuvable.'});} if(!globalProgressionFromXp(u.global_xp).prestigeReady){await c.query('ROLLBACK');return res.status(400).json({error:'Remplis entièrement la barre du niveau 55 avant de passer Prestige.'});} await syncGlobalLevelRewards(c,u.id,req.session.account.id,u.global_xp); const up=await c.query(`UPDATE users SET global_xp=0,prestige=prestige+1,updated_at=CURRENT_TIMESTAMP WHERE id=$1 RETURNING prestige`,[u.id]); await c.query('COMMIT'); pushLiveUpdate('game-update',{}); res.json({ok:true,message:`Prestige ${up.rows[0].prestige} atteint !`}); }catch(e){try{await c.query('ROLLBACK')}catch{};res.status(500).json({error:'Impossible de passer Prestige.'});}finally{c.release();}
});


const FRAGMENT_EGG_PRICE = 10;
app.post('/api/fragments/buy-egg', async (req,res)=>{
  const client=await pool.connect();
  try{
    if(!req.session.account||!req.session.user)return res.status(401).json({error:'Connexion requise.'});
    const quantity=Math.max(1,Math.min(99,Math.floor(Number(req.body?.quantity||1))));
    const total=quantity*FRAGMENT_EGG_PRICE;
    await client.query('BEGIN');
    const result=await client.query(`SELECT id,egg_fragments FROM users WHERE twitch_id=$1 FOR UPDATE`,[req.session.user.twitchId]);
    const user=result.rows[0];
    if(!user){await client.query('ROLLBACK');return res.status(404).json({error:'Joueur introuvable.'});}
    const balance=Math.max(0,Number(user.egg_fragments||0));
    if(balance<total){await client.query('ROLLBACK');return res.status(400).json({error:`Il te faut ${total} fragments pour cet achat.`});}
    await client.query(`UPDATE users SET egg_fragments=egg_fragments-$2,updated_at=CURRENT_TIMESTAMP WHERE id=$1`,[user.id,total]);
    await client.query(`INSERT INTO shop_inventory (account_id,item_key,quantity) VALUES($1,'mystery_egg',$2) ON CONFLICT (account_id,item_key) DO UPDATE SET quantity=shop_inventory.quantity+$2,purchased_at=CURRENT_TIMESTAMP`,[req.session.account.id,quantity]);
    await recordPlayerHistory(client,{accountId:req.session.account.id,kind:'purchase',itemKey:'mystery_egg',itemName:'Œuf mystère',quantity,currency:'egg_fragments',unitPrice:FRAGMENT_EGG_PRICE,totalCost:total,balanceBefore:balance,balanceAfter:balance-total});
    await client.query('COMMIT');
    const fragments=balance-total;
    pushLiveUpdate('game-update',{userId:Number(user.id),at:Date.now()});
    pushLiveUpdate('shop-update',{twitchId:req.session.user.twitchId});
    res.json({ok:true,quantity,spent:total,fragments,eggQuantity:quantity});
  }catch(error){try{await client.query('ROLLBACK')}catch{};console.error('Erreur achat œuf par fragments :',error);res.status(500).json({error:'Impossible d’acheter cet œuf.'});}finally{client.release();}
});

app.use('/api/pve', createPveRouter({
  pool,
  zones: PVE_ZONES,
  previousFight: pvePreviousFight,
  fightByKey: pveFightByKey,
  creatureBattleStats,
  typeMultiplier,
  globalThresholdForLevel
}));

const achievementService=createAchievements({pool,creatures,zones:PVE_ZONES,progressionFromXp,awardRewards:awardBadgeEconomyRewardsOnce});

app.get('/api/admin/events/badges',async(req,res)=>{
  try{
    if(!await getBroadcasterAccount(req))return res.status(403).json({error:'Accès réservé au diffuseur.'});
    res.json({ok:true,events:await achievementService.adminState()});
  }catch(error){console.error(error);res.status(500).json({error:'Événements indisponibles.'});}
});
app.post('/api/admin/events/badges',async(req,res)=>{
  try{
    const account=await getBroadcasterAccount(req);if(!account)return res.status(403).json({error:'Accès réservé au diffuseur.'});
    if(typeof req.body?.enabled!=='boolean'||!['event','marathon'].includes(req.body?.kind))return res.status(400).json({error:'Événement invalide.'});
    await runTrackerTick();
    const events=await achievementService.toggleEvent(req.body.kind,req.body.enabled);
    await logAdminAction(account.id,null,'badge_event',req.body.enabled?'Événement badges activé':'Événement badges arrêté',{kind:req.body.kind});
    res.json({ok:true,events});
  }catch(error){console.error(error);res.status(500).json({error:'Impossible de modifier cet événement.'});}
});


app.post('/api/badges/celebrations/claim', async (req, res) => {
  if (!req.session.account || !req.session.user) {
    return res.status(401).json({ error: 'Connexion requise.' });
  }
  const validList = value => Array.isArray(value) && value.length <= 500
    && value.every(signature => typeof signature === 'string' && signature.length > 0 && signature.length <= 200);
  if (!validList(req.body?.signatures)) {
    return res.status(400).json({ error: 'Animations invalides.' });
  }
  let client;
  try {
    client = await pool.connect();
    await client.query('BEGIN');
    // Sérialise les demandes PC/mobile : une seule peut obtenir une animation.
    const result = await client.query('SELECT id FROM users WHERE twitch_id = $1 FOR UPDATE', [req.session.user.twitchId]);
    const user = result.rows[0];
    if (!user) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Joueur introuvable.' });
    }
    await client.query(
      'INSERT INTO user_badge_celebrations (user_id, seen_signatures) VALUES ($1, $2::text[]) ON CONFLICT (user_id) DO NOTHING',
      [user.id, [...new Set(req.body.signatures)]]
    );
    const state = await client.query('SELECT seen_signatures FROM user_badge_celebrations WHERE user_id = $1', [user.id]);
    const seen = new Set(state.rows[0].seen_signatures);
    // Les anciennes versions ne mémorisaient que le dernier palier affiché.
    // Ses paliers antérieurs sont déjà acquis : ne pas les rejouer à la mise à jour.
    const stageMax = new Map();
    for (const signature of seen) {
      const match = /^(.*):stage:(\d+)$/.exec(signature);
      if (match) stageMax.set(match[1], Math.max(stageMax.get(match[1]) || 0, Number(match[2])));
    }
    const requested = [...new Set(req.body.signatures)];
    const claimed = requested.filter(signature => {
      if (seen.has(signature)) return false;
      const match = /^(.*):stage:(\d+)$/.exec(signature);
      return !match || Number(match[2]) > (stageMax.get(match[1]) || 0);
    });
    requested.forEach(signature => seen.add(signature));
    await client.query('UPDATE user_badge_celebrations SET seen_signatures = $2::text[] WHERE user_id = $1', [user.id, [...seen]]);
    await client.query('COMMIT');
    res.set('Cache-Control', 'no-store');
    res.json({ claimed });
  } catch (error) {
    if (client) await client.query('ROLLBACK').catch(() => {});
    console.error('Erreur animations badges :', error);
    res.status(500).json({ error: 'Impossible de synchroniser les animations.' });
  } finally {
    if (client) client.release();
  }
});

app.get('/api/badges', async (req, res) => {
  try {
    if (!req.session.account || !req.session.user) {
      return res.status(401).json({ error: 'Connexion requise.' });
    }

    const userResult = await pool.query(
      `SELECT id, is_sub, watch_seconds FROM users WHERE twitch_id = $1`,
      [req.session.user.twitchId]
    );

    const user = userResult.rows[0];

    const showcaseSettingsResult = await pool.query(
      `SELECT badge_showcase_public, badge_showcase_theme, discord_member_verified FROM accounts WHERE id = $1`,
      [req.session.account.id]
    );
    const showcaseSettings = showcaseSettingsResult.rows[0] || {
      badge_showcase_public: true,
      badge_showcase_theme: 'classic'
    };

    if (!user) {
      return res.status(404).json({ error: 'Joueur introuvable.' });
    }

    // Initialise les joueurs sans badge avant d’évaluer leur premier défi.
    // Les anciens comptes gardent la reprise silencieuse prévue pour leurs badges acquis.
    await pool.query(`INSERT INTO user_badge_celebrations(user_id,seen_signatures)
      SELECT $1,'{}'::text[] WHERE NOT EXISTS(SELECT 1 FROM user_badges WHERE user_id=$1)
      ON CONFLICT(user_id) DO NOTHING`,[user.id]);

    if (Boolean(showcaseSettings.discord_member_verified)) {
      await pool.query(
        `
        INSERT INTO user_badges (
          user_id,
          badge_key,
          game_id,
          game_name,
          badge_name,
          badge_image,
          badge_challenge,
          tier,
          threshold_hours
        )
        VALUES (
          $1,
          'mission:discord:membre-communaute',
          'special-discord',
          'Discord',
          'Membre de la communauté',
          '/badges/discord-1.webp',
          'Rejoindre le serveur Discord de LoVeRDoSeTV',
          'special',
          0
        )
        ON CONFLICT (user_id, badge_key) DO UPDATE SET
          game_name = EXCLUDED.game_name,
          badge_name = EXCLUDED.badge_name,
          badge_image = EXCLUDED.badge_image,
          badge_challenge = EXCLUDED.badge_challenge
        `,
        [user.id]
      );
      await awardBadgeEconomyRewardsOnce([user.id], 'mission:discord:membre-communaute', BADGE_SOCIAL_REWARD);
    }

    await achievementService.syncSubscriptionBadges(user.id);
    const subscriptionCycle = (await pool.query('SELECT cycle FROM user_subscription_badge_state WHERE user_id=$1',[user.id])).rows[0]?.cycle || 0;

    // Badge global évolutif : Fidèle de la chaîne
    // Il évolue automatiquement avec le temps total de visionnage du joueur.
    const globalWatchSeconds = Math.max(0, Number(user.watch_seconds) || 0);
    const globalWatchHours = globalWatchSeconds / 3600;
    const globalBadgeKey = 'mission:global:fidele-chaine';

    const globalBadgeStages = WATCH_HOUR_STAGES.map((hours,index)=>({
      minHours:hours,nextHours:WATCH_HOUR_STAGES[index+1]||null,
      image:`/badges/watch-global-${index+1}.webp`,tier:`global-${index+1}`,
      evolution:['Évolution I · Étincelle fidèle','Évolution II · Éclat fidèle','Évolution III · Cœur de fidélité','Évolution IV · Étoile légendaire','Évolution V · Présence mythique'][index]
    }));

    let globalStage = null;
    for (const stage of globalBadgeStages) {
      if (globalWatchHours >= stage.minHours) globalStage = stage;
    }

    if (globalStage) {
      await pool.query(
        `
        INSERT INTO user_badges (
          user_id,
          badge_key,
          game_id,
          game_name,
          badge_name,
          badge_image,
          badge_challenge,
          tier,
          threshold_hours
        )
        VALUES (
          $1,
          $2,
          'global-watch',
          $3,
          'Fidèle de la chaîne',
          $4,
          $5,
          $6,
          $7
        )
        ON CONFLICT (user_id, badge_key) DO UPDATE SET
          game_name = EXCLUDED.game_name,
          badge_name = EXCLUDED.badge_name,
          badge_image = EXCLUDED.badge_image,
          badge_challenge = EXCLUDED.badge_challenge,
          tier = EXCLUDED.tier,
          threshold_hours = EXCLUDED.threshold_hours
        `,
        [
          user.id,
          globalBadgeKey,
          `Global · ${globalStage.evolution}`,
          globalStage.image,
          globalStage.nextHours
            ? `Cumuler ${globalStage.nextHours} h de visionnage total pour faire évoluer le badge`
            : 'Évolution maximale atteinte · 500 h de visionnage total',
          globalStage.tier,
          globalStage.minHours
        ]
      );

      for (const stage of globalBadgeStages) {
        if (globalWatchHours >= stage.minHours) {
          const stageRewards = BADGE_GLOBAL_STAGE_REWARDS[stage.minHours];
          if (stageRewards) {
            await awardBadgeEconomyRewardsOnce(
              [user.id],
              globalBadgeKey,
              stageRewards,
              `stage-${stage.minHours}h-v1`,
              `mission:global:fidele-chaine:${stage.minHours}h`
            );
          }
        }
      }
    }

    await achievementService.reconcileGlobalWatch(user.id,globalWatchHours);

    const [watchResult, badgeResult] = await Promise.all([
      pool.query(
        `
        SELECT game_id, game_name, watch_seconds
        FROM user_game_watch
        WHERE user_id = $1
        ORDER BY watch_seconds DESC, game_name ASC
        `,
        [user.id]
      ),
      pool.query(
        `
        SELECT
          badge_key,
          game_id,
          game_name,
          badge_name,
          badge_image,
          badge_challenge,
          tier,
          threshold_hours,
          equipped_slot,
          leaderboard_slot,
          unlocked_at
        FROM user_badges
        WHERE user_id = $1
        ORDER BY game_name ASC, threshold_hours ASC
        `,
        [user.id]
      )
    ]);

    const dofusWatchSeconds = watchResult.rows
      .filter(item => String(item.game_name || '').trim().toLowerCase() === 'dofus')
      .reduce((total, item) => total + Number(item.watch_seconds || 0), 0);

    const dofusBadgeKey = 'challenge:dofus:gardien-emeraude:50h';
    const dofusUnlocked = badgeResult.rows.find(item => item.badge_key === dofusBadgeKey) || null;

    const palworldWatchSeconds = watchResult.rows
      .filter(item => String(item.game_name || '').trim().toLowerCase() === 'palworld')
      .reduce((total, item) => total + Number(item.watch_seconds || 0), 0);

    const palworldBadgeKey = 'challenge:palworld:maitre-des-spheres:50h';
    const palworldUnlocked = badgeResult.rows.find(item => item.badge_key === palworldBadgeKey) || null;


    const mw4WatchSeconds = watchResult.rows
      .filter(item => String(item.game_name || '').trim().toLowerCase().includes('modern warfare 4'))
      .reduce((total, item) => total + Number(item.watch_seconds || 0), 0);

    const mw4BadgeKey = 'challenge:mw4:operateur-elite:50h';
    const mw4Unlocked = badgeResult.rows.find(item => item.badge_key === mw4BadgeKey) || null;

    const zombieWatchSeconds = watchResult.rows
      .filter(item => String(item.game_id || '') === 'special:zombie')
      .reduce((total, item) => total + Number(item.watch_seconds || 0), 0);

    const zombieBadgeKey = 'mission:zombie:maitre-des-morts:25h';
    const zombieUnlocked = badgeResult.rows.find(item => item.badge_key === zombieBadgeKey) || null;

    const subBadgeKey = 'mission:sub:soutien-absolu';
    const subUnlocked = badgeResult.rows.find(item => item.badge_key === subBadgeKey) || null;

    const discordBadgeKey = 'mission:discord:membre-communaute';
    const discordUnlocked = badgeResult.rows.find(item => item.badge_key === discordBadgeKey) || null;

    const instagramBadgeKey = 'mission:instagram:communaute';
    const instagramUnlocked = badgeResult.rows.find(item => item.badge_key === instagramBadgeKey) || null;

    const tiktokBadgeKey = 'mission:tiktok:communaute';
    const tiktokUnlocked = badgeResult.rows.find(item => item.badge_key === tiktokBadgeKey) || null;

    const globalUnlocked = badgeResult.rows.find(item => item.badge_key === globalBadgeKey) || null;

    const attendanceBadgeKey = 'mission:attendance:lives-assistes';
    const attendanceCountResult = await pool.query(
      `SELECT COUNT(*)::int AS count FROM user_live_attendance WHERE user_id=$1 AND badge_watch_seconds >= $2`,
      [user.id, DAILY_CHALLENGE_LIBRARY.watch_60.goal]
    );
    const liveAttendanceCount = Math.max(0, Number(attendanceCountResult.rows[0]?.count || 0));
    let attendanceStage = null;
    for (const stage of LIVE_ATTENDANCE_STAGES) {
      if (liveAttendanceCount >= stage.count) attendanceStage = stage;
    }
    if (attendanceStage) {
      await pool.query(
        `INSERT INTO user_badges (
           user_id,badge_key,game_id,game_name,badge_name,badge_image,badge_challenge,tier,threshold_hours
         ) VALUES ($1,$2,'live-attendance',$3,'Présence en live',$4,$5,$6,$7)
         ON CONFLICT (user_id,badge_key) DO UPDATE SET
           game_name=EXCLUDED.game_name,
           badge_name=EXCLUDED.badge_name,
           badge_image=EXCLUDED.badge_image,
           badge_challenge=EXCLUDED.badge_challenge,
           tier=EXCLUDED.tier,
           threshold_hours=EXCLUDED.threshold_hours`,
        [
          user.id,
          attendanceBadgeKey,
          `Lives assistés · ${attendanceStage.evolution}`,
          attendanceStage.image,
          attendanceStage.nextCount
            ? `Cumuler 1 h de présence sur ${attendanceStage.nextCount} lives différents pour faire évoluer le badge`
            : 'Évolution maximale atteinte · 250 lives assistés',
          attendanceStage.tier,
          attendanceStage.count
        ]
      );

      for (const stage of LIVE_ATTENDANCE_STAGES) {
        if (liveAttendanceCount < stage.count) continue;
        await awardBadgeEconomyRewardsOnce(
          [user.id],
          attendanceBadgeKey,
          stage.rewards,
          `attendance-${stage.count}-v1`,
          `mission:attendance:lives-assistes:${stage.count}`
        );
        await pool.query(
          `INSERT INTO shop_inventory (account_id,item_key,quantity)
           VALUES ($1,$2,1)
           ON CONFLICT (account_id,item_key) DO NOTHING`,
          [req.session.account.id, stage.titleKey]
        );
      }
    }
    const attendanceUnlockedResult = await pool.query(
      `SELECT badge_key,equipped_slot,leaderboard_slot FROM user_badges WHERE user_id=$1 AND badge_key=$2 LIMIT 1`,
      [user.id, attendanceBadgeKey]
    );
    const attendanceUnlocked = attendanceUnlockedResult.rows[0] || null;
    const attendanceDisplayStage = attendanceStage || LIVE_ATTENDANCE_STAGES[0];
    const attendanceRewardStage = attendanceStage?.nextCount
      ? (LIVE_ATTENDANCE_STAGES.find(stage => stage.count === attendanceStage.nextCount) || attendanceStage)
      : attendanceDisplayStage;

    const currentGlobalStage = globalStage;
    const nextGlobalTargetHours = currentGlobalStage
      ? (currentGlobalStage.nextHours || currentGlobalStage.minHours)
      : 25;
    const globalDisplayStage = currentGlobalStage || {
      minHours: 25,
      nextHours: 25,
      image: '/badges/watch-global-1.webp',
      tier: 'global-1',
      evolution: 'Évolution I · Étincelle fidèle'
    };
    const globalRewardStageHours = currentGlobalStage?.nextHours || currentGlobalStage?.minHours || 25;
    const globalDisplayReward = BADGE_GLOBAL_STAGE_REWARDS[globalRewardStageHours] || BADGE_GLOBAL_STAGE_REWARDS[25];

    const achievementChallenges=await achievementService.sync(user.id,req.session.account.id);
    badgeResult.rows=(await pool.query('SELECT * FROM user_badges WHERE user_id=$1 ORDER BY game_name,threshold_hours',[user.id])).rows;

    const badgeEconomyRewards = [
      ['mission:discord:membre-communaute', BADGE_SOCIAL_REWARD],
      ['mission:instagram:communaute', BADGE_SOCIAL_REWARD],
      ['mission:tiktok:communaute', BADGE_SOCIAL_REWARD],
      // Le bonus abonné est géré par période active dans achievementService.
    ];
    for (const [badgeKey, rewards] of badgeEconomyRewards) {
      await awardBadgeEconomyRewardsOnce([user.id], badgeKey, rewards);
    }

    // Relit l'état XP après la réconciliation des récompenses.
    // Ainsi, les badges déjà débloqués avant l'ajout des récompenses créditent
    // aussi leur XP une seule fois, y compris pendant l'incubation.
    const xpStateResult = await pool.query(
      `SELECT xp, pending_xp, global_xp, points, lifetime_lovercash_earned FROM users WHERE id = $1 LIMIT 1`,
      [user.id]
    );
    const xpState = xpStateResult.rows[0] || { xp: 0, pending_xp: 0 };

    res.json({
      ok: true,
      xpSummary: {
        xp: Number(xpState.xp || 0),
        pendingXp: Number(xpState.pending_xp || 0),
        globalXp: Number(xpState.global_xp || 0),
        points: Number(xpState.points || 0),
        lifetimeCashEarned: Number(xpState.lifetime_lovercash_earned || 0),
        creatureProgression: progressionFromXp(Number(xpState.xp || 0)),
        globalProgression: globalProgressionFromXp(Number(xpState.global_xp || 0)),
        globalGrade: globalGradeForLevel(globalProgressionFromXp(Number(xpState.global_xp || 0)).level)
      },
      showcaseSettings: {
        isPublic: Boolean(showcaseSettings.badge_showcase_public),
        theme: ['classic', 'violet', 'gold', 'neon'].includes(showcaseSettings.badge_showcase_theme)
          ? showcaseSettings.badge_showcase_theme
          : 'classic'
      },
      gameWatch: watchResult.rows.map(item => ({
        gameId: item.game_id,
        gameName: item.game_name,
        watchSeconds: Number(item.watch_seconds)
      })),
      challenges: [
        {
          badgeKey: dofusBadgeKey,
          badgeName: 'Gardien de l’Émeraude',
          badgeImage: '/badges/watch-dofus-1.webp',
          badgeChallenge: 'Regarder 50 h de lives dans la catégorie Dofus',
          gameName: 'Dofus',
          badgeCategory: 'twitch',
          rewardXp: BADGE_TIME_REWARDS[50].lovysXp,
          rewardLovysXp: BADGE_TIME_REWARDS[50].lovysXp,
          rewardGlobalXp: BADGE_TIME_REWARDS[50].globalXp,
          rewardCash: BADGE_TIME_REWARDS[50].cash,
          lovysXpToReserve: true,
          targetHours: 50,
          watchSeconds: dofusWatchSeconds,
          unlocked: Boolean(dofusUnlocked),
          equippedSlot: dofusUnlocked?.equipped_slot === null || dofusUnlocked?.equipped_slot === undefined
            ? null
            : Number(dofusUnlocked.equipped_slot),
          leaderboardSlot: dofusUnlocked?.leaderboard_slot === null || dofusUnlocked?.leaderboard_slot === undefined
            ? null
            : Number(dofusUnlocked.leaderboard_slot)
        },
        {
          badgeKey: palworldBadgeKey,
          badgeName: 'Maître des Sphères',
          badgeImage: '/badges/watch-palworld-1.webp',
          badgeChallenge: 'Regarder 50 h de lives dans la catégorie Palworld',
          gameName: 'Palworld',
          badgeCategory: 'twitch',
          rewardXp: BADGE_TIME_REWARDS[50].lovysXp,
          rewardLovysXp: BADGE_TIME_REWARDS[50].lovysXp,
          rewardGlobalXp: BADGE_TIME_REWARDS[50].globalXp,
          rewardCash: BADGE_TIME_REWARDS[50].cash,
          lovysXpToReserve: true,
          targetHours: 50,
          watchSeconds: palworldWatchSeconds,
          unlocked: Boolean(palworldUnlocked),
          equippedSlot: palworldUnlocked?.equipped_slot === null || palworldUnlocked?.equipped_slot === undefined
            ? null
            : Number(palworldUnlocked.equipped_slot),
          leaderboardSlot: palworldUnlocked?.leaderboard_slot === null || palworldUnlocked?.leaderboard_slot === undefined
            ? null
            : Number(palworldUnlocked.leaderboard_slot)
        },
        {
          badgeKey: mw4BadgeKey,
          badgeName: 'Opérateur d’Élite',
          badgeImage: '/badges/watch-mw4-1.webp',
          badgeChallenge: 'Regarder 50 h de lives dans la catégorie Call of Duty: Modern Warfare 4',
          gameName: 'Call of Duty: Modern Warfare 4',
          badgeCategory: 'twitch',
          rewardXp: BADGE_TIME_REWARDS[50].lovysXp,
          rewardLovysXp: BADGE_TIME_REWARDS[50].lovysXp,
          rewardGlobalXp: BADGE_TIME_REWARDS[50].globalXp,
          rewardCash: BADGE_TIME_REWARDS[50].cash,
          lovysXpToReserve: true,
          targetHours: 50,
          watchSeconds: mw4WatchSeconds,
          unlocked: Boolean(mw4Unlocked),
          equippedSlot: mw4Unlocked?.equipped_slot === null || mw4Unlocked?.equipped_slot === undefined
            ? null
            : Number(mw4Unlocked.equipped_slot),
          leaderboardSlot: mw4Unlocked?.leaderboard_slot === null || mw4Unlocked?.leaderboard_slot === undefined
            ? null
            : Number(mw4Unlocked.leaderboard_slot)
        },
        {
          badgeKey: zombieBadgeKey,
          badgeName: 'Maître des morts',
          badgeImage: '/badges/watch-zombie-1.webp',
          badgeChallenge: 'Regarder 25 h de lives en mode Zombie',
          gameName: 'Zombie',
          missionType: 'special-mode',
          badgeCategory: 'twitch',
          rewardXp: BADGE_TIME_REWARDS[25].lovysXp,
          rewardLovysXp: BADGE_TIME_REWARDS[25].lovysXp,
          rewardGlobalXp: BADGE_TIME_REWARDS[25].globalXp,
          rewardCash: BADGE_TIME_REWARDS[25].cash,
          lovysXpToReserve: true,
          targetHours: 25,
          watchSeconds: zombieWatchSeconds,
          unlocked: Boolean(zombieUnlocked),
          equippedSlot: zombieUnlocked?.equipped_slot === null || zombieUnlocked?.equipped_slot === undefined
            ? null
            : Number(zombieUnlocked.equipped_slot),
          leaderboardSlot: zombieUnlocked?.leaderboard_slot === null || zombieUnlocked?.leaderboard_slot === undefined
            ? null
            : Number(zombieUnlocked.leaderboard_slot)
        },
        {
          badgeKey: discordBadgeKey,
          badgeName: 'Membre de la communauté',
          badgeImage: '/badges/discord-1.webp',
          badgeChallenge: 'Rejoins le serveur Discord de LoVeRDoSeTV et utilise le bouton Discord du défi pour vérifier ton appartenance.',
          gameName: 'Discord',
          missionType: 'discord',
          badgeCategory: 'social',
          rewardXp: BADGE_SOCIAL_REWARD.lovysXp,
          rewardLovysXp: BADGE_SOCIAL_REWARD.lovysXp,
          rewardGlobalXp: BADGE_SOCIAL_REWARD.globalXp,
          rewardCash: BADGE_SOCIAL_REWARD.cash,
          lovysXpToReserve: true,
          socialNetwork: 'discord',
          socialActionUrl: '/auth/discord',
          targetHours: 0,
          watchSeconds: 0,
          unlocked: Boolean(discordUnlocked),
          equippedSlot: discordUnlocked?.equipped_slot === null || discordUnlocked?.equipped_slot === undefined
            ? null
            : Number(discordUnlocked.equipped_slot),
          leaderboardSlot: discordUnlocked?.leaderboard_slot === null || discordUnlocked?.leaderboard_slot === undefined
            ? null
            : Number(discordUnlocked.leaderboard_slot)
        },
        {
          badgeKey: instagramBadgeKey,
          badgeName: 'Communauté Instagram',
          badgeImage: '/badges/instagram-1.webp',
          badgeChallenge: 'Ouvre le compte Instagram de LoVeRDoSeTV avec le bouton de ce défi pour débloquer le badge.',
          gameName: 'Instagram',
          missionType: 'instagram',
          badgeCategory: 'social',
          rewardXp: BADGE_SOCIAL_REWARD.lovysXp,
          rewardLovysXp: BADGE_SOCIAL_REWARD.lovysXp,
          rewardGlobalXp: BADGE_SOCIAL_REWARD.globalXp,
          rewardCash: BADGE_SOCIAL_REWARD.cash,
          lovysXpToReserve: true,
          socialNetwork: 'instagram',
          socialActionUrl: 'https://www.instagram.com/loverdosetv/',
          unlockOnClick: true,
          targetHours: 0,
          watchSeconds: 0,
          unlocked: Boolean(instagramUnlocked),
          equippedSlot: instagramUnlocked?.equipped_slot === null || instagramUnlocked?.equipped_slot === undefined
            ? null
            : Number(instagramUnlocked.equipped_slot),
          leaderboardSlot: instagramUnlocked?.leaderboard_slot === null || instagramUnlocked?.leaderboard_slot === undefined
            ? null
            : Number(instagramUnlocked.leaderboard_slot)
        },
        {
          badgeKey: tiktokBadgeKey,
          badgeName: 'Communauté TikTok',
          badgeImage: '/badges/tiktok-1.webp',
          badgeChallenge: 'Ouvre le compte TikTok de LoVeRDoSeTV avec le bouton de ce défi pour débloquer le badge.',
          gameName: 'TikTok',
          missionType: 'tiktok',
          badgeCategory: 'social',
          rewardXp: BADGE_SOCIAL_REWARD.lovysXp,
          rewardLovysXp: BADGE_SOCIAL_REWARD.lovysXp,
          rewardGlobalXp: BADGE_SOCIAL_REWARD.globalXp,
          rewardCash: BADGE_SOCIAL_REWARD.cash,
          lovysXpToReserve: true,
          socialNetwork: 'tiktok',
          socialActionUrl: 'https://www.tiktok.com/@loverdosetv',
          unlockOnClick: true,
          targetHours: 0,
          watchSeconds: 0,
          unlocked: Boolean(tiktokUnlocked),
          equippedSlot: tiktokUnlocked?.equipped_slot === null || tiktokUnlocked?.equipped_slot === undefined
            ? null
            : Number(tiktokUnlocked.equipped_slot),
          leaderboardSlot: tiktokUnlocked?.leaderboard_slot === null || tiktokUnlocked?.leaderboard_slot === undefined
            ? null
            : Number(tiktokUnlocked.leaderboard_slot)
        },
        {
          badgeKey: subBadgeKey,
          badgeName: 'Soutien Absolu',
          badgeImage: '/badges/subscription-1.webp',
          badgeChallenge: 'Aie un abonnement Twitch actif à LoVeRDoSeTV sur le compte lié au jeu. Le badge reste disponible pendant l’abonnement. Un nouveau bonus est accordé si ton abonnement expire puis que tu te réabonnes.',
          gameName: 'Spécial · Abonnement',
          missionType: 'subscription',
          celebrationCycleId: Number(subscriptionCycle),
          badgeCategory: 'twitch',
          rewardXp: BADGE_SUB_REWARD.lovysXp,
          rewardLovysXp: BADGE_SUB_REWARD.lovysXp,
          rewardGlobalXp: BADGE_SUB_REWARD.globalXp,
          rewardCash: BADGE_SUB_REWARD.cash,
          lovysXpToReserve: true,
          targetHours: 0,
          watchSeconds: 0,
          unlocked: Boolean(subUnlocked),
          equippedSlot: subUnlocked?.equipped_slot === null || subUnlocked?.equipped_slot === undefined
            ? null
            : Number(subUnlocked.equipped_slot),
          leaderboardSlot: subUnlocked?.leaderboard_slot === null || subUnlocked?.leaderboard_slot === undefined
            ? null
            : Number(subUnlocked.leaderboard_slot)
        },
        {
          badgeKey: attendanceBadgeKey,
          badgeName: 'Présence en live',
          badgeImage: attendanceDisplayStage.image,
          badgeChallenge: `Cumule au moins 1 h de visionnage comptabilisée sur chacun de ${attendanceStage?.nextCount || attendanceDisplayStage.count} lives différents de LoVeRDoSeTV. Chaque live compte une seule fois.`,
          gameName: `Lives assistés · ${attendanceDisplayStage.evolution}`,
          missionType: 'live-attendance',
          stages: LIVE_ATTENDANCE_STAGES.map(stage=>({goal:stage.count,name:stage.evolution,badgeChallenge:`Cumule au moins 1 h de visionnage comptabilisée sur chacun de ${stage.count} lives différents de LoVeRDoSeTV. Chaque live compte une seule fois.`,unlocked:liveAttendanceCount>=stage.count,image:stage.image,rewards:stage.rewards,rewardTitle:stage.titleName})),
          badgeCategory: 'twitch',
          rewardXp: attendanceRewardStage.rewards.lovysXp,
          rewardLovysXp: attendanceRewardStage.rewards.lovysXp,
          rewardGlobalXp: attendanceRewardStage.rewards.globalXp,
          rewardCash: attendanceRewardStage.rewards.cash,
          rewardTitle: attendanceRewardStage.titleName,
          celebrationStageId: attendanceStage?.count || 0,
          celebrationStageName: attendanceStage?.evolution || '',
          celebrationRewardLovysXp: attendanceStage?.rewards?.lovysXp || 0,
          celebrationRewardGlobalXp: attendanceStage?.rewards?.globalXp || 0,
          celebrationRewardCash: attendanceStage?.rewards?.cash || 0,
          celebrationRewardTitle: attendanceStage?.titleName || '',
          lovysXpToReserve: true,
          attendanceCount: liveAttendanceCount,
          targetCount: attendanceStage?.nextCount || attendanceDisplayStage.count,
          rewardStageCount: attendanceRewardStage.count,
          evolutionName: attendanceDisplayStage.evolution,
          evolutionLevel: attendanceStage ? LIVE_ATTENDANCE_STAGES.findIndex(stage => stage.count === attendanceStage.count) + 1 : 0,
          maxEvolutionLevel: LIVE_ATTENDANCE_STAGES.length,
          unlocked: Boolean(attendanceUnlocked),
          maxed: Boolean(attendanceStage && !attendanceStage.nextCount),
          equippedSlot: attendanceUnlocked?.equipped_slot === null || attendanceUnlocked?.equipped_slot === undefined
            ? null
            : Number(attendanceUnlocked.equipped_slot),
          leaderboardSlot: attendanceUnlocked?.leaderboard_slot === null || attendanceUnlocked?.leaderboard_slot === undefined
            ? null
            : Number(attendanceUnlocked.leaderboard_slot)
        },
        {
          badgeKey: globalBadgeKey,
          badgeName: 'Fidèle de la chaîne',
          badgeImage: globalDisplayStage.image,
          badgeChallenge: `Cumule ${nextGlobalTargetHours} h de visionnage comptabilisées sur les lives de LoVeRDoSeTV, toutes catégories confondues. Tu peux les cumuler sur plusieurs lives.`,
          gameName: `Global · ${globalDisplayStage.evolution}`,
          missionType: 'global-evolution',
          stages: globalBadgeStages.map(stage=>({goal:stage.minHours,name:stage.evolution,badgeChallenge:`Cumule ${stage.minHours} h de visionnage comptabilisées sur les lives de LoVeRDoSeTV, toutes catégories confondues. Tu peux les cumuler sur plusieurs lives.`,unlocked:globalWatchHours>=stage.minHours,image:stage.image,rewards:BADGE_GLOBAL_STAGE_REWARDS[stage.minHours]})),
          badgeCategory: 'twitch',
          rewardXp: globalDisplayReward.lovysXp,
          rewardLovysXp: globalDisplayReward.lovysXp,
          rewardGlobalXp: globalDisplayReward.globalXp,
          rewardCash: globalDisplayReward.cash,
          celebrationStageId: currentGlobalStage?.minHours || 0,
          celebrationStageName: currentGlobalStage?.evolution || '',
          celebrationRewardLovysXp: currentGlobalStage ? (BADGE_GLOBAL_STAGE_REWARDS[currentGlobalStage.minHours]?.lovysXp || 0) : 0,
          celebrationRewardGlobalXp: currentGlobalStage ? (BADGE_GLOBAL_STAGE_REWARDS[currentGlobalStage.minHours]?.globalXp || 0) : 0,
          celebrationRewardCash: currentGlobalStage ? (BADGE_GLOBAL_STAGE_REWARDS[currentGlobalStage.minHours]?.cash || 0) : 0,
          celebrationRewardTitle: '',
          lovysXpToReserve: true,
          rewardStageHours: globalRewardStageHours,
          evolutionName: globalDisplayStage.evolution,
          evolutionLevel: globalBadgeStages.findIndex(stage => stage.tier === globalDisplayStage.tier) + 1,
          maxEvolutionLevel: globalBadgeStages.length,
          targetHours: nextGlobalTargetHours,
          watchSeconds: globalWatchSeconds,
          unlocked: Boolean(globalUnlocked),
          maxed: Boolean(currentGlobalStage && !currentGlobalStage.nextHours),
          equippedSlot: globalUnlocked?.equipped_slot === null || globalUnlocked?.equipped_slot === undefined
            ? null
            : Number(globalUnlocked.equipped_slot),
          leaderboardSlot: globalUnlocked?.leaderboard_slot === null || globalUnlocked?.leaderboard_slot === undefined
            ? null
            : Number(globalUnlocked.leaderboard_slot)
        }
      ].filter(challenge=>!achievementChallenges.some(item=>item.badgeKey===challenge.badgeKey)).concat(achievementChallenges),
      badges: badgeResult.rows.map(item => ({
        badgeKey: item.badge_key,
        gameId: item.game_id,
        gameName: item.game_name,
        badgeName: item.badge_name || item.game_name || 'Badge',
        badgeImage: item.badge_image || null,
        badgeChallenge: item.badge_challenge || 'Mission à venir',
        tier: item.tier,
        thresholdHours: Number(item.threshold_hours),
        equippedSlot: item.equipped_slot === null ? null : Number(item.equipped_slot),
        leaderboardSlot: item.leaderboard_slot === null ? null : Number(item.leaderboard_slot),
        unlockedAt: item.unlocked_at
      }))
    });
  } catch (error) {
    console.error('Erreur badges :', error);
    res.status(500).json({ error: 'Impossible de charger les badges.' });
  }
});


app.post('/api/badges/social-click', async (req, res) => {
  try {
    if (!req.session.account || !req.session.user) {
      return res.status(401).json({ error: 'Connexion requise.' });
    }

    const network = String(req.body?.network || '').trim().toLowerCase();
    const socialBadges = {
      instagram: {
        badgeKey: 'mission:instagram:communaute',
        gameId: 'social-instagram',
        gameName: 'Instagram',
        badgeName: 'Communauté Instagram',
        badgeImage: '/badges/instagram-1.webp',
        badgeChallenge: 'Visiter le compte Instagram de LoVeRDoSeTV',
        url: 'https://www.instagram.com/loverdosetv/'
      },
      tiktok: {
        badgeKey: 'mission:tiktok:communaute',
        gameId: 'social-tiktok',
        gameName: 'TikTok',
        badgeName: 'Communauté TikTok',
        badgeImage: '/badges/tiktok-1.webp',
        badgeChallenge: 'Visiter le compte TikTok de LoVeRDoSeTV',
        url: 'https://www.tiktok.com/@loverdosetv'
      }
    };

    const badge = socialBadges[network];
    if (!badge) {
      return res.status(400).json({ error: 'Réseau social inconnu.' });
    }

    const userResult = await pool.query(
      'SELECT id FROM users WHERE twitch_id = $1 LIMIT 1',
      [req.session.user.twitchId]
    );
    const userId = userResult.rows[0]?.id;
    if (!userId) {
      return res.status(404).json({ error: 'Joueur introuvable.' });
    }

    await pool.query(
      `
      INSERT INTO user_badges (
        user_id, badge_key, game_id, game_name, badge_name, badge_image, badge_challenge, tier, threshold_hours
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,'social',0)
      ON CONFLICT (user_id, badge_key) DO UPDATE SET
        game_id = EXCLUDED.game_id,
        game_name = EXCLUDED.game_name,
        badge_name = EXCLUDED.badge_name,
        badge_image = EXCLUDED.badge_image,
        badge_challenge = EXCLUDED.badge_challenge,
        tier = EXCLUDED.tier,
        threshold_hours = 0
      `,
      [userId, badge.badgeKey, badge.gameId, badge.gameName, badge.badgeName, badge.badgeImage, badge.badgeChallenge]
    );

    const rewardGranted = await awardBadgeEconomyRewardsOnce([userId], badge.badgeKey, BADGE_SOCIAL_REWARD);

    pushLiveUpdate('challenge-update', {
      userId: Number(userId),
      badgeKey: badge.badgeKey,
      network,
      rewardGranted: Boolean(rewardGranted),
      rewardLovysXp: rewardGranted ? BADGE_SOCIAL_REWARD.lovysXp : 0,
      rewardGlobalXp: rewardGranted ? BADGE_SOCIAL_REWARD.globalXp : 0,
      rewardCash: rewardGranted ? BADGE_SOCIAL_REWARD.cash : 0,
      at: Date.now()
    });

    return res.json({
      ok: true,
      network,
      url: badge.url,
      badgeKey: badge.badgeKey,
      rewardGranted: Boolean(rewardGranted),
      rewardLovysXp: rewardGranted ? BADGE_SOCIAL_REWARD.lovysXp : 0,
      rewardGlobalXp: rewardGranted ? BADGE_SOCIAL_REWARD.globalXp : 0,
      rewardCash: rewardGranted ? BADGE_SOCIAL_REWARD.cash : 0
    });
  } catch (error) {
    console.error('Erreur badge réseau social :', error);
    return res.status(500).json({ error: 'Impossible de débloquer ce badge.' });
  }
});


app.post('/api/badges/showcase-settings', async (req, res) => {
  try {
    if (!req.session.account) {
      return res.status(401).json({ error: 'Connexion requise.' });
    }
    const isPublic = req.body?.isPublic !== false;
    const requestedTheme = String(req.body?.theme || 'classic').trim().toLowerCase();
    const theme = ['classic', 'violet', 'gold', 'neon'].includes(requestedTheme)
      ? requestedTheme
      : 'classic';
    await pool.query(
      `UPDATE accounts
       SET badge_showcase_public = $2,
           badge_showcase_theme = $3,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $1`,
      [req.session.account.id, isPublic, theme]
    );
    res.json({ ok: true, isPublic, theme });
  } catch (error) {
    console.error('Erreur préférences vitrine :', error);
    res.status(500).json({ error: 'Impossible d’enregistrer les préférences de vitrine.' });
  }
});

app.post('/api/badges/equip', async (req, res) => {
  const client = await pool.connect();

  try {
    if (!req.session.account || !req.session.user) {
      return res.status(401).json({ error: 'Connexion requise.' });
    }

    const badgeKey = String(req.body?.badgeKey || '').trim();
    const slot = Number(req.body?.slot);

    if (!badgeKey || !Number.isInteger(slot) || slot < 1 || slot > 6) {
      return res.status(400).json({ error: 'Badge ou emplacement invalide.' });
    }

    await client.query('BEGIN');

    const userResult = await client.query(
      `SELECT id FROM users WHERE twitch_id = $1 FOR UPDATE`,
      [req.session.user.twitchId]
    );

    const user = userResult.rows[0];

    if (!user) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Joueur introuvable.' });
    }

    const badgeResult = await client.query(
      `
      SELECT id
      FROM user_badges
      WHERE user_id = $1 AND badge_key = $2
      FOR UPDATE
      `,
      [user.id, badgeKey]
    );

    if (!badgeResult.rows[0]) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Badge non débloqué.' });
    }

    await client.query(
      `
      UPDATE user_badges
      SET equipped_slot = NULL
      WHERE user_id = $1
        AND (badge_key = $2 OR equipped_slot = $3)
      `,
      [user.id, badgeKey, slot]
    );

    await client.query(
      `
      UPDATE user_badges
      SET equipped_slot = $3
      WHERE user_id = $1 AND badge_key = $2
      `,
      [user.id, badgeKey, slot]
    );

    await client.query('COMMIT');
    res.json({ ok: true, slot });
  } catch (error) {
    try { await client.query('ROLLBACK'); } catch {}
    console.error('Erreur équipement badge :', error);
    res.status(500).json({ error: 'Impossible d’équiper ce badge.' });
  } finally {
    client.release();
  }
});

app.post('/api/badges/unequip', async (req, res) => {
  try {
    if (!req.session.account || !req.session.user) {
      return res.status(401).json({ error: 'Connexion requise.' });
    }

    const slot = Number(req.body?.slot);

    if (!Number.isInteger(slot) || slot < 1 || slot > 6) {
      return res.status(400).json({ error: 'Emplacement invalide.' });
    }

    const userResult = await pool.query(
      `SELECT id FROM users WHERE twitch_id = $1`,
      [req.session.user.twitchId]
    );

    const user = userResult.rows[0];

    if (!user) {
      return res.status(404).json({ error: 'Joueur introuvable.' });
    }

    await pool.query(
      `
      UPDATE user_badges
      SET equipped_slot = NULL
      WHERE user_id = $1 AND equipped_slot = $2
      `,
      [user.id, slot]
    );

    res.json({ ok: true });
  } catch (error) {
    console.error('Erreur retrait badge :', error);
    res.status(500).json({ error: 'Impossible de retirer ce badge.' });
  }
});



async function visitCardBadgeSlots(client,userId){
  const result=await client.query(
    'SELECT badge_key,leaderboard_slot FROM user_badges WHERE user_id=$1 AND leaderboard_slot IS NOT NULL ORDER BY leaderboard_slot',
    [userId]
  );
  return result.rows.map(row=>({badgeKey:row.badge_key,slot:Number(row.leaderboard_slot)}));
}

app.post('/api/badges/leaderboard/equip', async (req, res) => {
  const client = await pool.connect();

  try {
    if (!req.session.account || !req.session.user) {
      return res.status(401).json({ error: 'Connexion requise.' });
    }

    const badgeKey = String(req.body?.badgeKey || '').trim();
    if (!badgeKey) {
      return res.status(400).json({ error: 'Badge invalide.' });
    }

    await client.query('BEGIN');

    const userResult = await client.query(
      `SELECT id FROM users WHERE twitch_id = $1 FOR UPDATE`,
      [req.session.user.twitchId]
    );
    const user = userResult.rows[0];

    if (!user) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Joueur introuvable.' });
    }

    const badgeResult = await client.query(
      `SELECT id, leaderboard_slot
       FROM user_badges
       WHERE user_id = $1 AND badge_key = $2
       FOR UPDATE`,
      [user.id, badgeKey]
    );
    const badge = badgeResult.rows[0];

    if (!badge) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Badge non débloqué.' });
    }

    // Si le badge est déjà affiché, on ne modifie rien ici :
    // le client utilise la route unequip pour le retirer.
    if (badge.leaderboard_slot) {
      const slots=await visitCardBadgeSlots(client,user.id);
      await client.query('COMMIT');
      return res.json({ ok: true, slot: Number(badge.leaderboard_slot), unchanged: true, slots });
    }

    const equippedResult = await client.query(
      `SELECT id, badge_key, leaderboard_slot
       FROM user_badges
       WHERE user_id = $1 AND leaderboard_slot IS NOT NULL
       ORDER BY leaderboard_slot ASC
       FOR UPDATE`,
      [user.id]
    );
    const equipped = equippedResult.rows;

    let slot = 1;

    if (equipped.length === 0) {
      slot = 1;
    } else if (equipped.length === 1) {
      // On garde toujours le premier badge en slot 1 et le nouveau arrive en slot 2.
      const current = equipped[0];
      if (Number(current.leaderboard_slot) !== 1) {
        await client.query(
          `UPDATE user_badges SET leaderboard_slot = NULL WHERE id = $1`,
          [current.id]
        );
        await client.query(
          `UPDATE user_badges SET leaderboard_slot = 1 WHERE id = $1`,
          [current.id]
        );
      }
      slot = 2;
    } else {
      // File FIFO : ancien slot 1 sort, slot 2 devient slot 1,
      // et le nouveau badge prend le slot 2.
      const first = equipped.find(item => Number(item.leaderboard_slot) === 1) || equipped[0];
      const second = equipped.find(item => Number(item.leaderboard_slot) === 2) || equipped[1];

      if (first) {
        await client.query(
          `UPDATE user_badges SET leaderboard_slot = NULL WHERE id = $1`,
          [first.id]
        );
      }
      if (second) {
        await client.query(
          `UPDATE user_badges SET leaderboard_slot = NULL WHERE id = $1`,
          [second.id]
        );
        await client.query(
          `UPDATE user_badges SET leaderboard_slot = 1 WHERE id = $1`,
          [second.id]
        );
      }
      slot = 2;
    }

    await client.query(
      `UPDATE user_badges
       SET leaderboard_slot = $3
       WHERE user_id = $1 AND badge_key = $2`,
      [user.id, badgeKey, slot]
    );

    const slots=await visitCardBadgeSlots(client,user.id);
    await client.query('COMMIT');
    res.json({ ok: true, slot, slots });
  } catch (error) {
    try { await client.query('ROLLBACK'); } catch {}
    console.error('Erreur badge classement :', error);
    res.status(500).json({ error: 'Impossible d’afficher ce badge dans le classement.' });
  } finally {
    client.release();
  }
});

app.post('/api/badges/leaderboard/unequip', async (req, res) => {
  const client = await pool.connect();

  try {
    if (!req.session.account || !req.session.user) {
      return res.status(401).json({ error: 'Connexion requise.' });
    }

    const slot = Number(req.body?.slot);
    if (!Number.isInteger(slot) || slot < 1 || slot > 2) {
      return res.status(400).json({ error: 'Emplacement invalide.' });
    }

    await client.query('BEGIN');

    const userResult = await client.query(
      `SELECT id FROM users WHERE twitch_id = $1 FOR UPDATE`,
      [req.session.user.twitchId]
    );
    const user = userResult.rows[0];

    if (!user) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Joueur introuvable.' });
    }

    await client.query(
      `UPDATE user_badges
       SET leaderboard_slot = NULL
       WHERE user_id = $1 AND leaderboard_slot = $2`,
      [user.id, slot]
    );

    // Si le slot 1 a été retiré, le slot 2 remonte automatiquement.
    if (slot === 1) {
      const slot2Result = await client.query(
        `SELECT id FROM user_badges
         WHERE user_id = $1 AND leaderboard_slot = 2
         LIMIT 1
         FOR UPDATE`,
        [user.id]
      );
      const slot2 = slot2Result.rows[0];
      if (slot2) {
        await client.query(`UPDATE user_badges SET leaderboard_slot = NULL WHERE id = $1`, [slot2.id]);
        await client.query(`UPDATE user_badges SET leaderboard_slot = 1 WHERE id = $1`, [slot2.id]);
      }
    }

    const slots=await visitCardBadgeSlots(client,user.id);
    await client.query('COMMIT');
    res.json({ ok: true, slots });
  } catch (error) {
    try { await client.query('ROLLBACK'); } catch {}
    console.error('Erreur retrait badge classement :', error);
    res.status(500).json({ error: 'Impossible de retirer ce badge du classement.' });
  } finally {
    client.release();
  }
});


/* =========================================
   ADMIN - JOUEURS INSCRITS
========================================= */

app.use('/api', createFeedbackRouter({pool,getBroadcasterAccount}));
const wizebotAlerts=createWizebotAlerts({pool,getBroadcasterAccount,logAdminAction,baseUrl:BASE_URL,eggHatchSeconds:EGG_HATCH_SECONDS});
app.use('/api',wizebotAlerts.router);

registerAdminPlayerHistory(app,{pool,getBroadcasterAccount});

app.get('/api/admin/players', async (req, res) => {
  try {
    const broadcaster = await getBroadcasterAccount(req);
    if (!broadcaster) {
      return res.status(403).json({ error: 'Accès réservé au diffuseur.' });
    }

    const search = String(req.query.search || '').trim().slice(0, 64);

    const [playersResult, totalResult] = await Promise.all([
      pool.query(
        `
        SELECT
          a.id AS account_id,
          a.username,
          a.email,
          a.twitch_id,
          a.discord_user_id,
          a.discord_username,
          a.discord_member_verified,
          a.created_at,
          u.login AS twitch_login,
          u.display_name AS twitch_display_name,
          u.profile_image_url,
          u.creature_id,
          u.xp,
          u.pending_xp,
          u.points,
          u.watch_seconds,
          u.is_sub
        FROM accounts a
        LEFT JOIN users u ON u.twitch_id = a.twitch_id
        WHERE (
          $1 = ''
          OR a.username ILIKE '%' || $1 || '%'
          OR a.email ILIKE '%' || $1 || '%'
          OR COALESCE(u.login, '') ILIKE '%' || $1 || '%'
          OR COALESCE(u.display_name, '') ILIKE '%' || $1 || '%'
          OR COALESCE(a.discord_username, '') ILIKE '%' || $1 || '%'
        )
        ORDER BY a.created_at DESC, a.id DESC
        LIMIT 200
        `,
        [search]
      ),
      pool.query(`SELECT COUNT(*)::int AS total FROM accounts`)
    ]);

    const broadcasterId = String(process.env.TWITCH_BROADCASTER_ID || '').trim();

    res.json({
      ok: true,
      total: Number(totalResult.rows[0]?.total || 0),
      players: playersResult.rows.map(player => ({
        accountId: Number(player.account_id),
        online: Date.now() - (activeGameAccounts.get(Number(player.account_id)) || 0) < PLAYER_ONLINE_WINDOW_MS,
        username: player.username,
        email: player.email,
        createdAt: player.created_at,
        twitchConnected: Boolean(player.twitch_id),
        twitchLogin: player.twitch_login || null,
        profileImageUrl: player.profile_image_url || null,
        discordConnected: Boolean(player.discord_user_id),
        discordUsername: player.discord_username || null,
        discordVerified: Boolean(player.discord_member_verified),
        isBroadcaster: Boolean(player.twitch_id) && player.twitch_id === broadcasterId,
        isSub: Boolean(player.is_sub),
        state: player.creature_id ? 'creature' : (player.twitch_id ? 'egg' : 'account'),
        creatureId: player.creature_id || null,
        xp: Number(player.xp || 0),
        pendingXp: Number(player.pending_xp || 0),
        points: Number(player.points || 0),
        watchSeconds: Number(player.watch_seconds || 0)
      }))
    });
  } catch (error) {
    console.error('Erreur liste joueurs admin :', error);
    res.status(500).json({ error: 'Impossible de charger les joueurs.' });
  }
});


app.get('/api/admin/dashboard', async (req, res) => {
  try {
    const admin=await getBroadcasterAccount(req); if(!admin)return res.status(403).json({error:'Accès réservé au diffuseur.'});
    const today=dailyChallengeDateKey();
    const bossKeys=PVE_FIGHTS.filter(f=>f.finalBoss).map(f=>f.key);
    const [accounts,active,eggs,lovys,combat,economy,wheels,challenges,recent] = await Promise.all([
      pool.query(`SELECT COUNT(*)::int total,COUNT(*) FILTER(WHERE twitch_id IS NOT NULL)::int twitch_linked,COUNT(*) FILTER(WHERE discord_member_verified)::int discord_verified FROM accounts`),
      pool.query(`SELECT COUNT(DISTINCT user_id)::int total FROM user_daily_activity WHERE activity_date=$1 AND watch_seconds>0`,[today]),
      pool.query(`SELECT COUNT(*) FILTER(WHERE status='incubating')::int incubating,COUNT(*) FILTER(WHERE status='ready')::int ready FROM user_incubator_eggs`),
      pool.query(`SELECT COUNT(*)::int total FROM user_lovys`),
      pool.query(`SELECT COUNT(*)::int fights,COUNT(*) FILTER(WHERE result='victory')::int victories,COUNT(*) FILTER(WHERE result='victory' AND fight_key=ANY($1::text[]))::int boss_wins FROM user_combat_reports WHERE (created_at AT TIME ZONE 'Europe/Paris')::date=$2::date`,[bossKeys,today]),
      pool.query(`SELECT COALESCE(SUM(points),0)::double precision cash_balance,COALESCE(SUM(lifetime_lovercash_earned),0)::double precision cash_earned,COALESCE(SUM(lifetime_lovercash_spent),0)::double precision cash_spent FROM users`),
      pool.query(`SELECT COUNT(*)::int total FROM user_reward_wheel_spins WHERE (spun_at AT TIME ZONE 'Europe/Paris')::date=$1::date`,[today]),
      pool.query(`SELECT COUNT(*)::int total FROM user_daily_challenge_state WHERE challenge_date=$1 AND claimed_at IS NOT NULL`,[today]),
      pool.query(`SELECT id,target_account_id,action_key,summary,created_at FROM admin_audit_log ORDER BY created_at DESC LIMIT 8`)
    ]);
    const tracker=await getTrackerAuthRow();
    res.json({ok:true,today,stats:{players:Number(accounts.rows[0]?.total||0),twitchLinked:Number(accounts.rows[0]?.twitch_linked||0),discordVerified:Number(accounts.rows[0]?.discord_verified||0),activeToday:Number(active.rows[0]?.total||0),incubating:Number(eggs.rows[0]?.incubating||0),readyEggs:Number(eggs.rows[0]?.ready||0),lovys:Number(lovys.rows[0]?.total||0),fightsToday:Number(combat.rows[0]?.fights||0),victoriesToday:Number(combat.rows[0]?.victories||0),bossWinsToday:Number(combat.rows[0]?.boss_wins||0),cashBalance:Number(economy.rows[0]?.cash_balance||0),wheelSpinsToday:Number(wheels.rows[0]?.total||0),challengesClaimedToday:Number(challenges.rows[0]?.total||0)},tracker:{authorized:Boolean(tracker),live:Boolean(tracker?.last_live),chatters:Number(tracker?.last_chatter_count||0),matched:Number(tracker?.last_matched_count||0),lastSuccessAt:tracker?.last_success_at||null,error:tracker?.last_error||null},liveBoosts:await getActiveAdminLiveBoosts(),recent:recent.rows});
  }catch(error){console.error('Erreur dashboard admin :',error);res.status(500).json({error:'Impossible de charger le dashboard admin.'});}
});

app.get('/api/admin/economy', async (req,res)=>{
  try{
    const admin=await getBroadcasterAccount(req);if(!admin)return res.status(403).json({error:'Accès réservé au diffuseur.'});
    const [totals,eggs,fragments,series]=await Promise.all([
      pool.query(`SELECT COUNT(*)::int players,COALESCE(SUM(points),0)::double precision balance,COALESCE(SUM(lifetime_lovercash_earned),0)::double precision earned,COALESCE(SUM(lifetime_lovercash_spent),0)::double precision spent,COALESCE(SUM(global_xp),0)::double precision global_xp,COALESCE(SUM(pending_xp),0)::double precision pending_xp FROM users`),
      pool.query(`SELECT COALESCE(SUM(quantity),0)::int inventory_eggs FROM shop_inventory WHERE item_key='mystery_egg'`),
      pool.query(`SELECT COALESCE(SUM(egg_fragments),0)::bigint egg_fragments,COALESCE(SUM(universal_lovys_fragments),0)::bigint universal_fragments FROM users`),
      pool.query(`SELECT activity_date::text date,ROUND(SUM(lovercash_earned)::numeric,2)::double precision cash,ROUND(SUM(global_xp_earned)::numeric,2)::double precision global_xp,SUM(watch_seconds)::bigint watch_seconds FROM user_daily_activity WHERE activity_date>=CURRENT_DATE-INTERVAL '6 days' GROUP BY activity_date ORDER BY activity_date`)
    ]);
    res.json({ok:true,totals:{...totals.rows[0],...eggs.rows[0],...fragments.rows[0]},series:series.rows});
  }catch(error){console.error('Erreur économie admin :',error);res.status(500).json({error:'Impossible de charger l’économie.'});}
});

app.get('/api/admin/history',async(req,res)=>{
  try{const admin=await getBroadcasterAccount(req);if(!admin)return res.status(403).json({error:'Accès réservé au diffuseur.'});const result=await pool.query(`SELECT l.id,l.target_account_id,l.action_key,l.summary,l.details_json,l.created_at,a.username target_username FROM admin_audit_log l LEFT JOIN accounts a ON a.id=l.target_account_id ORDER BY l.created_at DESC LIMIT 150`);res.json({ok:true,items:result.rows});}catch(error){console.error('Erreur historique admin :',error);res.status(500).json({error:'Impossible de charger l’historique.'});}
});

app.get('/api/admin/players/:accountId/detail',async(req,res)=>{
  try{
    const admin=await getBroadcasterAccount(req);if(!admin)return res.status(403).json({error:'Accès réservé au diffuseur.'});
    const accountId=Number.parseInt(req.params.accountId,10);if(!Number.isInteger(accountId)||accountId<=0)return res.status(400).json({error:'Compte invalide.'});
    const ar=await pool.query(`SELECT a.*,u.id user_id,u.login twitch_login,u.display_name twitch_display_name,u.profile_image_url,u.is_sub,u.creature_id,u.xp,u.pending_xp,u.points,u.watch_seconds,u.global_xp,u.prestige,u.egg_fragments,u.universal_lovys_fragments,u.lifetime_lovercash_earned,u.lifetime_lovercash_spent FROM accounts a LEFT JOIN users u ON u.twitch_id=a.twitch_id WHERE a.id=$1`,[accountId]);
    const row=ar.rows[0];if(!row)return res.status(404).json({error:'Joueur introuvable.'});
    let lovys=[],incubator=[],badges=[],pve=[];
    const inventory=(await pool.query(`SELECT item_key,quantity,purchased_at FROM shop_inventory WHERE account_id=$1 AND quantity>0 ORDER BY item_key`,[accountId])).rows.map(item=>({...item,name:shopItemByKey(item.item_key)?.name||item.item_key}));
    if(row.user_id){
      const results=await Promise.all([
        pool.query(`SELECT id,creature_id,xp,is_active,fragments,rank,hatched_at FROM user_lovys WHERE user_id=$1 ORDER BY is_active DESC,hatched_at`,[row.user_id]),
        pool.query(`SELECT id,slot,egg_key,watched_seconds,status,placed_at FROM user_incubator_eggs WHERE user_id=$1 ORDER BY slot`,[row.user_id]),
        pool.query(`SELECT badge_key,badge_name,badge_image,tier,unlocked_at FROM user_badges WHERE user_id=$1 ORDER BY unlocked_at DESC`,[row.user_id]),
        pool.query(`SELECT fight_key,wins,attempts,first_won_at,last_fought_at FROM user_pve_progress WHERE user_id=$1 ORDER BY last_fought_at DESC NULLS LAST`,[row.user_id])
      ]);
      lovys=results[0].rows.map(l=>{const c=creatures.find(x=>x.id===l.creature_id);return {...l,name:c?.name||l.creature_id,rarity:c?.rarity||'—',type:c?.type||'—',level:progressionFromXp(Number(l.xp||0)).level};});
      incubator=results[1].rows;badges=results[2].rows;pve=results[3].rows;
    }
    res.json({ok:true,player:{accountId:Number(row.id),username:row.username,email:row.email,createdAt:row.created_at,twitchConnected:Boolean(row.twitch_id),twitchLogin:row.twitch_login||null,twitchDisplayName:row.twitch_display_name||null,profileImageUrl:row.profile_image_url||null,discordConnected:Boolean(row.discord_user_id),discordUsername:row.discord_username||null,discordVerified:Boolean(row.discord_member_verified),isBroadcaster:String(row.twitch_id||'')===String(process.env.TWITCH_BROADCASTER_ID||''),isSub:Boolean(row.is_sub),userId:row.user_id?Number(row.user_id):null,activeCreatureId:row.creature_id||null,xp:Number(row.xp||0),pendingXp:Number(row.pending_xp||0),points:Number(row.points||0),watchSeconds:Number(row.watch_seconds||0),globalXp:Number(row.global_xp||0),globalLevel:globalProgressionFromXp(Number(row.global_xp||0)).level,prestige:Number(row.prestige||0),eggFragments:Number(row.egg_fragments||0),universalFragments:Number(row.universal_lovys_fragments||0),cashEarned:Number(row.lifetime_lovercash_earned||0),cashSpent:Number(row.lifetime_lovercash_spent||0),lovys,incubator,badges,pve,inventory}});
  }catch(error){console.error('Erreur détail joueur admin :',error);res.status(500).json({error:'Impossible de charger ce joueur.'});}
});

// Correction administrative d'une adresse existante, tracée et réservée au diffuseur.
app.patch('/api/admin/players/:accountId/email', async (req,res) => {
  let client;
  try {
    const admin = await getBroadcasterAccount(req);
    if (!admin) return res.status(403).json({error:'Accès réservé au diffuseur.'});
    const id = Number(req.params.accountId);
    const email = String(req.body?.email || '').trim().toLowerCase();
    if (!Number.isSafeInteger(id) || id < 1) return res.status(400).json({error:'Compte invalide.'});
    if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({error:'Adresse e-mail invalide.'});
    client = await pool.connect(); await client.query('BEGIN');
    const original = (await client.query('SELECT id,email,username FROM accounts WHERE id=$1 FOR UPDATE',[id])).rows[0];
    if (!original) {await client.query('ROLLBACK');return res.status(404).json({error:'Joueur introuvable.'});}
    if (!original.email) {await client.query('ROLLBACK');return res.status(400).json({error:'Ce compte ne possède pas encore d’adresse e-mail.'});}
    if (String(original.email).toLowerCase() === email) {await client.query('ROLLBACK');return res.json({ok:true,email});}
    const used = (await client.query('SELECT id FROM accounts WHERE LOWER(email)=$1 AND id<>$2 LIMIT 1',[email,id])).rowCount;
    if (used) {await client.query('ROLLBACK');return res.status(409).json({error:'Adresse déjà utilisée.'});}
    await client.query('UPDATE accounts SET email=$2 WHERE id=$1',[id,email]);
    await logAdminAction(admin.id,id,'change_email',`Adresse e-mail corrigée · ${original.username}`,{oldEmail:original.email,newEmail:email},client);
    await client.query('COMMIT');
    res.json({ok:true,email});
  } catch (error) {
    if(client)try{await client.query('ROLLBACK');}catch{}
    console.error('Correction e-mail admin :',error);
    res.status(error.code==='23505'?409:500).json({error:error.code==='23505'?'Adresse déjà utilisée.':'Modification impossible.'});
  } finally {client?.release();}
});

app.post('/api/admin/players/:accountId/action',async(req,res)=>{
  const client=await pool.connect();
  try{
    const admin=await getBroadcasterAccount(req);if(!admin)return res.status(403).json({error:'Accès réservé au diffuseur.'});
    const accountId=Number.parseInt(req.params.accountId,10);if(!Number.isInteger(accountId)||accountId<=0)return res.status(400).json({error:'Compte invalide.'});
    const action=String(req.body?.action||'').trim();const reason=String(req.body?.reason||'').trim().slice(0,180);
    await client.query('BEGIN');
    const target=(await client.query(`SELECT a.id,a.username,a.twitch_id,u.id user_id FROM accounts a LEFT JOIN users u ON u.twitch_id=a.twitch_id WHERE a.id=$1 FOR UPDATE OF a`,[accountId])).rows[0];
    if(!target){await client.query('ROLLBACK');return res.status(404).json({error:'Joueur introuvable.'});}
    if(!target.user_id && !['grant_egg','reset_account'].includes(action)){await client.query('ROLLBACK');return res.status(400).json({error:'Ce compte doit d’abord être lié à Twitch.'});}
    let summary='',details={reason};
    const boundedDelta=(limit=1000000)=>Math.max(-limit,Math.min(limit,Math.round(Number(req.body?.amount||0))));
    if(action==='cash'||action==='global_xp'||action==='pending_xp'||action==='egg_fragments'||action==='universal_fragments'){
      const delta=boundedDelta(action.includes('fragments')?100000:1000000);if(!delta){await client.query('ROLLBACK');return res.status(400).json({error:'Montant invalide.'});}
      const column={cash:'points',global_xp:'global_xp',pending_xp:'pending_xp',egg_fragments:'egg_fragments',universal_fragments:'universal_lovys_fragments'}[action];
      const max=action==='global_xp'?globalThresholdForLevel(56):null;
      const expr=max?`LEAST($3,GREATEST(0,${column}+$2))`:`GREATEST(0,${column}+$2)`;
      await client.query(`UPDATE users SET ${column}=${expr},updated_at=CURRENT_TIMESTAMP WHERE id=$1`,max?[target.user_id,delta,max]:[target.user_id,delta]);
      const label={cash:"LoVeR'Cash",global_xp:'XP globale',pending_xp:'XP Lovys en réserve',egg_fragments:"fragments d'œuf",universal_fragments:'fragments universels'}[action];summary=`${delta>0?'+':''}${delta} ${label} · ${target.username}`;details={...details,delta,field:action};
    }else if(action==='prestige'){
      const value=Math.max(0,Math.min(99,Math.floor(Number(req.body?.amount||0))));await client.query(`UPDATE users SET prestige=$2,updated_at=CURRENT_TIMESTAMP WHERE id=$1`,[target.user_id,value]);summary=`Prestige réglé à ${value} · ${target.username}`;details={...details,value};
    }else if(action==='grant_egg'){
      const quantity=Math.max(1,Math.min(20,Math.floor(Number(req.body?.amount||1))));await client.query(`INSERT INTO shop_inventory(account_id,item_key,quantity) VALUES($1,'mystery_egg',$2) ON CONFLICT(account_id,item_key) DO UPDATE SET quantity=shop_inventory.quantity+$2,purchased_at=CURRENT_TIMESTAMP`,[accountId,quantity]);summary=`+${quantity} œuf(s) mystère · ${target.username}`;details={...details,quantity};
    }else if(action==='lovys_fragments'){
      const lovysId=Number.parseInt(req.body?.lovysId,10),delta=boundedDelta(100000);if(!lovysId||!delta){await client.query('ROLLBACK');return res.status(400).json({error:'Lovys ou montant invalide.'});}const lr=await client.query(`UPDATE user_lovys SET fragments=GREATEST(0,fragments+$3),updated_at=CURRENT_TIMESTAMP WHERE id=$1 AND user_id=$2 RETURNING creature_id,fragments`,[lovysId,target.user_id,delta]);if(!lr.rowCount){await client.query('ROLLBACK');return res.status(404).json({error:'Lovys introuvable.'});}summary=`${delta>0?'+':''}${delta} fragments ${creatures.find(c=>c.id===lr.rows[0].creature_id)?.name||lr.rows[0].creature_id} · ${target.username}`;details={...details,lovysId,delta};
    }else if(action==='reset_account'){
      if(String(req.body?.confirmUsername||'')!==target.username){
        await client.query('ROLLBACK');return res.status(400).json({error:'Recopie exactement le pseudo du joueur pour confirmer la réinitialisation.'});
      }
      await resetPlayerProgress(client,target,{achievementService,changeTradeAsset});
      summary=`Compte remis à zéro · ${target.username}`;
      details={...details,username:target.username,identitiesPreserved:true};
    }else if(action==='reset_battle'){
      await client.query(`DELETE FROM user_pve_battles WHERE user_id=$1`,[target.user_id]);summary=`Combat actif réinitialisé · ${target.username}`;
    }else if(action==='reset_pve'){
      await client.query(`DELETE FROM user_pve_battles WHERE user_id=$1`,[target.user_id]);await client.query(`DELETE FROM user_pve_progress WHERE user_id=$1`,[target.user_id]);summary=`Progression PvE réinitialisée · ${target.username}`;
    }else{await client.query('ROLLBACK');return res.status(400).json({error:'Action admin inconnue.'});}
    await logAdminAction(admin.id,accountId,action,summary,details,client);
    await client.query('COMMIT');
    if(target.twitch_id){pushLiveUpdate('game-update',{twitchId:target.twitch_id,at:Date.now()});pushLiveUpdate('shop-update',{twitchId:target.twitch_id});}
    if(action==='reset_account'){pushLiveUpdate('account-reset',{twitchId:target.twitch_id,at:Date.now()});pushLiveUpdate('trade-update',{at:Date.now()});}
    res.json({ok:true,summary});
  }catch(error){try{await client.query('ROLLBACK')}catch{};console.error('Erreur action joueur admin :',error);res.status(500).json({error:'Impossible d’appliquer cette correction.'});}finally{client.release();}
});

app.delete('/api/admin/players/:accountId', async (req, res) => {
  const client = await pool.connect();

  try {
    const broadcaster = await getBroadcasterAccount(req);
    if (!broadcaster) {
      return res.status(403).json({ error: 'Accès réservé au diffuseur.' });
    }

    const accountId = Number.parseInt(req.params.accountId, 10);
    if (!Number.isInteger(accountId) || accountId <= 0) {
      return res.status(400).json({ error: 'Compte invalide.' });
    }

    if (accountId === Number(broadcaster.id)) {
      return res.status(400).json({ error: 'Ton compte diffuseur ne peut pas être supprimé depuis ce panneau.' });
    }

    await client.query('BEGIN');

    const targetResult = await client.query(
      `SELECT id, username, twitch_id FROM accounts WHERE id = $1 FOR UPDATE`,
      [accountId]
    );
    const target = targetResult.rows[0];

    if (!target) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Compte introuvable.' });
    }

    if (target.twitch_id) {
      await client.query(`DELETE FROM users WHERE twitch_id = $1`, [target.twitch_id]);
    }

    await client.query(`DELETE FROM accounts WHERE id = $1`, [target.id]);
    await logAdminAction(broadcaster.id, target.id, 'delete_account', `Compte supprimé · ${target.username}`, { username:target.username }, client);
    await client.query('COMMIT');

    res.json({ ok: true, deletedUsername: target.username });
  } catch (error) {
    try { await client.query('ROLLBACK'); } catch {}
    console.error('Erreur suppression joueur admin :', error);
    res.status(500).json({ error: 'Impossible de supprimer ce compte.' });
  } finally {
    client.release();
  }
});


/* =========================================
   INCUBATEUR MULTI-ŒUFS
========================================= */
app.get('/api/incubator', async (req, res) => {
  try {
    if (!req.session.account || !req.session.user) return res.status(401).json({ error:'Connexion requise.' });

    const userResult = await pool.query(
      `SELECT id, creature_id, watch_seconds, pending_xp FROM users WHERE twitch_id=$1 LIMIT 1`,
      [req.session.user.twitchId]
    );
    const user = userResult.rows[0];
    if (!user) return res.status(404).json({ error:'Profil introuvable.' });

    const eggsResult = await pool.query(
      `SELECT id, slot, egg_key, watched_seconds, status, placed_at FROM user_incubator_eggs WHERE user_id=$1 ORDER BY slot ASC`,
      [user.id]
    );
    const inventoryResult = await pool.query(
      `SELECT quantity FROM shop_inventory WHERE account_id=$1 AND item_key='mystery_egg' LIMIT 1`,
      [req.session.account.id]
    );

    const slots = [1,2,3].map(slot => {
      // Tant que le premier Lovys n'a pas éclos, le slot 1 reste l'œuf historique.
      if (slot === 1 && !user.creature_id) {
        const watched = Math.max(0, Math.min(EGG_HATCH_SECONDS, Number(user.watch_seconds || 0)));
        return {
          slot,
          source:'starter',
          eggKey:'starter_egg',
          watchedSeconds:watched,
          progress:Math.min(100, watched / EGG_HATCH_SECONDS * 100),
          ready:watched >= EGG_HATCH_SECONDS,
          pendingXp:Number(user.pending_xp || 0)
        };
      }

      const extra = eggsResult.rows.find(row => Number(row.slot) === slot);
      if (!extra) return { slot, empty:true };
      const watched = Math.max(0, Math.min(EGG_HATCH_SECONDS, Number(extra.watched_seconds || 0)));
      return {
        slot,
        source:'extra',
        eggId:Number(extra.id),
        eggKey:extra.egg_key,
        watchedSeconds:watched,
        progress:Math.min(100, watched / EGG_HATCH_SECONDS * 100),
        ready:extra.status === 'ready' || watched >= EGG_HATCH_SECONDS,
        placedAt:extra.placed_at
      };
    });

    res.json({
      ok:true,
      slots,
      availableEggs:Number(inventoryResult.rows[0]?.quantity || 0),
      hatchSeconds:EGG_HATCH_SECONDS
    });
  } catch (error) {
    console.error('Erreur /api/incubator :', error);
    res.status(500).json({ error:'Impossible de charger l’incubateur.' });
  }
});

app.post('/api/incubator/place', async (req, res) => {
  const client = await pool.connect();
  try {
    if (!req.session.account || !req.session.user) return res.status(401).json({ error:'Connexion requise.' });
    const slot = Number(req.body?.slot);
    if (![1,2,3].includes(slot)) return res.status(400).json({ error:'Emplacement invalide.' });

    await client.query('BEGIN');
    const userResult = await client.query(
      `SELECT id, creature_id FROM users WHERE twitch_id=$1 FOR UPDATE`,
      [req.session.user.twitchId]
    );
    const user = userResult.rows[0];
    if (!user) { await client.query('ROLLBACK'); return res.status(404).json({ error:'Profil introuvable.' }); }
    if (slot === 1 && !user.creature_id) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error:'Le premier emplacement est déjà utilisé par ton œuf de départ.' });
    }

    const occupied = await client.query(
      `SELECT 1 FROM user_incubator_eggs WHERE user_id=$1 AND slot=$2 FOR UPDATE`,
      [user.id, slot]
    );
    if (occupied.rowCount) { await client.query('ROLLBACK'); return res.status(400).json({ error:'Cet emplacement est déjà occupé.' }); }

    const inv = await client.query(
      `SELECT quantity FROM shop_inventory WHERE account_id=$1 AND item_key='mystery_egg' FOR UPDATE`,
      [req.session.account.id]
    );
    const quantity = Number(inv.rows[0]?.quantity || 0);
    if (quantity <= 0) { await client.query('ROLLBACK'); return res.status(400).json({ error:'Tu ne possèdes aucun Œuf mystère à placer.' }); }

    await client.query(
      `INSERT INTO user_incubator_eggs (user_id, slot, egg_key) VALUES ($1,$2,'mystery_egg')`,
      [user.id, slot]
    );
    await client.query(
      `UPDATE shop_inventory SET quantity=quantity-1 WHERE account_id=$1 AND item_key='mystery_egg'`,
      [req.session.account.id]
    );
    await recordPlayerHistory(client,{accountId:req.session.account.id,kind:'use',itemKey:'mystery_egg',itemName:'Œuf mystère',quantity:1,details:{slot,message:`Œuf placé dans l’emplacement ${slot}.`}});
    await client.query('COMMIT');
    pushLiveUpdate('incubator-update', { twitchId:req.session.user.twitchId });
    res.json({ ok:true, slot, message:'Œuf placé dans l’incubateur.' });
  } catch (error) {
    try { await client.query('ROLLBACK'); } catch {}
    console.error('Erreur placement incubateur :', error);
    res.status(500).json({ error:'Impossible de placer cet œuf.' });
  } finally {
    client.release();
  }
});


app.post('/api/incubator/hatch', async (req,res)=>{
  const client=await pool.connect();
  try{
    if(!req.session.account||!req.session.user) return res.status(401).json({error:'Connexion requise.'});
    const slot=Number(req.body?.slot);
    if(![1,2,3].includes(slot)) return res.status(400).json({error:'Emplacement invalide.'});
    await client.query('BEGIN');
    const ur=await client.query(`SELECT id,creature_id,universal_lovys_fragments FROM users WHERE twitch_id=$1 FOR UPDATE`,[req.session.user.twitchId]);
    const user=ur.rows[0];
    if(!user){await client.query('ROLLBACK');return res.status(404).json({error:'Joueur introuvable.'});}
    if(!user.creature_id){await client.query('ROLLBACK');return res.status(400).json({error:'Fais d’abord éclore ton œuf de départ.'});}
    const er=await client.query(`SELECT id,watched_seconds,status FROM user_incubator_eggs WHERE user_id=$1 AND slot=$2 FOR UPDATE`,[user.id,slot]);
    const egg=er.rows[0];
    if(!egg){await client.query('ROLLBACK');return res.status(404).json({error:'Aucun œuf dans cet emplacement.'});}
    if(Number(egg.watched_seconds||0)<EGG_HATCH_SECONDS && egg.status!=='ready'){await client.query('ROLLBACK');return res.status(400).json({error:'Cet œuf n’est pas encore prêt à éclore.'});}
    const creature=rollStandardEgg();
    const existing=(await client.query(`SELECT id,rank,fragments FROM user_lovys WHERE user_id=$1 AND creature_id=$2 FOR UPDATE`,[user.id,creature.id])).rows[0];
    let lovysId,duplicate=false,fragmentsGained=0,universalFragmentsGained=0,currentFragments=0,currentRank=1,currentUniversalFragments=Number(user.universal_lovys_fragments||0);
    if(existing){
      duplicate=true;
      const normalReward=duplicateFragmentsForRarity(creature.rarity);
      currentRank=Number(existing.rank||1);
      if(currentRank>=LOVYS_MAX_RANK){
        universalFragmentsGained=Math.max(1,Math.ceil(normalReward/2));
        const universal=await client.query(`UPDATE users SET universal_lovys_fragments=universal_lovys_fragments+$2,updated_at=CURRENT_TIMESTAMP WHERE id=$1 RETURNING universal_lovys_fragments`,[user.id,universalFragmentsGained]);
        currentUniversalFragments=Number(universal.rows[0].universal_lovys_fragments||0);lovysId=Number(existing.id);currentFragments=Number(existing.fragments||0);
      }else{
        fragmentsGained=normalReward;
        const upgraded=await client.query(`UPDATE user_lovys SET fragments=fragments+$2,updated_at=CURRENT_TIMESTAMP WHERE id=$1 RETURNING id,rank,fragments`,[existing.id,fragmentsGained]);
        lovysId=Number(upgraded.rows[0].id);currentFragments=Number(upgraded.rows[0].fragments||0);currentRank=Number(upgraded.rows[0].rank||1);
      }
    }else{
      const created=await client.query(`INSERT INTO user_lovys (user_id,creature_id,xp,is_active,origin,rank,fragments) VALUES($1,$2,0,FALSE,'incubator',1,0) RETURNING id`,[user.id,creature.id]);
      lovysId=Number(created.rows[0].id);
    }
    await client.query(`UPDATE users SET total_lovys_hatched=COALESCE(total_lovys_hatched,0)+1,updated_at=CURRENT_TIMESTAMP WHERE id=$1`,[user.id]);
    await client.query(`DELETE FROM user_incubator_eggs WHERE id=$1`,[egg.id]);
    await client.query('COMMIT');
    pushLiveUpdate('incubator-update',{twitchId:req.session.user.twitchId});
    res.json({ok:true,lovysId,duplicate,fragmentsGained,universalFragmentsGained,currentFragments,currentRank,currentUniversalFragments,creature:{id:creature.id,name:creature.name,type:creature.type,rarity:creature.rarity,dropRate:creature.dropRate,duplicate,fragmentsGained,universalFragmentsGained,currentFragments,currentRank,currentUniversalFragments}});
  }catch(error){try{await client.query('ROLLBACK')}catch{};console.error('Erreur éclosion œuf incubateur :',error);res.status(500).json({error:'Impossible de faire éclore cet œuf.'});}finally{client.release();}
});

app.get('/api/lovys', async (req,res)=>{
  try{
    if(!req.session.account||!req.session.user) return res.status(401).json({error:'Connexion requise.'});
    const ur=await pool.query(`SELECT id,creature_id,xp,pending_xp,universal_lovys_fragments,is_sub FROM users WHERE twitch_id=$1 LIMIT 1`,[req.session.user.twitchId]);
    const user=ur.rows[0];
    if(!user) return res.status(404).json({error:'Joueur introuvable.'});
    if(user.creature_id){
      await pool.query(`UPDATE user_lovys SET xp=$2, updated_at=CURRENT_TIMESTAMP WHERE user_id=$1 AND is_active=TRUE`,[user.id,Number(user.xp||0)]);
    }
    const rows=(await pool.query(`SELECT id,creature_id,xp,is_active,origin,hatched_at,rank,fragments FROM user_lovys WHERE user_id=$1 ORDER BY is_active DESC,hatched_at ASC,id ASC`,[user.id])).rows;
    const [personalBoostResult, adminBoost] = await Promise.all([
      pool.query(`SELECT expires_at FROM user_active_boosts WHERE user_id=$1 AND boost_key='boost_xp_x2' AND expires_at > CURRENT_TIMESTAMP`, [user.id]),
      getActiveAdminLiveBoosts()
    ]);
    const liveXpBoosts = [{multiplier:2,expiresAt:personalBoostResult.rows[0]?.expires_at}, {multiplier:adminBoost.xp,expiresAt:adminBoost.expiresAt}];
    const baseXpPerHour = user.is_sub ? 120 : 100;
    const lovys=rows.map(row=>{const c=creatures.find(x=>x.id===row.creature_id)||{};const prog=progressionFromXp(Number(row.xp||0));const stats=creatureBattleStats({creature_id:row.creature_id,xp:Number(row.xp||0),rank:Number(row.rank||1)});const cost=nextRankCost(Number(row.rank||1));const universal=Number(user.universal_lovys_fragments||0);const specific=Number(row.fragments||0);const universalCap=cost?Math.floor(cost/2):0;const missing=cost?Math.max(0,cost-specific):0;const canRank=Boolean(cost&&(specific>=cost||(missing<=universalCap&&missing<=universal)));const rankPreviews=Array.from({length:LOVYS_MAX_RANK},(_,i)=>{const rank=i+1;const preview=creatureBattleStats({creature_id:row.creature_id,xp:Number(row.xp||0),rank});return {rank,cost:rank===1?0:LOVYS_RANK_COSTS?.[rank]||nextRankCost(rank-1)||0,stats:{hp:preview.hp,attack:preview.attack,defense:preview.defense,speed:preview.speed},talent:{...preview.talent,description:publicTalentDescription(preview.talent)}};});const nextPreview=cost&&Number(row.rank||1)<LOVYS_MAX_RANK?rankPreviews.find(x=>x.rank===Number(row.rank||1)+1)||null:null;return {id:Number(row.id),creatureId:row.creature_id,name:c.name||'Lovys',type:c.type||'Neutre',rarity:c.rarity||'Commun',xp:Number(row.xp||0),level:prog.level,liveSecondsToNextLevel:prog.maxLevel?null:estimateLovysLiveSeconds(Math.max(0,prog.nextThreshold-Number(row.xp||0)),baseXpPerHour,liveXpBoosts),progression:{currentThreshold:prog.currentThreshold,nextThreshold:prog.nextThreshold,maxLevel:Boolean(prog.maxLevel)},evolution:prog.evolution,evolutionName:prog.evolutionName,maxLevel:Boolean(prog.maxLevel),isActive:Boolean(row.is_active),origin:row.origin,hatchedAt:row.hatched_at,rank:Number(row.rank||1),fragments:Number(row.fragments||0),nextRankCost:cost,canRankUp:canRank,universalFragments:universal,stats:{hp:stats.hp,attack:stats.attack,defense:stats.defense,speed:stats.speed},power:stats.attack,hp:stats.hp,talent:{...stats.talent,description:publicTalentDescription(stats.talent)},skills:stats.skills,rankPreviews,nextRankPreview:nextPreview};});
    res.json({ok:true,lovys,pendingXp:Number(user.pending_xp||0),universalFragments:Number(user.universal_lovys_fragments||0)});
  }catch(error){console.error('Erreur collection Lovys :',error);res.status(500).json({error:'Impossible de charger tes Lovys.'});}
});

app.post('/api/lovys/rank-up', async (req,res)=>{
  const client=await pool.connect();
  try{
    if(!req.session.account||!req.session.user) return res.status(401).json({error:'Connexion requise.'});
    const lovysId=Number(req.body?.lovysId);if(!Number.isInteger(lovysId)||lovysId<=0)return res.status(400).json({error:'Lovys invalide.'});
    await client.query('BEGIN');
    const ur=await client.query(`SELECT id,universal_lovys_fragments FROM users WHERE twitch_id=$1 FOR UPDATE`,[req.session.user.twitchId]);const user=ur.rows[0];if(!user){await client.query('ROLLBACK');return res.status(404).json({error:'Joueur introuvable.'});}
    const lr=await client.query(`SELECT id,creature_id,rank,fragments,is_active,xp FROM user_lovys WHERE id=$1 AND user_id=$2 FOR UPDATE`,[lovysId,user.id]);const lovys=lr.rows[0];if(!lovys){await client.query('ROLLBACK');return res.status(404).json({error:'Lovys introuvable.'});}
    const rank=Math.max(1,Number(lovys.rank||1));if(rank>=LOVYS_MAX_RANK){await client.query('ROLLBACK');return res.status(400).json({error:'Ce Lovys est déjà au rang maximum.'});}
    const cost=nextRankCost(rank);const specific=Math.max(0,Number(lovys.fragments||0));const useSpecific=Math.min(specific,cost);const missing=cost-useSpecific;const universalAvailable=Math.max(0,Number(user.universal_lovys_fragments||0));const universalCap=Math.floor(cost/2);
    if(missing>universalCap||missing>universalAvailable){await client.query('ROLLBACK');return res.status(400).json({error:`Il faut ${cost} fragments. Les fragments universels peuvent couvrir au maximum 50 % du coût.`});}
    const up=await client.query(`UPDATE user_lovys SET rank=rank+1,fragments=fragments-$2,updated_at=CURRENT_TIMESTAMP WHERE id=$1 RETURNING rank,fragments`,[lovys.id,useSpecific]);
    if(missing>0)await client.query(`UPDATE users SET universal_lovys_fragments=universal_lovys_fragments-$2,updated_at=CURRENT_TIMESTAMP WHERE id=$1`,[user.id,missing]);
    await client.query('COMMIT');pushLiveUpdate('game-update',{userId:Number(user.id),at:Date.now()});
    res.json({ok:true,rank:Number(up.rows[0].rank),fragments:Number(up.rows[0].fragments),spent:cost,specificSpent:useSpecific,universalSpent:missing,message:`${creatures.find(c=>c.id===lovys.creature_id)?.name||'Ton Lovys'} passe rang ${'⭐'.repeat(Number(up.rows[0].rank))} !`});
  }catch(error){try{await client.query('ROLLBACK')}catch{};console.error('Erreur rang Lovys :',error);res.status(500).json({error:'Impossible d’améliorer ce Lovys.'});}finally{client.release();}
});

app.post('/api/lovys/activate', async (req,res)=>{
  const client=await pool.connect();
  try{
    if(!req.session.account||!req.session.user) return res.status(401).json({error:'Connexion requise.'});
    const lovysId=Number(req.body?.lovysId);
    if(!Number.isInteger(lovysId)||lovysId<=0) return res.status(400).json({error:'Lovys invalide.'});
    await client.query('BEGIN');
    const ur=await client.query(`SELECT id,creature_id,xp FROM users WHERE twitch_id=$1 FOR UPDATE`,[req.session.user.twitchId]);
    const user=ur.rows[0];
    if(!user){await client.query('ROLLBACK');return res.status(404).json({error:'Joueur introuvable.'});}
    if(user.creature_id) await client.query(`UPDATE user_lovys SET xp=$2,updated_at=CURRENT_TIMESTAMP WHERE user_id=$1 AND is_active=TRUE`,[user.id,Number(user.xp||0)]);
    const target=(await client.query(`SELECT id,creature_id,xp FROM user_lovys WHERE id=$1 AND user_id=$2 FOR UPDATE`,[lovysId,user.id])).rows[0];
    if(!target){await client.query('ROLLBACK');return res.status(404).json({error:'Ce Lovys ne fait pas partie de ta collection.'});}
    await client.query(`UPDATE user_lovys SET is_active=FALSE,updated_at=CURRENT_TIMESTAMP WHERE user_id=$1`,[user.id]);
    await client.query(`UPDATE user_lovys SET is_active=TRUE,updated_at=CURRENT_TIMESTAMP WHERE id=$1`,[target.id]);
    await client.query(`UPDATE users SET creature_id=$2,xp=$3,updated_at=CURRENT_TIMESTAMP WHERE id=$1`,[user.id,target.creature_id,Number(target.xp||0)]);
    await client.query('COMMIT');
    pushLiveUpdate('game-update',{userId:Number(user.id),at:Date.now()});
    res.json({ok:true,message:'Lovys actif changé.'});
  }catch(error){try{await client.query('ROLLBACK')}catch{};console.error('Erreur activation Lovys :',error);res.status(500).json({error:'Impossible de changer de Lovys actif.'});}finally{client.release();}
});

/* =========================================
   BOUTIQUE
========================================= */
app.get('/api/shop', async (req, res) => {
  try {
    if (!req.session.account || !req.session.user) return res.status(401).json({ error:'Connexion requise.' });

    const accountResult = await pool.query(
      `SELECT id, twitch_id, equipped_title_key, equipped_background_key, equipped_frame_key, equipped_avatar_frame_key FROM accounts WHERE id = $1`,
      [req.session.account.id]
    );
    const account = accountResult.rows[0];
    if (!account) return res.status(404).json({ error:'Compte introuvable.' });

    const userResult = await pool.query(`SELECT id, points FROM users WHERE twitch_id = $1`, [req.session.user.twitchId]);
    const user = userResult.rows[0];
    if (!user) return res.status(404).json({ error:'Profil de jeu introuvable.' });

    const inventoryResult = await pool.query(`SELECT item_key, quantity FROM shop_inventory WHERE account_id = $1`, [account.id]);
    const inventory = new Map(inventoryResult.rows.map(row => [row.item_key, Number(row.quantity || 0)]));

    const boostsResult = await pool.query(
      `SELECT boost_key, expires_at FROM user_active_boosts WHERE user_id = $1 AND expires_at > CURRENT_TIMESTAMP`,
      [user.id]
    );
    const activeBoosts = Object.fromEntries(boostsResult.rows.map(row => [row.boost_key, row.expires_at]));

    const broadcasterId = String(process.env.TWITCH_BROADCASTER_ID || '').trim();
    const isBroadcaster = broadcasterId && String(account.twitch_id || '') === broadcasterId;
    const catalog = SHOP_ITEMS.map(item => ({
      ...item,
      owned: item.category === 'object' ? inventory.get(item.key) > 0 : inventory.has(item.key),
      quantity: item.category === 'object' ? (inventory.get(item.key) || 0) : undefined,
      equipped:
        (item.category === 'title' && account.equipped_title_key === item.key) ||
        (item.category === 'background' && account.equipped_background_key === item.key) ||
        (item.category === 'frame' && account.equipped_frame_key === item.key) ||
        (item.category === 'avatar_frame' && account.equipped_avatar_frame_key === item.key)
    }));

    if (isBroadcaster) {
      catalog.unshift({ ...MASTER_TITLE, owned:true, equipped: account.equipped_title_key !== TITLE_NONE_KEY && (!account.equipped_title_key || account.equipped_title_key === MASTER_TITLE.key) });
    }

    res.json({
      ok:true,
      balance:Number(user.points || 0),
      catalog,
      activeBoosts,
      equipped:{
        title: account.equipped_title_key === TITLE_NONE_KEY ? null : (account.equipped_title_key || (isBroadcaster ? MASTER_TITLE.key : null)),
        background: account.equipped_background_key || null,
        frame: account.equipped_frame_key || null,
        avatar_frame: account.equipped_avatar_frame_key || null
      }
    });
  } catch (error) {
    console.error('Erreur boutique :', error);
    res.status(500).json({ error:'Impossible de charger la boutique.' });
  }
});

app.post('/api/shop/buy', economyWriteRateLimit, async (req, res) => {
  const client = await pool.connect();
  try {
    if (!req.session.account || !req.session.user) return res.status(401).json({ error:'Connexion requise.' });
    const key = String(req.body?.itemKey || '').trim();
    const item = shopItemByKey(key);
    if (!item || item.comingSoon || item.rewardOnly) return res.status(400).json({ error:'Cet article ne peut pas être acheté.' });

    const quantity = req.body?.quantity === undefined ? 1 : req.body.quantity;
    if (!Number.isSafeInteger(quantity) || quantity<1 || quantity>100 || (item.category!=='object' && quantity!==1)) return res.status(400).json({error:'Quantité invalide. Les objets s’achètent par lots de 1 à 100.'});
    const totalCost = item.price * quantity;
    await client.query('BEGIN');
    const userResult = await client.query(`SELECT id, points FROM users WHERE twitch_id = $1 FOR UPDATE`, [req.session.user.twitchId]);
    const user = userResult.rows[0];
    if (!user) { await client.query('ROLLBACK'); return res.status(404).json({ error:'Profil introuvable.' }); }

    if (item.category !== 'object') {
      const owned = await client.query(`SELECT 1 FROM shop_inventory WHERE account_id = $1 AND item_key = $2`, [req.session.account.id, key]);
      if (owned.rowCount) { await client.query('ROLLBACK'); return res.status(400).json({ error:'Article déjà possédé.' }); }
    }

    const balance = Number(user.points || 0);
    if (balance < totalCost) { await client.query('ROLLBACK'); return res.status(400).json({ error:"Pas assez de LoVeR'Cash." }); }

    await client.query(`UPDATE users SET points = points - $2, lifetime_lovercash_spent = lifetime_lovercash_spent + $2, updated_at = CURRENT_TIMESTAMP WHERE id = $1`, [user.id, totalCost]);
    await client.query(
      `INSERT INTO shop_inventory (account_id, item_key, quantity) VALUES ($1,$2,$3)
       ON CONFLICT (account_id,item_key) DO UPDATE SET quantity = shop_inventory.quantity + EXCLUDED.quantity, purchased_at = CURRENT_TIMESTAMP`,
      [req.session.account.id, key, quantity]
    );
    await recordPlayerHistory(client,{accountId:req.session.account.id,kind:'purchase',itemKey:key,itemName:item.name,quantity,currency:'cash',unitPrice:item.price,totalCost,balanceBefore:balance,balanceAfter:balance-totalCost});
    await client.query('COMMIT');
    pushLiveUpdate('shop-update', { twitchId:req.session.user.twitchId });
    res.json({ ok:true, itemKey:key, quantity, totalCost, balance:balance - totalCost });
  } catch (error) {
    try { await client.query('ROLLBACK'); } catch {}
    console.error('Erreur achat boutique :', error);
    res.status(500).json({ error:'Achat impossible.' });
  } finally { client.release(); }
});

// Tenue cosmétique : validation complète puis un seul UPDATE dans une transaction.
app.post('/api/shop/equip-outfit', async (req, res) => {
  if (!req.session.account || !req.session.user) return res.status(401).json({ error:'Connexion requise.' });
  const equipment = req.body?.equipment;
  const columns = {title:'equipped_title_key',background:'equipped_background_key',frame:'equipped_frame_key',avatar_frame:'equipped_avatar_frame_key'};
  if (!equipment || typeof equipment !== 'object' || Array.isArray(equipment)) return res.status(400).json({error:'Tenue invalide.'});
  const entries = Object.entries(equipment);
  if (!entries.length || entries.length > 4 || entries.some(([category,key]) => !Object.hasOwn(columns, category) || (key !== null && typeof key !== 'string'))) {
    return res.status(400).json({error:'Tenue invalide.'});
  }
  let client;
  try {
    client = await pool.connect();
    await client.query('BEGIN');
    const accountResult = await client.query('SELECT twitch_id FROM accounts WHERE id = $1 FOR UPDATE', [req.session.account.id]);
    if (!accountResult.rowCount) {await client.query('ROLLBACK');return res.status(404).json({error:'Compte introuvable.'});}
    const broadcasterId = String(process.env.TWITCH_BROADCASTER_ID || '').trim();
    const isBroadcaster = Boolean(broadcasterId && String(accountResult.rows[0].twitch_id || '') === broadcasterId);
    const values = [req.session.account.id], assignments = [];
    for (const [category,key] of entries) {
      if (key !== null) {
        const item = key === MASTER_TITLE.key ? MASTER_TITLE : shopItemByKey(key);
        if (!item || item.category !== category || item.category === 'object') {
          await client.query('ROLLBACK');return res.status(400).json({error:'Article incompatible avec cet emplacement.'});
        }
        if (key === MASTER_TITLE.key) {
          if (!isBroadcaster) {await client.query('ROLLBACK');return res.status(403).json({error:'Titre exclusif.'});}
        } else {
          const owned = await client.query('SELECT 1 FROM shop_inventory WHERE account_id = $1 AND item_key = $2 AND quantity > 0 FOR SHARE', [req.session.account.id,key]);
          if (!owned.rowCount) {await client.query('ROLLBACK');return res.status(403).json({error:'Tu ne possèdes pas tous les articles de cette tenue.'});}
        }
      }
      values.push(key === null && category === 'title' ? TITLE_NONE_KEY : key);
      assignments.push(`${columns[category]} = $${values.length}`);
    }
    await client.query(`UPDATE accounts SET ${assignments.join(', ')}, updated_at=CURRENT_TIMESTAMP WHERE id = $1`,values);
    await client.query('COMMIT');
    pushLiveUpdate('shop-update',{twitchId:req.session.user.twitchId});
    res.json({ok:true,message:'Tenue équipée !'});
  } catch (error) {
    if (client) {try {await client.query('ROLLBACK');} catch {}}
    console.error('Erreur équipement tenue :',error);
    res.status(500).json({error:'Impossible d’équiper cette tenue.'});
  } finally {client?.release();}
});

app.post('/api/shop/equip', async (req, res) => {
  try {
    if (!req.session.account || !req.session.user) return res.status(401).json({ error:'Connexion requise.' });
    const key = String(req.body?.itemKey || '').trim();
    const broadcasterId = String(process.env.TWITCH_BROADCASTER_ID || '').trim();
    const accountResult = await pool.query(`SELECT twitch_id FROM accounts WHERE id = $1`, [req.session.account.id]);
    const isBroadcaster = broadcasterId && String(accountResult.rows[0]?.twitch_id || '') === broadcasterId;

    if (key === MASTER_TITLE.key) {
      if (!isBroadcaster) return res.status(403).json({ error:'Titre exclusif.' });
      await pool.query(`UPDATE accounts SET equipped_title_key = $2, updated_at=CURRENT_TIMESTAMP WHERE id = $1`, [req.session.account.id, key]);
      pushLiveUpdate('shop-update', { twitchId:req.session.user.twitchId });
      return res.json({ ok:true });
    }

    const item = shopItemByKey(key);
    if (!item || !['title','background','frame','avatar_frame'].includes(item.category)) return res.status(400).json({ error:'Article non équipable.' });
    const owned = await pool.query(`SELECT 1 FROM shop_inventory WHERE account_id = $1 AND item_key = $2 AND quantity > 0`, [req.session.account.id, key]);
    if (!owned.rowCount) return res.status(403).json({ error:'Tu ne possèdes pas cet article.' });

    const column = item.category === 'title'
      ? 'equipped_title_key'
      : item.category === 'background'
        ? 'equipped_background_key'
        : item.category === 'frame'
          ? 'equipped_frame_key'
          : 'equipped_avatar_frame_key';
    await pool.query(`UPDATE accounts SET ${column} = $2, updated_at=CURRENT_TIMESTAMP WHERE id = $1`, [req.session.account.id, key]);
    pushLiveUpdate('shop-update', { twitchId:req.session.user.twitchId });
    res.json({ ok:true });
  } catch (error) {
    console.error('Erreur équipement boutique :', error);
    res.status(500).json({ error:'Impossible d’équiper cet article.' });
  }
});

app.post('/api/shop/unequip', async (req, res) => {
  try {
    if (!req.session.account || !req.session.user) return res.status(401).json({ error:'Connexion requise.' });
    const key = String(req.body?.itemKey || '').trim();

    if (key === MASTER_TITLE.key) {
      const broadcasterId = String(process.env.TWITCH_BROADCASTER_ID || '').trim();
      const accountResult = await pool.query(`SELECT twitch_id FROM accounts WHERE id = $1`, [req.session.account.id]);
      const isBroadcaster = broadcasterId && String(accountResult.rows[0]?.twitch_id || '') === broadcasterId;
      if (!isBroadcaster) return res.status(403).json({ error:'Titre exclusif.' });
      await pool.query(`UPDATE accounts SET equipped_title_key = $2, updated_at=CURRENT_TIMESTAMP WHERE id = $1`, [req.session.account.id, TITLE_NONE_KEY]);
      pushLiveUpdate('shop-update', { twitchId:req.session.user.twitchId });
      return res.json({ ok:true, message:'Titre déséquipé.' });
    }

    const item = shopItemByKey(key);
    if (!item || !['title','background','frame','avatar_frame'].includes(item.category)) {
      return res.status(400).json({ error:'Article non déséquipable.' });
    }

    const column = item.category === 'title'
      ? 'equipped_title_key'
      : item.category === 'background'
        ? 'equipped_background_key'
        : item.category === 'frame'
          ? 'equipped_frame_key'
          : 'equipped_avatar_frame_key';

    const value = item.category === 'title' ? TITLE_NONE_KEY : null;
    await pool.query(`UPDATE accounts SET ${column} = $2, updated_at=CURRENT_TIMESTAMP WHERE id = $1`, [req.session.account.id, value]);
    pushLiveUpdate('shop-update', { twitchId:req.session.user.twitchId });
    res.json({ ok:true, message:'Cosmétique déséquipé.' });
  } catch (error) {
    console.error('Erreur déséquipement boutique :', error);
    res.status(500).json({ error:'Impossible de déséquiper cet article.' });
  }
});

app.post('/api/shop/use', async (req, res) => {
  const client = await pool.connect();
  try {
    if (!req.session.account || !req.session.user) return res.status(401).json({ error:'Connexion requise.' });
    const key = String(req.body?.itemKey || '').trim();
    const item = shopItemByKey(key);
    if (key === 'mystery_egg') return res.status(400).json({ error:'Place cet œuf dans un emplacement libre de l’incubateur.' });
    if (!item || !['boost_xp_x2','boost_cash_x2','incubator_skip_30'].includes(key) || item.category !== 'object' || item.comingSoon) return res.status(400).json({ error:'Objet non utilisable.' });

    await client.query('BEGIN');
    const userResult = await client.query(`SELECT id, creature_id, watch_seconds FROM users WHERE twitch_id=$1 FOR UPDATE`, [req.session.user.twitchId]);
    const user = userResult.rows[0];
    if (!user) { await client.query('ROLLBACK'); return res.status(404).json({ error:'Profil introuvable.' }); }
    const inv = await client.query(`SELECT quantity FROM shop_inventory WHERE account_id=$1 AND item_key=$2 FOR UPDATE`, [req.session.account.id, key]);
    if (!inv.rowCount || Number(inv.rows[0].quantity || 0) <= 0) { await client.query('ROLLBACK'); return res.status(400).json({ error:'Tu ne possèdes pas cet objet.' }); }

    const requestedQuantity = req.body?.quantity === undefined ? 1 : req.body.quantity;
    if (!Number.isSafeInteger(requestedQuantity) || requestedQuantity < 1 || requestedQuantity > (key === 'incubator_skip_30' ? 12 : 1) ||
        (key !== 'incubator_skip_30' && requestedQuantity !== 1)) {
      await client.query('ROLLBACK');
      return res.status(400).json({error:'Quantité invalide (12 accélérateurs maximum, soit 6 heures).'});
    }
    if (Number(inv.rows[0].quantity) < requestedQuantity) {
      await client.query('ROLLBACK');
      return res.status(400).json({error:'Tu ne possèdes pas assez d’accélérateurs.'});
    }
    let message = '';
    let acceleration = null;
    let boostExpiresAt = null;
    if (key === 'boost_xp_x2' || key === 'boost_cash_x2') {
      if (key === 'boost_xp_x2' && !user.creature_id) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error:'Le booster XP sera utile après l’éclosion de ton œuf.' });
      }
      const boostResult = await client.query(
        `INSERT INTO user_active_boosts (user_id, boost_key, expires_at)
         VALUES ($1,$2,CURRENT_TIMESTAMP + INTERVAL '1 hour')
         ON CONFLICT (user_id,boost_key) DO UPDATE SET expires_at = GREATEST(user_active_boosts.expires_at, CURRENT_TIMESTAMP) + INTERVAL '1 hour' RETURNING expires_at`,
        [user.id, key]
      );
      boostExpiresAt = boostResult.rows[0]?.expires_at || null;
      message = key === 'boost_xp_x2' ? 'Booster XP x2 activé pendant 1 heure.' : "Booster LoVeR'Cash x2 activé pendant 1 heure.";
    } else if (key === 'incubator_skip_30') {
      const requestedSlot = req.body?.slot;
      const slot = requestedSlot == null && !user.creature_id ? 1 : Number(requestedSlot);
      if (!Number.isInteger(slot) || ![1,2,3].includes(slot)) {await client.query('ROLLBACK');return res.status(400).json({error:'Choisis l’œuf à accélérer.'});}
      let egg = null;
      const starter = slot === 1 && !user.creature_id;
      if (!starter) {
        const result = await client.query('SELECT id, watched_seconds, status FROM user_incubator_eggs WHERE user_id=$1 AND slot=$2 FOR UPDATE', [user.id,slot]);
        egg = result.rows[0];
        if (!egg) {await client.query('ROLLBACK');return res.status(400).json({error:'Cet emplacement ne contient aucun œuf.'});}
      }
      if ((req.body?.source && req.body.source !== (starter ? 'starter' : 'extra')) ||
          (!starter && req.body?.eggId != null && Number(req.body.eggId) !== Number(egg.id))) {
        await client.query('ROLLBACK');return res.status(409).json({error:'L’œuf de cet emplacement a changé. Choisis-le à nouveau.'});
      }
      const watched = Math.max(0, Number(starter ? user.watch_seconds : egg.watched_seconds) || 0);
      if (watched >= EGG_HATCH_SECONDS || egg?.status === 'ready') {await client.query('ROLLBACK');return res.status(400).json({error:'Cet œuf est déjà prêt à éclore.'});}
      const required = Math.ceil((EGG_HATCH_SECONDS - watched) / 1800);
      if (requestedQuantity > required) {
        await client.query('ROLLBACK');
        return res.status(400).json({error:`${required} accélérateur(s) suffisent pour terminer cet œuf.`});
      }
      const next = Math.min(EGG_HATCH_SECONDS, watched + 1800 * requestedQuantity);
      if (starter) {
        await client.query('UPDATE users SET watch_seconds=$2, incubator_accelerated_seconds=incubator_accelerated_seconds+$3, updated_at=CURRENT_TIMESTAMP WHERE id=$1', [user.id,next,next-watched]);
      } else {
        await client.query("UPDATE user_incubator_eggs SET watched_seconds=$2, status=$3, updated_at=CURRENT_TIMESTAMP WHERE id=$1", [egg.id,next,next >= EGG_HATCH_SECONDS ? 'ready' : 'incubating']);
      }
      acceleration = {slot,quantity:requestedQuantity,secondsReduced:next-watched,remainingSeconds:EGG_HATCH_SECONDS-next,ready:next>=EGG_HATCH_SECONDS};
      const minutes = Math.ceil((next-watched)/60);
      message = `Œuf de l’emplacement ${slot} accéléré de ${minutes} min.${acceleration.ready ? ' Il est prêt à éclore !' : ''}`;
    }

    await client.query(`UPDATE shop_inventory SET quantity = quantity - $3 WHERE account_id=$1 AND item_key=$2`, [req.session.account.id, key, requestedQuantity]);
    await recordPlayerHistory(client,{accountId:req.session.account.id,kind:'use',itemKey:key,itemName:item.name,quantity:requestedQuantity,details:{message,acceleration,boostExpiresAt}});
    await client.query('COMMIT');
    await wizebotAlerts.collect();
    pushLiveUpdate('shop-update', { twitchId:req.session.user.twitchId });
    res.json({ ok:true, message, acceleration, boostExpiresAt });
  } catch (error) {
    try { await client.query('ROLLBACK'); } catch {}
    console.error('Erreur utilisation objet :', error);
    res.status(500).json({ error:'Impossible d’utiliser cet objet.' });
  } finally { client.release(); }
});


/* =========================================
   V109 — LOBBY & ÉCHANGES COMMUNAUTAIRES
========================================= */
const TRADE_MAX_OPTIONS = 3;
const TRADE_MAX_QUANTITY = 999;
const TRADE_DURATIONS = new Set([1, 3, 7]);
const TRADE_MAX_ACTIVE = 3;
const TRADE_MAX_DAILY_COMPLETED = 20;

function tradeCreatureName(creatureId) {
  return creatures.find(creature => creature.id === creatureId)?.name || creatureId || 'Lovys';
}
function tradeCreatureImage(creatureId){
  const files={plant:'Mossy.webp',water:'Nymea.webp',lightning:'Voltis.webp',mist:'Brumee.webp',fire:'Flamby.webp',crystal:'Crysal.webp',forge:'Ferox.webp',dark:'Nocty.webp',solar:'Solka.webp',dream:'Mimo.webp'};
  return '/'+(files[String(creatureId||'').toLowerCase()]||'');
}

function normalizeTradeAsset(raw = {}) {
  const type = String(raw.type || '').trim().toLowerCase();
  const quantity = Math.max(0, Math.min(TRADE_MAX_QUANTITY, Number.parseInt(raw.quantity, 10) || 0));
  if (!['fragment', 'egg'].includes(type) || quantity < 1) return null;
  if (type === 'egg') return { type:'egg', creatureId:null, quantity };
  const creatureId = String(raw.creatureId || '').trim();
  if (!creatures.some(creature => creature.id === creatureId)) return null;
  return { type:'fragment', creatureId, quantity };
}

async function tradeContext(client, req) {
  if (!req.session.account || !req.session.user) return null;
  const result = await client.query(
    `SELECT u.id AS user_id, a.id AS account_id, a.username, u.display_name, u.twitch_id
     FROM accounts a JOIN users u ON u.twitch_id=a.twitch_id
     WHERE a.id=$1 AND u.twitch_id=$2 LIMIT 1`,
    [req.session.account.id, req.session.user.twitchId]
  );
  if (!result.rowCount) return null;
  return {
    userId:Number(result.rows[0].user_id), accountId:Number(result.rows[0].account_id),
    username:result.rows[0].username || result.rows[0].display_name || 'Joueur', twitchId:result.rows[0].twitch_id
  };
}

async function tradeAssetBalance(client, ctx, asset, lock=false) {
  if (asset.type === 'egg') {
    const result = await client.query(
      `SELECT quantity FROM shop_inventory WHERE account_id=$1 AND item_key='mystery_egg'${lock?' FOR UPDATE':''}`,
      [ctx.accountId]
    );
    return Number(result.rows[0]?.quantity || 0);
  }
  const result = await client.query(
    `SELECT fragments FROM user_lovys WHERE user_id=$1 AND creature_id=$2${lock?' FOR UPDATE':''}`,
    [ctx.userId, asset.creatureId]
  );
  return result.rowCount ? Number(result.rows[0].fragments || 0) : null;
}

async function changeTradeAsset(client, ctx, asset, delta) {
  const amount = Math.abs(Number(delta || 0));
  if (!amount) return;
  if (asset.type === 'egg') {
    if (delta < 0) {
      const result = await client.query(
        `UPDATE shop_inventory SET quantity=quantity-$2
         WHERE account_id=$1 AND item_key='mystery_egg' AND quantity >= $2 RETURNING quantity`,
        [ctx.accountId, amount]
      );
      if (!result.rowCount) throw new Error("Tu ne possèdes pas assez d'œufs disponibles.");
    } else {
      await client.query(
        `INSERT INTO shop_inventory(account_id,item_key,quantity) VALUES($1,'mystery_egg',$2)
         ON CONFLICT(account_id,item_key) DO UPDATE SET quantity=shop_inventory.quantity+EXCLUDED.quantity,purchased_at=CURRENT_TIMESTAMP`,
        [ctx.accountId, amount]
      );
    }
    return;
  }
  if (delta < 0) {
    const result = await client.query(
      `UPDATE user_lovys SET fragments=fragments-$3,updated_at=CURRENT_TIMESTAMP
       WHERE user_id=$1 AND creature_id=$2 AND fragments >= $3 RETURNING fragments`,
      [ctx.userId, asset.creatureId, amount]
    );
    if (!result.rowCount) throw new Error(`Tu ne possèdes pas assez de fragments ${tradeCreatureName(asset.creatureId)}.`);
  } else {
    const result = await client.query(
      `UPDATE user_lovys SET fragments=fragments+$3,updated_at=CURRENT_TIMESTAMP
       WHERE user_id=$1 AND creature_id=$2 RETURNING fragments`,
      [ctx.userId, asset.creatureId, amount]
    );
    if (!result.rowCount) throw new Error(`Il faut posséder ${tradeCreatureName(asset.creatureId)} pour recevoir ses fragments.`);
  }
}

async function restoreExpiredTrades(client=pool) {
  const expired = await client.query(
    `SELECT id,creator_user_id,creator_account_id,offer_type,offer_creature_id,offer_quantity
     FROM trade_offers WHERE status='open' AND expires_at <= CURRENT_TIMESTAMP FOR UPDATE SKIP LOCKED`
  );
  for (const offer of expired.rows) {
    const ctx={userId:Number(offer.creator_user_id),accountId:Number(offer.creator_account_id)};
    const asset={type:offer.offer_type,creatureId:offer.offer_creature_id,quantity:Number(offer.offer_quantity)};
    await changeTradeAsset(client,ctx,asset,asset.quantity);
    await client.query(`UPDATE trade_offers SET status='expired',updated_at=CURRENT_TIMESTAMP WHERE id=$1 AND status='open'`,[offer.id]);
    await client.query(`INSERT INTO trade_notifications(user_id,message,event_type,offer_id) VALUES($1,$2,'offer_expired',$3) ON CONFLICT DO NOTHING`,[ctx.userId,`Ton offre #${offer.id} a expiré sans être acceptée. Tes objets ont été rendus.`,offer.id]);
  }
  await restoreExpiredPlayerTrades(client);
}

function tradeAssetJson(type, creatureId, quantity) {
  const creature=creatures.find(c=>c.id===creatureId);
  return {type,creatureId:creatureId||null,quantity:Number(quantity||0),name:type==='egg'?'Œuf mystère':`Fragments ${tradeCreatureName(creatureId)}`,icon:type==='egg'?'🥚':'🧩',rarity:creature?.rarity||null,image:type==='fragment'&&creature?`/${creature.name}.webp`:null};
}

function normalizePlayerTradeBundle(raw) {
  if (!Array.isArray(raw) || raw.length < 1 || raw.length > 3) return null;
  const assets = [], keys = new Set();
  for (const item of raw) {
    if (!item || !Number.isSafeInteger(item.quantity) || item.quantity < 1 || item.quantity > TRADE_MAX_QUANTITY) return null;
    const asset = normalizeTradeAsset(item);
    if (!asset) return null;
    const key = `${asset.type}:${asset.creatureId || ''}`;
    if (keys.has(key)) return null;
    keys.add(key); assets.push(asset);
  }
  return assets.sort((a,b)=>`${a.type}:${a.creatureId || ''}`.localeCompare(`${b.type}:${b.creatureId || ''}`));
}

async function playerTradeUser(client, userId) {
  const result = await client.query(`SELECT u.id AS user_id,a.id AS account_id,
    COALESCE(a.username,u.display_name,u.login) username,u.global_xp,u.profile_image_url,u.creature_id
    FROM users u JOIN accounts a ON a.twitch_id=u.twitch_id WHERE u.id=$1`, [userId]);
  const row = result.rows[0];
  return row ? {userId:Number(row.user_id),accountId:Number(row.account_id),username:row.username,
    level:globalProgressionFromXp(Number(row.global_xp || 0)).level,profileImageUrl:row.profile_image_url || null,hasStarterEgg:!row.creature_id} : null;
}

async function playerTradeDailyCount(client, userId) {
  const result = await client.query(`SELECT (
    (SELECT COUNT(*) FROM trade_offers WHERE status='completed' AND accepted_at>=CURRENT_DATE AND (creator_user_id=$1 OR accepted_by_user_id=$1)) +
    (SELECT COUNT(*) FROM player_trade_offers WHERE status='completed' AND accepted_at>=CURRENT_DATE AND (creator_user_id=$1 OR target_user_id=$1))
  )::int AS count`, [userId]);
  return Number(result.rows[0]?.count || 0);
}

async function restoreExpiredPlayerTrades(client) {
  const expired = await client.query(`SELECT * FROM player_trade_offers
    WHERE status='open' AND (expires_at<=CURRENT_TIMESTAMP OR target_user_id IS NULL) FOR UPDATE SKIP LOCKED`);
  for (const offer of expired.rows) {
    const creator={userId:Number(offer.creator_user_id),accountId:Number(offer.creator_account_id)};
    for (const asset of offer.offered) await changeTradeAsset(client,creator,asset,asset.quantity);
    await client.query(`UPDATE player_trade_offers SET status='expired',updated_at=CURRENT_TIMESTAMP WHERE id=$1`,[offer.id]);
    await client.query(`INSERT INTO trade_notifications(user_id,message,event_type) VALUES($1,$2,'player_trade_expired')`,
      [creator.userId,`Ta proposition ciblée #${offer.id} a expiré. Tous les objets réservés ont été rendus.`]);
  }
}

// Collection publique limitée aux données utiles aux échanges, sans e-mail ni identifiant Discord.
app.get('/api/lobby/players/:userId', async (req,res)=>{
  try {
    const ctx=await tradeContext(pool,req);
    if(!ctx)return res.status(401).json({error:'Connexion requise.'});
    const userId=Number(req.params.userId);
    if(!Number.isSafeInteger(userId)||userId<1)return res.status(400).json({error:'Joueur invalide.'});
    const player=await playerTradeUser(pool,userId);
    if(!player)return res.status(404).json({error:'Joueur introuvable.'});
    const [owned,eggs,incubating]=await Promise.all([
      pool.query(`SELECT creature_id,fragments,rank,xp FROM user_lovys WHERE user_id=$1 ORDER BY creature_id`,[userId]),
      pool.query(`SELECT quantity FROM shop_inventory WHERE account_id=$1 AND item_key='mystery_egg'`,[player.accountId]),
      pool.query(`SELECT COUNT(*)::int count FROM user_incubator_eggs WHERE user_id=$1`,[userId])
    ]);
    res.json({ok:true,selfUserId:ctx.userId,player:{userId:player.userId,username:player.username,level:player.level,profileImageUrl:player.profileImageUrl},
      eggs:Number(eggs.rows[0]?.quantity||0),incubatingEggs:Number(incubating.rows[0]?.count||0)+(player.hasStarterEgg?1:0),totalLovys:creatures.length,
      lovys:owned.rows.map(row=>({creatureId:row.creature_id,name:tradeCreatureName(row.creature_id),image:tradeCreatureImage(row.creature_id),
        fragments:Number(row.fragments||0),rank:Number(row.rank||1),level:progressionFromXp(Number(row.xp||0)).level,
        rarity:creatures.find(c=>c.id===row.creature_id)?.rarity||null}))});
  } catch(error){console.error('Collection joueur :',error);res.status(500).json({error:'Impossible de charger cette collection.'});}
});

app.get('/api/player-trades', async(req,res)=>{
  const client=await pool.connect();
  try {
    const ctx=await tradeContext(client,req);if(!ctx)return res.status(401).json({error:'Connexion requise.'});
    await client.query('BEGIN');await restoreExpiredTrades(client);await client.query('COMMIT');
    const result=await client.query(`SELECT o.*,COALESCE(ca.username,cu.display_name,cu.login) creator_name,
      COALESCE(ta.username,tu.display_name,tu.login) target_name
      FROM player_trade_offers o JOIN users cu ON cu.id=o.creator_user_id
      JOIN accounts ca ON ca.id=o.creator_account_id LEFT JOIN users tu ON tu.id=o.target_user_id
      LEFT JOIN accounts ta ON ta.twitch_id=tu.twitch_id
      WHERE (o.creator_user_id=$1 OR o.target_user_id=$1) AND o.status='open' AND o.expires_at>CURRENT_TIMESTAMP
      ORDER BY o.created_at DESC LIMIT 100`,[ctx.userId]);
    const assetJson=asset=>({...tradeAssetJson(asset.type,asset.creatureId,asset.quantity),image:asset.type==='fragment'?tradeCreatureImage(asset.creatureId):null});
    res.json({ok:true,selfUserId:ctx.userId,offers:result.rows.map(o=>({id:Number(o.id),creatorUserId:Number(o.creator_user_id),targetUserId:Number(o.target_user_id),
      creatorName:o.creator_name,targetName:o.target_name,expiresAt:o.expires_at,status:o.status,offered:o.offered.map(assetJson),requested:o.requested.map(assetJson)}))});
  }catch(error){try{await client.query('ROLLBACK');}catch{};console.error('Propositions joueurs :',error);res.status(500).json({error:'Propositions indisponibles.'});}
  finally{client.release();}
});

app.post('/api/player-trades',tradeWriteRateLimit,async(req,res)=>{
  const offered=normalizePlayerTradeBundle(req.body?.offered),requested=normalizePlayerTradeBundle(req.body?.requested);
  const targetUserId=Number(req.body?.targetUserId),durationDays=Number(req.body?.durationDays??3);
  if(!offered||!requested||!Number.isSafeInteger(targetUserId)||targetUserId<1||!TRADE_DURATIONS.has(durationDays))
    return res.status(400).json({error:'Choisis de 1 à 3 éléments distincts de chaque côté, avec des quantités entières de 1 à 999.'});
  const client=await pool.connect();
  try {
    const ctx=await tradeContext(client,req);if(!ctx)return res.status(401).json({error:'Connexion requise.'});
    if(ctx.userId===targetUserId)return res.status(400).json({error:'Tu ne peux pas échanger avec toi-même.'});
    await client.query('BEGIN');await restoreExpiredTrades(client);
    // Verrouillage dans le même ordre pour les deux participants.
    await client.query(`SELECT id FROM users WHERE id=ANY($1::int[]) ORDER BY id FOR UPDATE`,[[ctx.userId,targetUserId].sort((a,b)=>a-b)]);
    const creator=await playerTradeUser(client,ctx.userId),target=await playerTradeUser(client,targetUserId);
    if(!creator||!target)throw new Error('Joueur introuvable.');
    const active=await client.query(`SELECT ((SELECT COUNT(*) FROM trade_offers WHERE creator_user_id=$1 AND status='open')+
      (SELECT COUNT(*) FROM player_trade_offers WHERE creator_user_id=$1 AND status='open'))::int count`,[ctx.userId]);
    if(Number(active.rows[0]?.count||0)>=TRADE_MAX_ACTIVE)throw new Error(`Tu peux avoir au maximum ${TRADE_MAX_ACTIVE} offres actives, publiques ou ciblées.`);
    for(const asset of requested) {
      if(await tradeAssetBalance(client,target,asset,true)<asset.quantity)throw new Error(`${target.username} ne possède plus assez de ${asset.type==='egg'?'œufs':`fragments ${tradeCreatureName(asset.creatureId)}`}.`);
      if(asset.type==='fragment'&&await tradeAssetBalance(client,creator,asset,true)===null)throw new Error(`Tu dois posséder ${tradeCreatureName(asset.creatureId)} pour recevoir ses fragments.`);
    }
    for(const asset of offered) {
      if(asset.type==='fragment'&&await tradeAssetBalance(client,target,asset,true)===null)throw new Error(`${target.username} doit posséder ${tradeCreatureName(asset.creatureId)} pour recevoir ses fragments.`);
      await changeTradeAsset(client,creator,asset,-asset.quantity);
    }
    const result=await client.query(`INSERT INTO player_trade_offers(creator_user_id,creator_account_id,target_user_id,offered,requested,expires_at)
      VALUES($1,$2,$3,$4::jsonb,$5::jsonb,CURRENT_TIMESTAMP+($6::text||' days')::interval) RETURNING id`,
      [creator.userId,creator.accountId,target.userId,JSON.stringify(offered),JSON.stringify(requested),String(durationDays)]);
    await client.query(`INSERT INTO trade_notifications(user_id,message,event_type) VALUES($1,$2,'player_trade_received')`,
      [target.userId,`${creator.username} t’a envoyé une proposition ciblée. Consulte Communauté → Joueurs pour accepter ou refuser.`]);
    await client.query('COMMIT');pushLiveUpdate('trade-update',{playerTradeId:Number(result.rows[0].id)});
    res.json({ok:true,offerId:Number(result.rows[0].id),message:`Proposition envoyée à ${target.username}.`});
  }catch(error){try{await client.query('ROLLBACK');}catch{};res.status(400).json({error:error.message||'Proposition impossible.'});}
  finally{client.release();}
});

app.post('/api/player-trades/:offerId/:action',tradeWriteRateLimit,async(req,res)=>{
  const offerId=Number(req.params.offerId),action=req.params.action;
  if(!Number.isSafeInteger(offerId)||offerId<1||!['accept','decline','cancel'].includes(action))return res.status(400).json({error:'Action invalide.'});
  const client=await pool.connect();
  try {
    const ctx=await tradeContext(client,req);if(!ctx)return res.status(401).json({error:'Connexion requise.'});
    await client.query('BEGIN');
    const result=await client.query(`SELECT * FROM player_trade_offers WHERE id=$1 FOR UPDATE`,[offerId]),offer=result.rows[0];
    if(!offer||offer.status!=='open')throw new Error('Cette proposition n’est plus disponible.');
    if(ctx.userId!==Number(action==='cancel'?offer.creator_user_id:offer.target_user_id)) {
      await client.query('ROLLBACK');return res.status(403).json({error:'Tu ne peux pas agir sur cette proposition.'});
    }
    if(!offer.target_user_id||new Date(offer.expires_at)<=new Date()) {
      for(const asset of offer.offered)await changeTradeAsset(client,{userId:Number(offer.creator_user_id),accountId:Number(offer.creator_account_id)},asset,asset.quantity);
      await client.query(`UPDATE player_trade_offers SET status='expired',updated_at=CURRENT_TIMESTAMP WHERE id=$1`,[offerId]);
      await client.query('COMMIT');return res.status(409).json({error:'Cette proposition a expiré. Les objets ont été rendus.'});
    }
    await client.query(`SELECT id FROM users WHERE id=ANY($1::int[]) ORDER BY id FOR UPDATE`,[[Number(offer.creator_user_id),Number(offer.target_user_id)].sort((a,b)=>a-b)]);
    const creator=await playerTradeUser(client,Number(offer.creator_user_id)),target=await playerTradeUser(client,Number(offer.target_user_id));
    if(!creator||!target)throw new Error('Joueur introuvable.');
    let status,message;
    if(action==='accept') {
      for(const participant of [creator,target])if(await playerTradeDailyCount(client,participant.userId)>=TRADE_MAX_DAILY_COMPLETED)throw new Error(`La limite quotidienne de ${TRADE_MAX_DAILY_COMPLETED} échanges est atteinte pour ${participant.username}.`);
      // Le débit de toutes les contreparties précède les crédits, dans une seule transaction.
      for(const asset of offer.requested)await changeTradeAsset(client,target,asset,-asset.quantity);
      for(const asset of offer.requested)await changeTradeAsset(client,creator,asset,asset.quantity);
      for(const asset of offer.offered)await changeTradeAsset(client,target,asset,asset.quantity);
      status='completed';message='Échange effectué ! Tous les éléments ont été transférés.';
    } else {
      for(const asset of offer.offered)await changeTradeAsset(client,creator,asset,asset.quantity);
      status=action==='decline'?'declined':'cancelled';message=action==='decline'?'Proposition refusée. Les objets ont été rendus au joueur.':'Proposition annulée. Tes objets ont été rendus.';
    }
    await client.query(`UPDATE player_trade_offers SET status=$2,accepted_at=CASE WHEN $2='completed' THEN CURRENT_TIMESTAMP ELSE NULL END,updated_at=CURRENT_TIMESTAMP WHERE id=$1`,[offerId,status]);
    for(const participant of [creator,target])await client.query(`INSERT INTO trade_notifications(user_id,message,event_type,player_trade_id) VALUES($1,$2,$3,$4)`,[participant.userId,`Proposition ciblée #${offerId} : ${message}`,action==='accept'&&participant.userId===creator.userId?'player_trade_accepted':'player_trade_resolved',offerId]);
    await client.query('COMMIT');pushLiveUpdate('trade-update',{playerTradeId:offerId});res.json({ok:true,message});
  }catch(error){try{await client.query('ROLLBACK');}catch{};res.status(400).json({error:error.message||'Échange impossible.'});}
  finally{client.release();}
});

app.get('/api/lobby', async (req,res)=>{
  try{
    if(!req.session.account||!req.session.user)return res.status(401).json({error:'Connexion requise.'});
    const tracker=(await pool.query(`SELECT last_live FROM twitch_tracker_auth WHERE id=1`)).rows[0];
    const result=await pool.query(`
      SELECT u.id,u.twitch_id,COALESCE(a.username,u.display_name,u.login) username,u.profile_image_url,u.global_xp,u.prestige,u.watch_seconds,u.last_live_seen_at,
             l.creature_id,l.rank,l.xp
      FROM users u LEFT JOIN accounts a ON a.twitch_id=u.twitch_id
      LEFT JOIN user_lovys l ON l.user_id=u.id AND l.is_active=TRUE
      WHERE a.id IS NOT NULL
      ORDER BY CASE WHEN u.last_live_seen_at > CURRENT_TIMESTAMP-INTERVAL '90 seconds' THEN 0 ELSE 1 END,
               COALESCE(u.last_live_seen_at,u.updated_at) DESC,username ASC LIMIT 100`);
    const live=Boolean(tracker?.last_live);
    const activeOffers=await pool.query(`SELECT creator_user_id,COUNT(*)::int count FROM trade_offers WHERE status='open' AND expires_at>CURRENT_TIMESTAMP GROUP BY creator_user_id`);const offerMap=new Map(activeOffers.rows.map(x=>[Number(x.creator_user_id),Number(x.count)]));const presentCount=result.rows.filter(row=>live&&row.last_live_seen_at&&Date.now()-new Date(row.last_live_seen_at).getTime()<90000).length;
    res.json({ok:true,live,presentCount,lastLiveLabel:null,liveDuration:'en cours',players:result.rows.map(row=>{const gp=globalProgressionFromXp(Number(row.global_xp||0));const cp=progressionFromXp(Number(row.xp||0));return {userId:Number(row.id),twitchId:row.twitch_id,username:row.username||'Joueur',profileImageUrl:row.profile_image_url||null,level:gp.level,prestige:Number(row.prestige||0),watchSeconds:Number(row.watch_seconds||0),present:live&&row.last_live_seen_at&&Date.now()-new Date(row.last_live_seen_at).getTime()<90000,lastSeenAt:row.last_live_seen_at||null,lovys:row.creature_id?{creatureId:row.creature_id,name:tradeCreatureName(row.creature_id),rank:Number(row.rank||1),level:cp.level}:null,activeOffers:offerMap.get(Number(row.id))||0};})});
  }catch(error){console.error('Erreur lobby :',error);res.status(500).json({error:'Impossible de charger le lobby.'});}
});

app.get('/api/trades/inventory',async(req,res)=>{
  try{
    if(!req.session.account||!req.session.user)return res.status(401).json({error:'Connexion requise.'});
    const ctx=await tradeContext(pool,req);if(!ctx)return res.status(404).json({error:'Profil introuvable.'});
    const [lovys,eggs]=await Promise.all([
      pool.query(`SELECT creature_id,fragments,rank FROM user_lovys WHERE user_id=$1 ORDER BY creature_id`,[ctx.userId]),
      pool.query(`SELECT quantity FROM shop_inventory WHERE account_id=$1 AND item_key='mystery_egg'`,[ctx.accountId])
    ]);
    res.json({ok:true,eggs:Number(eggs.rows[0]?.quantity||0),lovys:lovys.rows.map(row=>({creatureId:row.creature_id,name:tradeCreatureName(row.creature_id),fragments:Number(row.fragments||0),rank:Number(row.rank||1),rarity:creatures.find(c=>c.id===row.creature_id)?.rarity||null,image:tradeCreatureImage(row.creature_id)})),catalog:creatures.map(c=>({creatureId:c.id,name:c.name,rarity:c.rarity,image:tradeCreatureImage(c.id)}))});
  }catch(error){console.error('Erreur inventaire échanges :',error);res.status(500).json({error:"Impossible de charger l'inventaire d'échange."});}
});

app.get('/api/trades',async(req,res)=>{
  const client=await pool.connect();
  try{
    if(!req.session.account||!req.session.user)return res.status(401).json({error:'Connexion requise.'});
    await client.query('BEGIN');await restoreExpiredTrades(client);await client.query('COMMIT');
    const ctx=await tradeContext(client,req);if(!ctx)return res.status(404).json({error:'Profil introuvable.'});
    const mine=String(req.query.mine||'')==='1';
    const params=mine?[ctx.userId]:[];
    const where=mine?`o.creator_user_id=$1 AND o.status NOT IN ('expired','completed')`:`o.status='open' AND o.expires_at>CURRENT_TIMESTAMP`;
    const offers=await client.query(`
      SELECT o.*,COALESCE(a.username,u.display_name,u.login) creator_name,u.profile_image_url,
             COALESCE(accept_a.username,accept_u.display_name,accept_u.login) accepted_by_name
      FROM trade_offers o JOIN users u ON u.id=o.creator_user_id JOIN accounts a ON a.id=o.creator_account_id
      LEFT JOIN users accept_u ON accept_u.id=o.accepted_by_user_id LEFT JOIN accounts accept_a ON accept_a.twitch_id=accept_u.twitch_id
      WHERE ${where} ORDER BY CASE WHEN o.status='open' THEN 0 ELSE 1 END,o.created_at DESC LIMIT 100`,params);
    const ids=offers.rows.map(row=>Number(row.id));
    const options=ids.length?await client.query(`SELECT * FROM trade_offer_options WHERE offer_id=ANY($1::bigint[]) ORDER BY offer_id,position`,[ids]):{rows:[]};
    const byOffer=new Map();for(const option of options.rows){const id=Number(option.offer_id);if(!byOffer.has(id))byOffer.set(id,[]);byOffer.get(id).push({id:Number(option.id),...tradeAssetJson(option.receive_type,option.receive_creature_id,option.receive_quantity)});}
    res.json({ok:true,selfUserId:ctx.userId,offers:offers.rows.map(row=>({id:Number(row.id),creatorUserId:Number(row.creator_user_id),creatorName:row.creator_name||'Joueur',creatorAvatar:row.profile_image_url||null,status:row.status,createdAt:row.created_at,expiresAt:row.expires_at,acceptedAt:row.accepted_at||null,acceptedByName:row.accepted_by_name||null,acceptedOptionId:row.accepted_option_id?Number(row.accepted_option_id):null,offer:tradeAssetJson(row.offer_type,row.offer_creature_id,row.offer_quantity),options:byOffer.get(Number(row.id))||[]}))});
  }catch(error){try{await client.query('ROLLBACK')}catch{};console.error('Erreur offres échanges :',error);res.status(500).json({error:'Impossible de charger les échanges.'});}finally{client.release();}
});

app.post('/api/trades',tradeWriteRateLimit,async(req,res)=>{
  const client=await pool.connect();
  try{
    if(!req.session.account||!req.session.user)return res.status(401).json({error:'Connexion requise.'});
    const offered=normalizeTradeAsset(req.body?.offer);const rawOptions=Array.isArray(req.body?.options)?req.body.options:[];const options=rawOptions.slice(0,TRADE_MAX_OPTIONS).map(normalizeTradeAsset).filter(Boolean);
    const durationDays=Number.parseInt(req.body?.durationDays,10)||3;
    if(!offered||!options.length||rawOptions.length>TRADE_MAX_OPTIONS||options.length!==rawOptions.length)return res.status(400).json({error:'Offre ou contrepartie invalide.'});
    if(!TRADE_DURATIONS.has(durationDays))return res.status(400).json({error:"Durée d'annonce invalide."});
    const unique=new Set(options.map(a=>`${a.type}:${a.creatureId||''}:${a.quantity}`));if(unique.size!==options.length)return res.status(400).json({error:'Deux contreparties identiques ne sont pas nécessaires.'});
    await client.query('BEGIN');await restoreExpiredTrades(client);const ctx=await tradeContext(client,req);if(!ctx)throw new Error('Profil introuvable.');
    await client.query('SELECT id FROM users WHERE id=$1 FOR UPDATE',[ctx.userId]);
    const openCount=await client.query(`SELECT ((SELECT COUNT(*) FROM trade_offers WHERE creator_user_id=$1 AND status='open')+(SELECT COUNT(*) FROM player_trade_offers WHERE creator_user_id=$1 AND status='open'))::int count`,[ctx.userId]);
    if(Number(openCount.rows[0]?.count||0)>=TRADE_MAX_ACTIVE)throw new Error(`Tu peux avoir au maximum ${TRADE_MAX_ACTIVE} offres actives en même temps.`);
    // Le créateur doit déjà posséder les Lovys dont il souhaite recevoir des fragments.
    for(const option of options){if(option.type==='fragment'){const balance=await tradeAssetBalance(client,ctx,option,true);if(balance===null)throw new Error(`Tu dois posséder ${tradeCreatureName(option.creatureId)} pour demander ses fragments.`);}}
    await changeTradeAsset(client,ctx,offered,-offered.quantity);
    const created=await client.query(`INSERT INTO trade_offers(creator_user_id,creator_account_id,offer_type,offer_creature_id,offer_quantity,expires_at) VALUES($1,$2,$3,$4,$5,CURRENT_TIMESTAMP+($6::text||' days')::interval) RETURNING id,expires_at`,[ctx.userId,ctx.accountId,offered.type,offered.creatureId,offered.quantity,String(durationDays)]);
    const offerId=Number(created.rows[0].id);for(let i=0;i<options.length;i++){const option=options[i];await client.query(`INSERT INTO trade_offer_options(offer_id,receive_type,receive_creature_id,receive_quantity,position) VALUES($1,$2,$3,$4,$5)`,[offerId,option.type,option.creatureId,option.quantity,i+1]);}
    await client.query('COMMIT');pushLiveUpdate('trade-update',{offerId});res.json({ok:true,offerId,expiresAt:created.rows[0].expires_at});
  }catch(error){try{await client.query('ROLLBACK')}catch{};console.error('Erreur création échange :',error);res.status(400).json({error:error.message||"Impossible de publier l'offre."});}finally{client.release();}
});

app.post('/api/trades/:offerId/accept',tradeWriteRateLimit,async(req,res)=>{
  const client=await pool.connect();
  try{
    if(!req.session.account||!req.session.user)return res.status(401).json({error:'Connexion requise.'});
    const offerId=Number.parseInt(req.params.offerId,10),optionId=Number.parseInt(req.body?.optionId,10);if(!offerId||!optionId)return res.status(400).json({error:'Échange invalide.'});
    await client.query('BEGIN');await restoreExpiredTrades(client);const accepter=await tradeContext(client,req);if(!accepter)throw new Error('Profil introuvable.');
    const daily=await client.query(`SELECT ((SELECT COUNT(*) FROM trade_offers WHERE status='completed' AND accepted_at>=CURRENT_DATE AND (accepted_by_user_id=$1 OR creator_user_id=$1))+(SELECT COUNT(*) FROM player_trade_offers WHERE status='completed' AND accepted_at>=CURRENT_DATE AND (target_user_id=$1 OR creator_user_id=$1)))::int count`,[accepter.userId]);if(Number(daily.rows[0]?.count||0)>=TRADE_MAX_DAILY_COMPLETED)throw new Error(`Limite de ${TRADE_MAX_DAILY_COMPLETED} échanges par jour atteinte.`);
    const offerResult=await client.query(`SELECT * FROM trade_offers WHERE id=$1 FOR UPDATE`,[offerId]);const offer=offerResult.rows[0];if(!offer||offer.status!=='open'||new Date(offer.expires_at)<=new Date())throw new Error("Cette offre n'est plus disponible.");if(Number(offer.creator_user_id)===accepter.userId)throw new Error('Tu ne peux pas accepter ta propre offre.');
    const optionResult=await client.query(`SELECT * FROM trade_offer_options WHERE id=$1 AND offer_id=$2`,[optionId,offerId]);const option=optionResult.rows[0];if(!option)throw new Error('Cette contrepartie est introuvable.');
    const creator={userId:Number(offer.creator_user_id),accountId:Number(offer.creator_account_id)};
    const creatorDaily=await client.query(`SELECT ((SELECT COUNT(*) FROM trade_offers WHERE status='completed' AND accepted_at>=CURRENT_DATE AND (accepted_by_user_id=$1 OR creator_user_id=$1))+(SELECT COUNT(*) FROM player_trade_offers WHERE status='completed' AND accepted_at>=CURRENT_DATE AND (target_user_id=$1 OR creator_user_id=$1)))::int count`,[creator.userId]);if(Number(creatorDaily.rows[0]?.count||0)>=TRADE_MAX_DAILY_COMPLETED)throw new Error(`Le créateur a atteint sa limite de ${TRADE_MAX_DAILY_COMPLETED} échanges aujourd’hui.`);
    const offered={type:offer.offer_type,creatureId:offer.offer_creature_id,quantity:Number(offer.offer_quantity)};
    const requested={type:option.receive_type,creatureId:option.receive_creature_id,quantity:Number(option.receive_quantity)};
    // Le receveur doit posséder le Lovys correspondant avant de recevoir des fragments spécifiques.
    if(offered.type==='fragment'){const balance=await tradeAssetBalance(client,accepter,offered,true);if(balance===null)throw new Error(`Tu dois posséder ${tradeCreatureName(offered.creatureId)} pour recevoir ses fragments.`);}
    await changeTradeAsset(client,accepter,requested,-requested.quantity);
    await changeTradeAsset(client,creator,requested,requested.quantity);
    await changeTradeAsset(client,accepter,offered,offered.quantity);
    await client.query(`UPDATE trade_offers SET status='completed',accepted_by_user_id=$2,accepted_option_id=$3,accepted_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE id=$1`,[offerId,accepter.userId,optionId]);
    await client.query(`INSERT INTO trade_notifications(user_id,message,event_type,offer_id) VALUES($1,$2,'offer_accepted',$3)`,[creator.userId,`Ton offre #${offerId} a été acceptée par ${accepter.username}.`,offerId]);
    await client.query('COMMIT');pushLiveUpdate('trade-update',{offerId});res.json({ok:true,message:'Échange effectué !'});
  }catch(error){try{await client.query('ROLLBACK')}catch{};console.error('Erreur acceptation échange :',error);res.status(400).json({error:error.message||"Impossible d'accepter cet échange."});}finally{client.release();}
});

app.post('/api/trades/:offerId/cancel',tradeWriteRateLimit,async(req,res)=>{
  const client=await pool.connect();
  try{
    if(!req.session.account||!req.session.user)return res.status(401).json({error:'Connexion requise.'});const offerId=Number.parseInt(req.params.offerId,10);if(!offerId)return res.status(400).json({error:'Offre invalide.'});
    await client.query('BEGIN');await restoreExpiredTrades(client);const ctx=await tradeContext(client,req);if(!ctx)throw new Error('Profil introuvable.');
    const result=await client.query(`SELECT * FROM trade_offers WHERE id=$1 AND creator_user_id=$2 FOR UPDATE`,[offerId,ctx.userId]);const offer=result.rows[0];if(!offer||offer.status!=='open')throw new Error("Cette offre ne peut plus être annulée.");
    const asset={type:offer.offer_type,creatureId:offer.offer_creature_id,quantity:Number(offer.offer_quantity)};await changeTradeAsset(client,ctx,asset,asset.quantity);
    await client.query(`UPDATE trade_offers SET status='cancelled',updated_at=CURRENT_TIMESTAMP WHERE id=$1`,[offerId]);await client.query('COMMIT');pushLiveUpdate('trade-update',{offerId});res.json({ok:true,message:'Offre annulée. Les objets réservés ont été rendus.'});
  }catch(error){try{await client.query('ROLLBACK')}catch{};console.error('Erreur annulation échange :',error);res.status(400).json({error:error.message||"Impossible d'annuler cette offre."});}finally{client.release();}
});


app.get('/api/trades/history',async(req,res)=>{try{const ctx=await tradeContext(pool,req);if(!ctx)return res.status(401).json({error:'Connexion requise.'});const q=await pool.query(`SELECT o.*,COALESCE(a.username,u.display_name,u.login) creator_name,COALESCE(aa.username,au.display_name,au.login) accepted_by_name,u.profile_image_url FROM trade_offers o JOIN users u ON u.id=o.creator_user_id JOIN accounts a ON a.id=o.creator_account_id LEFT JOIN users au ON au.id=o.accepted_by_user_id LEFT JOIN accounts aa ON aa.twitch_id=au.twitch_id WHERE o.status='completed' AND (o.creator_user_id=$1 OR o.accepted_by_user_id=$1) ORDER BY o.accepted_at DESC LIMIT 50`,[ctx.userId]);const ids=q.rows.map(x=>Number(x.id));const opts=ids.length?await pool.query(`SELECT * FROM trade_offer_options WHERE offer_id=ANY($1::bigint[]) ORDER BY offer_id,position`,[ids]):{rows:[]};const by=new Map();for(const x of opts.rows){const id=Number(x.offer_id);if(!by.has(id))by.set(id,[]);by.get(id).push({id:Number(x.id),...tradeAssetJson(x.receive_type,x.receive_creature_id,x.receive_quantity)});}res.json({ok:true,offers:q.rows.map(x=>({id:Number(x.id),creatorUserId:Number(x.creator_user_id),creatorName:x.creator_name,creatorAvatar:x.profile_image_url,status:x.status,expiresAt:x.expires_at,acceptedAt:x.accepted_at,acceptedByName:x.accepted_by_name,offer:tradeAssetJson(x.offer_type,x.offer_creature_id,x.offer_quantity),options:by.get(Number(x.id))||[]}))});}catch(e){res.status(500).json({error:'Historique indisponible.'});}});
app.get('/api/trades/wishes',async(req,res)=>{try{const ctx=await tradeContext(pool,req);if(!ctx)return res.status(401).json({error:'Connexion requise.'});const mine=await pool.query(`SELECT creature_id FROM trade_wishes WHERE user_id=$1`,[ctx.userId]);const sum=await pool.query(`SELECT w.creature_id,COUNT(DISTINCT w.user_id)::int wish_count,COUNT(DISTINCT o.id)::int offer_count FROM trade_wishes w LEFT JOIN trade_offers o ON o.offer_creature_id=w.creature_id AND o.offer_type='fragment' AND o.status='open' AND o.expires_at>CURRENT_TIMESTAMP GROUP BY w.creature_id ORDER BY wish_count DESC`);const matches=await pool.query(`SELECT w.creature_id,w.user_id,COALESCE(a.username,u.display_name,u.login) username FROM trade_wishes w JOIN users u ON u.id=w.user_id LEFT JOIN accounts a ON a.twitch_id=u.twitch_id WHERE w.user_id<>$1 ORDER BY w.created_at DESC LIMIT 50`,[ctx.userId]);res.json({ok:true,mine:mine.rows.map(x=>x.creature_id),summary:sum.rows.map(x=>({creatureId:x.creature_id,name:tradeCreatureName(x.creature_id),wishCount:Number(x.wish_count),offerCount:Number(x.offer_count)})),matches:matches.rows.map(x=>({creatureId:x.creature_id,userId:Number(x.user_id),username:x.username||'Joueur'}))});}catch(e){res.status(500).json({error:'Souhaits indisponibles.'});}});
app.post('/api/trades/wishes',async(req,res)=>{try{const ctx=await tradeContext(pool,req);if(!ctx)return res.status(401).json({error:'Connexion requise.'});const id=String(req.body?.creatureId||'');if(!creatures.some(c=>c.id===id))return res.status(400).json({error:'Lovys invalide.'});if(req.body?.wanted)await pool.query(`INSERT INTO trade_wishes(user_id,creature_id) VALUES($1,$2) ON CONFLICT DO NOTHING`,[ctx.userId,id]);else await pool.query(`DELETE FROM trade_wishes WHERE user_id=$1 AND creature_id=$2`,[ctx.userId,id]);res.json({ok:true});}catch(e){res.status(500).json({error:'Impossible de modifier le souhait.'});}});


app.get('/api/trades/activity',async(req,res)=>{try{if(!req.session.account||!req.session.user)return res.status(401).json({error:'Connexion requise.'});const q=await pool.query(`SELECT o.id,o.status,o.created_at,o.accepted_at,COALESCE(a.username,u.display_name,u.login) creator_name,o.offer_type,o.offer_creature_id,o.offer_quantity,COALESCE(aa.username,au.display_name,au.login) accepted_by_name FROM trade_offers o JOIN users u ON u.id=o.creator_user_id LEFT JOIN accounts a ON a.twitch_id=u.twitch_id LEFT JOIN users au ON au.id=o.accepted_by_user_id LEFT JOIN accounts aa ON aa.twitch_id=au.twitch_id WHERE o.created_at>=CURRENT_TIMESTAMP-INTERVAL '7 days' AND (o.status='completed' OR (o.status='open' AND o.expires_at>CURRENT_TIMESTAMP)) ORDER BY COALESCE(o.accepted_at,o.created_at) DESC LIMIT 12`);res.json({ok:true,items:q.rows.map(x=>({id:Number(x.id),status:x.status,at:x.accepted_at||x.created_at,text:x.status==='completed'?`Offre de ${Number(x.offer_quantity)} ${x.offer_type==='egg'?'œuf(s)':`fragments de ${tradeCreatureName(x.offer_creature_id)}`} de ${x.creator_name||'un joueur'} acceptée${x.accepted_by_name?` par ${x.accepted_by_name}`:''}.`:`${x.creator_name||'Un joueur'} propose ${Number(x.offer_quantity)} ${x.offer_type==='egg'?'œuf(s)':`fragments de ${tradeCreatureName(x.offer_creature_id)}`}.`}))});}catch(e){res.status(500).json({error:'Activité indisponible.'});}});
app.get('/api/trades/notifications',async(req,res)=>{try{const ctx=await tradeContext(pool,req);if(!ctx)return res.status(401).json({error:'Connexion requise.'});const q=await pool.query(`SELECT id,message,event_type,created_at,read_at FROM trade_notifications WHERE user_id=$1 ORDER BY created_at DESC LIMIT 20`,[ctx.userId]);res.json({ok:true,unread:q.rows.filter(x=>!x.read_at).length,items:q.rows});}catch(e){res.status(500).json({error:'Notifications indisponibles.'});}});
app.post('/api/trades/notifications/read',async(req,res)=>{try{const ctx=await tradeContext(pool,req);if(!ctx)return res.status(401).json({error:'Connexion requise.'});await pool.query(`UPDATE trade_notifications SET read_at=CURRENT_TIMESTAMP WHERE user_id=$1 AND read_at IS NULL`,[ctx.userId]);res.json({ok:true});}catch(e){res.status(500).json({error:'Impossible de marquer les notifications.'});}});

app.get('/api/trades/accepted-notices',async(req,res)=>{
  try{
    const ctx=await tradeContext(pool,req);if(!ctx)return res.status(401).json({error:'Connexion requise.'});
    const result=await pool.query(`SELECT n.id,o.offer_type,o.offer_creature_id,o.offer_quantity,
      opt.receive_type,opt.receive_creature_id,opt.receive_quantity,
      COALESCE(a.username,u.display_name,u.login,'un joueur') partner
      FROM trade_notifications n JOIN trade_offers o ON o.id=n.offer_id
      JOIN trade_offer_options opt ON opt.id=o.accepted_option_id
      LEFT JOIN users u ON u.id=o.accepted_by_user_id LEFT JOIN accounts a ON a.twitch_id=u.twitch_id
      WHERE n.user_id=$1 AND o.creator_user_id=$1 AND o.status='completed'
      AND n.event_type='offer_accepted' AND n.popup_seen_at IS NULL ORDER BY n.id LIMIT 20`,[ctx.userId]);
    const targeted=await pool.query(`SELECT n.id,o.offered,o.requested,
      COALESCE(a.username,u.display_name,u.login,'un joueur') partner
      FROM trade_notifications n JOIN player_trade_offers o ON o.id=n.player_trade_id
      LEFT JOIN users u ON u.id=o.target_user_id LEFT JOIN accounts a ON a.twitch_id=u.twitch_id
      WHERE n.user_id=$1 AND o.creator_user_id=$1 AND o.status='completed'
      AND n.event_type='player_trade_accepted' AND n.popup_seen_at IS NULL ORDER BY n.id LIMIT 20`,[ctx.userId]);
    const items=result.rows.map(row=>({id:Number(row.id),partner:row.partner,
      give:[tradeAssetJson(row.offer_type,row.offer_creature_id,row.offer_quantity)],
      receive:[tradeAssetJson(row.receive_type,row.receive_creature_id,row.receive_quantity)]}));
    items.push(...targeted.rows.map(row=>({id:Number(row.id),partner:row.partner,
      give:row.offered.map(asset=>tradeAssetJson(asset.type,asset.creatureId,asset.quantity)),
      receive:row.requested.map(asset=>tradeAssetJson(asset.type,asset.creatureId,asset.quantity))})));
    res.json({ok:true,items:items.sort((a,b)=>a.id-b.id).slice(0,20)});
  }catch(error){console.error('Avis d’échange accepté :',error);res.status(500).json({error:'Notifications indisponibles.'});}
});
app.post('/api/trades/accepted-notices/seen',async(req,res)=>{
  try{
    const ctx=await tradeContext(pool,req);if(!ctx)return res.status(401).json({error:'Connexion requise.'});
    const ids=req.body?.ids;
    if(!Array.isArray(ids)||!ids.length||ids.length>20||ids.some(id=>!Number.isSafeInteger(id)||id<1))return res.status(400).json({error:'Avis invalides.'});
    await pool.query(`UPDATE trade_notifications SET popup_seen_at=CURRENT_TIMESTAMP WHERE user_id=$1
      AND id=ANY($2::bigint[]) AND event_type IN ('offer_accepted','player_trade_accepted') AND popup_seen_at IS NULL`,[ctx.userId,ids]);
    res.json({ok:true});
  }catch(error){res.status(500).json({error:'Impossible de confirmer les notifications.'});}
});

app.get('/api/trades/expiry-notices',async(req,res)=>{
  if(!req.session.account||!req.session.user)return res.status(401).json({error:'Connexion requise.'});
  let client,transaction=false;
  try{
    client=await pool.connect();await client.query('BEGIN');transaction=true;
    await restoreExpiredTrades(client);await client.query('COMMIT');transaction=false;
    const ctx=await tradeContext(client,req);if(!ctx)return res.status(404).json({error:'Profil introuvable.'});
    const notices=await client.query(`SELECT id,offer_id FROM trade_notifications WHERE user_id=$1 AND event_type='offer_expired' AND popup_seen_at IS NULL ORDER BY id LIMIT 20`,[ctx.userId]);
    res.json({ok:true,items:notices.rows.map(row=>({id:Number(row.id),offerId:Number(row.offer_id)}))});
  }catch(error){if(transaction)try{await client.query('ROLLBACK');}catch{};console.error('Erreur avis d’expiration :',error);res.status(500).json({error:'Avis d’expiration indisponibles.'});}
  finally{client?.release();}
});
app.post('/api/trades/expiry-notices/seen',async(req,res)=>{
  try{
    const ctx=await tradeContext(pool,req);if(!ctx)return res.status(401).json({error:'Connexion requise.'});
    const ids=req.body?.ids;
    if(!Array.isArray(ids)||!ids.length||ids.length>20||ids.some(id=>!Number.isSafeInteger(id)||id<1))return res.status(400).json({error:'Avis invalides.'});
    await pool.query(`UPDATE trade_notifications SET popup_seen_at=CURRENT_TIMESTAMP WHERE id=ANY($1::bigint[]) AND user_id=$2 AND event_type='offer_expired' AND popup_seen_at IS NULL`,[ids,ctx.userId]);
    res.json({ok:true});
  }catch(error){res.status(500).json({error:'Impossible de confirmer les avis.'});}
});

/* =========================================
   CLASSEMENT
========================================= */

app.get(
  '/api/leaderboard',
  async (req, res) => {
    try {
      const search = String(req.query.search || '').trim().slice(0, 32);
      const broadcasterId = String(process.env.TWITCH_BROADCASTER_ID || '').trim();
      // Identification par ID Twitch ; login de la chaîne uniquement si l'ID n'est pas configuré.
      const broadcasterMatch = `(($2::text <> '' AND u.twitch_id = $2::text) OR ($2::text = '' AND LOWER(COALESCE(u.login, '')) = $3::text))`;
      const requestedMetric = String(req.query.metric || 'watch').trim().toLowerCase();
      const metric = ['watch', 'level', 'pve', 'collection'].includes(requestedMetric) ? requestedMetric : 'watch';
      const orderByMetric = {
        watch: 'GREATEST(0, COALESCE(u.watch_seconds, 0) - COALESCE(u.incubator_accelerated_seconds, 0)) DESC, u.id ASC',
        level: 'COALESCE(u.global_xp, 0) DESC, u.id ASC',
        pve: 'pve_wins DESC, COALESCE(u.global_xp, 0) DESC, u.id ASC',
        collection: 'COALESCE(u.total_lovys_hatched, 0) DESC, COALESCE(u.global_xp, 0) DESC, u.id ASC'
      }[metric];

      // Requête volontairement simple et robuste : on récupère d'abord les joueurs,
      // puis leurs 2 badges de classement dans une seconde requête. Cela évite qu'une
      // ancienne ligne de badge ou une migration incomplète fasse tomber tout le classement.
      const playersResult = await pool.query(
        `
        SELECT
          u.id,
          u.twitch_id,
          u.login,
          ${broadcasterMatch} AS excluded_from_ranking,
          COALESCE(a.username, u.display_name, u.login) AS game_username,
          u.display_name,
          u.is_sub,
          u.profile_image_url,
          u.creature_id,
          u.xp,
          u.pending_xp,
          u.global_xp,
          u.prestige,
          u.total_lovys_hatched,
          u.egg_fragments,
          u.points,
          u.lifetime_lovercash_earned,
          u.lifetime_lovercash_spent,
          u.watch_seconds,
          u.incubator_accelerated_seconds,
          u.created_at,
          (SELECT COUNT(*)::int FROM user_lovys ul WHERE ul.user_id = u.id) AS collection_count,
          (SELECT COALESCE(SUM(upp.wins), 0)::int FROM user_pve_progress upp WHERE upp.user_id = u.id) AS pve_wins,
          a.equipped_title_key,
          a.equipped_background_key,
          a.equipped_frame_key,
          a.equipped_avatar_frame_key
        FROM users u
        LEFT JOIN accounts a ON a.twitch_id = u.twitch_id
        WHERE u.twitch_id IS NOT NULL
          AND ($1::text <> '' OR NOT ${broadcasterMatch})
          AND (
            $1::text = ''
            OR COALESCE(a.username, u.display_name, u.login) ILIKE '%' || $1::text || '%'
            OR COALESCE(u.display_name, '') ILIKE '%' || $1::text || '%'
            OR COALESCE(u.login, '') ILIKE '%' || $1::text || '%'
          )
        ORDER BY ${orderByMetric}
        LIMIT 50
        `,
        [search, broadcasterId, CHANNEL.trim()]
      );

      const playerIds = playersResult.rows.map(row => Number(row.id)).filter(Number.isFinite);
      let badgesByUser = new Map();
      let allBadgesByUser = new Map();
      let badgeCountsByUser = new Map();

      if (playerIds.length) {
        const badgesResult = await pool.query(
          `
          SELECT
            user_id,
            leaderboard_slot,
            badge_key,
            COALESCE(badge_name, game_name, 'Badge') AS badge_name,
            badge_image,
            badge_challenge,
            unlocked_at
          FROM user_badges
          WHERE user_id = ANY($1::int[])
          ORDER BY user_id ASC, unlocked_at DESC, id DESC
          `,
          [playerIds]
        );

        for (const badge of badgesResult.rows) {
          const userId = Number(badge.user_id);
          const publicBadge = {
            slot: badge.leaderboard_slot === null ? null : Number(badge.leaderboard_slot),
            badgeKey: badge.badge_key,
            badgeName: badge.badge_name || 'Badge',
            badgeImage: badge.badge_image || null,
            badgeChallenge: badge.badge_challenge || null,
            unlockedAt: badge.unlocked_at || null
          };

          if (!allBadgesByUser.has(userId)) allBadgesByUser.set(userId, []);
          allBadgesByUser.get(userId).push(publicBadge);

          if (badge.leaderboard_slot !== null && badge.leaderboard_slot !== undefined) {
            if (!badgesByUser.has(userId)) badgesByUser.set(userId, []);
            badgesByUser.get(userId).push(publicBadge);
          }
        }

        for (const list of badgesByUser.values()) {
          list.sort((a, b) => Number(a.slot || 99) - Number(b.slot || 99));
        }

        badgeCountsByUser = new Map(
          [...allBadgesByUser.entries()].map(([userId, badges]) => [Number(userId), badges.length])
        );
      }

      let visibleRank = 0;
      const leaderboard = playersResult.rows.map(player => {
        const hatched = Boolean(player.creature_id);
        const watched = Math.max(0, (Number(player.watch_seconds) || 0) - (Number(player.incubator_accelerated_seconds) || 0));
        const eggWatched = Math.min(watched, EGG_HATCH_SECONDS);

        return {
          id: Number(player.id),
          rank: player.excluded_from_ranking ? null : ++visibleRank,
          excluded_from_ranking: Boolean(player.excluded_from_ranking),
          twitch_id: player.twitch_id,
          login: player.login,
          display_name: player.game_username || player.display_name || player.login || 'Joueur',
          cosmetic_title: cosmeticTitleForTwitchId(player.twitch_id, player.equipped_title_key),
          cosmetic_title_color: titleCosmeticFor(player.twitch_id, player.equipped_title_key)?.color || null,
          cosmetic_background: validCosmeticKey(player.equipped_background_key, 'background'),
          cosmetic_frame: validCosmeticKey(player.equipped_frame_key, 'frame'),
          cosmetic_avatar_frame: validCosmeticKey(player.equipped_avatar_frame_key, 'avatar_frame'),
          is_sub: Boolean(player.is_sub),
          profile_image_url: player.profile_image_url || null,
          creature_id: player.creature_id,
          state: hatched ? 'creature' : 'egg',
          xp: Number(player.xp || 0),
          pending_xp: Number(player.pending_xp || 0),
          global_xp: Number(player.global_xp || 0),
          prestige: Number(player.prestige || 0),
          egg_fragments: Number(player.egg_fragments || 0),
          points: Number(player.points || 0),
          lifetime_lovercash_earned: Number(player.lifetime_lovercash_earned || 0),
          lifetime_lovercash_spent: Number(player.lifetime_lovercash_spent || 0),
          watch_seconds: watched,
          collection_count: Number(player.collection_count || 0),
          hatched_count: Number(player.total_lovys_hatched || 0),
          pve_wins: Number(player.pve_wins || 0),
          created_at: player.created_at || null,
          badge_count: badgeCountsByUser.get(Number(player.id)) || 0,
          creature_count: Number(player.collection_count || 0),
          total_lovys: creatures.length,
          leaderboard_badges: badgesByUser.get(Number(player.id)) || [],
          unlocked_badges: allBadgesByUser.get(Number(player.id)) || [],
          progression: progressionFromXp(Number(player.xp || 0)),
          global_progression: globalProgressionFromXp(Number(player.global_xp || 0)),
          egg: hatched ? null : {
            watchedSeconds: eggWatched,
            remainingSeconds: Math.max(0, EGG_HATCH_SECONDS - watched),
            progress: Math.min(100, (watched / EGG_HATCH_SECONDS) * 100),
            ready: watched >= EGG_HATCH_SECONDS
          }
        };
      });

      res.json({ ok: true, metric, leaderboard });
    } catch (error) {
      console.error('Erreur classement :', error);
      res.status(500).json({ error: 'Impossible de charger le classement' });
    }
  }
);


/* =========================================
   DÉMARRAGE
========================================= */

async function start() {

  try {

    await initDatabase();
    await achievementService.init();
    // Fige les badges historiques avant que le tracker puisse attribuer les nouveaux.
    // Les comptes sans badge ont une liste vide ; les nouveaux comptes sont initialisés à la liaison Twitch.
    await pool.query(`INSERT INTO user_badge_celebrations(user_id,seen_signatures)
      SELECT u.id,COALESCE(array_agg(CASE
        WHEN b.badge_key LIKE 'achievement:%' OR b.badge_key IN (
          'challenge:dofus:gardien-emeraude:50h','challenge:palworld:maitre-des-spheres:50h',
          'challenge:mw4:operateur-elite:50h','mission:zombie:maitre-des-morts:25h',
          'mission:global:fidele-chaine','mission:attendance:lives-assistes')
          THEN b.badge_key||':stage:'||b.threshold_hours::text
        WHEN b.badge_key='mission:sub:soutien-absolu' AND s.cycle>1
          THEN b.badge_key||':cycle:'||s.cycle::text
        ELSE b.badge_key||':unlocked' END) FILTER(WHERE b.badge_key IS NOT NULL),'{}'::text[])
      FROM users u LEFT JOIN user_badges b ON b.user_id=u.id
      LEFT JOIN user_subscription_badge_state s ON s.user_id=u.id
      WHERE NOT EXISTS(SELECT 1 FROM user_badge_celebrations c WHERE c.user_id=u.id)
      GROUP BY u.id ON CONFLICT(user_id) DO NOTHING`);


    // Premier contrôle peu après le démarrage, puis toutes les 15 secondes.
    setTimeout(() => {
      runTrackerTick().catch(error => console.error('Tracker Twitch :', error));
    }, 5000);

    setInterval(() => {
      runTrackerTick().catch(error => console.error('Tracker Twitch :', error));
    }, TRACKER_INTERVAL_MS);


    // Collecte silencieuse des fins de boosters, y compris sans navigateur ouvert.
    setInterval(() => { wizebotAlerts.collect(); }, 15000);

    app.listen(
      PORT,
      () => {

        console.log(
          `LoVeR Watch Game: ${BASE_URL}`
        );

      }
    );

  }

  catch (error) {

    console.error(
      'Impossible de démarrer le serveur :',
      error
    );


    process.exit(1);

  }

}


start();

