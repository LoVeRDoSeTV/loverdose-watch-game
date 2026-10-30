import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source=fs.readFileSync(new URL('../public/bot-studio.js',import.meta.url),'utf8');
function setup(){
 const classes=()=>({hidden:false,toggle(name,hide){this[name]=hide;}});
 const cards=[{textContent:'!profil Profil du joueur',enabled:true,classList:classes()},{textContent:'!discord Communauté',enabled:false,classList:classes()}];
 cards.forEach(c=>c.querySelector=()=>({getAttribute:()=>String(c.enabled)}));
 const results={},empty={classList:classes()},sections=['overview','commands','drops'].map(view=>({dataset:{botSection:view},classList:classes()}));
 const nav=sections.map(s=>({dataset:{botView:s.dataset.botSection},classList:classes(),setAttribute(k,v){this[k]=v;},removeAttribute(k){delete this[k];}}));
 const heading={},description={};let scrolls=0;
 const panel={querySelectorAll:()=>cards,querySelector:selector=>selector.includes('results')?results:empty};
 const c=vm.createContext({$:id=>({adminGameBot:panel,botStudioPageTitle:heading,botStudioPageDescription:description}[id]),document:{body:{classList:{contains:()=>false}},querySelectorAll:selector=>selector.includes('bot-studio-nav')?nav:sections,querySelector:()=>({scrollTo(){scrolls++;}})}});
 vm.runInContext(source.slice(source.indexOf('const adminBotDashboard='),source.indexOf('async function loadGameBotPanel(){')),c);
 return {c,cards,results,empty,sections,nav,heading,get scrolls(){return scrolls;}};
}
test('dashboard search and enabled filters combine without changing commands',()=>{
 const s=setup();
 vm.runInContext("adminBotDashboard.search='DISCORD';adminBotDashboard.filter='all'",s.c);s.c.filterBotDashboardCommands();
 assert.equal(s.cards[0].classList.hidden,true);assert.equal(s.cards[1].classList.hidden,false);assert.equal(s.results.textContent,'1 commande affichée');
 vm.runInContext("adminBotDashboard.filter='enabled'",s.c);s.c.filterBotDashboardCommands();assert.equal(s.empty.classList.hidden,false);
 vm.runInContext("adminBotDashboard.search='';adminBotDashboard.filter='disabled'",s.c);s.c.filterBotDashboardCommands();assert.equal(s.cards[0].classList.hidden,true);assert.equal(s.cards[1].classList.hidden,false);
 assert.equal(s.cards[0].enabled,true);assert.equal(s.cards[1].enabled,false);
});
test('dashboard retains its current section on refresh, with a safe fallback for unknown views',()=>{
 const s=setup();s.c.setBotDashboardView('commands');assert.equal(s.heading.textContent,'Commandes du chat');assert.equal(s.sections[0].classList.hidden,true);assert.equal(s.sections[1].classList.hidden,false);assert.equal(s.nav[1]['aria-current'],'page');
 const before=s.scrolls;s.c.setBotDashboardView('commands');assert.equal(s.scrolls,before);
 s.c.setBotDashboardView('unknown');assert.equal(s.heading.textContent,'Vue d’ensemble');assert.equal(s.sections[0].classList.hidden,false);assert.equal(s.nav[1]['aria-current'],undefined);
});
