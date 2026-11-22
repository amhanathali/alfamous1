#!/usr/bin/env node
// Convertit les exports CSV du classeur Lexique-Coran en fichiers de données d'Alfamous1.
//
// Usage : node scripts/convertir-classeur.mjs <dossier des CSV>
// Le dossier doit contenir « Lexique-Coran - Versets1.csv », « … - Lexique1.csv », « … - Feuille22.csv ».
//
// Produit :
//   donnees/texte/001.json … 114.json   arabe, racines, page Warsh, translittération (versionné)
//   donnees/mots/001.json … 114.json    mot à mot : [translittération, racine, arabe, sens] (versionné)
//   donnees/racines.json                index racine → occurrences « s:v:n », d'après la colonne Racines
//                                       de Versets1 (alignée mot à mot sur le texte), comme l'ancienne application
//   donnees/sourates.json               nombre de versets, première et dernière page (versionné)
//   import/commentaires-versets.json    commentaires à importer dans Firestore (NON versionné)
//   import/lexique.json                 entrées du lexique à importer dans Firestore (NON versionné)
//   import/rapport.txt                  contrôles et anomalies (NON versionné)
//
// Colonnes ignorées :
//   - traductions du classeur (Hamidullah, Yusuf Ali, AMZ, ES, Mountadana) : elles viennent de tanzil.net ;
//   - transcriptions « CSC » (coran-seul.com) : la translittération est recalculée par Alfamous1
//     à partir du texte arabe (scripts/lib/translitteration.mjs).
// Les entrées du lexique signées « CSC-Tradition » (définitions traditionnelles de coran-seul.com)
// sont écartées, à la demande de l'auteur : elles ne relèvent pas de la méthode Alfamous.

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { lireCsv } from './lib/csv.mjs';
import { decouperCommentaires } from './lib/commentaires.mjs';
import { translittererVerset, translittererMot } from './lib/translitteration.mjs';

const RACINE = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = process.argv[2];
if (!source) { console.error('Usage : node scripts/convertir-classeur.mjs <dossier des CSV>'); process.exit(1); }

const lire = (onglet) => lireCsv(readFileSync(join(source, `Lexique-Coran - ${onglet}.csv`), 'utf8'));
const ecrire = (chemin, donnees, compact = true) => {
  const complet = join(RACINE, chemin);
  mkdirSync(dirname(complet), { recursive: true });
  writeFileSync(complet, JSON.stringify(donnees, null, compact ? 0 : 2) + '\n');
};
const num = (n) => String(n).padStart(3, '0');
const rapport = [];

// Signatures harmonisées à la demande de l'auteur : « Amha » = « Amha Nathali » ; sans signature = « Anonyme ».
const ALIAS_AUTEURS = { 'amha': 'Amha Nathali', 'anonyme': 'Anonyme' };
const harmoniser = (c) => {
  const a = (c.auteur || '').trim();
  return { ...c, auteur: a ? (ALIAS_AUTEURS[a.toLowerCase()] || a) : 'Anonyme' };
};

// ---------- Versets1 ----------
const versets = lire('Versets1');
const entete = versets.shift();
const col = Object.fromEntries(entete.map((nom, i) => [nom, i]));
for (const nom of ['Soura', 'Aya', 'Coran', 'Trad.Lex', 'Racines', 'nWarsh']) {
  if (!(nom in col)) throw new Error(`Colonne manquante dans Versets1 : ${nom}`);
}

const parSourate = new Map();
const commentairesVersets = [];
for (const r of versets) {
  const s = Number(r[col.Soura]); const v = Number(r[col.Aya]);
  if (!s || !v) continue;
  if (!parSourate.has(s)) parSourate.set(s, []);
  parSourate.get(s).push({
    v,
    ar: r[col.Coran].trim(),
    racines: r[col.Racines].trim().split(/\s+/).filter(Boolean),
    page: Number(r[col.nWarsh]) || null,
    tr: translittererVerset(r[col.Coran]),
  });
  decouperCommentaires(r[col['Trad.Lex']]).forEach((c, ordre) => {
    commentairesVersets.push({ sourate: s, verset: v, ordre, ...harmoniser(c) });
  });
}

// Basmala : le classeur la place au début du verset 1 de chaque sourate (sauf 1 et 9).
// On la retire du verset et on la signale par « basmala: true » sur la sourate.
const BASMALA = parSourate.get(1)?.find((x) => x.v === 1)?.ar.split(/\s+/) || [];
const sansDiacritiques = (t) => t.replace(/[^\u0621-\u064A\u0671]/g, '');
const avecBasmala = new Set();
for (const [s, liste] of parSourate) {
  const v1 = liste.find((x) => x.v === 1);
  if (s === 1 || !v1) continue;
  const mots = v1.ar.split(/\s+/);
  if (mots.length > 4 && mots.slice(0, 4).map(sansDiacritiques).join(' ') === BASMALA.map(sansDiacritiques).join(' ')) {
    v1.ar = mots.slice(4).join(' ');
    v1.racines = v1.racines.slice(4);
    v1.tr = translittererVerset(v1.ar);
    avecBasmala.add(s);
  }
}
rapport.push(`Basmala retirée du verset 1 de ${avecBasmala.size} sourates`);

const sourates = [];
for (const [s, liste] of [...parSourate].sort((a, b) => a[0] - b[0])) {
  liste.sort((a, b) => a.v - b.v);
  liste.forEach((x, i) => { if (x.v !== i + 1) rapport.push(`Sourate ${s} : verset ${x.v} à la position ${i + 1}`); });
  ecrire(`donnees/texte/${num(s)}.json`, { sourate: s, basmala: avecBasmala.has(s), versets: liste });
  const pages = liste.map((x) => x.page).filter(Boolean);
  sourates.push({ n: s, versets: liste.length, basmala: avecBasmala.has(s), pageDebut: Math.min(...pages), pageFin: Math.max(...pages) });
}
ecrire('donnees/sourates.json', sourates, false);

const racines = new Map();
for (const [s, liste] of [...parSourate].sort((a, b) => a[0] - b[0])) {
  for (const x of liste) {
    if (x.racines.length !== x.ar.split(/\s+/).length) rapport.push(`${s}:${x.v} : ${x.racines.length} racines pour ${x.ar.split(/\s+/).length} mots`);
    x.racines.forEach((r, i) => {
      if (!racines.has(r)) racines.set(r, []);
      racines.get(r).push(`${s}:${x.v}:${i + 1}`);
    });
  }
}

// ---------- Feuille22 : mot à mot ----------
const mots = lire('Feuille22');
mots.shift();
const motsParSourate = new Map();
let motsHorsFormat = 0;
for (const r of mots) {
  const id = (r[0] || '').trim();
  const m = id.match(/^(\d+)\.(\d+)#(\d+)$/);
  if (!m) continue;
  const [s, v, n] = m.slice(1).map(Number);
  // Format : [translittération | racine | arabe | sens] ; le sens peut contenir « | »
  const parties = (r[1] || '').trim().replace(/^\[/, '').replace(/\]$/, '').split('|').map((x) => x.trim());
  if (parties.length < 4) { motsHorsFormat++; rapport.push(`Mot ${id} hors format : ${r[1]}`); continue; }
  const [, racine, ar, ...sens] = parties;   // la translittération CSC est remplacée
  const tr = translittererMot(ar);
  if (!motsParSourate.has(s)) motsParSourate.set(s, {});
  const parVerset = motsParSourate.get(s);
  (parVerset[v] ||= [])[n - 1] = [tr, racine, ar, sens.join(' | ')];
}
for (const [s, parVerset] of motsParSourate) ecrire(`donnees/mots/${num(s)}.json`, { sourate: s, versets: parVerset });
ecrire('donnees/racines.json', Object.fromEntries([...racines].sort((a, b) => a[0].localeCompare(b[0], 'ar'))));

// ---------- Lexique1 ----------
const lexique = lire('Lexique1');
lexique.shift();
const entreesLexique = [];
let ecartesCsc = 0;
for (const [cle, texte] of lexique) {
  if (!cle || !cle.trim()) continue;
  decouperCommentaires(texte)
    .filter((c) => {
      if (/^CSC-Tradition$/i.test(c.auteur || '')) { ecartesCsc++; return false; }
      return true;
    })
    .forEach((c, ordre) => entreesLexique.push({ cle: cle.trim(), ordre, ...harmoniser(c) }));
}

ecrire('import/commentaires-versets.json', commentairesVersets, false);
ecrire('import/lexique.json', entreesLexique, false);

// ---------- Rapport ----------
const auteurs = {};
for (const c of [...commentairesVersets, ...entreesLexique]) auteurs[c.auteur || '(sans signature)'] = (auteurs[c.auteur || '(sans signature)'] || 0) + 1;
const resume = [
  `Sourates : ${sourates.length}`,
  `Versets : ${sourates.reduce((t, x) => t + x.versets, 0)}`,
  `Mots (mot à mot) : ${[...motsParSourate.values()].reduce((t, pv) => t + Object.values(pv).reduce((u, l) => u + l.length, 0), 0)} ; ${motsHorsFormat} hors format`,
  `Mots du texte (avec racine) : ${[...racines.values()].reduce((t, x) => t + x.length, 0)}`,
  `Racines distinctes : ${racines.size}`,
  `Commentaires de versets : ${commentairesVersets.length} (${commentairesVersets.filter((c) => !c.date).length} sans date)`,
  `Entrées du lexique : ${entreesLexique.length} (${entreesLexique.filter((c) => !c.date).length} sans date) ; ${ecartesCsc} entrées « CSC-Tradition » écartées`,
  `Auteurs : ${Object.entries(auteurs).sort((a, b) => b[1] - a[1]).map(([a, n]) => `${a} (${n})`).join(', ')}`,
];
mkdirSync(join(RACINE, 'import'), { recursive: true });
writeFileSync(join(RACINE, 'import/rapport.txt'), [...resume, '', 'Anomalies :', ...rapport].join('\n') + '\n');
console.log(resume.join('\n'));
console.log(`Anomalies : ${rapport.length} (détail dans import/rapport.txt)`);
