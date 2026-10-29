import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = new URL('../public/', import.meta.url);
const get = name => fs.statSync(new URL(name, root)).size;

test('client payload stays within regression budgets', () => {
  const js = get('app.js');
  const css = get('styles.css') + get('styles-extended.css');
  // Budgets allow existing content but detect accidental bulk growth.
  assert.ok(js < 800_000, 'app.js exceeded 800 KB; investigate new code or split a module');
  assert.ok(css < 800_000, 'combined CSS exceeded 800 KB; investigate new rules');
});

test('optimized badge assets are smaller than original main-branch baseline', () => {
  const dir = new URL('badges/', root);
  const badges = fs.readdirSync(dir).filter(name => name.endsWith('.webp'));
  const total = badges.reduce((size, name) => size + fs.statSync(new URL(name, dir)).size, 0);
  assert.ok(total < 9_000_000, 'badges grew beyond 9 MB; review compressed image assets');
});
