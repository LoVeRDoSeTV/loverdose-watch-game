import fs from 'node:fs';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';

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
      const showAdminActionConfirmation=async()=>false;
      window.botWrites=[];
      const data={connected:true,login:'LoVeRWatchBot',enabled:true,live:false,recent:[],templates:[{key:'egg',label:'Œuf prêt',text:'Bonjour {joueur}, ton œuf est prêt !',variables:['joueur']},{key:'custom-demo',custom:true,label:'Annonce',text:'Retrouve le jeu sur le site.',variables:[]}],schedule:{enabled:true,min_minutes:20,max_minutes:40}};
      async function adminFetch(url,options){
        if(options?.method==='POST'){
          window.botWrites.push({url,body:JSON.parse(options.body)});
          if(url.endsWith('/schedule')){const b=JSON.parse(options.body);data.schedule={enabled:b.enabled,min_minutes:b.minMinutes,max_minutes:b.maxMinutes};}
          return {message:'Enregistré'};
        }
        return structuredClone(data);
      }
      ${panelCode}
      ${editorCode}
      void loadGameBotPanel();
    `});
    await page.locator('[data-bot-message-edit="egg"]').waitFor();
    assert.equal(await page.locator('#adminBotContent > .admin-players-empty').count(),0);
    const layout = await page.evaluate(() => {
      const modal=document.getElementById('adminBotModal'),panel=modal.querySelector('.admin-players-panel');
      return {width:innerWidth,panelWidth:panel.getBoundingClientRect().width,scroll:modal.scrollWidth,columns:getComputedStyle(document.querySelector('.bot-panel-grid')).gridTemplateColumns,z:Number(getComputedStyle(modal).zIndex),parentZ:Number(getComputedStyle(document.getElementById('desktopAdminModal')).zIndex)};
    });
    assert.ok(layout.scroll<=width+1,JSON.stringify(layout));
    if(width<=900){assert.ok(layout.panelWidth>=width-1);assert.ok(layout.z>layout.parentZ);assert.equal(layout.columns.split(' ').length,1);}
    else assert.equal(layout.columns.split(' ').length,2);
    await page.locator('[name=minMinutes]').fill('25');
    await page.locator('[name=maxMinutes]').fill('50');
    await page.getByRole('button',{name:'Enregistrer les délais'}).click();
    await page.waitForFunction(()=>window.botWrites.some(w=>w.url.endsWith('/schedule')));
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
    console.log('Bot layout and editing passed:',width);
    await page.setViewportSize({width,height:844});
    await page.locator('#adminBotModal').evaluate(el=>{el.scrollTop=0;});
    await page.screenshot({path:`browser-bot-${width}.png`});
    await page.close();
  }
} finally { await browser.close(); }
