#!/usr/bin/env node
// Télécharge depuis tanzil.net les traductions actives de donnees/traductions/langues.json,
// au format « Text (with aya numbers) » : une ligne « sourate|verset|texte » par verset.
// À lancer sur le PC (npm run traductions). Les fichiers .txt ne sont pas versionnés.
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const DOSSIER = join(dirname(fileURLToPath(import.meta.url)), '..', 'donnees', 'traductions');
const { traductions } = JSON.parse(readFileSync(join(DOSSIER, 'langues.json'), 'utf8'));

for (const t of traductions.filter((x) => x.actif)) {
  const url = `https://tanzil.net/trans/?transID=${encodeURIComponent(t.id)}&type=txt-2`;
  try {
    const r = await fetch(url);
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const texte = await r.text();
    const versets = texte.split(/\r?\n/).filter((l) => /^\d+\|\d+\|/.test(l)).length;
    if (versets !== 6236) throw new Error(`${versets} versets reçus au lieu de 6236 (format inattendu)`);
    writeFileSync(join(DOSSIER, `${t.id}.txt`), texte);
    console.log(`✓ ${t.id} (${t.nom}) : ${versets} versets`);
  } catch (e) {
    console.error(`✗ ${t.id} : ${e.message}. Téléchargez-le à la main sur https://tanzil.net/trans/${t.id}`
      + ` (format « Text (with aya numbers) ») et enregistrez-le sous donnees/traductions/${t.id}.txt`);
  }
}
