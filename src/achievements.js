import { existsSync } from 'node:fs';

export const WATCH_STAGE_REWARDS=Object.freeze({
  25:{lovysXp:250,globalXp:125,cash:25},
  50:{lovysXp:500,globalXp:250,cash:50},
  100:{lovysXp:750,globalXp:375,cash:75},
  250:{lovysXp:1500,globalXp:750,cash:150},
  500:{lovysXp:2500,globalXp:1250,cash:250},
  1000:{lovysXp:5000,globalXp:2500,cash:500}
});

// Une famille = un badge évolutif. Les gains sont incrémentaux, jamais horaires.
const rewards = index => ({ lovysXp:[10,25,50,100][Math.min(index,3)], globalXp:[5,10,20,40][Math.min(index,3)], cash:[1,2,3,5][Math.min(index,3)] });
const family=(id,category,icon,unit,metric,steps)=>({id,key:`achievement:${id}`,category,icon,unit,metric,steps:steps.map(([goal,name],index)=>({goal,name,rewards:rewards(index)}))});
export const ACHIEVEMENT_FAMILIES = [
  family('eggs','eggs','🥚','œufs éclos','eggs',[[1,'Première rencontre'],[10,'Petite nurserie'],[30,'Passionné d’éclosion'],[100,'Éleveur confirmé']]),
  family('collection','collection','🐉','Lovys différents','collection',[[3,'Les premiers amis'],[5,'Une belle famille'],[10,'Tous réunis']]),
  family('rare','collection','💎','Lovys Rare','rare',[[1,'Belle trouvaille']]),
  family('epic','collection','💜','Lovys Épique','epic',[[1,'Rencontre exceptionnelle']]),
  family('mimo','collection','🌈','Mimo découvert','mimo',[[1,'Un rêve nommé Mimo']]),
  family('rank','evolution','⭐','rang atteint','rank',[[2,'Une étoile de plus'],[5,'Compagnon accompli']]),
  family('rank-team','evolution','🌟','Lovys au rang 5','rankTeam',[[3,'Constellation']]),
  family('level','evolution','⚡','niveau atteint','level',[[10,'Ça grandit vite !'],[25,'Prêt pour l’aventure'],[50,'Au sommet']]),
  family('level-team','evolution','🏅','Lovys au niveau 50','levelTeam',[[3,'Équipe d’élite']]),
  family('victories','combat','⚔️','victoires PvE','victories',[[1,'Premier duel remporté'],[25,'Combattant confirmé'],[100,'Vétéran des arènes']]),
  family('close-win','combat','❤️','victoire avec moins de 10 % de PV','closeWin',[[1,'Sur le fil']]),
  family('flawless','combat','🛡️','victoire sans dégât subi','flawless',[[1,'Intouchable']]),
  family('variety','combat','🐾','espèces victorieuses','variety',[[5,'Toute la troupe']]),
  family('guardian','combat','🌳','Gardien des Racines vaincu','guardian',[[1,'Gardien terrassé']]),
  family('forest','combat','👑','Monarque vaincu','forest',[[1,'La forêt te reconnaît']]),
  family('ember','combat','🔥','zone volcanique terminée','ember',[[1,'Cœur de braise']]),
  family('trades','trade','🤝','échanges réalisés','trades',[[1,'Marché conclu !'],[10,'Partenaire de confiance']]),
  family('partners','trade','💞','partenaires différents','partners',[[5,'Créateur de liens']]),
  family('challenges','challenges','✅','défis réclamés','challenges',[[1,'Mission accomplie'],[50,'Toujours un objectif']]),
  family('perfect-day','challenges','🎯','journée de défis complète','perfectDay',[[1,'Journée parfaite']]),
  family('daily-wheel','wheel','🎡','roues quotidiennes lancées','dailyWheel',[[1,'Premier tour'],[30,'Ça tourne !']]),
  family('weekly-wheel','wheel','👑','roues des 7 lives lancées','weeklyWheel',[[1,'Le rendez-vous des fidèles']]),
  family('style','style','🎨','cosmétique équipé','style',[[1,'À mon image']]),
  family('full-style','style','✨','personnalisation complète','fullStyle',[[1,'La touche finale']]),
  family('event','event','🎉','événement suivi pendant 15 min','event',[[1,'J’étais là !']]),
  family('marathon','event','🌙','live spécial suivi pendant 3 h','marathon',[[1,'L’équipe des 24 h']])
];

export const WATCH_FAMILIES = [
  {id:'watch-dofus',key:'challenge:dofus:gardien-emeraude:50h',name:'Gardien d’Émeraude',image:'/DofusEmeraude.webp',base:50,match:r=>String(r.game_name).trim().toLowerCase()==='dofus'},
  {id:'watch-palworld',key:'challenge:palworld:maitre-des-spheres:50h',name:'Maître des Sphères',image:'/SpherePalworld.webp',base:50,match:r=>String(r.game_name).trim().toLowerCase()==='palworld'},
  {id:'watch-mw4',key:'challenge:mw4:operateur-elite:50h',name:'Opérateur d’Élite',image:'/MW4.webp',base:50,match:r=>String(r.game_name).trim().toLowerCase().includes('modern warfare 4')},
  {id:'watch-zombie',key:'mission:zombie:maitre-des-morts:25h',name:'Maître des Morts',image:'/Zombie.webp',base:25,match:r=>r.game_id==='special:zombie'}
];

export function achievementImage(id,stage,fallback=null){
  const path=`/badges/${id}-${stage}.webp`;
  return existsSync(new URL(`../public${path}`,import.meta.url))?path:fallback;
}

export function createAchievements({pool,creatures,zones,progressionFromXp,awardRewards}){
  async function init(){
    await pool.query(`CREATE TABLE IF NOT EXISTS user_subscription_badge_state(user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,is_active BOOLEAN NOT NULL,cycle INTEGER NOT NULL DEFAULT 0,updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP)`);
    await pool.query(`CREATE TABLE IF NOT EXISTS user_achievement_progress(
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      metric TEXT NOT NULL,value DOUBLE PRECISION NOT NULL DEFAULT 0,PRIMARY KEY(user_id,metric))`);
    await pool.query(`CREATE TABLE IF NOT EXISTS achievement_events(
      id BIGSERIAL PRIMARY KEY,kind TEXT NOT NULL CHECK(kind IN ('event','marathon')),
      starts_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,ends_at TIMESTAMPTZ NOT NULL,
      CHECK(ends_at>=starts_at))`);
    await pool.query(`CREATE TABLE IF NOT EXISTS user_achievement_event_watch(
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      event_id BIGINT NOT NULL REFERENCES achievement_events(id) ON DELETE CASCADE,
      seconds DOUBLE PRECISION NOT NULL DEFAULT 0,PRIMARY KEY(user_id,event_id))`);
  }

  async function trackEvents(client,userIds,seconds){
    if(!userIds.length||seconds<=0)return;
    await client.query(`INSERT INTO user_achievement_event_watch(user_id,event_id,seconds)
      SELECT uid,e.id,GREATEST(0,EXTRACT(EPOCH FROM LEAST(CURRENT_TIMESTAMP,e.ends_at)-GREATEST(e.starts_at,CURRENT_TIMESTAMP-$2::double precision*INTERVAL '1 second')))
      FROM unnest($1::int[]) uid CROSS JOIN achievement_events e
      WHERE e.starts_at<CURRENT_TIMESTAMP AND e.ends_at>CURRENT_TIMESTAMP-$2::double precision*INTERVAL '1 second'
      ON CONFLICT(user_id,event_id) DO UPDATE SET seconds=user_achievement_event_watch.seconds+EXCLUDED.seconds`,[userIds,seconds]);
  }

  async function metrics(client,userId,accountId){
    const user=(await client.query('SELECT creature_id,xp,total_lovys_hatched FROM users WHERE id=$1',[userId])).rows[0];
    const lovys=(await client.query('SELECT creature_id,xp,rank,is_active FROM user_lovys WHERE user_id=$1',[userId])).rows;
    const progress=(await client.query('SELECT fight_key,wins FROM user_pve_progress WHERE user_id=$1',[userId])).rows;
    const fights=new Map(progress.map(row=>[row.fight_key,Number(row.wins)]));
    const report=(await client.query(`SELECT
      COUNT(DISTINCT report_json->>'creatureId')::int AS variety,
      COUNT(*) FILTER(WHERE (report_json->>'playerMaxHp')::numeric>0 AND (report_json->>'playerRemainingHp')::numeric>0
        AND (report_json->>'playerRemainingHp')::numeric<(report_json->>'playerMaxHp')::numeric*.10)::int AS close_win,
      COUNT(*) FILTER(WHERE report_json->>'flawless'='true')::int AS flawless
      FROM user_combat_reports WHERE user_id=$1 AND result='victory'`,[userId])).rows[0];
    const trades=(await client.query(`SELECT other_id FROM (
      SELECT CASE WHEN creator_user_id=$1 THEN accepted_by_user_id ELSE creator_user_id END other_id FROM trade_offers
        WHERE status='completed' AND (creator_user_id=$1 OR accepted_by_user_id=$1)
      UNION ALL SELECT CASE WHEN creator_user_id=$1 THEN target_user_id ELSE creator_user_id END FROM player_trade_offers
        WHERE status='completed' AND (creator_user_id=$1 OR target_user_id=$1)) t`,[userId])).rows;
    const days=(await client.query(`SELECT challenge_date,COUNT(*)::int count FROM user_daily_challenge_state
      WHERE user_id=$1 AND claimed_at IS NOT NULL GROUP BY challenge_date`,[userId])).rows;
    const wheels=(await client.query(`SELECT wheel_type,COUNT(*)::int count FROM user_reward_wheel_spins WHERE user_id=$1 GROUP BY wheel_type`,[userId])).rows;
    const account=(await client.query(`SELECT equipped_title_key,equipped_background_key,equipped_frame_key,equipped_avatar_frame_key FROM accounts WHERE id=$1`,[accountId])).rows[0]||{};
    const events=(await client.query(`SELECT e.kind,MAX(w.seconds) seconds FROM user_achievement_event_watch w
      JOIN achievement_events e ON e.id=w.event_id WHERE w.user_id=$1 GROUP BY e.kind`,[userId])).rows;
    const levels=lovys.map(row=>progressionFromXp(row.is_active?Number(user.xp):Number(row.xp)).level);
    const owned=new Set(lovys.map(row=>row.creature_id));
    const owns=rarity=>creatures.some(c=>owned.has(c.id)&&String(c.rarity).toLowerCase()===rarity);
    return {
      eggs:Number(user.total_lovys_hatched||0),collection:owned.size,rare:Number(owns('rare')),epic:Number(owns('épique')),mimo:Number(owned.has('dream')),
      rank:Math.max(0,...lovys.map(row=>Number(row.rank))),rankTeam:lovys.filter(row=>Number(row.rank)>=5).length,
      level:Math.max(0,...levels),levelTeam:levels.filter(level=>level>=50).length,
      victories:progress.reduce((n,row)=>n+Number(row.wins),0),closeWin:Number(report.close_win),flawless:Number(report.flawless),variety:Number(report.variety),
      guardian:Number((fights.get('forest_6')||0)>0),forest:Number((fights.get('forest_boss')||0)>0),
      ember:Number(zones.find(zone=>zone.key==='ember')?.fights.every(fight=>(fights.get(fight.key)||0)>0)||false),
      trades:trades.length,partners:new Set(trades.map(row=>Number(row.other_id)).filter(id=>id&&id!==userId)).size,
      challenges:days.reduce((n,row)=>n+Number(row.count),0),perfectDay:Number(days.some(row=>Number(row.count)>=3)),
      dailyWheel:Number(wheels.find(row=>row.wheel_type==='daily')?.count||0),weeklyWheel:Number(wheels.find(row=>row.wheel_type==='weekly')?.count||0),
      style:Number(Object.values(account).some(Boolean)),fullStyle:Number(Object.values(account).filter(Boolean).length===4),
      event:Number(events.some(row=>Number(row.seconds)>=900)),marathon:Number(events.some(row=>row.kind==='marathon'&&Number(row.seconds)>=10800))
    };
  }

  async function sync(userId,accountId){
    const client=await pool.connect();
    try{
      await client.query('BEGIN');
      await client.query('SELECT id FROM users WHERE id=$1 FOR UPDATE',[userId]);
      const values=await metrics(client,userId,accountId);
      const previous=(await client.query('SELECT metric,value FROM user_achievement_progress WHERE user_id=$1',[userId])).rows;
      for(const row of previous)values[row.metric]=Math.max(Number(row.value),Number(values[row.metric]||0));
      for(const [metric,value] of Object.entries(values)){
        if(previous.some(row=>row.metric===metric&&Number(row.value)>=value))continue;
        await client.query(`INSERT INTO user_achievement_progress(user_id,metric,value) VALUES($1,$2,$3)
          ON CONFLICT(user_id,metric) DO UPDATE SET value=GREATEST(user_achievement_progress.value,EXCLUDED.value)`,[userId,metric,value]);
      }
      const watch=(await client.query('SELECT game_id,game_name,watch_seconds FROM user_game_watch WHERE user_id=$1',[userId])).rows;
      const definitions=[...ACHIEVEMENT_FAMILIES.map(f=>({...f,value:values[f.metric]})),...WATCH_FAMILIES.map(f=>({
        ...f,category:'watch',icon:'👀',unit:'h de visionnage',value:watch.filter(f.match).reduce((n,row)=>n+Number(row.watch_seconds)/3600,0),
        steps:[f.base,...[50,100,250,500,1000].filter(goal=>goal>f.base)].map((goal,index)=>({goal,name:f.name,rewards:WATCH_STAGE_REWARDS[goal]}))
      }))];
      const owned=(await client.query('SELECT badge_key,tier,badge_image,equipped_slot,leaderboard_slot FROM user_badges WHERE user_id=$1',[userId])).rows;
      const paid=new Set((await client.query('SELECT reward_key FROM user_xp_rewards WHERE user_id=$1',[userId])).rows.map(row=>row.reward_key));
      const challenges=[];
      for(const f of definitions){
        // Les récompenses historiques 25/50 h restent inchangées dans le tracker.
        const value=f.value||0,earned=f.steps.filter(stage=>value>=stage.goal),current=earned.at(-1),next=f.steps.find(stage=>value<stage.goal)||f.steps.at(-1);
        const stageIndex=current?f.steps.indexOf(current)+1:0,old=owned.find(row=>row.badge_key===f.key);
        const image=achievementImage(f.id,stageIndex||1,f.image||null);
        if(current&&old?.tier!==`achievement-${stageIndex}`){
          await client.query(`INSERT INTO user_badges(user_id,badge_key,game_id,game_name,badge_name,badge_image,badge_challenge,tier,threshold_hours)
            VALUES($1,$2,'achievement',$3,$4,$5,$6,$7,$8)
            ON CONFLICT(user_id,badge_key) DO UPDATE SET game_name=EXCLUDED.game_name,badge_name=EXCLUDED.badge_name,
              badge_image=EXCLUDED.badge_image,badge_challenge=EXCLUDED.badge_challenge,tier=EXCLUDED.tier,threshold_hours=EXCLUDED.threshold_hours`,
            [userId,f.key,f.category,current.name,image,`${current.goal} ${f.unit}`,`achievement-${stageIndex}`,current.goal]);
        }else if(current&&old.badge_image!==image){
          // L’ajout d’un visuel est pris en compte sans redébloquer le badge.
          await client.query('UPDATE user_badges SET badge_image=$3 WHERE user_id=$1 AND badge_key=$2 AND badge_image IS DISTINCT FROM $3',[userId,f.key,image]);
        }
        for(const stage of earned){
          if(f.base&&stage.goal===f.base)continue;
          const version=f.base?`watch-${stage.goal}-v2`:`achievement-${stage.goal}-v1`;
          if(!paid.has(`${f.key}:${version}`)){
            const old=f.base&&paid.has(`${f.key}:achievement-${stage.goal}-v1`)?rewards(f.steps.indexOf(stage)):{lovysXp:0,globalXp:0,cash:0};
            const grant=Object.fromEntries(['lovysXp','globalXp','cash'].map(key=>[key,Math.max(0,stage.rewards[key]-old[key])]));
            await awardRewards([userId],f.key,grant,version,`${f.key}:no-legacy`,client);
          }
        }
        const reward=current&&current===next?current.rewards:next.rewards;
        challenges.push({badgeKey:f.key,badgeName:current?.name||f.steps[0].name,badgeIcon:f.icon,badgeImage:image,
          badgeChallenge:`${next.goal} ${f.unit}`,gameName:f.category==='watch'?`${f.name} · Visionnage`:`${f.unit}`,
          badgeCategory:f.category,missionType:'achievement',unlocked:Boolean(current),maxed:earned.length===f.steps.length,
          progressValue:value,progressTarget:next.goal,progressUnit:f.unit,progressHint:['close-win','flawless','variety'].includes(f.id)?'Suivi des nouveaux combats après cette mise à jour.':f.category==='event'?'Pendant un événement activé par LoVeRDoSe.':null,
          evolutionLevel:stageIndex,maxEvolutionLevel:f.steps.length,evolutionName:current?.name||'',
          equippedSlot:old?.equipped_slot||null,leaderboardSlot:old?.leaderboard_slot||null,
          rewardLovysXp:f.base&&next.goal===f.base?(f.base===25?250:500):reward.lovysXp,
          rewardGlobalXp:f.base&&next.goal===f.base?(f.base===25?125:250):reward.globalXp,
          rewardCash:f.base&&next.goal===f.base?(f.base===25?25:50):reward.cash,lovysXpToReserve:true,
          celebrationStageId:current?.goal||0,celebrationStageName:current?.name||'',
          celebrationRewardLovysXp:current?(f.base&&current.goal===f.base?(f.base===25?250:500):current.rewards.lovysXp):0,
          celebrationRewardGlobalXp:current?(f.base&&current.goal===f.base?(f.base===25?125:250):current.rewards.globalXp):0,
          celebrationRewardCash:current?(f.base&&current.goal===f.base?(f.base===25?25:50):current.rewards.cash):0,
          stages:f.steps.map((stage,index)=>({goal:stage.goal,name:stage.name,unlocked:value>=stage.goal,image:achievementImage(f.id,index+1,f.image||null)}))});
      }
      await client.query('COMMIT');return challenges;
    }catch(error){try{await client.query('ROLLBACK');}catch{}throw error;}finally{client.release();}
  }


  async function syncSubscriptionTransitions(client,userIds=null){
    const rows=(await client.query(`SELECT u.id,u.is_sub,s.is_active,s.cycle FROM users u
      LEFT JOIN user_subscription_badge_state s ON s.user_id=u.id
      WHERE ($1::int[] IS NULL OR u.id=ANY($1::int[]))
        AND (s.user_id IS NULL OR s.is_active IS DISTINCT FROM u.is_sub)
      ORDER BY u.id FOR UPDATE OF u`,[userIds])).rows;
    const key='mission:sub:soutien-absolu';
    for(const row of rows){
      const active=Boolean(row.is_sub);
      const legacy=(await client.query('SELECT 1 FROM user_xp_rewards WHERE user_id=$1 AND reward_key=$2',[row.id,key+':economy-v1'])).rows.length>0;
      const initial=row.cycle===null||row.cycle===undefined;
      let cycle=initial?(legacy?1:0):Number(row.cycle);
      if(active)cycle=initial?Math.max(1,cycle):cycle+1;
      await client.query(`INSERT INTO user_subscription_badge_state(user_id,is_active,cycle) VALUES($1,$2,$3)
        ON CONFLICT(user_id) DO UPDATE SET is_active=EXCLUDED.is_active,cycle=EXCLUDED.cycle,updated_at=CURRENT_TIMESTAMP`,[row.id,active,cycle]);
      if(!active){
        await client.query('DELETE FROM user_badges WHERE user_id=$1 AND badge_key=$2',[row.id,key]);
        continue;
      }
      await client.query(`INSERT INTO user_badges(user_id,badge_key,game_id,game_name,badge_name,badge_image,badge_challenge,tier,threshold_hours)
        VALUES($1,$2,'special-sub','Spécial · Abonnement','Soutien Absolu','/Loverhi.webp','Abonnement Twitch actif','special',0)
        ON CONFLICT(user_id,badge_key) DO NOTHING`,[row.id,key]);
      if(!(initial&&legacy))await awardRewards([Number(row.id)],key,{lovysXp:500,globalXp:250,cash:100},`subscription-cycle-${cycle}-v1`,key+':no-legacy',client);
    }
  }
  async function syncSubscriptionBadges(userId){
    const client=await pool.connect();try{
      await client.query('BEGIN');await syncSubscriptionTransitions(client,[userId]);await client.query('COMMIT');
    }catch(error){try{await client.query('ROLLBACK');}catch{}throw error;}finally{client.release();}
  }

  async function reconcileGlobalWatch(userId,hours){
    if(hours<100)return 0;
    const key='mission:global:fidele-chaine';
    const previous=await pool.query('SELECT xp_amount FROM user_xp_rewards WHERE user_id=$1 AND reward_key=$2',[userId,key+':stage-100h-v1']);
    // Les nouveaux versements v1 utilisent déjà 750 ; seuls les anciens 500 sont complétés.
    if(Number(previous.rows[0]?.xp_amount)!==500)return 0;
    return awardRewards([userId],key,{lovysXp:250,globalXp:125,cash:25},'stage-100h-v2-adjustment',key+':no-legacy');
  }

  async function adminState(){return (await pool.query(`SELECT id,kind,starts_at,ends_at FROM achievement_events WHERE ends_at>CURRENT_TIMESTAMP ORDER BY id`)).rows;}
  async function toggleEvent(kind,enabled){
    if(!['event','marathon'].includes(kind))throw new Error('Événement inconnu.');
    const client=await pool.connect();try{
      await client.query('BEGIN');
      await client.query("SELECT pg_advisory_xact_lock(418)");
      await client.query('UPDATE achievement_events SET ends_at=CURRENT_TIMESTAMP WHERE kind=$1 AND ends_at>CURRENT_TIMESTAMP',[kind]);
      if(enabled)await client.query("INSERT INTO achievement_events(kind,ends_at) VALUES($1,CURRENT_TIMESTAMP+INTERVAL '24 hours')",[kind]);
      await client.query('COMMIT');return adminState();
    }catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
  }
  async function reset(client,userId){
    await client.query('DELETE FROM user_achievement_progress WHERE user_id=$1',[userId]);
    await client.query('DELETE FROM user_subscription_badge_state WHERE user_id=$1',[userId]);
    await client.query('DELETE FROM user_achievement_event_watch WHERE user_id=$1',[userId]);
  }
  return {init,sync,trackEvents,adminState,toggleEvent,reset,reconcileGlobalWatch,syncSubscriptionBadges,syncSubscriptionTransitions};
}
