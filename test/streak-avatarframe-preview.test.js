import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

const app=readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
const begin=app.indexOf('function shopPreview(item) {');
const end=app.indexOf('async function showPendingWatchStreakReward()',begin);
assert.ok(begin>=0 && end>begin,'Fonction de prévisualisation introuvable');
const preview=runInNewContext(app.slice(begin,end)+';shopPreview',{
  escapeHtml:value=>String(value),
  profileAvatarFrameStyle:key=>key==='streak_avatarframe_200'
    ? {border:'#f6c875',shadow:'0 0 0 2px rgba(246,200,117,.34)'}
    : {border:'#e4c3ef',shadow:'0 0 8px #e4c3ef22'},
});

test('Le cadre 200 lives est doré dans les listes et les aperçus, même sans image de cadre',()=>{
  const html=preview({category:'avatar_frame',key:'streak_avatarframe_200',preview:'streak-200'});
  assert.match(html,/frame-streak-200/);
  assert.match(html,/border-color:#f6c875/);
  assert.match(html,/box-shadow:0 0 0 2px/);
  assert.doesNotMatch(html,/border-color:rgba\(145,71,255/);
});

test('Les autres cadres conservent leur couleur spécifique',()=>{
  const html=preview({category:'avatar_frame',key:'streak_avatarframe_50',preview:'streak-50'});
  assert.match(html,/border-color:#e4c3ef/);
});

test('Le cache du JavaScript a changé',()=>{
  const page=readFileSync(new URL('../public/index.html',import.meta.url),'utf8');
  assert.match(page,/\/app\.min\.js\?v=646/);
});
