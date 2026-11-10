// Read-only deployment preflight: never rewrites assets or game data.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pub = path.join(root, 'public');
const errors = [];
const warnings = [];
const read = filename => fs.readFileSync(path.join(pub, filename), 'utf8');
const html = read('index.html');

// Check local assets actually requested by the game homepage.
const refs = [...html.matchAll(/<(?:script|link)\b[^>]*\b(?:src|href)=["'](\/[^"'#]+)["']/g)]
  .map(match => match[1].split('?')[0])
  .filter(value => /\.(?:js|css)$/.test(value));
for (const resource of new Set(refs)) {
  const resolved = path.resolve(pub, '.' + resource);
  if (!resolved.startsWith(pub + path.sep) || !fs.existsSync(resolved)) {
    errors.push('Ressource manquante dans public/: ' + resource);
  }
}

// Source and minified variants must expose the same admin actions.
// This catches accidental deployments that update app.js but forget app.min.js.
for (const [source, minified] of [['app.js', 'app.min.js'], ['bot-studio.js', 'bot-studio.min.js']]) {
  if (!fs.existsSync(path.join(pub, source)) || !fs.existsSync(path.join(pub, minified))) {
    errors.push('Paire JavaScript manquante : ' + source + ' / ' + minified);
    continue;
  }
  const original = read(source);
  const built = read(minified);
  const markers = [...new Set([
    ...original.matchAll(/data-admin-action="([^"]+)"/g),
    ...original.matchAll(/data-admin-boost-hours/g),
    ...original.matchAll(/grant_xp_boost_hours/g)
  ].map(match => match[1] || match[0]))];
  for (const marker of markers) {
    if (!built.includes(marker)) errors.push(minified + ' ne contient pas : ' + marker);
  }
  const check = spawnSync(process.execPath, ['--check', path.join(pub, minified)], {encoding:'utf8'});
  if (check.status !== 0) errors.push('Syntaxe invalide : ' + minified + ' — ' + (check.stderr || '').trim().slice(0,500));
}
for (const filename of ['server.js', 'public/app.js']) {
  const check = spawnSync(process.execPath, ['--check', path.join(root, filename)], {encoding:'utf8'});
  if (check.status !== 0) errors.push('Syntaxe invalide : ' + filename + ' — ' + (check.stderr || '').trim().slice(0,500));
}
if (fs.existsSync(path.join(pub, 'server.js'))) {
  warnings.push('public/server.js existe : vérifier son usage avant toute suppression (ne pas publier de serveur dans les fichiers statiques).');
}
for (const message of warnings) console.warn('ATTENTION : ' + message);
for (const message of errors) console.error('ERREUR : ' + message);
console.log('Prévol : ' + refs.length + ' références JS/CSS vérifiées ; ' + errors.length + ' erreur(s). Aucune modification.');
if (errors.length) process.exitCode = 1;
