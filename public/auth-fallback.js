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

/* Entrée depuis l'extension Twitch : ouverture des formulaires puis consentement. */
(function () {
  const query = new URLSearchParams(location.search);
  const choice = query.get('twitch_panel');
  if (choice === 'register' || choice === 'login') {
    sessionStorage.setItem('lwg_twitch_panel_intent', choice);
    history.replaceState(history.state, '', location.pathname + location.hash);
  }
  if (!sessionStorage.getItem('lwg_twitch_panel_intent')) return;

  const formButton = document.getElementById(choice === 'register' ? 'showRegister' : 'showLogin');
  const loggedIn = () => !document.body.classList.contains('auth-locked');
  if (choice && formButton) {
    // Laisser à app.js le temps de restaurer la session.
    setTimeout(() => { if (!loggedIn()) formButton.click(); }, 800);
  }

  let popupOpen = false, pending = false, completed = false;
  function modal() {
    let root = document.getElementById('lwg-panel-confirm');
    if (root) return root;
    root = document.createElement('div');
    root.id = 'lwg-panel-confirm';
    root.setAttribute('role', 'dialog');
    root.setAttribute('aria-modal', 'true');
    root.setAttribute('aria-labelledby', 'lwg-panel-title');
    root.style.cssText = 'position:fixed;inset:0;z-index:2147483000;background:rgba(5,3,14,.88);display:grid;place-items:center;padding:18px';
    root.innerHTML = '<div style="background:linear-gradient(160deg,#28153e,#100d1d);border:1px solid #9e64dd;border-radius:18px;max-width:410px;width:100%;color:#fff;padding:25px 22px;text-align:center;box-shadow:0 18px 55px #000a;font:14px/1.5 system-ui,sans-serif">' +
      '<h2 id="lwg-panel-title" style="font-size:20px;margin:0 0 12px">Lier ton panneau Twitch ?</h2>' +
      '<p id="lwg-panel-desc" style="color:#ddd0ef;margin:0 0 20px">Autorises-tu le panneau LoVeR Watch Game à afficher ton profil, tes Lovys et ton inventaire ?</p>' +
      '<p id="lwg-panel-error" role="alert" style="color:#ffb5c5;display:none"></p>' +
      '<div style="display:flex;gap:8px;justify-content:center;flex-wrap:wrap">' +
      '<button type="button" id="lwg-panel-cancel" style="border:1px solid #78648c;background:#261d32;color:white;padding:12px;border-radius:10px;cursor:pointer;flex:1">Refuser</button>' +
      '<button type="button" id="lwg-panel-accept" style="border:0;background:#9950ec;color:white;padding:12px;border-radius:10px;cursor:pointer;flex:1">Confirmer la liaison</button>' +
      '</div></div>';
    document.body.appendChild(root);
    root.querySelector('#lwg-panel-cancel').addEventListener('click', () => {
      sessionStorage.removeItem('lwg_twitch_panel_intent');
      root.remove(); completed = true;
    });
    root.querySelector('#lwg-panel-accept').addEventListener('click', async () => {
      if (pending) return;
      pending = true;
      const btn = root.querySelector('#lwg-panel-accept');
      const error = root.querySelector('#lwg-panel-error');
      btn.disabled = true;
      error.style.display = 'none';
      try {
        const response = await fetch('/api/twitch-panel/connection', {
          method: 'POST', credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ enabled: true })
        });
        const payload = await response.json();
        if (!response.ok || !payload.ok) throw new Error(payload.error || 'Liaison impossible.');
        sessionStorage.removeItem('lwg_twitch_panel_intent');
        completed = true;
        root.querySelector('#lwg-panel-title').textContent = 'Liaison confirmée !';
        root.querySelector('#lwg-panel-desc').textContent = 'Ton panneau Twitch peut maintenant afficher tes informations. Retourne sur Twitch et actualise le panneau.';
        btn.textContent = 'Terminer';
        btn.disabled = false;
        btn.onclick = () => root.remove();
      } catch (err) {
        error.textContent = err.message || 'Une erreur est survenue.';
        error.style.display = 'block';
        btn.disabled = false;
      } finally {
        pending = false;
      }
    });
    root.querySelector('#lwg-panel-accept').focus();
    return root;
  }
  let tries = 0;
  const watch = setInterval(async () => {
    if (completed || !sessionStorage.getItem('lwg_twitch_panel_intent') || ++tries > 240) {
      clearInterval(watch); return;
    }
    if (popupOpen || pending) return;
    try {
      const response = await fetch('/api/twitch-panel/connection', { credentials: 'same-origin', cache: 'no-store' });
      if (!response.ok) return;
      const state = await response.json();
      if (!state.authenticated || !state.twitchConnected) return;
      if (state.enabled) {
        sessionStorage.removeItem('lwg_twitch_panel_intent');
        completed = true; clearInterval(watch); return;
      }
      popupOpen = true;
      modal();
      clearInterval(watch);
    } catch (_) {}
  }, 1500);
})();
