import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const html=readFileSync(new URL('../public/index.html',import.meta.url),'utf8');
const source=readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
const bundle=readFileSync(new URL('../public/app.min.js',import.meta.url),'utf8');
const css=readFileSync(new URL('../public/trade-quantity-select.css',import.meta.url),'utf8');

test('une offre d’échange commence sans quantité et utilise un menu déroulant',()=>{
  assert.ok(html.includes('<select id="tradeOfferQuantity"'));
  assert.ok(html.includes('<option value="">Choisis une quantité</option>'));
  assert.ok(!html.includes('<input id="tradeOfferQuantity"'));
  assert.ok(html.includes('/trade-quantity-select.css?v=1'));
  for(const file of [source,bundle]){
    assert.ok(file.includes('<select data-trade-quantity aria-label="Quantité demandée">'));
    assert.ok(file.includes('function updateTradeQuantitySelect('));
    assert.ok(file.includes('updateTradeQuantitySelect(select,balance,changed)'));
    assert.ok(file.includes("updateTradeQuantitySelect(row.querySelector('[data-trade-quantity]'),999,key!==previous)"));
    assert.ok(!file.includes("tradeOfferQuantity').value='10'"));
    assert.ok(!file.includes('tradeOfferQuantity").value="10"'));
  }
});

test('une quantité doit être choisie, les offres sont bornées au stock du joueur',()=>{
  for(const file of [source,bundle]){
    assert.ok(file.includes("select.value=keep&&Number(keep)>=1&&Number(keep)<=cap?keep:''"));
    assert.ok(file.includes('select.disabled=cap===0'));
    assert.ok(file.includes('const balance=Math.max(0,Math.floor(tradeBalanceFor('));
    assert.ok(file.includes('validateDesktopTradeComposer(true)'));
    assert.ok(file.includes('function setupDesktopTradeQuantity('),'les autres échanges gardent leur contrôle de quantité');
  }
  assert.ok(css.includes('#tradeComposer select#tradeOfferQuantity'));
  assert.ok(css.includes('#tradeComposer select[data-trade-quantity]'));
});
