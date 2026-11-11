import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
for(const file of ['app.js','app.min.js'])test(`cash previews match normal and boss rewards in ${file}`,()=>{
 const source=fs.readFileSync(new URL('../public/'+file,import.meta.url),'utf8');
 const ctx=vm.createContext({});
 vm.runInContext(source.slice(source.indexOf('function pveCashRewardText('),source.indexOf('function pveFightDetailMarkup(')),ctx);
 assert.equal(ctx.pveCashRewardText({}),'3 à 5');
 for(const f of [{boss:true},{miniBoss:true},{finalBoss:true}])assert.equal(ctx.pveCashRewardText(f),'10');
 assert.match(ctx.pveReplayRewardsText({replayRewardAvailable:true,rewards:{creatureXp:12}}),/12 XP Lovys.*3 à 5 LoVeR/);
 assert.match(ctx.pveReplayRewardsText({replayRewardAvailable:false}),/aucune récompense/);
});
