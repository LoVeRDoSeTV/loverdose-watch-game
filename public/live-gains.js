(() => {
  const box=document.getElementById('liveGains');if(!box)return;
  let player=null,request=null,revision=0,staleTimer=null;
  const states={
    receiving:['Tu es actuellement en train d’XP !','Tes XP et tes LoVeR’Cash sont bien crédités grâce au live.'],
    waiting:['En attente de ta présence sur Twitch','Regarde le live avec ton compte Twitch lié. Le tracker peut mettre quelques instants à te détecter.'],
    offline:['Progression en pause','Le live est hors ligne. Ta progression reprendra pendant le prochain live.'],
    unavailable:['Vérification de ta progression…','Le suivi est momentanément indisponible. On attend la confirmation du tracker Twitch.']
  };
  function status(state,lastCreditAt=null){
    if(!Object.hasOwn(states,state))state='unavailable';
    box.dataset.state=state;
    box.querySelector('[data-gains-status]').textContent=states[state][0];
    box.querySelector('[data-gains-description]').textContent=states[state][1];
    const date=lastCreditAt?new Date(lastCreditAt):null;
    box.querySelector('[data-gains-last]').textContent=state==='receiving'&&date&&Number.isFinite(date.getTime())?'Dernier crédit confirmé à '+date.toLocaleTimeString('fr-FR')+'.':'';
  }
  window.liveGainsUnavailable=()=>{if(player)status('unavailable');};
  function forget(){
    revision++;request?.controller.abort();request=null;clearTimeout(staleTimer);
    player=null;box.hidden=true;status('unavailable');
  }
  window.refreshLiveGains=async user=>{
    if(!user){forget();return;}
    const id=String(user.id);
    if(player!==id){forget();player=id;}
    if(document.hidden)return;
    if(request)return request.promise;
    const controller=new AbortController(),version=revision;
    const timeout=setTimeout(()=>controller.abort(),12000),current={controller,promise:null};request=current;
    current.promise=(async()=>{
      try{
        const response=await fetch('/api/game/live-gains',{cache:'no-store',signal:controller.signal});
        if(version!==revision)return;
        if(response.status===401){forget();return;}
        if(!response.ok)throw Error('Unavailable');
        const data=await response.json();if(version!==revision)return;
        if(String(data.playerId)!==player)throw Error('Wrong player');
        status(data.state,data.lastCreditAt);box.hidden=false;
        clearTimeout(staleTimer);staleTimer=setTimeout(()=>{if(player)status('unavailable');},45000);
      }catch{if(version===revision){box.hidden=false;status('unavailable');}}
      finally{clearTimeout(timeout);if(request===current)request=null;}
    })();
    return current.promise;
  };
})();
