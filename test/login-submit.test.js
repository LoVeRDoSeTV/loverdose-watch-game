import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const app=fs.readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
const primary=app.slice(app.indexOf("loginForm.addEventListener('submit', async event => {"),app.indexOf('\n\n\nfunction syncDesktopAdminPlacement'));
const fallback=fs.readFileSync(new URL('../public/auth-fallback.js',import.meta.url),'utf8').split('/* Entrée depuis')[0];
function fixture(fetch,withPrimary=true){
 const listeners=[];const classes=()=>({add(){},remove(){},contains(){return true;}});
 const submit={disabled:false,textContent:'Se connecter',dataset:{}};
 const form={dataset:{},addEventListener(name,fn,capture){if(name==='submit')listeners.push({fn,capture:!!capture});},querySelector(){return submit;},reset(){}};
 const elements={loginForm:form,loginEmail:{value:'player'},loginPassword:{value:'secret'},loginError:{style:{}},loginScreen:{classList:classes()},loadingScreen:{classList:classes()},authOverlay:{classList:classes()},registerScreen:{classList:classes()},twitchScreen:{classList:classes()}};
 let reloads=0;const successes=[];const context=vm.createContext({document:{getElementById:id=>elements[id],querySelector:()=>({style:{},offsetParent:true}),body:{classList:classes()}},window:{},location:{reload(){reloads++;}},loginForm:form,loginError:elements.loginError,loginScreen:elements.loginScreen,$:id=>elements[id],showLoading(){},hideLoading(){},showSuccess(...args){successes.push(args);},showGame(){},loadGame(){},fetch,setTimeout,clearTimeout,AbortController,Date:{now:(()=>{let n=0;return()=>n+=1000;})()},console:{error(){}}});
 if(withPrimary)vm.runInContext(primary,context);vm.runInContext(fallback,context);
 function dispatch(){const event={defaultPrevented:false,preventDefault(){this.defaultPrevented=true;}};const pending=listeners.slice().sort((a,b)=>Number(b.capture)-Number(a.capture)).map(({fn})=>fn(event));assert.equal(event.defaultPrevented,true);return Promise.all(pending);}
 return{dispatch,form,submit,error:elements.loginError,reloads:()=>reloads,successes};
}
test('primary login and fallback together send one request even after an immediate failure',async()=>{
 let calls=0;const f=fixture(async()=>{calls++;throw Error('network');});await f.dispatch();assert.equal(calls,1);assert.equal(f.submit.disabled,false);assert.ok(f.error.style.display==='block');
});
test('repeated submissions while a login is pending cannot send extra requests; retry works after refusal',async()=>{
 let calls=0,finish;const f=fixture(()=>{calls++;return new Promise(r=>finish=r);});const first=f.dispatch();await f.dispatch();assert.equal(calls,1);assert.equal(f.submit.disabled,true);
 finish({ok:false,json:async()=>({error:'Mot de passe incorrect'})});await first;assert.equal(f.submit.disabled,false);
 const retry=f.dispatch();assert.equal(calls,2);finish({ok:false,json:async()=>({error:'Réessaie dans 15 minutes.'})});await retry;assert.equal(f.error.textContent,'Réessaie dans 15 minutes.');
});
test('standalone fallback synchronously cancels navigation and prevents duplicate pending requests',async()=>{
 let calls=0,finish;const f=fixture(()=>{calls++;return new Promise(r=>finish=r);},false);const first=f.dispatch(),second=f.dispatch();await new Promise(r=>setTimeout(r,5));assert.equal(calls,1);
 finish({ok:true,json:async()=>({account:{twitchConnected:true,gameReady:true}})});await Promise.all([first,second]);assert.equal(f.reloads(),1);assert.equal(f.submit.disabled,false);
});

test('a successful account login opens the Twitch linking step without a second login request',async()=>{
 let calls=0;const f=fixture(async()=>{calls++;return{ok:true,json:async()=>({account:{twitchConnected:false,gameReady:false}})};});
 await f.dispatch();assert.equal(calls,1);assert.equal(f.successes.length,1);assert.equal(f.successes[0][2],'Connecter Twitch');assert.equal(f.submit.disabled,false);
});
