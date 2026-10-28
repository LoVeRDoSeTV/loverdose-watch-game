import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';import {PGlite} from '@electric-sql/pglite';
const source=fs.readFileSync(new URL('../server.js',import.meta.url),'utf8');
let db,client,context;const routes=new Map();
async function call(path,userId,body={},offerId){const res={statusCode:200,status(n){this.statusCode=n;return this;},json(data){this.body=data;return this;}};await routes.get(path)({session:{account:{id:userId},user:{twitchId:String(userId)}},params:{offerId},body},res);return res;}
async function stock(account,key='xp_bottle_100'){return Number((await client.query('SELECT quantity FROM shop_inventory WHERE account_id=$1 AND item_key=$2',[account,key])).rows[0]?.quantity||0);}
test.before(async()=>{
 db=new PGlite();client={query:async(sql,args=[])=>{const r=await db.query(sql,args);return {...r,rowCount:r.rows.length||r.affectedRows||0};},release(){}};
 await db.exec(`CREATE TABLE users(id int PRIMARY KEY,twitch_id text,display_name text);CREATE TABLE accounts(id int PRIMARY KEY,twitch_id text,username text);CREATE TABLE shop_inventory(account_id int,item_key text,quantity int CHECK(quantity>=0),purchased_at timestamptz,PRIMARY KEY(account_id,item_key));CREATE TABLE player_trade_offers(status text,accepted_at timestamptz,target_user_id int,creator_user_id int);CREATE TABLE trade_notifications(user_id int,message text,event_type text,offer_id bigint);`);
 for(const name of ['trade_offers','trade_offer_options']){const start=source.indexOf('CREATE TABLE IF NOT EXISTS '+name+' (');const end=source.indexOf('`)\u003b',start);await db.exec(source.slice(start,end));}
 for(const name of ['trade_offers','trade_offer_options']){const start=source.indexOf('ALTER TABLE '+name+' DROP CONSTRAINT');const end=source.indexOf('`)\u003b',start);await db.exec(source.slice(start,end));}
 context=vm.createContext({console:{error(){}},pool:{connect:async()=>client},TRADE_MAX_QUANTITY:999,TRADE_MAX_OPTIONS:3,TRADE_MAX_ACTIVE:5,TRADE_DURATIONS:new Set([1,3,7]),TRADE_MAX_DAILY_COMPLETED:10,creatures:[],tradeCreatureName:id=>id,restoreExpiredPlayerTrades:async()=>{},pushLiveUpdate(){},tradeWriteRateLimit(){},app:{post:(path,...handlers)=>routes.set(path,handlers.at(-1))}});
 vm.runInContext(source.slice(source.indexOf('function normalizeTradeAsset'),source.indexOf('function normalizePlayerTradeBundle')),context);
 for(const path of ['/api/trades','/api/trades/:offerId/accept','/api/trades/:offerId/cancel']){const start=source.indexOf("app.post('"+path+"'");const end=source.indexOf('\n});',start)+4;vm.runInContext(source.slice(start,end),context);}
});
test.after(async()=>db?.close());
test.beforeEach(async()=>{await db.exec("TRUNCATE trade_offer_options,trade_offers RESTART IDENTITY CASCADE;DELETE FROM shop_inventory;DELETE FROM accounts;DELETE FROM users;INSERT INTO users VALUES(1,'1','One'),(2,'2','Two');INSERT INTO accounts VALUES(1,'1','One'),(2,'2','Two');INSERT INTO shop_inventory(account_id,item_key,quantity) VALUES(1,'xp_bottle_100',5),(2,'mystery_egg',2);");});
async function publish(){const r=await call('/api/trades',1,{offer:{type:'xp_bottle',quantity:3},options:[{type:'egg',quantity:1}],durationDays:3});assert.equal(r.statusCode,200,JSON.stringify(r.body));return r.body.offerId;}
test('bottles are reserved, transferred and cannot be accepted twice',async()=>{
 const id=await publish();assert.equal(await stock(1),2);
 const option=(await client.query('SELECT id FROM trade_offer_options WHERE offer_id=$1',[id])).rows[0].id;
 assert.equal((await call('/api/trades/:offerId/accept',2,{optionId:option},id)).statusCode,200);
 assert.equal(await stock(2),3);assert.equal(await stock(1),2);assert.equal(await stock(1,'mystery_egg'),1);
 assert.equal((await call('/api/trades/:offerId/accept',2,{optionId:option},id)).statusCode,400);assert.equal(await stock(2),3);
});
test('cancellation and expiration restore bottles once',async()=>{
 const id=await publish();assert.equal((await call('/api/trades/:offerId/cancel',1,{},id)).statusCode,200);assert.equal(await stock(1),5);
 assert.equal((await call('/api/trades/:offerId/cancel',1,{},id)).statusCode,400);assert.equal(await stock(1),5);
 const other=await publish();await client.query("UPDATE trade_offers SET expires_at=CURRENT_TIMESTAMP-INTERVAL '1 second' WHERE id=$1",[other]);
 await context.restoreExpiredTrades(client);await context.restoreExpiredTrades(client);assert.equal(await stock(1),5);
});
test('invalid quantities never reserve bottles',async()=>{
 for(const quantity of [0,-1,1.5,'2',1000,6]){const r=await call('/api/trades',1,{offer:{type:'xp_bottle',quantity},options:[{type:'egg',quantity:1}],durationDays:3});assert.equal(r.statusCode,400);assert.equal(await stock(1),5);}
});

test('bottles may be requested as payment; insufficient stock rolls everything back',async()=>{
 const request={offer:{type:'egg',quantity:1},options:[{type:'xp_bottle',quantity:3}],durationDays:3};
 const published=await call('/api/trades',2,request);assert.equal(published.statusCode,200,JSON.stringify(published.body));
 const id=published.body.offerId,option=(await client.query('SELECT id FROM trade_offer_options WHERE offer_id=$1',[id])).rows[0].id;
 await client.query("UPDATE shop_inventory SET quantity=2 WHERE account_id=1 AND item_key='xp_bottle_100'");
 assert.equal((await call('/api/trades/:offerId/accept',1,{optionId:option},id)).statusCode,400);assert.equal(await stock(1),2);assert.equal(await stock(2),0);
 await client.query("UPDATE shop_inventory SET quantity=3 WHERE account_id=1 AND item_key='xp_bottle_100'");
 assert.equal((await call('/api/trades/:offerId/accept',1,{optionId:option},id)).statusCode,200);assert.equal(await stock(2),3);assert.equal(await stock(1),0);assert.equal(await stock(1,'mystery_egg'),1);
});
