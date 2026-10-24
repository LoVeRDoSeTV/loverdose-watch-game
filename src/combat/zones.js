import { lovysThresholdForLevel } from '../xp-economy.js';

// Stable fight keys preserve existing victories and first-win rewards.
// Enemy levels describe the recommended Lovys level (campaign ends at 30), not a global level.
const LEGACY_ZONES = [
  { key:'forest', name:'Forêt des Premiers Éclats', icon:'🌿', fights:[
    {key:'forest_1',name:'Germe sauvage',level:1,type:'Verdance',hp:110,power:42,rewards:{creatureXp:4,globalXp:2,fragments:1}},
    {key:'forest_2',name:'Rôdeur mousseux',level:2,type:'Verdance',hp:130,power:48,rewards:{creatureXp:5,globalXp:2,fragments:1}},
    {key:'forest_3',name:'Sentinelle des racines',level:3,type:'Verdance',hp:150,power:54,rewards:{creatureXp:6,globalXp:3,fragments:1}},
    {key:'forest_4',name:'Lucibulle sylvestre',level:4,type:'Verdance',hp:175,power:60,rewards:{creatureXp:7,globalXp:3,fragments:1}},
    {key:'forest_5',name:'Mycélium vif',level:5,type:'Verdance',hp:205,power:66,rewards:{creatureXp:8,globalXp:4,fragments:1}},
    {key:'forest_6',name:'Gardien des Racines',level:6,type:'Verdance',hp:250,power:74,boss:true,miniBoss:true,mechanic:{key:'root_guard',name:'Écorce ancienne',description:'Le premier échange est fortement amorti. Toutes les 3 attaques, le Gardien utilise un écrasement racinaire.'},rewards:{creatureXp:12,globalXp:5,fragments:3}},
    {key:'forest_7',name:'Esprit du sous-bois',level:7,type:'Mirage',hp:275,power:78,rewards:{creatureXp:9,globalXp:4,fragments:1}},
    {key:'forest_8',name:'Sylve fractale',level:8,type:'Verdance',hp:305,power:84,rewards:{creatureXp:10,globalXp:5,fragments:1}},
    {key:'forest_9',name:'Grand mycéliarque',level:9,type:'Verdance',hp:340,power:90,rewards:{creatureXp:12,globalXp:5,fragments:2}},
    {key:'forest_boss',name:'Monarque des Premiers Éclats',level:10,type:'Verdance',hp:410,power:100,boss:true,finalBoss:true,mechanic:{key:'monarch_phases',name:'Règne des racines',description:'Change de phase à 60 % puis 30 % de PV : défense, régénération puis offensive finale.'},rewards:{creatureXp:20,globalXp:8,fragments:5}}
  ]},
  { key:'ember', name:'Forges du Cœur Ardent', icon:'🔥', fights:[
    {key:'ember_1',name:'Flammèche cavernicole',level:5,type:'Cendre',hp:235,power:76,rewards:{creatureXp:10,globalXp:4,fragments:1}},
    {key:'ember_2',name:'Roche ardente',level:6,type:'Forge',hp:270,power:84,rewards:{creatureXp:11,globalXp:4,fragments:1}},
    {key:'ember_3',name:'Salamandre de braise',level:7,type:'Cendre',hp:305,power:92,rewards:{creatureXp:12,globalXp:5,fragments:1}},
    {key:'ember_4',name:'Scarabraise',level:8,type:'Forge',hp:345,power:100,rewards:{creatureXp:13,globalXp:5,fragments:1}},
    {key:'ember_5',name:'Fumarok',level:9,type:'Cendre',hp:385,power:108,rewards:{creatureXp:14,globalXp:6,fragments:1}},
    {key:'ember_6',name:'Colosse des scories',level:10,type:'Forge',hp:450,power:120,boss:true,miniBoss:true,mechanic:{key:'colossus_armor',name:'Armure de scories',description:'Sa carapace absorbe fortement le premier coup reçu.'},rewards:{creatureXp:20,globalXp:8,fragments:3}},
    {key:'ember_7',name:'Vipère magmatique',level:11,type:'Cendre',hp:480,power:126,rewards:{creatureXp:16,globalXp:7,fragments:1}},
    {key:'ember_8',name:'Obsidrake',level:12,type:'Forge',hp:525,power:134,rewards:{creatureXp:18,globalXp:8,fragments:2}},
    {key:'ember_9',name:'Titan de la Forge',level:13,type:'Forge',hp:580,power:144,rewards:{creatureXp:20,globalXp:9,fragments:2}},
    {key:'ember_boss',name:'Cœur de Magma',level:15,type:'Cendre',hp:700,power:160,boss:true,finalBoss:true,mechanic:{key:'magma_core',name:'Cœur en fusion',description:'Prend toujours l’initiative. Surchauffe toutes les 3 attaques et entre en éruption sous 25 % de PV.',alwaysFirst:true},rewards:{creatureXp:32,globalXp:14,fragments:6}}
  ]},
  { key:'night', name:'Ruines Nocturnes', icon:'🌙', fights:[
    {key:'night_1',name:'Ombre errante',level:10,type:'Néant',hp:420,power:116,rewards:{creatureXp:10,globalXp:4,fragments:1}},
    {key:'night_2',name:'Veilleur brisé',level:11,type:'Cristal',hp:455,power:124,rewards:{creatureXp:11,globalXp:4,fragments:1}},
    {key:'night_3',name:'Spectre du miroir',level:12,type:'Mirage',hp:495,power:132,rewards:{creatureXp:12,globalXp:5,fragments:2}},
    {key:'night_4',name:'Chevalier du Néant',level:13,type:'Néant',hp:540,power:142,rewards:{creatureXp:13,globalXp:5,fragments:2}},
    {key:'night_5',name:'Chauvebrume astrale',level:16,type:'Mirage',family:'manta',rewards:{creatureXp:14,globalXp:6,fragments:2}},
    {key:'night_6',name:'Arachnuit des arches',level:16,type:'Cristal',family:'crab',rewards:{creatureXp:15,globalXp:6,fragments:2}},
    {key:'night_7',name:'Salamandre lunaire',level:16,type:'Mirage',family:'quadruped',rewards:{creatureXp:16,globalXp:7,fragments:2}},
    {key:'night_8',name:'Basilic d’obsidienne',level:16,type:'Néant',family:'wyrm',rewards:{creatureXp:17,globalXp:7,fragments:2}},
    {key:'night_mini',name:'Oracle des Ruines',level:14,type:'Mirage',hp:600,power:152,boss:true,miniBoss:true,mechanic:{key:'oracle_dodge',name:'Mirage prophétique',description:'Esquive automatiquement la première attaque du combat.'},rewards:{creatureXp:18,globalXp:7,fragments:4}},
    {key:'night_boss',name:'Seigneur de l’Éclipse',level:15,type:'Néant',hp:720,power:166,boss:true,finalBoss:true,mechanic:{key:'eclipse_phases',name:'Éclipse totale',description:'Peut esquiver au maximum deux attaques. Sous 50 % de PV, gagne ATQ/VIT et perce périodiquement la DEF.',dodgeChance:10,maxDodges:2},rewards:{creatureXp:28,globalXp:10,fragments:7}}
  ]}
];

const LEGACY_LEVELS = [[1,2,3,4,5,6,7,8,9,10],[10,10,11,11,12,12,13,13,14,14],[14,15,15,16,16,16,16,16,16,17]];
const archetypes = {
  slime:[.86,.93,.85,1], crab:[.98,.88,1.12,-2], manta:[.91,.98,.82,3], wyrm:[.95,1.04,.9,2],
  turtle:[1.08,.83,1.15,-3], jelly:[.90,.98,.88,0], quadruped:[.96,1.02,.93,2], owl:[.93,1,.9,2],
  rabbit:[.88,1,.85,4], moth:[.89,1.03,.86,3], golem:[1.05,.93,1.1,-2], titan:[1.06,.98,1.08,-2],
  leviathan:[1.01,1.02,.97,1], sphinx:[.98,1.02,1.03,1], chimera:[1,1.03,.98,2], phoenix:[.96,1.06,.9,3]
};

function balancedStats(level, {position=0,boss=false,finalBoss=false,family='quadruped',zoneIndex=0}={}) {
  const [hp,atk,def,speed] = archetypes[family] || archetypes.quadruped;
  const pressure = .80 + Math.min(position,7)*.018 + zoneIndex*.003;
  return {
    hp:Math.round((150+22.0*(level-1))*hp*(finalBoss?1.14:boss?1.06:1)),
    attack:Math.round((42+7.7*(level-1))*atk*pressure*(finalBoss?.86:boss?.94:1)*(finalBoss&&zoneIndex===9?.85:finalBoss&&zoneIndex===4?.92:1)),
    defense:Math.round((20+4.2*(level-1))*def*(finalBoss?1.04:1)),
    speed:Math.round(6+level*.24+speed)
  };
}

// Zone 3 illustrations are shared by the API and every responsive combat view.
const NIGHT_CREATURE_ART = {
  night_1:{zone:'night',size:.72,glow:'#9b8fff',image:'/pve/night/ombre-errante-v491.webp'},
  night_2:{zone:'night',size:.82,glow:'#8ee1ff',image:'/pve/night/veilleur-brise-v491.webp'},
  night_3:{zone:'night',size:.93,glow:'#c298ff',image:'/pve/night/spectre-miroir-v491.webp'},
  night_4:{zone:'night',size:1.05,glow:'#998cff',image:'/pve/night/chevalier-neant-v491.webp'},
  night_5:{zone:'night',size:.94,glow:'#ae91ff',image:'/pve/night/chauvebrume-astrale-v493.webp'},
  night_6:{zone:'night',size:.96,glow:'#b69bff',image:'/pve/night/arachnuit-arches-v493.webp'},
  night_7:{zone:'night',size:1,glow:'#8ddaff',image:'/pve/night/salamandre-lunaire-v493.webp'},
  night_8:{zone:'night',size:1.06,glow:'#a48cff',image:'/pve/night/basilic-obsidienne-v493.webp'},
  night_mini:{zone:'night',size:1.16,glow:'#caa8ff',image:'/pve/night/oracle-ruines-v491.webp'},
  night_boss:{zone:'night',size:1.32,glow:'#9181ff',image:'/pve/night/seigneur-eclipse-v491.webp'}
};

const legacy = LEGACY_ZONES.map((zone,zi)=>({...zone,recommendedRank:1,fights:zone.fights.map((fight,fi)=>{
  const level=LEGACY_LEVELS[zi][fi];
  const stats=balancedStats(level,{position:fi,boss:fight.boss,finalBoss:fight.finalBoss,zoneIndex:zi,family:fight.family});
  return {...fight,...stats,power:stats.attack,level,zoneKey:zone.key,...(NIGHT_CREATURE_ART[fight.key]?{visual:NIGHT_CREATURE_ART[fight.key]}:{})};
})}));

const THEMES = [
  {
    "key": "tide",
    "name": "Récifs des Marées oubliées",
    "icon": "🌊",
    "minLevel": 17,
    "maxLevel": 19,
    "type": "Abyssal",
    "accent": "#6ce0e5",
    "secondary": "#33739d",
    "sky": "#073b51",
    "deep": "#071723",
    "lore": "Une cité engloutie où les coraux protègent des créatures des marées.",
    "danger": "Boucliers · Abyssal · Coraux",
    "recommendedRank": 1,
    "mechanic": "tidal_shell",
    "roster": [
      {
        "name": "Perlune des récifs",
        "type": "Abyssal",
        "family": "slime"
      },
      {
        "name": "Crabulle nacré",
        "type": "Cristal",
        "family": "crab"
      },
      {
        "name": "Raie des courants",
        "type": "Abyssal",
        "family": "manta"
      },
      {
        "name": "Hippocampe d’écume",
        "type": "Mirage",
        "family": "wyrm"
      },
      {
        "name": "Tortue corallienne",
        "type": "Cristal",
        "family": "turtle"
      },
      {
        "name": "Méduse des lanternes",
        "type": "Abyssal",
        "family": "jelly"
      },
      {
        "name": "Muréclat azuré",
        "type": "Abyssal",
        "family": "wyrm"
      },
      {
        "name": "Sélacorne des abysses",
        "type": "Abyssal",
        "family": "quadruped"
      },
      {
        "name": "Gardien des Coraux",
        "type": "Cristal",
        "family": "golem"
      },
      {
        "name": "Léviathan des profondeurs",
        "type": "Abyssal",
        "family": "leviathan"
      }
    ]
  },
  {
    "key": "frost",
    "name": "Sommets du Givre éternel",
    "icon": "❄️",
    "minLevel": 19,
    "maxLevel": 21,
    "type": "Cristal",
    "accent": "#b4eaff",
    "secondary": "#708ed2",
    "sky": "#334978",
    "deep": "#0b1830",
    "lore": "Des sommets de glace éclairés par des aurores, où le givre modifie l’initiative.",
    "danger": "Givre · Cristal · Aurores",
    "recommendedRank": 1,
    "mechanic": "frost_breath",
    "roster": [
      {
        "name": "Flocon vif",
        "type": "Cristal",
        "family": "slime"
      },
      {
        "name": "Renardeau givré",
        "type": "Cristal",
        "family": "quadruped"
      },
      {
        "name": "Hibou des aurores",
        "type": "Mirage",
        "family": "owl"
      },
      {
        "name": "Crabe de banquise",
        "type": "Abyssal",
        "family": "crab"
      },
      {
        "name": "Hermine cristalline",
        "type": "Cristal",
        "family": "quadruped"
      },
      {
        "name": "Dracogivre des crêtes",
        "type": "Cristal",
        "family": "wyrm"
      },
      {
        "name": "Raie des neiges",
        "type": "Mirage",
        "family": "manta"
      },
      {
        "name": "Yéti des brumes froides",
        "type": "Cristal",
        "family": "golem"
      },
      {
        "name": "Veilleur des Aurores",
        "type": "Mirage",
        "family": "owl"
      },
      {
        "name": "Gardien du Cœur gelé",
        "type": "Cristal",
        "family": "titan"
      }
    ]
  },
  {
    "key": "dune",
    "name": "Dunes du Soleil brisé",
    "icon": "🏜️",
    "minLevel": 21,
    "maxLevel": 23,
    "type": "Solaire",
    "accent": "#f4ce85",
    "secondary": "#c07b65",
    "sky": "#73523d",
    "deep": "#241c29",
    "lore": "Des dunes anciennes et des obélisques solaires. Observe les attaques annoncées.",
    "danger": "Charge annoncée · Solaire · Sable",
    "recommendedRank": 1,
    "mechanic": "sand_charge",
    "roster": [
      {
        "name": "Grain de soleil",
        "type": "Solaire",
        "family": "slime"
      },
      {
        "name": "Fennec des dunes",
        "type": "Solaire",
        "family": "quadruped"
      },
      {
        "name": "Scarabée d’ambre",
        "type": "Forge",
        "family": "crab"
      },
      {
        "name": "Vipère des mirages",
        "type": "Mirage",
        "family": "wyrm"
      },
      {
        "name": "Tortue d’obsidienne dorée",
        "type": "Forge",
        "family": "turtle"
      },
      {
        "name": "Phalène du couchant",
        "type": "Mirage",
        "family": "moth"
      },
      {
        "name": "Roc des sables",
        "type": "Solaire",
        "family": "owl"
      },
      {
        "name": "Chimère de silice",
        "type": "Cristal",
        "family": "chimera"
      },
      {
        "name": "Colosse des Obélisques",
        "type": "Forge",
        "family": "golem"
      },
      {
        "name": "Sphinx des mirages",
        "type": "Solaire",
        "family": "sphinx"
      }
    ]
  },
  {
    "key": "dream",
    "name": "Jardins des Songes",
    "icon": "🍄",
    "minLevel": 23,
    "maxLevel": 25,
    "type": "Mirage",
    "accent": "#e2a5ed",
    "secondary": "#898ce0",
    "sky": "#493e70",
    "deep": "#201a3b",
    "lore": "Des jardins pastel et des champignons lumineux. Les créatures changent de posture.",
    "danger": "Postures · Mirage · Floraisons",
    "recommendedRank": 1,
    "mechanic": "dream_stance",
    "roster": [
      {
        "name": "Goutte de rêve",
        "type": "Mirage",
        "family": "slime"
      },
      {
        "name": "Lapin des pétales",
        "type": "Verdance",
        "family": "rabbit"
      },
      {
        "name": "Papillon des songes",
        "type": "Mirage",
        "family": "moth"
      },
      {
        "name": "Tortue des nénuphars",
        "type": "Verdance",
        "family": "turtle"
      },
      {
        "name": "Médusonge lilas",
        "type": "Mirage",
        "family": "jelly"
      },
      {
        "name": "Cerf des jardins flottants",
        "type": "Verdance",
        "family": "quadruped"
      },
      {
        "name": "Hibou des souvenirs",
        "type": "Mirage",
        "family": "owl"
      },
      {
        "name": "Dragon des bourgeons",
        "type": "Verdance",
        "family": "wyrm"
      },
      {
        "name": "Arbre des Murmures",
        "type": "Verdance",
        "family": "golem"
      },
      {
        "name": "Chimère des rêves",
        "type": "Mirage",
        "family": "chimera"
      }
    ]
  },
  {
    "key": "storm",
    "name": "Cimes de la Tempête",
    "icon": "⛈️",
    "minLevel": 25,
    "maxLevel": 27,
    "type": "Foudre",
    "accent": "#a8c6ff",
    "secondary": "#a77fe8",
    "sky": "#35415f",
    "deep": "#101b36",
    "lore": "Des îles flottantes reliées par des courants électriques. La foudre se charge puis se déchaîne.",
    "danger": "Charges électriques · Foudre · Îles flottantes",
    "recommendedRank": 1,
    "mechanic": "storm_charge",
    "roster": [
      {
        "name": "Étincelle des nuages",
        "type": "Foudre",
        "family": "slime"
      },
      {
        "name": "Lynx des bourrasques",
        "type": "Foudre",
        "family": "quadruped"
      },
      {
        "name": "Raie des vents",
        "type": "Mirage",
        "family": "manta"
      },
      {
        "name": "Crabe fulgurant",
        "type": "Foudre",
        "family": "crab"
      },
      {
        "name": "Hibou paratonnerre",
        "type": "Foudre",
        "family": "owl"
      },
      {
        "name": "Dracorage céleste",
        "type": "Foudre",
        "family": "wyrm"
      },
      {
        "name": "Méduse des cumulonimbus",
        "type": "Abyssal",
        "family": "jelly"
      },
      {
        "name": "Griffon des alizés",
        "type": "Foudre",
        "family": "chimera"
      },
      {
        "name": "Sentinelle des Éclairs",
        "type": "Forge",
        "family": "golem"
      },
      {
        "name": "Roc de l’Orage",
        "type": "Foudre",
        "family": "phoenix"
      }
    ]
  },
  {
    "key": "automata",
    "name": "Forges des Automates",
    "icon": "⚙️",
    "minLevel": 27,
    "maxLevel": 29,
    "type": "Forge",
    "accent": "#8ae2d0",
    "secondary": "#d9aa78",
    "sky": "#30524e",
    "deep": "#15272d",
    "lore": "Des mécanismes anciens envahis de végétation. La surchauffe expose les noyaux.",
    "danger": "Surchauffe · Forge · Cuivre",
    "recommendedRank": 1,
    "mechanic": "automaton_heat",
    "roster": [
      {
        "name": "Noyautin de cuivre",
        "type": "Forge",
        "family": "slime"
      },
      {
        "name": "Scarabée à ressort",
        "type": "Forge",
        "family": "crab"
      },
      {
        "name": "Renard des engrenages",
        "type": "Forge",
        "family": "quadruped"
      },
      {
        "name": "Tortue à turbine",
        "type": "Forge",
        "family": "turtle"
      },
      {
        "name": "Phalène mécanique",
        "type": "Cristal",
        "family": "moth"
      },
      {
        "name": "Serpent des conduites",
        "type": "Forge",
        "family": "wyrm"
      },
      {
        "name": "Hibou horloger",
        "type": "Cristal",
        "family": "owl"
      },
      {
        "name": "Chimère de bronze",
        "type": "Forge",
        "family": "chimera"
      },
      {
        "name": "Colosse des Pistons",
        "type": "Forge",
        "family": "golem"
      },
      {
        "name": "Titan du Noyau ancien",
        "type": "Forge",
        "family": "titan"
      }
    ]
  },
  {
    "key": "origin",
    "name": "Sanctuaire des Éclats originels",
    "icon": "🌌",
    "minLevel": 29,
    "maxLevel": 30,
    "type": "Cristal",
    "accent": "#f3dfa2",
    "secondary": "#b89cf0",
    "sky": "#454265",
    "deep": "#17172f",
    "lore": "Un sanctuaire céleste où se rencontrent les énergies des Lovys. Le gardien change de phase.",
    "danger": "Phases · Cristal · Énergie originelle",
    "recommendedRank": 1,
    "mechanic": "origin_phases",
    "roster": [
      {
        "name": "Éclat primordial",
        "type": "Cristal",
        "family": "slime"
      },
      {
        "name": "Renard des constellations",
        "type": "Mirage",
        "family": "quadruped"
      },
      {
        "name": "Raie des étoiles",
        "type": "Abyssal",
        "family": "manta"
      },
      {
        "name": "Tortue d’opale",
        "type": "Cristal",
        "family": "turtle"
      },
      {
        "name": "Papillon des origines",
        "type": "Mirage",
        "family": "moth"
      },
      {
        "name": "Serpent des comètes",
        "type": "Solaire",
        "family": "wyrm"
      },
      {
        "name": "Hibou du firmament",
        "type": "Cristal",
        "family": "owl"
      },
      {
        "name": "Phénix des éclats",
        "type": "Solaire",
        "family": "phoenix"
      },
      {
        "name": "Veilleur du Premier Éclat",
        "type": "Cristal",
        "family": "golem"
      },
      {
        "name": "Chimère des Éclats originels",
        "type": "Cristal",
        "family": "chimera"
      }
    ]
  }
];
const MECHANICS = {
  "tidal_shell": {
    "name": "Carapace des marées",
    "description": "Un bouclier absorbe les premières attaques directes. Une fois brisé, il ne revient pas."
  },
  "frost_breath": {
    "name": "Souffle de givre",
    "description": "Chaque troisième attaque applique du givre pendant 2 tours : la VIT de ton Lovys baisse de 35 %, sans bloquer ses actions."
  },
  "sand_charge": {
    "name": "Frappe des dunes",
    "description": "Cycle de 3 attaques : une attaque normale, une préparation faible, puis une frappe annoncée à 150 %. Les protections et esquives peuvent l’amortir."
  },
  "dream_stance": {
    "name": "Danse des songes",
    "description": "Alter­ne tous les 2 tours : posture défensive (+25 % DEF, -15 % ATQ), puis offensive (-15 % DEF, +15 % ATQ)."
  },
  "storm_charge": {
    "name": "Orage accumulé",
    "description": "Deux attaques chargent la foudre. La troisième décharge frappe à 135 %, puis les charges retombent à zéro."
  },
  "automaton_heat": {
    "name": "Noyau en surchauffe",
    "description": "Deux attaques à 115 %, puis 2 tours de refroidissement : -30 % ATQ et -30 % DEF. Le cycle recommence."
  },
  "origin_phases": {
    "name": "Résonance originelle",
    "description": "À 65 % de PV : +15 % DEF. À 30 % : +12 % ATQ et -10 % DEF. Le gardien annonce aussi une décharge toutes les 4 attaques."
  }
};

// Illustrations détaillées déjà créées et retrouvées ; noms versionnés pour le cache immuable.
const EXISTING_CREATURE_ART={
  tide_1:'/pve/tide/perlune-v489.webp',
  tide_3:'/pve/tide/raie-courants-v489.webp',
  tide_4:'/pve/tide/hippocampe-ecume-v489.webp',
  frost_2:'/pve/frost/renardeau-givre-v489.webp'
};

const expansion = THEMES.map((zone,zi)=>{
  const visual={accent:zone.accent,secondary:zone.secondary,sky:zone.sky,deep:zone.deep,background:`/assets/pve-battle-${zone.key}.webp`};
  const fights=zone.roster.map((entry,i)=>{
    const miniBoss=i===8,finalBoss=i===9,boss=miniBoss||finalBoss;
    const key=`${zone.key}_${finalBoss?'boss':i+1}`;
    const level=Math.round(zone.minLevel+(zone.maxLevel-zone.minLevel)*i/9);
    const stats=balancedStats(level,{position:i,boss,finalBoss,family:entry.family,zoneIndex:zi+3});
    const mechanic=(i===3||i===6||boss)?{key:zone.mechanic,...MECHANICS[zone.mechanic],shieldPercent:finalBoss?14:10}:null;
    // Status mechanics are occasional early in a zone, then guaranteed on its guardians.
    const rewardXp=Math.round(10+level*.72+(i%3));
    return {key,name:entry.name,level,type:entry.type,...stats,power:stats.attack,
      boss,miniBoss,finalBoss,zoneKey:zone.key,recommendedRank:zone.recommendedRank,...(mechanic?{mechanic}:{}),
      visual:{zone:zone.key,family:entry.family,index:i,glow:zone.accent,size:finalBoss?1.25:miniBoss?1.10:.78+i*.035,image:EXISTING_CREATURE_ART[key]||`/pve/${zone.key}/${i+1}.webp?v=490`},
      rewards:{creatureXp:boss?Math.round(rewardXp*(finalBoss?1.9:1.4)):rewardXp,globalXp:Math.round((5+level*.25)*(finalBoss?1.7:miniBoss?1.3:1)),fragments:finalBoss?6:miniBoss?3:zi>=4?2:1}};
  });
  return {key:zone.key,name:zone.name,icon:zone.icon,lore:zone.lore,danger:zone.danger,recommendedRank:zone.recommendedRank,minLevel:zone.minLevel,maxLevel:zone.maxLevel,visual,fights};
});

// Each zone returns 40% of its recommended-level XP span. Guardians take
// larger shares without letting the last zones fund the next zone outright.
let cumulativeBudget=0,roundedBudget=0;
export const PVE_ZONES=[...legacy,...expansion].map(zone=>{
  cumulativeBudget+=(lovysThresholdForLevel(zone.fights.at(-1).level)-lovysThresholdForLevel(zone.fights[0].level))*.4;
  const nextBudget=Math.round(cumulativeBudget),budget=nextBudget-roundedBudget;
  roundedBudget=nextBudget;
  const weights=zone.fights.map(f=>f.finalBoss?3:f.miniBoss?2:1);
  const weightTotal=weights.reduce((sum,n)=>sum+n,0);
  let assigned=0,cumulativeWeight=0;
  const fights=zone.fights.map((fight,index)=>{
    cumulativeWeight+=weights[index];
    const cumulative=Math.round(budget*cumulativeWeight/weightTotal),creatureXp=cumulative-assigned;
    assigned=cumulative;
    return {...fight,rewards:{...fight.rewards,creatureXp}};
  });
  return {...zone,fights};
});
export const PVE_FIGHTS=PVE_ZONES.flatMap(zone=>zone.fights.map((fight,index)=>({...fight,zoneKey:zone.key,zoneName:zone.name,zoneIcon:zone.icon,index})));
const byKey=new Map(PVE_FIGHTS.map(fight=>[fight.key,fight]));
const previousByKey=new Map(PVE_FIGHTS.map((fight,index)=>[fight.key,PVE_FIGHTS[index-1]||null]));
export const pveFightByKey=key=>byKey.get(key)||null;
export const pvePreviousFight=key=>previousByKey.get(key)||null;
