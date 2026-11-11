import test from 'node:test';
import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';
import { BETA_TESTER_TITLE, resolveBetaTesters, initPermanentRewards, hasBetaTesterEntitlement } from '../src/permanent-rewards.js';

const KEY=BETA_TESTER_TITLE.key;
const people=[
  [1,'twitch-miyu','LoVeRMiyu'],
  [2,'twitch-killer','LoVeRKiLLeR'],
  [3,'twitch-lzk','lzkll3_'],
  [4,'twitch-similar','lzkll3_other'],
  [5,'twitch-typo','lovermyiu'],
  [6,'twitch-random','anotherplayer']
];

function rows(values=people){
  return values.map(([id,twitch_id,login])=>({id,twitch_id,login}));
}
test('the beta title uses only three exact authenticated Twitch logins',()=>{
  const result=resolveBetaTesters(rows(), 'broadcaster');
  assert.deepEqual(result.selected.map(x=>x.id),[1,2,3]);
  assert.deepEqual(result.unresolved,[]);
  assert.deepEqual(resolveBetaTesters(rows([[1,'twitch-miyu','LoVeRMiyu'],[4,'twitch-similar','lzkll3_other']]),'broadcaster').selected.map(x=>x.id),[1]);
  assert.deepEqual(resolveBetaTesters(rows([[1,'twitch-miyu','LoVeRMiyu'],[4,'twitch-similar','lzkll3_other']]),'broadcaster').unresolved,['loverkiller','lzkll3_']);
  assert.deepEqual(resolveBetaTesters(rows([[3,'broadcaster','lzkll3_']]),'broadcaster').selected,[]);
});

async function fixture(values=people){
  const db=new PGlite();
  await db.exec(`CREATE TABLE accounts(id int PRIMARY KEY,twitch_id text,equipped_title_key text);
    CREATE TABLE users(id int PRIMARY KEY,twitch_id text,login text);
    CREATE TABLE shop_inventory(account_id int,item_key text,quantity int DEFAULT 1,
      purchased_at timestamptz DEFAULT CURRENT_TIMESTAMP,PRIMARY KEY(account_id,item_key));`);
  for(const [id,twitchId,login] of values){
    await db.query('INSERT INTO accounts(id,twitch_id) VALUES($1,$2)',[id,twitchId]);
    await db.query('INSERT INTO users(id,twitch_id,login) VALUES($1,$2,$3)',[id,twitchId,login]);
  }
  const pool={query:(...args)=>db.query(...args),connect:async()=>({query:(...args)=>db.query(...args),release(){}})};
  return {db,pool};
}
test('reconciles old incorrectly awarded titles and protects all other inventory',async()=>{
  const {db,pool}=await fixture();
  try{
    await db.exec(`CREATE TABLE account_permanent_rewards(
      account_id int NOT NULL REFERENCES accounts(id),item_key text NOT NULL,source text NOT NULL,
      twitch_id text NOT NULL,granted_at timestamptz DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY(account_id,item_key));
      CREATE TABLE permanent_reward_campaigns(key text PRIMARY KEY,completed boolean DEFAULT false,completed_at timestamptz);
      INSERT INTO permanent_reward_campaigns(key,completed) VALUES('beta-testers-v1',TRUE);`);
    await db.query("INSERT INTO account_permanent_rewards(account_id,item_key,source,twitch_id) VALUES(4,$1,'beta-testers-v1','twitch-similar')",[KEY]);
    await db.query("INSERT INTO shop_inventory(account_id,item_key,quantity) VALUES(4,$1,1)",[KEY]);
    await db.query("UPDATE accounts SET equipped_title_key=$1 WHERE id=4",[KEY]);
    await db.query("INSERT INTO shop_inventory(account_id,item_key,quantity) VALUES(4,'mystery_egg',2)");
    const result=await initPermanentRewards(pool,{broadcasterId:'broadcaster'});
    assert.equal(result.completed,true);
    let owners=(await db.query('SELECT account_id FROM account_permanent_rewards WHERE item_key=$1 ORDER BY account_id',[KEY])).rows.map(x=>x.account_id);
    assert.deepEqual(owners,[1,2,3]);
    let stocks=(await db.query('SELECT account_id FROM shop_inventory WHERE item_key=$1 ORDER BY account_id',[KEY])).rows.map(x=>x.account_id);
    assert.deepEqual(stocks,[1,2,3]);
    assert.equal((await db.query('SELECT equipped_title_key FROM accounts WHERE id=4')).rows[0].equipped_title_key,null);
    assert.equal((await db.query("SELECT quantity FROM shop_inventory WHERE account_id=4 AND item_key='mystery_egg'")).rows[0].quantity,2);
    await db.query("DELETE FROM shop_inventory WHERE account_id=1 AND item_key=$1",[KEY]);
    await initPermanentRewards(pool,{broadcasterId:'broadcaster'});
    assert.equal((await db.query("SELECT quantity FROM shop_inventory WHERE account_id=1 AND item_key=$1",[KEY])).rows[0].quantity,1);
    assert.equal((await db.query('SELECT COUNT(*)::int count FROM account_permanent_rewards WHERE item_key=$1',[KEY])).rows[0].count,3);
  }finally{await db.close();}
});
test('grants absent exact players later but never assigns by similarity',async()=>{
  const {db,pool}=await fixture([people[0],people[3]]);
  try{
    const first=await initPermanentRewards(pool,{broadcasterId:'broadcaster'});
    assert.equal(first.completed,false);
    assert.deepEqual(first.unresolved,['loverkiller','lzkll3_']);
    assert.deepEqual((await db.query('SELECT account_id FROM account_permanent_rewards WHERE item_key=$1',[KEY])).rows.map(x=>x.account_id),[1]);
    for(const [id,twitchId,login] of [people[1],people[2]]){
      await db.query('INSERT INTO accounts(id,twitch_id) VALUES($1,$2)',[id,twitchId]);
      await db.query('INSERT INTO users(id,twitch_id,login) VALUES($1,$2,$3)',[id,twitchId,login]);
    }
    const final=await initPermanentRewards(pool,{broadcasterId:'broadcaster'});
    assert.equal(final.completed,true);
    assert.deepEqual((await db.query('SELECT account_id FROM account_permanent_rewards WHERE item_key=$1 ORDER BY account_id',[KEY])).rows.map(x=>x.account_id),[1,2,3]);
  }finally{await db.close();}
});
test('permanent Twitch account entitlement survives renaming; name reuse cannot create a fourth holder',async()=>{
  const {db,pool}=await fixture();
  try{
    await initPermanentRewards(pool,{broadcasterId:'broadcaster'});
    await db.query("UPDATE users SET login='new-name' WHERE id=3");
    await db.query('INSERT INTO accounts(id,twitch_id) VALUES(7,$1)',['someone-new']);
    await db.query('INSERT INTO users(id,twitch_id,login) VALUES(7,$1,$2)',['someone-new','lzkll3_']);
    await initPermanentRewards(pool,{broadcasterId:'broadcaster'});
    assert.deepEqual((await db.query('SELECT account_id FROM account_permanent_rewards WHERE item_key=$1 ORDER BY account_id',[KEY])).rows.map(x=>x.account_id),[1,2,3]);
  }finally{await db.close();}
});

test('the title cannot be equipped using inventory stock without an exact permanent Twitch entitlement',async()=>{
  const {db,pool}=await fixture();
  try{
    await initPermanentRewards(pool,{broadcasterId:'broadcaster'});
    assert.equal(await hasBetaTesterEntitlement(pool,1,'twitch-miyu'),true);
    assert.equal(await hasBetaTesterEntitlement(pool,2,'twitch-killer'),true);
    assert.equal(await hasBetaTesterEntitlement(pool,3,'twitch-lzk'),true);
    assert.equal(await hasBetaTesterEntitlement(pool,4,'twitch-similar'),false);
    assert.equal(await hasBetaTesterEntitlement(pool,1,'someone-else'),false);
    assert.equal(await hasBetaTesterEntitlement(pool,0,'twitch-miyu'),false);
    const {readFileSync}=await import('node:fs');
    const server=readFileSync(new URL('../server.js',import.meta.url),'utf8');
    assert.match(server,/betaTitleEligible = inventory\.get\(BETA_TESTER_TITLE\.key\)>0/);
    assert.equal((server.match(/hasBetaTesterEntitlement\(/g)||[]).length,3);
  }finally{await db.close();}
});
