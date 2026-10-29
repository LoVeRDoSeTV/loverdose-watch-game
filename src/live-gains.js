export function createLiveGainsHandler(pool){
  return async(req,res)=>{
    res.set('Cache-Control','no-store');
    if(!req.session.account||!req.session.user?.twitchId)return res.status(401).json({error:'Connexion requise.'});
    try{
      const row=(await pool.query(`SELECT u.id,u.last_live_seen_at,
        t.last_live,t.last_error,t.last_success_at>CURRENT_TIMESTAMP-INTERVAL '90 seconds' tracker_fresh,
        u.last_live_seen_at>CURRENT_TIMESTAMP-INTERVAL '45 seconds' player_recent
        FROM users u LEFT JOIN twitch_tracker_auth t ON t.id=1 WHERE u.twitch_id=$1 LIMIT 1`,[req.session.user.twitchId])).rows[0];
      if(!row)return res.status(404).json({error:'Profil introuvable.'});
      const state=!row.tracker_fresh||row.last_error?'unavailable':!row.last_live?'offline':row.player_recent?'receiving':'waiting';
      res.json({playerId:String(row.id),state,lastCreditAt:row.last_live_seen_at||null});
    }catch{res.status(503).json({error:'Suivi de progression momentanément indisponible.'});}
  };
}
