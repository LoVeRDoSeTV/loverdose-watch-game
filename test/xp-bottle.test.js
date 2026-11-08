import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';
import {PGlite} from '@electric-sql/pglite';
import {LOVYS_MAX_XP} from '../src/xp-economy.js';
import {BETA_TESTER_TITLE} from '../src/permanent-rewards.js';
import {STREAK_COSMETICS} from '../src/watch-streak-rewards.js';
const source=fs.readFileSync(new URL('../server.js',import.meta.url),'utf8');
let db,client,context,historyFails=false,notificationsFail=false;const routes=new Map();
const response=()=>({statusCode:200,status(n){this.statusCode=n;return this;},json(body){this.body=body;return this;}});
async function call(path,body={},authenticated=true){const res=response();await routes.get(path)({session:authenticated?{account:{id:1},user:{twitchId:'player'}}:{},body},res);return res;}
async function user(){return (await client.query('SELECT * FROM users WHERE id=1')).rows[0];}
async function quantity(){return Number((await client.query("SELECT quantity FROM shop_inventory WHERE account_id=1 AND item_key='xp_bottle_100'")).rows[0]?.quantity||0);}
test.before(async()=>{
 db=new PGlite();client={query:async(sql,args=[])=>{const r=await db.query(sql,args);return {...r,rowCount:r.rows.length||r.affectedRows||0};},release(){}};
 await db.exec(`CREATE TABLE users(id int PRIMARY KEY,twitch_id text,creature_id text,points double precision,lifetime_lovercash_spent double precision DEFAULT 0,pending_xp double precision,xp double precision,global_xp double precision,watch_seconds int,updated_at timestamptz);
 CREATE TABLE shop_inventory(account_id int,item_key text,quantity int,purchased_at timestamptz,PRIMARY KEY(account_id,item_key));CREATE TABLE history(entry jsonb); CREATE TABLE user_active_boosts(user_id int,boost_key text,expires_at timestamptz,starts_at timestamptz,remaining_live_seconds double precision,PRIMARY KEY(user_id,boost_key));`);
 context=vm.createContext({console:{warn(){},error(){}},pool:{connect:async()=>client},economyWriteRateLimit(){},app:{post:(path,...handlers)=>routes.set(path,handlers.at(-1))},pushLiveUpdate(){},
 recordPlayerHistory:async(c,entry)=>{if(historyFails)throw Error('History interrupted');await c.query('INSERT INTO history VALUES($1::jsonb)',[JSON.stringify(entry)]);},
 wizebotAlerts:{collect:async()=>{if(notificationsFail)throw Error('Notification offline');}}});
 context.BETA_TESTER_TITLE=BETA_TESTER_TITLE;
 context.STREAK_COSMETICS=STREAK_COSMETICS;
 vm.runInContext(source.slice(source.indexOf('const SHOP_ITEMS = ['),source.indexOf('\nfunction titleCosmeticFor(')),context);
 for(const [start,end] of [["app.post('/api/shop/buy'",'// Tenue cosmétique'],["app.post('/api/shop/use'",'\n});']]){
  const a=source.indexOf(start),b=end==='\n});'?source.indexOf(end,a)+4:source.indexOf(end,a);vm.runInContext(source.slice(a,b),context);
 }
});
test.after(async()=>{await db?.close()});
test.beforeEach(async()=>{historyFails=false;notificationsFail=false;await db.exec(`DELETE FROM user_active_boosts;DELETE FROM users;DELETE FROM shop_inventory;DELETE FROM history;INSERT INTO users VALUES(1,'player','plant',1000,0,7,500,20,1234,NULL);`)});

test('bottle is a repeatable consumable with a server-controlled price and XP amount',async()=>{
 const item=vm.runInContext("shopItemByKey('xp_bottle_100')",context);assert.equal(item.category,'object');assert.equal(item.price,120);assert.equal(item.xpAmount,100);assert.equal(item.consumable,true);
 const bought=await call('/api/shop/buy',{itemKey:item.key,quantity:2,price:1,xpAmount:99999});assert.equal(bought.statusCode,200);assert.equal(bought.body.totalCost,240);assert.equal((await user()).points,760);assert.equal((await user()).pending_xp,7);assert.equal(await quantity(),2);
 const used=await call('/api/shop/use',{itemKey:item.key,xpAmount:99999});assert.equal(used.statusCode,200);assert.equal(used.body.xpGranted,100);assert.equal(used.body.pendingXp,107);assert.equal(await quantity(),1);
 const u=await user();assert.equal(u.xp,500);assert.equal(u.global_xp,20);assert.equal(u.watch_seconds,1234);
 await call('/api/shop/use',{itemKey:item.key});assert.equal((await user()).pending_xp,207);assert.equal(await quantity(),0);assert.equal((await call('/api/shop/use',{itemKey:item.key})).statusCode,400);assert.equal((await user()).pending_xp,207);
 const history=(await client.query('SELECT entry FROM history')).rows;assert.equal(history.length,3);assert.equal(history[1].entry.details.xpGranted,100);
});

test('unauthorized, invalid quantities, empty inventory and insufficient cash never credit XP',async()=>{
 assert.equal((await call('/api/shop/use',{itemKey:'xp_bottle_100'},false)).statusCode,401);
 assert.equal((await call('/api/shop/use',{itemKey:'xp_bottle_100'})).statusCode,400);
 for(const q of [0,-1,1.5,101,'2'])assert.equal((await call('/api/shop/buy',{itemKey:'xp_bottle_100',quantity:q})).statusCode,400);
 await call('/api/shop/buy',{itemKey:'xp_bottle_100'});assert.equal((await call('/api/shop/use',{itemKey:'xp_bottle_100',quantity:2})).statusCode,400);assert.equal(await quantity(),1);assert.equal((await user()).pending_xp,7);
 await client.query('UPDATE users SET points=119 WHERE id=1');assert.equal((await call('/api/shop/buy',{itemKey:'xp_bottle_100'})).statusCode,400);assert.equal((await user()).points,119);assert.equal(await quantity(),1);
});

test('bottle XP remains usable before hatching or with a max-level Lovys and bypasses no boosts',async()=>{
 await call('/api/shop/buy',{itemKey:'xp_bottle_100',quantity:2});await client.query('UPDATE users SET creature_id=NULL,xp=0 WHERE id=1');assert.equal((await call('/api/shop/use',{itemKey:'xp_bottle_100'})).body.xpGranted,100);
 await client.query("UPDATE users SET creature_id='plant',xp=$1 WHERE id=1",[LOVYS_MAX_XP]);await call('/api/shop/use',{itemKey:'xp_bottle_100'});assert.equal((await user()).xp,LOVYS_MAX_XP);assert.equal((await user()).pending_xp,207);
});

test('credit and consumption roll back together, and a failed post-commit notification does not invite a retry',async()=>{
 await call('/api/shop/buy',{itemKey:'xp_bottle_100'});historyFails=true;assert.equal((await call('/api/shop/use',{itemKey:'xp_bottle_100'})).statusCode,500);assert.equal(await quantity(),1);assert.equal((await user()).pending_xp,7);
 historyFails=false;notificationsFail=true;assert.equal((await call('/api/shop/use',{itemKey:'xp_bottle_100'})).statusCode,200);assert.equal(await quantity(),0);assert.equal((await user()).pending_xp,107);
});

test('multiple bottles credit the bank once and log the exact quantity',async()=>{
 await call('/api/shop/buy',{itemKey:'xp_bottle_100',quantity:5});
 const result=await call('/api/shop/use',{itemKey:'xp_bottle_100',quantity:3,xpAmount:99999});
 assert.equal(result.statusCode,200);assert.equal(result.body.xpGranted,300);assert.equal(result.body.pendingXp,307);assert.equal(await quantity(),2);
 const entry=(await client.query("SELECT entry FROM history WHERE entry->>'kind'='use'")).rows[0].entry;
 assert.equal(entry.quantity,3);assert.equal(entry.details.xpGranted,300);
 for(const invalid of [0,-1,1.5,'2',101])assert.equal((await call('/api/shop/use',{itemKey:'xp_bottle_100',quantity:invalid})).statusCode,400);
 assert.equal(await quantity(),2);assert.equal((await user()).pending_xp,307);
});
test('a 500 XP gourd costs less than five bottles and credits the bank once per use',async()=>{
 const item=vm.runInContext("shopItemByKey('xp_gourd_500')",context);
 assert.equal(item.price,500);assert.equal(item.xpAmount,500);assert.ok(item.price<5*120);
 const bought=await call('/api/shop/buy',{itemKey:item.key,quantity:2,xpAmount:99999});
 assert.equal(bought.statusCode,200);assert.equal(bought.body.totalCost,1000);
 const used=await call('/api/shop/use',{itemKey:item.key,quantity:2,xpAmount:99999});
 assert.equal(used.statusCode,200);assert.equal(used.body.xpGranted,1000);assert.equal(used.body.pendingXp,1007);
 const remaining=(await client.query("SELECT quantity FROM shop_inventory WHERE account_id=1 AND item_key='xp_gourd_500'")).rows[0].quantity;
 assert.equal(remaining,0);
});

 test('XP boosts add live hours to one x2 counter and consume only their own variant',async()=>{
  await client.query('UPDATE users SET points=5000 WHERE id=1');
  let seconds=0;
  for(const [key,hours,price] of [['boost_xp_x2',2,150],['boost_xp_x2_5h',5,330],['boost_xp_x2_10h',10,600]]){
   const bought=await call('/api/shop/buy',{itemKey:key,quantity:2});assert.equal(bought.statusCode,200);assert.equal(bought.body.totalCost,price*2);
   const used=await call('/api/shop/use',{itemKey:key,quantity:2,liveHours:999});seconds+=hours*2*3600;
   assert.equal(used.statusCode,200,JSON.stringify(used.body));assert.equal(used.body.xpBoostRemainingSeconds,seconds);
   assert.equal((await client.query('SELECT quantity FROM shop_inventory WHERE item_key=$1',[key])).rows[0].quantity,0);
  }
  const rows=(await client.query('SELECT * FROM user_active_boosts')).rows;assert.equal(rows.length,1);assert.equal(rows[0].boost_key,'boost_xp_x2');assert.equal(rows[0].expires_at,null);
  assert.equal((await user()).xp,500);assert.equal((await user()).global_xp,20);assert.equal((await user()).watch_seconds,1234);
 });
