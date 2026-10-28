import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {chooseDropReward,chooseWinnerCount,verifyEventSub} from '../src/routes/game-bot.js';

test('répartition des lots 50/25/20/5',()=>{
  const counts={};for(let i=0;i<100;i++){const key=chooseDropReward(()=>i).key;counts[key]=(counts[key]||0)+1;}
  assert.deepEqual(counts,{cash:50,fragments:25,xp:20,egg:5});
});
test('un à trois gagnants selon les probabilités 70/25/5',()=>{
  const counts=[0,0,0,0];for(let i=0;i<100;i++)counts[chooseWinnerCount(()=>i)]++;
  assert.deepEqual(counts,[0,70,25,5]);
});
test('EventSub refuse une signature incorrecte et un message expiré',()=>{
  const raw=Buffer.from(JSON.stringify({event:{message:{text:'!catch'}}}));
  const timestamp='2026-10-27T12:00:00Z',now=Date.parse(timestamp),secret='long-private-test-secret';
  const signature='sha256='+crypto.createHmac('sha256',secret).update('event-123'+timestamp).update(raw).digest('hex');
  const headers={'twitch-eventsub-message-id':'event-123','twitch-eventsub-message-timestamp':timestamp,'twitch-eventsub-message-signature':signature};
  assert.equal(verifyEventSub(headers,raw,secret,now),true);
  assert.equal(verifyEventSub(headers,Buffer.from('{}'),secret,now),false);
  assert.equal(verifyEventSub(headers,raw,secret,now+600001),false);
});

test('seul le webhook signé échappe au contrôle Origin',async()=>{
  const {createOriginGuard}=await import('../src/middleware/security.js');
  const guard=createOriginGuard({baseUrl:'https://loverwatchgame.fr'});
  const request=(path)=>({method:'POST',path,protocol:'https',get:(name)=>name==='host'?'loverwatchgame.fr':undefined});
  let passed=false,status=null;
  const response={status(code){status=code;return this;},json(){}};
  guard(request('/api/game-bot/eventsub'),response,()=>{passed=true});
  assert.equal(passed,true);
  passed=false;guard(request('/api/admin/game-bot/drop'),response,()=>{passed=true});
  assert.equal(passed,false);assert.equal(status,403);
});

test('le retour OAuth partagé reconnaît uniquement l’état du bot',async()=>{
  const {isGameBotCallback}=await import('../src/routes/game-bot.js');
  const {validOAuthCallback}=await import('../src/middleware/security.js');
  const session={gameBotOauthState:'bot-private-state',gameBotOauthStateStartedAt:1000,oauthState:'player-state',oauthStateStartedAt:1000};
  assert.equal(isGameBotCallback({state:'bot-private-state'},session),true);
  assert.equal(isGameBotCallback({state:'player-state'},session),false);
  assert.equal(isGameBotCallback({state:['bot-private-state']},session),false);
  assert.equal(isGameBotCallback({state:''},{}),false);
  assert.equal(validOAuthCallback({code:'bot-code',state:'bot-private-state'},session,'gameBotOauthState',2000),true);
  assert.equal(validOAuthCallback({code:'bot-code',state:'bot-private-state'},session,'gameBotOauthState',601001),false);
  assert.equal(validOAuthCallback({code:'player-code',state:'player-state'},session,'oauthState',2000),true);
});

test('le journal du bot distingue envoi accepté et refus Twitch sans exposer de jeton',async()=>{
  const {createGameBot}=await import('../src/routes/game-bot.js');
  const originalFetch=globalThis.fetch,calls=[];
  const pool={async query(sql,args){calls.push({sql,args});return {rows:sql.startsWith('SELECT * FROM game_bot_auth')?[{enabled:true,expires_at:new Date(Date.now()+3600000),access_token_enc:'private-token',twitch_user_id:'bot'}]:[],rowCount:1};}};
  const bot=createGameBot({pool,baseUrl:'https://example.com',getBroadcasterAccount:async()=>true,decrypt:x=>x});
  try{
    globalThis.fetch=async()=>({ok:true,json:async()=>({data:[{is_sent:true}]})});
    await bot.send('Annonce du drop','drop');
    let entries=calls.filter(c=>c.sql.startsWith('INSERT INTO game_bot_messages'));
    assert.deepEqual(entries[0].args,['drop','Annonce du drop','sent',null]);
    globalThis.fetch=async()=>({ok:false,status:403,json:async()=>({})});
    await assert.rejects(bot.send('Autre annonce','test'),/refusé/);
    entries=calls.filter(c=>c.sql.startsWith('INSERT INTO game_bot_messages'));
    assert.equal(entries[1].args[2],'failed');
    assert.equal(JSON.stringify(entries).includes('private-token'),false);
  }finally{globalThis.fetch=originalFetch;}
});

test('un échec du journal ne transforme pas un message envoyé en erreur à réessayer',async()=>{
  const {createGameBot}=await import('../src/routes/game-bot.js');
  const originalFetch=globalThis.fetch;let sends=0;
  const pool={async query(sql){if(sql.startsWith('INSERT INTO game_bot_messages'))throw Error('DB unavailable');return {rows:[{enabled:true,expires_at:new Date(Date.now()+3600000),access_token_enc:'token',twitch_user_id:'bot'}]};}};
  const bot=createGameBot({pool,baseUrl:'https://example.com',decrypt:x=>x});
  try{globalThis.fetch=async()=>{sends++;return {ok:true,json:async()=>({data:[{is_sent:true}]})};};await bot.send('Message');assert.equal(sends,1);}finally{globalThis.fetch=originalFetch;}
});

test('le test de chat peut envoyer un seul message en OFF sans activer le bot ni les drops',async()=>{
  const {createGameBot}=await import('../src/routes/game-bot.js');
  const originalFetch=globalThis.fetch,queries=[];let sends=0;
  const pool={async query(sql,args){queries.push({sql,args});return {rows:sql.startsWith('SELECT * FROM game_bot_auth')?[{enabled:false,expires_at:new Date(Date.now()+3600000),access_token_enc:'token',twitch_user_id:'bot'}]:[]};}};
  const bot=createGameBot({pool,baseUrl:'https://example.com',getBroadcasterAccount:async req=>req.allowed,decrypt:x=>x});
  const handler=bot.router.stack.find(layer=>layer.route?.path==='/admin/game-bot/test').route.stack[0].handle;
  let status=200,result;const res={status(n){status=n;return this;},sendStatus(n){status=n;},json(value){result=value;}};
  try{
    globalThis.fetch=async()=>{sends++;return {ok:true,json:async()=>({data:[{is_sent:true}]})};};
    await handler({allowed:false},res);assert.equal(status,403);assert.equal(sends,0);
    status=200;await handler({allowed:true},res);assert.equal(status,200);assert.equal(result.ok,true);assert.equal(sends,1);
    assert.equal(queries.some(q=>q.sql.includes('SET enabled=')||q.sql.includes('INSERT INTO game_bot_drops')),false);
    await assert.rejects(bot.send('Annonce automatique'),/Bot désactivé/);assert.equal(sends,1);
  }finally{globalThis.fetch=originalFetch;}
});

test('le bot signale les refus Twitch, les autorisations invalides et les réponses sans confirmation',async()=>{
  const {createGameBot}=await import('../src/routes/game-bot.js');
  const originalFetch=globalThis.fetch;
  const pool={async query(sql){return {rows:sql.startsWith('SELECT * FROM game_bot_auth')?[{enabled:true,expires_at:new Date(Date.now()+3600000),access_token_enc:'private-token',twitch_user_id:'bot'}]:[]};}};
  const bot=createGameBot({pool,baseUrl:'https://example.com',decrypt:x=>x});
  try{
    globalThis.fetch=async()=>({ok:true,status:200,json:async()=>({data:[{is_sent:false,drop_reason:{code:'msg_duplicate',message:'Duplicate message'}}]})});
    await assert.rejects(bot.send('Message'),/msg_duplicate.*Duplicate message/);
    globalThis.fetch=async()=>({ok:false,status:401,json:async()=>({message:'Missing user:write:chat scope'})});
    await assert.rejects(bot.send('Message'),/Missing user:write:chat scope.*Reconnecte/);
    globalThis.fetch=async()=>({ok:true,status:200,json:async()=>({})});
    await assert.rejects(bot.send('Message'),/pas confirmé/);
  }finally{globalThis.fetch=originalFetch;}
});
