import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const get = file => fs.readFileSync(new URL('../public/'+file,import.meta.url),'utf8');

test('production entrypoint uses exactly one application bundle',()=>{
  const html=get('index.html');
  assert.match(html, /<script defer src="\/app\.min\.js\?v=\d+"><\/script>/);
  assert.doesNotMatch(html, /<script[^>]*src="\/app\.js/);
  assert.equal((html.match(/<script defer src="\/app\.min\.js/g)||[]).length,1);
  const bundle=get('app.min.js');
  assert.ok(bundle.length>200000);
});

test('essential authenticated navigation and content loaders remain in app source and bundle',()=>{
  const src=get('app.js');
  const min=get('app.min.js');
  for(const name of ['openDesktopView','loadLeaderboard','loadLovysCollection','renderPveAdventureMap','loadShop']){
    assert.match(src,new RegExp('(?:async\\s+)?function\\s+'+name+'\\s*\\('));
    assert.match(min,new RegExp('(?:async\\s+)?function\\s+'+name+'\\s*\\('));
  }
  for(const endpoint of ['/api/shop','/api/trades/notifications','/api/game/return-summary']){
    assert.ok(src.includes(endpoint),'Source missing '+endpoint);
    assert.ok(min.includes(endpoint),'Bundle missing '+endpoint);
  }
});
