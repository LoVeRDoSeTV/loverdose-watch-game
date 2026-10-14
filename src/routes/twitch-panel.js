import express from 'express';
import path from 'node:path';
import { rateLimit } from 'express-rate-limit';
import { panelSettings, verifyExtensionToken, loadPanelSnapshot } from '../twitch-panel.js';

export function createTwitchPanelRouter({pool,baseUrl,hatchSeconds,creatureBattleStats,catalog,env=process.env}){
  const router=express.Router();
  const siteOrigin=new URL(baseUrl).origin;
  router.use((req,res,next)=>{res.set('Cache-Control','no-store');next();});
  // CORS is restricted to this extension and this site's preview, without cookies.
  router.use('/snapshot',(req,res,next)=>{
    const settings=panelSettings(env),origin=req.get('origin');
    const allowed=origin===siteOrigin||(settings.ready&&origin===`https://${settings.clientId}.ext-twitch.tv`);
    res.vary('Origin');
    if(origin&&!allowed)return res.status(403).json({error:'Origine du panel refusée.'});
    if(allowed)res.set('Access-Control-Allow-Origin',origin);
    if(req.method==='OPTIONS'){
      res.set('Access-Control-Allow-Methods','GET, OPTIONS');
      res.set('Access-Control-Allow-Headers','Authorization');
      return res.sendStatus(204);
    }
    next();
  });
  router.use(rateLimit({windowMs:60000,limit:300,standardHeaders:'draft-7',legacyHeaders:false,message:{error:'Patiente un instant avant d’actualiser le panel.'}}));

  router.get('/art/:file',(req,res)=>{
    const files=new Set(['Mossy.webp','Nymea.webp','Voltis.webp','Brumee.webp','Flamby.webp','Crysal.webp','Ferox.webp','Nocty.webp','Solka.webp','Mimo.webp']);
    if(!files.has(req.params.file))return res.sendStatus(404);
    res.set('Cross-Origin-Resource-Policy','cross-origin');
    res.set('Cache-Control','public, max-age=3600');
    res.sendFile(path.resolve('public',req.params.file));
  });

  router.get('/snapshot',async(req,res)=>{
    const settings=panelSettings(env);
    if(!settings.ready)return res.status(503).json({state:'setup_required',error:'Le panel est en cours de préparation.'});
    let identity;
    try{identity=verifyExtensionToken(String(req.get('authorization')||'').replace(/^Bearer /i,''),settings);}
    catch{return res.status(401).json({state:'authorization_required',error:'Actualise l’autorisation Twitch.'});}
    if(!identity.user_id||identity.is_unlinked===true||identity.is_unlinked==='true')return res.json({state:'identity_required'});
    try{
      res.json(await loadPanelSnapshot({pool,twitchId:identity.user_id,hatchSeconds,creatureBattleStats,catalog}));
    }catch(error){console.error('Erreur lecture panel Twitch :',error.message);res.status(500).json({error:'La progression est momentanément indisponible.'});}
  });

  // Entrée depuis le panneau : conserver l'intention dans la session serveur.
  router.get('/start',(req,res)=>{
    const mode=String(req.query.mode||'');
    if(!['register','login'].includes(mode))return res.status(400).send('Parcours invalide.');
    req.session.twitchPanelIntent={mode,createdAt:Date.now()};
    req.session.save(error=>{
      if(error)return res.status(500).send('Impossible de préparer la liaison.');
      res.redirect('/?twitch_panel='+mode);
    });
  });

  router.get('/connection',async(req,res)=>{
    if(!req.session?.account?.id)return res.json({authenticated:false});
    try{
      const result=await pool.query(`SELECT a.username,a.twitch_id,a.twitch_panel_enabled,u.id AS user_id FROM accounts a LEFT JOIN users u ON u.twitch_id=a.twitch_id WHERE a.id=$1`,[req.session.account.id]);
      const row=result.rows[0];
      res.json({authenticated:Boolean(row),name:row?.username||'',twitchConnected:Boolean(row?.twitch_id&&row?.user_id),enabled:Boolean(row?.twitch_panel_enabled),configured:panelSettings(env).ready,panelRequested:Boolean(req.session.twitchPanelIntent&&Date.now()-req.session.twitchPanelIntent.createdAt<20*60*1000)});
    }catch{res.status(500).json({error:'Impossible de vérifier la connexion.'});}
  });

  router.post('/connection',async(req,res)=>{
    if(req.get('origin')!==siteOrigin)return res.status(403).json({error:'Ouvre cette page depuis le site du jeu.'});
    if(!req.session?.account?.id)return res.status(401).json({error:'Connecte-toi sur le site du jeu.'});
    if(typeof req.body?.enabled!=='boolean')return res.status(400).json({error:'Choix invalide.'});
    try{
      // Explicit site consent; the account's Twitch connection is established by existing OAuth.
      const result=await pool.query(`UPDATE accounts SET twitch_panel_enabled=$2,updated_at=CURRENT_TIMESTAMP WHERE id=$1 AND ($2=FALSE OR (twitch_id IS NOT NULL AND EXISTS(SELECT 1 FROM users WHERE users.twitch_id=accounts.twitch_id))) RETURNING twitch_panel_enabled`,[req.session.account.id,req.body.enabled]);
      if(!result.rowCount)return res.status(409).json({error:'Relie d’abord ton compte Twitch depuis le site du jeu.'});
      delete req.session.twitchPanelIntent;
      res.json({ok:true,enabled:Boolean(result.rows[0].twitch_panel_enabled)});
    }catch{res.status(500).json({error:'Impossible de modifier la liaison.'});}
  });
  return router;
}
