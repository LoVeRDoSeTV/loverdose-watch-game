import { LOVYS_MAX_XP } from './xp-economy.js';

// Cadeaux du jeu : Twitch décide seul quels nombres peuvent être partagés.
// Aucun palier n'est attribué à partir du compteur de présence du jeu.
const stages = [
  [3,{cash:10}], [5,{xp:50}], [7,{cash:15,fragments:3}], [10,{egg:1}],
  [15,{xp:75,cash:15}], [20,{fragments:5,cash:20}],
  [25,{cosmetic:'streak_title_25',xp:100}], [30,{cash:30}],
  [35,{xp:100,fragments:5}], [40,{cash:40}], [45,{xp:125,fragments:5}],
  [50,{cosmetic:'streak_avatarframe_50'}],
  [60,{xp:150,cash:40}], [70,{fragments:8,cash:50}],
  [80,{xp:175,cash:50}], [90,{fragments:10,cash:60}],
  [100,{cosmetic:'streak_bg_100',egg:1}],
  [110,{xp:200,cash:60}], [120,{fragments:12,cash:60}],
  [130,{xp:200,cash:70}], [140,{fragments:12,cash:70}],
  [150,{cosmetic:'streak_title_150',xp:250}],
  [160,{xp:250,cash:70}], [170,{fragments:15,cash:80}],
  [180,{xp:250,cash:80}], [190,{fragments:15,cash:90}],
  [200,{cosmetic:'streak_avatarframe_200',egg:1}],
  [210,{xp:300,cash:90}], [220,{fragments:18,cash:90}],
  [230,{xp:300,cash:100}], [240,{fragments:18,cash:100}],
  [250,{cosmetic:'streak_bg_250',xp:300}],
  [260,{xp:350,cash:100}], [270,{fragments:20,cash:110}],
  [280,{xp:350,cash:110}], [290,{fragments:20,cash:120}],
  [300,{cosmetic:'streak_title_300',egg:1}],
  [310,{xp:400,cash:120}], [320,{fragments:25,cash:120}],
  [330,{xp:400,cash:130}], [340,{fragments:25,cash:130}],
  [350,{cosmetic:'streak_avatarframe_350',boost:1}]
];

export const STREAK_COSMETICS = Object.freeze([
  {key:'streak_title_25',category:'title',subcategory:'violet',name:'Fidèle du live',color:'#cba6ff'},
  {key:'streak_avatarframe_50',category:'avatar_frame',subcategory:'special',name:'Série de lives',preview:'streak-50'},
  {key:'streak_bg_100',category:'background',subcategory:'special',name:'Cent lives',preview:'streak-100'},
  {key:'streak_title_150',category:'title',subcategory:'gold',name:'Incontournable du live',color:'#f0ca79'},
  {key:'streak_avatarframe_200',category:'avatar_frame',subcategory:'special',name:'200 lives',preview:'streak-200'},
  {key:'streak_bg_250',category:'background',subcategory:'special',name:'Fidélité légendaire',preview:'streak-250'},
  {key:'streak_title_300',category:'title',subcategory:'gold',name:'Légende du direct',color:'#ffe4a3'},
  {key:'streak_avatarframe_350',category:'avatar_frame',subcategory:'special',name:'350 lives',preview:'streak-350'}
].map(item=>Object.freeze({...item,price:0,rewardOnly:true,description:'Obtenu en partageant ta série de visionnage dans le chat Twitch.'})));

const cosmeticNames=new Map(STREAK_COSMETICS.map(item=>[item.key,item.name]));
export const WATCH_STREAK_REWARDS=Object.freeze(stages.map(([count,reward])=>Object.freeze({
  count,...reward,
  description:[
    reward.cosmetic&&`${reward.cosmetic.includes('title')?'Titre':reward.cosmetic.includes('bg_')?'Fond':'Cadre de profil'} « ${cosmeticNames.get(reward.cosmetic)} »`,
    reward.xp&&`${reward.xp} XP Lovys`,reward.cash&&`${reward.cash} LoVeR’Cash`,
    reward.fragments&&`${reward.fragments} fragments d’œuf`,reward.egg&&`${reward.egg} œuf mystère`,
    reward.boost&&'Fiole Double XP · 2 h actives sur le live'
  ].filter(Boolean).join(' · ')
})));
const rewardByCount=new Map(WATCH_STREAK_REWARDS.map(reward=>[reward.count,reward]));
export function watchStreakRewardForCount(value){
  const count=Number(value);
  if(!Number.isSafeInteger(count)||count<1||count>350)return null;
  // Twitch ne publie pas tous ses paliers partageables. Un palier que Twitch
  // ajoute ou espace différemment reçoit tout de même un petit cadeau.
  return rewardByCount.get(count)||{count,xp:25,cash:5,description:'25 XP Lovys · 5 LoVeR’Cash'};
}

export async function initWatchStreakRewards(pool){
  await pool.query(`CREATE TABLE IF NOT EXISTS user_watch_streak_rewards (
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    milestone INTEGER NOT NULL,
    twitch_message_id TEXT NOT NULL,
    claimed_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    announced_at TIMESTAMPTZ,
    PRIMARY KEY(user_id,milestone)
  )`);
  await pool.query('ALTER TABLE user_watch_streak_rewards ADD COLUMN IF NOT EXISTS announced_at TIMESTAMPTZ');
}

// Appelé uniquement pour une notification Twitch signée, jamais pour un message texte libre.
// La transaction appartient au webhook : en cas d'échec, le marqueur et les ressources
// sont annulés ensemble, afin que Twitch puisse renvoyer la notification.
export async function grantSharedWatchStreak(client,{twitchId,count,messageId}){
  const reward=watchStreakRewardForCount(count);
  if(!reward||!twitchId||!messageId)return false;
  const player=(await client.query(`SELECT u.id user_id,a.id account_id FROM users u
    JOIN accounts a ON a.twitch_id=u.twitch_id WHERE u.twitch_id=$1 FOR UPDATE OF u`,[twitchId])).rows[0];
  if(!player)return false;
  const recorded=await client.query(`INSERT INTO user_watch_streak_rewards(user_id,milestone,twitch_message_id)
    VALUES($1,$2,$3) ON CONFLICT(user_id,milestone) DO NOTHING RETURNING milestone`,
    [player.user_id,reward.count,messageId]);
  if(!recorded.rowCount)return false;
  if(reward.cash||reward.fragments)await client.query(`UPDATE users SET points=points+$2,
    lifetime_lovercash_earned=lifetime_lovercash_earned+$2,egg_fragments=egg_fragments+$3,
    updated_at=CURRENT_TIMESTAMP WHERE id=$1`,[player.user_id,reward.cash||0,reward.fragments||0]);
  if(reward.xp){
    const active=(await client.query(`SELECT id,xp FROM user_lovys WHERE user_id=$1 AND is_active=TRUE FOR UPDATE`,[player.user_id])).rows[0];
    const direct=active?Math.min(reward.xp,Math.max(0,LOVYS_MAX_XP-Number(active.xp||0))):0;
    if(direct){
      await client.query('UPDATE user_lovys SET xp=xp+$2,updated_at=CURRENT_TIMESTAMP WHERE id=$1',[active.id,direct]);
      await client.query('UPDATE users SET xp=xp+$2,updated_at=CURRENT_TIMESTAMP WHERE id=$1',[player.user_id,direct]);
    }
    if(reward.xp>direct)await client.query('UPDATE users SET pending_xp=pending_xp+$2,updated_at=CURRENT_TIMESTAMP WHERE id=$1',[player.user_id,reward.xp-direct]);
  }
  for(const key of [reward.cosmetic,reward.egg&&'mystery_egg',reward.boost&&'boost_xp_x2'].filter(Boolean)){
    await client.query(`INSERT INTO shop_inventory(account_id,item_key,quantity) VALUES($1,$2,1)
      ON CONFLICT(account_id,item_key) DO UPDATE SET quantity=shop_inventory.quantity+1,purchased_at=CURRENT_TIMESTAMP`,
      [player.account_id,key]);
  }
  return true;
}
