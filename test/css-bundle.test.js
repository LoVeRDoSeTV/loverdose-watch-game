import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import postcss from 'postcss';
import { compactCss, stylesheets } from '../scripts/build-css.mjs';

// Compare every selector, condition, declaration, value and priority in order.
// Raw token values are included so embedded comments and hacks stay intact.
function tokens(node) {
  if (node.type === 'comment') return null;
  const row = {type: node.type};
  for (const key of ['name', 'params', 'selector', 'prop', 'value', 'important']) {
    if (key in node) row[key] = node.raws?.[key]?.raw ?? node[key];
  }
  if (node.nodes) row.nodes = node.nodes.map(tokens).filter(Boolean);
  return row;
}

for (const name of stylesheets) {
  test(`${name}: served CSS keeps all rules and tokens in order`, () => {
    const source = fs.readFileSync(new URL(`../public/${name}.css`, import.meta.url), 'utf8');
    const bundle = fs.readFileSync(new URL(`../public/${name}.min.css`, import.meta.url), 'utf8');
    assert.equal(bundle, compactCss(source), 'Run npm run build:css after editing styles');
    assert.deepEqual(tokens(postcss.parse(bundle)), tokens(postcss.parse(source)));
    assert.ok(Buffer.byteLength(bundle) < Buffer.byteLength(source));
  });
}

test('CSS formatting preserves strings, calc spacing, custom properties and duplicate fallbacks', () => {
  const source = '/* note */ @media (width > 10px) { .a :is(.b, .c) { --gap: 1px  2px; content: "/* keep */ ; :"; width: calc(100% - 2px); display: block; display: flex !important; } }';
  assert.deepEqual(tokens(postcss.parse(compactCss(source))), tokens(postcss.parse(source)));
});
