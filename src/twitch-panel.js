import crypto from 'node:crypto';

const ART = Object.freeze({plant:'/Mossy.webp',water:'/Nymea.webp',voltis:'/Voltis.webp',brumee:'/Brumee.webp',fire:'/Flamby.webp',crysal:'/Crysal.webp',ferox:'/Ferox.webp',dark:'/Nocty.webp',solka:'/Solka.webp',dream:'/Mimo.webp'});

export function panelSettings(env=process.env){
  const clientId=String(env.TWITCH_EXTENSION_CLIENT_ID||'').trim();
  const channelId=String(env.TWITCH_BROADCASTER_ID||'').trim();
  const encoded=String(env.TWITCH_EXTENSION_SECRET||'').trim();
  const secret=/^[A-Za-z0-9+/]+={0,2}$/.test(encoded)?Buffer.from(encoded,'base64'):Buffer.alloc(0);
  return {clientId,channelId,secret,ready:/^[a-z0-9]{8,64}$/.test(clientId)&&/^\d+$/.test(channelId)&&secret.length>=32};
}

export function verifyExtensionToken(token,{secret,channelId},now=Date.now()){
  if(typeof token!=='string'||token.length>8192)throw new Error('Jeton Twitch invalide.');
  const parts=token.split('.');
  if(parts.length!==3||parts.some(p=>!/^[A-Za-z0-9_-]+$/.test(p)))throw new Error('Jeton Twitch invalide.');
  const header=JSON.parse(Buffer.from(parts[0],'base64url').toString('utf8'));
  if(header?.alg!=='HS256'||header.crit)throw new Error('Signature Twitch invalide.');
  const expected=crypto.createHmac('sha256',secret).update(parts[0]+'.'+parts[1]).digest();
  const actual=Buffer.from(parts[2],'base64url');
  if(actual.length!==expected.length||!crypto.timingSafeEqual(actual,expected))throw new Error('Signature Twitch invalide.');
  const payload=JSON.parse(Buffer.from(parts[1],'base64url').toString('utf8'));
  const seconds=Math.floor(now/1000);
  if(!payload||!Number.isFinite(payload.exp)||payload.exp<=seconds||
    (payload.nbf!==undefined&&(!Number.isFinite(payload.nbf)||payload.nbf>seconds))||
    String(payload.channel_id)!==channelId||!['viewer','broadcaster','moderator'].includes(payload.role))throw new Error('Autorisation Twitch expirée ou invalide.');
  if(payload.user_id!==undefined&&(typeof payload.user_id!=='string'||!/^\d+$/.test(payload.user_id)))throw new Error('Identité Twitch invalide.');
  return payload;
}

export async function loadPanelSnapshot({pool,twitchId,hatchSeconds,creatureBattleStats,catalog}){
  // Identify only from the verified Twitch JWT; never accept an account ID from the client.
  const result=await pool.query(`SELECT a.id AS account_id,a.username,a.twitch_panel_enabled,u.id AS user_id,u.creature_id,u.xp,u.pending_xp,u.watch_seconds
    FROM accounts a LEFT JOIN users u ON u.twitch_id=a.twitch_id WHERE a.twitch_id=$1 LIMIT 1`,[twitchId]);
  const user=result.rows[0];
  if(!user?.user_id||!user.twitch_panel_enabled)return {state:'link_required'};
  const [lovys,eggs,inventory]=await Promise.all([
    pool.query(`SELECT creature_id,xp,rank FROM user_lovys WHERE user_id=$1 AND is_active=TRUE LIMIT 1`,[user.user_id]),
    pool.query(`SELECT slot,watched_seconds,status FROM user_incubator_eggs WHERE user_id=$1 ORDER BY slot`,[user.user_id]),
    pool.query(`SELECT item_key,quantity FROM shop_inventory WHERE account_id=$1 AND quantity>0 ORDER BY item_key`,[user.account_id])
  ]);
  const active=lovys.rows[0];
  const stats=active?creatureBattleStats({creature_id:active.creature_id,xp:Number(user.xp??active.xp??0),rank:Number(active.rank||1)}):null;
  const slots=[1,2,3].map(slot=>{
    const starter=slot===1&&!user.creature_id;
    const row=starter?{watched_seconds:user.watch_seconds}:eggs.rows.find(egg=>Number(egg.slot)===slot);
    if(!row)return {slot,empty:true};
    const watched=Math.max(0,Math.min(hatchSeconds,Number(row.watched_seconds||0)));
    const ready=row.status==='ready'||watched>=hatchSeconds;
    return {slot,empty:false,ready,progress:Math.min(100,watched/hatchSeconds*100),remainingWatchSeconds:ready?0:Math.max(0,hatchSeconds-watched)};
  });
  const objects=new Map(catalog.filter(item=>item.category==='object').map(item=>[item.key,item]));
  const items=inventory.rows.filter(row=>objects.has(row.item_key)).map(row=>({key:row.item_key,name:objects.get(row.item_key).name,icon:objects.get(row.item_key).icon||'🎒',quantity:Number(row.quantity)}));
  return {state:'player',player:{name:user.username,pendingXp:Math.max(0,Math.floor(Number(user.pending_xp||0))),lovys:stats?{name:stats.name,level:stats.level,rank:stats.rank,type:stats.type,image:'/api/twitch-panel/art'+(ART[active.creature_id]||'/Mossy.webp')}:null},eggs:slots,items:items.slice(0,4),itemTypes:items.length,updatedAt:new Date().toISOString()};
}
