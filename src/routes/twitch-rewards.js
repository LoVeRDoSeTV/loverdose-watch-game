import express from 'express';
import crypto from 'node:crypto';
import {verifyEventSub} from './game-bot.js';

const REWARDS = [
  {key:'reward_title_echo_chat', title:'LoVeR Watch · Écho du chat', aliases:['LoVeR Watch / Titre : Écho du chat'], cost:1000},
  {key:'reward_bg_twitch_live', title:'LoVeR Watch · Signal du direct', cost:2000}
];

export async function initTwitchRewards(pool) {
  await pool.query(`CREATE TABLE IF NOT EXISTS twitch_reward_config (
    id SMALLINT PRIMARY KEY CHECK(id=1), secret TEXT NOT NULL,
    subscription_id TEXT, updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP)`);
  await pool.query(`INSERT INTO twitch_reward_config(id,secret) VALUES(1,$1) ON CONFLICT(id) DO NOTHING`,[crypto.randomBytes(32).toString('hex')]);
  await pool.query(`CREATE TABLE IF NOT EXISTS twitch_reward_items (
    item_key TEXT PRIMARY KEY,reward_id TEXT UNIQUE NOT NULL)`);
  await pool.query(`CREATE TABLE IF NOT EXISTS twitch_reward_redemptions (
    redemption_id TEXT PRIMARY KEY,item_key TEXT NOT NULL,twitch_id TEXT NOT NULL,
    account_id INTEGER,decision TEXT NOT NULL,settled BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP)`);
}

export function createTwitchRewards({pool,baseUrl,getTrackerAuthRow,trackerTwitchFetch,getBroadcasterAccount}) {
  const router=express.Router();
  const broadcasterId=String(process.env.TWITCH_BROADCASTER_ID||'');
  const clientId=String(process.env.TWITCH_CLIENT_ID||'');
  const clientSecret=String(process.env.TWITCH_CLIENT_SECRET||'');
  const callback=new URL('/api/twitch-rewards/eventsub',baseUrl).href;

  async function setup() {
    const row=await getTrackerAuthRow();
    if(!row || row.twitch_user_id!==broadcasterId || !String(row.scopes||'').split(' ').includes('channel:manage:redemptions'))
      throw new Error('Reconnecte le tracker Twitch avec les autorisations des points de chaîne.');
    const list=await trackerTwitchFetch('/channel_points/custom_rewards?'+new URLSearchParams({broadcaster_id:broadcasterId,only_manageable_rewards:'true'}));
    const manageable=new Map((list.data||[]).map(reward=>[reward.title,reward]));
    for(const item of REWARDS) {
      const known=(await pool.query('SELECT reward_id FROM twitch_reward_items WHERE item_key=$1',[item.key])).rows[0];
      if(known)continue;
      const existing=[item.title,...(item.aliases||[])].map(title=>manageable.get(title)).find(Boolean);
      if(existing){
        await pool.query('INSERT INTO twitch_reward_items(item_key,reward_id) VALUES($1,$2) ON CONFLICT DO NOTHING',[item.key,existing.id]);
        continue;
      }
      const result=await trackerTwitchFetch('/channel_points/custom_rewards?broadcaster_id='+encodeURIComponent(broadcasterId),{
        method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({title:item.title,cost:item.cost,prompt:'Compte LoVeR Watch Game lié à Twitch requis. Une seule fois par joueur.',should_redemptions_skip_request_queue:false})
      });
      if(!result.data?.[0]?.id)throw new Error(`Création de « ${item.title} » : Twitch n’a pas renvoyé son identifiant.`);
      await pool.query('INSERT INTO twitch_reward_items(item_key,reward_id) VALUES($1,$2) ON CONFLICT DO NOTHING',[item.key,result.data[0].id]);
      manageable.set(item.title,result.data[0]);
    }
    const config=(await pool.query('SELECT * FROM twitch_reward_config WHERE id=1')).rows[0];
    const appResponse=await fetch('https://id.twitch.tv/oauth2/token',{method:'POST',body:new URLSearchParams({client_id:clientId,client_secret:clientSecret,grant_type:'client_credentials'})});
    if(!appResponse.ok)throw new Error('Jeton application Twitch indisponible.');
    const appToken=(await appResponse.json()).access_token;
    const headers={Authorization:`Bearer ${appToken}`,'Client-Id':clientId,'Content-Type':'application/json'};
    if(!config.subscription_id){
      const response=await fetch('https://api.twitch.tv/helix/eventsub/subscriptions',{method:'POST',headers,
        body:JSON.stringify({type:'channel.channel_points_custom_reward_redemption.add',version:'1',condition:{broadcaster_user_id:broadcasterId},transport:{method:'webhook',callback,secret:config.secret}})});
      const result=await response.json();
      if(!response.ok||!result.data?.[0]?.id)throw new Error(`Abonnement Twitch refusé : ${result.message||response.status}`);
      await pool.query('UPDATE twitch_reward_config SET subscription_id=$1,updated_at=CURRENT_TIMESTAMP WHERE id=1',[result.data[0].id]);
    }
    return true;
  }

  router.get('/twitch-rewards/status',async(req,res)=>{
    if(!await getBroadcasterAccount(req))return res.sendStatus(403);
    const row=(await pool.query('SELECT COUNT(*)::int AS count FROM twitch_reward_items')).rows[0];
    const config=(await pool.query('SELECT subscription_id FROM twitch_reward_config WHERE id=1')).rows[0];
    res.json({ready:row.count===REWARDS.length&&Boolean(config?.subscription_id),created:row.count,total:REWARDS.length,connectUrl:'/auth/twitch/tracker'});
  });
  router.post('/twitch-rewards/setup',async(req,res)=>{
    if(!await getBroadcasterAccount(req))return res.sendStatus(403);
    try{await setup();res.json({ok:true});}catch(error){res.status(409).json({error:error.message});}
  });

  async function settle(redemptionId,rewardId,decision){
    await trackerTwitchFetch('/channel_points/custom_rewards/redemptions?'+new URLSearchParams({broadcaster_id:broadcasterId,reward_id:rewardId,id:redemptionId}),{
      method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({status:decision==='grant'?'FULFILLED':'CANCELED'})});
    await pool.query('UPDATE twitch_reward_redemptions SET settled=TRUE WHERE redemption_id=$1',[redemptionId]);
  }

  router.post('/twitch-rewards/eventsub',async(req,res)=>{
    try{
      const secret=(await pool.query('SELECT secret FROM twitch_reward_config WHERE id=1')).rows[0]?.secret;
      if(!req.rawEventSubBody||!verifyEventSub(req.headers,req.rawEventSubBody,secret))return res.sendStatus(403);
      const body=req.body,type=req.get('twitch-eventsub-message-type');
      if(type==='webhook_callback_verification')return res.type('text/plain').send(body.challenge);
      if(type==='revocation'){
        await pool.query('UPDATE twitch_reward_config SET subscription_id=NULL,updated_at=CURRENT_TIMESTAMP WHERE id=1 AND subscription_id=$1',[body.subscription?.id]);
        return res.sendStatus(204);
      }
      if(type!=='notification'||body.subscription?.type!=='channel.channel_points_custom_reward_redemption.add')return res.sendStatus(204);
      const event=body.event;
      if(event?.broadcaster_user_id!==broadcasterId||!event.id||!event.reward?.id)return res.sendStatus(204);
      const item=(await pool.query('SELECT item_key FROM twitch_reward_items WHERE reward_id=$1',[event.reward.id])).rows[0];
      if(!item)return res.sendStatus(204);
      const client=await pool.connect();let decision;
      try{
        await client.query('BEGIN');
        const previous=(await client.query('SELECT decision,settled FROM twitch_reward_redemptions WHERE redemption_id=$1 FOR UPDATE',[event.id])).rows[0];
        if(previous){decision=previous.decision;if(previous.settled){await client.query('COMMIT');return res.sendStatus(204);}}
        else{
          const account=(await client.query('SELECT id FROM accounts WHERE twitch_id=$1 FOR UPDATE',[event.user_id])).rows[0];
          const owned=account&&(await client.query('SELECT 1 FROM shop_inventory WHERE account_id=$1 AND item_key=$2',[account.id,item.item_key])).rowCount>0;
          decision=account&&!owned?'grant':'refund';
          await client.query('INSERT INTO twitch_reward_redemptions(redemption_id,item_key,twitch_id,account_id,decision) VALUES($1,$2,$3,$4,$5)',[event.id,item.item_key,event.user_id,account?.id||null,decision]);
          if(decision==='grant')await client.query('INSERT INTO shop_inventory(account_id,item_key,quantity) VALUES($1,$2,1) ON CONFLICT(account_id,item_key) DO NOTHING',[account.id,item.item_key]);
        }
        await client.query('COMMIT');
      }catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
      await settle(event.id,event.reward.id,decision);
      res.sendStatus(204);
    }catch(error){console.error('Récompense points Twitch :',error);res.sendStatus(503);}
  });
  return {router,setup};
}
