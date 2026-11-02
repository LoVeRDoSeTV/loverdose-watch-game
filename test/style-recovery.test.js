import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

const script = readFileSync(new URL('../public/style-recovery.js', import.meta.url), 'utf8');
function fixture({ missing = false, hidden = false } = {}) {
  const events = new Map();
  let href = 'https://loverwatchgame.fr/styles.css?v=578', requests = 0;
  const link = { tagName: 'LINK', rel: 'stylesheet', disabled: false, sheet: missing ? null : {},
    get href() { return href; }, set href(value) { href = value; requests++; } };
  const external = { tagName: 'LINK', rel: 'stylesheet', href: 'https://example.com/styles.css', sheet: null };
  const listen = (name, fn) => { events.set(name, [...(events.get(name) || []), fn]); };
  const document = { hidden, readyState: 'interactive', querySelectorAll: () => [link, external], addEventListener: listen };
  runInNewContext(script, { document, window: { addEventListener: listen }, location: new URL('https://loverwatchgame.fr/'), URL, Date });
  return { link, document, get requests() { return requests; }, emit(name, target = link) {
    for (const fn of events.get(name) || []) fn({ target });
  } };
}

test('a healthy stylesheet stays cached through mobile return events', () => {
  const f = fixture();
  f.emit('pageshow'); f.emit('visibilitychange'); f.emit('online');
  assert.equal(f.requests, 0);
});

test('a missing stylesheet retries without changing its version or duplicating requests', () => {
  const f = fixture({ missing: true });
  assert.equal(f.requests, 1);
  assert.equal(new URL(f.link.href).searchParams.get('v'), '578');
  assert.ok(new URL(f.link.href).searchParams.has('_css_retry'));
  f.emit('pageshow'); f.emit('visibilitychange');
  assert.equal(f.requests, 1);
  f.link.sheet = {}; f.emit('load'); f.emit('pageshow');
  assert.equal(f.requests, 1);
});

test('persistent failures stop after two attempts and can recover when the network returns', () => {
  const f = fixture({ missing: true });
  f.emit('error'); f.emit('error'); f.emit('error'); f.emit('pageshow');
  assert.equal(f.requests, 2);
  f.emit('online');
  assert.equal(f.requests, 3);
});

test('failed styles in a suspended tab retry when it becomes visible', () => {
  const f = fixture({ missing: true, hidden: true });
  f.emit('error');
  assert.equal(f.requests, 0);
  f.document.hidden = false; f.emit('visibilitychange');
  assert.equal(f.requests, 1);
});
