import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
const shop=source.slice(source.indexOf('const FRAGMENT_EGG_PRICE=10;'),source.indexOf('\nlet pveMapState='));
function setup(balance=37){
  const nodes=new Map(),requests=[];
  const document={activeElement:null,addEventListener(){}};
  function node(id){
    if(!nodes.has(id)){
      const classes=new Set(id==='fragmentShopModal'||id==='pveModal'?['hidden']:[]);
      const element={textContent:'',className:'',dataset:{},hidden:false,disabled:false,isConnected:true,scrollTop:0,
        classList:{add(...items){items.forEach(x=>classes.add(x));},remove(...items){items.forEach(x=>classes.delete(x));},contains(x){return classes.has(x);}},
        focus(){document.activeElement=element;},scrollIntoView(){},setAttribute(){},addEventListener(){},querySelector:node};
      nodes.set(id,element);
    }
    return nodes.get(id);
  }
  const state={me:{user:{egg_fragments:balance}},pveMapState:{data:{eggFragments:balance}}};
  const context=vm.createContext({...state,document,$:node,window:{matchMedia:()=>({matches:true})},
    fetch:async(url,options)=>new Promise(resolve=>requests.push({url,quantity:JSON.parse(options.body).quantity,resolve})),
    setHubFragmentsButton(){},loadGame:async()=>{throw Error('Refresh offline');},loadShop:async()=>{},loadPve:async()=>{},trapDesktopAdminFocus(){}});
  vm.runInContext(shop,context);
  const run=code=>vm.runInContext(code,context);
  return {node,state,requests,run};
}

test('confirmation shows the exact cost; cancel never spends fragments',async()=>{
  const s=setup();s.run('openFragmentShop();fragmentShopQty=2;');
  await s.run('buyFragmentShopEgg()');
  assert.equal(s.requests.length,0);
  assert.match(s.node('fragmentShopConfirmationCopy').textContent,/20 fragments contre 2 œufs/);
  assert.match(s.node('fragmentShopConfirmationBalance').textContent,/17 fragments/);
  assert.equal(s.node('fragmentShopPlus').disabled,true);
  s.run('cancelFragmentShopConfirmation()');
  assert.equal(s.run('fragmentShopPhase'),'choose');
  assert.equal(s.state.me.user.egg_fragments,37);
  assert.equal(s.requests.length,0);
});

test('one confirmed order survives repeated clicks and reopening; success uses server values',async()=>{
  const s=setup();s.run('openFragmentShop();fragmentShopQty=2;');await s.run('buyFragmentShopEgg()');
  const pending=s.run('buyFragmentShopEgg()');
  await s.run('buyFragmentShopEgg()');s.run('closeFragmentShop();openFragmentShop()');await s.run('buyFragmentShopEgg()');
  assert.equal(s.requests.length,1);
  assert.equal(s.requests[0].quantity,2);
  assert.equal(s.run('fragmentShopPhase'),'pending');
  assert.equal(s.state.me.user.egg_fragments,37,'no local debit before server success');
  s.requests[0].resolve({ok:true,json:async()=>({quantity:2,spent:20,fragments:17})});await pending;
  assert.equal(s.run('fragmentShopPhase'),'success');
  assert.equal(s.state.me.user.egg_fragments,17);
  assert.equal(s.state.pveMapState.data.eggFragments,17);
  assert.match(s.node('fragmentShopExchangeAmounts').textContent,/−20 fragments → \+2 œufs/);
  assert.match(s.node('fragmentShopExchangeTitle').textContent,/Œufs ajoutés/);
});

test('server rejection restores the shop without success or a local debit',async()=>{
  const s=setup();s.run('openFragmentShop()');await s.run('buyFragmentShopEgg()');const pending=s.run('buyFragmentShopEgg()');
  s.requests[0].resolve({ok:false,json:async()=>({error:'Solde insuffisant.'})});await pending;
  assert.equal(s.run('fragmentShopPhase'),'choose');
  assert.equal(s.node('fragmentShopExchange').hidden,true);
  assert.equal(s.state.me.user.egg_fragments,37);
  assert.equal(s.node('fragmentShopMessage').textContent,'Solde insuffisant.');
});

test('insufficient or changed balance cannot confirm; quantity matches the server limit',async()=>{
  const s=setup(7);s.run('openFragmentShop()');await s.run('buyFragmentShopEgg()');assert.equal(s.requests.length,0);
  s.state.pveMapState.data.eggFragments=2000;s.run('fragmentShopQty=150;updateFragmentShopUi()');assert.equal(s.run('fragmentShopQty'),99);
  await s.run('buyFragmentShopEgg()');s.state.pveMapState.data.eggFragments=0;await s.run('buyFragmentShopEgg()');
  assert.equal(s.requests.length,0);assert.equal(s.run('fragmentShopPhase'),'choose');
  assert.match(s.node('fragmentShopMessage').textContent,/solde a changé/);
});
