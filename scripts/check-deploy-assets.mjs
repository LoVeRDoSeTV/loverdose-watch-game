// Read-only pre-deployment checks. Does not touch players, databases or live services.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pub = path.join(root, 'public');
const errors = [];
const home = fs.readFileSync(path.join(pub, 'index.html'), 'utf8');
const resourcePattern = /<(?:script|link)\b[^>]*\b(?:src|href)=["'](\/[^"'#]+)["']/g;
const assets = [...home.matchAll(resourcePattern)]
  .map(match => match[1].split('?')[0])
  .filter(resource => /\.(?:js|css)$/i.test(resource));
for (const resource of new Set(assets)) {
  const fullPath = path.resolve(pub, '.' + resource);
  if (!fullPath.startsWith(pub + path.sep) || !fs.existsSync(fullPath)) {
    errors.push('Ressource absente : ' + resource);
  }
}
if (!/<script\s+defer\s+src=["']\/app\.min\.js\?v=\d+["']/.test(home)) {
  errors.push('Le jeu doit charger app.min.js avec un numéro de version pour le cache.');
}
const server = fs.readFileSync(path.join(root, 'server.js'), 'utf8');
if (!server.includes("if (/^\\/+server\\.js(?:\\/|$)/i.test(path))")) {
  errors.push('Protection de /server.js manquante avant express.static.');
}
for (const resource of ['server.js','public/app.js','public/app.min.js','public/bot-studio.js','public/bot-studio.min.js']) {
  const result = spawnSync(process.execPath, ['--check', path.join(root, resource)], {encoding:'utf8'});
  if (result.status !== 0) errors.push('Syntaxe invalide : ' + resource + ': ' + (result.stderr || '').slice(0,500));
}
for (const message of errors) console.error('ERREUR : ' + message);
console.log('Prévol : ' + new Set(assets).size + ' ressources JS/CSS vérifiées. ' + errors.length + ' erreur(s). Aucun fichier modifié.');
if (errors.length) process.exitCode = 1;
