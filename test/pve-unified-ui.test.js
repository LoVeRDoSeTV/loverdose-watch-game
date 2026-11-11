import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source=fs.readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
const slice=(a,b)=>source.slice(source.indexOf(a),source.indexOf(b,source.indexOf(a)));
test('PC and touch devices render the same PvE encounters instead of the legacy map',()=>{
 for(const mobile of [false,true]){
  const calls=[],context=vm.createContext({isMobileGameUi:()=>mobile,renderMobilePveAdventure:(...args)=>calls.push(args)});
  vm.runInContext(source.match(/const PVE_SIMPLE_UI=[^;]+;/)[0]+slice('function renderPveAdventureMap(','async function loadPve('),context);
  const data={zones:[{key:'forest'}]};context.renderPveAdventureMap(data,0);
  assert.deepEqual(calls,[[data,0]]);
 }
});
test('PvE improvement opens the proper Lovys page for PC and touch navigation',async()=>{
 for(const desktop of [true,false]){
  const calls=[],context=vm.createContext({isDesktopGameUi:()=>desktop,openDesktopView:async view=>calls.push(['desktop',view]),toggleMobilePanel:async panel=>calls.push(['touch',panel])});
  vm.runInContext(slice('async function openPveLovysPage(){','let mobilePveStarting='),context);
  await context.openPveLovysPage();assert.deepEqual(calls,desktop?[['desktop','lovys']]:[['touch','creatures']]);
 }
});
test('PC gives the player a separate arena column and restores health on touch resize',()=>{
 const node=()=>({parentElement:null,children:[],appendChild(child){child.parentElement?.removeChild(child);this.children.push(child);child.parentElement=this;},removeChild(child){this.children=this.children.filter(x=>x!==child);child.parentElement=null;},insertBefore(child){this.appendChild(child);}});
 const player=node(),enemy=node(),arena=node(),heading=node(),playerHealth=node(),enemyHealth=node();
 player.appendChild(playerHealth);enemy.appendChild(enemyHealth);
 const elements={pveBattlePlayer:player,pveBattleEnemy:enemy,pveBattlePlayerName:{closest:()=>playerHealth},pveBattleEnemyName:{closest:()=>enemyHealth},pveBattleOverlay:{querySelector:selector=>selector==='.pve-battle-arena'?arena:heading}};
 let desktop=true;
 const context=vm.createContext({$:id=>elements[id],PVE_SIMPLE_UI:true,isDesktopGameUi:()=>desktop});
 vm.runInContext(slice('function syncPveBattleLayout(){',"window.addEventListener('resize',syncPveBattleLayout)"),context);
 context.syncPveBattleLayout();context.syncPveBattleLayout();
 assert.equal(playerHealth.parentElement,arena);assert.equal(arena.children.length,1);assert.equal(enemyHealth.parentElement,heading);
 desktop=false;context.syncPveBattleLayout();assert.equal(playerHealth.parentElement,player);
 desktop=true;context.syncPveBattleLayout();assert.equal(playerHealth.parentElement,arena);
});
