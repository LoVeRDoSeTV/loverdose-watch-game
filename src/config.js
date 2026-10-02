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
