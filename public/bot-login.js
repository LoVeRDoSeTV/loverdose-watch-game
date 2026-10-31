const form=document.getElementById('botLoginForm');
form?.addEventListener('submit',async event=>{
  event.preventDefault();const button=form.querySelector('button'),notice=document.getElementById('botLoginNotice');
  if(button.disabled)return;button.disabled=true;notice.textContent='Connexion…';
  try{
    const response=await fetch('/api/account/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:form.elements.email.value,password:form.elements.password.value})});
    const data=await response.json().catch(()=>({}));
    form.elements.password.value='';
    if(!response.ok)throw new Error(data.error||'Connexion impossible.');
    window.location.replace('/bot');
  }catch(error){notice.textContent=error.message;}finally{button.disabled=false;}
});
