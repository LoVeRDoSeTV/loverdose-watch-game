import fs from 'node:fs';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import {playerCommands} from '../src/game-bot-player-commands.js';
const builtinFixtures=Object.entries(playerCommands).map(([kind,c],i)=>({...c,kind,id:100+i,enabled:true,cooldown_seconds:10}));

// Exercise the real bot markup and event handlers against local mock data only.
// No Twitch requests or production administration mutations are made.
const read = file => fs.readFileSync(new URL('../public/' + file, import.meta.url), 'utf8');
const html = read('index.html'), app = read('app.js');
const css = [...html.matchAll(/<link rel="stylesheet" href="\/([^"?]+)/g)].map(m => read(m[1])).join('\n');
const modal = html.slice(html.indexOf('<div id="adminBotModal"'), html.indexOf('<!-- TRACKER - COMPTES DETECTES -->')).replace('admin-players-modal hidden', 'admin-players-modal');
const panelCode = app.slice(app.indexOf('let adminBotMessageTemplates=[];'), app.indexOf('setInterval(()=>{const panel=$(\'adminGameBot\')'));
const editorCode = app.slice(app.indexOf('function openBotMessageEditor('), app.indexOf("$('adminTrackerContent')?.addEventListener('click'"));
const browser = await chromium.launch({headless:true, ...(process.env.CHROMIUM_EXECUTABLE_PATH ? {executablePath:process.env.CHROMIUM_EXECUTABLE_PATH,args:['--no-sandbox','--disable-dev-shm-usage','--disable-gpu']} : {})});
try {
  for (const width of [360,390,820,1440]) {
    const page = await browser.newPage({viewport:{width,height:844}});
    page.setDefaultTimeout(10000);
    await page.route('**/*', route => route.fulfill({status:404,body:''}));
    await page.setContent(`<style>${css}</style><div id="desktopAdminModal" class="desktop-admin-modal"><div class="desktop-admin-panel">Administration</div></div>${modal}`);
    await page.addScriptTag({content:`
      const $=id=>document.getElementById(id);
      const escapeHtml=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
      const trapDesktopAdminFocus=()=>{};
      const showAdminActionConfirmation=async()=>true;
      window.botWrites=[];
      const data={connected:true,login:'LoVeRWatchBot',enabled:true,live:false,recent:[],commands:${JSON.stringify(builtinFixtures)},templates:[{key:'egg',label:'Œuf prêt',text:'Bonjour {joueur}, ton œuf est prêt !',variables:['joueur']},{key:'custom-demo',custom:true,label:'Annonce',text:'Retrouve le jeu sur le site.',variables:[]}],schedule:{enabled:true,min_minutes:20,max_minutes:40}};
      async function adminFetch(url,options){
        if(options?.method==='POST'){
          window.botWrites.push({url,body:JSON.parse(options.body)});
          if(url.endsWith('/schedule')){const b=JSON.parse(options.body);data.schedule={enabled:b.enabled,min_minutes:b.minMinutes,max_minutes:b.maxMinutes};}
          if(url.endsWith('/commands')){const b=JSON.parse(options.body),c={...data.commands.find(item=>Number(item.id)===Number(b.id)),id:b.id||1,name:b.name,text:b.text,enabled:b.enabled,cooldown_seconds:b.cooldownSeconds};data.commands=data.commands.filter(item=>Number(item.id)!==Number(c.id));data.commands.push(c);}
          if(url.endsWith('/commands/delete'))data.commands=data.commands.filter(c=>Number(c.id)!==Number(JSON.parse(options.body).id));
          return {message:'Enregistré'};
        }
        return structuredClone(data);
      }
      ${panelCode}
      ${editorCode}
      void loadGameBotPanel();
    `});
    await page.locator('[data-bot-message-edit="egg"]').waitFor({state:'attached'});
    assert.equal(await page.locator('.bot-studio-stats').isVisible(),true);
    assert.equal(await page.locator('.bot-commands-card').isVisible(),false);
    assert.equal(await page.locator('#adminBotContent > .admin-players-empty').count(),0);
    const layout = await page.evaluate(() => {
      const modal=document.getElementById('adminBotModal'),panel=modal.querySelector('.admin-players-panel');
      return {width:innerWidth,panelWidth:panel.getBoundingClientRect().width,scroll:modal.scrollWidth,columns:getComputedStyle(document.querySelector('.bot-panel-grid')).gridTemplateColumns,z:Number(getComputedStyle(modal).zIndex),parentZ:Number(getComputedStyle(document.getElementById('desktopAdminModal')).zIndex)};
    });
    assert.ok(layout.scroll<=width+1,JSON.stringify(layout));
    if(width<=900){assert.ok(layout.panelWidth>=width-1);assert.ok(layout.z>layout.parentZ);assert.equal(layout.columns.split(' ').length,1);}
    else assert.equal(layout.columns.split(' ').length,2);
    await page.locator('.bot-studio-nav [data-bot-view="drops"]').click();
    await page.locator('[name=minMinutes]').fill('25');
    await page.locator('[name=maxMinutes]').fill('50');
    await page.getByRole('button',{name:'Enregistrer les délais'}).click();
    await page.waitForFunction(()=>window.botWrites.some(w=>w.url.endsWith('/schedule')));
    await page.locator('.bot-studio-nav [data-bot-view="announcements"]').click();
    await page.locator('[data-bot-message-edit="egg"]').click();
    await page.locator('#botMessageText').fill('Bonjour {joueur}, un nouveau message depuis le mobile !');
    if(width<=900)assert.ok(await page.locator('#botMessageText').evaluate(el=>parseFloat(getComputedStyle(el).fontSize)>=16));
    if(width<=900){
      await page.setViewportSize({width,height:450});
      if(width===390)await page.screenshot({path:'browser-bot-editor-390.png'});
    }
    await page.getByRole('button',{name:'Enregistrer',exact:true}).click();
    await page.waitForFunction(()=>window.botWrites.some(w=>w.url.endsWith('/messages')));
    assert.equal(await page.locator('.game-bot-editor').count(),0);
    const writes=await page.evaluate(()=>window.botWrites);
    assert.deepEqual(writes.map(w=>w.url),['/api/admin/game-bot/schedule','/api/admin/game-bot/messages']);
    assert.equal(writes[0].body.minMinutes,25);assert.equal(writes[0].body.maxMinutes,50);
    assert.match(writes[1].body.text,/depuis le mobile/);
    await page.setViewportSize({width,height:844});
    await page.locator('.bot-studio-nav [data-bot-view="commands"]').click();
    await page.locator('[data-bot-command-search]').fill('introuvable');
    assert.equal(await page.locator('[data-bot-command-empty]').isVisible(),true);
    await page.locator('[data-bot-command-search]').fill('');
    await page.getByRole('button',{name:'Ajouter une commande',exact:true}).click();
    await page.locator('#botCommandName').fill('!discord');
    await page.locator('#botCommandText').fill('{joueur}, rejoins notre communauté !');
    await page.locator('#botCommandCooldown').fill('45');
    if(width<=900){await page.setViewportSize({width,height:450});assert.ok(await page.locator('#botCommandText').evaluate(el=>parseFloat(getComputedStyle(el).fontSize)>=16));}
    if(width===390)await page.screenshot({path:'browser-bot-command-editor-390.png'});
    await page.getByRole('button',{name:'Enregistrer la commande',exact:true}).click();
    await page.locator('[data-bot-command-edit="1"]').waitFor();
    await page.locator('[data-bot-command-edit="1"]').click();
    await page.locator('#botCommandText').fill('Un nouveau lien pour {joueur}');
    await page.getByRole('button',{name:'Enregistrer la commande',exact:true}).click();
    await page.locator('[data-bot-command-toggle="1"]').click();
    await page.waitForFunction(()=>window.botWrites.filter(w=>w.url.endsWith('/commands')).length===3);
    await page.locator('[data-bot-command-delete="1"]').click();
    await page.waitForFunction(()=>window.botWrites.some(w=>w.url.endsWith('/commands/delete')));
    assert.equal(await page.locator('[data-bot-command-edit="1"]').count(),0);
    const commandWrites=await page.evaluate(()=>window.botWrites.slice(2));
    assert.deepEqual(commandWrites.map(w=>w.url),['/api/admin/game-bot/commands','/api/admin/game-bot/commands','/api/admin/game-bot/commands','/api/admin/game-bot/commands/delete']);
    assert.equal(commandWrites[0].body.name,'!discord');assert.equal(commandWrites[0].body.cooldownSeconds,45);
    assert.equal(commandWrites[1].body.id,1);assert.equal(commandWrites[2].body.enabled,false);assert.equal(commandWrites[3].body.id,1);
    for(const id of [100,101,102]){
      assert.equal(await page.locator('[data-bot-command-toggle="'+id+'"]').getAttribute('aria-checked'),'true');
      assert.equal(await page.locator('[data-bot-command-delete="'+id+'"]').count(),0);
    }
    await page.locator('[data-bot-command-edit="100"]').click();
    assert.equal(await page.locator('#botCommandName').isEditable(),false);
    assert.ok((await page.locator('.game-bot-editor').textContent()).includes('{niveau}'));
    await page.locator('#botCommandText').fill('Salut {joueur}, niveau {niveau} et {cash} LoVeR’Cash !');
    if(width===390)await page.screenshot({path:'browser-bot-profil-editor-390.png'});
    await page.getByRole('button',{name:'Enregistrer la commande',exact:true}).click();
    await page.locator('[data-bot-command-toggle="100"]').click();
    await page.waitForFunction(()=>document.querySelector('[data-bot-command-toggle="100"]').getAttribute('aria-checked')==='false');
    await page.locator('[data-bot-command-toggle="100"]').click();
    await page.waitForFunction(()=>document.querySelector('[data-bot-command-toggle="100"]').getAttribute('aria-checked')==='true');
    const builtinWrites=await page.evaluate(()=>window.botWrites.filter(w=>w.body.id===100));
    assert.equal(builtinWrites.length,3);assert.equal(builtinWrites[0].body.name,'!profil');
    assert.equal(builtinWrites[1].body.enabled,false);assert.equal(builtinWrites[2].body.enabled,true);
    assert.ok(builtinWrites.every(w=>w.body.text==='Salut {joueur}, niveau {niveau} et {cash} LoVeR’Cash !'));
    console.log('Bot layout, eggs, custom and player command editing passed:',width);
    await page.setViewportSize({width,height:844});
    await page.locator('.bot-studio-nav [data-bot-view="overview"]').click();
    await page.screenshot({path:`browser-bot-${width}.png`});
    await page.close();
  }
} finally { await browser.close(); }
