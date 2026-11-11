import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import postcss from 'postcss';

const css=readFileSync(new URL('../public/mobile-purchase-streak.css',import.meta.url),'utf8');
const page=readFileSync(new URL('../public/index.html',import.meta.url),'utf8');

test('mobile purchase and streak adjustments are loaded after the existing stylesheets',()=>{
  const purchase=page.indexOf('/mobile-purchase-streak.css?v=');
  const base=page.indexOf('/styles-extended.min.css?v=');
  const tablet=page.indexOf('/tablet.min.css?v=');
  assert.ok(purchase>base && purchase>tablet);
});

test('purchase modal remains hidden when closed and scrollable within a dynamic viewport',()=>{
  const root=postcss.parse(css);
  let responsive=false,hidden=false,scroll=false,sticky=false;
  root.walkAtRules('media',rule=>{if(rule.params.includes('pointer:coarse')&&rule.params.includes('max-width:900px'))responsive=true;});
  root.walkRules(rule=>{
    if(rule.selector.includes('#shopPurchaseConfirmModal.hidden')&&rule.toString().includes('display:none!important'))hidden=true;
    if(rule.selector.includes('> .shop-purchase-card')&&rule.toString().includes('overflow-y:auto!important')&&rule.toString().includes('100dvh'))scroll=true;
    if(rule.selector.includes('.shop-purchase-actions')&&rule.toString().includes('position:sticky!important')&&rule.toString().includes('grid-template-columns:repeat(2'))sticky=true;
  });
  assert.ok(responsive&&hidden&&scroll&&sticky,'Mobile purchase layout must keep dialogs usable');
});

test('100 and 250 live backgrounds retain their artwork proportions on narrow cards',()=>{
  const root=postcss.parse(css);
  const bgRules=[];
  root.walkRules(rule=>{if(rule.selector.includes('streak-100-background')&&rule.selector.includes('streak-250-background'))bgRules.push(rule);});
  assert.ok(bgRules.length>=3);
  assert.ok(bgRules.every(rule=>rule.nodes.some(decl=>decl.prop==='background-size'&&decl.value.includes('100% auto'))));
});
