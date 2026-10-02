let me = null;
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
}

async function refreshAccountState() {
  try {
    const response = await fetch('/api/account/me', { cache: 'no-store' });
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Impossible de charger le compte.');
    }

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
  const status = slotData.ready ? 'Incubation terminée.' : `Encore ${formatEggTime(Math.max(0, Number(incubatorData?.hatchSeconds || 21600) - Number(slotData.watchedSeconds || 0)))} avant l’éclosion.`;
  const pending = isStarter ? `<div class="incubator-pending">⚡ XP en attente : <strong>${Math.max(0, Number(slotData.pendingXp || 0)).toLocaleString('fr-FR')} XP</strong></div>` : '';
  el.innerHTML = `${incubatorEggMarkup()}<div class="incubator-slot-title">${title}</div><div class="incubator-slot-progress"><div class="incubator-progress-bar" style="width:${progress}%"></div></div><div class="incubator-time">${watched} / 6 h 00</div><div class="incubator-status">${status}</div>${pending}`;
}

function renderIncubatorSlots() {
  if (!incubatorData?.slots) return;
  incubatorData.slots.forEach(renderIncubatorSlot);
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
    incubatorShopTargetSlot = selectedIncubatorSlot;
    selectedIncubatorSlot = null;
    $('incubatorAddModal')?.classList.add('hidden');
    openShopForIncubatorEgg(incubatorShopTargetSlot);
    return;
  }
  $('incubatorAddModal')?.classList.remove('hidden');
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
    icon:'👋', title:'Bienvenue dans LoVeRDoSe !',
    text:'Ton temps de présence sur les lives fait progresser ton compte et alimente plusieurs systèmes du jeu.',
    tip:'Le tutoriel reste accessible à tout moment avec le bouton ⓘ en haut de la page.'
  },
  {
    icon:'🪪', title:'Ta carte joueur', target:'.player-visit-card',
    text:'Ici tu retrouves ton niveau global, ton grade, tes badges, ton profil et l’accès à ton inventaire.',
    tip:'Ton niveau global continue de progresser même pendant l’incubation d’un œuf.'
  },
  {
    icon:'🥚', title:'Œufs et incubateur', target:'.incubator-topbar',
    text:'Place tes œufs dans l’incubateur. Leur progression avance grâce à ta présence cumulée pendant les lives.',
    tip:'Les XP Lovys gagnés sans compagnon actif sont conservés dans ta réserve et seront utilisés lors de l’éclosion.'
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

function renderTutorialStep() {
  const step = tutorialSteps[Math.max(0, Math.min(tutorialSteps.length - 1, tutorialStepIndex))];
  clearTutorialFocus();
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
    setTimeout(() => target.scrollIntoView({ behavior:'smooth', block:'center' }), 60);
  }
}

function openGameTutorial({ restart = true } = {}) {
  if (restart) tutorialStepIndex = 0;
  $('gameIntroModal')?.classList.remove('hidden');
  renderTutorialStep();
}

function maybeShowGameIntro() {
  if (!shouldShowGameIntro || !me?.user || me.user.creature_id) return;
  openGameTutorial({ restart:true });
}

async function closeGameIntro({ markSeen = true } = {}) {
  clearTutorialFocus();
  $('gameIntroModal')?.classList.add('hidden');
  if (!markSeen || !shouldShowGameIntro) return;
  shouldShowGameIntro = false;
  try {
    await fetch('/api/account/intro-seen', { method:'POST' });
  } catch (error) {
    console.error('Erreur sauvegarde introduction :', error);
  }
}

$('infoButton')?.addEventListener('click', () => openGameTutorial({ restart:true }));
$('tutorialPrev')?.addEventListener('click', () => { if (tutorialStepIndex > 0) { tutorialStepIndex -= 1; renderTutorialStep(); } });
$('gameIntroClose')?.addEventListener('click', () => {
  if (tutorialStepIndex < tutorialSteps.length - 1) { tutorialStepIndex += 1; renderTutorialStep(); return; }
  closeGameIntro({ markSeen:true });
});
$('tutorialSkip')?.addEventListener('click', () => closeGameIntro({ markSeen:true }));
$('gameIntroModal')?.addEventListener('click', event => {
  if (event.target.id === 'gameIntroModal') closeGameIntro({ markSeen:true });
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
  summary.textContent = actions.length ? `${actions.length} action${actions.length > 1 ? 's' : ''} utile${actions.length > 1 ? 's' : ''} pour ton compte` : 'Tout est à jour pour le moment';
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
    button.disabled = true; button.textContent = 'Installé ✓'; status.textContent = 'LoVeRDoSe est déjà lancé comme une application.'; wrap?.classList.add('is-installed'); return;
  }
  button.disabled = false; wrap?.classList.remove('is-installed');
  if (deferredPwaInstallPrompt) { button.textContent = 'Installer'; status.textContent = 'Installation disponible sur cet appareil.'; }
  else if (isIosDevice()) { button.textContent = 'Voir comment'; status.textContent = 'Sur iPhone/iPad, l’installation se fait depuis le menu Partager de Safari.'; }
  else { button.textContent = 'Voir comment'; status.textContent = 'L’installation dépend du navigateur utilisé.'; }
}
function openPwaHelp() {
  const content = $('pwaHelpContent');
  if (!content) return;
  if (isIosDevice()) content.innerHTML = `<div class="pwa-help-step"><b>1.</b> Ouvre le jeu dans <b>Safari</b>.</div><div class="pwa-help-step"><b>2.</b> Appuie sur le bouton <b>Partager</b>.</div><div class="pwa-help-step"><b>3.</b> Choisis <b>Sur l’écran d’accueil</b>, puis confirme avec <b>Ajouter</b>.</div><div class="pwa-help-note">L’icône LoVeRDoSe apparaîtra avec tes applications et le jeu s’ouvrira dans une fenêtre dédiée.</div>`;
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
    : 'En t’abonnant à LoVeRDoSeTV, tu profites de bonus permanents pendant les lives et d’avantages exclusifs dans le Watch Game.';
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

function renderBadgeCollection() {
  const container = $('badgeCollectionContent');
  if (!container) return;

  const challenges = badgeData.challenges || [];
  const badges = badgeData.badges || [];
  const challengeKeys = new Set(challenges.map(challenge => challenge.badgeKey));
  const extraBadges = badges.filter(badge => !challengeKeys.has(badge.badgeKey));

  const categoryOf = challenge => {
    const badgeCategory = String(challenge.badgeCategory || '').toLowerCase();
    const missionType = String(challenge.missionType || '').toLowerCase();

    if (badgeCategory === 'social' || ['discord', 'instagram', 'tiktok'].includes(missionType)) return 'social';
    if (badgeCategory === 'support' || badgeCategory === 'soutien' || missionType === 'subscription') return 'support';
    if (badgeCategory === 'special' || badgeCategory === 'special-mode' || missionType === 'special-mode') return 'special';
    return 'watch';
  };

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
        </div>`).join('')}
    </div>` : '';

  const selectedHtml = badgeCollectionView === 'locked' ? lockedHtml : unlockedHtml;
  container.innerHTML = filterTabs + selectedHtml;

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

    const openSocial = async () => {
      const url = card.dataset.socialAction;
      if (!url || !challenge) return;

      if (challenge.socialNetwork === 'discord') {
        window.location.href = url;
        return;
      }

      // Instagram / TikTok : le clic est la condition de la mission.
      // On ouvre immédiatement le réseau dans un nouvel onglet puis on enregistre le badge.
      window.open(url, '_blank', 'noopener,noreferrer');

      try {
        const response = await fetch('/api/badges/social-click', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ network: challenge.socialNetwork })
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Impossible de débloquer le badge.');

        // Rafraîchit immédiatement toute l'interface après une mission sociale :
        // XP, badge, progression du joueur et classement, sans F5 manuel.
        await loadGame();
        await loadLeaderboard();
      } catch (error) {
        console.error('Erreur mission réseau social :', error);
      }
    };

    card.addEventListener('click', event => {
      if (event.target.closest('button')) return;
      openSocial();
    });
    card.addEventListener('keydown', event => {
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
  $('badgeCollectionModal')?.classList.add('hidden');
});


let badgeBackdropMouseDown = false;

$('badgeCollectionModal')?.addEventListener('mousedown', event => {
  badgeBackdropMouseDown = event.target.id === 'badgeCollectionModal';
});

$('badgeCollectionModal')?.addEventListener('mouseup', event => {
  if (badgeBackdropMouseDown && event.target.id === 'badgeCollectionModal') {
    $('badgeCollectionModal')?.classList.add('hidden');
  }
  badgeBackdropMouseDown = false;
});

$('badgeCollectionContent')?.addEventListener('click', event => {
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

function formatLeaderboardDuration(totalSeconds) {
  const seconds = Math.max(0, Number(totalSeconds) || 0);
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return `${hours} h ${String(minutes).padStart(2, '0')}`;
}

async function loadLeaderboard(searchTerm = null) {
  const container = $('leaderboard');
  const searchInput = $('leaderboardSearch');
  const query = searchTerm === null
    ? String(searchInput?.value || '').trim()
    : String(searchTerm || '').trim();

  try {
    const url = query
      ? `/api/leaderboard?search=${encodeURIComponent(query)}`
      : '/api/leaderboard';

    const response = await fetch(url, { cache: 'no-store' });
    const data = await response.json();

    if (!data.leaderboard || data.leaderboard.length === 0) {
      container.innerHTML = query
        ? '<div class="leaderboard-empty-search">Aucun joueur trouvé.</div>'
        : '<p class="muted">Aucun joueur pour le moment.</p>';
      return;
    }

    leaderboardPlayers = data.leaderboard;

    container.innerHTML = data.leaderboard.map((playerData, visibleIndex) => {
      let rank = '#' + playerData.rank;
      if (playerData.rank === 1) rank = '🥇';
      if (playerData.rank === 2) rank = '🥈';
      if (playerData.rank === 3) rank = '🥉';

      const selectedBadges = Array.isArray(playerData.leaderboard_badges)
        ? playerData.leaderboard_badges.slice(0, 2)
        : [];

      const badgesHtml = selectedBadges.length
        ? `<span class="leaderboard-badges">${selectedBadges.map(badge => {
            if (badge.badgeImage) {
              return `<img loading="lazy" decoding="async" class="leaderboard-badge-img" src="${escapeHtml(badge.badgeImage)}" alt="${escapeHtml(badge.badgeName || 'Badge')}" title="${escapeHtml(badge.badgeName || 'Badge')}">`;
            }
            return `<span class="leaderboard-badge-placeholder" title="${escapeHtml(badge.badgeName || 'Badge')}">🏅</span>`;
          }).join('')}</span>`
        : '';

      let progressionHtml = '';

      if (playerData.state === 'egg' && playerData.egg) {
        const egg = playerData.egg;
        const readyText = egg.ready
          ? '<strong>Prêt à éclore</strong>'
          : `<strong>${formatLeaderboardDuration(egg.watchedSeconds)}</strong> / 6 h · reste ${formatLeaderboardDuration(egg.remainingSeconds)}`;

        progressionHtml = `
          <div class="leaderboard-player-state">
            <span class="leaderboard-egg-mini" aria-hidden="true"></span>
            <div class="leaderboard-player-state-text">
              ${readyText}
              <div class="leaderboard-egg-progress"><span style="width:${Math.max(0, Math.min(100, Number(egg.progress) || 0))}%"></span></div>
            </div>
          </div>`;
      } else {
        const leaderboardCreature = playerData.creature_id ? creatureById(playerData.creature_id) : null;
        const leaderboardCreatureName = leaderboardCreature?.name || 'Lovys';
        const globalLevel = playerData.global_progression?.level || 1;
        const lovysLevel = playerData.progression?.level || 1;
        progressionHtml = `<div class="leaderboard-player-level">Niveau : ${globalLevel} · ${escapeHtml(leaderboardCreatureName)} · Niv. ${lovysLevel}</div>`;
      }

      const topClass = Number(playerData.rank) === 1 && !query ? ' top-one' : '';

      const leaderboardAvatarFrame = profileAvatarFrameStyle(playerData.cosmetic_avatar_frame);
      const twitchAvatarHtml = playerData.profile_image_url
        ? `<img loading="lazy" decoding="async" class="leaderboard-twitch-avatar" style="${escapeHtml(leaderboardAvatarFrame ? `border-color:${leaderboardAvatarFrame.border};box-shadow:${leaderboardAvatarFrame.shadow};` : '')}" src="${escapeHtml(playerData.profile_image_url)}" alt="">`
        : '';

      const leaderboardBg = profileBackgroundValue(playerData.cosmetic_background);
      const leaderboardFrame = profileFrameStyle(playerData.cosmetic_frame);
      const leaderboardCardStyle = `--profile-card-image:${leaderboardBg};${leaderboardFrame ? `border-color:${leaderboardFrame.border};box-shadow:${leaderboardFrame.shadow};` : ''}`;

      return `
        <div class="leaderboard-player-card${topClass}" role="button" tabindex="0" data-player-index="${visibleIndex}" aria-label="Voir le profil de ${escapeHtml(playerData.display_name)}" style="${escapeHtml(leaderboardCardStyle)}">
          <div class="leaderboard-player-card-inner">
            <div class="leaderboard-player-rank">${rank}</div>
            ${twitchAvatarHtml}
            <div class="leaderboard-player-info">
              <div class="leaderboard-player-name">${escapeHtml(playerData.display_name)}</div>
              ${playerData.cosmetic_title ? `<div class="leaderboard-player-title" style="color:${escapeHtml(playerData.cosmetic_title_color || '#d9c8ff')}">&quot;${escapeHtml(playerData.cosmetic_title)}&quot;</div>` : ''}
              ${progressionHtml}
            </div>
            ${badgesHtml}
          </div>
        </div>
      `;
    }).join('');

  } catch (error) {
    console.error('Erreur classement :', error);
    container.innerHTML = '<p class="muted">Impossible de charger le classement.</p>';
  }
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
    const transferHtml=d.hasCreature&&pendingLovysXp>0?`<div class="lovys-transfer-wrap"><div class="lovys-transfer-balance">⚡ ${pendingLovysXp.toLocaleString('fr-FR')} XP Lovys disponible en réserve</div><button id="transferLovysXpBtn" class="hub-btn lovys-transfer-button" type="button">Transférer l’XP à un Lovys</button></div>`:'';
    const lovysProgressHtml=d.hasCreature
      ? `<div class="lovys-progress-card"><div class="lovys-progress-head"><div class="lovys-progress-title">🐉 Progression du Lovys</div><span class="lovys-progress-level">Niv. ${lovysLevel}</span></div><div class="lovys-progress-meta"><span>${lovysInto.toLocaleString('fr-FR')} XP</span><span>${cp.maxLevel?'Niveau max':lovysNeed.toLocaleString('fr-FR')+' XP'}</span></div><div class="lovys-xp-bar"><span style="width:${lovysPercent}%"></span></div><div class="lovys-progress-note">XP totale du Lovys : ${lovysTotalXp.toLocaleString('fr-FR')} XP</div>${transferHtml}</div>`
      : `<div class="lovys-progress-card"><div class="lovys-progress-head"><div class="lovys-progress-title">${eggIconMarkup('egg-inline-icon title-inline-icon')}XP du futur Lovys</div><span class="lovys-progress-level">Réserve</span></div><div class="lovys-progress-meta"><span>XP en attente</span><span>${pendingLovysXp.toLocaleString('fr-FR')} XP</span></div><div class="lovys-progress-note">Cette XP reste en réserve. Après l’éclosion, tu pourras choisir de la transférer à ton Lovys avec confirmation.</div></div>`;
    box.innerHTML=`<section class="progression-report"><div class="progression-report-hero"><div class="progression-report-kicker">Rapport de progression</div><div class="progression-report-main"><div class="progression-rank-emblem" style="color:${escapeHtml(grade.color||'#c7b4ee')}">${escapeHtml(grade.icon||'◆')}</div><div><div class="progression-report-level">Niveau ${currentLevel}</div><div class="progression-report-grade" style="color:${escapeHtml(grade.color||'#c7b4ee')}">${escapeHtml(grade.name||'Recrue')}</div></div><div class="progression-report-prestige"><strong>${Number(d.prestige||0)}</strong><span>Prestige</span></div></div><div class="progression-xp-row"><div class="progression-xp-values"><span>${xpNow.toLocaleString('fr-FR')} XP</span><span>${xpNeed.toLocaleString('fr-FR')} XP</span></div><div class="progression-xp-bar"><span style="width:${percent}%"></span></div></div><div id="progressionLevelPreview" class="progression-preview-card"></div></div><div class="level-road-wrap"><div id="globalLevelRoad" class="level-road">${road}</div></div><div class="level-road-legend"><span class="level-road-hint">↔ Fais défiler la progression du niveau 1 au 55</span><span class="level-road-goal">🏆 Niv. 55 → Prestige</span></div></section>${lovysProgressHtml}${g.prestigeReady?'<div class="hub-actions"><button id="doPrestige" class="hub-btn">🏆 Passer Prestige</button></div>':''}<div class="progression-section-title">🏅 Grades et titres</div><div class="grade-grid">${grades}</div><div class="progression-section-title">🎁 XP Lovys débloquée par niveau global</div><div class="hub-sub">Certains niveaux globaux donnent un bonus d’XP à ton Lovys. Si ton œuf n’a pas encore éclos, l’XP est conservée en attente.</div><div class="milestone-grid">${lovysGlobalRewardList}</div><div class="progression-section-title">🐉 Futures récompenses du Lovys</div><div class="hub-sub">Ces paliers augmentent directement sa puissance en combat.</div><div class="milestone-grid">${milestones}</div><div class="progression-section-title">📜 Rapports de combat</div><div class="report-list">${reports}</div>`;
    requestAnimationFrame(()=>{const roadEl=$('globalLevelRoad'),currentEl=roadEl?.querySelector('.level-step.current'),previewEl=$('progressionLevelPreview');if(roadEl&&previewEl){const renderPreview=(level)=>{const info=previewForLevel(level);const actionHtml=info.previewTitle?`<div class="progression-preview-actions"><button id="progressionPreviewTitleBtn" class="shop-action secondary progression-preview-action" type="button">👁 Essayer sur ma carte</button></div>`:'';previewEl.innerHTML=`<div class="progression-preview-kicker">Prévisualisation du palier</div><div class="progression-preview-main"><div class="progression-preview-left"><div class="progression-preview-icon" style="color:${escapeHtml(info.color)}">${escapeHtml(info.icon)}</div><div class="progression-preview-text"><div class="progression-preview-title" style="color:${escapeHtml(info.color)}">${escapeHtml(info.title)}</div><div class="progression-preview-sub">${escapeHtml(info.sub)}</div></div></div><div class="progression-preview-right"><div class="progression-preview-tag">${escapeHtml(info.tag)}</div>${actionHtml}</div></div>`;roadEl.querySelectorAll('.level-step').forEach(step=>step.classList.toggle('previewing',Number(step.dataset.progressLevel)===Number(info.level)));const previewBtn=$('progressionPreviewTitleBtn');if(previewBtn&&info.previewTitle){previewBtn.addEventListener('click',()=>openProgressionTitlePreview(info));}};renderPreview(currentLevel);roadEl.querySelectorAll('.level-step').forEach(step=>{step.addEventListener('click',()=>renderPreview(Number(step.dataset.progressLevel||currentLevel)));});if(currentEl){roadEl.scrollLeft=Math.max(0,currentEl.offsetLeft-roadEl.clientWidth/2+currentEl.clientWidth/2);}if(window.matchMedia('(min-width:801px)').matches){let dragging=false,startX=0,startScroll=0;const stopDrag=()=>{dragging=false;roadEl.classList.remove('dragging');};roadEl.addEventListener('mousedown',e=>{if(e.button!==0)return;dragging=true;startX=e.clientX;startScroll=roadEl.scrollLeft;roadEl.classList.add('dragging');e.preventDefault();});window.addEventListener('mousemove',e=>{if(!dragging)return;roadEl.scrollLeft=startScroll-(e.clientX-startX);});window.addEventListener('mouseup',stopDrag,{once:false});roadEl.addEventListener('mouseleave',e=>{if(dragging&&!(e.buttons&1))stopDrag();});}}});
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
function renderLovysFragmentInventory(data){
  const universalBox=$('lovysUniversalFragments'),grid=$('lovysFragmentsGrid');
  if(!grid)return;
  const universal=Math.max(0,Number(data?.universalFragments||0));
  if(universalBox) universalBox.innerHTML=`<div class="lovys-universal-icon">🧩</div><div><div class="lovys-universal-label">Fragments universels</div><div class="lovys-universal-value">${universal.toLocaleString('fr-FR')}</div><div class="lovys-universal-help">Utilisables pour compléter jusqu’à 50 % du coût d’un rang. Ils sont surtout obtenus avec les doublons d’un Lovys déjà rang ⭐⭐⭐⭐⭐.</div></div>`;
  const withFragments=(data?.lovys||[]).filter(l=>Number(l.fragments||0)>0);
  if(!withFragments.length){
    grid.innerHTML='<div class="lovys-fragments-empty"><div>🧩</div><strong>Aucun fragment de Lovys pour le moment</strong><span>Quand un œuf donne un Lovys que tu possèdes déjà, le doublon est automatiquement transformé en fragments ici.</span></div>';
    return;
  }
  grid.innerHTML=withFragments.map(l=>{
    const p=lovysFragmentProgress(l),stars=lovysRankStars(l.rank),max=!p.cost;
    const universalNeeded=p.cost?Math.max(0,p.cost-p.specific):0;
    const universalCap=p.cost?Math.floor(p.cost/2):0;
    const helper=max?'Rang maximum atteint':l.canRankUp?(p.specific>=p.cost?'Assez de fragments spécifiques pour améliorer ce Lovys.':`Amélioration possible avec ${universalNeeded} fragment${universalNeeded>1?'s':''} universel${universalNeeded>1?'s':''}.`):p.specific>=Math.ceil(p.cost/2)?`Il manque ${p.missing} fragment${p.missing>1?'s':''}. Les universels peuvent en couvrir jusqu’à ${universalCap}.`:`Continue à obtenir des doublons de ${escapeHtml(l.name)}.`;
    return `<article class="lovys-fragment-card ${l.canRankUp?'ready':''}"><div class="lovys-fragment-art">${artForLovys(l.creatureId,l.evolution||0,true)}</div><div class="lovys-fragment-body"><div class="lovys-fragment-top"><div><div class="lovys-fragment-name">${escapeHtml(l.name)}</div><div class="lovys-fragment-rarity">${escapeHtml(l.rarity)} · ${escapeHtml(l.type)}</div></div><div class="lovys-fragment-rank">${stars}<span>Rang ${Number(l.rank||1)}/5</span></div></div><div class="lovys-fragment-balance-line"><strong>🧩 ${p.specific.toLocaleString('fr-FR')}</strong><span>${max?'MAX':`/ ${p.cost} pour le rang suivant`}</span></div>${max?'':`<div class="lovys-fragment-progress"><span style="width:${p.pct}%"></span></div>`}<div class="lovys-fragment-helper">${helper}</div>${max?'':`<button class="hub-btn lovys-fragment-rank-btn" type="button" data-rank-lovys="${Number(l.id)}" ${l.canRankUp?'':'disabled'}>⭐ Passer au rang ${Number(l.rank||1)+1}</button>`}</div></article>`;
  }).join('');
}
function renderLovysCollection(data){
  const grid=$('lovysCollectionGrid');
  const lovys=data?.lovys||[];
  if($('lovysCollectionCount')) $('lovysCollectionCount').textContent=String(lovys.length);
  const fragmentOwners=lovys.filter(l=>Number(l.fragments||0)>0).length;
  if($('lovysFragmentsCount')) $('lovysFragmentsCount').textContent=String(fragmentOwners);
  if(!grid)return;
  if(!lovys.length){grid.innerHTML='<div class="hub-sub">Aucun Lovys pour le moment. Fais éclore ton premier œuf.</div>';renderLovysFragmentInventory(data);renderLovysCollectionTabs();return;}
  grid.innerHTML=lovys.map(l=>{const st=l.stats||{};const stars=lovysRankStars(l.rank);const cost=Number(l.nextRankCost||0);return `<article class="lovys-collection-card ${l.isActive?'active':''}"><div class="lovys-collection-art">${artForLovys(l.creatureId,l.evolution||0,true)}</div><div class="lovys-collection-name">${escapeHtml(l.name)}</div><div class="lovys-rank">${stars} <span>Rang ${Number(l.rank||1)}/5</span></div><div class="lovys-collection-meta">${escapeHtml(l.type)} · ${escapeHtml(l.rarity)}<br>Niveau ${Number(l.level||1)} · ${Math.floor(Number(l.xp||0)).toLocaleString('fr-FR')} XP</div><div class="lovys-combat-stats"><span>❤️ ${Number(st.hp||0)}</span><span>⚔️ ${Number(st.attack||0)}</span><span>🛡️ ${Number(st.defense||0)}</span><span>⚡ ${Number(st.speed||0)}</span></div><div class="lovys-talent-box"><strong>${escapeHtml(l.talent?.icon||'✨')} ${escapeHtml(l.talent?.name||'Talent')}</strong><span>${escapeHtml(l.talent?.description||'')}</span></div><div class="lovys-fragment-line">🧩 ${Number(l.fragments||0)} fragment(s)${cost?` · prochain rang : ${cost}`:' · rang maximum'}</div>${l.isActive?'<div class="lovys-collection-active">Lovys actif</div>':''}<div class="lovys-collection-actions">${l.isActive?'':`<button class="hub-btn" type="button" data-activate-lovys="${l.id}">Rendre actif</button>`}${Number(data.pendingXp||0)>0?`<button class="hub-btn" type="button" data-transfer-lovys="${l.id}">⚡ Donner de l’XP</button>`:''}${cost?`<button class="hub-btn lovys-rank-btn" type="button" data-rank-lovys="${l.id}" ${l.canRankUp?'':'disabled'}>⭐ Rang suivant · ${cost} fragments</button>`:''}</div></article>`}).join('');
  renderLovysFragmentInventory(data);
  renderLovysCollectionTabs();
}
async function loadLovysCollection(){
  const grid=$('lovysCollectionGrid');
  const fragmentsGrid=$('lovysFragmentsGrid');
  if(grid) grid.innerHTML='<div class="hub-sub">Chargement…</div>';
  if(fragmentsGrid) fragmentsGrid.innerHTML='<div class="hub-sub">Chargement…</div>';
  try{
    const response=await fetch('/api/lovys',{cache:'no-store'});
    const data=await response.json();
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
  lovysCollectionTab=tab==='fragments'?'fragments':'collection';
  $('lovysCollectionModal')?.classList.remove('hidden');
  if(isMobileGameUi()) document.body.style.overflow='hidden';
  renderLovysCollectionTabs();
  await loadLovysCollection();
  syncMobileNavState?.();
}
function closeLovysCollection(){ $('lovysCollectionModal')?.classList.add('hidden'); if(isMobileGameUi())document.body.style.overflow=''; syncMobileNavState?.(); }
$('openLovysCollection')?.addEventListener('click',()=>openLovysCollection('collection'));
$('lovysCollectionClose')?.addEventListener('click',closeLovysCollection);
$('lovysCollectionModal')?.addEventListener('click',e=>{if(e.target.id==='lovysCollectionModal')closeLovysCollection();});
document.querySelectorAll('[data-lovys-tab]').forEach(btn=>btn.addEventListener('click',()=>{lovysCollectionTab=btn.dataset.lovysTab==='fragments'?'fragments':'collection';renderLovysCollectionTabs();}));
async function rankUpLovysFromButton(rankBtn){
  const lovysId=Number(rankBtn?.dataset.rankLovys||0);
  const chosen=(lovysCollectionData?.lovys||[]).find(l=>Number(l.id)===lovysId);
  if(!chosen)return;
  if(!confirm(`Améliorer ${chosen.name} pour ${Number(chosen.nextRankCost||0)} fragments ? Les fragments universels peuvent couvrir jusqu’à 50 % du coût si nécessaire.`))return;
  rankBtn.disabled=true;
  try{
    const r=await fetch('/api/lovys/rank-up',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({lovysId})});
    const d=await r.json();
    if(!r.ok){alert(d.error||'Amélioration impossible.');return;}
    alert(d.message||'Rang amélioré !');
    await loadGame();
    await loadLovysCollection();
    await loadPve();
  }finally{
    if(document.body.contains(rankBtn)) rankBtn.disabled=false;
  }
}
$('lovysCollectionGrid')?.addEventListener('click',async e=>{
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
let pveBattleState={running:false,battle:null,fight:null,lastResult:null,uiHp:{player:0,enemy:0}};
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
function pveBattleSetDisabled(disabled){$('pveBattleActions')?.querySelectorAll('button').forEach(btn=>btn.disabled=Boolean(disabled)||btn.dataset.cooldown==='1');}
function pveSkillButtonMarkup(skill,cooldown=0){if(!skill)return '';const cd=Math.max(0,Number(cooldown||0));return `<span>${escapeHtml(skill.icon||'✨')}</span><strong>${escapeHtml(skill.name||'Compétence')}</strong><small>${cd?`Recharge : ${cd} tour${cd>1?'s':''}`:escapeHtml(skill.description||'Prête')}</small>`;}
function renderPveBattleActions(){const battle=pveBattleState.battle;if(!battle)return;const skills=battle.player?.skills||[];const cooldowns=battle.player?.cooldowns||{};[$('pveSkill1'),$('pveSkill2')].forEach((btn,i)=>{if(!btn)return;const skill=skills[i];if(!skill){btn.classList.add('hidden');return;}btn.classList.remove('hidden');const cd=Math.max(0,Number(cooldowns[skill.key]||0));btn.dataset.battleAction=skill.key;btn.dataset.cooldown=cd>0?'1':'0';btn.innerHTML=pveSkillButtonMarkup(skill,cd);btn.disabled=cd>0;});}
function renderPveBattleEffects(){const b=pveBattleState.battle;if(!b)return;const chips=[];if(b.player?.talent)chips.push(`<span class="pve-effect-chip player">${escapeHtml(b.player.talent.icon||'✨')} ${escapeHtml(b.player.talent.name||'Talent')}</span>`);if(b.enemy?.mechanic)chips.push(`<span class="pve-effect-chip boss">👑 ${escapeHtml(b.enemy.mechanic.name||'Mécanique')}</span>`);$('pveBattleEffects').innerHTML=chips.join('');}
function syncPveBattleUi(battle){if(!battle)return;pveBattleState.battle=battle;setPveHp('pveBattlePlayer',battle.player.hp,battle.player.maxHp);setPveHp('pveBattleEnemy',battle.enemy.hp,battle.enemy.maxHp);pveBattleState.uiHp={player:Number(battle.player.hp||0),enemy:Number(battle.enemy.hp||0)};$('pveBattleRound').textContent=battle.status==='active'?`Tour ${Number(battle.round||1)}`:'Combat terminé';$('pveBattlePlayerStats').textContent=`Niv. ${battle.player.level||1} · Rang ${battle.player.rank||1} · ⚔️ ${battle.player.attack||0} · 🛡️ ${battle.player.defense||0} · ⚡ ${battle.player.speed||0}`;$('pveBattleEnemyStats').textContent=`Niv. ${battle.enemy.level||1} · ⚔️ ${battle.enemy.attack||0} · 🛡️ ${Math.round(Number(battle.enemy.defense||0))} · ⚡ ${Math.round(Number(battle.enemy.speed||0))}`;renderPveBattleActions();renderPveBattleEffects();}
function openPveTacticalBattle(fight,battle){const overlay=$('pveBattleOverlay');if(!overlay||!battle)return;pveBattleState={running:false,battle,fight,lastResult:null,uiHp:{player:Number(battle.player.hp||0),enemy:Number(battle.enemy.hp||0)}};$('pveBattleTitle').textContent=`⚔️ ${fight?.boss?'Boss · ':''}${fight?.name||battle.enemy?.name||'Combat'}`;$('pveBattlePlayerName').textContent=battle.player?.name||'Lovys';$('pveBattlePlayerSprite').innerHTML=me?.user?.creature_id?art(me.user.creature_id,me.user.progression?.evolution||0,true):'🐉';$('pveBattleEnemyName').textContent=battle.enemy?.name||fight?.name||'Ennemi';const ev=pveEnemyVisual(fight||{}),stage=overlay.querySelector('.pve-battle-stage');if(stage){stage.classList.remove('zone-forest','zone-ember','zone-night');stage.classList.add(`zone-${ev.zone}`);}$('pveBattleEnemySprite').innerHTML=pveEnemySpriteMarkup(fight||{});$('pveBattleResult').classList.remove('active');$('pveBattleLog').textContent=`${battle.player?.name||'Ton Lovys'} est prêt. Choisis une action.`;syncPveBattleUi(battle);overlay.classList.remove('hidden');requestAnimationFrame(()=>overlay.classList.add('active'));}
async function animatePveBattleEvents(events=[]){for(const event of events){$('pveBattleLog').textContent=event.message||'Combat…';const target=event.target==='player'?'player':event.target==='enemy'?'enemy':null;if(event.type==='damage'&&target){const el=target==='player'?$('pveBattlePlayer'):$('pveBattleEnemy');const attacker=event.source==='enemy'?$('pveBattleEnemy'):$('pveBattlePlayer');attacker?.classList.add('attacking');await pveWait(150);attacker?.classList.remove('attacking');el?.classList.add('hit');const key=target==='player'?'player':'enemy';pveBattleState.uiHp[key]=Math.max(0,pveBattleState.uiHp[key]-Number(event.amount||0));pveDamagePop(target==='player'?'pveBattlePlayerDamage':'pveBattleEnemyDamage',event.amount);const b=pveBattleState.battle;setPveHp(target==='player'?'pveBattlePlayer':'pveBattleEnemy',pveBattleState.uiHp[key],target==='player'?b.player.maxHp:b.enemy.maxHp);await pveWait(300);el?.classList.remove('hit');}else if(event.type==='heal'&&target){const key=target;pveBattleState.uiHp[key]+=Number(event.amount||0);const b=pveBattleState.battle;pveBattleState.uiHp[key]=Math.min(target==='player'?b.player.maxHp:b.enemy.maxHp,pveBattleState.uiHp[key]);setPveHp(target==='player'?'pveBattlePlayer':'pveBattleEnemy',pveBattleState.uiHp[key],target==='player'?b.player.maxHp:b.enemy.maxHp);await pveWait(260);}else{await pveWait(event.type==='boss'?500:300);}}}
async function submitPveBattleAction(action){if(pveBattleState.running||!pveBattleState.battle)return;pveBattleState.running=true;pveBattleSetDisabled(true);try{const r=await fetch('/api/pve/action',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action})});const d=await r.json();if(!r.ok)throw new Error(d.error||'Action impossible.');await animatePveBattleEvents(d.events||[]);syncPveBattleUi(d.battle);pveBattleState.lastResult=d;if(d.finished){const victory=Boolean(d.victory);$('pveBattleResultIcon').textContent=victory?'🏆':'💥';$('pveBattleResultTitle').textContent=victory?'Victoire !':'Défaite';$('pveBattleResultCopy').textContent=victory?`${d.battle.player.name} remporte le combat en ${Number(d.rounds||d.battle.round||1)} tour(s).`:`${d.battle.player.name} a été vaincu. Essaie un autre Lovys, améliore son rang ou fais-le progresser.`;const rw=d.reward||{};$('pveBattleResultReward').textContent=victory&&d.firstWin?`Première victoire : +${Number(rw.creatureXp||0)} XP Lovys · +${Number(rw.globalXp||0)} XP globale · +${Number(rw.fragments||0)} fragment(s) d’œuf`:victory?'Combat rejoué : aucune nouvelle récompense de première victoire.':'';$('pveBattleResult').classList.add('active');}else{$('pveBattleLog').textContent='Choisis ta prochaine action.';}}catch(error){alert(error.message);}finally{pveBattleState.running=false;if(!pveBattleState.lastResult?.finished)pveBattleSetDisabled(false);}}
async function closePveBattleAnimation(){const result=pveBattleState.lastResult, fightKey=pveBattleState.fight?.key;const overlay=$('pveBattleOverlay');overlay?.classList.remove('active');setTimeout(()=>overlay?.classList.add('hidden'),180);pveBattleState={running:false,battle:null,fight:null,lastResult:null,uiHp:{player:0,enemy:0}};if(result?.victory&&fightKey)await animatePveVictory(fightKey,result);else{await loadGame();await loadLovysCollection();await loadPve();}}
$('pveBattleActions')?.addEventListener('click',e=>{const btn=e.target.closest('[data-battle-action]');if(!btn||btn.disabled)return;submitPveBattleAction(btn.dataset.battleAction);});
$('pveBattleContinue')?.addEventListener('click',closePveBattleAnimation);
$('pveBattleAbandon')?.addEventListener('click',async()=>{if(!pveBattleState.battle)return;if(!confirm('Abandonner ce combat ? Aucune récompense ne sera donnée.'))return;await fetch('/api/pve/abandon',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});const overlay=$('pveBattleOverlay');overlay?.classList.remove('active');setTimeout(()=>overlay?.classList.add('hidden'),180);pveBattleState={running:false,battle:null,fight:null,lastResult:null,uiHp:{player:0,enemy:0}};});
$('openProgression')?.addEventListener('click',()=>{$('progressionModal')?.classList.remove('hidden');loadProgression();syncMobileNavState?.();});$('progressionClose')?.addEventListener('click',()=>{$('progressionModal')?.classList.add('hidden');syncMobileNavState?.();});$('openPve')?.addEventListener('click',()=>{$('pveModal')?.classList.remove('hidden');loadPve();syncMobileNavState?.();});$('pveClose')?.addEventListener('click',()=>{$('pveModal')?.classList.add('hidden');syncMobileNavState?.();});
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
$('pveModal')?.addEventListener('click',e=>{if(e.target.id==='pveModal'){$('pveModal')?.classList.add('hidden');syncMobileNavState?.();}});
let progressionBackdropMouseDown=false;
$('progressionModal')?.addEventListener('mousedown',event=>{ progressionBackdropMouseDown=event.target.id==='progressionModal'; });
$('progressionModal')?.addEventListener('mouseup',event=>{
  if(progressionBackdropMouseDown && event.target.id==='progressionModal'){
    $('progressionModal')?.classList.add('hidden');
    syncMobileNavState?.();
  }
  progressionBackdropMouseDown=false;
});


function isMobileGameUi(){ return window.matchMedia('(max-width:900px)').matches; }
function setMobileNavActive(id){ document.querySelectorAll('.mobile-game-nav-btn').forEach(btn=>btn.classList.toggle('active',btn.id===id)); }
function getSelfLeaderboardPlayer(){ return (leaderboardPlayers||[]).find(player=>String(player.twitch_id||'')===String(me?.user?.twitch_id||'')); }
function isMobileEggDetailsOpen(){ return Boolean($('pick')?.classList.contains('egg-details-open')); }
function isMobilePanelOpen(panel){
  if(panel==='combat') return !$('pveModal')?.classList.contains('hidden');
  if(panel==='inventory') return !$('inventoryModal')?.classList.contains('hidden');
  if(panel==='profile') return !$('playerProfileModal')?.classList.contains('hidden');
  if(panel==='progression') return !$('progressionModal')?.classList.contains('hidden');
  if(panel==='creatures') return isMobileEggDetailsOpen() || !$('lovysCollectionModal')?.classList.contains('hidden');
  return false;
}
function syncMobileNavState(){
  if(!isMobileGameUi()) return;
  if(!$('pveModal')?.classList.contains('hidden')) return setMobileNavActive('mobileNavCombat');
  if(!$('inventoryModal')?.classList.contains('hidden')) return setMobileNavActive('mobileNavInventory');
  if(!$('playerProfileModal')?.classList.contains('hidden')) return setMobileNavActive('mobileNavProfile');
  if(isMobileEggDetailsOpen() || !$('lovysCollectionModal')?.classList.contains('hidden')) return setMobileNavActive('mobileNavCreatures');
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
function closeAllMobilePanels(except=''){
  if(!isMobileGameUi()) return;
  if(except!=='combat') $('pveModal')?.classList.add('hidden');
  if(except!=='inventory') $('inventoryModal')?.classList.add('hidden');
  if(except!=='profile') $('playerProfileModal')?.classList.add('hidden');
  if(except!=='progression') $('progressionModal')?.classList.add('hidden');
  if(except!=='creatures'){ $('pick')?.classList.remove('egg-details-open'); $('lovysCollectionModal')?.classList.add('hidden'); }
  $('dailyChallengeDetailModal')?.classList.add('hidden');
  document.body.style.overflow='';
}
function toggleMobilePanel(panel){
  if(!isMobileGameUi()) return;
  const alreadyOpen = isMobilePanelOpen(panel);
  closeAllMobilePanels(alreadyOpen ? '' : panel);
  if(alreadyOpen){
    syncMobileNavState();
    return;
  }
  if(panel==='combat'){
    $('pveModal')?.classList.remove('hidden');
    loadPve();
  } else if(panel==='inventory'){
    openInventory();
  } else if(panel==='profile'){
    const selfPlayer = getSelfLeaderboardPlayer();
    if(selfPlayer) openPlayerProfile(selfPlayer);
    else document.querySelector('.player-visit-card')?.scrollIntoView({behavior:'smooth',block:'start'});
  } else if(panel==='progression'){
    $('progressionModal')?.classList.remove('hidden');
    loadProgression();
  } else if(panel==='creatures'){
    if(me?.user?.creature_id){
      openLovysCollection();
    } else {
      openMobileEggDetails();
    }
  }
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
$('mobileNavHome')?.addEventListener('click',()=>{ if(!isMobileGameUi())return; closeAllMobilePanels(''); syncMobileNavState(); document.querySelector('.player-visit-card')?.scrollIntoView({behavior:'smooth',block:'start'}); });
$('mobileNavCombat')?.addEventListener('click',()=>{ if(!isMobileGameUi())return; toggleMobilePanel('combat'); });
$('mobileNavCreatures')?.addEventListener('click',()=>{ if(!isMobileGameUi())return; toggleMobilePanel('creatures'); });
$('mobileNavInventory')?.addEventListener('click',()=>{ if(!isMobileGameUi())return; toggleMobilePanel('inventory'); });
$('mobileNavProfile')?.addEventListener('click',()=>{ if(!isMobileGameUi())return; toggleMobilePanel('profile'); });
window.matchMedia('(max-width:900px)').addEventListener?.('change',e=>{ if(!e.matches){ closeAllMobilePanels(''); setMobileNavActive('mobileNavHome'); } else { syncMobileNavState(); } });
document.addEventListener('keydown',e=>{ if(e.key==='Escape'){ if($('pick')?.classList.contains('egg-details-open')){ $('pick').classList.remove('egg-details-open'); document.body.style.overflow=''; } if(!$('incubatorAddModal')?.classList.contains('hidden')) closeIncubatorAddModal(); } });

const leaderboardSearchInput = $('leaderboardSearch');
if (leaderboardSearchInput) {
  leaderboardSearchInput.addEventListener('input', () => {
    clearTimeout(leaderboardSearchTimer);
    leaderboardSearchTimer = setTimeout(() => loadLeaderboard(), 220);
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
$('playerProfileModal')?.addEventListener('mouseup', event => { if (playerProfileBackdropMouseDown && event.target.id === 'playerProfileModal') closePlayerProfile(); playerProfileBackdropMouseDown = false; });

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
let shopTitleFilter = 'all';
let shopBackgroundFilter = 'all';
let shopFrameFilter = 'all';
let shopAvatarFrameFilter = 'all';
let shopPreviewCurrentKey = null;
let shopFocusItemKey = null;
let inventoryCategory = 'title';
let inventoryTitleFilter = 'all';

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
  if (includePreview) buttons.push(`<button class="shop-action secondary" type="button" data-shop-preview="${escapeHtml(item.key)}">👁 Prévisualiser</button>`);

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

function renderShopPreviewVisual(item) {
  if (item.category === 'object') {
    const objectVisual = item.key === 'mystery_egg'
      ? `<span class="shop-preview-egg-premium" aria-label="Œuf mystère"></span>`
      : `<div class="shop-preview-object-large">${escapeHtml(item.icon || '🎁')}</div>`;
    return `<div class="shop-preview-object-stage">${objectVisual}<div class="shop-preview-object-title">${escapeHtml(item.name)}</div><div class="shop-preview-object-copy">${escapeHtml(item.description || '')}</div></div>`;
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
  const allCategoryItems = sortCatalogItems((shopData.catalog || []).filter(item => item.category === shopCategory && !(item.category === 'title' && item.rewardOnly)), shopCategory);
  let items = allCategoryItems;
  if (shopCategory === 'title' && shopTitleFilter !== 'all') {
    items = allCategoryItems.filter(item => getTitleColorGroup(item) === shopTitleFilter);
  } else if (shopCategory === 'background' && shopBackgroundFilter !== 'all') {
    items = allCategoryItems.filter(item => String(item.subcategory || 'classic') === shopBackgroundFilter);
  } else if (shopCategory === 'frame' && shopFrameFilter !== 'all') {
    items = allCategoryItems.filter(item => String(item.subcategory || 'classic') === shopFrameFilter);
  } else if (shopCategory === 'avatar_frame' && shopAvatarFrameFilter !== 'all') {
    items = allCategoryItems.filter(item => String(item.subcategory || 'classic') === shopAvatarFrameFilter);
  }
  $('shopGrid').innerHTML = items.map(item => {
    const price = item.rewardOnly ? 'Récompense à débloquer' : (item.exclusive ? 'Exclusif' : `${Math.floor(Number(item.price || 0))} LoVeR'Cash`);
    const actions = getShopActionButtons(item, { includePreview: true });
    const activeUntil = shopData.activeBoosts?.[item.key];
    const activeText = activeUntil ? `<div class="shop-owned">Actif jusqu’à ${new Date(activeUntil).toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'})}</div>` : '';
    const ownedText = item.category === 'object'
      ? (Number(item.quantity || 0) > 0 ? `<span class="shop-qty">Possédé : ${Number(item.quantity)}</span>` : '')
      : (item.owned || item.exclusive ? '<span class="shop-owned">Possédé</span>' : '');
    return `<article class="shop-item${item.equipped ? ' equipped' : ''}${item.comingSoon ? ' coming-soon' : ''}${shopFocusItemKey === item.key ? ' shop-focus' : ''}" data-shop-item-key="${escapeHtml(item.key)}">
      ${shopPreview(item)}
      <div class="shop-item-name">${escapeHtml(item.name)}</div>
      <div class="shop-item-desc">${escapeHtml(item.description || '')}</div>
      <div class="shop-item-meta"><span class="shop-price">${escapeHtml(price)}</span>${ownedText}</div>
      ${activeText}
      <div class="shop-actions">${actions}</div>
    </article>`;
  }).join('') || '<div class="muted">Aucun article dans cette catégorie.</div>';

  document.querySelectorAll('[data-shop-category]').forEach(button => button.classList.toggle('active', button.dataset.shopCategory === shopCategory));
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
  const items = inventoryOwnedItems();
  $('inventoryCount').textContent = `${items.length} article${items.length > 1 ? 's' : ''} dans cette catégorie`;

  document.querySelectorAll('[data-inventory-category]').forEach(button => {
    button.classList.toggle('active', button.dataset.inventoryCategory === inventoryCategory);
  });

  if (!items.length) {
    grid.innerHTML = `<div class="inventory-empty">Tu ne possèdes encore aucun article dans cette catégorie.</div>`;
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

    return `<article class="inventory-item${item.equipped ? ' equipped' : ''}">
      ${shopPreview(item)}
      <div class="inventory-item-name">${escapeHtml(item.name)}</div>
      <div class="inventory-item-desc">${escapeHtml(item.description || '')}</div>
      <div class="inventory-item-meta">${possession}</div>
      <div class="inventory-actions">
        <button class="shop-action secondary" type="button" data-inventory-preview="${escapeHtml(item.key)}">👁 Prévisualiser</button>
        ${action}
      </div>
    </article>`;
  }).join('');
}

async function openInventory() {
  $('inventoryModal')?.classList.remove('hidden');
  try {
    await loadShop();
    renderInventory();
  } catch (error) {
    $('inventoryGrid').innerHTML = `<div class="inventory-empty">Impossible de charger l’inventaire.</div>`;
  }
}

function closeInventory() {
  $('inventoryModal')?.classList.add('hidden');
  syncMobileNavState?.();
}

async function loadShop() {
  const response = await fetch('/api/shop', { cache:'no-store' });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Impossible de charger la boutique.');
  shopData = data;
  renderShop();
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
  shopFocusItemKey = null;
  incubatorShopTargetSlot = null;
  $('shopModal')?.classList.remove('hidden');
  setShopMessage();
  try { await loadShop(); } catch (error) { setShopMessage(error.message, 'error'); }
}

async function shopAction(url, itemKey) {
  setShopMessage();
  try {
    const response = await fetch(url, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ itemKey }) });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Action impossible.');
    setShopMessage(data.message || 'Action effectuée.', 'ok');
    await loadShop();
    await loadGame();
    await loadLeaderboard();
    if (!$('inventoryModal')?.classList.contains('hidden')) renderInventory();
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
  }
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
$('inventoryClose')?.addEventListener('click', closeInventory);

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
  if (preview) openShopItemPreview(preview.dataset.inventoryPreview);
  else if (equip) shopAction('/api/shop/equip', equip.dataset.inventoryEquip);
  else if (unequip) shopAction('/api/shop/unequip', unequip.dataset.inventoryUnequip);
  else if (use) shopAction('/api/shop/use', use.dataset.inventoryUse);
});

let inventoryBackdropMouseDown = false;
$('inventoryModal')?.addEventListener('mousedown', event => { inventoryBackdropMouseDown = event.target.id === 'inventoryModal'; });
$('inventoryModal')?.addEventListener('mouseup', event => { if (inventoryBackdropMouseDown && event.target.id === 'inventoryModal') closeInventory(); inventoryBackdropMouseDown = false; });

$('shopGrid')?.addEventListener('click', event => {
  const preview = event.target.closest('[data-shop-preview]');
  const buy = event.target.closest('[data-shop-buy]');
  const equip = event.target.closest('[data-shop-equip]');
  const use = event.target.closest('[data-shop-use]');
  if (preview) openShopItemPreview(preview.dataset.shopPreview);
  else if (buy) shopAction('/api/shop/buy', buy.dataset.shopBuy);
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

$('shopClose')?.addEventListener('click', () => { $('shopModal')?.classList.add('hidden'); closeShopItemPreview(); shopFocusItemKey=null; incubatorShopTargetSlot=null; });
$('shopItemPreviewClose')?.addEventListener('click', closeShopItemPreview);
$('shopItemPreviewActions')?.addEventListener('click', event => {
  const buy = event.target.closest('[data-shop-buy]');
  const equip = event.target.closest('[data-shop-equip]');
  const use = event.target.closest('[data-shop-use]');
  if (buy) shopAction('/api/shop/buy', buy.dataset.shopBuy);
  else if (equip) shopAction('/api/shop/equip', equip.dataset.shopEquip);
  else if (use) shopAction('/api/shop/use', use.dataset.shopUse);
});
let shopBackdropMouseDown = false;
$('shopModal')?.addEventListener('mousedown', event => { shopBackdropMouseDown = event.target.id === 'shopModal'; });
$('shopModal')?.addEventListener('mouseup', event => { if (shopBackdropMouseDown && event.target.id === 'shopModal') { $('shopModal')?.classList.add('hidden'); closeShopItemPreview(); shopFocusItemKey=null; incubatorShopTargetSlot=null; } shopBackdropMouseDown = false; });
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
  'Bon retour dans le Watch Game. Ton monstre t’attend !',
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
    const specialModeLine = zombieMode
      ? '🧟 Mode spécial : Zombie ACTIVÉ'
      : '';

    const trackerDetailText = data.error
      ? `Dernière erreur : ${data.error}`
      : data.live
        ? `${chatters} personne(s) dans le chat · ${matched} compte(s) Watch Game reconnu(s).`
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
    const response = await fetch('/api/events/special-mode', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode: nextMode })
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Modification impossible');
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
        <div>
          ${player.isBroadcaster
            ? '<button class="admin-player-delete" type="button" disabled>Compte admin</button>'
            : `<button class="admin-player-delete" type="button" data-delete-account="${player.accountId}" data-delete-username="${escapeHtml(player.username || 'ce joueur')}">🗑 Supprimer</button>`}
        </div>
      </div>`;
  }).join('');
}

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
}

$('adminPlayersButton')?.addEventListener('click', openAdminPlayersModal);
$('adminPlayersClose')?.addEventListener('click', closeAdminPlayersModal);
$('adminPlayersModal')?.addEventListener('click', event => {
  if (event.target.id === 'adminPlayersModal') closeAdminPlayersModal();
});
$('adminPlayersSearch')?.addEventListener('input', () => {
  clearTimeout(adminPlayersSearchTimer);
  adminPlayersSearchTimer = setTimeout(loadAdminPlayers, 250);
});
$('adminPlayersList')?.addEventListener('click', async event => {
  const button = event.target.closest('[data-delete-account]');
  if (!button) return;

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
        discordHelp.textContent = 'Ton compte Discord reste lié à ton compte Watch Game.';
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
        discordHelp.textContent = 'Connecte Discord une seule fois pour le lier à ton compte Watch Game.';
        discordConnect.textContent = 'Connecter Discord';
      }
    }

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
$('accountClose')?.addEventListener('click', closeAccountModal);

let accountBackdropMouseDown = false;
$('accountModal')?.addEventListener('mousedown', event => {
  accountBackdropMouseDown = event.target.id === 'accountModal';
});
$('accountModal')?.addEventListener('mouseup', event => {
  if (accountBackdropMouseDown && event.target.id === 'accountModal') {
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
    message: "Ton compte Watch Game, ton lien Twitch, ton monstre, ton XP, ton LoVeR'Cash et ton temps de jeu seront supprimés définitivement. Cette action est irréversible.",
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
  if (!window.EventSource || liveUpdates) return;

  liveUpdates = new EventSource('/api/live-updates');
  liveUpdates.addEventListener('tracker-update', refreshLiveGameState);
  liveUpdates.addEventListener('challenge-update', refreshLiveGameState);
  liveUpdates.addEventListener('shop-update', refreshLiveGameState);
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
    navigator.serviceWorker.register('/service-worker.js?v=106').catch(error => console.warn('Service worker non disponible :', error));
  });
}

startLiveUpdates();

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
