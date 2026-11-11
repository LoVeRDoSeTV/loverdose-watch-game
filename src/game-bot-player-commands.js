import {globalThresholdForLevel} from './xp-economy.js';
import {renderBotMessage} from './game-bot-messages.js';

export const playerCommands={
  profil:{name:'!profil',label:'Profil du joueur',text:'👤 {joueur} · Niveau {niveau} · Prestige {prestige} · {cash} LoVeR’Cash. {lien}',variables:['joueur','niveau','prestige','cash','lien']},
  oeufs:{name:'!oeufs',label:'État des incubateurs',text:'🥚 {joueur} · {oeufs} · {prets} œuf(s) prêt(s). {lien}',variables:['joueur','oeufs','prets','lien']},
  classement:{name:'!classement',label:'Classement XP globale',text:'🏆 {joueur} · Classement XP globale : {position}. Top 3 : {podium}. {lien}',variables:['joueur','position','podium','lien']}
};
const number=value=>Math.max(0,Math.floor(Number(value)||0)).toLocaleString('fr-FR');
const safeName=value=>String(value||'Joueur').replace(/[\x00-\x1f\x7f]/g,' ').replace(/\s+/g,' ').trim().slice(0,25);
export function playerGlobalLevel(xp){let level=1;while(level<55&&Number(xp)>=globalThresholdForLevel(level+1))level++;return level;}
function liveTime(seconds){const minutes=Math.ceil(Math.max(0,seconds)/60),hours=Math.floor(minutes/60);return hours?`${hours} h ${String(minutes%60).padStart(2,'0')} min de live`:`${minutes} min de live`;}
// Read only: these chat commands never grant rewards, hatch eggs or change balances.
export async function renderPlayerCommand(pool,command,context,{baseUrl='https://loverwatchgame.fr',channelId='',channelLogin='loverdosetv',eggHatchSeconds=21600}={}){
  const lien=new URL('/',baseUrl).href,joueur='@'+String(context.login||'joueur').replace(/[^a-zA-Z0-9_]/g,'');
  const user=(await pool.query(`SELECT u.id,u.global_xp,u.prestige,u.points,u.creature_id,u.watch_seconds
    FROM users u WHERE u.twitch_id=$1 AND EXISTS(SELECT 1 FROM accounts a WHERE a.twitch_id=u.twitch_id) LIMIT 1`,[context.twitchId])).rows[0];
  if(!user)return `${joueur}, crée ton compte et lie ton compte Twitch sur ${lien} pour consulter ta progression.`;
  const values={joueur,lien};
  if(command.kind==='profil')Object.assign(values,{niveau:playerGlobalLevel(user.global_xp),prestige:number(user.prestige),cash:number(user.points)});
  else if(command.kind==='oeufs'){
    const rows=(await pool.query("SELECT slot,status,watched_seconds FROM user_incubator_eggs WHERE user_id=$1 AND status IN ('incubating','ready') ORDER BY slot",[user.id])).rows;
    const eggs=[1,2,3].flatMap(slot=>{
      const egg=slot===1&&!user.creature_id?{slot,watched_seconds:user.watch_seconds}:rows.find(row=>Number(row.slot)===slot);
      if(!egg)return [];
      const ready=egg.status==='ready'||Number(egg.watched_seconds)>=eggHatchSeconds;
      return [{ready,text:`emplacement ${slot} : ${ready?'prêt à éclore':liveTime(eggHatchSeconds-Number(egg.watched_seconds||0))}`}];
    });
    values.prets=eggs.filter(egg=>egg.ready).length;values.oeufs=eggs.map(egg=>egg.text).join(' ; ')||'aucun œuf en incubation';
  }else if(command.kind==='classement'){
    // Same ordering and broadcaster exclusion as /api/leaderboard?metric=level.
    const rows=(await pool.query(`WITH ranked AS (
      SELECT u.id,COALESCE(a.username,u.display_name,u.login) username,
        ROW_NUMBER() OVER(ORDER BY COALESCE(u.global_xp,0) DESC,u.id ASC) position
      FROM users u LEFT JOIN accounts a ON a.twitch_id=u.twitch_id
      WHERE u.twitch_id IS NOT NULL AND NOT (($2::text<>'' AND u.twitch_id=$2)
        OR ($2::text='' AND LOWER(COALESCE(u.login,''))=$3)))
      SELECT * FROM ranked WHERE position<=3 OR id=$1 ORDER BY position`,[user.id,String(channelId),String(channelLogin).toLowerCase()])).rows;
    const own=rows.find(row=>Number(row.id)===Number(user.id));
    values.position=own?String(own.position):'hors classement (diffuseur)';
    values.podium=rows.filter(row=>Number(row.position)<=3).map(row=>`${row.position}. ${safeName(row.username)}`).join(' / ')||'aucun joueur classé';
  }
  return renderBotMessage(command.text,values);
}
