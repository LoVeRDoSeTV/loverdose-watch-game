(() => {
  'use strict';
  const panel = document.querySelector('[data-live-xp-boost]');
  if (!panel) return;
  let expiresAt = 0;
  let clockOffset = 0;
  let pending = false;
  let queued = false;
  const timer = panel.querySelector('[data-boost-countdown]');
  function render() {
    const remaining = Math.max(0, Math.ceil((expiresAt - (Date.now() + clockOffset)) / 1000));
    panel.hidden = remaining <= 0;
    if (!remaining) return;
    const hours = Math.floor(remaining / 3600);
    const minutes = Math.floor(remaining / 60) % 60;
    const seconds = remaining % 60;
    timer.textContent = (hours ? String(hours).padStart(2, '0') + ':' : '')
      + String(minutes).padStart(2, '0') + ':' + String(seconds).padStart(2, '0');
    panel.querySelector('[data-boost-progress]').style.width = Math.min(100, remaining / 36) + '%';
  }
  async function refresh() {
    if (pending) { queued = true; return; }
    pending = true;
    const started = Date.now();
    try {
      const response = await fetch('/api/game/live-xp-boost', { cache: 'no-store', credentials: 'omit' });
      if (!response.ok) return;
      const data = await response.json();
      const serverNow = Number(data.serverNow);
      if (Number.isFinite(serverNow)) clockOffset = serverNow - (started + Date.now()) / 2;
      expiresAt = data.active ? Date.parse(data.expiresAt) || 0 : 0;
      render();
    } catch (_) {
      // L'échéance connue reste valable même si la connexion est interrompue.
    } finally {
      pending = false;
      if (queued) { queued = false; refresh(); }
    }
  }
  // OBS ne possède pas de session de jeu : son flux public ne reçoit que
  // les changements du boost, sans aucune information de joueur.
  if (document.body.classList.contains('boost-overlay-page') && window.EventSource) {
    const events = new window.EventSource('/api/game/live-xp-boost/events');
    events.addEventListener('boost-change', refresh);
    events.addEventListener('connected', refresh);
  }
  window.refreshLiveXpBoost = refresh;
  setInterval(render, 1000);
  setInterval(refresh, 10000);
  window.addEventListener('online', refresh);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) refresh(); });
  refresh();
})();
