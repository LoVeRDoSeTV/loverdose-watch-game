import express from 'express';
import crypto from 'crypto';
import { rateLimit } from 'express-rate-limit';

// Wizebot exécute ce relais via une annonce automatique. Aucun message ni appel
// à un service externe au démarrage ; OFF par défaut et conservé en PostgreSQL.
export async function initWizebotAlerts(pool) {
  await pool.query(`CREATE TABLE IF NOT EXISTS wizebot_alert_settings (
    id SMALLINT PRIMARY KEY CHECK(id=1), enabled BOOLEAN NOT NULL DEFAULT FALSE,
    relay_token TEXT NOT NULL, generation INTEGER NOT NULL DEFAULT 0,
    enabled_at TIMESTAMPTZ, last_poll_at TIMESTAMPTZ, updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`);
  await pool.query(`INSERT INTO wizebot_alert_settings(id,relay_token) VALUES(1,$1) ON CONFLICT(id) DO NOTHING`,[crypto.randomBytes(32).toString('hex')]);
  await pool.query(`CREATE TABLE IF NOT EXISTS wizebot_game_alerts (
    id BIGSERIAL PRIMARY KEY, event_key TEXT UNIQUE NOT NULL, generation INTEGER NOT NULL,
    kind TEXT NOT NULL, user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    payload JSONB, valid_until TIMESTAMPTZ, created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`);
  await pool.query(`CREATE INDEX IF NOT EXISTS wizebot_game_alerts_generation_idx ON wizebot_game_alerts(generation,id)`);
}

function sameToken(expected,provided) {
  const a=Buffer.from(String(expected||'')),b=Buffer.from(String(provided||''));
  return a.length>0 && a.length===b.length && crypto.timingSafeEqual(a,b);
}

export function wizebotRelayScript(baseUrl,token) {
  const endpoint=new URL('/api/wizebot/alerts',baseUrl).href;
  return `// Relais automatique LoVeR Watch Game — ne pas partager ce script.
var cursorKey = 'lwg_alerts_cursor_v351';
var cursor = {};
try { cursor = JSON.parse(JS.wizebot.get_var(cursorKey) || '{}'); } catch (e) {}
var url = ${JSON.stringify(endpoint+'?token='+token)};
url += '&generation=' + (Number(cursor.generation) || 0) + '&after=' + (Number(cursor.id) || 0);
var data = null;
try { data = JSON.parse(JS.wizebot.call_tag('urlcall', [url, 1, 0])); } catch (e) {}
if (data && data.enabled && Array.isArray(data.events)) {
  for (var i = 0; i < data.events.length; i++) {
    var event = data.events[i];
    if (!event.message || JS.wizebot.send_chat_message(event.message) !== true) break;
    JS.wizebot.set_var(cursorKey, JSON.stringify({generation:data.generation, id:event.id}));
  }
}`;
}

export function createWizebotAlerts({pool,getBroadcasterAccount,logAdminAction,baseUrl,eggHatchSeconds}) {
  const router=express.Router();
  let collecting=false;

  async function readyEggs(client) {
    return (await client.query(`SELECT 'egg:'||e.id::text event_key,e.user_id,e.id egg_id,e.slot,u.login
      FROM user_incubator_eggs e JOIN users u ON u.id=e.user_id WHERE e.status='ready'
      UNION ALL
      SELECT 'starter:'||u.id::text||':'||u.created_at::text,u.id,NULL::integer,1,u.login
      FROM users u WHERE u.creature_id IS NULL AND u.watch_seconds >= $1`,[eggHatchSeconds])).rows;
  }

  async function insertAlert(client,settings,key,kind,userId,payload,validUntil=null) {
    await client.query(`INSERT INTO wizebot_game_alerts(event_key,generation,kind,user_id,payload,valid_until)
      VALUES($1,$2,$3,$4,$5::jsonb,$6) ON CONFLICT(event_key) DO NOTHING`,
      [key,settings.generation,kind,userId, payload?JSON.stringify(payload):null,validUntil]);
  }

  async function collectWithClient(client,settings,{baseline=false}={}) {
    const eggs=await readyEggs(client);
    for(const egg of eggs) {
      const login=String(egg.login||'').toLowerCase();
      if(!/^[a-z0-9_]{1,25}$/.test(login))continue;
      await insertAlert(client,settings,egg.event_key,'egg',egg.user_id,baseline?null:{
        message:`🥚 @${login}, ton œuf est prêt à éclore ! ✨ Vite, rejoins LoVeR Watch Game pour découvrir quel Lovys se cache à l’intérieur !`,
        eggId:egg.egg_id,slot:egg.slot
      },baseline?null:new Date(Date.now()+300000));
    }
    if(baseline)return;
    const boosts=(await client.query(`SELECT b.user_id,b.boost_key,b.expires_at,u.login,
      EXTRACT(EPOCH FROM(b.expires_at-CURRENT_TIMESTAMP)) remaining
      FROM user_active_boosts b JOIN users u ON u.id=b.user_id
      WHERE b.boost_key IN ('boost_xp_x2','boost_cash_x2')
        AND b.expires_at>= $1 AND b.expires_at BETWEEN CURRENT_TIMESTAMP-INTERVAL '2 minutes' AND CURRENT_TIMESTAMP+INTERVAL '5 minutes'`,[settings.enabled_at])).rows;
    for(const boost of boosts) {
      const login=String(boost.login||'').toLowerCase();if(!/^[a-z0-9_]{1,25}$/.test(login))continue;
      const remaining=Number(boost.remaining),soon=remaining>0;
      const label=boost.boost_key==='boost_xp_x2'?'double XP':"boost LoVeR’Cash ×2";
      const duration=Math.max(1,Math.ceil(remaining/60));
      await insertAlert(client,settings,`${soon?'boost-soon':'boost-end'}:${boost.user_id}:${boost.boost_key}:${new Date(boost.expires_at).toISOString()}`,
        soon?'boost-soon':'boost-end',boost.user_id,{
          message:soon?`⏳ @${login}, ton ${label} se termine dans ${duration} min !`:`⌛ @${login}, ton ${label} est terminé.`,
          boostKey:boost.boost_key,expiresAt:new Date(boost.expires_at).toISOString()
        },new Date(soon?boost.expires_at:Date.now()+120000));
    }
    const global=(await client.query(`SELECT * FROM admin_live_boosts WHERE id=1
      AND expires_at >= $1 AND expires_at BETWEEN CURRENT_TIMESTAMP-INTERVAL '2 minutes' AND CURRENT_TIMESTAMP+INTERVAL '5 minutes'
      AND (xp_multiplier>1 OR cash_multiplier>1 OR global_xp_multiplier>1)`,[settings.enabled_at])).rows[0];
    if(global) {
      const remaining=(new Date(global.expires_at)-Date.now())/1000,soon=remaining>0;
      const names=[];if(Number(global.xp_multiplier)>1)names.push(`XP Lovys ×${Number(global.xp_multiplier)}`);
      if(Number(global.cash_multiplier)>1)names.push(`LoVeR’Cash ×${Number(global.cash_multiplier)}`);
      if(Number(global.global_xp_multiplier)>1)names.push(`XP globale ×${Number(global.global_xp_multiplier)}`);
      await insertAlert(client,settings,`live-${soon?'soon':'end'}:${new Date(global.expires_at).toISOString()}`,
        'live-boost',null,{message:soon?`⏳ Le boost du live (${names.join(', ')}) se termine dans ${Math.max(1,Math.ceil(remaining/60))} min !`:`⌛ Le boost du live (${names.join(', ')}) est terminé.`,expiresAt:new Date(global.expires_at).toISOString(),soon},
        new Date(soon?global.expires_at:Date.now()+120000));
    }
  }

  async function collect() {
    if(collecting)return;collecting=true;let client;
    try {
      // OFF : une seule lecture, aucun accès aux ressources des joueurs.
      const state=(await pool.query('SELECT enabled FROM wizebot_alert_settings WHERE id=1')).rows[0];
      if(!state?.enabled)return;
      client=await pool.connect();await client.query('BEGIN');
      const locked=(await client.query('SELECT pg_try_advisory_xact_lock(351001) locked')).rows[0]?.locked;
      if(!locked){await client.query('ROLLBACK');return;}
      const settings=(await client.query('SELECT * FROM wizebot_alert_settings WHERE id=1 FOR SHARE')).rows[0];
      const live=(await client.query(`SELECT 1 FROM twitch_tracker_auth WHERE id=1 AND last_live=TRUE
        AND last_error IS NULL AND last_success_at>CURRENT_TIMESTAMP-INTERVAL '90 seconds'`)).rowCount;
      if(settings?.enabled&&live)await collectWithClient(client,settings);
      await client.query('COMMIT');
    } catch(error) {
      if(client)try{await client.query('ROLLBACK');}catch{}
      console.error('Alertes Wizebot : collecte indisponible.');
    } finally {client?.release();collecting=false;}
  }

  async function adminOnly(req,res,next) {
    try {const account=await getBroadcasterAccount(req);if(!account)return res.status(403).json({error:'Accès réservé au diffuseur.'});req.wizebotAdmin=account;next();}
    catch {res.status(500).json({error:'Vérification admin indisponible.'});}
  }
  router.use('/admin/wizebot',adminOnly,(req,res,next)=>{res.set('Cache-Control','no-store');next();});
  router.get('/admin/wizebot',async(req,res)=>{
    try {
      const settings=(await pool.query('SELECT * FROM wizebot_alert_settings WHERE id=1')).rows[0];
      const recent=(await pool.query(`SELECT payload->>'message' message,created_at FROM wizebot_game_alerts
        WHERE payload IS NOT NULL AND generation=$1 ORDER BY id DESC LIMIT 5`,[settings.generation])).rows;
      res.json({ok:true,enabled:settings.enabled,lastPollAt:settings.last_poll_at,
        script:wizebotRelayScript(baseUrl,settings.relay_token),recent,
        examples:['🥚 @joueur, ton œuf est prêt à éclore ! ✨ Vite, rejoins LoVeR Watch Game pour découvrir quel Lovys se cache à l’intérieur !',
          '⏳ @joueur, ton double XP se termine dans 5 min !','⌛ @joueur, ton double XP est terminé.']});
    }catch {res.status(500).json({error:'Impossible de charger Wizebot.'});}
  });
  router.patch('/admin/wizebot',async(req,res)=>{
    if(typeof req.body?.enabled!=='boolean')return res.status(400).json({error:'Choisis ON ou OFF.'});
    const client=await pool.connect();
    try {
      await client.query('BEGIN');const before=(await client.query('SELECT * FROM wizebot_alert_settings WHERE id=1 FOR UPDATE')).rows[0];
      const enabled=req.body.enabled;
      if(enabled!==before.enabled) {
        const settings=(await client.query(`UPDATE wizebot_alert_settings SET enabled=$1,generation=generation+1,
          enabled_at=CASE WHEN $1 THEN CURRENT_TIMESTAMP ELSE NULL END,updated_at=CURRENT_TIMESTAMP WHERE id=1 RETURNING *`,[enabled])).rows[0];
        if(enabled)await collectWithClient(client,settings,{baseline:true});
        await logAdminAction(req.wizebotAdmin.id,null,'wizebot_alerts',`Alertes du jeu Wizebot ${enabled?'ON':'OFF'}`,{enabled},client);
      }
      await client.query('COMMIT');res.json({ok:true,enabled,message:enabled?'Alertes automatiques ON. Le relais Wizebot doit être installé.':'Alertes automatiques OFF. Aucun nouveau message du jeu ne sera fourni au relais.'});
    }catch {try{await client.query('ROLLBACK');}catch{}res.status(500).json({error:'Impossible de modifier Wizebot.'});}
    finally {client.release();}
  });

  router.post('/admin/wizebot/test',async(req,res)=>{
    let client;
    try {
      client=await pool.connect();
      await client.query('BEGIN');
      const settings=(await client.query('SELECT * FROM wizebot_alert_settings WHERE id=1 FOR UPDATE')).rows[0];
      const recent=(await client.query(`SELECT 1 FROM wizebot_game_alerts WHERE kind='test'
        AND created_at>CURRENT_TIMESTAMP-INTERVAL '15 seconds' LIMIT 1`)).rowCount;
      if(recent){await client.query('ROLLBACK');return res.status(429).json({error:'Attends 15 secondes avant de préparer un autre test.'});}
      const message='🧪 Test LoVeR Watch Game : les alertes Wizebot fonctionnent ! 🥚✨';
      await insertAlert(client,settings,'test:'+crypto.randomUUID(),'test',req.wizebotAdmin.id,{message},new Date(Date.now()+120000));
      await logAdminAction(req.wizebotAdmin.id,null,'wizebot_test','Préparer un message de test dans le chat Twitch',{},client);
      await client.query('COMMIT');
      res.json({ok:true,message:'Test prêt pendant 2 minutes. Hors live, tape !lwg_alertes dans le chat Twitch pour le recevoir. En live, le prochain passage automatique peut aussi le récupérer.'});
    }catch {if(client)try{await client.query('ROLLBACK');}catch{}res.status(500).json({error:'Impossible de préparer le message de test.'});}
    finally {client?.release();}
  });

  const relayLimit=rateLimit({windowMs:60000,limit:30,standardHeaders:'draft-7',legacyHeaders:false,message:{enabled:false,events:[]}});
  router.get('/wizebot/alerts',relayLimit,async(req,res)=>{
    res.set('Cache-Control','no-store');
    try {
      const settings=(await pool.query('SELECT * FROM wizebot_alert_settings WHERE id=1')).rows[0];
      if(!sameToken(settings?.relay_token,req.query.token))return res.status(403).json({enabled:false,events:[]});
      await pool.query('UPDATE wizebot_alert_settings SET last_poll_at=CURRENT_TIMESTAMP WHERE id=1');
      const live=(await pool.query(`SELECT 1 FROM twitch_tracker_auth WHERE id=1 AND last_live=TRUE
        AND last_error IS NULL AND last_success_at>CURRENT_TIMESTAMP-INTERVAL '90 seconds'`)).rowCount;
      const automaticEnabled=Boolean(settings.enabled&&live);
      const after=Number(req.query.generation)===settings.generation&&/^\d{1,15}$/.test(String(req.query.after||''))?Number(req.query.after):0;
      const events=(await pool.query(`SELECT n.id,n.kind,n.payload FROM wizebot_game_alerts n
        WHERE n.generation=$1 AND n.id>$2 AND n.payload IS NOT NULL
          AND (n.kind='test' OR ($4::boolean AND EXISTS(SELECT 1 FROM wizebot_alert_settings s WHERE s.id=1 AND s.enabled=TRUE AND s.generation=n.generation))) AND n.valid_until>CURRENT_TIMESTAMP
          AND n.created_at>CURRENT_TIMESTAMP-INTERVAL '5 minutes'
          AND (n.kind<>'egg' OR (n.payload->>'eggId' IS NULL AND EXISTS(SELECT 1 FROM users u WHERE u.id=n.user_id AND u.creature_id IS NULL AND u.watch_seconds >= $3))
            OR EXISTS(SELECT 1 FROM user_incubator_eggs e WHERE e.id::text=n.payload->>'eggId' AND e.status='ready'))
          AND (n.kind NOT IN ('boost-soon','boost-end') OR EXISTS(SELECT 1 FROM user_active_boosts b WHERE b.user_id=n.user_id
            AND b.boost_key=n.payload->>'boostKey' AND b.expires_at=(n.payload->>'expiresAt')::timestamptz))
          AND (n.kind<>'live-boost' OR EXISTS(SELECT 1 FROM admin_live_boosts b WHERE b.id=1 AND b.expires_at=(n.payload->>'expiresAt')::timestamptz))
        ORDER BY n.id LIMIT 3`,[settings.generation,after,eggHatchSeconds,automaticEnabled])).rows;
      res.json({enabled:automaticEnabled||events.length>0,generation:settings.generation,events:events.map(e=>{
        let message=e.payload.message;
        if(e.kind==='boost-soon'||(e.kind==='live-boost'&&e.payload.soon)){
          const minutes=Math.max(1,Math.ceil((new Date(e.payload.expiresAt)-Date.now())/60000));
          message=message.replace(/dans \d+ min/,`dans ${minutes} min`);
        }
        return {id:Number(e.id),message};
      })});
    } catch {res.status(503).json({enabled:false,events:[]});}
  });
  return {router,collect};
}
