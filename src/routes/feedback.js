import express from 'express';

export const FEEDBACK_PAGES = ['Accueil','Lovys','Incubateur','PvE','Communauté','Classement','Progression','Boutique','Inventaire','Mon compte','Autre'];
export function decodeFeedbackScreenshot(value) {
  if (!value) return null;
  if (typeof value !== 'string') throw new Error('Capture invalide.');
  const match = /^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/]+={0,2})$/.exec(value);
  if (!match) throw new Error('Choisis une image PNG, JPEG ou WebP.');
  const bytes = Buffer.from(match[2], 'base64');
  if (!bytes.length || bytes.length > 1500000) throw new Error('La capture doit faire moins de 1,5 Mo après compression.');
  const valid = match[1] === 'png' ? bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])) : match[1] === 'jpeg' ? bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255 : bytes.toString('ascii',0,4) === 'RIFF' && bytes.toString('ascii',8,12) === 'WEBP';
  if (!valid) throw new Error('Le fichier ne correspond pas à une image acceptée.');
  return { bytes, mime:`image/${match[1]}`, extension:match[1] === 'jpeg' ? 'jpg' : match[1] };
}
export function feedbackWebhookUrl() {
  const raw = String(process.env.DISCORD_FEEDBACK_WEBHOOK_URL || '').trim();
  if (!raw) return null;
  try {
    const url = new URL(raw);
    if (url.protocol !== 'https:' || url.hostname !== 'discord.com' || url.port || !/^\/api\/webhooks\/\d+\/[A-Za-z0-9_-]+$/.test(url.pathname) || url.search || url.hash) return null;
    return url.href;
  } catch { return null; }
}
export async function deliverFeedbackToDiscord(pool, id) {
  const webhook = feedbackWebhookUrl();
  if (!webhook) { await pool.query(`UPDATE game_feedback SET discord_status='not_configured' WHERE id=$1 AND discord_status IN ('waiting','failed','not_configured')`,[id]); return 'not_configured'; }
  const claimed = await pool.query(`UPDATE game_feedback SET discord_status='sending' WHERE id=$1 AND discord_status IN ('waiting','failed','not_configured') RETURNING *`,[id]);
  const row = claimed.rows[0];
  if (!row) return 'unchanged';
  try {
    const payload = { username:'LoVeR Watch Game', allowed_mentions:{parse:[]}, embeds:[{title:`${row.kind === 'bug' ? '🐛 Bug' : '💡 Idée'} #${row.id}`,description:row.description,color:row.kind === 'bug' ? 10176767 : 9553919,fields:[{name:'Joueur',value:row.player_name.slice(0,100),inline:true},{name:'Page',value:row.page,inline:true}],timestamp:new Date(row.created_at).toISOString()}] };
    let body,headers;
    if (row.screenshot) {
      const extension=row.screenshot_mime === 'image/jpeg' ? 'jpg' : row.screenshot_mime === 'image/png' ? 'png' : 'webp';
      const filename=`capture-${row.id}.${extension}`;
      payload.embeds[0].image={url:`attachment://${filename}`};
      body=new FormData();body.append('payload_json',JSON.stringify(payload));body.append('files[0]',new Blob([row.screenshot],{type:row.screenshot_mime}),filename);
    } else {body=JSON.stringify(payload);headers={'Content-Type':'application/json'};}
    const response=await fetch(webhook,{method:'POST',headers,body,redirect:'error',signal:AbortSignal.timeout(8000)});
    if (!response.ok) throw new Error('Discord indisponible');
    await pool.query(`UPDATE game_feedback SET discord_status='sent',discord_sent_at=CURRENT_TIMESTAMP WHERE id=$1`,[id]);
    return 'sent';
  } catch {
    await pool.query(`UPDATE game_feedback SET discord_status='failed' WHERE id=$1`,[id]);
    return 'failed';
  }
}
export function createFeedbackRouter({pool,getBroadcasterAccount}) {
  const router=express.Router();
  router.post('/feedback',async(req,res)=>{
    if (!req.session.account?.id || !req.session.user?.twitchId) return res.status(401).json({error:'Connecte-toi au jeu pour envoyer un message.'});
    const {kind,page,description,screenshot}=req.body || {};
    if (!['bug','idea'].includes(kind) || !FEEDBACK_PAGES.includes(page) || typeof description !== 'string' || description.trim().length < 20 || description.trim().length > 3000) return res.status(400).json({error:'Choisis une page et décris ton message en 20 à 3 000 caractères.'});
    let image;
    try { image=decodeFeedbackScreenshot(screenshot); } catch(error) { return res.status(400).json({error:error.message}); }
    let client;
    try {
      client=await pool.connect();await client.query('BEGIN');
      const account=(await client.query('SELECT id,username FROM accounts WHERE id=$1 FOR UPDATE',[req.session.account.id])).rows[0];
      if (!account) {await client.query('ROLLBACK');return res.status(401).json({error:'Compte introuvable.'});}
      const count=(await client.query(`SELECT COUNT(*)::int count FROM game_feedback WHERE account_id=$1 AND created_at>CURRENT_TIMESTAMP-INTERVAL '1 hour'`,[account.id])).rows[0].count;
      if (count>=5) {await client.query('ROLLBACK');return res.status(429).json({error:'Tu as déjà envoyé 5 messages en une heure. Réessaie plus tard.'});}
      const row=(await client.query(`INSERT INTO game_feedback(account_id,player_name,kind,page,description,screenshot,screenshot_mime) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING id`,[account.id,account.username,kind,page,description.trim(),image?.bytes || null,image?.mime || null])).rows[0];
      await client.query('COMMIT');client.release();client=null;
      // L'enregistrement reste disponible dans l'Admin même si Discord échoue.
      try {await deliverFeedbackToDiscord(pool,row.id);} catch { /* Ne pas faire renvoyer un message déjà enregistré. */ }
      res.json({ok:true,id:row.id,message:'Merci ! Ton message a bien été enregistré et transmis à l’administrateur.'});
    } catch {if(client)await client.query('ROLLBACK');res.status(500).json({error:'Impossible d’enregistrer ton message. Réessaie.'});} finally {client?.release();}
  });
  router.use('/admin/feedback',async(req,res,next)=>{
    try {if (!await getBroadcasterAccount(req)) return res.status(403).json({error:'Accès réservé au diffuseur.'});next();} catch {res.status(500).json({error:'Vérification impossible.'});}
  });
  router.get('/admin/feedback',async(req,res)=>{
    try {const rows=await pool.query(`SELECT id,player_name,kind,page,description,status,discord_status,created_at,discord_sent_at,screenshot IS NOT NULL has_screenshot FROM game_feedback ORDER BY created_at DESC LIMIT 100`);res.json({ok:true,items:rows.rows,discordConfigured:Boolean(feedbackWebhookUrl())});} catch {res.status(500).json({error:'Messages indisponibles.'});}
  });
  router.get('/admin/feedback/:id/screenshot',async(req,res)=>{
    const id=Number(req.params.id);if(!Number.isSafeInteger(id)||id<1)return res.sendStatus(400);
    try {const row=(await pool.query('SELECT screenshot,screenshot_mime FROM game_feedback WHERE id=$1',[id])).rows[0];if(!row?.screenshot)return res.sendStatus(404);res.set({'Content-Type':row.screenshot_mime,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Content-Disposition':'inline'}).send(row.screenshot);} catch {res.sendStatus(500);}
  });
  router.patch('/admin/feedback/:id',async(req,res)=>{
    const id=Number(req.params.id),status=req.body?.status;
    if(!Number.isSafeInteger(id)||id<1||!['new','in_progress','resolved'].includes(status))return res.status(400).json({error:'Statut invalide.'});
    try {const result=await pool.query('UPDATE game_feedback SET status=$2 WHERE id=$1 RETURNING id',[id,status]);if(!result.rowCount)return res.sendStatus(404);res.json({ok:true});} catch {res.status(500).json({error:'Modification impossible.'});}
  });
  router.post('/admin/feedback/:id/discord',async(req,res)=>{
    const id=Number(req.params.id);if(!Number.isSafeInteger(id)||id<1)return res.sendStatus(400);
    try {const status=await deliverFeedbackToDiscord(pool,id);res.json({ok:true,status});} catch {res.status(500).json({error:'Envoi Discord impossible.'});}
  });
  return router;
}
