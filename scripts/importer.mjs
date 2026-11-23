#!/usr/bin/env node
// Phase 4 : import des commentaires de l'ancienne application (versets et lexique) dans Firestore.
//
// Source : exports CSV du classeur Lexique-Coran, posés dans un dossier (par défaut import/, jamais dans Git) :
//   « Lexique-Coran - Versets1.csv » et « Lexique-Coran - Lexique1.csv ».
//
//   npm run importer                                  à blanc : rapport et fiche de contrôle, rien n'est écrit
//   npm run importer -- --projet essai --ecrire       écrit sur alfamous-essai (remplace les documents déjà importés)
//   npm run importer -- --projet essai --verifier     relit Firestore et compare au classeur
//   npm run importer -- --projet essai --purger       supprime les commentaires importés (et seulement eux)
//   --projet prod : alfamous-atelier, confirmation PROD demandée.  Sans --projet : émulateurs (demo-alfamous1).
//   --source <dossier> : autre dossier que import/.
//
// Pour un vrai projet : clé de compte de service HORS du dépôt :
//   set GOOGLE_APPLICATION_CREDENTIALS=C:\Users\gmpcd\cles\alfamous-essai.json
// Règles et décisions : scripts/lib/import.mjs, docs/DECISIONS.md.
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createInterface } from 'node:readline/promises';
import { lireCsv } from './lib/csv.mjs';
import { extraireVersets, extraireLexique, preparerImport, texteRapport, csvControle, SOURCE } from './lib/import.mjs';

const RACINE = join(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const valeur = (nom) => { const i = args.indexOf(nom); return i >= 0 ? args[i + 1] : null; };
const alias = valeur('--projet');
const source = valeur('--source') || join(RACINE, 'import');
const mode = args.includes('--purger') ? 'purger' : args.includes('--verifier') ? 'verifier' : args.includes('--ecrire') ? 'ecrire' : 'a-blanc';
// Comptes auxquels relier les commentaires (décision de l'auteur : ses propres commentaires seulement).
const COMPTES = { 'Amha Nathali': 'gmpcdz@gmail.com' };
const SITES = { essai: 'https://alfamous-essai.web.app', prod: 'https://alfamous-atelier.web.app' };

function arreter(msg) { console.error(msg); process.exit(1); }

// ---------- Lecture du classeur ----------
function lire(onglet) {
  const chemin = join(source, `Lexique-Coran - ${onglet}.csv`);
  if (!existsSync(chemin)) arreter(`Fichier introuvable : ${chemin}\nExportez l'onglet ${onglet} du classeur (Fichier › Télécharger › CSV).`);
  return lireCsv(readFileSync(chemin, 'utf8'));
}
const bruts = [...extraireVersets(lire('Versets1')), ...extraireLexique(lire('Lexique1'))];
const nbVersetsParSourate = Object.fromEntries(
  JSON.parse(readFileSync(join(RACINE, 'donnees/sourates.json'), 'utf8')).map((s) => [s.n, s.versets]));

// ---------- Firebase (sauf à blanc) ----------
let db = null; let auth = null; let FieldValue = null;
if (mode !== 'a-blanc' || alias) {
  const { initializeApp, applicationDefault } = await import('firebase-admin/app');
  const fs = await import('firebase-admin/firestore');
  const { getAuth } = await import('firebase-admin/auth');
  FieldValue = fs.FieldValue;
  let app;
  if (!alias) {
    process.env.FIRESTORE_EMULATOR_HOST ||= '127.0.0.1:8085';
    process.env.FIREBASE_AUTH_EMULATOR_HOST ||= '127.0.0.1:9099';
    app = initializeApp({ projectId: 'demo-alfamous1' });
    console.log('Cible : émulateurs (demo-alfamous1).');
  } else {
    const projets = JSON.parse(readFileSync(join(RACINE, '.firebaserc'), 'utf8')).projects;
    const projectId = projets[alias];
    if (!projectId || alias === 'default') arreter(`Projet inconnu : ${alias} (essai ou prod).`);
    if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) arreter('Indiquez la clé de service : set GOOGLE_APPLICATION_CREDENTIALS=C:\\chemin\\hors\\depot\\cle.json');
    app = initializeApp({ credential: applicationDefault(), projectId });
    console.log(`Cible : ${projectId}.`);
  }
  db = fs.getFirestore(app);
  auth = getAuth(app);
}

// Comptes reliés : uid cherché par courriel dans le projet visé.
const uidParAuteur = {};
if (auth) {
  for (const [nom, courriel] of Object.entries(COMPTES)) {
    try {
      const u = await auth.getUserByEmail(courriel);
      uidParAuteur[nom] = u.uid;
      if (u.displayName !== nom) console.log(`Attention : le compte ${courriel} s'affiche « ${u.displayName || '(sans nom)'} », les commentaires importés sont signés « ${nom} ».`);
    } catch { console.log(`Attention : aucun compte ${courriel} sur ce projet ; les commentaires de ${nom} ne seront reliés à aucun compte.`); }
  }
}

const prep = preparerImport(bruts, { nbVersetsParSourate, uidParAuteur });
mkdirSync(join(RACINE, 'import'), { recursive: true });
writeFileSync(join(RACINE, 'import/rapport-import.txt'), texteRapport(prep));
writeFileSync(join(RACINE, 'import/controle-import.csv'), csvControle(prep.documents, SITES[alias] || SITES.essai));
const nv = prep.documents.filter((d) => d.donnees.type === 'verset').length;
console.log(`Préparé : ${prep.documents.length} commentaires (versets ${nv}, lexique ${prep.documents.length - nv}) ; écartés ${prep.ecartes.length} ; anomalies ${prep.anomalies.length}.`);
console.log('Détail : import/rapport-import.txt ; fiche de contrôle : import/controle-import.csv');
if (mode === 'a-blanc') process.exit(0);

if (alias === 'prod' && mode !== 'verifier') {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const r = await rl.question(`PRODUCTION (alfamous-atelier) : ${mode === 'ecrire' ? `écrire ${prep.documents.length} commentaires` : 'supprimer les commentaires importés'} ? Tapez PROD : `);
  rl.close();
  if (r.trim() !== 'PROD') arreter('Annulé.');
}

// Commentaires importés déjà présents (repérés par le champ import.source).
async function dejaImportes() {
  const snap = await db.collection('commentaires').where('import.source', '==', SOURCE).get();
  return snap.docs;
}
async function parLots(operations) {
  for (let i = 0; i < operations.length; i += 400) {
    const lot = db.batch();
    operations.slice(i, i + 400).forEach((op) => op(lot));
    await lot.commit();
  }
}

if (mode === 'purger') {
  const docs = await dejaImportes();
  // Un commentaire importé peut avoir des sous-collections (versions, signalements, prive) : supprimées aussi.
  for (const d of docs) await db.recursiveDelete(d.ref);
  console.log(`Supprimés : ${docs.length} commentaires importés. Les autres commentaires n'ont pas été touchés.`);
  process.exit(0);
}

if (mode === 'ecrire') {
  const attendus = new Set(prep.documents.map((d) => d.id));
  const enTrop = (await dejaImportes()).filter((d) => !attendus.has(d.id));
  if (enTrop.length) console.log(`${enTrop.length} commentaires importés auparavant ne sont plus dans le classeur : lancez --purger puis --ecrire pour repartir de zéro.`);
  await parLots(prep.documents.map(({ id, donnees }) => (lot) => lot.set(db.collection('commentaires').doc(id),
    { ...donnees, import: { ...donnees.import, le: FieldValue.serverTimestamp() } })));
  console.log(`Écrits : ${prep.documents.length} commentaires. Vérifiez avec --verifier.`);
}

// ---------- Vérification : Firestore relu et comparé au classeur ----------
const lus = new Map((await dejaImportes()).map((d) => [d.id, d.data()]));
const ecarts = [];
for (const { id, donnees: a } of prep.documents) {
  const l = lus.get(id);
  if (!l) { ecarts.push(`${id} : absent de Firestore`); continue; }
  for (const champ of ['type', 'cle', 'auteurNom', 'auteurUid', 'texte']) {
    if (l[champ] !== a[champ]) ecarts.push(`${id} : ${champ} différent`);
  }
  if (l.creeLe?.toMillis() !== a.creeLe.getTime()) ecarts.push(`${id} : date différente`);
  lus.delete(id);
}
for (const id of lus.keys()) ecarts.push(`${id} : dans Firestore mais plus dans le classeur`);
console.log(ecarts.length ? `Vérification : ${ecarts.length} écarts\n${ecarts.join('\n')}` : `Vérification : les ${prep.documents.length} commentaires de Firestore sont identiques au classeur.`);
process.exit(ecarts.length ? 1 : 0);
