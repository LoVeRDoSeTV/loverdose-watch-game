import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

for(const file of ['app.js','app.min.js']){
 const source=fs.readFileSync(new URL('../public/'+file,import.meta.url),'utf8');
 const extract=(a,b)=>source.slice(source.indexOf(a),source.indexOf(b,source.indexOf(a)));
 const fight=(key,won=false)=>({key,name:key,unlocked:true,won,accountWon:true,replayRewardAvailable:!won,rewards:{creatureXp:12,globalXp:8,fragments:5}});
 const campaign=id=>({activeLovysId:id,hasCreature:true,creature:{name:'Test'},zones:[{key:'forest',name:'Forêt',fights:[fight('forest_1'),fight('forest_2')]},{key:'ember',name:'Volcan',fights:[fight('ember_1')]}]});
 function setup(){
  const box={innerHTML:''},c=vm.createContext({$:()=>box,pveMapState:{data:campaign(1),selectedZone:1,selectedFight:'ember_1'},lovysCollectionData:null,me:null,escapeHtml:s=>String(s??''),pveZoneArtStyle:()=>'',pveEnemyVisual:()=>({}),pveEnemySpriteMarkup:()=>'',pveFightRoleLabel:()=>'',lovysRankStars:()=>'',pveAtlasMarkup:()=>'',fragmentIconMarkup:()=>''});
  for(const [a,b] of [['function pveZoneAccessible(','function pveTravelerMarkup('],['function pveCashRewardText(','function pveFightDetailMarkup('],['function pveFragmentsMarkup(','function pveZoneVisualMeta('],['function mobilePveZoneIndex(','function mobilePveNextFight('],['function renderMobilePveAdventure(','async function startMobilePveFight(']])vm.runInContext(extract(a,b),c);
  return {c,box};
 }
 test(`${file}: changing Lovys clears the old selected fight and shows only its own checkmarks`,()=>{
  const {c,box}=setup(),data=campaign(2);
  c.renderMobilePveAdventure(data);
  assert.equal(c.pveMapState.selectedZone,0);assert.equal(c.pveMapState.selectedFight,'forest_1');
  assert.match(box.innerHTML,/0\/2 gagnés avec ce Lovys/);assert.doesNotMatch(box.innerHTML,/Gagné avec ce Lovys/);
  const rewards=box.innerHTML.match(/<div class="mobile-pve-rewards">(.*?)<\/div>/s)[1];
  assert.match(rewards,/12 XP Lovys/);assert.doesNotMatch(rewards,/XP globale|fragments d’œuf/);
  data.zones[0].fights[0].won=true;data.zones[0].fights[0].replayRewardAvailable=false;
  c.pveMapState.selectedFight=null;c.renderMobilePveAdventure(data);
  assert.match(box.innerHTML,/1\/2 gagnés avec ce Lovys/);assert.match(box.innerHTML,/Gagné avec ce Lovys/);assert.equal(c.pveMapState.selectedFight,'forest_2');
  const original=campaign(1);original.zones[0].fights.forEach(f=>f.won=true);c.renderMobilePveAdventure(original);
  assert.equal(c.pveMapState.selectedZone,1);assert.equal(c.pveMapState.selectedFight,'ember_1');
 });
 test(`${file}: fragments remain collected at account level with a fresh Lovys`,()=>{
  const {c}=setup(),html=c.pveFragmentsMarkup(campaign(2));
  assert.match(html,/15 fragment\(s\) récupéré\(s\) sur 15/);assert.equal((html.match(/Récompense récupérée/g)||[]).length,3);
 });
}
