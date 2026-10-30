// Minimal standalone adapter. No game loaders, economy calls or player polling.
const $=id=>document.getElementById(id);
const escapeHtml=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
async function adminFetch(url,options={}){
  const response=await fetch(url,{cache:'no-store',credentials:'same-origin',...options});
  if(response.status===401||response.status===403){window.location.replace('/bot');throw new Error('Connexion propriétaire requise.');}
  const data=await response.json().catch(()=>({}));
  if(!response.ok)throw new Error(data.error||'Action impossible.');
  return data;
}
function trapDesktopAdminFocus(event,container){
  const controls=[...container.querySelectorAll('button:not(:disabled),a[href],input:not(:disabled),textarea:not(:disabled),select:not(:disabled)')].filter(el=>el.getClientRects().length);
  if(!controls.length)return;
  const first=controls[0],last=controls.at(-1);
  if(event.shiftKey&&(document.activeElement===first||!container.contains(document.activeElement))){event.preventDefault();last.focus();}
  else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
}
async function showAdminActionConfirmation(details){return window.confirm(`${details.actionText}\n\n${details.question}`);}
