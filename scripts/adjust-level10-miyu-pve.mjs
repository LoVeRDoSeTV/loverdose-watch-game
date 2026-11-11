import 'dotenv/config';
import pg from 'pg';

const db=new pg.Pool({connectionString:process.env.DATABASE_URL});
const apply=process.argv.includes('--apply');
const key='level10-miyu-pve-3eggs-20261103';
const client=await db.connect();
try {
  await client.query('BEGIN');
  const players=(await client.query(`
    SELECT a.id account_id,a.username,u.id user_id,u.login,u.xp user_xp,u.pending_xp,
           l.id lovys_id,l.creature_id,l.xp lovys_xp
    FROM accounts a JOIN users u ON u.twitch_id=a.twitch_id
    JOIN user_lovys l ON l.user_id=u.id AND l.is_active=TRUE
    WHERE lower(a.username)='lovermiyu'
       OR lower(a.username) IN ('loverdose','loverdosetv')
       OR lower(u.login)='loverdosetv'
    ORDER BY u.id FOR UPDATE OF u,l
  `)).rows;
  const miyu=players.find(p=>p.username.toLowerCase()==='lovermiyu');
  const others=players.filter(p=>p.user_id!==miyu?.user_id);
  if(!miyu || Number(miyu.lovys_id)!==21 || others.length!==1 || players.length!==2)
    throw Error('Comptes ambigus ou Brumee n°21 non actif : aucune modification.');
  const owner=others[0];
  const stock=(await client.query(`SELECT quantity FROM shop_inventory
    WHERE account_id=$1 AND item_key='mystery_egg' FOR UPDATE`,[miyu.account_id])).rows[0];
  const eggs=Number(stock?.quantity||0);
  if(eggs<3)throw Error(`Miyu a seulement ${eggs} œuf(s) en stock : aucune modification.`);
  const progress=(await client.query('SELECT * FROM user_pve_progress WHERE user_id=$1',[miyu.user_id])).rows;
  const battles=(await client.query('SELECT * FROM user_pve_battles WHERE user_id=$1',[miyu.user_id])).rows;
  const reports=(await client.query('SELECT * FROM user_combat_reports WHERE user_id=$1',[miyu.user_id])).rows;
  console.table([owner,miyu].map(p=>({pseudo:p.username,lovys:p.lovys_id,xp_avant:Math.floor(Number(p.lovys_xp)),xp_apres:1000,reserve:Math.floor(Number(p.pending_xp))})));
  console.log(`Miyu : ${progress.length} progressions, ${reports.length} rapports PvE, ${battles.length} combat actif ; stock d’œufs ${eggs} → ${eggs-3}.`);
  if(!apply){console.log('Aperçu uniquement. Utilise --apply pour appliquer.');await client.query('ROLLBACK');}
  else {
    await client.query(`CREATE TABLE IF NOT EXISTS manual_adjustment_snapshots (
      operation_key text PRIMARY KEY,snapshot jsonb NOT NULL,created_at timestamptz NOT NULL DEFAULT now())`);
    const inserted=await client.query(`INSERT INTO manual_adjustment_snapshots(operation_key,snapshot)
      VALUES($1,$2::jsonb) ON CONFLICT DO NOTHING RETURNING operation_key`,
      [key,JSON.stringify({owner,miyu,stock,progress,battles,reports})]);
    if(!inserted.rowCount)throw Error('Correction déjà appliquée : aucune nouvelle modification.');
    for(const p of [owner,miyu]){
      await client.query('UPDATE user_lovys SET xp=1000,updated_at=now() WHERE id=$1 AND user_id=$2 AND is_active=TRUE',[p.lovys_id,p.user_id]);
      await client.query('UPDATE users SET xp=1000,updated_at=now() WHERE id=$1',[p.user_id]);
    }
    await client.query('DELETE FROM user_pve_battles WHERE user_id=$1',[miyu.user_id]);
    await client.query('DELETE FROM user_pve_progress WHERE user_id=$1',[miyu.user_id]);
    await client.query('DELETE FROM user_combat_reports WHERE user_id=$1',[miyu.user_id]);
    const debit=await client.query(`UPDATE shop_inventory SET quantity=quantity-3
      WHERE account_id=$1 AND item_key='mystery_egg' AND quantity>=3 RETURNING quantity`,[miyu.account_id]);
    if(debit.rowCount!==1)throw Error('Stock modifié simultanément : aucune modification.');
    await client.query('COMMIT');
    console.log('Appliqué. Anciennes valeurs sauvegardées dans manual_adjustment_snapshots.');
  }
} catch(error) {
  await client.query('ROLLBACK').catch(()=>{});
  console.error(error.message);
  process.exitCode=1;
} finally {client.release();await db.end();}
