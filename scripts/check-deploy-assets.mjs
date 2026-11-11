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
// Check every JavaScript source and bundle, not only the homepage entrypoints.
// Recursive scan is read-only; node --check parses without executing game code.
const javascript = [path.join(root, 'server.js')];
function collectJavaScript(directory) {
  if (!fs.existsSync(directory)) return;
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) collectJavaScript(fullPath);
    else if (entry.isFile() && /\.(?:js|mjs|cjs)$/i.test(entry.name)) javascript.push(fullPath);
  }
}
for (const folder of ['src', 'scripts', 'public']) collectJavaScript(path.join(root, folder));
for (const filename of javascript.sort()) {
  const result = spawnSync(process.execPath, ['--check', filename], {encoding:'utf8'});
  if (result.status !== 0) {
    errors.push('Syntaxe invalide : ' + path.relative(root, filename) + ': ' + (result.stderr || '').slice(0,500));
  }
}
// Never let a dump, credentials or a private key become a public static asset.
function checkPublicSecrets(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) checkPublicSecrets(fullPath);
    else if (entry.isFile() && /(?:^\.env(?:\..*)?$|\.(?:sql|dump|pem|key|bak)$|^id_(?:rsa|ed25519)$)/i.test(entry.name)) {
      errors.push('Fichier sensible dans public/ : ' + path.relative(pub, fullPath));
    }
  }
}
checkPublicSecrets(pub);
for (const message of errors) console.error('ERREUR : ' + message);
console.log('Prévol : ' + new Set(assets).size + ' ressources JS/CSS, ' + javascript.length + ' fichiers JavaScript vérifiés. ' + errors.length + ' erreur(s). Aucun fichier modifié.');
if (errors.length) process.exitCode = 1;
