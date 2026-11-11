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

test('100 and 250 use the SAME full-bleed vector asset on mobile player and shop preview',()=>{
  const root=postcss.parse(css);
  const entries=[];
  root.walkRules(rule=>{
    entries.push({selector:rule.selector,values:Object.fromEntries(rule.nodes.filter(n=>n.type==='decl').map(n=>[n.prop,n.value]))});
  });
  for(const milestone of [100,250]){
    const name='streak-'+milestone+'-mobile.svg';
    const card=entries.find(rule=>rule.selector.includes('.dashboard-left-stack > .player-visit-card.streak-'+milestone+'-background')&&rule.values['background-image']);
    const shop=entries.find(rule=>rule.selector.includes('#shopItemPreviewVisual .shop-profile-preview-card.streak-'+milestone+'-background::before')&&rule.values['background-image']);
    assert.ok(card&&shop,'Full coverage missing for '+milestone+' lives');
    assert.ok(card.values['background-image'].includes(name));
    assert.ok(shop.values['background-image'].includes(name));
    assert.match(card.values['background-size'],/cover/);
    assert.match(shop.values['background-size'],/cover/);
    const art=readFileSync(new URL('../public/assets/'+name,import.meta.url),'utf8');
    const original=readFileSync(new URL('../public/assets/streak-'+milestone+'.svg',import.meta.url),'utf8');
    assert.match(art,/viewBox="0 0 700 470"/);
    assert.ok(art.includes('<rect width="700" height="470" fill="url(#base)"/>'));
    assert.equal((art.match(/<rect /g)||[]).length,1,'Only full-bleed background rectangle allowed');
    const ring=milestone===100?'cx="919" cy="195" r="127"':'cx="916" cy="201" r="139"';
    assert.ok(art.includes(ring)&&original.includes(ring),'Original medal ring must stay intact');
  }
  const compact=entries.find(rule=>rule.selector.includes('body .dashboard-left-stack > .player-visit-card:is(.streak-100-background,.streak-250-background)')&&rule.values['min-height']);
  assert.equal(compact?.values['min-height'],'0!important');
  const stage=entries.find(rule=>rule.selector.includes('#shopItemPreviewVisual .shop-profile-preview-card:is(.streak-100-background,.streak-250-background)')&&rule.values['min-height']);
  assert.equal(stage?.values['min-height'],'220px!important');
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

