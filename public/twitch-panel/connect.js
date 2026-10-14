'use strict';
(()=>{
  const $=id=>document.getElementById(id);let busy=false,mutating=false;
  async function request(options={}){
    const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),10000);
    try{const r=await fetch('/api/twitch-panel/connection',{credentials:'same-origin',cache:'no-store',...options,signal:controller.signal});const data=await r.json();if(!r.ok)throw new Error(data.error||'Connexion indisponible.');return data;}finally{clearTimeout(timeout);}
  }
  async function check(){
    if(busy||mutating||document.hidden)return;busy=true;
    try{
      const data=await request();
      $('loginLink').hidden=data.authenticated&&data.twitchConnected;
      $('consentButton').hidden=!data.authenticated||!data.twitchConnected||data.enabled;
      $('revokeButton').hidden=!data.authenticated||!data.enabled;
      $('connectionState').textContent=data.authenticated?`Connecté : ${data.name}`:'Aucune connexion au jeu détectée';
      $('connectionTitle').textContent=data.enabled?'Ton aperçu est autorisé':data.authenticated&&data.twitchConnected?'Autoriser mon aperçu':'Connecter mon compte';
      $('connectionCopy').textContent=!data.authenticated?'Ouvre le site, connecte-toi ou crée ton compte, puis reviens sur cette page.':!data.twitchConnected?'Ouvre le site et relie ton compte Twitch depuis Mon compte. Reviens ensuite ici pour autoriser l’aperçu.':data.enabled?'Tu peux revenir sur Twitch. Dans le panel, autorise Twitch à reconnaître ce même compte pour afficher ta progression.':'Le panel pourra consulter ton Lovys, tes œufs, ton XP en réserve et tes objets. Aucune action de jeu ne sera effectuée.';
      if(data.authenticated&&!data.configured)$('connectionMessage').textContent='Le panel est encore en préparation. Ta liaison peut déjà être enregistrée.';
    }catch(error){$('connectionMessage').textContent=error.name==='AbortError'?'La vérification prend trop de temps. Réessaie.':error.message;}
    finally{busy=false;}
  }
  async function consent(enabled){
    if(mutating||busy)return;mutating=true;$('consentButton').disabled=true;$('revokeButton').disabled=true;
    try{await request({method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({enabled})});$('connectionMessage').textContent=enabled?'Liaison enregistrée. Reviens maintenant sur Twitch.':'Aperçu désactivé. Tes données ne seront plus renvoyées au panel.';}
    catch(error){$('connectionMessage').textContent=error.name==='AbortError'?'La demande a pris trop de temps. Vérifie son état avant de réessayer.':error.message;}
    finally{mutating=false;$('consentButton').disabled=false;$('revokeButton').disabled=false;check();}
  }
  $('consentButton').addEventListener('click',()=>consent(true));$('revokeButton').addEventListener('click',()=>consent(false));$('checkButton').addEventListener('click',check);
  window.addEventListener('focus',check);document.addEventListener('visibilitychange',check);setInterval(check,15000);check();
})();
