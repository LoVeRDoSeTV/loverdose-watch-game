import express from 'express';
import {initDropSchedule,advanceDropSchedule,validateDropSchedule} from '../game-bot-schedule.js';
import {botMessageTemplates,validateBotMessage,renderBotMessage} from '../game-bot-messages.js';
import crypto from 'node:crypto';
import {chatCommandName,validateChatCommand,initChatCommands,enqueueChatCommand,deliverChatCommands} from '../game-bot-commands.js';
import {validOAuthCallback} from '../middleware/security.js';

export function isGameBotCallback(query,session){
  return typeof query.state==='string'&&typeof session.gameBotOauthState==='string'&&session.gameBotOauthState.length>0&&query.state===session.gameBotOauthState;
}

const rewards=[
  {key:'cash',weight:50,label:"20 LoVeR’Cash",icon:'💰'},
  {key:'fragments',weight:25,label:'2 fragments d’œuf',icon:'🧩'},
  {key:'xp',weight:20,label:'une bouteille de 100 XP',icon:'🧪'},
  {key:'egg',weight:5,label:'un œuf mystère',icon:'🥚'}
];
export function chooseDropReward(random=crypto.randomInt){let n=random(100);for(const r of rewards){if(n<r.weight)return r;n-=r.weight;}return rewards[0];}
export function chooseWinnerCount(random=crypto.randomInt){const n=random(100);return n<70?1:n<95?2:3;}
export function verifyEventSub(headers,raw,secret,now=Date.now()){
  const id=String(headers['twitch-eventsub-message-id']||''),timestamp=String(headers['twitch-eventsub-message-timestamp']||'');
  const signature=String(headers['twitch-eventsub-message-signature']||'');
  if(!id||!timestamp||!secret||!Number.isFinite(Date.parse(timestamp))||Math.abs(now-Date.parse(timestamp))>600000)return false;
  const expected='sha256='+crypto.createHmac('sha256',secret).update(id+timestamp).update(raw).digest('hex');
  const a=Buffer.from(expected),b=Buffer.from(signature);
  return a.length===b.length&&crypto.timingSafeEqual(a,b);
}
export async function initGameBot(pool){
  await initDropSchedule(pool);
  await pool.query(`CREATE TABLE IF NOT EXISTS game_bot_auth (
    id SMALLINT PRIMARY KEY CHECK(id=1),twitch_user_id TEXT NOT NULL,login TEXT NOT NULL,
    access_token_enc TEXT NOT NULL,refresh_token_enc TEXT NOT NULL,expires_at TIMESTAMPTZ,
    webhook_secret TEXT NOT NULL,subscription_id TEXT,enabled BOOLEAN NOT NULL DEFAULT FALSE,
    last_error TEXT,alert_cursor BIGINT NOT NULL DEFAULT 0,updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP)`);
  await pool.query(`CREATE TABLE IF NOT EXISTS game_bot_message_templates (key TEXT PRIMARY KEY,label TEXT NOT NULL,text TEXT NOT NULL,updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP)`);
  await pool.query(`CREATE TABLE IF NOT EXISTS game_bot_messages (id BIGSERIAL PRIMARY KEY,kind TEXT NOT NULL,message TEXT NOT NULL,status TEXT NOT NULL,error TEXT,created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP)`);
  await pool.query('ALTER TABLE game_bot_auth ADD COLUMN IF NOT EXISTS alert_cursor BIGINT NOT NULL DEFAULT 0');
  await initChatCommands(pool);
  await pool.query(`CREATE TABLE IF NOT EXISTS game_bot_drops (
    id BIGSERIAL PRIMARY KEY,reward_key TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'pending',
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,started_at TIMESTAMPTZ,
    ends_at TIMESTAMPTZ,settled_at TIMESTAMPTZ)`);
  await pool.query("CREATE UNIQUE INDEX IF NOT EXISTS game_bot_one_drop_idx ON game_bot_drops ((1)) WHERE status IN ('pending','open')");
  await pool.query(`CREATE TABLE IF NOT EXISTS game_bot_entries (
    drop_id BIGINT NOT NULL REFERENCES game_bot_drops(id),twitch_id TEXT NOT NULL,
    account_id INTEGER NOT NULL REFERENCES accounts(id),user_id INTEGER NOT NULL REFERENCES users(id),
    entered_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,PRIMARY KEY(drop_id,twitch_id))`);
  await pool.query(`CREATE TABLE IF NOT EXISTS game_bot_event_ids (
    id TEXT PRIMARY KEY,received_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP)`);
}
export function createGameBot({pool,baseUrl,getBroadcasterAccount,encrypt,decrypt,saveSession,logAdminAction}){
  const router=express.Router();
  const channelId=String(process.env.TWITCH_BROADCASTER_ID||'');
  const clientId=String(process.env.TWITCH_CLIENT_ID||'');
  const clientSecret=String(process.env.TWITCH_CLIENT_SECRET||'');
  const redirectUri=new URL('/auth/twitch/callback',baseUrl).href;
  const webhookUrl=new URL('/api/game-bot/eventsub',baseUrl).href;
  let ticking=false;
  async function botRow(){return (await pool.query('SELECT * FROM game_bot_auth WHERE id=1')).rows[0];}
  async function accessToken(){
    const row=await botRow();if(!row)throw new Error('Connecte le compte du bot Twitch.');
    if(new Date(row.expires_at||0).getTime()>Date.now()+120000)return decrypt(row.access_token_enc);
    const response=await fetch('https://id.twitch.tv/oauth2/token',{method:'POST',signal:AbortSignal.timeout(15000),body:new URLSearchParams({client_id:clientId,client_secret:clientSecret,grant_type:'refresh_token',refresh_token:decrypt(row.refresh_token_enc)})});
    if(!response.ok)throw new Error(`Renouvellement Twitch refusé (${response.status}).`);
    const tokens=await response.json();
    await pool.query(`UPDATE game_bot_auth SET access_token_enc=$1,refresh_token_enc=$2,expires_at=$3,updated_at=CURRENT_TIMESTAMP WHERE id=1`,
      [encrypt(tokens.access_token),encrypt(tokens.refresh_token||decrypt(row.refresh_token_enc)),new Date(Date.now()+tokens.expires_in*1000)]);
    return tokens.access_token;
  }
  async function messageText(key,values={}){
    const saved=(await pool.query('SELECT text FROM game_bot_message_templates WHERE key=$1',[key])).rows[0];
    return renderBotMessage(saved?.text||botMessageTemplates[key].text,values);
  }
  async function send(message,kind='announcement',{allowDisabled=false}={}){
    try {
      const bot=await botRow();if(!bot)throw new Error('Connecte le compte du bot Twitch.');
      if(!bot.enabled&&!allowDisabled)throw new Error('Bot désactivé.');
      const token=await accessToken();
      const response=await fetch('https://api.twitch.tv/helix/chat/messages',{method:'POST',signal:AbortSignal.timeout(15000),headers:{Authorization:`Bearer ${token}`,'Client-Id':clientId,'Content-Type':'application/json'},body:JSON.stringify({broadcaster_id:channelId,sender_id:bot.twitch_user_id,message})});
      const result=await response.json().catch(()=>({}));
      if(!response.ok||result.data?.[0]?.is_sent!==true){
        const reason=result.data?.[0]?.drop_reason;
        const detail=reason?.message||result.message||'Twitch n’a pas confirmé l’envoi du message.';
        const hint=response.status===401?' Reconnecte le compte bot pour renouveler ses autorisations.':response.status===403?' Vérifie que le compte bot peut écrire dans le chat de la chaîne.':'';
        throw new Error(`Message Twitch refusé (${response.status}${reason?.code?' · '+reason.code:''}) : ${detail}${hint}`);
      }
      await recordMessage(kind,message,'sent');
      if(bot.last_error)await pool.query('UPDATE game_bot_auth SET last_error=NULL WHERE id=1').catch(()=>{});
    } catch(error) {
      await recordMessage(kind,message,'failed',String(error.message||error));
      throw error;
    }
  }
  async function recordMessage(kind,message,status,error=null){
    // Un journal indisponible ne doit pas faire renvoyer un message déjà envoyé.
    try {
      await pool.query('INSERT INTO game_bot_messages(kind,message,status,error) VALUES($1,$2,$3,$4)',[kind,String(message).slice(0,2000),status,error?.slice(0,500)||null]);
      await pool.query('DELETE FROM game_bot_messages WHERE id <= (SELECT id FROM game_bot_messages ORDER BY id DESC OFFSET 500 LIMIT 1) AND id < (SELECT MAX(id) FROM game_bot_messages)');
    } catch(error) {console.warn('Journal du bot indisponible :',error.message);}
  }
  async function subscribe(){
    const bot=await botRow();if(!bot)throw new Error('Connecte le bot.');
    const appResponse=await fetch('https://id.twitch.tv/oauth2/token',{method:'POST',body:new URLSearchParams({client_id:clientId,client_secret:clientSecret,grant_type:'client_credentials'})});
    if(!appResponse.ok)throw new Error('Jeton application Twitch indisponible.');
    const appToken=(await appResponse.json()).access_token;
    const response=await fetch('https://api.twitch.tv/helix/eventsub/subscriptions',{method:'POST',headers:{Authorization:`Bearer ${appToken}`,'Client-Id':clientId,'Content-Type':'application/json'},body:JSON.stringify({type:'channel.chat.message',version:'1',condition:{broadcaster_user_id:channelId,user_id:bot.twitch_user_id},transport:{method:'webhook',callback:webhookUrl,secret:bot.webhook_secret}})});
    const data=await response.json().catch(()=>({}));
    if(!response.ok&&response.status!==409)throw new Error(`Abonnement au chat refusé (${response.status}) : ${data.message||'vérifie que le bot est modérateur.'}`);
    if(response.status===409){
      const listResponse=await fetch('https://api.twitch.tv/helix/eventsub/subscriptions?type=channel.chat.message',{headers:{Authorization:`Bearer ${appToken}`,'Client-Id':clientId}});
      const list=await listResponse.json();
      data.data=(list.data||[]).filter(item=>item.condition?.user_id===bot.twitch_user_id&&item.condition?.broadcaster_user_id===channelId&&item.transport?.callback===webhookUrl&&['enabled','webhook_callback_verification_pending'].includes(item.status));
    }
    if(!data.data?.[0]?.id)throw new Error('Abonnement au chat introuvable : reconnecte le bot.');
    await pool.query('UPDATE game_bot_auth SET subscription_id=$1,last_error=NULL WHERE id=1',[data.data[0].id]);
    return data;
  }
  router.get('/game-bot/connect',async(req,res)=>{
    const admin=await getBroadcasterAccount(req);if(!admin)return res.status(403).send('Accès réservé au diffuseur.');
    const state=crypto.randomBytes(24).toString('hex');req.session.gameBotOauthState=state;req.session.gameBotOauthStateStartedAt=Date.now();await saveSession(req);
    res.redirect('https://id.twitch.tv/oauth2/authorize?'+new URLSearchParams({client_id:clientId,redirect_uri:redirectUri,response_type:'code',scope:'user:read:chat user:write:chat user:bot',force_verify:'true',state}));
  });
  async function handleCallback(req,res){
    try{
      const admin=await getBroadcasterAccount(req);
      if(!admin||!validOAuthCallback(req.query,req.session,'gameBotOauthState'))return res.status(400).send('Connexion du bot expirée ou invalide. Relance-la depuis Administration → Bot.');
      delete req.session.gameBotOauthState;delete req.session.gameBotOauthStateStartedAt;await saveSession(req);
      const response=await fetch('https://id.twitch.tv/oauth2/token',{method:'POST',body:new URLSearchParams({client_id:clientId,client_secret:clientSecret,code:String(req.query.code),grant_type:'authorization_code',redirect_uri:redirectUri})});
      if(!response.ok)throw new Error('Autorisation Twitch refusée.');
      const tokens=await response.json();
      const userResponse=await fetch('https://api.twitch.tv/helix/users',{headers:{Authorization:`Bearer ${tokens.access_token}`,'Client-Id':clientId}});
      const bot=(await userResponse.json()).data?.[0];
      if(!bot||bot.id===channelId)throw new Error('Connecte un compte Twitch distinct de celui de la chaîne.');
      const previous=await botRow();
      await pool.query(`INSERT INTO game_bot_auth(id,twitch_user_id,login,access_token_enc,refresh_token_enc,expires_at,webhook_secret,enabled)
        VALUES(1,$1,$2,$3,$4,$5,$6,FALSE) ON CONFLICT(id) DO UPDATE SET twitch_user_id=$1,login=$2,access_token_enc=$3,refresh_token_enc=$4,expires_at=$5,webhook_secret=$6,subscription_id=NULL,enabled=FALSE,last_error=NULL,updated_at=CURRENT_TIMESTAMP`,
        [bot.id,bot.login,encrypt(tokens.access_token),encrypt(tokens.refresh_token),new Date(Date.now()+tokens.expires_in*1000),previous?.twitch_user_id===bot.id?previous.webhook_secret:crypto.randomBytes(32).toString('hex')]);
      await pool.query('UPDATE game_bot_drop_schedule SET next_at=NULL WHERE id=1');
      try{await subscribe();}catch(error){await pool.query('UPDATE game_bot_auth SET last_error=$1 WHERE id=1',[error.message]);}
      res.redirect('/?gameBot=connected');
    }catch(error){res.status(500).send(`Connexion du bot impossible : ${error.message}`);}
  }
  router.get('/game-bot/callback',handleCallback);
  router.post('/game-bot/eventsub',async(req,res)=>{
    try{
      const row=await botRow(),raw=req.rawEventSubBody;
      if(!raw||!verifyEventSub(req.headers,raw,row?.webhook_secret))return res.sendStatus(403);
      const event=req.body,type=req.headers['twitch-eventsub-message-type'];
      if(type==='webhook_callback_verification')return res.type('text/plain').send(event.challenge);
      if(type==='revocation'){
        await pool.query("UPDATE game_bot_auth SET subscription_id=NULL,enabled=FALSE,last_error='Abonnement Twitch révoqué : reconnecte le bot.' WHERE id=1 AND subscription_id=$1",[event.subscription?.id]);
        return res.sendStatus(204);
      }
      if(type!=='notification'||event.subscription?.type!=='channel.chat.message')return res.sendStatus(204);
      const chat=event.event,name=chatCommandName(chat?.message?.text);
      if(chat?.broadcaster_user_id!==channelId||!name||chat.chatter_user_id===row.twitch_user_id||!row.enabled)return res.sendStatus(204);
      const id=String(req.headers['twitch-eventsub-message-id']);
      const client=await pool.connect();try{
        await client.query('BEGIN');
        const seen=await client.query('INSERT INTO game_bot_event_ids(id) VALUES($1) ON CONFLICT DO NOTHING RETURNING id',[id]);
        if(seen.rowCount&&name!=='!catch')await enqueueChatCommand(client,name,chat,id);
        if(seen.rowCount&&name==='!catch'&&chat.message.text.trim().toLowerCase()==='!catch'){
          const round=(await client.query("SELECT * FROM game_bot_drops WHERE status='open' FOR UPDATE")).rows[0];
          if(round&&new Date(round.ends_at)>new Date()){
            const player=(await client.query('SELECT a.id account_id,u.id user_id FROM accounts a JOIN users u ON u.twitch_id=a.twitch_id WHERE a.twitch_id=$1 LIMIT 1',[event.event.chatter_user_id])).rows[0];
            if(player)await client.query('INSERT INTO game_bot_entries(drop_id,twitch_id,account_id,user_id) VALUES($1,$2,$3,$4) ON CONFLICT(drop_id,twitch_id) DO NOTHING',[round.id,event.event.chatter_user_id,player.account_id,player.user_id]);
          }
        }
        await client.query('COMMIT');
      }catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
      res.sendStatus(204);
    }catch{res.sendStatus(503);}
  });
  async function settle(client,round){
    const entries=(await client.query(`SELECT e.* FROM game_bot_entries e JOIN accounts a ON a.id=e.account_id AND a.twitch_id=e.twitch_id
      JOIN users u ON u.id=e.user_id AND u.twitch_id=e.twitch_id WHERE e.drop_id=$1`,[round.id])).rows;
    const shuffled=entries.map(entry=>({entry,sort:crypto.randomInt(0x7fffffff)})).sort((a,b)=>a.sort-b.sort);
    const winners=shuffled.slice(0,Math.min(entries.length,chooseWinnerCount())).map(item=>item.entry);
    for(const winner of winners){
      if(round.reward_key==='cash')await client.query('UPDATE users SET points=points+20,lifetime_lovercash_earned=lifetime_lovercash_earned+20,updated_at=CURRENT_TIMESTAMP WHERE id=$1',[winner.user_id]);
      else if(round.reward_key==='fragments')await client.query('UPDATE users SET egg_fragments=egg_fragments+2,updated_at=CURRENT_TIMESTAMP WHERE id=$1',[winner.user_id]);
      else await client.query(`INSERT INTO shop_inventory(account_id,item_key,quantity) VALUES($1,$2,1)
        ON CONFLICT(account_id,item_key) DO UPDATE SET quantity=shop_inventory.quantity+1,purchased_at=CURRENT_TIMESTAMP`,[winner.account_id,round.reward_key==='egg'?'mystery_egg':'xp_bottle_100']);
    }
    const names=winners.length?(await client.query('SELECT twitch_id,login FROM users WHERE twitch_id=ANY($1::text[])',[winners.map(w=>w.twitch_id)])).rows:[];
    const byId=new Map(names.map(row=>[row.twitch_id,row.login]));
    const mentions=winners.map(w=>`@${String(byId.get(w.twitch_id)||'joueur').replace(/[^a-zA-Z0-9_]/g,'')}`).join(', ');
    await client.query("UPDATE game_bot_drops SET status='settled',settled_at=CURRENT_TIMESTAMP WHERE id=$1",[round.id]);
    return messageText(winners.length?'winners':'empty',{gagnants:mentions,recompense:rewards.find(r=>r.key===round.reward_key).label});
  }
  async function tick(){if(ticking)return;ticking=true;let client;try{
    const bot=await botRow();if(!bot?.enabled)return;
    client=await pool.connect();await client.query('BEGIN');
    const live=!!(await client.query("SELECT 1 FROM twitch_tracker_auth WHERE id=1 AND last_live=TRUE AND last_error IS NULL AND last_success_at>CURRENT_TIMESTAMP-INTERVAL '90 seconds'")).rowCount;
    await advanceDropSchedule(client,{live,chooseReward:chooseDropReward});
    const round=(await client.query("SELECT * FROM game_bot_drops WHERE status IN ('pending','open') FOR UPDATE")).rows[0];
    if(!round){await client.query('COMMIT');await deliverGameAlerts();return;}
    if(round.status==='pending'){
      const reward=rewards.find(r=>r.key===round.reward_key);
      await send(await messageText('drop',{recompense:reward.label}),'drop');
      await client.query("UPDATE game_bot_drops SET status='open',started_at=CURRENT_TIMESTAMP,ends_at=CURRENT_TIMESTAMP+INTERVAL '60 seconds' WHERE id=$1",[round.id]);
    }else if(new Date(round.ends_at)<=new Date()){
      const message=await settle(client,round);await send(message,'winners');
      await advanceDropSchedule(client,{live,chooseReward:chooseDropReward});
    }
    await client.query('COMMIT');
    await deliverGameAlerts();
  }catch(error){if(client)try{await client.query('ROLLBACK');}catch{};await pool.query('UPDATE game_bot_auth SET last_error=$1 WHERE id=1',[String(error.message||error).slice(0,240)]).catch(()=>{});console.error('Bot du jeu :',error.message);}finally{client?.release();ticking=false;}}
  async function deliverGameAlerts(){
    const bot=await botRow();if(!bot?.enabled)return;
    await deliverChatCommands(pool,send);
    const rows=(await pool.query(`SELECT id,kind,payload,payload->>'message' message,(SELECT login FROM users WHERE id=n.user_id) login FROM wizebot_game_alerts n
      WHERE id>$1 AND kind<>'test' AND payload IS NOT NULL AND valid_until>CURRENT_TIMESTAMP
        AND (n.kind<>'egg' OR (n.payload->>'eggId' IS NULL AND EXISTS(SELECT 1 FROM users u WHERE u.id=n.user_id AND u.creature_id IS NULL))
          OR EXISTS(SELECT 1 FROM user_incubator_eggs e WHERE e.id::text=n.payload->>'eggId' AND e.status='ready'))
        AND (n.kind NOT IN ('boost-soon','boost-end') OR EXISTS(SELECT 1 FROM user_active_boosts b WHERE b.user_id=n.user_id
          AND b.boost_key=n.payload->>'boostKey' AND b.expires_at=(n.payload->>'expiresAt')::timestamptz))
        AND (n.kind<>'live-boost' OR EXISTS(SELECT 1 FROM admin_live_boosts b WHERE b.id=1 AND b.expires_at=(n.payload->>'expiresAt')::timestamptz))
      ORDER BY id LIMIT 3`,[bot.alert_cursor])).rows;
    for(const row of rows){
      let text=row.message;
      const payload=row.payload||{},minutes=Math.max(1,Math.ceil((Date.parse(payload.expiresAt)-Date.now())/60000));
      if(['egg','boost-soon','boost-end'].includes(row.kind))text=await messageText(row.kind,{joueur:'@'+String(row.login||'joueur').replace(/[^a-zA-Z0-9_]/g,''),boost:payload.boostKey==='boost_xp_x2'?'double XP':'boost LoVeR’Cash ×2',minutes});
      else if(row.kind==='live-boost')text=await messageText(payload.soon?'live-soon':'live-end',{boost:payload.boostLabel||row.message.match(/\((.*?)\)/)?.[1]||'bonus du live',minutes});
      await send(text,row.kind);
      await pool.query('UPDATE game_bot_auth SET alert_cursor=GREATEST(alert_cursor,$1) WHERE id=1',[row.id]);
    }
    // Les anciens messages expirés ne doivent pas bloquer le curseur.
    if(!rows.length)await pool.query(`UPDATE game_bot_auth SET alert_cursor=GREATEST(alert_cursor,
      COALESCE((SELECT MAX(id) FROM wizebot_game_alerts WHERE valid_until<CURRENT_TIMESTAMP),0)) WHERE id=1`);
  }
  router.get('/admin/game-bot',async(req,res)=>{try{
    if(!await getBroadcasterAccount(req))return res.sendStatus(403);
    const bot=await botRow();
    const schedule=(await pool.query('SELECT * FROM game_bot_drop_schedule WHERE id=1')).rows[0];
    const live=!!(await pool.query("SELECT 1 FROM twitch_tracker_auth WHERE id=1 AND last_live=TRUE AND last_error IS NULL AND last_success_at>CURRENT_TIMESTAMP-INTERVAL '90 seconds'")).rowCount;
    const round=(await pool.query(`SELECT d.id,d.reward_key,d.status,d.started_at,d.ends_at,(SELECT COUNT(*)::int FROM game_bot_entries e WHERE e.drop_id=d.id) participants FROM game_bot_drops d ORDER BY d.id DESC LIMIT 1`)).rows[0];
    const saved=(await pool.query('SELECT key,label,text FROM game_bot_message_templates ORDER BY key')).rows;
    const templates=Object.entries(botMessageTemplates).map(([key,value])=>({key,...value,text:saved.find(row=>row.key===key)?.text||value.text,custom:false})).concat(saved.filter(row=>!Object.hasOwn(botMessageTemplates,row.key)).map(row=>({...row,variables:[],custom:true})));
    const commands=(await pool.query('SELECT id,name,text,enabled,cooldown_seconds FROM game_bot_commands ORDER BY name')).rows;
    const messages=(await pool.query('SELECT id,kind,message,status,error,created_at FROM game_bot_messages ORDER BY id DESC LIMIT 50')).rows;
    res.set('Cache-Control','no-store').json({connected:!!bot,enabled:!!bot?.enabled,login:bot?.login,subscriptionId:bot?.subscription_id,error:bot?.last_error,round,messages,templates,commands,schedule,live,serverTime:new Date().toISOString()});
  }catch{res.status(500).json({error:'Bot indisponible.'});}});
  router.post('/admin/game-bot/commands',async(req,res)=>{
    try{
      if(!await getBroadcasterAccount(req))return res.sendStatus(403);
      const c=validateChatCommand(req.body);
      if(c.id){
        const updated=await pool.query('UPDATE game_bot_commands SET name=$2,text=$3,enabled=$4,cooldown_seconds=$5,updated_at=CURRENT_TIMESTAMP WHERE id=$1 RETURNING id',[c.id,c.name,c.text,c.enabled,c.cooldownSeconds]);
        if(!updated.rows.length)return res.status(404).json({error:'Commande introuvable.'});
        // Replies waiting for an older version must not be sent after editing or disabling.
        await pool.query('DELETE FROM game_bot_command_queue WHERE command_id=$1',[c.id]);
      }else await pool.query('INSERT INTO game_bot_commands(name,text,enabled,cooldown_seconds) VALUES($1,$2,$3,$4)',[c.name,c.text,c.enabled,c.cooldownSeconds]);
      res.json({ok:true,message:'Commande enregistrée.'});
    }catch(error){res.status(error.code==='23505'?409:400).json({error:error.code==='23505'?'Cette commande existe déjà.':error.message});}
  });
  router.post('/admin/game-bot/commands/delete',async(req,res)=>{
    try{
      if(!await getBroadcasterAccount(req))return res.sendStatus(403);
      const id=Number(req.body?.id);if(!Number.isSafeInteger(id)||id<1)return res.status(400).json({error:'Commande introuvable.'});
      await pool.query('DELETE FROM game_bot_commands WHERE id=$1',[id]);res.json({ok:true,message:'Commande supprimée.'});
    }catch{res.status(500).json({error:'Suppression impossible.'});}
  });
  router.post('/admin/game-bot/schedule',async(req,res)=>{
    try{
      if(!await getBroadcasterAccount(req))return res.sendStatus(403);
      const settings=validateDropSchedule(req.body);
      await pool.query('UPDATE game_bot_drop_schedule SET enabled=$1,min_minutes=$2,max_minutes=$3,next_at=NULL WHERE id=1',[settings.enabled,settings.minMinutes,settings.maxMinutes]);
      res.json({ok:true,message:settings.enabled?'Drops automatiques activés. Un nouveau délai sera tiré au prochain passage du bot en live.':'Drops automatiques désactivés. Un drop déjà ouvert peut se terminer.'});
    }catch(error){res.status(400).json({error:error.message});}
  });
  router.post('/admin/game-bot/messages',async(req,res)=>{
    try{
      if(!await getBroadcasterAccount(req))return res.sendStatus(403);
      const key=String(req.body?.key||''),custom=!Object.hasOwn(botMessageTemplates,key);
      if(custom&&key&&!/^custom-[a-f0-9-]{36}$/.test(key))throw Error('Message introuvable.');
      const label=custom?String(req.body?.label||'').trim():botMessageTemplates[key].label;
      if(!label||label.length>80)throw Error('Choisis un titre de 1 à 80 caractères.');
      const text=validateBotMessage(key,req.body?.text);
      await pool.query('INSERT INTO game_bot_message_templates(key,label,text) VALUES($1,$2,$3) ON CONFLICT(key) DO UPDATE SET label=$2,text=$3,updated_at=CURRENT_TIMESTAMP',[key||'custom-'+crypto.randomUUID(),label,text]);
      res.json({ok:true,message:'Message enregistré.'});
    }catch(error){res.status(400).json({error:error.message});}
  });
  router.post('/admin/game-bot/messages/reset',async(req,res)=>{
    try{if(!await getBroadcasterAccount(req))return res.sendStatus(403);await pool.query('DELETE FROM game_bot_message_templates WHERE key=$1',[String(req.body?.key||'')]);res.json({ok:true});}catch{res.status(500).json({error:'Modification impossible.'});}
  });
  router.post('/admin/game-bot/messages/send',async(req,res)=>{
    try{
      if(!await getBroadcasterAccount(req))return res.sendStatus(403);
      const key=String(req.body?.key||'');if(!key.startsWith('custom-'))throw Error('Seuls les messages personnalisés peuvent être envoyés manuellement.');
      const row=(await pool.query('SELECT text FROM game_bot_message_templates WHERE key=$1',[key])).rows[0];if(!row)throw Error('Message introuvable.');
      await send(row.text,'custom');res.json({ok:true,message:'Message envoyé dans le chat.'});
    }catch(error){res.status(400).json({error:error.message});}
  });
  router.post('/admin/game-bot/subscribe',async(req,res)=>{try{if(!await getBroadcasterAccount(req))return res.sendStatus(403);await subscribe();res.json({ok:true});}catch(error){res.status(400).json({error:error.message});}});
  router.post('/admin/game-bot/test',async(req,res)=>{try{if(!await getBroadcasterAccount(req))return res.sendStatus(403);await send(await messageText('test'),'test',{allowDisabled:true});res.json({ok:true,message:'Message de test envoyé dans le chat Twitch.'});}catch(error){res.status(400).json({error:error.message});}});
  router.post('/admin/game-bot/enabled',async(req,res)=>{try{if(!await getBroadcasterAccount(req))return res.sendStatus(403);const enabled=req.body?.enabled===true;const bot=await botRow();if(!bot?.subscription_id)return res.status(400).json({error:'Connecte le bot et abonne-le au chat avant de l’activer.'});await pool.query(`UPDATE game_bot_auth SET enabled=$1,alert_cursor=CASE WHEN $1 AND NOT enabled THEN COALESCE((SELECT MAX(id) FROM wizebot_game_alerts),0) ELSE alert_cursor END WHERE id=1`,[enabled]);if(enabled!==bot.enabled)await pool.query('UPDATE wizebot_alert_settings SET generation=generation+1,updated_at=CURRENT_TIMESTAMP WHERE id=1');if(!enabled){await pool.query('DELETE FROM game_bot_command_queue');await pool.query("UPDATE game_bot_drops SET status='cancelled',settled_at=CURRENT_TIMESTAMP WHERE status IN ('pending','open')");await pool.query('UPDATE game_bot_drop_schedule SET next_at=NULL WHERE id=1');}res.json({ok:true,enabled});}catch{res.status(500).json({error:'Bot indisponible.'});}});
  router.post('/admin/game-bot/drop',async(req,res)=>{try{
    const admin=await getBroadcasterAccount(req);if(!admin)return res.sendStatus(403);
    const bot=await botRow();if(!bot?.enabled)return res.status(400).json({error:'Active le bot d’abord.'});
    const live=(await pool.query("SELECT 1 FROM twitch_tracker_auth WHERE id=1 AND last_live=TRUE AND last_error IS NULL AND last_success_at>CURRENT_TIMESTAMP-INTERVAL '90 seconds'")).rowCount;
    if(!live)return res.status(400).json({error:'Le live et le tracker doivent être actifs.'});
    const reward=chooseDropReward();const round=(await pool.query('INSERT INTO game_bot_drops(reward_key) VALUES($1) RETURNING id',[reward.key])).rows[0];
    await logAdminAction(admin.id,null,'game_bot_drop',`Drop ${reward.label} préparé`,{roundId:round.id},pool);
    tick();res.json({ok:true,message:`Drop ${reward.label} préparé. Le bot va l’annoncer dans le chat.`});
  }catch(error){res.status(error.code==='23505'?409:500).json({error:error.code==='23505'?'Un drop est déjà en cours.':'Impossible de préparer le drop.'});}});
  return {router,tick,send,subscribe,handleCallback};
}
