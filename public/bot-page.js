let botTwitchBusy=false;
async function loadBotTwitchPanel(){
  const host=$('botStudioTwitch');if(!host||botTwitchBusy)return;botTwitchBusy=true;
  try{
    const data=await adminFetch('/api/tracker/status');
    const state=!data.authorized?'À configurer':data.error?'À vérifier':data.live?'Live détecté':'Hors live';
    host.innerHTML=`<div class="bot-twitch-grid"><article class="bot-twitch-card"><span class="bot-card-eyebrow">TWITCH DU SITE</span><h3>Connexion et suivi du live</h3><p class="bot-status-chip ${data.authorized&&!data.error?'live':''}">${escapeHtml(state)}</p><p>${data.authorized?'Le tracker suit la présence des joueurs sur la chaîne LoVeRDoSeTV.':'Connecte le compte Twitch LoVeRDoSeTV pour autoriser le suivi.'}</p>${data.error?`<p role="alert">${escapeHtml(data.error)}</p>`:''}<div class="bot-twitch-actions"><a class="bot-back-button" href="/auth/twitch/tracker?studio=1">${data.authorized?'Reconnecter Twitch':'Connecter Twitch'}</a><button type="button" class="bot-back-button" data-studio-tracker-test ${!data.authorized?'disabled':''}>Tester le tracker</button><button type="button" class="bot-back-button" data-studio-tracker-refresh>Actualiser</button></div><p>Dernier suivi réussi : ${data.lastSuccessAt?escapeHtml(new Date(data.lastSuccessAt).toLocaleString('fr-FR')):'aucun pour le moment'}</p></article><article class="bot-twitch-card"><span class="bot-card-eyebrow">CATÉGORIE DÉTECTÉE</span><h3>${escapeHtml(data.gameName||(data.live?'Catégorie indisponible':'En attente du live'))}</h3><p>Le site utilise automatiquement la catégorie de ton live Twitch pour comptabiliser le visionnage des badges concernés.</p><dl><div><dt>Spectateurs Twitch</dt><dd>${Number(data.viewerCount||0)}</dd></div><div><dt>Comptes dans le chat</dt><dd>${Number(data.chatterCount||0)}</dd></div><div><dt>Joueurs reconnus</dt><dd>${Number(data.matchedCount||0)}</dd></div></dl></article></div><p id="botTwitchNotice" role="status" aria-live="polite"></p>`;
  }catch(error){host.innerHTML=`<p role="alert">${escapeHtml(error.message)}</p><button type="button" class="bot-back-button" data-studio-tracker-refresh>Réessayer</button>`;}
  finally{botTwitchBusy=false;}
}
$('botStudioTwitch')?.addEventListener('click',async event=>{
  const button=event.target.closest('[data-studio-tracker-refresh],[data-studio-tracker-test]');
  if(!button||button.disabled)return;
  if(button.hasAttribute('data-studio-tracker-refresh'))return loadBotTwitchPanel();
  button.disabled=true;
  try{
    const result=await adminFetch('/api/tracker/run-now',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({})});
    if(result.ok===false)throw new Error(result.error||'Test du tracker impossible.');
    await loadBotTwitchPanel();if($('botTwitchNotice'))$('botTwitchNotice').textContent='Test du tracker terminé.';
  }catch(error){if($('botTwitchNotice'))$('botTwitchNotice').textContent=error.message;}
  finally{button.disabled=false;}
});
$('botStudioFullscreen')?.addEventListener('click',async()=>{
  try{if(document.fullscreenElement)await document.exitFullscreen();else await document.documentElement.requestFullscreen();}catch{if($('botStudioNotice'))$('botStudioNotice').textContent='Le plein écran n’est pas disponible dans ce navigateur.';}
});
document.addEventListener('fullscreenchange',()=>{if($('botStudioFullscreen'))$('botStudioFullscreen').textContent=document.fullscreenElement?'⛶ Quitter le plein écran':'⛶ Plein écran';});
try{setBotDashboardView(sessionStorage.getItem('loverwatchbot:view')||'overview');}catch{}
void loadGameBotPanel();
setInterval(()=>{if(!document.hidden&&$('botStudioTwitch')?.getClientRects().length)void loadBotTwitchPanel();},30000);
