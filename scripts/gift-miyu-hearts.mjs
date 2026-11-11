import 'dotenv/config';
import pg from 'pg';

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const apply = process.argv.includes('--apply');
const eventKey = 'lovermiyu-heart-background-20261103';
const client = await pool.connect();
try {
  await client.query('BEGIN');
  const matches = (await client.query(
    "SELECT id, username FROM accounts WHERE lower(username) = 'lovermiyu' FOR UPDATE"
  )).rows;
  if (matches.length !== 1) throw new Error('Compte LoVeRMiyu introuvable ou ambigu : aucun cadeau envoyé.');
  const account = matches[0];
  const item = (await client.query(
    "SELECT quantity FROM shop_inventory WHERE account_id = $1 AND item_key = 'bg_tiny_hearts' FOR UPDATE",
    [account.id]
  )).rows[0];
  const prior = (await client.query(
    'SELECT id, acknowledged_at FROM player_gift_notifications WHERE account_id = $1 AND event_key = $2',
    [account.id, eventKey]
  )).rows[0];
  console.log(`Destinataire : ${account.username} (compte ${account.id}). Fond Cœurs pastel : ${item ? 'déjà possédé' : 'à offrir'}. Animation : ${prior ? 'déjà programmée' : 'à programmer'}.`);
  if (!apply) {
    console.log('Aperçu uniquement. Relance avec --apply pour confirmer.');
    await client.query('ROLLBACK');
  } else {
    if (!prior) {
      await client.query(`
        INSERT INTO shop_inventory (account_id, item_key, quantity)
        VALUES ($1, 'bg_tiny_hearts', 1)
        ON CONFLICT (account_id, item_key) DO NOTHING
      `, [account.id]);
      await client.query(`
        INSERT INTO player_gift_notifications (account_id, event_key, item_key, sender_name)
        VALUES ($1, $2, 'bg_tiny_hearts', 'LoVeRDoSe')
        ON CONFLICT (account_id, event_key) DO NOTHING
      `, [account.id, eventKey]);
    }
    await client.query('COMMIT');
    console.log(prior ? 'Cadeau déjà enregistré ; aucune modification.' : 'Cadeau enregistré ; animation affichée à sa prochaine ouverture du jeu.');
  }
} catch (error) {
  await client.query('ROLLBACK');
  console.error(error.message);
  process.exitCode = 1;
} finally {
  client.release();
  await pool.end();
}
