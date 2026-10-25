import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {PGlite} from '@electric-sql/pglite';
import {LOVYS_MAX_XP,legacyLovysThresholdForLevel,lovysThresholdForLevel,lovysProgressionFromXp,migrateLegacyLovysXp,migrateLovysProgressionCurve} from '../src/xp-economy.js';
import {PVE_FIGHTS} from '../src/combat/zones.js';

test('early levels keep their thresholds, later levels get progressively more expensive',()=>{
  for(let level=1;level<=25;level++)assert.equal(lovysThresholdForLevel(level),legacyLovysThresholdForLevel(level));
  assert.equal(lovysThresholdForLevel(30),5300);assert.equal(lovysThresholdForLevel(40),12650);assert.equal(lovysThresholdForLevel(50),25000);
  let previousCost=0;
  for(let level=25;level<50;level++){
    const cost=lovysThresholdForLevel(level+1)-lovysThresholdForLevel(level);
    assert.ok(cost>previousCost);previousCost=cost;
  }
  for(let level=1;level<=50;level++){
    const current=lovysThresholdForLevel(level),p=lovysProgressionFromXp(current);
    assert.equal(p.level,level);assert.equal(p.currentThreshold,current);assert.equal(p.maxLevel,level===50);
    if(level<50){assert.equal(p.nextThreshold,lovysThresholdForLevel(level+1));assert.equal(lovysProgressionFromXp(p.nextThreshold-.0001).level,level);}
    assert.equal(p.evolution,level>=50?3:level>=25?2:level>=10?1:0);
  }
  assert.equal(lovysProgressionFromXp(10000).maxLevel,false);
  assert.equal(lovysProgressionFromXp(-100).level,1);
  assert.equal(lovysProgressionFromXp(999999).level,50);
  assert.equal(PVE_FIGHTS.reduce((sum,f)=>sum+f.rewards.creatureXp,0),1920,'PvE rewards must not grow with the new cost curve');
});

test('conversion preserves every old level and its fraction, including existing max levels',()=>{
  for(let level=1;level<50;level++)for(const fraction of [0,.01,.25,.5,.99]){
    const old=legacyLovysThresholdForLevel(level)+(legacyLovysThresholdForLevel(level+1)-legacyLovysThresholdForLevel(level))*fraction;
    const converted=migrateLegacyLovysXp(old),p=lovysProgressionFromXp(converted);
    assert.equal(p.level,level,`${level} at ${fraction}`);
    const progress=(converted-p.currentThreshold)/(p.nextThreshold-p.currentThreshold);
    assert.ok(Math.abs(progress-fraction)<1e-9);
    if(level<25)assert.equal(converted,old);
  }
  assert.equal(migrateLegacyLovysXp(10000),LOVYS_MAX_XP);
});

async function database(){
  const db=new PGlite();
  await db.exec(`CREATE TABLE users(id int PRIMARY KEY,creature_id text,xp double precision,pending_xp double precision DEFAULT 0,updated_at timestamptz);
    CREATE TABLE user_lovys(id int PRIMARY KEY,user_id int,creature_id text,xp double precision,is_active boolean,updated_at timestamptz);
    CREATE TABLE economy_migrations(version text PRIMARY KEY,applied_at timestamptz DEFAULT CURRENT_TIMESTAMP);`);
  const client={query:async(sql,args=[])=>{const r=await db.query(sql,args);return {...r,rowCount:r.rows.length||r.affectedRows||0};},release(){}};
  return {db,client,pool:{connect:async()=>client}};
}

test('real migration converts active and inactive Lovys once and keeps reserves and legacy overflow',async()=>{
  const {db,client,pool}=await database();
  try{
    await db.exec(`INSERT INTO users VALUES(1,'plant',7530,123,NULL),(2,'plant',11200,50,NULL),(3,NULL,0,600,NULL);
      INSERT INTO user_lovys VALUES(1,1,'plant',7400,TRUE,NULL),(2,1,'water',3500,FALSE,NULL),(3,1,'fire',500,FALSE,NULL),
      (4,2,'plant',10500,TRUE,NULL),(5,2,'water',10800,FALSE,NULL);`);
    const result=await migrateLovysProgressionCurve(pool);assert.equal(result.applied,true);
    const users=(await client.query('SELECT * FROM users ORDER BY id')).rows,lovys=(await client.query('SELECT * FROM user_lovys ORDER BY id')).rows;
    assert.equal(users[0].xp,migrateLegacyLovysXp(7530),'stale active snapshot must not lose live XP');
    assert.equal(lovys[0].xp,users[0].xp);assert.equal(users[0].pending_xp,123);
    assert.equal(lovys[1].xp,3500);assert.equal(lovys[2].xp,500);
    assert.equal(users[1].xp,LOVYS_MAX_XP);assert.equal(lovys[3].xp,LOVYS_MAX_XP);assert.equal(lovys[4].xp,LOVYS_MAX_XP);
    assert.equal(users[1].pending_xp,2050,'old overflow is refunded at its real amount, once');
    assert.equal(users[2].pending_xp,600,'pre-hatch reserve is not multiplied');
    await client.query('UPDATE user_lovys SET xp=xp+50 WHERE id=1');await client.query('UPDATE users SET xp=xp+50 WHERE id=1');
    assert.equal((await migrateLovysProgressionCurve(pool)).applied,false);
    assert.equal((await client.query('SELECT xp FROM users WHERE id=1')).rows[0].xp,users[0].xp+50);
    assert.equal((await client.query('SELECT pending_xp FROM users WHERE id=2')).rows[0].pending_xp,2050);
  }finally{await db.close();}
});

test('failed migration rolls back XP, refunds and marker; the next startup can retry',async()=>{
  const {db,client,pool}=await database();
  try{
    await db.exec(`INSERT INTO users VALUES(1,'plant',11200,50,NULL);INSERT INTO user_lovys VALUES(1,1,'plant',11200,TRUE,NULL);`);
    const failingPool={connect:async()=>({...client,query:async(sql,args)=>{if(sql.includes('jsonb_to_recordset'))throw Error('Simulated interruption');return client.query(sql,args);}})};
    await assert.rejects(migrateLovysProgressionCurve(failingPool),/Simulated interruption/);
    assert.equal((await client.query('SELECT xp,pending_xp FROM users WHERE id=1')).rows[0].xp,11200);
    assert.equal((await client.query('SELECT pending_xp FROM users WHERE id=1')).rows[0].pending_xp,50);
    assert.equal((await client.query('SELECT * FROM economy_migrations')).rowCount,0);
    await migrateLovysProgressionCurve(pool);
    assert.equal((await client.query('SELECT xp FROM users WHERE id=1')).rows[0].xp,LOVYS_MAX_XP);
    assert.equal((await client.query('SELECT pending_xp FROM users WHERE id=1')).rows[0].pending_xp,1250);
  }finally{await db.close();}
});

test('donation UI reads the server cap and allows XP above the former 10000 limit',()=>{
  const source=fs.readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
  const code=source.slice(source.indexOf('function updateLovysXpTransferCapacity()'),source.indexOf('async function openLovysXpTransferConfirm('));
  const nodes=new Map(),node=id=>{if(!nodes.has(id))nodes.set(id,{value:id==='lovysXpTransferTarget'?'1':''});return nodes.get(id);};
  const chosen={id:1,name:'Mimi',xp:18200,maxLevel:false};
  const context=vm.createContext({$:node,lovysCollectionData:{maxXp:LOVYS_MAX_XP,lovys:[chosen]},lovysXpTransferTargetId:1,lovysXpTransferAmount:10000,artForLovys(){return '';}});
  vm.runInContext(code,context);vm.runInContext('updateLovysXpTransferCapacity()',context);
  assert.equal(node('lovysXpTransferValue').max,'6800');assert.equal(node('lovysXpTransferConfirm').disabled,false);
  chosen.maxLevel=true;chosen.xp=LOVYS_MAX_XP;vm.runInContext('updateLovysXpTransferCapacity()',context);assert.equal(node('lovysXpTransferConfirm').disabled,true);
});
