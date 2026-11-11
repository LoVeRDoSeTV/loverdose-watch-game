import test from 'node:test';
import assert from 'node:assert/strict';
import {PGlite} from '@electric-sql/pglite';
import {GLOBAL_RESET_PHRASE,GLOBAL_PROGRESS_TABLES,registerGlobalGameReset} from '../src/reset-game.js';
import {BETA_TESTER_TITLE,initPermanentRewards,resolveBetaTesters} from '../src/permanent-rewards.js';
import {resetPlayerProgress} from '../src/reset-player.js';
let db;
const numeric=['xp','pending_xp','global_xp','prestige','egg_fragments','universal_lovys_fragments','points','lifetime_lovercash_earned','lifetime_lovercash_spent','watch_seconds','incubator_accelerated_seconds','total_lovys_hatched','away_lovys_xp','away_global_xp','away_lovercash','away_watch_seconds'];
test.before(async()=>{
 db=new PGlite();
 await db.exec(`CREATE TABLE users(id int PRIMARY KEY,twitch_id text,login text,is_sub boolean,creature_id text,${numeric.map(k=>k+' double precision DEFAULT 99').join(',')},last_live_seen_at timestamptz,progress_reset_at timestamptz,updated_at timestamptz);
 CREATE TABLE accounts(id int PRIMARY KEY,username text,email text,password_hash text,twitch_id text,equipped_title_key text,equipped_background_key text,equipped_frame_key text,equipped_avatar_frame_key text,game_intro_seen boolean,community_intro_seen boolean,updated_at timestamptz);
 CREATE TABLE player_trade_offers(id int,status text,updated_at timestamptz,creator_user_id int,target_user_id int);CREATE TABLE trade_offers(id int,status text,updated_at timestamptz,creator_user_id int);
 CREATE TABLE game_bot_drops(id int,status text,settled_at timestamptz);CREATE TABLE game_bot_drop_schedule(id int,next_at timestamptz,enabled boolean);
 CREATE TABLE wizebot_game_alerts(user_id int,valid_until timestamptz);
 CREATE TABLE admin_audit_log(admin_account_id int,target_account_id int,action_key text,summary text,details_json jsonb);
 CREATE TABLE user_sessions(id text);CREATE TABLE game_bot_auth(enabled boolean);CREATE TABLE player_economy_history(id int);
 CREATE TABLE account_permanent_rewards(account_id int REFERENCES accounts(id) ON DELETE CASCADE,item_key text,source text,twitch_id text,granted_at timestamptz DEFAULT CURRENT_TIMESTAMP,PRIMARY KEY(account_id,item_key));
 CREATE TABLE permanent_reward_campaigns(key text PRIMARY KEY,completed boolean DEFAULT FALSE,completed_at timestamptz);`);
 for(const table of GLOBAL_PROGRESS_TABLES){
  if(table==='shop_inventory')await db.exec(`CREATE TABLE ${table}(account_id int REFERENCES accounts(id),item_key text,quantity int,PRIMARY KEY(account_id,item_key))`);
  else if(table==='user_badge_celebrations')await db.exec(`CREATE TABLE ${table}(user_id int PRIMARY KEY REFERENCES users(id),seen_signatures text[])`);
  else await db.exec(`CREATE TABLE ${table}(user_id int REFERENCES users(id))`);
 }
});
test.after(async()=>db?.close());
test.beforeEach(async()=>{
 await db.exec(`TRUNCATE ${[...GLOBAL_PROGRESS_TABLES,'account_permanent_rewards','permanent_reward_campaigns','player_trade_offers','trade_offers','game_bot_drops','game_bot_drop_schedule','wizebot_game_alerts','admin_audit_log','user_sessions','game_bot_auth','player_economy_history','accounts','users'].join(',')};
 INSERT INTO users(id,twitch_id,login,is_sub,creature_id) VALUES(11,'one','one',true,'voltis'),(22,'two','two',false,'plant'),(33,'three','three',false,'fire'),(44,'detected','detected',true,'water');
 INSERT INTO accounts(id,username,email,password_hash,twitch_id,equipped_title_key,game_intro_seen) VALUES(1,'owner','owner@example.test','hash','one','title',true),(2,'player','player@example.test','hash2','two','title',true),(3,'unlinked','unlinked@example.test','hash3',NULL,'title',true);
 INSERT INTO player_trade_offers(id,status,updated_at) VALUES(1,'open',NULL),(2,'accepted',NULL);INSERT INTO trade_offers(id,status,updated_at) VALUES(1,'open',NULL),(2,'accepted',NULL);
 INSERT INTO game_bot_drops VALUES(1,'open',NULL),(2,'settled',NULL);INSERT INTO game_bot_drop_schedule VALUES(1,CURRENT_TIMESTAMP,true);
 INSERT INTO wizebot_game_alerts VALUES(11,CURRENT_TIMESTAMP+INTERVAL '1 day');
 INSERT INTO user_sessions VALUES('session-kept');INSERT INTO game_bot_auth VALUES(true);INSERT INTO player_economy_history VALUES(1);`);
 for(const table of GLOBAL_PROGRESS_TABLES){
  if(table==='shop_inventory')await db.exec("INSERT INTO shop_inventory VALUES(1,'egg',3),(3,'egg',2)");
  else if(table==='user_badge_celebrations')await db.exec("INSERT INTO user_badge_celebrations VALUES(11,ARRAY['old'])");
  else await db.exec(`INSERT INTO ${table}(user_id) VALUES(11),(44)`);
 }
});
function harness({owner=true,locked=true,failAudit=false}={}){
 const queries=[],events=[];let released=0,handler;
 const query=async(sql,args)=>{queries.push(sql);if(sql.includes('pg_try_advisory_xact_lock'))return {rows:[{locked}]};if(failAudit&&sql.startsWith('INSERT INTO admin_audit_log'))throw Error('Simulated audit failure');return db.query(sql,args);};
 registerGlobalGameReset({post:(path,fn)=>{assert.equal(path,'/api/admin/reset-game');handler=fn;}},{pool:{connect:async()=>({query,release:()=>released++})},getBroadcasterAccount:async()=>owner?{id:1}:null,pushLiveUpdate:(type)=>{assert.equal(queries.at(-1),'COMMIT');events.push(type);}});
 return {queries,events,get released(){return released;},invoke:async(body={confirmation:GLOBAL_RESET_PHRASE,confirmAll:true,requestId:'12345678-1234-1234-1234-123456789abc'})=>{const res={statusCode:200,status(n){this.statusCode=n;return this;},json(body){this.body=body;return this;}};await handler({body},res);return res;}};
}
test('only the broadcaster with the exact typed phrase can reset; invalid requests never open a transaction',async()=>{
 const denied=harness({owner:false});assert.equal((await denied.invoke()).statusCode,403);assert.equal(denied.queries.length,0);
 const h=harness();for(const body of [{},{confirmation:GLOBAL_RESET_PHRASE,confirmAll:false},{confirmation:'reinitialiser tout le jeu',confirmAll:true}])assert.equal((await h.invoke(body)).statusCode,400);
 assert.equal(h.queries.length,0);
});
test('global reset clears every player, including detected and unlinked inventory, while retaining identities and history',async()=>{
 const h=harness();const result=await h.invoke();assert.equal(result.statusCode,200);assert.equal(result.body.accounts,3);assert.equal(result.body.players,4);
 const users=(await db.query('SELECT * FROM users ORDER BY id')).rows;
 for(const u of users){for(const field of numeric)assert.equal(u[field],0,field);assert.equal(u.creature_id,null);assert.ok(u.progress_reset_at);assert.ok(u.login);}
 assert.equal(users[0].is_sub,true);assert.equal(users[3].twitch_id,'detected');
 const accounts=(await db.query('SELECT * FROM accounts ORDER BY id')).rows;assert.equal(accounts.length,3);assert.equal(accounts[0].password_hash,'hash');assert.equal(accounts[0].twitch_id,'one');assert.equal(accounts[2].email,'unlinked@example.test');assert.equal(accounts[0].equipped_title_key,null);
 for(const table of GLOBAL_PROGRESS_TABLES){const n=(await db.query(`SELECT COUNT(*)::int n FROM ${table}`)).rows[0].n;assert.equal(n,table==='user_badge_celebrations'?4:0,table);}
 assert.deepEqual((await db.query('SELECT status FROM player_trade_offers ORDER BY id')).rows.map(x=>x.status),['cancelled','accepted']);
 assert.deepEqual((await db.query('SELECT status FROM game_bot_drops ORDER BY id')).rows.map(x=>x.status),['cancelled','settled']);
 assert.equal((await db.query('SELECT enabled FROM game_bot_drop_schedule')).rows[0].enabled,true);
 for(const table of ['user_sessions','game_bot_auth','player_economy_history'])assert.equal((await db.query(`SELECT COUNT(*)::int n FROM ${table}`)).rows[0].n,1);
 assert.equal((await db.query('SELECT action_key FROM admin_audit_log')).rows[0].action_key,'reset_game_all');assert.deepEqual(h.events,['game-reset-all']);assert.equal(h.released,1);
});
test('replaying a confirmed request never resets newly earned progress a second time',async()=>{
 const h=harness();await h.invoke();await db.query('UPDATE users SET xp=123 WHERE id=11');const again=await h.invoke();assert.equal(again.body.alreadyApplied,true);assert.equal((await db.query('SELECT xp FROM users WHERE id=11')).rows[0].xp,123);assert.equal(h.events.length,1);
});
test('failure after clearing data rolls back balances, inventory, trades and the entire reset',async()=>{
 const h=harness({failAudit:true});const result=await h.invoke();assert.equal(result.statusCode,500);assert.equal((await db.query('SELECT xp FROM users WHERE id=11')).rows[0].xp,99);assert.equal((await db.query('SELECT quantity FROM shop_inventory WHERE account_id=3')).rows[0].quantity,2);assert.equal((await db.query('SELECT status FROM player_trade_offers WHERE id=1')).rows[0].status,'open');assert.equal(h.events.length,0);assert.equal(h.queries.at(-1),'ROLLBACK');assert.equal(h.released,1);
});
test('a concurrent reset is refused before any progress is touched',async()=>{
 const h=harness({locked:false});assert.equal((await h.invoke()).statusCode,409);assert.equal((await db.query('SELECT xp FROM users WHERE id=11')).rows[0].xp,99);assert.equal(h.events.length,0);
});
async function betaPlayers(){
 await db.exec("UPDATE users SET login=CASE id WHEN 11 THEN 'LoVeRMiyu' WHEN 22 THEN 'LoVeRKiLLeR' WHEN 33 THEN 'Lzkll3_' ELSE login END;UPDATE accounts SET twitch_id='three' WHERE id=3");
 const client={query:(...args)=>db.query(...args),release(){}};
 const pool={query:(...args)=>db.query(...args),connect:async()=>client};
 return {pool,client};
}
test('beta title belongs only to the three resolved Twitch accounts and survives repeated global and individual resets',async()=>{
 const {pool,client}=await betaPlayers();assert.equal((await initPermanentRewards(pool)).completed,true);
 let rows=(await db.query('SELECT account_id FROM shop_inventory WHERE item_key=$1 ORDER BY account_id',[BETA_TESTER_TITLE.key])).rows;
 assert.deepEqual(rows.map(x=>x.account_id),[1,2,3]);
 const h=harness();await h.invoke();await h.invoke({confirmation:GLOBAL_RESET_PHRASE,confirmAll:true,requestId:'abcdefab-1234-1234-1234-123456789abc'});
 await db.query('BEGIN');await resetPlayerProgress(client,{id:1,user_id:11},{achievementService:{reset:async()=>{}},changeTradeAsset:async()=>{throw Error('Unexpected refund');}});await db.query('COMMIT');
 rows=(await db.query('SELECT account_id,item_key,quantity FROM shop_inventory ORDER BY account_id')).rows;
 assert.equal(rows.length,3);assert.ok(rows.every(x=>x.item_key===BETA_TESTER_TITLE.key&&x.quantity===1));
 // Renames and newly matching people cannot add new recipients after the one-time grant.
 await db.exec("UPDATE users SET login='renamed' WHERE id=11;UPDATE users SET login='lovermiyu' WHERE id=44;INSERT INTO accounts(id,username,twitch_id) VALUES(4,'new-person','detected')");
 assert.equal((await initPermanentRewards(pool)).completed,true);
 assert.equal((await db.query('SELECT COUNT(*)::int n FROM account_permanent_rewards')).rows[0].n,3);
 assert.equal((await db.query('SELECT COUNT(*)::int n FROM shop_inventory WHERE account_id=4')).rows[0].n,0);
});
test('only verified exact Twitch recipients receive beta title, even if other accounts are missing',async()=>{
  const accounts=[{id:1,twitch_id:'1',login:'LoVeRMiyu'},{id:2,twitch_id:'2',login:'LoVeRKiLLeR__'},{id:3,twitch_id:'3',login:'Lzkll3_'},{id:4,twitch_id:'4',login:'lzk-other'}];
  assert.deepEqual(resolveBetaTesters(accounts).selected.map(a=>a.id),[1,3]);
  assert.deepEqual(resolveBetaTesters(accounts).unresolved,['loverkiller']);
  const {pool}=await betaPlayers();
  await db.query("UPDATE users SET login='someone' WHERE id=22");
  const result=await initPermanentRewards(pool);
  assert.equal(result.completed,false);
  assert.deepEqual((await db.query('SELECT account_id FROM account_permanent_rewards ORDER BY account_id')).rows.map(r=>r.account_id),[1,3]);
});
test('abbreviations and lookalikes cannot receive the exclusive beta title',()=>{
  const accounts=[{id:1,twitch_id:'1',login:'LoVeRMiyu'},{id:2,twitch_id:'2',login:'LoVeRKiLLeR__'},{id:3,twitch_id:'3',login:'Izkll3_'},{id:4,twitch_id:'owner',login:'loverdosetv'}];
  const resolved=resolveBetaTesters(accounts,'owner');
  assert.deepEqual(resolved.selected.map(a=>a.id),[1]);
  assert.deepEqual(resolved.unresolved,['loverkiller','lzkll3_']);
  const exact=accounts.map(a=>a.id===2?{...a,login:'LoVeRKiLLeR'}:a.id===3?{...a,login:'lzkll3_'}:a);
  assert.deepEqual(resolveBetaTesters(exact,'owner').selected.map(a=>a.id),[1,2,3]);
  assert.deepEqual(resolveBetaTesters([...exact,{id:5,twitch_id:'5',login:'lzkll3_fake'}],'owner').selected.map(a=>a.id),[1,2,3]);
});
test('the broadcaster is excluded even if their Twitch login matches a beta recipient',()=>{
  const accounts=[{id:1,twitch_id:'owner',login:'LoVeRMiyu'},{id:2,twitch_id:'2',login:'LoVeRKiLLeR'},{id:3,twitch_id:'3',login:'Lzkll3_'}];
  assert.deepEqual(resolveBetaTesters(accounts,'owner').selected.map(a=>a.id),[2,3]);
  assert.deepEqual(resolveBetaTesters(accounts,'owner').unresolved,['lovermiyu']);
});
