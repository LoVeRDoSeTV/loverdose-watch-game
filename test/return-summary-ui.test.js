import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source=fs.readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
const state=source.slice(source.indexOf('let returnSummaryBusy=false;'),source.indexOf('function showReturnSummary('));
const refresh=source.slice(source.indexOf('async function refreshReturnSummary(){'),source.indexOf('function leaveGameTab(){'));
function setup(){
  const shown=[],requests=[],document={hidden:false};let next;
  const context=vm.createContext({document,me:{user:{id:1}},returnSummaryTabId:'tab-12345678',showReturnSummary:summary=>shown.push(summary),leaveGameTab:()=>{},console:{warn(){}},fetch:async(...args)=>{requests.push(args);return next();}});
  vm.runInContext(state+refresh,context);
  return {document,shown,requests,setNext(value){next=value;},async refresh(){await context.refreshReturnSummary();}};
}
const summary={watchSeconds:360,loverCash:2,globalXp:4,lovysXp:10};
const response=()=>({ok:true,json:async()=>({summary})});
test('le premier retour affiche les gains une fois, les retours d’onglet et heartbeats restent silencieux',async()=>{
  const s=setup();s.setNext(response);await s.refresh();assert.equal(s.shown.length,1);assert.equal(s.shown[0].loverCash,2);
  await s.refresh();s.document.hidden=true;await s.refresh();s.document.hidden=false;await s.refresh();
  assert.equal(s.requests.length,3);assert.equal(s.shown.length,1);
});
test('un premier chargement sans gains ne déclenche pas un accueil plus tard dans la page ouverte',async()=>{
  const s=setup();s.setNext(()=>({ok:true,json:async()=>({summary:{watchSeconds:0}})}));await s.refresh();s.setNext(response);await s.refresh();assert.equal(s.shown.length,0);
});
test('un échec initial permet de réessayer sans perdre le récapitulatif',async()=>{
  const s=setup();s.setNext(()=>({ok:false}));await s.refresh();s.setNext(()=>{throw Error('offline');});await s.refresh();s.setNext(response);await s.refresh();await s.refresh();assert.equal(s.shown.length,1);
});
test('une réponse initiale reçue en arrière-plan attend le retour visible et ne se répète pas',async()=>{
  const s=setup();let resolve;s.setNext(()=>new Promise(done=>{resolve=done;}));const pending=s.refresh();await s.refresh();assert.equal(s.requests.length,1);
  s.document.hidden=true;resolve(response());await pending;assert.equal(s.shown.length,0);
  s.document.hidden=false;s.setNext(response);await s.refresh();assert.equal(s.shown.length,1);await s.refresh();assert.equal(s.shown.length,1);
});
