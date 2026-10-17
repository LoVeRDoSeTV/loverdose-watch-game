import express from 'express';
import crypto from 'crypto';

export function createStreamDeckRouter({ pool, getTrackerAuthRow, runTrackerTick, pushLiveUpdate, getActiveAdminLiveBoosts, mutateLiveBoosts, publicLiveBoostStatus }) {
  const router = express.Router();

  function tokenIsValid(req) {
    const configured = String(process.env.STREAM_DECK_TOKEN || '').trim();
    const headerToken = req.get('x-stream-deck-token');
    const queryToken = req.method === 'GET' && typeof req.query?.token === 'string'
      ? req.query.token : '';
    const provided = String(headerToken || queryToken).trim();
    if (!configured || !provided) return false;
    const expected = Buffer.from(configured);
    const received = Buffer.from(provided);
    return expected.length === received.length && crypto.timingSafeEqual(expected, received);
  }

  function requireToken(req, res, next) {
    // Les appels GET du Stream Deck doivent atteindre le serveur à chaque clic.
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Referrer-Policy', 'no-referrer');
    if (!tokenIsValid(req)) return res.status(403).send('Accès refusé.');
    return next();
  }

  async function enableZombie(req, res) {
    try {
      const row = await getTrackerAuthRow();
      if (!row) return res.status(409).send('Tracker Twitch non configuré.');
      await runTrackerTick();
      await pool.query(`UPDATE twitch_tracker_auth SET special_mode='zombie', updated_at=CURRENT_TIMESTAMP WHERE id=1`);
      pushLiveUpdate('special-mode-update', { specialMode: 'zombie' });
      res.send('🧟 Mode Zombie activé');
    } catch (error) {
      console.error('Erreur Stream Deck Zombie ON :', error);
      res.status(500).send('Impossible d’activer le mode Zombie.');
    }
  }

  async function disableZombie(req, res) {
    try {
      const row = await getTrackerAuthRow();
      if (!row) return res.status(409).send('Tracker Twitch non configuré.');
      await runTrackerTick();
      await pool.query(`UPDATE twitch_tracker_auth SET special_mode=NULL, updated_at=CURRENT_TIMESTAMP WHERE id=1`);
      pushLiveUpdate('special-mode-update', { specialMode: null });
      res.send('✅ Mode Zombie désactivé');
    } catch (error) {
      console.error('Erreur Stream Deck Zombie OFF :', error);
      res.status(500).send('Impossible de désactiver le mode Zombie.');
    }
  }

  router.post('/zombie/on', requireToken, enableZombie);
  router.get('/zombie/on', requireToken, enableZombie);
  router.post('/zombie/off', requireToken, disableZombie);
  router.get('/zombie/off', requireToken, disableZombie);

  router.get('/zombie/status', requireToken, async (req, res) => {
    try {
      const row = await getTrackerAuthRow();
      res.json({ ok:true, active:String(row?.special_mode || '').toLowerCase() === 'zombie', specialMode:row?.special_mode || null });
    } catch (error) {
      console.error('Erreur Stream Deck Zombie STATUS :', error);
      res.status(500).json({ error:'Impossible de charger le mode Zombie.' });
    }
  });

  const boostColumns = {
    xp:'streamdeck_xp_expires_at',
    cash:'streamdeck_cash_expires_at',
    globalXp:'streamdeck_global_xp_expires_at'
  };
  async function setLiveBoost(req, res, kind, enabled) {
    try {
      if (enabled && !await getTrackerAuthRow()) return res.status(409).send('Tracker Twitch non configuré.');
      const columns = kind === 'all' ? Object.values(boostColumns) : [boostColumns[kind]];
      // Les colonnes proviennent exclusivement de la liste interne ci-dessus.
      // UPDATE verrouille la ligne ; les clics simultanés ne prolongent pas le bonus.
      let assignments = columns.map(column => enabled
        ? `${column}=CASE WHEN ${column}>CURRENT_TIMESTAMP THEN ${column} ELSE CURRENT_TIMESTAMP+INTERVAL '1 hour' END`
        : `${column}=NULL`);
      if (kind === 'all' && !enabled) {
        assignments.push('xp_multiplier=1','cash_multiplier=1','global_xp_multiplier=1','expires_at=NULL');
      }
      await mutateLiveBoosts(pool,client=>client.query(`UPDATE admin_live_boosts SET ${assignments.join(',')},updated_at=CURRENT_TIMESTAMP WHERE id=1`));
      const liveBoosts = await getActiveAdminLiveBoosts();
      pushLiveUpdate('live-boost-update',publicLiveBoostStatus(liveBoosts));
      res.json({ ok:true, liveBoosts });
    } catch (error) {
      console.error('Erreur Stream Deck boost :', error);
      res.status(500).json({ error:'Impossible de modifier les boosts du live.' });
    }
  }
  for (const [path,kind] of [['xp','xp'],['cash','cash'],['global-xp','globalXp'],['all','all']]) {
    for (const [action,enabled] of [['on',true],['off',false]]) {
      router.get(`/${path}/${action}`, requireToken, (req,res) => setLiveBoost(req,res,kind,enabled));
      router.post(`/${path}/${action}`, requireToken, (req,res) => setLiveBoost(req,res,kind,enabled));
    }
  }
  router.get('/boost/off', requireToken, (req,res) => setLiveBoost(req,res,'all',false));
  router.post('/boost/off', requireToken, (req,res) => setLiveBoost(req,res,'all',false));

  return router;
}
