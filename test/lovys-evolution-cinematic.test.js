import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source=fs.readFileSync(new URL('../public/lovys-evolution.js',import.meta.url),'utf8');
function harness(storage=new Map(),reduced=false){
  let now=0,sequence=0,blocked=false,storageFails=false;
  const timers=new Map(),listeners=new Map(),overlays=[];
  function element(){
    const classes=new Set(),events=new Map(),children=new Map();
    return {isConnected:true,hidden:false,textContent:'',classList:{add:(...v)=>v.forEach(x=>classes.add(x)),remove:(...v)=>v.forEach(x=>classes.delete(x)),contains:x=>classes.has(x)},
      setAttribute(){},getClientRects:()=>[{}],focus(){document.activeElement=this;},
      addEventListener:(name,fn)=>events.set(name,fn),click(){events.get('click')?.();},
      remove(){this.isConnected=false;},
      querySelector(selector){if(!children.has(selector))children.set(selector,element());return children.get(selector);},
      querySelectorAll:()=>[{decode:()=>new Promise(()=>{})},{decode:()=>new Promise(()=>{})}]
    };
  }
  const body=element();body.appendChild=node=>overlays.push(node);
  const focus=element();const document={body,activeElement:focus,hidden:false,createElement:element,addEventListener:(type,fn)=>listeners.set(type,fn),removeEventListener:(type,fn)=>{if(listeners.get(type)===fn)listeners.delete(type);}};
  const window={matchMedia:()=>({matches:reduced})};
  const context=vm.createContext({window,document,Map,Promise,localStorage:{getItem:key=>storage.get(key)||null,setItem:(key,value)=>{if(storageFails)throw Error('Storage unavailable');storage.set(key,value);}},setTimeout:(fn,delay)=>{const id=++sequence;timers.set(id,{fn,at:now+delay});return id;},clearTimeout:id=>timers.delete(id)});
  vm.runInContext(source,context);
  function advance(ms=0){const target=now+ms;let count=0;while(true){const next=[...timers].filter(([,x])=>x.at<=target).sort((a,b)=>a[1].at-b[1].at)[0];if(!next)break;assert.ok(++count<100);now=next[1].at;timers.delete(next[0]);next[1].fn();}now=target;}
  const observe=(level,accountId='a',extra={},meta={})=>window.LovysEvolutionCelebration.observe({accountId,lovys:[{creatureId:'voltis',name:'Voltis',level,...extra}],imageFor:(id,evo)=>id==='voltis'?`/Voltis-${evo}.webp`:'',isBlocked:()=>blocked,...meta});
  return {observe,advance,storage,document,overlays,focus,api:window.LovysEvolutionCelebration,
    setBlocked:value=>{blocked=value;},failStorage:()=>{storageFails=true;},current:()=>overlays.findLast(x=>x.isConnected),
    pressEscape:()=>listeners.get('keydown')?.({key:'Escape',preventDefault(){},stopImmediatePropagation(){}})};
}
test('levels 25 and 50 celebrate once; initial and rank-only refreshes remain silent',()=>{
  const h=harness();h.observe(24);h.advance();assert.equal(h.overlays.length,0);
  h.observe(25);h.advance();assert.equal(h.overlays.length,1);
  assert.match(h.current().innerHTML,/Voltis-0.webp/);assert.match(h.current().innerHTML,/Voltis-2.webp/);
  h.current().querySelector('button').click();assert.equal(h.current().querySelector('button').textContent,'Continuer');
  assert.match(h.current().innerHTML,/\+15 %/);h.current().querySelector('button').click();
  assert.equal(h.api.isActive(),false);assert.equal(h.document.activeElement,h.focus);
  h.observe(25,'a',{rank:5});h.observe(24);h.observe(25);h.advance();assert.equal(h.overlays.length,1);
  h.observe(50);h.advance();assert.match(h.current().innerHTML,/Voltis-2.webp/);assert.match(h.current().innerHTML,/Voltis-3.webp/);assert.match(h.current().innerHTML,/\+30 %/);
  const initial=harness();initial.observe(50);initial.advance();assert.equal(initial.overlays.length,0);
});
test('a large XP grant queues both forms and survives reload without replaying acknowledged forms',()=>{
  const h=harness();h.observe(24);h.observe(50);h.advance();
  h.current().querySelector('button').click();h.current().querySelector('button').click();
  assert.match(h.current().innerHTML,/NIVEAU 50/);h.api.reset();
  const restored=harness(h.storage);restored.observe(50);restored.advance();assert.match(restored.current().innerHTML,/NIVEAU 50/);
  restored.pressEscape();restored.pressEscape();assert.equal(restored.current(),undefined);
  const done=harness(h.storage);done.observe(50);done.advance();assert.equal(done.overlays.length,0);
});
test('combat, confirmation and background tabs delay the animation; account changes keep events separate',()=>{
  const h=harness();h.observe(24);h.setBlocked(true);h.observe(25);h.advance(800);assert.equal(h.overlays.length,0);
  h.setBlocked(false);h.document.hidden=true;h.advance(800);assert.equal(h.overlays.length,0);
  h.document.hidden=false;h.advance(400);assert.equal(h.api.isActive(),true);
  h.observe(50,'b');h.advance();assert.equal(h.current(),undefined);
  h.observe(25,'a');h.advance();assert.match(h.current().innerHTML,/NIVEAU 25/);
});
test('reduced motion reveals immediately; normal animation has a loading fallback and cleans up on logout',()=>{
  const reduced=harness(new Map(),true);reduced.observe(49);reduced.observe(50);reduced.advance();
  assert.equal(reduced.current().querySelector('button').textContent,'Continuer');
  const h=harness();h.observe(24);h.observe(25);h.advance();h.advance(4800);
  assert.equal(h.current().querySelector('button').textContent,'Continuer');
  h.api.reset();h.advance(10000);assert.equal(h.api.isActive(),false);assert.equal(h.document.body.classList.contains('lovys-evolution-playing'),false);
});
test('unavailable storage never prevents the game from celebrating and dismissing an evolution',()=>{
  const h=harness();h.failStorage();h.observe(24);h.observe(25);h.advance();
  h.current().querySelector('button').click();h.current().querySelector('button').click();
  h.observe(25);h.advance();assert.equal(h.overlays.length,1);
});
test('a server-confirmed reset starts a new evolution cycle and discards old pending celebrations',()=>{
  const h=harness();h.observe(49);h.observe(50);h.advance();assert.equal(h.api.isActive(),true);
  const meta={progressResetAt:'2026-10-31T03:00:00Z'};
  h.observe(1,'a',{},meta);h.advance();assert.equal(h.api.isActive(),false);
  h.observe(25,'a',{},meta);h.advance();assert.match(h.current().innerHTML,/NIVEAU 25/);
});
