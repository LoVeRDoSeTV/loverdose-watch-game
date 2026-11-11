import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { PGlite } from '@electric-sql/pglite';
import { globalThresholdForLevel,lovysProgressionFromXp,lovysThresholdForLevel,migratePreviousLovysXp,migrateLovysProgressionCurve,LOVYS_MAX_XP,LIVE_TICK_SQL,creditLovysXp,reconcileLovysXp,syncActiveLovysXp,recordDailyLiveActivity } from '../src/xp-economy.js';
import { ACHIEVEMENT_FAMILIES,WATCH_FAMILIES,WATCH_HOUR_STAGES,createAchievements } from '../src/achievements.js';
import { PVE_ZONES,PVE_FIGHTS,pveFightByKey,pvePreviousFight } from '../src/combat/zones.js';
import { initPveRewards } from '../src/combat/rewards.js';
import { createPveRouter } from '../src/routes/pve.js';
import { createBattleState } from '../src/combat/battle.js';

const source=fs.readFileSync(new URL('../server.js',import.meta.url),'utf8');
let db,pool,client;
const query=async(sql,args=[])=>{const r=await db.query(sql,args);return {...r,rowCount:r.rows.length||r.affectedRows||0};};
test.before(async()=>{
 db=new PGlite();client={query,release(){}};pool={query,connect:async()=>client};
 await db.exec(`CREATE TABLE users(id int PRIMARY KEY,twitch_id text,creature_id text,xp double precision DEFAULT 0,pending_xp double precision DEFAULT 0,
 global_xp double precision DEFAULT 0,prestige int DEFAULT 0,is_sub boolean DEFAULT FALSE,points double precision DEFAULT 0,
 lifetime_lovercash_earned double precision DEFAULT 0,watch_seconds bigint DEFAULT 0,away_lovys_xp double precision DEFAULT 0,
 away_global_xp double precision DEFAULT 0,away_lovercash double precision DEFAULT 0,away_watch_seconds bigint DEFAULT 0,last_live_seen_at timestamptz,updated_at timestamptz,
 total_lovys_hatched int DEFAULT 0,progress_reset_at timestamptz);
 CREATE TABLE user_lovys(id int PRIMARY KEY,user_id int REFERENCES users(id),creature_id text,xp double precision DEFAULT 0,is_active boolean DEFAULT FALSE,rank int DEFAULT 1,fragments int DEFAULT 0,updated_at timestamptz);
 CREATE TABLE user_active_boosts(user_id int,boost_key text,starts_at timestamptz,expires_at timestamptz,remaining_live_seconds double precision,PRIMARY KEY(user_id,boost_key));
 CREATE TABLE user_daily_activity(user_id int,activity_date date,watch_seconds bigint,global_xp_earned double precision,lovercash_earned double precision,updated_at timestamptz,PRIMARY KEY(user_id,activity_date));
 CREATE TABLE user_game_tabs(user_id int,last_seen_at timestamptz);
 CREATE TABLE user_pve_progress(user_id int,fight_key text,wins int DEFAULT 0,attempts int DEFAULT 0,first_won_at timestamptz,last_fought_at timestamptz,PRIMARY KEY(user_id,fight_key));
 CREATE TABLE user_lovys_pve_progress(user_id int,lovys_id int REFERENCES user_lovys(id),fight_key text,won_at timestamptz DEFAULT CURRENT_TIMESTAMP,PRIMARY KEY(user_id,lovys_id,fight_key));
 CREATE TABLE user_pve_battles(user_id int PRIMARY KEY,fight_key text,state_json jsonb,updated_at timestamptz);
 CREATE TABLE user_combat_reports(id serial PRIMARY KEY,user_id int,fight_key text,result text,creature_level int,enemy_level int,creature_power int,enemy_power int,reward_creature_xp int,reward_global_xp int,reward_fragments int,report_json jsonb,created_at timestamptz DEFAULT CURRENT_TIMESTAMP);
 CREATE TABLE economy_migrations(version text PRIMARY KEY);
 ALTER TABLE users ADD COLUMN egg_fragments int DEFAULT 0;
 CREATE TABLE accounts(id int PRIMARY KEY,equipped_title_key text,equipped_background_key text,equipped_frame_key text,equipped_avatar_frame_key text);
 CREATE TABLE user_game_watch(user_id int,game_id text,game_name text,watch_seconds bigint);
 CREATE TABLE user_badges(user_id int,badge_key text,game_id text,game_name text,badge_name text,badge_image text,badge_challenge text,tier text,threshold_hours double precision,equipped_slot int,leaderboard_slot int,PRIMARY KEY(user_id,badge_key));
 CREATE TABLE user_xp_rewards(user_id int,reward_key text,xp_amount double precision,PRIMARY KEY(user_id,reward_key));
 CREATE TABLE trade_offers(creator_user_id int,accepted_by_user_id int,status text,accepted_at timestamptz);
 CREATE TABLE player_trade_offers(creator_user_id int,target_user_id int,status text,accepted_at timestamptz);
 CREATE TABLE user_daily_challenge_state(user_id int,challenge_date date,claimed_at timestamptz);
 CREATE TABLE user_reward_wheel_spins(user_id int,wheel_type text);
 CREATE TABLE user_reward_wheels(user_id int PRIMARY KEY,daily_last_spin_at timestamptz,weekly_last_spin_at timestamptz,weekly_ready boolean DEFAULT FALSE,weekly_live_checkpoint int DEFAULT 0,updated_at timestamptz);
 CREATE TABLE user_live_attendance(user_id int,stream_id text,badge_watch_seconds bigint,wheel_legacy_credited boolean DEFAULT FALSE);
 CREATE TABLE shop_inventory(account_id int,item_key text,quantity int,PRIMARY KEY(account_id,item_key));
 CREATE TABLE user_global_xp_level_rewards(user_id int,prestige int,level int,xp_amount double precision,PRIMARY KEY(user_id,prestige,level));
 CREATE TABLE user_global_cash_level_rewards(user_id int,prestige int,level int,cash_amount double precision,PRIMARY KEY(user_id,prestige,level));
 CREATE TABLE user_global_lovys_xp_rewards(user_id int,prestige int,level int,xp_amount double precision,PRIMARY KEY(user_id,prestige,level));`);
});

test('PvE checkmarks follow the active Lovys while unlocks and first rewards follow the account',async()=>{
 const id=await player(),otherId=id+20000,keys=PVE_FIGHTS.slice(0,2).map(f=>f.key);
 await query("INSERT INTO user_lovys(id,user_id,creature_id,is_active) VALUES($1,$2,'water',FALSE)",[otherId,id]);
 for(const key of keys){
  await query('INSERT INTO user_pve_progress(user_id,fight_key,wins) VALUES($1,$2,1)',[id,key]);
  await query('INSERT INTO user_lovys_pve_progress(user_id,lovys_id,fight_key) VALUES($1,$1,$2)',[id,key]);
 }
 const router=createPveRouter({pool,zones:PVE_ZONES,previousFight:pvePreviousFight,fightByKey:pveFightByKey,creatureBattleStats:()=>({name:'Test'})});
 const handler=router.stack.find(layer=>layer.route?.path==='/').route.stack[0].handle;
 async function read(){const res=response();await handler({session:{account:{id},user:{twitchId:String(id)}}},res);assert.equal(res.statusCode,200);return res.body;}
 const first=await read();assert.equal(first.activeLovysId,id);assert.equal(first.zones[0].fights.filter(f=>f.won).length,2);
 await query('UPDATE user_lovys SET is_active=(id=$2) WHERE user_id=$1',[id,otherId]);
 const second=await read();assert.equal(second.activeLovysId,otherId);assert.equal(second.zones[0].fights.filter(f=>f.won).length,0);
 for(const f of second.zones[0].fights.slice(0,2)){assert.equal(f.accountWon,true);assert.equal(f.replayRewardAvailable,true);}
 // Chaque Lovys doit débloquer son propre combat suivant ; les victoires du compte restent consultables.
 assert.equal(first.zones[0].fights[1].unlocked,true);
 assert.equal(second.zones[0].fights[0].unlocked,true);
 assert.equal(second.zones[0].fights[1].unlocked,false);
 await query('INSERT INTO user_lovys_pve_progress(user_id,lovys_id,fight_key) VALUES($1,$2,$3)',[id,otherId,keys[0]]);
 const partial=await read();assert.equal(partial.zones[0].fights[0].won,true);assert.equal(partial.zones[0].fights[1].won,false);assert.equal(partial.zones[0].fights[0].replayRewardAvailable,false);
 await query('UPDATE user_lovys SET is_active=(id=$2) WHERE user_id=$1',[id,id]);
 assert.equal((await read()).zones[0].fights.filter(f=>f.won).length,2);
});

test('PvE replays reward each other Lovys once, then stop after its zone boss',async()=>{
 const id=await player(600),otherId=id+10000;
 await query("INSERT INTO user_lovys(id,user_id,creature_id,xp,is_active) VALUES($1,$2,'plant',0,FALSE)",[otherId,id]);
 const router=createPveRouter({pool,zones:PVE_ZONES,previousFight:pvePreviousFight,fightByKey:pveFightByKey,globalThresholdForLevel});
 const handler=router.stack.find(layer=>layer.route?.path==='/action').route.stack[0].handle;
 const fight=PVE_FIGHTS[0],boss=PVE_ZONES[0].fights.find(item=>item.finalBoss);
 async function win(lovysId,fightToWin=fight){
  const state=createBattleState({fight:fightToWin,player:{name:'Test',creatureId:'plant',lovysId,level:5,rank:1,type:'Neutre',hp:100000,attack:100000,defense:10000,speed:100}});
  await query('INSERT INTO user_pve_battles VALUES($1,$2,$3,NULL)',[id,fightToWin.key,JSON.stringify(state)]);
  const res=response();await handler({session:{account:{id},user:{twitchId:String(id)}},body:{action:'basic'}},res);
  assert.equal(res.statusCode,200);assert.equal(res.body.victory,true);return res.body;
 }
 const first=await win(id);
 assert.ok(first.reward.cash>=3&&first.reward.cash<=5);
 assert.equal((await win(id)).replayReward,false);
 const replay=await win(otherId);
 assert.equal(replay.replayReward,true);assert.ok(replay.reward.cash>=3&&replay.reward.cash<=5);
 assert.equal(replay.reward.creatureXp,fight.rewards.creatureXp);
 assert.equal((await query('SELECT xp FROM user_lovys WHERE id=$1',[otherId])).rows[0].xp,replay.reward.creatureXp);
 assert.equal((await balances(id)).points,first.reward.cash+replay.reward.cash);
 assert.equal((await win(otherId)).replayReward,false);
 await query('INSERT INTO user_lovys_pve_progress(user_id,lovys_id,fight_key) VALUES($1,$2,$3)',[id,otherId,boss.key]);
 await query('INSERT INTO user_pve_progress(user_id,fight_key,wins) VALUES($1,$2,1)',[id,PVE_FIGHTS[1].key]);
 const blocked=await win(otherId,PVE_FIGHTS[1]);
 assert.equal(blocked.replayReward,false);assert.equal(blocked.reward.cash,0);
 const mini=PVE_ZONES[0].fights.find(item=>item.miniBoss);
 assert.equal((await win(id,mini)).reward.cash,10);
 assert.equal((await win(id,boss)).reward.cash,10);
 assert.equal((await win(id,boss)).reward.cash,0);
 assert.equal((await balances(id)).points,first.reward.cash+replay.reward.cash+20);
});
test.after(async()=>{await db?.close();});
let next=0;
async function player(xp=0,{sub=false,hatched=true}={}){
 const id=++next;
 await query('INSERT INTO users(id,twitch_id,creature_id,xp,is_sub) VALUES($1,$2,$3,$4,$5)',[id,String(id),hatched?'plant':null,xp,sub]);
 await query('INSERT INTO accounts(id) VALUES($1)',[id]);
 if(hatched)await query('INSERT INTO user_lovys(id,user_id,creature_id,xp,is_active) VALUES($1,$1,\'plant\',$2,TRUE)',[id,xp]);
 return id;
}
async function balances(id){return (await query('SELECT * FROM users WHERE id=$1',[id])).rows[0];}
async function tick(ids,seconds=3600){
 const ratio=seconds/3600;
 await query('BEGIN');
 const result=await query(LIVE_TICK_SQL,[100*ratio,120*ratio,10*ratio,12*ratio,seconds,ids.map(String),50*ratio,60*ratio,LOVYS_MAX_XP,'2026-10-24T12:00:00Z']);
 await syncActiveLovysXp(client,ids);
 await query('COMMIT');
 return result;
}
function extracted(start,end,extra={}){
 const ctx={pool,console,globalThresholdForLevel,...extra};vm.createContext(ctx);
 vm.runInContext(source.slice(source.indexOf(start),source.indexOf(end,source.indexOf(start))),ctx);
 return ctx;
}
function response(){return {statusCode:200,status(n){this.statusCode=n;return this;},json(body){this.body=body;return this;}};}

test('global thresholds keep their current curve',()=>{
 assert.equal(globalThresholdForLevel(10),810);assert.equal(globalThresholdForLevel(25),3960);assert.equal(globalThresholdForLevel(55),17010);assert.equal(globalThresholdForLevel(56),17600);
});
test('slower curve keeps existing Lovys levels, progress and all badge rewards',()=>{
 assert.equal(lovysThresholdForLevel(10),1000);
 assert.equal(Math.round(lovysThresholdForLevel(18)),3667);
 assert.equal(lovysThresholdForLevel(25),6000);
 assert.equal(lovysThresholdForLevel(50),LOVYS_MAX_XP);
 for(const level of [1,10,11,18,25,26,40,50]){
  const old=level<=25?(level<=10?(level-1)*1000/9:1000+(level-10)*2500/15):3500+260*(level-25)+25*(level-25)*(level-26);
  const mapped=migratePreviousLovysXp(old);
  assert.equal(lovysProgressionFromXp(mapped).level,level);
  assert.ok(Math.abs(mapped-lovysThresholdForLevel(level))<1e-7);
 }
});

test('pace migration preserves active and inactive levels once without changing reserve',async()=>{
 const id=await player(1000+8*2500/15);
 const inactive=id+10000;
 await query("INSERT INTO user_lovys(id,user_id,creature_id,xp,is_active) VALUES($1,$2,'water',$3,FALSE)",[inactive,id,3500]);
 await query('UPDATE users SET pending_xp=500 WHERE id=$1',[id]);
 // This fixture already uses the previous 25 000 XP curve.
 await query("CREATE TABLE IF NOT EXISTS economy_migrations(version text PRIMARY KEY,applied_at timestamptz DEFAULT CURRENT_TIMESTAMP)");
 await query("INSERT INTO economy_migrations(version) VALUES('v498-lovys-curve') ON CONFLICT DO NOTHING");
 await migrateLovysProgressionCurve(pool);
 let u=await balances(id),other=(await query('SELECT xp FROM user_lovys WHERE id=$1',[inactive])).rows[0];
 assert.equal(lovysProgressionFromXp(u.xp).level,18);
 assert.equal(lovysProgressionFromXp(other.xp).level,25);
 assert.equal(u.pending_xp,500);
 const xp=u.xp;
 await migrateLovysProgressionCurve(pool);
 u=await balances(id);
 assert.equal(u.xp,xp);
 assert.equal(u.pending_xp,500);
});

test('real SQL credits normal, subscriber and pre-hatch reserve without multiplying watch time',async()=>{
 const a=await player(),b=await player(0,{sub:true}),c=await player(0,{hatched:false});
 await tick([a,b,c]);
 for(const [id,xp,global,cash] of [[a,100,50,10],[b,120,60,12]]){const u=await balances(id);assert.equal(u.xp,xp);assert.equal(u.global_xp,global);assert.equal(u.points,cash);assert.equal(Number(u.watch_seconds),3600);assert.equal((await query('SELECT xp FROM user_lovys WHERE id=$1',[id])).rows[0].xp,xp);}
 const u=await balances(c);assert.equal(u.xp,0);assert.equal(u.pending_xp,100);
});
test('live gains stop exactly at level 50 and send overflow to reserve',async()=>{
 const id=await player(LOVYS_MAX_XP-50);await tick([id]);let u=await balances(id);assert.equal(u.xp,LOVYS_MAX_XP);assert.equal(u.pending_xp,50);
 await tick([id]);u=await balances(id);assert.equal(u.xp,LOVYS_MAX_XP);assert.equal(u.pending_xp,150);
});
test('potion expiry midway through a poll pays only its overlap and reports actual boosted cash',async()=>{
 const id=await player();
 // Double XP utilise désormais 30 secondes de présence restantes, tandis que le boost Cash garde sa date d'expiration.
 for(const key of ['boost_xp_x2','boost_cash_x2'])await query('INSERT INTO user_active_boosts(user_id,boost_key,starts_at,expires_at,remaining_live_seconds) VALUES($1,$2,$3,$4,$5)',[id,key,'2026-10-24T11:00:00Z','2026-10-24T11:59:30Z',key==='boost_xp_x2'?30:null]);
 const r=await tick([id],60),u=await balances(id);
 assert.ok(Math.abs(u.xp-2.5)<1e-9);assert.ok(Math.abs(u.points-.25)<1e-9);assert.equal(r.rows[0].cash_gain,u.points);assert.equal(Number(u.watch_seconds),60);
});
test('restart reconciles stale active XP and recovers every overflow exactly once',async()=>{
 const id=await player(LOVYS_MAX_XP+1200);await query('UPDATE user_lovys SET xp=$2 WHERE id=$1',[id,LOVYS_MAX_XP+500]);
 await query('INSERT INTO user_lovys VALUES($1,$2,\'water\',$3,FALSE,1,0,NULL)',[id+10000,id,LOVYS_MAX_XP+800]);
 await reconcileLovysXp(pool);let u=await balances(id);assert.equal(u.xp,LOVYS_MAX_XP);assert.equal(u.pending_xp,2000);
 await reconcileLovysXp(pool);u=await balances(id);assert.equal(u.pending_xp,2000);
});
test('a first win preserves live XP despite an old collection snapshot',async()=>{
 await initPveRewards(pool);
 const id=await player(600);await query('UPDATE user_lovys SET xp=500 WHERE id=$1',[id]);
 await query('BEGIN');await creditLovysXp(client,id,id,20);await query('COMMIT');
 assert.equal((await balances(id)).xp,620);assert.equal((await query('SELECT xp FROM user_lovys WHERE id=$1',[id])).rows[0].xp,620);
});
test('inactive fighter receives its reward without changing the newly active Lovys',async()=>{
 const id=await player(700),fighter=id+10000;await query('INSERT INTO user_lovys VALUES($1,$2,\'water\',$3,FALSE,1,0,NULL)',[fighter,id,LOVYS_MAX_XP-10]);
 await query('BEGIN');await creditLovysXp(client,id,fighter,30);await query('COMMIT');
 const u=await balances(id);assert.equal(u.xp,700);assert.equal(u.pending_xp,20);assert.equal((await query('SELECT xp FROM user_lovys WHERE id=$1',[fighter])).rows[0].xp,LOVYS_MAX_XP);
});
test('actual donation route caps transfer, rejects max level and invalid amounts without spending twice',async()=>{
 let handler;extracted("app.post('/api/progression/transfer-lovys-xp'","app.post('/api/prestige'",{app:{post:(p,h)=>handler=h},LOVYS_MAX_XP,pushLiveUpdate(){}});
 const id=await player(LOVYS_MAX_XP-10);await query('UPDATE users SET pending_xp=100 WHERE id=$1',[id]);
 const call=async amount=>{const res=response();await handler({session:{account:{id},user:{twitchId:String(id)}},body:{lovysId:id,amount}},res);return res;};
 const first=await call(100);assert.equal(first.body.transferredXp,10);assert.equal((await balances(id)).pending_xp,90);
 assert.equal((await call(100)).statusCode,400);assert.equal((await balances(id)).pending_xp,90);
 const other=await player(0);await query('UPDATE users SET pending_xp=50 WHERE id=$1',[other]);
 const res=response();await handler({session:{account:{id:other},user:{twitchId:String(other)}},body:{lovysId:other,amount:'bad'}},res);assert.equal(res.statusCode,400);assert.equal((await balances(other)).pending_xp,50);
});
test('weekly wheel ignores short visits, counts one-hour lives and preserves consumed checkpoints',async()=>{
 const id=await player();const ctx=extracted('async function syncRewardWheelState','async function applyWheelReward',{LIVE_ATTENDANCE_SECONDS:3600});
 for(let n=0;n<8;n++)await query('INSERT INTO user_live_attendance VALUES($1,$2,$3)',[id,String(n),n===7?3599:3600]);
 let state=await ctx.syncRewardWheelState(client,id);assert.equal(state.weekly_ready,true);assert.equal(state.total_live_attendance,7);
 await query('UPDATE user_reward_wheels SET weekly_live_checkpoint=7 WHERE user_id=$1',[id]);
 state=await ctx.syncRewardWheelState(client,id);assert.equal(state.weekly_ready,false);assert.equal(state.weekly_live_progress,0);
 await query('UPDATE user_live_attendance SET badge_watch_seconds=3600 WHERE user_id=$1 AND stream_id=\'7\'',[id]);
 state=await ctx.syncRewardWheelState(client,id);assert.equal(state.weekly_live_progress,1);
});
test('PvE zone payouts follow their XP spans and guardians earn the larger shares',()=>{
 for(const zone of PVE_ZONES){const regular=zone.fights.filter(f=>!f.boss);const mini=zone.fights.find(f=>f.miniBoss),boss=zone.fights.find(f=>f.finalBoss);assert.ok(mini.rewards.creatureXp>Math.max(...regular.map(f=>f.rewards.creatureXp)));assert.ok(boss.rewards.creatureXp>mini.rewards.creatureXp);}
 assert.equal(PVE_FIGHTS.reduce((sum,f)=>sum+f.rewards.creatureXp,0),1920);
});
test('all progressive badge images exist, including the five MW4 stages',()=>{
 for(const f of [...ACHIEVEMENT_FAMILIES,...WATCH_FAMILIES.map(f=>({...f,steps:WATCH_HOUR_STAGES}))])for(let n=1;n<=f.steps.length;n++)assert.ok(fs.statSync(new URL(`../public/badges/${f.id}-${n}.webp`,import.meta.url)).size>1000);
});

test('actual PvE action route preserves live XP, pays the first victory once and allows a replay',async()=>{
 await initPveRewards(pool);
 const id=await player(600);await query('UPDATE user_lovys SET xp=500 WHERE id=$1',[id]);
 const router=createPveRouter({pool,zones:PVE_ZONES,previousFight:pvePreviousFight,fightByKey:pveFightByKey,globalThresholdForLevel});
 const handler=router.stack.find(layer=>layer.route?.path==='/action').route.stack[0].handle;
 const fight=PVE_FIGHTS[0];
 for(let n=0;n<2;n++){
  const state=createBattleState({fight,player:{name:'Test',creatureId:'plant',lovysId:id,level:5,rank:1,type:'Neutre',hp:100000,attack:100000,defense:10000,speed:100}});
  state.achievementDamageTaken=0;
  await query('INSERT INTO user_pve_battles VALUES($1,$2,$3,NULL)',[id,fight.key,JSON.stringify(state)]);
  const res=response();await handler({session:{account:{id},user:{twitchId:String(id)}},body:{action:'basic'}},res);
  assert.equal(res.statusCode,200);assert.equal(res.body.victory,true);assert.equal(res.body.firstWin,n===0);
  assert.equal((await balances(id)).xp,600+fight.rewards.creatureXp);
 }
 assert.equal((await query('SELECT wins FROM user_pve_progress WHERE user_id=$1',[id])).rows[0].wins,2);
 assert.ok((await balances(id)).points>=3&&(await balances(id)).points<=5);
 assert.equal((await balances(id)).egg_fragments,fight.rewards.fragments);
 const achievements=createAchievements({pool,creatures:[],zones:PVE_ZONES,progressionFromXp:lovysProgressionFromXp,awardRewards:async()=>{}});
 await achievements.init();
 const badge=(await achievements.sync(id,id)).find(item=>item.badgeKey==='achievement:victories');
 assert.equal(badge.progressValue,1);
 assert.equal(badge.stages[0].unlocked,true);
 // Corrige également les anciens compteurs qui avaient déjà inclus les replays.
 await query("UPDATE user_achievement_progress SET value=30 WHERE user_id=$1 AND metric='victories'",[id]);
 assert.equal((await achievements.sync(id,id)).find(item=>item.badgeKey==='achievement:victories').progressValue,1);
});

test('badge rebalance tops up old tiers once and pays the same total to a new player',async()=>{
 const ctx=extracted('async function awardBadgeEconomyRewardsOnce','async function runTrackerTick');
 const service=createAchievements({pool,creatures:[],zones:PVE_ZONES,progressionFromXp:lovysProgressionFromXp,awardRewards:ctx.awardBadgeEconomyRewardsOnce});
 await service.init();
 const old=await player(0,{hatched:false}),fresh=await player(0,{hatched:false});
 await query('UPDATE users SET total_lovys_hatched=100 WHERE id=ANY($1::int[])',[[old,fresh]]);
 await query('INSERT INTO user_badges(user_id,badge_key,tier,threshold_hours) VALUES($1,\'achievement:eggs\',\'achievement-4\',100)',[old]);
 const legacyXp=[10,25,50,100];
 for(const [i,goal] of [1,10,30,100].entries())await query('INSERT INTO user_xp_rewards VALUES($1,$2,$3)',[old,`achievement:eggs:achievement-${goal}-v1`,legacyXp[i]]);
 await query('UPDATE users SET pending_xp=185,global_xp=75,points=11 WHERE id=$1',[old]);
 const cards=await service.sync(old,old);await service.sync(fresh,fresh);
 const expected=ACHIEVEMENT_FAMILIES.find(f=>f.id==='eggs').steps.reduce((sum,s)=>sum+s.rewards.lovysXp,0);
 assert.equal(expected,710);assert.equal((await balances(old)).pending_xp,expected);assert.equal((await balances(fresh)).pending_xp,expected);
 const before=await balances(old);await service.sync(old,old);const after=await balances(old);
 assert.equal(after.pending_xp,before.pending_xp);assert.equal(after.global_xp,before.global_xp);assert.equal(after.points,before.points);
 assert.equal(cards.find(c=>c.badgeKey==='achievement:eggs').maxed,true);
 // Watch unlock boundaries are raw hours, independent of potion XP.
 await query('INSERT INTO user_game_watch VALUES($1,\'dofus\',\'Dofus\',$2)',[fresh,25*3600]);
 const watch=await service.sync(fresh,fresh);assert.equal(watch.find(c=>c.badgeKey===WATCH_FAMILIES[0].key).evolutionLevel,1);
 const paid=await balances(fresh);await service.sync(fresh,fresh);assert.equal((await balances(fresh)).pending_xp,paid.pending_xp);
 await query('UPDATE user_game_watch SET watch_seconds=$2 WHERE user_id=$1',[fresh,50*3600]);
 const nextCards=await service.sync(fresh,fresh);assert.equal(nextCards.find(c=>c.badgeKey===WATCH_FAMILIES[0].key).evolutionLevel,2);
 assert.equal((await balances(fresh)).pending_xp,paid.pending_xp+500);
});

test('daily cash challenge receives the actual potion-boosted amount, once per credited interval',async()=>{
 const id=await player();await query('INSERT INTO user_active_boosts VALUES($1,\'boost_cash_x2\',$2,$3)',[id,'2026-10-24T10:00:00Z','2026-10-24T13:00:00Z']);
 const r=await tick([id]);await recordDailyLiveActivity(client,'2026-10-24',3600,r.rows);
 const row=(await query('SELECT * FROM user_daily_activity WHERE user_id=$1',[id])).rows[0];
 assert.equal(row.lovercash_earned,20);assert.equal(row.global_xp_earned,50);assert.equal(Number(row.watch_seconds),3600);
});

test('global rewards read locked current XP and prestige keeps excess instead of destroying it',async()=>{
 const ctx=extracted('async function syncGlobalLevelRewards','function typeMultiplier',{});
 // The helper refers to constants declared elsewhere in the server.
 for(const name of ['GLOBAL_LEVEL_CASH_REWARDS','GLOBAL_LEVEL_CASH_LEVELS','GLOBAL_LEVEL_XP_REWARDS']){
  const a=source.indexOf(`const ${name} =`);const b=source.indexOf('\n);',a)>=0&&name==='GLOBAL_LEVEL_XP_REWARDS'?source.indexOf('\n);',a)+3:source.indexOf(';',a)+1;
  vm.runInContext(source.slice(a,b),ctx);
 }
 vm.runInContext(source.slice(source.indexOf('function globalProgressionFromXp'),source.indexOf('const CREATURE_MILESTONES')),ctx);
 const id=await player();await query('UPDATE users SET global_xp=20000 WHERE id=$1',[id]);
 const reward=await ctx.syncGlobalLevelRewards(pool,id,id,0);assert.equal(reward.globalXp,20950);assert.equal((await balances(id)).global_xp,20950);
 await ctx.syncGlobalLevelRewards(pool,id,id,0);assert.equal((await balances(id)).global_xp,20950);
 let handler;ctx.app={post:(p,h)=>handler=h};ctx.pushLiveUpdate=()=>{};
 vm.runInContext(source.slice(source.indexOf("app.post('/api/prestige'"),source.indexOf('const FRAGMENT_EGG_PRICE')),ctx);
 const res=response();await handler({session:{account:{id},user:{twitchId:String(id)}}},res);
 assert.equal(res.statusCode,200);assert.equal((await balances(id)).prestige,1);assert.equal((await balances(id)).global_xp,3350);
});

test('profile reward refresh uses five queries without rewriting earned rewards and preserves prestige grants',async()=>{
 const statements=[];
 const trackedClient={query:async(sql,args)=>{statements.push(sql);return query(sql,args);},release(){}};
 const trackedPool={query:trackedClient.query,connect:async()=>trackedClient};
 const ctx=extracted('async function syncGlobalLevelRewards','function typeMultiplier',{pool:trackedPool});
 for(const name of ['GLOBAL_LEVEL_CASH_REWARDS','GLOBAL_LEVEL_CASH_LEVELS','GLOBAL_LEVEL_XP_REWARDS']){
  const a=source.indexOf(`const ${name} =`);
  const b=name==='GLOBAL_LEVEL_XP_REWARDS'?source.indexOf('\n);',a)+3:source.indexOf(';',a)+1;
  vm.runInContext(source.slice(a,b),ctx);
 }
 vm.runInContext(source.slice(source.indexOf('function globalProgressionFromXp'),source.indexOf('const CREATURE_MILESTONES')),ctx);
 const id=await player();await query('UPDATE users SET global_xp=$2 WHERE id=$1',[id,globalThresholdForLevel(55)]);
 const first=await ctx.syncGlobalLevelRewards(trackedPool,id,id,0);
 assert.ok(first.globalXpGranted>0);assert.ok(first.cashGranted>0);assert.ok(first.pendingXpGranted>0);
 const before=await balances(id);statements.length=0;
 const repeat=await ctx.syncGlobalLevelRewards(trackedPool,id,id,0);
 assert.equal(statements.length,5,'BEGIN, three reads and COMMIT only');
 assert.ok(statements.every(sql=>!/^\s*(INSERT|UPDATE|DELETE)/i.test(sql)));
 assert.deepEqual(await balances(id),before);
 assert.equal(repeat.globalXpGranted,0);assert.equal(repeat.pendingXpGranted,0);assert.equal(repeat.cashGranted,0);
 await query('DELETE FROM user_global_cash_level_rewards WHERE user_id=$1 AND prestige=0 AND level=5',[id]);
 assert.ok((await ctx.syncGlobalLevelRewards(trackedPool,id,id,0)).cashGranted>0,'missing legacy reward is still backfilled');
 assert.equal((await ctx.syncGlobalLevelRewards(trackedPool,id,id,0)).cashGranted,0);
 await query('UPDATE users SET prestige=1 WHERE id=$1',[id]);
 const prestige=await ctx.syncGlobalLevelRewards(trackedPool,id,id,0);
 assert.ok(prestige.globalXpGranted>0);assert.ok(prestige.cashGranted>0);assert.ok(prestige.pendingXpGranted>0);
});

test('startup global XP backfill runs once and never refills a completed prestige',async()=>{
 const legacy=await player(0,{hatched:false}),prestiged=await player(0,{hatched:false});
 await query('UPDATE users SET watch_seconds=7200 WHERE id=ANY($1::int[])',[[legacy,prestiged]]);
 await query('UPDATE users SET prestige=1 WHERE id=$1',[prestiged]);
 const start=source.indexOf('  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS global_xp_initialized');
 const end=source.indexOf('// On initialise le total historique',start);
 const ctx={pool,GLOBAL_XP_PER_HOUR:50};vm.createContext(ctx);
 await vm.runInContext('(async()=>{'+source.slice(start,end)+'})()',ctx);
 assert.equal((await balances(legacy)).global_xp,100);assert.equal((await balances(prestiged)).global_xp,0);
 await query('UPDATE users SET global_xp=0 WHERE id=$1',[legacy]);
 await vm.runInContext('(async()=>{'+source.slice(start,end)+'})()',ctx);
 assert.equal((await balances(legacy)).global_xp,0);
});

test('attendance migration preserves old wheel credits without granting unearned presence badges',async()=>{
 const id=await player();await query('INSERT INTO user_live_attendance(user_id,stream_id,badge_watch_seconds) VALUES($1,\'legacy-short\',30)',[id]);
 const a=source.indexOf('  await pool.query(`CREATE TABLE IF NOT EXISTS economy_migrations');
 const b=source.indexOf('  await pool.query(`CREATE INDEX IF NOT EXISTS user_reward_wheel_spins_user_idx',a);
 const ctx={pool};vm.createContext(ctx);await vm.runInContext('(async()=>{'+source.slice(a,b)+'})()',ctx);
 let row=(await query('SELECT * FROM user_live_attendance WHERE user_id=$1',[id])).rows[0];assert.equal(row.wheel_legacy_credited,true);assert.equal(Number(row.badge_watch_seconds),30);
 await query('INSERT INTO user_live_attendance(user_id,stream_id,badge_watch_seconds) VALUES($1,\'new-short\',30)',[id]);
 await vm.runInContext('(async()=>{'+source.slice(a,b)+'})()',ctx);
 row=(await query('SELECT * FROM user_live_attendance WHERE user_id=$1 AND stream_id=\'new-short\'',[id])).rows[0];assert.equal(row.wheel_legacy_credited,false);
 const wheel=extracted('async function syncRewardWheelState','async function applyWheelReward',{LIVE_ATTENDANCE_SECONDS:3600});
 assert.equal((await wheel.syncRewardWheelState(client,id)).total_live_attendance,1);
 await query('UPDATE user_live_attendance SET badge_watch_seconds=3600 WHERE user_id=$1 AND stream_id=\'legacy-short\'',[id]);
 assert.equal((await wheel.syncRewardWheelState(client,id)).total_live_attendance,1);
});


test('combat badge corrects inflated replay totals for existing players',async()=>{
 const id=await player();
 const service=createAchievements({pool,creatures:[],zones:PVE_ZONES,progressionFromXp:lovysProgressionFromXp,awardRewards:async()=>{}});
 await service.init();
 for(let n=0;n<10;n++)await query('INSERT INTO user_pve_progress(user_id,fight_key,wins,attempts) VALUES($1,$2,3,3)',[id,`fight_${n}`]);
 await query("INSERT INTO user_achievement_progress VALUES($1,'victories',30)",[id]);
 await query("INSERT INTO user_badges(user_id,badge_key,tier,threshold_hours) VALUES($1,'achievement:victories','achievement-2',25)",[id]);
 for(let n=0;n<2;n++){
  const card=(await service.sync(id,id)).find(c=>c.badgeKey==='achievement:victories');
  assert.equal(card.progressValue,10);assert.equal(card.evolutionLevel,1);
  assert.match(card.badgeChallenge,/une seule fois/);
 }
 assert.equal((await query("SELECT value FROM user_achievement_progress WHERE user_id=$1 AND metric='victories'",[id])).rows[0].value,10);
 assert.equal((await query("SELECT threshold_hours FROM user_badges WHERE user_id=$1 AND badge_key='achievement:victories'",[id])).rows[0].threshold_hours,1);
});
