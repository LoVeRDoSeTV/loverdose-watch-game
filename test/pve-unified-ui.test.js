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
