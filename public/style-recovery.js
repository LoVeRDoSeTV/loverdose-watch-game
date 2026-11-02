/* Une feuille interrompue sur mobile peut laisser une page partiellement stylée.
   Relancer uniquement les feuilles absentes, sans recharger le jeu. */
(function () {
  'use strict';
  const retries = new WeakMap();
  const maxAttempts = 2;

  function isLocalStylesheet(link) {
    return link?.tagName === 'LINK' && link.rel === 'stylesheet' && !link.disabled &&
      new URL(link.href, location.href).origin === location.origin;
  }

  function recover(link) {
    if (!isLocalStylesheet(link) || link.sheet) return;
    const state = retries.get(link) || { href: link.href, attempts: 0, pending: false };
    if (state.pending || state.attempts >= maxAttempts) return;
    state.pending = true;
    state.attempts++;
    retries.set(link, state);
    const url = new URL(state.href, location.href);
    url.searchParams.set('_css_retry', `${Date.now()}-${state.attempts}`);
    link.href = url.href;
  }

  function recoverMissingStyles() {
    if (document.hidden) return;
    document.querySelectorAll('link[rel="stylesheet"]').forEach(recover);
  }

  document.addEventListener('error', event => {
    const link = event.target;
    if (!isLocalStylesheet(link)) return;
    const state = retries.get(link);
    if (state) state.pending = false;
    if (!document.hidden) recover(link);
  }, true);

  document.addEventListener('load', event => {
    if (isLocalStylesheet(event.target)) retries.delete(event.target);
  }, true);

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', recoverMissingStyles, { once: true });
  } else {
    recoverMissingStyles();
  }
  window.addEventListener('pageshow', recoverMissingStyles);
  document.addEventListener('visibilitychange', recoverMissingStyles);
  window.addEventListener('online', () => {
    document.querySelectorAll('link[rel="stylesheet"]').forEach(link => {
      const state = retries.get(link);
      if (state && !state.pending) state.attempts = 0;
    });
    recoverMissingStyles();
  });
})();
