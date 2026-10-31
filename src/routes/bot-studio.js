import express from 'express';
import {fileURLToPath} from 'node:url';

// HTML stays outside public/: the owner check runs before any private UI is sent.
export function createBotStudioRouter({getBroadcasterAccount}) {
  const router=express.Router();
  router.get(['/bot','/bot/'],async(req,res)=>{
    res.set('Cache-Control','no-store');
    res.set('X-Robots-Tag','noindex, nofollow');
    try {
      const owner=await getBroadcasterAccount(req);
      if(!owner){
        if(req.session?.account)res.status(403);
        return res.sendFile(fileURLToPath(new URL('../../views/bot-login.html',import.meta.url)));
      }
      return res.sendFile(fileURLToPath(new URL('../../views/bot-studio.html',import.meta.url)));
    }catch{res.status(503).send('Studio temporairement indisponible. Réessaie dans quelques instants.');}
  });
  return router;
}
