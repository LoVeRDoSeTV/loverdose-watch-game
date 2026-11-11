(() => {
  const flask='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><defs><linearGradient id="g" x2="1" y2="1"><stop stop-color="#50f3d3"/><stop offset="1" stop-color="#16853f"/></linearGradient></defs><path d="M39 8h22v14l-5 8v17l23 32c5 7 0 13-8 13H29c-8 0-13-6-8-13l23-32V30l-5-8z" fill="#e0f8ff" stroke="#87c5d3" stroke-width="5"/><path d="M34 69h32l9 13c2 3 0 5-4 5H29c-4 0-6-2-4-5z" fill="url(#g)"/><path d="M38 8h24v14H38z" fill="#7445c6" stroke="#c7a6ff" stroke-width="4"/><text x="50" y="81" text-anchor="middle" font-size="17" font-family="Arial" font-weight="bold" fill="white">XP</text></svg>';
  const variants={
    cash:{image:'/lovercash-logo.webp',label:'3 à 25 LoVeR’Cash',notes:[392,494,659,784]},
    fragments:{image:'/assets/fragment-premium.webp',label:'2 fragments d’œuf',notes:[440,587,698,880]},
    xp:{image:'data:image/svg+xml;charset=utf-8,'+encodeURIComponent(flask),label:'Une fiole de 100 XP',notes:[523,659,784,1047]},
    egg:{image:'/assets/egg-premium.webp',label:'Un œuf mystère',notes:[392,587,784,1175]}
  };
  let lastId=null,initialized=false,timeoutId=0,polling=false;
  const sound=document.getElementById("dropSound");
  const item=document.getElementById('dropItem');
  function play(drop,withSound=true){
    const kind=Object.hasOwn(variants,drop.rewardKey)?drop.rewardKey:'egg';
    const variant=variants[kind];
    const body=document.body;
    body.classList.remove('play');
    void body.offsetWidth;
    item.setAttribute('href',variant.image);
    document.getElementById('reward').textContent=drop.reward||variant.label;
    document.getElementById('instruction').textContent='Tape !catch dans le chat !';
    body.classList.add('play');
    clearTimeout(timeoutId);
    timeoutId=setTimeout(()=>body.classList.remove('play'),12000);
    if(withSound){
      sound.pause();
      sound.currentTime=0;
      sound.play().catch(error=>console.warn("Son de largage indisponible",error));
    }
  }
  async function poll(){
    if(polling)return;
    polling=true;
    try{
      const response=await fetch('/api/game-bot/drop-alert',{cache:'no-store'});
      if(!response.ok)return;
      const {drop}=await response.json();
      if(!initialized){initialized=true;lastId=drop?.id||null;return;}
      if(!drop||drop.id===lastId)return;
      lastId=drop.id;
      if(Date.now()-Date.parse(drop.startedAt)>15000)return;
      play(drop);
    }catch(error){console.warn('Alerte drop indisponible',error);}
    finally{polling=false;}
  }
  const test=new URLSearchParams(location.search).get('test');
  if(Object.hasOwn(variants,test)){
    play({rewardKey:test,reward:variants[test].label},true);
    document.getElementById('replay').style.display='inline-block';
    document.getElementById('replay').addEventListener('click',()=>play({rewardKey:test,reward:variants[test].label},true));
  }else{
    poll();
    setInterval(poll,1000);
  }
})();
