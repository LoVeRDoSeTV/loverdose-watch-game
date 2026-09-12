import 'dotenv/config';
import express from 'express';
import session from 'express-session';
import Database from 'better-sqlite3';
import crypto from 'crypto';

const app = express();app.set('trust proxy', 1);
const db = new Database('game.db');
const PORT = Number(process.env.PORT || 3000);
const BASE_URL = process.env.BASE_URL || `http://localhost:${PORT}`;
const CHANNEL = (process.env.TWITCH_CHANNEL || 'loverdosetv').toLowerCase();
const XP_PER_MINUTE = 100 / 60;
const SUB_MULTIPLIER = 1.10;
const POINTS_PER_MINUTE = 10 / 60;

// Progression: 50 levels, with evolutions at 10, 25 and 50.
const LEVEL_XP = [0, 1000, 3500, 10000]; // XP required for levels 1, 10, 25, 50

function progressionFromXp(xp) {
  const value = Math.max(0, Number(xp) || 0);
  let level = 1;
  if (value >= LEVEL_XP[3]) level = 50;
  else if (value >= LEVEL_XP[2]) level = 25 + Math.min(24, Math.floor((value - LEVEL_XP[2]) / ((LEVEL_XP[3] - LEVEL_XP[2]) / 25)));
  else if (value >= LEVEL_XP[1]) level = 10 + Math.min(14, Math.floor((value - LEVEL_XP[1]) / ((LEVEL_XP[2] - LEVEL_XP[1]) / 15)));
  else level = 1 + Math.min(8, Math.floor(value / (LEVEL_XP[1] / 9)));

  let currentThreshold = 0;
  let nextThreshold = LEVEL_XP[1];
  if (level >= 10 && level < 25) {
    currentThreshold = LEVEL_XP[1] + (level - 10) * ((LEVEL_XP[2] - LEVEL_XP[1]) / 15);
    nextThreshold = currentThreshold + ((LEVEL_XP[2] - LEVEL_XP[1]) / 15);
  } else if (level >= 25 && level < 50) {
    currentThreshold = LEVEL_XP[2] + (level - 25) * ((LEVEL_XP[3] - LEVEL_XP[2]) / 25);
    nextThreshold = currentThreshold + ((LEVEL_XP[3] - LEVEL_XP[2]) / 25);
  } else if (level < 10) {
    currentThreshold = (level - 1) * (LEVEL_XP[1] / 9);
    nextThreshold = level * (LEVEL_XP[1] / 9);
  } else {
    currentThreshold = LEVEL_XP[3];
    nextThreshold = LEVEL_XP[3];
  }
  const evolution = level >= 50 ? 3 : level >= 25 ? 2 : level >= 10 ? 1 : 0;
  const evolutionName = ['Forme de départ', 'Évolution 1', 'Évolution 2', 'Forme finale'][evolution];
  return { level, evolution, evolutionName, currentThreshold, nextThreshold, maxLevel: level >= 50 };
}

const creatures = [
  { id:'fire', name:'Flamby', type:'Feu', description:'Petit renard-dragon aux flammes vives.' },
  { id:'water', name:'Nyméa', type:'Eau', description:'Petite créature aquatique mystique.' },
  { id:'plant', name:'Mossy', type:'Plante', description:'Petit hybride écureuil et plante.' },
  { id:'dark', name:'Nocty', type:'Obscur', description:'Petit félin mystérieux lié aux ombres.' },
  { id:'dream', name:'Mimo', type:'Rêve', description:'Petite créature céleste née des rêves.' }
];

db.exec(`CREATE TABLE IF NOT EXISTS users (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 twitch_id TEXT UNIQUE NOT NULL,
 login TEXT NOT NULL,
 display_name TEXT NOT NULL,
 is_sub INTEGER NOT NULL DEFAULT 0,
 creature_id TEXT,
 xp REAL NOT NULL DEFAULT 0,
 points REAL NOT NULL DEFAULT 0,
 watch_seconds INTEGER NOT NULL DEFAULT 0,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);`);

db.exec(`CREATE TABLE IF NOT EXISTS sessions_watch (
 user_id INTEGER PRIMARY KEY,
 last_heartbeat INTEGER NOT NULL,
 FOREIGN KEY(user_id) REFERENCES users(id)
);`);

function twitchAuthUrl(state) {
  const params = new URLSearchParams({
    client_id: process.env.TWITCH_CLIENT_ID,
    redirect_uri: `${BASE_URL}/auth/twitch/callback`,
    response_type: 'code',
    scope: 'user:read:subscriptions',
    state
  });
  return `https://id.twitch.tv/oauth2/authorize?${params}`;
}

async function twitchFetch(path, token, options = {}) {
  const r = await fetch(`https://api.twitch.tv/helix${path}`, {
    ...options,
    headers: { 'Client-Id': process.env.TWITCH_CLIENT_ID, Authorization: `Bearer ${token}`, ...(options.headers || {}) }
  });
  if (!r.ok) throw new Error(`Twitch API ${r.status}: ${await r.text()}`);
  return r.json();
}

app.use(express.json());
app.use(session({ secret: process.env.SESSION_SECRET || 'dev-secret-change-me', resave:false, saveUninitialized:false, cookie:{httpOnly:true,sameSite:'lax',secure:BASE_URL.startsWith('https://')} }));
app.use(express.static('public'));

app.get('/auth/twitch', (req,res) => {
  if (!process.env.TWITCH_CLIENT_ID || !process.env.TWITCH_CLIENT_SECRET) return res.status(500).send('Configure TWITCH_CLIENT_ID et TWITCH_CLIENT_SECRET dans .env');
  const state = crypto.randomBytes(24).toString('hex');
  req.session.oauthState = state;
  res.redirect(twitchAuthUrl(state));
});

app.get('/auth/twitch/callback', async (req,res) => {
  try {
    if (!req.query.code || req.query.state !== req.session.oauthState) return res.status(400).send('OAuth invalide.');
    const tokenRes = await fetch('https://id.twitch.tv/oauth2/token', { method:'POST', headers:{'Content-Type':'application/x-www-form-urlencoded'}, body:new URLSearchParams({client_id:process.env.TWITCH_CLIENT_ID,client_secret:process.env.TWITCH_CLIENT_SECRET,code:req.query.code,grant_type:'authorization_code',redirect_uri:`${BASE_URL}/auth/twitch/callback`}) });
    if (!tokenRes.ok) return res.status(400).send('Impossible de finaliser la connexion Twitch.');
    const tokens = await tokenRes.json();
    const me = await twitchFetch('/users', tokens.access_token);
    const t = me.data[0];
    let isSub = false;
    try { const sub = await twitchFetch(`/subscriptions/user?broadcaster_id=${encodeURIComponent(process.env.TWITCH_BROADCASTER_ID || '')}&user_id=${encodeURIComponent(t.id)}`, tokens.access_token); isSub = !!sub.data?.length; } catch {}
    const existing = db.prepare('SELECT * FROM users WHERE twitch_id=?').get(t.id);
    if (!existing) db.prepare('INSERT INTO users(twitch_id,login,display_name,is_sub) VALUES(?,?,?,?)').run(t.id,t.login,t.display_name,isSub?1:0);
    else db.prepare('UPDATE users SET login=?,display_name=?,is_sub=?,updated_at=CURRENT_TIMESTAMP WHERE twitch_id=?').run(t.login,t.display_name,isSub?1:0,t.id);
    req.session.user = { twitchId:t.id, login:t.login };
    res.redirect('/');
  } catch (e) { console.error(e); res.status(500).send('Erreur de connexion Twitch.'); }
});

app.post('/api/logout',(req,res)=>req.session.destroy(()=>res.json({ok:true})));

app.get('/api/me',(req,res)=>{
  if(!req.session.user) return res.json({authenticated:false});
  const u=db.prepare('SELECT twitch_id,login,display_name,is_sub,creature_id,xp,points,watch_seconds FROM users WHERE twitch_id=?').get(req.session.user.twitchId);
  res.json({authenticated:true,user:{...u, progression:progressionFromXp(u.xp)},creatures});
});

app.post('/api/creature',(req,res)=>{
  if(!req.session.user) return res.status(401).json({error:'Connexion Twitch requise'});
  if(!creatures.some(c=>c.id===req.body.creatureId)) return res.status(400).json({error:'Créature invalide'});
  const u=db.prepare('SELECT * FROM users WHERE twitch_id=?').get(req.session.user.twitchId);
  if(u.creature_id) return res.status(400).json({error:'Créature déjà choisie'});
  db.prepare('UPDATE users SET creature_id=?,updated_at=CURRENT_TIMESTAMP WHERE twitch_id=?').run(req.body.creatureId,u.twitch_id);
  res.json({ok:true});
});

app.post('/api/watch/heartbeat',(req,res)=>{
  if(!req.session.user) return res.status(401).json({error:'Connexion requise'});
  const u=db.prepare('SELECT * FROM users WHERE twitch_id=?').get(req.session.user.twitchId);
  if(!u?.creature_id) return res.status(400).json({error:'Choisis une créature'});
  const now=Date.now();
  const prev=db.prepare('SELECT * FROM sessions_watch WHERE user_id=?').get(u.id);
  let delta=0;
  if(prev){ delta=Math.min(Math.max((now-prev.last_heartbeat)/1000,0),90); }
  db.prepare('INSERT INTO sessions_watch(user_id,last_heartbeat) VALUES(?,?) ON CONFLICT(user_id) DO UPDATE SET last_heartbeat=excluded.last_heartbeat').run(u.id,now);
  // The client only sends heartbeats while the embedded Twitch player is actually playing.
  const xp=delta/60*XP_PER_MINUTE*(u.is_sub?SUB_MULTIPLIER:1);
  const points=delta/60*POINTS_PER_MINUTE;
  db.prepare('UPDATE users SET xp=xp+?,points=points+?,watch_seconds=watch_seconds+?,updated_at=CURRENT_TIMESTAMP WHERE id=?').run(xp,points,Math.floor(delta),u.id);
  const updated=db.prepare('SELECT xp,points,watch_seconds,is_sub,creature_id FROM users WHERE id=?').get(u.id);
  res.json({ok:true,delta,stats:{...updated,progression:progressionFromXp(updated.xp)}});
});
app.get('/api/leaderboard', (req, res) => {
  try {
    const players = db.prepare(`
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
      WHERE creature_id IS NOT NULL
      ORDER BY xp DESC, watch_seconds DESC
      LIMIT 25
    `).all();

    const leaderboard = players.map((player, index) => ({
      rank: index + 1,
      twitch_id: player.twitch_id,
      login: player.login,
      display_name: player.display_name,
      is_sub: Boolean(player.is_sub),
      creature_id: player.creature_id,
      xp: player.xp,
      points: player.points,
      watch_seconds: player.watch_seconds,
      progression: progressionFromXp(player.xp)
    }));

    res.json({
      ok: true,
      leaderboard
    });

  } catch (error) {
    console.error('Erreur classement :', error);

    res.status(500).json({
      error: 'Impossible de charger le classement'
    });
  }
});
app.listen(PORT,()=>console.log(`LoVeRDoSe Watch Game: ${BASE_URL}`));
