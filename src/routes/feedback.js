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
export async function feedbackMentionUserId(pool) {
  const configured=String(process.env.DISCORD_FEEDBACK_MENTION_USER_ID || '').trim();
  if (configured) return /^\d{17,20}$/.test(configured) ? configured : null;
  const broadcaster=String(process.env.TWITCH_BROADCASTER_ID || '').trim();
  if (!broadcaster) return null;
  const account=(await pool.query('SELECT discord_user_id FROM accounts WHERE twitch_id=$1 LIMIT 1',[broadcaster])).rows[0];
  const linked=String(account?.discord_user_id || '').trim();
  return /^\d{17,20}$/.test(linked) ? linked : null;
}
export function buildDiscordFeedbackPayload(row, mentionId) {
  const bug=row.kind === 'bug';
  const plain=value=>String(value || '').replace(/([\\`*_~|>\[\]])/g,'\\$1');
  const status={new:'À traiter',in_progress:'En cours',resolved:'Résolu'}[row.status] || 'À traiter';
  const capture=row.screenshot ? 'La capture jointe apparaît ci-dessous.' : 'Aucune capture jointe.';
  return {
    username:'LoVeR Watch Game',
    content:mentionId ? `<@${mentionId}> ${bug?'🐛 Un joueur a signalé un bug.':'💡 Un joueur a proposé une idée.'}` : undefined,
    allowed_mentions:{parse:[],users:mentionId?[mentionId]:[]},
    embeds:[{
      author:{name:'LoVeR Watch Game · Retours des joueurs'},
      title:bug?'🐛 Nouveau signalement de bug':'💡 Nouvelle suggestion pour le jeu',
      color:row.status==='resolved'?0x53e6a8:row.status==='in_progress'?0xf3c85b:bug?0xe47788:0x9147ff,
      description:`**👤 Envoyé par :** ${plain(row.player_name).slice(0,200)}\n**📍 Page concernée :** ${plain(row.page)}\n**📋 Suivi :** ${status}\n\n**${bug?'💬 Description du problème':'💬 Idée proposée'}**\n${plain(row.description).slice(0,3400)}${plain(row.description).length>3400?'… (suite dans l’Admin)':''}\n\n**📷 Capture d’écran**\n${capture}`,
      footer:{text:`${bug?'Bug':'Idée'} n°${row.id} · Administration → Bugs et idées des joueurs`},
      timestamp:new Date(row.created_at).toISOString()
    }]
  };
}
export async function discordFailureReason(response) {
  const data=await response.json().catch(()=>({}));
  const code=Number.isInteger(data.code)?data.code:null;
  const reasons={10015:'Le webhook Discord a été supprimé ou remplacé.',10008:'Le message Discord a été supprimé.',50027:'Le token du webhook est invalide.',50013:'Discord refuse l’accès au salon.',50001:'Le webhook n’a plus accès au salon.',50035:'Discord refuse le format du message.',220001:'Le webhook pointe vers un forum : utilise un salon textuel.'};
  let reason=reasons[code] || (response.status===429?'Discord limite temporairement les envois. Réessaie plus tard.':response.status>=500?'Discord est temporairement indisponible.':response.status===401||response.status===403?'Le webhook Discord est refusé : vérifie sa configuration.':'Discord a refusé la requête.');
  if(code===50035 && data.errors){
    const paths=[];
    const walk=(value,path,depth=0)=>{if(!value||typeof value!=='object'||depth>8)return;if(Array.isArray(value._errors))paths.push(path.replace(/[^a-zA-Z0-9_.]/g,'').slice(0,100));for(const key of Object.keys(value)){if(key!=='_errors')walk(value[key],path?`${path}.${key}`:key,depth+1);}};
    walk(data.errors,'');if(paths.length)reason+=` Champs refusés : ${paths.slice(0,4).join(', ')}.`;
  }
  return `${reason} (HTTP ${Number(response.status)||0}${code?`, code ${code}`:''})`;
}
function feedbackNetworkError(error){
  return error?.name==='TimeoutError'||error?.name==='AbortError'?'Discord ne répond pas dans le délai prévu. Réessaie.':'Connexion à Discord impossible. Réessaie et vérifie les journaux du serveur.';
}
export async function deliverFeedbackToDiscord(pool, id) {
  const webhook=feedbackWebhookUrl();
  if(!webhook){await pool.query(`UPDATE game_feedback SET discord_status='not_configured',discord_error='Webhook Discord absent ou invalide.' WHERE id=$1 AND discord_status IN ('waiting','failed','not_configured')`,[id]);return 'not_configured';}
  const claimed=await pool.query(`UPDATE game_feedback SET discord_status='sending',discord_error=NULL WHERE id=$1 AND discord_status IN ('waiting','failed','not_configured') RETURNING *`,[id]);
  const row=claimed.rows[0];if(!row)return 'unchanged';
  let response,reason;
  try {
    // La mention est facultative : son chargement ne doit jamais bloquer le retour.
    let mentionId=null;try{mentionId=await feedbackMentionUserId(pool);}catch{}
    const payload=buildDiscordFeedbackPayload(row,mentionId);
    let body,headers;
    if(row.screenshot){
      const extension=row.screenshot_mime==='image/jpeg'?'jpg':row.screenshot_mime==='image/png'?'png':'webp';
      const filename=`capture-${row.id}.${extension}`;payload.embeds[0].image={url:`attachment://${filename}`};
      body=new FormData();body.append('payload_json',JSON.stringify(payload));body.append('files[0]',new Blob([row.screenshot],{type:row.screenshot_mime}),filename);
    }else{body=JSON.stringify(payload);headers={'Content-Type':'application/json'};}
    response=await fetch(`${webhook}?wait=true`,{method:'POST',headers,body,redirect:'error',signal:AbortSignal.timeout(15000)});
    if(!response.ok)reason=await discordFailureReason(response);
  }catch(error){reason=feedbackNetworkError(error);}
  if(reason){
    console.warn(`[Feedback ${id}] ${reason}`);
    await pool.query(`UPDATE game_feedback SET discord_status='failed',discord_error=$2 WHERE id=$1`,[id,reason]);return 'failed';
  }
  // Une réponse positive confirme l'envoi : ne pas renvoyer un doublon en cas
  // de réponse vide ou d'échec de stockage de l'identifiant.
  const message=await response.json().catch(()=>({}));
  const messageId=/^\d{17,20}$/.test(String(message.id||''))?String(message.id):null;
  const warning=messageId?null:'Message accepté par Discord, mais identifiant absent : synchronisation indisponible.';
  try{
    await pool.query(`UPDATE game_feedback SET discord_status='sent',discord_sent_at=CURRENT_TIMESTAMP,discord_message_id=$2,discord_error=$3 WHERE id=$1`,[id,messageId,warning]);
  }catch{
    console.warn(`[Feedback ${id}] Message accepté par Discord, identifiant non enregistré.`);
    await pool.query(`UPDATE game_feedback SET discord_status='sent',discord_sent_at=CURRENT_TIMESTAMP,discord_error='Message accepté par Discord, identifiant non enregistré.' WHERE id=$1`,[id]);
  }
  return 'sent';
}
export async function syncFeedbackDiscordStatus(pool,id) {
  const row=(await pool.query('SELECT * FROM game_feedback WHERE id=$1',[id])).rows[0];
  const webhook=feedbackWebhookUrl();if(!webhook)return 'not_configured';
  if(!row?.discord_message_id)return row?.discord_status==='sent'?'legacy':'not_sent';
  if(!/^\d{17,20}$/.test(String(row.discord_message_id)))return 'failed';
  let reason;
  try{
    const payload=buildDiscordFeedbackPayload(row,null);
    if(row.screenshot){const ext=row.screenshot_mime==='image/jpeg'?'jpg':row.screenshot_mime==='image/png'?'png':'webp';payload.embeds[0].image={url:`attachment://capture-${row.id}.${ext}`};}
    const response=await fetch(`${webhook}/messages/${row.discord_message_id}`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({embeds:payload.embeds,allowed_mentions:{parse:[]}}),redirect:'error',signal:AbortSignal.timeout(15000)});
    if(!response.ok)reason=await discordFailureReason(response);
  }catch(error){reason=feedbackNetworkError(error);}
  await pool.query('UPDATE game_feedback SET discord_error=$2 WHERE id=$1',[id,reason||null]);
  if(reason){console.warn(`[Feedback ${id}] ${reason}`);return 'failed';}return 'synced';
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
    try {const archived=req.query?.archive==='1';const page=Math.max(1,Math.min(100000,Number.parseInt(req.query?.page,10)||1));const rows=await pool.query(`SELECT id,account_id,player_name,kind,page,description,status,discord_status,discord_error,created_at,discord_sent_at,screenshot IS NOT NULL has_screenshot,COUNT(*) OVER() total_count FROM game_feedback WHERE (status='resolved')=$1 ORDER BY created_at DESC LIMIT 20 OFFSET $2`,[archived,(page-1)*20]);res.json({ok:true,items:rows.rows,page,total:Number(rows.rows[0]?.total_count||0),discordConfigured:Boolean(feedbackWebhookUrl()),discordMentionConfigured:Boolean(await feedbackMentionUserId(pool))});} catch {res.status(500).json({error:'Messages indisponibles.'});}
  });
  router.get('/admin/feedback/:id',async(req,res)=>{
    const id=Number(req.params.id);if(!Number.isSafeInteger(id)||id<1)return res.sendStatus(400);
    try{const row=(await pool.query('SELECT id,account_id,player_name,kind,page,description,status,discord_status,discord_error,created_at,screenshot IS NOT NULL has_screenshot FROM game_feedback WHERE id=$1',[id])).rows[0];if(!row)return res.sendStatus(404);res.json({ok:true,item:row});}catch{res.status(500).json({error:'Retour indisponible.'});}
  });
  router.get('/admin/feedback/:id/screenshot',async(req,res)=>{
    const id=Number(req.params.id);if(!Number.isSafeInteger(id)||id<1)return res.sendStatus(400);
    try {const row=(await pool.query('SELECT screenshot,screenshot_mime FROM game_feedback WHERE id=$1',[id])).rows[0];if(!row?.screenshot)return res.sendStatus(404);res.set({'Content-Type':row.screenshot_mime,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Content-Disposition':'inline'}).send(row.screenshot);} catch {res.sendStatus(500);}
  });
  router.patch('/admin/feedback/:id',async(req,res)=>{
    const id=Number(req.params.id),status=req.body?.status;
    if(!Number.isSafeInteger(id)||id<1||!['new','in_progress','resolved'].includes(status))return res.status(400).json({error:'Statut invalide.'});
    try {const result=await pool.query('UPDATE game_feedback SET status=$2 WHERE id=$1 RETURNING id',[id,status]);if(!result.rowCount)return res.sendStatus(404);let discordSync='failed';try{discordSync=await syncFeedbackDiscordStatus(pool,id);}catch{}const row=(await pool.query('SELECT discord_error FROM game_feedback WHERE id=$1',[id])).rows[0];res.json({ok:true,discordSync,detail:row?.discord_error||null});} catch {res.status(500).json({error:'Modification impossible.'});}
  });
  router.post('/admin/feedback/:id/discord',async(req,res)=>{
    const id=Number(req.params.id);if(!Number.isSafeInteger(id)||id<1)return res.sendStatus(400);
    try {let status=await deliverFeedbackToDiscord(pool,id);if(status==='unchanged')status=await syncFeedbackDiscordStatus(pool,id);const row=(await pool.query('SELECT discord_error FROM game_feedback WHERE id=$1',[id])).rows[0];res.json({ok:true,status,detail:row?.discord_error||null});} catch {res.status(500).json({error:'Envoi Discord impossible.'});}
  });
  return router;
}
