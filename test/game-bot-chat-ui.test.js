import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source=fs.readFileSync(new URL('../public/bot-studio.js',import.meta.url),'utf8');
const notice=source.slice(source.indexOf('let adminBotActionNotice=null;'),source.indexOf('async function loadGameBotPanel(){'));
const start=source.indexOf("  const action=event.target.closest('[data-game-bot-subscribe]");
const body=source.slice(start,source.indexOf("\n});",start));
function setup(request){
  let status={textContent:'',dataset:{}};const attributes=new Set(['data-game-bot-test']);
  const action={disabled:false,textContent:'Tester le chat',dataset:{},hasAttribute:name=>attributes.has(name),setAttribute:name=>attributes.add(name),removeAttribute:name=>attributes.delete(name)};
  const context=vm.createContext({$:()=>({querySelector:()=>status}),adminFetch:request,loadGameBotPanel:async()=>{status={textContent:'',dataset:{}};}});
  vm.runInContext(notice+'\nasync function act(event){'+body+'}',context);
  return {action,context,get status(){return status;},click:()=>context.act({target:{closest:()=>action}})};
}
test('le bouton attend la confirmation, empêche les doubles clics et affiche le succès près des contrôles',async()=>{
  let resolve,calls=0;const s=setup(async url=>{calls++;assert.equal(url,'/api/admin/game-bot/test');return new Promise(done=>{resolve=done;});});
  const pending=s.click();assert.equal(s.action.disabled,true);assert.equal(s.action.textContent,'Envoi du test…');assert.match(s.status.textContent,/Envoi/);
  await s.click();assert.equal(calls,1);resolve({message:'Message de test envoyé.'});await pending;
  assert.equal(s.status.textContent,'Message de test envoyé.');assert.equal(s.action.disabled,false);assert.equal(s.action.textContent,'Tester le chat');
});
test('une erreur visible ne disparaît pas au prochain rafraîchissement et le bouton redevient utilisable',async()=>{
  const s=setup(async()=>{throw Error('Twitch refuse : autorisation manquante.');});await s.click();
  assert.match(s.status.textContent,/autorisation manquante/);assert.equal(s.status.dataset.error,'true');assert.equal(s.action.disabled,false);
  await s.context.loadGameBotPanel();vm.runInContext('setBotActionNotice(adminBotActionNotice.message,adminBotActionNotice.error)',s.context);
  assert.match(s.status.textContent,/autorisation manquante/);assert.equal(s.status.dataset.error,'true');
});
