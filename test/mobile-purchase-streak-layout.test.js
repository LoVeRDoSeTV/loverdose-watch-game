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

test('real and badge preview cards share original panoramic background rules',()=>{
  const root=postcss.parse(css);
  const selectors=[];
  root.walkRules(rule=>{
    if(rule.selector.includes('.dashboard-left-stack > .player-visit-card') &&
      rule.selector.includes('#badgeVisitPreviewVisual .player-visit-card')){
      const values=Object.fromEntries(rule.nodes.filter(n=>n.type==='decl').map(n=>[n.prop,n.value]));
      if(values['background-size'])selectors.push({selector:rule.selector,values});
    }
  });
  assert.equal(selectors.length,1);
  assert.match(selectors[0].selector,/streak-100-background/);
  assert.match(selectors[0].selector,/streak-250-background/);
  assert.match(selectors[0].values['background-size'],/100% auto/);
  assert.match(selectors[0].values['background-position'],/bottom 28px/);
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

