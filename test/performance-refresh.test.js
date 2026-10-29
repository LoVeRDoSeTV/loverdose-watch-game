import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source=fs.readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
const slice=(start,end)=>source.slice(source.indexOf(start),source.indexOf(end,source.indexOf(start)));
const flush=()=>new Promise(resolve=>setImmediate(resolve));
const deferred=()=>{let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});return {promise,resolve,reject};};

test('overlapping game refreshes run serially with one fresh trailing read',async()=>{
  const context=vm.createContext({});vm.runInContext(slice('function createTrailingRefresh(task){','const queuedGameRefresh='),context);
  const first=deferred();let value=1,active=0,max=0;const reads=[];
  const run=context.createTrailingRefresh(async()=>{active++;max=Math.max(max,active);reads.push(value);if(reads.length===1)await first.promise;active--;});
  const a=run();await flush();value=12;const b=run(),c=run();first.resolve();await Promise.all([a,b,c]);
  assert.deepEqual(reads,[1,12]);assert.equal(max,1);
});
test('a failed queued refresh does not permanently lock later updates',async()=>{
  const context=vm.createContext({});vm.runInContext(slice('function createTrailingRefresh(task){','const queuedGameRefresh='),context);let calls=0;
  const run=context.createTrailingRefresh(async()=>{if(++calls===1)throw Error('offline');});await assert.rejects(run(),/offline/);await run();assert.equal(calls,2);
});
function liveContext(){
  let now=10000,requests=0,next;const context=vm.createContext({Date:{now:()=>now},fetch:async()=>{requests++;return next();},AbortController,setTimeout:()=>1,clearTimeout(){}});
  vm.runInContext(slice('let homeLiveStatusRequest=null','async function refreshDesktopHomeLiveStatus()'),context);
  return {context,get requests(){return requests;},setNext(fn){next=fn;},advance(ms){now+=ms;}};
}
test('incubator and home consumers share one status request and renew the short cache',async()=>{
  const s=liveContext(),gate=deferred();s.setNext(()=>gate.promise);
  const first=s.context.readHomeLiveStatus(),second=s.context.readHomeLiveStatus();assert.equal(s.requests,1);
  gate.resolve({ok:true,json:async()=>({live:true})});await Promise.all([first,second]);await s.context.readHomeLiveStatus();assert.equal(s.requests,1);
  s.advance(1001);await s.context.readHomeLiveStatus();assert.equal(s.requests,2);
});
test('a failed live-status request can be retried and is not cached',async()=>{
  const s=liveContext();s.setNext(()=>({ok:false}));await assert.rejects(s.context.readHomeLiveStatus());s.setNext(()=>({ok:true,json:async()=>({live:false})}));assert.equal((await s.context.readHomeLiveStatus()).live,false);assert.equal(s.requests,2);
});
test('dashboard modules start together after incubation data, even if one module fails',async()=>{
  const incubation=deferred(),modules=Array.from({length:4},deferred),started=[];let finished=false;
  const context=vm.createContext({fetch:async()=>({ok:true,json:async()=>({authenticated:true,user:{}})}),cosmeticRevision:0,cosmeticPending:new Map(),me:null,Date,lastGameRefreshAt:0,
    $:()=>({classList:{add(){},remove(){}}}),isMobileGameUi:()=>false,window:{},console,
    loadIncubatorSlots:()=>incubation.promise,
    ...Object.fromEntries(['syncDesktopLovysHub','loadBadges','loadDailyChallenges','loadRewardWheels'].map((name,i)=>[name,()=>{started.push(name);return modules[i].promise;}]))});
  for(const name of ['refreshReturnSummary','reapplyPendingCosmetics','startLiveUpdates','refreshDesktopHomeLiveStatus','syncLoverCashDisplays','renderPlayerVisitCard','renderPlayerSubscriptionStatus','renderGame','renderNextActions','updatePwaInstallUi','setupTopDashboardSync','scheduleTopDashboardSync'])context[name]=()=>{};
  vm.runInContext(slice('async function loadGameOnce() {','let incubatorData = null;'),context);
  const pending=context.loadGameOnce().then(()=>{finished=true;});await flush();assert.equal(started.length,0);
  incubation.resolve();await flush();assert.equal(started.length,4);assert.equal(finished,false);
  modules[0].resolve();modules[1].reject(Error('module temporarily unavailable'));modules[2].resolve();modules[3].resolve();await pending;assert.equal(finished,true);
});
test('layout bursts schedule one calculation per animation frame',()=>{
  const frames=[];let calculations=0;const context=vm.createContext({window:{requestAnimationFrame(fn){frames.push(fn);return frames.length;}},syncTopDashboardHeights(){calculations++;}});
  vm.runInContext(slice('let topDashboardSyncFrame=null;','let topDashboardResizeObserver = null;'),context);
  for(let i=0;i<30;i++)context.scheduleTopDashboardSync();assert.equal(frames.length,1);frames[0]();assert.equal(calculations,1);context.scheduleTopDashboardSync();assert.equal(frames.length,2);
});
test('periodic safety polling skips hidden tabs, closed rankings and already fresh game state',()=>{
  let tick,game=0,ranking=0,visible=false;const document={hidden:false};const context=vm.createContext({setInterval(fn){tick=fn;},document,me:{user:{}},Date:{now:()=>30000},lastGameRefreshAt:29000,leaderboardIsVisible:()=>visible,loadGame(){game++;},loadLeaderboard(){ranking++;}});
  const start=source.indexOf('// Filet de sécurité si une connexion SSE');vm.runInContext(source.slice(start,source.indexOf('\n\nfunction handleDailyChallengeAction',start)),context);
  tick();assert.equal(game,0);assert.equal(ranking,0);context.lastGameRefreshAt=0;tick();assert.equal(game,1);visible=true;tick();assert.equal(ranking,1);document.hidden=true;tick();assert.equal(game,2);assert.equal(ranking,1);
});
test('an older ranking response cannot overwrite the latest search',async()=>{
  const responses=[deferred(),deferred()],container={innerHTML:''};let requests=0;
  const context=vm.createContext({$:id=>id==='leaderboard'?container:{value:''},document:{},leaderboardRequestId:0,leaderboardMetric:'watch',LEADERBOARD_METRICS:{watch:{}},URLSearchParams,fetch:()=>responses[requests++].promise,console});
  vm.runInContext(slice('async function loadLeaderboard(searchTerm','let progressionDragCleanup=null;'),context);
  const old=context.loadLeaderboard('older'),latest=context.loadLeaderboard('');responses[1].resolve({json:async()=>({leaderboard:[]})});await latest;const expected=container.innerHTML;
  responses[0].resolve({json:async()=>({leaderboard:[]})});await old;assert.equal(container.innerHTML,expected);assert.match(expected,/pour le moment/);
});
function target(){const events=new Map(),classes=new Set();return {scrollLeft:0,events,classList:{add:x=>classes.add(x),remove:x=>classes.delete(x)},addEventListener(name,fn){if(!events.has(name))events.set(name,new Set());events.get(name).add(fn);},removeEventListener(name,fn){events.get(name)?.delete(fn);},dispatch(name,event){for(const fn of events.get(name)||[])fn(event);}};}
test('reopening progression replaces global drag listeners instead of retaining old pages',()=>{
  const window=target(),old=target(),latest=target(),context=vm.createContext({window});vm.runInContext(slice('let progressionDragCleanup=null;','function progressionPct('),context);
  context.bindProgressionDrag(old);context.bindProgressionDrag(latest);assert.equal(window.events.get('mousemove').size,1);assert.equal(old.events.get('mousedown').size,0);
  latest.dispatch('mousedown',{button:0,clientX:100,preventDefault(){}});window.dispatch('mousemove',{buttons:1,clientX:80,preventDefault(){}});assert.equal(latest.scrollLeft,20);assert.equal(old.scrollLeft,0);
  context.bindProgressionDrag(latest);assert.equal(window.events.get('mousemove').size,1);
});
test('boost refresh pauses in a hidden game tab but continues for OBS overlays',async()=>{
  const script=fs.readFileSync(new URL('../public/live-xp-boost.js',import.meta.url),'utf8');const code=script.slice(script.indexOf('  async function refresh() {'),script.indexOf("  if (document.body.classList.contains('boost-overlay-page')"));
  let calls=0;const context=vm.createContext({document:{hidden:true},isOverlay:false,pending:false,queued:false,signalRevision:0,Date,AbortController,setTimeout:()=>1,clearTimeout(){},fetch:async()=>{calls++;return {ok:true,json:async()=>({})};},applyStatus(){}});
  vm.runInContext(code,context);await context.refresh();assert.equal(calls,0);context.isOverlay=true;await context.refresh();assert.equal(calls,1);
});
