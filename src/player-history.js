// Append-only purchase/use journal. Call recordPlayerHistory inside the debit transaction.
export async function initPlayerHistory(pool) {
  await pool.query(`CREATE TABLE IF NOT EXISTS player_economy_history (
    id BIGSERIAL PRIMARY KEY,
    account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    kind TEXT NOT NULL CHECK(kind IN ('purchase','use')),
    item_key TEXT NOT NULL, item_name TEXT NOT NULL,
    quantity INTEGER NOT NULL CHECK(quantity>0),
    currency TEXT CHECK(currency IN ('cash','egg_fragments')),
    unit_price DOUBLE PRECISION, total_cost DOUBLE PRECISION,
    balance_before DOUBLE PRECISION, balance_after DOUBLE PRECISION,
    details JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`);
  await pool.query(`CREATE INDEX IF NOT EXISTS player_economy_history_account_idx
    ON player_economy_history(account_id,created_at DESC,id DESC)`);
}
export async function recordPlayerHistory(client, event) {
  const {accountId,kind,itemKey,itemName,quantity,currency=null,unitPrice=null,totalCost=null,
    balanceBefore=null,balanceAfter=null,details={}}=event;
  await client.query(`INSERT INTO player_economy_history
    (account_id,kind,item_key,item_name,quantity,currency,unit_price,total_cost,balance_before,balance_after,details)
    VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
    [accountId,kind,itemKey,itemName,quantity,currency,unitPrice,totalCost,balanceBefore,balanceAfter,JSON.stringify(details)]);
}
export function registerAdminPlayerHistory(app, {pool,getBroadcasterAccount}) {
  app.get('/api/admin/players/:accountId/history',async(req,res)=>{
    try {
      if(!await getBroadcasterAccount(req))return res.status(403).json({error:'Accès réservé au diffuseur.'});
      const accountId=Number(req.params.accountId);
      const filter=String(req.query.type||'all');
      const offset=Number(req.query.offset||0);
      if(!Number.isSafeInteger(accountId)||accountId<=0||!['all','purchase','use','admin'].includes(filter)||!Number.isSafeInteger(offset)||offset<0||offset>100000)
        return res.status(400).json({error:'Paramètres d’historique invalides.'});
      const account=await pool.query('SELECT id FROM accounts WHERE id=$1',[accountId]);
      if(!account.rowCount)return res.status(404).json({error:'Joueur introuvable.'});
      const result=await pool.query(`SELECT * FROM (
        SELECT id,'economy'::text source,kind,item_key,item_name,quantity,currency,unit_price,total_cost,
          balance_before,balance_after,details,created_at,NULL::text summary,NULL::text admin_name
        FROM player_economy_history WHERE account_id=$1
        UNION ALL
        SELECT l.id,'admin'::text source,'admin'::text kind,NULL::text,NULL::text,NULL::int,NULL::text,
          NULL::double precision,NULL::double precision,NULL::double precision,NULL::double precision,
          COALESCE(l.details_json,'{}'::jsonb),l.created_at,l.summary,a.username
        FROM admin_audit_log l LEFT JOIN accounts a ON a.id=l.admin_account_id WHERE l.target_account_id=$1
      ) history WHERE ($2='all' OR kind=$2)
      ORDER BY created_at DESC,source DESC,id DESC LIMIT 51 OFFSET $3`,[accountId,filter,offset]);
      const items=result.rows.slice(0,50);
      res.setHeader('Cache-Control','no-store');
      res.json({ok:true,items,hasMore:result.rows.length>50,nextOffset:offset+items.length});
    } catch(error) {
      console.error('Erreur historique joueur admin :',error);
      res.status(500).json({error:'Impossible de charger l’historique de ce joueur.'});
    }
  });
}
