import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import fs from 'node:fs';
import {createBotStudioRouter} from '../src/routes/bot-studio.js';

test('standalone studio admits only the verified broadcaster, with private uncached HTML',async()=>{
 const app=express();app.use((req,res,next)=>{req.session=req.get('x-user')?{account:{id:req.get('x-user')}}:{};next();});
 app.use(createBotStudioRouter({getBroadcasterAccount:async req=>{if(req.session.account?.id==='error')throw Error('database down');return req.session.account?.id==='owner'?{id:1}:null;}}));
 app.use(express.static(new URL('../public/',import.meta.url).pathname));
 const server=app.listen(0,'127.0.0.1');await new Promise(resolve=>server.on('listening',resolve));const url='http://127.0.0.1:'+server.address().port;
 try{
  for(const [user,status] of [[null,200],['other',403],['owner',200],['error',503]]){
   const response=await fetch(url+'/bot',{headers:user?{'x-user':user}:{}});assert.equal(response.status,status);assert.equal(response.headers.get('cache-control'),'no-store');assert.match(response.headers.get('x-robots-tag'),/noindex/);
   const html=await response.text();
   if(user==='owner'){assert.ok(html.includes('bot-studio-standalone'));assert.ok(html.includes('/bot-studio.min.js'));assert.ok(html.includes('Twitch du site'));assert.ok(!html.includes('/app.min.js'));assert.ok(!html.includes('id="mobileGameNav"'));}
   else assert.ok(!html.includes('data-bot-view'));
  }
  for(const path of ['/bot-studio.html','/views/bot-studio.html'])assert.equal((await fetch(url+path)).status,404);
 }finally{await new Promise(resolve=>server.close(resolve));}
});
test('standalone page never boots game data loaders and game entrypoint loads the shared bot once',()=>{
 const entry=fs.readFileSync(new URL('../views/bot-studio.html',import.meta.url),'utf8');
 const page=fs.readFileSync(new URL('../public/bot-page.js',import.meta.url),'utf8');
 const boot=fs.readFileSync(new URL('../public/bot-bootstrap.js',import.meta.url),'utf8');
 for(const source of [entry,page,boot])for(const gameEndpoint of ['/api/game/return-summary','/api/incubator','/api/shop','/api/leaderboard'])assert.ok(!source.includes(gameEndpoint));
 const game=fs.readFileSync(new URL('../public/index.html',import.meta.url),'utf8');assert.equal((game.match(/src="\/bot-studio.min.js/g)||[]).length,1);
 const standaloneOrder=[entry.indexOf('/bot-bootstrap.js'),entry.indexOf('/bot-studio.min.js'),entry.indexOf('/bot-page.js')];assert.ok(standaloneOrder[0]<standaloneOrder[1]&&standaloneOrder[1]<standaloneOrder[2]);
});
