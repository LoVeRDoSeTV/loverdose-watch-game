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
    if(sql.includes('SELECT item_key FROM twitch_reward_items'))return {rows:args[0]==='reward-twitch'? [{item_key:'reward_bg_twitch_live'}]:[]};
    if(sql.includes('SELECT decision,settled FROM twitch_reward_redemptions'))return {rows:redemptions.has(args[0])?[redemptions.get(args[0])]:[]};
    if(sql.includes('SELECT id FROM accounts WHERE twitch_id'))return {rows:args[0]==='linked'?[{id:42}]:[]};
    if(sql.includes('SELECT 1 FROM shop_inventory'))return {rowCount:inventory.has(`${args[0]}:${args[1]}`)?1:0};
    if(sql.includes('INSERT INTO twitch_reward_redemptions')){redemptions.set(args[0],{decision:args[4],settled:false});return {rowCount:1};}
    if(sql.includes('INSERT INTO shop_inventory')){inventory.add(`${args[0]}:${args[1]}`);return {rowCount:1};}
    if(sql.includes('UPDATE twitch_reward_redemptions')){redemptions.get(args[0]).settled=true;return {rowCount:1};}
    return {rows:[],rowCount:0};
  };
  return {pool:{query,connect:async()=>({query,release(){}})},inventory,redemptions};
}

test('un objet Twitch ne se crédite qu’une fois ; le deuxième échange et un compte non lié sont remboursés',async()=>{
  process.env.TWITCH_BROADCASTER_ID='channel';
  const {pool,inventory}=fakeDb(),statuses=[];
  const rewards=createTwitchRewards({pool,baseUrl:'https://example.com',getTrackerAuthRow:async()=>null,
    trackerTwitchFetch:async(_url,options)=>{statuses.push(JSON.parse(options.body).status);return {data:[]};},
    getBroadcasterAccount:async()=>null});
  const app=express();app.use(express.json({verify(req,_res,raw){req.rawEventSubBody=Buffer.from(raw);}}));app.use('/api',rewards.router);
  const server=app.listen(0);
  try{
    async function redeem(id,userId){
      const body=JSON.stringify({subscription:{type:'channel.channel_points_custom_reward_redemption.add'},event:{id,user_id:userId,broadcaster_user_id:'channel',reward:{id:'reward-twitch'}}});
      const stamp=new Date().toISOString(),messageId=`msg-${id}`;
      const sig='sha256='+crypto.createHmac('sha256',secret).update(messageId+stamp+body).digest('hex');
      const response=await fetch(`http://127.0.0.1:${server.address().port}/api/twitch-rewards/eventsub`,{method:'POST',headers:{'Content-Type':'application/json','Twitch-Eventsub-Message-Id':messageId,'Twitch-Eventsub-Message-Timestamp':stamp,'Twitch-Eventsub-Message-Signature':sig,'Twitch-Eventsub-Message-Type':'notification'},body});
      assert.equal(response.status,204);
    }
    await redeem('first','linked');await redeem('second','linked');await redeem('third','not-linked');
    assert.deepEqual(statuses,['FULFILLED','CANCELED','CANCELED']);
    assert.deepEqual([...inventory],['42:reward_bg_twitch_live']);
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
    assert.deepEqual(created,['LoVeR Watch · Signal du direct']);
    assert.deepEqual([...items],[['reward_title_echo_chat','title-existing'],['reward_bg_twitch_live','background-new']]);
  }finally{globalThis.fetch=previousFetch;if(previousId===undefined)delete process.env.TWITCH_BROADCASTER_ID;else process.env.TWITCH_BROADCASTER_ID=previousId;}
});
