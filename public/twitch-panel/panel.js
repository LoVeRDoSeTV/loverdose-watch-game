'use strict';
(()=>{
  const SITE=new URL(window.LOVER_PANEL_CONFIG.siteOrigin).origin;
  const root=document.getElementById('panel');
  const preview=location.pathname.endsWith('/preview.html');
  let token='',revision=0,visible=true,busy=false,controller=null,poll=null;
  const $=id=>document.getElementById(id);
  const node=(tag,className,text)=>{const e=document.createElement(tag);if(className)e.className=className;if(text!==undefined)e.textContent=text;return e;};
  const image=(src,alt)=>{const e=node('img');e.alt=alt;e.src=SITE+src;e.decoding='async';return e;};
  const link=(text,path='/',className='')=>{const e=node('a',className,text);e.href=SITE+path;e.target='_blank';e.rel='noopener noreferrer';return e;};
  function shell(){
    root.replaceChildren();
    if(preview){const demo=node('div','demo','Aperçu · données fictives');demo.append(node('br'));const guest=node('a','','Visiteur');guest.href='preview.html?view=guest';const player=node('a','','Joueur');player.href='preview.html?view=player';demo.append(guest,' · ',player);root.append(demo);}
    const header=node('header','brand'),brand=node('div');
    const name=node('div','brand-name','LoVeR ');name.append(node('em','','Watch Game'));
    brand.append(name,node('small','','REGARDE. COLLECTIONNE. PROGRESSE.'));
    const refresh=node('button','refresh','↻');refresh.type='button';refresh.title='Actualiser ma progression';refresh.setAttribute('aria-label','Actualiser ma progression');refresh.addEventListener('click',()=>refreshPanel());
    header.append(brand,refresh);root.append(header);
  }
  function footer(){root.append(node('p','foot','Éclosion, objets et combats sur loverwatchgame.fr.'));const status=node('p','status');status.id='panelStatus';status.setAttribute('role','status');root.append(status);}
  function guest(state='guest',message=''){
    shell();const body=node('section','guest');
    const art=image('/api/twitch-panel/art/Voltis.webp','Voltis, un Lovys de type Foudre');art.className='guest-art';body.append(art);
    const title=node('h1','','Ton live. ');title.append(node('span','','Tes Lovys.'));body.append(title);
    body.append(node('p','','Regarde LoVeRDoSeTV, fais éclore tes œufs et collectionne tes compagnons.'));
    const points=node('div','guest-points');
    for(const [icon,title,text]of [['🥚','Des œufs à faire éclore','Progresse pendant les lives.'],['🐉','Une collection à faire grandir','Découvre les Lovys et améliore leurs rangs.'],['⚔️','Une aventure sur le site','Combats, échanges et badges t’y attendent.']]){const row=node('div'),copy=node('div');copy.append(node('strong','',title),node('small','',text));row.append(node('span','',icon),copy);points.append(row);}
    body.append(points);
    if(state==='identity_required'){
      const button=node('button','secondary','Déjà lié ? Afficher ma progression');button.type='button';button.addEventListener('click',()=>{
        if(preview)return;
        try{window.Twitch?.ext?.actions?.requestIdShare();$('panelStatus').textContent='Autorise Twitch à reconnaître ton compte, puis actualise si nécessaire.';}catch{$('panelStatus').textContent='Ouvre le panel sur Twitch pour afficher ta progression.';}
      });body.append(button);
    }
    body.append(link('Découvrir le jeu ↗','/','secondary'));root.append(body,link('Connecter mon compte sur le site ↗','/twitch-panel/connect.html','cta'));footer();
    if(message)$('panelStatus').textContent=message;
    else if(state==='link_required')$('panelStatus').textContent='Connecte ce compte Twitch au jeu, puis autorise son aperçu sur le site.';
    else if(state==='identity_required')$('panelStatus').textContent='Après la liaison sur le site, affiche ta progression ici.';
  }
  const watchTime=seconds=>{const minutes=Math.ceil(Math.max(0,seconds)/60);return minutes>=60?`${Math.floor(minutes/60)} h ${String(minutes%60).padStart(2,'0')}`:`${minutes} min`;};
  function player(data){
    shell();const intro=node('p','intro','L’aventure de ');intro.append(node('strong','',data.player.name));root.append(intro);
    const lovy=data.player.lovys,hero=node('section','lovy'),copy=node('div','lovy-copy');
    if(lovy){hero.append(image(lovy.image,lovy.name));copy.append(node('span','eyebrow','Ton Lovys actif'),node('h1','',lovy.name),node('p','',`Niv. ${lovy.level} · ${lovy.type}`));const stars=node('div','stars','★'.repeat(Math.max(1,Math.min(5,Number(lovy.rank)||1))));stars.setAttribute('aria-label',`Rang ${lovy.rank} sur 5`);copy.append(stars);}
    else{hero.append(node('span','egg-icon','🥚'));copy.append(node('span','eyebrow','Le début de l’aventure'),node('h1','','Ton premier Lovys'),node('p','','Fais éclore ton œuf sur le site.'));}
    hero.append(copy);root.append(hero);
    const bank=node('div','bank','🏦 XP en réserve');bank.append(node('strong','',Number(data.player.pendingXp).toLocaleString('fr-FR')));root.append(bank);
    const eggHead=node('div','section-head');eggHead.append(node('h2','','Mes œufs'),node('span','eyebrow','Progression en live'));root.append(eggHead);
    const eggs=node('div','eggs');
    for(const egg of data.eggs){const card=node('div','egg'+(egg.empty?' empty':egg.ready?' ready':''));card.append(node('span','egg-icon',egg.empty?'＋':'🥚'),node('strong','',egg.empty?'Emplacement libre':egg.ready?'Prêt à éclore !':`Œuf ${egg.slot}`),node('small','',egg.empty?'Sur le site':egg.ready?'Sur le site':watchTime(egg.remainingWatchSeconds)+' de live'));
      if(!egg.empty){const track=node('div','track'),fill=node('span');fill.style.width=Math.max(0,Math.min(100,egg.progress))+'%';track.setAttribute('role','progressbar');track.setAttribute('aria-label',`Incubation de l’œuf ${egg.slot}`);track.setAttribute('aria-valuemin','0');track.setAttribute('aria-valuemax','100');track.setAttribute('aria-valuenow',String(Math.round(egg.progress)));track.append(fill);card.append(track);}eggs.append(card);}
    root.append(eggs);
    const itemHead=node('div','section-head');itemHead.append(node('h2','','Mes objets'),node('span','eyebrow','Disponibles'));root.append(itemHead);
    if(data.items.length){const items=node('div','items');for(const item of data.items){const row=node('div','item');row.append(node('span','item-icon',item.icon),node('span','item-name',item.name),node('strong','',`×${item.quantity}`));items.append(row);}root.append(items);}
    else root.append(node('p','empty-copy','Ton inventaire d’objets utilisables est vide pour le moment.'));
    root.append(link('Ouvrir le jeu ↗','/','cta'));footer();
    $('panelStatus').textContent=preview?'Démonstration · aucune donnée réelle.':'Progression actualisée · mise à jour toutes les 30 s.';
  }
  function demo(){
    if(new URLSearchParams(location.search).get('view')!=='player')return guest('identity_required');
    player({player:{name:'LoVeRDoSe',pendingXp:60,lovys:{name:'Voltis',level:14,rank:3,type:'Foudre',image:'/api/twitch-panel/art/Voltis.webp'}},eggs:[{slot:1,progress:100,ready:true},{slot:2,progress:64,remainingWatchSeconds:7776},{slot:3,empty:true}],items:[{icon:'⚡',name:'Booster XP x2',quantity:2},{icon:'⏱️',name:'Accélérateur 30 min',quantity:3},{icon:'🥚',name:'Œuf mystère',quantity:1}],itemTypes:3});
  }
  async function refreshPanel(){
    if(preview)return demo();
    if(!token||!visible||document.hidden||busy)return;
    busy=true;const version=revision,usedToken=token;const abort=new AbortController();controller=abort;const timeout=setTimeout(()=>abort.abort(),10000);
    try{
      const response=await fetch(SITE+'/api/twitch-panel/snapshot',{headers:{Authorization:'Bearer '+usedToken},credentials:'omit',cache:'no-store',signal:abort.signal});const data=await response.json();
      if(version!==revision)return;
      if(!response.ok){
        if(response.status===401){guest('guest','Actualise le panel sur Twitch pour renouveler ton autorisation.');return;}
        if(response.status===503){guest('guest',data.error);return;}
        throw new Error(data.error||'Actualisation momentanément indisponible.');
      }
      if(data.state==='player')player(data);else guest(data.state);
    }catch(error){if(version===revision&&$('panelStatus'))$('panelStatus').textContent='Actualisation indisponible. Réessaie avec ↻.';}
    finally{clearTimeout(timeout);if(version===revision){busy=false;controller=null;}}
  }
  function schedule(){clearInterval(poll);if(visible&&!document.hidden)poll=setInterval(refreshPanel,30000);}
  if(preview){demo();return;}
  guest();
  if(window.Twitch?.ext){
    Twitch.ext.onAuthorized(auth=>{revision++;controller?.abort();busy=false;token=auth.token;guest('guest','Chargement de ta progression…');refreshPanel();schedule();});
    Twitch.ext.onVisibilityChanged(isVisible=>{revision++;controller?.abort();busy=false;visible=isVisible;schedule();if(visible)refreshPanel();});
  }else $('panelStatus').textContent='Ton aperçu personnel sera disponible dans l’extension Twitch.';
  document.addEventListener('visibilitychange',()=>{revision++;controller?.abort();busy=false;schedule();if(!document.hidden)refreshPanel();});
})();
