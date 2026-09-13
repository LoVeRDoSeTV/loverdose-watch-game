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

const SUB_MULTIPLIER = 1.10;

const POINTS_PER_MINUTE = 10 / 60;


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

const creatures = [

  {
    id: 'fire',
    name: 'Flamby',
    type: 'Feu',
    description:
      'Petit renard-dragon aux flammes vives.'
  },

  {
    id: 'water',
    name: 'Nyméa',
    type: 'Eau',
    description:
      'Petite créature aquatique mystique.'
  },

  {
    id: 'plant',
    name: 'Mossy',
    type: 'Plante',
    description:
      'Petit hybride écureuil et plante.'
  },

  {
    id: 'dark',
    name: 'Nocty',
    type: 'Obscur',
    description:
      'Petit félin mystérieux lié aux ombres.'
  },

  {
    id: 'dream',
    name: 'Mimo',
    type: 'Rêve',
    description:
      'Petite créature céleste née des rêves.'
  }

];


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


  await pool.query(`
    CREATE TABLE IF NOT EXISTS sessions_watch (

      user_id INTEGER PRIMARY KEY
        REFERENCES users(id)
        ON DELETE CASCADE,

      last_heartbeat BIGINT NOT NULL

    );
  `);


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

    if (username.length < 3 || username.length > 24) {
      return res.status(400).json({
        error: 'Le pseudo doit contenir entre 3 et 24 caractères.'
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
        password_hash
      )
      VALUES ($1, $2, $3)
      RETURNING id, email, username, twitch_id
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
        gameReady
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
        twitch_id
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
        gameReady
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
          t.display_name,
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
            )

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
   CHOIX DE LA CRÉATURE
========================================= */

app.post(
  '/api/creature',
  async (req, res) => {

    try {

      if (!req.session.account || !req.session.user) {

        return res
          .status(401)
          .json({
            error:
              'Connexion Twitch requise'
          });

      }


      if (
        !creatures.some(
          c =>
            c.id ===
            req.body.creatureId
        )
      ) {

        return res
          .status(400)
          .json({
            error:
              'Créature invalide'
          });

      }


      const result =
        await pool.query(
          `
          SELECT
            twitch_id,
            creature_id

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

        return res
          .status(404)
          .json({
            error:
              'Joueur introuvable'
          });

      }


      if (u.creature_id) {

        return res
          .status(400)
          .json({
            error:
              'Créature déjà choisie'
          });

      }


      await pool.query(
        `
        UPDATE users

        SET

          creature_id = $1,

          updated_at =
            CURRENT_TIMESTAMP

        WHERE twitch_id = $2
        `,
        [
          req.body
            .creatureId,

          u.twitch_id
        ]
      );


      res.json({
        ok: true
      });

    }

    catch (error) {

      console.error(
        'Erreur choix créature :',
        error
      );


      res.status(500).json({
        error:
          'Impossible de sauvegarder la créature'
      });

    }

  }
);


/* =========================================
   TEMPS DE VISIONNAGE
========================================= */

app.post(
  '/api/watch/heartbeat',
  async (req, res) => {

    try {

      if (!req.session.account || !req.session.user) {

        return res
          .status(401)
          .json({
            error:
              'Connexion requise'
          });

      }


      const userResult =
        await pool.query(
          `
          SELECT *

          FROM users

          WHERE twitch_id = $1
          `,
          [
            req.session.user
              .twitchId
          ]
        );


      const u =
        userResult.rows[0];


      if (!u?.creature_id) {

        return res
          .status(400)
          .json({
            error:
              'Choisis une créature'
          });

      }


      const now =
        Date.now();


      const previousResult =
        await pool.query(
          `
          SELECT
            last_heartbeat

          FROM sessions_watch

          WHERE user_id = $1
          `,
          [u.id]
        );


      const previous =
        previousResult.rows[0];


      let delta = 0;


      if (previous) {

        delta =
          Math.min(
            Math.max(
              (
                now -
                Number(
                  previous
                    .last_heartbeat
                )
              ) /
              1000,
              0
            ),
            90
          );

      }


      await pool.query(
        `
        INSERT INTO sessions_watch (
          user_id,
          last_heartbeat
        )

        VALUES (
          $1,
          $2
        )

        ON CONFLICT (user_id)

        DO UPDATE SET

          last_heartbeat =
            EXCLUDED.last_heartbeat
        `,
        [
          u.id,
          now
        ]
      );


      const xp =
        delta /
        60 *
        XP_PER_MINUTE *
        (
          u.is_sub
            ? SUB_MULTIPLIER
            : 1
        );


      const points =
        delta /
        60 *
        POINTS_PER_MINUTE;


      await pool.query(
        `
        UPDATE users

        SET

          xp =
            xp + $1,

          points =
            points + $2,

          watch_seconds =
            watch_seconds + $3,

          updated_at =
            CURRENT_TIMESTAMP

        WHERE id = $4
        `,
        [
          xp,
          points,
          Math.floor(delta),
          u.id
        ]
      );


      const updatedResult =
        await pool.query(
          `
          SELECT

            xp,

            points,

            watch_seconds,

            is_sub,

            creature_id

          FROM users

          WHERE id = $1
          `,
          [
            u.id
          ]
        );


      const updated =
        updatedResult.rows[0];


      const stats = {

        ...updated,

        xp:
          Number(updated.xp),

        points:
          Number(updated.points),

        watch_seconds:
          Number(
            updated.watch_seconds
          ),

        progression:
          progressionFromXp(
            updated.xp
          )

      };


      res.json({

        ok: true,

        delta,

        stats

      });

    }

    catch (error) {

      console.error(
        'Erreur heartbeat :',
        error
      );


      res.status(500).json({
        error:
          'Impossible de sauvegarder la progression'
      });

    }

  }
);


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

            twitch_id,

            login,

            display_name,

            is_sub,

            creature_id,

            xp,

            points,

            watch_seconds

          FROM users

          WHERE creature_id
            IS NOT NULL

          ORDER BY

            xp DESC,

            watch_seconds DESC

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
              player.display_name,

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
