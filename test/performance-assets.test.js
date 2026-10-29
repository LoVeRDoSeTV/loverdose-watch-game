import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = name => fs.readFileSync(new URL('../public/' + name, import.meta.url), 'utf8');

test('extended styles load immediately after base styles, before other stylesheets', () => {
  const html = read('index.html');
  const refs = [...html.matchAll(/<link\s+rel="stylesheet"\s+href="([^"]+)"/g)].map(m => m[1].split('?')[0]);
  assert.deepEqual(refs.slice(0, 2), ['/styles.css', '/styles-extended.css']);
  assert.equal(refs.filter(x => x === '/styles-extended.css').length, 1);
});

test('split CSS preserves the original rule boundary and core mobile profile protections', () => {
  const base = read('styles.css');
  const extended = read('styles-extended.css');
  assert.match(base, /\}\s*$/);
  assert.match(extended, /^\/\* V88 — chances de drop dans une vraie popup \*\//);
  assert.match(base + extended, /#playerProfileModal\{overflow-x:hidden!important/);
  assert.match(base + extended, /#lovysXpTransferModal\{[\s\S]*?overflow-x:hidden!important/);
});

test('hidden tabs do not run the periodic event or bot visual updates', () => {
  const app = read('app.js');
  assert.match(app, /if\(!document\.hidden && !\$\('eventsModal'\)\?\.classList\.contains\('hidden'\)\)void refreshEventsState\(\)/);
  assert.match(app, /if\(document\.hidden\)return;const timer=document\.querySelector\('\[data-bot-countdown\]'\)/);
  assert.match(app, /if\(!document\.hidden && isDesktopGameUi\(\)\)syncDesktopBoostData\(\)/);
});
