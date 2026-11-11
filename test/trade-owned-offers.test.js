import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
const excerpt=source.slice(source.indexOf("function tradeCreatureOptions("),source.indexOf("function tradeCreaturePreviewMarkup("));
assert.ok(excerpt.includes('function syncTradeOwnedOfferOptions('),'Le filtrage doit exister dans le jeu.');

const types=[
  ['fragment','🧩 Fragments d’un Lovys'],
  ['egg','🥚 Œuf mystère'],
  ['xp_bottle','🧪 Fiole de 100 XP'],
  ['xp_gourd','🫙 Gourde de 500 XP'],
  ['xp_boost','⚡ Double XP 2h'],
  ['xp_boost_5h','⚡ Double XP 5h'],
  ['xp_boost_10h','⚡ Double XP 10h']
];

class FakeSelect {
  constructor(options=[]){this.options=options.map(([value,textContent])=>({value,textContent}));this.value=this.options[0]?.value||'';this.disabled=false;this._html='';}
  set innerHTML(value){
    this._html=value;
    this.options=[...value.matchAll(/<option value="([^"]*)"[^>]*>([^<]*)<\/option>/g)]
      .map(match=>({value:match[1],textContent:match[2]}));
    this.value=this.options[0]?.value||'';
  }
  get innerHTML(){return this._html;}
}

function setup(inventory,startingType='fragment') {
  const type=new FakeSelect(types),creature=new FakeSelect();
  type.value=startingType;
  const nodes={tradeOfferType:type,tradeOfferCreature:creature};
  const context=vm.createContext({
    tradeInventory:inventory,
    $:name=>nodes[name],
    escapeHtml:value=>String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;')
  });
  vm.runInContext(excerpt,context);
  return {type,creature,context};
}

test('public exchange only lists owned, available types (mobile and desktop)',()=>{
  const inventory={lovys:[{creatureId:'plant',name:'Mossy',fragments:0},{creatureId:'water',name:'Nymea',fragments:3}],
    eggs:0,xpBottles:2,xpGourds:0,xpBoosts:0,xpBoosts5h:1,xpBoosts10h:0};
  const {type,creature,context}=setup(inventory);
  assert.equal(context.syncTradeOwnedOfferOptions(),true);
  assert.deepEqual(type.options.map(option=>option.value),['fragment','xp_bottle','xp_boost_5h']);
  assert.equal(creature.options.length,1);
  assert.equal(creature.options[0].value,'water');
  assert.equal(type.disabled,false);
  assert.equal(type.innerHTML.includes('xp_boost_10h'),false);
});

test('inventory with no tradeable objects shows only an empty message and disables selection',()=>{
  const {type,creature,context}=setup({lovys:[{creatureId:'plant',name:'Mossy',fragments:0}],
    eggs:0,xpBottles:0,xpGourds:0,xpBoosts:0,xpBoosts5h:0,xpBoosts10h:0});
  assert.equal(context.syncTradeOwnedOfferOptions(),false);
  assert.equal(type.disabled,true);
  assert.deepEqual(type.options.map(option=>option.value),['']);
  assert.equal(type.value,'');
  assert.equal(creature.options.length,0);
  assert.match(type.innerHTML,/Aucun objet disponible à proposer/);
});

test('newly acquired stock appears when the composer reloads its inventory',()=>{
  const inventory={lovys:[],eggs:0,xpBottles:0,xpGourds:0,xpBoosts:0,xpBoosts5h:0,xpBoosts10h:0};
  const {type,context}=setup(inventory);
  assert.equal(context.syncTradeOwnedOfferOptions(),false);
  inventory.eggs=1;
  inventory.xpBoosts10h=2;
  assert.equal(context.syncTradeOwnedOfferOptions(),true);
  assert.deepEqual(type.options.map(option=>option.value),['egg','xp_boost_10h']);
  assert.equal(type.value,'egg');
});

test('wanted alternatives keep the catalogue and the server validates reservations',()=>{
  assert.match(source,/function tradeOptionRow\(index\)\{return.*?<option value="xp_boost_10h">/);
  assert.match(source,/function tradeCreatureOptions\(selected='',ownedOnly=false\)/);
  assert.match(source,/!tradeOwnedOfferTypes\(\)\.includes\(offerType\)/);
  const server=fs.readFileSync(new URL('../server.js',import.meta.url),'utf8');
  assert.match(server,/await changeTradeAsset\(client,ctx,offered,-offered\.quantity\)/);
  assert.match(server,/if\(await tradeAssetBalance\(client,target,asset,true\)<asset\.quantity\)/);
});
