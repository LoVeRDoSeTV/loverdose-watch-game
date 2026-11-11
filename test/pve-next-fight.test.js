import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {PVE_ZONES} from '../src/combat/zones.js';

const campaign=()=>({hasCreature:true,eggFragments:5,zones:PVE_ZONES.map(zone=>({...zone,fights:zone.fights.map(f=>({...f,won:true,unlocked:true}))}))});
for(const file of ['app.js','app.min.js']){
 const source=fs.readFileSync(new URL('../public/'+file,import.meta.url),'utf8');
 const extract=(a,b)=>source.slice(source.indexOf(a),source.indexOf(b,source.indexOf(a)));
 const helper=extract('function mobilePveNextFight(','function renderMobilePveAdventure(');
 const context=()=>{const c=vm.createContext({});vm.runInContext(helper,c);return c;};
 test(`${file}: replaying the complete campaign follows every encounter in order, including guardians and zone boundaries`,()=>{
  const {mobilePveNextFight:next}=context(),data=campaign();
  const flat=data.zones.flatMap((z,zoneIndex)=>z.fights.map(fight=>({fight,zoneIndex})));
  for(let n=0;n<flat.length-1;n++){
   const actual=next(data,flat[n].fight.key);
   assert.equal(actual?.fight.key,flat[n+1].fight.key);assert.equal(actual.zoneIndex,flat[n+1].zoneIndex);
  }
  assert.equal(next(data,flat.at(-1).fight.key),null);
 });
 test(`${file}: global progress and reward availability cannot skip an immediate replay opponent`,()=>{
  const {mobilePveNextFight:next}=context(),data=campaign();
  data.zones[8].fights[4].won=false;
  data.zones[0].fights.forEach(f=>f.replayRewardAvailable=false);
  assert.equal(next(data,data.zones[0].fights[0].key).fight.key,data.zones[0].fights[1].key);
  data.zones[0].fights[1].won=false;
  assert.equal(next(data,data.zones[0].fights[0].key).fight.key,data.zones[0].fights[1].key);
 });
 test(`${file}: a locked successor, missing encounter or final boss cannot wrap to another encounter`,()=>{
  const {mobilePveNextFight:next}=context(),data=campaign();
  const start=data.zones[0].fights[0].key;
  data.zones[0].fights[1].unlocked=false;
  assert.equal(next(data,start),null);assert.equal(next(data,'missing'),null);assert.equal(next({},start),null);
  const boss=data.zones[0].fights.at(-1).key;data.zones[1].fights[0].unlocked=false;
  assert.equal(next(data,boss),null);
 });
 function setup({fail=false}={}){
  const data=campaign(),nodes=new Map(),started=[],renders=[];
  data.zones[8].fights[4].won=false;
  const $=id=>{
   if(!nodes.has(id)){
    const classes=new Set(['active']);
    nodes.set(id,{disabled:false,textContent:id==='mobilePveResultPrimary'?'Combat suivant':'',dataset:{},
     classList:{add:c=>classes.add(c),remove:c=>classes.delete(c),contains:c=>classes.has(c)},
     setAttribute(){},removeAttribute(){},querySelector:()=>null});
   }
   return nodes.get(id);
  };
  let resolveFetch;const pending=new Promise(resolve=>{resolveFetch=resolve;});
  const c=vm.createContext({$,AbortController,setTimeout:()=>1,clearTimeout(){},
   mobilePveTransitionBusy:false,mobilePveStarting:false,
   pveBattleState:{fight:{key:data.zones[0].fights[0].key},autoToken:0},pveMapState:{data,selectedZone:0,selectedFight:null},
   fetch:async()=>{await pending;return {ok:!fail,json:async()=>fail?{error:'Actualisation impossible'}:data};},
   stopPveAutoLoop(){},setHubFragmentsButton(){},loadGame:async()=>{},loadLovysCollection:async()=>{},
   startMobilePveFight:async key=>{started.push(key);return true;},openPveLovysPage:async()=>{},
   renderPveAdventureMap(d,index){renders.push(index);c.pveMapState.selectedZone=index;if(!c.pveMapState.selectedFight)c.pveMapState.selectedFight=d.zones[index??0].fights.at(-1).key;}});
  vm.runInContext(helper,c);
  vm.runInContext(extract('function pveFightInfoByKey(','function pveZoneAccessible('),c);
  vm.runInContext(extract('async function closeMobilePveBattle(','function confirmMobilePveAbandon('),c);
  return {c,data,started,renders,$,release:()=>resolveFetch()};
 }
 test(`${file}: the actual Next button refreshes progress and opens fight 2 instead of the account frontier`,async()=>{
  const s=setup();const pending=s.c.closeMobilePveBattle('next');
  assert.equal(s.$('mobilePveResultPrimary').disabled,true);
  await s.c.closeMobilePveBattle('next');
  s.release();await pending;
  assert.deepEqual(s.started,[s.data.zones[0].fights[1].key]);
  assert.equal(s.c.pveMapState.selectedFight,s.data.zones[0].fights[1].key);
  assert.equal(s.c.mobilePveTransitionBusy,false);assert.equal(s.$('mobilePveResultPrimary').disabled,false);
 });
 test(`${file}: retry keeps the current opponent and returning to the zone starts no fight`,async()=>{
  for(const action of ['retry','zone','next-zone']){
   const s=setup();s.release();await s.c.closeMobilePveBattle(action);
   assert.deepEqual(s.started,action==='retry'?[s.data.zones[0].fights[0].key]:[]);
   if(action==='next-zone')assert.equal(s.renders.at(-1),1);
  }
 });
 test(`${file}: a refresh failure preserves the result for a retry without starting a fight`,async()=>{
  const s=setup({fail:true});s.release();await s.c.closeMobilePveBattle('next');
  assert.deepEqual(s.started,[]);assert.equal(s.c.mobilePveTransitionBusy,false);
  assert.equal(s.$('mobilePveResultPrimary').disabled,false);assert.match(s.$('pveBattleResultCopy').textContent,/Actualisation impossible/);
 });
}
