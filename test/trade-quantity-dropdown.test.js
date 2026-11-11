import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const html=readFileSync(new URL('../public/index.html',import.meta.url),'utf8');
const source=readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
const bundle=readFileSync(new URL('../public/app.min.js',import.meta.url),'utf8');
const css=readFileSync(new URL('../public/trade-quantity-select.css',import.meta.url),'utf8');

test('création d’échange : quantité vide par défaut et sélection native',()=>{
  assert.match(html,/<select id="tradeOfferQuantity"[^>]*><option value="">Choisis une quantité<\\/option><\\/select>/);
  assert.doesNotMatch(html,/<input id="tradeOfferQuantity"/);
  assert.match(html,/trade-quantity-select\\.css\\?v=1/);
  for(const file of [source,bundle]){
    assert.match(file,/<select data-trade-quantity aria-label="Quantité demandée"><option value="">Choisis une quantité<\\/option><\\/select>/);
    assert.match(file,/function updateTradeQuantitySelect\\(/);
    assert.match(file,/updateTradeQuantitySelect\\(select,balance,changed\\)/);
    assert.match(file,/updateTradeQuantitySelect\\(row\\.querySelector\\('\[data-trade-quantity\]'\\),999,key!==previous\\)/);
    assert.doesNotMatch(file,/tradeOfferQuantity['"]\\)\\.value\\s*=\\s*['"]10['"]/);
  }
});

test('on ne présélectionne plus 10, et l’inventaire borne les offres',()=>{
  for(const file of [source,bundle]){
    assert.match(file,/select\\.value=keep&&Number\\(keep\\)>=1&&Number\\(keep\\)<=cap\\?keep:''/);
    assert.match(file,/select\\.disabled=cap===0/);
    assert.match(file,/const balance=Math\\.max\\(0,Math\\.floor\\(tradeBalanceFor\\(/);
    assert.match(file,/validateDesktopTradeComposer\\(true\\)/);
    assert.match(file,/function setupDesktopTradeQuantity\\(/,'les autres échanges doivent garder leurs contrôles de quantités');
  }
  assert.match(css,/#tradeComposer select#tradeOfferQuantity/);
  assert.match(css,/#tradeComposer select\\[data-trade-quantity\\]/);
});
