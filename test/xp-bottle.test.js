import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';
import {PGlite} from '@electric-sql/pglite';
import {LOVYS_MAX_XP} from '../src/xp-economy.js';
const source=fs.readFileSync(new URL('../server.js',import.meta.url),'utf8');
let db,client,context,historyFails=false,notificationsFail=false;const routes=new Map();
const response=()=>({statusCode:200,status(n){this.statusCode=n;return this;},json(body){this.body=body;return this;}});
async function call(path,body={},authenticated=true){const res=response();await routes.get(path)({session:authenticated?{account:{id:1},user:{twitchId:'player'}}:{},body},res);return res;}
async function user(){return (await client.query('SELECT * FROM users WHERE id=1')).rows[0];}
async function quantity(){return Number((await client.query("SELECT quantity FROM shop_inventory WHERE account_id=1 AND item_key='xp_bottle_100'")).rows[0]?.quantity||0);}
test.before(async()=>{
 db=new PGlite();client={query:async(sql,args=[])=>{const r=await db.query(sql,args);return {...r,rowCount:r.rows.length||r.affectedRows||0};},release(){}};
 await db.exec(`CREATE TABLE users(id int PRIMARY KEY,twitch_id text,creature_id text,points double precision,lifetime_lovercash_spent double precision DEFAULT 0,pending_xp double precision,xp double precision,global_xp double precision,watch_seconds int,updated_at timestamptz);
 CREATE TABLE shop_inventory(account_id int,item_key text,quantity int,purchased_at timestamptz,PRIMARY KEY(account_id,item_key));CREATE TABLE history(entry jsonb);`);
 context=vm.createContext({console:{warn(){},error(){}},pool:{connect:async()=>client},economyWriteRateLimit(){},app:{post:(path,...handlers)=>routes.set(path,handlers.at(-1))},pushLiveUpdate(){},
 recordPlayerHistory:async(c,entry)=>{if(historyFails)throw Error('History interrupted');await c.query('INSERT INTO history VALUES($1::jsonb)',[JSON.stringify(entry)]);},
 wizebotAlerts:{collect:async()=>{if(notificationsFail)throw Error('Notification offline');}}});
 vm.runInContext(source.slice(source.indexOf('const SHOP_ITEMS = ['),source.indexOf('\nfunction titleCosmeticFor(')),context);
 for(const [start,end] of [["app.post('/api/shop/buy'",'// Tenue cosmétique'],["app.post('/api/shop/use'",'\n});']]){
  const a=source.indexOf(start),b=end==='\n});'?source.indexOf(end,a)+4:source.indexOf(end,a);vm.runInContext(source.slice(a,b),context);
 }
});
test.after(async()=>{await db?.close()});
test.beforeEach(async()=>{historyFails=false;notificationsFail=false;await db.exec(`DELETE FROM users;DELETE FROM shop_inventory;DELETE FROM history;INSERT INTO users VALUES(1,'player','plant',1000,0,7,500,20,1234,NULL);`)});

test('bottle is a repeatable consumable with a server-controlled price and XP amount',async()=>{
 const item=vm.runInContext("shopItemByKey('xp_bottle_100')",context);assert.equal(item.category,'object');assert.equal(item.price,200);assert.equal(item.xpAmount,100);assert.equal(item.consumable,true);
 const bought=await call('/api/shop/buy',{itemKey:item.key,quantity:2,price:1,xpAmount:99999});assert.equal(bought.statusCode,200);assert.equal(bought.body.totalCost,400);assert.equal((await user()).points,600);assert.equal((await user()).pending_xp,7);assert.equal(await quantity(),2);
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
 await client.query('UPDATE users SET points=199 WHERE id=1');assert.equal((await call('/api/shop/buy',{itemKey:'xp_bottle_100'})).statusCode,400);assert.equal((await user()).points,199);assert.equal(await quantity(),1);
});

test('bottle XP remains usable before hatching or with a max-level Lovys and bypasses no boosts',async()=>{
 await call('/api/shop/buy',{itemKey:'xp_bottle_100',quantity:2});await client.query('UPDATE users SET creature_id=NULL,xp=0 WHERE id=1');assert.equal((await call('/api/shop/use',{itemKey:'xp_bottle_100'})).body.xpGranted,100);
 await client.query("UPDATE users SET creature_id='plant',xp=$1 WHERE id=1",[LOVYS_MAX_XP]);await call('/api/shop/use',{itemKey:'xp_bottle_100'});assert.equal((await user()).xp,LOVYS_MAX_XP);assert.equal((await user()).pending_xp,207);
});

test('credit and consumption roll back together, and a failed post-commit notification does not invite a retry',async()=>{
 await call('/api/shop/buy',{itemKey:'xp_bottle_100'});historyFails=true;assert.equal((await call('/api/shop/use',{itemKey:'xp_bottle_100'})).statusCode,500);assert.equal(await quantity(),1);assert.equal((await user()).pending_xp,7);
 historyFails=false;notificationsFail=true;assert.equal((await call('/api/shop/use',{itemKey:'xp_bottle_100'})).statusCode,200);assert.equal(await quantity(),0);assert.equal((await user()).pending_xp,107);
});
