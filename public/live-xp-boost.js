(() => {
  'use strict';
  const panel = document.querySelector('[data-live-xp-boost]');
  if (!panel) return;
  const labels = { xp:'XP Lovys', cash:'LoVeR’Cash', globalXp:'XP globale' };
  const icons = { xp:'⚡', cash:'💰', globalXp:'⭐' };
  let boosts = [], clockOffset = 0, pending = false, queued = false;
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
    panel.hidden = active.length === 0;
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
  async function refresh() {
    if (pending) { queued = true; return; }
    pending = true;
    const started = Date.now();
    try {
      const response = await fetch('/api/game/live-xp-boost', { cache:'no-store', credentials:'omit' });
      if (!response.ok) return;
      const data = await response.json();
      const serverNow = Number(data.serverNow);
      if (Number.isFinite(serverNow)) clockOffset = serverNow - (started+Date.now())/2;
      const items = Array.isArray(data.items) ? data.items : data.active ? [{key:'xp',multiplier:data.multiplier||2,expiresAt:data.expiresAt}] : [];
      const seen = new Set();
      boosts = items.filter(item=>Object.hasOwn(labels,item.key) && !seen.has(item.key) && seen.add(item.key))
        .map(item=>({key:item.key,multiplier:Math.max(1,Math.min(3,Number(item.multiplier)||1)),end:Date.parse(item.expiresAt)||0})).filter(item=>item.multiplier>1);
      render();
    } catch (_) { /* Le décompte continue à partir des échéances connues. */ }
    finally { pending=false; if (queued) { queued=false; refresh(); } }
  }
  if (document.body.classList.contains('boost-overlay-page') && window.EventSource) {
    const events = new window.EventSource('/api/game/live-xp-boost/events');
    events.addEventListener('boost-change', refresh);
    events.addEventListener('connected', refresh);
  }
  window.refreshLiveXpBoost = refresh;
  setInterval(render,1000);
  setInterval(refresh,10000);
  window.addEventListener('online',refresh);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh();});
  refresh();
})();
