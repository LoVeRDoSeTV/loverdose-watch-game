import express from 'express';
import crypto from 'node:crypto';
import {verifyEventSub} from './game-bot.js';

const REWARDS = [
  {key:'reward_title_echo_chat', name:'Écho du chat', category:'title', title:'LoVeR Watch · Écho du chat', aliases:['LoVeR Watch / Titre : Écho du chat'], cost:1000},
  {key:'reward_bg_twitch_live', name:'Signal du direct', category:'background', title:'LoVeR Watch · Signal du direct', cost:2000},
  {key:'twitch_drop', name:'Déclenche un Drop !', category:'event', icon:'🎁', title:'LoVeR Watch · Déclenche un Drop !', cost:2500, prompt:'Lance un drop de 60 secondes pour le chat. Compte lié, live et bot actifs, aucune autre partie en cours.', repeatable:true},
  {key:'twitch_cash_bag', name:"Sac de LoVeR'Cash · 50", category:'object', icon:'💰', title:"LoVeR Watch · Sac de LoVeR'Cash", cost:750, prompt:"50 LoVeR'Cash pour ton compte lié au jeu. Rachetable.", repeatable:true},
  {key:'twitch_xp_bag', name:'Sac d’XP · 300', category:'object', icon:'🧪', title:'LoVeR Watch · Sac d’XP', cost:1000, prompt:'3 fioles de 100 XP Lovys pour ton compte lié au jeu. Rachetable.', repeatable:true},
  {key:'twitch_egg', name:'Œuf mystère', category:'object', icon:'🥚', title:'LoVeR Watch · Œuf mystère', cost:1500, prompt:'1 œuf mystère pour ton compte lié au jeu. Rachetable.', repeatable:true},
  {key:'twitch_double_xp', name:'Double XP · 2 h de live', category:'object', icon:'⚡', title:'LoVeR Watch · Double XP · 2 h de live', cost:2000, prompt:'Booster XP ×2 : 2 h de présence comptabilisée en live, temps suspendu hors live. Compte lié. Rachetable.', repeatable:true}
];
export const twitchRewardCount=REWARDS.length;

export function hasTwitchRewardAuthorization(row,broadcasterId){
  return Boolean(row && String(row.twitch_user_id)===String(broadcasterId) &&
    String(row.scopes||'').split(' ').includes('channel:manage:redemptions'));
}

export async function initTwitchRewards(pool) {
  await pool.query(`CREATE TABLE IF NOT EXISTS twitch_reward_config (
    id SMALLINT PRIMARY KEY CHECK(id=1), secret TEXT NOT NULL,
    subscription_id TEXT, last_error TEXT, authorization_required BOOLEAN NOT NULL DEFAULT FALSE,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP)`);
  await pool.query('ALTER TABLE twitch_reward_config ADD COLUMN IF NOT EXISTS last_error TEXT');
  await pool.query('ALTER TABLE twitch_reward_config ADD COLUMN IF NOT EXISTS authorization_required BOOLEAN NOT NULL DEFAULT FALSE');
  await pool.query(`INSERT INTO twitch_reward_config(id,secret) VALUES(1,$1) ON CONFLICT(id) DO NOTHING`,[crypto.randomBytes(32).toString('hex')]);
  await pool.query(`CREATE TABLE IF NOT EXISTS twitch_reward_items (
    item_key TEXT PRIMARY KEY,reward_id TEXT UNIQUE NOT NULL)`);
  await pool.query(`CREATE TABLE IF NOT EXISTS twitch_reward_redemptions (
    redemption_id TEXT PRIMARY KEY,item_key TEXT NOT NULL,twitch_id TEXT NOT NULL,
    account_id INTEGER,decision TEXT NOT NULL,settled BOOLEAN NOT NULL DEFAULT FALSE,
    announced_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP)`);
  await pool.query('ALTER TABLE twitch_reward_redemptions ADD COLUMN IF NOT EXISTS announced_at TIMESTAMPTZ');
}

export function createTwitchRewards({pool,baseUrl,getTrackerAuthRow,trackerTwitchFetch,getBroadcasterAccount,pushLiveUpdate}) {
  const router=express.Router();
  const broadcasterId=String(process.env.TWITCH_BROADCASTER_ID||'');
  const clientId=String(process.env.TWITCH_CLIENT_ID||'');
  const clientSecret=String(process.env.TWITCH_CLIENT_SECRET||'');
  const callback=new URL('/api/twitch-rewards/eventsub',baseUrl).href;

  async function setup() {
    const row=await getTrackerAuthRow();
    if(!hasTwitchRewardAuthorization(row,broadcasterId)){
      const error=new Error('Autorise les points de chaîne avec le compte Twitch du diffuseur.');
      error.twitchAuthorizationRequired=true;
      throw error;
    }
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
        body:JSON.stringify({title:item.title,cost:item.cost,prompt:item.prompt||'Compte LoVeR Watch Game lié à Twitch requis. Une seule fois par joueur.',should_redemptions_skip_request_queue:false})
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
    const config=(await pool.query('SELECT subscription_id,authorization_required FROM twitch_reward_config WHERE id=1')).rows[0];
    const tracker=await getTrackerAuthRow();
    res.json({ready:row.count===REWARDS.length&&Boolean(config?.subscription_id),created:row.count,total:REWARDS.length,authorizationRequired:Boolean(config?.authorization_required)||!hasTwitchRewardAuthorization(tracker,broadcasterId)});
  });

  router.get('/twitch-rewards/notifications/pending',async(req,res)=>{
    if(!req.session?.account)return res.status(401).json({error:'Connexion requise.'});
    try{
      const rows=(await pool.query(`SELECT redemption_id,item_key FROM twitch_reward_redemptions
        WHERE account_id=$1 AND decision='grant' AND settled=TRUE AND announced_at IS NULL
        ORDER BY created_at ASC LIMIT 100`,[req.session.account.id])).rows;
      res.set('Cache-Control','no-store').json({rewards:rows.map(row=>{
        const item=REWARDS.find(entry=>entry.key===row.item_key);
        return {id:row.redemption_id,itemKey:row.item_key,name:item?.name||'Récompense Twitch',category:item?.category||'object',...(item?.icon?{icon:item.icon}:{})};
      })});
    }catch(error){console.error('Notification Twitch :',error);res.status(500).json({error:'Notification indisponible.'});}
  });
  router.post('/twitch-rewards/notifications/acknowledge',async(req,res)=>{
    if(!req.session?.account)return res.status(401).json({error:'Connexion requise.'});
    try{
      const ids=[...new Set(Array.isArray(req.body?.ids)?req.body.ids:[])];
      if(!ids.length||ids.length>100||ids.some(id=>typeof id!=='string'||!id||id.length>128))return res.status(400).json({error:'Récompenses invalides.'});
      const result=await pool.query(`UPDATE twitch_reward_redemptions SET announced_at=CURRENT_TIMESTAMP
        WHERE redemption_id=ANY($1::text[]) AND account_id=$2 AND decision='grant' AND settled=TRUE AND announced_at IS NULL`,
        [ids,req.session.account.id]);
      res.json({acknowledged:result.rowCount});
    }catch(error){console.error('Confirmation Twitch :',error);res.status(500).json({error:'Confirmation indisponible.'});}
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
      const reward=REWARDS.find(entry=>entry.key===item.item_key);
      if(!reward)return res.sendStatus(204);
      const client=await pool.connect();let decision;
      try{
        await client.query('BEGIN');
        const previous=(await client.query('SELECT decision,settled FROM twitch_reward_redemptions WHERE redemption_id=$1 FOR UPDATE',[event.id])).rows[0];
        if(previous){decision=previous.decision;if(previous.settled){await client.query('COMMIT');return res.sendStatus(204);}}
        else{
          const account=(await client.query('SELECT id FROM accounts WHERE twitch_id=$1 FOR UPDATE',[event.user_id])).rows[0];
          const owned=!reward.repeatable&&account&&(await client.query('SELECT 1 FROM shop_inventory WHERE account_id=$1 AND item_key=$2',[account.id,item.item_key])).rowCount>0;
          let canDrop=true;
          if(reward.key==='twitch_drop'){
            canDrop=(await client.query("SELECT 1 FROM game_bot_auth WHERE id=1 AND enabled=TRUE")).rowCount>0 &&
              (await client.query("SELECT 1 FROM twitch_tracker_auth WHERE id=1 AND last_live=TRUE AND last_error IS NULL AND last_success_at>CURRENT_TIMESTAMP-INTERVAL '90 seconds'")).rowCount>0;
          }
          decision=account&&!owned&&canDrop?'grant':'refund';
          await client.query('INSERT INTO twitch_reward_redemptions(redemption_id,item_key,twitch_id,account_id,decision) VALUES($1,$2,$3,$4,$5)',[event.id,item.item_key,event.user_id,account?.id||null,decision]);
          if(decision==='grant'){
            if(!reward.repeatable){
              await client.query('INSERT INTO shop_inventory(account_id,item_key,quantity) VALUES($1,$2,1) ON CONFLICT(account_id,item_key) DO NOTHING',[account.id,item.item_key]);
            }else if(reward.key==='twitch_drop'){
              const keys=['cash','fragments','xp','egg'];
              const selected=keys[crypto.randomInt(keys.length)];
              const inserted=await client.query('INSERT INTO game_bot_drops(reward_key) VALUES($1) ON CONFLICT DO NOTHING RETURNING id',[selected]);
              if(!inserted.rowCount)decision='refund';
            }else if(reward.key==='twitch_cash_bag'){
              await client.query('UPDATE users SET points=points+50,lifetime_lovercash_earned=lifetime_lovercash_earned+50,updated_at=CURRENT_TIMESTAMP WHERE twitch_id=$1',[event.user_id]);
            }else{
              const itemKey=reward.key==='twitch_xp_bag'?'xp_bottle_100':reward.key==='twitch_egg'?'mystery_egg':reward.key==='twitch_double_xp'?'boost_xp_x2':reward.key;
              const quantity=reward.key==='twitch_xp_bag'?3:1;
              await client.query('INSERT INTO shop_inventory(account_id,item_key,quantity) VALUES($1,$2,$3) ON CONFLICT(account_id,item_key) DO UPDATE SET quantity=shop_inventory.quantity+$3,purchased_at=CURRENT_TIMESTAMP',[account.id,itemKey,quantity]);
            }
            if(decision==='refund')await client.query("UPDATE twitch_reward_redemptions SET decision='refund' WHERE redemption_id=$1",[event.id]);
          }
        }
        await client.query('COMMIT');
      }catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
      await settle(event.id,event.reward.id,decision);
      if(decision==='grant')pushLiveUpdate?.('twitch-reward',{twitchId:event.user_id,at:Date.now()});
      res.sendStatus(204);
    }catch(error){console.error('Récompense points Twitch :',error);res.sendStatus(503);}
  });
  return {router,setup};
}
