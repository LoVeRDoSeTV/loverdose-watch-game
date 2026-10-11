import express from 'express';
import crypto from 'crypto';

export function createStreamDeckRouter({ pool, getTrackerAuthRow, runTrackerTick, pushLiveUpdate }) {
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

  return router;
}
