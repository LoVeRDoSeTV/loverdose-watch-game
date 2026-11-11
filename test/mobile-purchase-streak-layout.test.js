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

test('100 and 250 lives have separate mobile assets on the real home card',()=>{
  const root=postcss.parse(css);
  const rules=[];
  root.walkRules(rule=>{
    if(rule.selector.includes('.dashboard-left-stack > .player-visit-card')){
      const values=Object.fromEntries(rule.nodes.filter(n=>n.type==='decl').map(n=>[n.prop,n.value]));
      rules.push({selector:rule.selector,values});
    }
  });
  for(const milestone of [100,250]){
    const real=rules.find(rule=>rule.selector.includes(`streak-${milestone}-background`));
    assert.ok(real,`Missing home card CSS for ${milestone} lives`);
    assert.match(real.values['background-image'],new RegExp(`streak-${milestone}-mobile\\.svg`));
    assert.match(real.values['background-size'],/100% auto/);
  }
  const shop=[];
  root.walkRules(rule=>{
    if(rule.selector.includes('.shop-profile-preview-card')&&rule.selector.includes('streak-250-background')){
      shop.push(Object.fromEntries(rule.nodes.filter(n=>n.type==='decl').map(n=>[n.prop,n.value])));
    }
  });
  assert.ok(shop.some(values=>values['background-size']?.includes('contain')));
  for(const milestone of [100,250]){
    const svg=readFileSync(new URL(`../public/assets/streak-${milestone}-mobile.svg`,import.meta.url),'utf8');
    assert.match(svg,/viewBox="0 0 360 260"/);
    assert.match(svg,new RegExp(`>${milestone}<\\/text>`));
  }
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

test('100/250 lives preview in badge collection uses the mobile artwork without stretching the ring',()=>{
  const root=postcss.parse(css);
  const previewRules=[];
  root.walkRules(rule=>{
    if(rule.selector.includes('#badgeVisitPreviewVisual')&&rule.selector.includes('.player-visit-card')){
      const values=Object.fromEntries(rule.nodes.filter(n=>n.type==='decl').map(n=>[n.prop,n.value]));
      if(values['background-image'])previewRules.push({selector:rule.selector,values});
    }
  });
  for(const milestone of [100,250]){
    const match=previewRules.find(rule=>rule.selector.includes(`streak-${milestone}-background`));
    assert.ok(match,`Missing badge collection preview for ${milestone} lives`);
    assert.match(match.values['background-image'],new RegExp(`streak-${milestone}-mobile\\.svg`));
    assert.match(match.values['background-size'],/100% auto/);
    assert.match(match.values['background-position'],/center center/);
  }
  const svg=readFileSync(new URL('../public/assets/streak-100-mobile.svg',import.meta.url),'utf8');
  assert.match(svg,/stroke="#e8ccff"/);
  assert.doesNotMatch(svg,/<circle cx="292" cy="159"[^>]*fill="#21143c"/);
});
