export const botMessageTemplates={
  drop:{label:'Lancement du drop',text:'🎁 Un drop apparaît : {recompense} ! Tape !catch dans les 60 secondes. 1 à 3 gagnants seront tirés au sort !',variables:['recompense'],required:['recompense']},
  winners:{label:'Gagnants du drop',text:'🎉 Drop terminé ! Bravo {gagnants} ! Récompense : {recompense}, ajoutée au jeu.',variables:['gagnants','recompense'],required:['gagnants','recompense']},
  empty:{label:'Drop sans participant',text:'⌛ Drop terminé : aucun participant éligible cette fois.',variables:[]},
  egg:{label:'Œuf prêt',text:'🥚 {joueur}, ton œuf est prêt à éclore ! ✨ Vite, rejoins LoVeR Watch Game pour découvrir quel Lovys se cache à l’intérieur !',variables:['joueur'],required:['joueur']},
  'boost-soon':{label:'Boost personnel bientôt terminé',text:'⏳ {joueur}, ton {boost} se termine dans {minutes} min !',variables:['joueur','boost','minutes'],required:['joueur','boost','minutes']},
  'boost-end':{label:'Boost personnel terminé',text:'⌛ {joueur}, ton {boost} est terminé.',variables:['joueur','boost'],required:['joueur','boost']},
  'live-soon':{label:'Boost du live bientôt terminé',text:'⏳ Le boost du live ({boost}) se termine dans {minutes} min !',variables:['boost','minutes'],required:['boost','minutes']},
  'live-end':{label:'Boost du live terminé',text:'⌛ Le boost du live ({boost}) est terminé.',variables:['boost'],required:['boost']},
  test:{label:'Test de connexion',text:'🧪 Test du bot LoVeR Watch Game : les annonces du jeu sont prêtes !',variables:[]}
};
export function validateBotMessage(key,text){
  if(typeof text!=='string'||!text.trim()||text.trim().length>400||/[\r\n\x00-\x1f]/.test(text))throw Error('Écris un message sur une seule ligne, de 1 à 400 caractères.');
  const definition=botMessageTemplates[key],variables=definition?.variables||[];
  const withoutTokens=text.replace(/\{([a-z]+)\}/g,(_,name)=>{if(!variables.includes(name))throw Error(`Variable inconnue : {${name}}.`);return '';});
  if(/[{}]/.test(withoutTokens))throw Error('Vérifie les accolades et les variables du message.');
  for(const name of definition?.required||[])if(!text.includes(`{${name}}`))throw Error(`Garde la variable {${name}} dans cette annonce.`);
  if(key==='drop'&&!text.includes('!catch'))throw Error('Garde la commande !catch dans l’annonce du drop.');
  return text.trim();
}
export function renderBotMessage(text,values={}){
  const rendered=text.replace(/\{([a-z]+)\}/g,(_,key)=>String(values[key]??''));
  if(rendered.length>500)throw Error('Le message complété dépasse 500 caractères. Raccourcis son texte.');
  return rendered;
}
