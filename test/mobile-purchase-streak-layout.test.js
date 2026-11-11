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

test('100/250 lives cards and previews cover their entire background without a rectangular seam',()=>{
  const root=postcss.parse(css);
  let card=null,shopPreview=null;
  root.walkRules(rule=>{
    const values=Object.fromEntries(rule.nodes.filter(n=>n.type==='decl').map(n=>[n.prop,n.value]));
    if(rule.selector.includes('.dashboard-left-stack > .player-visit-card') &&
       rule.selector.includes('#badgeVisitPreviewVisual .player-visit-card') &&
       values['background-size'])card={selector:rule.selector,values};
    if(rule.selector.includes('.shop-profile-preview-card:is(.streak-100-background,.streak-250-background)::before') &&
       values['background-size'])shopPreview={selector:rule.selector,values};
  });
  assert.ok(card,'Real and badge preview cards need a common full-bleed rule');
  assert.match(card.selector,/streak-100-background/);
  assert.match(card.selector,/streak-250-background/);
  assert.equal(card.values['background-size'],'cover,cover,cover,cover!important');
  assert.equal(card.values['background-position'],'82% center,center,center,center!important');
  assert.ok(shopPreview,'Shop preview pseudo-element needs independent full-bleed rule');
  assert.equal(shopPreview.values['background-size'],'cover,cover!important');
  assert.equal(shopPreview.values['background-position'],'82% center,center!important');
  assert.ok(!css.includes('center bottom 28px'));
  assert.ok(!css.includes('background-size:100% auto,cover'));
  assert.ok(!css.includes('streak-100-mobile.svg'));
  assert.ok(!css.includes('streak-250-mobile.svg'));
  for(const milestone of [100,250]){
    const original=readFileSync(new URL('../public/assets/streak-'+milestone+'.svg',import.meta.url),'utf8');
    assert.match(original,/viewBox="0 0 1200 440"/);
  }
});

test('mobile cards have enough room for the circle and the action button',()=>{
  const root=postcss.parse(css);
  let home=null,preview=null,actions=null;
  root.walkRules(rule=>{
    const values=Object.fromEntries(rule.nodes.filter(n=>n.type==='decl').map(n=>[n.prop,n.value]));
    if(rule.selector.includes('body .dashboard-left-stack > .player-visit-card') && values['min-height'])home=values;
    if(rule.selector.includes('body #badgeVisitPreviewVisual .player-visit-card') && values['min-height'])preview=values;
    if(rule.selector.includes('> .player-card-actions') && values['padding-top'])actions=values;
  });
  assert.ok(parseInt(home?.['min-height']||'0')>=290);
  assert.ok(parseInt(preview?.['min-height']||'0')>=250);
  assert.equal(actions?.['margin-top'],'auto');
});
test('200 live avatar frame preview stays visibly gold and bounded on mobile',()=>{
  const root=postcss.parse(css);
  let frame=false;
  root.walkRules(rule=>{
    if(rule.selector.includes('.frame-streak-200 .shop-preview-avatarframe-inner') && rule.toString().includes('#f6c875') && rule.toString().includes('50px'))frame=true;
  });
  assert.ok(frame);
});


test('100 and 250 lives have centered medal thumbnails without changing the equipped card',()=>{
  const root=postcss.parse(css);
  let medal=null,layer=null;
  root.walkRules(rule=>{
    if(rule.selector.includes('.shop-item-preview:is(.streak-100-background,.streak-250-background)')&&rule.selector.includes('#inventoryModal')){
      const map=Object.fromEntries(rule.nodes.filter(node=>node.type==='decl').map(node=>[node.prop,node.value]));
      if(map['background-size'])medal={selector:rule.selector,...map};
      if(map.display)layer={selector:rule.selector,...map};
    }
  });
  assert.ok(medal?.selector.includes('#shopModal'));
  assert.match(medal?.['background-size']||'',/270% auto/);
  assert.match(medal?.['background-position']||'',/92% center/);
  assert.ok(layer?.display?.includes('none'));
  assert.ok(!medal.selector.includes('.player-visit-card'));
});

