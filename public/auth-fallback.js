/* Filet de sécurité connexion : garde les boutons d'authentification actifs
   même si une erreur dans une fonctionnalité secondaire interrompt le script principal. */
(function(){
  function byId(id){ return document.getElementById(id); }
  function showLoginFallback(){
    const overlay=byId('authOverlay'), home=document.querySelector('.auth-home'), login=byId('loginScreen'), reg=byId('registerScreen'), twitch=byId('twitchScreen');
    overlay?.classList.remove('hidden');
    if(home) home.style.display='none';
    login?.classList.remove('hidden'); reg?.classList.add('hidden'); twitch?.classList.add('hidden');
    document.body.classList.add('auth-locked');
  }
  function showHomeFallback(){
    const overlay=byId('authOverlay'), home=document.querySelector('.auth-home'), login=byId('loginScreen'), reg=byId('registerScreen'), twitch=byId('twitchScreen');
    overlay?.classList.remove('hidden');
    if(home) home.style.display='flex';
    login?.classList.add('hidden'); reg?.classList.add('hidden'); twitch?.classList.add('hidden');
    document.body.classList.add('auth-locked');
  }
  const showLoginBtn=byId('showLogin');
  if(showLoginBtn && !showLoginBtn.dataset.fallbackBound){
    showLoginBtn.dataset.fallbackBound='1';
    showLoginBtn.addEventListener('click', function(){
      const login=byId('loginScreen');
      setTimeout(function(){ if(login?.classList.contains('hidden')) showLoginFallback(); }, 0);
    });
  }
  const back=byId('backFromLogin');
  if(back && !back.dataset.fallbackBound){
    back.dataset.fallbackBound='1';
    back.addEventListener('click', function(){ setTimeout(function(){ if(!document.querySelector('.auth-home')?.offsetParent) showHomeFallback(); },0); });
  }
  const form=byId('loginForm');
  if(form && !form.dataset.fallbackSubmitBound){
    form.dataset.fallbackSubmitBound='1';
    form.addEventListener('submit', async function(ev){
      /* Si le gestionnaire principal fonctionne déjà, il aura affiché l'écran de chargement. */
      await new Promise(r=>setTimeout(r,0));
      const loading=byId('loadingScreen');
      if(loading && !loading.classList.contains('hidden')) return;
      ev.preventDefault();
      const error=byId('loginError');
      if(error){ error.style.display='none'; error.textContent=''; }
      const submit=form.querySelector('button[type="submit"]');
      if(submit){ submit.disabled=true; submit.dataset.oldText=submit.textContent; submit.textContent='Connexion…'; }
      try{
        const controller=new AbortController();
        const timer=setTimeout(()=>controller.abort(),15000);
        const response=await fetch('/api/account/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:byId('loginEmail')?.value||'',password:byId('loginPassword')?.value||''}),signal:controller.signal});
        clearTimeout(timer);
        let data={}; try{ data=await response.json(); }catch(_){ data={error:'Réponse serveur invalide.'}; }
        if(!response.ok){ throw new Error(data.error||'Connexion impossible.'); }
        if(!data.account?.twitchConnected || !data.account?.gameReady){
          if(typeof window.showTwitchLink==='function') window.showTwitchLink(); else location.reload();
          return;
        }
        location.reload();
      }catch(err){
        if(error){ error.textContent=err?.name==='AbortError'?'Le serveur met trop de temps à répondre. Réessaie dans quelques secondes.':(err?.message||'Impossible de contacter le serveur.'); error.style.display='block'; }
        showLoginFallback();
      }finally{
        if(submit){ submit.disabled=false; submit.textContent=submit.dataset.oldText||'Se connecter'; }
      }
    }, true);
  }
})();
