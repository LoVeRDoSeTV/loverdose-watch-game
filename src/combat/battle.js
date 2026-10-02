import crypto from 'crypto';

const clamp=(n,min,max)=>Math.max(min,Math.min(max,n));
const chance=(pct)=>crypto.randomInt(10000) < clamp(Number(pct||0),0,100)*100;
const variance=()=>.94 + crypto.randomInt(0,13)/100;

function effectiveDefense(base, ignorePercent=0){ return Math.max(0, Number(base||0) * (1-clamp(ignorePercent,0,100)/100)); }
function damageAmount(attack, defense, multiplier=1, typeMultiplier=1, ignoreDefense=0){
  const def=effectiveDefense(defense,ignoreDefense);
  const mitigation=100/(100+def*1.15);
  return Math.max(4, Math.round(Number(attack||1)*Number(multiplier||1)*Number(typeMultiplier||1)*mitigation*variance()));
}
function talentKey(state){ return state.player?.talent?.key || ''; }
function playerTalentValue(state){ return Number(state.player?.talent?.value||0); }
function playerTalentSecondary(state){ return Number(state.player?.talent?.secondaryValue||0); }
function playerTalentTertiary(state){ return Number(state.player?.talent?.tertiaryValue||0); }
function pushEvent(events,type,message,extra={}){ events.push({type,message,...extra}); }
function heal(entity,amount){ const before=entity.hp; entity.hp=Math.min(entity.maxHp,entity.hp+Math.max(0,Math.round(amount))); return Math.max(0,entity.hp-before); }

export function createBattleState({fight, player, typeMultiplier=1, bossMechanic=null}){
  const enemyDefense=Number(fight.defense ?? (20+Number(fight.level||1)*3.2));
  const enemySpeed=Number(fight.speed ?? (6+Number(fight.level||1)*.55));
  const state={
    version:2, fightKey:fight.key, round:1, status:'active', typeMultiplier:Number(typeMultiplier||1),
    player:{...player,hp:Number(player.hp),maxHp:Number(player.hp),cooldowns:{},attackBuffTurns:0,attackBuffPercent:0,defenseBuffTurns:0,defenseBuffPercent:0,guaranteedDodge:false,talentState:{firstHit:true,firstAttack:true,fatalUsed:false,actionCount:0,secondWindUsed:false}},
    enemy:{name:fight.name,level:Number(fight.level||1),type:fight.type||'Neutre',hp:Number(fight.hp||1),maxHp:Number(fight.hp||1),attack:Number(fight.attack ?? (Number(fight.power||1)*.90)),defense:enemyDefense,speed:enemySpeed,boss:Boolean(fight.boss),mechanic:bossMechanic||fight.mechanic||null,statuses:{burnTurns:0,burnDamage:0,stunned:false},mechanicState:{dodgesUsed:0,phase:1,specialCounter:0,firstHit:true}},
    createdAt:Date.now()
  };
  return state;
}

export function battlePublicState(state){
  return {
    fightKey:state.fightKey, round:state.round, status:state.status, typeMultiplier:state.typeMultiplier,
    player:{name:state.player.name,level:state.player.level,rank:state.player.rank,type:state.player.type,hp:state.player.hp,maxHp:state.player.maxHp,attack:state.player.attack,defense:state.player.defense,speed:state.player.speed,power:state.player.attack,talent:state.player.talent,skills:state.player.skills,cooldowns:state.player.cooldowns},
    enemy:{name:state.enemy.name,level:state.enemy.level,type:state.enemy.type,hp:state.enemy.hp,maxHp:state.enemy.maxHp,attack:state.enemy.attack,defense:state.enemy.defense,speed:state.enemy.speed,power:state.enemy.attack,boss:state.enemy.boss,mechanic:state.enemy.mechanic}
  };
}

function tickCooldowns(state){ for(const key of Object.keys(state.player.cooldowns||{})) state.player.cooldowns[key]=Math.max(0,Number(state.player.cooldowns[key]||0)-1); }
function playerAttackValue(state){ return state.player.attack * (1+(state.player.attackBuffTurns>0?state.player.attackBuffPercent:0)/100); }
function playerDefenseValue(state){ return state.player.defense * (1+(state.player.defenseBuffTurns>0?state.player.defenseBuffPercent:0)/100); }
function typeMultiplierForPlayer(state){ return talentKey(state)==='waking_dream' && state.typeMultiplier<1 ? 1 : state.typeMultiplier; }

function applyStartOfPlayerTurn(state,events){
  if(talentKey(state)==='living_roots'){
    const amount=heal(state.player,state.player.maxHp*playerTalentValue(state)/100);
    if(amount>0) pushEvent(events,'heal',`${state.player.name} récupère ${amount} PV grâce à Racines vives.`,{target:'player',amount});
  }
  if(talentKey(state)==='second_wind'){
    const amount=heal(state.player,state.player.maxHp*playerTalentValue(state)/100);
    if(amount>0) pushEvent(events,'heal',`${state.player.name} récupère ${amount} PV grâce à Second souffle.`,{target:'player',amount});
    const ts=state.player.talentState;
    if(!ts.secondWindUsed && state.player.hp/state.player.maxHp<.30){
      ts.secondWindUsed=true;
      const burst=heal(state.player,state.player.maxHp*playerTalentSecondary(state)/100);
      state.player.attackBuffPercent=playerTalentTertiary(state); state.player.attackBuffTurns=3;
      pushEvent(events,'talent',`Second souffle s’active : +${burst} PV et +${playerTalentTertiary(state)} % ATQ pendant 3 tours.`,{target:'player'});
    }
  }
}

function applyBossPhase(state,events){
  const m=state.enemy.mechanic; if(!m) return;
  const pct=state.enemy.hp/state.enemy.maxHp*100;
  if(m.key==='monarch_phases'){
    if(pct<=30 && state.enemy.mechanicState.phase<3){state.enemy.mechanicState.phase=3;state.enemy.attack=Math.round(state.enemy.attack*1.20);state.enemy.speed+=3;state.enemy.defense=Math.round(state.enemy.defense*.88);pushEvent(events,'boss',`💜 Dernier éclat : ${state.enemy.name} gagne en ATQ et VIT mais perd de la DEF.`);}
    else if(pct<=60 && state.enemy.mechanicState.phase<2){state.enemy.mechanicState.phase=2;state.enemy.defense=Math.round(state.enemy.defense*1.12);pushEvent(events,'boss',`🌿 Éveil des racines : ${state.enemy.name} renforce sa DEF.`);}
    if(state.enemy.mechanicState.phase===2){const h=heal(state.enemy,state.enemy.maxHp*.015);if(h)pushEvent(events,'heal',`${state.enemy.name} régénère ${h} PV.`,{target:'enemy',amount:h});}
  }
  if(m.key==='magma_core' && pct<=25 && state.enemy.mechanicState.phase<2){state.enemy.mechanicState.phase=2;state.enemy.attack=Math.round(state.enemy.attack*1.15);state.enemy.defense=Math.round(state.enemy.defense*.85);pushEvent(events,'boss',`🌋 Éruption finale : +15 % ATQ, -15 % DEF.`);}
  if(m.key==='eclipse_phases' && pct<=50 && state.enemy.mechanicState.phase<2){state.enemy.mechanicState.phase=2;state.enemy.attack=Math.round(state.enemy.attack*1.12);state.enemy.speed+=2;pushEvent(events,'boss',`🌑 Éclipse totale : ${state.enemy.name} accélère et frappe plus fort.`);}
}

function enemyDodge(state,events){
  const m=state.enemy.mechanic; if(!m) return false;
  if(m.key==='oracle_dodge' && state.enemy.mechanicState.dodgesUsed===0){state.enemy.mechanicState.dodgesUsed=1;pushEvent(events,'dodge',`${state.enemy.name} disparaît dans un mirage et esquive l’attaque.`,{target:'enemy'});return true;}
  const pct=Number(m.dodgeChance||0),max=Number(m.maxDodges||0);
  if(pct>0 && (!max||state.enemy.mechanicState.dodgesUsed<max) && chance(pct)){state.enemy.mechanicState.dodgesUsed++;pushEvent(events,'dodge',`${state.enemy.name} esquive l’attaque.`,{target:'enemy'});return true;}
  return false;
}

function playerDodge(state,events){
  if(state.player.guaranteedDodge){state.player.guaranteedDodge=false;pushEvent(events,'dodge',`${state.player.name} se dissipe et esquive le coup.`,{target:'player'});return true;}
  if(talentKey(state)==='mist_dodge' && chance(playerTalentValue(state))){pushEvent(events,'dodge',`${state.player.name} esquive grâce à Esquive brumeuse.`,{target:'player'});return true;}
  return false;
}

function applyIncomingPlayerDamage(state,rawDamage,events){
  let damage=Math.max(0,Math.round(rawDamage));
  const ts=state.player.talentState;
  if(talentKey(state)==='deep_veil' && ts.firstHit){ts.firstHit=false;const before=damage;damage=Math.max(1,Math.round(damage*(1-playerTalentValue(state)/100)));pushEvent(events,'talent',`Voile des profondeurs réduit le premier coup de ${before-damage} dégâts.`,{target:'player'});}
  const lethal=damage>=state.player.hp;
  if(lethal && talentKey(state)==='waking_dream' && !ts.fatalUsed){ts.fatalUsed=true;state.player.hp=1;const restored=heal(state.player,state.player.maxHp*playerTalentValue(state)/100);pushEvent(events,'talent',`✨ Rêve éveillé sauve ${state.player.name} et lui rend ${restored} PV.`,{target:'player'});return 0;}
  state.player.hp=Math.max(0,state.player.hp-damage);
  if(talentKey(state)==='prismatic_reflection' && damage>0 && state.enemy.hp>0){const reflected=Math.max(1,Math.round(damage*playerTalentValue(state)/100));state.enemy.hp=Math.max(0,state.enemy.hp-reflected);pushEvent(events,'reflect',`Reflet prismatique renvoie ${reflected} dégâts.`,{target:'enemy',amount:reflected});}
  return damage;
}

function executePlayerAction(state,actionKey,events){
  const skills=state.player.skills||[];
  const skill=skills.find(s=>s.key===actionKey);
  if(actionKey!=='basic'&&!skill) throw new Error('Compétence inconnue.');
  if(skill && Number(state.player.cooldowns?.[skill.key]||0)>0) throw new Error('Cette compétence est encore en recharge.');
  const action=skill||{key:'basic',name:'Attaque',icon:'⚔️',multiplier:1,cooldown:0};
  state.player.talentState.actionCount++;
  let mult=Number(action.multiplier||1),ignore=Number(action.ignoreDefense||0);
  if(talentKey(state)==='ambush' && state.player.talentState.firstAttack){state.player.talentState.firstAttack=false;mult*=playerTalentValue(state)/100;pushEvent(events,'talent',`🌑 Embuscade renforce la première attaque.`,{target:'player'});}
  if(talentKey(state)==='forge_strike' && state.player.talentState.actionCount%3===0){mult*=playerTalentValue(state)/100;ignore=Math.max(ignore,playerTalentSecondary(state));pushEvent(events,'talent',`🔨 Frappe de forge : coup renforcé et ${ignore} % de DEF ignorée.`,{target:'player'});}
  if(enemyDodge(state,events)){ if(skill) state.player.cooldowns[skill.key]=Number(skill.cooldown||0); return; }
  const dmg=damageAmount(playerAttackValue(state),state.enemy.defense,mult,typeMultiplierForPlayer(state),ignore);
  state.enemy.hp=Math.max(0,state.enemy.hp-dmg);
  pushEvent(events,'damage',`${state.player.name} utilise ${action.name} et inflige ${dmg} dégâts.`,{source:'player',target:'enemy',amount:dmg,action:action.name});
  if(skill) state.player.cooldowns[skill.key]=Number(skill.cooldown||0);
  if(action.healPercent){const h=heal(state.player,state.player.maxHp*Number(action.healPercent)/100);if(h)pushEvent(events,'heal',`${state.player.name} récupère ${h} PV.`,{target:'player',amount:h});}
  if(action.defenseBuff){state.player.defenseBuffPercent=Number(action.defenseBuff);state.player.defenseBuffTurns=Number(action.buffTurns||2);pushEvent(events,'buff',`🛡️ DEF +${action.defenseBuff} % pendant ${action.buffTurns||2} tours.`,{target:'player'});}
  if(action.guaranteedDodge){state.player.guaranteedDodge=true;pushEvent(events,'buff',`💨 La prochaine attaque ennemie sera esquivée.`,{target:'player'});}
  if(state.enemy.hp<=0) return;
  if(talentKey(state)==='discharge'){
    const bossResistance=state.enemy.boss?.5:0;
    const stunChance=(playerTalentValue(state)+Number(action.stunBonus||0))*(1-bossResistance);
    if(chance(stunChance)){state.enemy.statuses.stunned=true;pushEvent(events,'status',`⚡ ${state.enemy.name} est étourdi et sautera son prochain tour.`,{target:'enemy'});}
  }
  if(talentKey(state)==='persistent_ember'){
    const proc=Boolean(action.guaranteedBurn)||chance(playerTalentValue(state));
    if(proc){state.enemy.statuses.burnTurns=Number(action.burnTurns||3);state.enemy.statuses.burnDamage=Math.max(1,Math.round(state.player.attack*playerTalentSecondary(state)/100));pushEvent(events,'status',`🔥 ${state.enemy.name} brûle pendant ${state.enemy.statuses.burnTurns} tours.`,{target:'enemy'});}
  }
}

function executeEnemyTurn(state,events){
  if(state.enemy.hp<=0) return;
  applyBossPhase(state,events);
  if(state.enemy.statuses.burnTurns>0){const d=Math.min(state.enemy.hp,Math.max(1,Number(state.enemy.statuses.burnDamage||1)));state.enemy.hp=Math.max(0,state.enemy.hp-d);state.enemy.statuses.burnTurns--;pushEvent(events,'damage',`🔥 Braise inflige ${d} dégâts à ${state.enemy.name}.`,{source:'status',target:'enemy',amount:d});if(state.enemy.hp<=0)return;}
  if(state.enemy.statuses.stunned){state.enemy.statuses.stunned=false;pushEvent(events,'skip',`⚡ ${state.enemy.name} est étourdi et perd son tour.`,{target:'enemy'});return;}
  if(playerDodge(state,events)) return;
  let mult=1,ignore=0,actionName='Attaque';
  const m=state.enemy.mechanic;
  state.enemy.mechanicState.specialCounter++;
  if(m?.key==='magma_core' && state.enemy.mechanicState.specialCounter%3===0){mult=1.35;actionName='Surchauffe';pushEvent(events,'boss',`🔥 Le Cœur de Magma libère sa Surchauffe.`);}
  if(m?.key==='root_guard' && state.enemy.mechanicState.specialCounter%3===0){mult=1.22;actionName='Écrasement racinaire';}
  if(m?.key==='eclipse_phases' && state.enemy.mechanicState.specialCounter%3===0){ignore=30;actionName='Faille d’éclipse';}
  const dmg=damageAmount(state.enemy.attack,playerDefenseValue(state),mult,1,ignore);
  const dealt=applyIncomingPlayerDamage(state,dmg,events);
  if(dealt>0)pushEvent(events,'damage',`${state.enemy.name} utilise ${actionName} et inflige ${dealt} dégâts.`,{source:'enemy',target:'player',amount:dealt,action:actionName});
}

function bossPrePlayerReaction(state,events){
  const m=state.enemy.mechanic;
  if(m?.key==='root_guard' && state.enemy.mechanicState.firstHit){state.enemy.mechanicState.firstHit=false;state.enemy.defense=Math.round(state.enemy.defense*1.45);pushEvent(events,'boss',`🛡️ Écorce ancienne : la DEF du ${state.enemy.name} est renforcée pour le premier échange.`);return ()=>{state.enemy.defense=Math.round(state.enemy.defense/1.45);};}
  if(m?.key==='colossus_armor' && state.enemy.mechanicState.firstHit){state.enemy.mechanicState.firstHit=false;state.enemy.defense=Math.round(state.enemy.defense*1.55);pushEvent(events,'boss',`🪨 Armure de scories : le premier coup est fortement amorti.`);return ()=>{state.enemy.defense=Math.round(state.enemy.defense/1.55);};}
  return ()=>{};
}

export function resolveBattleAction(state,actionKey){
  if(!state||state.status!=='active') throw new Error('Aucun combat actif.');
  const events=[];
  tickCooldowns(state);
  const bossForcesFirst=Boolean(state.enemy.mechanic?.alwaysFirst && state.round===1);
  const noctyForcesFirst=talentKey(state)==='ambush' && state.round===1;
  const enemyFirst=bossForcesFirst || (!noctyForcesFirst && Number(state.enemy.speed||0)>Number(state.player.speed||0));

  const doPlayer=()=>{
    if(state.player.hp<=0||state.enemy.hp<=0)return;
    applyStartOfPlayerTurn(state,events);
    if(state.player.hp<=0)return;
    const restore=bossPrePlayerReaction(state,events);
    executePlayerAction(state,String(actionKey||'basic'),events);
    restore();
  };
  const doEnemy=()=>{ if(state.player.hp>0&&state.enemy.hp>0)executeEnemyTurn(state,events); };

  if(enemyFirst){
    if(bossForcesFirst)pushEvent(events,'boss',`⚡ ${state.enemy.name} prend l’initiative du combat.`);
    doEnemy();
    doPlayer();
  }else{
    doPlayer();
    doEnemy();
  }

  if(state.enemy.hp<=0){state.status='victory';return {state,events};}
  if(state.player.hp<=0){state.status='defeat';return {state,events};}
  if(state.player.attackBuffTurns>0)state.player.attackBuffTurns--;
  if(state.player.defenseBuffTurns>0)state.player.defenseBuffTurns--;
  state.round++;
  if(state.round>30){state.status=state.enemy.hp<state.player.hp?'victory':'defeat';pushEvent(events,'system','Le combat atteint la limite de 30 tours.');}
  return {state,events};
}
