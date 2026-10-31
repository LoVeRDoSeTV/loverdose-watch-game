import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {lovysProgressionFromXp,lovysEvolutionFromLevel,lovysThresholdForLevel} from '../src/xp-economy.js';
import {buildLovysBattleStats,LOVYS_COMBAT_CONFIG} from '../src/combat/lovys.js';
import {createBattleState,battlePublicState} from '../src/combat/battle.js';
import {PVE_FIGHTS,PVE_ZONES} from '../src/combat/zones.js';
test('only levels 25 and 50 evolve a Lovy; rank does not select its form',()=>{
 for(const level of [1,10,24,25,30,49,50]){
  const p=lovysProgressionFromXp(lovysThresholdForLevel(level));
  assert.equal(p.evolution,level>=50?3:level>=25?2:0);
  assert.equal(p.evolutionBonusPercent,level>=50?30:level>=25?15:0);
  for(const rank of [1,3,5]){const stats=buildLovysBattleStats({creature:{id:'voltis'},level,rank});assert.equal(stats.evolution,p.evolution);assert.equal(stats.evolutionBonusPercent,p.evolutionBonusPercent);}
 }
 assert.equal(lovysEvolutionFromLevel(24).nextEvolutionLevel,25);
 assert.equal(lovysEvolutionFromLevel(25).nextEvolutionLevel,50);
 assert.equal(lovysEvolutionFromLevel(50).nextEvolutionLevel,null);
});
test('evolution grants real combat stats independently from rank and talents',()=>{
 for(const [id,cfg] of Object.entries(LOVYS_COMBAT_CONFIG))for(const level of [24,25,49,50])for(const rank of [1,5]){
  const p=buildLovysBattleStats({creature:{id},level,rank});
  const evo=level>=50?1.30:level>=25?1.15:1,stars=1+(rank-1)*.02;
  for(const stat of ['hp','attack','defense','speed'])assert.equal(p[stat],Math.round((cfg.base[stat]+cfg.growth[stat]*(level-1))*evo*stars),`${id}/${level}/${rank}/${stat}`);
  assert.equal(p.talent.tier,rank===5?2:0);
 }
 const player=buildLovysBattleStats({creature:{id:'voltis'},level:30,rank:3});
 const battle=battlePublicState(createBattleState({fight:PVE_FIGHTS[0],player}));
 assert.equal(battle.player.creatureId,'voltis');assert.equal(battle.player.evolution,2);assert.equal(battle.player.rank,3);
});
test('late campaign spans 30–50 without changing victory keys or reward budget',()=>{
 assert.equal(PVE_ZONES.find(z=>z.key==='dune').fights.at(-1).level,30);
 assert.equal(PVE_ZONES.find(z=>z.key==='dream').fights[0].level,30);
 assert.equal(PVE_ZONES.at(-1).fights.at(-1).level,50);
 assert.equal(PVE_FIGHTS.reduce((n,f)=>n+f.rewards.creatureXp,0),1920);
 assert.ok(PVE_FIGHTS.find(f=>f.key==='origin_boss').hp>PVE_FIGHTS.find(f=>f.key==='dune_boss').hp);
});
test('art selects the approved stage by evolution, including aliases and all species',()=>{
 const source=fs.readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
 const code=source.slice(source.indexOf('function lovysEvolutionForLevel('),source.indexOf('function lovysEvolutionMarkup('));
 const context=vm.createContext({});vm.runInContext(code,context);
 const files={plant:'Mossy',water:'Nymea',voltis:'Voltis',brumee:'Brumee',fire:'Flamby',crysal:'Crysal',ferox:'Ferox',dark:'Nocty',solka:'Solka',dream:'Mimo'};
 for(const [id,name] of Object.entries(files))for(const level of [1,24,25,49,50]){
  const expected=`/${name}${level>=50?'-evolution-50':level>=25?'-evolution-25':''}.webp`;
  assert.equal(context.lovysImageUrl(id,context.lovysEvolutionForLevel(level)),expected);
  assert.ok(fs.existsSync(new URL('../public'+expected,import.meta.url)),expected);
 }
 assert.equal(context.lovysImageUrl('lightning',2),'/Voltis-evolution-25.webp');
});
