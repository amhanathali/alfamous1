#!/usr/bin/env node
// Prépare le dossier dist/ que Firebase Hosting met en ligne.
// Copie : src/ (l'application) et les données publiques de donnees/.
// Ne copie JAMAIS import/ (commentaires à importer dans Firestore) ni scripts/.
import { cpSync, rmSync, mkdirSync, existsSync, readdirSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { MODULES_SDK, lireModuleSdk } from './lib/sdk-firebase.mjs';

const RACINE = join(dirname(fileURLToPath(import.meta.url)), '..');
const DIST = join(RACINE, 'dist');

rmSync(DIST, { recursive: true, force: true });
cpSync(join(RACINE, 'src'), DIST, { recursive: true, filter: (f) => !f.startsWith(join(RACINE, 'src', 'config')) });

const D = join(DIST, 'donnees');
mkdirSync(join(D, 'traductions'), { recursive: true });
for (const dossier of ['texte', 'mots']) cpSync(join(RACINE, 'donnees', dossier), join(D, dossier), { recursive: true });
for (const f of ['racines.json', 'sourates.json']) cpSync(join(RACINE, 'donnees', f), join(D, f));
cpSync(join(RACINE, 'donnees/traductions/langues.json'), join(D, 'traductions/langues.json'));

// Traductions tanzil présentes sur ce poste (téléchargées par « npm run traductions »).
const traductions = readdirSync(join(RACINE, 'donnees/traductions')).filter((f) => f.endsWith('.txt'));
for (const f of traductions) cpSync(join(RACINE, 'donnees/traductions', f), join(D, 'traductions', f));
// Liste des traductions réellement déployées, lue par l'application.
writeFileSync(join(D, 'traductions/disponibles.json'), JSON.stringify(traductions.map((f) => f.replace(/\.txt$/, ''))) + '\n');

// SDK Firebase (comptes, commentaires) servi par l'application.
mkdirSync(join(DIST, 'vendor/firebase'), { recursive: true });
for (const m of MODULES_SDK) writeFileSync(join(DIST, 'vendor/firebase', m), lireModuleSdk(RACINE, m));

writeFileSync(join(DIST, 'version.json'), JSON.stringify({ construit: new Date().toISOString() }) + '\n');
if (existsSync(join(DIST, 'import'))) throw new Error('import/ ne doit pas être publié');
console.log(`dist/ prêt : application, données, ${traductions.length} traduction(s) tanzil (${traductions.join(', ') || 'aucune'}).`);
