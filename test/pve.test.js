import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {PVE_ZONES,PVE_FIGHTS,pvePreviousFight,pveFightByKey} from '../src/combat/zones.js';
import {createBattleState,resolveBattleAction,battlePublicState} from '../src/combat/battle.js';
import {buildLovysBattleStats,LOVYS_COMBAT_CONFIG} from '../src/combat/lovys.js';
import {isPveFightUnlocked} from '../src/combat/progression.js';
const player={name:'Test',level:30,rank:1,type:'Neutre',hp:100000,attack:1,defense:100000,speed:100,skills:[{key:'skill',name:'Skill',multiplier:1,cooldown:3}]};
const fight={key:'test',name:'Test',level:30,hp:100000,attack:1,defense:10,speed:1};
const battle=(key)=>createBattleState({fight:{...fight,mechanic:{key}},player});
const turn=s=>resolveBattleAction(s,'basic');
test('night expansion preserves old victory keys and gates new fights in order',()=>{
 const night=PVE_ZONES.find(z=>z.key==='night');
 assert.deepEqual(night.fights.map(f=>f.key),['night_1','night_2','night_3','night_4','night_5','night_6','night_7','night_8','night_mini','night_boss']);
 assert.equal(night.fights[8].miniBoss,true);assert.equal(night.fights[9].finalBoss,true);
 const oldWins=new Map(['night_1','night_2','night_3','night_4','night_mini','night_boss'].map(key=>[key,1]));
 const unlocked=key=>{const previous=pvePreviousFight(key);return isPveFightUnlocked(previous,oldWins.get(previous?.key),oldWins.get(key));};
 assert.equal(unlocked('night_5'),true);assert.equal(unlocked('night_6'),false);
 assert.equal(unlocked('night_mini'),true);assert.equal(unlocked('night_boss'),true);assert.equal(unlocked('tide_1'),true);
 oldWins.delete('night_mini');oldWins.delete('night_boss');
 assert.equal(unlocked('night_mini'),false);assert.equal(unlocked('night_boss'),false);assert.equal(unlocked('tide_1'),false);
 for(const key of ['night_5','night_6','night_7','night_8','night_mini','night_boss']){assert.equal(unlocked(key),true);oldWins.set(key,1);}
 assert.equal(unlocked('tide_1'),true);
});
test('campaign preserves keys, ordered levels, unique assets and cross-zone unlocks',()=>{
 assert.equal(PVE_ZONES.length,10);assert.equal(PVE_FIGHTS.length,100);
 assert.equal(new Set(PVE_FIGHTS.map(f=>f.key)).size,100);
 assert.equal(pvePreviousFight('forest_1'),null);
 assert.equal(pvePreviousFight('tide_1').key,'night_boss');
 assert.equal(pvePreviousFight('origin_1').key,'automata_boss');
 assert.equal(PVE_FIGHTS.at(-1).level,50);
 PVE_FIGHTS.forEach((f,i)=>{assert.ok(f.level>= (PVE_FIGHTS[i-1]?.level||1));assert.equal(pveFightByKey(f.key),f);if(f.visual)assert.ok(fs.existsSync(new URL('../public'+f.visual.image,import.meta.url)));});
 PVE_ZONES.forEach(z=>{assert.equal(z.fights.length,10);assert.equal(z.fights.filter(f=>f.miniBoss).length,1);assert.equal(z.fights.filter(f=>f.finalBoss).length,1);if(z.visual?.background)assert.ok(fs.existsSync(new URL('../public'+z.visual.background,import.meta.url)));});
});
test('invalid actions and unavailable skills cannot mutate persisted battle',()=>{
 const s=battle('');s.enemy.speed=200;const before=JSON.stringify(s);assert.throws(()=>resolveBattleAction(s,'hacked'));assert.equal(JSON.stringify(s),before);
 resolveBattleAction(s,'skill');const used=JSON.stringify(s);assert.throws(()=>resolveBattleAction(s,'skill'));assert.equal(JSON.stringify(s),used);
 turn(s);turn(s);assert.doesNotThrow(()=>resolveBattleAction(s,'skill'));
});
test('shield absorbs direct damage, breaks once, survives JSON persistence',()=>{
 let s=battle('tidal_shell');const shield=s.enemy.mechanicState.shield;s.player.attack=100000;turn(s);assert.ok(s.enemy.mechanicState.shield<shield);s=JSON.parse(JSON.stringify(s));assert.equal(battlePublicState(s).enemy.shield,s.enemy.mechanicState.shield);
});
test('frost applies on third attack without skipping player turns',()=>{
 const s=battle('frost_breath');turn(s);turn(s);turn(s);assert.equal(s.player.frostUntilRound,5);assert.equal(s.player.talentState.actionCount,3);
});
test('sand and storm telegraph the charged attack',()=>{
 for(const key of ['sand_charge','storm_charge']){const s=battle(key);turn(s);turn(s);assert.match(battlePublicState(s).enemy.intent,/Prochaine attaque/);const r=turn(s);assert.ok(r.events.some(e=>/chargée|Décharge/.test(e.action||'')));}
});
test('dream and automata alternate without compounding stats',()=>{
 const dream=battle('dream_stance');turn(dream);turn(dream);turn(dream);assert.equal(dream.enemy.defense,Math.round(10*.85));turn(dream);turn(dream);assert.equal(dream.enemy.defense,Math.round(10*1.25));
 const auto=battle('automaton_heat');turn(auto);turn(auto);turn(auto);assert.equal(auto.enemy.defense,7);turn(auto);turn(auto);assert.equal(auto.enemy.defense,10);
});
test('origin phases advance and final phase stays stable',()=>{
 const s=battle('origin_phases');s.enemy.hp=60000;turn(s);assert.equal(s.enemy.mechanicState.phase,2);s.enemy.hp=29000;turn(s);assert.equal(s.enemy.mechanicState.phase,3);const atk=s.enemy.attack;turn(s);assert.equal(s.enemy.attack,atk);
});
test('timeout requires a kill, including a kill on the last allowed turn',()=>{
 const s=battle('');for(let i=0;i<30;i++)turn(s);assert.equal(s.status,'defeat');assert.equal(s.endReason,'turn_limit');assert.equal(s.round,30);
 const last=battle('');last.round=30;last.enemy.hp=1;turn(last);assert.equal(last.status,'victory');
});
test('version 2 legacy battles still resolve after restart',()=>{
 const s=createBattleState({fight:PVE_FIGHTS[0],player});s.version=2;delete s.enemy.baseAttack;delete s.enemy.baseDefense;delete s.player.frostUntilRound;delete s.enemy.mechanicState.shield;
 assert.doesNotThrow(()=>turn(JSON.parse(JSON.stringify(s))));
});
test('all species at max level and max rank can finish the campaign',()=>{
 for(const id of Object.keys(LOVYS_COMBAT_CONFIG))for(const f of PVE_FIGHTS){const p=buildLovysBattleStats({creature:{id,name:id,type:'Neutre'},level:50,rank:5});const s=createBattleState({fight:f,player:p});for(let i=0;i<30&&s.status==='active';i++){const sk=[...s.player.skills].reverse().find(sk=>Number(s.player.cooldowns[sk.key]||0)<=1);resolveBattleAction(s,sk?.key||'basic');}assert.equal(s.status,'victory',id+' / '+f.key);}
});
