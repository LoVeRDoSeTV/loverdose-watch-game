import fs from 'node:fs';
import postcss from 'postcss';

export const stylesheets = ['styles-extended', 'pve-expansion', 'return-summary', 'live-xp-boost', 'tablet'];

// Only remove formatting outside CSS tokens. Keep selectors, values, custom
// properties, rule order, duplicate declarations and browser hacks verbatim.
export function compactCss(source) {
  const root = postcss.parse(source);
  root.walk(node => {
    if (node.type === 'comment' && !node.text.startsWith('!')) {
      node.remove();
      return;
    }
    for (const key of ['before', 'after']) {
      if (/^\s*$/.test(node.raws[key] ?? '')) node.raws[key] = '';
    }
    if (node.type === 'decl') {
      if (/^:\s*$/.test(node.raws.between ?? '')) node.raws.between = ':';
    } else if (/^\s*$/.test(node.raws.between ?? '')) {
      node.raws.between = '';
    }
  });
  root.raws.after = '';
  return root.toString();
}

if (process.argv[1] && import.meta.url === new URL(process.argv[1], 'file:').href) {
  const check = process.argv.includes('--check');
  let failed = false;
  let before = 0, after = 0;
  for (const name of stylesheets) {
    const input = new URL(`../public/${name}.css`, import.meta.url);
    const output = new URL(`../public/${name}.min.css`, import.meta.url);
    const source = fs.readFileSync(input, 'utf8');
    const compact = compactCss(source);
    before += Buffer.byteLength(source);
    after += Buffer.byteLength(compact);
    if (check) {
      if (!fs.existsSync(output) || fs.readFileSync(output, 'utf8') !== compact) {
        console.error(`Outdated CSS bundle: ${name}.min.css`);
        failed = true;
      }
    } else {
      fs.writeFileSync(output, compact);
    }
  }
  console.log(JSON.stringify({before, after, saved: before - after}));
  if (failed) process.exitCode = 1;
}
