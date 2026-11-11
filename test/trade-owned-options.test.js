import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const ui=fs.readFileSync(new URL('../public/app.js',import.meta.url),'utf8');

function allowed(inventory){
  const start=ui.indexOf('function tradeAvailableOfferTypes(inventory) {');
  const end=ui.indexOf('const TRADE_OFFER_TYPE_OPTIONS=',start);
  assert.ok(start>=0&&end>start,'owned-only trade choices must exist');
  const ctx=vm.createContext({});
  vm.runInContext(ui.slice(start,end),ctx);
  return Array.from(ctx.tradeAvailableOfferTypes(inventory));
}

test('public offers list only objects actually owned, including exact boost durations',()=>{
  assert.deepEqual(allowed({lovys:[],eggs:0,xpBottles:0,xpGourds:0,xpBoosts:0,xpBoosts5h:0,xpBoosts10h:0}),[]);
  assert.deepEqual(allowed({lovys:[{creatureId:'mossy',fragments:0}],eggs:2,xpBottles:0,xpGourds:1,xpBoosts:0,xpBoosts5h:0,xpBoosts10h:2}),['egg','xp_gourd','xp_boost_10h']);
  assert.deepEqual(allowed({lovys:[{creatureId:'mossy',fragments:3}],eggs:0,xpBottles:1,xpGourds:0,xpBoosts:2,xpBoosts5h:1,xpBoosts10h:0}),['fragment','xp_bottle','xp_boost','xp_boost_5h']);
  assert.deepEqual(allowed(null),[]);
});

test('the offering selector is rebuilt from ownership, while requested options remain independent',()=>{
  const start=ui.indexOf('function syncTradeOfferInventoryChoices(){');
  const end=ui.indexOf('function syncTradeOfferFields() {',start);
  assert.ok(start>=0&&end>start);
  const code=ui.slice(start,end);
  assert.match(code,/TRADE_OFFER_TYPE_OPTIONS\.filter\(option=>available\.includes\(option\.value\)\)/);
  assert.match(code,/tradeCreatureOptions\(originalCreature,true\)/);
  assert.match(ui,/function tradeOptionRow\(index\)/);
  assert.match(ui,/function tradeCreatureOptions\(selected='',ownedOnly=false\)/);
  assert.match(ui,/function openTradeComposer\(prefillCreature=''\)[\s\S]*?syncTradeOfferInventoryChoices\(\)/);
  assert.match(ui,/function setupDesktopTradeComposer\(\)[\s\S]*?syncTradeOfferInventoryChoices\(\)/);
  assert.match(ui,/if \(!tradeAvailableOfferTypes\(tradeInventory\)\.includes\(offer\.type\)/);
});

test('both mobile and desktop check the offering quantity before publication',()=>{
  const idx=ui.indexOf("$('tradePublish')?.addEventListener('click',()=>{");
  assert.ok(idx>=0);
  const code=ui.slice(idx,idx+450);
  assert.match(code,/const error=validateDesktopTradeComposer\(true\)/);
  assert.doesNotMatch(code,/if\(isDesktopGameUi\(\)\)/);
});

test('private offers continue using each players actual inventory for both sides',()=>{
  assert.match(ui,/const source=side==='offered'\?playerTradeInventory:playerCollectionData/);
  assert.match(ui,/const receiver=side==='offered'\?playerCollectionData:playerTradeInventory/);
  assert.match(ui,/source\.lovys\.filter\(l=>receiverIds\.has\(l\.creatureId\) && Number\(l\.fragments\)>0\)/);
});
