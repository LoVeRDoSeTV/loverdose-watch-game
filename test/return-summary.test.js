import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync(new URL('../server.js',import.meta.url),'utf8');
const route=source.slice(source.indexOf("app.post('/api/game/return-summary'"),source.indexOf("app.post('/api/game/presence/leave'"));

function setup(initial){
  let callback,commits=0,zeroes=0,presence=0;
  const player={id:11,creature_id:'plant',away_lovys_xp:initial.lovysXp,away_global_xp:initial.globalXp,away_lovercash:initial.loverCash,away_watch_seconds:initial.watchSeconds};
  const client={query:async(sql,args)=>{
    if(sql.includes('SELECT id,creature_id,away_lovys_xp'))return {rows:[{...player}]};
    if(sql.includes('INSERT INTO user_game_tabs')){presence++;return {rows:[]};}
    if(sql.includes('UPDATE users SET away_lovys_xp=0')){zeroes++;Object.assign(player,{away_lovys_xp:0,away_global_xp:0,away_lovercash:0,away_watch_seconds:0});}
    if(sql==='COMMIT')commits++;
    return {rows:[]};
  },release:()=>{}};
  vm.runInNewContext(route,{app:{post:(_,cb)=>{callback=cb;}},pool:{connect:async()=>client},console});
  const call=async(tabId='aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee',authenticated=true)=>{
    let status=200,body,headers={};const res={status(n){status=n;return this;},json(x){body=x;return this;},setHeader(k,v){headers[k]=v;}};
    await callback({session:authenticated?{account:{id:1},user:{twitchId:'123'}}:{},body:{tabId}},res);
    return {status,body,headers};
  };
  return {call,get state(){return {player,commits,zeroes,presence};}};
}

test('le retour consomme les gains une fois, garde les montants et enregistre l’onglet',async()=>{
  const s=setup({lovysXp:10.25,globalXp:4.5,loverCash:1.05,watchSeconds:360});
  const first=await s.call();
  assert.equal(first.status,200);
  assert.deepEqual(JSON.parse(JSON.stringify(first.body.summary)),{lovysXp:10.25,globalXp:4.5,loverCash:1.05,watchSeconds:360,hasLovy:true});
  assert.equal(first.headers['Cache-Control'],'no-store');
  const second=await s.call();
  assert.equal(second.body.summary.watchSeconds,0);
  assert.deepEqual({commits:s.state.commits,zeroes:s.state.zeroes,presence:s.state.presence},{commits:2,zeroes:1,presence:2});
});

test('aucun accès ou identifiant d’onglet invalide ne consomme les gains',async()=>{
  const s=setup({lovysXp:5,globalXp:1,loverCash:.5,watchSeconds:60});
  assert.equal((await s.call('aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee',false)).status,401);
  assert.equal((await s.call('invalid')).status,400);
  assert.equal(s.state.player.away_watch_seconds,60);
  assert.equal(s.state.commits,0);
});
