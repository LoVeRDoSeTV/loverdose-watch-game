export function getDiscordInviteUrl(value) {
  try {
    const url = new URL(String(value || '').trim());
    const allowed = url.hostname === 'discord.gg'
      ? /^\/[A-Za-z0-9_-]+$/.test(url.pathname)
      : url.hostname === 'discord.com' && /^\/invite\/[A-Za-z0-9_-]+$/.test(url.pathname);
    return url.protocol === 'https:' && !url.username && !url.password && !url.port && !url.search && !url.hash && allowed ? url.href : null;
  } catch { return null; }
}

export function createChangePasswordHandler({ pool, bcrypt }) {
  return async function changePassword(req, res) {
    if (!req.session?.account) return res.status(401).json({ error: 'Connexion requise.' });
    const { currentPassword, newPassword, confirmPassword } = req.body || {};
    if (typeof currentPassword !== 'string' || !currentPassword || currentPassword.length > 1024 ||
        typeof newPassword !== 'string' || typeof confirmPassword !== 'string') {
      return res.status(400).json({ error: 'Renseigne les trois champs de mot de passe.' });
    }
    if (newPassword.length < 8 || Buffer.byteLength(newPassword, 'utf8') > 72) {
      return res.status(400).json({ error: 'Choisis au moins 8 caractères, dans la limite de 72 octets (les caractères accentués et emojis comptent davantage).' });
    }
    if (newPassword !== confirmPassword) return res.status(400).json({ error: 'Les nouveaux mots de passe ne correspondent pas.' });
    if (newPassword === currentPassword) return res.status(400).json({ error: 'Choisis un mot de passe différent de l’actuel.' });
    let client;
    try {
      const account = (await pool.query('SELECT password_hash FROM accounts WHERE id=$1', [req.session.account.id])).rows[0];
      if (!account) return res.status(404).json({ error: 'Compte introuvable.' });
      if (!account.password_hash) return res.status(400).json({ error: 'Ce compte n’utilise pas de mot de passe.' });
      if (!await bcrypt.compare(currentPassword, account.password_hash)) return res.status(403).json({ error: 'Le mot de passe actuel est incorrect.' });
      const hash = await bcrypt.hash(newPassword, 12);
      client = await pool.connect();
      await client.query('BEGIN');
      const updated = await client.query('UPDATE accounts SET password_hash=$2, updated_at=CURRENT_TIMESTAMP WHERE id=$1 AND password_hash=$3 RETURNING id', [req.session.account.id, hash, account.password_hash]);
      if (!updated.rowCount) {
        await client.query('ROLLBACK');
        return res.status(409).json({ error: 'Le mot de passe a déjà changé. Réessaie avec le mot de passe actuel.' });
      }
      // Conserve cette connexion et ferme les autres sessions du compte.
      await client.query("DELETE FROM user_sessions WHERE sess->'account'->>'id'=$1 AND sid<>$2", [String(req.session.account.id), req.sessionID]);
      await client.query('COMMIT');
      res.setHeader('Cache-Control', 'no-store');
      res.json({ ok: true, message: 'Mot de passe modifié. Les autres sessions ont été déconnectées.' });
    } catch {
      if (client) { try { await client.query('ROLLBACK'); } catch {} }
      res.status(500).json({ error: 'Impossible de modifier le mot de passe.' });
    } finally { client?.release(); }
  };
}
