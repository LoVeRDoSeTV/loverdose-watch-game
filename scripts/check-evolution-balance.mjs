// Deterministic in-memory simulation; no database or production state.
// SIM_LEVEL=30 fixes the player at level 30; otherwise uses each boss recommendation.
import crypto from 'node:crypto';
import fs from 'node:fs';
import {PVE_ZONES} from '../src/combat/zones.js';
import {buildLovysBattleStats} from '../src/combat/lovys.js';
import {createBattleState,resolveBattleAction} from '../src/combat/battle.js';
const server=fs.readFileSync(new URL('../server.js',import.meta.url),'utf8');const start=server.indexOf('const creatures = [');const creatures=Function(server.slice(start,server.indexOf('\n];',start)+3)+';return creatures')();
let seed=563;crypto.randomInt=(min,max)=>{if(max===undefined){max=min;min=0;}seed=(Math.imul(1664525,seed)+1013904223)>>>0;return min+seed%(max-min);};
const beats={Verdance:'Abyssal',Abyssal:'Cendre',Cendre:'Verdance',Foudre:'Abyssal',Néant:'Mirage',Mirage:'Néant',Solaire:'Néant',Forge:'Cristal',Cristal:'Foudre'};
const multiplier=(a,b)=>beats[a]===b?1.25:beats[b]===a?.8:1;
const out=[];
for(const zone of PVE_ZONES){const fight=zone.fights.at(-1),wins={};for(const rank of [1,3,5]){let w=0,t=0,hp=0;const species={};for(const creature of creatures){let cw=0;for(let i=0;i<40;i++){const p=buildLovysBattleStats({creature,level:Number(process.env.SIM_LEVEL)||fight.level,rank});const s=createBattleState({fight,player:p,typeMultiplier:multiplier(creature.type,fight.type)});for(let turn=0;turn<30&&s.status==='active';turn++){const skill=[...s.player.skills].reverse().find(sk=>Number(s.player.cooldowns[sk.key]||0)<=1);resolveBattleAction(s,skill?.key||'basic');}if(s.status==='victory'){w++;cw++;hp+=s.player.hp/s.player.maxHp;}t+=s.round;}species[creature.id]=Math.round(cw/40*100);}wins[rank]={winPercent:Math.round(w/(creatures.length*40)*100),turns:+(t/(creatures.length*40)).toFixed(1),hpPercent:w?Math.round(hp/w*100):0,species};}out.push({zone:zone.key,level:fight.level,wins});}
console.log(out.map(x=>({zone:x.zone,level:x.level,r1:x.wins[1].winPercent,r3:x.wins[3].winPercent,r5:x.wins[5].winPercent,turns:x.wins[1].turns,hp:x.wins[1].hpPercent})));
