import 'dotenv/config';
import pg from 'pg';

const apply = process.argv.includes('--apply');
const ids = [1, 2, 3];
const operationKey = 'delete-old-feedback-archives-1-2-3-20261104';
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL manquant dans le .env du serveur.');
  process.exit(1);
}

const client = await pool.connect();
try {
  await client.query('BEGIN');
  const { rows } = await client.query(
    'SELECT * FROM game_feedback WHERE id = ANY($1::int[]) ORDER BY id FOR UPDATE',
    [ids]
  );
  const expectedKinds = new Map([[1, 'idea'], [2, 'idea'], [3, 'bug']]);
  if (rows.length !== ids.length || rows.some(row =>
    expectedKinds.get(Number(row.id)) !== row.kind ||
    String(row.player_name || '').toLowerCase() !== 'loverdose' ||
    row.status !== 'resolved'
  )) {
    throw new Error('Les trois archives attendues ne correspondent pas aux IDs, au propriétaire ou au statut. Aucune suppression.');
  }

  console.table(rows.map(row => ({
    id: row.id,
    type: row.kind,
    joueur: row.player_name,
    statut: row.status,
    message: String(row.description || '').slice(0, 70),
    discord: row.discord_message_id ? 'identifiant enregistré' : 'effacement manuel possible'
  })));

  if (!apply) {
    await client.query('ROLLBACK');
    console.log('Aperçu seulement. Relance avec --apply pour supprimer ces trois archives du jeu.');
  } else {
    await client.query(`CREATE TABLE IF NOT EXISTS manual_adjustment_snapshots (
      operation_key text PRIMARY KEY,
      snapshot jsonb NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now()
    )`);
    const backup = await client.query(
      'INSERT INTO manual_adjustment_snapshots(operation_key, snapshot) VALUES ($1, $2::jsonb) ON CONFLICT DO NOTHING RETURNING operation_key',
      [operationKey, JSON.stringify({ feedback: rows })]
    );
    if (backup.rowCount !== 1) throw new Error('Cette suppression a déjà été appliquée. Aucune modification.');
    const deleted = await client.query(
      "DELETE FROM game_feedback WHERE id = ANY($1::int[]) AND status = 'resolved' RETURNING id",
      [ids]
    );
    if (deleted.rowCount !== ids.length) throw new Error('Suppression incomplète : transaction annulée.');
    await client.query('COMMIT');
    console.log('Archives #1, #2 et #3 supprimées du jeu. Sauvegarde conservée dans manual_adjustment_snapshots.');
    console.log('Les anciens messages Discord sans identifiant doivent être effacés manuellement dans Discord.');
  }
} catch (error) {
  await client.query('ROLLBACK').catch(() => {});
  console.error(error.message);
  process.exitCode = 1;
} finally {
  client.release();
  await pool.end();
}
