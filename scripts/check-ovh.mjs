import 'dotenv/config';
import pg from 'pg';
import crypto from 'node:crypto';
import { getPublicBaseUrl, twitchConfigurationIssues, getSessionSecret } from '../src/config.js';

let failures = 0;
function result(ok, label) { console.log(`${ok ? 'OK' : 'À CORRIGER'} — ${label}`); if (!ok) failures++; }
let base;
try { base = getPublicBaseUrl(); result(base === 'https://loverwatchgame.fr', 'Adresse publique OVH'); }
catch (error) { result(false, error.message); }
result(process.env.NODE_ENV === 'production', 'NODE_ENV=production');
for (const issue of twitchConfigurationIssues()) result(false, issue);
if (!twitchConfigurationIssues().length) result(true, 'Réglages Twitch renseignés (valeurs masquées)');
let sessionSecret;
try { sessionSecret = getSessionSecret(); result(sessionSecret.length >= 32, 'Secret de session suffisamment long'); }
catch (error) { result(false, error.message); }
if (base) {
  console.log(`Callback connexion : ${base}/auth/twitch/callback`);
  console.log(`Callback tracker : ${base}/auth/twitch/tracker/callback`);
  console.log(`Callback Discord, si utilisé : ${base}/auth/discord/callback`);
}
for (const key of ['STREAM_DECK_TOKEN', 'DISCORD_CLIENT_ID', 'DISCORD_CLIENT_SECRET', 'DISCORD_GUILD_ID', 'DISCORD_FEEDBACK_WEBHOOK_URL']) {
  const configured = String(process.env[key] || '').trim();
  console.log(`Option ${key} : ${configured && !/^(your_|change_this)/i.test(configured) ? 'renseignée' : 'absente/exemple (à recopier si utilisée sur Render)'}`);
}

function decrypt(value) {
  const [version, iv, tag, encrypted] = String(value || '').split(':');
  if (version !== 'v1' || !iv || !tag || !encrypted || !sessionSecret) throw Error('invalid');
  const key = crypto.createHash('sha256').update(sessionSecret).digest();
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(iv, 'base64url'));
  decipher.setAuthTag(Buffer.from(tag, 'base64url'));
  return Buffer.concat([decipher.update(Buffer.from(encrypted, 'base64url')), decipher.final()]).toString('utf8');
}
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 10000, query_timeout: 10000 });
try {
  if (!process.env.DATABASE_URL) throw Error('missing');
  await pool.query('SELECT 1'); result(true, 'Connexion PostgreSQL');
  const counts = (await pool.query('SELECT (SELECT COUNT(*) FROM accounts)::int accounts, (SELECT COUNT(*) FROM users)::int players')).rows[0];
  console.log(`Données présentes : ${counts.accounts} comptes, ${counts.players} joueurs.`);
  const row = (await pool.query('SELECT * FROM twitch_tracker_auth WHERE id=1')).rows[0];
  result(Boolean(row), 'Autorisation du tracker enregistrée');
  if (row) {
    const broadcaster = String(process.env.TWITCH_BROADCASTER_ID || '').trim();
    result(row.twitch_user_id === broadcaster, 'Tracker associé au diffuseur configuré');
    const scopes = new Set(String(row.scopes || '').split(/\s+/));
    result(['moderator:read:chatters', 'channel:read:subscriptions'].every(scope => scopes.has(scope)), 'Permissions chatters et abonnements');
    let accessToken;
    try { accessToken = decrypt(row.access_token_enc); decrypt(row.refresh_token_enc); result(true, 'Jetons lisibles avec le secret actuel'); }
    catch { result(false, 'Jetons importés illisibles : reconnecter le tracker depuis Administration'); }
    const recent = row.last_success_at && Date.now() - new Date(row.last_success_at).getTime() < 90000;
    result(Boolean(recent && !row.last_error), 'Dernier contrôle automatique du tracker réussi depuis moins de 90 secondes');
    console.log(`État enregistré : ${row.last_live ? 'en live' : 'hors live'}, ${Number(row.last_matched_count || 0)} comptes reconnus.`);
    if (accessToken && process.argv.includes('--twitch')) {
      const response = await fetch('https://id.twitch.tv/oauth2/validate', { headers: { Authorization: `OAuth ${accessToken}` }, signal: AbortSignal.timeout(10000) });
      if (response.ok) {
        const token = await response.json();
        result(token.client_id === process.env.TWITCH_CLIENT_ID && token.user_id === broadcaster, 'Twitch confirme l’application et le diffuseur du jeton');
      } else result(false, 'Jeton refusé par Twitch ; attendre le renouvellement ou reconnecter le tracker');
    }
  }
  const wizebot = (await pool.query('SELECT enabled,last_poll_at FROM wizebot_alert_settings WHERE id=1')).rows[0];
  console.log(`Wizebot : ${wizebot?.enabled ? 'ON' : 'OFF'}, dernier appel ${wizebot?.last_poll_at ? new Date(wizebot.last_poll_at).toISOString() : 'aucun'}. Recopier le relais depuis Administration vers Wizebot après migration.`);
} catch { result(false, 'Contrôle PostgreSQL/Twitch interrompu : vérifier le service, DATABASE_URL et les tables importées (aucun secret affiché)'); }
finally { await pool.end(); }
console.log('Ce diagnostic ne modifie aucune donnée et ne distribue aucune récompense.');
process.exitCode = failures ? 1 : 0;
