import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';

export function createHelmetMiddleware({ production = false } = {}) {
  return helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        // Images locales + avatars Twitch renvoyés par l'API Helix.
        // Les badges/visuels du jeu restent servis localement via 'self'.
        imgSrc: ["'self'", 'data:', 'https://static-cdn.jtvnw.net'],
        connectSrc: ["'self'"],
        fontSrc: ["'self'", 'data:'],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        frameAncestors: ["'none'"],
        formAction: ["'self'"],
        upgradeInsecureRequests: production ? [] : null
      }
    },
    crossOriginEmbedderPolicy: false,
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' }
  });
}

function normalizeOrigin(value) {
  try { return new URL(value).origin; } catch { return null; }
}

export function createOriginGuard({ baseUrl }) {
  const configuredOrigins = new Set(
    [baseUrl, ...(String(process.env.ALLOWED_ORIGINS || '').split(','))]
      .map(value => normalizeOrigin(String(value || '').trim()))
      .filter(Boolean)
  );

  return function verifyRequestOrigin(req, res, next) {
    if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) return next();
    if (req.path.startsWith('/api/streamdeck/')) return next();

    const origin = normalizeOrigin(req.get('origin'));
    const currentOrigin = normalizeOrigin(`${req.protocol}://${req.get('host')}`);
    const allowed = origin && (origin === currentOrigin || configuredOrigins.has(origin));

    if (!allowed) {
      return res.status(403).json({ error: 'Origine de la requête refusée.' });
    }
    return next();
  };
}

export const loginRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  message: { error: 'Trop de tentatives de connexion. Réessaie dans quelques minutes.' }
});

export const registerRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 5,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Trop de créations de compte depuis cette connexion. Réessaie plus tard.' }
});
