(() => {
  'use strict';
  const panel = document.querySelector('[data-live-xp-boost]');
  if (!panel) return;

  const isOverlay = document.body.classList.contains('boost-overlay-page');
  let hideTimer = null, revealFrame = 0;
  function setVisibility(show) {
    if (!isOverlay) { panel.hidden = !show; return; }
    if (show) {
      if (hideTimer !== null) { clearTimeout(hideTimer); hideTimer = null; }
      if (panel.hidden) {
        panel.hidden = false;
        // Deux images assurent que le fondu part bien d'une opacité nulle.
        revealFrame = requestAnimationFrame(() => {
          revealFrame = requestAnimationFrame(() => {
            panel.classList.add('is-visible');
            revealFrame = 0;
          });
        });
      } else if (!revealFrame) { panel.classList.add('is-visible'); }
    } else {
      if (revealFrame) { cancelAnimationFrame(revealFrame); revealFrame = 0; }
      panel.classList.remove('is-visible');
      if (!panel.hidden && hideTimer === null) {
        hideTimer = setTimeout(() => { panel.hidden = true; hideTimer = null; }, 550);
      }
    }
  }

  const labels = { xp:'XP Lovys', cash:'LoVeR’Cash', globalXp:'XP globale' };
  const icons = { xp:'⚡', cash:'💰', globalXp:'⭐' };
  let boosts = [], clockOffset = 0, pending = false, queued = false, signalRevision = 0;
  const timer = panel.querySelector('[data-boost-countdown]');
  const copy = panel.querySelector('.live-xp-boost-copy');
  const list = document.createElement('span');
  list.className = 'live-boost-list';
  list.hidden = true;
  copy.appendChild(list);
  const format = remaining => {
    const h = Math.floor(remaining / 3600), m = Math.floor(remaining / 60) % 60, s = remaining % 60;
    return (h ? String(h).padStart(2,'0') + ':' : '') + String(m).padStart(2,'0') + ':' + String(s).padStart(2,'0');
  };
  function render() {
    const now = Date.now() + clockOffset;
    const active = boosts.map(item => ({ ...item, remaining:Math.max(0,Math.ceil((item.end-now)/1000)) })).filter(item=>item.remaining>0);
    setVisibility(active.length > 0);
    if (!active.length) return;
    const multiple = active.length > 1;
    panel.classList.toggle('has-multiple-boosts', multiple);
    panel.querySelector('.live-xp-boost-icon').textContent = multiple ? '🔥' : icons[active[0].key];
    copy.querySelector('strong').textContent = multiple ? 'Boosts du live' : labels[active[0].key] + ' ×' + active[0].multiplier;
    copy.querySelector('small').hidden = multiple;
    timer.hidden = multiple;
    list.hidden = !multiple;
    if (multiple) {
      list.innerHTML = active.map(item => `<span><b>${labels[item.key]} ×${item.multiplier}</b><time>${format(item.remaining)}</time></span>`).join('');
    } else { timer.textContent = format(active[0].remaining); }
    panel.querySelector('[data-boost-progress]').style.width = Math.min(100,Math.min(...active.map(item=>item.remaining))/36) + '%';
  }
  function applyStatus(data, started=Date.now()) {
    const serverNow=Number(data.serverNow);
    if(Number.isFinite(serverNow))clockOffset=serverNow-(started+Date.now())/2;
    const items=Array.isArray(data.items)?data.items:data.active?[{key:'xp',multiplier:data.multiplier||2,expiresAt:data.expiresAt}]:[];
    const seen=new Set();
    boosts=items.filter(item=>Object.hasOwn(labels,item.key)&&!seen.has(item.key)&&seen.add(item.key))
      .map(item=>({key:item.key,multiplier:Math.max(1,Math.min(3,Number(item.multiplier)||1)),end:Date.parse(item.expiresAt)||0})).filter(item=>item.multiplier>1);
    render();
  }
  async function refresh() {
    if (pending) { queued = true; return; }
    pending = true;
    const started = Date.now(), revision=signalRevision;
    const controller=new AbortController();
    const timeout=setTimeout(()=>controller.abort(),4000);
    try {
      const response = await fetch('/api/game/live-xp-boost', { cache:'no-store', credentials:'omit', signal:controller.signal });
      if (!response.ok) return;
      const data = await response.json();
      if(revision===signalRevision)applyStatus(data,started);
    } catch (_) { /* Le décompte continue à partir des échéances connues. */ }
    finally { clearTimeout(timeout);pending=false; if (queued) { queued=false; refresh(); } }
  }
  if (document.body.classList.contains('boost-overlay-page') && window.EventSource) {
    const events = new window.EventSource('/api/game/live-xp-boost/events');
    events.addEventListener('boost-change',event=>{
      signalRevision++;
      try{const data=JSON.parse(event.data);if(Array.isArray(data.items)){applyStatus(data);return;}}catch{}
      refresh();
    });
    events.addEventListener('connected', refresh);
  }
  window.refreshLiveXpBoost = refresh;
  setInterval(render,1000);
  // OBS conserve une réaction rapide même si le proxy interrompt le flux temps réel.
  setInterval(refresh,isOverlay?1000:10000);
  window.addEventListener('online',refresh);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh();});
  refresh();
})();
