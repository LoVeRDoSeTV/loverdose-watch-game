import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import express from 'express';
import {panelSettings,verifyExtensionToken,loadPanelSnapshot} from '../src/twitch-panel.js';
import {createTwitchPanelRouter} from '../src/routes/twitch-panel.js';

const secret=Buffer.alloc(32,7),channelId='12345';
const env={TWITCH_EXTENSION_CLIENT_ID:'extension12345678',TWITCH_EXTENSION_SECRET:secret.toString('base64'),TWITCH_BROADCASTER_ID:channelId};
const settings=panelSettings(env);
const sign=(patch={},header={alg:'HS256',typ:'JWT'})=>{
  const parts=[header,{exp:Math.floor(Date.now()/1000)+300,role:'viewer',channel_id:channelId,opaque_user_id:'Uopaque',user_id:'42',...patch}].map(v=>Buffer.from(JSON.stringify(v)).toString('base64url'));
  return parts.join('.')+'.'+crypto.createHmac('sha256',secret).update(parts.join('.')).digest('base64url');
};
function fixture(){
  const calls=[];
  const account={account_id:1,username:'Joueur',twitch_panel_enabled:true,user_id:2,creature_id:'voltis',xp:900,pending_xp:60,watch_seconds:10};
  const catalog=Array.from({length:5},(_,i)=>({key:'item'+i,category:'object',name:'Objet '+i,icon:'🥚'}));catalog.push({key:'title',category:'title'});
  const pool={query:async(sql,params)=>{
    calls.push({sql,params});
    if(sql.startsWith('SELECT a.id'))return {rows:[account]};
    if(sql.startsWith('SELECT a.username'))return {rows:[{username:account.username,twitch_id:'42',user_id:2,twitch_panel_enabled:account.twitch_panel_enabled}]};
    if(sql.startsWith('SELECT creature_id'))return {rows:[{creature_id:'voltis',xp:1,rank:3}]};
    if(sql.includes('FROM user_incubator_eggs'))return {rows:[{slot:1,watched_seconds:22000,status:'ready'},{slot:2,watched_seconds:10800,status:'incubating'}]};
    if(sql.includes('FROM shop_inventory'))return {rows:[...catalog.map(item=>({item_key:item.key,quantity:2})),{item_key:'unknown',quantity:1}]};
    if(sql.startsWith('UPDATE accounts')){account.twitch_panel_enabled=params[1];return {rowCount:1,rows:[{twitch_panel_enabled:params[1]}]};}
    throw Error('Unexpected SQL');
  }};
  return {pool,calls,account,catalog,hatchSeconds:21600,creatureBattleStats:input=>({name:'Voltis',type:'Foudre',level:input.xp===900?14:1,rank:input.rank})};
}

test('JWT: authenticates signed Twitch identity and rejects expired, wrong-channel, external, altered and malformed tokens',()=>{
  assert(settings.ready);assert(!panelSettings({}).ready);
  assert.equal(verifyExtensionToken(sign(),settings).user_id,'42');
  for(const token of [sign({exp:0}),sign({channel_id:'9'}),sign({role:'external'}),sign({nbf:Date.now()/1000+60}),sign({user_id:'bad'}),sign({}, {alg:'none'}),'a.b.c',sign().slice(0,-4)+'abcd'])assert.throws(()=>verifyExtensionToken(token,settings));
});

test('snapshot: authentic game values, 3 incubators, 4 consumable types, no credentials and no writes',async()=>{
  const f=fixture(),snapshot=await loadPanelSnapshot({...f,twitchId:'42'});
  assert.equal(snapshot.state,'player');assert.equal(snapshot.player.lovys.level,14);
  assert.equal(snapshot.player.pendingXp,60);assert.equal(snapshot.eggs.length,3);
  assert(snapshot.eggs[0].ready);assert.equal(snapshot.eggs[0].progress,100);
  assert.equal(snapshot.eggs[1].progress,50);assert(snapshot.eggs[2].empty);
  assert.equal(snapshot.items.length,4);assert.equal(snapshot.itemTypes,5);
  assert(snapshot.items.every(i=>i.key!=='title'&&i.key!=='unknown'));
  assert(f.calls.every(c=>c.sql.startsWith('SELECT')));
  assert(!JSON.stringify(snapshot).match(/account_id|user_id|email|password|token|twitch_id/));
});

test('snapshot: no consent means no private queries; starter egg uses real watched time',async()=>{
  const f=fixture();f.account.twitch_panel_enabled=false;
  assert.equal((await loadPanelSnapshot({...f,twitchId:'42'})).state,'link_required');assert.equal(f.calls.length,1);
  f.account.twitch_panel_enabled=true;f.account.creature_id=null;f.account.watch_seconds=10800;
  const snapshot=await loadPanelSnapshot({...f,twitchId:'42'});assert.equal(snapshot.eggs[0].progress,50);assert.equal(snapshot.eggs[0].ready,false);
});

test('HTTP: identity, CORS, explicit site consent, spoofing protection, revocation and feature-disabled state',async()=>{
  const f=fixture(),app=express();app.use(express.json());app.use((req,res,next)=>{req.session=req.get('x-test-account')?{account:{id:1}}:{};next();});
  app.use('/api/twitch-panel',createTwitchPanelRouter({...f,baseUrl:'https://loverwatchgame.fr',env}));
  const server=app.listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));
  const base=`http://127.0.0.1:${server.address().port}/api/twitch-panel`,origin='https://extension12345678.ext-twitch.tv';
  const api=(path,options={})=>fetch(base+path,options);
  try{
    let r=await api('/snapshot',{headers:{Origin:origin}});assert.equal(r.status,401);
    r=await api('/snapshot',{headers:{Origin:'https://evil.example',Authorization:'Bearer '+sign()}});assert.equal(r.status,403);assert(!r.headers.has('Access-Control-Allow-Origin'));
    r=await api('/snapshot',{method:'OPTIONS',headers:{Origin:origin,'Access-Control-Request-Headers':'Authorization'}});assert.equal(r.status,204);assert.equal(r.headers.get('Access-Control-Allow-Origin'),origin);
    const before=f.calls.length;
    r=await api('/snapshot',{headers:{Origin:origin,Authorization:'Bearer '+sign({user_id:undefined})}});assert.equal((await r.json()).state,'identity_required');assert.equal(f.calls.length,before);
    r=await api('/snapshot',{headers:{Origin:origin,Authorization:'Bearer '+sign({is_unlinked:true})}});assert.equal((await r.json()).state,'identity_required');
    r=await api('/snapshot?twitchId=999&accountId=999',{headers:{Origin:origin,Authorization:'Bearer '+sign()}});assert.equal((await r.json()).state,'player');assert(!r.headers.has('Access-Control-Allow-Credentials'));assert(f.calls.some(c=>c.params[0]==='42'));assert(!f.calls.some(c=>c.params.includes('999')));
    r=await api('/connection');assert.equal((await r.json()).authenticated,false);
    r=await api('/connection',{method:'POST',headers:{Origin:'https://loverwatchgame.fr','Content-Type':'application/json'},body:'{"enabled":true}'});assert.equal(r.status,401);
    r=await api('/connection',{method:'POST',headers:{Origin:'https://evil.example','Content-Type':'application/json','x-test-account':'1'},body:'{"enabled":true}'});assert.equal(r.status,403);
    r=await api('/connection',{method:'POST',headers:{Origin:'https://loverwatchgame.fr','Content-Type':'application/json','x-test-account':'1'},body:'{"enabled":"true"}'});assert.equal(r.status,400);
    r=await api('/connection',{method:'POST',headers:{Origin:'https://loverwatchgame.fr','Content-Type':'application/json','x-test-account':'1'},body:'{"enabled":false}'});assert.equal(r.status,200);
    r=await api('/snapshot',{headers:{Origin:origin,Authorization:'Bearer '+sign()}});assert.equal((await r.json()).state,'link_required');
    r=await api('/connection',{method:'POST',headers:{Origin:'https://loverwatchgame.fr','Content-Type':'application/json','x-test-account':'1'},body:'{"enabled":true}'});assert.equal((await r.json()).enabled,true);
    env.TWITCH_EXTENSION_SECRET='';r=await api('/snapshot',{headers:{Authorization:'Bearer '+sign()}});assert.equal(r.status,503);env.TWITCH_EXTENSION_SECRET=secret.toString('base64');
  }finally{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
});
