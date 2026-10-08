let me = null;
let desktopAdminAuthorized = false;
let desktopAdminOrigin = null;
let desktopAdminPreviousOverflow = '';
const desktopAdminLayoutOrigins = new Map();
let desktopTrackerButtonMarkup = null;
const DESKTOP_ADMIN_PAGES = {
  adminDashboardButton:'adminDashboardModal', adminPlayersButton:'adminPlayersModal',
  adminEconomyButton:'adminEconomyModal', adminTrackerButton:'adminTrackerModal',
  trackerDetectedButton:'trackerDetectedModal', adminHistoryButton:'adminHistoryModal',
  eventsButton:'eventsModal'
};
let desktopAdminConfirmationCancel = null;
let desktopActionSuccessTimer = null;
let dailyChallengesData = null;
let dailyCarouselIndex = 0;
let dailyCarouselTimer = null;
let dailyCarouselPaused = false;
let rewardWheelData = null;
let rewardWheelType = 'daily';
let rewardWheelSpinning = false;
let rewardWheelRotation = 0;
let rewardWheelCountdownTimer = null;
let shouldShowGameIntro = false;
let shouldShowCommunityIntro = false;
let communityGuideStepIndex = 0;
let communityGuidePreviousFocus = null;
let latestPveData = null;
let tutorialStepIndex = 0;
let deferredPwaInstallPrompt = null;

const $ = id => document.getElementById(id);

const authOverlay = $('authOverlay');
const authHome = document.querySelector('.auth-home');
const registerScreen = $('registerScreen');
const loginScreen = $('loginScreen');
const twitchScreen = $('twitchScreen');
const registerForm = $('registerForm');
const loginForm = $('loginForm');
const registerError = $('registerError');
const loginError = $('loginError');

// Afficher / masquer le mot de passe sur les écrans d'inscription et de connexion.
document.querySelectorAll('.password-toggle').forEach(button => {
  button.addEventListener('click', () => {
    const input = $(button.dataset.passwordTarget);
    if (!input) return;

    const showPassword = input.type === 'password';
    input.type = showPassword ? 'text' : 'password';
    button.setAttribute('aria-pressed', String(showPassword));
    button.setAttribute('aria-label', showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe');
    button.setAttribute('title', showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe');
  });
});

const loadingScreen = $('loadingScreen');
  
const successScreen = $('successScreen');
const successTitle = $('successTitle');
const successMessage = $('successMessage');
const successAction = $('successAction');

let successCallback = null;

const homeMonsters = [
  { id:'water', name:'Nyméa', type:'Abyssal', rarity:'Commun', chance:'17,5 %', image:'/Nymea.webp', glow:'rgba(61,174,255,.30)', description:'Un Lovys aquatique vif qui maîtrise bulles, vagues et éclats d’eau.' },
  { id:'plant', name:'Mossy', type:'Verdance', rarity:'Commun', chance:'17,5 %', image:'/Mossy.webp', glow:'rgba(84,210,126,.28)', description:'Un compagnon de la forêt qui puise sa force dans la nature.' },
  { id:'lightning', name:'Voltis', type:'Foudre', rarity:'Commun', chance:'17,5 %', image:'/Voltis.webp', glow:'rgba(255,220,70,.30)', description:'Un petit Lovys vif chargé d’une énergie électrique.' },
  { id:'mist', name:'Brumee', type:'Brume', rarity:'Commun', chance:'17,5 %', image:'/Brumee.webp', glow:'rgba(190,200,230,.25)', description:'Un Lovys léger et mystérieux enveloppée de brume magique.' },
  { id:'fire', name:'Flamby', type:'Cendre', rarity:'Rare', chance:'8 %', image:'/Flamby.webp', glow:'rgba(255,123,58,.30)', description:'Un petit compagnon ardent qui transforme chaque combat en étincelles.' },
  { id:'crystal', name:'Crysal', type:'Cristal', rarity:'Rare', chance:'7 %', image:'/Crysal.webp', glow:'rgba(120,230,255,.28)', description:'Un Lovys lumineux dont le corps semble taillé dans le cristal.' },
  { id:'forge', name:'Ferox', type:'Forge', rarity:'Rare', chance:'7 %', image:'/Ferox.webp', glow:'rgba(255,140,70,.28)', description:'Un Lovys robuste marqué par le métal et la chaleur de la forge.' },
  { id:'dark', name:'Nocty', type:'Néant', rarity:'Épique', chance:'3,5 %', image:'/Nocty.webp', glow:'rgba(160,89,255,.32)', description:'Un petit Lovys lunaire entouré d’une énergie mystérieuse.' },
  { id:'solar', name:'Solka', type:'Solaire', rarity:'Épique', chance:'3,5 %', image:'/Solka.webp', glow:'rgba(255,210,80,.30)', description:'Un Lovys rayonnant imprégné d’une énergie solaire.' },
  { id:'dream', name:'Mimo', type:'Mirage', rarity:'Mythique', chance:'1 %', image:'/Mimo.webp', glow:'rgba(255,126,218,.28)', description:'Un compagnon onirique qui combat avec une magie douce et lumineuse.' }
];
let homeMonsterIndex = 0;

function renderHomeMonster() {
  const monster = homeMonsters[homeMonsterIndex];
  const card = $('carouselCard');
  if (!card) return;
  card.style.setProperty('--monster-glow', monster.glow);
  $('carouselMonster').src = monster.image;
  $('carouselMonster').alt = monster.name;
  $('carouselName').textContent = monster.name;
  $('carouselType').textContent = monster.type;
  $('carouselDrop').textContent = `${monster.rarity} • ${monster.chance}`;
  $('carouselDescription').textContent = monster.description;
  document.querySelectorAll('.carousel-dot').forEach((dot, index) => {
    dot.classList.toggle('active', index === homeMonsterIndex);
  });
}

function moveHomeCarousel(direction) {
  homeMonsterIndex = (homeMonsterIndex + direction + homeMonsters.length) % homeMonsters.length;
  renderHomeMonster();
}

const dotsContainer = $('carouselDots');
if (dotsContainer) {
  dotsContainer.innerHTML = homeMonsters.map((monster, index) =>
    `<button class="carousel-dot${index === 0 ? ' active' : ''}" type="button" aria-label="Afficher ${monster.name}" data-index="${index}"></button>`
  ).join('');
  dotsContainer.addEventListener('click', event => {
    const dot = event.target.closest('.carousel-dot');
    if (!dot) return;
    homeMonsterIndex = Number(dot.dataset.index);
    renderHomeMonster();
  });
}
$('carouselPrev')?.addEventListener('click', () => moveHomeCarousel(-1));
$('carouselNext')?.addEventListener('click', () => moveHomeCarousel(1));
  
  const carouselCard = $('carouselCard');

let touchStartX = 0;
let touchEndX = 0;

if (carouselCard) {

  carouselCard.addEventListener('touchstart', event => {
    touchStartX = event.changedTouches[0].screenX;
  }, { passive: true });

  carouselCard.addEventListener('touchend', event => {
    touchEndX = event.changedTouches[0].screenX;

    const swipeDistance = touchEndX - touchStartX;

    // Évite qu'un petit mouvement du doigt change de monstre
    if (Math.abs(swipeDistance) < 50) return;

    // Swipe vers la gauche = monstre suivant
    if (swipeDistance < 0) {
      moveHomeCarousel(1);
    }

    // Swipe vers la droite = monstre précédent
    if (swipeDistance > 0) {
      moveHomeCarousel(-1);
    }
  }, { passive: true });

}
renderHomeMonster();

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function creatureById(id) {
  return me?.creatures?.find(c => c.id === id);
}

function resolveLovysEntry(id) {
  if (!id) return null;
  const direct = creatureById(id);
  if (direct) return direct;

  const aliasMap = { lightning:'voltis', mist:'brumee', crystal:'crysal', forge:'ferox', voltis:'lightning', brumee:'mist', crysal:'crystal', ferox:'forge' };
  const alias = aliasMap[id];
  if (alias) {
    const fromCreatures = creatureById(alias);
    if (fromCreatures) return fromCreatures;
  }

  const catalog = homeMonsters.find(monster => monster.id === id || monster.id === alias);
  if (catalog) return catalog;

  return null;
}

function artForLovys(id, evo = 0, small = true) {
  if (!id) return '<div class="lovys-home-egg-visual" aria-hidden="true"><div class="egg-aura"></div><div class="egg-shell"></div><div class="egg-sparkles"></div></div>';
  const aliasMap = { lightning:'voltis', mist:'brumee', crystal:'crysal', forge:'ferox' };
  return art(id, evo, small) || art(aliasMap[id], evo, small) || '<div class="lovys-home-egg-icon">🐉</div>';
}

function buildPveDesktopSummary(pveData) {
  if (!pveData || !Array.isArray(pveData.zones)) {
    return {
      kicker:'Prêt pour le combat',
      title:'Mode aventure disponible',
      subline:'Ouvre l’aventure PvE pour choisir un adversaire.',
      note:'Utilise le bouton Combattre pour voir les zones, les niveaux conseillés et les récompenses de première victoire.',
      reward:'',
      stats:[
        { label:'Fragments', value:`${Number(me?.user?.egg_fragments || 0)}`, sub:'À dépenser pour l’incubation' },
        { label:'État', value:'Prêt', sub:'Ton Lovys peut partir à l’aventure' }
      ]
    };
  }

  const zones = pveData.zones || [];
  const unlockedZones = zones.filter(zone => Array.isArray(zone.fights) && zone.fights.some(fight => fight.unlocked));
  let nextZone = null;
  let nextFight = null;
  for (const zone of unlockedZones) {
    const fight = zone.fights.find(item => item.unlocked && !item.won) || zone.fights.find(item => item.unlocked);
    if (fight) {
      nextZone = zone;
      nextFight = fight;
      break;
    }
  }

  const totalUnlocked = unlockedZones.reduce((count, zone) => count + zone.fights.filter(fight => fight.unlocked).length, 0);
  const totalWon = zones.reduce((count, zone) => count + zone.fights.filter(fight => fight.won).length, 0);

  if (!nextZone || !nextFight) {
    return {
      kicker:'Aventure terminée',
      title:'Toutes les zones débloquées sont terminées',
      subline:'Tu peux rejouer des combats ou attendre de nouveaux paliers.',
      note:'Toutes les récompenses de première victoire disponibles ont été récupérées.',
      reward:'',
      stats:[
        { label:'Combats gagnés', value:`${totalWon}`, sub:'Succès PvE enregistrés' },
        { label:'Fragments', value:`${Number(pveData.eggFragments || 0)}`, sub:'Fragments d’œuf en poche' }
      ]
    };
  }

  const rewards = nextFight.rewards || {};
  return {
    kicker:'Prochain combat',
    title:`${nextZone.icon || '⚔️'} ${nextFight.boss ? 'Boss · ' : ''}${nextFight.name}`,
    subline:`${nextZone.name} · Niv. conseillé ${nextFight.level} · ${nextFight.type}`,
    note:`${totalWon} combat(s) gagné(s) • ${Math.max(0, totalUnlocked - totalWon)} défi(s) encore disponibles.`,
    reward:`1re victoire : +${Number(rewards.creatureXp || 0)} XP Lovys · +${Number(rewards.globalXp || 0)} XP globale · +${Number(rewards.fragments || 0)} fragment(s)`,
    stats:[
      { label:'Puissance conseillée', value:`Niv. ${nextFight.level}`, sub:`${nextFight.type} · ❤️ ${nextFight.hp}` },
      { label:'Fragments', value:`${Number(pveData.eggFragments || 0)}`, sub:'Récompenses d’incubation' }
    ]
  };
}

function desktopPveRouteMarkup(pveData){
  const zones=pveData?.zones||[];
  let zone=zones.find(z=>(z.fights||[]).some(f=>f.unlocked&&!f.won));
  if(!zone) zone=[...zones].reverse().find(z=>(z.fights||[]).some(f=>f.unlocked||f.won))||zones[0];
  if(!zone) return '';
  const fights=zone.fights||[];
  const current=fights.find(f=>f.unlocked&&!f.won)||[...fights].reverse().find(f=>f.won)||fights[0];
  const nodes=fights.map((f,i)=>{const cls=f.won?'won':(f.key===current?.key?'current':(!f.unlocked?'locked':''));const boss=f.boss?' boss':'';return `<div class="pc-pve-node ${cls}${boss}" title="${escapeHtml(f.name||'Combat')}">${f.won?'✓':f.boss?'♛':i+1}</div>`}).join('');
  const rw=current?.rewards||{};
  const enemyCfg=current?pveEnemyVisual(current):null;const enemyThumb=enemyCfg?.image?`<div class="pc-pve-enemy-thumb"><img loading="lazy" decoding="async" src="${enemyCfg.image}" alt=""></div>`:'';
  return `<div class="pc-pve-zone-card"><div class="pc-pve-zone-top"><div><div class="pc-pve-zone-label">${zone.icon||'🗺️'} Zone actuelle</div><div class="pc-pve-zone-title">${escapeHtml(zone.name||'Aventure')}</div><div class="pc-pve-zone-meta">Progression vers le boss</div></div><button class="pc-pve-fragments" data-open-fragment-shop type="button" title="Ouvrir la boutique de fragments"><b>${fragmentIconMarkup('fragment-inline-icon fragment-inline-icon-lg')} ${Number(pveData?.eggFragments||0)}</b><span>Fragments</span></button></div><div class="pc-pve-route-head"><span>Progression de la zone</span><b>${fights.filter(f=>f.won).length} / ${fights.length}</b></div><div class="pc-pve-route">${nodes}</div><div class="pc-pve-current"><div class="pc-pve-next-badge">⚔️ Prochain combat</div>${enemyThumb}<div class="pc-pve-current-copy"><div class="pc-pve-current-name">${current?.boss?'👑 ': ''}${escapeHtml(current?.name||'Prochain combat')}</div><div class="pc-pve-current-sub"><span>${escapeHtml(current?.type||'')}</span><span>❤️ ${Number(current?.hp||0)}</span><span>⚔️ ${Number(current?.power||0)}</span></div><div class="pc-pve-reward">1re victoire : +${Number(rw.creatureXp||0)} XP Lovys · +${Number(rw.globalXp||0)} XP globale · +${Number(rw.fragments||0)} fragment(s)</div></div><div class="pc-pve-level"><span>Niveau conseillé</span><b>${Number(current?.level||1)}</b></div></div></div>`;
}
function eggIconMarkup(cls='egg-inline-icon'){return `<span class="${cls}" aria-hidden="true"></span>`;}
function fragmentIconMarkup(cls='fragment-inline-icon'){return `<span class="${cls}" aria-hidden="true"></span>`;}
function setHubFragmentsButton(fragments){const btn=$('hubFragments');if(!btn)return;const n=Math.max(0,Number(fragments||0));btn.innerHTML=`<span class="fragment-pill-value">${fragmentIconMarkup('fragment-inline-icon fragment-inline-icon-lg')}${n}</span><span class="fragment-pill-label">Fragment${n>1?'s':''} d’œuf</span>`;}
function renderDesktopLovysHub(pveData = null) {
  const overview = $('desktopLovysOverview');
  const pveState = $('desktopLovysPveState');
  if (!overview || !pveState || !me?.user) return;

  const user = me.user;
  const fragments = Number((pveData && pveData.eggFragments) ?? user.egg_fragments ?? 0);
  setHubFragmentsButton(fragments);

  if (user.creature_id) {
    const creature = resolveLovysEntry(user.creature_id) || {};
    const progress = user.progression || {};
    const currentThreshold = Number(progress.currentThreshold || 0);
    const nextThreshold = Number(progress.nextThreshold || currentThreshold + 1);
    const totalXp = Math.max(0, Number(user.xp || 0));
    const earnedInLevel = progress.maxLevel ? totalXp : Math.max(0, Math.floor(totalXp - currentThreshold));
    const neededForLevel = progress.maxLevel ? 0 : Math.max(1, Math.ceil(nextThreshold - currentThreshold));
    const percent = progress.maxLevel ? 100 : Math.max(0, Math.min(100, ((totalXp - currentThreshold) / Math.max(1, nextThreshold - currentThreshold)) * 100));
    const type = creature.type || progress.evolutionName || 'Compagnon';
    const rarity = creature.rarity || 'Lovys';
    const name = creature.name || 'Lovys';
    const desc = creature.description || 'Ton Lovys est prêt à partir en aventure. Continue de le faire progresser pendant les lives et en PvE.';
    const level = Number(progress.level || 1);
    const evolutionName = progress.evolutionName || 'Forme active';
    const watchedMinutes = Math.floor(Number(user.watch_seconds || 0) / 60);
    const cash = Math.floor(Number(user.points || 0));

    overview.innerHTML = `
      <div class="lovys-home-artbox">${artForLovys(user.creature_id, progress.evolution || 0, true)}</div>
      <div class="lovys-home-copy">
        <div class="lovys-home-name">${escapeHtml(name)}</div>
        <div class="lovys-home-statusline">Lovys actif · niveau ${level}</div>
        <div class="lovys-home-meta">
          <span class="lovys-pill is-accent">${escapeHtml(type)}</span>
          <span class="lovys-pill">${escapeHtml(rarity)}</span>
          <span class="lovys-pill">✨ ${escapeHtml(evolutionName)}</span>
        </div>
        <div class="lovys-home-desc">${escapeHtml(desc)}</div>
        <div class="lovys-home-track">
          <div class="lovys-home-track-top"><span>XP du Lovys</span><span>${progress.maxLevel ? 'Niveau max' : `${earnedInLevel.toLocaleString('fr-FR')} / ${neededForLevel.toLocaleString('fr-FR')} XP`}</span></div>
          <div class="lovys-home-track-bar"><span style="width:${percent}%"></span></div>
          <div class="lovys-home-note">${progress.maxLevel ? 'Le niveau maximum est atteint, mais ton XP continue d’être enregistrée.' : `Encore ${Math.max(0, neededForLevel - earnedInLevel).toLocaleString('fr-FR')} XP pour le niveau suivant.`}</div>
        </div>
        <div class="lovys-home-stats">
          <div class="lovys-home-stat"><div class="lovys-home-stat-label">Compte</div><div class="lovys-home-stat-value">Niv. ${Number(user.global_progression?.level || 1)}</div><div class="lovys-home-stat-sub">${escapeHtml(user.global_grade?.name || 'Recrue')}</div></div>
          <div class="lovys-home-stat"><div class="lovys-home-stat-label">Temps live</div><div class="lovys-home-stat-value">${watchedMinutes}</div><div class="lovys-home-stat-sub">minutes regardées</div></div>
          <div class="lovys-home-stat"><div class="lovys-home-stat-label">LoVeR'Cash</div><div class="lovys-home-stat-value">${cash}</div><div class="lovys-home-stat-sub">solde actuel</div></div>
        </div>
      </div>`;

    const summary = buildPveDesktopSummary(pveData);
    const statsHtml = (summary.stats || []).map(item => `
      <div class="lovys-pve-stat">
        <div class="lovys-pve-stat-label">${escapeHtml(item.label || '')}</div>
        <div class="lovys-pve-stat-value">${escapeHtml(item.value || '')}</div>
        <div class="lovys-pve-stat-sub">${escapeHtml(item.sub || '')}</div>
      </div>`).join('');

    pveState.innerHTML = pveData
      ? desktopPveRouteMarkup(pveData)
      : `<div class="pc-pve-zone-card"><div class="pc-pve-zone-label">⚔️ Aventure PvE</div><div class="pc-pve-zone-title">Chargement de l’aventure…</div><div class="pc-pve-zone-meta">Ouvre le PvE pour synchroniser les combats et les récompenses.</div></div>`;

    if ($('openPve')) {
      $('openPve').disabled = false;
      $('openPve').textContent = '⚔️ Combattre';
    }
    return;
  }

  const egg = user.egg || {};
  const progressPct = Math.max(0, Math.min(100, Number(egg.progress || 0)));
  const pendingXp = Math.max(0, Math.floor(Number(user.pending_xp || 0)));
  const remaining = egg.ready ? 'Œuf prêt à éclore' : `Encore ${formatEggTime(egg.remainingSeconds || 0)}`;
  overview.innerHTML = `
    <div class="lovys-home-artbox"><div class="lovys-home-egg-visual" aria-label="Œuf en incubation"><div class="egg-aura"></div><div class="egg-shell"></div><div class="egg-sparkles"></div></div></div>
    <div class="lovys-home-copy">
      <div class="lovys-home-name">Œuf en incubation</div>
      <div class="lovys-home-statusline">Ton prochain Lovys se prépare</div>
      <div class="lovys-home-meta">
        <span class="lovys-pill is-accent">Incubation</span>
        <span class="lovys-pill">${formatEggTime(egg.watchedSeconds || 0)} / 6 h 00</span>
        <span class="lovys-pill">⚡ ${pendingXp.toLocaleString('fr-FR')} XP en attente</span>
      </div>
      <div class="lovys-home-desc">Fais éclore ton œuf pour obtenir ton premier Lovys, puis débloquer les combats PvE et les récompenses liées à l’aventure.</div>
      <div class="lovys-home-track">
        <div class="lovys-home-track-top"><span>Progression de l’incubation</span><span>${Math.round(progressPct)}%</span></div>
        <div class="lovys-home-track-bar"><span style="width:${progressPct}%"></span></div>
        <div class="lovys-home-note">${escapeHtml(remaining)} avant l’éclosion.</div>
      </div>
      <div class="lovys-home-stats">
        <div class="lovys-home-stat"><div class="lovys-home-stat-label">Compte</div><div class="lovys-home-stat-value">Niv. ${Number(user.global_progression?.level || 1)}</div><div class="lovys-home-stat-sub">${escapeHtml(user.global_grade?.name || 'Recrue')}</div></div>
        <div class="lovys-home-stat"><div class="lovys-home-stat-label">Fragments</div><div class="lovys-home-stat-value">${Number(user.egg_fragments || 0)}</div><div class="lovys-home-stat-sub">fragments d’œuf en stock</div></div>
        <div class="lovys-home-stat"><div class="lovys-home-stat-label">LoVeR'Cash</div><div class="lovys-home-stat-value">${Math.floor(Number(user.points || 0))}</div><div class="lovys-home-stat-sub">solde actuel</div></div>
      </div>
    </div>`;

  pveState.innerHTML = `
    <div class="lovys-pve-kicker"><span class="egg-inline-icon" aria-hidden="true"></span> Aventure verrouillée</div>
    <div class="lovys-pve-name">Débloque ton premier Lovys</div>
    <div class="lovys-home-empty-note">Le mode PvE s’ouvrira automatiquement après l’éclosion.</div>
    <div class="lovys-home-empty-helper">Continue à regarder les lives pour compléter les 6 heures d’incubation. Les XP gagnés via les défis seront conservés et ajoutés à ton Lovys au moment de l’éclosion.</div>
    <div class="lovys-home-empty-tag">⚡ ${pendingXp.toLocaleString('fr-FR')} XP en attente</div>
    <div class="lovys-pve-stats">
      <div class="lovys-pve-stat"><div class="lovys-pve-stat-label">Temps restant</div><div class="lovys-pve-stat-value">${egg.ready ? '0 h 00' : escapeHtml(formatEggTime(egg.remainingSeconds || 0))}</div><div class="lovys-pve-stat-sub">avant l’éclosion</div></div>
      <div class="lovys-pve-stat"><div class="lovys-pve-stat-label">Fragments</div><div class="lovys-pve-stat-value">${Number(user.egg_fragments || 0)}</div><div class="lovys-pve-stat-sub">déjà récupérés</div></div>
    </div>`;

  if ($('openPve')) {
    $('openPve').disabled = true;
    $('openPve').textContent = '⚔️ Éclosion requise';
  }
}

async function syncDesktopLovysHub() {
  renderDesktopLovysHub();
  if (!me?.user?.creature_id) return;
  try {
    const response = await fetch('/api/pve', { cache: 'no-store' });
    const data = await response.json();
    if (!response.ok) return;
    latestPveData = data;
    renderDesktopLovysHub(data);
    renderNextActions();
  } catch (error) {
    console.warn('Impossible de synchroniser le panneau Lovys PC :', error);
  }
}

function art(type, evo = 0, small = false) {
  const monsterImages = {
    fire: '/Flamby.webp',
    water: '/Nymea.webp',
    plant: '/Mossy.webp',
    dark: '/Nocty.webp',
    dream: '/Mimo.webp',
    voltis: '/Voltis.webp',
    crysal: '/Crysal.webp',
    brumee: '/Brumee.webp',
    solka: '/Solka.webp',
    ferox: '/Ferox.webp'
  };

  const monsterNames = {
    fire: 'Flamby',
    water: 'Nyméa',
    plant: 'Mossy',
    dark: 'Nocty',
    dream: 'Mimo',
    voltis: 'Voltis',
    crysal: 'Crysal',
    brumee: 'Brumee',
    solka: 'Solka',
    ferox: 'Ferox'
  };

  const image = monsterImages[type];
  if (!image) return '';

  return `
    <img loading="lazy" decoding="async"
      src="${image}"
      alt="${monsterNames[type]}"
      class="${small ? 'monster-image-small' : 'monster-image'}"
      onerror="this.style.display='none';this.nextElementSibling.style.display='flex'"
    >
    <div class="monster-placeholder">Image de ${monsterNames[type]}<br>à ajouter</div>
  `;
}
  
function showLoading(
  title = 'Connexion en cours...',
  message = 'Vérification de ton compte'
) {

  $('loadingTitle').textContent = title;
  $('loadingMessage').textContent = message;

  authOverlay.classList.remove('hidden');

  authHome.style.display = 'none';

  registerScreen.classList.add('hidden');
  loginScreen.classList.add('hidden');
  twitchScreen.classList.add('hidden');
  successScreen.classList.add('hidden');

  loadingScreen.classList.remove('hidden');

  document.body.classList.add('auth-locked');
}


function hideLoading() {
  loadingScreen.classList.add('hidden');
}
  
function showSuccess(title, message, buttonText, callback) {

  successTitle.textContent = title;
  successMessage.textContent = message;
  successAction.textContent = buttonText;

  successCallback = callback;

  authOverlay.classList.remove('hidden');

  authHome.style.display = 'none';

  registerScreen.classList.add('hidden');
  loginScreen.classList.add('hidden');
  twitchScreen.classList.add('hidden');

  successScreen.classList.remove('hidden');

  document.body.classList.add('auth-locked');
}
  successAction.addEventListener('click', async () => {

  successScreen.classList.add('hidden');

  const callback = successCallback;
  successCallback = null;

  if (callback) {
    await callback();
  }

});
  
function showAuthHome() {
  setDesktopAdminAccess(false);
  desktopActiveBoosts={};desktopBoostNotice=null;renderDesktopBoostStatus();
  authOverlay.classList.remove('hidden');
  authHome.style.display = 'flex';
  
  registerScreen.classList.add('hidden');
  loginScreen.classList.add('hidden');
  twitchScreen.classList.add('hidden');
  successScreen.classList.add('hidden');
  loadingScreen.classList.add('hidden');
  
  document.body.classList.add('auth-locked');
}

function showTwitchLink(message = 'Ton compte est connecté. Il reste à lier ton compte Twitch pour continuer.') {
  $('twitchMessage').textContent = message;
  authOverlay.classList.remove('hidden');
  authHome.style.display = 'none';
  registerScreen.classList.add('hidden');
  loginScreen.classList.add('hidden');
  twitchScreen.classList.remove('hidden');
  document.body.classList.add('auth-locked');
}

function showGame() {
  authOverlay.classList.add('hidden');
  twitchScreen.classList.add('hidden');
  document.body.classList.remove('auth-locked');
  if(isDesktopGameUi()) {refreshDesktopAdminAccess();refreshDesktopBoostStatus();refreshDesktopHomeLiveStatus();}
}

async function refreshAccountState() {
  try {
    const response = await fetch('/api/account/me', { cache: 'no-store' });
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Impossible de charger le compte.');
    }
    setDesktopAdminAccess(Boolean(data.authenticated && data.account?.isBroadcaster));

    if (!data.authenticated) {
      showAuthHome();
      return;
    }

    // Un compte peut avoir twitch_id en base mais pas encore de session jeu
    // (ex. nouvelle connexion sur un autre navigateur). Le serveur restaure
    // désormais automatiquement cette session via gameReady.
    if (!data.account.twitchConnected || !data.account.gameReady) {
      showTwitchLink();
      return;
    }

    shouldShowGameIntro = Boolean(data.account.showGameIntro);
    shouldShowCommunityIntro = Boolean(data.account.showCommunityIntro);

    showGame();
    await loadGame();

  } catch (error) {
    console.error('Erreur état compte :', error);
    showAuthHome();
  }
}

function syncTopDashboardHeights() {
  // L’incubateur occupe sa propre ligne : aucune hauteur forcée.
  const incubator = document.querySelector('.incubator-topbar');
  if (incubator) { incubator.style.height = ''; incubator.style.minHeight = ''; }

  // V94 — PC : le bloc Défis du jour se termine exactement au même niveau
  // que l’ensemble Carte joueur + Portefeuille à gauche.
  const leftStack = document.querySelector('.dashboard-left-stack');
  const dailyCard = document.querySelector('.dashboard-side-stack .daily-challenges-card');
  if (dailyCard) {
    if (window.matchMedia('(min-width:1181px)').matches && leftStack) {
      const leftStyles = window.getComputedStyle(leftStack);
      const topPadding = parseFloat(leftStyles.paddingTop || '0') || 0;
      const targetHeight = Math.max(0, leftStack.getBoundingClientRect().height - topPadding);
      dailyCard.style.setProperty('height', `${Math.round(targetHeight)}px`, 'important');
      dailyCard.style.setProperty('min-height', `${Math.round(targetHeight)}px`, 'important');
      dailyCard.style.setProperty('max-height', `${Math.round(targetHeight)}px`, 'important');
    } else {
      dailyCard.style.removeProperty('height');
      dailyCard.style.removeProperty('min-height');
      dailyCard.style.removeProperty('max-height');
    }
  }
}

function scheduleTopDashboardSync() {
  window.requestAnimationFrame(syncTopDashboardHeights);
}

let topDashboardResizeObserver = null;
function setupTopDashboardSync() {
  if (topDashboardResizeObserver || !window.ResizeObserver) return;

  const leftStack = document.querySelector('.dashboard-left-stack');
  if (!leftStack) return;

  topDashboardResizeObserver = new ResizeObserver(() => {
    scheduleTopDashboardSync();
  });
  topDashboardResizeObserver.observe(leftStack);
}

function setDailyChallengeMessage(message = '', type = '') {
  const el = $('dailyChallengesMessage');
  if (!el) return;
  el.textContent = message;
  el.className = `daily-challenges-message${type ? ` ${type}` : ''}`;
}

function formatDailyChallengeProgress(challenge) {
  if (challenge.type === 'watch') {
    const current = Math.min(Number(challenge.progress || 0), Number(challenge.goal || 0));
    const goal = Number(challenge.goal || 0);
    const cm = Math.floor(current / 60);
    const gm = Math.floor(goal / 60);
    return `${cm} / ${gm} min`;
  }
  if (challenge.type === 'cash') return `${Math.floor(Number(challenge.progress || 0))} / ${Math.floor(Number(challenge.goal || 0))} LoVeR'Cash`;
  if (challenge.type === 'global_xp') return `${Math.floor(Number(challenge.progress || 0))} / ${Math.floor(Number(challenge.goal || 0))} XP`;
  return challenge.completed ? 'Terminé' : 'En cours';
}


/* V97 — PC : les 3 défis restent fixes. Ne pas appliquer carousel-active,
   car cette classe possède un fond générique prioritaire qui masque les fonds illustrés. */
function isDesktopDailyCarousel() { return false; }
function applyDailyCarouselState() {
  const cards = Array.from(document.querySelectorAll('#dailyChallengesGrid .daily-challenge'));
  if (!cards.length) return;
  cards.forEach(card => card.classList.remove('carousel-active'));
  if ($('dailyCarouselPosition')) $('dailyCarouselPosition').textContent = '';
}
function moveDailyCarousel() { applyDailyCarouselState(); }
function restartDailyCarousel() {
  if (dailyCarouselTimer) clearInterval(dailyCarouselTimer);
  dailyCarouselTimer = null;
  dailyCarouselPaused = false;
}

function renderDailyChallenges() {
  const grid = $('dailyChallengesGrid');
  const summary = $('dailyChallengesSummary');
  if (!grid || !summary) return;

  const challenges = dailyChallengesData?.challenges || [];
  if (!challenges.length) {
    summary.textContent = 'Aucun défi disponible pour le moment.';
    grid.innerHTML = '';
    return;
  }

  const claimed = challenges.filter(item => item.claimed).length;
  const completed = challenges.filter(item => item.completed).length;
  summary.textContent = `${completed}/3 terminés · ${claimed}/3 récompenses récupérées`;
  if ($('dailyChallengesReset')) $('dailyChallengesReset').textContent = 'Renouvellement à 00h00 · heure de Paris';

  grid.innerHTML = challenges.map(challenge => {
    const goal = Math.max(1, Number(challenge.goal || 1));
    const progress = Math.max(0, Math.min(goal, Number(challenge.progress || 0)));
    const pct = Math.max(0, Math.min(100, (progress / goal) * 100));
    const rewards = `${Number(challenge.rewardCash || 0) > 0 ? `<span class="daily-reward-pill cash">💰 +${Number(challenge.rewardCash)} LoVeR'Cash</span>` : ''}${Number(challenge.rewardGlobalXp || 0) > 0 ? `<span class="daily-reward-pill">⭐ +${Number(challenge.rewardGlobalXp)} XP globale</span>` : ''}${Number(challenge.rewardLovysXp || 0) > 0 ? `<span class="daily-reward-pill">🐉 +${Number(challenge.rewardLovysXp)} XP Lovys</span>` : ''}`;

    let actions = '';
    if (challenge.claimed) {
      actions = `<span class="daily-challenge-status">✓ Récompense récupérée</span>`;
    } else if (challenge.completed) {
      actions = `<button class="daily-challenge-button" type="button" data-daily-claim="${escapeHtml(challenge.key)}">🎁 Réclamer</button>`;
    } else {
      actions = `<button class="daily-challenge-button" type="button" disabled>En cours</button>`;
    }

    const visualClass = ({
      watch_30:'daily-challenge-watch-30',
      watch_60:'daily-challenge-watch-60',
      watch_120:'daily-challenge-watch-120',
      global_xp_25:'daily-challenge-global-xp',
      cash_10:'daily-challenge-cash'
    })[String(challenge.key || '')] || '';

    return `<article class="daily-challenge ${visualClass}${challenge.completed ? ' complete' : ''}${challenge.claimed ? ' claimed' : ''}" data-daily-detail="${escapeHtml(challenge.key)}">
      <div class="daily-challenge-top">
        <div class="daily-challenge-icon">${escapeHtml(challenge.icon || '🎯')}</div>
        <div><div class="daily-challenge-title">${escapeHtml(challenge.title || 'Défi')}</div><div class="daily-challenge-desc">${escapeHtml(challenge.description || '')}</div></div>
      </div>
      <div class="daily-challenge-rewards">${rewards}</div>
      <div class="daily-challenge-progress"><span style="width:${pct}%"></span></div>
      <div class="daily-challenge-progress-text"><span>${escapeHtml(formatDailyChallengeProgress(challenge))}</span><span>${challenge.completed ? 'Terminé' : 'En cours'}</span></div>
      <div class="daily-challenge-actions">${actions}</div>
    </article>`;
  }).join('');
  applyDailyCarouselState();
  restartDailyCarousel();
}

function getDailyChallengeByKey(challengeKey) {
  return (dailyChallengesData?.challenges || []).find(challenge => String(challenge.key || '') === String(challengeKey || '')) || null;
}
function closeDailyChallengeDetail() { $('dailyChallengeDetailModal')?.classList.add('hidden'); }
function setDailyChallengeDetailBackground(challengeKey) {
  const panel = $('dailyChallengeDetailPanel');
  if (!panel) return;
  const image = ({
    watch_30:'daily-challenge-watch-30.webp',
    watch_60:'daily-challenge-watch-60.webp',
    watch_120:'daily-challenge-watch-120.webp',
    global_xp_25:'daily-challenge-global-xp.webp',
    cash_10:'daily-challenge-cash.webp'
  })[String(challengeKey || '')] || '';
  if (image) {
    panel.style.setProperty('--daily-detail-bg', `url('${image}')`);
    panel.classList.add('has-challenge-bg');
  } else {
    panel.style.removeProperty('--daily-detail-bg');
    panel.classList.remove('has-challenge-bg');
  }
}
function renderDailyChallengeDetail(challengeKey) {
  const challenge = getDailyChallengeByKey(challengeKey);
  if (!challenge) return;
  setDailyChallengeDetailBackground(challenge.key);
  const goal = Math.max(1, Number(challenge.goal || 1));
  const progress = Math.max(0, Math.min(goal, Number(challenge.progress || 0)));
  const pct = Math.max(0, Math.min(100, (progress / goal) * 100));
  const rewards = `${Number(challenge.rewardCash || 0) > 0 ? `<span class="daily-reward-pill cash">💰 +${Number(challenge.rewardCash)} LoVeR'Cash</span>` : ''}${Number(challenge.rewardGlobalXp || 0) > 0 ? `<span class="daily-reward-pill">⭐ +${Number(challenge.rewardGlobalXp)} XP globale</span>` : ''}${Number(challenge.rewardLovysXp || 0) > 0 ? `<span class="daily-reward-pill">🐉 +${Number(challenge.rewardLovysXp)} XP Lovys</span>` : ''}`;
  let actions = challenge.claimed ? `<span class="daily-challenge-status">✓ Récompense récupérée</span>` : challenge.completed ? `<button class="daily-challenge-button" type="button" data-daily-claim="${escapeHtml(challenge.key)}">🎁 Réclamer</button>` : `<button class="daily-challenge-button" type="button" disabled>En cours</button>`;
  $('dailyChallengeDetailIcon').textContent = challenge.icon || '🎯';
  $('dailyChallengeDetailTitle').textContent = challenge.title || 'Défi du jour';
  $('dailyChallengeDetailDesc').textContent = challenge.description || '';
  $('dailyChallengeDetailRewards').innerHTML = rewards;
  $('dailyChallengeDetailProgressBar').style.width = `${pct}%`;
  $('dailyChallengeDetailProgressText').textContent = formatDailyChallengeProgress(challenge);
  $('dailyChallengeDetailState').textContent = challenge.completed ? 'Terminé' : 'En cours';
  $('dailyChallengeDetailActions').innerHTML = actions;
  $('dailyChallengeDetailModal')?.classList.remove('hidden');
}

async function loadDailyChallenges() {
  try {
    const response = await fetch('/api/daily-challenges', { cache:'no-store' });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Impossible de charger les défis.');
    dailyChallengesData = data;
    renderDailyChallenges();
    renderNextActions();
  } catch (error) {
    console.error('Erreur défis journaliers :', error);
    if ($('dailyChallengesSummary')) $('dailyChallengesSummary').textContent = 'Impossible de charger les défis du jour.';
  }
}

async function claimDailyChallenge(challengeKey) {
  setDailyChallengeMessage();
  try {
    const response = await fetch('/api/daily-challenges/claim', {
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({ challengeKey })
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Récompense impossible à récupérer.');
    const parts = [];
    if (Number(data.rewardCash || 0) > 0) parts.push(`+${Number(data.rewardCash)} LoVeR'Cash`);
    if (Number(data.rewardGlobalXp || 0) > 0) parts.push(`+${Number(data.rewardGlobalXp)} XP globale`);
    if (Number(data.rewardLovysXp || 0) > 0) parts.push(`+${Number(data.rewardLovysXp)} XP Lovys${data.lovysXpPending ? ' en attente' : ''}`);
    if (Number.isFinite(Number(data.balance))) {
      if (me?.user) me.user.points = Number(data.balance);
      syncLoverCashDisplays({ points:Number(data.balance) });
    }
    setDailyChallengeMessage(`Récompense récupérée : ${parts.join(' · ')}`, 'ok');
    await Promise.all([loadDailyChallenges(), loadGame(), loadLeaderboard()]);
  } catch (error) {
    setDailyChallengeMessage(error.message || 'Récompense impossible à récupérer.', 'error');
  }
}

function syncLoverCashDisplays(user = me?.user) {
  if (!user) return;
  const loverCash = Math.floor(Number(user.points || 0));
  if ($('walletBalance')) $('walletBalance').textContent = loverCash;
  if ($('loverCash')) $('loverCash').textContent = loverCash;
}


function formatWheelCountdown(ms) {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return `${String(h).padStart(2,'0')}h ${String(m).padStart(2,'0')}m ${String(s).padStart(2,'0')}s`;
}
function currentWheelState() { return rewardWheelData?.[rewardWheelType] || null; }
function renderRewardWheel() {
  const card=$('rewardWheelCard'), disc=$('rewardWheelDisc'), spin=$('rewardWheelSpin'), status=$('rewardWheelStatus'), result=$('rewardWheelResult');
  if (!card || !disc || !spin) return;
  const state=currentWheelState();
  card.classList.toggle('weekly-mode', rewardWheelType === 'weekly');
  $('rewardWheelDailyTab')?.classList.toggle('active', rewardWheelType === 'daily');
  $('rewardWheelWeeklyTab')?.classList.toggle('active', rewardWheelType === 'weekly');
  const streak=Number(rewardWheelData?.weekly?.streak || 0), goal=Number(rewardWheelData?.weekly?.goal || 7);
  if ($('rewardWheelStreakText')) $('rewardWheelStreakText').textContent=`${streak} / ${goal}`;
  if ($('rewardWheelStreakDots')) $('rewardWheelStreakDots').innerHTML=Array.from({length:goal},(_,i)=>`<span class="reward-wheel-dot${i<streak?' on':''}${streak>=goal?' ready':''}"></span>`).join('');
  const rewards=state?.rewards || [];
  disc.querySelectorAll('.reward-wheel-label').forEach(el=>el.remove());
  rewards.forEach((reward,index)=>{ const el=document.createElement('span'); el.className='reward-wheel-label'; el.style.setProperty('--a',`${index*45+22.5}deg`); el.textContent=reward.icon||'🎁'; el.title=`${reward.label} · ${reward.chance}%`; disc.appendChild(el); });
  const oddsRows=rewards.map(r=>{ const chance=Math.max(0,Math.min(100,Number(r.chance||0))); return `<div class="reward-wheel-odds-row" style="--drop:${chance}%"><span class="reward-wheel-odds-icon">${escapeHtml(r.icon||'🎁')}</span><span class="reward-wheel-odds-label">${escapeHtml(r.label||'Récompense')}</span><strong class="reward-wheel-odds-chance">${chance}%<small>drop</small></strong></div>`; }).join('');
  if ($('rewardWheelOdds')) $('rewardWheelOdds').innerHTML=oddsRows;
  if ($('rewardWheelOddsPopupList')) $('rewardWheelOddsPopupList').innerHTML=oddsRows;
  $('rewardWheelOddsPopup')?.classList.toggle('weekly',rewardWheelType==='weekly');
  if ($('rewardWheelOddsPopupKicker')) $('rewardWheelOddsPopupKicker').textContent=rewardWheelType==='weekly'?'👑 Roue des 7 lives':'🎡 Roue quotidienne';
  if (rewardWheelSpinning) { spin.disabled=true; spin.textContent='La roue tourne…'; return; }
  const available=Boolean(state?.available);
  spin.disabled=!available;
  spin.textContent=rewardWheelType==='weekly' ? (available?'👑 Lancer la roue 7 lives':'🔒 Roue 7 lives verrouillée') : (available?'🎡 Lancer la roue':'⏳ Déjà lancée');
  if (status) {
    if (rewardWheelType==='weekly') status.textContent=available?'7 lives validés ! Ta roue premium est prête.':`Encore ${Math.max(0,goal-streak)} live${Math.max(0,goal-streak)>1?'s':''} différent${Math.max(0,goal-streak)>1?'s':''} à assister. Ta progression ne se perd pas entre deux lives.`;
    else if (available) status.textContent='Disponible maintenant · 1 lancement toutes les 24 h.';
    else status.textContent='Prochain lancement dans…';
  }
  if (result && !rewardWheelSpinning && !result.dataset.keep) result.textContent='';
  updateRewardWheelCountdown();
}
function updateRewardWheelCountdown() {
  if (rewardWheelType!=='daily' || !rewardWheelData?.daily || rewardWheelData.daily.available) return;
  const target=Date.parse(rewardWheelData.daily.nextSpinAt || '');
  if (!Number.isFinite(target)) return;
  const remaining=target-Date.now();
  if (remaining<=0) { loadRewardWheels(); return; }
  if ($('rewardWheelStatus')) $('rewardWheelStatus').textContent=`Prochain lancement dans ${formatWheelCountdown(remaining)}`;
}
async function loadRewardWheels() {
  try {
    const response=await fetch('/api/reward-wheels',{cache:'no-store'}); const data=await response.json();
    if(!response.ok) throw new Error(data.error||'Impossible de charger les roues.');
    rewardWheelData=data;
    renderNextActions();
    if (data.weekly?.available) rewardWheelType='weekly';
    renderRewardWheel();
    if (rewardWheelCountdownTimer) clearInterval(rewardWheelCountdownTimer);
    rewardWheelCountdownTimer=setInterval(updateRewardWheelCountdown,1000);
  } catch(error) { console.error('Erreur roues :',error); if($('rewardWheelStatus')) $('rewardWheelStatus').textContent='Impossible de charger la roue.'; }
}

function closeRewardWheelWinPopup() {
  const modal=$('rewardWheelWinPopup');
  if(modal) modal.classList.add('hidden');
}
function showRewardWheelWinPopup(reward,wheelType='daily') {
  const modal=$('rewardWheelWinPopup');
  if(!modal) return;
  const jackpot=reward?.key==='mystery_egg';
  modal.classList.toggle('weekly',wheelType==='weekly');
  modal.classList.toggle('jackpot',jackpot);
  if($('rewardWheelWinKicker')) $('rewardWheelWinKicker').textContent=jackpot?'✨ JACKPOT !':(wheelType==='weekly'?'👑 Roue des 7 lives':'🎡 Roue quotidienne');
  if($('rewardWheelWinTitle')) $('rewardWheelWinTitle').textContent=jackpot?'Récompense exceptionnelle !':'Félicitations !';
  if($('rewardWheelWinIcon')) $('rewardWheelWinIcon').textContent=reward?.icon||'🎁';
  if($('rewardWheelWinReward')) $('rewardWheelWinReward').textContent=reward?.label||'Récompense gagnée !';
  if($('rewardWheelWinNote')) $('rewardWheelWinNote').textContent=reward?.key==='mystery_egg'
    ? 'Ton œuf mystère a été ajouté automatiquement à ton inventaire.'
    : 'Ta récompense a été ajoutée automatiquement à ton compte.';
  modal.classList.remove('hidden');
  setTimeout(()=>$('rewardWheelWinOk')?.focus(),60);
}

function openRewardWheelOddsPopup() {
  const modal=$('rewardWheelOddsPopup');
  if(!modal) return;
  modal.classList.toggle('weekly',rewardWheelType==='weekly');
  if($('rewardWheelOddsPopupKicker')) $('rewardWheelOddsPopupKicker').textContent=rewardWheelType==='weekly'?'👑 Roue des 7 lives':'🎡 Roue quotidienne';
  modal.classList.remove('hidden');
  setTimeout(()=>$('rewardWheelOddsPopupClose')?.focus(),50);
}
function closeRewardWheelOddsPopup() { $('rewardWheelOddsPopup')?.classList.add('hidden'); }

async function spinRewardWheel() {
  const state=currentWheelState(); if(rewardWheelSpinning || !state?.available) return;
  const spunWheelType=rewardWheelType;
  rewardWheelSpinning=true;
  const resultEl=$('rewardWheelResult'); if(resultEl){resultEl.textContent='';resultEl.className='reward-wheel-result';resultEl.dataset.keep='';}
  renderRewardWheel();
  try {
    const response=await fetch('/api/reward-wheels/spin',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({wheelType:spunWheelType})});
    const data=await response.json(); if(!response.ok) throw new Error(data.error||'Impossible de lancer la roue.');
    const rewards=state.rewards||[]; const index=Math.max(0,rewards.findIndex(r=>r.key===data.reward?.key));
    const target=rewardWheelRotation + 360*6 + (360 - (index*45+22.5));
    rewardWheelRotation=target;
    if($('rewardWheelDisc')) $('rewardWheelDisc').style.transform=`rotate(${target}deg)`;
    setTimeout(async()=>{
      rewardWheelSpinning=false;
      if(resultEl){ const jackpot=data.reward?.key==='mystery_egg'; resultEl.textContent=`${jackpot?'✨ JACKPOT · ':''}${data.reward?.icon||'🎁'} ${data.reward?.label||'Récompense gagnée !'}`; resultEl.className=`reward-wheel-result${jackpot?' jackpot':''}`; resultEl.dataset.keep='1'; }
      showRewardWheelWinPopup(data.reward,spunWheelType);
      if(data.balances && me?.user){ me.user.points=Number(data.balances.points??me.user.points); me.user.global_xp=Number(data.balances.global_xp??me.user.global_xp); me.user.pending_xp=Number(data.balances.pending_xp??me.user.pending_xp); me.user.egg_fragments=Number(data.balances.egg_fragments??me.user.egg_fragments); syncLoverCashDisplays(me.user); }
      await Promise.all([loadRewardWheels(),loadIncubatorSlots(),syncDesktopLovysHub()]);
      if(resultEl){ resultEl.textContent=`${data.reward?.key==='mystery_egg'?'✨ JACKPOT · ':''}${data.reward?.icon||'🎁'} ${data.reward?.label||'Récompense gagnée !'}`; resultEl.className=`reward-wheel-result${data.reward?.key==='mystery_egg'?' jackpot':''}`; resultEl.dataset.keep='1'; }
    },4500);
  } catch(error) { rewardWheelSpinning=false; if(resultEl){resultEl.textContent=error.message||'Impossible de lancer la roue.';resultEl.dataset.keep='1';} renderRewardWheel(); }
}

async function loadGame() {
  try {
    const response = await fetch('/api/me', { cache: 'no-store' });
    const data = await response.json();

    if (!response.ok || !data.authenticated) {
      $('app').classList.add('hidden');
      return;
    }

    me = data;
    startLiveUpdates();
    refreshDesktopHomeLiveStatus();
    $('app').classList.remove('hidden');
    syncLoverCashDisplays(me.user);
    renderPlayerVisitCard();
    renderPlayerSubscriptionStatus();

    renderGame();
    await loadIncubatorSlots();
    await syncDesktopLovysHub();
    await loadBadges();
    await loadDailyChallenges();
    await loadRewardWheels();
    renderNextActions();
    updatePwaInstallUi();
    setupTopDashboardSync();
    scheduleTopDashboardSync();
  } catch (error) {
    console.error('Erreur chargement jeu :', error);
  }
}

let incubatorData = null;
let selectedIncubatorSlot = null;
let incubatorShopTargetSlot = null;
let incubatorBackdropMouseDown = false;

function incubatorEggMarkup() {
  return `<div class="incubator-slot-egg"><div class="incubator-egg-mini" aria-hidden="true"><div class="egg-aura"></div><div class="egg-shell"></div><div class="egg-sparkles"></div></div></div>`;
}

function incubatorLovysDropsMarkup() {
  return `<div id="incubatorDropPanel" class="incubator-drop-panel">
    <div class="incubator-drop-head"><div class="incubator-drop-title">🎲 Lovys possibles</div><div class="incubator-drop-total">100 % au total</div></div>
    <div class="egg-drop-list">
      <div class="egg-drop-row common"><div class="egg-drop-main"><img loading="lazy" decoding="async" class="egg-drop-thumb" src="/Mossy.webp" alt="Mossy"><span class="egg-drop-name">Mossy · Commun</span></div><b>17,5 %</b></div>
      <div class="egg-drop-row common"><div class="egg-drop-main"><img loading="lazy" decoding="async" class="egg-drop-thumb" src="/Nymea.webp" alt="Nyméa"><span class="egg-drop-name">Nyméa · Commun</span></div><b>17,5 %</b></div>
      <div class="egg-drop-row common"><div class="egg-drop-main"><img loading="lazy" decoding="async" class="egg-drop-thumb" src="/Voltis.webp" alt="Voltis"><span class="egg-drop-name">Voltis · Commun</span></div><b>17,5 %</b></div>
      <div class="egg-drop-row common"><div class="egg-drop-main"><img loading="lazy" decoding="async" class="egg-drop-thumb" src="/Brumee.webp" alt="Brumee"><span class="egg-drop-name">Brumee · Commun</span></div><b>17,5 %</b></div>
      <div class="egg-drop-row rare"><div class="egg-drop-main"><img loading="lazy" decoding="async" class="egg-drop-thumb" src="/Flamby.webp" alt="Flamby"><span class="egg-drop-name">Flamby · Rare</span></div><b>8 %</b></div>
      <div class="egg-drop-row rare"><div class="egg-drop-main"><img loading="lazy" decoding="async" class="egg-drop-thumb" src="/Crysal.webp" alt="Crysal"><span class="egg-drop-name">Crysal · Rare</span></div><b>7 %</b></div>
      <div class="egg-drop-row rare"><div class="egg-drop-main"><img loading="lazy" decoding="async" class="egg-drop-thumb" src="/Ferox.webp" alt="Ferox"><span class="egg-drop-name">Ferox · Rare</span></div><b>7 %</b></div>
      <div class="egg-drop-row epic"><div class="egg-drop-main"><img loading="lazy" decoding="async" class="egg-drop-thumb" src="/Nocty.webp" alt="Nocty"><span class="egg-drop-name">Nocty · Épique</span></div><b>3,5 %</b></div>
      <div class="egg-drop-row epic"><div class="egg-drop-main"><img loading="lazy" decoding="async" class="egg-drop-thumb" src="/Solka.webp" alt="Solka"><span class="egg-drop-name">Solka · Épique</span></div><b>3,5 %</b></div>
      <div class="egg-drop-row mythic"><div class="egg-drop-main"><img loading="lazy" decoding="async" class="egg-drop-thumb" src="/Mimo.webp" alt="Mimo"><span class="egg-drop-name">Mimo · Mythique</span></div><b>1 %</b></div>
    </div>
  </div>`;
}

function bindIncubatorDropToggle() {
  const toggle = $('incubatorDropToggle');
  const panel = $('incubatorDropPanel');
  if (!toggle || !panel) return;
  toggle.addEventListener('click', () => {
    const opening = panel.classList.contains('hidden');
    panel.classList.toggle('hidden', !opening);
    toggle.textContent = opening ? 'Masquer les Lovys possibles' : 'Voir les Lovys possibles';
    toggle.setAttribute('aria-expanded', opening ? 'true' : 'false');
  });
}

function renderIncubatorSlot(slotData) {
  const slot = Number(slotData?.slot || 0);
  const el = slot === 1 ? $('topIncubatorEgg') : $(`topIncubatorSlot${slot}`);
  if (!el) return;
  el.dataset.incubatorSlot = String(slot);
  el.classList.remove('active','empty','extra-egg','ready');

  if (!slotData || slotData.empty) {
    el.classList.add('empty');
    el.innerHTML = `<div class="incubator-slot-plus">＋</div><div class="incubator-slot-title">Emplacement libre</div><div class="incubator-slot-note">${isMobileGameUi() ? 'Toucher' : 'Cliquer'} pour ajouter un œuf</div>`;
    return;
  }

  const progress = Math.max(0, Math.min(100, Number(slotData.progress || 0)));
  const watched = formatEggTime(slotData.watchedSeconds || 0);
  const isStarter = slotData.source === 'starter';
  el.classList.add(isStarter ? 'active' : 'extra-egg');
  if (slotData.ready) el.classList.add('ready');
  const title = slotData.ready ? 'Œuf prêt à éclore' : 'Œuf en incubation';
  const remaining = Math.max(0, Number(incubatorData?.hatchSeconds || 21600) - Number(slotData.watchedSeconds || 0));
  const status = slotData.ready ? '✨ Prêt à éclore !' : `Éclosion dans ${formatEggTime(remaining)}`;
  const pending = isStarter ? `<div class="incubator-pending">⚡ XP en attente : <strong>${Math.max(0, Number(slotData.pendingXp || 0)).toLocaleString('fr-FR')} XP</strong></div>` : '';
  const action = slotData.ready ? '<button class="incubator-card-action hatch" type="button">✨ Faire éclore</button>' : '<button class="incubator-card-action chances" type="button">Chances</button>';
  el.innerHTML = `${incubatorEggMarkup()}<div class="incubator-slot-title">${title}</div><div class="incubator-slot-progress"><div class="incubator-progress-bar" style="width:${progress}%"></div><span class="incubator-progress-percent">${Math.round(progress)} %</span></div><div class="incubator-status">${status}</div><div class="incubator-live-state" data-incubator-live>🟣 Progresse pendant tes heures de présence en live</div>${pending}${action}`;
}

let mobileIncubatorHelpOpen=false;
function renderIncubatorOverview() {
  const box = $('incubatorOverview');
  if (!box || !incubatorData?.slots) return;
  const active = incubatorData.slots.filter(slot => slot && !slot.empty);
  const next = active.filter(slot => !slot.ready).sort((a,b)=>Number(b.watchedSeconds||0)-Number(a.watchedSeconds||0))[0];
  const ready = active.find(slot => slot.ready);
  const remaining = next ? Math.max(0, Number(incubatorData?.hatchSeconds || 21600)-Number(next.watchedSeconds||0)) : 0;
  const available = Math.max(0, Number(incubatorData?.availableEggs || 0));
  box.innerHTML = `<div class="incubator-overview-head"><div><span class="incubator-overview-kicker">INCUBATION</span><h3>${ready ? '✨ Un œuf est prêt à éclore' : next ? `Prochaine éclosion dans ${formatEggTime(remaining)}` : 'Aucune incubation en cours'}</h3><p>${active.length ? 'Tes œufs progressent avec ta présence pendant les lives.' : 'Place un œuf pour commencer une incubation.'}</p></div><div class="incubator-stock">🥚 <strong>${available}</strong> œuf${available>1?'s':''} disponible${available>1?'s':''}</div></div><div class="incubator-info-grid"><div class="incubator-info-card"><strong>🎲 Chances d’obtention</strong><div class="incubator-rarity-line"><span>Commun <b>70 %</b></span><span>Rare <b>22 %</b></span><span>Épique <b>7 %</b></span><span>Mythique <b>1 %</b></span></div><small>Clique sur un œuf en incubation pour voir les Lovys possibles avec leurs pourcentages d’obtention.</small></div><div class="incubator-info-card"><strong>📺 Progression liée au live</strong><p>Le temps d’incubation avance quand ta présence est comptabilisée pendant le live.</p><div id="incubatorGlobalLiveState" class="incubator-global-live">Vérification du statut du live…</div></div></div>`;
  if(isMobileGameUi()){
    const info=box.querySelector('.incubator-info-grid');
    if(info){
      const fold=document.createElement('details');fold.className='mobile-info-fold';
      fold.open=mobileIncubatorHelpOpen;
      fold.innerHTML='<summary>ⓘ Comment ça fonctionne ?</summary>';
      info.replaceWith(fold);fold.appendChild(info);
      fold.addEventListener('toggle',()=>{mobileIncubatorHelpOpen=fold.open;});
    }
  }
}

function renderDesktopHomeLiveStatus(data) {
  if (!isDesktopGameUi()) return;
  const live = typeof data?.live === 'boolean' ? data.live : null;
  const dot = $('desktopHomeLiveDot');
  dot?.classList.toggle('is-live', live === true);
  dot?.classList.toggle('is-offline', live === false);
  if ($('desktopHomeLiveLabel')) $('desktopHomeLiveLabel').textContent = live === null ? 'Statut du live indisponible' : live ? 'En live' : 'Hors ligne';
  const count = data?.gamePlayerCount;
  if ($('desktopHomeGamePlayers')) $('desktopHomeGamePlayers').textContent = Number.isSafeInteger(count) && count >= 0 ? count.toLocaleString('fr-FR') : '—';
  if ($('desktopHomeViewerGroup')) $('desktopHomeViewerGroup').hidden = live !== true;
  const viewers = data?.twitchViewerCount;
  if ($('desktopHomeViewers')) $('desktopHomeViewers').textContent = Number.isSafeInteger(viewers) && viewers >= 0 ? viewers.toLocaleString('fr-FR') : '—';
}

async function refreshDesktopHomeLiveStatus() {
  if (!isDesktopGameUi() || !me?.user) return;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    let response;
    try { response = await fetch('/api/game/live-status', { cache:'no-store', signal:controller.signal }); }
    finally { clearTimeout(timeout); }
    if (!response.ok) throw new Error('Statut indisponible');
    renderDesktopHomeLiveStatus(await response.json());
  } catch { renderDesktopHomeLiveStatus(null); }
}

function renderMobileHomeLiveStatus(data){
  const button=$('mobileHomeLiveStatus');
  if(!button || !isMobileGameUi())return;
  const live=typeof data?.live==='boolean'?data.live:null;
  button.classList.toggle('is-live',live===true);
  button.classList.toggle('is-offline',live===false);
  const gameCount=data?.gamePlayerCount,viewerCount=data?.twitchViewerCount;
  const players=Number.isSafeInteger(gameCount)&&gameCount>=0?gameCount.toLocaleString('fr-FR'):'—';
  const viewers=Number.isSafeInteger(viewerCount)&&viewerCount>=0?viewerCount.toLocaleString('fr-FR'):'—';
  const counts=`${players} joueurs sur le jeu · ${viewers} spectateurs sur Twitch`;
  if($('mobileHomeLiveLabel'))$('mobileHomeLiveLabel').textContent=live===null?'Statut du live indisponible':live?'En live':'Hors ligne';
  if($('mobileHomeLiveAction'))$('mobileHomeLiveAction').textContent=live===true?counts:'Voir la chaîne Twitch';
  button.setAttribute('aria-label',live===true?`LoVeRDoSeTV est en live. ${counts}. Ouvrir la chaîne Twitch.`:live===false?'LoVeRDoSeTV est hors ligne. Voir la chaîne Twitch.':'Voir la chaîne Twitch. Statut du live indisponible.');
}

async function refreshMobileHomeLiveStatus(){
  if(!isMobileGameUi() || !me?.user)return;
  try{
    const response=await fetch('/api/game/live-status',{cache:'no-store'});
    if(!response.ok)throw new Error('Statut indisponible');
    renderMobileHomeLiveStatus(await response.json());
  }catch{renderMobileHomeLiveStatus(null);}
}

async function refreshIncubatorLiveState() {
  try {
    const response = await fetch('/api/lobby', { cache:'no-store' });
    const data = await response.json();
    if (!response.ok) return;
    const live = Boolean(data.live);
    refreshMobileHomeLiveStatus();
    document.querySelectorAll('[data-incubator-live]').forEach(el => {
      el.textContent = live ? '🟢 En progression · Live en cours' : '⏸️ En pause · Reprendra au prochain live';
      el.classList.toggle('is-live', live);
    });
    const global = $('incubatorGlobalLiveState');
    if (global) { global.textContent = live ? '🟢 Live en cours · tes incubations peuvent progresser' : '⏸️ Live hors ligne · reprise au prochain live'; global.classList.toggle('is-live', live); }
  } catch {}
}

function renderIncubatorSlots() {
  if (!incubatorData?.slots) return;
  incubatorData.slots.forEach(renderIncubatorSlot);
  arrangeIncubatorCarousel();
  renderIncubatorOverview();
  refreshIncubatorLiveState();
}

async function loadIncubatorSlots() {
  try {
    const response = await fetch('/api/incubator', { cache:'no-store' });
    const data = await response.json();
    if (!response.ok) return;
    incubatorData = data;
    renderIncubatorSlots();
    renderNextActions();
  } catch (error) {
    console.warn('Impossible de charger les emplacements d’incubation :', error);
  }
}

function closeIncubatorAddModal() {
  $('incubatorAddModal')?.classList.add('hidden');
  selectedIncubatorSlot = null;
}

function openIncubatorAddModal(slot) {
  selectedIncubatorSlot = Number(slot);
  const content = $('incubatorAddContent');
  if (!content) return;
  const available = Math.max(0, Number(incubatorData?.availableEggs || 0));
  $('incubatorAddSubtitle').textContent = `Emplacement ${selectedIncubatorSlot} · choisis un œuf disponible.`;
  if (available > 0) {
    content.innerHTML = `<div class="incubator-add-card"><div class="incubator-add-egg"><div class="incubator-add-egg-visual">${incubatorEggMarkup()}</div><div class="incubator-add-info"><div class="incubator-add-title">Œuf mystère</div><div class="incubator-add-copy">Place cet œuf dans l’incubateur. Il progressera automatiquement pendant tes heures de présence en live, sur PC comme sur mobile.</div><div class="incubator-add-count">${eggIconMarkup()} ${available} disponible${available > 1 ? 's' : ''}</div></div></div><div class="incubator-add-actions"><button id="incubatorPlaceEgg" class="hub-btn" type="button">Placer dans l’emplacement ${selectedIncubatorSlot}</button></div>${incubatorLovysDropsMarkup()}<div id="incubatorAddMessage" class="incubator-add-message"></div></div>`;
    $('incubatorPlaceEgg')?.addEventListener('click', placeEggInSelectedSlot);
  } else {
    if (isDesktopGameUi()) {
      content.innerHTML = `<div class="incubator-add-card"><div class="incubator-add-egg"><div class="incubator-add-egg-visual">${incubatorEggMarkup()}</div><div class="incubator-add-info"><div class="incubator-add-title">Aucun œuf disponible</div><div class="incubator-add-copy">Récupère un œuf dans la boutique, puis reviens le placer dans cet emplacement.</div></div></div><div class="incubator-add-actions"><button id="incubatorOpenEggShop" class="hub-btn" type="button">🥚 Voir les œufs dans la boutique</button></div></div>`;
      $('incubatorOpenEggShop')?.addEventListener('click', async () => {
        closeIncubatorAddModal();
        shopCategory = 'object';
        history.replaceState(null, '', location.pathname + location.search + '#boutique');
        await openDesktopView('shop');
        focusShopItem('mystery_egg');
      });
      $('incubatorAddModal')?.classList.remove('hidden');
      return;
    }
    // Aucun œuf : on reste dans une popup dédiée à l’incubateur au lieu d’envoyer
    // le joueur vers la Boutique complète.
    incubatorShopTargetSlot = selectedIncubatorSlot;
    content.innerHTML = `<div class="incubator-add-card incubator-empty-buy"><div class="incubator-add-egg"><div class="incubator-add-egg-visual">${incubatorEggMarkup()}</div><div class="incubator-add-info"><div class="incubator-add-title">Aucun œuf disponible</div><div class="incubator-add-copy">Tu n’as aucun œuf en stock. Tu peux acheter un Œuf mystère ici puis le placer directement dans cet emplacement.</div></div></div><div class="incubator-add-actions"><button id="incubatorBuyEggHere" class="hub-btn" type="button" disabled>🥚 Acheter un œuf</button></div><div id="incubatorAddMessage" class="incubator-add-message"></div></div>`;
    $('incubatorAddModal')?.classList.remove('hidden');
    prepareIncubatorEggPurchase();
    return;
  }
  $('incubatorAddModal')?.classList.remove('hidden');
}


async function prepareIncubatorEggPurchase() {
  const button = $('incubatorBuyEggHere');
  const message = $('incubatorAddMessage');
  try {
    if (!shopData?.catalog) await loadShop();
    const item = getShopItemByKey('mystery_egg');
    if (!item) throw new Error('Œuf mystère indisponible pour le moment.');
    const price = Number(item.price ?? item.cost ?? 0);
    const balance = Math.max(0, Math.floor(Number(shopData?.balance ?? me?.user?.points ?? 0)));
    const missing = Math.max(0, price - balance);
    if (button) {
      button.disabled = price > 0 && balance < price;
      button.textContent = price > 0 ? `🥚 Acheter · ${price.toLocaleString('fr-FR')} LoVeR’Cash` : '🥚 Acheter un œuf';
      button.title = missing > 0 ? `Il te manque ${missing.toLocaleString('fr-FR')} LoVeR’Cash` : '';
      button.onclick = buyIncubatorEggHere;
    }
  } catch (error) {
    if (message) { message.className='incubator-add-message error'; message.textContent=error.message || 'Impossible de charger l’œuf.'; }
  }
}

async function buyIncubatorEggHere() {
  const button = $('incubatorBuyEggHere');
  const message = $('incubatorAddMessage');
  const slot = Number(incubatorShopTargetSlot || selectedIncubatorSlot || 0);
  if (button) { button.disabled = true; button.textContent = 'Achat en cours…'; }
  if (message) { message.className='incubator-add-message'; message.textContent=''; }
  try {
    const response = await fetch('/api/shop/buy', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ itemKey:'mystery_egg' }) });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Achat impossible.');
    await loadGame();
    await loadIncubatorSlots();
    // Après l’achat, la même popup affiche immédiatement l’œuf disponible
    // et permet de l’incuber sans changer de page.
    openIncubatorAddModal(slot);
  } catch (error) {
    if (message) { message.className='incubator-add-message error'; message.textContent=error.message || 'Achat impossible.'; }
    if (button) { button.disabled=false; button.textContent='🥚 Acheter un œuf'; }
  }
}

async function placeEggInSelectedSlot() {
  if (![1,2,3].includes(Number(selectedIncubatorSlot))) return;
  const button = $('incubatorPlaceEgg');
  const message = $('incubatorAddMessage');
  if (button) button.disabled = true;
  if (message) { message.className='incubator-add-message'; message.textContent='Placement en cours…'; }
  try {
    const response = await fetch('/api/incubator/place', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ slot:selectedIncubatorSlot }) });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Impossible de placer cet œuf.');
    if (message) { message.className='incubator-add-message ok'; message.textContent='Œuf placé dans l’incubateur !'; }
    await loadIncubatorSlots();
    setTimeout(closeIncubatorAddModal, 450);
  } catch (error) {
    if (message) { message.className='incubator-add-message error'; message.textContent=error.message; }
    if (button) button.disabled = false;
  }
}

function openExtraEggInfo(slotData) {
  const content = $('incubatorAddContent');
  if (!content) return;
  selectedIncubatorSlot = Number(slotData.slot);
  $('incubatorAddSubtitle').textContent = `Emplacement ${selectedIncubatorSlot} · œuf en cours d’incubation.`;
  const remaining = Math.max(0, Number(incubatorData?.hatchSeconds || 21600) - Number(slotData.watchedSeconds || 0));
  content.innerHTML = `<div class="incubator-add-card"><div class="incubator-add-egg"><div class="incubator-add-egg-visual">${incubatorEggMarkup()}</div><div class="incubator-add-info"><div class="incubator-add-title">${slotData.ready ? 'Œuf prêt à éclore' : 'Œuf en incubation'}</div><div class="incubator-add-copy">${slotData.ready ? 'Cet œuf a terminé ses 6 heures d’incubation. Fais-le éclore pour ajouter un nouveau Lovys à ta collection.' : `Il reste ${formatEggTime(remaining)} avant que cet œuf soit prêt.`}</div><div class="incubator-add-count">⏱️ ${formatEggTime(slotData.watchedSeconds || 0)} / 6 h 00</div></div></div><div class="incubator-add-actions">${slotData.ready ? `<button id="incubatorHatchExtraEgg" class="hub-btn lovys-hatch-ready" type="button">✨ Faire éclore</button>` : ''}</div>${incubatorLovysDropsMarkup()}<div id="incubatorAddMessage" class="incubator-add-message"></div></div>`;
  $('incubatorHatchExtraEgg')?.addEventListener('click',()=>hatchExtraIncubatorEgg(slotData.slot));
  $('incubatorAddModal')?.classList.remove('hidden');
}

function formatEggTime(seconds) {
  const total = Math.max(0, Math.floor(Number(seconds) || 0));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  return `${hours} h ${String(minutes).padStart(2, '0')}`;
}

function updateEgg(egg) {
  if (!egg) return;

  const pendingXp = Math.max(0, Math.floor(Number(me?.user?.pending_xp) || 0));
  if ($('eggPendingXpValue')) $('eggPendingXpValue').textContent = pendingXp + ' XP';

  const eggProgress = Math.max(0, Math.min(100, egg.progress || 0));
  $('eggProgressBar').style.width = `${eggProgress}%`;
  $('eggTime').textContent = `${formatEggTime(egg.watchedSeconds)} / 6 h 00`;
  if ($('topIncubatorProgressBar')) $('topIncubatorProgressBar').style.width = `${eggProgress}%`;
  if ($('topIncubatorTime')) $('topIncubatorTime').textContent = `${formatEggTime(egg.watchedSeconds)} / 6 h 00`;
  if ($('topIncubatorPendingXp')) $('topIncubatorPendingXp').textContent = pendingXp + ' XP';
  $('topIncubatorEgg')?.classList.remove('hidden');
  $('topIncubatorEggArt')?.classList.remove('hidden');
  $('topIncubatorPendingWrap')?.classList.remove('hidden');

  if (egg.ready) {
    $('eggStatus').textContent = 'Ton œuf est prêt ! Tu peux maintenant le faire éclore.';
    if ($('topIncubatorTitle')) $('topIncubatorTitle').textContent = 'Œuf prêt à éclore';
    if ($('topIncubatorStatus')) $('topIncubatorStatus').textContent = 'Ton œuf est prêt ! Fais-le éclore pour découvrir ton compagnon.';
    $('eggStatus').classList.add('egg-ready');
    $('hatchEgg').disabled = false;
  } else {
    $('eggStatus').textContent = `Encore ${formatEggTime(egg.remainingSeconds)} avant l’éclosion.`;
    if ($('topIncubatorTitle')) $('topIncubatorTitle').textContent = 'Œuf en incubation';
    if ($('topIncubatorStatus')) $('topIncubatorStatus').textContent = `Encore ${formatEggTime(egg.remainingSeconds)} avant l’éclosion.`;
    $('eggStatus').classList.remove('egg-ready');
    $('hatchEgg').disabled = true;
  }
}

const tutorialSteps = [
  {
    icon:'👋', title:'Bienvenue dans LoVeR Watch Game !',
    text:'Ton temps de présence sur les lives fait progresser ton compte et alimente plusieurs systèmes du jeu.',
    tip:'Le tutoriel reste accessible à tout moment avec le bouton ⓘ en haut de la page.'
  },
  {
    icon:'🪪', title:'Ta carte joueur', target:'.player-visit-card',
    text:'Ici tu retrouves ton niveau global, ton grade, tes badges, ton profil et l’accès à ton inventaire.',
    tip:'Ton inventaire se trouve aussi dans la page Boutique, onglet 🎒 Inventaire. Tu peux y essayer et équiper tes titres, fonds et cadres.'
  },
  {
    icon:'🥚', title:'Œufs et incubateur', target:'.incubator-topbar',
    text:'Les incubateurs servent à faire éclore tes œufs pour découvrir de nouveaux Lovys. Place un œuf dans un emplacement libre : il faut 6 heures de présence comptabilisée pendant les lives Twitch pour le rendre prêt à éclore.',
    tip:'Le temps se cumule sur plusieurs lives et se met en pause hors ligne. Quand l’œuf est prêt, clique sur « Faire éclore ». Tu peux faire progresser jusqu’à 3 œufs en même temps.'
  },
  {
    icon:'🎯', title:'Défis du jour', target:'#dailyChallengesCard',
    text:'Trois défis se renouvellent chaque jour. Quand un défi est terminé, pense à réclamer sa récompense.',
    tip:'Les défis peuvent donner du LoVeR’Cash, de l’XP globale et de l’XP Lovys.'
  },
  {
    icon:'🎡', title:'Roues de récompenses', target:'#rewardWheelCard',
    text:'La roue quotidienne offre un bonus régulier. Une seconde roue premium se débloque après 7 lives différents assistés.',
    tip:'Le panneau « Que faire maintenant ? » te préviendra lorsqu’une roue est disponible.'
  },
  {
    icon:'🐉', title:'Lovys et aventure PvE', target:'.desktop-lovys-hub', mobileTarget:'#mobileNavCreatures',
    text:'Après l’éclosion, ton Lovys gagne de l’XP et peut partir en PvE. Les combats débloquent des récompenses et de nouvelles étapes.',
    tip:'Chaque Lovys possède un talent signature. Un doublon devient des fragments qui servent à augmenter son rang ⭐ et ses statistiques.'
  },
  {
    icon:'⭐', title:'Progression à long terme',
    text:'Badges, titres, collection, niveaux globaux et Prestige donnent des objectifs sur la durée. Tu n’as pas besoin de tout apprendre dès le premier jour.',
    tip:'Utilise « Que faire maintenant ? » : le jeu te proposera seulement les actions utiles à ton compte.'
  }
];

function clearTutorialFocus() {
  document.querySelectorAll('.tutorial-focus').forEach(element => element.classList.remove('tutorial-focus'));
}

function tutorialTargetForStep(step) {
  const selector = isMobileGameUi() && step.mobileTarget ? step.mobileTarget : step.target;
  if (!selector) return null;
  const element = document.querySelector(selector);
  if (!element || element.offsetParent === null) return null;
  return element;
}

function resetTutorialPanelPosition() {
  const panel = document.querySelector('.tutorial-panel');
  if (!panel) return;
  panel.style.position = '';
  panel.style.left = '';
  panel.style.right = '';
  panel.style.top = '';
  panel.style.transform = '';
}

function positionTutorialPanel(target) {
  const panel = document.querySelector('.tutorial-panel');
  if (!panel || !target || isMobileGameUi()) { resetTutorialPanelPosition(); return; }
  const rect = target.getBoundingClientRect();
  const gap = 34;
  const panelWidth = Math.min(560, window.innerWidth - 40);
  const roomRight = window.innerWidth - rect.right;
  const roomLeft = rect.left;
  panel.style.position = 'fixed';
  panel.style.top = '50%';
  panel.style.transform = 'translateY(-50%)';
  if (roomRight >= panelWidth + gap) {
    panel.style.left = `${Math.min(window.innerWidth - panelWidth - 20, rect.right + gap)}px`;
    panel.style.right = 'auto';
  } else if (roomLeft >= panelWidth + gap) {
    panel.style.right = `${Math.min(window.innerWidth - panelWidth - 20, window.innerWidth - rect.left + gap)}px`;
    panel.style.left = 'auto';
  } else {
    panel.style.left = '50%';
    panel.style.right = 'auto';
    panel.style.transform = 'translate(-50%,-50%)';
  }
}

function renderTutorialStep() {
  if(isMobileGameUi()){
    clearTutorialFocus();
    resetTutorialPanelPosition();
    $('gameIntroModal')?.classList.remove('tutorial-step-incubator');
    if($('tutorialIcon')) $('tutorialIcon').textContent='👋';
    if($('gameIntroTitle')) $('gameIntroTitle').textContent='Bienvenue dans le jeu !';
    if($('tutorialText')) $('tutorialText').textContent='Voici l’essentiel pour commencer :';
    if($('tutorialTip')) $('tutorialTip').innerHTML=
      '<div class="mobile-intro-item"><span>📺</span><div><strong>Regarde les lives Twitch</strong><br>Ta présence fait progresser ton compte et tes œufs.</div></div>'+
      '<div class="mobile-intro-item"><span>🐉</span><div><strong>Découvre tes Lovys</strong><br>Fais éclore tes œufs, collectionne les Lovys et pars en combat.</div></div>'+
      '<div class="mobile-intro-item"><span>🎁</span><div><strong>Récupère tes récompenses</strong><br>Sur l’accueil : défis du jour et roues. Les boutons du bas ouvrent les autres pages.</div></div>';
    if($('gameIntroClose')) $('gameIntroClose').textContent='C’est parti !';
    return;
  }
  const step = tutorialSteps[Math.max(0, Math.min(tutorialSteps.length - 1, tutorialStepIndex))];
  clearTutorialFocus();
  resetTutorialPanelPosition();
  // Étape 3 uniquement : le panneau du tutoriel doit rester devant l'Incubateur
  // après le scroll automatique, sans modifier le comportement des autres étapes.
  $('gameIntroModal')?.classList.toggle('tutorial-step-incubator', tutorialStepIndex === 2);
  if ($('tutorialStepLabel')) $('tutorialStepLabel').textContent = `Étape ${tutorialStepIndex + 1} / ${tutorialSteps.length}`;
  if ($('tutorialProgressBar')) $('tutorialProgressBar').style.width = `${((tutorialStepIndex + 1) / tutorialSteps.length) * 100}%`;
  if ($('tutorialIcon')) $('tutorialIcon').textContent = step.icon || '✨';
  if ($('gameIntroTitle')) $('gameIntroTitle').textContent = step.title || 'Tutoriel';
  if ($('tutorialText')) $('tutorialText').textContent = step.text || '';
  if ($('tutorialTip')) $('tutorialTip').textContent = step.tip || '';
  if ($('tutorialPrev')) $('tutorialPrev').disabled = tutorialStepIndex === 0;
  if ($('gameIntroClose')) $('gameIntroClose').textContent = tutorialStepIndex === tutorialSteps.length - 1 ? 'Terminer ✓' : 'Suivant →';
  const target = tutorialTargetForStep(step);
  if (target) {
    target.classList.add('tutorial-focus');
    setTimeout(() => { target.scrollIntoView({ behavior:'smooth', block:'center' }); setTimeout(() => positionTutorialPanel(target), 260); }, 60);
  }
}

function openGameTutorial({ restart = true } = {}) {
  if (restart) tutorialStepIndex = 0;
  if(isMobileGameUi()){
    updateMobileNavHeight();
    const modal = $('gameIntroModal');
    // Le tutoriel mobile ne dépend pas de l'empilement de la page ouverte.
    if(modal && modal.parentElement !== document.body) document.body.appendChild(modal);
  }
  $('gameIntroModal')?.classList.remove('hidden');
  renderTutorialStep();
}

function maybeShowGameIntro() {
  if (!shouldShowGameIntro || !me?.user || me.user.creature_id) return;
  if(isMobileGameUi() && !$('gameIntroModal')?.classList.contains('hidden')) return;
  openGameTutorial({ restart:true });
}

async function closeGameIntro({ markSeen = true } = {}) {
  clearTutorialFocus();
  resetTutorialPanelPosition();
  $('gameIntroModal')?.classList.add('hidden');
  if (!markSeen || !shouldShowGameIntro) return;
  shouldShowGameIntro = false;
  try {
    await fetch('/api/account/intro-seen', { method:'POST' });
  } catch (error) {
    console.error('Erreur sauvegarde introduction :', error);
  }
}

$('infoButton')?.addEventListener('click', async () => {
  if (isDesktopGameUi()) {
    // Le tutoriel présente les blocs de l'accueil : les afficher avant son ouverture.
    history.replaceState(null, '', location.pathname + location.search + '#accueil');
    await openDesktopView('home');
  }
  openGameTutorial({ restart:true });
});
$('tutorialPrev')?.addEventListener('click', () => { if (tutorialStepIndex > 0) { tutorialStepIndex -= 1; renderTutorialStep(); } });
$('gameIntroClose')?.addEventListener('click', () => {
  if(isMobileGameUi()){ closeGameIntro({markSeen:true}); return; }
  if (tutorialStepIndex < tutorialSteps.length - 1) { tutorialStepIndex += 1; renderTutorialStep(); return; }
  closeGameIntro({ markSeen:true });
});
$('tutorialSkip')?.addEventListener('click', () => closeGameIntro({ markSeen:true }));
$('gameIntroModal')?.addEventListener('click', event => {
  if (!isMobileGameUi() && event.target.id === 'gameIntroModal') closeGameIntro({ markSeen:true });
});

// V104 — assistant contextuel « Que faire maintenant ? ».
function firstPveAction() {
  const zones = latestPveData?.zones || [];
  for (const zone of zones) {
    const fight = (zone.fights || []).find(item => item.unlocked && !item.won);
    if (fight) return { zone, fight };
  }
  return null;
}

function buildNextActions() {
  if (!me?.user) return [];
  const actions = [];
  const claimable = (dailyChallengesData?.challenges || []).find(item => item.completed && !item.claimed);
  if (claimable) actions.push({ id:'claim-challenge', key:claimable.key, icon:'🎁', title:'Réclame ton défi terminé', desc:`${claimable.title} est terminé : sa récompense t’attend.`, button:'Réclamer', priority:true });

  const slots = incubatorData?.slots || [];
  const readySlot = slots.find(slot => !slot.empty && slot.ready);
  if (readySlot) actions.push({ id:readySlot.source === 'starter' ? 'hatch-starter' : 'hatch-extra', slot:Number(readySlot.slot), icon:'✨', title:'Un œuf est prêt à éclore', desc:'L’incubation est terminée. Découvre le Lovys qui se cache à l’intérieur.', button:'Faire éclore', priority:true });

  const emptySlot = slots.find(slot => slot.empty);
  if (emptySlot && Number(incubatorData?.availableEggs || 0) > 0) actions.push({ id:'place-egg', slot:Number(emptySlot.slot), icon:'🥚', title:'Un emplacement d’incubateur est libre', desc:`Tu as ${Number(incubatorData.availableEggs)} œuf${Number(incubatorData.availableEggs) > 1 ? 's' : ''} disponible${Number(incubatorData.availableEggs) > 1 ? 's' : ''}.`, button:'Placer un œuf' });

  if (rewardWheelData?.weekly?.available) actions.push({ id:'wheel-weekly', icon:'👑', title:'Ta roue des 7 lives est prête', desc:'Ta récompense premium est disponible maintenant.', button:'Lancer', priority:true });
  else if (rewardWheelData?.daily?.available) actions.push({ id:'wheel-daily', icon:'🎡', title:'Ta roue quotidienne est disponible', desc:'Tu peux récupérer ton bonus du jour.', button:'Lancer', priority:true });

  const rankable=(lovysCollectionData?.lovys||[]).find(l=>l.canRankUp);
  if(rankable) actions.push({ id:'lovys-rank', lovysId:Number(rankable.id), icon:'⭐', title:`${rankable.name} peut monter de rang`, desc:`${Number(rankable.fragments||0)} fragments disponibles · prochain rang : ${Number(rankable.nextRankCost||0)}.`, button:'Améliorer', priority:true });

  const pve = firstPveAction();
  if (me.user.creature_id && pve) actions.push({ id:'pve', icon:pve.fight.boss ? '👑' : '⚔️', title:pve.fight.boss ? `Boss débloqué : ${pve.fight.name}` : `Combat débloqué : ${pve.fight.name}`, desc:`${pve.zone.name} · niveau conseillé ${pve.fight.level}.`, button:'Combattre' });

  if (!me.user.creature_id && !readySlot) {
    const starter = slots.find(slot => slot.source === 'starter');
    if (starter && !starter.ready) actions.push({ id:'incubator-view', icon:'⏱️', title:'Continue l’incubation', desc:`Il reste ${formatEggTime(Math.max(0, Number(incubatorData?.hatchSeconds || 21600) - Number(starter.watchedSeconds || 0)))} avant ton premier Lovys.`, button:'Voir' });
  }

  const pendingXp = Math.max(0, Number(me.user.pending_xp || 0));
  if (!me.user.creature_id && pendingXp > 0) actions.push({ id:'incubator-view', icon:'⚡', title:`${pendingXp.toLocaleString('fr-FR')} XP en réserve`, desc:'Cette XP est conservée et sera attribuée à ton Lovys lors de l’éclosion.', button:'Voir la réserve' });
  return actions.slice(0, 6);
}

function renderNextActions() {
  const list = $('nextActionsList');
  const summary = $('nextActionsSummary');
  const count = $('nextActionsCount');
  if (!summary || !count) return;
  const actions = buildNextActions();
  count.textContent = String(actions.length);
  const quick=$('nextActionQuick');
  if(quick){
    const action=actions[0];
    quick.classList.toggle('hidden',!action);
    quick.textContent=action ? action.button : '';
    quick.onclick=()=>list?.querySelector('[data-next-action]')?.click();
  }
  summary.textContent = isMobileGameUi() && actions.length ? actions[0].title : actions.length ? `${actions.length} action${actions.length > 1 ? 's' : ''} utile${actions.length > 1 ? 's' : ''} pour ton compte` : 'Tout est à jour pour le moment';
  if (!list) return;
  if (!actions.length) {
    list.innerHTML = `<div class="next-action-empty"><b>✓ Rien d’urgent</b>Continue à profiter du live et à faire progresser ton compte. Les prochaines actions apparaîtront ici automatiquement.</div>`;
    return;
  }
  list.innerHTML = actions.map(action => `<article class="next-action-card${action.priority ? ' priority' : ''}"><div class="next-action-icon">${escapeHtml(action.icon)}</div><div class="next-action-copy"><div class="next-action-title">${escapeHtml(action.title)}</div><div class="next-action-desc">${escapeHtml(action.desc)}</div></div><button class="next-action-button" type="button" data-next-action="${escapeHtml(action.id)}"${action.key ? ` data-key="${escapeHtml(action.key)}"` : ''}${action.slot ? ` data-slot="${Number(action.slot)}"` : ''}>${escapeHtml(action.button)}</button></article>`).join('');
}

function closeNextActions() { $('nextActionsModal')?.classList.add('hidden'); }
function openStarterEggDetails() {
  if (isMobileGameUi()) { toggleMobilePanel('creatures'); return; }
  const pick = $('pick');
  if (!pick) return;
  pick.classList.add('egg-details-open');
  document.body.style.overflow = 'hidden';
}
function scrollToGameElement(selector) {
  closeNextActions();
  setTimeout(() => document.querySelector(selector)?.scrollIntoView({ behavior:'smooth', block:'center' }), 60);
}
function runNextAction(button) {
  const action = button.dataset.nextAction;
  if (action === 'claim-challenge') { closeNextActions(); renderDailyChallengeDetail(button.dataset.key); return; }
  if (action === 'hatch-starter') { closeNextActions(); openStarterEggDetails(); return; }
  if (action === 'hatch-extra') { closeNextActions(); const slot=incubatorData?.slots?.find(item=>Number(item.slot)===Number(button.dataset.slot)); if(slot) openExtraEggInfo(slot); return; }
  if (action === 'place-egg') { closeNextActions(); openIncubatorAddModal(Number(button.dataset.slot)); return; }
  if (action === 'wheel-daily' || action === 'wheel-weekly') { rewardWheelType = action === 'wheel-weekly' ? 'weekly' : 'daily'; renderRewardWheel(); scrollToGameElement('#rewardWheelCard'); return; }
  if (action === 'lovys-rank') { closeNextActions(); openLovysCollection('fragments'); return; }
  if (action === 'pve') { closeNextActions(); $('pveModal')?.classList.remove('hidden'); loadPve(); syncMobileNavState?.(); return; }
  if (action === 'incubator-view') { closeNextActions(); if (isMobileGameUi()) openMobileEggDetails(); else scrollToGameElement('.incubator-topbar'); }
}

$('nextActionsOpen')?.addEventListener('click', () => { renderNextActions(); $('nextActionsModal')?.classList.remove('hidden'); });
$('nextActionsClose')?.addEventListener('click', closeNextActions);
$('nextActionsModal')?.addEventListener('click', event => { if (event.target.id === 'nextActionsModal') closeNextActions(); });
$('nextActionsList')?.addEventListener('click', event => { const button=event.target.closest('[data-next-action]'); if(button) runNextAction(button); });

// V104 — installation PWA. Le jeu reste connecté : le service worker n’intercepte pas les API.
function isStandalonePwa() { return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true; }
function isIosDevice() { return /iphone|ipad|ipod/i.test(navigator.userAgent); }
function updatePwaInstallUi() {
  const button = $('pwaInstallButton');
  const status = $('pwaInstallStatus');
  const wrap = button?.closest('.next-actions-install');
  if (!button || !status) return;
  if (isStandalonePwa()) {
    button.disabled = true; button.textContent = 'Installé ✓'; status.textContent = 'LoVeR Watch Game est déjà lancé comme une application.'; wrap?.classList.add('is-installed'); return;
  }
  button.disabled = false; wrap?.classList.remove('is-installed');
  if (deferredPwaInstallPrompt) { button.textContent = 'Installer'; status.textContent = 'Installation disponible sur cet appareil.'; }
  else if (isIosDevice()) { button.textContent = 'Voir comment'; status.textContent = 'Sur iPhone/iPad, l’installation se fait depuis le menu Partager de Safari.'; }
  else { button.textContent = 'Voir comment'; status.textContent = 'L’installation dépend du navigateur utilisé.'; }
}
function openPwaHelp() {
  const content = $('pwaHelpContent');
  if (!content) return;
  if (isIosDevice()) content.innerHTML = `<div class="pwa-help-step"><b>1.</b> Ouvre le jeu dans <b>Safari</b>.</div><div class="pwa-help-step"><b>2.</b> Appuie sur le bouton <b>Partager</b>.</div><div class="pwa-help-step"><b>3.</b> Choisis <b>Sur l’écran d’accueil</b>, puis confirme avec <b>Ajouter</b>.</div><div class="pwa-help-note">L’icône LoVeR Watch Game apparaîtra avec tes applications et le jeu s’ouvrira dans une fenêtre dédiée.</div>`;
  else content.innerHTML = `<div class="pwa-help-step"><b>1.</b> Ouvre le menu de ton navigateur.</div><div class="pwa-help-step"><b>2.</b> Cherche <b>Installer l’application</b> ou <b>Ajouter à l’écran d’accueil</b>.</div><div class="pwa-help-step"><b>3.</b> Confirme l’installation.</div><div class="pwa-help-note">Sur Chrome/Edge compatibles, le bouton Installer peut aussi apparaître automatiquement ici.</div>`;
  $('pwaHelpModal')?.classList.remove('hidden');
}
$('pwaInstallButton')?.addEventListener('click', async () => {
  if (deferredPwaInstallPrompt) {
    deferredPwaInstallPrompt.prompt();
    try { await deferredPwaInstallPrompt.userChoice; } catch {}
    deferredPwaInstallPrompt = null;
    updatePwaInstallUi();
    return;
  }
  openPwaHelp();
});
$('pwaHelpClose')?.addEventListener('click', () => $('pwaHelpModal')?.classList.add('hidden'));
$('pwaHelpModal')?.addEventListener('click', event => { if (event.target.id === 'pwaHelpModal') $('pwaHelpModal')?.classList.add('hidden'); });
window.addEventListener('beforeinstallprompt', event => { event.preventDefault(); deferredPwaInstallPrompt = event; updatePwaInstallUi(); });
window.addEventListener('appinstalled', () => { deferredPwaInstallPrompt = null; updatePwaInstallUi(); });


let badgeData = { gameWatch: [], challenges: [], badges: [], showcaseSettings: { isPublic: true, theme: 'classic' } };
let badgeCollectionView = 'unlocked';
let badgeCategoryFilter = 'all';
let unlockedBadgeCategoryFilter = 'all';

const badgeCelebrationQueue = [];
let badgeCelebrationActive = false;

function badgeCelebrationStorageKey() {
  const userKey = String(me?.user?.twitch_id || me?.user?.id || me?.user?.game_username || 'player');
  return `loverdose:badge-celebrations:v72:${userKey}`;
}

function badgeCelebrationSignature(challenge) {
  if (!challenge?.unlocked || !challenge?.badgeKey) return '';
  if (challenge.missionType === 'live-attendance' || challenge.missionType === 'global-evolution') {
    const stageId = Number(challenge.celebrationStageId || challenge.evolutionLevel || 0);
    return stageId > 0 ? `${challenge.badgeKey}:stage:${stageId}` : '';
  }
  return `${challenge.badgeKey}:unlocked`;
}

function badgeCelebrationDescriptor(challenge) {
  const progressive = challenge.missionType === 'live-attendance' || challenge.missionType === 'global-evolution';
  const lovysXp = Number(progressive ? challenge.celebrationRewardLovysXp : challenge.rewardLovysXp || challenge.rewardXp) || 0;
  const globalXp = Number(progressive ? challenge.celebrationRewardGlobalXp : challenge.rewardGlobalXp) || 0;
  const cash = Number(progressive ? challenge.celebrationRewardCash : challenge.rewardCash) || 0;
  const rewardTitle = String(progressive ? challenge.celebrationRewardTitle : challenge.rewardTitle || '').trim();
  return {
    signature: badgeCelebrationSignature(challenge),
    badgeName: String(challenge.badgeName || 'Nouveau badge'),
    badgeImage: String(challenge.badgeImage || ''),
    stageName: String(progressive ? (challenge.celebrationStageName || challenge.evolutionName || '') : ''),
    lovysXp,
    globalXp,
    cash,
    rewardTitle,
    reserve: Boolean(challenge.lovysXpToReserve && lovysXp > 0)
  };
}

function ensureBadgeCelebrationModal() {
  let modal = document.getElementById('badgeUnlockCelebration');
  if (modal) return modal;
  modal = document.createElement('div');
  modal.id = 'badgeUnlockCelebration';
  modal.className = 'badge-unlock-celebration';
  modal.setAttribute('aria-hidden', 'true');
  modal.innerHTML = `<div class="badge-unlock-card" role="dialog" aria-modal="true" aria-labelledby="badgeUnlockTitle">
    <div class="badge-unlock-glow"></div>
    ${Array.from({length:18},(_,i)=>`<i class="badge-unlock-particle" style="--x:${8 + ((i*29)%84)}%;--y:${18 + ((i*17)%67)}%;--delay:${((i%7)*.13).toFixed(2)}s"></i>`).join('')}
    <div class="badge-unlock-kicker">✦ Badge débloqué</div>
    <div class="badge-unlock-title" id="badgeUnlockTitle">Félicitations !</div>
    <div class="badge-unlock-stage" id="badgeUnlockStage"></div>
    <div class="badge-unlock-logo-wrap"><div class="badge-unlock-ring"></div><div id="badgeUnlockLogo"></div></div>
    <div class="badge-unlock-name" id="badgeUnlockName"></div>
    <div class="badge-unlock-reward-title">Récompenses obtenues</div>
    <div class="badge-unlock-rewards" id="badgeUnlockRewards"></div>
    <div class="badge-unlock-reserve" id="badgeUnlockReserve"></div>
    <button class="badge-unlock-ok" id="badgeUnlockOk" type="button">OK</button>
  </div>`;
  document.body.appendChild(modal);
  modal.querySelector('#badgeUnlockOk')?.addEventListener('click', closeBadgeCelebration);
  modal.addEventListener('click', event => { if (event.target === modal) closeBadgeCelebration(); });
  return modal;
}

function showNextBadgeCelebration() {
  if (badgeCelebrationActive || !badgeCelebrationQueue.length) return;
  const item = badgeCelebrationQueue.shift();
  if (!item) return;
  badgeCelebrationActive = true;
  const modal = ensureBadgeCelebrationModal();
  const logo = modal.querySelector('#badgeUnlockLogo');
  const stage = modal.querySelector('#badgeUnlockStage');
  const name = modal.querySelector('#badgeUnlockName');
  const rewards = modal.querySelector('#badgeUnlockRewards');
  const reserve = modal.querySelector('#badgeUnlockReserve');
  if (stage) stage.textContent = item.stageName ? `Nouvelle évolution · ${item.stageName}` : 'Un nouveau badge rejoint ta collection';
  if (name) name.textContent = item.badgeName;
  if (logo) logo.innerHTML = item.badgeImage
    ? `<img loading="lazy" decoding="async" class="badge-unlock-logo" src="${escapeHtml(item.badgeImage)}" alt="${escapeHtml(item.badgeName)}">`
    : '<div class="badge-unlock-logo-fallback">🏆</div>';
  const rewardParts = [];
  if (item.lovysXp > 0) rewardParts.push(`<div class="badge-unlock-reward"><b>🐉 +${item.lovysXp}</b><span>XP Lovys</span></div>`);
  if (item.globalXp > 0) rewardParts.push(`<div class="badge-unlock-reward"><b>⭐ +${item.globalXp}</b><span>XP globale</span></div>`);
  if (item.cash > 0) rewardParts.push(`<div class="badge-unlock-reward"><b>💰 +${item.cash}</b><span>LoVeR'Cash</span></div>`);
  if (item.rewardTitle) rewardParts.push(`<div class="badge-unlock-reward title"><b>🏷️ « ${escapeHtml(item.rewardTitle)} »</b><span>Nouveau titre débloqué</span></div>`);
  if (!rewardParts.length) rewardParts.push('<div class="badge-unlock-reward title"><b>🏅 Badge ajouté</b><span>Disponible dans Mes badges</span></div>');
  if (rewards) rewards.innerHTML = rewardParts.join('');
  if (reserve) reserve.textContent = item.reserve ? 'L’XP Lovys a été ajoutée à ta réserve d’XP.' : '';
  modal.setAttribute('aria-hidden', 'false');
  requestAnimationFrame(() => modal.classList.add('show'));
  setTimeout(() => modal.querySelector('#badgeUnlockOk')?.focus(), 260);
}

function closeBadgeCelebration() {
  const modal = document.getElementById('badgeUnlockCelebration');
  if (!modal || !badgeCelebrationActive) return;
  modal.classList.remove('show');
  modal.setAttribute('aria-hidden', 'true');
  badgeCelebrationActive = false;
  setTimeout(showNextBadgeCelebration, 220);
}

function syncBadgeUnlockCelebrations(challenges = []) {
  if (!me?.user) return;
  const descriptors = (Array.isArray(challenges) ? challenges : [])
    .filter(challenge => challenge?.unlocked)
    .map(badgeCelebrationDescriptor)
    .filter(item => item.signature);
  const currentSignatures = [...new Set(descriptors.map(item => item.signature))];
  const storageKey = badgeCelebrationStorageKey();
  let previous = null;
  try {
    const raw = localStorage.getItem(storageKey);
    previous = raw ? JSON.parse(raw) : null;
  } catch (_) { previous = null; }

  // Première visite avec V72 : on mémorise l'existant sans rejouer tous les anciens badges.
  if (!Array.isArray(previous)) {
    try { localStorage.setItem(storageKey, JSON.stringify(currentSignatures)); } catch (_) {}
    return;
  }

  const seen = new Set(previous);
  descriptors.filter(item => !seen.has(item.signature)).forEach(item => badgeCelebrationQueue.push(item));
  try { localStorage.setItem(storageKey, JSON.stringify(currentSignatures)); } catch (_) {}
  showNextBadgeCelebration();
}

function badgeVisual(badge, className = 'badge-art') {
  if (badge?.badgeImage) {
    return `<img loading="lazy" decoding="async" class="${className}" src="${escapeHtml(badge.badgeImage)}" alt="${escapeHtml(badge.badgeName || 'Badge')}">`;
  }

  const placeholderClass = className === 'leaderboard-badge-img'
    ? 'leaderboard-badge-placeholder'
    : 'badge-art-placeholder';

  return `<span class="${placeholderClass}" aria-hidden="true">🏆</span>`;
}


function openSubBenefitsModal() {
  const isSub = Boolean(me?.user?.is_sub);
  const title = $('subBenefitsTitle');
  const intro = document.querySelector('.sub-benefits-intro');
  const note = $('subBenefitsNote');
  const subscribe = $('subBenefitsSubscribe');

  if (title) title.textContent = isSub ? '⭐ Avantages Abonné Twitch' : '☆ Avantages de l’abonnement Twitch';
  if (intro) intro.textContent = isSub
    ? 'Être abonné à LoVeRDoSeTV accélère ta progression pendant les lives et débloque des avantages exclusifs.'
    : 'En t’abonnant à LoVeRDoSeTV, tu profites de bonus permanents pendant les lives et d’avantages exclusifs dans LoVeR Watch Game.';
  if (note) note.textContent = isSub
    ? 'Les bonus sont appliqués automatiquement par le tracker lorsque tu es présent pendant un live.'
    : 'Une fois ton abonnement détecté par le tracker, tous ces avantages sont appliqués automatiquement.';
  subscribe?.classList.toggle('hidden', isSub);
  $('subBenefitsModal')?.classList.remove('hidden');
}

function renderPlayerSubscriptionStatus() {
  const zone = $('playerCardSubZone');
  if (!zone || !me?.user) return;

  if (me.user.is_sub) {
    zone.innerHTML = `<button id="playerCardSubStatus" class="player-sub-status is-sub" type="button" title="Voir les avantages Abonné"><span class="player-sub-star">★</span><span>Abonné</span></button>`;
    $('playerCardSubStatus')?.addEventListener('click', openSubBenefitsModal);
  } else {
    zone.innerHTML = `
      <button id="playerCardSubStatus" class="player-sub-status not-sub" type="button" title="Découvrir les avantages Sub"><span class="player-sub-star">☆</span><span>Non abonné</span></button>
      <a class="player-card-subscribe" href="https://www.twitch.tv/subs/loverdosetv" target="_blank" rel="noopener noreferrer">S’abonner</a>`;
    $('playerCardSubStatus')?.addEventListener('click', openSubBenefitsModal);
  }
}

function profileBackgroundValue(key) {
  const map = {
    bg_nebula: 'radial-gradient(circle at 15% 15%,rgba(155,85,255,.42),transparent 38%),linear-gradient(150deg,rgba(36,20,68,.96),rgba(12,16,32,.98))',
    bg_starry: 'radial-gradient(circle at 18% 22%,rgba(255,255,255,.82) 0 1px,transparent 2px),radial-gradient(circle at 72% 25%,rgba(204,190,255,.8) 0 1px,transparent 2px),radial-gradient(circle at 84% 72%,rgba(255,255,255,.8) 0 1px,transparent 2px),linear-gradient(150deg,#080c1c,#161a35)',
    bg_ember: 'radial-gradient(circle at 22% 90%,rgba(255,102,40,.42),transparent 34%),linear-gradient(150deg,rgba(55,18,16,.96),rgba(18,15,29,.98))',
    bg_dawn_violet: 'radial-gradient(circle at 72% 22%,rgba(228,190,255,.28),transparent 28%),linear-gradient(150deg,rgba(85,42,116,.96),rgba(34,22,58,.98) 56%,rgba(14,20,38,.99))',
    bg_blue_twilight: 'radial-gradient(circle at 78% 24%,rgba(92,176,255,.22),transparent 32%),linear-gradient(150deg,rgba(15,43,83,.97),rgba(15,27,55,.98) 58%,rgba(8,14,29,.99))',
    bg_dark_mist: 'radial-gradient(ellipse at 25% 65%,rgba(165,186,211,.13),transparent 38%),radial-gradient(ellipse at 75% 35%,rgba(124,145,173,.10),transparent 42%),linear-gradient(150deg,rgba(35,43,56,.98),rgba(15,21,34,.99))',
    bg_cosmic_glow: 'radial-gradient(circle at 22% 28%,rgba(182,104,255,.42),transparent 24%),radial-gradient(circle at 78% 68%,rgba(55,190,255,.22),transparent 28%),radial-gradient(circle at 58% 22%,rgba(255,255,255,.82) 0 1px,transparent 2px),linear-gradient(150deg,#15102f,#0b162b)',
    bg_purple_storm: 'linear-gradient(118deg,transparent 0 43%,rgba(211,155,255,.42) 44%,transparent 46% 58%,rgba(142,79,255,.30) 59%,transparent 61%),radial-gradient(circle at 28% 30%,rgba(126,59,205,.34),transparent 34%),linear-gradient(150deg,#221137,#0f1224)',
    bg_constellation: 'linear-gradient(28deg,transparent 49%,rgba(130,160,255,.12) 50%,transparent 51%),radial-gradient(circle at 18% 25%,rgba(255,255,255,.90) 0 1px,transparent 2px),radial-gradient(circle at 42% 62%,rgba(197,210,255,.88) 0 1px,transparent 2px),radial-gradient(circle at 74% 28%,rgba(255,255,255,.92) 0 1px,transparent 2px),radial-gradient(circle at 84% 72%,rgba(197,210,255,.86) 0 1px,transparent 2px),linear-gradient(150deg,#050a1a,#121a37)',
    bg_royal_night: 'radial-gradient(circle at 74% 18%,rgba(245,207,104,.20),transparent 20%),radial-gradient(circle at 22% 78%,rgba(48,92,181,.28),transparent 34%),linear-gradient(150deg,#091a3e,#10142a 62%,#211a15)',
    bg_obsidian: 'linear-gradient(125deg,rgba(255,255,255,.045) 0 1px,transparent 1px 18%,rgba(255,255,255,.028) 18% 19%,transparent 19% 100%),radial-gradient(circle at 72% 28%,rgba(120,136,170,.11),transparent 30%),linear-gradient(150deg,#131720,#06080d)',
    reward_bg_level55: 'radial-gradient(circle at 50% 28%,rgba(255,227,132,.25),transparent 24%),radial-gradient(circle at 20% 75%,rgba(151,91,255,.28),transparent 28%),linear-gradient(150deg,#301c50,#0f152a 58%,#392a12)',
    bg_aurora: 'radial-gradient(circle at 22% 28%,rgba(109,255,177,.28),transparent 25%),radial-gradient(circle at 75% 25%,rgba(109,198,255,.22),transparent 28%),linear-gradient(150deg,#071521,#0b2230 45%,#12253d)',
    bg_rose_horizon: 'radial-gradient(circle at 70% 25%,rgba(255,188,236,.22),transparent 26%),linear-gradient(150deg,#482048,#1e1835 58%,#0f162a)',
    bg_sapphire_wave: 'radial-gradient(circle at 26% 74%,rgba(88,179,255,.22),transparent 28%),linear-gradient(150deg,#0b2950,#101f3d 56%,#081223)',
    bg_golden_sunset: 'radial-gradient(circle at 30% 76%,rgba(255,166,76,.32),transparent 28%),radial-gradient(circle at 76% 22%,rgba(255,221,124,.15),transparent 18%),linear-gradient(150deg,#3b1c19,#2e1f39 58%,#141425)',
  };
  return map[key] || 'none';
}

function profileFrameStyle(key) {
  const map = {
    frame_violet: { border:'#a76fff', shadow:'0 0 20px rgba(167,111,255,.26)' },
    frame_cyan: { border:'#4de4ff', shadow:'0 0 20px rgba(77,228,255,.23)' },
    frame_silver: { border:'#d9e2ef', shadow:'0 0 20px rgba(217,226,239,.22)' },
    frame_crimson: { border:'#ff5b73', shadow:'0 0 20px rgba(255,91,115,.24)' },
    frame_emerald: { border:'#53e6a8', shadow:'0 0 20px rgba(83,230,168,.22)' },
    frame_gold: { border:'#f3c85b', shadow:'0 0 20px rgba(243,200,91,.23)' },
    frame_rose: { border:'#ff7ad9', shadow:'0 0 20px rgba(255,122,217,.24)' },
    frame_obsidian: { border:'#7f8aa6', shadow:'0 0 20px rgba(127,138,166,.20)' },
    frame_royal: { border:'#78a6ff', shadow:'0 0 20px rgba(120,166,255,.24)' },
    frame_sapphire: { border:'#4b8dff', shadow:'0 0 20px rgba(75,141,255,.24)' },
    frame_amber: { border:'#ffb14d', shadow:'0 0 20px rgba(255,177,77,.24)' },
    frame_amethyst: { border:'#b96cff', shadow:'0 0 20px rgba(185,108,255,.24)' },
    frame_ruby: { border:'#ff4d79', shadow:'0 0 20px rgba(255,77,121,.24)' },
    frame_ice: { border:'#9fe8ff', shadow:'0 0 20px rgba(159,232,255,.22)' },
    frame_pearl: { border:'#f5efe8', shadow:'0 0 20px rgba(245,239,232,.20)' }
  };
  return map[key] || null;
}

function profileAvatarFrameStyle(key) {
  const map = {
    avatarframe_violet: { border:'#a76fff', shadow:'0 0 16px rgba(167,111,255,.34)' },
    avatarframe_cyan: { border:'#4de4ff', shadow:'0 0 16px rgba(77,228,255,.32)' },
    avatarframe_silver: { border:'#d9e2ef', shadow:'0 0 16px rgba(217,226,239,.28)' },
    avatarframe_emerald: { border:'#53e6a8', shadow:'0 0 16px rgba(83,230,168,.30)' },
    avatarframe_rose: { border:'#ff7ad9', shadow:'0 0 16px rgba(255,122,217,.30)' },
    avatarframe_gold: { border:'#f3c85b', shadow:'0 0 16px rgba(243,200,91,.32)' },
    avatarframe_crimson: { border:'#ff5b73', shadow:'0 0 16px rgba(255,91,115,.32)' },
    avatarframe_royal: { border:'#78a6ff', shadow:'0 0 16px rgba(120,166,255,.30)' },
    avatarframe_obsidian: { border:'#7f8aa6', shadow:'0 0 16px rgba(127,138,166,.26)' },
    avatarframe_sapphire: { border:'#4b8dff', shadow:'0 0 16px rgba(75,141,255,.30)' },
    avatarframe_amber: { border:'#ffb14d', shadow:'0 0 16px rgba(255,177,77,.32)' },
    avatarframe_amethyst: { border:'#b96cff', shadow:'0 0 16px rgba(185,108,255,.32)' },
    avatarframe_ruby: { border:'#ff4d79', shadow:'0 0 16px rgba(255,77,121,.32)' },
    avatarframe_ice: { border:'#9fe8ff', shadow:'0 0 16px rgba(159,232,255,.32)' },
    avatarframe_pearl: { border:'#f5efe8', shadow:'0 0 16px rgba(245,239,232,.28)' }
  };
  return map[key] || null;
}

function applyAvatarFrameCosmetics(element, avatarFrameKey) {
  if (!element) return;
  const frame = profileAvatarFrameStyle(avatarFrameKey);
  element.style.borderColor = frame?.border || '';
  element.style.boxShadow = frame?.shadow || '';
}

function applyProfileCosmetics(element, backgroundKey, frameKey) {
  if (!element) return;
  element.style.setProperty('--profile-card-image', profileBackgroundValue(backgroundKey));
  const frame = profileFrameStyle(frameKey);
  element.style.borderColor = frame?.border || '';
  element.style.boxShadow = frame?.shadow || '';
}

let progressionTitlePreview = null;

function renderPlayerVisitCard() {
  const nameEl = $('playerCardName');
  const titleEl = $('playerCardTitle');
  const levelValueEl = $('playerCardLevelValue');
  const rankEl = $('playerCardRank');
  const avatarEl = $('playerCardAvatar');
  if (!nameEl || !titleEl || !levelValueEl || !rankEl || !avatarEl || !me?.user) return;

  nameEl.textContent = me.user.game_username || me.user.display_name || 'Joueur';
  const previewTitle = progressionTitlePreview?.name ? String(progressionTitlePreview.name).trim() : '';
  const cosmeticTitle = previewTitle || String(me.user.cosmetic_title || '').trim();
  titleEl.textContent = cosmeticTitle ? `"${cosmeticTitle}"` : '';
  titleEl.classList.toggle('visible', Boolean(cosmeticTitle));
  titleEl.style.color = previewTitle ? (progressionTitlePreview.color || me.user.cosmetic_title_color || '') : (me.user.cosmetic_title_color || '');
  applyProfileCosmetics(document.querySelector('.player-visit-card'), me.user.cosmetic_background, me.user.cosmetic_frame);
  applyAvatarFrameCosmetics(avatarEl, me.user.cosmetic_avatar_frame);
  setHubFragmentsButton(Number(me.user.egg_fragments || 0));
  levelValueEl.textContent = `Niveau : ${me.user.global_progression?.level || 1} · ${me.user.global_grade?.name || 'Recrue'}`;
  const gradeEmblem = $('playerGradeEmblem'); if (gradeEmblem) { gradeEmblem.textContent = me.user.global_grade?.icon || '◆'; gradeEmblem.style.color = me.user.global_grade?.color || '#9aa3b8'; }
  const creatureLevelEl = $('playerCardCreatureLevelValue');
  if (creatureLevelEl) { creatureLevelEl.textContent = ''; creatureLevelEl.classList.add('hidden'); }
  const leaderboardRank = Number(me.user.leaderboard_rank);
  rankEl.textContent = Number.isFinite(leaderboardRank) && leaderboardRank > 0
    ? `#${leaderboardRank}`
    : '#—';

  if (me.user.profile_image_url) {
    avatarEl.innerHTML = `<img loading="lazy" decoding="async" class="twitch-profile-avatar" src="${escapeHtml(me.user.profile_image_url)}" alt="Photo Twitch de ${escapeHtml(me.user.game_username || me.user.display_name || 'Joueur')}">`;
  } else if (me.user.creature_id) {
    avatarEl.innerHTML = art(me.user.creature_id, me.user.progression?.evolution || 0, true);
  } else {
    avatarEl.innerHTML = eggIconMarkup('egg-inline-icon egg-inline-icon-avatar');
  }

  const selected = (badgeData.badges || [])
    .filter(badge => Number(badge.leaderboardSlot) > 0)
    .sort((a,b) => Number(a.leaderboardSlot) - Number(b.leaderboardSlot))
    .slice(0,2);

  [1,2].forEach((slot, index) => {
    const el = $(`playerCardBadge${slot}`);
    if (!el) return;
    const badge = selected[index];
    if (!badge) {
      el.className = 'player-card-rankbadge empty';
      el.innerHTML = '＋';
      el.title = `Badge de classement ${slot} non choisi`;
      return;
    }
    el.className = 'player-card-rankbadge';
    el.title = badge.badgeName || 'Badge';
    el.innerHTML = badge.badgeImage
      ? `<img loading="lazy" decoding="async" src="${escapeHtml(badge.badgeImage)}" alt="${escapeHtml(badge.badgeName || 'Badge')}">`
      : '🏅';
  });
}

async function loadBadges() {
  try {
    const response = await fetch('/api/badges', { cache: 'no-store' });
    const data = await response.json();

    if (!response.ok) throw new Error(data.error || 'Impossible de charger les badges.');

    badgeData = data;
    syncBadgeUnlockCelebrations(data.challenges || []);
    if (data.xpSummary && me?.user) {
      me.user.xp = Number(data.xpSummary.xp || 0);
      me.user.pending_xp = Number(data.xpSummary.pendingXp || 0);
      if (me.egg) updateEgg(me.egg);
    }
  } catch (error) {
    console.error('Erreur badges :', error);
    badgeData = { gameWatch: [], challenges: [], badges: [], showcaseSettings: { isPublic: true, theme: 'classic' } };
  }

  renderBadgeShowcase();
  renderBadgeCollection();
  syncShowcaseSettingsUI();
  renderPlayerVisitCard();
  scheduleTopDashboardSync();
}


function applyShowcaseTheme(theme) {
  const allowed = ['classic', 'violet', 'gold', 'neon'];
  const selected = allowed.includes(theme) ? theme : 'classic';
  const card = document.querySelector('.showcase-topbar');
  if (card) {
    card.classList.remove('theme-classic', 'theme-violet', 'theme-gold', 'theme-neon');
    card.classList.add(`theme-${selected}`);
  }
  document.querySelectorAll('[data-showcase-theme]').forEach(button => {
    button.classList.toggle('active', button.dataset.showcaseTheme === selected);
  });
}
function syncShowcaseSettingsUI() {
  applyShowcaseTheme('classic');
}

function renderBadgeShowcase() {
  const container = $('badgeShowcase');
  if (!container) return;
  const equipped = new Map((badgeData.badges || []).filter(badge => badge.equippedSlot).map(badge => [Number(badge.equippedSlot), badge]));
  container.innerHTML = Array.from({ length: 6 }, (_, index) => {
    const slot = index + 1;
    const badge = equipped.get(slot);
    if (!badge) {
      return `<button class="badge-slot" type="button" data-open-badge-collection="true" title="Ajouter un badge">
        <div class="badge-medal">＋</div><div class="badge-game">Ajouter un badge</div></button>`;
    }
    const name = escapeHtml(badge.badgeName || badge.gameName || 'Badge');
    const mission = escapeHtml(badge.badgeChallenge || 'Mission à venir');
    return `<button class="badge-slot filled" type="button" data-badge-slot="${slot}" aria-label="${name} — ${mission}">
      ${badgeVisual(badge)}
      <span class="badge-slot-tooltip" role="tooltip"><strong>${name}</strong><span>Mission : ${mission}</span></span>
    </button>`;
  }).join('');
}

function badgeCategoryOf(challenge) {
  const category = String(challenge.badgeCategory || '').toLowerCase();
  const mission = String(challenge.missionType || '').toLowerCase();
  if (category === 'social' || ['discord', 'instagram', 'tiktok'].includes(mission)) return 'social';
  if (category === 'support' || category === 'soutien' || mission === 'subscription') return 'support';
  if (category === 'special' || category === 'special-mode' || mission === 'special-mode') return 'special';
  return 'watch';
}

function badgeMobileProgress(challenge) {
  const type = String(challenge.missionType || '');
  if (type === 'live-attendance') {
    const current = Math.max(0, Number(challenge.attendanceCount || 0));
    const target = Math.max(1, Number(challenge.targetCount || 1));
    return { percent: Math.min(100, current / target * 100), label: `${current} / ${target} lives`, remaining: `${Math.max(0, target - current)} live(s) restant(s)` };
  }
  const target = Number(challenge.targetHours || 0);
  if (target > 0) {
    const seconds = Math.max(0, Number(challenge.watchSeconds || 0));
    const remainingMinutes = Math.ceil(Math.max(0, target * 3600 - seconds) / 60);
    const remaining = remainingMinutes >= 60 ? `${Math.floor(remainingMinutes / 60)} h ${String(remainingMinutes % 60).padStart(2, '0')}` : `${remainingMinutes} min`;
    return { percent: Math.min(100, seconds / (target * 3600) * 100), label: `${(seconds / 3600).toFixed(1).replace('.', ',')} h / ${target} h`, remaining: `${remaining} de visionnage restant` };
  }
  return { percent: challenge.unlocked ? 100 : 0, label: challenge.unlocked ? 'Obtenu' : 'Action à accomplir', remaining: 'Action à accomplir' };
}

function renderMobileNextBadges(challenges) {
  if (!isMobileGameUi()) return '';
  const next = challenges.filter(challenge => !challenge.maxed && (!challenge.unlocked || ['global-evolution', 'live-attendance'].includes(challenge.missionType)))
    .map(challenge => ({ challenge, progress: badgeMobileProgress(challenge) }))
    .sort((a, b) => b.progress.percent - a.progress.percent)
    .slice(0, 3);
  return `<section class="badge-mobile-next" aria-label="Mes prochains badges">
    <h3>✨ Mes prochains badges</h3>
    ${next.length ? next.map(({ challenge, progress }) => `<button type="button" class="badge-mobile-next-card" data-mobile-badge-detail="${escapeHtml(challenge.badgeKey)}">
      ${badgeVisual(challenge)}<span class="badge-mobile-next-copy"><strong>${escapeHtml(challenge.badgeName || 'Badge')}</strong><small>${escapeHtml(progress.remaining)}</small><span class="badge-mobile-progress"><span style="width:${progress.percent}%"></span></span></span><span aria-hidden="true">›</span>
    </button>`).join('') : '<p>Tous les badges disponibles sont obtenus !</p>'}
  </section>`;
}

async function activateBadgeSocialMission(challenge) {
  const url = challenge?.socialActionUrl;
  if (!url) return;
  if (challenge.socialNetwork === 'discord') {
    window.location.href = url;
    return;
  }
  window.open(url, '_blank', 'noopener,noreferrer');
  try {
    const response = await fetch('/api/badges/social-click', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ network: challenge.socialNetwork })
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Impossible de débloquer le badge.');
    await loadGame();
    await loadLeaderboard();
  } catch (error) {
    console.error('Erreur mission réseau social :', error);
  }
}

function closeMobileBadgeDetail() {
  $('badgeMobileDetail')?.classList.add('hidden');
  $('badgeCollectionContent')?.classList.remove('hidden');
  document.querySelector('.badge-collection-panel')?.classList.remove('mobile-detail-open');
}

function openMobileBadgeDetail(key) {
  if (!isMobileGameUi()) return;
  const challenge = (badgeData.challenges || []).find(item => item.badgeKey === key);
  const owned = (badgeData.badges || []).find(item => item.badgeKey === key);
  const badge = challenge || owned;
  if (!badge) return;
  const category = badgeCategoryOf(badge);
  const label = { watch: 'Visionnage', social: 'Réseaux sociaux', support: 'Soutien', special: 'Spéciaux' }[category];
  const progress = challenge ? badgeMobileProgress(challenge) : null;
  const unlocked = Boolean(challenge?.unlocked || owned);
  const rewards = challenge ? [
    Number(challenge.rewardLovysXp || challenge.rewardXp || 0) > 0 ? `🐉 +${Number(challenge.rewardLovysXp || challenge.rewardXp)} XP Lovys` : '',
    Number(challenge.rewardGlobalXp || 0) > 0 ? `⭐ +${Number(challenge.rewardGlobalXp)} XP globale` : '',
    Number(challenge.rewardCash || 0) > 0 ? `💰 +${Number(challenge.rewardCash)} LoVeR'Cash` : '',
    challenge.rewardTitle ? `🏷️ Titre « ${challenge.rewardTitle} »` : ''
  ].filter(Boolean) : [];
  $('badgeMobileDetailBody').innerHTML = `
    <div class="badge-mobile-detail-hero">${badgeVisual(badge)}<span class="badge-mobile-detail-category">${label}</span>
      <h3>${escapeHtml(badge.badgeName || badge.gameName || 'Badge')}</h3>
      <span class="badge-mobile-detail-state">${unlocked ? '✅ Débloqué' : '🔒 À débloquer'}</span>
    </div>
    <div class="badge-mobile-detail-section"><h4>Comment l’obtenir</h4><p>${escapeHtml(badge.badgeChallenge || 'Mission à venir')}</p>
      ${progress ? `<div class="badge-mobile-progress"><span style="width:${progress.percent}%"></span></div><small>${escapeHtml(progress.label)}${challenge.maxed ? ' · Évolution maximale' : ''}</small>` : ''}</div>
    ${rewards.length ? `<div class="badge-mobile-detail-section"><h4>Récompense</h4><div class="badge-mobile-rewards">${rewards.map(reward => `<span>${escapeHtml(reward)}</span>`).join('')}</div>${challenge.lovysXpToReserve && Number(challenge.rewardLovysXp || 0) > 0 ? '<small>L’XP Lovys est ajoutée à ta réserve.</small>' : ''}</div>` : ''}
    ${!unlocked && category === 'social' && challenge.socialActionUrl ? `<button type="button" class="badge-mobile-social-button" data-mobile-social-mission="${escapeHtml(key)}">${challenge.socialNetwork === 'discord' ? 'Rejoindre / vérifier Discord' : `Ouvrir ${escapeHtml(challenge.gameName || 'le réseau social')}`}</button>` : ''}
  `;
  $('badgeCollectionContent')?.classList.add('hidden');
  $('badgeMobileDetail')?.classList.remove('hidden');
  document.querySelector('.badge-collection-panel')?.classList.add('mobile-detail-open');
  document.querySelector('.badge-collection-panel')?.scrollTo({ top: 0 });
  $('badgeMobileDetailBack')?.focus();
}

function renderBadgeCollection() {
  const container = $('badgeCollectionContent');
  if (!container) return;

  const challenges = badgeData.challenges || [];
  const badges = badgeData.badges || [];
  const challengeKeys = new Set(challenges.map(challenge => challenge.badgeKey));
  const extraBadges = badges.filter(badge => !challengeKeys.has(badge.badgeKey));

  const categoryOf = badgeCategoryOf;

  const categoryMeta = {
    watch: { label: 'Visionnage', icon: '👀' },
    social: { label: 'Réseaux sociaux', icon: '🌐' },
    support: { label: 'Soutien', icon: '⭐' },
    special: { label: 'Spéciaux', icon: '🏆' }
  };

  function renderChallengeCard(challenge) {
    const unlocked = Boolean(challenge.unlocked);
    const isSubscriptionMission = challenge.missionType === 'subscription';
    const isGlobalEvolution = challenge.missionType === 'global-evolution';
    const isLiveAttendance = challenge.missionType === 'live-attendance';
    const isSpecialModeMission = challenge.missionType === 'special-mode';
    const isSocialMission = categoryOf(challenge) === 'social';
    const isInstantMission = isSocialMission || isSubscriptionMission;
    const watchedHours = Math.max(0, Number(challenge.watchSeconds || 0) / 3600);
    const targetHours = Number(challenge.targetHours ?? 0);
    const attendanceCount = Math.max(0, Number(challenge.attendanceCount || 0));
    const targetCount = Math.max(1, Number(challenge.targetCount || 1));
    const percent = isInstantMission
      ? (unlocked ? 100 : 0)
      : isLiveAttendance
        ? Math.min(100, attendanceCount / targetCount * 100)
        : Math.min(100, targetHours > 0 ? watchedHours / targetHours * 100 : 0);

    const progressText = isSubscriptionMission
      ? (unlocked ? 'Abonnement détecté · Badge débloqué' : 'S’abonner pour débloquer ce badge')
      : isSocialMission
        ? (unlocked ? 'Condition validée · Badge débloqué' : 'Action requise sur le réseau social')
        : isLiveAttendance
          ? (challenge.maxed
              ? `${attendanceCount} lives assistés · Évolution maximale`
              : `${attendanceCount} / ${targetCount} lives assistés`)
          : (isGlobalEvolution && challenge.maxed
              ? `${watchedHours.toFixed(1).replace('.', ',')} h · Évolution maximale`
              : `${watchedHours.toFixed(1).replace('.', ',')} h / ${targetHours} h`);

    const missionSource = isSocialMission
      ? (challenge.socialNetwork === 'discord'
          ? 'Rejoins la communauté sur Discord'
          : challenge.socialNetwork === 'instagram'
            ? 'Retrouve LoVeRDoSeTV sur Instagram'
            : challenge.socialNetwork === 'tiktok'
              ? 'Retrouve LoVeRDoSeTV sur TikTok'
              : `Réseaux sociaux · ${challenge.gameName}`)
      : isGlobalEvolution
        ? `Visionnage global · ${challenge.evolutionName || 'Fidèle de la chaîne'}`
        : isLiveAttendance
          ? `Régularité · ${challenge.evolutionName || 'Présence en live'}`
        : isSpecialModeMission
          ? `Mode spécial · ${challenge.gameName}`
          : isSubscriptionMission
            ? 'Twitch · Abonnement'
            : `Catégorie Twitch · ${challenge.gameName}`;

    const actions = unlocked ? `
      <div class="badge-card-actions">
        <button class="badge-action ${challenge.equippedSlot ? 'active' : ''}"
          type="button" data-showcase-badge="${escapeHtml(challenge.badgeKey)}">
          ${challenge.equippedSlot ? `Vitrine ${challenge.equippedSlot}` : 'Ajouter vitrine'}
        </button>
        <button class="badge-action ${challenge.leaderboardSlot ? 'active' : ''}"
          type="button" data-leaderboard-badge="${escapeHtml(challenge.badgeKey)}">
          ${challenge.leaderboardSlot ? `Classement ${challenge.leaderboardSlot}` : 'Ajouter à la carte de visite'}
        </button>
      </div>` : '';

    const socialAction = !unlocked && isSocialMission && challenge.socialActionUrl
      ? ` data-social-action="${escapeHtml(challenge.socialActionUrl)}" tabindex="0" role="link"`
      : '';
    const socialClass = !unlocked && isSocialMission && challenge.socialActionUrl ? ' social-action' : '';
    const socialCta = !unlocked && isSocialMission && challenge.socialActionUrl
      ? `<div class="badge-social-cta">${challenge.socialNetwork === 'discord'
          ? 'Cliquer pour rejoindre / vérifier Discord'
          : `Cliquer pour ouvrir ${escapeHtml(challenge.gameName)} et débloquer le badge`}</div>`
      : '';

    const progressBlock = isSocialMission
      ? (unlocked
          ? `<div class="badge-instant-complete">✓ Mission validée instantanément</div>`
          : socialCta)
      : `
        <div class="badge-challenge-progress"><span style="width:${percent}%"></span></div>
        <div class="badge-challenge-bottom">
          <span class="challenge-progress-value">${progressText}</span>
          <span class="challenge-text">${escapeHtml(challenge.badgeChallenge)}</span>
        </div>`;

    const rewardLovysXp = Math.max(0, Number(challenge.rewardLovysXp ?? challenge.rewardXp ?? 0));
    const rewardGlobalXp = Math.max(0, Number(challenge.rewardGlobalXp || 0));
    const rewardCash = Math.max(0, Number(challenge.rewardCash || 0));
    const rewardTitle = String(challenge.rewardTitle || '').trim();
    const rewardParts = [
      rewardLovysXp > 0 ? `<span class="badge-reward-pill">🐉 +${rewardLovysXp} XP Lovys</span>` : '',
      rewardGlobalXp > 0 ? `<span class="badge-reward-pill">⭐ +${rewardGlobalXp} XP globale</span>` : '',
      rewardCash > 0 ? `<span class="badge-reward-pill cash">💰 +${rewardCash} LoVeR'Cash</span>` : '',
      rewardTitle ? `<span class="badge-reward-pill">🏷️ Titre « ${escapeHtml(rewardTitle)} »</span>` : ''
    ].filter(Boolean).join('');
    const reserveNote = challenge.lovysXpToReserve && rewardLovysXp > 0
      ? `<span class="badge-reward-reserve">L’XP Lovys est ajoutée à ta réserve.</span>`
      : '';
    const rewardLabel = isGlobalEvolution
      ? (challenge.maxed
          ? '✓ Récompense finale obtenue'
          : `🎁 Palier ${Number(challenge.rewardStageHours || challenge.targetHours || 0)} h`)
      : isLiveAttendance
        ? (challenge.maxed
            ? '✓ Récompense finale obtenue'
            : `🎁 Palier ${Number(challenge.rewardStageCount || challenge.targetCount || 0)} lives`)
        : (unlocked ? '✓ Récompense obtenue' : '🎁 Récompense');
    const rewardBlock = rewardParts
      ? `<div class="badge-xp-reward"><span class="badge-reward-label">${rewardLabel}</span>${rewardParts}${reserveNote}</div>`
      : '';

    return `
      <div class="badge-challenge-card ${unlocked ? 'unlocked' : 'locked'}${socialClass}"
        data-badge-key="${escapeHtml(challenge.badgeKey)}"
        data-challenge="${escapeHtml(challenge.badgeChallenge || 'Mission à venir')}"${socialAction}>
        <div class="badge-challenge-top">
          <div class="badge-challenge-icon badge-challenge-art-wrap">${badgeVisual(challenge)}${unlocked ? '' : '<span class="badge-challenge-lock">🔒</span>'}</div>
          <div class="badge-challenge-info">
            <div class="badge-challenge-name">${escapeHtml(challenge.badgeName)}</div>
            <div class="badge-challenge-game">${escapeHtml(missionSource)}</div>
          </div>
          <div class="badge-challenge-state">${(isGlobalEvolution || isLiveAttendance) && unlocked ? `Niveau ${challenge.evolutionLevel}/${challenge.maxEvolutionLevel}` : (unlocked ? 'Débloqué' : 'À débloquer')}</div>
        </div>
        ${progressBlock}
        ${isSocialMission ? `<div class="badge-challenge-bottom"><span class="challenge-text">${escapeHtml(challenge.badgeChallenge)}</span></div>` : ''}
        ${rewardBlock}
        ${actions}
        <button type="button" class="badge-mobile-detail-button" data-mobile-badge-detail="${escapeHtml(challenge.badgeKey)}">Voir le détail →</button>
      </div>`;
  }

  function renderStatusSection(items, unlocked) {
    const activeCategoryFilter = unlocked ? unlockedBadgeCategoryFilter : badgeCategoryFilter;
    const visibleItems = activeCategoryFilter === 'all'
      ? items
      : items.filter(item => categoryOf(item) === activeCategoryFilter);

    const groups = ['watch', 'social', 'support', 'special'].map(category => {
      const grouped = visibleItems.filter(item => categoryOf(item) === category);
      if (!grouped.length) return '';
      const meta = categoryMeta[category];
      return `
        <section class="badge-category-block">
          <div class="badge-category-heading">${meta.icon} ${meta.label}<span class="badge-category-count">${grouped.length}</span></div>
          <div class="badge-challenge-grid">${grouped.map(renderChallengeCard).join('')}</div>
        </section>`;
    }).join('');

    const filterSelect = `
      <label class="badge-status-filter">
        <span>Catégorie</span>
        <select class="badge-status-select" data-badge-category-filter="${unlocked ? 'unlocked' : 'locked'}">
          <option value="all" ${activeCategoryFilter === 'all' ? 'selected' : ''}>Toutes les catégories</option>
          <option value="watch" ${activeCategoryFilter === 'watch' ? 'selected' : ''}>Visionnage</option>
          <option value="social" ${activeCategoryFilter === 'social' ? 'selected' : ''}>Réseaux sociaux</option>
          <option value="support" ${activeCategoryFilter === 'support' ? 'selected' : ''}>Soutien</option>
          <option value="special" ${activeCategoryFilter === 'special' ? 'selected' : ''}>Spéciaux</option>
        </select>
      </label>`;

    const emptyMessage = unlocked
      ? (activeCategoryFilter === 'all'
          ? 'Aucun badge débloqué pour le moment.'
          : 'Aucun badge débloqué dans cette catégorie.')
      : (activeCategoryFilter === 'all'
          ? 'Tous les badges disponibles sont débloqués.'
          : 'Aucun badge à débloquer dans cette catégorie.');

    return `
      <section class="badge-status-section">
        <div class="badge-status-header ${unlocked ? 'unlocked' : 'locked'}">
          <div class="badge-status-header-main">${unlocked ? '✅ Badges débloqués' : '🔒 Badges à débloquer'}</div>
          ${filterSelect}
        </div>
        ${groups || `<div class="badge-empty">${emptyMessage}</div>`}
      </section>`;
  }

  const unlockedChallenges = challenges.filter(item => Boolean(item.unlocked));
  const lockedChallenges = challenges.filter(item => !item.unlocked);

  const unlockedHtml = renderStatusSection(unlockedChallenges, true);
  const lockedHtml = renderStatusSection(lockedChallenges, false);
  const filterTabs = `
    <div class="badge-filter-tabs" role="tablist" aria-label="Filtrer les badges">
      <button class="badge-filter-tab unlocked ${badgeCollectionView === 'unlocked' ? 'active' : ''}" type="button" data-badge-view="unlocked">✅ Débloqués <span class="badge-filter-count">${unlockedChallenges.length}</span></button>
      <button class="badge-filter-tab locked ${badgeCollectionView === 'locked' ? 'active' : ''}" type="button" data-badge-view="locked">🔒 À débloquer <span class="badge-filter-count">${lockedChallenges.length}</span></button>
    </div>`;

  const extraHtml = extraBadges.length ? `
    <div class="badge-modal-section-title" style="margin-top:18px;">Autres badges débloqués</div>
    <div class="badge-collection-grid">
      ${extraBadges.map(badge => `
        <div class="badge-card" data-challenge="${escapeHtml(badge.badgeChallenge || 'Mission à venir')}">
          ${badgeVisual(badge)}
          <div class="badge-card-title">${escapeHtml(badge.badgeName || badge.gameName || 'Badge')}</div>
          ${badge.gameName ? `<div class="badge-card-sub">${escapeHtml(badge.gameName)}</div>` : ''}
          <button type="button" class="badge-mobile-detail-button" data-mobile-badge-detail="${escapeHtml(badge.badgeKey)}">Voir le détail →</button>
        </div>`).join('')}
    </div>` : '';

  const selectedHtml = badgeCollectionView === 'locked' ? lockedHtml : unlockedHtml;
  container.innerHTML = renderMobileNextBadges(challenges) + filterTabs + selectedHtml;

  if (badgeCollectionView === 'unlocked' && extraHtml) container.insertAdjacentHTML('beforeend', extraHtml);

  container.querySelectorAll('[data-badge-view]').forEach(button => {
    button.addEventListener('click', () => {
      badgeCollectionView = button.dataset.badgeView === 'locked' ? 'locked' : 'unlocked';
      renderBadgeCollection();
    });
  });

  container.querySelectorAll('[data-badge-category-filter]').forEach(categoryFilterSelect => {
    categoryFilterSelect.addEventListener('change', () => {
      const filterValue = categoryFilterSelect.value || 'all';
      if (categoryFilterSelect.dataset.badgeCategoryFilter === 'unlocked') {
        unlockedBadgeCategoryFilter = filterValue;
      } else {
        badgeCategoryFilter = filterValue;
      }
      renderBadgeCollection();
    });
  });

  container.querySelectorAll('[data-social-action]').forEach(card => {
    const challengeKey = card.getAttribute('data-badge-key');
    const challenge = (badgeData.challenges || []).find(item => item.badgeKey === challengeKey);

    const openSocial = () => activateBadgeSocialMission(challenge);

    card.addEventListener('click', event => {
      if (isMobileGameUi()) return;
      if (event.target.closest('button')) return;
      openSocial();
    });
    card.addEventListener('keydown', event => {
      if (isMobileGameUi()) return;
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        openSocial();
      }
    });
  });
}

async function equipBadge(badgeKey) {
  const badge = (badgeData.badges || []).find(item => item.badgeKey === badgeKey);
  if (!badge) return;

  if (badge.equippedSlot) {
    await unequipBadge(Number(badge.equippedSlot));
    return;
  }

  const occupied = new Set(
    (badgeData.badges || [])
      .filter(item => item.equippedSlot)
      .map(item => Number(item.equippedSlot))
  );

  const freeSlot = [1,2,3,4,5,6].find(slot => !occupied.has(slot));

  if (!freeSlot) {
    alert('Ta vitrine est pleine. Retire d’abord un badge exposé.');
    return;
  }

  const response = await fetch('/api/badges/equip', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ badgeKey, slot: freeSlot })
  });

  const data = await response.json();
  if (!response.ok) return alert(data.error || 'Impossible d’ajouter le badge à la vitrine.');

  await loadBadges();
}

async function unequipBadge(slot) {
  const response = await fetch('/api/badges/unequip', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ slot })
  });

  const data = await response.json();
  if (!response.ok) return alert(data.error || 'Impossible de retirer le badge de la vitrine.');

  await loadBadges();
}

async function equipLeaderboardBadge(badgeKey) {
  const badge = (badgeData.badges || []).find(item => item.badgeKey === badgeKey);
  if (!badge) return;

  if (badge.leaderboardSlot) {
    await unequipLeaderboardBadge(Number(badge.leaderboardSlot));
    return;
  }

  const response = await fetch('/api/badges/leaderboard/equip', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ badgeKey })
  });

  const data = await response.json();
  if (!response.ok) return alert(data.error || 'Impossible d’afficher ce badge dans le classement.');

  await loadBadges();
  await loadLeaderboard();
}

async function unequipLeaderboardBadge(slot) {
  const response = await fetch('/api/badges/leaderboard/unequip', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ slot })
  });

  const data = await response.json();
  if (!response.ok) return alert(data.error || 'Impossible de retirer ce badge du classement.');

  await loadBadges();
  await loadLeaderboard();
}

function openBadgeShowcaseModal() {
  closeMobileBadgeDetail();
  renderBadgeShowcase();
  renderBadgeCollection();
  $('badgeCollectionModal')?.classList.remove('hidden');
}

$('openBadgeCollection')?.addEventListener('click', openBadgeShowcaseModal);
$('openBadgeShowcase')?.addEventListener('click', openBadgeShowcaseModal);
$('playerCardBadgesTrigger')?.addEventListener('click', openBadgeShowcaseModal);
$('playerCardBadgesTrigger')?.addEventListener('keydown', event => {
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    openBadgeShowcaseModal();
  }
});

$('badgeCollectionClose')?.addEventListener('click', () => {
  closeMobileBadgeDetail();
  $('badgeCollectionModal')?.classList.add('hidden');
});
$('badgeMobileDetailBack')?.addEventListener('click', closeMobileBadgeDetail);
$('badgeMobileDetailBody')?.addEventListener('click', event => {
  const button = event.target.closest('[data-mobile-social-mission]');
  if (!button) return;
  const challenge = (badgeData.challenges || []).find(item => item.badgeKey === button.dataset.mobileSocialMission);
  if (!challenge) return;
  closeMobileBadgeDetail();
  activateBadgeSocialMission(challenge);
});


let badgeBackdropMouseDown = false;

$('badgeCollectionModal')?.addEventListener('mousedown', event => {
  badgeBackdropMouseDown = event.target.id === 'badgeCollectionModal';
});

$('badgeCollectionModal')?.addEventListener('mouseup', event => {
  if (badgeBackdropMouseDown && event.target.id === 'badgeCollectionModal') {
    closeMobileBadgeDetail();
    $('badgeCollectionModal')?.classList.add('hidden');
  }
  badgeBackdropMouseDown = false;
});

$('badgeCollectionContent')?.addEventListener('click', event => {
  if (isMobileGameUi()) {
    const detailButton = event.target.closest('[data-mobile-badge-detail]');
    const badgeCard = event.target.closest('.badge-challenge-card[data-badge-key]');
    if (detailButton || (badgeCard && !event.target.closest('button'))) {
      openMobileBadgeDetail(detailButton?.dataset.mobileBadgeDetail || badgeCard.dataset.badgeKey);
      return;
    }
  }
  const showcaseButton = event.target.closest('[data-showcase-badge]');
  if (showcaseButton) {
    equipBadge(showcaseButton.dataset.showcaseBadge);
    return;
  }

  const leaderboardButton = event.target.closest('[data-leaderboard-badge]');
  if (leaderboardButton) {
    equipLeaderboardBadge(leaderboardButton.dataset.leaderboardBadge);
  }
});



let hatchCinematicCallback = null;
let hatchCinematicTimers = [];
let hatchAudioContext = null;

function prepareHatchAudio() {
  try {
    if (!hatchAudioContext) hatchAudioContext = new (window.AudioContext || window.webkitAudioContext)();
    if (hatchAudioContext.state === 'suspended') hatchAudioContext.resume();
  } catch (_) {}
}

function hatchTone(frequency = 440, duration = .12, gain = .035, type = 'sine', delay = 0) {
  try {
    if (!hatchAudioContext || hatchAudioContext.state !== 'running') return;
    const now = hatchAudioContext.currentTime + delay;
    const osc = hatchAudioContext.createOscillator();
    const amp = hatchAudioContext.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(frequency, now);
    amp.gain.setValueAtTime(.0001, now);
    amp.gain.exponentialRampToValueAtTime(Math.max(.001, gain), now + .015);
    amp.gain.exponentialRampToValueAtTime(.0001, now + duration);
    osc.connect(amp);
    amp.connect(hatchAudioContext.destination);
    osc.start(now);
    osc.stop(now + duration + .04);
  } catch (_) {}
}

function hatchSoundStep(kind) {
  if (kind === 'shake') {
    hatchTone(130,.08,.018,'triangle');
    hatchTone(170,.08,.012,'triangle',.09);
  } else if (kind === 'crack') {
    hatchTone(520,.06,.025,'square');
    hatchTone(740,.08,.018,'square',.06);
  } else if (kind === 'burst') {
    hatchTone(220,.20,.035,'sine');
    hatchTone(440,.24,.028,'sine',.03);
    hatchTone(880,.34,.020,'sine',.08);
  } else if (kind === 'reveal') {
    hatchTone(523.25,.25,.025,'sine');
    hatchTone(659.25,.28,.025,'sine',.10);
    hatchTone(783.99,.36,.030,'sine',.20);
  }
}

function hatchRarityKey(rarity) {
  const value = String(rarity || '').toLowerCase();
  if (value.includes('myth')) return 'mythic';
  if (value.includes('épique') || value.includes('epique')) return 'epic';
  if (value.includes('rare')) return 'rare';
  return 'common';
}

function buildHatchParticles(rarityKey) {
  const box = $('hatchParticles');
  if (!box) return;
  const counts = { common:22, rare:28, epic:34, mythic:42 };
  const count = counts[rarityKey] || 22;
  let html = '';
  for (let i = 0; i < count; i++) {
    const angle = (Math.PI * 2 * i / count) + ((i % 3) * .09);
    const radius = 115 + (i % 7) * 13;
    const x = Math.round(Math.cos(angle) * radius);
    const y = Math.round(Math.sin(angle) * radius);
    const delay = ((i % 8) * .035).toFixed(2);
    const dur = (0.85 + (i % 6) * .08).toFixed(2);
    const size = 4 + (i % 5);
    html += `<span class="hatch-particle" style="--x:${x}px;--y:${y}px;--delay:${delay}s;--dur:${dur}s;width:${size}px;height:${size}px"></span>`;
  }
  box.innerHTML = html;
}

function clearHatchTimers() {
  hatchCinematicTimers.forEach(timer => clearTimeout(timer));
  hatchCinematicTimers = [];
}

function setHatchPhase(phase) {
  const modal = $('hatchCinematic');
  if (!modal) return;
  modal.classList.remove('phase-shake','phase-crack','phase-burst','phase-silhouette','phase-reveal','phase-done');
  if (phase) modal.classList.add(`phase-${phase}`);
}

function finishHatchAnimation() {
  clearHatchTimers();
  setHatchPhase('done');
  if ($('hatchTopline')) $('hatchTopline').textContent = 'Nouveau Lovys obtenu';
}

async function closeHatchAnimation() {
  clearHatchTimers();
  const modal = $('hatchCinematic');
  if (modal) {
    modal.classList.remove('active','phase-shake','phase-crack','phase-burst','phase-silhouette','phase-reveal','phase-done');
    modal.classList.add('hidden');
  }
  document.body.style.overflow = '';
  const callback = hatchCinematicCallback;
  hatchCinematicCallback = null;
  if (callback) await callback();
}

function playHatchAnimation(creature, callback) {
  const modal = $('hatchCinematic');
  if (!modal || !creature) {
    if (callback) callback();
    return;
  }

  prepareHatchAudio();
  clearHatchTimers();
  hatchCinematicCallback = callback || null;

  const rarityKey = hatchRarityKey(creature.rarity);
  modal.dataset.rarity = rarityKey;
  $('hatchEggWrap').innerHTML = incubatorEggMarkup();
  $('hatchCreatureArt').innerHTML = art(creature.id, 0, true) || `<div class="lovys-home-egg-icon">🐉</div>`;
  $('hatchRarity').textContent = creature.rarity || 'Lovys';
  $('hatchCinematicName').textContent = creature.duplicate ? `${creature.name || 'Lovys'} déjà possédé !` : `${creature.name || 'Ton Lovys'} est né !`;
  $('hatchCinematicMeta').textContent = creature.duplicate ? `${creature.type || 'Type inconnu'} · doublon converti en fragments` : `${creature.type || 'Type inconnu'} · ${creature.rarity || 'Lovys'}${Number.isFinite(Number(creature.dropRate)) ? ` · ${String(creature.dropRate).replace('.', ',')} %` : ''}`;
  $('hatchCinematicMessage').textContent = creature.duplicate ? creature.universalFragmentsGained ? `♻️ ${creature.name} est déjà rang MAX : +${Number(creature.universalFragmentsGained||0)} fragments universels.` : `♻️ +${Number(creature.fragmentsGained||0)} fragments de ${creature.name}. Utilise-les pour augmenter son rang ⭐.` :
    rarityKey === 'mythic' ? 'Incroyable… tu viens d’obtenir un Lovys mythique !' :
    rarityKey === 'epic' ? 'Une énergie exceptionnelle se dégage de ton nouvel allié.' :
    rarityKey === 'rare' ? 'Un Lovys rare rejoint ta collection.' :
    'Ton nouveau Lovys rejoint ta collection.';
  $('hatchTopline').textContent = 'Quelque chose se passe…';
  buildHatchParticles(rarityKey);

  modal.className = 'hatch-cinematic active';
  modal.classList.remove('hidden');
  document.body.style.overflow = 'hidden';

  const extra = rarityKey === 'mythic' ? 650 : rarityKey === 'epic' ? 300 : 0;

  hatchCinematicTimers.push(setTimeout(() => {
    setHatchPhase('shake');
    $('hatchTopline').textContent = 'L’œuf commence à bouger…';
    hatchSoundStep('shake');
  }, 350));

  hatchCinematicTimers.push(setTimeout(() => {
    setHatchPhase('crack');
    $('hatchTopline').textContent = 'La coquille se fissure !';
    hatchSoundStep('crack');
  }, 1500 + extra * .25));

  hatchCinematicTimers.push(setTimeout(() => {
    setHatchPhase('burst');
    $('hatchTopline').textContent = 'Une énergie se libère…';
    hatchSoundStep('burst');
  }, 2400 + extra * .45));

  hatchCinematicTimers.push(setTimeout(() => {
    setHatchPhase('silhouette');
  }, 2900 + extra * .60));

  hatchCinematicTimers.push(setTimeout(() => {
    setHatchPhase('reveal');
    $('hatchTopline').textContent = 'Ton Lovys apparaît !';
    hatchSoundStep('reveal');
  }, 3350 + extra * .72));

  hatchCinematicTimers.push(setTimeout(() => {
    finishHatchAnimation();
  }, 4250 + extra));
}

$('hatchContinue')?.addEventListener('click', closeHatchAnimation);
$('hatchSkip')?.addEventListener('click', finishHatchAnimation);


function renderGame() {
  if (!me?.user) return;

  if (me.user.creature_id) {
    $('pick').classList.add('hidden');
    $('game').classList.remove('hidden');
    updateStats(me.user);
    return;
  }

  $('pick').classList.remove('hidden');
  $('game').classList.add('hidden');
  updateEgg(me.user.egg);
  maybeShowGameIntro();
  scheduleTopDashboardSync();
}

async function hatchEgg() {
  const button = $('hatchEgg');
  if (button.disabled) return;

  prepareHatchAudio();
  button.disabled = true;
  button.textContent = 'Éclosion...';

  try {
    const response = await fetch('/api/egg/hatch', { method: 'POST' });
    const data = await response.json();

    if (!response.ok) {
      if (data.egg) updateEgg(data.egg);
      alert(data.error || 'Impossible de faire éclore l’œuf.');
      return;
    }

    const creature = data.creature;

    playHatchAnimation(
      creature,
      async () => {
        showGame();
        await loadGame();
      }
    );
  } catch (error) {
    console.error('Erreur éclosion :', error);
    alert('Impossible de contacter le serveur.');
  } finally {
    button.textContent = "Faire éclore l'œuf";
    if (me?.user?.egg?.ready) button.disabled = false;
  }
}

$('hatchEgg')?.addEventListener('click', hatchEgg);

function updateStats(u) {
  const p = u.progression;
  const c = creatureById(u.creature_id);
  if (!c) return;

  $('creatureTitle').textContent = `${c.name} — niveau ${p.level}`;
  $('evolution').textContent = p.evolutionName;
  $('mainCreature').innerHTML = art(c.id, p.evolution);
  $('topIncubatorEgg')?.classList.remove('hidden');
  $('topIncubatorEggArt')?.classList.add('hidden');
  $('topIncubatorPendingWrap')?.classList.add('hidden');
  if ($('topIncubatorSubtitle')) $('topIncubatorSubtitle').textContent = 'Tes emplacements d’incubation.';
  if ($('topIncubatorTitle')) $('topIncubatorTitle').textContent = 'Emplacement libre';
  if ($('topIncubatorProgressBar')) $('topIncubatorProgressBar').style.width = '0%';
  if ($('topIncubatorTime')) $('topIncubatorTime').textContent = 'Aucun œuf';
  if ($('topIncubatorStatus')) $('topIncubatorStatus').textContent = 'Prêt pour un nouvel œuf.';
  $('xp').textContent = Math.floor(u.xp);
  syncLoverCashDisplays(u);
  $('watch').innerHTML = `${Math.floor(u.watch_seconds / 60)} <small>min</small>`;

  const pct = p.maxLevel
    ? 100
    : Math.max(0, Math.min(100,
        ((u.xp - p.currentThreshold) /
        (p.nextThreshold - p.currentThreshold)) * 100
      ));

  $('xpbar').style.width = pct + '%';
  $('levelText').textContent = p.maxLevel
    ? 'Niveau maximum atteint · XP continue à être enregistrée'
    : `${Math.floor(u.xp - p.currentThreshold)} / ${Math.ceil(p.nextThreshold - p.currentThreshold)} XP pour le niveau suivant`;

  $('subBadge').classList.toggle('hidden', !u.is_sub);
  scheduleTopDashboardSync();
}

let leaderboardSearchTimer = null;
let leaderboardPlayers = [];
let leaderboardMetric = 'watch';

const LEADERBOARD_METRICS = {
  watch: { label: 'Visionnage', icon: '👁️', heading: 'Classé par temps de visionnage', description: 'Le temps total enregistré par LoVeR Watch Game détermine ta position.' },
  level: { label: 'Niveau global', icon: '⭐', heading: 'Classé par progression globale', description: 'Le classement suit ton XP globale et ton niveau général.' },
  pve: { label: 'PvE', icon: '⚔️', heading: 'Classé par victoires PvE', description: 'Chaque victoire enregistrée dans les combats PvE compte.' },
  collection: { label: 'Collection', icon: '🧬', heading: 'Classé par Lovys éclos', description: 'Chaque éclosion compte, y compris lorsqu’un doublon est converti en fragments.' }
};

function formatLeaderboardDuration(totalSeconds) {
  const seconds = Math.max(0, Number(totalSeconds) || 0);
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return `${hours} h ${String(minutes).padStart(2, '0')}`;
}
function leaderboardScoreValue(player, metric=leaderboardMetric) {
  if (metric === 'level') return Math.max(0, Number(player.global_xp || 0));
  if (metric === 'pve') return Math.max(0, Number(player.pve_wins || 0));
  if (metric === 'collection') return Math.max(0, Number(player.hatched_count || 0));
  return Math.max(0, Number(player.watch_seconds || 0));
}
function leaderboardScoreText(player, metric=leaderboardMetric) {
  if (metric === 'level') return `Niv. ${Number(player.global_progression?.level || 1)} · ${Math.floor(Number(player.global_xp || 0)).toLocaleString('fr-FR')} XP`;
  if (metric === 'pve') return `${Number(player.pve_wins || 0)} victoire${Number(player.pve_wins || 0) > 1 ? 's' : ''}`;
  if (metric === 'collection') { const n = Number(player.hatched_count || 0); return `${n} Lovys éclos`; }
  return formatLeaderboardDuration(player.watch_seconds);
}
function leaderboardGapText(self, previous, metric=leaderboardMetric) {
  if (!previous) return 'Tu es actuellement en tête de ce classement.';
  const gap = Math.max(0, leaderboardScoreValue(previous, metric) - leaderboardScoreValue(self, metric));
  if (metric === 'watch') return `Encore ${formatLeaderboardDuration(gap + 60)} environ pour dépasser #${Number(previous.rank || self.rank - 1)}.`;
  if (metric === 'level') return `Encore ${(gap + 1).toLocaleString('fr-FR')} XP globale pour dépasser #${Number(previous.rank || self.rank - 1)}.`;
  if (metric === 'pve') return `Encore ${gap + 1} victoire${gap + 1 > 1 ? 's' : ''} PvE pour dépasser #${Number(previous.rank || self.rank - 1)}.`;
  if (metric === 'collection') return `Encore ${gap + 1} éclosion${gap + 1 > 1 ? 's' : ''} pour dépasser #${Number(previous.rank || self.rank - 1)}.`;
  return '';
}

function applyLeaderboardCanonicalLayout(isSearch = false) {
  if (!isDesktopGameUi()) return;
  const board = document.querySelector('.global-leaderboard');
  const container = $('leaderboard');
  const important = (el, prop, value) => el?.style.setProperty(prop, value, 'important');
  // Le classement ne doit jamais pouvoir traverser sur une autre page PC.
  // V184 utilise display:contents en recherche : sans ce garde, ses enfants
  // restent visibles même lorsque l'aside parent est censé être masqué.
  if (document.body.dataset.desktopView !== 'leaderboard') {
    important(board, 'display', 'none');
    return;
  }
  if (board) {
    ['background','background-image','box-shadow','border','backdrop-filter','-webkit-backdrop-filter'].forEach(prop => important(board, prop, prop === 'border' ? '0' : prop.includes('filter') ? 'none' : prop.includes('shadow') ? 'none' : 'transparent'));
    important(board, 'height', 'auto'); important(board, 'min-height', '0'); important(board, 'max-height', 'none');
    // En mode recherche, l'aside historique ne génère plus aucune boîte visuelle.
    // display:contents conserve h2, recherche et résultats dans le flux mais supprime
    // complètement la surface rectangulaire de .global-leaderboard.
    important(board, 'display', isSearch ? 'contents' : 'block');
  }
  if (container) {
    important(container, 'background', 'transparent'); important(container, 'background-image', 'none');
    important(container, 'border', '0'); important(container, 'box-shadow', 'none'); important(container, 'min-height', '0');
    // En recherche, #leaderboard ne doit plus avoir de boîte propre : cela neutralise
    // définitivement les anciens fonds/panneaux hérités des versions précédentes.
    important(container, 'display', isSearch ? 'contents' : 'block');
  }
  if (isSearch) {
    const results = container?.querySelector('.leaderboard-search-results');
    const summary = container?.querySelector('.leaderboard-search-summary');
    const list = container?.querySelector('.leaderboard-v150-list');
    // Même principe pour le wrapper de recherche : aucun rectangle ne peut être peint.
    if (results) {
      important(results, 'display', 'contents');
      important(results, 'background', 'transparent'); important(results, 'background-image', 'none');
      important(results, 'border', '0'); important(results, 'box-shadow', 'none'); important(results, 'padding', '0');
    }
    [summary, list].forEach(el => {
      important(el, 'width', 'min(1000px, calc(100vw - 96px))'); important(el, 'max-width', '1000px');
      important(el, 'margin-left', 'auto'); important(el, 'margin-right', 'auto');
      important(el, 'background', 'transparent'); important(el, 'background-image', 'none'); important(el, 'border', '0'); important(el, 'box-shadow', 'none');
    });
    if (summary) {
      important(summary, 'display', 'flex'); important(summary, 'align-items', 'center'); important(summary, 'justify-content', 'center');
      important(summary, 'gap', '16px'); important(summary, 'padding', '4px 0 14px');
    }
    if (list) { important(list, 'padding', '0'); important(list, 'gap', '8px'); }
    container?.querySelectorAll('.leaderboard-v150-row').forEach(row => {
      important(row, 'width', '100%'); important(row, 'min-height', '72px'); important(row, 'padding', '11px 14px');
    });
    container?.querySelectorAll('.leaderboard-v154-row-content').forEach(row => {
      important(row, 'grid-template-columns', '56px 52px minmax(190px,1.35fr) 125px minmax(175px,1fr) 145px');
      important(row, 'gap', '12px');
    });
  } else {
    ['.leaderboard-v151-tabs','.leaderboard-v150-head','.leaderboard-v150-my-position'].forEach(sel => {
      const el=container?.querySelector(sel); if(!el)return;
      important(el, 'width', 'min(760px, 100%)'); important(el, 'max-width', '760px'); important(el, 'margin-left', 'auto'); important(el, 'margin-right', 'auto');
    });
  }
}

async function loadLeaderboard(searchTerm = null, metric = null) {
  const container = $('leaderboard');
  const searchInput = $('leaderboardSearch');
  if (metric && LEADERBOARD_METRICS[metric]) leaderboardMetric = metric;
  const activeMetric = leaderboardMetric;
  const meta = LEADERBOARD_METRICS[activeMetric];
  const query = searchTerm === null ? String(searchInput?.value || '').trim() : String(searchTerm || '').trim();
  try {
    const params = new URLSearchParams({ metric: activeMetric });
    if (query) params.set('search', query);
    const response = await fetch(`/api/leaderboard?${params.toString()}`, { cache: 'no-store' });
    const data = await response.json();
    if (!data.leaderboard || data.leaderboard.length === 0) {
      container.innerHTML = query ? '<div class="leaderboard-empty-search">Aucun joueur trouvé.</div>' : '<p class="muted">Aucun joueur pour le moment.</p>';
      return;
    }
    leaderboardPlayers = data.leaderboard;
    const players = data.leaderboard;
    const selfTwitchId = String(me?.user?.twitch_id || '');
    const selfIndex = players.findIndex(player => String(player.twitch_id || '') === selfTwitchId);
    const self = selfIndex >= 0 ? players[selfIndex] : null;
    const previous = selfIndex > 0 ? players[selfIndex - 1] : null;
    const creatureMeta = player => player.creature_id ? resolveLovysEntry(player.creature_id) : null;
    const leaderboardLovysImage = player => { const id = String(player.creature_id || '').toLowerCase(); const images = {water:'/Nymea.webp',plant:'/Mossy.webp',lightning:'/Voltis.webp',mist:'/Brumee.webp',fire:'/Flamby.webp',crystal:'/Crysal.webp',forge:'/Ferox.webp',dark:'/Nocty.webp',solar:'/Solka.webp',dream:'/Mimo.webp',nyméa:'/Nymea.webp',nymea:'/Nymea.webp',mossy:'/Mossy.webp',voltis:'/Voltis.webp',brumee:'/Brumee.webp',flamby:'/Flamby.webp',crysal:'/Crysal.webp',ferox:'/Ferox.webp',nocty:'/Nocty.webp',solka:'/Solka.webp',mimo:'/Mimo.webp'}; return images[id] || creatureMeta(player)?.image || ''; };
    const playerTitle = player => player.cosmetic_title ? `<div class="leaderboard-v150-title" style="color:${escapeHtml(player.cosmetic_title_color || '#d9c8ff')}">&quot;${escapeHtml(player.cosmetic_title)}&quot;</div>` : '<div class="leaderboard-v150-title muted">Aucun titre équipé</div>';
    const avatarHtml = (player, cls='') => { const frame = profileAvatarFrameStyle(player.cosmetic_avatar_frame); return player.profile_image_url ? `<img loading="lazy" decoding="async" class="leaderboard-v150-avatar ${cls}" style="${escapeHtml(frame ? `border-color:${frame.border};box-shadow:${frame.shadow};` : '')}" src="${escapeHtml(player.profile_image_url)}" alt="">` : `<div class="leaderboard-v150-avatar leaderboard-v150-avatar-fallback ${cls}">👤</div>`; };
    const lovysHtml = (player, large=false) => { const creature = creatureMeta(player); if (!creature) return `<div class="leaderboard-v150-lovys empty">🥚 Aucun Lovys actif</div>`; const level = Number(player.progression?.level || 1); return `<div class="leaderboard-v150-lovys${large ? ' large' : ''}"><img src="${escapeHtml(leaderboardLovysImage(player))}" alt=""><span><strong>${escapeHtml(creature.name)}</strong><small>Niv. ${level}</small></span></div>`; };
    const rankLabel = rank => rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `#${rank}`;
    const cardCosmeticStyle = player => { const frame = profileFrameStyle(player.cosmetic_frame); const bg = profileBackgroundValue(player.cosmetic_background); return `${bg && bg !== 'none' ? `background-image:${bg};--leaderboard-card-bg:${bg};` : ''}${frame ? `border-color:${frame.border};box-shadow:${frame.shadow};--leaderboard-card-border:${frame.border};--leaderboard-card-shadow:${frame.shadow};` : ''}`; };
    const cardCosmeticClass = player => `${player.cosmetic_background ? ' has-cosmetic-background' : ''}${player.cosmetic_frame ? ' has-cosmetic-frame' : ''}`;
    const leaderboardBadgesHtml = (player, compact=false) => { const badges = Array.isArray(player.leaderboard_badges) ? player.leaderboard_badges.slice(0, 2) : []; if (!badges.length) return ''; return `<div class="leaderboard-v154-badges${compact ? ' compact' : ''}" aria-label="Badges affichés">${badges.map(badge => { const label = badge.badgeName || 'Badge'; const tooltip = `${label}${badge.badgeChallenge ? ` — ${badge.badgeChallenge}` : ''}`; return `<span class="leaderboard-v154-badge" title="${escapeHtml(tooltip)}">${badge.badgeImage ? `<img loading="lazy" decoding="async" src="${escapeHtml(badge.badgeImage)}" alt="${escapeHtml(label)}">` : '🏅'}</span>`; }).join('')}</div>`; };
    const podiumCard = player => { const rank = Number(player.rank || 0), globalLevel = Number(player.global_progression?.level || 1), isSelf = String(player.twitch_id || '') === selfTwitchId; return `<button type="button" class="leaderboard-v150-podium-card leaderboard-v154-profile-card rank-${rank}${isSelf ? ' is-self' : ''}${cardCosmeticClass(player)}" style="${escapeHtml(cardCosmeticStyle(player))}" data-player-index="${players.indexOf(player)}"><div class="leaderboard-v154-card-shade"></div><div class="leaderboard-v154-card-content"><div class="leaderboard-v150-medal">${rankLabel(rank)}</div>${avatarHtml(player, 'podium-avatar')}<div class="leaderboard-v150-name">${escapeHtml(player.display_name)}</div>${playerTitle(player)}${leaderboardBadgesHtml(player)}${lovysHtml(player, true)}<div class="leaderboard-v150-global">Niveau global ${globalLevel}</div><div class="leaderboard-v150-score">${meta.icon} ${escapeHtml(leaderboardScoreText(player, activeMetric))}</div></div></button>`; };
    const listRow = player => { const idx = players.indexOf(player), rank = Number(player.rank || idx + 1), globalLevel = Number(player.global_progression?.level || 1), isSelf = String(player.twitch_id || '') === selfTwitchId; return `<button type="button" class="leaderboard-v150-row leaderboard-v154-profile-card${isSelf ? ' is-self' : ''}${cardCosmeticClass(player)}" style="${escapeHtml(cardCosmeticStyle(player))}" data-player-index="${idx}"><div class="leaderboard-v154-card-shade"></div><div class="leaderboard-v154-row-content"><div class="leaderboard-v150-row-rank">${rankLabel(rank)}</div>${avatarHtml(player)}<div class="leaderboard-v150-row-main"><strong>${escapeHtml(player.display_name)}</strong>${playerTitle(player)}${leaderboardBadgesHtml(player, true)}</div><div class="leaderboard-v150-row-level">Niv. global <strong>${globalLevel}</strong></div>${lovysHtml(player)}<div class="leaderboard-v150-row-score"><small>${escapeHtml(meta.label)}</small><strong>${escapeHtml(leaderboardScoreText(player, activeMetric))}</strong></div></div></button>`; };
    const tabs = `<div class="leaderboard-v151-tabs">${Object.entries(LEADERBOARD_METRICS).map(([key,item])=>`<button type="button" class="${key===activeMetric?'active':''}" data-leaderboard-metric="${key}">${item.icon} ${escapeHtml(item.label)}</button>`).join('')}</div>`;
    let myPositionHtml = '';
    if (self) myPositionHtml = `<div class="leaderboard-v150-my-position"><div><span>📍 Ma position · ${escapeHtml(meta.label)}</span><strong>#${Number(self.rank)} · ${escapeHtml(leaderboardScoreText(self, activeMetric))}</strong></div><p>${leaderboardGapText(self, previous, activeMetric)}</p></div>`;
    if (query) {
      document.body.classList.add('leaderboard-search-active');
      container.innerHTML = `<div class="leaderboard-search-results"><div class="leaderboard-search-summary"><strong>${players.length} joueur${players.length > 1 ? 's' : ''} trouvé${players.length > 1 ? 's' : ''}</strong><span>Recherche : ${escapeHtml(query)}</span></div><div class="leaderboard-v150-list">${players.map(listRow).join('')}</div></div>`;
      applyLeaderboardCanonicalLayout(true);
      return;
    }
    document.body.classList.remove('leaderboard-search-active');
    const top3 = players.filter(p => Number(p.rank) <= 3), orderedPodium = (isMobileGameUi() ? [1,2,3] : [2,1,3]).map(rank=>top3.find(p=>Number(p.rank)===rank)).filter(Boolean), rest = players.filter(p => Number(p.rank) >= 4);
    container.innerHTML = `${tabs}<div class="leaderboard-v150-head"><div><strong>${meta.icon} ${escapeHtml(meta.heading)}</strong><span>${escapeHtml(meta.description)}</span></div></div>${myPositionHtml}<section class="leaderboard-v150-podium" aria-label="Podium du classement">${orderedPodium.map(podiumCard).join('')}</section>${rest.length ? `<div class="leaderboard-v150-list-title">Classement général</div><div class="leaderboard-v150-list">${rest.map(listRow).join('')}</div>` : ''}`;
    applyLeaderboardCanonicalLayout(false);
  } catch (error) { console.error('Erreur classement :', error); container.innerHTML = '<p class="muted">Impossible de charger le classement.</p>'; }
}
function progressionPct(current,total){return Math.max(0,Math.min(100,total>0?(current/total)*100:0));}
async function loadProgression(){
  const box=$('progressionContent');
  if(!box)return;
  box.innerHTML='<p class="muted">Chargement…</p>';
  try{
    const r=await fetch('/api/progression',{cache:'no-store'}),d=await r.json();
    if(!r.ok)throw new Error(d.error||'Erreur');
    const g=d.globalProgression||{},cp=d.creatureProgression||{};
    const currentLevel=Math.max(1,Math.min(55,Number(g.level||1)));
    const percent=progressionPct(g.xpIntoLevel,g.xpForNextLevel);
    const grade=d.grade||{};
    const gradeList=Array.isArray(d.grades)?d.grades:[];
    const globalLevelXpRewards=Array.isArray(d.globalLevelXpRewards)?d.globalLevelXpRewards:[];
    const globalLevelCashRewards=Array.isArray(d.globalLevelCashRewards)?d.globalLevelCashRewards:[];
    const lovysXpRewards=Array.isArray(d.globalLovysXpRewards)?d.globalLovysXpRewards:[];
    const rewardForLevel=(level)=>{
      const gr=gradeList.find(x=>Number(x.min)===level);
      const globalXpReward=globalLevelXpRewards.find(x=>Number(x.level)===level);
      const cashReward=globalLevelCashRewards.find(x=>Number(x.level)===level);
      const xpReward=lovysXpRewards.find(x=>Number(x.level)===level);
      const parts=[];
      let icon='';
      if(gr){ icon='🏅'; parts.push(`Titre ${gr.name||''}`.trim()); }
      if(level===55){ icon='🏆'; parts.push('Fond Ascension'); }
      if(globalXpReward){ if(!icon)icon='⭐'; parts.push(`+${Number(globalXpReward.xp||0)} XP globale`); }
      if(cashReward){ if(!icon)icon='💰'; parts.push(`+${Number(cashReward.cash||0)} LoVeR'Cash`); }
      if(xpReward){ if(!icon)icon='🐉'; parts.push(`+${Number(xpReward.xp||0)} XP Lovys`); }
      return parts.length?{icon,name:parts.join(' · ')}:null;
    };
    const previewForLevel=(level)=>{
      const lvl=Math.max(1,Math.min(55,Number(level||1)));
      const gradeAtLevel=gradeList.find(x=>lvl>=Number(x.min)&&lvl<=Number(x.max))||grade||{};
      const titleReward=gradeList.find(x=>Number(x.min)===lvl);
      const globalXpReward=globalLevelXpRewards.find(x=>Number(x.level)===lvl);
      const cashReward=globalLevelCashRewards.find(x=>Number(x.level)===lvl);
      const xpReward=lovysXpRewards.find(x=>Number(x.level)===lvl);
      const details=[];
      let majorIcon=gradeAtLevel?.icon||'◆';
      let title=`Palier niveau ${lvl}`;
      if(titleReward){ details.push(`Débloque le titre « ${titleReward.name} ».`); title=`Titre : \"${titleReward.name}\"`; majorIcon='🏅'; }
      if(globalXpReward){ details.push(`Donne +${Number(globalXpReward.xp||0)} XP globale pour commencer à remplir le niveau suivant.`); if(!titleReward){ title=`Bonus global +${Number(globalXpReward.xp||0)} XP`; majorIcon='⭐'; } }
      if(cashReward){ details.push(`Donne +${Number(cashReward.cash||0)} LoVeR'Cash.`); if(!titleReward&&!globalXpReward){ title=`Bonus +${Number(cashReward.cash||0)} LoVeR'Cash`; majorIcon='💰'; } }
      if(xpReward){ details.push(`Ajoute +${Number(xpReward.xp||0)} XP à ton Lovys.`); if(!titleReward&&!globalXpReward&&!cashReward){ title=`Bonus Lovys +${Number(xpReward.xp||0)} XP`; majorIcon='🐉'; } }
      if(lvl===55){ details.push('Débloque le fond « Ascension » et l’accès au Prestige une fois la barre remplie.'); title='Palier Prestige'; majorIcon='🏆'; }
      if(!details.length){ details.push('Pas de récompense directe sur ce niveau, mais il te rapproche du prochain palier important.'); }
      const rangeText = gradeAtLevel?.min && gradeAtLevel?.max ? `Grade ${gradeAtLevel.name} · niveaux ${gradeAtLevel.min} à ${gradeAtLevel.max}` : (gradeAtLevel?.name ? `Grade ${gradeAtLevel.name}` : 'Progression globale');
      return { level:lvl, tag:`NIV. ${lvl}`, icon:majorIcon, color:gradeAtLevel?.color||'#c7b4ee', title, sub:`${rangeText} · ${details.join(' ')}`, previewTitle: titleReward ? { name:titleReward.name, color:gradeAtLevel?.color||'#c7b4ee' } : null };
    };
    const road=Array.from({length:55},(_,i)=>{
      const level=i+1,reward=rewardForLevel(level),done=level<currentLevel,current=level===currentLevel,final=level===55;
      const state=[done?'done':'',current?'current':'',reward?'reward':'',final?'final':''].filter(Boolean).join(' ');
      const levelGrade=gradeList.find(x=>level>=Number(x.min)&&level<=Number(x.max))||grade;
      const rankColor=escapeHtml(levelGrade?.color||'#8d97b5'),rankIcon=escapeHtml(levelGrade?.icon||'◆');
      return `<div class="level-step ${state}" data-progress-level="${level}" style="--rank-color:${rankColor}"><div class="level-node"><span class="level-node-icon">${done?'✓':rankIcon}</span><span class="level-node-number">${level}</span></div><div class="level-label" style="color:${rankColor}">NIV. ${level}</div><div class="level-reward">${reward?reward.icon:''}</div><div class="level-reward-name">${reward?escapeHtml(reward.name):'&nbsp;'}</div></div>`;
    }).join('');
    const grades=gradeList.map(x=>`<div class="grade-item ${currentLevel>=x.min?'unlocked':''}"><strong style="color:${escapeHtml(x.color)}">${escapeHtml(x.icon)} ${escapeHtml(x.name)}</strong><div class="hub-sub">Niv. ${x.min}–${x.max} · titre ${currentLevel>=x.min?'débloqué':'à débloquer'}</div></div>`).join('');
    const lovysGlobalRewardList=lovysXpRewards.map(x=>`<div class="milestone-item ${currentLevel>=Number(x.level)?'unlocked':''}"><strong>Niv. ${Number(x.level)}</strong><div class="hub-sub">🐉 +${Number(x.xp||0)} XP Lovys ${currentLevel>=Number(x.level)?'✓':'à débloquer'}</div></div>`).join('');
    const milestones=(d.creatureMilestones||[]).map(x=>`<div class="milestone-item ${(cp.level||1)>=x.level?'unlocked':''}"><strong>Niv. ${x.level}</strong><div class="hub-sub">${escapeHtml(x.label)} · +${Number(x.power||0)} puissance ${(cp.level||1)>=x.level?'✓':''}</div></div>`).join('');
    const reports=(d.recentReports||[]).map(x=>`<div class="report-row">${x.result==='victory'?'✅ Victoire':'❌ Défaite'} · ${escapeHtml(x.fight_key)} · +${Math.floor(Number(x.reward_creature_xp||0))} XP Lovys · +${Math.floor(Number(x.reward_global_xp||0))} XP globale · +${Number(x.reward_fragments||0)} ${fragmentIconMarkup()}</div>`).join('')||'<div class="hub-sub">Aucun combat pour le moment.</div>';
    const xpNow=Math.floor(Number(g.xpIntoLevel||0)),xpNeed=Math.max(1,Math.floor(Number(g.xpForNextLevel||0)));
    const lovysLevel=Math.max(1,Number(cp.level||1));
    const lovysTotalXp=Math.max(0,Math.floor(Number(d.creatureXp||0)));
    const lovysCurrentThreshold=Math.max(0,Number(cp.currentThreshold||0));
    const lovysNextThreshold=Math.max(lovysCurrentThreshold,Number(cp.nextThreshold||lovysCurrentThreshold));
    const lovysInto=Math.max(0,Math.floor(lovysTotalXp-lovysCurrentThreshold));
    const lovysNeed=Math.max(1,Math.floor(lovysNextThreshold-lovysCurrentThreshold));
    const lovysPercent=cp.maxLevel?100:progressionPct(lovysInto,lovysNeed);
    const pendingLovysXp=Math.max(0,Math.floor(Number(d.pendingCreatureXp||0)));
    const activeLovysName=d.hasCreature?(creatureById(me?.user?.creature_id)?.name||'ton Lovys'):'ton futur Lovys';
    const transferHtml=d.hasCreature&&pendingLovysXp>0?`<div class="lovys-transfer-wrap"><div class="lovys-transfer-balance">⚡ XP en réserve : ${pendingLovysXp.toLocaleString('fr-FR')}</div><button id="transferLovysXpBtn" class="hub-btn lovys-transfer-button" type="button">Distribuer à ${escapeHtml(activeLovysName)}</button></div>`:'';
    const lovysProgressHtml=d.hasCreature
      ? `<div class="lovys-progress-card"><div class="lovys-progress-head"><div class="lovys-progress-title">🐉 Progression du Lovys</div><span class="lovys-progress-level">Niv. ${lovysLevel}</span></div><div class="lovys-progress-meta"><span>${lovysInto.toLocaleString('fr-FR')} XP</span><span>${cp.maxLevel?'Niveau max':lovysNeed.toLocaleString('fr-FR')+' XP'}</span></div><div class="lovys-xp-bar"><span style="width:${lovysPercent}%"></span></div><div class="lovys-progress-note">XP totale du Lovys : ${lovysTotalXp.toLocaleString('fr-FR')} XP</div>${transferHtml}</div>`
      : `<div class="lovys-progress-card"><div class="lovys-progress-head"><div class="lovys-progress-title">${eggIconMarkup('egg-inline-icon title-inline-icon')}XP du futur Lovys</div><span class="lovys-progress-level">Réserve</span></div><div class="lovys-progress-meta"><span>XP en attente</span><span>${pendingLovysXp.toLocaleString('fr-FR')} XP</span></div><div class="lovys-progress-note">Cette XP reste en réserve. Après l’éclosion, tu pourras choisir de la transférer à ton Lovys avec confirmation.</div></div>`;
    box.innerHTML=`<section class="progression-report"><div class="progression-report-hero"><div class="progression-report-kicker">Rapport de progression</div><div class="progression-report-main"><div class="progression-rank-emblem" style="color:${escapeHtml(grade.color||'#c7b4ee')}">${escapeHtml(grade.icon||'◆')}</div><div><div class="progression-report-level">Niveau ${currentLevel}</div><div class="progression-report-grade" style="color:${escapeHtml(grade.color||'#c7b4ee')}">${escapeHtml(grade.name||'Recrue')}</div></div><button class="progression-report-prestige" id="prestigeInfoBtn" type="button" aria-label="En savoir plus sur le Prestige"><strong>${Number(d.prestige||0)}</strong><span>Prestige ⓘ</span></button></div><div class="progression-xp-row"><div class="progression-xp-values"><span>${xpNow.toLocaleString('fr-FR')} / ${xpNeed.toLocaleString('fr-FR')} XP</span><span>${Math.max(0,xpNeed-xpNow).toLocaleString('fr-FR')} XP restants</span></div><div class="progression-xp-bar"><span style="width:${percent}%"></span></div></div><div id="progressionLevelPreview" class="progression-preview-card"></div></div><div class="level-road-wrap"><div id="globalLevelRoad" class="level-road">${road}</div></div><div class="level-road-legend"><span class="level-road-hint">↔ Fais défiler la progression du niveau 1 au 55</span><div class="progression-road-actions"><button id="progressionBackCurrent" class="progression-go55 hidden" type="button">← Revenir à mon niveau</button><button id="progressionGo55" class="progression-go55" type="button">Aller au niveau 55 →</button><span class="level-road-goal">🏆 Niv. 55 → Prestige</span></div></div></section>${lovysProgressHtml}<div class="progression-prestige-info"><div><strong>🏆 Prestige : niveau ${currentLevel} sur 55</strong><span>Disponible après le niveau 55.</span></div><div class="progression-prestige-rules"><span><b>Tu recommences</b> la progression globale.</span><span><b>Tu gardes</b> ta collection et tes récompenses permanentes.</span><span><b>Tu gagnes</b> un niveau de Prestige affiché sur ton profil et tu repars pour une nouvelle ascension.</span></div></div>${g.prestigeReady?'<div class="hub-actions"><button id="doPrestige" class="hub-btn">🏆 Passer Prestige</button></div>':''}<div class="progression-section-title">🏅 Grades et titres</div><div class="grade-grid">${grades}</div><div class="progression-section-title">🎁 XP Lovys débloquée par niveau global</div><div class="hub-sub">Certains niveaux globaux donnent un bonus d’XP à ton Lovys. Si ton œuf n’a pas encore éclos, l’XP est conservée en attente.</div><div class="milestone-grid">${lovysGlobalRewardList}</div><div class="progression-section-title">🐉 Futures récompenses du Lovys</div><div class="hub-sub">Ces paliers augmentent directement sa puissance en combat.</div><div class="milestone-grid">${milestones}</div><div class="progression-section-title">📜 Rapports de combat</div><div class="report-list">${reports}</div>`;
    requestAnimationFrame(()=>{const roadEl=$('globalLevelRoad'),currentEl=roadEl?.querySelector('.level-step.current'),previewEl=$('progressionLevelPreview');if(roadEl&&previewEl){const renderPreview=(level)=>{const info=previewForLevel(level);const actionHtml=info.previewTitle?`<div class="progression-preview-actions"><button id="progressionPreviewTitleBtn" class="shop-action secondary progression-preview-action" type="button">👁 Essayer sur ma carte</button></div>`:'';previewEl.innerHTML=`<div class="progression-preview-kicker">Prévisualisation du palier</div><div class="progression-preview-main"><div class="progression-preview-left"><div class="progression-preview-icon" style="color:${escapeHtml(info.color)}">${escapeHtml(info.icon)}</div><div class="progression-preview-text"><div class="progression-preview-title" style="color:${escapeHtml(info.color)}">${escapeHtml(info.title)}</div><div class="progression-preview-sub">${escapeHtml(info.sub)}</div></div></div><div class="progression-preview-right"><div class="progression-preview-tag">${escapeHtml(info.tag)}</div>${actionHtml}</div></div>`;roadEl.querySelectorAll('.level-step').forEach(step=>step.classList.toggle('previewing',Number(step.dataset.progressLevel)===Number(info.level)));const previewBtn=$('progressionPreviewTitleBtn');if(previewBtn&&info.previewTitle){previewBtn.addEventListener('click',()=>openProgressionTitlePreview(info));}};renderPreview(Math.min(55,currentLevel+1));roadEl.querySelectorAll('.level-step').forEach(step=>{step.addEventListener('click',()=>renderPreview(Number(step.dataset.progressLevel||currentLevel)));});const scrollToProgressLevel=(level,preview=true)=>{const target=roadEl.querySelector(`[data-progress-level="${Number(level)}"]`);if(!target)return;roadEl.scrollTo({left:Math.max(0,target.offsetLeft-roadEl.clientWidth/2+target.clientWidth/2),behavior:'smooth'});if(preview)renderPreview(Number(level));};$('progressionGo55')?.addEventListener('click',()=>scrollToProgressLevel(55));$('progressionBackCurrent')?.addEventListener('click',()=>scrollToProgressLevel(currentLevel));const updateBackCurrent=()=>{const back=$('progressionBackCurrent');if(!back||!currentEl)return;const center=currentEl.offsetLeft+currentEl.clientWidth/2;const visibleCenter=roadEl.scrollLeft+roadEl.clientWidth/2;back.classList.toggle('hidden',Math.abs(center-visibleCenter)<roadEl.clientWidth*.42);};roadEl.addEventListener('scroll',updateBackCurrent,{passive:true});setTimeout(updateBackCurrent,80);if(currentEl){roadEl.scrollLeft=Math.max(0,currentEl.offsetLeft-roadEl.clientWidth/2+currentEl.clientWidth/2);}if(window.matchMedia('(min-width:801px)').matches){let dragging=false,startX=0,startScroll=0;const stopDrag=()=>{if(!dragging)return;dragging=false;roadEl.classList.remove('dragging');};roadEl.addEventListener('mousedown',e=>{if(e.button!==0)return;dragging=true;startX=e.clientX;startScroll=roadEl.scrollLeft;roadEl.classList.add('dragging');e.preventDefault();});window.addEventListener('mousemove',e=>{if(!dragging)return;if(!(e.buttons&1)){stopDrag();return;}roadEl.scrollLeft=startScroll-(e.clientX-startX);e.preventDefault();});window.addEventListener('mouseup',stopDrag);window.addEventListener('blur',stopDrag);roadEl.addEventListener('mouseleave',e=>{if(!(e.buttons&1))stopDrag();});}}});
    $('prestigeInfoBtn')?.addEventListener('click',()=>{
      let modal=$('prestigeInfoModal');
      if(!modal){
        modal=document.createElement('div');
        modal.id='prestigeInfoModal';
        modal.className='prestige-info-modal';
        modal.innerHTML=`<div class="prestige-info-panel" role="dialog" aria-modal="true" aria-labelledby="prestigeInfoTitle"><button class="prestige-info-close" type="button" aria-label="Fermer">×</button><div class="prestige-info-icon">🏆</div><h3 id="prestigeInfoTitle">Qu’est-ce que le Prestige ?</h3><p>Le Prestige devient disponible après avoir terminé le <strong>niveau 55</strong>.</p><div class="prestige-info-rules"><div><b>↻ Nouvelle ascension</b><span>Ta progression globale repart pour un nouveau cycle.</span></div><div><b>✓ Tes acquis restent</b><span>Ta collection et tes récompenses permanentes sont conservées.</span></div><div><b>🏆 Niveau de Prestige</b><span>Chaque ascension augmente le nombre de Prestige affiché sur ton profil.</span></div></div><div class="prestige-info-current"><span>Ton Prestige actuel</span><strong>${Number(d.prestige||0)}</strong></div><p class="prestige-info-note">Le <strong>${Number(d.prestige||0)}</strong> jaune affiché dans le rapport correspond donc à ton niveau de Prestige actuel.</p><button class="hub-btn prestige-info-ok" type="button">Compris</button></div>`;
        document.body.appendChild(modal);
        const close=()=>modal.classList.remove('open');
        modal.querySelector('.prestige-info-close')?.addEventListener('click',close);
        modal.querySelector('.prestige-info-ok')?.addEventListener('click',close);
        modal.addEventListener('click',e=>{if(e.target===modal)close();});
      }
      modal.classList.add('open');
    });
    $('doPrestige')?.addEventListener('click',async()=>{const rr=await fetch('/api/prestige',{method:'POST'}),dd=await rr.json();alert(dd.message||dd.error||'Prestige');if(rr.ok){await loadGame();await loadProgression();}});
    $('transferLovysXpBtn')?.addEventListener('click',()=>openLovysXpTransferConfirm(pendingLovysXp));
  }catch(e){box.innerHTML=`<p class="muted">${escapeHtml(e.message)}</p>`;}
}
let lovysXpTransferAmount=0;
let lovysXpTransferTargetId=null;
async function openLovysXpTransferConfirm(amount,lovysName=null,forcedLovysId=null){
  lovysXpTransferAmount=Math.max(0,Math.floor(Number(amount||0)));
  let data=lovysCollectionData?.lovys?.length?lovysCollectionData:await loadLovysCollection();
  const lovys=data?.lovys||[];
  const select=$('lovysXpTransferTarget');
  if(select){select.innerHTML=lovys.map(l=>`<option value="${l.id}">${escapeHtml(l.name)} · Niv. ${Number(l.level||1)}${l.isActive?' · actif':''}</option>`).join('');}
  lovysXpTransferTargetId=Number(forcedLovysId||lovys.find(l=>l.isActive)?.id||lovys[0]?.id||0)||null;
  if(select&&lovysXpTransferTargetId) select.value=String(lovysXpTransferTargetId);
  if($('lovysXpTransferValue')){$('lovysXpTransferValue').max=String(lovysXpTransferAmount);$('lovysXpTransferValue').value=String(lovysXpTransferAmount);}
  if($('lovysXpTransferCopy')) $('lovysXpTransferCopy').textContent='Choisis le Lovys et la quantité d’XP à lui transférer. Une confirmation est demandée avant application.';
  if($('lovysXpTransferAmount')) $('lovysXpTransferAmount').textContent=`⚡ ${lovysXpTransferAmount.toLocaleString('fr-FR')} XP disponibles`;
  $('lovysXpTransferModal')?.classList.remove('hidden');
}
function closeLovysXpTransferConfirm(){$('lovysXpTransferModal')?.classList.add('hidden');}
$('lovysXpTransferTarget')?.addEventListener('change',e=>{lovysXpTransferTargetId=Number(e.target.value)||null;});
$('lovysXpTransferCancel')?.addEventListener('click',closeLovysXpTransferConfirm);
$('lovysXpTransferModal')?.addEventListener('click',e=>{if(e.target.id==='lovysXpTransferModal')closeLovysXpTransferConfirm();});
$('lovysXpTransferConfirm')?.addEventListener('click',async()=>{
  const btn=$('lovysXpTransferConfirm');
  const amount=Math.max(0,Math.min(lovysXpTransferAmount,Math.floor(Number($('lovysXpTransferValue')?.value||0))));
  const lovysId=Number($('lovysXpTransferTarget')?.value||lovysXpTransferTargetId||0);
  if(!btn||amount<=0||!lovysId)return;
  const chosen=(lovysCollectionData?.lovys||[]).find(l=>Number(l.id)===lovysId);
  if(!confirm(`Transférer ${amount.toLocaleString('fr-FR')} XP à ${chosen?.name||'ce Lovys'} ?`)) return;
  btn.disabled=true;btn.textContent='Transfert…';
  try{
    const r=await fetch('/api/progression/transfer-lovys-xp',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({lovysId,amount})});
    const d=await r.json();
    if(!r.ok){alert(d.error||'Transfert impossible.');return;}
    closeLovysXpTransferConfirm();
    await loadGame();
    await loadLovysCollection();
    if(!$('progressionModal')?.classList.contains('hidden')) await loadProgression();
  }catch(e){alert('Impossible de contacter le serveur.');}
  finally{btn.disabled=false;btn.textContent='⚡ Confirmer le transfert';}
});

let lovysCollectionData={lovys:[],pendingXp:0,universalFragments:0};
let lovysCollectionTab='collection';

function lovysRankStars(rank){return '⭐'.repeat(Math.max(1,Math.min(5,Number(rank||1))));}
function lovysFragmentProgress(l){
  const cost=Number(l?.nextRankCost||0),specific=Math.max(0,Number(l?.fragments||0));
  if(!cost)return {cost:0,specific,pct:100,missing:0};
  return {cost,specific,pct:Math.max(0,Math.min(100,(specific/cost)*100)),missing:Math.max(0,cost-specific)};
}
function renderLovysCollectionTabs(){
  const collection=$('lovysCollectionGrid'),fragments=$('lovysFragmentsPanel');
  const collectionBtn=$('lovysCollectionTabCollection'),fragmentsBtn=$('lovysCollectionTabFragments');
  const showFragments=lovysCollectionTab==='fragments';
  collection?.classList.toggle('hidden',showFragments);
  fragments?.classList.toggle('hidden',!showFragments);
  collectionBtn?.classList.toggle('active',!showFragments);
  fragmentsBtn?.classList.toggle('active',showFragments);
  collectionBtn?.setAttribute('aria-selected',String(!showFragments));
  fragmentsBtn?.setAttribute('aria-selected',String(showFragments));
}
const LOVYS_ROLES={plant:'Tank',water:'Soutien',voltis:'Rapide',brumee:'Rapide',fire:'Assassin',crysal:'Tank',ferox:'Tank',dark:'Assassin',solka:'Soutien',dream:'Assassin'};
const LOVYS_ID_ALIASES={lightning:'voltis',mist:'brumee',crystal:'crysal',forge:'ferox',solar:'solka'};
const LOVYS_TYPE_BEATS={Verdance:'Abyssal',Abyssal:'Cendre',Cendre:'Verdance',Foudre:'Abyssal',Néant:'Mirage',Mirage:'Néant',Solaire:'Néant',Forge:'Cristal',Cristal:'Foudre'};
let lovysPveData=null;
let lovysIncubatorData=null;
const LOVYS_MILESTONES=[{level:5,power:5,label:'Éveil'},{level:10,power:5,label:'Instinct'},{level:15,power:5,label:'Affinité'},{level:20,power:5,label:'Maîtrise'},{level:25,power:10,label:'Ascendant'},{level:30,power:10,label:'Harmonie'},{level:40,power:15,label:'Domination'},{level:50,power:20,label:'Apogée'}];
function lovysCanonicalId(id){return LOVYS_ID_ALIASES[id]||id;}
function lovysRole(l){return LOVYS_ROLES[lovysCanonicalId(l?.creatureId)]||'Polyvalent';}
function lovysRarityClass(r='Commun'){return String(r).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();}
function lovysNextRankText(l){const n=l?.nextRankPreview;if(!n)return 'Rang maximum atteint';const cur=l.stats||{}, parts=[];if(Number(n.stats?.attack)>Number(cur.attack))parts.push(`ATQ ${cur.attack} → ${n.stats.attack}`);if(Number(n.stats?.hp)>Number(cur.hp))parts.push(`PV ${cur.hp} → ${n.stats.hp}`);if(l.talent?.description!==n.talent?.description)parts.push(`${l.talent?.name||'Talent'} : ${l.talent?.description||''} → ${n.talent?.description||''}`);return parts.slice(0,2).join(' · ')||'Statistiques renforcées au prochain rang';}
function lovysZoneAdvantage(l){const enemyType=lovysPveData?.fight?.type||lovysPveData?.currentFight?.type||lovysPveData?.zone?.type||'';if(!enemyType)return '';if(LOVYS_TYPE_BEATS[l.type]===enemyType)return `⚔️ Avantage de type contre ${enemyType}`;if(LOVYS_TYPE_BEATS[enemyType]===l.type)return `⚠️ Désavantage de type contre ${enemyType}`;return '';}
function lovysSkillMarkup(skill,index=1){if(!skill)return '';const cd=Math.max(0,Number(skill.cooldown||0));return `<div class="lovys-skill combat-skill"><div class="lovys-skill-top"><strong><small>COMPÉTENCE ${index}</small>${escapeHtml(skill.icon||'⚔️')} ${escapeHtml(skill.name||'Compétence')}</strong><span class="lovys-cooldown">⏱ Recharge : ${cd} tour${cd>1?'s':''}</span></div><p>${escapeHtml(skill.description||'')}</p></div>`;}
function lovysRankTimeline(l){
  const previews=l?.rankPreviews||[];
  return `<div class="lovys-rank-timeline">${previews.map(r=>{const current=Number(r.rank)===Number(l.rank||1),done=Number(r.rank)<Number(l.rank||1);return `<div class="lovys-rank-step ${current?'current':''} ${done?'done':''}"><span class="lovys-rank-stars">${'⭐'.repeat(Number(r.rank||1))}</span><strong>${r.rank===1?'Départ':`${Number(r.cost||0)} 🧩`}</strong></div>`}).join('')}</div>`;
}
function lovysTalentEvolution(l){
  const previews=l?.rankPreviews||[];
  if(!previews.length)return '';
  const short=d=>{const m=String(d||'').match(/(\d+(?:[,.]\d+)?)\s*%/);return m?`${m[1]} %`:`R${previews.findIndex(x=>x.talent?.description===d)+1}`};
  return `<div class="lovys-talent-evolution"><span>Évolution du talent</span><div>${previews.map(r=>`<b class="${Number(r.rank)===Number(l.rank||1)?'current':''}">${short(r.talent?.description)}</b>`).join('<i>→</i>')}</div></div>`;
}
function lovysZoneAdvice(active){
  const enemyType=lovysPveData?.fight?.type||lovysPveData?.currentFight?.type||lovysPveData?.zone?.type||'';
  if(!enemyType)return '';
  const zoneName=lovysPveData?.zone?.name||lovysPveData?.currentFight?.zoneName||'la zone en cours';
  const status=LOVYS_TYPE_BEATS[active.type]===enemyType?'avantagé':LOVYS_TYPE_BEATS[enemyType]===active.type?'désavantagé':'neutre';
  const better=homeMonsters.find(m=>LOVYS_TYPE_BEATS[m.type]===enemyType && lovysCanonicalId(m.id)!==lovysCanonicalId(active.creatureId));
  return `${active.name} est ${status} dans ${zoneName}${better?` ; ${better.name} serait avantagé.`:'.'}`;
}
function lovysDesktopRankAction(active) {
  if (!isDesktopGameUi()) return '';
  const cost = Number(active?.nextRankCost || 0), rank = Number(active?.rank || 1);
  if (!cost || rank >= 5) return '<div class="lovys-desktop-rank-action max"><strong>⭐ Rang maximum atteint</strong></div>';
  const ready = active.canRankUp === true;
  const universalUsed = Math.max(0,cost-Number(active.fragments||0));
  const hint = ready ? (universalUsed > 0 ? `Prêt avec ${universalUsed} fragments universels en complément.` : 'Tu as les fragments nécessaires !') : 'Récupère des fragments pour débloquer cette amélioration.';
  return `<div class="lovys-desktop-rank-action ${ready?'ready':''}"><span class="lovys-rank-ready-label">${ready?'✨ Amélioration disponible':'🧩 Amélioration du Lovys'}</span><button class="hub-btn lovys-desktop-rank-button" type="button" data-rank-lovys="${Number(active.id)}" ${ready?'':'disabled'}>⭐ Passer au rang ${rank+1}<small>${cost} fragments</small></button><p>${escapeHtml(hint)}</p></div>`;
}

function lovysLiveLevelEstimate(active) {
  if (!isDesktopGameUi() || active.maxLevel) return '';
  const seconds = active.liveSecondsToNextLevel;
  if (!Number.isFinite(seconds) || seconds < 0) return '';
  const minutes = Math.max(1, Math.ceil(seconds / 60));
  const hours = Math.floor(minutes / 60), rest = minutes % 60;
  const time = hours ? `${hours} h${rest ? ' '+String(rest).padStart(2,'0') : ''}` : `${minutes} min`;
  return `<div class="lovys-live-level-estimate"><strong>📺 Environ ${time} de live pour atteindre le niveau ${Number(active.level)+1}</strong></div>`;
}

function lovysLiveXpExplanation() {
  if (!isDesktopGameUi()) return '';
  return `<div class="lovys-live-xp-explanation"><strong>📺 Seul ton Lovys actif gagne l’XP du live</strong><p>L’XP du live n’est ni partagée ni donnée aux autres Lovys de ta collection. Pour faire progresser un autre Lovys, sélectionne-le puis rends-le actif : il recevra l’XP des prochains instants de présence comptabilisés pendant le live.</p><p>⚡ Tu peux aussi sélectionner un Lovys et utiliser « Donner de l’XP » pour lui attribuer de l’XP en réserve.</p></div>`;
}

function renderLovysActiveHero(data){
  const box=$('lovysActiveHero'),now=$('lovysNowStrip');if(!box||!now)return;
  const active=(data?.lovys||[]).find(l=>l.isActive)||(data?.lovys||[])[0];
  if(!active){box.innerHTML='';now.innerHTML='';return;}
  const st=active.stats||{},skills=active.skills||[],frag=lovysFragmentProgress(active),nextRank=Number(active.rank||1)+1,nextPreview=lovysNextRankText(active);
  const prog=active.progression||{},cur=Math.max(0,Number(prog.currentThreshold||0)),next=Math.max(cur,Number(prog.nextThreshold||cur)),total=Math.max(0,Number(active.xp||0)),into=Math.max(0,Math.floor(total-cur)),need=Math.max(0,Math.ceil(next-cur)),xpPct=active.maxLevel?100:Math.max(0,Math.min(100,need?into/need*100:0));
  const milestone=LOVYS_MILESTONES.find(m=>m.level>Number(active.level||1));
  const typeStrong=LOVYS_TYPE_BEATS[active.type]||'—',typeWeak=Object.keys(LOVYS_TYPE_BEATS).find(k=>LOVYS_TYPE_BEATS[k]===active.type)||'—';
  const advice=lovysZoneAdvice(active);
  box.innerHTML=`<div class="lovys-active-art">${artForLovys(active.creatureId,active.evolution||0,true)}<span class="lovys-active-image-badge">✓ Lovys actif</span></div>
  <div class="lovys-active-main"><div class="lovys-active-kicker">LOVYS ACTIF</div><div class="lovys-active-title"><h3>${escapeHtml(active.name)}</h3><span class="lovys-role">${escapeHtml(lovysRole(active))}</span><span class="lovys-rarity ${lovysRarityClass(active.rarity)}">${escapeHtml(active.rarity)}</span></div><div class="lovys-active-level">Niveau ${Number(active.level||1)} · ${lovysRankStars(active.rank)} <span>Rang ${Number(active.rank||1)}/5</span></div><div class="lovys-active-xp"><span style="width:${xpPct}%"></span></div><div class="lovys-xp-copy"><strong>${active.maxLevel?'Niveau maximum':`${into.toLocaleString('fr-FR')} / ${need.toLocaleString('fr-FR')} XP`}</strong><span>${milestone?`Niv. ${milestone.level} : +${milestone.power} puissance · ${milestone.label}`:'Tous les paliers de puissance atteints'}</span></div>${lovysLiveLevelEstimate(active)}${lovysLiveXpExplanation()}<div class="lovys-stat-grid"><div><span>PV</span><strong>${Number(st.hp||0)}</strong></div><div><span>ATQ</span><strong>${Number(st.attack||0)}</strong></div><div><span>DEF</span><strong>${Number(st.defense||0)}</strong></div><div><span>VIT</span><strong>${Number(st.speed||0)}</strong></div></div><div class="lovys-type-chips"><span>▲ Fort contre <b>${escapeHtml(typeStrong)}</b></span><span>▼ Faible face à <b>${escapeHtml(typeWeak)}</b></span></div>${advice?`<div class="lovys-zone-advice">💡 ${escapeHtml(advice)}</div>`:''}${frag.cost?`<div class="lovys-rank-explainer"><div class="lovys-rank-explainer-title">⭐ AMÉLIORATION DU RANG</div><p>Les doublons de <b>${escapeHtml(active.name)}</b> donnent des fragments. Remplis la jauge pour augmenter son rang et renforcer son talent.</p><div class="lovys-rank-progress-head"><strong>🧩 ${frag.specific}/${frag.cost} fragments</strong><span>→ Rang ${nextRank}</span></div><div class="lovys-rank-progress"><span style="width:${frag.pct}%"></span></div><div class="lovys-rank-reward">✨ Prochaine amélioration : <b>${escapeHtml(nextPreview)}</b></div>${lovysRankTimeline(active)}${frag.specific<frag.cost?`<button class="lovys-trade-fragments-btn" type="button" data-find-lovys-fragments="${active.id}">🤝 Trouver des fragments</button>`:''}</div>`:'<div class="lovys-rank-explainer max"><strong>⭐ Rang maximum atteint</strong>${lovysRankTimeline(active)}</div>'}<div class="lovys-active-actions"><button class="hub-btn primary" type="button" data-lovys-pve>⚔️ Combattre</button><div class="lovys-xp-action"><button class="hub-btn" type="button" data-transfer-lovys="${active.id}" ${Number(data.pendingXp||0)>0?'':'disabled'}>⚡ Donner de l’XP</button>${Number(data.pendingXp||0)>0?'':`<small>0 XP en réserve</small>`}</div></div></div>
  <div class="lovys-active-kit"><div class="lovys-kit-label">TALENT & COMPÉTENCES <button class="lovys-kit-info" type="button" title="Le talent passif est toujours actif. Les compétences sont utilisées en combat puis doivent se recharger." aria-label="Aide sur le talent et les compétences">?</button></div><div class="lovys-skill talent"><div class="lovys-skill-top"><strong><small>✨ TALENT PASSIF · RANG ${Number(active.rank||1)}</small>${escapeHtml(active.talent?.icon||'✨')} ${escapeHtml(active.talent?.name||'Talent')}</strong><span class="lovys-passive-badge">TOUJOURS ACTIF</span></div><p>${escapeHtml(active.talent?.description||'')}</p>${lovysTalentEvolution(active)}</div><div class="lovys-combat-kit-title">⚔️ COMPÉTENCES DE COMBAT</div>${lovysSkillMarkup(skills[0],1)}${lovysSkillMarkup(skills[1],2)}${lovysDesktopRankAction(active)}</div>`;

  if(isMobileGameUi()){
    const actions=box.querySelector('.lovys-active-actions');
    const rank=box.querySelector('.lovys-rank-explainer');
    if(actions && rank){
      rank.before(actions);
      const button=document.createElement('button');button.type='button';button.className='hub-btn mobile-rank-action';
      button.dataset.rankLovys=String(active.id);
      const enough=Boolean(active.canRankUp);
      button.disabled=!enough;
      button.textContent=frag.cost ? '⭐ Rang '+nextRank+' · '+frag.specific+'/'+frag.cost+' fragments' : '⭐ Rang maximum';
      actions.appendChild(button);
    }
    const kit=box.querySelector('.lovys-active-kit');
    if(kit){
      const fold=document.createElement('details');fold.className='mobile-info-fold mobile-lovys-kit';
      fold.innerHTML='<summary>✨ Talent et compétences</summary>';
      kit.replaceWith(fold);fold.appendChild(kit);
    }
    if(rank){
      const fold=document.createElement('details');fold.className='mobile-info-fold mobile-lovys-rank';
      fold.innerHTML='<summary>⭐ Comprendre les rangs et fragments</summary>';
      rank.replaceWith(fold);fold.appendChild(rank);
    }
  }
  const pending=Math.floor(Number(data.pendingXp||0));
  const readySlot=(lovysIncubatorData?.slots||[]).find(x=>x?.ready);
  const incubating=(lovysIncubatorData?.slots||[]).find(x=>x&&!x.ready&&Number(x.watchedSeconds||0)>0);
  const hatchSeconds=Number(lovysIncubatorData?.hatchSeconds||21600);
  let tipIcon='📺',tipTitle='Regarde le live pour progresser',tipText='Tu gagneras de l’XP et avanceras la progression de ton Lovys.',tipAction='';
  if(readySlot){
    tipIcon='🥚';tipTitle='Ton œuf est prêt à éclore !';tipText='Passe par l’Incubateur pour découvrir ton nouveau Lovys.';tipAction='<button type="button" data-lovys-incubator>Voir l’incubateur</button>';
  }else if(incubating){
    const left=Math.max(0,hatchSeconds-Number(incubating.watchedSeconds||0));
    tipIcon='🥚';tipTitle=`Éclosion dans ${formatEggTime(left)}`;tipText='Ton œuf progresse pendant le live. Tu peux suivre son avancée dans l’Incubateur.';tipAction='<button type="button" data-lovys-incubator>Voir l’incubateur</button>';
  }else if(pending>0){
    tipIcon='⚡';tipTitle=`${pending.toLocaleString('fr-FR')} XP à distribuer`;tipText=`Tu as de l’XP en réserve : donne-la à ${escapeHtml(active.name)} pour accélérer sa progression.`;tipAction=`<button type="button" data-transfer-lovys="${active.id}">Distribuer l’XP</button>`;
  }else if(frag.cost && frag.specific<frag.cost){
    const missing=Math.max(0,frag.cost-frag.specific);
    tipIcon='🧩';tipTitle=`Il manque ${missing} fragment${missing>1?'s':''} pour le Rang ${nextRank}`;tipText=`Les doublons de ${escapeHtml(active.name)} donnent des fragments. Tu peux aussi passer par les Échanges.`;tipAction=`<button type="button" data-find-lovys-fragments="${active.id}">Trouver des fragments</button>`;
  }else if(advice){
    tipIcon='⚔️';tipTitle='Conseil pour la zone en cours';tipText=escapeHtml(advice);
  }
  now.innerHTML=`<div class="lovys-moment-tip"><div class="lovys-moment-tip-icon">${tipIcon}</div><div class="lovys-moment-tip-copy"><span>CONSEIL DU MOMENT</span><strong>${tipTitle}</strong><p>${tipText}</p></div>${tipAction}</div>`;
}
function renderLovysFragmentInventory(data){
  const universalBox=$('lovysUniversalFragments'),grid=$('lovysFragmentsGrid'); if(!grid)return;
  const universal=Math.max(0,Number(data?.universalFragments||0));
  if(universalBox) universalBox.innerHTML=`<div class="lovys-fragment-rule"><strong>🧩 Comment fonctionnent les doublons ?</strong><span>Un doublon donne 10 / 15 / 25 / 40 fragments selon sa rareté. Les fragments universels peuvent compléter jusqu’à 50 % du coût d’un rang.</span></div><div class="lovys-universal-icon">🧩</div><div><div class="lovys-universal-label">Fragments universels</div><div class="lovys-universal-value">${universal.toLocaleString('fr-FR')}</div><div class="lovys-universal-help">Réserve commune utilisable sur tous tes Lovys.</div></div>`;
  const owned=(data?.lovys||[]);
  if(!owned.length){grid.innerHTML='<div class="lovys-fragments-empty"><div>🧩</div><strong>Aucun Lovys pour le moment</strong></div>';return;}
  grid.innerHTML=owned.map(l=>{const p=lovysFragmentProgress(l),stars=lovysRankStars(l.rank),max=!p.cost;return `<article class="lovys-fragment-card ${l.canRankUp?'ready':''}"><div class="lovys-fragment-art">${artForLovys(l.creatureId,l.evolution||0,true)}</div><div class="lovys-fragment-body"><div class="lovys-fragment-top"><div><div class="lovys-fragment-name">${escapeHtml(l.name)}</div><div class="lovys-fragment-rarity">${escapeHtml(l.rarity)} · ${escapeHtml(l.type)}</div></div><div class="lovys-fragment-rank">${stars}<span>Rang ${Number(l.rank||1)}/5</span></div></div><div class="lovys-fragment-balance-line"><strong>🧩 ${p.specific.toLocaleString('fr-FR')}</strong><span>${max?'MAX':`/ ${p.cost}`}</span></div>${max?'':`<div class="lovys-fragment-progress"><span style="width:${p.pct}%"></span></div><div class="lovys-fragment-helper">Prochain rang : ${escapeHtml(lovysNextRankText(l))}</div><button class="hub-btn lovys-fragment-rank-btn" type="button" data-rank-lovys="${Number(l.id)}" ${l.canRankUp?'':'disabled'}>⭐ Passer au rang ${Number(l.rank||1)+1}</button>`}</div></article>`}).join('');
}
function lovysMissingCards(owned){const ids=new Set(owned.map(l=>lovysCanonicalId(l.creatureId)));return homeMonsters.filter(m=>!ids.has(lovysCanonicalId(m.id))).map(m=>`<article class="lovys-collection-card missing rarity-${lovysRarityClass(m.rarity)}"><div class="lovys-card-rarity-line"></div><div class="lovys-collection-art silhouette"><img src="${escapeHtml(m.image)}" alt="" loading="lazy"></div><div class="lovys-collection-name">???</div><div class="lovys-collection-meta">${escapeHtml(m.rarity)} · ${escapeHtml(m.type)}</div><div class="lovys-missing-hints"><span>Rôle : ???</span><span>Taux : ${escapeHtml(m.chance)}</span></div></article>`).join('');}
function renderLovysDetail(l){const panel=$('lovysDetailPanel');if(!panel||!l)return;const previews=l.rankPreviews||[],skills=l.skills||[];panel.classList.remove('hidden');panel.innerHTML=`<div class="lovys-detail-head"><div><span class="lovys-section-kicker">FICHE DÉTAILLÉE</span><h3>${escapeHtml(l.name)} · ${escapeHtml(l.type)}</h3></div><button type="button" data-close-lovys-detail>×</button></div><div class="lovys-detail-grid"><div><div class="lovys-detail-art">${artForLovys(l.creatureId,l.evolution||0,true)}</div><div class="lovys-detail-types"><span>Rôle : <b>${escapeHtml(lovysRole(l))}</b></span><span>Fort contre : <b>${escapeHtml(LOVYS_TYPE_BEATS[l.type]||'—')}</b></span><span>Faible contre : <b>${escapeHtml(Object.keys(LOVYS_TYPE_BEATS).find(k=>LOVYS_TYPE_BEATS[k]===l.type)||'—')}</b></span></div></div><div><h4>✨ Talent</h4><div class="lovys-skill talent"><div class="lovys-skill-top"><strong>${escapeHtml(l.talent?.icon||'✨')} ${escapeHtml(l.talent?.name||'Talent')}</strong></div><p>${escapeHtml(l.talent?.description||'')}</p></div><h4>⚔️ Compétences</h4>${lovysSkillMarkup(skills[0])}${lovysSkillMarkup(skills[1])}</div><div><h4>⭐ Rangs</h4><div class="lovys-rank-road">${previews.map(r=>`<div class="${Number(r.rank)<=Number(l.rank)?'done':''}"><strong>Rang ${r.rank}</strong><span>${r.rank===1?'Départ':`${Number(r.cost||0)} fragments`}</span><small>${escapeHtml(r.talent?.description||'Stats renforcées')}</small></div>`).join('')}</div><h4>📈 Paliers</h4><div class="lovys-level-stages"><span>Éveil</span><span>Éclosion</span><span>Ascension</span><span>Apogée</span></div></div></div>`;panel.scrollIntoView({behavior:'smooth',block:'nearest'});}
function renderLovysCollection(data){
  const grid=$('lovysCollectionGrid'),lovys=data?.lovys||[]; if($('lovysCollectionCount'))$('lovysCollectionCount').textContent=String(lovys.length);if($('lovysFragmentsCount'))$('lovysFragmentsCount').textContent=String(lovys.filter(l=>Number(l.fragments||0)>0).length);if($('lovysDiscoveredCount'))$('lovysDiscoveredCount').textContent=`${lovys.length}/10 découverts`;renderLovysActiveHero(data);if(!grid)return;
  const owned=lovys.map(l=>{const stars=lovysRankStars(l.rank);return `<article class="lovys-collection-card rarity-${lovysRarityClass(l.rarity)} ${l.isActive?'active':''}" data-lovys-card="${l.id}"><div class="lovys-card-rarity-line"></div><div class="lovys-collection-art">${artForLovys(l.creatureId,l.evolution||0,true)}${l.isActive?'<span class="lovys-card-active-badge">✓ Actif</span>':''}</div><div class="lovys-collection-name-row"><div><div class="lovys-collection-name">${escapeHtml(l.name)}</div><div class="lovys-collection-meta">${escapeHtml(l.type)} · ${escapeHtml(l.rarity)}</div></div><span class="lovys-role">${escapeHtml(lovysRole(l))}</span></div><div class="lovys-rank">${stars} <span>Rang ${Number(l.rank||1)}/5</span></div><div class="lovys-card-level">Niveau ${Number(l.level||1)}</div><div class="lovys-collection-actions">${l.isActive?'':`<button class="hub-btn" type="button" data-activate-lovys="${l.id}">Définir comme actif</button>`}<button class="hub-btn" type="button" data-view-lovys="${l.id}">Voir la fiche</button></div></article>`}).join('');
  grid.innerHTML=`<div class="lovys-grid-toolbar"><div><strong>Collection</strong><span>Découvre de nouveaux Lovys dans l’incubateur.</span></div><button class="hub-btn" type="button" data-lovys-incubator>🥚 Aller à l’incubateur</button></div>${owned+lovysMissingCards(lovys)}`;renderLovysFragmentInventory(data);renderLovysCollectionTabs();
}
async function loadLovysCollection(){
  const grid=$('lovysCollectionGrid');
  const fragmentsGrid=$('lovysFragmentsGrid');
  if(grid) grid.innerHTML='<div class="hub-sub">Chargement…</div>';
  if(fragmentsGrid) fragmentsGrid.innerHTML='<div class="hub-sub">Chargement…</div>';
  try{
    const [response,pveResponse,incubatorResponse]=await Promise.all([fetch('/api/lovys',{cache:'no-store'}),fetch('/api/pve',{cache:'no-store'}).catch(()=>null),fetch('/api/incubator',{cache:'no-store'}).catch(()=>null)]);
    const data=await response.json();
    if(pveResponse?.ok){try{lovysPveData=await pveResponse.json();}catch{lovysPveData=null;}}
    if(incubatorResponse?.ok){try{lovysIncubatorData=await incubatorResponse.json();}catch{lovysIncubatorData=null;}}
    if(!response.ok) throw new Error(data.error||'Impossible de charger la collection.');
    lovysCollectionData=data;
    if($('lovysCollectionReserve')) $('lovysCollectionReserve').textContent=`⚡ ${Math.floor(Number(data.pendingXp||0)).toLocaleString('fr-FR')} XP en réserve · 🧩 ${Number(data.universalFragments||0)} fragments universels`;
    renderLovysCollection(data);
    return data;
  }catch(error){
    if(grid)grid.innerHTML=`<div class="hub-sub">${escapeHtml(error.message)}</div>`;
    if(fragmentsGrid)fragmentsGrid.innerHTML=`<div class="hub-sub">${escapeHtml(error.message)}</div>`;
    return null;
  }
}
async function openLovysCollection(tab='collection'){
  if(typeof isDesktopGameUi==='function'&&isDesktopGameUi()){desktopView='lovys';document.body.dataset.desktopView='lovys';setDesktopNavActive?.('lovys');}
  lovysCollectionTab=tab==='fragments'?'fragments':'collection';
  $('lovysCollectionModal')?.classList.remove('hidden');
  if(isMobileGameUi()) document.body.style.overflow='hidden';
  renderLovysCollectionTabs();
  await loadLovysCollection();
  restoreMobilePageScroll('lovysCollectionModal');
  syncMobileNavState?.();
}
function closeLovysCollection(){ $('lovysCollectionModal')?.classList.add('hidden'); if(isMobileGameUi())document.body.style.overflow=''; syncMobileNavState?.(); }
$('openLovysCollection')?.addEventListener('click',()=>openLovysCollection('collection'));
$('lovysCollectionClose')?.addEventListener('click',closeLovysCollection);
$('lovysCollectionModal')?.addEventListener('click',e=>{if(!isDesktopGameUi()&&e.target.id==='lovysCollectionModal')closeLovysCollection();});
document.querySelectorAll('[data-lovys-tab]').forEach(btn=>btn.addEventListener('click',()=>{lovysCollectionTab=btn.dataset.lovysTab==='fragments'?'fragments':'collection';renderLovysCollectionTabs();}));
function showLovysRankCelebration(chosen, newRank) {
  if (!isDesktopGameUi()) return;
  desktopBoostAcceptedClose?.();
  const rank = Math.max(1, Math.min(5, Number(newRank) || 1));
  const previousRank = Math.max(1, Number(chosen.rank) || 1);
  const previousFocus = document.activeElement;
  const overlay = document.createElement('div');
  overlay.className = 'desktop-boost-accepted-overlay';
  overlay.setAttribute('role','dialog');overlay.setAttribute('aria-modal','true');overlay.setAttribute('aria-labelledby','lovysRankCelebrationTitle');
  overlay.innerHTML = `<div class="desktop-boost-accepted-panel lovys-rank-celebration"><div class="lovys-rank-celebration-art">${artForLovys(chosen.creatureId,chosen.evolution||0,true)}</div><div class="boost-accepted-kicker">Rang amélioré !</div><h2 id="lovysRankCelebrationTitle">${escapeHtml(chosen.name)} passe au rang ${rank}</h2><div class="lovys-celebration-stars" aria-label="${rank} étoiles sur 5">${Array.from({length:5},(_,i)=>`<span aria-hidden="true" class="${i<rank?'earned':'locked'} ${i>=previousRank&&i<rank?'new-star':''}">★</span>`).join('')}</div><p>Ton Lovys devient plus puissant !</p><button class="shop-action" type="button">Continuer</button></div>`;
  let finished = false;
  const close = () => {
    if (finished) return;finished = true;
    document.removeEventListener('keydown',keydown,true);window.removeEventListener('resize',resize);
    overlay.remove();desktopBoostAcceptedClose = null;
    if(previousFocus?.isConnected)previousFocus.focus();
  };
  const keydown = event => {if(event.key==='Escape'){event.preventDefault();event.stopImmediatePropagation();close();}else if(event.key==='Tab')trapDesktopAdminFocus(event,overlay);};
  const resize = () => {if(!isDesktopGameUi())close();};
  overlay.addEventListener('click',event=>{if(event.target===overlay||event.target.closest('button'))close();});
  desktopBoostAcceptedClose=close;
  document.body.appendChild(overlay);document.addEventListener('keydown',keydown,true);window.addEventListener('resize',resize);
  overlay.querySelector('button').focus();
}
function confirmLovysRankInGame(chosen, errorMessage = '') {
  return new Promise(resolve => {
    const previousFocus = document.activeElement;
    const cost = Math.max(0, Number(chosen.nextRankCost) || 0);
    const specific = Math.min(cost, Math.max(0, Number(chosen.fragments) || 0));
    const universal = Math.max(0, cost - specific);
    const nextRank = Math.min(5, Number(chosen.rank || 1) + 1);
    const overlay = document.createElement('div');
    overlay.className = 'desktop-egg-boost-overlay';
    overlay.setAttribute('role','dialog');overlay.setAttribute('aria-modal','true');overlay.setAttribute('aria-labelledby','lovysRankConfirmTitle');
    overlay.innerHTML = `<div class="desktop-egg-boost-panel"><h2 id="lovysRankConfirmTitle">${errorMessage ? 'Amélioration impossible' : '⭐ Améliorer '+escapeHtml(chosen.name)}</h2>${errorMessage ? `<p>${escapeHtml(errorMessage)}</p>` : `<p>Souhaites-tu passer <strong>${escapeHtml(chosen.name)}</strong> au rang <strong>${nextRank}/5 · ${'⭐'.repeat(nextRank)}</strong> ?</p><div class="boost-accepted-duration">🧩 ${specific} fragments de ${escapeHtml(chosen.name)}${universal ? `<br>✨ ${universal} fragments universels en complément` : ''}<br>Total : ${cost} fragments</div><p>Les fragments seront consommés uniquement après confirmation et réussite de l’amélioration.</p>`}<div class="egg-boost-actions"><button class="shop-action secondary" type="button" data-rank-confirm-no>${errorMessage ? 'Compris' : '✕ Non, annuler'}</button>${errorMessage ? '' : '<button class="shop-action" type="button" data-rank-confirm-yes>✓ Oui, améliorer</button>'}</div></div>`;
    let finished = false;
    const finish = value => {
      if(finished)return;finished=true;
      document.removeEventListener('keydown',onKey,true);window.removeEventListener('resize',onResize);
      overlay.remove();if(previousFocus?.isConnected)previousFocus.focus();resolve(value);
    };
    const onKey = event => {if(event.key==='Escape'){event.preventDefault();event.stopImmediatePropagation();finish(false);}else if(event.key==='Tab')trapDesktopAdminFocus(event,overlay);};
    const onResize = () => {if(!isDesktopGameUi())finish(false);};
    overlay.addEventListener('click',event=>{
      if(event.target===overlay||event.target.closest('[data-rank-confirm-no]'))finish(false);
      else if(event.target.closest('[data-rank-confirm-yes]'))finish(true);
    });
    document.body.appendChild(overlay);document.addEventListener('keydown',onKey,true);window.addEventListener('resize',onResize);
    overlay.querySelector('[data-rank-confirm-no]').focus();
  });
}
let lovysRankUpgradeBusy = false;
async function rankUpLovysFromButton(rankBtn){
  if(lovysRankUpgradeBusy)return;
  const lovysId=Number(rankBtn?.dataset.rankLovys||0);
  const chosen=(lovysCollectionData?.lovys||[]).find(l=>Number(l.id)===lovysId);
  if(!chosen)return;
  lovysRankUpgradeBusy=true;
  rankBtn.disabled=true;
  try{
    const approved = isDesktopGameUi() ? await confirmLovysRankInGame(chosen) : confirm(`Améliorer ${chosen.name} pour ${Number(chosen.nextRankCost||0)} fragments ? Les fragments universels peuvent couvrir jusqu’à 50 % du coût si nécessaire.`);
    if(!approved)return;
    const r=await fetch('/api/lovys/rank-up',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({lovysId})});
    const d=await r.json();
    if(!r.ok)throw new Error(d.error||'Amélioration impossible.');
    if(isDesktopGameUi())showLovysRankCelebration(chosen,d.rank);
    else alert(d.message||'Rang amélioré !');
    await loadGame();
    await loadLovysCollection();
    await loadPve();
  }catch(error){
    if(isDesktopGameUi())await confirmLovysRankInGame(chosen,error.message||'Amélioration impossible.');
    else alert(error.message||'Amélioration impossible.');
  }finally{
    lovysRankUpgradeBusy=false;
    if(document.body.contains(rankBtn)) rankBtn.disabled=false;
  }
}
$('lovysCollectionGrid')?.addEventListener('click',async e=>{
  const view=e.target.closest('[data-view-lovys]'); if(view){const chosen=(lovysCollectionData?.lovys||[]).find(l=>Number(l.id)===Number(view.dataset.viewLovys));renderLovysDetail(chosen);return;}
  const incubator=e.target.closest('[data-lovys-incubator]');if(incubator){$('openIncubator')?.click();return;}
  const activate=e.target.closest('[data-activate-lovys]');
  if(activate){activate.disabled=true;const r=await fetch('/api/lovys/activate',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({lovysId:Number(activate.dataset.activateLovys)})});const d=await r.json();if(!r.ok){alert(d.error||'Impossible de changer de Lovys.');activate.disabled=false;return;}await loadGame();await loadLovysCollection();return;}
  const rankBtn=e.target.closest('[data-rank-lovys]');
  if(rankBtn){await rankUpLovysFromButton(rankBtn);return;}
  const transfer=e.target.closest('[data-transfer-lovys]');
  if(transfer){openLovysXpTransferConfirm(Number(lovysCollectionData.pendingXp||0),null,Number(transfer.dataset.transferLovys));}
});
$('lovysFragmentsGrid')?.addEventListener('click',async e=>{
  const rankBtn=e.target.closest('[data-rank-lovys]');
  if(rankBtn) await rankUpLovysFromButton(rankBtn);
});
function openLovysFragmentTrades(){
  lobbyTab='trades';
  if(typeof isDesktopGameUi==='function'&&isDesktopGameUi()){
    const nextHash='#lobby';
    if(location.hash===nextHash) openDesktopView('lobby');
    else location.hash=nextHash;
    return;
  }
  if(isMobileGameUi()){ toggleMobilePanel('community'); return; }
  document.querySelector('[data-lobby-tab="trades"]')?.click();
}
function mobileLovysTalentHelpMarkup(active){
  const name=escapeHtml(active?.name||'ton Lovys');
  const talent=active?.talent;
  const previews=active?.rankPreviews||[];
  const cost=Number(active?.nextRankCost||0);
  const rank=Math.max(1,Number(active?.rank||1));
  const stages=[{rank:1,label:'Rangs 1 et 2'},{rank:3,label:'Rangs 3 et 4'},{rank:5,label:'Rang 5'}];
  const evolution=stages.map(stage=>{
    const preview=previews.find(item=>Number(item.rank)===stage.rank);
    if(!preview?.talent?.description)return '';
    return `<span><strong>${stage.label} :</strong> ${escapeHtml(preview.talent.description)}</span>`;
  }).join('');
  return `<div><b>✨ Le talent fonctionne automatiquement</b><span>${talent?`${escapeHtml(talent.icon||'✨')} ${escapeHtml(talent.name||'Talent')} de ${name} : ${escapeHtml(talent.description||'')}`:'Chaque Lovys possède son propre talent passif.'}</span><span>Tu n’as aucun bouton à activer : le talent agit en combat selon les conditions de sa description. Un pourcentage peut représenter une chance de déclenchement ou un bonus, selon le talent.</span></div>
  <div><b>⭐ Augmente le rang pour renforcer le talent</b><span>Le talent s’améliore au rang 3, puis au rang 5. Les rangs 2 et 4 gardent le même effet de talent que le rang précédent.</span>${evolution}</div>
  <div><b>🧩 Récupère les fragments de ${name}</b><span>Fais éclore un œuf : si tu obtiens un Lovys déjà découvert, le doublon donne des fragments de ce Lovys. Tu peux aussi en obtenir par un échange dans Communauté → Échanges.</span><span>Les fragments universels peuvent compléter jusqu’à 50 % du coût d’un rang.</span></div>
  <div><b>👆 Passe au rang suivant</b><span>${rank>=5?'Ton Lovys est déjà au rang maximum : son talent a atteint son dernier palier.':`Ouvre Mes Lovys → Fragments, retrouve ${name}, puis appuie sur « Passer au rang ${rank+1} » et confirme.${cost?` Ce passage coûte ${cost} fragments.`:''} Le bouton s’active quand tu as assez de fragments.`}</span><span>Pour atteindre le rang 3 ou 5, passe chaque rang dans l’ordre. Consulte « Évolution du talent » pour voir le résultat.</span></div>
  <div><b>⚡ L’XP augmente le niveau</b><span>« Donner de l’XP » améliore le niveau et les statistiques. Pour augmenter les pourcentages du talent, utilise les fragments pour monter le rang.</span></div>`;
}
function openLovysKitHelp(){
  let modal=document.getElementById('lovysKitHelpModal');
  const mode=isMobileGameUi()?'mobile':'pc';
  if(modal && modal.dataset.helpMode && modal.dataset.helpMode!==mode){modal.remove();modal=null;}
  if(!modal){
    modal=document.createElement('div'); modal.id='lovysKitHelpModal'; modal.className='lovys-help-modal';
    modal.innerHTML=`<div class="lovys-help-card" role="dialog" aria-modal="true" aria-labelledby="lovysHelpTitle"><button class="lovys-help-close" type="button" aria-label="Fermer">×</button><div class="lovys-help-kicker">GUIDE RAPIDE</div><h3 id="lovysHelpTitle">Comment fonctionnent les Lovys ?</h3><div class="lovys-help-steps"><div><b>🧩 Doublons → fragments</b><span>Obtenir un Lovys déjà découvert te donne des fragments liés à sa rareté.</span></div><div><b>⭐ Fragments → rang</b><span>Accumule les fragments nécessaires pour faire évoluer ton Lovys jusqu’à 5 étoiles.</span></div><div><b>✨ Rang → talent renforcé</b><span>Chaque nouveau rang améliore le talent passif de ton Lovys.</span></div><div><b>⚔️ Compétences de combat</b><span>Elles sont utilisées pendant les combats puis doivent attendre leur nombre de tours de recharge.</span></div><div><b>⚡ XP → niveau</b><span>L’XP augmente le niveau du Lovys. Le niveau et le rang sont deux progressions différentes.</span></div></div></div>`;
    document.body.appendChild(modal);
    modal.querySelector('.lovys-help-close')?.addEventListener('click',()=>modal.classList.remove('open'));
    modal.addEventListener('click',e=>{if(e.target===modal)modal.classList.remove('open')});
  }
  modal.dataset.helpMode=mode;
  if(mode==='mobile'){
    const active=(lovysCollectionData?.lovys||[]).find(l=>l.isActive)||(lovysCollectionData?.lovys||[])[0];
    modal.querySelector('.lovys-help-kicker').textContent='TALENT PASSIF';
    modal.querySelector('#lovysHelpTitle').textContent='Comment améliorer ton talent ?';
    modal.querySelector('.lovys-help-steps').innerHTML=mobileLovysTalentHelpMarkup(active);
  }
  modal.classList.add('open');
}

$('lovysActiveHero')?.addEventListener('click',e=>{const rank=e.target.closest('[data-rank-lovys]');if(rank){rankUpLovysFromButton(rank);return;}const help=e.target.closest('.lovys-kit-info');if(help){openLovysKitHelp();return;}const trade=e.target.closest('[data-find-lovys-fragments]');if(trade){openLovysFragmentTrades();return;}const pve=e.target.closest('[data-lovys-pve]');if(pve){$('openPve')?.click();return;}const transfer=e.target.closest('[data-transfer-lovys]');if(transfer)openLovysXpTransferConfirm(Number(lovysCollectionData.pendingXp||0),null,Number(transfer.dataset.transferLovys));});
$('lovysNowStrip')?.addEventListener('click',e=>{const transfer=e.target.closest('[data-transfer-lovys]');if(transfer){openLovysXpTransferConfirm(Number(lovysCollectionData.pendingXp||0),null,Number(transfer.dataset.transferLovys));return;}if(e.target.closest('[data-lovys-incubator]')){
    if(isMobileGameUi()){closeAllMobilePanels();syncMobileNavState();document.querySelector('.incubator-topbar')?.scrollIntoView({behavior:'smooth',block:'start'});}
    else $('openIncubator')?.click();
  }});
$('lovysDetailPanel')?.addEventListener('click',e=>{if(e.target.closest('[data-close-lovys-detail]'))$('lovysDetailPanel')?.classList.add('hidden');});


const FRAGMENT_EGG_PRICE=10;
let fragmentShopQty=1;
function fragmentCurrentBalance(){return Math.max(0,Number(pveMapState?.data?.eggFragments ?? me?.user?.egg_fragments ?? 0));}
function fragmentShopEggMarkup(){return `<div class="fragment-shop-egg-premium" aria-hidden="true"></div>`;}
function updateFragmentShopUi(){
  const balance=fragmentCurrentBalance();
  const max=Math.max(1,Math.floor(balance/FRAGMENT_EGG_PRICE));
  fragmentShopQty=Math.max(1,Math.min(fragmentShopQty,max));
  if($('fragmentShopBalance'))$('fragmentShopBalance').textContent=String(balance);
  if($('fragmentShopQty'))$('fragmentShopQty').textContent=String(fragmentShopQty);
  if($('fragmentShopTotal'))$('fragmentShopTotal').textContent=String(fragmentShopQty*FRAGMENT_EGG_PRICE);
  const buy=$('fragmentShopBuy');
  if(buy){buy.disabled=balance<FRAGMENT_EGG_PRICE;buy.textContent=balance<FRAGMENT_EGG_PRICE?`Il faut ${FRAGMENT_EGG_PRICE} fragments`:`Acheter ${fragmentShopQty} œuf${fragmentShopQty>1?'s':''}`;}
}
function openFragmentShop(){fragmentShopQty=1;const msg=$('fragmentShopMessage');if(msg){msg.textContent='';msg.className='fragment-shop-message';}const egg=$('fragmentShopModal')?.querySelector('.fragment-shop-egg');if(egg)egg.innerHTML=fragmentShopEggMarkup();updateFragmentShopUi();$('fragmentShopModal')?.classList.remove('hidden');}
function closeFragmentShop(){$('fragmentShopModal')?.classList.add('hidden');}
document.addEventListener('click',e=>{const open=e.target.closest('[data-open-fragment-shop]');if(open){e.preventDefault();openFragmentShop();}});
$('fragmentShopClose')?.addEventListener('click',closeFragmentShop);
$('fragmentShopModal')?.addEventListener('click',e=>{if(e.target.id==='fragmentShopModal')closeFragmentShop();});
$('fragmentShopMinus')?.addEventListener('click',()=>{fragmentShopQty=Math.max(1,fragmentShopQty-1);updateFragmentShopUi();});
$('fragmentShopPlus')?.addEventListener('click',()=>{const max=Math.max(1,Math.floor(fragmentCurrentBalance()/FRAGMENT_EGG_PRICE));fragmentShopQty=Math.min(max,fragmentShopQty+1);updateFragmentShopUi();});
$('fragmentShopBuy')?.addEventListener('click',async()=>{
  const btn=$('fragmentShopBuy'),msg=$('fragmentShopMessage');if(!btn)return;
  btn.disabled=true;if(msg){msg.textContent='Achat en cours…';msg.className='fragment-shop-message';}
  try{
    const r=await fetch('/api/fragments/buy-egg',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({quantity:fragmentShopQty})});
    const d=await r.json();
    if(!r.ok)throw new Error(d.error||'Achat impossible.');
    if(me?.user)me.user.egg_fragments=Number(d.fragments||0);
    if(pveMapState?.data)pveMapState.data.eggFragments=Number(d.fragments||0);
    setHubFragmentsButton(Number(d.fragments||0));
    if(msg){msg.textContent=`✓ ${fragmentShopQty} œuf${fragmentShopQty>1?'s':''} ajouté${fragmentShopQty>1?'s':''} à ton inventaire.`;msg.className='fragment-shop-message ok';}
    fragmentShopQty=1;updateFragmentShopUi();
    await loadGame();
    if(!$('pveModal')?.classList.contains('hidden'))await loadPve();
  }catch(err){if(msg){msg.textContent=err.message;msg.className='fragment-shop-message error';}updateFragmentShopUi();}
});

let pveMapState={data:null,selectedZone:null,selectedFight:null,view:'map'};
let pveBattleState={running:false,battle:null,fight:null,lastResult:null,uiHp:{player:0,enemy:0},auto:false,autoToken:0};
function pveFightInfoByKey(key){for(const z of (pveMapState.data?.zones||[])){const f=(z.fights||[]).find(x=>x.key===key);if(f)return {fight:f,zone:z,zoneIndex:(pveMapState.data.zones||[]).indexOf(z),fightIndex:(z.fights||[]).indexOf(f)};}return null;}
function pveZoneAccessible(zone){return Boolean((zone?.fights||[]).some(f=>f.unlocked||f.won));}
function pveZoneComplete(zone){const fights=zone?.fights||[];return fights.length>0&&fights.every(f=>f.won);}
function pveDefaultZoneIndex(data){const zones=data?.zones||[];const pending=zones.findIndex(z=>(z.fights||[]).some(f=>f.unlocked&&!f.won));if(pending>=0)return pending;const lastAccessible=zones.map((z,i)=>pveZoneAccessible(z)?i:-1).filter(i=>i>=0).pop();return Number.isFinite(lastAccessible)?lastAccessible:0;}
function pveVisibleZoneCount(data){const zones=data?.zones||[];if(!zones.length)return 0;let count=1;while(count<zones.length&&pveZoneComplete(zones[count-1]))count++;return count;}
function pveSelectedFight(zone){if(!zone)return null;const chosen=(zone.fights||[]).find(f=>f.key===pveMapState.selectedFight&&(f.unlocked||f.won));if(chosen)return chosen;return (zone.fights||[]).find(f=>f.unlocked&&!f.won)||(zone.fights||[]).slice().reverse().find(f=>f.won)||(zone.fights||[])[0]||null;}
function pveTravelerMarkup(step=0){const id=me?.user?.creature_id;const evo=me?.user?.progression?.evolution||0;return `<div class="pve-map-traveler" aria-label="Ton Lovys, position actuelle${step?` étape ${step}`:''}"><span class="pve-map-traveler-beam" aria-hidden="true"></span><span class="pve-map-traveler-ring r1" aria-hidden="true"></span><span class="pve-map-traveler-ring r2" aria-hidden="true"></span><span class="pve-map-traveler-art">${id?art(id,evo,true):'🐉'}</span><span class="pve-map-traveler-tag">Ton Lovys${step?`<span class="pve-map-traveler-step">Étape ${step}</span>`:''}</span></div>`;}
function pveFightDetailMarkup(f){
  if(!f)return'';
  const state=f.won?'Terminé':f.unlocked?'Disponible':'Verrouillé';
  const cfg=pveEnemyVisual(f)||{};
  const monster=pveEnemySpriteMarkup(f);
  const rewardFragments=Number(f.rewards?.fragments||0);
  return `<div class="pve-map-detail-backdrop" data-pve-detail-backdrop><div class="pve-map-detail pve-monster-popup" role="dialog" aria-modal="true" aria-label="${escapeHtml(f.name)}"><button class="pve-map-detail-close pve-monster-popup-close" type="button" data-pve-detail-close aria-label="Fermer">×</button><div class="pve-monster-popup-visual" style="--popup-glow:${escapeHtml(cfg.glow||'#9147ff')}"><div class="pve-monster-popup-halo"></div>${monster}<div class="pve-monster-popup-shadow"></div></div><div class="pve-monster-popup-info"><div class="pve-monster-popup-kicker">${f.boss?'BOSS':'CRÉATURE'} · ${state.toUpperCase()}</div><div class="pve-map-detail-title">${f.boss?'👑 ':''}${escapeHtml(f.name)}</div><div class="pve-map-detail-type">Niv. ${Number(f.level||1)} · ${escapeHtml(f.type||'Neutre')}</div><div class="pve-map-detail-stats"><div class="pve-map-detail-stat"><b>❤️ ${Number(f.hp||0)}</b><span>PV</span></div><div class="pve-map-detail-stat"><b>⚔️ ${Number((f.attack??f.power)||0)}</b><span>ATQ</span></div><div class="pve-map-detail-stat"><b>🛡️ ${Math.round(Number(f.defense||0))}</b><span>DEF</span></div><div class="pve-map-detail-stat"><b>⚡ ${Math.round(Number(f.speed||0))}</b><span>VIT</span></div></div>${f.mechanic?`<div class="pve-boss-mechanic"><strong>👑 ${escapeHtml(f.mechanic.name||'Mécanique de boss')}</strong><span>${escapeHtml(f.mechanic.description||'')}</span></div>`:''}<div class="pve-map-detail-reward">🎁 <strong>1re victoire</strong> · +${Number(f.rewards?.creatureXp||0)} XP Lovys · +${Number(f.rewards?.globalXp||0)} XP globale · +${rewardFragments} Fragment${rewardFragments>1?'s':''} d’œuf</div><div class="pve-map-detail-actions"><button class="hub-btn pve-monster-popup-fight" data-fight="${escapeHtml(f.key)}" ${!f.unlocked?'disabled':''}>${f.won?'↻ Rejouer':f.unlocked?'⚔️ Combattre':'🔒 Combat verrouillé'}</button></div></div></div></div>`;
}
function pveFragmentsMarkup(data){let all=0,earned=0;const zones=(data?.zones||[]).map(z=>{let zAll=0,zEarned=0;const rows=(z.fights||[]).map(f=>{const n=Number(f.rewards?.fragments||0);zAll+=n;if(f.won)zEarned+=n;return `<div class="pve-fragment-row ${f.won?'won':(!f.unlocked?'locked':'')}"><div class="pve-fragment-row-main"><div class="pve-fragment-row-name">${f.boss?'👑 ':''}${escapeHtml(f.name)}</div><div class="pve-fragment-row-state">${f.won?'Récompense récupérée':f.unlocked?'Première victoire disponible':'Combat verrouillé'}</div></div><div class="pve-fragment-row-reward">${f.won?'✓ ':''}+${n} ${fragmentIconMarkup()}</div></div>`}).join('');all+=zAll;earned+=zEarned;return `<section class="pve-fragment-zone"><div class="pve-fragment-zone-head"><div class="pve-fragment-zone-name">${z.icon||'🗺️'} ${escapeHtml(z.name)}</div><div class="pve-fragment-zone-count">${zEarned} / ${zAll} gagnés</div></div><div class="pve-fragment-fights">${rows}</div></section>`}).join('');return `<div class="pve-fragments-panel"><section class="pve-fragment-hero"><div class="pve-fragment-kicker">Réserve de fragments d’œuf</div><div class="pve-fragment-balance">${fragmentIconMarkup('fragment-inline-icon fragment-inline-icon-lg')} ${Number(data?.eggFragments||0)} <small>fragment${Number(data?.eggFragments||0)>1?'s':''}</small></div><div class="pve-fragment-explain">Les fragments sont séparés du LoVeR'Cash. Tu les gagnes surtout lors des <strong>premières victoires PvE</strong> et ils restent synchronisés sur ton compte entre PC et mobile.</div><button class="hub-btn" data-open-fragment-shop type="button" style="margin-top:12px">${fragmentIconMarkup()} Ouvrir la boutique de fragments</button></section><div class="pve-fragment-info-grid"><div class="pve-fragment-info"><div class="pve-fragment-info-icon">⚔️</div><div class="pve-fragment-info-title">Comment en gagner ?</div><div class="pve-fragment-info-copy">Remporte un combat pour la première fois. Rejouer un combat déjà gagné ne redonne pas cette récompense.</div></div><div class="pve-fragment-info"><div class="pve-fragment-info-icon">${fragmentIconMarkup('fragment-inline-icon fragment-inline-icon-lg')}</div><div class="pve-fragment-info-title">Ressource des œufs</div><div class="pve-fragment-info-copy">Ton solde est conservé sur ton compte et sert de ressource dédiée au système d’œufs et d’incubation.</div></div><div class="pve-fragment-info"><div class="pve-fragment-info-icon">📊</div><div class="pve-fragment-info-title">Progression</div><div class="pve-fragment-info-copy">${earned} fragment(s) récupéré(s) sur ${all} actuellement proposés par les zones PvE.</div></div></div><div class="pve-fragment-zone-list">${zones}</div><div class="pve-fragment-footer">💡 Cette page te permet de voir immédiatement où récupérer les prochains fragments sans chercher combat par combat.</div></div>`;}
function pveZoneVisualMeta(zone){
  const key=String(zone?.key||'forest');
  const map={
    forest:{lore:'Une forêt suspendue baignée de cristaux vivants. Les racines anciennes protègent le passage vers le Gardien Sylvestre.',danger:'🌿 Verdance · Cristaux · Îlots suspendus'},
    ember:{lore:'Un chemin suspendu traverse les Forges du Cœur Ardent. Plus tu montes au-dessus du magma, plus la chaleur et les gardiens deviennent redoutables.',danger:'🔥 Cendre · Forge · Magma · Obsidienne'},
    night:{lore:'Des ruines flottent dans une nuit éternelle. Brume, miroirs et énergie du Néant entourent le Seigneur de l’Éclipse.',danger:'🌙 Néant · Mirage · Ruines astrales'}
  };
  return map[key]||map.forest;
}
function pveWorldSceneryMarkup(zone){
  const key=String(zone?.key||'forest');
  return `<div class="pve-zone-world" aria-hidden="true"><div class="pve-world-stars"></div><div class="pve-world-orb"></div><div class="pve-island i1"></div><div class="pve-island i2"></div><div class="pve-island i3"></div><i class="pve-crystal c1"></i><i class="pve-crystal c2"></i><i class="pve-crystal c3"></i><i class="pve-crystal c4"></i><i class="pve-waterfall w1"></i><i class="pve-waterfall w2"></i><i class="pve-tree t1"></i><i class="pve-tree t2"></i><i class="pve-lava l1"></i><i class="pve-lava l2"></i><i class="pve-ember e1"></i><i class="pve-ember e2"></i><i class="pve-ember e3"></i><i class="pve-ember e4"></i><i class="pve-ruin r1"></i><i class="pve-ruin r2"></i><i class="pve-mist m1"></i><i class="pve-mist m2"></i><div class="pve-world-haze"></div></div>`;
}
function pveRouteSvgMarkup(zoneKey=''){
  // Zones 1 et 2 : le fond contient déjà le vrai chemin. On place uniquement les combats dessus.
  if(['forest','ember'].includes(String(zoneKey))) return '';
  const generic='M50 97 C21 90 22 80 54 76 C84 72 79 62 46 58 C16 54 20 44 55 40 C83 36 78 26 47 22 C24 19 27 11 51 4';
  return `<svg class="pve-route-svg" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><path class="pve-route-shadow" vector-effect="non-scaling-stroke" d="${generic}"/><path class="pve-route-line" vector-effect="non-scaling-stroke" d="${generic}"/></svg>`;
}
function pveLovysSidebarMarkup(){
  const lovys=lovysCollectionData?.lovys||[];
  if(!lovys.length)return `<aside class="pve-lovys-sidebar"><div class="pve-lovys-sidebar-title">🐉 Mes Lovys</div><div class="pve-lovys-sidebar-sub">Aucun Lovys disponible.</div></aside>`;
  const cards=lovys.map(l=>`<button class="pve-lovys-choice ${l.isActive?'active':''}" type="button" data-pve-lovys="${Number(l.id)}"><span class="pve-lovys-choice-art">${artForLovys(l.creatureId,l.evolution||0,true)}</span><span><span class="pve-lovys-choice-name">${escapeHtml(l.name)}</span><span class="pve-lovys-choice-meta">${escapeHtml(l.type)} · Niv. ${Number(l.level||1)} · ${'⭐'.repeat(Math.max(1,Number(l.rank||1)))}<br>❤️ ${Number(l.stats?.hp||l.hp||0)} · ⚔️ ${Number(l.stats?.attack||l.power||0)} · 🛡️ ${Number(l.stats?.defense||0)} · ⚡ ${Number(l.stats?.speed||0)}</span>${l.isActive?'<span class="pve-lovys-choice-active">Sélectionné pour le PvE</span>':''}</span></button>`).join('');
  return `<aside class="pve-lovys-sidebar"><div class="pve-lovys-sidebar-title">🐉 Mes Lovys</div><div class="pve-lovys-sidebar-sub">Sélectionne le Lovys qui combattra sur la carte.</div><div class="pve-lovys-list">${cards}</div></aside>`;
}

function pveMapEnemyNodeMarkup(f){
  const cfg=pveEnemyVisual(f)||{};
  let visual='';
  if(cfg.image){
    visual=`<img loading="lazy" decoding="async" src="${escapeHtml(cfg.image)}" alt="" draggable="false">`;
  }else{
    visual=pveEnemySvg(f);
  }
  return `<span class="pve-map-node-monster" aria-hidden="true">${visual}</span>${!f.unlocked&&!f.won?'<span class="pve-map-node-lock" aria-hidden="true">🔒</span>':''}`;
}

function renderPveAdventureMap(data,zoneIndex=null){
  const box=$('pveContent');if(!box)return;
  pveMapState.data=data;
  pveMapState.view='map';
  const zones=data.zones||[];
  const visibleZoneCount=pveVisibleZoneCount(data);
  const visibleZones=zones.slice(0,visibleZoneCount||zones.length);
  if(zoneIndex===null||zoneIndex===undefined)zoneIndex=pveMapState.selectedZone;
  if(zoneIndex===null||zoneIndex===undefined||zoneIndex>=visibleZoneCount||!zones[zoneIndex]||!pveZoneAccessible(zones[zoneIndex]))zoneIndex=Math.min(pveDefaultZoneIndex(data),Math.max(0,visibleZoneCount-1));
  pveMapState.selectedZone=zoneIndex;
  const zone=zones[zoneIndex]||visibleZones[0];if(!zone){box.innerHTML='<div class="combat-report">Aucune zone disponible.</div>';return;}
  const visual=pveZoneVisualMeta(zone);
  const selected=pveSelectedFight(zone);pveMapState.selectedFight=selected?.key||null;
  const current=(zone.fights||[]).find(f=>f.unlocked&&!f.won)||(zone.fights||[]).slice().reverse().find(f=>f.won);
  const currentKey=current?.key;
  const wonCount=(zone.fights||[]).filter(f=>f.won).length;
  const zoneTabs=visibleZones.map((z,i)=>`<button class="pve-zone-tab ${i===zoneIndex?'active':''} ${pveZoneComplete(z)?'complete':''}" type="button" data-pve-zone="${i}">${z.icon||'🗺️'} ${escapeHtml(z.name)}</button>`).join('');
  const reversed=[...(zone.fights||[])].reverse();
  const route=reversed.map(f=>{const originalIndex=(zone.fights||[]).findIndex(x=>x.key===f.key);const side=originalIndex%2===0?'left':'right';const isCurrent=f.key===currentKey;const state=f.won?'won':(!f.unlocked?'locked':isCurrent?'current':'');const isFinal=Boolean(f.finalBoss||f.boss&&originalIndex===(zone.fights||[]).length-1);const bossClass=isFinal?'boss final-boss':f.boss?'boss':'';const badge=isFinal?'Boss de zone':f.boss?'Mini-boss':f.won?'Validé':isCurrent?'Position actuelle':'Étape';const forestPathPos=[[63.0,92.0],[47.0,84.0],[39.0,71.0],[53.0,63.0],[68.0,54.0],[61.0,41.0],[47.0,35.0],[39.0,25.0],[58.0,17.0],[51.0,10.0]];const emberPathPos=[[56.25,91.59],[42.29,83.19],[46.36,69.94],[(window.innerWidth>=1024?55.80:60.80),(window.innerWidth>=1024?65.60:62.20)],[65.20,53.60],[49.40,43.90],[52.40,34.70],[58.68,18.00],[56.50,8.50],[66.02,7.76]];const pathPos=zone.key==='forest'?forestPathPos:zone.key==='ember'?emberPathPos:null;const pos=pathPos?pathPos[Math.max(0,Math.min(pathPos.length-1,originalIndex))]:null;const posStyle=(pos)?` style="--pve-x:${pos[0]}%;--pve-y:${pos[1]}%"`:'';return `<div class="pve-map-stop ${side}" data-stop-key="${escapeHtml(f.key)}"${posStyle}><div class="pve-map-node-wrap"><button class="pve-map-node ${state} ${bossClass}" data-step="${originalIndex+1}" type="button" data-pve-node="${escapeHtml(f.key)}" aria-label="Combat ${originalIndex+1} : ${escapeHtml(f.name)}" >${pveMapEnemyNodeMarkup(f)}</button><div class="pve-map-node-label">${f.boss?`<div class="pve-map-boss-heading"><span class="pve-map-boss-logo ${isFinal?'zone-boss':'mini-boss'}" aria-hidden="true"><span class="pve-map-boss-logo-mark">${isFinal?'B':'M'}</span></span><span class="pve-map-boss-kind">${isFinal?'BOSS DE ZONE':'MINI-BOSS'}</span></div>`:''}<div class="pve-map-node-name">${escapeHtml(f.name)}</div><div class="pve-map-node-meta">Niv. ${Number(f.level||1)} · ${escapeHtml(f.type||'')}</div><span class="pve-map-node-badge">${badge}</span></div>${isCurrent?pveTravelerMarkup(originalIndex+1):''}</div></div>`}).join('');
  const mainMarkup=`<div class="pve-desktop-main"><div class="pve-zone-tabs">${zoneTabs}</div><section class="pve-adventure-map theme-${escapeHtml(zone.key||'forest')} pve-map-enter">${pveWorldSceneryMarkup(zone)}<div class="pve-map-zone-head"><div class="pve-map-zone-kicker">Zone ${zoneIndex+1} · ${escapeHtml(visual.danger)}</div><div class="pve-map-zone-name">${zone.icon||'🗺️'} ${escapeHtml(zone.name)}</div><div class="pve-map-zone-lore">${escapeHtml(visual.lore)}</div><div class="pve-map-zone-progress">${wonCount} / ${(zone.fights||[]).length} combats terminés</div></div><div class="pve-map-route">${pveRouteSvgMarkup(zone.key)}<span class="pve-map-goal">Sommet · Boss</span>${route}<span class="pve-map-start">Départ</span></div><div id="pveMapDetail">${pveFightDetailMarkup(selected)}</div><div id="pveZoneTransition" class="pve-zone-transition"></div></section></div>`;
  box.innerHTML=window.matchMedia('(min-width:1024px)').matches?`<div class="pve-desktop-layout">${pveLovysSidebarMarkup()}${mainMarkup}</div>`:`<div class="pve-map-shell">${mainMarkup}</div>`;
  if(window.matchMedia('(min-width:1024px)').matches)$('pveMapDetail')?.classList.remove('detail-open');
}
async function loadPve(){const box=$('pveContent');if(!box)return;box.innerHTML='<p class="muted">Chargement…</p>';try{const [pveResponse]=await Promise.all([fetch('/api/pve',{cache:'no-store'}),loadLovysCollection()]);const d=await pveResponse.json();if(!pveResponse.ok)throw new Error(d.error||'Erreur');setHubFragmentsButton(Number(d.eggFragments||0));renderDesktopLovysHub(d);if(!d.hasCreature){box.innerHTML=`<div class="combat-report">${eggIconMarkup()} Ton œuf doit d’abord éclore avant de pouvoir combattre.</div>`;return;}renderPveAdventureMap(d);}catch(e){box.innerHTML=`<p class="muted">${escapeHtml(e.message)}</p>`;}}
async function refreshPveAfterVictory(zoneIndex=null){
  const [pveResponse]=await Promise.all([
    fetch('/api/pve',{cache:'no-store'}),
    loadGame(),
    loadLovysCollection()
  ]);
  const d=await pveResponse.json();
  if(!pveResponse.ok)throw new Error(d.error||'Erreur');
  setHubFragmentsButton(Number(d.eggFragments||0));
  renderDesktopLovysHub(d);
  if(!d.hasCreature){const box=$('pveContent');if(box)box.innerHTML=`<div class="combat-report">${eggIconMarkup()} Ton œuf doit d’abord éclore avant de pouvoir combattre.</div>`;return;}
  renderPveAdventureMap(d,zoneIndex);
}

async function animatePveTravelerToFight(fromKey,toKey){
  const traveler=document.querySelector('.pve-adventure-map .pve-map-traveler');
  const fromNode=document.querySelector(`[data-pve-node="${CSS.escape(fromKey)}"]`);
  const toNode=document.querySelector(`[data-pve-node="${CSS.escape(toKey)}"]`);
  if(!traveler||!fromNode||!toNode)return;
  if(window.matchMedia('(prefers-reduced-motion: reduce)').matches)return;
  const tr=traveler.getBoundingClientRect(),fr=fromNode.getBoundingClientRect(),to=toNode.getBoundingClientRect();
  const travelerCenterX=tr.left+tr.width/2,travelerCenterY=tr.top+tr.height/2;
  const fromCenterX=fr.left+fr.width/2,fromCenterY=fr.top+fr.height/2;
  const targetCenterX=to.left+to.width/2+(travelerCenterX-fromCenterX);
  const targetCenterY=to.top+to.height/2+(travelerCenterY-fromCenterY);
  const dx=targetCenterX-travelerCenterX,dy=targetCenterY-travelerCenterY;
  traveler.style.zIndex='40';
  const anim=traveler.animate([
    {transform:'translate(-50%,-135%) translate(0px,0px) scale(1)',filter:'brightness(1)',opacity:1},
    {offset:.22,transform:`translate(-50%,-135%) translate(${dx*.18}px,${dy*.18-12}px) scale(1.10)`,filter:'brightness(1.25)',opacity:1},
    {offset:.72,transform:`translate(-50%,-135%) translate(${dx*.78}px,${dy*.78-8}px) scale(1.04)`,filter:'brightness(1.18)',opacity:1},
    {transform:`translate(-50%,-135%) translate(${dx}px,${dy}px) scale(1)`,filter:'brightness(1)',opacity:1}
  ],{duration:850,easing:'cubic-bezier(.22,.78,.24,1)',fill:'forwards'});
  try{await anim.finished;}catch(_){ }
}

async function animatePveVictory(fightKey,result={}){
  const info=pveFightInfoByKey(fightKey);
  const node=document.querySelector(`[data-pve-node="${CSS.escape(fightKey)}"]`);
  node?.classList.add('just-won');
  const isFirstWin=Boolean(result?.firstWin);
  const isZoneEnd=Boolean(info&&info.fightIndex===(info.zone.fights||[]).length-1);
  const nextFight=info&&!isZoneEnd?(info.zone.fights||[])[info.fightIndex+1]:null;

  if(isFirstWin&&nextFight){
    await animatePveTravelerToFight(fightKey,nextFight.key);
    pveMapState.selectedFight=nextFight.key;
    await refreshPveAfterVictory(info?.zoneIndex??pveMapState.selectedZone);
    return;
  }

  if(isFirstWin&&isZoneEnd){
    document.querySelector('.pve-adventure-map')?.classList.add('traveler-moving');
    await new Promise(r=>setTimeout(r,720));
    const overlay=$('pveZoneTransition');
    const next=(pveMapState.data?.zones||[])[info.zoneIndex+1];
    if(overlay){
      overlay.innerHTML=`<div class="pve-zone-transition-card"><div class="pve-zone-transition-icon">${next?(next.icon||'🗺️'):'🏆'}</div><div class="pve-zone-transition-title">${next?'Zone terminée !':'Aventure terminée !'}</div><div class="pve-zone-transition-sub">${next?`Direction : ${escapeHtml(next.name)}`:'Tous les combats actuels ont été terminés.'}</div></div>`;
      overlay.classList.add('active');
    }
    await new Promise(r=>setTimeout(r,1000));
    pveMapState.selectedZone=null;
    pveMapState.selectedFight=null;
    await refreshPveAfterVictory();
    return;
  }

  // Rejouer un combat déjà gagné ne déplace pas le marqueur.
  await refreshPveAfterVictory(info?.zoneIndex??pveMapState.selectedZone);
}

const PVE_BESTIARY={
  forest_1:{zone:'forest',size:.70,boss:false,glow:'#73ebb0',image:'/pve/zone1/germe-sauvage.webp'},
  forest_2:{zone:'forest',size:.76,boss:false,glow:'#83efb6',image:'/pve/zone1/rodeur-mousseux.webp'},
  forest_3:{zone:'forest',size:.82,boss:false,glow:'#8feab9',image:'/pve/zone1/sentinelle-racines.webp'},
  forest_4:{zone:'forest',size:.78,boss:false,glow:'#bda0ff',image:'/pve/zone1/lucibulle-sylvestre.webp'},
  forest_5:{zone:'forest',size:.86,boss:false,glow:'#b9a0ff',image:'/pve/zone1/mycelium-vif.webp'},
  forest_6:{zone:'forest',size:1.02,boss:true,miniBoss:true,glow:'#7ff0a8',image:'/pve/zone1/gardien-racines.webp'},
  forest_7:{zone:'forest',size:.93,boss:false,glow:'#c2a2ff',image:'/pve/zone1/esprit-sous-bois.webp'},
  forest_8:{zone:'forest',size:1.00,boss:false,glow:'#bba0ff',image:'/pve/zone1/sylve-fractale.webp'},
  forest_9:{zone:'forest',size:1.08,boss:false,glow:'#8feea9',image:'/pve/zone1/grand-myceliarque.webp'},
  forest_boss:{zone:'forest',size:1.22,boss:true,glow:'#8df5b3',image:'/pve/zone1/monarque-premiers-eclats.webp'},
  ember_1:{zone:'ember',size:.72,boss:false,glow:'#ffb45f',image:'/pve/zone2/flammeche-cavernicole.webp'},
  ember_2:{zone:'ember',size:.80,boss:false,glow:'#ff9c4a',image:'/pve/zone2/roche-ardente.webp'},
  ember_3:{zone:'ember',size:.86,boss:false,glow:'#ff8d43',image:'/pve/zone2/salamandre-braise.webp'},
  ember_4:{zone:'ember',size:.82,boss:false,glow:'#ff9b4f',image:'/pve/zone2/scarabraise.webp'},
  ember_5:{zone:'ember',size:.90,boss:false,glow:'#e76cff',image:'/pve/zone2/fumarok.webp'},
  ember_6:{zone:'ember',size:1.05,boss:true,miniBoss:true,glow:'#ff7540',image:'/pve/zone2/colosse-scories.webp'},
  ember_7:{zone:'ember',size:.96,boss:false,glow:'#ff8a43',image:'/pve/zone2/vipere-magmatique.webp'},
  ember_8:{zone:'ember',size:1.02,boss:false,glow:'#ff7440',image:'/pve/zone2/obsidrake.webp'},
  ember_9:{zone:'ember',size:1.10,boss:false,glow:'#ff6538',image:'/pve/zone2/titan-forge.webp'},
  ember_boss:{zone:'ember',size:1.26,boss:true,glow:'#ff5b32',image:'/pve/zone2/coeur-magma.webp'},
  night_1:{zone:'night',size:.72,boss:false,glow:'#9b8fff',art:'moondrop'},
  night_2:{zone:'night',size:.82,boss:false,glow:'#8ee1ff',art:'shardowl'},
  night_3:{zone:'night',size:.93,boss:false,glow:'#c298ff',art:'mirrormoth'},
  night_4:{zone:'night',size:1.05,boss:false,glow:'#998cff',art:'duskknight'},
  night_mini:{zone:'night',size:1.16,boss:true,glow:'#caa8ff',art:'astralseer'},
  night_boss:{zone:'night',size:1.32,boss:true,glow:'#9181ff',art:'eclipsebehemoth'}
};
function pveEnemyVisual(fight){
  if(PVE_BESTIARY[fight?.key]) return PVE_BESTIARY[fight.key];
  const zone=String(fight?.zoneKey||fight?.zone||'night');
  const lvl=Number(fight?.level||1);
  const boss=Boolean(fight?.boss||fight?.finalBoss);
  if(zone==='forest') return boss?(lvl>=10?PVE_BESTIARY.forest_boss:PVE_BESTIARY.forest_6):lvl<=1?PVE_BESTIARY.forest_1:lvl<=2?PVE_BESTIARY.forest_2:lvl<=3?PVE_BESTIARY.forest_3:lvl<=4?PVE_BESTIARY.forest_4:lvl<=5?PVE_BESTIARY.forest_5:lvl<=7?PVE_BESTIARY.forest_7:lvl<=8?PVE_BESTIARY.forest_8:PVE_BESTIARY.forest_9;
  if(zone==='ember') return boss?(lvl>=15?PVE_BESTIARY.ember_boss:PVE_BESTIARY.ember_6):lvl<=5?PVE_BESTIARY.ember_1:lvl<=6?PVE_BESTIARY.ember_2:lvl<=7?PVE_BESTIARY.ember_3:lvl<=8?PVE_BESTIARY.ember_4:lvl<=9?PVE_BESTIARY.ember_5:lvl<=11?PVE_BESTIARY.ember_7:lvl<=12?PVE_BESTIARY.ember_8:PVE_BESTIARY.ember_9;
  return boss?(lvl>=15?PVE_BESTIARY.night_boss:PVE_BESTIARY.night_mini):lvl<=10?PVE_BESTIARY.night_1:lvl<=11?PVE_BESTIARY.night_2:lvl<=12?PVE_BESTIARY.night_3:PVE_BESTIARY.night_4;
}
function pveEnemySvg(fight){
  const cfg=pveEnemyVisual(fight),id='e'+String(fight?.key||'x').replace(/[^a-z0-9]/gi,'');
  const defs=`<defs><radialGradient id="g${id}" cx="34%" cy="24%"><stop offset="0" stop-color="#fff" stop-opacity=".32"/><stop offset=".36" stop-color="var(--m1)"/><stop offset="1" stop-color="var(--m2)"/></radialGradient><filter id="glow${id}"><feGaussianBlur stdDeviation="4" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>`;
  const shell=(body,extra='',m1='#6d58a5',m2='#201936')=>`<svg viewBox="0 0 180 180" style="--m1:${m1};--m2:${m2}" aria-hidden="true">${defs}<ellipse cx="90" cy="154" rx="46" ry="10" fill="#000" opacity=".22"/>${extra}<g>${body}</g></svg>`;
  switch(cfg.art){
    case 'seedling': return shell(`
      <circle cx="89" cy="101" r="34" fill="url(#g${id})" stroke="#75ebb1" stroke-width="4"/>
      <path d="M83 63c-12-18-24-16-28-9 10 0 18 5 22 16m11-7c10-18 25-17 30-10-11 0-18 7-23 16" fill="none" stroke="#8ff3be" stroke-width="7" stroke-linecap="round"/>
      <path d="M90 121c0 9-6 16-14 16-8 0-14-7-14-16 0-4 2-7 5-10 3 4 7 6 9 6s6-2 9-6c3 3 5 6 5 10Zm42 0c0 9-6 16-14 16s-14-7-14-16c0-4 2-7 5-10 3 4 7 6 9 6s6-2 9-6c3 3 5 6 5 10Z" fill="#25402d" opacity=".42"/>
      <circle cx="78" cy="103" r="5" fill="#effff5"/>
      <circle cx="102" cy="103" r="5" fill="#effff5"/>
      <path d="M81 120c6 5 13 5 19 0" fill="none" stroke="#e6ffef" stroke-width="4.2" stroke-linecap="round"/>
    `, `<circle cx="90" cy="95" r="50" fill="#67e7a4" opacity=".10" filter="url(#glow${id})"/>`, '#6dbb7a','#25402d');
    case 'bramblecub': return shell(`
      <path d="M47 114c0-30 18-50 45-50 26 0 44 18 44 47 0 27-19 44-46 44-28 0-43-15-43-41Z" fill="url(#g${id})" stroke="#88e5a8" stroke-width="4"/>
      <path d="M62 74 46 50l22 10 10 14m32 0 15-24 9 22-20 10" fill="#34543b" stroke="#98f0b7" stroke-width="4" stroke-linejoin="round" stroke-linecap="round"/>
      <circle cx="77" cy="103" r="5" fill="#f3fff7"/>
      <circle cx="104" cy="103" r="5" fill="#f3fff7"/>
      <path d="M79 121h24l-5 8H84Z" fill="#203126"/>
      <path d="M56 133c-14 8-24 6-30 1 13 0 20-5 24-13" fill="none" stroke="#53795a" stroke-width="9" stroke-linecap="round"/>
    `, `<circle cx="91" cy="92" r="53" fill="#7be8a8" opacity=".10" filter="url(#glow${id})"/>`, '#628968','#29392d');
    case 'rootwarden': return shell(`
      <path d="M55 132c-4-37 11-64 37-69 28-5 52 17 53 52 1 29-19 44-47 44-24 0-39-9-43-27Z" fill="url(#g${id})" stroke="#8ee4a4" stroke-width="4"/>
      <path d="M68 76 57 48m22 24-5-32m25 30 10-29m12 36 16-24" stroke="#7e6440" stroke-width="9" stroke-linecap="round"/>
      <path d="M67 136 49 159m35-18-5 25m32-25 13 23" stroke="#705537" stroke-width="10" stroke-linecap="round"/>
      <circle cx="80" cy="103" r="5" fill="#ecfff3"/>
      <circle cx="106" cy="103" r="5" fill="#ecfff3"/>
      <path d="M81 122c6 4 11 4 17 0" fill="none" stroke="#e8fff0" stroke-width="4" stroke-linecap="round"/>
    `, `<path d="M55 75c11-20 26-29 45-28 17 0 30 8 40 24" fill="none" stroke="#78edaa" stroke-width="5" opacity=".65"/>`, '#7b6948','#31271c');
    case 'grovewisp': return shell(`
      <path d="M90 45c26 0 44 25 40 57-4 31-21 50-40 50s-36-19-40-50c-4-32 14-57 40-57Z" fill="url(#g${id})" stroke="#d0a8ff" stroke-width="4"/>
      <path d="M61 86 38 68m82 17 23-18M64 124l-20 20m72-20 19 19" stroke="#9770db" stroke-width="8" stroke-linecap="round"/>
      <ellipse cx="77" cy="99" rx="5" ry="8" fill="#f5ebff"/>
      <ellipse cx="102" cy="99" rx="5" ry="8" fill="#f5ebff"/>
      <path d="M90 43V23m-10 8 10-11 10 11" fill="none" stroke="#9df0b8" stroke-width="5" stroke-linecap="round"/>
      <path d="M82 118c5 4 11 4 16 0" fill="none" stroke="#f4e5ff" stroke-width="4" stroke-linecap="round"/>
    `, `<circle cx="90" cy="90" r="60" fill="#b887ff" opacity=".12" filter="url(#glow${id})"/>`, '#8b67b4','#2c2242');
    case 'stagguardian': return shell(`
      <path d="M54 118c0-40 17-66 42-66 28 0 49 29 49 67 0 31-21 45-48 45-25 0-43-15-43-46Z" fill="url(#g${id})" stroke="#9df2b5" stroke-width="5"/>
      <path d="M68 69 47 39 34 19m27 33-4-28m60 44 18-29 11-20m-21 35 7-28" fill="none" stroke="#d0bb7f" stroke-width="8" stroke-linecap="round"/>
      <path d="M68 82c-10 13-15 27-17 43m74-43c10 13 15 27 17 43" fill="none" stroke="#4a744a" stroke-width="8"/>
      <circle cx="80" cy="108" r="6" fill="#ecfff2" filter="url(#glow${id})"/>
      <circle cx="112" cy="108" r="6" fill="#ecfff2" filter="url(#glow${id})"/>
      <path d="M89 125h15l-7 8Z" fill="#ecd6a0"/>
    `, `<circle cx="96" cy="96" r="69" fill="#86f1b0" opacity=".12" filter="url(#glow${id})"/>`, '#6b7351','#293122');
    case 'sparkimp': return shell(`
      <path d="M59 122c-4-28 8-50 28-56 20-6 40 10 44 38 5 30-10 48-37 51-21 3-31-8-35-33Z" fill="url(#g${id})" stroke="#ffb16a" stroke-width="4"/>
      <path d="M78 70c3-19 15-35 24-41-2 15 9 18 7 35m-42 26-17 10m83-8 18 8" fill="none" stroke="#ff8a4f" stroke-width="8" stroke-linecap="round"/>
      <circle cx="82" cy="108" r="5" fill="#fff0bd"/>
      <circle cx="106" cy="105" r="5" fill="#fff0bd"/>
      <path d="M86 123c7 4 13 4 19 0" fill="none" stroke="#ffe19b" stroke-width="4" stroke-linecap="round"/>
    `, `<circle cx="96" cy="92" r="50" fill="#ff6f3d" opacity=".14" filter="url(#glow${id})"/>`, '#955032','#351614');
    case 'coalboar': return shell(`
      <path d="M47 121c0-31 20-51 48-51 31 0 48 19 46 47-2 26-20 42-49 42-29 0-45-14-45-38Z" fill="url(#g${id})" stroke="#ffa86a" stroke-width="4"/>
      <path d="M61 84 50 60l18 9 9 16m37 1 15-22 9 19-18 10" fill="#5b3027" stroke="#ffb77c" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>
      <circle cx="79" cy="105" r="5" fill="#ffe6b3"/>
      <circle cx="104" cy="105" r="5" fill="#ffe6b3"/>
      <path d="M74 123h32l-6 10H80Z" fill="#201111"/>
      <path d="M54 134c-14 7-23 5-29 0 12 0 19-5 23-13" fill="none" stroke="#7a4b36" stroke-width="9" stroke-linecap="round"/>
    `, `<circle cx="93" cy="95" r="53" fill="#ff8654" opacity=".10" filter="url(#glow${id})"/>`, '#7b4333','#2d1715');
    case 'flarelizard': return shell(`
      <path d="M40 118c12-35 37-53 69-48 23 3 38 19 36 39-2 24-21 38-51 38-22 0-38-8-54-29Z" fill="url(#g${id})" stroke="#ff9f69" stroke-width="4"/>
      <path d="M51 124 26 142m90-2 26 13M123 89l24-11" stroke="#6b2b20" stroke-width="9" stroke-linecap="round"/>
      <path d="M133 120c18 4 22 18 14 28-2-11-11-12-21-10" fill="none" stroke="#ff7048" stroke-width="8" stroke-linecap="round"/>
      <circle cx="110" cy="100" r="6" fill="#fff0bf"/>
      <path d="M81 76c7-16 18-27 29-34-2 12 5 18 2 30" fill="#ff7d49"/>
    `, `<path d="M45 136c24 15 56 18 82 6" fill="none" stroke="#ff633d" stroke-width="4" opacity=".55"/>`, '#8f392a','#341616');
    case 'anvilguard': return shell(`
      <path d="M54 77 83 47l35 7 24 37-9 52-40 19-39-24Z" fill="url(#g${id})" stroke="#ffa86a" stroke-width="4"/>
      <path d="M56 93 29 105m106-12 24 13M68 147l-12 19m58-21 17 20" stroke="#4f2720" stroke-width="12" stroke-linecap="round"/>
      <rect x="72" y="86" width="16" height="10" rx="3" fill="#ffd78a"/>
      <rect x="104" y="86" width="16" height="10" rx="3" fill="#ffd78a"/>
      <path d="M79 120h35" stroke="#231314" stroke-width="8" stroke-linecap="round"/>
    `, `<path d="M67 64 80 77m36-18-10 21m24 31-22 1m-45 3-18 8" stroke="#ff6e45" stroke-width="4" opacity=".8"/>`, '#73433a','#2d1b19');
    case 'infernotitan': return shell(`
      <path d="M48 124 58 69l35-30 42 15 24 41-12 53-49 20-45-22Z" fill="url(#g${id})" stroke="#ff9d58" stroke-width="5"/>
      <path d="M59 86 29 68m111 19 25-20m-91 79-19 25m68-28 24 24" stroke="#61261d" stroke-width="15" stroke-linecap="round"/>
      <path d="M67 95c12-17 44-21 62-3l-8 39H74Z" fill="#261111"/>
      <path d="M77 101h16l-8 14Zm27 0h16l-8 14Z" fill="#ffd878"/>
      <path d="M81 127h33" stroke="#ffbb65" stroke-width="7" stroke-linecap="round"/>
      <path d="M79 52 91 24l8 26 15-20 1 31" fill="#ff6d42" filter="url(#glow${id})"/>
    `, `<circle cx="99" cy="104" r="66" fill="#ff6038" opacity=".17" filter="url(#glow${id})"/>`, '#95352b','#341515');
    case 'moondrop': return shell(`
      <path d="M90 46c24 0 39 24 35 53-3 19-12 27-14 44l-16-12-13 16-7-19-16 10c2-15-8-24-6-42 3-30 17-50 37-50Z" fill="url(#g${id})" stroke="#a499ff" stroke-width="4"/>
      <ellipse cx="78" cy="95" rx="5" ry="8" fill="#c7f2ff"/>
      <ellipse cx="101" cy="95" rx="5" ry="8" fill="#c7f2ff"/>
      <path d="M81 113c5 4 11 4 16 0" fill="none" stroke="#daf6ff" stroke-width="4" stroke-linecap="round"/>
    `, `<circle cx="89" cy="91" r="56" fill="#7e74ff" opacity=".14" filter="url(#glow${id})"/>`, '#5c57a8','#181530');
    case 'shardowl': return shell(`
      <path d="M52 122 65 76l28-24 30 23 12 46-20 34H70Z" fill="url(#g${id})" stroke="#95e7ff" stroke-width="4"/>
      <path d="M70 76 55 48l24 14 15-27 14 29 25-14-14 28" fill="#6488b2" stroke="#9df0ff" stroke-width="3" stroke-linejoin="round"/>
      <circle cx="78" cy="100" r="6" fill="#effbff"/>
      <circle cx="106" cy="100" r="6" fill="#effbff"/>
      <path d="M80 124h26" stroke="#afe8ff" stroke-width="5" stroke-linecap="round"/>
    `, `<circle cx="96" cy="92" r="56" fill="#6fd2ff" opacity=".13" filter="url(#glow${id})"/>`, '#50749f','#1d2942');
    case 'mirrormoth': return shell(`
      <path d="M89 43c25 0 43 22 39 53-2 21-12 32-18 49l-18-14-16 17-9-21-19 8c7-17 2-26 5-44 5-30 18-48 36-48Z" fill="url(#g${id})" stroke="#cd9cff" stroke-width="4"/>
      <path d="M90 56 73 92l17 31 18-32Z" fill="#9b86ff" opacity=".42"/>
      <path d="M57 70 40 58m83 9 18-12M60 123l-16 12m80-15 17 12" stroke="#8f7fff" stroke-width="3" opacity=".55"/>
      <circle cx="79" cy="91" r="5" fill="#f8efff"/>
      <circle cx="103" cy="91" r="5" fill="#f8efff"/>
    `, `<circle cx="90" cy="91" r="60" fill="#b07dff" opacity=".12" filter="url(#glow${id})"/>`, '#6d58a6','#20183f');
    case 'duskknight': return shell(`
      <path d="M61 82 87 50l35 18 18 44-19 46H71l-20-43Z" fill="url(#g${id})" stroke="#a59dff" stroke-width="4"/>
      <path d="M75 72 91 43l18 28 18 8-10 21H72l-12-19Z" fill="#29243f" stroke="#9d93ff" stroke-width="4"/>
      <path d="M80 92h34" stroke="#9aeaff" stroke-width="6" stroke-linecap="round"/>
      <path d="M51 111 28 129m110-19 22 19" stroke="#332d59" stroke-width="12" stroke-linecap="round"/>
      <path d="M116 112 140 89" stroke="#b5acff" stroke-width="7" stroke-linecap="round"/>
    `, `<circle cx="95" cy="100" r="62" fill="#786aff" opacity=".14" filter="url(#glow${id})"/>`, '#4f4974','#18152d');
    case 'astralseer': return shell(`
      <path d="M90 39c27 0 47 28 43 61-3 30-20 54-43 54s-39-24-43-54c-4-33 16-61 43-61Z" fill="url(#g${id})" stroke="#ddb8ff" stroke-width="4"/>
      <path d="M63 71 44 48l27 10m46 13 20-25-28 11" fill="none" stroke="#8a71c7" stroke-width="8" stroke-linecap="round"/>
      <ellipse cx="79" cy="98" rx="5" ry="9" fill="#f5ecff"/>
      <ellipse cx="103" cy="98" rx="5" ry="9" fill="#f5ecff"/>
      <path d="M90 74v44" stroke="#ddcbff" stroke-width="4"/>
      <circle cx="90" cy="67" r="10" fill="none" stroke="#9be8ff" stroke-width="4"/>
    `, `<circle cx="90" cy="90" r="68" fill="#b889ff" opacity=".14" filter="url(#glow${id})"/>`, '#725c96','#221a38');
    case 'eclipsebehemoth': return shell(`
      <path d="M50 123c0-47 19-80 46-80 30 0 53 36 53 80 0 32-22 46-53 46-28 0-46-14-46-46Z" fill="url(#g${id})" stroke="#a89cff" stroke-width="5"/>
      <path d="M67 75 47 45 33 21m86 53 19-30 11-24" fill="none" stroke="#6157aa" stroke-width="10" stroke-linecap="round"/>
      <path d="M65 91c13-15 51-15 64 0l-12 45H77Z" fill="#16132b"/>
      <ellipse cx="80" cy="104" rx="6" ry="10" fill="#b6f0ff" filter="url(#glow${id})"/>
      <ellipse cx="111" cy="104" rx="6" ry="10" fill="#b6f0ff" filter="url(#glow${id})"/>
      <path d="M89 133h15" stroke="#baabff" stroke-width="6" stroke-linecap="round"/>
      <circle cx="98" cy="33" r="23" fill="#18142d" stroke="#b4a2ff" stroke-width="5"/>
      <path d="M98 4v17M71 16l12 14m43-14-12 14" stroke="#b4a2ff" stroke-width="4"/>
    `, `<circle cx="98" cy="95" r="77" fill="#7868ff" opacity=".17" filter="url(#glow${id})"/>`, '#564a90','#17132c');
    default:
      return shell(`<circle cx="90" cy="100" r="48" fill="url(#g${id})"/><circle cx="75" cy="96" r="5" fill="#fff"/><circle cx="105" cy="96" r="5" fill="#fff"/>`);
  }
}
function pveEnemySpriteMarkup(fight){const cfg=pveEnemyVisual(fight);const bossClass=cfg.boss?'boss':'';if(cfg.image)return `<div class="pve-enemy-art ${bossClass} real-art" style="--enemy-size:${cfg.size};--enemy-glow:${cfg.glow}"><img loading="lazy" decoding="async" class="pve-enemy-photo" src="${cfg.image}" alt="${escapeHtml(fight?.name||'Monstre PvE')}"></div>`;return `<div class="pve-enemy-art ${bossClass}" style="--enemy-size:${cfg.size};--enemy-glow:${cfg.glow}">${pveEnemySvg(fight)}</div>`;}
function setPveHp(prefix,hp,maxHp){const pct=Math.max(0,Math.min(100,Number(hp||0)/Math.max(1,Number(maxHp||1))*100));const bar=$(prefix+'Hp'),txt=$(prefix+'HpText');if(bar){bar.style.width=pct+'%';bar.classList.toggle('mid',pct<=55&&pct>25);bar.classList.toggle('low',pct<=25);}if(txt)txt.textContent=`${Math.max(0,Math.round(hp))} / ${Math.max(1,Math.round(maxHp))}`;}
function pveWait(ms){return new Promise(r=>setTimeout(r,ms));}
function pveDamagePop(id,amount,prefix='-'){const el=$(id);if(!el)return;el.textContent=`${prefix}${Math.max(0,Math.round(amount))}`;el.classList.remove('show');void el.offsetWidth;el.classList.add('show');}
function pveBattleSetDisabled(disabled){
  // L'attaque normale est l'action de secours permanente : elle n'a jamais de cooldown
  // et reste visuellement disponible à chaque tour. Le verrou `running` dans
  // submitPveBattleAction empêche malgré tout les doubles actions pendant l'animation.
  const basic=$('pveBasicAttack');
  if(basic){basic.disabled=false;basic.dataset.cooldown='0';}
  [$('pveSkill1'),$('pveSkill2')].forEach(btn=>{
    if(!btn)return;
    btn.disabled=Boolean(disabled)||btn.dataset.cooldown==='1';
  });
}
function pveSkillButtonMarkup(skill,cooldown=0){if(!skill)return '';const cd=Math.max(0,Number(cooldown||0));return `<span>${escapeHtml(skill.icon||'✨')}</span><strong>${escapeHtml(skill.name||'Compétence')}</strong><small>${cd?`Recharge : ${cd} tour${cd>1?'s':''}`:escapeHtml(skill.description||'Prête')}</small>`;}
function renderPveBattleActions(){const battle=pveBattleState.battle;if(!battle)return;const basic=$('pveBasicAttack');if(basic){basic.disabled=false;basic.dataset.cooldown='0';}const skills=battle.player?.skills||[];const cooldowns=battle.player?.cooldowns||{};[$('pveSkill1'),$('pveSkill2')].forEach((btn,i)=>{if(!btn)return;const skill=skills[i];if(!skill){btn.classList.add('hidden');return;}btn.classList.remove('hidden');const cd=Math.max(0,Number(cooldowns[skill.key]||0));btn.dataset.battleAction=skill.key;btn.dataset.cooldown=cd>0?'1':'0';btn.innerHTML=pveSkillButtonMarkup(skill,cd);btn.disabled=cd>0;});}
function renderPveBattleEffects(){const b=pveBattleState.battle;if(!b)return;const chips=[];if(b.player?.talent)chips.push(`<span class="pve-effect-chip player">${escapeHtml(b.player.talent.icon||'✨')} ${escapeHtml(b.player.talent.name||'Talent')}</span>`);if(b.enemy?.mechanic)chips.push(`<span class="pve-effect-chip boss">👑 ${escapeHtml(b.enemy.mechanic.name||'Mécanique')}</span>`);$('pveBattleEffects').innerHTML=chips.join('');}
function syncPveBattleUi(battle){if(!battle)return;pveBattleState.battle=battle;setPveHp('pveBattlePlayer',battle.player.hp,battle.player.maxHp);setPveHp('pveBattleEnemy',battle.enemy.hp,battle.enemy.maxHp);pveBattleState.uiHp={player:Number(battle.player.hp||0),enemy:Number(battle.enemy.hp||0)};$('pveBattleRound').textContent=battle.status==='active'?`Tour ${Number(battle.round||1)}`:'Combat terminé';$('pveBattlePlayerStats').textContent=`Niv. ${battle.player.level||1} · Rang ${battle.player.rank||1} · ⚔️ ${battle.player.attack||0} · 🛡️ ${battle.player.defense||0} · ⚡ ${battle.player.speed||0}`;$('pveBattleEnemyStats').textContent=`Niv. ${battle.enemy.level||1} · ⚔️ ${battle.enemy.attack||0} · 🛡️ ${Math.round(Number(battle.enemy.defense||0))} · ⚡ ${Math.round(Number(battle.enemy.speed||0))}`;renderPveBattleActions();renderPveBattleEffects();}
function openPveTacticalBattle(fight,battle){const overlay=$('pveBattleOverlay');if(!overlay||!battle)return;if(!isMobileGameUi()){const panel=$('pveModal')?.querySelector('.game-panel');if(panel&&overlay.parentElement!==panel)panel.appendChild(overlay);$('pveModal')?.classList.add('desktop-battle-mode');}pveBattleState={running:false,battle,fight,lastResult:null,uiHp:{player:Number(battle.player.hp||0),enemy:Number(battle.enemy.hp||0)},auto:false,autoToken:(pveBattleState.autoToken||0)+1};$('pveBattleTitle').textContent=`⚔️ ${fight?.boss?'Boss · ':''}${fight?.name||battle.enemy?.name||'Combat'}`;$('pveBattlePlayerName').textContent=battle.player?.name||'Lovys';$('pveBattlePlayerSprite').innerHTML=me?.user?.creature_id?art(me.user.creature_id,me.user.progression?.evolution||0,true):'🐉';$('pveBattleEnemyName').textContent=battle.enemy?.name||fight?.name||'Ennemi';const ev=pveEnemyVisual(fight||{}),stage=overlay.querySelector('.pve-battle-stage');if(stage){stage.classList.remove('zone-forest','zone-ember','zone-night');stage.classList.add(`zone-${ev.zone}`);}$('pveBattleEnemySprite').innerHTML=pveEnemySpriteMarkup(fight||{});$('pveBattleResult').classList.remove('active');$('pveBattleLog').textContent=`${battle.player?.name||'Ton Lovys'} est prêt. Choisis une action.`;syncPveBattleUi(battle);updatePveAutoUi();overlay.classList.remove('hidden');requestAnimationFrame(()=>overlay.classList.add('active'));}
async function animatePveBattleEvents(events=[]){for(const event of events){$('pveBattleLog').textContent=event.message||'Combat…';const target=event.target==='player'?'player':event.target==='enemy'?'enemy':null;if(event.type==='damage'&&target){const el=target==='player'?$('pveBattlePlayer'):$('pveBattleEnemy');const attacker=event.source==='enemy'?$('pveBattleEnemy'):$('pveBattlePlayer');attacker?.classList.add('attacking');await pveWait(150);attacker?.classList.remove('attacking');el?.classList.add('hit');const key=target==='player'?'player':'enemy';pveBattleState.uiHp[key]=Math.max(0,pveBattleState.uiHp[key]-Number(event.amount||0));pveDamagePop(target==='player'?'pveBattlePlayerDamage':'pveBattleEnemyDamage',event.amount);const b=pveBattleState.battle;setPveHp(target==='player'?'pveBattlePlayer':'pveBattleEnemy',pveBattleState.uiHp[key],target==='player'?b.player.maxHp:b.enemy.maxHp);await pveWait(300);el?.classList.remove('hit');}else if(event.type==='heal'&&target){const key=target;pveBattleState.uiHp[key]+=Number(event.amount||0);const b=pveBattleState.battle;pveBattleState.uiHp[key]=Math.min(target==='player'?b.player.maxHp:b.enemy.maxHp,pveBattleState.uiHp[key]);setPveHp(target==='player'?'pveBattlePlayer':'pveBattleEnemy',pveBattleState.uiHp[key],target==='player'?b.player.maxHp:b.enemy.maxHp);await pveWait(260);}else{await pveWait(event.type==='boss'?500:300);}}}
function updatePveAutoUi(){const btn=$('pveAutoBattle');if(!btn)return;btn.classList.toggle('active',Boolean(pveBattleState.auto));btn.setAttribute('aria-pressed',pveBattleState.auto?'true':'false');btn.innerHTML=pveBattleState.auto?'⏸️ <strong>Auto activé</strong>':'▶️ <strong>Combat auto</strong>';}
function choosePveAutoAction(){const b=pveBattleState.battle;if(!b||b.status!=='active')return null;const skills=b.player?.skills||[],cd=b.player?.cooldowns||{};for(let i=skills.length-1;i>=0;i--){const sk=skills[i];if(sk&&Number(cd[sk.key]||0)<=0)return sk.key;}return 'basic';} // basic reste toujours disponible quand les compétences rechargent
let pveAutoLoopTimer=null;
function ensurePveAutoLoop(){
  if(pveAutoLoopTimer)return;
  pveAutoLoopTimer=setInterval(()=>{
    if(!pveBattleState.auto||pveBattleState.running||!pveBattleState.battle||pveBattleState.battle.status!=='active')return;
    const action=choosePveAutoAction();
    if(action)submitPveBattleAction(action);
  },900);
}
function stopPveAutoLoop(){if(pveAutoLoopTimer){clearInterval(pveAutoLoopTimer);pveAutoLoopTimer=null;}}
function schedulePveAuto(){if(pveBattleState.auto)ensurePveAutoLoop();else stopPveAutoLoop();}
async function submitPveBattleAction(action){
  if(pveBattleState.running||!pveBattleState.battle||pveBattleState.battle.status!=='active')return;
  pveBattleState.running=true;pveBattleSetDisabled(true);
  const controller=new AbortController();
  const requestTimeout=setTimeout(()=>controller.abort(),10000);
  try{
    const r=await fetch('/api/pve/action',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action}),signal:controller.signal});
    const d=await r.json();
    if(!r.ok)throw new Error(d.error||'Action impossible.');
    await animatePveBattleEvents(d.events||[]);
    syncPveBattleUi(d.battle);pveBattleState.lastResult=d;
    if(d.finished){
      pveBattleState.auto=false;pveBattleState.autoToken++;stopPveAutoLoop();updatePveAutoUi();
      const victory=Boolean(d.victory);$('pveBattleResultIcon').textContent=victory?'🏆':'💥';$('pveBattleResultTitle').textContent=victory?'Victoire !':'Défaite';$('pveBattleResultCopy').textContent=victory?`${d.battle.player.name} remporte le combat en ${Number(d.rounds||d.battle.round||1)} tour(s).`:`${d.battle.player.name} a été vaincu. Essaie un autre Lovys, améliore son rang ou fais-le progresser.`;const rw=d.reward||{};$('pveBattleResultReward').textContent=victory&&d.firstWin?`Première victoire : +${Number(rw.creatureXp||0)} XP Lovys · +${Number(rw.globalXp||0)} XP globale · +${Number(rw.fragments||0)} fragment(s) d’œuf`:victory?'Combat rejoué : aucune nouvelle récompense de première victoire.':'';$('pveBattleResult').classList.add('active');
    }else $('pveBattleLog').textContent=pveBattleState.auto?'Combat automatique en cours…':'Choisis ta prochaine action.';
  }catch(error){
    // Ne jamais laisser le combat verrouillé si une requête réseau reste suspendue.
    if(error?.name==='AbortError') $('pveBattleLog').textContent='La réponse du combat a pris trop de temps. Tu peux attaquer à nouveau.';
    else $('pveBattleLog').textContent=error?.message||'Action impossible. Réessaie.';
  }finally{
    clearTimeout(requestTimeout);
    pveBattleState.running=false;
    if(pveBattleState.battle?.status==='active'&&!pveBattleState.lastResult?.finished){renderPveBattleActions();pveBattleSetDisabled(false);if(pveBattleState.auto)ensurePveAutoLoop();}
  }
}
async function closePveBattleAnimation(){stopPveAutoLoop();const result=pveBattleState.lastResult, fightKey=pveBattleState.fight?.key;const overlay=$('pveBattleOverlay');overlay?.classList.remove('active');if(!isMobileGameUi()){overlay?.classList.add('hidden');$('pveModal')?.classList.remove('desktop-battle-mode');}else setTimeout(()=>overlay?.classList.add('hidden'),180);pveBattleState={running:false,battle:null,fight:null,lastResult:null,uiHp:{player:0,enemy:0},auto:false,autoToken:(pveBattleState.autoToken||0)+1};if(result?.victory&&fightKey)await animatePveVictory(fightKey,result);else{await loadGame();await loadLovysCollection();await loadPve();}}
$('pveAutoBattle')?.addEventListener('click',()=>{if(!pveBattleState.battle||pveBattleState.battle.status!=='active')return;pveBattleState.auto=!pveBattleState.auto;pveBattleState.autoToken++;updatePveAutoUi();if(pveBattleState.auto){$('pveBattleLog').textContent='Combat automatique activé.';schedulePveAuto();}else{stopPveAutoLoop();$('pveBattleLog').textContent='Combat automatique désactivé. Choisis une action.';}});
$('pveBattleActions')?.addEventListener('click',e=>{const btn=e.target.closest('[data-battle-action]');if(!btn||btn.disabled)return;submitPveBattleAction(btn.dataset.battleAction);});
$('pveBattleContinue')?.addEventListener('click',closePveBattleAnimation);
$('pveBattleAbandon')?.addEventListener('click',async()=>{if(!pveBattleState.battle)return;stopPveAutoLoop();if(!confirm('Abandonner ce combat ? Aucune récompense ne sera donnée.'))return;await fetch('/api/pve/abandon',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});const overlay=$('pveBattleOverlay');overlay?.classList.remove('active');if(!isMobileGameUi()){overlay?.classList.add('hidden');$('pveModal')?.classList.remove('desktop-battle-mode');}else setTimeout(()=>overlay?.classList.add('hidden'),180);pveBattleState={running:false,battle:null,fight:null,lastResult:null,uiHp:{player:0,enemy:0},auto:false,autoToken:(pveBattleState.autoToken||0)+1};if(!isMobileGameUi())await loadPve();});
$('openProgression')?.addEventListener('click',()=>{if(!isMobileGameUi()){desktopView='progression';document.body.dataset.desktopView='progression';setDesktopNavActive?.('progression');}$('progressionModal')?.classList.remove('hidden');loadProgression();syncMobileNavState?.();});$('progressionClose')?.addEventListener('click',()=>{$('progressionModal')?.classList.add('hidden');syncMobileNavState?.();});$('openPve')?.addEventListener('click',()=>{if(!isMobileGameUi()){desktopView='pve';document.body.dataset.desktopView='pve';setDesktopNavActive?.('pve');}$('pveModal')?.classList.remove('hidden');loadPve();syncMobileNavState?.();});$('pveClose')?.addEventListener('click',()=>{$('pveModal')?.classList.add('hidden');syncMobileNavState?.();});
$('pveContent')?.addEventListener('click',async e=>{
  const lovysBtn=e.target.closest('[data-pve-lovys]');
  if(lovysBtn){if(lovysBtn.classList.contains('active'))return;lovysBtn.disabled=true;try{const r=await fetch('/api/lovys/activate',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({lovysId:Number(lovysBtn.dataset.pveLovys)})});const d=await r.json();if(!r.ok){alert(d.error||'Impossible de changer de Lovys.');return;}await loadGame();await loadLovysCollection();await loadPve();}finally{lovysBtn.disabled=false;}return;}
  const closeDetail=e.target.closest('[data-pve-detail-close]');if(closeDetail){$('pveMapDetail')?.classList.remove('detail-open');return;}
  if(e.target.matches?.('[data-pve-detail-backdrop]')){$('pveMapDetail')?.classList.remove('detail-open');return;}
  const cat=e.target.closest('[data-pve-category]');if(cat){pveMapState.view=cat.dataset.pveCategory==='fragments'?'fragments':'map';renderPveAdventureMap(pveMapState.data,pveMapState.selectedZone);return;}
  const zb=e.target.closest('[data-pve-zone]');if(zb){const idx=Number(zb.dataset.pveZone);if(Number.isFinite(idx)){pveMapState.selectedZone=idx;pveMapState.selectedFight=null;renderPveAdventureMap(pveMapState.data,idx);}return;}
  const nb=e.target.closest('[data-pve-node]');if(nb){pveMapState.selectedFight=nb.dataset.pveNode;const info=pveFightInfoByKey(pveMapState.selectedFight),detail=$('pveMapDetail');if(detail&&info){detail.innerHTML=pveFightDetailMarkup(info.fight);detail.classList.add('detail-open');}document.querySelectorAll('.pve-map-node').forEach(n=>n.classList.toggle('selected',n.dataset.pveNode===pveMapState.selectedFight));return;}
  const b=e.target.closest('[data-fight]');if(!b)return;b.disabled=true;const fightKey=b.dataset.fight,info=pveFightInfoByKey(fightKey);const r=await fetch('/api/pve/fight',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({fightKey})}),d=await r.json();if(!r.ok){$('combatResult').innerHTML=`<div class="combat-report">${escapeHtml(d.error||'Combat impossible.')}</div>`;b.disabled=false;return;}$('combatResult').innerHTML='';$('pveMapDetail')?.classList.remove('detail-open');openPveTacticalBattle(info?.fight||{key:fightKey,name:'Combat'},d.battle);b.disabled=false;
});
$('pveModal')?.addEventListener('click',e=>{if(!isDesktopGameUi()&&!isMobileGameUi()&&e.target.id==='pveModal'){$('pveModal')?.classList.add('hidden');syncMobileNavState?.();}});
let progressionBackdropMouseDown=false;
$('progressionModal')?.addEventListener('mousedown',event=>{ progressionBackdropMouseDown=event.target.id==='progressionModal'; });
$('progressionModal')?.addEventListener('mouseup',event=>{
  if(!isDesktopGameUi() && !isMobileGameUi() && progressionBackdropMouseDown && event.target.id==='progressionModal'){
    $('progressionModal')?.classList.add('hidden');
    syncMobileNavState?.();
  }
  progressionBackdropMouseDown=false;
});


function isMobileGameUi(){ return window.matchMedia('(max-width:900px)').matches; }
function setMobileNavActive(id){
  document.querySelectorAll('.mobile-game-nav-btn').forEach(btn=>btn.classList.toggle('active',btn.id===id));
  if(isMobileGameUi()) document.body.style.overflow=id==='mobileNavHome'?'':'hidden';
  if(syncMobileFooterPlacement.ready)syncMobileFooterPlacement();
}
// La hauteur mesurée comprend la zone sûre iOS et suit les rotations / zooms.
function updateMobileNavHeight(){
  const nav = $('mobileGameNav');
  if(!nav || !isMobileGameUi()) return;
  const height = nav.getBoundingClientRect().height;
  if(height > 0) document.documentElement.style.setProperty('--mobile-nav-height', height + 'px');
}
if(typeof ResizeObserver !== 'undefined' && $('mobileGameNav')){
  new ResizeObserver(updateMobileNavHeight).observe($('mobileGameNav'));
}
window.addEventListener('resize', updateMobileNavHeight);
updateMobileNavHeight();
function getSelfLeaderboardPlayer(){
  const current = me?.user;
  const cached = (leaderboardPlayers||[]).find(player=>String(player.twitch_id||'')===String(current?.twitch_id||''));
  if(!current) return cached || null;
  // Le profil mobile reprend toujours les données actuellement équipées sur la carte joueur.
  // Les infos propres au classement (rang, badges, compteurs) restent celles du dernier chargement.
  return {
    ...(cached || {}),
    twitch_id: current.twitch_id,
    login: current.login,
    display_name: current.game_username || current.display_name || cached?.display_name || 'Joueur',
    is_sub: Boolean(current.is_sub),
    profile_image_url: current.profile_image_url || null,
    creature_id: current.creature_id || null,
    xp: Number(current.xp ?? cached?.xp ?? 0),
    pending_xp: Number(current.pending_xp ?? cached?.pending_xp ?? 0),
    global_xp: Number(current.global_xp ?? cached?.global_xp ?? 0),
    prestige: Number(current.prestige ?? cached?.prestige ?? 0),
    egg_fragments: Number(current.egg_fragments ?? cached?.egg_fragments ?? 0),
    points: Number(current.points ?? cached?.points ?? 0),
    watch_seconds: Number(current.watch_seconds ?? cached?.watch_seconds ?? 0),
    rank: Number(cached?.rank || current.leaderboard_rank || 0),
    progression: current.progression || cached?.progression,
    global_progression: current.global_progression || cached?.global_progression,
    created_at: current.created_at || cached?.created_at || null,
    lifetime_lovercash_earned: Number(current.lifetime_lovercash_earned ?? cached?.lifetime_lovercash_earned ?? 0),
    lifetime_lovercash_spent: Number(current.lifetime_lovercash_spent ?? cached?.lifetime_lovercash_spent ?? 0),
    creature_count: Number(cached?.creature_count ?? (current.creature_id ? 1 : 0)),
    badge_count: Number(cached?.badge_count ?? (badgeData.badges || []).length),
    cosmetic_title: current.cosmetic_title || null,
    cosmetic_title_color: current.cosmetic_title_color || null,
    cosmetic_background: current.cosmetic_background || null,
    cosmetic_frame: current.cosmetic_frame || null,
    cosmetic_avatar_frame: current.cosmetic_avatar_frame || null,
    leaderboard_badges: cached?.leaderboard_badges || (badgeData.badges || []).filter(badge=>Number(badge.leaderboardSlot)>0).sort((a,b)=>Number(a.leaderboardSlot)-Number(b.leaderboardSlot)).slice(0,2),
    unlocked_badges: cached?.unlocked_badges || badgeData.badges || []
  };
}
function isMobileEggDetailsOpen(){ return Boolean($('pick')?.classList.contains('egg-details-open')); }
function isMobilePanelOpen(panel){
  if(panel==='leaderboard') return document.body.classList.contains('mobile-leaderboard-open');
  if(panel==='community') return document.body.classList.contains('mobile-community-open');
  if(panel==='combat') return !$('pveModal')?.classList.contains('hidden');
  if(panel==='inventory') return !$('inventoryModal')?.classList.contains('hidden');
  if(panel==='profile') return !$('playerProfileModal')?.classList.contains('hidden');
  if(panel==='progression') return !$('progressionModal')?.classList.contains('hidden');
  if(panel==='creatures') return isMobileEggDetailsOpen() || !$('lovysCollectionModal')?.classList.contains('hidden');
  return false;
}
function syncMobileNavState(){
  if(!isMobileGameUi()) return;
  if(document.body.classList.contains('mobile-leaderboard-open')) return setMobileNavActive('mobileNavLeaderboard');
  if(document.body.classList.contains('mobile-community-open')) return setMobileNavActive('mobileNavCommunity');
  if(!$('pveModal')?.classList.contains('hidden')) return setMobileNavActive('mobileNavCombat');
  if(!$('inventoryModal')?.classList.contains('hidden')) return setMobileNavActive('mobileNavInventory');
  if(!$('playerProfileModal')?.classList.contains('hidden')) return setMobileNavActive('mobileNavProfile');
  if(isMobileEggDetailsOpen() || !$('lovysCollectionModal')?.classList.contains('hidden')) return setMobileNavActive('mobileNavCreatures');
  if(!$('progressionModal')?.classList.contains('hidden')) return setMobileNavActive('mobileNavProfile');
  setMobileNavActive('mobileNavHome');
}
function openMobileEggDetails(){
  if(!isMobileGameUi() || me?.user?.creature_id) return;
  $('pick')?.classList.add('egg-details-open');
  document.body.style.overflow='hidden';
  syncMobileNavState();
}
function closeMobileEggDetails(){
  $('pick')?.classList.remove('egg-details-open');
  if(isMobileGameUi()) document.body.style.overflow='';
  syncMobileNavState();
}
const mobilePageScroll = new Map();
const mobilePageIds = ['inventoryModal','playerProfileModal','progressionModal','lovysCollectionModal','desktopLobbyPage'];
function restoreMobilePageScroll(id){
  if(!isMobileGameUi()) return;
  requestAnimationFrame(()=>{ const el=$(id);if(el && !el.classList.contains('hidden')) el.scrollTop=mobilePageScroll.get(id)||0; });
}
function closeAllMobilePanels(except=''){
  if(!isMobileGameUi()) return;
  mobilePageIds.forEach(id=>{const el=$(id);if(el && !el.classList.contains('hidden')) mobilePageScroll.set(id,el.scrollTop);});
  const board=document.querySelector('.global-leaderboard');
  if(document.body.classList.contains('mobile-leaderboard-open') && board) mobilePageScroll.set('leaderboard',board.scrollTop);
  if(except!=='leaderboard') document.body.classList.remove('mobile-leaderboard-open');
  if(except!=='community'){ document.body.classList.remove('mobile-community-open'); $('desktopLobbyPage')?.classList.add('hidden'); }
  if(except!=='combat') $('pveModal')?.classList.add('hidden');
  if(except!=='inventory'){ $('inventoryModal')?.classList.add('hidden'); mobileInventoryNewItemKey=null; }
  $('shopModal')?.classList.add('hidden');
  closeShopItemPreview();
  if(except!=='profile') $('playerProfileModal')?.classList.add('hidden');
  if(except!=='progression') $('progressionModal')?.classList.add('hidden');
  if(except!=='creatures'){ $('pick')?.classList.remove('egg-details-open'); $('lovysCollectionModal')?.classList.add('hidden'); }
  $('dailyChallengeDetailModal')?.classList.add('hidden');
  $('tradeComposer')?.classList.add('hidden');
  document.querySelector('.lobby-profile-drawer')?.classList.add('hidden');
  document.body.style.overflow='';
}
async function toggleMobilePanel(panel){
  if(!isMobileGameUi()) return;
  if(isMobilePanelOpen(panel)){
    if(panel==='combat'){syncMobileNavState();return;}
    const ids={combat:'pveModal',inventory:'inventoryModal',profile:'playerProfileModal',progression:'progressionModal',creatures:'lovysCollectionModal',community:'desktopLobbyPage'};
    const el=panel==='leaderboard'?document.querySelector('.global-leaderboard'):$(ids[panel]);
    el?.scrollTo({top:0,behavior:'smooth'});syncMobileNavState();return;
  }
  closeAllMobilePanels(panel);
  if(panel==='leaderboard'){
    openMobileLeaderboard();
  } else if(panel==='community'){
    document.body.classList.add('mobile-community-open');
    $('desktopLobbyPage')?.classList.remove('hidden');
    document.body.style.overflow='hidden';
    await openLobbyTab(lobbyTab);
  } else if(panel==='combat'){
    $('pveModal')?.classList.remove('hidden');
    loadPve();
  } else if(panel==='inventory'){
    await openInventory();
  } else if(panel==='profile'){
    const selfPlayer = getSelfLeaderboardPlayer();
    if(selfPlayer) openPlayerProfile(selfPlayer);
    else document.querySelector('.player-visit-card')?.scrollIntoView({behavior:'smooth',block:'start'});
  } else if(panel==='progression'){
    $('progressionModal')?.classList.remove('hidden');
    await loadProgression();
  } else if(panel==='creatures'){
    if(me?.user?.creature_id){
      openLovysCollection(lovysCollectionTab);
    } else {
      openMobileEggDetails();
    }
  }
  const pageIds={inventory:'inventoryModal',profile:'playerProfileModal',progression:'progressionModal',community:'desktopLobbyPage'};
  if(pageIds[panel]) restoreMobilePageScroll(pageIds[panel]);
  syncMobileNavState();
}
async function hatchExtraIncubatorEgg(slot){
  const message=$('incubatorAddMessage');
  const button=$('incubatorHatchExtraEgg');
  prepareHatchAudio();
  if(button){button.disabled=true;button.textContent='Éclosion…';}
  try{
    const response=await fetch('/api/incubator/hatch',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({slot:Number(slot)})});
    const data=await response.json();
    if(!response.ok) throw new Error(data.error||'Éclosion impossible.');
    closeIncubatorAddModal();
    await loadIncubatorSlots();
    playHatchAnimation(data.creature, async()=>{
      await loadGame();
      openLovysCollection();
    });
  }catch(error){
    if(message){message.className='incubator-add-message error';message.textContent=error.message;}
    if(button){button.disabled=false;button.textContent='✨ Faire éclore';}
  }
}

// Incubateur mobile : défilement natif, sans reconstruire les cartes lors des mises à jour.
let incubatorCarouselIndex = 0;
let incubatorCarouselOrder = '';
function arrangeIncubatorCarousel(){
  const track = $('incubatorCarousel');
  if(!track || !incubatorData?.slots) return;
  const mobile = isMobileGameUi();
  const slots = new Map(incubatorData.slots.map(slot=>[Number(slot.slot),slot]));
  const cards = [...track.querySelectorAll('[data-incubator-slot]')];
  cards.sort((a,b)=>{
    const aSlot = Number(a.dataset.incubatorSlot), bSlot = Number(b.dataset.incubatorSlot);
    if(mobile){
      const aOccupied = slots.has(aSlot) && !slots.get(aSlot).empty;
      const bOccupied = slots.has(bSlot) && !slots.get(bSlot).empty;
      if(aOccupied !== bOccupied) return aOccupied ? -1 : 1;
      if(aOccupied && bOccupied){
        const hatchSeconds = Number(incubatorData.hatchSeconds || 21600);
        const remaining = slot => slot.ready ? 0 : Math.max(0,hatchSeconds - Number(slot.watchedSeconds || 0));
        const timeDifference = remaining(slots.get(aSlot)) - remaining(slots.get(bSlot));
        if(timeDifference) return timeDifference;
      }
    }
    return aSlot - bSlot;
  });
  const order = (mobile ? 'mobile:' : 'pc:') + cards.map(card=>card.dataset.incubatorSlot).join(',');
  if(order === incubatorCarouselOrder) return;
  incubatorCarouselOrder = order;
  // Seul l'ordre visuel change : les identifiants et actions gardent le vrai numéro du slot.
  cards.forEach(card=>track.appendChild(card));
  incubatorCarouselIndex = 0;
  if(mobile){
    track.scrollTo({left:0,behavior:'instant'});
    updateIncubatorCarousel();
  }
}
window.matchMedia('(max-width:900px)').addEventListener?.('change',arrangeIncubatorCarousel);
function updateIncubatorCarousel(){
  const track = $('incubatorCarousel');
  if(!track || !isMobileGameUi() || !track.clientWidth) return;
  const cards = [...track.querySelectorAll('[data-incubator-slot]')];
  const left = track.getBoundingClientRect().left;
  let closest = 0, distance = Infinity;
  cards.forEach((card,index)=>{
    const delta = Math.abs(card.getBoundingClientRect().left - left);
    if(delta < distance){ closest = index; distance = delta; }
  });
  incubatorCarouselIndex = closest;
  document.querySelectorAll('[data-incubator-slide]').forEach(button=>{
    button.setAttribute('aria-pressed', String(Number(button.dataset.incubatorSlide) === closest));
  });
  if($('incubatorCarouselPrev')) $('incubatorCarouselPrev').disabled = closest === 0;
  if($('incubatorCarouselNext')) $('incubatorCarouselNext').disabled = closest === cards.length - 1;
  if($('incubatorCarouselCount')) $('incubatorCarouselCount').textContent = (closest + 1) + ' / ' + cards.length;
}
function goToIncubatorSlide(index, behavior){
  const track = $('incubatorCarousel');
  if(!track || !isMobileGameUi()) return;
  const cards = [...track.querySelectorAll('[data-incubator-slot]')];
  const target = cards[Math.max(0,Math.min(cards.length - 1,index))];
  if(!target) return;
  track.scrollTo({
    left:track.scrollLeft + target.getBoundingClientRect().left - track.getBoundingClientRect().left,
    behavior:behavior || (window.matchMedia('(prefers-reduced-motion:reduce)').matches ? 'auto' : 'smooth')
  });
}
$('incubatorCarousel')?.addEventListener('scroll',updateIncubatorCarousel,{passive:true});
$('incubatorCarouselPrev')?.addEventListener('click',()=>goToIncubatorSlide(incubatorCarouselIndex - 1));
$('incubatorCarouselNext')?.addEventListener('click',()=>goToIncubatorSlide(incubatorCarouselIndex + 1));
document.querySelectorAll('[data-incubator-slide]').forEach(button=>{
  button.addEventListener('click',()=>goToIncubatorSlide(Number(button.dataset.incubatorSlide)));
});
if(typeof ResizeObserver !== 'undefined' && $('incubatorCarousel')){
  new ResizeObserver(()=>{
    if(!isMobileGameUi()) return;
    goToIncubatorSlide(incubatorCarouselIndex,'auto');
    updateIncubatorCarousel();
  }).observe($('incubatorCarousel'));
}
updateIncubatorCarousel();

document.querySelector('.incubator-slots')?.addEventListener('click', event=>{
  const slotEl = event.target.closest('[data-incubator-slot]');
  if (!slotEl) return;
  const slot = Number(slotEl.dataset.incubatorSlot || 0);
  const slotData = incubatorData?.slots?.find(item => Number(item.slot) === slot);
  if (!slotData || slotData.empty) { openIncubatorAddModal(slot); return; }
  if (slotData.source === 'starter') {
    if(isMobileGameUi()) { toggleMobilePanel('creatures'); return; }
    const pick=$('pick'); if(!pick) return;
    pick.classList.toggle('egg-details-open');
    document.body.style.overflow=pick.classList.contains('egg-details-open')?'hidden':'';
    return;
  }
  openExtraEggInfo(slotData);
});
$('incubatorAddClose')?.addEventListener('click', closeIncubatorAddModal);
$('incubatorAddModal')?.addEventListener('mousedown', event=>{ incubatorBackdropMouseDown = event.target.id === 'incubatorAddModal'; });
$('incubatorAddModal')?.addEventListener('mouseup', event=>{ if (incubatorBackdropMouseDown && event.target.id === 'incubatorAddModal') closeIncubatorAddModal(); incubatorBackdropMouseDown=false; });
$('mobileEggClose')?.addEventListener('click',()=>{ $('pick')?.classList.remove('egg-details-open'); document.body.style.overflow=''; syncMobileNavState?.(); });
$('playerCardProgressionMobile')?.addEventListener('click',()=>{ if(isMobileGameUi()) { toggleMobilePanel('progression'); return; } $('progressionModal')?.classList.remove('hidden'); loadProgression(); });
$('mobileNavHome')?.addEventListener('click',()=>{ if(!isMobileGameUi())return; const wasHome=$('mobileNavHome')?.classList.contains('active'); closeAllMobilePanels(''); syncMobileNavState(); if(wasHome)window.scrollTo({top:0,behavior:'smooth'}); });
$('mobileNavCombat')?.addEventListener('click',()=>{ if(!isMobileGameUi())return; toggleMobilePanel('combat'); });
$('mobileNavCreatures')?.addEventListener('click',()=>{ if(!isMobileGameUi())return; toggleMobilePanel('creatures'); });
$('mobileNavLeaderboard')?.addEventListener('click',()=>{ if(!isMobileGameUi())return; toggleMobilePanel('leaderboard'); });
$('mobileNavCommunity')?.addEventListener('click',()=>{ if(!isMobileGameUi())return; toggleMobilePanel('community'); });
$('mobileNavInventory')?.addEventListener('click',()=>{ if(!isMobileGameUi())return; toggleMobilePanel('inventory'); });
$('mobileNavProfile')?.addEventListener('click',()=>{ if(!isMobileGameUi())return; toggleMobilePanel('profile'); });
function openMobileLeaderboard(){
  if(!isMobileGameUi()) return;
  closeAllMobilePanels('leaderboard');
  document.body.classList.add('mobile-leaderboard-open');
  document.body.style.overflow='hidden';
  setMobileNavActive('mobileNavLeaderboard');
  loadLeaderboard().then(()=>{
    if(document.body.classList.contains('mobile-leaderboard-open')){
      const board=document.querySelector('.global-leaderboard');
      if(board)board.scrollTop=mobilePageScroll.get('leaderboard')||0;
    }
  });
}
function closeMobileLeaderboard(){
  document.body.classList.remove('mobile-leaderboard-open');
  if(isMobileGameUi()) document.body.style.overflow='';
  syncMobileNavState();
}
$('mobileLeaderboardOpen')?.addEventListener('click',openMobileLeaderboard);
$('mobileLeaderboardClose')?.addEventListener('click',closeMobileLeaderboard);
window.matchMedia('(max-width:900px)').addEventListener?.('change',e=>{ if(!e.matches){ closeMobileLeaderboard(); closeAllMobilePanels(''); setMobileNavActive('mobileNavHome'); } else { syncMobileNavState(); } renderIncubatorOverview(); renderLovysActiveHero(lovysCollectionData); });
document.addEventListener('keydown',e=>{ if(e.key==='Escape'){ if(document.body.classList.contains('mobile-leaderboard-open')) closeMobileLeaderboard(); if($('pick')?.classList.contains('egg-details-open')){ $('pick').classList.remove('egg-details-open'); document.body.style.overflow=''; } if(!$('incubatorAddModal')?.classList.contains('hidden')) closeIncubatorAddModal(); } });

const leaderboardSearchInput = $('leaderboardSearch');
if (leaderboardSearchInput) {
  const closeLeaderboardSearch = () => {
    if (!leaderboardSearchInput.value.trim() && !document.body.classList.contains('leaderboard-search-active')) return;
    leaderboardSearchInput.value = '';
    document.body.classList.remove('leaderboard-search-active');
    clearTimeout(leaderboardSearchTimer);
    loadLeaderboard('');
  };
  leaderboardSearchInput.addEventListener('input', () => {
    clearTimeout(leaderboardSearchTimer);
    const hasQuery = Boolean(leaderboardSearchInput.value.trim());
    document.body.classList.toggle('leaderboard-search-active', hasQuery);
    leaderboardSearchTimer = setTimeout(() => loadLeaderboard(), 220);
  });
  leaderboardSearchInput.addEventListener('keydown', event => {
    if (event.key === 'Escape') { event.preventDefault(); closeLeaderboardSearch(); leaderboardSearchInput.blur(); }
  });
  document.addEventListener('mousedown', event => {
    if (!document.body.classList.contains('leaderboard-search-active')) return;
    if (event.target.closest('.leaderboard-search-wrap, .leaderboard-search-results')) return;
    closeLeaderboardSearch();
  });
}



function formatProfileDate(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('fr-FR', { day:'2-digit', month:'2-digit', year:'numeric' });
}

function formatProfileDateTime(value) {
  if (!value) return 'Date inconnue';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Date inconnue';
  return date.toLocaleString('fr-FR', {
    day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit'
  });
}

function formatProfileHours(seconds) {
  const total = Math.max(0, Number(seconds) || 0);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  return `${hours} h ${String(minutes).padStart(2,'0')}`;
}

function openPlayerProfile(playerData) {
  if (!playerData) return;
  const content = $('playerProfileContent');
  if (!content) return;
  const isOwnMobileProfile=isMobileGameUi() && Boolean(me?.user?.twitch_id) && String(playerData.twitch_id||'')===String(me.user.twitch_id);
  $('mobileSelfProfileActions')?.classList.toggle('hidden',!isOwnMobileProfile);
  $('mobileProfileAdmin')?.classList.toggle('hidden',!isOwnMobileProfile || !desktopAdminAuthorized);
  if(isOwnMobileProfile)refreshDesktopAdminAccess();

  const creature = playerData.creature_id ? creatureById(playerData.creature_id) : null;
  const avatarFrame = profileAvatarFrameStyle(playerData.cosmetic_avatar_frame);
  const cardFrame = profileFrameStyle(playerData.cosmetic_frame);
  const cardBg = profileBackgroundValue(playerData.cosmetic_background);
  const avatarHtml = playerData.profile_image_url
    ? `<img loading="lazy" decoding="async" src="${escapeHtml(playerData.profile_image_url)}" alt="Avatar de ${escapeHtml(playerData.display_name || 'Joueur')}">`
    : (playerData.creature_id ? `<span>✨</span>` : eggIconMarkup('egg-inline-icon egg-inline-icon-avatar'));
  const titleHtml = playerData.cosmetic_title
    ? `<div class="player-profile-title" style="color:${escapeHtml(playerData.cosmetic_title_color || '#d9c8ff')}">&quot;${escapeHtml(playerData.cosmetic_title)}&quot;</div>`
    : '';
  const unlockedBadges = Array.isArray(playerData.unlocked_badges) ? playerData.unlocked_badges : [];
  const badgeHtml = unlockedBadges.length
    ? unlockedBadges.map(badge => {
        const tooltip = `${badge.badgeName || 'Badge'}\nDébloqué le ${formatProfileDateTime(badge.unlockedAt)}`;
        return `<span class="player-profile-badge" data-tooltip="${escapeHtml(tooltip)}" aria-label="${escapeHtml(tooltip)}">${badge.badgeImage ? `<img loading="lazy" decoding="async" src="${escapeHtml(badge.badgeImage)}" alt="${escapeHtml(badge.badgeName || 'Badge')}">` : '🏅'}</span>`;
      }).join('')
    : '<span class="muted" style="font-size:12px">Aucun badge débloqué pour le moment.</span>';

  const creatureName = creature?.name || (playerData.creature_id ? 'Lovys' : 'Œuf en incubation');
  const creatureLevel = playerData.creature_id ? (playerData.progression?.level || 1) : '—';
  const globalLevel = playerData.global_progression?.level || 1;
  const globalXp = Math.floor(Number(playerData.global_xp || 0));
  const creatureXp = Math.floor(Number(playerData.xp || 0));

  content.innerHTML = `<div id="playerProfileHero" class="player-profile-hero" style="--profile-card-image:${escapeHtml(cardBg)};${cardFrame ? `border-color:${escapeHtml(cardFrame.border)};box-shadow:${escapeHtml(cardFrame.shadow)};` : ''}"><div class="player-profile-hero-inner"><div id="playerProfileAvatar" class="player-profile-avatar">${avatarHtml}</div><div class="player-profile-identity"><div class="player-profile-name">${escapeHtml(playerData.display_name || 'Joueur')}</div>${titleHtml}<div class="player-profile-rank">Rang #${Number(playerData.rank) || '—'} · ${playerData.is_sub ? '⭐ Abonné Twitch' : 'Viewer'}</div></div></div></div>
  <div class="player-profile-stats">
    <div class="player-profile-stat"><div class="player-profile-stat-label">Niveau global</div><div class="player-profile-stat-value">${globalLevel}</div></div>
    <div class="player-profile-stat"><div class="player-profile-stat-label">Niveau Lovys</div><div class="player-profile-stat-value">${creatureLevel}</div></div>
    <div class="player-profile-stat"><div class="player-profile-stat-label">Temps regardé</div><div class="player-profile-stat-value">${escapeHtml(formatProfileHours(playerData.watch_seconds))}</div></div>
    <div class="player-profile-stat"><div class="player-profile-stat-label">LoVeR'Cash</div><div class="player-profile-stat-value">${Math.floor(Number(playerData.points || 0))}</div></div>
    <div class="player-profile-stat"><div class="player-profile-stat-label">Badges débloqués</div><div class="player-profile-stat-value">${Number(playerData.badge_count || 0)}</div></div>
    <div class="player-profile-stat"><div class="player-profile-stat-label">Compagnons</div><div class="player-profile-stat-value">${Number(playerData.creature_count || 0)}</div></div>
  </div>
  <div class="player-profile-sections">
    <section class="player-profile-section"><h3>📈 Progression</h3><div class="player-profile-line"><span>XP globale</span><strong>${globalXp} XP</strong></div><div class="player-profile-line"><span>Prestige</span><strong>${Number(playerData.prestige || 0)}</strong></div><div class="player-profile-line"><span>Fragments d’œuf</span><strong>${Number(playerData.egg_fragments || 0)}</strong></div><div class="player-profile-line"><span>XP Lovys</span><strong>${creatureXp} XP</strong></div><div class="player-profile-line"><span>Lovys actuel</span><strong>${escapeHtml(creatureName)}</strong></div><div class="player-profile-line"><span>Arrivée sur le jeu</span><strong>${escapeHtml(formatProfileDate(playerData.created_at))}</strong></div></section>
    <section class="player-profile-section"><h3>💰 LoVeR'Cash</h3><div class="player-profile-line"><span>Solde actuel</span><strong>${Math.floor(Number(playerData.points || 0))}</strong></div><div class="player-profile-line"><span>Gagné au total</span><strong>${Math.floor(Number(playerData.lifetime_lovercash_earned || 0))}</strong></div><div class="player-profile-line"><span>Dépensé au total</span><strong>${Math.floor(Number(playerData.lifetime_lovercash_spent || 0))}</strong></div></section>
    <section class="player-profile-section"><h3>🎨 Personnalisation</h3><div class="player-profile-line"><span>Titre</span><strong>${escapeHtml(playerData.cosmetic_title || 'Aucun')}</strong></div><div class="player-profile-line"><span>Fond</span><strong>${playerData.cosmetic_background ? 'Équipé' : 'Aucun'}</strong></div><div class="player-profile-line"><span>Encadrement</span><strong>${playerData.cosmetic_frame ? 'Équipé' : 'Aucun'}</strong></div><div class="player-profile-line"><span>Cadre de profil</span><strong>${playerData.cosmetic_avatar_frame ? 'Équipé' : 'Aucun'}</strong></div></section>
    <section class="player-profile-section"><h3>🏆 Badges débloqués</h3><div class="player-profile-badges">${badgeHtml}</div></section>
  </div>`;

  applyAvatarFrameCosmetics($('playerProfileAvatar'), playerData.cosmetic_avatar_frame);
  $('playerProfileModal')?.classList.remove('hidden');
  syncMobileNavState?.();
}

function closePlayerProfile() {
  $('playerProfileModal')?.classList.add('hidden');
  syncMobileNavState?.();
}

$('leaderboard')?.addEventListener('click', event => {
  const metricButton = event.target.closest('[data-leaderboard-metric]');
  if (metricButton) {
    leaderboardMetric = metricButton.dataset.leaderboardMetric || 'watch';
    loadLeaderboard(null, leaderboardMetric);
    return;
  }
  const card = event.target.closest('[data-player-index]');
  if (!card) return;
  const player = leaderboardPlayers[Number(card.dataset.playerIndex)];
  if (player) openPlayerProfile(player);
});

$('leaderboard')?.addEventListener('keydown', event => {
  if (event.key !== 'Enter' && event.key !== ' ') return;
  const card = event.target.closest('[data-player-index]');
  if (!card) return;
  event.preventDefault();
  const player = leaderboardPlayers[Number(card.dataset.playerIndex)];
  if (player) openPlayerProfile(player);
});

$('playerProfileClose')?.addEventListener('click', closePlayerProfile);
$('mobileProfileAccount')?.addEventListener('click',()=>{if(isMobileGameUi())openAccountModal();});
$('mobileProfileAdmin')?.addEventListener('click',()=>{if(isMobileGameUi())openDesktopAdmin();});
$('playerProfileContent')?.addEventListener('click', event => {
  if (!isMobileGameUi()) return;
  const badge = event.target.closest('.player-profile-badge');
  document.querySelectorAll('.player-profile-badge.touch-open').forEach(item => {
    if (item !== badge) item.classList.remove('touch-open');
  });
  if (badge) {
    event.stopPropagation();
    badge.classList.toggle('touch-open');
  }
});
document.addEventListener('click', event => {
  if (!isMobileGameUi() || event.target.closest('.player-profile-badge')) return;
  document.querySelectorAll('.player-profile-badge.touch-open').forEach(item => item.classList.remove('touch-open'));
});
let playerProfileBackdropMouseDown = false;
$('playerProfileModal')?.addEventListener('mousedown', event => { playerProfileBackdropMouseDown = event.target.id === 'playerProfileModal'; });
$('playerProfileModal')?.addEventListener('mouseup', event => { if (!isMobileGameUi() && playerProfileBackdropMouseDown && event.target.id === 'playerProfileModal') closePlayerProfile(); playerProfileBackdropMouseDown = false; });

const TITLE_COLOR_ORDER = { gold:0, silver:1, violet:2, blue:3, green:4, pink:5, red:6, other:9 };

function getTitleColorGroup(item) {
  const raw = String(item?.subcategory || '').toLowerCase();
  if (raw && raw !== 'classic' && raw !== 'special' && raw !== 'animated') return raw;
  const color = String(item?.color || '').toLowerCase();
  if (['#f3c85b','#f4cd67','#ffd86b'].includes(color)) return 'gold';
  if (['#e7edf8','#d9e2ef','#ffffff'].includes(color)) return 'silver';
  if (['#b785ff','#c28cff','#b96cff'].includes(color)) return 'violet';
  if (['#62a8ff','#7ab8ff','#79c8ff','#4fd1c5'].includes(color)) return 'blue';
  if (['#69e3a7','#8ce26b'].includes(color)) return 'green';
  if (['#ff8ad9','#ff95ef'].includes(color)) return 'pink';
  if (['#ff8a63'].includes(color)) return 'red';
  return 'other';
}

function sortCatalogItems(items, category) {
  const list = [...items];
  if (category === 'title') {
    return list.sort((a, b) => {
      const groupDiff = (TITLE_COLOR_ORDER[getTitleColorGroup(a)] ?? 99) - (TITLE_COLOR_ORDER[getTitleColorGroup(b)] ?? 99);
      if (groupDiff) return groupDiff;
      const priceDiff = Number(a.price || 0) - Number(b.price || 0);
      if (priceDiff) return priceDiff;
      return String(a.name || '').localeCompare(String(b.name || ''), 'fr', { sensitivity:'base' });
    });
  }
  if (category === 'avatar_frame') {
    return list.sort((a, b) => Number(a.price || 0) - Number(b.price || 0) || String(a.name || '').localeCompare(String(b.name || ''), 'fr', { sensitivity:'base' }));
  }
  return list;
}

let shopData = null;
let shopCategory = 'title';
let mobileShopPage = 0;
let mobileShopPageCategory = 'title';
const MOBILE_SHOP_PAGE_SIZE = 4;
let shopTitleFilter = 'all';
let shopBackgroundFilter = 'all';
let shopFrameFilter = 'all';
let shopAvatarFrameFilter = 'all';
let shopPreviewCurrentKey = null;
let shopFocusItemKey = null;
let inventoryCategory = 'title';
let inventoryTitleFilter = 'all';
let mobileInventoryNewItemKey = null;

function setShopMessage(message = '', type = '') {
  const box = $('shopMessage');
  if (!box) return;
  box.textContent = message;
  box.className = `shop-message${type ? ` ${type}` : ''}`;
}

function shopPreview(item) {
  if (item.category === 'title') return `<div class="shop-item-preview"><div class="shop-preview-title" style="color:${escapeHtml(item.color || '#fff')}">&quot;${escapeHtml(item.name)}&quot;</div></div>`;
  if (item.category === 'background') return `<div class="shop-item-preview shop-preview-bg bg-${escapeHtml(item.preview || 'violet')}"></div>`;
  if (item.category === 'frame') return `<div class="shop-item-preview"><div class="shop-preview-frame frame-${escapeHtml(item.preview || 'violet')}"></div></div>`;
  if (item.category === 'avatar_frame') return `<div class="shop-item-preview shop-preview-avatarframe frame-${escapeHtml(item.preview || 'violet')}"><div class="shop-preview-avatarframe-inner"></div></div>`;
  if (item.key === 'mystery_egg') return `<div class="shop-item-preview"><span class="shop-preview-egg-premium" aria-label="Œuf mystère"></span></div>`;
  return `<div class="shop-item-preview"><div class="shop-preview-object">${escapeHtml(item.icon || '🎁')}</div></div>`;
}

function shopCategoryLabel(category) {
  if (category === 'title') return 'Titre';
  if (category === 'background') return 'Fond';
  if (category === 'frame') return 'Encadrement';
  if (category === 'avatar_frame') return 'Cadre de profil';
  if (category === 'object') return 'Objet';
  return 'Article';
}

function getShopItemByKey(itemKey) {
  return (shopData?.catalog || []).find(item => item.key === itemKey) || null;
}

function getShopActionButtons(item, { includePreview = false } = {}) {
  const buttons = [];
  if (includePreview && !isDesktopGameUi()) buttons.push(`<button class="shop-action secondary" type="button" data-shop-preview="${escapeHtml(item.key)}">👁 Prévisualiser</button>`);

  if (item.rewardOnly && !item.owned && !item.equipped) { buttons.push('<button class="shop-action" type="button" disabled>À débloquer</button>');
  } else if (item.comingSoon) {
    buttons.push('<button class="shop-action" type="button" disabled>Bientôt</button>');
  } else if (item.category === 'object') {
    buttons.push(`<button class="shop-action" type="button" data-shop-buy="${escapeHtml(item.key)}">Acheter</button>`);
    if (Number(item.quantity || 0) > 0) buttons.push(`<button class="shop-action secondary" type="button" data-shop-use="${escapeHtml(item.key)}">Utiliser</button>`);
  } else if (item.equipped) {
    buttons.push('<button class="shop-action" type="button" disabled>Équipé</button>');
  } else if (item.owned || item.exclusive) {
    buttons.push(`<button class="shop-action" type="button" data-shop-equip="${escapeHtml(item.key)}">Équiper</button>`);
  } else {
    buttons.push(`<button class="shop-action" type="button" data-shop-buy="${escapeHtml(item.key)}">Acheter</button>`);
  }

  return buttons.join('');
}

function renderDesktopVisitCardPreview(item = null, cardId = 'shopProfilePreviewCard') {
  const source = document.querySelector('.dashboard-left-stack > .player-visit-card');
  if (!source) return '';
  const card = source.cloneNode(true);
  card.querySelectorAll('.player-card-actions, .player-card-progress-mobile').forEach(node => node.remove());
  card.querySelectorAll('button').forEach(node => {const label=document.createElement('span');label.className=node.className;label.innerHTML=node.innerHTML;node.replaceWith(label);});
  card.querySelectorAll('[id]').forEach(node => node.removeAttribute('id'));
  card.querySelectorAll('[role="button"], [tabindex]').forEach(node => {
    node.removeAttribute('role');
    node.removeAttribute('tabindex');
    node.removeAttribute('aria-label');
  });
  card.id = cardId;
  card.classList.add('inventory-visit-preview');
  const avatar = card.querySelector('.player-card-avatar');
  avatar?.classList.add('shop-profile-preview-avatar');
  if (item?.category === 'title') {
    const title = card.querySelector('.player-card-title');
    if (title) {
      title.textContent = `"${item.name}"`;
      title.classList.remove('hidden');
      title.classList.add('visible');
      title.style.color = item.color || '#e2d2ff';
    }
  }
  applyProfileCosmetics(card, item?.category === 'background' ? item.key : me?.user?.cosmetic_background,
    item?.category === 'frame' ? item.key : me?.user?.cosmetic_frame);
  applyAvatarFrameCosmetics(avatar, item?.category === 'avatar_frame' ? item.key : me?.user?.cosmetic_avatar_frame);
  return card.outerHTML;
}

let commerceDraft = {};
let commerceTab = 'shop';
let commerceBusy = false;
let commercePreviewOrigin = null;
let commerceToolsOrigin = null;
let inventoryDesktopOrigin = null;

function syncInventoryPagePlacement() {
  const page = $('inventoryModal'), preview = $('inventoryVisitPreview'), tools = $('shopAccountTools');
  if (!page || !preview) return;
  if (!inventoryDesktopOrigin) {
    inventoryDesktopOrigin = document.createComment('inventory-origin');
    page.parentNode.insertBefore(inventoryDesktopOrigin, page);
    commercePreviewOrigin = document.createComment('inventory-preview-origin');
    preview.parentNode.insertBefore(commercePreviewOrigin, preview);
    commerceToolsOrigin = document.createComment('shop-tools-origin');
    tools.parentNode.insertBefore(commerceToolsOrigin, tools);
  }
  if (isDesktopGameUi()) {
    $('commerceCatalog')?.appendChild(page);
    $('commercePreviewSlot')?.appendChild(preview);
    $('commerceTopline')?.appendChild(tools);
    page.removeAttribute('aria-modal');
    page.setAttribute('role', 'region');
  } else {
    inventoryDesktopOrigin.parentNode.insertBefore(page, inventoryDesktopOrigin.nextSibling);
    commercePreviewOrigin.parentNode.insertBefore(preview, commercePreviewOrigin.nextSibling);
    commerceToolsOrigin.parentNode.insertBefore(tools, commerceToolsOrigin.nextSibling);
    page.setAttribute('role', 'dialog');
    page.setAttribute('aria-modal', 'true');
  }
}

const COMMERCE_SLOTS = {title:'🏷️ Titre',background:'🖼️ Fond',frame:'✨ Encadrement',avatar_frame:'🪞 Cadre de profil'};
function commerceOwns(item) { return Boolean(item && (item.owned || item.equipped || item.exclusive)); }
function renderInventoryVisitPreview() {
  if (!isDesktopGameUi()) return;
  const entries = Object.entries(commerceDraft);
  $('inventoryVisitPreviewVisual').innerHTML = renderDesktopVisitCardPreview(null, 'inventoryCurrentVisitCard');
  const card = $('inventoryCurrentVisitCard');
  if (card) {
    const keys = {...(shopData?.equipped || {}), ...commerceDraft};
    const title = getShopItemByKey(keys.title), titleEl = card.querySelector('.player-card-title');
    if (titleEl) {
      titleEl.textContent = title ? `"${title.name}"` : '';
      titleEl.classList.toggle('visible', Boolean(title));
      titleEl.style.color = title?.color || '';
    }
    applyProfileCosmetics(card, keys.background, keys.frame);
    applyAvatarFrameCosmetics(card.querySelector('.player-card-avatar'), keys.avatar_frame);
  }
  $('inventoryPreviewStatus').textContent = entries.length ? 'Aperçu, non équipé' : 'Ton équipement actuel';
  const missing = entries.some(([,key]) => key && !commerceOwns(getShopItemByKey(key)));
  $('inventoryOutfitEquip').disabled = commerceBusy || !entries.length || missing;
  $('inventoryPreviewReset').disabled = commerceBusy || !entries.length;
  $('inventoryOutfitEquip').textContent = commerceBusy ? 'Équipement…' : 'Équiper cette tenue';
  $('inventoryOutfitEquip').title = missing ? 'Achète les articles essayés avant de les équiper.' : '';
  $('inventoryCurrentEquipment').innerHTML = Object.entries(COMMERCE_SLOTS).map(([category,label]) => {
    const item = getShopItemByKey(shopData?.equipped?.[category]);
    return `<div class="commerce-equipment-slot"><button type="button" data-commerce-slot="${category}"><span>${label}</span><strong>${escapeHtml(item?.name || 'Aucun')}</strong></button>${item ? `<button type="button" class="commerce-slot-remove" data-commerce-remove="${escapeHtml(item.key)}" aria-label="Retirer ${escapeHtml(item.name)}" ${commerceBusy?'disabled':''}>Retirer</button>` : ''}</div>`;
  }).join('');
  document.querySelectorAll('[data-shop-item-key], [data-inventory-item-key]').forEach(node => {
    const item = getShopItemByKey(node.dataset.shopItemKey || node.dataset.inventoryItemKey);
    node.classList.toggle('commerce-tried', Boolean(item && commerceDraft[item.category] === item.key));
  });
}

function previewInventoryItem(key) {
  const item = getShopItemByKey(key);
  if (!isDesktopGameUi()) return openShopItemPreview(key);
  if (!item || item.category === 'object' || commerceBusy) return;
  if (commerceDraft[item.category] === key) return;
  commerceDraft[item.category] = key;
  $('inventoryOutfitMessage').textContent = commerceOwns(item) ? '' : 'Achète cet article pour pouvoir équiper la tenue.';
  renderInventoryVisitPreview();
}

function setCommerceTab(tab) {
  if (!isDesktopGameUi()) return;
  commerceTab = tab === 'inventory' ? 'inventory' : 'shop';
  syncInventoryPagePlacement();
  $('shopModal').classList.remove('hidden');
  $('shopModal').classList.toggle('commerce-inventory-active', commerceTab === 'inventory');
  $('inventoryModal').classList.toggle('hidden', commerceTab !== 'inventory');
  $('commerceShopTab').setAttribute('aria-pressed', String(commerceTab === 'shop'));
  $('commerceInventoryTab').setAttribute('aria-pressed', String(commerceTab === 'inventory'));
  if (commerceTab === 'inventory') renderInventory();
  else renderShop();
  renderInventoryVisitPreview();
}

function syncDesktopBoostData() {
  if (!isDesktopGameUi()) return;
  desktopActiveBoosts = shopData?.activeBoosts || {};
  renderDesktopBoostStatus();
}

async function equipCommerceOutfit() {
  if (!isDesktopGameUi() || commerceBusy || !Object.keys(commerceDraft).length) return;
  const equipment = {...commerceDraft};
  if (Object.values(equipment).some(key => key && !commerceOwns(getShopItemByKey(key)))) return;
  commerceBusy = true; renderInventoryVisitPreview();
  try {
    const response = await fetch('/api/shop/equip-outfit', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({equipment})});
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Impossible d’équiper cette tenue.');
    commerceDraft = {};
    $('inventoryOutfitMessage').textContent = '✓ Tenue équipée !';
    await loadShop(); await loadGame(); await loadLeaderboard();
    if (commerceTab === 'inventory') renderInventory();
  } catch (error) { $('inventoryOutfitMessage').textContent = error.message; }
  finally {commerceBusy = false;renderInventoryVisitPreview();}
}

function renderShopPreviewVisual(item) {
  if (item.category === 'object') {
    const objectVisual = item.key === 'mystery_egg'
      ? `<span class="shop-preview-egg-premium" aria-label="Œuf mystère"></span>`
      : `<div class="shop-preview-object-large">${escapeHtml(item.icon || '🎁')}</div>`;
    return `<div class="shop-preview-object-stage">${objectVisual}<div class="shop-preview-object-title">${escapeHtml(item.name)}</div><div class="shop-preview-object-copy">${escapeHtml(item.description || '')}</div></div>`;
  }

  if (isDesktopGameUi() && !$('inventoryModal')?.classList.contains('hidden')) {
    return renderDesktopVisitCardPreview(item);
  }

  const previewTitle = item.category === 'title' ? item.name : String(me?.user?.cosmetic_title || '').trim();
  const previewTitleColor = item.category === 'title' ? (item.color || '#e2d2ff') : (me?.user?.cosmetic_title_color || '#e2d2ff');
  const username = me?.user?.game_username || me?.user?.display_name || 'Joueur';
  const level = me?.user?.progression?.level || 1;
  const rank = Number(me?.user?.leaderboard_rank) > 0 ? `#${Number(me.user.leaderboard_rank)}` : '#—';
  const avatarHtml = me?.user?.profile_image_url
    ? `<img loading="lazy" decoding="async" src="${escapeHtml(me.user.profile_image_url)}" alt="Avatar Twitch">`
    : (me?.user?.creature_id ? `<span>✨</span>` : eggIconMarkup('egg-inline-icon egg-inline-icon-avatar'));

  return `<div id="shopProfilePreviewCard" class="shop-profile-preview-card"><div class="shop-profile-preview-top"><div class="shop-profile-preview-avatar">${avatarHtml}</div><div class="shop-profile-preview-rank">${rank}</div></div><div class="shop-profile-preview-name">${escapeHtml(username)}</div><div class="shop-profile-preview-title ${previewTitle ? '' : 'hidden'}" style="color:${escapeHtml(previewTitleColor)}">${previewTitle ? `&quot;${escapeHtml(previewTitle)}&quot;` : ''}</div><div class="shop-profile-preview-level">Niveau ${escapeHtml(level)}</div><div class="shop-profile-preview-note">Aperçu sur ta carte de visite avant achat.</div></div>`;
}

function renderShopItemPreview() {
  const item = getShopItemByKey(shopPreviewCurrentKey);
  if (!item) return;

  $('shopItemPreviewSubtitle').textContent = isDesktopGameUi() && !$('inventoryModal')?.classList.contains('hidden')
    ? 'Essaie cet article sur ta carte avant de l’équiper.'
    : "Découvre l’article avant de dépenser ton LoVeR'Cash.";
  $('shopItemPreviewTitle').textContent = `👁 Prévisualisation · ${shopCategoryLabel(item.category)}`;
  $('shopItemPreviewKicker').textContent = shopCategoryLabel(item.category);
  $('shopItemPreviewName').textContent = item.name || 'Article';
  $('shopItemPreviewDesc').textContent = item.description || '';

  const price = item.rewardOnly ? 'Récompense à débloquer' : (item.exclusive ? 'Exclusif' : `${Math.floor(Number(item.price || 0))} LoVeR'Cash`);
  let statusText = '';
  if (item.category === 'object') {
    if (Number(item.quantity || 0) > 0) statusText = `Possédé : ${Number(item.quantity)}`;
  } else if (item.equipped) {
    statusText = 'Équipé';
  } else if (item.owned || item.exclusive) {
    statusText = 'Possédé';
  }

  $('shopItemPreviewMeta').innerHTML = `<span class="shop-preview-pill price">💰 ${escapeHtml(price)}</span>${item.comingSoon ? '<span class="shop-preview-pill">Bientôt</span>' : ''}`;
  $('shopItemPreviewOwned').textContent = statusText;

  const effectEl = $('shopItemPreviewEffect');
  if (item.category === 'object') {
    effectEl.classList.remove('hidden');
    effectEl.textContent = item.description || 'Objet consommable utilisable depuis ta collection.';
  } else {
    effectEl.classList.add('hidden');
    effectEl.textContent = '';
  }

  $('shopItemPreviewVisual').innerHTML = renderShopPreviewVisual(item);
  if (item.category !== 'object') {
    const previewCard = $('shopProfilePreviewCard');
    const backgroundKey = item.category === 'background' ? item.key : me?.user?.cosmetic_background;
    const frameKey = item.category === 'frame' ? item.key : me?.user?.cosmetic_frame;
    const avatarFrameKey = item.category === 'avatar_frame' ? item.key : me?.user?.cosmetic_avatar_frame;
    applyProfileCosmetics(previewCard, backgroundKey, frameKey);
    applyAvatarFrameCosmetics(previewCard.querySelector('.shop-profile-preview-avatar'), avatarFrameKey);
  }

  $('shopItemPreviewActions').innerHTML = getShopActionButtons(item, { includePreview: false });
}

function openShopItemPreview(itemKey) {
  shopPreviewCurrentKey = itemKey;
  renderShopItemPreview();
  $('shopItemPreviewModal')?.classList.remove('hidden');
}

function openProgressionTitlePreview(info) {
  if (!info || !info.previewTitle) return;
  const item = {
    key: `progression-preview-${String(info.level || '').trim()}`,
    category: 'title',
    name: info.previewTitle.name || info.title || 'Titre',
    color: info.previewTitle.color || info.color || '#e2d2ff',
    description: info.sub || 'Aperçu du titre sur ta carte de joueur.',
    rewardOnly: true,
    owned: false,
    exclusive: true
  };

  $('shopItemPreviewTitle').textContent = '👁 Prévisualisation · Titre';
  $('shopItemPreviewKicker').textContent = 'Titre';
  $('shopItemPreviewName').textContent = item.name;
  $('shopItemPreviewDesc').textContent = item.description;
  $('shopItemPreviewMeta').innerHTML = `<span class="shop-preview-pill">${escapeHtml(info.tag || '')}</span><span class="shop-preview-pill price">🏅 Récompense de niveau</span>`;
  $('shopItemPreviewOwned').textContent = 'Aperçu sur ta carte de joueur';

  const effectEl = $('shopItemPreviewEffect');
  effectEl.classList.remove('hidden');
  effectEl.textContent = 'Cette fenêtre te montre le rendu du titre directement sur ta carte de joueur avant le déblocage.';

  $('shopItemPreviewVisual').innerHTML = renderShopPreviewVisual(item);
  const previewCard = $('shopProfilePreviewCard');
  applyProfileCosmetics(previewCard, me?.user?.cosmetic_background, me?.user?.cosmetic_frame);
  applyAvatarFrameCosmetics(previewCard?.querySelector('.shop-profile-preview-avatar'), me?.user?.cosmetic_avatar_frame);

  $('shopItemPreviewActions').innerHTML = '<button id="progressionPreviewCloseBtn" class="shop-action secondary" type="button">Fermer</button>';
  $('progressionPreviewCloseBtn')?.addEventListener('click', closeShopItemPreview);
  $('shopItemPreviewModal')?.classList.remove('hidden');
}

function closeShopItemPreview() {
  $('shopItemPreviewModal')?.classList.add('hidden');
}

function mobileShopPageItems(items){
  if(mobileShopPageCategory!==shopCategory){mobileShopPage=0;mobileShopPageCategory=shopCategory;}
  const pageCount=Math.max(1,Math.ceil(items.length/MOBILE_SHOP_PAGE_SIZE));
  const focused=shopFocusItemKey ? items.findIndex(item=>item.key===shopFocusItemKey) : -1;
  if(focused>=0)mobileShopPage=Math.floor(focused/MOBILE_SHOP_PAGE_SIZE);
  mobileShopPage=Math.max(0,Math.min(pageCount-1,mobileShopPage));
  const pagination=$('shopMobilePagination');
  pagination?.classList.toggle('hidden',pageCount<=1);
  if($('shopMobilePageLabel'))$('shopMobilePageLabel').textContent=`Page ${mobileShopPage+1} / ${pageCount}`;
  if($('shopMobilePrevious'))$('shopMobilePrevious').disabled=mobileShopPage===0;
  if($('shopMobileNext'))$('shopMobileNext').disabled=mobileShopPage===pageCount-1;
  if($('shopMobileCategory'))$('shopMobileCategory').value=shopCategory;
  const from=mobileShopPage*MOBILE_SHOP_PAGE_SIZE;
  if($('shopMobileSummary'))$('shopMobileSummary').textContent=items.length ? `${items.length} article${items.length>1?'s':''} · ${from+1}–${Math.min(from+MOBILE_SHOP_PAGE_SIZE,items.length)} affiché${items.length>1?'s':''}` : 'Aucun article disponible';
  return items.slice(from,from+MOBILE_SHOP_PAGE_SIZE);
}
function renderShop() {
  if (!shopData) return;
  $('shopBalance').textContent = Math.floor(Number(shopData.balance || 0));
  const titleFilterWrap = $('shopTitleFilterWrap');
  const backgroundFilterWrap = $('shopBackgroundFilterWrap');
  const frameFilterWrap = $('shopFrameFilterWrap');
  const avatarFrameFilterWrap = $('shopAvatarFrameFilterWrap');
  if (titleFilterWrap) titleFilterWrap.classList.toggle('hidden', shopCategory !== 'title');
  if (backgroundFilterWrap) backgroundFilterWrap.classList.toggle('hidden', shopCategory !== 'background');
  if (frameFilterWrap) frameFilterWrap.classList.toggle('hidden', shopCategory !== 'frame');
  if (avatarFrameFilterWrap) avatarFrameFilterWrap.classList.toggle('hidden', shopCategory !== 'avatar_frame');
  // La boutique affiche uniquement les articles réellement achetables.
  // Toute récompense de progression (titres, fonds, encadrements, cadres de profil, etc.)
  // reste dans Progression / Inventaire et ne doit jamais apparaître ici.
  const isProgressionReward = item => {
    if (!item) return false;
    if (item.rewardOnly) return true;
    const key = String(item.key || '');
    const description = String(item.description || '');
    return /^reward_/.test(key) || /(?:niveau|level)\s+(?:global|général)/i.test(description);
  };
  const allCategoryItems = sortCatalogItems((shopData.catalog || []).filter(item =>
    item.category === shopCategory && !isProgressionReward(item) && (item.category === 'object' || (!item.owned && !item.equipped && !item.exclusive))
  ), shopCategory);
  let items = allCategoryItems;
  if (!isMobileGameUi() && shopCategory === 'title' && shopTitleFilter !== 'all') {
    items = allCategoryItems.filter(item => getTitleColorGroup(item) === shopTitleFilter);
  } else if (!isMobileGameUi() && shopCategory === 'background' && shopBackgroundFilter !== 'all') {
    items = allCategoryItems.filter(item => String(item.subcategory || 'classic') === shopBackgroundFilter);
  } else if (!isMobileGameUi() && shopCategory === 'frame' && shopFrameFilter !== 'all') {
    items = allCategoryItems.filter(item => String(item.subcategory || 'classic') === shopFrameFilter);
  } else if (!isMobileGameUi() && shopCategory === 'avatar_frame' && shopAvatarFrameFilter !== 'all') {
    items = allCategoryItems.filter(item => String(item.subcategory || 'classic') === shopAvatarFrameFilter);
  }
  if(isMobileGameUi())items=mobileShopPageItems(items);
  $('shopGrid').innerHTML = items.map(item => {
    const price = item.rewardOnly ? 'Récompense à débloquer' : (item.exclusive ? 'Exclusif' : `${Math.floor(Number(item.price || 0))} LoVeR'Cash`);
    const actions = getShopActionButtons(item, { includePreview: true });
    const activeUntil = shopData.activeBoosts?.[item.key];
    const activeText = isMobileGameUi() && activeUntil ? `<div class="shop-owned">Actif jusqu’à ${new Date(activeUntil).toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'})}</div>` : '';
    const ownedText = item.category === 'object'
      ? (Number(item.quantity || 0) > 0 ? `<span class="shop-qty">Possédé : ${Number(item.quantity)}</span>` : '')
      : (item.owned || item.exclusive ? '<span class="shop-owned">Possédé</span>' : '');
    return `<article ${isDesktopGameUi()?`title="${escapeHtml(item.description || '')}" ${item.category!=='object'?'tabindex="0"':''}`:''} class="shop-item${item.equipped ? ' equipped' : ''}${item.comingSoon ? ' coming-soon' : ''}${shopFocusItemKey === item.key ? ' shop-focus' : ''}" data-shop-item-key="${escapeHtml(item.key)}">
      ${shopPreview(item)}
      <div class="shop-item-name">${escapeHtml(item.name)}</div>
      <div class="shop-item-desc">${escapeHtml(item.description || '')}</div>
      <div class="shop-item-meta"><span class="shop-price">${escapeHtml(price)}</span>${ownedText}</div>
      ${activeText}
      <div class="shop-actions">${actions}</div>
    </article>`;
  }).join('') || '<div class="muted">Aucun article dans cette catégorie.</div>';

  document.querySelectorAll('[data-shop-category]').forEach(button => {
    const category=button.dataset.shopCategory;
    button.classList.toggle('active', category === shopCategory);
    const count=(shopData.catalog||[]).filter(item=>item.category===category&&!isProgressionReward(item)&&(category==='object'||(!item.owned&&!item.equipped&&!item.exclusive))).length;
    button.textContent=`${({title:'🏷️ Titres',background:'🖼️ Fonds',frame:'✨ Encadrements',avatar_frame:'🪞 Cadres de profil',object:'🎁 Objets'})[category]}${isDesktopGameUi()?` ${count}`:''}`;
  });
  if(isDesktopGameUi())renderInventoryVisitPreview();
}

function inventoryOwnedItems() {
  let items = (shopData?.catalog || []).filter(item => {
    if (item.category !== inventoryCategory) return false;
    if (item.category === 'object') return Number(item.quantity || 0) > 0;
    return Boolean(item.owned || item.exclusive || item.equipped);
  });
  items = sortCatalogItems(items, inventoryCategory);
  if (inventoryCategory === 'title' && inventoryTitleFilter !== 'all') {
    items = items.filter(item => getTitleColorGroup(item) === inventoryTitleFilter);
  }
  return items;
}

function renderInventory() {
  const grid = $('inventoryGrid');
  if (!grid) return;

  const titleFilterWrap = $('inventoryTitleFilterWrap');
  if (titleFilterWrap) titleFilterWrap.classList.toggle('hidden', inventoryCategory !== 'title');
  renderInventoryVisitPreview();
  const items = inventoryOwnedItems();
  document.querySelectorAll('[data-inventory-category]').forEach(button => {
    const category = button.dataset.inventoryCategory;
    const count = (shopData?.catalog || []).filter(item => item.category === category && (category === 'object' ? Number(item.quantity)>0 : commerceOwns(item))).length;
    button.textContent = `${({title:'🏷️ Titres',background:'🖼️ Fonds',frame:'✨ Encadrements',avatar_frame:'🪞 Cadres de profil',object:'🎁 Objets'})[category]}${isDesktopGameUi()?` ${count}`:''}`;
  });
  $('inventoryCount').textContent = `${items.length} article${items.length > 1 ? 's' : ''} dans cette catégorie`;

  document.querySelectorAll('[data-inventory-category]').forEach(button => {
    button.classList.toggle('active', button.dataset.inventoryCategory === inventoryCategory);
  });

  if (!items.length) {
    grid.innerHTML = isDesktopGameUi() ? `<div class="inventory-empty">Tu n’as ${({title:'aucun titre',background:'aucun fond',frame:'aucun encadrement',avatar_frame:'aucun cadre de profil',object:'aucun objet'})[inventoryCategory]}.<br><button class="shop-action secondary" type="button" data-commerce-empty-shop="${inventoryCategory}">Voir dans la boutique →</button></div>` : `<div class="inventory-empty">Tu ne possèdes encore aucun article dans cette catégorie.</div>`;
    return;
  }

  grid.innerHTML = items.map(item => {
    let action = '';
    if (item.category === 'object') {
      action = item.comingSoon
        ? `<button class="shop-action" type="button" disabled>Bientôt</button>`
        : `<button class="shop-action" type="button" data-inventory-use="${escapeHtml(item.key)}">Utiliser</button>`;
    } else if (item.equipped) {
      action = `<button class="shop-action secondary" type="button" data-inventory-unequip="${escapeHtml(item.key)}">Déséquiper</button>`;
    } else {
      action = `<button class="shop-action" type="button" data-inventory-equip="${escapeHtml(item.key)}">Équiper</button>`;
    }

    const possession = item.category === 'object'
      ? `<span class="inventory-qty">Quantité : ${Number(item.quantity || 0)}</span>`
      : `<span class="inventory-status">${item.equipped ? 'Équipé' : 'Possédé'}</span>`;

    const newlyPurchased=isMobileGameUi() && item.key===mobileInventoryNewItemKey;
    return `<article ${isDesktopGameUi()?`title="${escapeHtml(item.description || '')}" ${item.category!=='object'?'tabindex="0"':''}`:''} class="inventory-item${item.equipped ? ' equipped' : ''}${newlyPurchased?' inventory-item-new':''}" data-inventory-item-key="${escapeHtml(item.key)}">
      ${newlyPurchased?'<span class="inventory-new-badge">✨ Nouveau</span>':''}
      ${shopPreview(item)}
      <div class="inventory-item-name">${escapeHtml(item.name)}</div>
      <div class="inventory-item-desc">${escapeHtml(item.description || '')}</div>
      <div class="inventory-item-meta">${possession}</div>
      <div class="inventory-actions">
        ${isDesktopGameUi()?'':`<button class="shop-action secondary" type="button" data-inventory-preview="${escapeHtml(item.key)}">👁 Prévisualiser</button>`}
        ${action}
      </div>
    </article>`;
  }).join('');
  if(isDesktopGameUi())renderInventoryVisitPreview();
}

async function openInventory() {
  if (isDesktopGameUi()) {
    inventoryTitleFilter = 'all';
    if (desktopView !== 'shop') await openDesktopView('shop');
    setCommerceTab('inventory');
    return;
  }
  syncInventoryPagePlacement();
  renderInventoryVisitPreview();
  $('inventoryModal')?.classList.remove('hidden');
  try {
    await loadShop();
    renderInventory();
  } catch (error) {
    $('inventoryGrid').innerHTML = `<div class="inventory-empty">Impossible de charger l’inventaire.</div>`;
  }
}

function closeInventory() {
  if (isDesktopGameUi()) {setCommerceTab('shop');return;}
  if(isMobileGameUi())mobileInventoryNewItemKey=null;
  $('inventoryModal')?.classList.add('hidden');
  syncMobileNavState?.();
}

async function loadShop() {
  const response = await fetch('/api/shop', { cache:'no-store' });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Impossible de charger la boutique.');
  shopData = data;
  renderShop();
  if(isDesktopGameUi()) {syncDesktopBoostData();renderInventoryVisitPreview();if(commerceTab==='inventory')renderInventory();}
}

function focusShopItem(itemKey) {
  shopFocusItemKey = itemKey || null;
  renderShop();
  if (!itemKey) return;
  requestAnimationFrame(() => {
    const target = document.querySelector(`[data-shop-item-key="${CSS.escape(String(itemKey))}"]`);
    target?.scrollIntoView({ behavior:'smooth', block:'center', inline:'nearest' });
  });
}

async function openShopForIncubatorEgg(slot) {
  incubatorShopTargetSlot = Number(slot) || incubatorShopTargetSlot || null;
  shopCategory = 'object';
  shopFocusItemKey = 'mystery_egg';
  $('shopModal')?.classList.remove('hidden');
  setShopMessage(`Tu n’as pas d’œuf disponible pour l’emplacement ${incubatorShopTargetSlot || ''}. Achète un Œuf mystère pour continuer.`, 'ok');
  try {
    await loadShop();
    focusShopItem('mystery_egg');
  } catch (error) {
    setShopMessage(error.message || 'Impossible de charger la boutique.', 'error');
  }
}

async function openShop() {
  if(isMobileGameUi())mobileShopPage=0;
  if(typeof isDesktopGameUi==='function'&&isDesktopGameUi()){desktopView='shop';document.body.dataset.desktopView='shop';setDesktopNavActive?.('shop');}
  shopFocusItemKey = null;
  incubatorShopTargetSlot = null;
  $('shopModal')?.classList.remove('hidden');
  setShopMessage();
  if(isDesktopGameUi()) setCommerceTab('shop');
  try { await loadShop(); } catch (error) { setShopMessage(error.message, 'error'); }
}

let pendingShopPurchaseKey = null;

let shopPurchaseBusy = false;
function shopPurchaseQuantity(item) {
  return isDesktopGameUi() && item?.category === 'object' ? Number($('shopPurchaseQuantity')?.value) : 1;
}
function updateShopPurchaseQuantity() {
  if (!isDesktopGameUi()) return;
  const item = getShopItemByKey(pendingShopPurchaseKey);
  if (!item) return;
  const quantity = shopPurchaseQuantity(item);
  const valid = Number.isSafeInteger(quantity) && quantity >= 1 && quantity <= 100;
  const total = valid ? Number(item.price || 0) * quantity : 0;
  const enough = valid && Number(shopData?.balance || 0) >= total;
  $('shopPurchaseConfirmPrice').textContent = valid ? `${total.toLocaleString('fr-FR')} LoVeR’Cash` : 'Quantité invalide';
  $('shopPurchaseConfirmText').textContent = valid ? `Confirmer l’achat de ${quantity > 1 ? `${quantity} × ` : ''}${item.name} ?` : 'Choisis une quantité entière entre 1 et 100.';
  $('shopPurchaseConfirmButton').disabled = shopPurchaseBusy || !enough;
  $('shopPurchaseConfirmButton').textContent = shopPurchaseBusy ? 'Paiement en cours…' : !valid ? 'Quantité invalide' : enough ? 'Confirmer l’achat' : 'LoVeR’Cash insuffisant';
  $('shopPurchaseQuantity').disabled = shopPurchaseBusy;
  $('shopPurchaseQuantityMinus').disabled = shopPurchaseBusy || !valid || quantity <= 1;
  $('shopPurchaseQuantityPlus').disabled = shopPurchaseBusy || !valid || quantity >= 100 || Number(shopData?.balance || 0) < Number(item.price || 0)*(quantity+1);
}
function changeShopPurchaseQuantity(delta) {
  if (!isDesktopGameUi() || shopPurchaseBusy) return;
  const input = $('shopPurchaseQuantity');
  input.value = String(Math.max(1,Math.min(100,(Number(input.value)||1)+delta)));
  $('shopPurchaseConfirmError').textContent='';
  updateShopPurchaseQuantity();
}
$('shopPurchaseQuantity')?.addEventListener('input', () => {if(!shopPurchaseBusy){$('shopPurchaseConfirmError').textContent='';updateShopPurchaseQuantity();}});
$('shopPurchaseQuantityMinus')?.addEventListener('click', () => changeShopPurchaseQuantity(-1));
$('shopPurchaseQuantityPlus')?.addEventListener('click', () => changeShopPurchaseQuantity(1));

function openShopPurchaseConfirm(itemKey) {
  const item = getShopItemByKey(itemKey);
  if (!item) return;
  if(shopPurchaseBusy)return;
  pendingShopPurchaseKey = itemKey;
  $('shopPurchaseQuantity').value='1';
  $('shopPurchaseQuantityWrap').classList.toggle('is-visible',isDesktopGameUi() && item.category==='object');
  $('shopPurchaseUnitPrice').textContent=`${Number(item.price||0).toLocaleString('fr-FR')} LoVeR’Cash par objet`;
  $('shopPurchaseConfirmError').textContent='';
  const balance = Number(shopData?.balance || 0);
  const price = Math.max(0, Math.floor(Number(item.price || 0)));
  const enough = balance >= price;
  const visual = $('shopPurchaseConfirmVisual');
  if (visual) visual.innerHTML = shopPreview(item);
  if ($('shopPurchaseConfirmName')) $('shopPurchaseConfirmName').textContent = item.name || 'Article';
  if ($('shopPurchaseConfirmPrice')) $('shopPurchaseConfirmPrice').textContent = `${price.toLocaleString('fr-FR')} LoVeR’Cash`;
  if ($('shopPurchaseConfirmBalance')) $('shopPurchaseConfirmBalance').textContent = `${balance.toLocaleString('fr-FR')} LoVeR’Cash`;
  if ($('shopPurchaseConfirmText')) $('shopPurchaseConfirmText').textContent = `Confirmer l’achat de ${item.name || 'cet article'} ?`;
  const confirm = $('shopPurchaseConfirmButton');
  if (confirm) { confirm.disabled = !enough; confirm.textContent = enough ? 'Confirmer l’achat' : 'LoVeR’Cash insuffisant'; }
  if ($('shopPurchaseConfirmCancel')) $('shopPurchaseConfirmCancel').disabled = false;
  if ($('shopPurchaseConfirmClose')) $('shopPurchaseConfirmClose').disabled = false;
  $('shopPaymentWaiting')?.classList.add('hidden');
  $('shopPaymentWaiting')?.classList.remove('is-running');
  updateShopPurchaseQuantity();
  $('shopPurchaseConfirmModal')?.classList.remove('hidden');
}

function closeShopPurchaseConfirm() {
  if(shopPurchaseBusy)return;
  $('shopPurchaseConfirmModal')?.classList.add('hidden');
  pendingShopPurchaseKey = null;
}

function openShopPurchaseSuccess(item, balance, quantity = 1) {
  const inventoryButton=$('shopPurchaseSuccessInventory');
  if(inventoryButton){
    inventoryButton.dataset.inventoryCategory=item?.category||'object';
    inventoryButton.dataset.inventoryItemKey=item?.key||'';
  }
  if ($('shopPurchaseSuccessVisual')) $('shopPurchaseSuccessVisual').innerHTML = shopPreview(item);
  if ($('shopPurchaseSuccessName')) $('shopPurchaseSuccessName').textContent = `${quantity > 1 ? `${quantity} × ` : ''}${item?.name || 'Ton objet'}`;
  if ($('shopPurchaseSuccessBalance')) $('shopPurchaseSuccessBalance').textContent = `${Number(balance || 0).toLocaleString('fr-FR')} LoVeR’Cash`;
  $('shopPurchaseSuccessModal')?.classList.remove('hidden');
  const card = $('shopPurchaseSuccessCard');
  card?.classList.remove('is-paying');
  void card?.offsetWidth;
  card?.classList.add('is-paying');
}

function closeShopPurchaseSuccess() { $('shopPurchaseSuccessModal')?.classList.add('hidden'); }

async function confirmShopPurchase() {
  const itemKey = pendingShopPurchaseKey;
  const item = getShopItemByKey(itemKey);
  if (!itemKey || !item || shopPurchaseBusy) return;
  const quantity = shopPurchaseQuantity(item);
  if(!Number.isSafeInteger(quantity) || quantity<1 || quantity>100 || (item.category!=='object' && quantity!==1)) {updateShopPurchaseQuantity();return;}
  if(Number(shopData?.balance||0)<Number(item.price||0)*quantity){updateShopPurchaseQuantity();return;}
  shopPurchaseBusy = true;
  updateShopPurchaseQuantity();
  const button = $('shopPurchaseConfirmButton');
  const cancel = $('shopPurchaseConfirmCancel');
  const close = $('shopPurchaseConfirmClose');
  const waiting = $('shopPaymentWaiting');
  if (button) { button.disabled = true; button.textContent = 'Paiement en cours…'; }
  if (cancel) cancel.disabled = true;
  if (close) close.disabled = true;
  waiting?.classList.remove('hidden');
  waiting?.classList.remove('is-running');
  void waiting?.offsetWidth;
  waiting?.classList.add('is-running');
  try {
    const paymentRequest = fetch('/api/shop/buy', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ itemKey, quantity }) });
    const minimumAnimation = new Promise(resolve => setTimeout(resolve, 1500));
    const [response] = await Promise.all([paymentRequest, minimumAnimation]);
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Achat impossible.');
    waiting?.classList.add('hidden');
    waiting?.classList.remove('is-running');
    $('shopPurchaseConfirmModal')?.classList.add('hidden');
    pendingShopPurchaseKey = null;
    await loadShop();
    await loadGame();
    await loadLeaderboard();
    if (!$('inventoryModal')?.classList.contains('hidden')) {renderInventory();}
    closeShopItemPreview();
    openShopPurchaseSuccess(item, data.balance, data.quantity || quantity);

    if (itemKey === 'mystery_egg' && incubatorShopTargetSlot) {
      const targetSlot = Number(incubatorShopTargetSlot);
      incubatorShopTargetSlot = null;
      shopFocusItemKey = null;
      await loadIncubatorSlots();
      $('shopPurchaseSuccessInventory').dataset.incubatorSlot = String(targetSlot);
    } else {
      delete $('shopPurchaseSuccessInventory')?.dataset.incubatorSlot;
    }
  } catch (error) {
    waiting?.classList.add('hidden');
    waiting?.classList.remove('is-running');
    setShopMessage(error.message || 'Achat impossible.', 'error');
    if(isDesktopGameUi())$('shopPurchaseConfirmError').textContent=error.message || 'Achat impossible.';
    if (button) { button.disabled = false; button.textContent = 'Confirmer l’achat'; }
    if (cancel) cancel.disabled = false;
    if (close) close.disabled = false;
  } finally {shopPurchaseBusy=false;updateShopPurchaseQuantity();}
}

let desktopObjectUseBusy = false;
let desktopActiveBoosts = {};
let desktopBoostNotice = null;
let desktopBoostNoticeTimer = null;

function formatBoostRemainingTime(milliseconds) {
  const minutes = Math.max(1, Math.round(Math.max(0, Number(milliseconds) || 0) / 60000));
  const hours = Math.floor(minutes / 60), rest = minutes % 60;
  return hours ? `${hours} h${rest ? ' '+String(rest).padStart(2,'0') : ''}` : `${minutes} min`;
}
function renderDesktopBoostStatus() {
  const box = $('desktopBoostList');
  if (!box || !isDesktopGameUi()) return;
  const active = Object.entries(desktopActiveBoosts).filter(([,until]) => Date.parse(until) > Date.now()).map(([key,until]) => {
    const label = key === 'boost_xp_x2' ? '⚡ XP Lovys ×2' : '💰 LoVeR’Cash ×2';
    return `<span class="desktop-boost-chip"><strong>${label}</strong> · encore ${formatBoostRemainingTime(Date.parse(until)-Date.now())}</span>`;
  });
  if (desktopBoostNotice) active.push(`<span class="desktop-boost-notice ${desktopBoostNotice.error?'error':''}">${escapeHtml(desktopBoostNotice.message)}</span>`);
  box.innerHTML = active.join('') || '<p class="home-boost-empty">Aucun boost actif pour le moment.</p>';
}
function showDesktopBoostNotice(message, error = false) {
  if (!isDesktopGameUi()) return;
  clearTimeout(desktopBoostNoticeTimer);
  desktopBoostNotice = {message,error};
  renderDesktopBoostStatus();
  desktopBoostNoticeTimer = setTimeout(() => {desktopBoostNotice=null;renderDesktopBoostStatus();},12000);
}
async function refreshDesktopBoostStatus() {
  if (!isDesktopGameUi() || document.body.classList.contains('auth-locked')) return;
  try {
    const response = await fetch('/api/shop',{cache:'no-store'});
    if (!response.ok) return;
    const data = await response.json();
    desktopActiveBoosts = data.activeBoosts || {};
    renderDesktopBoostStatus();
  } catch {}
}
setInterval(() => {renderDesktopBoostStatus();refreshDesktopBoostStatus();},60000);

let desktopBoostAcceptedClose = null;
function showDesktopBoostAccepted(itemKey, data) {
  if (!isDesktopGameUi()) return;
  desktopBoostAcceptedClose?.();
  const acceleration = data.acceleration;
  const title = itemKey === 'boost_xp_x2' ? '⚡ Double XP activé !'
    : itemKey === 'boost_cash_x2' ? '💰 Double LoVeR’Cash activé !' : '⏱️ Œuf accéléré !';
  const copy = itemKey === 'boost_xp_x2' ? 'Ton Lovys gagne deux fois plus d’XP pendant tes heures de présence en live.'
    : itemKey === 'boost_cash_x2' ? 'Tu gagnes deux fois plus de LoVeR’Cash pendant tes heures de présence en live.'
    : data.message || 'Le temps d’incubation a été réduit.';
  const until = Date.parse(data.boostExpiresAt);
  const detail = acceleration ? `Emplacement ${acceleration.slot} · ${acceleration.ready ? 'Prêt à éclore !' : `Éclosion dans ${formatEggTime(acceleration.remainingSeconds)}`}`
    : Number.isFinite(until) ? `1 heure ajoutée · ${formatBoostRemainingTime(until-Date.now())} restantes · fin à ${new Date(until).toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'})}` : 'Durée ajoutée : 1 heure';
  const previousFocus = document.activeElement;
  const overlay = document.createElement('div');
  overlay.className = 'desktop-boost-accepted-overlay';
  overlay.setAttribute('role','dialog');overlay.setAttribute('aria-modal','true');overlay.setAttribute('aria-labelledby','desktopBoostAcceptedTitle');
  overlay.innerHTML = `<div class="desktop-boost-accepted-panel"><div class="boost-accepted-check" aria-hidden="true">✓</div><div class="boost-accepted-kicker">Boost accepté</div><h2 id="desktopBoostAcceptedTitle">${escapeHtml(title)}</h2><p>${escapeHtml(copy)}</p><div class="boost-accepted-duration">${escapeHtml(detail)}</div><button class="shop-action" type="button">Compris !</button></div>`;
  const close = () => {document.removeEventListener('keydown',keydown,true);window.removeEventListener('resize',resize);overlay.remove();desktopBoostAcceptedClose=null;previousFocus?.focus?.();};
  const keydown = event => {if(event.key==='Escape'){event.preventDefault();event.stopImmediatePropagation();close();}else if(event.key==='Tab')trapDesktopAdminFocus(event,overlay);};
  const resize = () => {if(!isDesktopGameUi())close();};
  overlay.addEventListener('click', event => {if(event.target===overlay || event.target.closest('button'))close();});
  desktopBoostAcceptedClose=close;
  document.body.appendChild(overlay);document.addEventListener('keydown',keydown,true);window.addEventListener('resize',resize);
  overlay.querySelector('button').focus();
}

async function chooseEggForAcceleration() {
  const response = await fetch('/api/incubator',{cache:'no-store'});
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Impossible de charger tes œufs.');
  incubatorData = data;
  const hatch = Number(data.hatchSeconds || 21600);
  const slots = (data.slots || []).filter(slot => !slot.empty && !slot.ready && Number(slot.watchedSeconds)<hatch);
  if (!slots.length) throw new Error('Aucun œuf à accélérer : tes emplacements sont libres ou tes œufs sont déjà prêts.');
  return new Promise(resolve => {
    const previousFocus = document.activeElement;
    const overlay = document.createElement('div');
    overlay.className = 'desktop-egg-boost-overlay';
    overlay.setAttribute('role','dialog');overlay.setAttribute('aria-modal','true');overlay.setAttribute('aria-labelledby','eggBoostChoiceTitle');
    let selected = null;
    overlay.innerHTML = `<div class="desktop-egg-boost-panel"><h2 id="eggBoostChoiceTitle">⏱️ Accélérateur −30 min</h2><p>Choisis l’œuf à accélérer. Un seul accélérateur sera utilisé après confirmation.</p><div class="egg-boost-choices">${slots.map(slot => {
      const remaining = Math.max(0,hatch-Number(slot.watchedSeconds));
      return `<button type="button" data-egg-boost-slot="${Number(slot.slot)}" aria-pressed="false"><span>🥚 Œuf · emplacement ${Number(slot.slot)}</span><strong>${formatEggTime(remaining)} → ${remaining<=1800?'Prêt à éclore !':formatEggTime(remaining-1800)}</strong></button>`;
    }).join('')}</div><p class="egg-boost-question" data-egg-boost-question>Choisis un œuf pour continuer.</p><div class="egg-boost-actions"><button class="shop-action secondary" type="button" data-egg-boost-cancel>✕ Non, annuler</button><button class="shop-action" type="button" data-egg-boost-confirm disabled>✓ Oui, utiliser</button></div></div>`;
    const finish = value => {document.removeEventListener('keydown',keyHandler,true);window.removeEventListener('resize',resizeHandler);overlay.remove();previousFocus?.focus?.();resolve(value);};
    const resizeHandler = () => {if(!isDesktopGameUi())finish(null);};
    const keyHandler = event => {
      if (event.key==='Escape') {event.preventDefault();event.stopImmediatePropagation();finish(null);}
      else if (event.key==='Tab') trapDesktopAdminFocus(event,overlay);
    };
    overlay.addEventListener('click',event => {
      const choice = event.target.closest('[data-egg-boost-slot]');
      if (choice) {
        selected = slots.find(slot => Number(slot.slot)===Number(choice.dataset.eggBoostSlot));
        overlay.querySelectorAll('[data-egg-boost-slot]').forEach(button => button.setAttribute('aria-pressed', String(button===choice)));
        overlay.querySelector('[data-egg-boost-question]').textContent = `Utiliser un accélérateur sur l’œuf de l’emplacement ${selected.slot} ?`;
        overlay.querySelector('[data-egg-boost-confirm]').disabled = false;
      } else if (event.target.closest('[data-egg-boost-confirm]') && selected) finish({slot:Number(selected.slot),source:selected.source,eggId:selected.eggId});
      else if (event.target===overlay || event.target.closest('[data-egg-boost-cancel]')) finish(null);
    });
    document.body.appendChild(overlay);document.addEventListener('keydown',keyHandler,true);window.addEventListener('resize',resizeHandler);
    overlay.querySelector('[data-egg-boost-cancel]').focus();
  });
}

function confirmDesktopObjectUse(itemKey) {
  const item = getShopItemByKey(itemKey);
  const name = item?.name || 'cet objet';
  const effect = itemKey === 'boost_xp_x2' ? 'Double tes gains d’XP Lovys pendant 1 heure.'
    : itemKey === 'boost_cash_x2' ? 'Double tes gains de LoVeR’Cash pendant 1 heure.'
    : item?.description || '';
  return new Promise(resolve => {
    const previousFocus = document.activeElement;
    const overlay = document.createElement('div');
    overlay.className = 'desktop-egg-boost-overlay';
    overlay.setAttribute('role','dialog');
    overlay.setAttribute('aria-modal','true');
    overlay.setAttribute('aria-labelledby','objectUseConfirmTitle');
    overlay.innerHTML = `<div class="desktop-egg-boost-panel"><h2 id="objectUseConfirmTitle">✨ Utiliser un bonus</h2><p>Souhaites-tu vraiment utiliser <strong>${escapeHtml(name)}</strong> ?</p><p>${escapeHtml(effect)}</p><p>Un objet sera consommé uniquement si tu confirmes et que l’activation réussit.</p><div class="egg-boost-actions"><button class="shop-action secondary" type="button" data-object-use-no>✕ Non, annuler</button><button class="shop-action" type="button" data-object-use-yes>✓ Oui, utiliser</button></div></div>`;
    let finished = false;
    const finish = value => {
      if (finished) return;
      finished = true;
      document.removeEventListener('keydown', onKey, true);
      window.removeEventListener('resize', onResize);
      overlay.remove();
      if (previousFocus?.isConnected) previousFocus.focus();
      resolve(value);
    };
    const onKey = event => {
      if (event.key === 'Escape') {event.preventDefault();event.stopImmediatePropagation();finish(false);}
      else if (event.key === 'Tab') trapDesktopAdminFocus(event,overlay);
    };
    const onResize = () => {if (!isDesktopGameUi()) finish(false);};
    overlay.addEventListener('click', event => {
      if (event.target === overlay || event.target.closest('[data-object-use-no]')) finish(false);
      else if (event.target.closest('[data-object-use-yes]')) finish(true);
    });
    document.body.appendChild(overlay);
    document.addEventListener('keydown', onKey, true);
    window.addEventListener('resize', onResize);
    overlay.querySelector('[data-object-use-no]').focus();
  });
}

async function shopAction(url, itemKey) {
  const desktopUse = isDesktopGameUi() && url === '/api/shop/use';
  if(desktopUse && desktopObjectUseBusy)return;
  if(desktopUse)desktopObjectUseBusy=true;
  setShopMessage();
  try {
    let target = {};
    if(desktopUse && itemKey === 'mystery_egg') {
      await openDesktopView('incubator');await loadIncubatorSlots();
      const free = incubatorData?.slots?.find(slot => slot.empty);
      if(!free)throw new Error('Tous tes emplacements sont occupés. Fais éclore un œuf pour libérer une place.');
      openIncubatorAddModal(free.slot);return;
    }
    if(desktopUse && itemKey === 'incubator_skip_30') {target=await chooseEggForAcceleration();if(!target)return;} 
    else if(desktopUse && !(await confirmDesktopObjectUse(itemKey))) return;
    const response = await fetch(url, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ itemKey, ...target }) });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Action impossible.');
    if(desktopUse) {clearTimeout(desktopBoostNoticeTimer);desktopBoostNotice=null;renderDesktopBoostStatus();showDesktopBoostAccepted(itemKey,data);}
    if(isDesktopGameUi())commerceDraft = {};
    setShopMessage(data.message || 'Action effectuée.', 'ok');
    await loadShop();
    await loadGame();
    await loadLeaderboard();
    if(desktopUse)await loadIncubatorSlots();
    if (!$('inventoryModal')?.classList.contains('hidden')) {renderInventory();}
    if (shopPreviewCurrentKey && !$('shopItemPreviewModal')?.classList.contains('hidden')) renderShopItemPreview();

    if (url === '/api/shop/buy' && itemKey === 'mystery_egg' && incubatorShopTargetSlot) {
      const targetSlot = Number(incubatorShopTargetSlot);
      incubatorShopTargetSlot = null;
      shopFocusItemKey = null;
      await loadIncubatorSlots();
      $('shopModal')?.classList.add('hidden');
      closeShopItemPreview();
      requestAnimationFrame(() => openIncubatorAddModal(targetSlot));
    }
  } catch (error) {
    setShopMessage(error.message || 'Action impossible.', 'error');
    if(desktopUse)showDesktopBoostNotice(error.message || 'Action impossible.',true);
  } finally {if(desktopUse)desktopObjectUseBusy=false;}
}

$('shopTitleFilter')?.addEventListener('change', event => {
  shopTitleFilter = event.target.value || 'all';
  renderShop();
});
$('shopBackgroundFilter')?.addEventListener('change', event => {
  shopBackgroundFilter = event.target.value || 'all';
  renderShop();
});
$('shopFrameFilter')?.addEventListener('change', event => {
  shopFrameFilter = event.target.value || 'all';
  renderShop();
});
$('shopAvatarFrameFilter')?.addEventListener('change', event => {
  shopAvatarFrameFilter = event.target.value || 'all';
  renderShop();
});
$('inventoryTitleFilter')?.addEventListener('change', event => {
  inventoryTitleFilter = event.target.value || 'all';
  renderInventory();
});
$('playerCardInventory')?.addEventListener('click', openInventory);
$('shopInventoryButton')?.addEventListener('click',()=>{if(isDesktopGameUi())openInventory();});
$('inventoryClose')?.setAttribute('title', 'Retour à la boutique');
$('inventoryClose')?.addEventListener('click', closeInventory);
$('inventoryPreviewReset')?.addEventListener('click', () => {commerceDraft = {}; $('inventoryOutfitMessage').textContent = ''; renderInventoryVisitPreview();});
$('inventoryOutfitEquip')?.addEventListener('click', equipCommerceOutfit);
$('homeBoostObjects')?.addEventListener('click', () => {if(!isDesktopGameUi())return;inventoryCategory='object';openInventory();});
$('commerceShopTab')?.addEventListener('click', () => setCommerceTab('shop'));
$('commerceInventoryTab')?.addEventListener('click', () => setCommerceTab('inventory'));
$('inventoryCurrentEquipment')?.addEventListener('click', event => {
  const slot = event.target.closest('[data-commerce-slot]'), remove = event.target.closest('[data-commerce-remove]');
  if (remove && !commerceBusy) shopAction('/api/shop/unequip', remove.dataset.commerceRemove);
  else if (slot) {inventoryCategory = slot.dataset.commerceSlot;inventoryTitleFilter = 'all';setCommerceTab('inventory');}
});
setInterval(syncDesktopBoostData, 30000);
window.addEventListener('resize', syncInventoryPagePlacement);

document.querySelectorAll('[data-inventory-category]').forEach(button => {
  button.addEventListener('click', () => {
    inventoryCategory = button.dataset.inventoryCategory || 'title';
    renderInventory();
  });
});

$('inventoryGrid')?.addEventListener('click', event => {
  const preview = event.target.closest('[data-inventory-preview]');
  const equip = event.target.closest('[data-inventory-equip]');
  const unequip = event.target.closest('[data-inventory-unequip]');
  const use = event.target.closest('[data-inventory-use]');
  const emptyShop = event.target.closest('[data-commerce-empty-shop]');
  if(emptyShop && isDesktopGameUi()){shopCategory=emptyShop.dataset.commerceEmptyShop;shopTitleFilter=shopBackgroundFilter=shopFrameFilter=shopAvatarFrameFilter='all';setCommerceTab('shop');return;}
  if (preview) previewInventoryItem(preview.dataset.inventoryPreview);
  else if (equip) shopAction('/api/shop/equip', equip.dataset.inventoryEquip);
  else if (unequip) shopAction('/api/shop/unequip', unequip.dataset.inventoryUnequip);
  else if (use) shopAction('/api/shop/use', use.dataset.inventoryUse);
});

for (const [gridId,attribute] of [['inventoryGrid','inventoryItemKey'],['shopGrid','shopItemKey']]) {
  const grid = $(gridId);
  const tryCard = event => {
    if (!isDesktopGameUi()) return;
    const card = event.target.closest('[data-inventory-item-key], [data-shop-item-key]');
    if (!card || (event.type === 'pointerover' && card.contains(event.relatedTarget))) return;
    if (event.type === 'click' && event.target.closest('button')) return;
    previewInventoryItem(card.dataset[attribute]);
  };
  grid?.addEventListener('pointerover', tryCard);
  grid?.addEventListener('focusin', tryCard);
  grid?.addEventListener('click', tryCard);
  grid?.addEventListener('keydown', event => {if(isDesktopGameUi() && event.target.matches('article') && ['Enter',' '].includes(event.key)){event.preventDefault();tryCard(event);}});
}

let inventoryBackdropMouseDown = false;
$('inventoryModal')?.addEventListener('mousedown', event => { inventoryBackdropMouseDown = event.target.id === 'inventoryModal'; });
$('inventoryModal')?.addEventListener('mouseup', event => { if (!isMobileGameUi() && inventoryBackdropMouseDown && event.target.id === 'inventoryModal') closeInventory(); inventoryBackdropMouseDown = false; });

$('shopGrid')?.addEventListener('click', event => {
  const preview = event.target.closest('[data-shop-preview]');
  const buy = event.target.closest('[data-shop-buy]');
  const equip = event.target.closest('[data-shop-equip]');
  const use = event.target.closest('[data-shop-use]');
  if (preview) {if(isDesktopGameUi())previewInventoryItem(preview.dataset.shopPreview);else openShopItemPreview(preview.dataset.shopPreview);}
  else if (buy) openShopPurchaseConfirm(buy.dataset.shopBuy);
  else if (equip) shopAction('/api/shop/equip', equip.dataset.shopEquip);
  else if (use) shopAction('/api/shop/use', use.dataset.shopUse);
});

document.querySelectorAll('[data-shop-category]').forEach(button => {
  button.addEventListener('click', () => {
    shopCategory = button.dataset.shopCategory || 'title';
    if (shopCategory !== 'object') shopFocusItemKey = null;
    renderShop();
  });
});

$('shopMobileCategory')?.addEventListener('change',event=>{
  shopCategory=event.target.value;mobileShopPage=0;shopFocusItemKey=null;renderShop();
});
function changeMobileShopPage(delta){
  if(!isMobileGameUi())return;
  mobileShopPage+=delta;shopFocusItemKey=null;renderShop();
  $('shopModal')?.scrollTo({top:0,behavior:'smooth'});
}
$('shopMobilePrevious')?.addEventListener('click',()=>changeMobileShopPage(-1));
$('shopMobileNext')?.addEventListener('click',()=>changeMobileShopPage(1));
window.matchMedia('(max-width:900px)').addEventListener?.('change',()=>{if(shopData)renderShop();});

$('shopClose')?.addEventListener('click', () => { $('shopModal')?.classList.add('hidden'); closeShopItemPreview(); shopFocusItemKey=null; incubatorShopTargetSlot=null; });
$('shopItemPreviewClose')?.addEventListener('click', closeShopItemPreview);
$('shopItemPreviewActions')?.addEventListener('click', event => {
  const buy = event.target.closest('[data-shop-buy]');
  const equip = event.target.closest('[data-shop-equip]');
  const use = event.target.closest('[data-shop-use]');
  if (buy) { closeShopItemPreview(); openShopPurchaseConfirm(buy.dataset.shopBuy); }
  else if (equip) shopAction('/api/shop/equip', equip.dataset.shopEquip);
  else if (use) shopAction('/api/shop/use', use.dataset.shopUse);
});
let shopBackdropMouseDown = false;
$('shopModal')?.addEventListener('mousedown', event => { shopBackdropMouseDown = event.target.id === 'shopModal'; });
$('shopModal')?.addEventListener('mouseup', event => { if (!isDesktopGameUi() && shopBackdropMouseDown && event.target.id === 'shopModal') { $('shopModal')?.classList.add('hidden'); closeShopItemPreview(); shopFocusItemKey=null; incubatorShopTargetSlot=null; } shopBackdropMouseDown = false; });
$('shopPurchaseConfirmCancel')?.addEventListener('click', closeShopPurchaseConfirm);
$('shopPurchaseConfirmClose')?.addEventListener('click', closeShopPurchaseConfirm);
$('shopPurchaseConfirmButton')?.addEventListener('click', confirmShopPurchase);
$('shopPurchaseSuccessContinue')?.addEventListener('click', closeShopPurchaseSuccess);
$('shopPurchaseSuccessClose')?.addEventListener('click', closeShopPurchaseSuccess);
$('shopPurchaseSuccessInventory')?.addEventListener('click', async event => {
  const slot = Number(event.currentTarget.dataset.incubatorSlot || 0);
  closeShopPurchaseSuccess();
  if(isMobileGameUi()){
    const category=event.currentTarget.dataset.inventoryCategory;
    inventoryCategory=['title','background','frame','avatar_frame','object'].includes(category)?category:'object';
    inventoryTitleFilter='all';
    mobileInventoryNewItemKey=event.currentTarget.dataset.inventoryItemKey||null;
    closeAllMobilePanels('inventory');
    closeShopItemPreview();
    $('inventoryModal')?.classList.remove('hidden');
    syncMobileNavState();
    await openInventory();
    const purchased=[...($('inventoryGrid')?.querySelectorAll('[data-inventory-item-key]')||[])].find(card=>card.dataset.inventoryItemKey===mobileInventoryNewItemKey);
    if(purchased)purchased.scrollIntoView({block:'center',behavior:'auto'});
    else $('inventoryModal')?.scrollTo({top:0,behavior:'auto'});
    return;
  }
  if (slot) { $('shopModal')?.classList.add('hidden'); requestAnimationFrame(() => openIncubatorAddModal(slot)); return; }
  await openInventory();
});
$('shopPurchaseConfirmModal')?.addEventListener('click', event => { if (event.target.id === 'shopPurchaseConfirmModal') closeShopPurchaseConfirm(); });
$('shopPurchaseSuccessModal')?.addEventListener('click', event => { if (event.target.id === 'shopPurchaseSuccessModal') closeShopPurchaseSuccess(); });

let shopPreviewBackdropMouseDown = false;
$('shopItemPreviewModal')?.addEventListener('mousedown', event => { shopPreviewBackdropMouseDown = event.target.id === 'shopItemPreviewModal'; });
$('shopItemPreviewModal')?.addEventListener('mouseup', event => { if (shopPreviewBackdropMouseDown && event.target.id === 'shopItemPreviewModal') closeShopItemPreview(); shopPreviewBackdropMouseDown = false; });

function clearAuthErrors() {
  registerError.style.display = 'none';
  loginError.style.display = 'none';
}

$('showRegister').addEventListener('click', () => {
  clearAuthErrors();
  authHome.style.display = 'none';
  registerScreen.classList.remove('hidden');
  loginScreen.classList.add('hidden');
  twitchScreen.classList.add('hidden');
});

$('showLogin').addEventListener('click', () => {
  clearAuthErrors();
  authHome.style.display = 'none';
  loginScreen.classList.remove('hidden');
  registerScreen.classList.add('hidden');
  twitchScreen.classList.add('hidden');
});

$('backFromRegister').addEventListener('click', showAuthHome);
$('backFromLogin').addEventListener('click', showAuthHome);

registerForm.addEventListener('submit', async event => {
  event.preventDefault();
  registerError.style.display = 'none';

  showLoading(
    'Création du compte...',
    'Préparation de ton aventure'
  );

  const loadingStart = Date.now();

  try {
    const response = await fetch('/api/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: $('registerUsername').value,
        email: $('registerEmail').value,
        password: $('registerPassword').value
      })
    });

    const data = await response.json();

    const elapsed = Date.now() - loadingStart;
    if (elapsed < 300) {
      await new Promise(resolve => setTimeout(resolve, 300 - elapsed));
    }

    hideLoading();

    if (!response.ok) {
      registerScreen.classList.remove('hidden');
      registerError.textContent = data.error || 'Impossible de créer le compte.';
      registerError.style.display = 'block';
      return;
    }

    registerForm.reset();

    showSuccess(
      'Inscription réussie !',
      'Ton compte a bien été créé. Il ne te reste plus qu’à connecter ton compte Twitch pour commencer l’aventure.',
      'Connecter Twitch',
      () => {
        showTwitchLink();
      }
    );
  } catch (error) {
    hideLoading();
    registerScreen.classList.remove('hidden');
    console.error(error);
    registerError.textContent = 'Impossible de contacter le serveur.';
    registerError.style.display = 'block';
  }
});

loginForm.addEventListener('submit', async event => {
  event.preventDefault();
  loginError.style.display = 'none';

  showLoading(
    'Connexion en cours...',
    'Vérification de ton compte'
  );

const loadingStart = Date.now();

  try {
    const response = await fetch('/api/account/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: $('loginEmail').value,
        password: $('loginPassword').value
      })
    });

    const data = await response.json();
    const elapsed = Date.now() - loadingStart;

if (elapsed < 300) {
  await new Promise(resolve => setTimeout(resolve, 300 - elapsed));
}

hideLoading();

    if (!response.ok) {
      loginScreen.classList.remove('hidden');
      
      loginError.textContent = data.error || 'Connexion impossible.';
      loginError.style.display = 'block';
      return;
    }

    loginForm.reset();

if (!data.account?.twitchConnected || !data.account?.gameReady) {

  showSuccess(
    'Connexion réussie !',
    'Tu es bien connecté. Il ne te reste plus qu’à connecter ton compte Twitch.',
    'Connecter Twitch',
    () => {
      showTwitchLink();
    }
  );

  return;
}

showSuccess(
  'Connexion réussie !',
  'Bon retour dans LoVeR Watch Game. Ton monstre t’attend !',
  'Entrer dans le jeu',
  async () => {
    showGame();
    await loadGame();
  }
);
  } catch (error) {

  hideLoading();

  loginScreen.classList.remove('hidden');

  console.error(error);

  loginError.textContent = 'Impossible de contacter le serveur.';
  loginError.style.display = 'block';
}
});



function syncDesktopAdminPlacement(){
  const section=$('trackerAdminSection'), content=$('desktopAdminContent');
  if(!section || !content)return;
  if(!desktopAdminOrigin){
    desktopAdminOrigin=document.createComment('tracker-admin-account-origin');
    section.parentNode.insertBefore(desktopAdminOrigin,section);
  }
  if(isDesktopGameUi() || isMobileGameUi()){
    if(section.parentNode!==content)content.appendChild(section);
    section.classList.toggle('hidden',!desktopAdminAuthorized);
  }else{
    closeDesktopAdmin();
    if(desktopAdminOrigin.parentNode && section.parentNode!==desktopAdminOrigin.parentNode){
      desktopAdminOrigin.parentNode.insertBefore(section,desktopAdminOrigin.nextSibling);
    }
  }
}
function setDesktopAdminAccess(allowed){
  desktopAdminAuthorized=Boolean(allowed);
  $('desktopAdminButton')?.classList.toggle('hidden',!desktopAdminAuthorized);
  $('mobileProfileAdmin')?.classList.toggle('hidden',!desktopAdminAuthorized || !isMobileGameUi() || $('mobileSelfProfileActions')?.classList.contains('hidden'));
  if(!desktopAdminAuthorized){closeDesktopAdmin();if(isDesktopGameUi())desktopAdminConfirmationCancel?.();}
  syncDesktopAdminPlacement();
}
async function refreshDesktopAdminAccess(){
  try{
    const response=await fetch('/api/account/me',{cache:'no-store'});
    const data=await response.json();
    setDesktopAdminAccess(Boolean(response.ok && data.authenticated && data.account?.isBroadcaster));
  }catch{setDesktopAdminAccess(false);}
  return desktopAdminAuthorized;
}
async function openDesktopAdmin(){
  if (isDesktopGameUi() && document.body.dataset.desktopView !== 'admin') {
    if (location.hash === '#administration') return openDesktopView('admin');
    location.hash = '#administration';
    return;
  }
  if(!(isDesktopGameUi()||isMobileGameUi()) || !await refreshDesktopAdminAccess()) {
    if (isDesktopGameUi() && document.body.dataset.desktopView === 'admin') location.hash = '#accueil';
    return;
  }
  syncAccountPagePlacement();
  syncDesktopAdminPlacement();
  syncDesktopAdminPageLayout();
  const modal=$('desktopAdminModal');
  if(!modal || !modal.classList.contains('hidden'))return;
  if (!isDesktopGameUi()) {
    desktopAdminPreviousOverflow=document.body.style.overflow;
    document.body.style.overflow='hidden';
    modal.dataset.scrollLocked='true';
  }
  modal.classList.remove('hidden');
  if (isDesktopGameUi()) $('adminTrackerButton')?.click();
  if (!isDesktopGameUi()) $('desktopAdminClose')?.focus();
  await loadTrackerStatus();
}
function closeDesktopAdmin(){
  const modal=$('desktopAdminModal');
  if(!modal || modal.classList.contains('hidden'))return;
  modal.classList.add('hidden');
  if (modal.dataset.scrollLocked === 'true') {
    document.body.style.overflow=desktopAdminPreviousOverflow;
    delete modal.dataset.scrollLocked;
  }
  if(isDesktopGameUi()) return;
  else if(isMobileGameUi())$('mobileProfileAdmin')?.focus();
}
$('desktopAdminButton')?.addEventListener('click',openDesktopAdmin);
$('desktopAdminClose')?.addEventListener('click',()=>{if(isDesktopGameUi())location.hash='#accueil';else closeDesktopAdmin();});
$('desktopAdminModal')?.addEventListener('click',event=>{if(!isDesktopGameUi() && event.target===$('desktopAdminModal'))closeDesktopAdmin();});
document.addEventListener('keydown',event=>{
  if(isDesktopGameUi() || $('desktopAdminModal')?.classList.contains('hidden'))return;
  if(document.querySelector('[data-admin-confirm-overlay]'))return;
  if(['adminPlayersModal','adminDashboardModal','adminEconomyModal','adminTrackerModal','trackerDetectedModal','adminHistoryModal','eventsModal'].some(id=>!$(id)?.classList.contains('hidden')))return;
  if(event.key==='Escape'){event.preventDefault();closeDesktopAdmin();}
  if(event.key==='Tab')trapDesktopAdminFocus(event,$('desktopAdminModal'));
});
window.matchMedia('(min-width:901px)').addEventListener('change',event=>{
  if(!event.matches)desktopAdminConfirmationCancel?.();
  syncDesktopAdminPlacement();
  if(event.matches)refreshDesktopAdminAccess();
});
syncDesktopAdminPlacement();

async function loadTrackerStatus() {
  const section = $('trackerAdminSection');
  const status = $('trackerStatus');
  const detail = $('trackerDetail');
  const connect = $('trackerConnect');
  const test = $('trackerTest');
  if (!section || !status || !detail || !connect || !test) return;

  try {
    const response = await fetch('/api/tracker/status', { cache: 'no-store' });
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Statut indisponible');
    }

    if (!data.authorized) {
      status.textContent = '⚠️ Non configuré';
      detail.textContent = 'Autorise une seule fois le compte Twitch diffuseur pour permettre au serveur de lire la liste des personnes présentes dans le chat.';
      connect.textContent = 'Configurer le tracker';
      test.disabled = true;
      return;
    }

    const zombieMode = String(data.specialMode || '').toLowerCase() === 'zombie';

    status.textContent = data.error
      ? '⚠️ Tracker à vérifier'
      : data.live
        ? zombieMode
          ? '🧟 Mode Zombie · tracker actif'
          : '🟢 Live détecté · tracker actif'
        : zombieMode
          ? '⚪ Chaîne hors ligne · 🧟 Zombie activé'
          : '⚪ Chaîne hors ligne';

    const matched = Number(data.matchedCount || 0);
    const chatters = Number(data.chatterCount || 0);
    const viewers = Number(data.viewerCount || 0);
    const specialModeLine = zombieMode
      ? '🧟 Mode spécial : Zombie ACTIVÉ'
      : '';

    const trackerDetailText = data.error
      ? `Dernière erreur : ${data.error}`
      : data.live
        ? `${viewers} spectateur(s) Twitch · ${chatters} compte(s) présent(s) dans le chat · ${matched} compte(s) LoVeR Watch Game reconnu(s).`
        : 'Le temps sera compté automatiquement lorsque la chaîne sera en live.';

    detail.textContent = specialModeLine
      ? `${trackerDetailText}\n${specialModeLine}`
      : trackerDetailText;

    connect.textContent = 'Reconnecter le tracker';
    test.disabled = false;
  } catch (error) {
    status.textContent = '⚠️ Statut indisponible';
    detail.textContent = error.message || 'Impossible de charger le tracker.';
    test.disabled = true;
  }
}


let eventsRefreshTimer = null;
let currentSpecialMode = null;

function renderEventsState(data) {
  const zombieCard = $('eventZombieCard');
  const zombieState = $('eventZombieState');
  const zombieToggle = $('eventZombieToggle');
  const liveState = $('eventsLiveState');
  const updated = $('eventsUpdated');
  if (!zombieCard || !zombieState || !zombieToggle || !liveState || !updated) return;

  currentSpecialMode = String(data?.specialMode || '').toLowerCase() || null;
  const zombieActive = currentSpecialMode === 'zombie';

  zombieCard.classList.toggle('active', zombieActive);
  zombieState.textContent = zombieActive ? '🟢 ON' : '🔴 OFF';
  zombieToggle.textContent = zombieActive ? 'Passer OFF' : 'Passer ON';
  zombieToggle.classList.toggle('active', zombieActive);

  liveState.textContent = data?.live
    ? '🟢 Chaîne en live · le mode actif peut comptabiliser du temps'
    : '⚪ Chaîne hors ligne · aucun temps n’est comptabilisé';

  const boosts = data?.liveBoosts || {};
  const boostActive = boosts.expiresAt && new Date(boosts.expiresAt).getTime() > Date.now();
  const remaining = boostActive ? Math.max(1, Math.ceil((new Date(boosts.expiresAt).getTime() - Date.now()) / 60000)) : 0;
  const boostStates = [
    ['eventXpBoostState', Number(boosts.xp || 1) > 1],
    ['eventCashBoostState', Number(boosts.cash || 1) > 1],
    ['eventGlobalXpBoostState', Number(boosts.globalXp || 1) > 1],
    ['eventAllBoostState', Number(boosts.xp || 1) > 1 && Number(boosts.cash || 1) > 1 && Number(boosts.globalXp || 1) > 1]
  ];
  boostStates.forEach(([id, active]) => {
    const el=$(id); if(!el) return;
    el.textContent = active && boostActive ? `🟢 ACTIF · ${remaining} min` : 'INACTIF';
  });

  updated.textContent = `Dernière mise à jour : ${new Date().toLocaleTimeString('fr-FR')}`;
}

async function refreshEventsState() {
  try {
    const response = await fetch('/api/tracker/status', { cache: 'no-store' });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Statut indisponible');
    renderEventsState(data);
  } catch (error) {
    const liveState = $('eventsLiveState');
    if (liveState) liveState.textContent = `⚠️ ${error.message || 'Impossible de charger l’état'}`;
  }
}

function stopEventsRefresh() {
  if (eventsRefreshTimer) {
    clearInterval(eventsRefreshTimer);
    eventsRefreshTimer = null;
  }
}

async function openEventsModal() {
  const modal = $('eventsModal');
  if (!modal) return;
  modal.classList.remove('hidden');
  await refreshEventsState();
  stopEventsRefresh();
  eventsRefreshTimer = setInterval(refreshEventsState, 1500);
}

function closeEventsModal() {
  $('eventsModal')?.classList.add('hidden');
  stopEventsRefresh();
}

$('eventsButton')?.addEventListener('click', openEventsModal);
$('eventsClose')?.addEventListener('click', closeEventsModal);
$('eventsModal')?.addEventListener('click', (event) => {
  if (event.target === $('eventsModal')) closeEventsModal();
});

$('eventZombieToggle')?.addEventListener('click', async () => {
  const button = $('eventZombieToggle');
  if (!button) return;
  button.disabled = true;
  button.textContent = 'Modification…';
  try {
    const nextMode = currentSpecialMode === 'zombie' ? null : 'zombie';
    if(isDesktopGameUi() && !await showAdminActionConfirmation({username:'Tous les joueurs concernés',actionText:nextMode?'Activer le mode Zombie':'Désactiver le mode Zombie',question:nextMode?'Activer le mode Zombie pour le jeu ?':'Désactiver le mode Zombie pour le jeu ?'}))return;
    const response = await fetch('/api/events/special-mode', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode: nextMode })
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Modification impossible');
    showDesktopActionSuccess(nextMode?'Mode Zombie bien activé.':'Mode Zombie bien désactivé.');
    renderEventsState(data);
    await loadTrackerStatus();
  } catch (error) {
    const liveState = $('eventsLiveState');
    if (liveState) liveState.textContent = `⚠️ ${error.message || 'Modification impossible'}`;
  } finally {
    button.disabled = false;
    await refreshEventsState();
  }
});


$('eventsGrid')?.addEventListener('click', async event => {
  const button=event.target.closest('[data-live-boost]');
  if(!button) return;
  const kind=button.getAttribute('data-live-boost') || 'off';
  button.disabled=true;
  const old=button.textContent;
  button.textContent='Modification…';
  try{
    if(isDesktopGameUi()){
      const label={xp:'XP Lovys ×2',cash:'LoVeR’Cash ×2',global_xp:'XP globale ×2',all:'XP Lovys, LoVeR’Cash et XP globale ×2'}[kind];
      const details={username:'Les joueurs récompensés par le tracker Twitch',actionText:kind==='off'?'Arrêter les boosts live':`Activer ${label} pendant 60 min`,question:kind==='off'?'Arrêter tous les boosts live du jeu ?':`Activer ${label} pendant 60 minutes pour les joueurs du tracker Twitch ? Ce réglage remplace le boost live précédent.`};
      if(!await showAdminActionConfirmation(details))return;
    }
    const response=await fetch('/api/admin/events/live-boost',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({kind,minutes:60})});
    const data=await response.json();
    if(!response.ok) throw new Error(data.error||'Modification impossible.');
    const successLabel={xp:'Boost XP Lovys ×2',cash:'Boost LoVeR’Cash ×2',global_xp:'Boost XP globale ×2',all:'Boost XP Lovys, LoVeR’Cash et XP globale ×2'}[kind];
    showDesktopActionSuccess(kind==='off'?'Les boosts live ont bien été arrêtés.':`${successLabel} bien activé pour les joueurs du tracker Twitch pendant 60 minutes.`);
    await refreshEventsState();
  }catch(error){window.alert(error.message||'Modification impossible.');}
  finally{button.disabled=false;button.textContent=old;}
});

let adminPlayersSearchTimer = null;

function formatAdminDate(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function formatAdminHours(seconds) {
  const hours = Math.max(0, Number(seconds) || 0) / 3600;
  return `${hours.toFixed(hours >= 10 ? 0 : 1).replace('.', ',')} h`;
}

function renderAdminPlayers(data) {
  const list = $('adminPlayersList');
  const total = $('adminPlayersTotal');
  if (!list || !total) return;

  const players = Array.isArray(data?.players) ? data.players : [];
  const totalCount = Number(data?.total || 0);
  total.textContent = `${totalCount} joueur${totalCount > 1 ? 's' : ''}`;

  if (!players.length) {
    list.innerHTML = '<div class="admin-players-empty">Aucun joueur trouvé.</div>';
    return;
  }

  list.innerHTML = players.map(player => {
    const stateText = player.state === 'creature'
      ? `🐉 Lovys · ${Math.round(Number(player.xp || 0))} XP`
      : player.state === 'egg'
        ? `Œuf · ${formatAdminHours(player.watchSeconds)}`
        : '👤 Compte créé';
    const twitchText = player.twitchConnected
      ? `✅ Twitch${player.twitchLogin ? ` · ${escapeHtml(player.twitchLogin)}` : ''}`
      : '⚪ Twitch non lié';
    const discordText = player.discordVerified
      ? `✅ Discord${player.discordUsername ? ` · ${escapeHtml(player.discordUsername)}` : ''}`
      : player.discordConnected ? '🟠 Discord lié' : '⚪ Discord non lié';

    return `
      <div class="admin-player-card ${player.isBroadcaster ? 'is-broadcaster' : ''}" data-account-id="${player.accountId}">
        <div>
          <div class="admin-player-name">${escapeHtml(player.username || 'Sans pseudo')}${player.isBroadcaster ? ' · 👑 Admin' : ''}</div>
          <div class="admin-player-meta">Inscrit le ${formatAdminDate(player.createdAt)}<br>${escapeHtml(player.email || '—')}</div>
        </div>
        <div>
          <div class="admin-player-meta">${stateText}</div>
          <div class="admin-player-status"><span class="admin-player-pill">${player.isSub ? '⭐ Sub' : '☆ Non sub'}</span><span class="admin-player-pill">💰 ${Math.round(Number(player.points || 0))} LoVeR'Cash</span></div>
        </div>
        <div>
          <div class="admin-player-meta">${twitchText}</div>
          <div class="admin-player-meta">${discordText}</div>
        </div>
        <div class="admin-player-card-actions">
          <button class="admin-player-manage" type="button" data-admin-open-player="${player.accountId}">⚙️ Gérer</button>
          ${player.isBroadcaster
            ? '<span class="admin-player-protected">Compte admin protégé</span>'
            : `<button class="admin-player-delete" type="button" data-delete-account="${player.accountId}" data-delete-username="${escapeHtml(player.username || 'ce joueur')}">🗑 Supprimer</button>`}
        </div>
      </div>`;
  }).join('');
}


function formatAdminNumber(value, digits=0){
  return Number(value||0).toLocaleString('fr-FR',{maximumFractionDigits:digits});
}
function adminStatCard(icon,label,value,sub=''){
  return `<div class="admin-stat-card"><div class="admin-stat-icon">${icon}</div><div><div class="admin-stat-label">${escapeHtml(label)}</div><div class="admin-stat-value">${escapeHtml(String(value))}</div>${sub?`<div class="admin-stat-sub">${escapeHtml(sub)}</div>`:''}</div></div>`;
}
async function adminFetch(url, options={}){
  const response=await fetch(url,{cache:'no-store',...options});
  const data=await response.json().catch(()=>({}));
  if(!response.ok) throw new Error(data.error||'Action impossible.');
  return data;
}

async function openAdminPlayerEditor(accountId){
  const editor=$('adminPlayerEditor'); if(!editor)return;
  editor.dataset.accountId=String(accountId);
  document.querySelectorAll('.admin-player-card.editor-selected').forEach(el=>el.classList.remove('editor-selected'));
  document.querySelector(`.admin-player-card[data-account-id="${CSS.escape(String(accountId))}"]`)?.classList.add('editor-selected');
  editor.classList.remove('hidden');
  editor.innerHTML='<div class="admin-players-empty">Chargement du compte…</div>';
  editor.scrollIntoView({behavior:'smooth',block:'start'});
  try{
    const data=await adminFetch(`/api/admin/players/${encodeURIComponent(accountId)}/detail`);
    renderAdminPlayerEditor(data.player);
  }catch(error){editor.innerHTML=`<div class="admin-players-empty">⚠️ ${escapeHtml(error.message)}</div>`;}
}
function renderAdminPlayerEditor(player){
  const editor=$('adminPlayerEditor');if(!editor)return;
  editor.dataset.playerUsername=String(player.username||'Joueur');
  const lovys=Array.isArray(player.lovys)?player.lovys:[];
  const badges=Array.isArray(player.badges)?player.badges:[];
  const incubator=Array.isArray(player.incubator)?player.incubator:[];
  const pve=Array.isArray(player.pve)?player.pve:[];
  const eggs=Array.isArray(player.inventory)?player.inventory.find(x=>x.item_key==='mystery_egg')?.quantity||0:0;
  const pveWins=pve.reduce((sum,x)=>sum+Number(x.wins||0),0);
  editor.innerHTML=`
    <div class="admin-editor-head"><div><div class="admin-editor-title">⚙️ ${escapeHtml(player.username||'Joueur')}${player.isBroadcaster?' · 👑 Admin':''}</div><div class="admin-player-meta">${escapeHtml(player.email||'—')} · ${player.twitchLogin?`Twitch : ${escapeHtml(player.twitchLogin)}`:'Twitch non lié'}</div></div><button class="account-close" type="button" data-admin-close-editor>×</button></div>
    <div class="admin-player-summary">
      ${adminStatCard('🌐','Niveau global',`${player.globalLevel} · Prestige ${player.prestige}`)}
      ${adminStatCard('💰',"LoVeR'Cash",formatAdminNumber(player.points))}
      ${adminStatCard('⏱️','Visionnage',formatAdminHours(player.watchSeconds))}
      ${adminStatCard('⚡','Réserve XP',formatAdminNumber(player.pendingXp))}
      ${adminStatCard('🐉','Lovys',lovys.length)}
      ${adminStatCard('⚔️','Victoires PvE',pveWins)}
      ${adminStatCard('🥚','Œufs inventaire',eggs)}
      ${adminStatCard('🏅','Badges',badges.length)}
    </div>
    <div class="admin-editor-reason"><label>Motif de la correction <span>(facultatif mais conseillé)</span></label><input id="adminPlayerActionReason" maxlength="180" placeholder="Ex. récompense événement, correction support…"></div>
    <div class="admin-editor-section"><h3>🛠 Corrections du compte</h3><div class="admin-adjust-grid">
      ${adminAdjustRow('💰',"LoVeR'Cash",'cash','+ / −')}
      ${adminAdjustRow('⭐','XP globale','global_xp','+ / −')}
      ${adminAdjustRow('⚡','XP Lovys en réserve','pending_xp','+ / −')}
      ${adminAdjustRow('🧩',"Fragments d'œuf",'egg_fragments','+ / −')}
      ${adminAdjustRow('✨','Fragments universels','universal_fragments','+ / −')}
      ${adminAdjustRow('🥚','Donner des œufs','grant_egg','quantité',true)}
      ${adminAdjustRow('👑','Régler le Prestige','prestige','valeur',true)}
    </div></div>
    <div class="admin-editor-section"><h3>🐉 Lovys & fragments</h3><div class="admin-lovys-admin-list">${lovys.length?lovys.map(l=>`<div class="admin-lovys-row"><div><strong>${l.is_active?'⭐ ':''}${escapeHtml(l.name)}</strong><div class="admin-player-meta">Niv. ${l.level} · Rang ${l.rank}/5 · ${escapeHtml(l.rarity)} · ${formatAdminNumber(l.xp)} XP</div></div><div class="admin-lovys-fragments"><span>🧩 ${formatAdminNumber(l.fragments)}</span><input type="number" value="10" step="1" data-lovys-fragment-input="${l.id}"><button class="btn secondary" data-admin-action="lovys_fragments" data-lovys-id="${l.id}">Appliquer</button></div></div>`).join(''):'<div class="admin-player-meta">Aucun Lovys.</div>'}</div></div>
    <div class="admin-editor-columns">
      <div class="admin-editor-section"><h3>🥚 Incubateur</h3>${incubator.length?incubator.map(e=>`<div class="admin-mini-row"><span>Slot ${e.slot}</span><strong>${e.status==='ready'?'✅ Prêt':'⏳ En cours'}</strong></div>`).join(''):'<div class="admin-player-meta">Aucun œuf placé.</div>'}</div>
      <div class="admin-editor-section"><h3>🏅 Badges</h3><div class="admin-badge-admin-list">${badges.length?badges.slice(0,12).map(b=>`<span class="admin-player-pill">${escapeHtml(b.badge_name||b.badge_key)}</span>`).join(''):'<span class="admin-player-meta">Aucun badge.</span>'}</div></div>
    </div>
    <div class="admin-editor-section admin-danger-section"><h3>⚔️ Réparation PvE</h3><p class="admin-player-meta">Ces outils servent à débloquer un joueur en cas de problème. Ils ne modifient pas les réglages des boss.</p><div class="admin-editor-actions"><button class="btn secondary" data-admin-action="reset_battle">↻ Annuler le combat actif</button><button class="btn warning" data-admin-action="reset_pve">⚠️ Réinitialiser la progression PvE</button></div></div>
    <div id="adminPlayerActionMessage" class="admin-action-message"></div>`;
}
function adminAdjustRow(icon,label,action,placeholder,positiveOnly=false){
  return `<div class="admin-adjust-row"><div><strong>${icon} ${escapeHtml(label)}</strong><div class="admin-player-meta">${positiveOnly?'Valeur ou quantité':'Montant positif ou négatif'}</div></div><input type="number" step="1" value="${action==='prestige'?0:10}" ${positiveOnly&&action!=='prestige'?'min="1"':''} data-admin-amount="${action}" placeholder="${escapeHtml(placeholder)}"><button class="btn secondary" data-admin-action="${action}">Appliquer</button></div>`;
}
function adminActionConfirmationDetails(action, amount, button, editor){
  const username=editor?.dataset?.playerUsername||'ce joueur';
  const numeric=Number(amount);
  const signed=(Number.isFinite(numeric)&&numeric>0?'+':'')+(Number.isFinite(numeric)?numeric:amount);
  const labels={cash:"LoVeR’Cash",global_xp:'XP globale',pending_xp:'XP Lovys en réserve',egg_fragments:"fragments d’œuf",universal_fragments:'fragments universels'};
  if(labels[action]){
    const verb=Number(numeric)<0?'Retirer':'Ajouter';
    const qty=Math.abs(Number(numeric)||0);
    return {username,actionText:`${verb} ${qty.toLocaleString('fr-FR')} ${labels[action]}`,question:`Êtes-vous sûr de vouloir ${verb.toLowerCase()} ${qty.toLocaleString('fr-FR')} ${labels[action]} ${Number(numeric)<0?'à':'à'} ${username} ?`};
  }
  if(action==='grant_egg') return {username,actionText:`Donner ${Number(numeric)||0} œuf(s)`,question:`Êtes-vous sûr de vouloir donner ${Number(numeric)||0} œuf(s) à ${username} ?`};
  if(action==='prestige') return {username,actionText:`Régler le Prestige sur ${Number(numeric)||0}`,question:`Êtes-vous sûr de vouloir régler le Prestige de ${username} sur ${Number(numeric)||0} ?`};
  if(action==='lovys_fragments'){
    const row=button.closest('.admin-lovys-row');
    const lovysName=row?.querySelector('strong')?.textContent?.replace(/^⭐\s*/,'').trim()||'ce Lovys';
    const verb=Number(numeric)<0?'Retirer':'Ajouter'; const qty=Math.abs(Number(numeric)||0);
    return {username,actionText:`${verb} ${qty} fragment(s) · ${lovysName}`,question:`Êtes-vous sûr de vouloir ${verb.toLowerCase()} ${qty} fragment(s) de ${lovysName} à ${username} ?`};
  }
  if(action==='reset_battle') return {username,actionText:'Annuler le combat PvE actif',question:`Êtes-vous sûr de vouloir annuler le combat PvE actif de ${username} ?`};
  if(action==='reset_pve') return {username,actionText:'Réinitialiser la progression PvE',question:`Êtes-vous sûr de vouloir réinitialiser toute la progression PvE de ${username} ?`};
  return {username,actionText:`Appliquer ${action} ${signed}`,question:`Êtes-vous sûr de vouloir appliquer cette modification à ${username} ?`};
}
function showLegacyAdminActionConfirmation(details){
  return new Promise(resolve=>{
    document.querySelector('[data-admin-confirm-overlay]')?.remove();
    const overlay=document.createElement('div');
    overlay.className='admin-confirm-overlay'; overlay.setAttribute('data-admin-confirm-overlay','');
    overlay.innerHTML=`<div class="admin-confirm-card" role="dialog" aria-modal="true" aria-label="Confirmer la modification"><div class="admin-confirm-icon">⚠️</div><h3>Confirmer la modification</h3><div class="admin-confirm-summary"><div><span>Joueur</span><strong>${escapeHtml(details.username)}</strong></div><div><span>Action</span><strong>${escapeHtml(details.actionText)}</strong></div></div><p>${escapeHtml(details.question)}</p><div class="admin-confirm-actions"><button type="button" class="btn secondary" data-admin-confirm-cancel>Annuler</button><button type="button" class="btn" data-admin-confirm-approve>✓ Approuver</button></div></div>`;
    document.body.appendChild(overlay);
    const finish=value=>{overlay.remove();document.removeEventListener('keydown',onKey);resolve(value);};
    const onKey=e=>{if(e.key==='Escape')finish(false);}; document.addEventListener('keydown',onKey);
    overlay.addEventListener('click',e=>{if(e.target===overlay||e.target.closest('[data-admin-confirm-cancel]'))finish(false);if(e.target.closest('[data-admin-confirm-approve]'))finish(true);});
    overlay.querySelector('[data-admin-confirm-approve]')?.focus();
  });
}
function trapDesktopAdminFocus(event,container){
  const buttons=Array.from(container.querySelectorAll('button:not(:disabled),a[href],input:not(:disabled)')).filter(el=>el.getClientRects().length);
  if(!buttons.length)return;
  const first=buttons[0],last=buttons[buttons.length-1];
  if(event.shiftKey && (document.activeElement===first || !container.contains(document.activeElement))){event.preventDefault();last.focus();}
  else if(!event.shiftKey && (document.activeElement===last || !container.contains(document.activeElement))){event.preventDefault();first.focus();}
}
function showAdminActionConfirmation(details){
  if(!isDesktopGameUi())return showLegacyAdminActionConfirmation(details);
  if(desktopActionSuccessTimer)clearTimeout(desktopActionSuccessTimer);
  desktopActionSuccessTimer=null;
  document.querySelector('[data-desktop-action-success]')?.remove();
  desktopAdminConfirmationCancel?.();
  return new Promise(resolve=>{
    const previousFocus=document.activeElement;
    const overlay=document.createElement('div');
    overlay.className='admin-confirm-overlay';overlay.setAttribute('data-admin-confirm-overlay','');
    overlay.innerHTML=`<div class="admin-confirm-card" role="dialog" aria-modal="true" aria-labelledby="desktopAdminConfirmTitle"><div class="admin-confirm-icon">⚠️</div><h3 id="desktopAdminConfirmTitle">Confirmer ou refuser</h3><div class="admin-confirm-summary"><div><span>Joueur / cible</span><strong>${escapeHtml(details.username)}</strong></div><div><span>Action</span><strong>${escapeHtml(details.actionText)}</strong></div></div><p>${escapeHtml(details.question)}</p><div class="admin-confirm-actions"><button type="button" class="btn secondary" data-admin-confirm-cancel>✕ Non, refuser</button><button type="button" class="btn" data-admin-confirm-approve>✓ Oui, confirmer</button></div></div>`;
    document.body.appendChild(overlay);
    let finished=false;
    const finish=value=>{
      if(finished)return;finished=true;
      overlay.remove();document.removeEventListener('keydown',onKey);
      desktopAdminConfirmationCancel=null;
      if(previousFocus?.isConnected)previousFocus.focus();
      resolve(value);
    };
    const onKey=event=>{
      if(event.key==='Escape'){event.preventDefault();event.stopImmediatePropagation();finish(false);}
      if(event.key==='Tab')trapDesktopAdminFocus(event,overlay);
    };
    desktopAdminConfirmationCancel=()=>finish(false);
    document.addEventListener('keydown',onKey);
    overlay.addEventListener('click',event=>{
      if(event.target===overlay || event.target.closest('[data-admin-confirm-cancel]'))finish(false);
      else if(event.target.closest('[data-admin-confirm-approve]'))finish(true);
    });
    overlay.querySelector('[data-admin-confirm-cancel]')?.focus();
  });
}
function desktopAdminActionConfirmationDetails(action,amount,button,editor){
  const username=editor.dataset.playerUsername||'ce joueur';
  const numeric=Number(amount),qty=Math.abs(numeric).toLocaleString('fr-FR');
  const verb=numeric<0?'Retirer':'Donner';
  const labels={cash:"LoVeR’Cash",global_xp:'XP globale',pending_xp:'XP Lovys en réserve',egg_fragments:'fragments d’œuf',universal_fragments:'fragments universels'};
  if(labels[action])return {username,actionText:`${verb} ${qty} ${labels[action]}`,question:`${verb} ${qty} ${labels[action]} à ${username} ?`};
  if(action==='grant_egg')return {username,actionText:`Donner ${qty} œuf(s) mystère`,question:`Donner ${qty} œuf(s) mystère à ${username} ?`};
  if(action==='prestige')return {username,actionText:`Régler le Prestige à ${numeric}`,question:`Régler le Prestige de ${username} à ${numeric} ?`};
  if(action==='lovys_fragments'){
    const name=button.closest('.admin-lovys-row')?.querySelector('strong')?.textContent?.replace(/^⭐\s*/,'').trim()||'ce Lovys';
    return {username,lovysName:name,actionText:`${verb} ${qty} fragment(s) de ${name}`,question:`${verb} ${qty} fragment(s) de ${name} à ${username} ?`};
  }
  if(action==='reset_battle')return {username,actionText:'Annuler le combat actif',question:`Annuler le combat actif de ${username} ?`};
  return {username,actionText:'Réinitialiser la progression PvE',question:`Réinitialiser toute la progression PvE de ${username} ? Les victoires enregistrées seront effacées.`};
}
function validateDesktopAdminAmount(action,amount){
  if(action==='reset_battle' || action==='reset_pve')return;
  const value=Number(amount);
  const limit=action==='grant_egg'?20:action==='prestige'?99:action.includes('fragments')?100000:1000000;
  if(String(amount??'').trim()==='' || !Number.isSafeInteger(value) || Math.abs(value)>limit || (action==='grant_egg' && value<1) || (action==='prestige' && value<0) || (action!=='prestige' && value===0)){
    throw new Error(`Saisis un nombre entier ${action==='grant_egg'?`entre 1 et ${limit}`:action==='prestige'?`entre 0 et ${limit}`:`non nul entre −${limit.toLocaleString('fr-FR')} et ${limit.toLocaleString('fr-FR')}`}.`);
  }
}
function showDesktopActionSuccess(message){
  if(!isDesktopGameUi())return;
  if(desktopActionSuccessTimer)clearTimeout(desktopActionSuccessTimer);
  document.querySelector('[data-desktop-action-success]')?.remove();
  const notice=document.createElement('div');
  notice.className='desktop-action-success';notice.setAttribute('data-desktop-action-success','');
  notice.setAttribute('role','status');notice.setAttribute('aria-live','polite');notice.setAttribute('aria-atomic','true');
  notice.innerHTML=`<span class="desktop-action-success-check" aria-hidden="true">✓</span><strong>Action réussie</strong><p>${escapeHtml(message)}</p><span class="desktop-action-success-progress" aria-hidden="true"></span>`;
  document.body.appendChild(notice);
  desktopActionSuccessTimer=setTimeout(()=>{notice.remove();desktopActionSuccessTimer=null;},2600);
}
function desktopAdminPlayerSuccessMessage(action,amount,details){
  const name=details.username,qty=Math.abs(Number(amount)||0).toLocaleString('fr-FR');
  const removing=Number(amount)<0;
  if(action==='cash')return removing?`Retrait de ${qty} LoVeR’Cash effectué pour ${name}.`:`${qty} LoVeR’Cash bien crédités à ${name}.`;
  if(action==='grant_egg')return `${qty} œuf(s) mystère bien donnés à ${name}.`;
  if(action==='pending_xp')return removing?`Réserve d’XP Lovys de ${name} mise à jour.`:`${qty} XP Lovys bien créditées à la réserve de ${name}.`;
  if(action==='global_xp')return `XP globale de ${name} bien mise à jour.`;
  if(action==='egg_fragments')return removing?`Fragments d’œuf de ${name} bien mis à jour.`:`${qty} fragments d’œuf bien crédités à ${name}.`;
  if(action==='universal_fragments')return removing?`Fragments universels de ${name} bien mis à jour.`:`${qty} fragments universels bien crédités à ${name}.`;
  if(action==='lovys_fragments')return removing?`Fragments de ${details.lovysName||'Lovys'} de ${name} bien mis à jour.`:`${qty} fragments de ${details.lovysName||'Lovys'} bien donnés à ${name}.`;
  if(action==='prestige')return `Prestige de ${name} bien réglé à ${amount}.`;
  if(action==='reset_battle')return `Combat actif de ${name} bien annulé.`;
  if(action==='reset_pve')return `Progression PvE de ${name} bien réinitialisée.`;
  return `${details.actionText} : modification bien appliquée à ${name}.`;
}
async function runAdminPlayerAction(button){
  if(isDesktopGameUi())return runDesktopAdminPlayerAction(button);
  const editor=$('adminPlayerEditor');if(!editor)return;
  const accountId=editor.closest('.admin-players-panel')?.querySelector('.admin-player-card.editor-selected')?.dataset.accountId || editor.dataset.accountId;
  if(!accountId)return;
  const action=button.getAttribute('data-admin-action');
  const reason=$('adminPlayerActionReason')?.value?.trim()||'';
  let amount;
  if(action==='lovys_fragments') amount=editor.querySelector(`[data-lovys-fragment-input="${button.dataset.lovysId}"]`)?.value;
  else amount=editor.querySelector(`[data-admin-amount="${action}"]`)?.value;
  const details=adminActionConfirmationDetails(action,amount,button,editor);
  const approved=await showAdminActionConfirmation(details);
  if(!approved)return;
  button.disabled=true;const old=button.textContent;button.textContent='…';
  try{
    const body={action,reason,amount};if(action==='lovys_fragments')body.lovysId=button.dataset.lovysId;
    const data=await adminFetch(`/api/admin/players/${encodeURIComponent(accountId)}/action`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
    const msg=$('adminPlayerActionMessage');if(msg){msg.textContent=`✅ ${data.summary}`;msg.className='admin-action-message success';}
    await openAdminPlayerEditor(accountId);await loadAdminPlayers();
  }catch(error){window.alert(error.message||'Correction impossible.');}
  finally{button.disabled=false;button.textContent=old;}
}
async function runDesktopAdminPlayerAction(button){
  const editor=$('adminPlayerEditor');
  if(!desktopAdminAuthorized || !editor?.dataset.accountId || button.disabled)return;
  const accountId=editor.dataset.accountId;
  const action=button.getAttribute('data-admin-action');
  const amount=action==='lovys_fragments'?editor.querySelector(`[data-lovys-fragment-input="${button.dataset.lovysId}"]`)?.value:editor.querySelector(`[data-admin-amount="${action}"]`)?.value;
  const message=$('adminPlayerActionMessage');
  try{validateDesktopAdminAmount(action,amount);}catch(error){if(message){message.textContent=error.message;message.className='admin-action-message error';}return;}
  const body={action,reason:$('adminPlayerActionReason')?.value?.trim()||''};
  if(amount!==undefined)body.amount=Number(amount);
  if(action==='lovys_fragments')body.lovysId=button.dataset.lovysId;
  const details=desktopAdminActionConfirmationDetails(action,amount,button,editor);
  const old=button.textContent;button.disabled=true;
  try{
    if(!await showAdminActionConfirmation(details))return;
    button.textContent='Application…';
    const data=await adminFetch(`/api/admin/players/${encodeURIComponent(accountId)}/action`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
    showDesktopActionSuccess(desktopAdminPlayerSuccessMessage(action,body.amount,details));
    await loadAdminPlayers();await openAdminPlayerEditor(accountId);
    const result=$('adminPlayerActionMessage');
    if(result){result.textContent=`✅ ${data.summary}`;result.className='admin-action-message success';}
  }catch(error){
    const result=$('adminPlayerActionMessage');
    if(result){result.textContent=error.message||'Correction impossible.';result.className='admin-action-message error';}
  }finally{button.disabled=false;button.textContent=old;if(button.isConnected)button.focus();}
}

async function loadAdminDashboard(){
  const box=$('adminDashboardContent');if(!box)return;box.innerHTML='<div class="admin-players-empty">Chargement…</div>';
  try{const d=await adminFetch('/api/admin/dashboard');const s=d.stats||{},t=d.tracker||{},b=d.liveBoosts||{};box.innerHTML=`<div class="admin-dashboard-grid">${adminStatCard('👥','Joueurs inscrits',s.players,`${s.activeToday} actif(s) aujourd’hui`)}${adminStatCard('🟣','Twitch liés',s.twitchLinked)}${adminStatCard('🥚','Incubations',s.incubating,`${s.readyEggs} prêt(s)`)}${adminStatCard('🐉','Lovys possédés',s.lovys)}${adminStatCard('⚔️','Combats aujourd’hui',s.fightsToday,`${s.victoriesToday} victoire(s)`)}${adminStatCard('👑','Boss vaincus',s.bossWinsToday)}${adminStatCard('💰','Cash en circulation',formatAdminNumber(s.cashBalance))}${adminStatCard('🎡','Roues aujourd’hui',s.wheelSpinsToday)}</div><div class="admin-dashboard-section"><h3>📺 Tracker</h3><div class="admin-health ${t.error?'bad':t.live?'good':''}"><strong>${t.error?'⚠️ À vérifier':t.live?'🟢 Live détecté':'⚪ Chaîne hors ligne'}</strong><span>${t.chatters||0} dans le chat · ${t.matched||0} joueur(s) reconnu(s)</span></div></div><div class="admin-dashboard-section"><h3>🔥 Boost live</h3><div class="admin-player-meta">XP ×${b.xp||1} · Cash ×${b.cash||1} · XP globale ×${b.globalXp||1}${b.expiresAt?` · jusqu’à ${new Date(b.expiresAt).toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'})}`:''}</div></div><div class="admin-dashboard-section"><h3>📜 Activité admin récente</h3>${(d.recent||[]).length?(d.recent||[]).map(x=>`<div class="admin-history-row"><div><strong>${escapeHtml(x.summary)}</strong><div class="admin-player-meta">${new Date(x.created_at).toLocaleString('fr-FR')}</div></div></div>`).join(''):'<div class="admin-player-meta">Aucune action enregistrée.</div>'}</div>`;}catch(e){box.innerHTML=`<div class="admin-players-empty">⚠️ ${escapeHtml(e.message)}</div>`;}
}
async function loadAdminEconomy(){
  const box=$('adminEconomyContent');if(!box)return;box.innerHTML='<div class="admin-players-empty">Chargement…</div>';
  try{const d=await adminFetch('/api/admin/economy');const t=d.totals||{},series=d.series||[];box.innerHTML=`<div class="admin-dashboard-grid">${adminStatCard('💰','Cash possédé',formatAdminNumber(t.balance))}${adminStatCard('📥','Cash gagné historique',formatAdminNumber(t.earned))}${adminStatCard('📤','Cash dépensé historique',formatAdminNumber(t.spent))}${adminStatCard('⭐','XP globale totale',formatAdminNumber(t.global_xp))}${adminStatCard('⚡','XP Lovys en réserve',formatAdminNumber(t.pending_xp))}${adminStatCard('🥚','Œufs en inventaire',formatAdminNumber(t.inventory_eggs))}${adminStatCard('🧩',"Fragments d'œuf",formatAdminNumber(t.egg_fragments))}${adminStatCard('✨','Fragments universels',formatAdminNumber(t.universal_fragments))}</div><div class="admin-dashboard-section"><h3>7 derniers jours</h3><div class="admin-economy-days">${series.length?series.map(x=>`<div class="admin-economy-day"><strong>${new Date(`${x.date}T12:00:00`).toLocaleDateString('fr-FR',{weekday:'short',day:'2-digit'})}</strong><span>💰 ${formatAdminNumber(x.cash,1)}</span><span>⭐ ${formatAdminNumber(x.global_xp,1)}</span><span>⏱️ ${formatAdminHours(x.watch_seconds)}</span></div>`).join(''):'<div class="admin-player-meta">Pas encore de données sur cette période.</div>'}</div></div>`;}catch(e){box.innerHTML=`<div class="admin-players-empty">⚠️ ${escapeHtml(e.message)}</div>`;}
}

async function loadAdminTrackerPanel(){
  const box=$('adminTrackerContent');if(!box)return;box.innerHTML='<div class="admin-players-empty">Chargement…</div>';
  try{const d=await adminFetch('/api/tracker/status');if(!d.authorized){box.innerHTML='<div class="admin-players-empty">⚠️ Tracker non configuré.</div>';return;}const b=d.liveBoosts||{};box.innerHTML=`<div class="admin-dashboard-grid">${adminStatCard(d.live?'🟢':'⚪','État',d.live?'LIVE':'HORS LIGNE')}${adminStatCard('👁','Spectateurs Twitch',d.viewerCount||0)}${adminStatCard('👥','Comptes dans le chat',d.chatterCount||0)}${adminStatCard('🎮','LoVeR Watch Game reconnus',d.matchedCount||0)}${adminStatCard('🧟','Mode spécial',d.specialMode||'Aucun')}</div><div class="admin-dashboard-section"><div class="admin-health ${d.error?'bad':'good'}"><strong>${d.error?'⚠️ Erreur tracker':'✅ Tracker opérationnel'}</strong><span>${d.error?escapeHtml(d.error):`Dernier succès : ${d.lastSuccessAt?new Date(d.lastSuccessAt).toLocaleString('fr-FR'):'—'}`}</span></div></div><div class="admin-dashboard-section"><h3>Boosts de visionnage</h3><div class="admin-player-meta">XP Lovys ×${b.xp||1} · Cash ×${b.cash||1} · XP globale ×${b.globalXp||1}</div></div>`;}catch(e){box.innerHTML=`<div class="admin-players-empty">⚠️ ${escapeHtml(e.message)}</div>`;}
}
async function loadAdminHistory(){
  const box=$('adminHistoryContent');if(!box)return;box.innerHTML='<div class="admin-players-empty">Chargement…</div>';
  try{const d=await adminFetch('/api/admin/history');const items=d.items||[];box.innerHTML=items.length?items.map(x=>`<div class="admin-history-row"><div><strong>${escapeHtml(x.summary)}</strong><div class="admin-player-meta">${escapeHtml(x.target_username||'Action globale')} · ${new Date(x.created_at).toLocaleString('fr-FR')}</div>${x.details_json?.reason?`<div class="admin-history-reason">Motif : ${escapeHtml(x.details_json.reason)}</div>`:''}</div><span class="admin-player-pill">${escapeHtml(x.action_key)}</span></div>`).join(''):'<div class="admin-players-empty">Aucune action enregistrée.</div>';}catch(e){box.innerHTML=`<div class="admin-players-empty">⚠️ ${escapeHtml(e.message)}</div>`;}
}
function openAdminModal(id,loader){$(id)?.classList.remove('hidden');loader?.();}
function closeAdminModal(id){$(id)?.classList.add('hidden');}

async function loadAdminPlayers() {
  const list = $('adminPlayersList');
  if (!list) return;
  const search = $('adminPlayersSearch')?.value?.trim() || '';
  list.innerHTML = '<div class="admin-players-empty">Chargement…</div>';
  try {
    const response = await fetch(`/api/admin/players?search=${encodeURIComponent(search)}`, { cache: 'no-store' });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Impossible de charger les joueurs.');
    renderAdminPlayers(data);
  } catch (error) {
    list.innerHTML = `<div class="admin-players-empty">⚠️ ${escapeHtml(error.message || 'Erreur de chargement')}</div>`;
  }
}

function openAdminPlayersModal() {
  $('adminPlayersModal')?.classList.remove('hidden');
  if ($('adminPlayersSearch')) $('adminPlayersSearch').value = '';
  loadAdminPlayers();
}

function closeAdminPlayersModal() {
  $('adminPlayersModal')?.classList.add('hidden');
  $('adminPlayerEditor')?.classList.add('hidden');
}

$('adminPlayersButton')?.addEventListener('click', openAdminPlayersModal);
$('adminPlayersClose')?.addEventListener('click', closeAdminPlayersModal);
$('adminDashboardButton')?.addEventListener('click',()=>openAdminModal('adminDashboardModal',loadAdminDashboard));
$('adminEconomyButton')?.addEventListener('click',()=>openAdminModal('adminEconomyModal',loadAdminEconomy));
async function loadTrackerDetectedAccounts(){
  const box=$('trackerDetectedContent'); if(!box)return;
  box.innerHTML='<div class="admin-players-empty">Chargement…</div>';
  try{
    const r=await fetch('/api/tracker/detected-accounts',{cache:'no-store'}); const d=await r.json();
    if(!r.ok)throw new Error(d.error||'Chargement impossible.');
    if(!d.live){box.innerHTML='<div class="admin-players-empty">⚪ La chaîne est hors ligne.</div>';return;}
    const matched=Array.isArray(d.matched)?d.matched:[];
    const others=(Array.isArray(d.chatters)?d.chatters:[]).filter(x=>!x.linked);
    const row=x=>`<div class="admin-history-row"><div><strong>${escapeHtml(x.twitchName||x.twitchLogin||'Compte Twitch')}</strong><div class="admin-player-meta">@${escapeHtml(x.twitchLogin||'—')}${x.watchGameName?` · LoVeR Watch Game : ${escapeHtml(x.watchGameName)}`:''}</div></div><div>${x.linked?'✅ Reconnu':'⚪ Non lié'}</div></div>`;
    box.innerHTML=`<div class="admin-dashboard-grid">${adminStatCard('👁','Spectateurs Twitch',d.viewerCount||0)}${adminStatCard('💬','Comptes chat',d.chatterCount||0)}${adminStatCard('🎮','LoVeR Watch Game reconnus',d.matchedCount||0)}</div><div class="admin-dashboard-section"><h3>✅ Comptes LoVeR Watch Game détectés</h3>${matched.length?matched.map(row).join(''):'<div class="admin-players-empty">Aucun compte LoVeR Watch Game reconnu pour le moment.</div>'}</div><div class="admin-dashboard-section"><h3>Autres comptes présents dans le chat</h3><div class="admin-player-meta" style="margin-bottom:10px">Les bots connus et le compte diffuseur sont exclus des récompenses.</div>${others.length?others.map(row).join(''):'<div class="admin-players-empty">Aucun autre compte.</div>'}</div>`;
  }catch(e){box.innerHTML=`<div class="admin-players-empty">⚠️ ${escapeHtml(e.message||'Chargement impossible.')}</div>`;}
}

$('trackerDetectedButton')?.addEventListener('click',()=>openAdminModal('trackerDetectedModal',loadTrackerDetectedAccounts));
$('trackerDetectedClose')?.addEventListener('click',()=>$('trackerDetectedModal')?.classList.add('hidden'));
$('trackerDetectedModal')?.addEventListener('click',e=>{if(e.target?.id==='trackerDetectedModal')$('trackerDetectedModal')?.classList.add('hidden');});

$('adminTrackerButton')?.addEventListener('click',()=>{openAdminModal('adminTrackerModal',loadAdminTrackerPanel);if(isDesktopGameUi())loadTrackerStatus();});
$('adminHistoryButton')?.addEventListener('click',()=>openAdminModal('adminHistoryModal',loadAdminHistory));
[['adminDashboardModal','adminDashboardClose'],['adminEconomyModal','adminEconomyClose'],['adminTrackerModal','adminTrackerClose'],['adminHistoryModal','adminHistoryClose']].forEach(([modalId,closeId])=>{
  $(closeId)?.addEventListener('click',()=>closeAdminModal(modalId));
  $(modalId)?.addEventListener('click',e=>{if(e.target.id===modalId)closeAdminModal(modalId);});
});
$('adminPlayersModal')?.addEventListener('click', event => {
  if (event.target.id === 'adminPlayersModal') closeAdminPlayersModal();
});
$('adminPlayersSearch')?.addEventListener('input', () => {
  clearTimeout(adminPlayersSearchTimer);
  adminPlayersSearchTimer = setTimeout(loadAdminPlayers, 250);
});
$('adminPlayersList')?.addEventListener('click', async event => {
  const manageButton=event.target.closest('[data-admin-open-player]');
  if(manageButton){await openAdminPlayerEditor(manageButton.getAttribute('data-admin-open-player'));return;}
  const button = event.target.closest('[data-delete-account]');
  if (!button) return;
  if(isDesktopGameUi()){await deleteDesktopAdminAccount(button);return;}

  const accountId = button.getAttribute('data-delete-account');
  const username = button.getAttribute('data-delete-username') || 'ce joueur';
  const confirmed = window.confirm(`Supprimer définitivement le compte de ${username} ?\n\nLe compte, la progression, les badges, l’XP, le LoVeR'Cash et le temps de visionnage seront supprimés.`);
  if (!confirmed) return;

  const secondConfirm = window.confirm(`Dernière confirmation : supprimer ${username} définitivement ?`);
  if (!secondConfirm) return;

  button.disabled = true;
  const oldText = button.textContent;
  button.textContent = 'Suppression…';
  try {
    const response = await fetch(`/api/admin/players/${encodeURIComponent(accountId)}`, { method: 'DELETE' });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Suppression impossible.');
    await loadAdminPlayers();
    await loadLeaderboard();
  } catch (error) {
    window.alert(error.message || 'Suppression impossible.');
    button.disabled = false;
    button.textContent = oldText;
  }
});

async function deleteDesktopAdminAccount(button){
  if(!desktopAdminAuthorized || button.disabled)return;
  const accountId=button.getAttribute('data-delete-account');
  const username=button.getAttribute('data-delete-username')||'ce joueur';
  const old=button.textContent;button.disabled=true;
  try{
    if(!await showAdminActionConfirmation({username,actionText:'Supprimer le compte et sa progression',question:`Supprimer le compte de ${username} ? Ses Lovys, badges, XP, LoVeR’Cash et temps de visionnage seront effacés.`}))return;
    if(!await showAdminActionConfirmation({username,actionText:'Suppression définitive du compte',question:`Dernière confirmation : supprimer définitivement ${username} ? Cette action ne peut pas être annulée.`}))return;
    button.textContent='Suppression…';
    await adminFetch(`/api/admin/players/${encodeURIComponent(accountId)}`,{method:'DELETE'});
    showDesktopActionSuccess(`Compte de ${username} bien supprimé.`);
    if($('adminPlayerEditor')?.dataset.accountId===accountId)$('adminPlayerEditor')?.classList.add('hidden');
    await loadAdminPlayers();await loadLeaderboard();
  }catch(error){window.alert(error.message||'Suppression impossible.');}
  finally{button.disabled=false;button.textContent=old;if(button.isConnected)button.focus();}
}

$('adminPlayerEditor')?.addEventListener('click', async event=>{
  if(event.target.closest('[data-admin-close-editor]')){$('adminPlayerEditor')?.classList.add('hidden');return;}
  const button=event.target.closest('[data-admin-action]');if(button)await runAdminPlayerAction(button);
});

$('trackerTest')?.addEventListener('click', async () => {
  const button = $('trackerTest');
  if (!button) return;

  button.disabled = true;
  button.textContent = 'Test...';

  try {
    const response = await fetch('/api/tracker/run-now', { method: 'POST' });
    const data = await response.json();
    if (!response.ok || data.ok === false) {
      throw new Error(data.error || 'Test impossible');
    }
    await loadTrackerStatus();
  } catch (error) {
    $('trackerStatus').textContent = '⚠️ Test échoué';
    $('trackerDetail').textContent = error.message || 'Impossible de tester le tracker.';
  } finally {
    button.textContent = 'Tester maintenant';
    button.disabled = false;
  }
});


function showDiscordCallbackMessage() {
  const params = new URLSearchParams(window.location.search);
  const status = params.get('discord');
  if (!status) return;

  let message = '';
  if (status === 'verified') message = '✅ Discord vérifié : mission Membre de la communauté débloquée !';
  if (status === 'not-member') message = '⚠️ Discord connecté, mais tu n’es pas encore détecté comme membre du serveur.';
  if (status === 'error') message = '⚠️ Impossible de vérifier Discord pour le moment.';

  if (message) setTimeout(() => alert(message), 150);
  params.delete('discord');
  const query = params.toString();
  history.replaceState(null, '', window.location.pathname + (query ? '?' + query : '') + window.location.hash);
}

showDiscordCallbackMessage();

async function openAccountModal() {
  // Sur PC, tous les accès au compte ouvrent la destination de navigation.
  if (isDesktopGameUi() && document.body.dataset.desktopView !== 'account') {
    if (location.hash === '#compte') return openDesktopView('account');
    location.hash = '#compte';
    return;
  }
  syncAccountPagePlacement();
  const modal = $('accountModal');
  const usernameValue = $('accountUsername');
  const usernameInput = $('accountUsernameInput');
  const usernameButton = $('accountUsernameSave');
  const usernameMessage = $('accountUsernameMessage');

  if (!modal || !usernameValue || !usernameInput || !usernameButton || !usernameMessage) return;

  modal.classList.remove('hidden');
  usernameValue.textContent = 'Chargement...';
  usernameInput.value = '';
  usernameInput.disabled = true;
  usernameButton.disabled = true;
  usernameMessage.className = 'account-username-message';
  usernameMessage.textContent = '';
  $('accountEmail').textContent = 'Chargement...';
  $('accountTwitch').textContent = 'Chargement...';
  if ($('accountDiscord')) $('accountDiscord').textContent = 'Chargement...';

  try {
    const response = await fetch('/api/account/me', { cache: 'no-store' });
    const data = await response.json();

    if (!response.ok || !data.authenticated) {
      throw new Error(data.error || 'Compte introuvable');
    }

    const username = data.account.username || '—';
    usernameValue.textContent = username;
    usernameInput.value = data.account.username || '';
    usernameInput.disabled = false;
    usernameButton.disabled = false;
    $('accountEmail').textContent = data.account.email || '—';
    $('accountTwitch').textContent = data.account.twitchConnected
      ? (me?.user?.login ? `Connecté · ${me.user.login}` : 'Connecté')
      : 'Non connecté';

    const twitchConnect = $('accountTwitchConnect');
    const twitchHelp = $('accountTwitchHelp');
    if (twitchConnect && twitchHelp) {
      if (data.account.twitchConnected) {
        twitchConnect.textContent = '↻ Reconnecter Twitch';
        twitchHelp.textContent = 'Actualise ta photo, ton pseudo Twitch et tes autorisations sans perdre ta progression.';
      } else {
        twitchConnect.textContent = 'Connecter Twitch';
        twitchHelp.textContent = 'Lie ton compte Twitch pour activer le suivi de présence et ton profil Twitch.';
      }
    }

    const discordStatus = $('accountDiscord');
    const discordHelp = $('accountDiscordHelp');
    const discordConnect = $('accountDiscordConnect');
    if (discordStatus && discordHelp && discordConnect) {
      discordStatus.classList.remove('discord-status-ok', 'discord-status-warn');
      if (data.account.discordMemberVerified) {
        discordStatus.textContent = data.account.discordUsername
          ? `✅ Discord lié · ${data.account.discordUsername}`
          : '✅ Discord lié';
        discordStatus.classList.add('discord-status-ok');
        discordHelp.textContent = 'Ton compte Discord reste lié à ton compte LoVeR Watch Game.';
        discordConnect.textContent = 'Discord connecté';
        discordConnect.style.display = 'none';
      } else if (data.account.discordConnected) {
        discordConnect.style.display = '';
        discordStatus.textContent = data.account.discordUsername
          ? `⚠️ Discord lié · ${data.account.discordUsername}`
          : '⚠️ Discord lié';
        discordStatus.classList.add('discord-status-warn');
        discordHelp.textContent = 'Le serveur n’a pas encore été détecté. Rejoins-le puis lance une nouvelle vérification.';
        discordConnect.textContent = 'Vérifier le serveur';
      } else {
        discordConnect.style.display = '';
        discordStatus.textContent = 'Non connecté';
        discordHelp.textContent = 'Connecte Discord une seule fois pour le lier à ton compte LoVeR Watch Game.';
        discordConnect.textContent = 'Connecter Discord';
      }
    }

    setDesktopAdminAccess(Boolean(data.account.isBroadcaster));
    const trackerSection = $('trackerAdminSection');
    if (trackerSection) {
      trackerSection.classList.toggle('hidden', !data.account.isBroadcaster);
      if (data.account.isBroadcaster) {
        await loadTrackerStatus();
      }
    }
  } catch (error) {
    console.error('Erreur chargement compte :', error);
    usernameValue.textContent = '—';
    usernameInput.value = '';
    usernameInput.disabled = true;
    usernameButton.disabled = true;
    usernameMessage.textContent = 'Impossible de charger le compte.';
    usernameMessage.classList.add('error');
    $('accountEmail').textContent = '—';
    $('accountTwitch').textContent = '—';
    if ($('accountDiscord')) $('accountDiscord').textContent = '—';
  }
}

async function saveAccountUsername() {
  const input = $('accountUsernameInput');
  const button = $('accountUsernameSave');
  const message = $('accountUsernameMessage');
  if (!input || !button || !message) return;
  if (isDesktopGameUi() && button.disabled) return;

  const username = input.value.trim();
  message.className = 'account-username-message';
  message.textContent = '';

  if (username.length < 3 || username.length > 24) {
    message.textContent = 'Le pseudo doit contenir entre 3 et 24 caractères.';
    message.classList.add('error');
    return;
  }

  button.disabled = true;
  button.textContent = '...';

  try {
    if (isDesktopGameUi()) {
      const currentName = $('accountUsername')?.textContent || 'mon compte';
      const approved = await showAdminActionConfirmation({
        username: currentName,
        actionText: `Changer le pseudo en ${username}`,
        question: `Changer le pseudo de ${currentName} en ${username} ?`
      });
      if (!approved) return;
    }
    const response = await fetch('/api/account/username', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username })
    });
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Impossible de modifier le pseudo.');
    }

    $('accountUsername').textContent = data.username;
    input.value = data.username;
    message.textContent = '✓ Pseudo modifié avec succès.';
    message.classList.add('success');

    showDesktopActionSuccess(`Ton pseudo a bien été changé en ${data.username}.`);

    if (me?.user) {
      // Garde toutes les zones du site synchronisées avec le nouveau pseudo.
      me.user.display_name = data.username;
      me.user.game_username = data.username;
      renderPlayerVisitCard();
    }

    await loadLeaderboard();
  } catch (error) {
    message.textContent = error.message || 'Impossible de modifier le pseudo.';
    message.classList.add('error');
  } finally {
    button.disabled = false;
    button.textContent = 'Modifier';
    if (isDesktopGameUi() && button.isConnected) button.focus();
  }
}

$('accountUsernameSave')?.addEventListener('click', saveAccountUsername);
$('accountUsernameInput')?.addEventListener('keydown', event => {
  if (event.key === 'Enter') {
    event.preventDefault();
    saveAccountUsername();
  }
});

function closeAccountModal() {
  $('accountModal')?.classList.add('hidden');
}

$('accountButton')?.addEventListener('click', openAccountModal);
$('accountClose')?.addEventListener('click',()=>{if(isDesktopGameUi()){location.hash='#accueil';}else closeAccountModal();});

let accountBackdropMouseDown = false;
$('accountModal')?.addEventListener('mousedown', event => {
  accountBackdropMouseDown = event.target.id === 'accountModal';
});
$('accountModal')?.addEventListener('mouseup', event => {
  if (!isDesktopGameUi() && accountBackdropMouseDown && event.target.id === 'accountModal') {
    closeAccountModal();
  }
  accountBackdropMouseDown = false;
});
$('accountModal')?.addEventListener('mouseleave', () => {
  accountBackdropMouseDown = false;
});
$('accountLogout')?.addEventListener('click', async () => {
  await fetch('/api/account/logout', { method: 'POST' });
  location.reload();
});

let pendingAccountAction = null;

function openAccountConfirmation({ title, message, buttonText, mode }) {
  pendingAccountAction = mode;
  $('confirmAccountTitle').textContent = title;
  $('confirmAccountMessage').textContent = message;
  $('confirmAccountAction').textContent = buttonText;
  $('confirmAccountAction').className = mode === 'reset' ? 'btn warning' : 'btn danger';
  $('confirmAccountIcon').textContent = mode === 'reset' ? '↻' : '⚠️';
  $('confirmAccountError').style.display = 'none';
  $('confirmAccountError').textContent = '';
  $('confirmAccountModal').classList.remove('hidden');
}

function closeAccountConfirmation() {
  pendingAccountAction = null;
  $('confirmAccountModal')?.classList.add('hidden');
}

$('resetGameButton')?.addEventListener('click', () => {
  openAccountConfirmation({
    title: 'Réinitialiser le jeu ?',
    message: "Ton compte et ton lien Twitch seront conservés. Ton monstre, ton œuf, ton XP, ton LoVeR'Cash et ton temps de jeu seront remis à zéro. Cette action est définitive.",
    buttonText: 'Oui, réinitialiser',
    mode: 'reset'
  });
});

$('deleteAccountButton')?.addEventListener('click', () => {
  openAccountConfirmation({
    title: 'Supprimer définitivement le compte ?',
    message: "Ton compte LoVeR Watch Game, ton lien Twitch, ton monstre, ton XP, ton LoVeR'Cash et ton temps de jeu seront supprimés définitivement. Cette action est irréversible.",
    buttonText: 'Supprimer définitivement',
    mode: 'delete'
  });
});

$('confirmAccountCancel')?.addEventListener('click', closeAccountConfirmation);
$('confirmAccountModal')?.addEventListener('click', event => {
  if (event.target.id === 'confirmAccountModal') closeAccountConfirmation();
});

$('confirmAccountAction')?.addEventListener('click', async () => {
  if (!pendingAccountAction) return;

  const action = pendingAccountAction;
  const button = $('confirmAccountAction');
  const errorBox = $('confirmAccountError');

  button.disabled = true;
  const oldText = button.textContent;
  button.textContent = 'Traitement...';
  errorBox.style.display = 'none';

  try {
    const response = await fetch(
      action === 'reset' ? '/api/account/reset-game' : '/api/account',
      { method: action === 'reset' ? 'POST' : 'DELETE' }
    );

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Action impossible.');
    }

    closeAccountConfirmation();
    closeAccountModal();

    if (action === 'delete') {
      location.href = '/';
      return;
    }

    location.reload();
  } catch (error) {
    console.error('Erreur action compte :', error);
    errorBox.textContent = error.message || 'Action impossible.';
    errorBox.style.display = 'block';
  } finally {
    button.disabled = false;
    button.textContent = oldText;
  }
});

$('logout')?.addEventListener('click', async () => {
  await fetch('/api/account/logout', { method: 'POST' });
  location.reload();
});

$('subBenefitsClose')?.addEventListener('click', () => $('subBenefitsModal')?.classList.add('hidden'));
let subBenefitsBackdropMouseDown = false;
$('subBenefitsModal')?.addEventListener('mousedown', event => { subBenefitsBackdropMouseDown = event.target.id === 'subBenefitsModal'; });
$('subBenefitsModal')?.addEventListener('mouseup', event => {
  if (subBenefitsBackdropMouseDown && event.target.id === 'subBenefitsModal') $('subBenefitsModal')?.classList.add('hidden');
  subBenefitsBackdropMouseDown = false;
});


/* =========================================
   V109 — NAVIGATION PC + LOBBY / ÉCHANGES
   La version mobile conserve son agencement actuel.
========================================= */

/* V240 — restauration du contrôleur d'en-tête partagé V229 */
const STANDARD_PAGE_HEADER_DATA={
 lovys:['🐉 Mes Lovys','Gère ta collection, tes fragments de doublons et les rangs ⭐ de tes Lovys.'],
 incubator:['🥚 Incubateur',"Tes emplacements d’incubation."],
 lobby:['🤝 Communauté',"La place centrale pour proposer, trouver et sécuriser tes échanges de fragments et d'œufs."],
 leaderboard:['🏆 Classement','Compare ta progression avec les autres joueurs.'],
 progression:['📈 Ma progression','Suis ton niveau global, Prestige et progression du Lovys.'],
 shop:['🛒 Boutique',"Personnalise ton profil et utilise ton LoVeR’Cash."]
};
function updateStandardPageHeader(view){
 const el=document.getElementById('standardPageHeader'),t=document.getElementById('standardPageHeaderTitle'),s=document.getElementById('standardPageHeaderSubtitle');
 if(!el||!t||!s)return;
 const d=STANDARD_PAGE_HEADER_DATA[view],show=!!d&&view!=='pve';
 el.classList.toggle('is-visible',show);el.setAttribute('aria-hidden',show?'false':'true');
 if(show){t.textContent=d[0];s.textContent=d[1]||'';s.hidden=!d[1];}
}
let desktopView='home';
let lobbyTab='trades';
let lobbyAutoRefreshTimer=null;
let tradeCreatureFilter='all';
let lobbyPlayers=[];
let playerCollectionData=null,playerTradeInventory=null,playerCollectionGeneration=0,playerTradeBusy=false;
let playerTradeOffers=[],playerTradeSelfId=0,pendingPlayerTradePayload=null;
let tradeOffers=[];
let myTradeOffers=[];
let tradeInventory={eggs:0,lovys:[]};
let tradeFilter='all';
let tradeOptionCount=1;

function isDesktopGameUi(){return window.matchMedia('(min-width:901px)').matches;}
function setDesktopNavActive(view){document.querySelectorAll('.desktop-game-nav-btn').forEach(btn=>btn.classList.toggle('active',btn.dataset.desktopView===view));}
function closeDesktopPrimaryPages(except=''){
  if(except!=='shop')$('inventoryModal')?.classList.add('hidden');
  if(except!=='account')$('accountModal')?.classList.add('hidden');
  if(except!=='admin')closeDesktopAdmin();
  if(except!=='lovys')$('lovysCollectionModal')?.classList.add('hidden');
  if(except!=='pve'){$('pveModal')?.classList.add('hidden');$('pveModal')?.classList.remove('desktop-battle-mode');}
  if(except!=='progression')$('progressionModal')?.classList.add('hidden');
  if(except!=='shop')$('shopModal')?.classList.add('hidden');
  if(except!=='lobby')$('desktopLobbyPage')?.classList.add('hidden');
  if(except!=='leaderboard')document.body.classList.remove('desktop-leaderboard-open');
}
const desktopProfilePageOrigins = new Map();
function syncAccountPagePlacement() {
  syncDesktopAdminPageLayout();
  const header = $('standardPageHeader');
  if (!header) return;
  let previous = header;
  for (const id of ['accountModal', 'desktopAdminModal']) {
    const page = $(id);
    if (!page) continue;
    if (!desktopProfilePageOrigins.has(id)) {
      const origin = document.createComment(id + '-mobile-origin');
      page.parentNode.insertBefore(origin, page);
      desktopProfilePageOrigins.set(id, origin);
    }
    if (isDesktopGameUi()) {
      previous.after(page);
      previous = page;
      page.setAttribute('role', 'region');
      page.removeAttribute('aria-modal');
    } else {
      const origin = desktopProfilePageOrigins.get(id);
      origin.parentNode.insertBefore(page, origin.nextSibling);
      page.setAttribute('role', 'dialog');
      page.setAttribute('aria-modal', 'true');
    }
  }
}
let desktopLeaderboardPlaceholder=null;
function syncDesktopLeaderboardPlacement(){
  const board=document.querySelector('.global-leaderboard');
  const app=$('app');
  if(!board||!app)return;
  if(isDesktopGameUi()){
    if(!desktopLeaderboardPlaceholder){
      desktopLeaderboardPlaceholder=document.createComment('leaderboard-mobile-origin');
      board.parentNode?.insertBefore(desktopLeaderboardPlaceholder,board);
    }
    if(board.parentElement!==app)app.appendChild(board);
  }else if(desktopLeaderboardPlaceholder?.parentNode){
    desktopLeaderboardPlaceholder.parentNode.insertBefore(board,desktopLeaderboardPlaceholder.nextSibling);
  }
}
async function openDesktopView(view='home'){
  if(!isDesktopGameUi())return;
  if(view==='inventory') return openInventory();
  if(view!=='lobby' && !$('communityGuideModal')?.classList.contains('hidden'))closeCommunityGuide();
  syncDesktopLeaderboardPlacement();
  syncInventoryPagePlacement();
  syncAccountPagePlacement();
  desktopView=view;setDesktopNavActive(view);
  $('desktopAccountButton')?.toggleAttribute('aria-current', view === 'account');
  $('desktopAdminButton')?.toggleAttribute('aria-current', view === 'admin');
  document.body.dataset.desktopView=view;
  updateStandardPageHeader(view);
  closeDesktopPrimaryPages(view);
  const leaderboardBoard=document.querySelector('.global-leaderboard');
  if(view!=='leaderboard'){
    leaderboardBoard?.style.setProperty('display','none','important');
    document.body.classList.remove('leaderboard-search-active');
    const leaderboardSearch=$('leaderboardSearch');
    if(leaderboardSearch) leaderboardSearch.value='';
  }else{
    leaderboardBoard?.style.removeProperty('display');
  }
  window.scrollTo({top:0,behavior:'auto'});
  if(view==='home'||view==='incubator')return;
  if(view==='account'){await openAccountModal();return;}
  if(view==='admin'){await openDesktopAdmin();return;}
  if(view==='lovys'){await openLovysCollection('collection');return;}
  if(view==='pve'){$('pveModal')?.classList.remove('hidden');await loadPve();return;}
  if(view==='progression'){$('progressionModal')?.classList.remove('hidden');await loadProgression();return;}
  if(view==='shop'){await openShop();return;}
  if(view==='leaderboard'){document.body.classList.add('desktop-leaderboard-open');await loadLeaderboard();return;}
  if(view==='lobby'){$('desktopLobbyPage')?.classList.remove('hidden');await openLobbyTab(lobbyTab);if(desktopView==='lobby' && shouldShowCommunityIntro)openCommunityGuide();}
}

const desktopViewHashes={home:'accueil',lovys:'lovys',incubator:'incubateur',pve:'pve',lobby:'lobby',leaderboard:'classement',progression:'progression',shop:'boutique',inventory:'inventaire',account:'compte',admin:'administration'};
const desktopHashViews=Object.fromEntries(Object.entries(desktopViewHashes).map(([view,hash])=>[hash,view]));
function desktopViewFromHash(){return desktopHashViews[String(location.hash||'').replace(/^#/,'').toLowerCase()]||'home';}
function syncDesktopViewFromUrl(){if(isDesktopGameUi())openDesktopView(desktopViewFromHash());}
// V164 — Un rechargement/F5 repart toujours sur l’Accueil sur PC.
if(isDesktopGameUi() && location.hash!=='#accueil'){history.replaceState(null,'',location.pathname+location.search+'#accueil');}
document.querySelectorAll('[data-desktop-view]').forEach(link=>link.addEventListener('click',event=>{
  if(!isDesktopGameUi())return;
  event.preventDefault();
  const view=link.dataset.desktopView||'home';
  const nextHash='#'+(desktopViewHashes[view]||'accueil');
  if(location.hash===nextHash)openDesktopView(view);
  else location.hash=nextHash;
}));
window.addEventListener('hashchange',syncDesktopViewFromUrl);
window.addEventListener('resize',()=>{syncAccountPagePlacement();syncDesktopLeaderboardPlacement();if(isDesktopGameUi())syncDesktopViewFromUrl();});
if(isDesktopGameUi()){syncDesktopLeaderboardPlacement();syncDesktopViewFromUrl();}

function lobbyRelativeSeen(value){if(!value)return 'Hors ligne';const sec=Math.max(0,Math.floor((Date.now()-new Date(value).getTime())/1000));if(sec<120)return 'Vu à l’instant';if(sec<3600)return `Vu il y a ${Math.floor(sec/60)} min`;if(sec<86400)return `Vu il y a ${Math.floor(sec/3600)} h`;return `Vu il y a ${Math.floor(sec/86400)} j`;}
function lobbyPlayerMarkup(player){
  const active=player.lovys;const avatar=player.profileImageUrl?`<img loading="lazy" decoding="async" src="${escapeHtml(player.profileImageUrl)}" alt="">`:'👤';
  const status=player.present?'🟢 En ligne':`⚪ ${lobbyRelativeSeen(player.lastSeenAt)}`;const offers=Number(player.activeOffers||0);
  return `<article class="lobby-player-card ${player.present?'present':''}" data-lobby-user="${Number(player.userId)}" ${isDesktopGameUi()?'tabindex="0" role="button" aria-label="Voir la collection de '+escapeHtml(player.username)+'"':''}><div class="lobby-player-avatar">${avatar}<span class="lobby-presence-dot"></span></div><div class="lobby-player-copy"><div class="lobby-player-name">${escapeHtml(player.username)}</div><div class="lobby-player-meta">${status} · Niveau ${Number(player.level||1)}${Number(player.prestige||0)>0?` · Prestige ${Number(player.prestige)}`:''}</div>${active?`<div class="lobby-player-lovys">🐉 ${escapeHtml(active.name)} · Niv. ${Number(active.level||1)} · ${'⭐'.repeat(Math.max(1,Number(active.rank||1)))}</div>`:'<div class="lobby-player-lovys muted">Aucun Lovys actif</div>'}${offers?`<div class="lobby-player-offers">🔄 ${offers} offre${offers>1?'s':''} active${offers>1?'s':''}</div>`:''}</div><div class="lobby-player-actions">${isDesktopGameUi()?'<span class="player-collection-link">Voir la collection →</span>':`<button class="lobby-secondary-btn" type="button" data-lobby-profile="${escapeHtml(player.twitchId||'')}">Voir le profil</button><button class="lobby-primary-btn" type="button" data-lobby-trade-user="${Number(player.userId)}">Échanger</button>`}</div></article>`;
}
async function loadLobbyPlayers(){
  const grid=$('lobbyPlayersGrid');if(grid)grid.innerHTML='<div class="lobby-empty">Chargement du lobby…</div>';
  try{const r=await fetch('/api/lobby',{cache:'no-store'}),d=await r.json();if(!r.ok)throw new Error(d.error||'Impossible de charger le lobby.');lobbyPlayers=(d.players||[]).sort((x,y)=>Number(y.present)-Number(x.present)||Number(y.activeOffers||0)-Number(x.activeOffers||0)||String(x.username).localeCompare(String(y.username),'fr'));renderLobbyPlayers();const summary=$('lobbyPresenceSummary');if(summary){if(d.live){summary.classList.remove('hidden');summary.innerHTML=`🔴 En live · ${Number(d.presentCount||0)} joueur${Number(d.presentCount||0)>1?'s':''} connecté${Number(d.presentCount||0)>1?'s':''} <a href="https://www.twitch.tv/loverdosetv" target="_blank" rel="noopener">Voir Twitch</a>`;}else if(d.lastLiveLabel){summary.classList.remove('hidden');summary.textContent=`⚪ Dernier live : ${d.lastLiveLabel}`;}else{summary.classList.add('hidden');summary.textContent='';}}}catch(error){if(grid)grid.innerHTML=`<div class="lobby-empty">${escapeHtml(error.message)}</div>`;}
}
function renderLobbyPlayers(){const grid=$('lobbyPlayersGrid');if(!grid)return;const q=String($('lobbyPlayerSearch')?.value||'').trim().toLowerCase();const rows=lobbyPlayers.filter(p=>!q||String(p.username||'').toLowerCase().includes(q));grid.innerHTML=rows.length?rows.map(lobbyPlayerMarkup).join(''):'<div class="lobby-empty">Aucun joueur trouvé.</div>';}

function tradeLovysById(id){return (tradeInventory.lovys||[]).find(l=>l.creatureId===id);}
function tradeCanReceive(asset){return asset.type!=='fragment'||Boolean(tradeLovysById(asset.creatureId));}
function tradeBalanceFor(asset){if(asset.type==='egg')return Number(tradeInventory.eggs||0);return Number(tradeLovysById(asset.creatureId)?.fragments||0);}
function tradeCanAcceptOption(offer,option){return Number(offer.creatorUserId)!==Number((tradeOffers._selfUserId||0))&&tradeCanReceive(offer.offer)&&tradeBalanceFor(option)>=Number(option.quantity||0);}
function tradeAssetMarkup(asset){const art=asset.type==='fragment'&&asset.image?`<img src="${escapeHtml(asset.image)}" alt="">`:(asset.type==='egg'?'🥚':'🧩');return `<span class="trade-asset-icon">${art}</span><span><strong>${escapeHtml(asset.name||'Objet')}</strong><small>× ${Number(asset.quantity||0)}${asset.rarity?` · ${escapeHtml(asset.rarity)}`:''}</small></span>`;}
function tradeStatusLabel(status){return {open:'Active',completed:'Acceptée',cancelled:'Annulée',expired:'Expirée'}[status]||status;}
function formatTradeRemaining(value){const ms=new Date(value).getTime()-Date.now();if(ms<=0)return 'expirée';const m=Math.ceil(ms/60000);if(m<60)return `expire dans ${m} min`;const h=Math.ceil(m/60);if(h<48)return `expire dans ${h} h`;return `expire dans ${Math.ceil(h/24)} j`;}
function tradeOfferMarkup(offer,mine=false){
  const options=(offer.options||[]).map(option=>{const possible=tradeCanAcceptOption(offer,option);return `<div class="trade-option ${possible?'possible':''}">${tradeAssetMarkup(option)}${!mine&&offer.status==='open'?`<button type="button" data-trade-accept="${Number(offer.id)}" data-trade-option="${Number(option.id)}" ${possible?'':'disabled'}>${possible?'Accepter':'Indisponible'}</button>`:''}</div>`;}).join('');
  const accepted=offer.status==='completed'?`<div class="trade-completed-note">✓ Échange terminé${offer.acceptedByName?` avec ${escapeHtml(offer.acceptedByName)}`:''}</div>`:'';
  return `<article class="trade-offer-card status-${escapeHtml(offer.status)}"><div class="trade-offer-head"><div class="trade-owner"><span>${offer.creatorAvatar?`<img loading="lazy" decoding="async" src="${escapeHtml(offer.creatorAvatar)}" alt="">`:'👤'}</span><div><strong>${escapeHtml(offer.creatorName)}</strong><small>${tradeStatusLabel(offer.status)} · ${offer.status==='open'?formatTradeRemaining(offer.expiresAt):formatTradeDate(offer.acceptedAt||offer.expiresAt)}</small></div></div>${mine&&offer.status==='open'?`<button class="trade-cancel-btn" type="button" data-trade-cancel="${Number(offer.id)}">Annuler</button>`:''}</div><div class="trade-exchange-side trade-exchange-give"><div class="trade-label">TU PROPOSES</div><div class="trade-give">${tradeAssetMarkup(offer.offer)}</div></div><div class="trade-exchange-side trade-exchange-want"><div class="trade-label">CONTRE</div><div class="trade-options">${options}</div></div>${accepted}</article>`;
}
function formatTradeDate(value){try{return new Intl.DateTimeFormat('fr-FR',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}).format(new Date(value));}catch{return '—';}}
async function loadTradeInventory(){const r=await fetch('/api/trades/inventory',{cache:'no-store'}),d=await r.json();if(!r.ok)throw new Error(d.error||"Impossible de charger l'inventaire.");tradeInventory=d;return d;}
function syncLobbyTabCounts(){const open=(tradeOffers||[]).filter(o=>o.status==='open').length,mine=(myTradeOffers||[]).filter(o=>o.status==='open').length;const a=document.querySelector('[data-lobby-tab="trades"]'),b=document.querySelector('[data-lobby-tab="mine"]');if(a)a.innerHTML=`🔄 Échanges${open?` <b>${open}</b>`:''}`;if(b)b.innerHTML=`📜 Mes offres${mine?` <b>${mine}</b>`:''}`;const lim=$('tradeActiveLimit');if(lim)lim.textContent=`Offres actives : ${mine} / 3`;}
async function loadTrades(mine=false){
  const grid=$(mine?'lobbyMineGrid':'lobbyTradesGrid');if(grid)grid.innerHTML='<div class="lobby-empty">Chargement des offres…</div>';
  try{await loadTradeInventory();const r=await fetch(`/api/trades${mine?'?mine=1':''}`,{cache:'no-store'}),d=await r.json();if(!r.ok)throw new Error(d.error||'Impossible de charger les offres.');if(mine)myTradeOffers=d.offers||[];else{tradeOffers=d.offers||[];tradeOffers._selfUserId=d.selfUserId;}renderTrades(mine);syncLobbyTabCounts();}catch(error){if(grid)grid.innerHTML=`<div class="lobby-empty">${escapeHtml(error.message)}</div>`;}
}
function renderTrades(mine=false){
  const grid=$(mine?'lobbyMineGrid':'lobbyTradesGrid');if(!grid)return;let offers=mine?myTradeOffers:tradeOffers;
  if(!mine){const select=$('lobbyTradeCreatureFilter');if(select){const available=[...new Map((tradeOffers||[]).filter(o=>o.offer?.creatureId).map(o=>[o.offer.creatureId,String(o.offer.name||'').replace(/^Fragments\s+/,'')])).entries()].sort((a,b)=>a[1].localeCompare(b[1],'fr'));const keep=tradeCreatureFilter;select.innerHTML='<option value="all">Tous les Lovys</option>'+available.map(([id,name])=>`<option value="${escapeHtml(id)}">${escapeHtml(name)}</option>`).join('');select.value=available.some(x=>x[0]===keep)?keep:'all';if(select.value==='all')tradeCreatureFilter='all';}offers=offers.filter(o=>(tradeFilter==='all'||(tradeFilter==='possible'&&(o.options||[]).some(opt=>tradeCanAcceptOption(o,opt)))||o.offer.type===tradeFilter)&&(tradeCreatureFilter==='all'||o.offer.creatureId===tradeCreatureFilter));}
  grid.innerHTML=offers.length?offers.map(o=>tradeOfferMarkup(o,mine)).join(''):`<div class="lobby-empty lobby-empty-action"><strong>${mine?'Aucune offre publiée':'Aucune offre pour l’instant'}</strong><span>${mine?'Crée ta première annonce pour commencer à échanger.':'Sois le premier à faire vivre la bourse.'}</span><button class="lobby-primary-btn" type="button" data-empty-create>＋ Créer la première offre</button></div>`;
}
async function openLobbyTab(tab='trades'){
  lobbyTab=['players','trades','mine','history','wishes'].includes(tab)?tab:'trades';document.querySelectorAll('.lobby-tab').forEach(btn=>btn.classList.toggle('active',btn.dataset.lobbyTab===lobbyTab));
  ['Players','Trades','Mine','History','Wishes'].forEach(n=>$(`lobby${n}Panel`)?.classList.toggle('hidden',lobbyTab!==n.toLowerCase()));
  if(lobbyTab==='players'){await loadLobbyPlayers();if(isDesktopGameUi())await loadPlayerTradeInbox();}else if(lobbyTab==='history')await loadTradeHistory();else if(lobbyTab==='wishes')await loadTradeWishes();else await loadTrades(lobbyTab==='mine');
  refreshLobbyCounts();if(lobbyTab==='trades')loadLobbyActivity();markLobbyNotificationsRead();checkTradeExpiryNotices();
}
let tradeExpiryChecking=false,tradeExpiryClosing=false,tradeExpiryItems=[];
function communityIsVisible(){return isDesktopGameUi()?desktopView==='lobby':document.body.classList.contains('mobile-community-open');}
async function checkTradeExpiryNotices(){
  const modal=$('tradeExpiryNotice');
  if(!modal||!modal.classList.contains('hidden')||!communityIsVisible()||tradeExpiryChecking||tradeExpiryClosing||!$('tradeComposer')?.classList.contains('hidden'))return;
  tradeExpiryChecking=true;
  try{
    const response=await fetch('/api/trades/expiry-notices',{cache:'no-store'}),data=await response.json();
    if(!response.ok||!communityIsVisible()||!data.items?.length)return;
    tradeExpiryItems=data.items;
    const count=tradeExpiryItems.length;
    $('tradeExpiryNoticeTitle').textContent=count===1?'Aucun joueur n’a accepté ton échange :(':'Aucun joueur n’a accepté tes échanges :(';
    $('tradeExpiryNoticeCount').textContent=count===1?`Ton offre #${tradeExpiryItems[0].offerId} a expiré.`:`${count} offres ont expiré : ${tradeExpiryItems.map(item=>`#${item.offerId}`).join(', ')}.`;
    $('tradeExpiryNoticeError').textContent='';modal.classList.remove('hidden');$('tradeExpiryDismiss').focus();
  }catch(error){console.warn('Avis d’expiration indisponibles :',error);}
  finally{tradeExpiryChecking=false;}
}
async function dismissTradeExpiryNotice(createNew=false){
  if(tradeExpiryClosing||!tradeExpiryItems.length)return;
  tradeExpiryClosing=true;
  const actions=[$('tradeExpiryDismiss'),$('tradeExpiryCreate')];actions.forEach(button=>button.disabled=true);
  try{
    const response=await fetch('/api/trades/expiry-notices/seen',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({ids:tradeExpiryItems.map(item=>item.id)})}),data=await response.json();
    if(!response.ok)throw new Error(data.error||'Impossible de confirmer le message.');
    tradeExpiryItems=[];$('tradeExpiryNotice').classList.add('hidden');
    if(createNew)await openTradeComposer();
  }catch(error){$('tradeExpiryNoticeError').textContent=error.message||'Réessaie dans un instant.';}
  finally{actions.forEach(button=>button.disabled=false);tradeExpiryClosing=false;}
}
$('tradeExpiryDismiss')?.addEventListener('click',()=>dismissTradeExpiryNotice());
$('tradeExpiryCreate')?.addEventListener('click',()=>dismissTradeExpiryNotice(true));
document.addEventListener('keydown',event=>{if(event.key==='Escape'&&!$('tradeExpiryNotice')?.classList.contains('hidden')){event.preventDefault();dismissTradeExpiryNotice();}});
async function refreshLobbyCounts(){try{const [x,y]=await Promise.all([fetch('/api/trades',{cache:'no-store'}).then(r=>r.json()),fetch('/api/trades?mine=1',{cache:'no-store'}).then(r=>r.json())]);if(x.offers){tradeOffers=x.offers;tradeOffers._selfUserId=x.selfUserId;}if(y.offers)myTradeOffers=y.offers;syncLobbyTabCounts();}catch{}}
async function loadTradeHistory(){const box=$('lobbyHistoryGrid');if(!box)return;box.innerHTML='<div class="lobby-empty">Chargement…</div>';try{const r=await fetch('/api/trades/history',{cache:'no-store'}),d=await r.json();if(!r.ok)throw new Error(d.error||'Historique indisponible.');box.innerHTML=(d.offers||[]).length?d.offers.map(o=>tradeOfferMarkup(o,true)).join(''):'<div class="lobby-empty">Aucun échange terminé pour le moment.</div>';}catch(e){box.innerHTML=`<div class="lobby-empty">${escapeHtml(e.message)}</div>`;}}
async function loadTradeWishes(){const box=$('lobbyWishesGrid');if(!box)return;box.innerHTML='<div class="lobby-empty">Chargement…</div>';try{await loadTradeInventory();const r=await fetch('/api/trades/wishes',{cache:'no-store'}),d=await r.json();if(!r.ok)throw new Error(d.error||'Souhaits indisponibles.');const mine=new Set(d.mine||[]),catalog=tradeInventory.catalog||[],owned=new Map((tradeInventory.lovys||[]).map(l=>[l.creatureId,l]));const cards=catalog.map(c=>{const o=owned.get(c.creatureId),wanted=mine.has(c.creatureId);return `<button class="wishlist-card ${wanted?'wanted':''}" type="button" data-wish-toggle="${escapeHtml(c.creatureId)}" aria-pressed="${wanted}"><img src="${escapeHtml(tradeCreatureImageUrl(c))}" alt=""><span><strong>${escapeHtml(c.name)}</strong><small>${escapeHtml(c.rarity||'')}</small></span><b>${wanted?'♥':'♡'}</b></button>`;}).join('');const doubles=[...owned.values()].filter(l=>Number(l.fragments||0)>0);const summaries=(d.summary||[]).map(x=>`<div><strong>${escapeHtml(x.name)}</strong><span>${Number(x.wishCount||0)} joueur${Number(x.wishCount||0)>1?'s':''} cherche${Number(x.wishCount||0)>1?'nt':''} · ${Number(x.offerCount||0)} offre${Number(x.offerCount||0)>1?'s':''}</span></div>`).join('');const matches=(d.matches||[]).filter(m=>Number(owned.get(m.creatureId)?.fragments||0)>0).slice(0,6).map(m=>`<div class="wishlist-match"><span>💞 <b>${escapeHtml(m.username)}</b> cherche ${escapeHtml(catalog.find(c=>c.creatureId===m.creatureId)?.name||m.creatureId)}</span><button class="lobby-primary-btn" type="button" data-wish-trade-user="${Number(m.userId)}" data-wish-trade-creature="${escapeHtml(m.creatureId)}">Échanger</button></div>`).join('');box.innerHTML=`<div class="wishlist-editor"><h3>💜 Mes fragments recherchés</h3><p>Ajoute un cœur aux Lovys que tu recherches. Tous les Lovys sont visibles, même ceux que tu n’as pas encore découverts.</p><div class="wishlist-grid">${cards}</div></div><div class="wishlist-editor wishlist-doubles"><h3>🧩 Mes doublons à proposer</h3><p>${doubles.length?'Ces fragments peuvent servir à créer rapidement une offre.':'Tu n’as aucun fragment en double disponible pour le moment.'}</p><div class="wishlist-double-grid">${doubles.map(l=>`<button type="button" data-wish-trade-creature="${escapeHtml(l.creatureId)}"><img src="${escapeHtml(tradeCreatureImageUrl(l))}" alt=""><span><strong>${escapeHtml(l.name)}</strong><small>${Number(l.fragments)} fragments · ${escapeHtml(l.rarity||'')}</small></span></button>`).join('')}</div></div>${matches?`<div class="wishlist-editor"><h3>✨ Correspondances</h3><div class="wishlist-matches">${matches}</div></div>`:''}<div class="wishlist-community">${summaries||'<div class="lobby-empty">Aucune demande communautaire pour le moment.</div>'}</div>`;}catch(e){box.innerHTML=`<div class="lobby-empty">${escapeHtml(e.message)}</div>`;}}
document.querySelectorAll('.lobby-tab').forEach(btn=>btn.addEventListener('click',()=>openLobbyTab(btn.dataset.lobbyTab)));
$('lobbyPlayerSearch')?.addEventListener('input',renderLobbyPlayers);
$('lobbyPlayersGrid')?.addEventListener('click',e=>{if(isDesktopGameUi()){const card=e.target.closest('[data-lobby-user]');if(card){openPlayerCollection(Number(card.dataset.lobbyUser));return;}}const trade=e.target.closest('[data-lobby-trade-user]');if(trade){openTradeComposer();return;}const btn=e.target.closest('[data-lobby-profile]');if(!btn)return;const p=lobbyPlayers.find(x=>String(x.twitchId||'')===String(btn.dataset.lobbyProfile||''));if(p)openLobbySideProfile(p);});
function openLobbySideProfile(p){if(isDesktopGameUi())return openPlayerCollection(Number(p.userId));const drawer=$('lobbyProfileDrawer'),body=$('lobbyProfileDrawerBody');if(!drawer||!body)return;body.innerHTML=lobbyPlayerMarkup(p);drawer.classList.remove('hidden');}
$('lobbyProfileDrawerClose')?.addEventListener('click',()=>$('lobbyProfileDrawer')?.classList.add('hidden'));
document.querySelectorAll('[data-trade-filter]').forEach(btn=>btn.addEventListener('click',()=>{tradeFilter=btn.dataset.tradeFilter||'all';document.querySelectorAll('[data-trade-filter]').forEach(b=>b.classList.toggle('active',b===btn));renderTrades(false);}));
$('lobbyTradeCreatureFilter')?.addEventListener('change',e=>{tradeCreatureFilter=e.target.value||'all';renderTrades(false);});
$('desktopLobbyPage')?.addEventListener('click',e=>{if(e.target.closest('[data-empty-create]'))openTradeComposer();});
$('lobbyWishesGrid')?.addEventListener('click',async e=>{const wish=e.target.closest('[data-wish-toggle]');if(wish){const wanted=wish.getAttribute('aria-pressed')!=='true';await fetch('/api/trades/wishes',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({creatureId:wish.dataset.wishToggle,wanted})});loadTradeWishes();return;}const trade=e.target.closest('[data-wish-trade-creature]');if(trade){await openTradeComposer(trade.dataset.wishTradeCreature||'');}});
async function loadLobbyActivity(){const box=$('lobbyActivityBox'),feed=$('lobbyActivityFeed');if(!box||!feed)return;try{const r=await fetch('/api/trades/activity',{cache:'no-store'}),d=await r.json();const items=d.items||[];if(!r.ok||!items.length){box.classList.add('hidden');feed.innerHTML='';return;}feed.innerHTML=items.slice(0,6).map(x=>`<div class="lobby-activity-item"><span>•</span><span>${escapeHtml(x.text)}</span><small>${formatTradeDate(x.at)}</small></div>`).join('');box.classList.remove('hidden');}catch{box.classList.add('hidden');}}
let lastLobbyUnread=0;async function refreshLobbyNotifications(){try{const r=await fetch('/api/trades/notifications',{cache:'no-store'}),d=await r.json();if(!r.ok)return;const n=Number(d.unread||0),badges=[$('lobbyNavBadge'),$('mobileLobbyNavBadge')].filter(Boolean);badges.forEach(badge=>{badge.textContent=String(n);badge.classList.toggle('hidden',n<=0);});if(n>lastLobbyUnread&&lastLobbyUnread>=0&&typeof Notification!=='undefined'&&Notification.permission==='granted'){const newest=(d.items||[]).find(x=>!x.read_at);if(newest&&newest.event_type!=='offer_expired')new Notification('LoVeR Watch Game · Communauté',{body:newest.message});}lastLobbyUnread=n;}catch{}}
async function markLobbyNotificationsRead(){try{await fetch('/api/trades/notifications/read',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});lastLobbyUnread=0;[$('lobbyNavBadge'),$('mobileLobbyNavBadge')].filter(Boolean).forEach(b=>b.classList.add('hidden'));}catch{}}
function startLobbyAutoRefresh(){clearInterval(lobbyAutoRefreshTimer);lobbyAutoRefreshTimer=setInterval(()=>{refreshLobbyNotifications();if(desktopView==='lobby'||document.body.classList.contains('mobile-community-open')){openLobbyTab(lobbyTab);if(lobbyTab==='trades')loadLobbyActivity();}},30000);}startLobbyAutoRefresh();refreshLobbyNotifications();

function tradeCreatureImageUrl(l){
  if(!l)return '';
  const normalize=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');
  const id=normalize(l.creatureId),name=normalize(l.name);
  const known=homeMonsters.find(m=>normalize(m.id)===id||normalize(m.name)===name);
  if(known?.image)return known.image;
  const aliases={mossy:'/Mossy.webp',plant:'/Mossy.webp',nymea:'/Nymea.webp',water:'/Nymea.webp',voltis:'/Voltis.webp',lightning:'/Voltis.webp',brumee:'/Brumee.webp',mist:'/Brumee.webp',flamby:'/Flamby.webp',fire:'/Flamby.webp',crysal:'/Crysal.webp',crystal:'/Crysal.webp',ferox:'/Ferox.webp',forge:'/Ferox.webp',nocty:'/Nocty.webp',dark:'/Nocty.webp',solka:'/Solka.webp',solar:'/Solka.webp',mimo:'/Mimo.webp',dream:'/Mimo.webp'};
  return aliases[id]||aliases[name]||String(l.image||'');
}
function tradeCreatureOptions(selected=''){return (tradeInventory.lovys||[]).map(l=>`<option value="${escapeHtml(l.creatureId)}" ${l.creatureId===selected?'selected':''}>${escapeHtml(l.name)} · ${escapeHtml(l.rarity||'')} · ${Number(l.fragments||0)} fragments</option>`).join('');}
function tradeCreatureMenuMarkup(){return `<div class="trade-creature-menu">${(tradeInventory.lovys||[]).map(l=>`<button type="button" data-trade-creature-choice="${escapeHtml(l.creatureId)}"><img src="${escapeHtml(tradeCreatureImageUrl(l))}" alt=""><span><strong>${escapeHtml(l.name)}</strong><small>${escapeHtml(l.rarity||'')} · ${Number(l.fragments||0)} fragments disponibles</small></span></button>`).join('')}</div>`;}

function tradeCreaturePreviewMarkup(creatureId,egg=false){if(egg)return `<span class="trade-preview-egg">🥚</span><span><strong>Œuf mystère</strong><small>Objet d’incubation</small></span>`;const l=tradeLovysById(creatureId);if(!l)return '';return `<img src="${escapeHtml(tradeCreatureImageUrl(l))}" alt=""><span><strong>${escapeHtml(l.name)}</strong><small>${escapeHtml(l.rarity||'')} · ${Number(l.fragments||0)} fragments disponibles</small></span><b class="trade-select-chevron">⌄</b>`;}
function setupTradeVisualSelector(row){const type=row.querySelector('[data-trade-type]')?.value||'fragment',select=row.querySelector('[data-trade-creature]'),preview=row.querySelector('[data-trade-preview]');if(!preview||!select)return;preview.classList.toggle('is-selectable',type!=='egg');preview.dataset.tradeVisualSelector=type!=='egg'?'1':'0';}

function syncTradeAssetRow(row){const type=row.querySelector('[data-trade-type]')?.value||'fragment',creature=row.querySelector('[data-trade-creature]'),preview=row.querySelector('[data-trade-preview]');if(creature){creature.classList.toggle('hidden',type==='egg');creature.disabled=type==='egg';}if(preview)preview.innerHTML=tradeCreaturePreviewMarkup(creature?.value,type==='egg');setupTradeVisualSelector(row);}
function tradeOptionRow(index){return `<div class="trade-option-edit" data-trade-option-row><span class="trade-option-number">${index}</span><select data-trade-type><option value="fragment">🧩 Fragments</option><option value="egg">🥚 Œuf mystère</option></select><select data-trade-creature>${tradeCreatureOptions()}</select><div class="trade-selected-preview" data-trade-preview></div><input data-trade-quantity type="number" min="1" max="999" value="10" inputmode="numeric"><button data-trade-remove type="button" aria-label="Retirer">×</button></div>`;}
function renderTradeOptions(){const list=$('tradeOptionsList');if(!list)return;const current=[...list.querySelectorAll('[data-trade-option-row]')].map(row=>({type:row.querySelector('[data-trade-type]')?.value,creatureId:row.querySelector('[data-trade-creature]')?.value,quantity:row.querySelector('[data-trade-quantity]')?.value}));list.innerHTML=Array.from({length:tradeOptionCount},(_,i)=>tradeOptionRow(i+1)).join('');[...list.querySelectorAll('[data-trade-option-row]')].forEach((row,i)=>{const old=current[i];if(old){row.querySelector('[data-trade-type]').value=old.type||'fragment';row.querySelector('[data-trade-creature]').value=old.creatureId||row.querySelector('[data-trade-creature]').value;row.querySelector('[data-trade-quantity]').value=old.quantity||10;}syncTradeAssetRow(row);});$('tradeOptionAdd').disabled=tradeOptionCount>=3;}
function syncTradeOfferFields(){const type=$('tradeOfferType')?.value||'fragment',creature=$('tradeOfferCreature');if(creature){creature.classList.toggle('hidden',type==='egg');creature.disabled=type==='egg';}const preview=$('tradeOfferPreview');if(preview)preview.innerHTML=tradeCreaturePreviewMarkup(creature?.value,type==='egg');setupTradeVisualSelector($('tradeOfferType')?.closest('.trade-asset-row')||document);const asset=type==='egg'?{type:'egg'}:{type:'fragment',creatureId:creature?.value};const balance=tradeBalanceFor(asset);if($('tradeOfferBalance'))$('tradeOfferBalance').textContent=type==='egg'?`Disponible : ${balance} œuf${balance>1?'s':''}`:`Disponible : ${balance} fragment${balance>1?'s':''}`;}
async function openTradeComposer(prefillCreature=''){
  try{hideTradePublishConfirmation();await loadTradeInventory();await refreshLobbyCounts();tradeOptionCount=1;$('tradeOfferCreature').innerHTML=tradeCreatureOptions();$('tradeOfferType').value=(tradeInventory.lovys||[]).some(l=>Number(l.fragments||0)>0)?'fragment':'egg';if(prefillCreature&&$('tradeOfferCreature'))$('tradeOfferCreature').value=prefillCreature;$('tradeOfferQuantity').value='10';$('tradeComposerMessage').textContent='';renderTradeOptions();syncTradeOfferFields();updateTradeComposerRecap();$('tradeComposer')?.classList.remove('hidden');}catch(error){alert(error.message);}
}
function closeTradeComposer(){hideTradePublishConfirmation();$('tradeComposer')?.classList.add('hidden');}
$('tradeCreateOpen')?.addEventListener('click',openTradeComposer);$('tradeCreateOpenMine')?.addEventListener('click',openTradeComposer);$('tradeComposerClose')?.addEventListener('click',closeTradeComposer);$('tradeOfferType')?.addEventListener('change',syncTradeOfferFields);$('tradeOfferCreature')?.addEventListener('change',syncTradeOfferFields);
$('tradeOptionAdd')?.addEventListener('click',()=>{tradeOptionCount=Math.min(3,tradeOptionCount+1);renderTradeOptions();});
function tradeComposerSummary(){const type=$('tradeOfferType')?.value||'fragment',creature=$('tradeOfferCreature')?.value,qty=Number($('tradeOfferQuantity')?.value||0),name=type==='egg'?'œuf mystère':(tradeLovysById(creature)?.name||'fragments');const opts=[...$('tradeOptionsList').querySelectorAll('[data-trade-option-row]')].map(row=>{const t=row.querySelector('[data-trade-type]').value,q=Number(row.querySelector('[data-trade-quantity]').value||0),cid=row.querySelector('[data-trade-creature]').value;return `${q} × ${t==='egg'?'œuf mystère':(tradeLovysById(cid)?.name||'fragments')}`;});return `Tu donnes ${qty} × ${name}. Tu demandes : ${opts.join(' ou ')}.`;}
function updateTradeComposerRecap(){const el=$('tradeComposerRecap');if(el)el.textContent=tradeComposerSummary();}
$('tradeComposer')?.addEventListener('input',()=>{updateTradeComposerRecap();hideTradePublishConfirmation();});$('tradeComposer')?.addEventListener('change',()=>{updateTradeComposerRecap();hideTradePublishConfirmation();});
$('tradeOptionsList')?.addEventListener('change',e=>{const row=e.target.closest('[data-trade-option-row]');if(row)syncTradeAssetRow(row);});
$('tradeOptionsList')?.addEventListener('click',e=>{if(!e.target.closest('[data-trade-remove]')||tradeOptionCount<=1)return;const rows=[...$('tradeOptionsList').querySelectorAll('[data-trade-option-row]')],idx=rows.indexOf(e.target.closest('[data-trade-option-row]'));if(idx>=0){rows[idx].remove();tradeOptionCount--;[...$('tradeOptionsList').querySelectorAll('.trade-option-number')].forEach((n,i)=>n.textContent=String(i+1));$('tradeOptionAdd').disabled=false;}});

document.addEventListener('click',e=>{
  const choice=e.target.closest('[data-trade-creature-choice]');
  if(choice){
    const preview=choice.closest('[data-trade-preview]'),row=preview?.closest('.trade-asset-row,[data-trade-option-row]'),select=row?.querySelector('[data-trade-creature]');
    if(select){select.value=choice.dataset.tradeCreatureChoice||select.value;select.dispatchEvent(new Event('change',{bubbles:true}));}
    document.querySelectorAll('.trade-creature-menu').forEach(m=>m.remove());e.stopPropagation();return;
  }
  const preview=e.target.closest('[data-trade-preview][data-trade-visual-selector="1"]');
  if(preview){
    const wasOpen=!!preview.querySelector('.trade-creature-menu');document.querySelectorAll('.trade-creature-menu').forEach(m=>m.remove());
    if(!wasOpen)preview.insertAdjacentHTML('beforeend',tradeCreatureMenuMarkup());e.stopPropagation();return;
  }
  document.querySelectorAll('.trade-creature-menu').forEach(m=>m.remove());
});
let pendingTradePublication=null;
function hideTradePublishConfirmation(){const box=$('tradePublishConfirm'),normal=$('tradePublishConfirmNormal'),success=$('tradePublishSuccess');if(box)box.classList.add('hidden');if(normal)normal.classList.remove('hidden');if(success)success.classList.add('hidden');pendingTradePublication=null;}
$('tradePublish')?.addEventListener('click',()=>{
  const offerType=$('tradeOfferType').value;const offer={type:offerType,creatureId:offerType==='fragment'?$('tradeOfferCreature').value:null,quantity:Number($('tradeOfferQuantity').value||0)};const options=[...$('tradeOptionsList').querySelectorAll('[data-trade-option-row]')].map(row=>{const type=row.querySelector('[data-trade-type]').value;return {type,creatureId:type==='fragment'?row.querySelector('[data-trade-creature]').value:null,quantity:Number(row.querySelector('[data-trade-quantity]').value||0)};});
  pendingTradePublication={offer,options,durationDays:Number($('tradeDuration').value||3)};const box=$('tradePublishConfirm'),txt=$('tradePublishConfirmText'),normal=$('tradePublishConfirmNormal'),success=$('tradePublishSuccess');if(txt)txt.textContent=tradeComposerSummary();if(normal)normal.classList.remove('hidden');if(success)success.classList.add('hidden');if(box)box.classList.remove('hidden');
});
$('tradePublishCancel')?.addEventListener('click',hideTradePublishConfirmation);
$('tradePublishConfirm')?.addEventListener('click',e=>{if(e.target===$('tradePublishConfirm'))hideTradePublishConfirmation();});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!$('tradePublishConfirm')?.classList.contains('hidden'))hideTradePublishConfirmation();});
$('tradePublishConfirmBtn')?.addEventListener('click',async()=>{
  if(!pendingTradePublication)return;
  const btn=$('tradePublishConfirmBtn'),msg=$('tradeComposerMessage'),payload=pendingTradePublication,normal=$('tradePublishConfirmNormal'),success=$('tradePublishSuccess');
  btn.disabled=true;btn.textContent='Publication…';msg.className='trade-composer-message';msg.textContent='';
  try{
    const r=await fetch('/api/trades',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)}),d=await r.json();
    if(!r.ok)throw new Error(d.error||'Publication impossible.');
    pendingTradePublication=null;if(normal)normal.classList.add('hidden');if(success)success.classList.remove('hidden');
    await new Promise(resolve=>setTimeout(resolve,1500));hideTradePublishConfirmation();closeTradeComposer();await openLobbyTab('mine');
  }catch(error){msg.textContent=error.message;msg.className='trade-composer-message error';hideTradePublishConfirmation();}
  finally{btn.disabled=false;btn.textContent='Confirmer la publication';}
});
async function acceptTrade(offerId,optionId){const offer=tradeOffers.find(o=>Number(o.id)===Number(offerId)),option=offer?.options?.find(o=>Number(o.id)===Number(optionId));if(!offer||!option)return;if(!confirm(`Confirmer l’échange ?\n\nTu donnes : ${option.quantity} × ${option.name}\nTu reçois : ${offer.offer.quantity} × ${offer.offer.name}`))return;const r=await fetch(`/api/trades/${offerId}/accept`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({optionId})}),d=await r.json();if(!r.ok){alert(d.error||'Échange impossible.');return;}await loadGame();await loadLovysCollection();await loadTrades(false);}
async function cancelTrade(offerId){if(!confirm('Annuler cette offre ? Les objets réservés seront rendus à ton inventaire.'))return;const r=await fetch(`/api/trades/${offerId}/cancel`,{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'}),d=await r.json();if(!r.ok){alert(d.error||'Annulation impossible.');return;}await loadGame();await loadLovysCollection();await loadTrades(true);}
$('lobbyTradesGrid')?.addEventListener('click',e=>{const btn=e.target.closest('[data-trade-accept]');if(btn&&!btn.disabled)acceptTrade(Number(btn.dataset.tradeAccept),Number(btn.dataset.tradeOption));});
$('lobbyMineGrid')?.addEventListener('click',e=>{const btn=e.target.closest('[data-trade-cancel]');if(btn)cancelTrade(Number(btn.dataset.tradeCancel));});


async function inviteFriendToWatchGame(){
  const shareUrl=location.origin+location.pathname;
  const shareName='LoVeR Watch Game';
  const shareData={title:shareName,text:`Rejoins-moi sur ${shareName} !`,url:shareUrl};
  if(navigator.share){try{await navigator.share(shareData);return;}catch(error){if(error?.name==='AbortError')return;}}
  const overlay=document.createElement('div');overlay.className='lobby-share-overlay';
  overlay.innerHTML=`<div class="lobby-share-card" role="dialog" aria-modal="true"><button class="lobby-share-close" type="button">×</button><div class="desktop-page-kicker">INVITER UN AMI</div><h3>🔗 Partager LoVeR Watch Game</h3><p>Envoie le lien du jeu à ton ami.</p><div class="lobby-share-url">${escapeHtml(shareUrl)}</div><div class="lobby-share-actions"><button type="button" data-share-copy>📋 Copier le lien</button><button type="button" data-share-discord>💬 Copier & ouvrir Discord</button></div><small>Sur iPhone, Android et les navigateurs compatibles, le bouton utilise directement le menu de partage du système.</small></div>`;
  document.body.appendChild(overlay);
  const close=()=>overlay.remove();overlay.querySelector('.lobby-share-close').onclick=close;overlay.addEventListener('click',e=>{if(e.target===overlay)close();});
  overlay.querySelector('[data-share-copy]').onclick=async e=>{await navigator.clipboard?.writeText(shareUrl);e.currentTarget.textContent='✓ Lien copié';};
  overlay.querySelector('[data-share-discord]').onclick=async()=>{await navigator.clipboard?.writeText(`${shareData.text} ${shareUrl}`);window.open('https://discord.com/channels/@me','_blank','noopener');};
}
$('lobbyInviteFriend')?.addEventListener('click',inviteFriendToWatchGame);

window.addEventListener('resize',()=>{if(!isDesktopGameUi()){document.body.dataset.desktopView='';document.body.classList.remove('desktop-leaderboard-open');$('desktopLobbyPage')?.classList.add('hidden');}else if(!document.body.dataset.desktopView){openDesktopView('home');}});
if(isDesktopGameUi())syncDesktopViewFromUrl();

loadLeaderboard();
refreshAccountState();

// Mise à jour temps réel : le serveur pousse un événement dès que le tracker
// enregistre de la progression ou qu'un défi est validé.
let liveUpdates = null;
let liveRefreshRunning = false;
let liveRefreshQueued = false;

async function refreshLiveGameState() {
  if (liveRefreshRunning) {
    liveRefreshQueued = true;
    return;
  }

  liveRefreshRunning = true;
  try {
    if (me?.user) await loadGame();
    await loadLeaderboard();
  } finally {
    liveRefreshRunning = false;
    if (liveRefreshQueued) {
      liveRefreshQueued = false;
      refreshLiveGameState();
    }
  }
}

function startLiveUpdates() {
  if (!me?.user || !window.EventSource || liveUpdates) return;

  liveUpdates = new EventSource('/api/live-updates');
  liveUpdates.addEventListener('connected', refreshDesktopHomeLiveStatus);
  liveUpdates.addEventListener('tracker-update', refreshDesktopHomeLiveStatus);
  liveUpdates.addEventListener('tracker-update', refreshLiveGameState);
  liveUpdates.addEventListener('challenge-update', refreshLiveGameState);
  liveUpdates.addEventListener('shop-update', async () => {await refreshLiveGameState();refreshDesktopBoostStatus();if(isDesktopGameUi() && desktopView==='shop') {try {await loadShop();}catch{}}});
  liveUpdates.addEventListener('trade-update', () => { if (desktopView === 'lobby') openLobbyTab(lobbyTab); });
  liveUpdates.onerror = () => {
    // EventSource tente automatiquement de se reconnecter.
  };
}

window.addEventListener('resize', scheduleTopDashboardSync);
window.addEventListener('keydown', event => {
  if (event.key === 'Escape' && badgeCelebrationActive) closeBadgeCelebration();
});

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/service-worker.js?v=109').catch(error => console.warn('Service worker non disponible :', error));
  });
}

startLiveUpdates();

refreshDesktopHomeLiveStatus();
setInterval(refreshDesktopHomeLiveStatus, 30000);
setInterval(refreshMobileHomeLiveStatus, 30000);

// Filet de sécurité si une connexion SSE est interrompue par le navigateur/proxy.
setInterval(() => {
  loadLeaderboard();
  if (me?.user) loadGame();
}, 30000);


function handleDailyChallengeAction(event) {
  const claimButton = event.target.closest('[data-daily-claim]');
  if (claimButton) { claimDailyChallenge(claimButton.dataset.dailyClaim); return true; }
  return false;
}
$('dailyChallengesGrid')?.addEventListener('click', event => {
  if (handleDailyChallengeAction(event)) return;
  const card = event.target.closest('[data-daily-detail]');
  if (card) renderDailyChallengeDetail(card.dataset.dailyDetail);
});
$('dailyChallengeDetailActions')?.addEventListener('click', event => { handleDailyChallengeAction(event); });
$('dailyChallengeDetailClose')?.addEventListener('click', closeDailyChallengeDetail);
$('dailyChallengeDetailModal')?.addEventListener('click', event => { if (event.target.id === 'dailyChallengeDetailModal') closeDailyChallengeDetail(); });


$('rewardWheelDailyTab')?.addEventListener('click',()=>{rewardWheelType='daily'; if($('rewardWheelResult')){$('rewardWheelResult').textContent='';$('rewardWheelResult').dataset.keep='';} renderRewardWheel();});
$('rewardWheelWeeklyTab')?.addEventListener('click',()=>{rewardWheelType='weekly'; if($('rewardWheelResult')){$('rewardWheelResult').textContent='';$('rewardWheelResult').dataset.keep='';} renderRewardWheel();});
$('rewardWheelSpin')?.addEventListener('click',spinRewardWheel);
$('rewardWheelOddsToggle')?.addEventListener('click',openRewardWheelOddsPopup);
$('rewardWheelOddsPopupClose')?.addEventListener('click',closeRewardWheelOddsPopup);
$('rewardWheelOddsPopup')?.addEventListener('click',event=>{if(event.target===$('rewardWheelOddsPopup')) closeRewardWheelOddsPopup();});
$('rewardWheelWinOk')?.addEventListener('click',closeRewardWheelWinPopup);
$('rewardWheelWinPopup')?.addEventListener('click',event=>{if(event.target===$('rewardWheelWinPopup')) closeRewardWheelWinPopup();});
document.addEventListener('keydown',event=>{if(event.key!=='Escape') return; if(!$('rewardWheelWinPopup')?.classList.contains('hidden')) closeRewardWheelWinPopup(); if(!$('rewardWheelOddsPopup')?.classList.contains('hidden')) closeRewardWheelOddsPopup();});
window.addEventListener('resize',()=>{applyDailyCarouselState();restartDailyCarousel();});

$('playerCardCollection')?.addEventListener('click', () => {
  $('badgeCollectionModal')?.classList.remove('hidden');
  renderBadgeCollection();
});
$('playerCardShop')?.addEventListener('click', openShop);

// V101 — remplace l'ancien onclick inline pour permettre une CSP stricte.
$('playerCardAccount')?.addEventListener('click', () => openAccountModal());


// ===== V113 — contrôle PC Mon compte =====
(function initDesktopAccountControl(){
  const accountButton = document.getElementById('desktopAccountButton');
  accountButton?.addEventListener('click', () => { if(!isDesktopGameUi()) openAccountModal(); });
})();
// ===== /V113 =====


/* V235 — progression uniquement : maintenir + glisser, arrêt au relâchement */
(function(){
  function bindDragScroller(el){
    if(!el || el.dataset.v235Drag==='1') return;
    el.dataset.v235Drag='1';
    let down=false, startX=0, startScroll=0, pid=null;

    el.addEventListener('pointerdown',function(e){
      if(e.pointerType==='mouse' && e.button!==0) return;
      down=true; pid=e.pointerId; startX=e.clientX; startScroll=el.scrollLeft;
      el.classList.add('is-dragging');
      try{el.setPointerCapture(pid)}catch(_){}
    });
    el.addEventListener('pointermove',function(e){
      if(!down || e.pointerId!==pid) return;
      const dx=e.clientX-startX;
      if(Math.abs(dx)>2) e.preventDefault();
      el.scrollLeft=startScroll-dx;
    },{passive:false});
    function end(e){
      if(!down || (e && e.pointerId!==pid)) return;
      down=false; el.classList.remove('is-dragging');
      try{el.releasePointerCapture(pid)}catch(_){}
      pid=null;
    }
    el.addEventListener('pointerup',end);
    el.addEventListener('pointercancel',end);
    el.addEventListener('lostpointercapture',end);
  }
  function bindAll(){
    document.querySelectorAll('#globalLevelRoad,.global-level-rank-scroll').forEach(bindDragScroller);
  }
  bindAll();
  new MutationObserver(bindAll).observe(document.documentElement,{childList:true,subtree:true});
})();


// Retours joueurs PC : capture compressée puis enregistrée sur le serveur.
const gameFeedbackPages=['Accueil','Lovys','Incubateur','PvE','Communauté','Classement','Progression','Boutique','Inventaire','Mon compte','Autre'];
let gameFeedbackScreenshot=null,gameFeedbackImageVersion=0,gameFeedbackImageBusy=false,gameFeedbackSending=false,gameFeedbackPreviousFocus=null;
function feedbackMessage(text,error=false){$('gameFeedbackMessage').textContent=text;$('gameFeedbackMessage').classList.toggle('error',error);}
function clearFeedbackImage(){gameFeedbackImageVersion++;gameFeedbackScreenshot=null;gameFeedbackImageBusy=false;$('gameFeedbackScreenshot').value='';$('gameFeedbackImage').removeAttribute('src');$('gameFeedbackImagePreview').classList.add('hidden');}
function closeGameFeedback(){if(gameFeedbackSending)return;$('gameFeedbackModal').classList.add('hidden');gameFeedbackPreviousFocus?.focus();}
function openGameFeedback(){
  if(!me?.user)return;
  gameFeedbackPreviousFocus=document.activeElement;$('gameFeedbackSuccess').classList.add('hidden');$('gameFeedbackForm').classList.remove('hidden');$('gameFeedbackForm').style.removeProperty('display');$('gameFeedbackSubmit').style.removeProperty('display');$('gameFeedbackIntro').classList.remove('hidden');$('gameFeedbackTitle').textContent='Améliorons le jeu ensemble';$('gameFeedbackForm').reset();clearFeedbackImage();feedbackMessage('');
  $('gameFeedbackPlatform').value=isMobileGameUi()?'mobile':'pc';
  $('gameFeedbackPage').innerHTML=gameFeedbackPages.map(page=>`<option>${escapeHtml(page)}</option>`).join('');
  $('gameFeedbackPage').value=({home:'Accueil',lovys:'Lovys',incubator:'Incubateur',pve:'PvE',lobby:'Communauté',leaderboard:'Classement',progression:'Progression',shop:commerceTab==='inventory'?'Inventaire':'Boutique',account:'Mon compte'})[desktopView]||'Autre';
  if(isMobileGameUi())$('gameFeedbackPage').value=currentMobileFeedbackPage();
  $('gameFeedbackSubmit').disabled=false;$('gameFeedbackSubmit').textContent='Envoyer mon message';$('gameFeedbackModal').classList.remove('hidden');$('gameFeedbackKind').dispatchEvent(new Event('change'));
  if(isMobileGameUi())$('gameFeedbackClose').focus({preventScroll:true});
  else $('gameFeedbackKind').focus();
}
$('gameFeedbackOpen')?.addEventListener('click',openGameFeedback);
$('gameFeedbackClose')?.addEventListener('click',closeGameFeedback);
$('gameFeedbackSuccessClose')?.addEventListener('click',closeGameFeedback);
$('gameFeedbackModal')?.addEventListener('click',e=>{if(e.target===$('gameFeedbackModal'))closeGameFeedback();});
$('gameFeedbackRemoveImage')?.addEventListener('click',clearFeedbackImage);
$('gameFeedbackKind')?.addEventListener('change',()=>{const bug=$('gameFeedbackKind').value==='bug';$('gameFeedbackDescriptionLabel').textContent=bug?'Que s’est-il passé ? Comment reproduire le bug ?':'Quelle est ton idée et que pourrait-elle améliorer ?';$('gameFeedbackDescription').placeholder=bug?'Explique ce que tu faisais, ce qui s’est passé et ce que tu attendais…':'Décris ton idée et pourquoi elle serait utile aux joueurs…';});
$('gameFeedbackScreenshot')?.addEventListener('change',async()=>{
  const file=$('gameFeedbackScreenshot').files[0];clearFeedbackImage();if(!file)return;
  const version=gameFeedbackImageVersion;gameFeedbackImageBusy=true;feedbackMessage('Préparation de la capture…');
  let url;
  try {
    if(!['image/png','image/jpeg','image/webp'].includes(file.type)||file.size>12000000)throw Error('Choisis une image PNG, JPEG ou WebP de moins de 12 Mo.');
    url=URL.createObjectURL(file);const image=new Image();image.src=url;await image.decode();
    if(image.width*image.height>40000000)throw Error('Cette image est trop grande.');
    const scale=Math.min(1,1600/Math.max(image.width,image.height)),canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(image.width*scale));canvas.height=Math.max(1,Math.round(image.height*scale));const context=canvas.getContext('2d');context.fillStyle='#fff';context.fillRect(0,0,canvas.width,canvas.height);context.drawImage(image,0,0,canvas.width,canvas.height);
    const result=canvas.toDataURL('image/jpeg',.82);if(result.length>2000000)throw Error('La capture est trop lourde. Essaie une image plus petite.');
    if(version!==gameFeedbackImageVersion)return;gameFeedbackScreenshot=result;$('gameFeedbackImage').src=result;$('gameFeedbackImagePreview').classList.remove('hidden');feedbackMessage('Capture prête à être envoyée.');
  } catch(error){if(version===gameFeedbackImageVersion)feedbackMessage(error.message||'Capture illisible.',true);}finally{if(url)URL.revokeObjectURL(url);if(version===gameFeedbackImageVersion)gameFeedbackImageBusy=false;}
});
$('gameFeedbackDescription')?.addEventListener('keydown',event=>{
  if(event.key!=='Enter'||event.shiftKey||event.ctrlKey||event.altKey||event.metaKey||event.isComposing)return;
  event.preventDefault();
  if(event.repeat||gameFeedbackSending||$('gameFeedbackForm').classList.contains('hidden'))return;
  $('gameFeedbackForm').requestSubmit();
});
$('gameFeedbackForm')?.addEventListener('submit',async event=>{
  event.preventDefault();if(gameFeedbackSending)return;if(gameFeedbackImageBusy){feedbackMessage('Attends la préparation de la capture.',true);return;}
  const description=$('gameFeedbackDescription').value.trim();if(description.length<20){feedbackMessage('Décris ton message en au moins 20 caractères.',true);return;}
  const submittedKind=$('gameFeedbackKind').value;
  gameFeedbackSending=true;const button=$('gameFeedbackSubmit');button.disabled=true;feedbackMessage('');
  try {
    const response=await fetch('/api/feedback',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({kind:submittedKind,page:$('gameFeedbackPage').value,platform:$('gameFeedbackPlatform').value,description,screenshot:gameFeedbackScreenshot})});const data=await response.json();if(!response.ok)throw Error(data.error||'Envoi impossible.');
    const bug=submittedKind==='bug';
    $('gameFeedbackSuccessEmoji').textContent=bug?'🛠️':'💡✨';
    $('gameFeedbackTitle').textContent='Message bien reçu';
    $('gameFeedbackSuccessTitle').textContent=bug?'Merci pour votre signalement !':'Merci pour votre idée !';
    $('gameFeedbackSuccessText').textContent=bug?'Votre bug a bien été transmis à l’équipe. Nous ferons notre possible pour vous aider rapidement.':'Merci de nous faire parvenir vos idées ! Cela contribue à améliorer LoVeR Watch Game pour toute la communauté.';
    $('gameFeedbackSuccessReference').textContent=`${bug?'Signalement':'Suggestion'} n°${data.id} · Enregistré ✓`;
    $('gameFeedbackDescription').value='';clearFeedbackImage();button.style.display='none';$('gameFeedbackForm').style.display='none';$('gameFeedbackForm').classList.add('hidden');$('gameFeedbackIntro').classList.add('hidden');$('gameFeedbackSuccess').classList.remove('hidden');$('gameFeedbackSuccessClose').focus();
  } catch(error){feedbackMessage(error.message||'Envoi impossible.',true);button.disabled=false;button.textContent='Réessayer l’envoi';}finally{gameFeedbackSending=false;}
});
document.addEventListener('keydown',event=>{if($('gameFeedbackModal')?.classList.contains('hidden'))return;if(event.key==='Escape'){event.preventDefault();event.stopImmediatePropagation();closeGameFeedback();}else if(event.key==='Tab')trapDesktopAdminFocus(event,$('gameFeedbackModal'));},true);
window.matchMedia('(min-width:901px)').addEventListener('change',event=>{if(!event.matches&&!gameFeedbackSending)closeGameFeedback();});
let adminFeedbackArchive=false,adminFeedbackPage=1,adminFeedbackSelected=null,adminFeedbackGeneration=0;
const adminFeedbackSelectedIds=new Set();
function updateAdminFeedbackSelection(){
  const count=adminFeedbackSelectedIds.size;
  $('adminFeedbackSelectionBar').classList.toggle('hidden',!adminFeedbackArchive);
  $('adminFeedbackSelectionCount').textContent=`${count} message${count>1?'s':''} sélectionné${count>1?'s':''} sur cette page`;
  $('adminFeedbackPurge').disabled=!adminFeedbackArchive||count===0;
}
function feedbackStatusControl(item){return `<label>Statut <select data-feedback-status="${Number(item.id)}">${[['new','À traiter'],['in_progress','En cours'],['resolved','Résolu · traité']].map(([value,label])=>`<option value="${value}" ${item.status===value?'selected':''}>${label}</option>`).join('')}</select></label><button class="btn secondary" type="button" data-feedback-discord="${Number(item.id)}">${item.discord_status==='sent'?'Synchroniser Discord':'Réessayer l’envoi Discord'}</button>`;}
async function loadAdminFeedback(){
  const generation=++adminFeedbackGeneration;
  adminFeedbackSelectedIds.clear();updateAdminFeedbackSelection();
  const list=$('adminFeedbackList');list.classList.remove('hidden');$('adminFeedbackDetail').classList.add('hidden');$('adminFeedbackPagination').classList.remove('hidden');adminFeedbackSelected=null;list.innerHTML='<p class="muted">Chargement…</p>';
  $('adminFeedbackActive').classList.toggle('secondary',adminFeedbackArchive);$('adminFeedbackArchive').classList.toggle('secondary',!adminFeedbackArchive);
  try {
    const data=await adminFetch(`/api/admin/feedback?archive=${adminFeedbackArchive?1:0}&page=${adminFeedbackPage}`);if(generation!==adminFeedbackGeneration)return;
    $('adminFeedbackDiscordState').textContent=data.discordConfigured?'Discord configuré : les nouveaux retours sont envoyés dans ton salon et leur statut y est mis à jour.':'Discord non configuré. Les retours restent enregistrés ici.';
    list.innerHTML=data.items.length?data.items.map(item=>`<div class="admin-feedback-list-entry">${adminFeedbackArchive?`<label class="admin-feedback-select"><input type="checkbox" data-feedback-select="${Number(item.id)}" aria-label="Sélectionner ${item.kind==='bug'?'le bug':'l’idée'} numéro ${Number(item.id)}"><span>Choisir</span></label>`:''}<button type="button" class="admin-feedback-item admin-feedback-row" data-feedback-open="${Number(item.id)}"><span><strong>${item.kind==='bug'?'🐛 Bug':'💡 Idée'} #${Number(item.id)} · ${escapeHtml(item.player_name)}</strong><small>${({pc:'🖥️ PC',mobile:'📱 Mobile'})[item.platform]||'Version non précisée'} · ${escapeHtml(item.page)} · ${new Date(item.created_at).toLocaleString('fr-FR')}</small><span class="admin-feedback-preview">${escapeHtml(item.description.slice(0,160))}${item.description.length>160?'…':''}</span></span><span>${{new:'À traiter',in_progress:'En cours',resolved:'✓ Traité'}[item.status]} →</span></button></div>`).join(''):`<p class="muted">${adminFeedbackArchive?'Aucun retour archivé.':'Aucun retour à traiter.'}</p>`;
    const pages=Math.max(1,Math.ceil(data.total/20));$('adminFeedbackPagination').innerHTML=`<button class="btn secondary" type="button" data-feedback-page="${adminFeedbackPage-1}" ${adminFeedbackPage<=1?'disabled':''}>← Précédent</button><span>Page ${adminFeedbackPage} / ${pages}</span><button class="btn secondary" type="button" data-feedback-page="${adminFeedbackPage+1}" ${adminFeedbackPage>=pages?'disabled':''}>Suivant →</button>`;
  }catch(error){if(generation===adminFeedbackGeneration)list.textContent=error.message;}
}
async function openAdminFeedbackDetail(id){
  const generation=++adminFeedbackGeneration;adminFeedbackSelected=id;
  adminFeedbackSelectedIds.clear();updateAdminFeedbackSelection();
  $('adminFeedbackList').classList.add('hidden');$('adminFeedbackPagination').classList.add('hidden');const detail=$('adminFeedbackDetail');detail.classList.remove('hidden');detail.innerHTML='<p>Chargement du retour et du joueur…</p>';
  try{
    const data=await adminFetch(`/api/admin/feedback/${id}`);if(generation!==adminFeedbackGeneration)return;const item=data.item;
    detail.innerHTML=`<button class="btn secondary" type="button" data-feedback-return>← Liste des retours</button><div class="admin-feedback-detail-grid"><article class="admin-feedback-item"><h3>${item.kind==='bug'?'🐛 Bug':'💡 Idée'} #${Number(item.id)}</h3><p><strong>${escapeHtml(item.player_name)}</strong> · ${({pc:'🖥️ PC',mobile:'📱 Mobile'})[item.platform]||'Version non précisée'} · ${escapeHtml(item.page)}<br><small>${new Date(item.created_at).toLocaleString('fr-FR')}</small></p><p class="admin-feedback-description">${escapeHtml(item.description)}</p>${item.has_screenshot?`<a href="/api/admin/feedback/${id}/screenshot" target="_blank" rel="noopener"><img src="/api/admin/feedback/${id}/screenshot" alt="Capture du retour"></a>`:'<p class="muted">Aucune capture jointe.</p>'}<div class="admin-feedback-actions">${feedbackStatusControl(item)}</div>${item.discord_error?`<p class="muted">⚠️ ${escapeHtml(item.discord_error)}</p>`:''}<p class="muted">« Résolu · traité » archive ce retour. Le statut peut être remis à « À traiter » depuis les archives.</p></article><aside id="adminFeedbackPlayer" class="admin-feedback-item"><p>Chargement du profil…</p></aside></div>`;
    const profile=$('adminFeedbackPlayer');
    if(!item.account_id){profile.textContent='Le compte du joueur a été supprimé. Son message reste disponible.';return;}
    try{
      const {player}=await adminFetch(`/api/admin/players/${Number(item.account_id)}/detail`);if(generation!==adminFeedbackGeneration)return;
      let avatar='';try{const url=new URL(player.profileImageUrl);if(url.protocol==='https:')avatar=`<img class="admin-feedback-avatar" src="${escapeHtml(url.href)}" alt="Avatar de ${escapeHtml(player.username)}">`;}catch{}
      profile.innerHTML=`${avatar}<h3>${escapeHtml(player.username)}</h3><p class="muted">Profil actuel du joueur · ${player.twitchLogin?`Twitch : ${escapeHtml(player.twitchLogin)}`:'Twitch non lié'}</p><div class="admin-feedback-stats">${adminStatCard('⏱️','Temps de visionnage',formatAdminHours(player.watchSeconds),'Temps de live comptabilisé par le jeu')}${adminStatCard('🌐','Niveau global',`${player.globalLevel} · Prestige ${player.prestige}`)}${adminStatCard('🐉','Lovys',player.lovys.length)}${adminStatCard('🥚','Œufs en incubation',player.incubator.filter(egg=>egg.status!=='hatched').length)}</div><h4>Lovys du joueur</h4>${player.lovys.length?player.lovys.map(l=>`<p>${l.is_active?'🟢 ':''}${escapeHtml(l.name)} · Niveau ${Number(l.level)} · Rang ${Number(l.rank||1)}</p>`).join(''):'<p class="muted">Aucun Lovys.</p>'}<p class="muted">Compte créé le ${new Date(player.createdAt).toLocaleDateString('fr-FR')}.</p>`;
    }catch(error){if(generation===adminFeedbackGeneration)profile.textContent=error.message;}
  }catch(error){if(generation===adminFeedbackGeneration)detail.innerHTML=`<button class="btn secondary" data-feedback-return type="button">← Liste des retours</button><p>${escapeHtml(error.message)}</p>`;}
}
$('adminFeedbackOpen')?.addEventListener('click',async()=>{$('desktopAdminContent').classList.add('hidden');if(!isDesktopGameUi())$('adminFeedbackOpen').classList.add('hidden');$('adminFeedbackSection').classList.remove('hidden');$('adminFeedbackNotice').textContent='';adminFeedbackArchive=false;adminFeedbackPage=1;await loadAdminFeedback();$('adminFeedbackSection').scrollIntoView({block:'start',behavior:'smooth'});});
$('adminFeedbackBack')?.addEventListener('click',()=>{adminFeedbackGeneration++;$('adminFeedbackSection').classList.add('hidden');$('desktopAdminContent').classList.remove('hidden');$('adminFeedbackOpen').classList.remove('hidden');});
for(const [id,archive] of [['adminFeedbackActive',false],['adminFeedbackArchive',true]])$(id)?.addEventListener('click',()=>{adminFeedbackArchive=archive;adminFeedbackPage=1;$('adminFeedbackNotice').textContent='';loadAdminFeedback();});
$('adminFeedbackPurge')?.addEventListener('click',async()=>{
  if(!adminFeedbackArchive||!adminFeedbackSelectedIds.size)return;
  const ids=[...adminFeedbackSelectedIds],count=ids.length;
  const approved=await showAdminActionConfirmation({username:'Messages sélectionnés',actionText:`Supprimer ${count} archive${count>1?'s':''} : ${ids.map(id=>`#${id}`).join(', ')}`,question:`Supprimer uniquement ${count===1?'ce message archivé':'ces messages archivés'} et ${count===1?'son message Discord associé':'leurs messages Discord associés'} ? Les autres archives restent intactes. Cette action ne peut pas être annulée.`});
  if(!approved)return;
  const button=$('adminFeedbackPurge');button.disabled=true;
  try{
    $('adminFeedbackNotice').textContent='Suppression des messages sélectionnés…';
    const data=await adminFetch('/api/admin/feedback/archive',{method:'DELETE',headers:{'Content-Type':'application/json'},body:JSON.stringify({ids})});
    await loadAdminFeedback();
    const deleted=Number(data.deleted)||0,failed=data.failedIds||[];
    $('adminFeedbackNotice').textContent=`✓ ${deleted} message${deleted>1?'s':''} supprimé${deleted>1?'s':''}.${failed.length?` Conservé${failed.length>1?'s':''} : ${failed.map(id=>`#${id}`).join(', ')} (Discord indisponible ou ancien message sans identifiant).`:''}`;
  }catch(error){$('adminFeedbackNotice').textContent=`Aucun message supprimé : ${error.message}. Vérifie que le serveur a bien été redéployé avec ce correctif.`;}
  finally{updateAdminFeedbackSelection();}
});
$('adminFeedbackSection')?.addEventListener('change',async event=>{
  const checked=event.target.closest('[data-feedback-select]');
  if(checked){const id=Number(checked.dataset.feedbackSelect);if(checked.checked)adminFeedbackSelectedIds.add(id);else adminFeedbackSelectedIds.delete(id);updateAdminFeedbackSelection();return;}
  const select=event.target.closest('[data-feedback-status]');if(!select)return;
  select.disabled=true;const id=Number(select.dataset.feedbackStatus);const status=select.value;
  try{
    const data=await adminFetch(`/api/admin/feedback/${id}`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({status})});
    const sync={synced:'Statut Discord mis à jour.',legacy:'Ancien message Discord : mise à jour automatique indisponible.',not_configured:'Discord non configuré.',not_sent:'Le message n’a pas encore été envoyé sur Discord.',failed:'La mise à jour Discord a échoué. Clique sur « Synchroniser Discord » pour réessayer.'}[data.discordSync];
    if(status==='resolved'||adminFeedbackArchive){adminFeedbackPage=1;await loadAdminFeedback();}else await openAdminFeedbackDetail(id);
    $('adminFeedbackNotice').textContent=`✓ ${status==='resolved'?'Retour traité et déplacé dans les archives.':'Statut enregistré.'} ${sync||''}${data.detail?' '+data.detail:''}`;
  }catch(error){$('adminFeedbackNotice').textContent=error.message;select.disabled=false;}
});
$('adminFeedbackSection')?.addEventListener('click',async event=>{
  const open=event.target.closest('[data-feedback-open]');if(open){$('adminFeedbackNotice').textContent='';openAdminFeedbackDetail(Number(open.dataset.feedbackOpen));return;}
  if(event.target.closest('[data-feedback-return]')){loadAdminFeedback();return;}
  const page=event.target.closest('[data-feedback-page]');if(page&&!page.disabled){adminFeedbackPage=Number(page.dataset.feedbackPage);loadAdminFeedback();return;}
  const button=event.target.closest('[data-feedback-discord]');if(!button)return;button.disabled=true;
  try{const data=await adminFetch(`/api/admin/feedback/${Number(button.dataset.feedbackDiscord)}/discord`,{method:'POST'});const notice={sent:'✓ Message envoyé sur Discord.',synced:'✓ Statut Discord synchronisé.',legacy:'Cet ancien message Discord n’a pas d’identifiant enregistré : synchronisation indisponible.',not_sent:'Le message n’a pas encore été envoyé sur Discord.',unchanged:'Ce message a déjà été envoyé. Change son statut pour le synchroniser.',failed:'Envoi Discord échoué.',not_configured:'Discord non configuré.'}[data.status]||'Envoi terminé.';if(adminFeedbackSelected)await openAdminFeedbackDetail(Number(button.dataset.feedbackDiscord));$('adminFeedbackNotice').textContent=notice+(data.detail?' '+data.detail:'');}catch(error){$('adminFeedbackNotice').textContent=error.message;}finally{button.disabled=false;}
});

// Le même pied de page suit la zone de défilement mobile et retrouve sa place PC.
function currentMobileFeedbackPage(){
  if(document.body.classList.contains('mobile-leaderboard-open'))return 'Classement';
  if(document.body.classList.contains('mobile-community-open'))return 'Communauté';
  for(const [id,label] of [['shopModal','Boutique'],['inventoryModal','Inventaire'],['playerProfileModal','Mon compte'],['lovysCollectionModal','Lovys'],['progressionModal','Progression'],['pveModal','PvE']])if($(id)&&!$(id).classList.contains('hidden'))return label;
  return isMobileEggDetailsOpen()?'Incubateur':'Accueil';
}
function syncMobileFooterPlacement(){
  if(!syncMobileFooterPlacement.ready)return;
  const {footer,origin}=syncMobileFooterPlacement;
  if(!isMobileGameUi()){
    footer.classList.remove('mobile-footer-hidden');
    if(origin.parentNode&&footer.previousSibling!==origin)origin.after(footer);
    return;
  }
  let host=$('app');
  if(document.body.classList.contains('mobile-leaderboard-open'))host=document.querySelector('.global-leaderboard');
  else if(document.body.classList.contains('mobile-community-open'))host=$('desktopLobbyPage')?.querySelector('.desktop-lobby-shell');
  else for(const id of ['shopModal','inventoryModal','playerProfileModal','lovysCollectionModal','progressionModal']){
    const page=$(id);if(page&&!page.classList.contains('hidden')){host=page.firstElementChild;break;}
  }
  if(isMobileEggDetailsOpen())host=$('pick');
  footer.classList.toggle('mobile-footer-hidden',Boolean($('pveModal')&&!$('pveModal').classList.contains('hidden')));
  if(host&&footer.parentNode!==host)host.appendChild(footer);
}
(function initMobileFooter(){
  const footer=$('desktopGameFooter');if(!footer)return;
  const origin=document.createComment('game-footer-original-position');footer.before(origin);
  Object.assign(syncMobileFooterPlacement,{footer,origin,ready:true});
  const observer=new MutationObserver(syncMobileFooterPlacement);
  for(const node of [document.body,$('app'),$('pick'),...['shopModal','inventoryModal','playerProfileModal','lovysCollectionModal','progressionModal','pveModal','desktopLobbyPage'].map($)].filter(Boolean))observer.observe(node,{attributes:true,attributeFilter:['class']});
  window.matchMedia('(max-width:900px)').addEventListener('change',syncMobileFooterPlacement);
  syncMobileFooterPlacement();
})();
// À l'ouverture, afficher immédiatement le début des CGU dans la page courante.
// scrollIntoView suit aussi le conteneur de défilement des pages mobiles.
document.querySelector('.desktop-game-footer-terms')?.addEventListener('toggle',event=>{
  const terms=event.currentTarget;
  if(!terms.open)return;
  requestAnimationFrame(()=>{
    if(terms.open)terms.querySelector('.desktop-game-footer-terms-copy h3')?.scrollIntoView({behavior:'auto',block:'start',inline:'nearest'});
  });
});

// PC : les mêmes outils se présentent en onglets, sans dupliquer les contrôles.

function syncDesktopAdminPageLayout() {
  const tabs=$('desktopAdminTabs'), slot=$('desktopAdminPageSlot');
  if(!tabs || !slot)return;
  for(const id of [...Object.keys(DESKTOP_ADMIN_PAGES), 'adminFeedbackOpen', ...Object.values(DESKTOP_ADMIN_PAGES), 'desktopAdminContent']) {
    const node=$(id); if(!node)continue;
    if(!desktopAdminLayoutOrigins.has(id)) {
      const origin=document.createComment(id+'-mobile-origin');
      node.parentNode.insertBefore(origin,node);desktopAdminLayoutOrigins.set(id,origin);
    }
    if(isDesktopGameUi()) {
      if(id==='desktopAdminContent') $('adminTrackerContent')?.before(node);
      else (Object.values(DESKTOP_ADMIN_PAGES).includes(id)?slot:tabs).appendChild(node);
      if(id==='adminTrackerButton') {
        if(desktopTrackerButtonMarkup===null)desktopTrackerButtonMarkup=node.innerHTML;
        const logo=document.querySelector('.home-twitch-logo')?.cloneNode(true);
        if(logo){logo.setAttribute('class','admin-twitch-logo');node.replaceChildren(logo,document.createTextNode(' Twitch'));}
      }
      if(Object.values(DESKTOP_ADMIN_PAGES).includes(id)){node.setAttribute('role','region');node.removeAttribute('aria-modal');}
    } else {
      const origin=desktopAdminLayoutOrigins.get(id);origin.parentNode.insertBefore(node,origin.nextSibling);
      if(Object.values(DESKTOP_ADMIN_PAGES).includes(id)){node.setAttribute('role','dialog');node.setAttribute('aria-modal','true');}
      if(id==='adminTrackerButton' && desktopTrackerButtonMarkup!==null)node.innerHTML=desktopTrackerButtonMarkup;
      if(id==='desktopAdminContent')node.classList.toggle('hidden',!$('adminFeedbackSection').classList.contains('hidden'));
      if(id==='adminFeedbackOpen')node.classList.toggle('hidden',!$('adminFeedbackSection').classList.contains('hidden'));
    }
  }
}
$('desktopAdminTabs')?.addEventListener('click',event=>{
  const button=event.target.closest('button');if(!button || !isDesktopGameUi())return;
  for(const id of Object.values(DESKTOP_ADMIN_PAGES))$(id)?.classList.add('hidden');
  $('adminFeedbackSection')?.classList.add('hidden');
  $('desktopAdminContent')?.classList.toggle('hidden',button.id!=='adminTrackerButton');
  $('adminFeedbackOpen')?.classList.remove('hidden');
  $('desktopAdminTabs').querySelectorAll('button').forEach(node=>node.toggleAttribute('aria-current',node===button));
},true);


// PC — Collections publiques et échanges ciblés de lots (maximum trois éléments par côté).
async function playerTradeApi(url, options={}) {
  const response=await fetch(url,{cache:'no-store',...options});
  const data=await response.json();
  if(!response.ok)throw new Error(data.error || 'Action impossible.');
  return data;
}
function closePlayerCollection() {
  playerCollectionGeneration++;
  playerCollectionData=null;pendingPlayerTradePayload=null;
  $('lobbyPlayerCollectionPage')?.classList.add('hidden');
  $('lobbyPlayersDirectory')?.classList.remove('hidden');
}
$('lobbyPlayerCollectionBack')?.addEventListener('click',()=>{closePlayerCollection();$('lobbyPlayerSearch')?.focus();});
$('lobbyPlayersGrid')?.addEventListener('keydown',event=>{
  if(!isDesktopGameUi() || !['Enter',' '].includes(event.key))return;
  const card=event.target.closest('[data-lobby-user]');
  if(card){event.preventDefault();openPlayerCollection(Number(card.dataset.lobbyUser));}
});
window.matchMedia('(min-width:901px)').addEventListener('change',event=>{if(!event.matches)closePlayerCollection();});
async function openPlayerCollection(userId) {
  if(!isDesktopGameUi())return;
  const generation=++playerCollectionGeneration;
  pendingPlayerTradePayload=null;
  $('lobbyPlayersDirectory')?.classList.add('hidden');
  $('lobbyPlayerCollectionPage')?.classList.remove('hidden');
  const body=$('lobbyPlayerCollectionBody');body.innerHTML='<p class="muted">Chargement de la collection…</p>';
  try {
    const [collection,inventory]=await Promise.all([playerTradeApi('/api/lobby/players/'+userId),playerTradeApi('/api/trades/inventory')]);
    if(generation!==playerCollectionGeneration || !isDesktopGameUi())return;
    playerCollectionData=collection;playerTradeInventory=inventory;
    const player=collection.player,isSelf=Number(player.userId)===Number(collection.selfUserId);
    const cards=collection.lovys.map(l=>`<article class="player-collection-lovys"><img src="${escapeHtml(l.image)}" alt="${escapeHtml(l.name)}" loading="lazy"><h3>${escapeHtml(l.name)}</h3><span>${escapeHtml(l.rarity||'')} · Niv. ${Number(l.level)}</span><span class="player-collection-stars">${'⭐'.repeat(Math.max(1,Math.min(5,Number(l.rank)||1)))}</span><strong>🧩 ${Number(l.fragments)} fragments disponibles</strong></article>`).join('');
    body.innerHTML=`<div class="player-collection-head">${player.profileImageUrl?`<img class="player-collection-avatar" src="${escapeHtml(player.profileImageUrl)}" alt="">`:''}<div><h2>${escapeHtml(player.username)}</h2><p>Niveau global ${Number(player.level)} · 🐉 ${collection.lovys.length}/${Number(collection.totalLovys)} Lovys obtenus</p></div><div class="player-collection-eggs"><strong>🥚 ${Number(collection.eggs)} œufs disponibles</strong><span>${Number(collection.incubatingEggs)} œufs dans les incubateurs</span></div></div><div class="player-collection-grid">${cards || '<p class="muted">Ce joueur n’a pas encore fait éclore de Lovys.</p>'}</div>${isSelf?'<p class="muted">C’est ta collection. Choisis un autre joueur pour proposer un échange.</p>':`<section class="player-bundle-section"><h3>🔄 Proposer un échange à ${escapeHtml(player.username)}</h3><p>Commence par choisir de 1 à 3 éléments à proposer, puis valide pour choisir de 1 à 3 éléments à demander. Tous seront échangés ensemble si le joueur accepte. Les fragments concernent les Lovys déjà obtenus par les deux joueurs ; les œufs disponibles peuvent aussi être échangés.</p><form id="playerBundleForm"><p id="playerBundleStepLabel" class="player-bundle-step-label">Étape 1 / 2 · Je propose entre 1 et 3 éléments</p><div class="player-bundle-columns player-bundle-wizard"><section id="playerBundleOfferedStep"><div class="player-bundle-heading"><h4>Je propose</h4><button class="lobby-secondary-btn" type="button" data-bundle-add="offered">＋ Ajouter</button></div><div id="playerBundleOffered" class="player-bundle-rows"></div></section><section id="playerBundleRequestedStep" class="hidden"><p id="playerBundleOfferedRecap" class="player-bundle-recap"></p><div class="player-bundle-heading"><h4>Je voudrais</h4><button class="lobby-secondary-btn" type="button" data-bundle-add="requested">＋ Ajouter</button></div><div id="playerBundleRequested" class="player-bundle-rows"></div></section></div><div class="player-bundle-footer"><button id="playerBundleBackStep" class="lobby-secondary-btn hidden" type="button" data-bundle-back>← Modifier ce que je propose</button><label id="playerBundleDurationLabel" class="hidden">Durée <select id="playerBundleDuration"><option value="1">24 heures</option><option value="3" selected>3 jours</option><option value="7">7 jours</option></select></label><button id="playerBundleContinue" class="lobby-primary-btn" type="button" data-bundle-continue>Valider et choisir ce que je voudrais →</button><button id="playerBundleReview" class="lobby-primary-btn hidden" type="submit">Vérifier mon échange</button></div><p id="playerBundleMessage" role="status"></p><div id="playerBundleConfirmation" class="hidden"></div></form></section>`}`;
    if(!isSelf){
      for(const side of ['offered','requested']){
        if(playerBundleChoices(side).length)addPlayerBundleRow(side);
        else $(side==='offered'?'playerBundleOffered':'playerBundleRequested').innerHTML=`<p class="muted">${side==='offered'?'Tu n’as aucun fragment compatible ni œuf disponible à proposer à ce joueur.':'Ce joueur n’a aucun fragment disponible pour tes Lovys, ni œuf disponible à demander.'}</p>`;
      }
      syncPlayerBundleControls();
    }
    $('lobbyPlayerCollectionPage')?.scrollIntoView({block:'start',behavior:'auto'});
  }catch(error){if(generation===playerCollectionGeneration)body.innerHTML=`<p role="status">${escapeHtml(error.message)}</p>`;}
}
function playerBundleChoices(side) {
  const source=side==='offered'?playerTradeInventory:playerCollectionData;
  const receiver=side==='offered'?playerCollectionData:playerTradeInventory;
  if(!source || !receiver)return [];
  const receiverIds=new Set(receiver.lovys.map(l=>l.creatureId));
  const assets=source.lovys.filter(l=>receiverIds.has(l.creatureId) && Number(l.fragments)>0).map(l=>({value:'fragment:'+l.creatureId,label:'🧩 '+l.name+' · '+Number(l.fragments)+' disponibles',quantity:Number(l.fragments),image:l.image}));
  if(Number(source.eggs)>0)assets.push({value:'egg',label:'🥚 Œuf mystère · '+Number(source.eggs)+' disponibles',quantity:Number(source.eggs)});
  return assets;
}
function addPlayerBundleRow(side) {
  const list=$(side==='offered'?'playerBundleOffered':'playerBundleRequested');if(!list || list.children.length>=3)return;
  const choices=playerBundleChoices(side);
  const row=document.createElement('div');row.className='player-bundle-row';row.dataset.bundleSide=side;
  row.innerHTML=`<div class="player-bundle-asset-preview" aria-hidden="true"></div><label>Élément<select data-bundle-asset required><option value="">Choisir un élément…</option>${choices.map(a=>`<option value="${escapeHtml(a.value)}">${escapeHtml(a.label)}</option>`).join('')}</select></label><label>Quantité<input data-bundle-quantity type="number" min="1" max="999" value="1" required inputmode="numeric"></label><button type="button" data-bundle-remove aria-label="Retirer cet élément">×</button>`;
  list.appendChild(row);syncPlayerBundleControls();
}
function syncPlayerBundleControls() {
  const form=$('playerBundleForm');if(!form)return;
  form.querySelector('[type=submit]').disabled=playerTradeBusy || !playerBundleChoices('offered').length || !playerBundleChoices('requested').length;
  $('playerBundleContinue').disabled=playerTradeBusy || !playerBundleChoices('offered').length;
  form.querySelectorAll('[data-bundle-add]').forEach(button=>{const list=$(button.dataset.bundleAdd==='offered'?'playerBundleOffered':'playerBundleRequested');button.disabled=playerTradeBusy || list.children.length>=3 || !playerBundleChoices(button.dataset.bundleAdd).length;});
  form.querySelectorAll('[data-bundle-remove]').forEach(button=>button.disabled=playerTradeBusy || button.parentElement.parentElement.children.length<=1);
}
function clearPlayerBundleConfirmation() {pendingPlayerTradePayload=null;$('playerBundleConfirmation')?.classList.add('hidden');}
function readPlayerBundle(side) {
  const rows=[...$(side==='offered'?'playerBundleOffered':'playerBundleRequested').children],choices=playerBundleChoices(side),seen=new Set();
  return rows.map(row=>{
    const value=row.querySelector('[data-bundle-asset]').value,quantity=Number(row.querySelector('[data-bundle-quantity]').value),choice=choices.find(c=>c.value===value);
    if(!choice||!Number.isSafeInteger(quantity)||quantity<1||quantity>999||quantity>choice.quantity)throw new Error('Vérifie les éléments et les quantités disponibles de chaque côté.');
    if(seen.has(value))throw new Error('Choisis chaque élément une seule fois et ajuste sa quantité.');seen.add(value);
    return {type:value==='egg'?'egg':'fragment',creatureId:value==='egg'?null:value.slice(9),quantity};
  });
}
function showPlayerBundleStage(stage,offered=[]) {
  clearPlayerBundleConfirmation();
  $('playerBundleMessage').textContent='';
  $('playerBundleOfferedStep').classList.toggle('hidden',stage!==1);
  $('playerBundleRequestedStep').classList.toggle('hidden',stage!==2);
  $('playerBundleContinue').classList.toggle('hidden',stage!==1);
  for(const id of ['playerBundleBackStep','playerBundleDurationLabel','playerBundleReview'])$(id).classList.toggle('hidden',stage!==2);
  $('playerBundleStepLabel').textContent=stage===1?'Étape 1 / 2 · Je propose entre 1 et 3 éléments':'Étape 2 / 2 · Je voudrais entre 1 et 3 éléments';
  if(stage===2)$('playerBundleOfferedRecap').textContent='Tu proposes : '+playerBundleSummary(offered);
  const active=$(stage===1?'playerBundleOfferedStep':'playerBundleRequestedStep');
  active.querySelector('select')?.focus();
  syncPlayerBundleControls();
}
function playerBundleSummary(assets) {
  const catalog=playerTradeInventory?.catalog || [];
  return assets.map(asset=>`${asset.quantity} × ${asset.type==='egg'?'œuf mystère':'fragments '+(catalog.find(l=>l.creatureId===asset.creatureId)?.name || asset.creatureId)}`).join(' + ');
}
$('lobbyPlayerCollectionBody')?.addEventListener('input',()=>{if(!playerTradeBusy)clearPlayerBundleConfirmation();});
$('lobbyPlayerCollectionBody')?.addEventListener('change',event=>{
  if(playerTradeBusy)return;clearPlayerBundleConfirmation();
  const row=event.target.closest('[data-bundle-side]');if(!row)return;
  const choice=playerBundleChoices(row.dataset.bundleSide).find(c=>c.value===row.querySelector('[data-bundle-asset]').value);
  row.querySelector('[data-bundle-quantity]').max=String(Math.min(999,choice?.quantity || 999));
  row.querySelector('.player-bundle-asset-preview').innerHTML=choice?.image?`<img src="${escapeHtml(choice.image)}" alt="">`:choice?.value==='egg'?'🥚':'🧩';
});
$('lobbyPlayerCollectionBody')?.addEventListener('submit',event=>{
  if(event.target.id!=='playerBundleForm')return;event.preventDefault();if(playerTradeBusy)return;
  try {
    pendingPlayerTradePayload={targetUserId:playerCollectionData.player.userId,offered:readPlayerBundle('offered'),requested:readPlayerBundle('requested'),durationDays:Number($('playerBundleDuration').value)};
    $('playerBundleMessage').textContent='';
    const box=$('playerBundleConfirmation');box.innerHTML=`<h4>Envoyer cette proposition à ${escapeHtml(playerCollectionData.player.username)} ?</h4><p><strong>Tu proposes :</strong> ${escapeHtml(playerBundleSummary(pendingPlayerTradePayload.offered))}</p><p><strong>Tu voudrais :</strong> ${escapeHtml(playerBundleSummary(pendingPlayerTradePayload.requested))}</p><p>Seuls tes objets proposés seront réservés. Le joueur pourra accepter ou refuser.</p><button class="lobby-primary-btn" type="button" data-bundle-send>Oui, envoyer la proposition</button> <button class="lobby-secondary-btn" type="button" data-bundle-edit>Non, modifier</button>`;box.classList.remove('hidden');box.querySelector('[data-bundle-send]').focus();
  }catch(error){$('playerBundleMessage').textContent=error.message;}
});
$('lobbyPlayerCollectionBody')?.addEventListener('click',async event=>{
  const add=event.target.closest('[data-bundle-add]'),remove=event.target.closest('[data-bundle-remove]');
  if(playerTradeBusy)return;
  if(event.target.closest('[data-bundle-continue]')){
    try{const offered=readPlayerBundle('offered');showPlayerBundleStage(2,offered);}
    catch(error){$('playerBundleMessage').textContent=error.message;}
    return;
  }
  if(event.target.closest('[data-bundle-back]')){showPlayerBundleStage(1);return;}
  if(add){clearPlayerBundleConfirmation();addPlayerBundleRow(add.dataset.bundleAdd);return;}
  if(remove){clearPlayerBundleConfirmation();if(remove.parentElement.parentElement.children.length>1)remove.parentElement.remove();syncPlayerBundleControls();return;}
  if(event.target.closest('[data-bundle-edit]')){clearPlayerBundleConfirmation();return;}
  if(!event.target.closest('[data-bundle-send]') || !pendingPlayerTradePayload)return;
  const payload=pendingPlayerTradePayload,generation=playerCollectionGeneration;
  playerTradeBusy=true;$('playerBundleForm').querySelectorAll('button,input,select').forEach(node=>node.disabled=true);
  try {
    const data=await playerTradeApi('/api/player-trades',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
    pendingPlayerTradePayload=null;
    await loadPlayerTradeInbox();
    if($('playerTradeNotice'))$('playerTradeNotice').textContent='✓ '+data.message;
    if(generation===playerCollectionGeneration)await openPlayerCollection(payload.targetUserId);
  }catch(error){if(generation===playerCollectionGeneration)$('playerBundleMessage').textContent=error.message;}
  finally{playerTradeBusy=false;if(generation===playerCollectionGeneration)$('playerBundleForm')?.querySelectorAll('button,input,select').forEach(node=>node.disabled=false);syncPlayerBundleControls();}
});
function playerTradeOfferMarkup(offer) {
  const received=Number(offer.targetUserId)===playerTradeSelfId;
  const give=received?offer.requested:offer.offered,get=received?offer.offered:offer.requested;
  const items=assets=>assets.map(a=>`<span>${a.image?`<img src="${escapeHtml(a.image)}" alt="">`:'🥚'} ${Number(a.quantity)} × ${escapeHtml(a.name)}</span>`).join('');
  return `<article class="player-trade-offer"><div class="player-trade-offer-head"><strong>${received?'📥 De '+escapeHtml(offer.creatorName):'📤 Pour '+escapeHtml(offer.targetName)}</strong><small>${formatTradeRemaining(offer.expiresAt)}</small></div><div class="player-bundle-columns"><div><h4>Tu proposes</h4>${items(give)}</div><div><h4>Tu reçois</h4>${items(get)}</div></div><div class="player-trade-offer-actions">${received?`<button class="lobby-primary-btn" type="button" data-player-trade-action="accept" data-player-trade-id="${offer.id}">Accepter cet échange</button><button class="lobby-secondary-btn" type="button" data-player-trade-action="decline" data-player-trade-id="${offer.id}">Refuser</button>`:`<button class="lobby-secondary-btn" type="button" data-player-trade-action="cancel" data-player-trade-id="${offer.id}">Annuler ma proposition</button>`}</div></article>`;
}
async function loadPlayerTradeInbox() {
  if(!isDesktopGameUi())return;
  try {
    const data=await playerTradeApi('/api/player-trades');playerTradeOffers=data.offers || [];playerTradeSelfId=Number(data.selfUserId);
    $('playerTradeInbox').innerHTML=`<div class="player-trade-inbox-head"><h3>Propositions entre joueurs${playerTradeOffers.length?' · '+playerTradeOffers.length:''}</h3><p id="playerTradeNotice" role="status"></p></div>${playerTradeOffers.length?playerTradeOffers.map(playerTradeOfferMarkup).join(''):'<p class="muted">Tes propositions envoyées et celles reçues apparaîtront ici.</p>'}`;
  }catch(error){$('playerTradeInbox').innerHTML=`<p id="playerTradeNotice" role="status">${escapeHtml(error.message)}</p>`;}
}
function confirmPlayerTrade(offer,action) {
  const received=Number(offer.targetUserId)===playerTradeSelfId;
  const give=received?offer.requested:offer.offered,get=received?offer.offered:offer.requested;
  return new Promise(resolve=>{
    const previous=document.activeElement,overlay=document.createElement('div');overlay.className='player-trade-confirm-overlay';
    const question=action==='accept'?'Accepter cet échange ?':action==='decline'?'Refuser cette proposition ?':'Annuler ta proposition ?';
    overlay.innerHTML=`<div class="player-trade-confirm-card" role="dialog" aria-modal="true" aria-labelledby="playerTradeConfirmTitle"><h3 id="playerTradeConfirmTitle">${question}</h3><p>${action==='accept'?`<strong>Tu donnes :</strong> ${escapeHtml(give.map(a=>a.quantity+' × '+a.name).join(' + '))}</p><p><strong>Tu reçois :</strong> ${escapeHtml(get.map(a=>a.quantity+' × '+a.name).join(' + '))}`:'Tous les objets réservés seront rendus au joueur qui les a proposés.'}</p><div><button class="lobby-secondary-btn" type="button" data-direct-no>Non, revenir</button><button class="lobby-primary-btn" type="button" data-direct-yes>Oui, confirmer</button></div></div>`;
    document.body.appendChild(overlay);
    const finish=value=>{overlay.remove();document.removeEventListener('keydown',key);if(previous?.isConnected)previous.focus();resolve(value);};
    const key=event=>{if(event.key==='Escape'){event.preventDefault();finish(false);}if(event.key==='Tab')trapDesktopAdminFocus(event,overlay);};
    document.addEventListener('keydown',key);
    overlay.addEventListener('click',event=>{if(event.target===overlay || event.target.closest('[data-direct-no]'))finish(false);else if(event.target.closest('[data-direct-yes]'))finish(true);});
    overlay.querySelector('[data-direct-no]').focus();
  });
}
$('playerTradeInbox')?.addEventListener('click',async event=>{
  const button=event.target.closest('[data-player-trade-action]');if(!button || playerTradeBusy)return;
  const offer=playerTradeOffers.find(o=>Number(o.id)===Number(button.dataset.playerTradeId));if(!offer)return;
  playerTradeBusy=true;
  try {
    if(!await confirmPlayerTrade(offer,button.dataset.playerTradeAction))return;
    button.disabled=true;
    const data=await playerTradeApi(`/api/player-trades/${offer.id}/${button.dataset.playerTradeAction}`,{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});
    await loadPlayerTradeInbox();if($('playerTradeNotice'))$('playerTradeNotice').textContent='✓ '+data.message;
    if(playerCollectionData)await openPlayerCollection(playerCollectionData.player.userId);
    await loadGame();
  }catch(error){await loadPlayerTradeInbox();if($('playerTradeNotice'))$('playerTradeNotice').textContent=error.message;}
  finally{playerTradeBusy=false;button.disabled=false;syncPlayerBundleControls();}
});


// PC — Présentation de la communauté, mémorisée sur le compte.
const communityGuideSteps = [
 {icon:'🤝',title:'Bienvenue dans la Communauté !',text:'Ici, les joueurs échangent des fragments de Lovys et des œufs mystère disponibles.',details:'<p><strong>🔄 Échanges :</strong> trouve les offres publiques.</p><p><strong>📜 Mes offres :</strong> suis ou annule tes annonces.</p><p><strong>👥 Joueurs :</strong> découvre les collections et propose un échange à une personne précise.</p><p><strong>💜 Souhaits :</strong> indique les Lovys que tu recherches.</p><p><strong>🕘 Historique :</strong> retrouve les échanges publics terminés.</p>'},
 {icon:'🧩',title:'Quels fragments peux-tu échanger ?',text:'Les doublons donnent des fragments. Tu échanges ces fragments : ton Lovys reste dans ta collection.',details:'<p><strong>Les deux joueurs doivent déjà posséder le Lovys correspondant.</strong></p><p>Exemple : pour échanger des fragments Voltis, vous devez tous les deux avoir Voltis.</p><p>Les œufs mystère disponibles peuvent aussi être échangés. Les œufs en incubation restent dans leurs incubateurs.</p>'},
 {icon:'👥',title:'Je propose / Je voudrais',text:'Clique sur le rectangle d’un joueur pour voir ses Lovys avec leurs photos, ses fragments et ses œufs.',details:'<p><strong>Je propose :</strong> tes fragments compatibles et tes œufs disponibles.</p><p><strong>Je voudrais :</strong> les fragments que ce joueur possède pour tes Lovys, et ses œufs disponibles.</p><p>D’abord, choisis <strong>1 à 3 éléments dans Je propose</strong> et valide cette étape. Ensuite, choisis <strong>1 à 3 éléments dans Je voudrais</strong>. La confirmation finale récapitule les deux côtés avant l’envoi.</p><p><strong>Aucun choix ?</strong> Le joueur doit avoir du stock compatible : posséder un Lovys ne suffit pas pour demander des fragments qu’il n’a pas.</p>'},
 {icon:'✅',title:'Confirmer et suivre ton échange',text:'Relis les quantités avant d’envoyer. Tes objets proposés sont réservés jusqu’à la réponse du joueur.',details:'<p><strong>Proposition ciblée :</strong> le destinataire accepte ou refuse dans <strong>Joueurs</strong>. Tu peux y annuler ta proposition.</p><p><strong>Offre publique :</strong> propose un élément contre une des alternatives. Un joueur choisit une seule contrepartie pour accepter.</p><p>En cas de refus, d’annulation ou d’expiration, les objets réservés sont rendus. L’acceptation transfère les éléments ensemble.</p><p>Échanges accessibles au <strong>niveau global 3</strong> : maximum 3 offres actives et 20 échanges réalisés par jour.</p>'}
];
function renderCommunityGuide(){
 const step=communityGuideSteps[communityGuideStepIndex];
 $('communityGuideStep').textContent=`Étape ${communityGuideStepIndex+1} / ${communityGuideSteps.length}`;
 $('communityGuideProgress').style.width=`${(communityGuideStepIndex+1)/communityGuideSteps.length*100}%`;
 $('communityGuideIcon').textContent=step.icon;
 $('communityGuideTitle').textContent=step.title;
 $('communityGuideText').textContent=step.text;
 $('communityGuideDetails').innerHTML=step.details;
 $('communityGuidePrev').disabled=communityGuideStepIndex===0;
 $('communityGuideNext').textContent=communityGuideStepIndex===communityGuideSteps.length-1?'J’ai compris ✓':'Suivant →';
 $('communityGuideTitle').focus({preventScroll:true});
 $('communityGuideModal').querySelector('.community-guide-panel').scrollTop=0;
}
function openCommunityGuide(){
 if(!isDesktopGameUi() || !$('communityGuideModal').classList.contains('hidden') || !$('gameIntroModal')?.classList.contains('hidden'))return;
 communityGuidePreviousFocus=document.activeElement;communityGuideStepIndex=0;
 $('communityGuideModal').classList.remove('hidden');renderCommunityGuide();
}
async function closeCommunityGuide(){
 if($('communityGuideModal').classList.contains('hidden'))return;
 $('communityGuideModal').classList.add('hidden');
 if(communityGuidePreviousFocus?.isConnected)communityGuidePreviousFocus.focus({preventScroll:true});
 if(!shouldShowCommunityIntro)return;
 shouldShowCommunityIntro=false;
 try{const response=await fetch('/api/account/community-intro-seen',{method:'POST'});if(!response.ok)throw new Error('Présentation non enregistrée.');}
 catch(error){console.error(error);}
}
$('communityGuideOpen')?.addEventListener('click',openCommunityGuide);
['communityGuideClose','communityGuideSkip'].forEach(id=>$(id)?.addEventListener('click',closeCommunityGuide));
$('communityGuidePrev')?.addEventListener('click',()=>{if(communityGuideStepIndex>0){communityGuideStepIndex--;renderCommunityGuide();}});
$('communityGuideNext')?.addEventListener('click',()=>{if(communityGuideStepIndex<communityGuideSteps.length-1){communityGuideStepIndex++;renderCommunityGuide();}else closeCommunityGuide();});
document.addEventListener('keydown',event=>{
 const modal=$('communityGuideModal');if(!modal || modal.classList.contains('hidden'))return;
 if(event.key==='Escape'){event.preventDefault();closeCommunityGuide();}
 if(event.key==='Tab')trapDesktopAdminFocus(event,modal);
});
window.matchMedia('(min-width:901px)').addEventListener('change',event=>{if(!event.matches)closeCommunityGuide();});
