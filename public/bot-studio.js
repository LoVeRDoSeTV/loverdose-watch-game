let adminBotMessageTemplates=[];
let adminBotCommands=[];
let adminBotActionNotice=null;
function setBotActionNotice(message,error=false){
  adminBotActionNotice={message,error};
  const status=$('adminGameBot')?.querySelector('[data-game-bot-status]');
  if(status){status.textContent=message;status.dataset.error=String(error);}
}
const adminBotDashboard={view:'overview',search:'',filter:'all'};
const botDashboardViews={
  overview:['Vue d’ensemble','Tout ce qu’il faut pour animer ta communauté.'],
  commands:['Commandes du chat','Les bonnes réponses, au bon moment. Personnalise les commandes de ton bot.'],
  announcements:['Annonces et messages','Donne ta voix aux alertes du jeu et prépare tes messages personnalisés.'],
  drops:['Drops !catch','Récompense ta communauté et règle le rythme des drops pendant tes lives.'],
  history:['Historique du bot','Retrouve les derniers messages et vérifie leur envoi dans le chat.'],
  twitch:['Twitch du site','Connexion du tracker, catégorie détectée et état du suivi Twitch.'],
  settings:['Fonctionnement','Les règles, les délais et les conditions des automatisations.']
};
function setBotDashboardView(view){
  if(!Object.hasOwn(botDashboardViews,view))view='overview';
  const changed=adminBotDashboard.view!==view;
  adminBotDashboard.view=view;
  document.querySelectorAll('#adminBotModal .bot-studio-nav [data-bot-view]').forEach(button=>{
    const active=button.dataset.botView===view;
    button.classList.toggle('active',active);
    if(active)button.setAttribute('aria-current','page');else button.removeAttribute('aria-current');
  });
  document.querySelectorAll('#adminGameBot [data-bot-section]').forEach(section=>{
    section.classList.toggle('hidden',section.dataset.botSection!==view);
  });
  $('adminBotContent')?.classList.toggle('hidden',view==='twitch');
  $('botStudioTwitch')?.classList.toggle('hidden',view!=='twitch');
  if(view==='twitch'&&typeof loadBotTwitchPanel==='function')void loadBotTwitchPanel();
  if(document.body?.classList.contains('bot-studio-standalone')){try{sessionStorage.setItem('loverwatchbot:view',view);}catch{}}
  const [title,description]=botDashboardViews[view];
  if($('botStudioPageTitle'))$('botStudioPageTitle').textContent=title;
  if($('botStudioPageDescription'))$('botStudioPageDescription').textContent=description;
  if(changed)document.querySelector('#adminBotModal .bot-studio-main')?.scrollTo({top:0});
}
function filterBotDashboardCommands(){
  const panel=$('adminGameBot');if(!panel)return;
  const search=adminBotDashboard.search.trim().toLocaleLowerCase('fr-FR');
  let count=0;
  panel.querySelectorAll('.bot-commands-card .bot-template-card').forEach(card=>{
    const enabled=card.querySelector('[data-bot-command-toggle]')?.getAttribute('aria-checked')==='true';
    const visible=card.textContent.toLocaleLowerCase('fr-FR').includes(search)&&(adminBotDashboard.filter==='all'||enabled===(adminBotDashboard.filter==='enabled'));
    card.classList.toggle('hidden',!visible);if(visible)count++;
  });
  const result=panel.querySelector('[data-bot-command-results]');if(result)result.textContent=count+' commande'+(count>1?'s':'')+' affichée'+(count>1?'s':'');
  panel.querySelector('[data-bot-command-empty]')?.classList.toggle('hidden',count>0);
}
function buildBotDashboard(data,panel){
  const grid=panel.querySelector('.bot-panel-grid');if(!grid)return;
  const sections=[['.bot-connection-card','overview'],['.bot-commands-card','commands'],['.bot-egg-card','announcements'],['.bot-editor-card','announcements'],['.bot-drop-card','drops'],['.bot-current-drop-card','drops'],['.bot-schedule-card','drops'],['.bot-history-card','history'],['.bot-timing-card','settings']];
  for(const [selector,view] of sections){const card=grid.querySelector(selector);if(card)card.dataset.botSection=view;}
  const active=adminBotCommands.filter(command=>command.enabled).length;
  const messages=data.messages||[];
  const schedule=data.schedule||{enabled:true,min_minutes:20,max_minutes:40};
  const stats=document.createElement('section');stats.className='bot-studio-stats';stats.dataset.botSection='overview';stats.dataset.connected=String(Boolean(data.connected));stats.setAttribute('aria-label','État du bot');
  stats.innerHTML=[['Connexion Twitch',data.connected?'Connecté':'À connecter',data.connected?'@'+(data.login||'LoVeRWatchBot'):'Connecte ton compte bot','connection'],['Commandes activées',String(active),adminBotCommands.length+' commandes au total','commands'],['Drops automatiques',!schedule.enabled?'Désactivés':!data.connected?'À connecter':!data.enabled?'Suspendus':data.live?'Activés':'En attente',schedule.enabled?Number(schedule.min_minutes||20)+' à '+Number(schedule.max_minutes||40)+' min · '+(!data.enabled?'Bot en pause':data.live?'En live':'Au prochain live'):'Tu choisis le rythme','drops'],['Journal récent',String(messages.length),'Envois ou tentatives conservés dans cette vue','history']].map(([label,value,description,kind])=>`<article class="bot-stat" data-stat="${kind}"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong><small>${escapeHtml(description)}</small></article>`).join('');
  panel.prepend(stats);
  const status=panel.querySelector('[data-game-bot-status]');if(status)panel.prepend(status);
  const commands=grid.querySelector('.bot-commands-card');
  if(commands){
    const toolbar=document.createElement('div');toolbar.className='bot-command-toolbar';
    toolbar.innerHTML=`<label><span>Rechercher une commande</span><input type="search" data-bot-command-search placeholder="!profil, !discord…" value="${escapeHtml(adminBotDashboard.search)}"></label><label><span>État</span><select data-bot-command-filter><option value="all">Toutes les commandes</option><option value="enabled">Activées</option><option value="disabled">Désactivées</option></select></label><span data-bot-command-results role="status"></span>`;
    commands.querySelector('.game-bot-messages')?.before(toolbar);
    toolbar.querySelector('select').value=adminBotDashboard.filter;
    commands.insertAdjacentHTML('beforeend','<div class="bot-search-empty hidden" data-bot-command-empty>Aucune commande ne correspond à ta recherche.</div>');
  }
  const overview=document.createElement('section');overview.className='bot-overview-activity bot-card-wide';overview.dataset.botSection='overview';
  overview.innerHTML=`<div class="bot-section-heading"><div><span class="bot-card-eyebrow">À PORTÉE DE MAIN</span><h4>Fais vivre ton chat</h4></div></div><div class="bot-quick-links"><button type="button" data-bot-view="commands"><span>⌨</span><strong>Personnaliser les commandes</strong><small>Réponses du jeu et commandes sur mesure</small><b aria-hidden="true">↗</b></button><button type="button" data-bot-view="announcements"><span>☷</span><strong>Préparer les annonces</strong><small>Œufs prêts, boosts et messages du jeu</small><b aria-hidden="true">↗</b></button><button type="button" data-bot-view="drops"><span>◇</span><strong>Régler les drops</strong><small>Récompenses, lancement et fréquence</small><b aria-hidden="true">↗</b></button></div><div class="bot-section-heading bot-recent-heading"><h4>Dernière activité</h4><button type="button" data-bot-view="history" class="bot-text-link">Voir le journal →</button></div><div class="bot-recent-list">${messages.slice(0,3).map(message=>`<article><span class="bot-status-dot ${message.status==='sent'?'success':'error'}" aria-hidden="true"></span><div><strong>${message.status==='sent'?'Message envoyé':'Envoi en échec'}</strong><p>${escapeHtml(message.message)}</p></div><time>${escapeHtml(new Date(message.created_at).toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'}))}</time></article>`).join('')||'<div class="bot-studio-empty"><strong>Le journal attend ses premiers messages.</strong><p>Connecte le bot et utilise « Tester le chat » pour vérifier sa connexion.</p></div>'}</div>`;
  grid.appendChild(overview);
  if($('botStudioLive')){$('botStudioLive').textContent=data.live?'● Live en cours':'○ Hors live';$('botStudioLive').classList.toggle('live',Boolean(data.live));}
  if($('botStudioPower')){$('botStudioPower').textContent=data.connected?(data.enabled?'● Bot activé':'○ Bot en pause'):'○ Bot non connecté';$('botStudioPower').classList.toggle('live',Boolean(data.connected&&data.enabled));}
  if($('botStudioAccount'))$('botStudioAccount').textContent=data.connected?'@'+(data.login||'LoVeRWatchBot'):'Compte non connecté';
  if($('botCommandNavCount'))$('botCommandNavCount').textContent=String(adminBotCommands.length);
  setBotDashboardView(adminBotDashboard.view);filterBotDashboardCommands();
}
async function loadGameBotPanel(){
  const host=$('adminBotContent');if(!host)return;
  let panel=$('adminGameBot');
  if(!panel){panel=document.createElement('section');panel.id='adminGameBot';panel.className='bot-studio-content';host.appendChild(panel);}
  try{
    const data=await adminFetch('/api/admin/game-bot');
    adminBotMessageTemplates=data.templates||[];
    adminBotCommands=data.commands||[];
    if(!panel.isConnected)return;
    host.querySelector(':scope > .admin-players-empty')?.remove();
    panel.innerHTML=`<div class="bot-connection-card"><div class="bot-card-eyebrow">🤖 LoVeRWatchBot</div><h3>Le bot de ton jeu</h3><p class="admin-player-meta">Les commandes, les drops et les alertes d’œufs de ta communauté, réunis au même endroit.</p><p>${data.connected?`Compte connecté : <strong>${escapeHtml(data.login||'Bot')}</strong> · ${data.subscriptionId?'Chat Twitch relié':'Connexion au chat à finaliser'}`:'Aucun compte bot connecté.'}</p>${data.error?`<p role="alert">⚠️ ${escapeHtml(data.error)}</p>`:''}<p class="admin-player-meta">${data.connected?'Utilise le test du chat pour vérifier la connexion, ou mets le bot en pause à tout moment.':'Connecte le compte Twitch du bot et ajoute-le aux modérateurs de ta chaîne pour activer ses fonctionnalités.'}</p><a class="btn secondary" href="/api/game-bot/connect">${data.connected?'Reconnecter le compte bot':'Connecter le compte bot'}</a>${data.connected?` <button type="button" class="btn secondary" data-game-bot-subscribe>Relancer la connexion au chat</button> <button type="button" class="btn bot-power-switch" role="switch" aria-label="Bot du jeu" aria-checked="${Boolean(data.enabled)}" data-game-bot-toggle data-enabled="${Boolean(data.enabled)}"><span class="bot-power-track" aria-hidden="true"><span class="bot-power-thumb"></span></span><span class="bot-power-label">Bot ${data.enabled?'ON':'OFF'}</span></button> <button type="button" class="btn secondary" data-game-bot-test>Tester le chat</button><small class="bot-chat-test-help">Le test envoie un seul message, même si le bot est OFF ou si le live est arrêté.</small>`:''}</div><div class="wizebot-drop bot-drop-card"><span class="bot-card-eyebrow">Déclenchement automatique · Live requis</span><h4>🎁 Drops !catch</h4><p>Au lancement d’un drop, le bot annonce une récompense. Les joueurs liés à Twitch ont 60 secondes pour taper !catch, puis il tire et annonce 1 à 3 gagnants. 50 % LoVeR’Cash, 25 % fragments d’œuf, 20 % bouteille de 100 XP et 5 % œuf mystère.</p><button type="button" class="btn" data-game-bot-drop>Lancer un drop supplémentaire</button><p>${data.round?.status==='open'?'Drop en cours':data.round?.status==='pending'?'Drop en préparation':''}</p></div><p data-game-bot-status role="status" aria-live="polite"></p>`;
    const schedule=data.schedule||{enabled:true,min_minutes:20,max_minutes:40};
    panel.insertAdjacentHTML('beforeend',`<div class="wizebot-drop bot-schedule-card"><span class="bot-card-eyebrow">🎲 Le bot s’en charge</span><h4>Drops automatiques aléatoires</h4><p>Le bot attend un délai choisi au hasard, annonce le drop puis tire les gagnants. Après la fin du drop, il choisit un nouveau délai. Aucun lancement hors live.</p><form data-bot-schedule-form><label class="bot-schedule-toggle"><input type="checkbox" name="enabled" ${schedule.enabled?'checked':''}> Activer les drops automatiques</label><div class="bot-schedule-inputs"><label>Délai minimum (minutes)<input name="minMinutes" type="number" min="5" max="180" step="1" required value="${Number(schedule.min_minutes)}"></label><label>Délai maximum (minutes)<input name="maxMinutes" type="number" min="5" max="180" step="1" required value="${Number(schedule.max_minutes)}"></label></div><button class="btn" type="submit">Enregistrer les délais</button><p role="status" data-bot-schedule-status></p></form><p class="bot-schedule-next">${!data.enabled?'Bot désactivé : active-le pour lancer les drops.':!schedule.enabled?'Drops automatiques désactivés.':!data.live?'En attente du live et du tracker. Le délai sera tiré à leur démarrage.':data.round&&['pending','open'].includes(data.round.status)?'Drop en cours : un nouveau délai sera tiré à sa fin.':schedule.next_at?'Prochain drop prévu à '+escapeHtml(new Date(schedule.next_at).toLocaleString('fr-FR')):'Préparation du prochain délai aléatoire…'}</p><p class="admin-player-meta">Réglage possible de 5 à 180 minutes. Enregistrer relance le délai. Un arrêt du live remet l’attente à zéro ; le prochain live repart avec un nouveau tirage.</p></div>`);
    const labels={command:'Réponse à une commande',custom:'Message personnalisé',test:'Test',drop:'Lancement du drop',winners:'Résultat du drop',egg:'Œuf prêt','boost-soon':'Boost bientôt terminé','boost-end':'Boost terminé','live-boost':'Boost du live',announcement:'Annonce du jeu'};
    const round=data.round,states={pending:'En préparation',open:'Participation ouverte',settled:'Terminé',cancelled:'Annulé'};
    const remaining=round?.ends_at?Math.max(0,Math.ceil((Date.parse(round.ends_at)-Date.parse(data.serverTime))/1000)):0;
    const egg=adminBotMessageTemplates.find(template=>template.key==='egg');
    panel.insertAdjacentHTML('beforeend',`<div class="wizebot-drop bot-egg-card"><span class="bot-card-eyebrow">Annonce automatique · Live requis</span><h4>🥚 Œufs prêts à éclore</h4><p>${data.enabled?'LoVeRWatchBot prend en charge les alertes d’œufs.':'Active le bot pour lui confier les alertes d’œufs.'} Chaque nouvel œuf prêt déclenche une annonce avec le @pseudo Twitch du joueur, pour l’œuf de départ comme pour les incubateurs. Le relais Wizebot n’envoie pas ces alertes lorsque le bot du jeu est ON.</p>${egg?`<p class="game-bot-message-text">${escapeHtml(egg.text)}</p><div class="bot-card-actions"><button type="button" class="btn secondary" data-bot-message-edit="egg">Modifier l’annonce d’œuf</button><button type="button" class="btn secondary" data-bot-message-reset="egg">Texte par défaut</button></div>`:''}<p class="admin-player-meta">Détection pendant le live. Un œuf déjà éclos n’est plus annoncé. La variable {joueur} inclut automatiquement le @pseudo.</p></div>`);
    panel.insertAdjacentHTML('beforeend',`<div class="wizebot-drop bot-card-wide bot-commands-card"><h4>⌨️ Commandes du chat</h4><p>Ajoute une commande comme !jeu ou !discord et la réponse que LoVeRWatchBot enverra. Les commandes du jeu ci-dessous affichent les données du compte lié au Twitch de la personne qui écrit. Les commandes personnalisées restent disponibles à tous. Le bot doit être ON, en live comme hors live. !catch reste réservé aux drops.</p><button type="button" class="btn" data-bot-command-new>Ajouter une commande</button><div class="game-bot-messages">${adminBotCommands.map(command=>`<article class="game-bot-message bot-template-card"><span class="bot-template-badge">${command.kind&&command.kind!=='custom'?'Commande du jeu · ':''}${command.enabled?'Activée':'Désactivée'} · Délai ${Number(command.cooldown_seconds)} s</span><h5>${escapeHtml(command.name)}${command.label?` · ${escapeHtml(command.label)}`:''}</h5><p class="game-bot-message-text">${escapeHtml(command.text)}</p><div class="bot-card-actions"><button type="button" class="btn secondary" data-bot-command-edit="${Number(command.id)}">Modifier</button><button type="button" class="btn secondary" role="switch" aria-label="${escapeHtml(command.name)} activée" aria-checked="${Boolean(command.enabled)}" data-bot-command-toggle="${Number(command.id)}">${command.enabled?'ON · Désactiver':'OFF · Activer'}</button>${!command.kind||command.kind==='custom'?`<button type="button" class="btn secondary" data-bot-command-delete="${Number(command.id)}">Supprimer</button>`:''}</div></article>`).join('')||'<p>Aucune commande personnalisée. Ajoute ta première commande ci-dessus.</p>'}</div><p class="admin-player-meta">Le délai s’applique à tous les spectateurs pour la même commande. Le bot accepte au plus une réponse de commande toutes les 3 secondes. {joueur} permet de mentionner la personne qui l’utilise. Les réponses apparaissent dans le journal du bot.</p></div>`);
    panel.insertAdjacentHTML('beforeend',`<div class="wizebot-drop"><h4>✏️ Éditeur des messages</h4><p>Modifier le texte ne change pas les délais ni les récompenses. Les annonces du jeu utilisent les textes ci-dessous. Les variables sont remplacées par les informations du joueur ou du drop. Les messages personnalisés s’envoient manuellement ; ils ne se répètent pas automatiquement.</p><button type="button" class="btn" data-bot-message-new>Ajouter un message</button><div class="game-bot-messages">${adminBotMessageTemplates.filter(template=>template.key!=='egg').map(template=>`<article class="game-bot-message bot-template-card"><span class="bot-template-badge">${template.custom?'Message personnalisé':'Annonce du jeu'}</span><h5>${escapeHtml(template.label)}</h5><p class="game-bot-message-text">${escapeHtml(template.text)}</p><div class="bot-card-actions"><button type="button" class="btn secondary" data-bot-message-edit="${escapeHtml(template.key)}">Modifier</button> <button type="button" class="btn secondary" data-bot-message-reset="${escapeHtml(template.key)}">${template.custom?'Supprimer':'Texte par défaut'}</button>${template.custom?` <button type="button" class="btn" data-bot-message-send="${escapeHtml(template.key)}">Envoyer dans le chat</button>`:''}</div></article>`).join('')}</div></div>`);
    panel.insertAdjacentHTML('beforeend',`<div class="wizebot-drop"><h4>⏱️ Fonctionnement et délais</h4><p><strong>Bot ${data.enabled?'actif':'désactivé'}</strong> · Actualisation du panneau toutes les 15 secondes pendant son affichage.</p><ul><li><strong>Drops automatiques :</strong> délai aléatoire entre ${Number(data.schedule?.min_minutes||20)} et ${Number(data.schedule?.max_minutes||40)} minutes, après le début du live puis après chaque drop terminé. Le bouton de lancement reste facultatif.</li><li><strong>Participation : 60 secondes</strong> après l’annonce, avec !catch. Une inscription par compte lié au jeu.</li><li><strong>Tirage :</strong> 1 gagnant (70 %), 2 (25 %) ou 3 (5 %), dans la limite des participants. Même récompense pour chaque gagnant.</li><li><strong>Envoi du bot :</strong> vérification toutes les 3 secondes. Le lancement et le résultat partent au prochain passage, avec un délai supplémentaire possible lié à Twitch.</li><li><strong>Œufs prêts et boosts :</strong> détection toutes les 15 secondes, puis envoi au passage du bot (jusqu’à 3 annonces par passage).</li><li><strong>Boosts :</strong> rappel dans les 5 dernières minutes, puis annonce de fin. Une annonce par étape et par expiration.</li><li><strong>Validité :</strong> annonce d’œuf pendant 5 minutes, annonce de fin de boost pendant 2 minutes. Les annonces devenues périmées sont ignorées.</li><li>Les drops nécessitent un live actif et un tracker à jour. Ils sont annulés si ces conditions disparaissent.</li></ul></div><div class="wizebot-drop"><h4>🎯 Dernier drop</h4>${round?`<p>${escapeHtml(states[round.status]||round.status)} · ${Number(round.participants||0)} participant(s) · ${escapeHtml({cash:'20 LoVeR’Cash',fragments:'2 fragments d’œuf',xp:'1 fiole de 100 XP',egg:'1 œuf mystère'}[round.reward_key]||round.reward_key)}</p>${round.status==='open'?`<p>Fin des inscriptions : ${escapeHtml(new Date(round.ends_at).toLocaleString('fr-FR'))} · <span data-bot-countdown="${remaining}" data-bot-countdown-at="${Date.now()}">${remaining} s restantes</span></p>`:''}`:'<p>Aucun drop lancé.</p>'}</div><div class="wizebot-drop"><h4>💬 Messages du bot</h4><button type="button" class="btn secondary" data-game-bot-refresh>Actualiser</button><p class="admin-player-meta">Les 50 derniers envois ou tentatives. Le journal conserve jusqu’à 500 messages à partir de cette mise à jour. « Envoyé » signifie accepté par Twitch.</p><div class="game-bot-messages">${(data.messages||[]).map(message=>`<article class="game-bot-message"><p><strong>${escapeHtml(labels[message.kind]||message.kind)}</strong> · ${message.status==='sent'?'✅ Envoyé':'❌ Échec'} · <time>${escapeHtml(new Date(message.created_at).toLocaleString('fr-FR'))}</time></p><p class="game-bot-message-text">${escapeHtml(message.message)}</p>${message.error?`<p role="status">${escapeHtml(message.error)}</p>`:''}</article>`).join('')||'<p>Aucun message enregistré pour le moment.</p>'}</div></div>`);

    const cards=[...panel.querySelectorAll(':scope > .wizebot-drop')];
    const grid=document.createElement('div');grid.className='bot-panel-grid';
    const connection=panel.querySelector('.bot-connection-card');
    if(connection){
      const toolbar=document.createElement('div');toolbar.className='bot-connection-actions';
      connection.querySelectorAll(':scope > .btn').forEach(button=>toolbar.appendChild(button));
      connection.appendChild(toolbar);
      const help=connection.querySelector('.bot-chat-test-help');if(help)connection.appendChild(help);
      const status=panel.querySelector('[data-game-bot-status]');if(status)connection.appendChild(status);
      grid.appendChild(connection);
    }
    for(const card of cards){
      const title=card.querySelector('h4')?.textContent||'';
      if(title.includes('Éditeur'))card.classList.add('bot-editor-card','bot-card-wide');
      else if(title.includes('Fonctionnement'))card.classList.add('bot-timing-card','bot-card-wide');
      else if(title.includes('Messages du bot'))card.classList.add('bot-history-card','bot-card-wide');
      else if(title.includes('Dernier drop'))card.classList.add('bot-current-drop-card');
      grid.appendChild(card);
    }
    const current=grid.querySelector('.bot-current-drop-card'),drop=grid.querySelector('.bot-drop-card');if(current&&drop)drop.after(current);
    panel.prepend(grid);
    buildBotDashboard(data,panel);
    if(document.body.classList.contains('bot-studio-standalone'))panel.querySelector('a[href="/api/game-bot/connect"]')?.setAttribute('href','/api/game-bot/connect?studio=1');
    if(adminBotActionNotice)setBotActionNotice(adminBotActionNotice.message,adminBotActionNotice.error);

  }catch(error){panel.innerHTML=`<div role="alert"><h3>Le tableau de bord est indisponible</h3><p>${escapeHtml(error.message)}</p></div><button type="button" class="btn secondary" data-game-bot-refresh>Réessayer</button>`;}
}
setInterval(()=>{const panel=$('adminGameBot');if(!document.hidden&&panel?.getClientRects().length&&!panel.querySelector('button:disabled')&&!document.querySelector('.game-bot-editor')&&!panel.querySelector('[data-bot-schedule-dirty]')&&!panel.querySelector('input:focus,select:focus,textarea:focus'))void loadGameBotPanel();},15000);
setInterval(()=>{if(document.hidden)return;const timer=document.querySelector('[data-bot-countdown]');if(!timer || !timer.getClientRects().length)return;const seconds=Math.max(0,Number(timer.dataset.botCountdown)-Math.floor((Date.now()-Number(timer.dataset.botCountdownAt))/1000));timer.textContent=seconds?`${seconds} s restantes`:'Inscriptions closes · tirage en cours…';},1000);
function openBotMessageEditor(template=null){
  if(document.querySelector('.game-bot-editor'))return;
  const previousFocus=document.activeElement,overlay=document.createElement('div'),custom=!template||template.custom;
  overlay.className='desktop-egg-boost-overlay game-bot-editor';overlay.setAttribute('role','dialog');overlay.setAttribute('aria-modal','true');overlay.setAttribute('aria-labelledby','botMessageEditorTitle');
  overlay.innerHTML=`<div class="desktop-egg-boost-panel"><h2 id="botMessageEditorTitle">${template?'Modifier le message':'Nouveau message'}</h2><label for="botMessageLabel">Titre</label><input id="botMessageLabel" class="admin-reset-input" maxlength="80" value="${escapeHtml(template?.label||'')}" ${custom?'':'readonly'}><label for="botMessageText">Message (400 caractères maximum)</label><textarea id="botMessageText" rows="5" maxlength="400">${escapeHtml(template?.text||'')}</textarea><p>${template?.variables?.length?'Variables : '+template.variables.map(name=>'{'+escapeHtml(name)+'}').join(', '):'Texte libre sans variable.'}</p><p>Aperçu avec des données d’exemple :</p><p class="game-bot-message-text" data-message-preview></p><p role="status" data-message-error></p><div class="egg-boost-actions"><button type="button" class="shop-action secondary" data-message-cancel>Annuler</button><button type="button" class="shop-action" data-message-save>Enregistrer</button></div></div>`;
  let busy=false;
  const close=()=>{if(busy)return;document.removeEventListener('keydown',onKey,true);overlay.remove();previousFocus?.isConnected&&previousFocus.focus();};
  const onKey=event=>{if(event.key==='Escape'){event.preventDefault();event.stopImmediatePropagation();close();}else if(event.key==='Tab')trapDesktopAdminFocus(event,overlay);};
  const input=overlay.querySelector('textarea'),error=overlay.querySelector('[data-message-error]');
  const preview=()=>{const samples={joueur:'@ExempleJoueur',gagnants:'@Joueur1, @Joueur2',recompense:'une bouteille de 100 XP',boost:'double XP',minutes:'5'};overlay.querySelector('[data-message-preview]').textContent=input.value.replace(/\{([a-z]+)\}/g,(match,name)=>samples[name]||match);};
  overlay.addEventListener('input',preview);
  overlay.addEventListener('click',async event=>{
    if(event.target===overlay||event.target.closest('[data-message-cancel]')){close();return;}
    if(!event.target.closest('[data-message-save]')||busy)return;
    busy=true;const button=overlay.querySelector('[data-message-save]');button.disabled=true;error.textContent='';
    try{await adminFetch('/api/admin/game-bot/messages',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({key:template?.key||'',label:overlay.querySelector('#botMessageLabel').value,text:input.value})});busy=false;close();await loadGameBotPanel();}catch(err){error.textContent=err.message;}finally{busy=false;button.disabled=false;}
  });
  document.body.appendChild(overlay);document.addEventListener('keydown',onKey,true);preview();input.focus();
}
function openBotCommandEditor(command=null){
  if(document.querySelector('.game-bot-editor'))return;
  const previousFocus=document.activeElement,overlay=document.createElement('div'),builtin=command?.kind&&command.kind!=='custom';
  overlay.className='desktop-egg-boost-overlay game-bot-editor';overlay.setAttribute('role','dialog');overlay.setAttribute('aria-modal','true');overlay.setAttribute('aria-labelledby','botCommandEditorTitle');
  overlay.innerHTML=`<div class="desktop-egg-boost-panel"><h2 id="botCommandEditorTitle">${command?'Modifier la commande':'Nouvelle commande'}</h2><label for="botCommandName">Commande (exemple : !discord)</label><input id="botCommandName" class="admin-reset-input" maxlength="31" autocapitalize="none" autocorrect="off" spellcheck="false" value="${escapeHtml(command?.name||'')}" ${builtin?'readonly':''}><label for="botCommandText">Réponse (400 caractères maximum)</label><textarea id="botCommandText" rows="5" maxlength="400">${escapeHtml(command?.text||'')}</textarea><p>Variables disponibles : ${(command?.variables||['joueur']).map(name=>'{'+escapeHtml(name)+'}').join(', ')}. {joueur} inclut le @pseudo. Les données sont remplies automatiquement.</p>${builtin?'<p>Sans compte Twitch lié au jeu, le bot indique comment le lier. Le nom de la commande du jeu est fixe.</p>':''}<label for="botCommandCooldown">Délai entre deux réponses (secondes)</label><input id="botCommandCooldown" class="admin-reset-input" type="number" min="5" max="3600" step="1" value="${Number(command?.cooldown_seconds||30)}"><label class="bot-command-enabled"><input id="botCommandEnabled" type="checkbox" ${!command||command.enabled?'checked':''}> Commande activée</label><p role="status" data-command-error></p><div class="egg-boost-actions"><button type="button" class="shop-action secondary" data-command-cancel>Annuler</button><button type="button" class="shop-action" data-command-save>Enregistrer la commande</button></div></div>`;
  let busy=false;
  const close=()=>{if(busy)return;document.removeEventListener('keydown',onKey,true);overlay.remove();if(previousFocus?.isConnected)previousFocus.focus();};
  const onKey=event=>{if(event.key==='Escape'){event.preventDefault();event.stopImmediatePropagation();close();}else if(event.key==='Tab')trapDesktopAdminFocus(event,overlay);};
  overlay.addEventListener('click',async event=>{
    if(event.target===overlay||event.target.closest('[data-command-cancel]')){close();return;}
    if(!event.target.closest('[data-command-save]')||busy)return;
    busy=true;const button=overlay.querySelector('[data-command-save]'),error=overlay.querySelector('[data-command-error]');button.disabled=true;error.textContent='';
    try{
      const result=await adminFetch('/api/admin/game-bot/commands',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:command?.id,name:overlay.querySelector('#botCommandName').value,text:overlay.querySelector('#botCommandText').value,cooldownSeconds:Number(overlay.querySelector('#botCommandCooldown').value),enabled:overlay.querySelector('#botCommandEnabled').checked})});
      busy=false;close();await loadGameBotPanel();setBotActionNotice(result.message);
    }catch(err){error.textContent=err.message;}finally{busy=false;button.disabled=false;}
  });
  document.body.appendChild(overlay);document.addEventListener('keydown',onKey,true);overlay.querySelector('#botCommandName').focus();
}
$('adminBotContent')?.addEventListener('input',event=>{const form=event.target.closest('[data-bot-schedule-form]');if(form)form.setAttribute('data-bot-schedule-dirty','true');});
$('adminBotContent')?.addEventListener('submit',async event=>{
  const form=event.target.closest('[data-bot-schedule-form]');if(!form)return;event.preventDefault();
  const button=form.querySelector('button'),status=form.querySelector('[data-bot-schedule-status]');if(button.disabled)return;
  button.disabled=true;status.textContent='';
  try{
    const result=await adminFetch('/api/admin/game-bot/schedule',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({enabled:form.elements.enabled.checked,minMinutes:Number(form.elements.minMinutes.value),maxMinutes:Number(form.elements.maxMinutes.value)})});
    await loadGameBotPanel();const updated=$('adminGameBot')?.querySelector('[data-bot-schedule-status]');if(updated)updated.textContent=result.message;
  }catch(error){status.textContent=error.message;}finally{button.disabled=false;}
});
$('adminBotModal')?.addEventListener('click',event=>{
  const target=event.target.closest('[data-bot-view]');
  if(target){setBotDashboardView(target.dataset.botView);$('botStudioPageTitle')?.focus({preventScroll:true});}
});
$('adminBotContent')?.addEventListener('input',event=>{
  if(event.target.matches('[data-bot-command-search]')){adminBotDashboard.search=event.target.value;filterBotDashboardCommands();}
});
$('adminBotContent')?.addEventListener('change',event=>{
  if(event.target.matches('[data-bot-command-filter]')){adminBotDashboard.filter=event.target.value;filterBotDashboardCommands();}
});
$('adminBotContent')?.addEventListener('click',async event=>{
  const commandEdit=event.target.closest('[data-bot-command-new],[data-bot-command-edit]');
  if(commandEdit){openBotCommandEditor(adminBotCommands.find(command=>Number(command.id)===Number(commandEdit.dataset.botCommandEdit)));return;}
  const commandAction=event.target.closest('[data-bot-command-toggle],[data-bot-command-delete]');
  if(commandAction){
    if(commandAction.disabled)return;
    const deleting=commandAction.hasAttribute('data-bot-command-delete'),id=Number(commandAction.dataset.botCommandDelete||commandAction.dataset.botCommandToggle),command=adminBotCommands.find(item=>Number(item.id)===id);if(!command)return;
    commandAction.disabled=true;
    try{
      if(deleting&&!await showAdminActionConfirmation({username:command.name,actionText:'Supprimer la commande',question:'Supprimer cette commande et sa réponse ?'}))return;
      const result=await adminFetch('/api/admin/game-bot/commands'+(deleting?'/delete':''),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(deleting?{id}:{id,name:command.name,text:command.text,enabled:!command.enabled,cooldownSeconds:Number(command.cooldown_seconds)})});
      await loadGameBotPanel();setBotActionNotice(result.message);
    }catch(error){setBotActionNotice(error.message,true);}finally{commandAction.disabled=false;}
    return;
  }
  const edit=event.target.closest('[data-bot-message-edit],[data-bot-message-new]');
  if(edit){openBotMessageEditor(adminBotMessageTemplates.find(template=>template.key===edit.dataset.botMessageEdit));return;}
  const messageAction=event.target.closest('[data-bot-message-reset],[data-bot-message-send]');
  if(messageAction){
    if(messageAction.disabled)return;
    const sending=messageAction.hasAttribute('data-bot-message-send'),key=messageAction.dataset.botMessageSend||messageAction.dataset.botMessageReset,template=adminBotMessageTemplates.find(item=>item.key===key);if(!template)return;
    messageAction.disabled=true;
    try{
      const approved=await showAdminActionConfirmation({username:template.label,actionText:sending?'Envoyer dans le chat Twitch':template.custom?'Supprimer ce message':'Rétablir le texte par défaut',question:sending?`Envoyer maintenant ce message : ${template.text}`:template.custom?'Supprimer ce message personnalisé ?':'Remplacer le texte modifié par le texte d’origine ?'});
      if(!approved)return;
      const result=await adminFetch('/api/admin/game-bot/messages/'+(sending?'send':'reset'),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({key})});
      await loadGameBotPanel();const status=$('adminGameBot')?.querySelector('[data-game-bot-status]');if(status)status.textContent=result.message||'Modification enregistrée.';
    }catch(error){const status=$('adminGameBot')?.querySelector('[data-game-bot-status]');if(status)status.textContent=error.message;}finally{messageAction.disabled=false;}
    return;
  }
  if(event.target.closest('[data-game-bot-refresh]')){await loadGameBotPanel();return;}
  const action=event.target.closest('[data-game-bot-subscribe],[data-game-bot-toggle],[data-game-bot-drop],[data-game-bot-test]');if(!action||action.disabled)return;
  action.disabled=true;action.setAttribute('aria-busy','true');const originalLabel=action.textContent;
  if(action.hasAttribute('data-game-bot-test'))action.textContent='Envoi du test…';
  setBotActionNotice(action.hasAttribute('data-game-bot-test')?'Envoi du message de test dans le chat Twitch…':'Action en cours…');
  try{
    const url=action.hasAttribute('data-game-bot-subscribe')?'/api/admin/game-bot/subscribe':action.hasAttribute('data-game-bot-toggle')?'/api/admin/game-bot/enabled':action.hasAttribute('data-game-bot-test')?'/api/admin/game-bot/test':'/api/admin/game-bot/drop';
    const body=action.hasAttribute('data-game-bot-toggle')?{enabled:action.dataset.enabled!=='true'}:{};
    const data=await adminFetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
    await loadGameBotPanel();
    setBotActionNotice(data.message||(action.hasAttribute('data-game-bot-toggle')?(data.enabled?'Bot ON : prêt à envoyer les annonces du jeu.':'Bot OFF : annonces et drops arrêtés.'):'Action prise en compte.'));
    if(action.hasAttribute('data-game-bot-toggle'))$('adminGameBot')?.querySelector('[data-game-bot-toggle]')?.focus({preventScroll:true});
  }catch(error){setBotActionNotice(error.message,true);}finally{action.disabled=false;action.removeAttribute('aria-busy');if(action.hasAttribute('data-game-bot-test'))action.textContent=originalLabel;}
});
