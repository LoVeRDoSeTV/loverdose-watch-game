import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source=fs.readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
const slice=(a,b)=>source.slice(source.indexOf(a),source.indexOf(b,source.indexOf(a)));
function setup(storage=new Map(),mobile=false){
  const elements=new Map();
  const element=id=>{
    if(!elements.has(id))elements.set(id,{classList:{add(){},remove(){},toggle(){}},querySelector:()=>null,querySelectorAll:()=>[],setAttribute(){},removeAttribute(){},focus(){},style:{},innerHTML:'',textContent:''});
    return elements.get(id);
  };
  let loops=0;
  const c=vm.createContext({me:{user:{id:1}},localStorage:{getItem:k=>storage.get(k)??null,setItem:(k,v)=>storage.set(k,v)},
    $:element,isMobileGameUi:()=>mobile,isDesktopGameUi:()=>!mobile,PVE_SIMPLE_UI:true,document:{body:{appendChild(){}}},requestAnimationFrame:fn=>fn(),
    pveFightRoleLabel:()=>'',pveEnemyVisual:()=>({zone:1}),pveEnemySpriteMarkup:()=>'',syncPveBattleLayout(){},syncPveBattleUi(b){c.pveBattleState.battle=b;},updatePveAutoUi(){},
    stopPveAutoLoop(){loops=0;},schedulePveAuto(){loops++;},
    pveBattleSetDisabled(){},AbortController,setTimeout:()=>1,clearTimeout(){},animatePveBattleEvents:async()=>{},configureMobilePveResult(){},configurePveZoneResult(){},renderPveBattleActions(){},ensurePveAutoLoop(){loops++;}});
  c.pveBattleState={auto:false,autoToken:0};
  vm.runInContext(slice('const pveAutoPreferences = new Map();','function pveFightRoleLabel('),c);
  vm.runInContext(slice('function openPveTacticalBattle(', 'async function animatePveBattleEvents('),c);
  vm.runInContext(slice('async function submitPveBattleAction(', 'let pveDesktopClosing='),c);
  const battle=()=>({status:'active',player:{name:'Lovy',hp:100,maxHp:100},enemy:{hp:100,maxHp:100}});
  return {c,storage,battle,get loops(){return loops;}};
}
for(const mobile of [false,true])test(`auto resumes after victory, defeat and opening another fight (${mobile?'touch':'PC'})`,async()=>{
  const s=setup(new Map(),mobile),{c}=s;
  c.openPveTacticalBattle({},s.battle());assert.equal(c.pveBattleState.auto,false);assert.equal(s.loops,0);
  c.setPveAutoPreference(true);
  for(const victory of [true,false]){
    c.openPveTacticalBattle({},s.battle());assert.equal(c.pveBattleState.auto,true);assert.equal(s.loops,1);
    c.fetch=async()=>({ok:true,json:async()=>({finished:true,victory,battle:{...s.battle(),status:victory?'victory':'defeat'}})});
    await c.submitPveBattleAction('basic');assert.equal(c.pveBattleState.auto,false);assert.equal(s.loops,0);assert.equal(c.readPveAutoPreference(),true);
  }
  c.openPveTacticalBattle({},s.battle());assert.equal(c.pveBattleState.auto,true);assert.equal(s.loops,1);
});
test('refresh restores choice, explicit disable persists, accounts stay independent',()=>{
  const s=setup();s.c.setPveAutoPreference(true);
  const fresh=setup(s.storage);fresh.c.openPveTacticalBattle({},fresh.battle());assert.equal(fresh.c.pveBattleState.auto,true);
  fresh.c.me.user.id=2;assert.equal(fresh.c.readPveAutoPreference(),false);
  fresh.c.me.user.id=1;fresh.c.setPveAutoPreference(false);
  const again=setup(s.storage);again.c.openPveTacticalBattle({},again.battle());assert.equal(again.c.pveBattleState.auto,false);assert.equal(again.loops,0);
});
test('blocked browser storage still preserves the choice between battles',()=>{
  const s=setup();s.c.localStorage={getItem(){throw Error('blocked');},setItem(){throw Error('blocked');}};
  s.c.setPveAutoPreference(true);s.c.openPveTacticalBattle({},s.battle());assert.equal(s.c.pveBattleState.auto,true);
  s.c.setPveAutoPreference(false);s.c.openPveTacticalBattle({},s.battle());assert.equal(s.c.pveBattleState.auto,false);
});
