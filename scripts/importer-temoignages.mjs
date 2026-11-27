#!/usr/bin/env node
// Import des témoignages de l'ancienne application Alfamous (projet alfamous-amha, collection temoignages).
//
// L'ancienne collection est lue publiquement (API REST de Firestore, sans clé) et JAMAIS modifiée.
// Copie locale (jamais dans Git, import/ est ignoré) : import/temoignages/anciens.json.
//
//   npm run importer:temoignages                                à blanc : télécharge si besoin, rapport, rien n'est écrit
//   npm run importer:temoignages -- --telecharger               retélécharge la copie locale
//   npm run importer:temoignages -- --ecrire                    émulateurs (demo-alfamous1)
//   npm run importer:temoignages -- --projet essai --ecrire     alfamous-essai ; puis --verifier
//   npm run importer:temoignages -- --projet essai --purger     supprime ce qui a été importé (et seulement cela)
//   --projet prod : alfamous-atelier, confirmation PROD demandée.
//   --forcer : réimporter aussi les témoignages modifiés ou masqués dans l'atelier depuis l'import.
//
// Pour un vrai projet : clé de compte de service HORS du dépôt :
//   set GOOGLE_APPLICATION_CREDENTIALS=C:\Users\gmpcd\cles\alfamous-essai.json
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createInterface } from 'node:readline/promises';
import { COURRIEL_AUTEUR } from './lib/import-articles.mjs';
import {
  lireRest, preparerTemoignages, texteRapportTemoignages, URL_ANCIENS, SOURCE_TEMOIGNAGES,
} from './lib/import-temoignages.mjs';

const RACINE = join(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const valeur = (nom) => { const i = args.indexOf(nom); return i >= 0 ? args[i + 1] : null; };
const alias = valeur('--projet');
const source = valeur('--source') || join(RACINE, 'import/temoignages');
const forcer = args.includes('--forcer');
const mode = args.includes('--purger') ? 'purger' : args.includes('--verifier') ? 'verifier' : args.includes('--ecrire') ? 'ecrire' : 'a-blanc';
const arreter = (msg) => { console.error(msg); process.exit(1); };

process.exitCode = await main();

async function main() {

  // ---------- Copie locale de l'ancienne collection ----------
  mkdirSync(source, { recursive: true });
  const cheminCopie = join(source, 'anciens.json');
  if (args.includes('--telecharger') || !existsSync(cheminCopie)) {
    console.log('Lecture publique de l\'ancienne collection (alfamous-amha/temoignages)…');
    const pages = [];
    let jeton = '';
    do {
      const r = await fetch(`${URL_ANCIENS}?pageSize=300${jeton ? `&pageToken=${encodeURIComponent(jeton)}` : ''}`);
      if (!r.ok) arreter(`Lecture impossible : HTTP ${r.status} ${await r.text()}`);
      const page = await r.json();
      pages.push(page);
      jeton = page.nextPageToken || '';
    } while (jeton);
    writeFileSync(cheminCopie, JSON.stringify(pages, null, 1));
    console.log(`Copie locale : ${cheminCopie}`);
  }
  const anciens = lireRest(JSON.parse(readFileSync(cheminCopie, 'utf8')));

  // ---------- Firebase (sauf à blanc) ----------
  let db = null; let auth = null; let FieldValue = null; let Timestamp = null; let projectId = 'demo-alfamous1';
  if (mode !== 'a-blanc') {
    const { initializeApp, applicationDefault } = await import('firebase-admin/app');
    const fs = await import('firebase-admin/firestore');
    const { getAuth } = await import('firebase-admin/auth');
    ({ FieldValue, Timestamp } = fs);
    let app;
    if (!alias) {
      process.env.FIRESTORE_EMULATOR_HOST ||= '127.0.0.1:8085';
      process.env.FIREBASE_AUTH_EMULATOR_HOST ||= '127.0.0.1:9099';
      app = initializeApp({ projectId });
      console.log('Cible : émulateurs (demo-alfamous1).');
    } else {
      const projets = JSON.parse(readFileSync(join(RACINE, '.firebaserc'), 'utf8')).projects;
      projectId = projets[alias];
      if (!projectId || alias === 'default') arreter(`Projet inconnu : ${alias} (essai ou prod).`);
      if (projectId === 'alfamous-amha') arreter('L\'ancienne application n\'est jamais une cible.');
      if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) arreter('Indiquez la clé de service : set GOOGLE_APPLICATION_CREDENTIALS=C:\\chemin\\hors\\depot\\cle.json');
      app = initializeApp({ credential: applicationDefault(), projectId });
      console.log(`Cible : ${projectId}.`);
    }
    db = fs.getFirestore(app);
    auth = getAuth(app);
  }

  // Compte de l'auteur (sur les émulateurs : admin@essai.local, pour pouvoir modifier ses témoignages importés).
  let uidAuteur = null;
  if (auth) {
    for (const courriel of [COURRIEL_AUTEUR, ...(alias ? [] : ['admin@essai.local'])]) {
      try { uidAuteur = (await auth.getUserByEmail(courriel)).uid; console.log(`Témoignages signés de l'auteur reliés au compte ${courriel}.`); break; } catch { /* suivant */ }
    }
  }

  if (alias === 'prod' && (mode === 'ecrire' || mode === 'purger')) {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    const r = await rl.question(`PRODUCTION (alfamous-atelier) : ${mode === 'ecrire' ? 'écrire les témoignages de l\'ancienne application' : 'supprimer les témoignages importés'} ? Tapez PROD : `);
    rl.close();
    if (r.trim() !== 'PROD') arreter('Annulé.');
  }

  // ---------- Préparation ----------
  const prep = preparerTemoignages(anciens, { uidAuteur });
  const cheminRapport = join(source, 'rapport-import.txt');
  writeFileSync(cheminRapport, texteRapportTemoignages(prep, { cible: mode === 'a-blanc' ? 'à blanc' : `${mode} sur ${projectId}` }));
  console.log(`Préparé : ${prep.temoignages.length} témoignages (${prep.temoignages.filter((t) => t.public.anonyme).length} anonymes) ; écartés ${prep.ecartes.length} ; anomalies ${prep.anomalies.length}.`);
  console.log(`Détail : ${cheminRapport}`);
  if (mode === 'a-blanc') return 0;

  const importes = async () => (await db.collection('temoignages').where('import.source', '==', SOURCE_TEMOIGNAGES).get()).docs;

  if (mode === 'purger') {
    const docs = await importes();
    for (const d of docs) await db.recursiveDelete(d.ref);
    console.log(`Supprimés : ${docs.length} témoignages importés. Le reste n'a pas été touché.`);
    return 0;
  }

  if (mode === 'ecrire') {
    const ts = FieldValue.serverTimestamp();
    const lot = db.batch();
    let ecrits = 0; let ignores = 0;
    for (const t of prep.temoignages) {
      const ref = db.doc(`temoignages/${t.id}`);
      const avant = await ref.get();
      // Modifié par son auteur ou masqué par un modérateur depuis l'import : laissé tel quel, sauf --forcer.
      if (avant.exists && !forcer && (avant.data().nbVersions > 1 || avant.data().masque)) { ignores += 1; continue; }
      if (avant.exists) await db.recursiveDelete(ref);
      lot.set(ref, {
        ...t.public,
        creeLe: Timestamp.fromDate(t.public.creeLe),
        import: { ...t.import, publieLe: t.import.publieLe ? Timestamp.fromDate(t.import.publieLe) : null, le: ts },
      });
      lot.set(db.doc(`temoignages/${t.id}/prive/auteur`), t.prive);
      ecrits += 1;
    }
    await lot.commit();
    console.log(`Écrits : ${ecrits} témoignages${ignores ? ` (${ignores} laissés tels quels : modifiés ou masqués depuis l'import ; --forcer pour les remplacer)` : ''}.`);
  }

  // ---------- Vérification ----------
  const lus = new Map((await importes()).map((d) => [d.id, d.data()]));
  const ecarts = [];
  for (const t of prep.temoignages) {
    const l = lus.get(t.id);
    if (!l) { ecarts.push(`${t.id} : absent`); continue; }
    if (l.nbVersions === 1 && !l.masque) {
      for (const champ of ['titre', 'texte', 'anonyme', 'auteurNom']) if (l[champ] !== t.public[champ]) ecarts.push(`${t.id} : ${champ} différent`);
    }
    if (l.anonyme && (l.auteurUid || l.auteurNom)) ecarts.push(`${t.id} : anonyme mais porte un nom ou un compte`);
    if (/@/.test(JSON.stringify(l))) ecarts.push(`${t.id} : une adresse courriel figure dans le document public`);
    if (!(await db.doc(`temoignages/${t.id}/prive/auteur`).get()).exists) ecarts.push(`${t.id} : prive/auteur absent`);
    lus.delete(t.id);
  }
  for (const id of lus.keys()) ecarts.push(`${id} : importé auparavant, absent de l'ancienne collection`);
  console.log(ecarts.length ? `Vérification : ${ecarts.length} écarts\n${ecarts.join('\n')}` : `Vérification : ${prep.temoignages.length} témoignages conformes à l'ancienne collection.`);
  return ecarts.length ? 1 : 0;
}
