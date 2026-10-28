import test from 'node:test';
import assert from 'node:assert/strict';
import {PGlite} from '@electric-sql/pglite';
import {initDropSchedule,advanceDropSchedule,randomDropDelay,validateDropSchedule} from '../src/game-bot-schedule.js';
import {createGameBot} from '../src/routes/game-bot.js';

test('le délai est tiré entre les bornes incluses et les réglages restent valides',()=>{
  assert.equal(randomDropDelay(20,40,(min,max)=>min),1200);
  assert.equal(randomDropDelay(20,40,(min,max)=>max-1),2400);
  assert.equal(randomDropDelay(5,5,(min,max)=>max-1),300);
  assert.deepEqual(validateDropSchedule({enabled:true,minMinutes:20,maxMinutes:40}),{enabled:true,minMinutes:20,maxMinutes:40});
  for(const settings of [{enabled:'true',minMinutes:20,maxMinutes:40},{enabled:true,minMinutes:0,maxMinutes:40},{enabled:true,minMinutes:20,maxMinutes:19},{enabled:true,minMinutes:5,maxMinutes:181},{enabled:true,minMinutes:5.5,maxMinutes:40}])assert.throws(()=>validateDropSchedule(settings));
});

test('le planning persiste, ne prépare qu’un drop et repart après la fin ou un nouveau live',async()=>{
  const db=new PGlite();
  const client={async query(sql,args){const result=await db.query(sql,args);return {...result,rowCount:result.rows.length||result.affectedRows||0};}};
  await db.exec("CREATE TABLE game_bot_drops(id BIGSERIAL PRIMARY KEY,reward_key TEXT,status TEXT DEFAULT 'pending',settled_at TIMESTAMPTZ);CREATE UNIQUE INDEX only_open ON game_bot_drops((1)) WHERE status IN ('pending','open')");
  await initDropSchedule(client);
  let draws=0,rewards=0;
  const advance=async(live=true)=>{await db.exec('BEGIN');try{await advanceDropSchedule(client,{live,random:(min)=>{draws++;return min;},chooseReward:()=>{rewards++;return {key:'xp'};}});await db.exec('COMMIT');}catch(error){await db.exec('ROLLBACK');throw error;}};
  const state=async()=>(await db.query('SELECT * FROM game_bot_drop_schedule')).rows[0];
  try{
    await advance(false);assert.equal((await state()).next_at,null);
    await advance();const next=(await state()).next_at;assert.ok(next);assert.equal(draws,1);
    await advance();assert.deepEqual((await state()).next_at,next);assert.equal(draws,1);
    await initDropSchedule(client);await advance();assert.deepEqual((await state()).next_at,next);
    await db.exec("UPDATE game_bot_drop_schedule SET next_at=CURRENT_TIMESTAMP-INTERVAL '1 second'");
    await advance();await advance();assert.equal(rewards,1);assert.equal((await state()).next_at,null);
    assert.equal((await db.query('SELECT * FROM game_bot_drops')).rows.length,1);
    await db.exec("UPDATE game_bot_drops SET status='settled'");await advance();assert.ok((await state()).next_at);assert.equal(draws,2);
    await db.exec("UPDATE game_bot_drop_schedule SET next_at=CURRENT_TIMESTAMP-INTERVAL '1 second'");await advance(false);assert.equal(rewards,1);assert.equal((await state()).next_at,null);
    await advance();assert.equal(draws,3);
    await db.exec("UPDATE game_bot_drop_schedule SET next_at=CURRENT_TIMESTAMP-INTERVAL '1 second'");await advance();
    await db.exec("UPDATE game_bot_drops SET status='open' WHERE status='pending';UPDATE game_bot_drop_schedule SET enabled=FALSE");
    await advance();assert.equal((await db.query("SELECT * FROM game_bot_drops WHERE status='open'")).rows.length,1);
    await advance(false);assert.equal((await db.query("SELECT * FROM game_bot_drops WHERE status='open'")).rows.length,0);
    await advance();assert.equal((await state()).next_at,null);
    const bot=createGameBot({pool:client,baseUrl:'https://example.com',getBroadcasterAccount:async req=>req.allowed});
    const handler=bot.router.stack.find(layer=>layer.route?.path==='/admin/game-bot/schedule').route.stack[0].handle;
    let code=200;const res={status(n){code=n;return this;},sendStatus(n){code=n;},json(){}};
    await handler({allowed:false,body:{enabled:true,minMinutes:5,maxMinutes:10}},res);assert.equal(code,403);assert.equal((await state()).enabled,false);
    code=200;await handler({allowed:true,body:{enabled:true,minMinutes:40,maxMinutes:20}},res);assert.equal(code,400);
    code=200;await handler({allowed:true,body:{enabled:true,minMinutes:10,maxMinutes:30}},res);assert.equal(code,200);assert.equal((await state()).min_minutes,10);assert.equal((await state()).next_at,null);
  }finally{await db.close();}
});
