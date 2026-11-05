import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { PGlite } from '@electric-sql/pglite';
import { initPveRewards, pveVictoryReward } from '../src/combat/rewards.js';
import { createPveRouter } from '../src/routes/pve.js';
import { createBattleState } from '../src/combat/battle.js';

const fight={key:'forest_1',name:'Test',hp:1,attack:1,defense:0,speed:1,level:1,rewards:{creatureXp:12,globalXp:4,fragments:2}};
const response=()=>({statusCode:200,status(code){this.statusCode=code;return this;},json(body){this.body=body;return this;}});

test('cash is 3–5 inclusive for normal fights and exactly 10 for both bosses',()=>{
  for(const cash of [3,4,5])assert.equal(pveVictoryReward(fight,{firstWin:true,firstLovysWin:true},(min,max)=>{assert.equal(min,3);assert.equal(max,6);return cash;}).cash,cash);
  for(const flags of [{boss:true,miniBoss:true},{boss:true,finalBoss:true}])assert.equal(pveVictoryReward({...fight,...flags},{firstWin:false,firstLovysWin:true}).cash,10);
  assert.deepEqual(pveVictoryReward(fight,{firstWin:false,firstLovysWin:false}),{creatureXp:0,globalXp:0,fragments:0,cash:0});
});

test('persisted rewards, historical migration, replays, losses and active-Lovys switches',async()=>{
  const db=new PGlite();
  const client={async query(sql,args=[]){const r=await db.query(sql,args);return {...r,rowCount:r.rows.length||r.affectedRows||0};},release(){}};
  const pool={...client,connect:async()=>client};
  try{
    await db.exec(`CREATE TABLE users(id int PRIMARY KEY,twitch_id text,creature_id text,xp float DEFAULT 0,pending_xp float DEFAULT 0,global_xp float DEFAULT 0,egg_fragments int DEFAULT 0,points float DEFAULT 0,lifetime_lovercash_earned float DEFAULT 0,updated_at timestamptz);
    CREATE TABLE user_lovys(id int PRIMARY KEY,user_id int REFERENCES users(id),creature_id text,is_active boolean,xp float DEFAULT 0,rank int DEFAULT 1,fragments int DEFAULT 0,updated_at timestamptz);
    CREATE TABLE economy_migrations(version text PRIMARY KEY);
    CREATE TABLE user_pve_progress(user_id int,fight_key text,wins int,attempts int,first_won_at timestamptz,last_fought_at timestamptz,PRIMARY KEY(user_id,fight_key));
    CREATE TABLE user_pve_battles(user_id int PRIMARY KEY,fight_key text,state_json jsonb,updated_at timestamptz);
    CREATE TABLE user_combat_reports(id serial PRIMARY KEY,user_id int,fight_key text,result text,creature_level int,enemy_level int,creature_power int,enemy_power int,reward_creature_xp float,reward_global_xp float,reward_fragments int,report_json jsonb,created_at timestamptz DEFAULT CURRENT_TIMESTAMP);
    INSERT INTO users(id,twitch_id,creature_id) VALUES(1,'player','plant');
    INSERT INTO user_lovys(id,user_id,creature_id,is_active) VALUES(11,1,'plant',true),(12,1,'fire',false);
    INSERT INTO user_combat_reports(user_id,fight_key,result,report_json) VALUES(1,'old','victory','{"creatureId":"plant"}'),(1,'lost','defeat','{"creatureId":"fire"}');`);
    await initPveRewards(pool);
    assert.deepEqual((await db.query('SELECT lovys_id,fight_key FROM user_pve_lovys_wins')).rows,[{lovys_id:11,fight_key:'old'}]);
    const router=createPveRouter({pool,zones:[{key:'forest',fights:[fight]}],previousFight:()=>null,fightByKey:()=>fight,creatureBattleStats:()=>({}),typeMultiplier:()=>1});
    const action=router.stack.find(x=>x.route?.path==='/action').route.stack[0].handle;
    const play=async(lovysId,{lose=false}={})=>{
      const state=createBattleState({fight:lose?{...fight,hp:10000,attack:100000,speed:10000}:fight,player:{lovysId,creatureId:lovysId===11?'plant':'fire',name:'Lovy',level:1,rank:1,hp:100,attack:1000,defense:0,speed:10,skills:[]}});
      state.achievementDamageTaken=0;
      await db.query('INSERT INTO user_pve_battles VALUES(1,$1,$2,NULL) ON CONFLICT(user_id) DO UPDATE SET state_json=$2',[fight.key,JSON.stringify(state)]);
      const res=response();await action({session:{account:{id:1},user:{twitchId:'player'}},body:{action:'basic'}},res);
      assert.equal(res.statusCode,200);return res.body;
    };
    const first=await play(11);assert.equal(first.firstWin,true);assert.equal(first.firstLovysWin,true);assert.equal(first.reward.creatureXp,12);assert.equal(first.reward.fragments,2);assert.ok(first.reward.cash>=3&&first.reward.cash<=5);
    const repeat=await play(11);assert.deepEqual(repeat.reward,{creatureXp:0,globalXp:0,fragments:0,cash:0});
    // The opponent is still pre-boss: repeated victories must already be unpaid.
    const loss=await play(12,{lose:true});assert.equal(loss.victory,false);assert.equal(loss.reward.cash,0);
    const other=await play(12);assert.equal(other.firstWin,false);assert.equal(other.firstLovysWin,true);assert.equal(other.reward.creatureXp,12);assert.equal(other.reward.globalXp,0);assert.equal(other.reward.fragments,0);
    assert.equal((await play(12)).reward.cash,0);
    const user=(await db.query('SELECT * FROM users')).rows[0];assert.equal(user.points,first.reward.cash+other.reward.cash);assert.equal(user.lifetime_lovercash_earned,user.points);assert.equal(user.global_xp,4);assert.equal(user.egg_fragments,2);
    const lovys=(await db.query('SELECT xp FROM user_lovys ORDER BY id')).rows;assert.deepEqual(lovys,[{xp:12},{xp:12}]);
    await initPveRewards(pool);assert.equal((await play(11)).reward.cash,0);
    const duplicate=response();await action({session:{account:{id:1},user:{twitchId:'player'}},body:{action:'basic'}},duplicate);assert.equal(duplicate.statusCode,409);
    const get=router.stack.find(x=>x.route?.path==='/').route.stack[0].handle,res=response();await get({session:{account:{id:1},user:{twitchId:'player'}}},res);assert.equal(res.body.zones[0].fights[0].wonWithLovys,true);
  } finally {await db.close();}
});

test('reward previews and results distinguish a new Lovys from a paid replay',()=>{
 const source=fs.readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
 const context=vm.createContext({});vm.runInContext(source.slice(source.indexOf('function pveRewardPreview('),source.indexOf('function pveFightDetailMarkup(')),context);
 context.fight={...fight,won:true,wonWithLovys:false,cashRange:{min:3,max:5}};
 assert.match(vm.runInContext('pveRewardPreview(fight)',context),/3 à 5 LoVeR/);
 assert.doesNotMatch(vm.runInContext('pveRewardPreview(fight)',context),/globale|fragments/);
 context.fight.wonWithLovys=true;assert.match(vm.runInContext('pveRewardPreview(fight)',context),/aucune nouvelle/);
 assert.match(vm.runInContext('pveResultRewardText({victory:true,firstWin:false,firstLovysWin:true,reward:{creatureXp:12,cash:4}})',context),/12 XP Lovys.*4 LoVeR/);
});
