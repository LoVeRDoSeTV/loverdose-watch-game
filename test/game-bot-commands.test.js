import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {PGlite} from '@electric-sql/pglite';
import {chatCommandName,validateChatCommand,deliverChatCommands} from '../src/game-bot-commands.js';
import {createGameBot,initGameBot} from '../src/routes/game-bot.js';
import {createWizebotAlerts,initWizebotAlerts} from '../src/routes/wizebot.js';

const settings={name:'!jeu',text:'{joueur}, retrouve le jeu sur https://loverwatchgame.fr/',enabled:true,cooldownSeconds:30};
test('les commandes valident nom, réponse et délai, et réservent !catch',()=>{
  assert.equal(chatCommandName(' !JeU un argument '),'!jeu');
  assert.equal(chatCommandName('bonjour !jeu'),null);
  assert.equal(validateChatCommand({...settings,name:' !JeU '}).name,'!jeu');
  for(const patch of [{name:'!catch'},{name:'!deux mots'},{name:'sans_prefixe'},{text:'deux\nlignes'},{text:'{gagnants}'},{text:'x'.repeat(401)},{text:'{joueur}'.repeat(49)},{enabled:'true'},{cooldownSeconds:4},{cooldownSeconds:3601},{cooldownSeconds:5.5},{id:-1}])assert.throws(()=>validateChatCommand({...settings,...patch}));
});

async function setup(){
  const db=new PGlite();
  await db.exec(`CREATE TABLE accounts(id INTEGER PRIMARY KEY,twitch_id TEXT);
    CREATE TABLE users(id INTEGER PRIMARY KEY,twitch_id TEXT,login TEXT,creature_id TEXT,watch_seconds INTEGER DEFAULT 0,created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE twitch_tracker_auth(id INTEGER PRIMARY KEY,last_live BOOLEAN,last_error TEXT,last_success_at TIMESTAMPTZ);
    CREATE TABLE user_incubator_eggs(id INTEGER PRIMARY KEY,user_id INTEGER,slot INTEGER,status TEXT);
    CREATE TABLE user_active_boosts(user_id INTEGER,boost_key TEXT,expires_at TIMESTAMPTZ);
    CREATE TABLE admin_live_boosts(id INTEGER PRIMARY KEY,expires_at TIMESTAMPTZ,xp_multiplier INTEGER,cash_multiplier INTEGER,global_xp_multiplier INTEGER);
    INSERT INTO twitch_tracker_auth VALUES(1,FALSE,NULL,CURRENT_TIMESTAMP);
    INSERT INTO accounts VALUES(1,'alice-id');
    INSERT INTO users(id,twitch_id,login) VALUES(1,'alice-id','alice');`);
  const pool={async query(sql,args){const r=await db.query(sql,args);return {...r,rowCount:r.rows.length||r.affectedRows||0};},async connect(){return {...this,release(){}};}};
  await initGameBot(pool);await initWizebotAlerts(pool);
  await pool.query(`INSERT INTO game_bot_auth(id,twitch_user_id,login,access_token_enc,refresh_token_enc,expires_at,webhook_secret,enabled)
    VALUES(1,'bot-id','loverwatchbot','test-token','test-refresh',CURRENT_TIMESTAMP+INTERVAL '1 hour','test-secret',TRUE)`);
  const oldChannel=process.env.TWITCH_BROADCASTER_ID;process.env.TWITCH_BROADCASTER_ID='channel-id';
  const bot=createGameBot({pool,baseUrl:'https://example.com',getBroadcasterAccount:async req=>req.allowed,decrypt:x=>x});
  if(oldChannel===undefined)delete process.env.TWITCH_BROADCASTER_ID;else process.env.TWITCH_BROADCASTER_ID=oldChannel;
  const invoke=async(path,req={})=>{const handler=bot.router.stack.find(layer=>layer.route?.path===path).route.stack[0].handle;let status=200,data;const res={status(n){status=n;return this;},sendStatus(n){status=n;},json(value){data=value;},set(){return this;}};await handler({allowed:true,...req},res);return {status,data};};
  let sequence=0;
  const webhook=async(text,overrides={},eventId='event-'+(++sequence),badSignature=false)=>{
    const body={subscription:{type:'channel.chat.message'},event:{broadcaster_user_id:'channel-id',chatter_user_id:'visitor-without-game-account',chatter_user_login:'visiteur',message:{text},...overrides}},raw=Buffer.from(JSON.stringify(body)),timestamp=new Date().toISOString();
    const signature='sha256='+crypto.createHmac('sha256','test-secret').update(eventId+timestamp).update(raw).digest('hex');
    return invoke('/game-bot/eventsub',{body,rawEventSubBody:raw,headers:{'twitch-eventsub-message-id':eventId,'twitch-eventsub-message-timestamp':timestamp,'twitch-eventsub-message-signature':badSignature?'invalid':signature,'twitch-eventsub-message-type':'notification'}});
  };
  const count=async table=>Number((await pool.query('SELECT COUNT(*) n FROM '+table)).rows[0].n);
  return {db,pool,bot,invoke,webhook,count};
}

test('commandes persistantes : édition admin, webhook signé, mention, anti-spam, déduplication, OFF et !catch',async()=>{
  const s=await setup(),originalFetch=globalThis.fetch,sent=[];
  globalThis.fetch=async(url,options)=>{assert.equal(url,'https://api.twitch.tv/helix/chat/messages');sent.push(JSON.parse(options.body).message);return {ok:true,json:async()=>({data:[{is_sent:true}]})};};
  const path='/admin/game-bot/commands';
  try{
    for(const suffix of ['', '/delete'])assert.equal((await s.invoke(path+suffix,{allowed:false,body:settings})).status,403);
    assert.equal((await s.invoke(path,{body:{...settings,name:'!catch'}})).status,400);
    assert.equal((await s.invoke(path,{body:settings})).status,200);
    assert.equal((await s.invoke(path,{body:settings})).status,409);
    const command=(await s.pool.query('SELECT * FROM game_bot_commands')).rows[0];
    const listed=await s.invoke('/admin/game-bot');assert.equal(listed.data.commands[0].name,'!jeu');
    assert.equal((await s.webhook('!jeu',{},'bad',true)).status,403);
    await s.webhook('!jeu',{broadcaster_user_id:'other'});await s.webhook('!jeu',{chatter_user_id:'bot-id'});await s.webhook('!inconnue');assert.equal(await s.count('game_bot_command_queue'),0);
    assert.equal((await s.webhook('!JeU un argument',{},'retry-id')).status,204);
    assert.equal(sent.length,0);assert.equal(await s.count('game_bot_command_queue'),1);
    await s.webhook('!JeU un argument',{},'retry-id');await s.webhook('!jeu');assert.equal(await s.count('game_bot_command_queue'),1);
    await s.bot.tick();await s.bot.tick();assert.equal(sent.length,1);assert.match(sent[0],/^@visiteur,/);assert.equal(await s.count('game_bot_command_queue'),0);
    assert.equal((await s.pool.query("SELECT kind FROM game_bot_messages")).rows[0].kind,'command');
    await s.pool.query("UPDATE game_bot_auth SET command_last_used_at=CURRENT_TIMESTAMP-INTERVAL '4 seconds'");
    await s.webhook('!jeu');assert.equal(await s.count('game_bot_command_queue'),0); // Per-command cooldown still active.
    await s.pool.query("UPDATE game_bot_commands SET last_used_at=CURRENT_TIMESTAMP-INTERVAL '31 seconds'");
    await s.webhook('!jeu');assert.equal(await s.count('game_bot_command_queue'),1);
    await s.invoke(path,{body:{...settings,id:command.id,enabled:false}});assert.equal(await s.count('game_bot_command_queue'),0);
    await s.webhook('!jeu');assert.equal(await s.count('game_bot_command_queue'),0);
    await s.invoke(path,{body:{...settings,id:command.id,name:'!discord',enabled:true}});
    await s.invoke(path,{body:{...settings,name:'!autre'}});
    await s.pool.query("UPDATE game_bot_commands SET last_used_at=NULL");
    await s.webhook('!autre');assert.equal(await s.count('game_bot_command_queue'),0); // Shared three-second cooldown.
    await s.pool.query("UPDATE game_bot_auth SET command_last_used_at=NULL");await s.webhook('!discord');assert.equal(await s.count('game_bot_command_queue'),1);
    await s.invoke(path+'/delete',{body:{id:command.id}});assert.equal(await s.count('game_bot_command_queue'),0);
    await s.pool.query("UPDATE game_bot_auth SET enabled=FALSE");await s.webhook('!autre');await s.bot.tick();assert.equal(sent.length,1);
    await s.pool.query("UPDATE game_bot_auth SET enabled=TRUE");
    await s.pool.query("INSERT INTO game_bot_drops(reward_key,status,ends_at) VALUES('xp','open',CURRENT_TIMESTAMP+INTERVAL '60 seconds')");
    await s.webhook('!catch',{chatter_user_id:'alice-id'});await s.webhook('!catch',{chatter_user_id:'alice-id'});
    assert.equal(await s.count('game_bot_entries'),1);assert.equal(sent.length,1);
  }finally{globalThis.fetch=originalFetch;await s.db.close();}
});

test('un œuf prêt est annoncé avec @pseudo par le bot même avec Wizebot OFF, sans relais en double',async()=>{
  const s=await setup(),originalFetch=globalThis.fetch,sent=[];
  globalThis.fetch=async(url,options)=>{sent.push(JSON.parse(options.body).message);return {ok:true,json:async()=>({data:[{is_sent:true}]})};};
  try{
    await s.pool.query("UPDATE twitch_tracker_auth SET last_live=TRUE");
    await s.db.exec("UPDATE users SET creature_id='lovys';INSERT INTO user_incubator_eggs VALUES(1,1,2,'ready')");
    const alerts=createWizebotAlerts({pool:s.pool,baseUrl:'https://example.com',eggHatchSeconds:21600});
    await alerts.collect();await alerts.collect();assert.equal(await s.count('wizebot_game_alerts'),1);
    await s.bot.tick();await s.bot.tick();assert.equal(sent.length,1);assert.match(sent[0],/@alice, ton œuf est prêt à éclore/);
    await s.pool.query("INSERT INTO user_incubator_eggs VALUES(2,1,3,'ready')");await alerts.collect();
    await s.pool.query("UPDATE user_incubator_eggs SET status='hatched' WHERE id=2");await s.bot.tick();assert.equal(sent.length,1);
    await s.pool.query("UPDATE wizebot_alert_settings SET enabled=TRUE");
    const handler=alerts.router.stack.find(l=>l.route?.path==='/wizebot/alerts').route.stack.at(-1).handle;
    const token=(await s.pool.query('SELECT relay_token FROM wizebot_alert_settings')).rows[0].relay_token;let response;
    await handler({query:{token}},{set(){return this;},json(value){response=value;},status(){return this;}});
    assert.equal(response.enabled,false);assert.equal(response.events.length,0);
    await s.pool.query("UPDATE users SET creature_id=NULL,watch_seconds=21600");await alerts.collect();await s.bot.tick();
    assert.equal(sent.length,2);assert.match(sent[1],/@alice, ton œuf est prêt à éclore/);
  }finally{globalThis.fetch=originalFetch;await s.db.close();}
});

test('une réponse refusée ne bloque pas les annonces d’œufs et n’est pas renvoyée en boucle',async()=>{
  const s=await setup();let attempts=0;
  try{
    await s.invoke('/admin/game-bot/commands',{body:settings});await s.webhook('!jeu');
    const send=async()=>{attempts++;throw Error('Twitch refused');};
    await deliverChatCommands(s.pool,send);await deliverChatCommands(s.pool,send);
    assert.equal(attempts,1);assert.equal(await s.count('game_bot_command_queue'),0);
  }finally{await s.db.close();}
});
