import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Ne remplace jamais les secrets ni les données PostgreSQL.
export function updatePublicOrigin(text) {
  const newline = text.includes('\r\n') ? '\r\n' : '\n';
  const keys = { BASE_URL: 'https://loverwatchgame.fr' };
  let lines = text.split(/\r?\n/);
  for (const [key, value] of Object.entries(keys)) {
    let found = false;
    lines = lines.filter(line => {
      if (!new RegExp(`^\\s*(?:export\\s+)?${key}\\s*=`).test(line)) return true;
      if (found) return false;
      found = true;
      return true;
    }).map(line => new RegExp(`^\\s*(?:export\\s+)?${key}\\s*=`).test(line) ? `${key}=${value}` : line);
    if (!found) { if (lines.at(-1) === '') lines.pop(); lines.push(`${key}=${value}`, ''); }
  }
  return lines.join(newline);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const envPath = path.join(root, '.env');
  const before = fs.readFileSync(envPath, 'utf8');
  const after = updatePublicOrigin(before);
  if (before === after) console.log('BASE_URL est déjà configurée pour https://loverwatchgame.fr.');
  else if (!process.argv.includes('--apply')) {
    console.log('Préparation : BASE_URL sera remplacée par https://loverwatchgame.fr.');
    console.log('Pour appliquer : node scripts/migrate-ovh.mjs --apply');
  } else {
    const backup = `${envPath}.avant-ovh-${Date.now()}`;
    fs.writeFileSync(backup, before, { mode: 0o600, flag: 'wx' });
    // Écriture atomique ; le service continue d’utiliser son environnement actuel jusqu’au redémarrage.
    const temporary = `${envPath}.ovh-${process.pid}.tmp`;
    fs.writeFileSync(temporary, after, { mode: 0o600, flag: 'wx' });
    fs.renameSync(temporary, envPath);
    console.log('BASE_URL corrigée. Sauvegarde privée du .env créée à côté du fichier.');
    console.log('Secrets et base de données conservés. Redémarrer loverwatchgame après les réglages Twitch.');
  }
}
