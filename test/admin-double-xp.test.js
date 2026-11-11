import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../server.js', import.meta.url), 'utf8');
const ui = fs.readFileSync(new URL('../public/app.js', import.meta.url), 'utf8');
const start = source.indexOf("app.post('/api/admin/players/:accountId/action'");
const end = source.indexOf("app.delete('/api/admin/players/:accountId'", start);
assert.ok(start > 0 && end > start, 'Route administrateur introuvable');

function adminHarness() {
  const inventory = new Map();
  let activeSeconds = 14 * 3600;
  const audit = [];
  let handler;
  const query = async (sql, args = []) => {
    const statement = String(sql).trim();
    if (['BEGIN','COMMIT','ROLLBACK'].includes(statement)) return {rows:[],rowCount:0};
    if (statement.includes('SELECT a.id,a.username,a.twitch_id,u.id user_id')) {
      return {rows:[{id:7,username:'ViewerTest',twitch_id:'test-twitch',user_id:11}],rowCount:1};
    }
    if (statement.includes('INSERT INTO shop_inventory(account_id,item_key,quantity)')) {
      const [accountId,key,quantity] = args;
      assert.equal(accountId,7);
      inventory.set(key,(inventory.get(key)||0)+quantity);
      return {rows:[],rowCount:1};
    }
    if (statement.includes('UPDATE shop_inventory SET quantity=quantity-$3')) {
      const [accountId,key,quantity] = args;
      assert.equal(accountId,7);
      if ((inventory.get(key)||0) < quantity) return {rows:[],rowCount:0};
      inventory.set(key,inventory.get(key)-quantity);
      return {rows:[{quantity:inventory.get(key)}],rowCount:1};
    }
    if (statement.startsWith('UPDATE user_active_boosts')) {
      assert.equal(args[0],11);
      const hours=args[1];
      if (activeSeconds < hours*3600) return {rows:[],rowCount:0};
      activeSeconds -= hours*3600;
      return {rows:[{remaining_live_seconds:activeSeconds}],rowCount:1};
    }
    throw new Error('Unexpected admin SQL: '+statement.slice(0,130));
  };
  const context = vm.createContext({
    app:{post(_path,cb){handler=cb;}},
    pool:{connect:async()=>({query,release(){}})},
    getBroadcasterAccount:async()=>({id:99}),
    logAdminAction:async (...args)=>audit.push(args),
    pushLiveUpdate:()=>{},
    console
  });
  vm.runInContext(source.slice(start,end),context);
  assert.equal(typeof handler,'function');
  async function act(action, data={}) {
    const response={status:200,body:null};
    const res={
      status(code){response.status=code;return this;},
      json(body){response.body=body;return this;}
    };
    await handler({params:{accountId:'7'},body:{action,...data}},res);
    return response;
  }
  return {inventory,audit,act,getActiveSeconds:()=>activeSeconds};
}

test('admin gives precise Double XP items of 2h, 5h and 10h (never twice the duration)',async()=>{
  const h=adminHarness();
  for (const [hours,key] of [[2,'boost_xp_x2'],[5,'boost_xp_x2_5h'],[10,'boost_xp_x2_10h']]) {
    const result=await h.act('grant_xp_boost_hours',{boostHours:hours,amount:2});
    assert.equal(result.status,200);
    assert.equal(h.inventory.get(key),2);
    assert.equal(h.audit.at(-1)[2],'grant_xp_boost_hours');
  }
  assert.equal(h.getActiveSeconds(),14*3600,'gifts must not activate a boost');
});

test('removing an inventory boost does not touch active hours, refuses overspending',async()=>{
  const h=adminHarness();
  await h.act('grant_xp_boost_hours',{boostHours:5,amount:3});
  let response=await h.act('remove_xp_boost_inventory',{boostHours:5,amount:2});
  assert.equal(response.status,200);
  assert.equal(h.inventory.get('boost_xp_x2_5h'),1);
  assert.equal(h.getActiveSeconds(),14*3600);
  response=await h.act('remove_xp_boost_inventory',{boostHours:5,amount:2});
  assert.equal(response.status,409);
  assert.equal(h.inventory.get('boost_xp_x2_5h'),1);
});

test('removing active hours preserves inventory, refuses overspending',async()=>{
  const h=adminHarness();
  await h.act('grant_xp_boost_hours',{boostHours:10,amount:1});
  let response=await h.act('remove_active_xp_boost_hours',{amount:4});
  assert.equal(response.status,200);
  assert.equal(h.getActiveSeconds(),10*3600);
  assert.equal(h.inventory.get('boost_xp_x2_10h'),1);
  response=await h.act('remove_active_xp_boost_hours',{amount:11});
  assert.equal(response.status,409);
  assert.equal(h.getActiveSeconds(),10*3600);
});

test('admin Double XP validates durations and amounts',async()=>{
  const h=adminHarness();
  for(const data of [{boostHours:3,amount:1},{boostHours:5,amount:0},{boostHours:10,amount:21}]){
    const response=await h.act('grant_xp_boost_hours',data);
    assert.equal(response.status,400);
  }
  assert.equal((await h.act('remove_active_xp_boost_hours',{amount:201})).status,400);
  assert.equal((await h.act('remove_xp_boost_inventory',{boostHours:2,amount:-1})).status,400);
});

test('admin buttons, confirmation and payload exist for desktop and mobile',()=>{
  for(const action of ['grant_xp_boost_hours','remove_xp_boost_inventory','remove_active_xp_boost_hours']){
    assert.match(ui,new RegExp('data-admin-action="'+action+'"'));
    assert.match(ui,new RegExp("if\\(action==='"+action+"'\\)"));
  }
  assert.match(ui,/data-admin-remove-boost-hours/);
  assert.match(ui,/activeXpBoostSeconds/);
});
