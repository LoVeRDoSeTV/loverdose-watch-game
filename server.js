import 'dotenv/config';
import express from 'express';
import session from 'express-session';
import pg from 'pg';
import connectPgSimple from 'connect-pg-simple';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';

const { Pool } = pg;

const app = express();

app.set('trust proxy', 1);

const PORT = Number(process.env.PORT || 3000);

const BASE_URL =
  process.env.BASE_URL ||
  `http://localhost:${PORT}`;

const CHANNEL =
  (process.env.TWITCH_CHANNEL || 'loverdosetv')
    .toLowerCase();

const XP_PER_MINUTE = 100 / 60;

const SUB_MULTIPLIER = 1.20;

const POINTS_PER_MINUTE = 10 / 60;


// Tracker Twitch : présence dans le chat pendant que la chaîne est en live.
// Ce n'est pas une mesure certifiée de lecture vidéo individuelle.
const TRACKER_INTERVAL_MS = 2 * 60 * 1000;
const TRACKER_MAX_GAP_SECONDS = 5 * 60;
const TRACKER_MAX_CREDIT_SECONDS = 3 * 60;
const TRACKER_SUB_SYNC_MS = 10 * 60 * 1000;


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
    description: 'Petite créature mystique venue des profondeurs abyssales.'
  },
  {
    id: 'voltis',
    name: 'Voltis',
    type: 'Foudre',
    rarity: 'Commun',
    dropRate: 17.5,
    dropWeight: 1750,
    description: 'Petite créature vive parcourue d’une énergie électrique.'
  },
  {
    id: 'brumee',
    name: 'Brumee',
    type: 'Brume',
    rarity: 'Commun',
    dropRate: 17.5,
    dropWeight: 1750,
    description: 'Créature légère et mystérieuse qui se déplace dans la brume.'
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
    description: 'Créature minérale dont le corps reflète une lumière cristalline.'
  },
  {
    id: 'ferox',
    name: 'Ferox',
    type: 'Forge',
    rarity: 'Rare',
    dropRate: 7,
    dropWeight: 700,
    description: 'Créature robuste façonnée par la chaleur et le métal.'
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
    description: 'Créature rayonnante nourrie par une énergie solaire intense.'
  },
  {
    id: 'dream',
    name: 'Mimo',
    type: 'Mirage',
    rarity: 'Mythique',
    dropRate: 1,
    dropWeight: 100,
    description: 'Créature céleste extrêmement rare née d’un Mirage.'
  }
];

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

  await pool.query(
    `
    UPDATE user_badges
    SET badge_name = 'Gardien de l’Émeraude',
        badge_image = '/DofusEmeraude.png',
        badge_challenge = 'Regarder 50 h de lives dans la catégorie Dofus'
    WHERE badge_key = 'challenge:dofus:gardien-emeraude:50h'
    `
  );

  await pool.query(
    `
    UPDATE user_badges
    SET badge_name = 'Maître des Sphères',
        badge_image = '/SpherePalworld.png',
        badge_challenge = 'Regarder 50 h de lives dans la catégorie Palworld'
    WHERE badge_key = 'challenge:palworld:maitre-des-spheres:50h'
    `
  );


  await pool.query(
    `
    UPDATE user_badges
    SET badge_name = 'Opérateur d’Élite',
        badge_image = '/MW4.png',
        badge_challenge = 'Regarder 50 h de lives dans la catégorie Call of Duty: Modern Warfare 4'
    WHERE badge_key = 'challenge:mw4:operateur-elite:50h'
    `
  );


  await pool.query(
    `
    UPDATE user_badges
    SET badge_name = 'Maître des morts',
        badge_image = '/Zombie.png',
        badge_challenge = 'Regarder 25 h de lives en mode Zombie'
    WHERE badge_key = 'mission:zombie:maitre-des-morts:25h'
    `
  );


  console.log(
    'PostgreSQL connecté ✅'
  );

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
  const secret = process.env.SESSION_SECRET || 'dev-secret-change-me';
  return crypto.createHash('sha256').update(secret).digest();
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

  return Buffer.concat([
    decipher.update(Buffer.from(encryptedText, 'base64url')),
    decipher.final()
  ]).toString('utf8');
}

async function getTrackerAuthRow() {
  const result = await pool.query(`
    SELECT *
    FROM twitch_tracker_auth
    WHERE id = 1
  `);
  return result.rows[0] || null;
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

    await client.query('COMMIT');
  } catch (error) {
    try { await client.query('ROLLBACK'); } catch {}
    throw error;
  } finally {
    client.release();
  }
}

let trackerTickRunning = false;

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
    const chatterIds = [...new Set(chatters.map(item => String(item.user_id || '')).filter(Boolean))];

    let matched = 0;

    if (deltaSeconds > 0 && chatterIds.length > 0) {
      const normalXp = deltaSeconds / 3600 * 100;
      const subXp = deltaSeconds / 3600 * 120;
      const points = deltaSeconds / 3600 * 10;

      const result = await pool.query(
        `
        UPDATE users
        SET
          xp = xp + CASE
            WHEN creature_id IS NULL THEN 0
            WHEN is_sub THEN $2
            ELSE $1
          END,
          points = points + $3,
          watch_seconds = watch_seconds + $4,
          updated_at = CURRENT_TIMESTAMP
        WHERE twitch_id = ANY($5::text[])
        RETURNING id
        `,
        [normalXp, subXp, points, deltaSeconds, chatterIds]
      );

      matched = result.rowCount || 0;

      const matchedUserIds = result.rows
        .map(item => Number(item.id))
        .filter(Number.isInteger);

      if (matchedUserIds.length > 0) {
        await pool.query(
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
            $4,
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
            SELECT
              user_id,
              'challenge:dofus:gardien-emeraude:50h',
              game_id,
              game_name,
              'Gardien de l’Émeraude',
              '/DofusEmeraude.png',
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
            SELECT
              user_id,
              'challenge:palworld:maitre-des-spheres:50h',
              game_id,
              game_name,
              'Maître des Sphères',
              '/SpherePalworld.png',
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
            SELECT
              user_id,
              'challenge:mw4:operateur-elite:50h',
              game_id,
              game_name,
              'Opérateur d’Élite',
              '/MW4.png',
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
          await pool.query(
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
              $2,
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
            SELECT
              user_id,
              'mission:zombie:maitre-des-morts:25h',
              game_id,
              game_name,
              'Maître des morts',
              '/Zombie.png',
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
      const result = await pool.query(
        `SELECT COUNT(*)::int AS count FROM users WHERE twitch_id = ANY($1::text[])`,
        [chatterIds]
      );
      matched = Number(result.rows[0]?.count || 0);
    }

    await pool.query(
      `
      UPDATE twitch_tracker_auth
      SET last_poll_at = CURRENT_TIMESTAMP,
          last_success_at = CURRENT_TIMESTAMP,
          last_live = TRUE,
          last_chatter_count = $1,
          last_matched_count = $2,
          last_error = NULL,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = 1
      `,
      [chatterIds.length, matched]
    );

    return {
      ok: true,
      live: true,
      creditedSeconds: deltaSeconds,
      chatters: chatterIds.length,
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

/* =========================================
   EXPRESS
========================================= */

app.use(express.json());


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
      process.env.SESSION_SECRET ||
      'dev-secret-change-me',

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


app.use(
  express.static('public')
);

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

app.post('/api/register', async (req, res) => {
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

app.post('/api/account/login', async (req, res) => {
  try {
    let { email, password } = req.body;

    email = String(email || '').trim().toLowerCase();
    password = String(password || '');

    if (!email || !password) {
      return res.status(400).json({
        error: 'E-mail et mot de passe obligatoires.'
      });
    }

    const result = await pool.query(
      `
      SELECT
        id,
        email,
        username,
        password_hash,
        twitch_id
      FROM accounts
      WHERE email = $1
      `,
      [email]
    );

    const account = result.rows[0];

    if (!account) {
      return res.status(401).json({
        error: 'E-mail ou mot de passe incorrect.'
      });
    }

    const passwordOk = await bcrypt.compare(
      password,
      account.password_hash
    );

    if (!passwordOk) {
      return res.status(401).json({
        error: 'E-mail ou mot de passe incorrect.'
      });
    }

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
        gameReady,
        showGameIntro: Boolean(account.twitch_id) && !account.game_intro_seen,
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
        twitch_id,
        game_intro_seen
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
        twitchConnected: Boolean(account.twitch_id),
        gameReady,
        showGameIntro: Boolean(account.twitch_id) && !account.game_intro_seen,
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


/* =========================================
   COMPTE - INTRODUCTION VUE
========================================= */

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
  req.session.destroy(() => {
    res.json({
      ok: true
    });
  });
});


/* =========================================
   COMPTE - RÉINITIALISER LE JEU
========================================= */

app.post('/api/account/reset-game', async (req, res) => {
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

    if (!account.twitch_id) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Aucun compte Twitch n’est lié.' });
    }

    const userResult = await client.query(
      `
      SELECT id
      FROM users
      WHERE twitch_id = $1
      FOR UPDATE
      `,
      [account.twitch_id]
    );

    const user = userResult.rows[0];

    if (!user) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Profil de jeu introuvable.' });
    }

    await client.query(
      `DELETE FROM sessions_watch WHERE user_id = $1`,
      [user.id]
    );

    await client.query(
      `DELETE FROM user_badges WHERE user_id = $1`,
      [user.id]
    );

    await client.query(
      `DELETE FROM user_game_watch WHERE user_id = $1`,
      [user.id]
    );

    await client.query(
      `
      UPDATE users
      SET
        creature_id = NULL,
        xp = 0,
        points = 0,
        watch_seconds = 0,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
      `,
      [user.id]
    );

    await client.query('COMMIT');

    res.json({
      ok: true,
      message: 'Progression du jeu réinitialisée.'
    });
  } catch (error) {
    try { await client.query('ROLLBACK'); } catch {}
    console.error('Erreur réinitialisation jeu :', error);
    res.status(500).json({ error: 'Impossible de réinitialiser la progression.' });
  } finally {
    client.release();
  }
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

    if (!req.query.code || req.query.state !== req.session.trackerOauthState) {
      return res.status(400).send('OAuth tracker invalide.');
    }

    delete req.session.trackerOauthState;

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


function streamDeckTokenIsValid(req) {
  const configured = String(process.env.STREAM_DECK_TOKEN || '').trim();
  const provided = String(req.query?.token || '').trim();

  if (!configured || !provided) return false;

  const configuredBuffer = Buffer.from(configured);
  const providedBuffer = Buffer.from(provided);

  if (configuredBuffer.length !== providedBuffer.length) return false;
  return crypto.timingSafeEqual(configuredBuffer, providedBuffer);
}

app.get('/api/streamdeck/zombie/on', async (req, res) => {
  try {
    if (!streamDeckTokenIsValid(req)) {
      return res.status(403).send('Accès refusé.');
    }

    const row = await getTrackerAuthRow();
    if (!row) {
      return res.status(409).send('Tracker Twitch non configuré.');
    }

    // Compte d'abord le temps écoulé avec l'ancien mode, puis active Zombie.
    await runTrackerTick();

    await pool.query(
      `
      UPDATE twitch_tracker_auth
      SET special_mode = 'zombie',
          updated_at = CURRENT_TIMESTAMP
      WHERE id = 1
      `
    );

    res.send('🧟 Mode Zombie activé');
  } catch (error) {
    console.error('Erreur Stream Deck Zombie ON :', error);
    res.status(500).send('Impossible d’activer le mode Zombie.');
  }
});

app.get('/api/streamdeck/zombie/off', async (req, res) => {
  try {
    if (!streamDeckTokenIsValid(req)) {
      return res.status(403).send('Accès refusé.');
    }

    const row = await getTrackerAuthRow();
    if (!row) {
      return res.status(409).send('Tracker Twitch non configuré.');
    }

    // Compte le dernier intervalle Zombie avant de couper le mode spécial.
    await runTrackerTick();

    await pool.query(
      `
      UPDATE twitch_tracker_auth
      SET special_mode = NULL,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = 1
      `
    );

    res.send('✅ Mode Zombie désactivé');
  } catch (error) {
    console.error('Erreur Stream Deck Zombie OFF :', error);
    res.status(500).send('Impossible de désactiver le mode Zombie.');
  }
});

app.get('/api/streamdeck/zombie/status', async (req, res) => {
  try {
    if (!streamDeckTokenIsValid(req)) {
      return res.status(403).json({ error: 'Accès refusé.' });
    }

    const row = await getTrackerAuthRow();
    res.json({
      ok: true,
      active: String(row?.special_mode || '').toLowerCase() === 'zombie',
      specialMode: row?.special_mode || null
    });
  } catch (error) {
    console.error('Erreur Stream Deck Zombie STATUS :', error);
    res.status(500).json({ error: 'Impossible de charger le mode Zombie.' });
  }
});


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

    res.json({
      ok: true,
      authorized: true,
      live: Boolean(row.last_live),
      lastPollAt: row.last_poll_at,
      lastSuccessAt: row.last_success_at,
      lastSubSyncAt: row.last_sub_sync_at,
      chatterCount: Number(row.last_chatter_count || 0),
      matchedCount: Number(row.last_matched_count || 0),
      specialMode: row.special_mode || null,
      error: row.last_error || null
    });
  } catch (error) {
    console.error('Erreur statut tracker :', error);
    res.status(500).json({ error: 'Impossible de charger le statut du tracker.' });
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
        !req.query.code ||
        req.query.state !==
          req.session.oauthState
      ) {

        return res
          .status(400)
          .send(
            'OAuth invalide.'
          );

      }

      delete req.session.oauthState;

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


      await pool.query(
        `
        INSERT INTO users (
          twitch_id,
          login,
          display_name,
          is_sub
        )

        VALUES (
          $1,
          $2,
          $3,
          $4
        )

        ON CONFLICT (twitch_id)

        DO UPDATE SET

          login =
            EXCLUDED.login,

          display_name =
            EXCLUDED.display_name,

          is_sub =
            EXCLUDED.is_sub,

          updated_at =
            CURRENT_TIMESTAMP
        `,
        [
          t.id,
          t.login,
          req.session.account.username || t.display_name,
          isSub
        ]
      );

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
          SELECT

            twitch_id,

            login,

            display_name,

            is_sub,

            creature_id,

            xp,

            points,

            watch_seconds

          FROM users

          WHERE twitch_id = $1
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


      res.json({

        authenticated:
          true,

        user: {

          ...u,

          game_username:
            req.session.account.username || u.display_name,

          watch_seconds:
            Number(
              u.watch_seconds
            ),

          xp:
            Number(u.xp),

          points:
            Number(u.points),

          progression:
            progressionFromXp(
              u.xp
            ),

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
          watch_seconds
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
          updated_at = CURRENT_TIMESTAMP
        WHERE id = $2
        `,
        [creature.id, u.id]
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
        }
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
      `SELECT badge_showcase_public, badge_showcase_theme FROM accounts WHERE id = $1`,
      [req.session.account.id]
    );
    const showcaseSettings = showcaseSettingsResult.rows[0] || {
      badge_showcase_public: true,
      badge_showcase_theme: 'classic'
    };

    if (!user) {
      return res.status(404).json({ error: 'Joueur introuvable.' });
    }

    if (user.is_sub) {
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
          'mission:sub:soutien-absolu',
          'special-sub',
          'Spécial · Abonnement',
          'Soutien Absolu',
          '/Loverhi.png',
          'S’abonner à la chaîne LoVeRDoSeTV',
          'special',
          0
        )
        ON CONFLICT (user_id, badge_key) DO NOTHING
        `,
        [user.id]
      );
    }

    // Badge global évolutif : Fidèle de la chaîne
    // Il évolue automatiquement avec le temps total de visionnage du joueur.
    const globalWatchSeconds = Math.max(0, Number(user.watch_seconds) || 0);
    const globalWatchHours = globalWatchSeconds / 3600;
    const globalBadgeKey = 'mission:global:fidele-chaine';

    const globalBadgeStages = [
      { minHours: 50,  nextHours: 100,  image: '/Watch1.png', tier: 'global-1', evolution: 'Évolution I · Étincelle fidèle' },
      { minHours: 100, nextHours: 250,  image: '/Watch2.png', tier: 'global-2', evolution: 'Évolution II · Éclat fidèle' },
      { minHours: 250, nextHours: 500,  image: '/Watch3.png', tier: 'global-3', evolution: 'Évolution III · Cœur de fidélité' },
      { minHours: 500, nextHours: 1000, image: '/Watch4.png', tier: 'global-4', evolution: 'Évolution IV · Étoile légendaire' },
      { minHours: 1000, nextHours: null, image: '/Watch5.png', tier: 'global-5', evolution: 'Évolution V · Présence mythique' }
    ];

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
            : 'Évolution maximale atteinte · 1000 h de visionnage total',
          globalStage.tier,
          globalStage.minHours
        ]
      );
    }

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

    const globalUnlocked = badgeResult.rows.find(item => item.badge_key === globalBadgeKey) || null;
    const currentGlobalStage = globalStage;
    const nextGlobalTargetHours = currentGlobalStage
      ? (currentGlobalStage.nextHours || currentGlobalStage.minHours)
      : 50;
    const globalDisplayStage = currentGlobalStage || {
      minHours: 50,
      nextHours: 50,
      image: '/Watch1.png',
      tier: 'global-1',
      evolution: 'Évolution I · Étincelle fidèle'
    };

    res.json({
      ok: true,
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
          badgeImage: '/DofusEmeraude.png',
          badgeChallenge: 'Regarder 50 h de lives dans la catégorie Dofus',
          gameName: 'Dofus',
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
          badgeImage: '/SpherePalworld.png',
          badgeChallenge: 'Regarder 50 h de lives dans la catégorie Palworld',
          gameName: 'Palworld',
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
          badgeImage: '/MW4.png',
          badgeChallenge: 'Regarder 50 h de lives dans la catégorie Call of Duty: Modern Warfare 4',
          gameName: 'Call of Duty: Modern Warfare 4',
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
          badgeImage: '/Zombie.png',
          badgeChallenge: 'Regarder 25 h de lives en mode Zombie',
          gameName: 'Zombie',
          missionType: 'special-mode',
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
          badgeKey: subBadgeKey,
          badgeName: 'Soutien Absolu',
          badgeImage: '/Loverhi.png',
          badgeChallenge: 'S’abonner à la chaîne LoVeRDoSeTV',
          gameName: 'Spécial · Abonnement',
          missionType: 'subscription',
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
          badgeKey: globalBadgeKey,
          badgeName: 'Fidèle de la chaîne',
          badgeImage: globalDisplayStage.image,
          badgeChallenge: currentGlobalStage?.nextHours
            ? `Cumuler ${currentGlobalStage.nextHours} h de visionnage total pour faire évoluer le badge`
            : 'Atteindre 1000 h de visionnage total sur la chaîne',
          gameName: `Global · ${globalDisplayStage.evolution}`,
          missionType: 'global-evolution',
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
      ],
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



app.post('/api/badges/leaderboard/equip', async (req, res) => {
  const client = await pool.connect();

  try {
    if (!req.session.account || !req.session.user) {
      return res.status(401).json({ error: 'Connexion requise.' });
    }

    const badgeKey = String(req.body?.badgeKey || '').trim();
    const slot = Number(req.body?.slot);

    if (!badgeKey || !Number.isInteger(slot) || slot < 1 || slot > 2) {
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
      WHERE user_id = $1
        AND badge_key = $2
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
      SET leaderboard_slot = NULL
      WHERE user_id = $1
        AND (badge_key = $2 OR leaderboard_slot = $3)
      `,
      [user.id, badgeKey, slot]
    );

    await client.query(
      `
      UPDATE user_badges
      SET leaderboard_slot = $3
      WHERE user_id = $1
        AND badge_key = $2
      `,
      [user.id, badgeKey, slot]
    );

    await client.query('COMMIT');
    res.json({ ok: true, slot });
  } catch (error) {
    try { await client.query('ROLLBACK'); } catch {}
    console.error('Erreur badge classement :', error);
    res.status(500).json({ error: 'Impossible d’afficher ce badge dans le classement.' });
  } finally {
    client.release();
  }
});

app.post('/api/badges/leaderboard/unequip', async (req, res) => {
  try {
    if (!req.session.account || !req.session.user) {
      return res.status(401).json({ error: 'Connexion requise.' });
    }

    const slot = Number(req.body?.slot);

    if (!Number.isInteger(slot) || slot < 1 || slot > 2) {
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
      SET leaderboard_slot = NULL
      WHERE user_id = $1
        AND leaderboard_slot = $2
      `,
      [user.id, slot]
    );

    res.json({ ok: true });
  } catch (error) {
    console.error('Erreur retrait badge classement :', error);
    res.status(500).json({ error: 'Impossible de retirer ce badge du classement.' });
  }
});


/* =========================================
   CLASSEMENT
========================================= */

app.get(
  '/api/leaderboard',
  async (req, res) => {

    try {

      const result =
        await pool.query(
          `
          SELECT

            u.twitch_id,

            u.login,

            COALESCE(a.username, u.display_name) AS game_username,

            u.display_name,

            u.is_sub,

            u.creature_id,

            u.xp,

            u.points,

            u.watch_seconds,

            COALESCE(
              (
                SELECT json_agg(
                  json_build_object(
                    'slot', ub.leaderboard_slot,
                    'badgeKey', ub.badge_key,
                    'badgeName', COALESCE(ub.badge_name, ub.game_name, 'Badge'),
                    'badgeImage', ub.badge_image
                  )
                  ORDER BY ub.leaderboard_slot
                )
                FROM user_badges ub
                WHERE ub.user_id = u.id
                  AND ub.leaderboard_slot IS NOT NULL
              ),
              '[]'::json
            ) AS leaderboard_badges

          FROM users u
          LEFT JOIN accounts a ON a.twitch_id = u.twitch_id

          WHERE u.creature_id
            IS NOT NULL

          ORDER BY

            u.xp DESC,

            u.watch_seconds DESC

          LIMIT 25
          `
        );


      const leaderboard =
        result.rows.map(
          (
            player,
            index
          ) => ({

            rank:
              index + 1,

            twitch_id:
              player.twitch_id,

            login:
              player.login,

            display_name:
              player.game_username || player.display_name,

            is_sub:
              Boolean(
                player.is_sub
              ),

            creature_id:
              player.creature_id,

            xp:
              Number(
                player.xp
              ),

            points:
              Number(
                player.points
              ),

            watch_seconds:
              Number(
                player
                  .watch_seconds
              ),

            leaderboard_badges:
              Array.isArray(player.leaderboard_badges)
                ? player.leaderboard_badges
                : [],

            progression:
              progressionFromXp(
                player.xp
              )

          })
        );


      res.json({

        ok:
          true,

        leaderboard

      });

    }

    catch (error) {

      console.error(
        'Erreur classement :',
        error
      );


      res
        .status(500)
        .json({
          error:
            'Impossible de charger le classement'
        });

    }

  }
);


/* =========================================
   DÉMARRAGE
========================================= */

async function start() {

  try {

    await initDatabase();

    // Premier contrôle peu après le démarrage, puis toutes les 2 minutes.
    setTimeout(() => {
      runTrackerTick().catch(error => console.error('Tracker Twitch :', error));
    }, 5000);

    setInterval(() => {
      runTrackerTick().catch(error => console.error('Tracker Twitch :', error));
    }, TRACKER_INTERVAL_MS);


    app.listen(
      PORT,
      () => {

        console.log(
          `LoVeRDoSe Watch Game: ${BASE_URL}`
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
