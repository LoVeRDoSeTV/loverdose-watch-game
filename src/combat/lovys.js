export const LOVYS_RANK_COSTS = Object.freeze({ 2:20, 3:40, 4:70, 5:120 });
export const LOVYS_MAX_RANK = 5;
export const DUPLICATE_FRAGMENT_REWARDS = Object.freeze({ Commun:10, Rare:15, 'Épique':25, Mythique:40 });

export const LOVYS_COMBAT_CONFIG = Object.freeze({
  plant: {
    base:{ hp:170, attack:42, defense:50, speed:8 }, growth:{ hp:20, attack:6, defense:5, speed:0.18 },
    talent:{ key:'living_roots', name:'Racines vives', icon:'🌿', values:[2.5,2.8,3], description:'Récupère {value} % de ses PV max au début de chaque tour.' },
    skills:[
      { key:'vine_whip', name:'Fouet végétal', icon:'🌿', multiplier:1.20, cooldown:2, description:'Une attaque végétale à 120 % de l’ATQ.' },
      { key:'healing_sap', name:'Sève réparatrice', icon:'💚', multiplier:.85, cooldown:4, healPercent:8, description:'Frappe à 85 % et récupère 8 % des PV max.' }
    ]
  },
  water: {
    base:{ hp:165, attack:48, defense:52, speed:7 }, growth:{ hp:20, attack:7, defense:5.3, speed:0.16 },
    talent:{ key:'deep_veil', name:'Voile des profondeurs', icon:'💧', values:[45,50,55], description:'Le premier coup reçu inflige {value} % de dégâts en moins.' },
    skills:[
      { key:'abyssal_wave', name:'Vague abyssale', icon:'🌊', multiplier:1.15, cooldown:2, description:'Une vague à 115 % de l’ATQ.' },
      { key:'protective_current', name:'Courant protecteur', icon:'🫧', multiplier:.95, cooldown:4, defenseBuff:20, buffTurns:2, description:'Frappe à 95 % et augmente la DEF de 20 % pendant 2 tours.' }
    ]
  },
  voltis: {
    base:{ hp:145, attack:48, defense:36, speed:12 }, growth:{ hp:17, attack:6.8, defense:4.2, speed:0.24 },
    talent:{ key:'discharge', name:'Décharge', icon:'⚡', values:[15,17,20], description:'Chaque attaque a {value} % de chances d’étourdir l’ennemi pendant 1 tour.' },
    skills:[
      { key:'electric_arc', name:'Arc électrique', icon:'⚡', multiplier:1.20, cooldown:2, description:'Une frappe électrique à 120 % de l’ATQ.' },
      { key:'overcharge', name:'Surtension', icon:'🌩️', multiplier:1.35, cooldown:4, stunBonus:10, description:'Frappe à 135 % avec +10 % de chance d’étourdir.' }
    ]
  },
  brumee: {
    base:{ hp:140, attack:44, defense:38, speed:13 }, growth:{ hp:17, attack:6.2, defense:4.3, speed:0.25 },
    talent:{ key:'mist_dodge', name:'Esquive brumeuse', icon:'🌫️', values:[12,14,16], description:'A {value} % de chances d’esquiver complètement une attaque.' },
    skills:[
      { key:'mist_slash', name:'Entaille brumeuse', icon:'🌫️', multiplier:1.15, cooldown:2, description:'Une attaque rapide à 115 % de l’ATQ.' },
      { key:'dissipation', name:'Dissipation', icon:'💨', multiplier:1.00, cooldown:4, guaranteedDodge:true, description:'Frappe à 100 % puis garantit l’esquive du prochain coup.' }
    ]
  },
  fire: {
    base:{ hp:150, attack:52, defense:40, speed:10 }, growth:{ hp:18, attack:7.2, defense:4.5, speed:0.20 },
    talent:{ key:'persistent_ember', name:'Braise tenace', icon:'🔥', values:[20,23,25], secondary:[15,17,20], description:'Peut enflammer l’ennemi pendant 3 tours.' },
    skills:[
      { key:'burning_bite', name:'Morsure ardente', icon:'🔥', multiplier:1.20, cooldown:2, description:'Une morsure à 120 % de l’ATQ.' },
      { key:'blaze', name:'Brasier', icon:'☄️', multiplier:1.25, cooldown:4, guaranteedBurn:true, burnTurns:2, description:'Frappe à 125 % et applique Braise pendant 2 tours.' }
    ]
  },
  crysal: {
    base:{ hp:165, attack:48, defense:55, speed:7 }, growth:{ hp:19, attack:6.4, defense:5.7, speed:0.16 },
    talent:{ key:'prismatic_reflection', name:'Reflet prismatique', icon:'💎', values:[12,14,16], description:'Renvoie {value} % des dégâts réellement reçus.' },
    skills:[
      { key:'prismatic_shard', name:'Éclat prismatique', icon:'💎', multiplier:1.18, cooldown:2, description:'Une projection cristalline à 118 % de l’ATQ.' },
      { key:'refraction', name:'Réfraction', icon:'🔷', multiplier:1.30, cooldown:4, ignoreDefense:20, description:'Frappe à 130 % et ignore 20 % de la DEF.' }
    ]
  },
  ferox: {
    base:{ hp:180, attack:55, defense:58, speed:6 }, growth:{ hp:21, attack:7.3, defense:6, speed:0.13 },
    talent:{ key:'forge_strike', name:'Frappe de forge', icon:'🔨', values:[140,145,150], secondary:[50,60,70], description:'Tous les 3 coups, frappe plus fort et ignore une partie de la DEF.' },
    skills:[
      { key:'forge_impact', name:'Impact de forge', icon:'⚒️', multiplier:1.25, cooldown:2, description:'Un impact massif à 125 % de l’ATQ.' },
      { key:'telluric_fusion', name:'Fusion tellurique', icon:'🌋', multiplier:1.45, cooldown:4, ignoreDefense:25, description:'Frappe à 145 % et ignore 25 % de la DEF.' }
    ]
  },
  dark: {
    base:{ hp:145, attack:60, defense:38, speed:14 }, growth:{ hp:17, attack:7.8, defense:4.2, speed:0.28 },
    talent:{ key:'ambush', name:'Embuscade', icon:'🌑', values:[175,185,200], description:'Joue en priorité au début du combat et sa première attaque est renforcée.' },
    skills:[
      { key:'void_claw', name:'Griffe du Néant', icon:'🌑', multiplier:1.25, cooldown:2, description:'Une attaque du Néant à 125 % de l’ATQ.' },
      { key:'shadow_step', name:'Pas d’ombre', icon:'🖤', multiplier:1.35, cooldown:4, guaranteedDodge:true, description:'Frappe à 135 % puis garantit l’esquive du prochain coup.' }
    ]
  },
  solka: {
    base:{ hp:175, attack:52, defense:48, speed:9 }, growth:{ hp:20, attack:6.8, defense:5.1, speed:0.19 },
    talent:{ key:'second_wind', name:'Second souffle', icon:'☀️', values:[1.5,1.8,2], secondary:[18,20,22], tertiary:[12,14,15], description:'Régénère chaque tour et déclenche une récupération d’urgence sous 30 % de PV.' },
    skills:[
      { key:'solar_ray', name:'Rayon solaire', icon:'☀️', multiplier:1.18, cooldown:2, description:'Un rayon à 118 % de l’ATQ.' },
      { key:'regenerative_dawn', name:'Aube régénérante', icon:'🌅', multiplier:.90, cooldown:4, healPercent:10, description:'Frappe à 90 % et récupère 10 % des PV max.' }
    ]
  },
  dream: {
    base:{ hp:160, attack:58, defense:45, speed:11 }, growth:{ hp:19, attack:7.5, defense:4.8, speed:0.22 },
    talent:{ key:'waking_dream', name:'Rêve éveillé', icon:'✨', values:[20,25,30], description:'Une fois par combat, survit à un coup fatal puis récupère des PV. Ignore aussi le malus de type.' },
    skills:[
      { key:'dream_shard', name:'Éclat onirique', icon:'✨', multiplier:1.20, cooldown:2, description:'Une attaque onirique à 120 % de l’ATQ.' },
      { key:'perfect_mirage', name:'Mirage parfait', icon:'🌌', multiplier:1.30, cooldown:4, ignoreDefense:20, description:'Frappe à 130 % et ignore 20 % de la DEF.' }
    ]
  }
});

export function talentTierForRank(rank=1){ return Number(rank)>=5 ? 2 : Number(rank)>=3 ? 1 : 0; }
export function rankStatMultiplier(rank=1){ return 1 + Math.max(0, Math.min(4, Number(rank||1)-1)) * .02; }
export function duplicateFragmentsForRarity(rarity='Commun'){ return DUPLICATE_FRAGMENT_REWARDS[rarity] || 10; }
export function nextRankCost(rank=1){ return LOVYS_RANK_COSTS[Math.min(LOVYS_MAX_RANK, Number(rank||1)+1)] || null; }

export function buildLovysBattleStats({ creature, level=1, rank=1 }){
  const cfg=LOVYS_COMBAT_CONFIG[creature?.id] || LOVYS_COMBAT_CONFIG.plant;
  const lvl=Math.max(1, Math.min(50, Number(level||1)));
  const r=Math.max(1, Math.min(LOVYS_MAX_RANK, Number(rank||1)));
  const bonus=rankStatMultiplier(r);
  const calc=(key)=>Math.round((Number(cfg.base[key]||0)+Number(cfg.growth[key]||0)*(lvl-1))*bonus);
  const tier=talentTierForRank(r);
  const talent={...cfg.talent,tier,value:Number(cfg.talent.values?.[tier]||0),secondaryValue:Number(cfg.talent.secondary?.[tier]||0),tertiaryValue:Number(cfg.talent.tertiary?.[tier]||0)};
  return {
    level:lvl, rank:r, hp:calc('hp'), attack:calc('attack'), defense:calc('defense'), speed:calc('speed'), power:calc('attack'),
    type:creature?.type||'Neutre', name:creature?.name||'Lovys', rarity:creature?.rarity||'Commun', creatureId:creature?.id||'plant',
    talent, skills:cfg.skills.map(skill=>({...skill}))
  };
}

export function publicTalentDescription(talent){
  if(!talent) return '';
  let text=String(talent.description||'');
  text=text.replace('{value}', String(talent.value ?? ''));
  return text;
}
