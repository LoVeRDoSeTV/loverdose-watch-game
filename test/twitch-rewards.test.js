import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import express from 'express';
import {createTwitchRewards,hasTwitchRewardAuthorization} from '../src/routes/twitch-rewards.js';

const secret='test-signing-secret';

test('une autorisation Twitch enregistrée suffit pour les récompenses sans nouvelle connexion',async()=>{
  assert.equal(hasTwitchRewardAuthorization({twitch_user_id:'channel',scopes:'moderator:read:chatters channel:manage:redemptions'},'channel'),true);
  assert.equal(hasTwitchRewardAuthorization({twitch_user_id:'channel',scopes:'moderator:read:chatters'},'channel'),false);
  process.env.TWITCH_BROADCASTER_ID='channel';
  const rewards=createTwitchRewards({pool:{query:async()=>({rows:[]})},baseUrl:'https://example.com',
    getTrackerAuthRow:async()=>({twitch_user_id:'channel',scopes:'moderator:read:chatters'}),
    trackerTwitchFetch:async()=>{throw new Error('Twitch ne doit pas être appelé');},getBroadcasterAccount:async()=>({id:1})});
  try{
    await assert.rejects(rewards.setup(),error=>error.twitchAuthorizationRequired===true);
  }finally{delete process.env.TWITCH_BROADCASTER_ID;}
});

function fakeDb(){
  const inventory=new Set(),redemptions=new Map();
  const query=async(sql,args=[])=>{
    if(sql.includes('SELECT secret FROM twitch_reward_config'))return {rows:[{secret}]};
    if(sql.includes('SELECT item_key FROM twitch_reward_items'))return {rows:args[0]==='reward-twitch'?[{item_key:'reward_bg_twitch_live'}]:args[0]==='reward-title'?[{item_key:'reward_title_echo_chat'}]:[]};
    if(sql.includes('SELECT redemption_id,item_key FROM twitch_reward_redemptions')){
      const rewards=[...redemptions.entries()].filter(([,row])=>row.account_id===args[0]&&row.decision==='grant'&&row.settled&&!row.announced_at);
      return {rows:rewards.map(([id,row])=>({redemption_id:id,item_key:row.item_key}))};
    }
    if(sql.includes('SELECT decision,settled FROM twitch_reward_redemptions'))return {rows:redemptions.has(args[0])?[redemptions.get(args[0])]:[]};
    if(sql.includes('SELECT id FROM accounts WHERE twitch_id'))return {rows:args[0]==='linked'?[{id:42}]:[]};
    if(sql.includes('SELECT 1 FROM shop_inventory'))return {rowCount:inventory.has(`${args[0]}:${args[1]}`)?1:0};
    if(sql.includes('INSERT INTO twitch_reward_redemptions')){redemptions.set(args[0],{item_key:args[1],account_id:args[3],decision:args[4],settled:false,announced_at:null});return {rowCount:1};}
    if(sql.includes('INSERT INTO shop_inventory')){inventory.add(`${args[0]}:${args[1]}`);return {rowCount:1};}
    if(sql.includes('SET announced_at=')){
      let count=0;
      for(const id of args[0]){const row=redemptions.get(id);if(!row||row.account_id!==args[1]||row.decision!=='grant'||!row.settled||row.announced_at)continue;
        row.announced_at=new Date();count++;}
      return {rowCount:count};
    }
    if(sql.includes('UPDATE twitch_reward_redemptions')){redemptions.get(args[0]).settled=true;return {rowCount:1};}
    return {rows:[],rowCount:0};
  };
  return {pool:{query,connect:async()=>({query,release(){}})},inventory,redemptions};
}

test('plusieurs récompenses Twitch sont récapitulées ensemble pour le seul joueur lié',async()=>{
  process.env.TWITCH_BROADCASTER_ID='channel';
  const {pool,inventory}=fakeDb(),statuses=[],events=[];
  const rewards=createTwitchRewards({pool,baseUrl:'https://example.com',getTrackerAuthRow:async()=>null,
    trackerTwitchFetch:async(_url,options)=>{statuses.push(JSON.parse(options.body).status);return {data:[]};},
    getBroadcasterAccount:async()=>null,pushLiveUpdate:(type,payload)=>events.push({type,payload})});
  const app=express();app.use((req,_res,next)=>{if(req.get('X-Test-Account'))req.session={account:{id:Number(req.get('X-Test-Account'))}};next();});
  app.use(express.json({verify(req,_res,raw){req.rawEventSubBody=Buffer.from(raw);}}));app.use('/api',rewards.router);
  const server=app.listen(0);
  try{
    async function redeem(id,userId,rewardId='reward-twitch'){
      const body=JSON.stringify({subscription:{type:'channel.channel_points_custom_reward_redemption.add'},event:{id,user_id:userId,broadcaster_user_id:'channel',reward:{id:rewardId}}});
      const stamp=new Date().toISOString(),messageId=`msg-${id}`;
      const sig='sha256='+crypto.createHmac('sha256',secret).update(messageId+stamp+body).digest('hex');
      const response=await fetch(`http://127.0.0.1:${server.address().port}/api/twitch-rewards/eventsub`,{method:'POST',headers:{'Content-Type':'application/json','Twitch-Eventsub-Message-Id':messageId,'Twitch-Eventsub-Message-Timestamp':stamp,'Twitch-Eventsub-Message-Signature':sig,'Twitch-Eventsub-Message-Type':'notification'},body});
      assert.equal(response.status,204);
    }
    await redeem('first','linked');await redeem('second','linked','reward-title');await redeem('third','linked');await redeem('fourth','not-linked');
    assert.deepEqual(statuses,['FULFILLED','FULFILLED','CANCELED','CANCELED']);
    assert.deepEqual([...inventory],['42:reward_bg_twitch_live','42:reward_title_echo_chat']);
    assert.deepEqual(events.map(event=>event.type),['twitch-reward','twitch-reward']);
    const url=`http://127.0.0.1:${server.address().port}/api/twitch-rewards/notifications`;
    const player={headers:{'X-Test-Account':'42'}},other={headers:{'X-Test-Account':'43'}};
    const pending=async options=>(await (await fetch(url+'/pending',options)).json()).rewards;
    const expected=[{id:'first',itemKey:'reward_bg_twitch_live',name:'Signal du direct',category:'background'},
      {id:'second',itemKey:'reward_title_echo_chat',name:'Écho du chat',category:'title'}];
    assert.deepEqual(await pending(player),expected);
    assert.deepEqual(await pending(player),expected);
    assert.deepEqual(await pending(other),[]);
    const acknowledge=async options=>(await (await fetch(url+'/acknowledge',{
      method:'POST',headers:{'Content-Type':'application/json',...options.headers},body:JSON.stringify({ids:['first','second']})})).json()).acknowledged;
    assert.equal(await acknowledge(other),0);
    assert.equal(await acknowledge(player),2);
    assert.deepEqual(await pending(player),[]);
  }finally{server.close();delete process.env.TWITCH_BROADCASTER_ID;}
});

test('une activation interrompue récupère le titre existant et crée seulement le fond manquant',async()=>{
  const previousFetch=globalThis.fetch,previousId=process.env.TWITCH_BROADCASTER_ID;
  process.env.TWITCH_BROADCASTER_ID='channel';
  const items=new Map(),created=[];
  const pool={query:async(sql,args=[])=>{
    if(sql.includes('SELECT reward_id FROM twitch_reward_items'))return {rows:items.has(args[0])?[{reward_id:items.get(args[0])}]:[]};
    if(sql.includes('INSERT INTO twitch_reward_items')){items.set(args[0],args[1]);return {rowCount:1};}
    if(sql.includes('SELECT * FROM twitch_reward_config'))return {rows:[{secret:'secret',subscription_id:null}]};
    return {rows:[]};
  }};
  globalThis.fetch=async url=>({ok:true,json:async()=>url.includes('oauth2/token')?{access_token:'app-token'}:{data:[{id:'subscription'}]}});
  try{
    const rewards=createTwitchRewards({pool,baseUrl:'https://example.com',getTrackerAuthRow:async()=>({twitch_user_id:'channel',scopes:'channel:manage:redemptions'}),
      trackerTwitchFetch:async(_url,options)=>{
        if(!options)return {data:[{id:'title-existing',title:'LoVeR Watch / Titre : Écho du chat',cost:1000}]};
        const body=JSON.parse(options.body);created.push(body.title);
        return {data:[{id:'background-new'}]};
      },getBroadcasterAccount:async()=>null});
    await rewards.setup();
    assert.deepEqual(created,['LoVeR Watch · Signal du direct','LoVeR Watch · Déclenche un Drop !',"LoVeR Watch · Sac de LoVeR'Cash",'LoVeR Watch · Sac d’XP','LoVeR Watch · Œuf mystère','LoVeR Watch · Double XP · 2 h de live']);
    assert.deepEqual([...items].map(([key])=>key),['reward_title_echo_chat','reward_bg_twitch_live','twitch_drop','twitch_cash_bag','twitch_xp_bag','twitch_egg','twitch_double_xp']);
  }finally{globalThis.fetch=previousFetch;if(previousId===undefined)delete process.env.TWITCH_BROADCASTER_ID;else process.env.TWITCH_BROADCASTER_ID=previousId;}
});

test('les récompenses consommables se cumulent et un second drop est remboursé',async()=>{
  const previousId=process.env.TWITCH_BROADCASTER_ID;
  process.env.TWITCH_BROADCASTER_ID='channel';
  const redemptions=new Map(),inventory=new Map(),statuses=[],drops=[];
  let cash=0;
  const query=async(sql,args=[])=>{
    if(sql.includes('SELECT secret FROM twitch_reward_config'))return {rows:[{secret}]};
    if(sql.includes('SELECT item_key FROM twitch_reward_items'))return {rows:[{item_key:args[0]}]};
    if(sql.includes('SELECT decision,settled FROM twitch_reward_redemptions'))return {rows:redemptions.has(args[0])?[redemptions.get(args[0])]:[]};
    if(sql.includes('SELECT id FROM accounts WHERE twitch_id'))return {rows:[{id:42}]};
    if(sql.includes('SELECT 1 FROM game_bot_auth')||sql.includes('SELECT 1 FROM twitch_tracker_auth'))return {rowCount:1};
    if(sql.includes('INSERT INTO twitch_reward_redemptions')){redemptions.set(args[0],{decision:args[4],settled:false});return {rowCount:1};}
    if(sql.includes('INSERT INTO game_bot_drops')){if(drops.length)return {rowCount:0,rows:[]};drops.push(args[0]);return {rowCount:1,rows:[{id:1}]};}
    if(sql.includes("SET decision='refund'")){redemptions.get(args[0]).decision='refund';return {rowCount:1};}
    if(sql.includes('UPDATE users SET points=points+50')){cash+=50;return {rowCount:1};}
    if(sql.includes('INSERT INTO shop_inventory')){const key=args[1];inventory.set(key,(inventory.get(key)||0)+args[2]);return {rowCount:1};}
    if(sql.includes('UPDATE twitch_reward_redemptions')){redemptions.get(args[0]).settled=true;return {rowCount:1};}
    return {rows:[],rowCount:0};
  };
  const rewards=createTwitchRewards({pool:{query,connect:async()=>({query,release(){}})},baseUrl:'https://example.com',
    getTrackerAuthRow:async()=>null,trackerTwitchFetch:async(_url,options)=>{statuses.push(JSON.parse(options.body).status);return {};},getBroadcasterAccount:async()=>null});
  const app=express();app.use(express.json({verify(req,_res,raw){req.rawEventSubBody=Buffer.from(raw);}}));app.use('/api',rewards.router);
  const server=app.listen(0);
  try{
    async function redeem(id,key){
      const body=JSON.stringify({subscription:{type:'channel.channel_points_custom_reward_redemption.add'},event:{id,user_id:'linked',broadcaster_user_id:'channel',reward:{id:key}}});
      const stamp=new Date().toISOString(),messageId=`msg-${id}`;
      const sig='sha256='+crypto.createHmac('sha256',secret).update(messageId+stamp+body).digest('hex');
      const response=await fetch(`http://127.0.0.1:${server.address().port}/api/twitch-rewards/eventsub`,{method:'POST',headers:{'Content-Type':'application/json','Twitch-Eventsub-Message-Id':messageId,'Twitch-Eventsub-Message-Timestamp':stamp,'Twitch-Eventsub-Message-Signature':sig,'Twitch-Eventsub-Message-Type':'notification'},body});
      assert.equal(response.status,204);
    }
    await redeem('egg-1','twitch_egg');await redeem('egg-2','twitch_egg');
    await redeem('xp-1','twitch_xp_bag');await redeem('cash-1','twitch_cash_bag');
    await redeem('drop-1','twitch_drop');await redeem('drop-2','twitch_drop');
    assert.equal(inventory.get('mystery_egg'),2);
    assert.equal(inventory.get('xp_bottle_100'),3);
    assert.equal(cash,50);
    assert.equal(drops.length,1);
    assert.deepEqual(statuses,['FULFILLED','FULFILLED','FULFILLED','FULFILLED','FULFILLED','CANCELED']);
  }finally{server.close();if(previousId===undefined)delete process.env.TWITCH_BROADCASTER_ID;else process.env.TWITCH_BROADCASTER_ID=previousId;}
});
