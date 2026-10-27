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
