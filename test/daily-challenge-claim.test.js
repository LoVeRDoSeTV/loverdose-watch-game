import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
const code=source.slice(source.indexOf('const dailyChallengeClaims='),source.indexOf('\nfunction syncLoverCashDisplays('));
function setup(){
  const challenge={key:'watch_60',title:'Présence active',type:'watch',goal:3600,progress:3600,completed:true,claimed:false,rewardCash:5,rewardGlobalXp:15,rewardLovysXp:10};
  let list={date:'2026-10-25',challenges:[challenge]};
  const nodes=new Map(),requests=[];
  function node(id){
    if(!nodes.has(id)){
      const classes=new Set(id==='dailyChallengeDetailModal'?['hidden']:[]);
      nodes.set(id,{textContent:'',innerHTML:'',hidden:false,className:'',style:{setProperty(){},removeProperty(){}},setAttribute(){},
        classList:{add(c){classes.add(c);},remove(c){classes.delete(c);},contains(c){return classes.has(c);}}});
    }
    return nodes.get(id);
  }
  const context=vm.createContext({$:node,dailyChallengesData:structuredClone(list),dailyCarouselTimer:null,me:{user:{points:20}},document:{querySelectorAll:()=>[]},clearInterval(){},escapeHtml:x=>String(x??''),renderNextActions(){},console,
    fetch:async(url,options)=>url==='/api/daily-challenges'?{ok:true,json:async()=>structuredClone(list)}:new Promise(resolve=>requests.push({key:JSON.parse(options.body).challengeKey,resolve})),
    syncLoverCashDisplays(){},loadGame:async()=>{throw Error('Refresh failed');},loadLeaderboard:async()=>{}});
  vm.runInContext(code,context);const run=script=>vm.runInContext(script,context);
  const succeed=()=>requests.at(-1).resolve({ok:true,json:async()=>({rewardCash:5,rewardGlobalXp:15,rewardLovysXp:10,lovysXpPending:true,balance:25})});
  return {run,node,requests,succeed,get list(){return list;},set list(value){list=value;}};
}

test('detail locks repeated claims and displays success even when a refresh fails or returns stale data',async()=>{
  const s=setup();s.run("renderDailyChallengeDetail('watch_60')");const pending=s.run("claimDailyChallenge('watch_60')");
  assert.match(s.node('dailyChallengeDetailActions').innerHTML,/disabled.*Récupération/);
  assert.match(s.node('dailyChallengeDetailMessage').textContent,/Récupération/);
  await s.run("claimDailyChallenge('watch_60')");assert.equal(s.requests.length,1);
  s.succeed();await pending;
  assert.equal(s.run("getDailyChallengeByKey('watch_60').claimed"),true);
  assert.doesNotMatch(s.node('dailyChallengeDetailActions').innerHTML,/data-daily-claim/);
  assert.match(s.node('dailyChallengeDetailMessage').textContent,/5.*LoVeR.Cash.*15.*XP globale.*10.*XP Lovys en attente/);
  assert.equal(s.node('dailyChallengeDetailMessage').hidden,false);
  assert.equal(s.node('dailyChallengeDetailMessage').className,'daily-challenge-detail-message ok');
  assert.equal(s.run('me.user.points'),25);
});

test('server refusal is visible inside the popup and permits retry without marking the reward claimed',async()=>{
  const s=setup();s.run("renderDailyChallengeDetail('watch_60')");const pending=s.run("claimDailyChallenge('watch_60')");
  s.requests[0].resolve({ok:false,json:async()=>({error:'Défi pas encore terminé.'})});await pending;
  assert.equal(s.run("getDailyChallengeByKey('watch_60').claimed"),false);
  assert.equal(s.node('dailyChallengeDetailMessage').className,'daily-challenge-detail-message error');
  assert.match(s.node('dailyChallengeDetailMessage').textContent,/pas encore terminé/);
  assert.doesNotMatch(s.node('dailyChallengeDetailActions').innerHTML,/disabled/);
  const retry=s.run("claimDailyChallenge('watch_60')");assert.equal(s.requests.length,2);s.succeed();await retry;
});

test('completion does not reopen a popup closed during the claim',async()=>{
  const s=setup();s.run("renderDailyChallengeDetail('watch_60')");const pending=s.run("claimDailyChallenge('watch_60')");s.run('closeDailyChallengeDetail()');s.succeed();await pending;
  assert.equal(s.node('dailyChallengeDetailModal').classList.contains('hidden'),true);
});

test('a new day clears old success feedback and allows the new daily challenge state',async()=>{
  const s=setup();s.run("renderDailyChallengeDetail('watch_60')");const pending=s.run("claimDailyChallenge('watch_60')");s.succeed();await pending;
  s.list={date:'2026-10-26',challenges:[{...s.list.challenges[0],completed:false,claimed:false,progress:0}]};await s.run('loadDailyChallenges()');
  assert.equal(s.run("getDailyChallengeByKey('watch_60').claimed"),false);
  assert.equal(s.node('dailyChallengeDetailMessage').hidden,true);
  assert.equal(s.node('dailyChallengeDetailState').textContent,'En cours');
});
