// Rebuild and verify JavaScript delivered to browsers without renaming symbols.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { minify } from 'terser';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const check = process.argv.includes('--check');
const files = ['app', 'bot-studio'];
let failed = false;

for (const name of files) {
  const input = path.join(root, 'public', name + '.js');
  const output = path.join(root, 'public', name + '.min.js');
  const source = fs.readFileSync(input, 'utf8');
  // Equivalent to: terser INPUT --format comments=false
  // Keep optimization disabled to protect the game's runtime behavior.
  const generated = (await minify(source, {
    compress: false,
    mangle: false,
    format: { comments: false }
  })).code;
  if (typeof generated !== 'string') throw new Error('Échec de minification : ' + name);
  if (check) {
    if (!fs.existsSync(output) || fs.readFileSync(output, 'utf8') !== generated) {
      console.error('Version JavaScript non synchronisée : ' + name + '.min.js');
      failed = true;
    } else {
      console.log('OK : ' + name + '.min.js');
    }
  } else {
    fs.writeFileSync(output, generated);
    console.log('Généré : ' + name + '.min.js (' + Buffer.byteLength(generated) + ' octets)');
  }
}

if (failed) process.exitCode = 1;
