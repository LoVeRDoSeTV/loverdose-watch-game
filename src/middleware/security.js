import helmet from 'helmet';
import { createHash } from 'node:crypto';
import { rateLimit } from 'express-rate-limit';

export function validOAuthCallback(query, session, stateKey, now = Date.now()) {
  const state = session[stateKey];
  const startedAt = session[`${stateKey}StartedAt`];
  return typeof query.code === 'string' && query.code.length > 0
    && typeof query.state === 'string' && query.state.length > 0
    && typeof state === 'string' && state.length > 0 && query.state === state
    && Number.isFinite(startedAt) && now >= startedAt && now - startedAt <= 10 * 60 * 1000;
}

export function regenerateSession(req) {
  return new Promise((resolve, reject) => {
    req.session.regenerate(error => error ? reject(error) : resolve());
  });
}

export const feedbackRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Trop de messages depuis cette connexion. Réessaie dans 15 minutes.' }
});

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
    // EventSub n'envoie pas Origin ; la route vérifie la signature HMAC de Twitch.
    if (req.path === '/api/game-bot/eventsub') return next();

    const origin = normalizeOrigin(req.get('origin'));
    const currentOrigin = normalizeOrigin(`${req.protocol}://${req.get('host')}`);
    const allowed = origin && (origin === currentOrigin || configuredOrigins.has(origin));

    if (!allowed) {
      return res.status(403).json({ error: 'Origine de la requête refusée.' });
    }
    return next();
  };
}

// A shared connection must not let one mistyped account lock out every viewer.
// Count authentication refusals only; outages and OAuth/navigation requests are not failures.
export function createLoginRateLimits(){
  const common={windowMs:15*60*1000,standardHeaders:'draft-7',legacyHeaders:false,
    skipSuccessfulRequests:true,requestWasSuccessful:(_req,res)=>res.statusCode!==401,
    handler(req,res,_next,options){
      const reset=req.rateLimit?.resetTime?.getTime();
      const retryAfterSeconds=Math.max(1,Math.ceil(((reset||Date.now()+options.windowMs)-Date.now())/1000));
      const minutes=Math.ceil(retryAfterSeconds/60);
      res.setHeader('Retry-After',String(retryAfterSeconds));
      res.status(429).json({error:`Trop de tentatives de connexion incorrectes. Réessaie dans ${minutes} minute${minutes>1?'s':''}.`,retryAfterSeconds});
    }};
  return [
    rateLimit({...common,limit:60}),
    rateLimit({...common,limit:10,keyGenerator:req=>createHash('sha256')
      .update(String(req.ip||'')).update('\0')
      .update(String(req.body?.email||'').trim().toLowerCase()).digest('hex')})
  ];
}
export const loginRateLimit=createLoginRateLimits();

export const registerRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 5,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Trop de créations de compte depuis cette connexion. Réessaie plus tard.' }
});

// Plafonds défensifs sur les écritures d'économie et les échanges.
// Les lectures, le combat PvE et les ticks automatiques du Tracker ne sont pas concernés.
export const economyWriteRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 60,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Trop d’achats rapprochés. Réessaie dans quelques minutes.' }
});

export const tradeWriteRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 60,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Trop d’opérations d’échange. Réessaie dans quelques minutes.' }
});


// Limite les tentatives de changement de mot de passe, y compris pour un compte connecté.
export const passwordChangeRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  message: { error: 'Trop de tentatives. Réessaie dans 15 minutes.' }
});
