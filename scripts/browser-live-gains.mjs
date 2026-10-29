import fs from 'node:fs';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const read=file=>fs.readFileSync(new URL('../public/'+file,import.meta.url),'utf8');
const html=read('index.html'),css=[...html.matchAll(/<link rel="stylesheet" href="\/([^"?]+)/g)].map(m=>read(m[1])).join('\n');
const block=html.slice(html.indexOf('<section id="liveGains"'),html.indexOf('<section id="nextActionsBar"'));
const script=read('live-gains.js');
const browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_EXECUTABLE_PATH?{executablePath:process.env.CHROMIUM_EXECUTABLE_PATH,args:['--no-sandbox','--disable-dev-shm-usage','--disable-gpu']}:{})});
try{
 for(const width of [360,390,820,1440]){
  const page=await browser.newPage({viewport:{width,height:700}});page.setDefaultTimeout(10000);
  await page.route('**/*',route=>route.fulfill({body:`<html><meta charset="utf-8"><style>${css}</style><body data-desktop-view="home"><main style="max-width:1100px;margin:20px auto;padding:0 12px">${block}</main></body></html>`,contentType:'text/html'}));
  await page.goto('http://live-gains.local');
  await page.addScriptTag({content:`window.snapshot={playerId:'1',state:'waiting',lastCreditAt:null};window.requests=0;window.fail=false;window.unauth=false;window.fetch=async(url)=>{if(url!='/api/game/live-gains')throw Error('Unexpected request');window.requests++;if(window.fail)throw Error('Offline');return {ok:!window.unauth,status:window.unauth?401:200,json:async()=>structuredClone(window.snapshot)};};`});
  await page.addScriptTag({content:script});
  await page.evaluate(()=>window.refreshLiveGains({id:1}));
  assert.equal(await page.locator('#liveGains').getAttribute('data-state'),'waiting');
  assert.match(await page.locator('[data-gains-status]').textContent(),/En attente/);
  await page.evaluate(async()=>{window.snapshot.state='receiving';window.snapshot.lastCreditAt=new Date().toISOString();await window.refreshLiveGains({id:1});});
  assert.equal(await page.locator('#liveGains').getAttribute('data-state'),'receiving');
  assert.equal(await page.locator('[data-gains-status]').textContent(),'Tu es actuellement en train d’XP !');
  assert.match(await page.locator('[data-gains-description]').textContent(),/XP et tes LoVeR’Cash sont bien crédités/);
  assert.match(await page.locator('[data-gains-last]').textContent(),/Dernier crédit confirmé/);
  assert.ok(await page.locator('#liveGains').evaluate(el=>el.scrollWidth<=el.clientWidth));
  assert.equal(await page.locator('[data-gains-value]').count(),0);
  await page.screenshot({path:`browser-live-gains-${width}.png`});
  await page.evaluate(async()=>{window.snapshot.state='offline';await window.refreshLiveGains({id:1});});
  assert.match(await page.locator('[data-gains-status]').textContent(),/en pause/);
  assert.equal(await page.locator('[data-gains-last]').textContent(),'');
  await page.evaluate(async()=>{window.fail=true;await window.refreshLiveGains({id:1});});
  assert.equal(await page.locator('#liveGains').getAttribute('data-state'),'unavailable');
  await page.evaluate(async()=>{await window.refreshLiveGains({id:2});});
  assert.equal(await page.locator('#liveGains').getAttribute('data-state'),'unavailable');
  const hiddenRequests=await page.evaluate(async()=>{const n=window.requests;Object.defineProperty(document,'hidden',{configurable:true,value:true});await window.refreshLiveGains({id:2});Object.defineProperty(document,'hidden',{configurable:true,value:false});return window.requests-n;});
  assert.equal(hiddenRequests,0);
  await page.evaluate(async()=>{window.fail=false;window.unauth=true;await window.refreshLiveGains({id:2});});
  assert.equal(await page.locator('#liveGains').isVisible(),false);
  console.log('Live XP indicator, waiting, pause, failure, hidden tab and account change passed:',width);
  await page.close();
 }
}finally{await browser.close();}
