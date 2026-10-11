const isProduction = process.env.NODE_ENV === 'production';

export function getSessionSecret() {
  const configured = String(process.env.SESSION_SECRET || '').trim();

  if (isProduction && configured.length < 32) {
    throw new Error('SESSION_SECRET doit être défini en production et contenir au moins 32 caractères.');
  }

  if (configured) return configured;

  console.warn('[sécurité] SESSION_SECRET absent : secret de développement utilisé hors production uniquement.');
  return 'dev-secret-change-me';
}

export { isProduction };

// Une origine unique pour OAuth, les cookies et les relais externes.
export function getPublicBaseUrl(env = process.env) {
  const production = env.NODE_ENV === 'production';
  const raw = String(env.BASE_URL || '').trim();
  if (!raw && production) throw new Error('BASE_URL doit contenir l’adresse HTTPS publique du jeu.');
  let url;
  try { url = new URL(raw || `http://localhost:${env.PORT || 3000}`); }
  catch { throw new Error('BASE_URL doit être une adresse HTTP(S) valide.'); }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password ||
      url.search || url.hash || !/^\/*$/.test(url.pathname)) {
    throw new Error('BASE_URL doit contenir uniquement l’origine du site, sans chemin ni paramètres.');
  }
  if (production && url.protocol !== 'https:') throw new Error('BASE_URL doit utiliser HTTPS en production.');
  return url.origin;
}

export function twitchConfigurationIssues(env = process.env) {
  const issues = [];
  for (const key of ['TWITCH_CLIENT_ID', 'TWITCH_CLIENT_SECRET']) {
    const value = String(env[key] || '').trim();
    if (!value || /^(your_|change_this)/i.test(value)) issues.push(`${key} absent ou encore rempli avec un exemple.`);
  }
  if (!/^\d+$/.test(String(env.TWITCH_BROADCASTER_ID || '').trim())) {
    issues.push('TWITCH_BROADCASTER_ID doit être l’identifiant numérique du diffuseur.');
  }
  return issues;
}
