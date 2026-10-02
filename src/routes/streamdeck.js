import express from 'express';
import crypto from 'crypto';

export function createStreamDeckRouter({ pool, getTrackerAuthRow, runTrackerTick }) {
  const router = express.Router();

  function tokenIsValid(req) {
    const configured = String(process.env.STREAM_DECK_TOKEN || '').trim();
    const provided = String(req.get('x-stream-deck-token') || '').trim();
    if (!configured || !provided) return false;
    const expected = Buffer.from(configured);
    const received = Buffer.from(provided);
    return expected.length === received.length && crypto.timingSafeEqual(expected, received);
  }

  function requireToken(req, res, next) {
    if (!tokenIsValid(req)) return res.status(403).send('Accès refusé.');
    return next();
  }

  router.post('/zombie/on', requireToken, async (req, res) => {
    try {
      const row = await getTrackerAuthRow();
      if (!row) return res.status(409).send('Tracker Twitch non configuré.');
      await runTrackerTick();
      await pool.query(`UPDATE twitch_tracker_auth SET special_mode='zombie', updated_at=CURRENT_TIMESTAMP WHERE id=1`);
      res.send('🧟 Mode Zombie activé');
    } catch (error) {
      console.error('Erreur Stream Deck Zombie ON :', error);
      res.status(500).send('Impossible d’activer le mode Zombie.');
    }
  });

  router.post('/zombie/off', requireToken, async (req, res) => {
    try {
      const row = await getTrackerAuthRow();
      if (!row) return res.status(409).send('Tracker Twitch non configuré.');
      await runTrackerTick();
      await pool.query(`UPDATE twitch_tracker_auth SET special_mode=NULL, updated_at=CURRENT_TIMESTAMP WHERE id=1`);
      res.send('✅ Mode Zombie désactivé');
    } catch (error) {
      console.error('Erreur Stream Deck Zombie OFF :', error);
      res.status(500).send('Impossible de désactiver le mode Zombie.');
    }
  });

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
