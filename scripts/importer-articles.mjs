#!/usr/bin/env node
// Étape 5 : import des articles et commentaires du blog Blogger « Zoom-Coran » (docs/ARTICLES.md § 6).
//
// Source (jamais dans Git) : import/articles/feed.atom (sauvegarde Google Takeout du blog) et
// import/articles/controle-familles.csv (familles : colonne famille_choisie, sinon famille_proposee).
//
//   npm run importer:articles                                  à blanc : rapport et fiche, rien n'est écrit
//   npm run importer:articles -- --ecrire                      émulateurs (demo-alfamous1)
//   npm run importer:articles -- --projet essai --ecrire       alfamous-essai ; puis --verifier
//   npm run importer:articles -- --projet essai --purger       supprime ce qui a été importé (et seulement cela)
//   --projet prod : alfamous-atelier, confirmation PROD demandée.
//   --forcer : réimporter aussi les articles modifiés dans l'atelier depuis l'import (sinon ils sont laissés tels quels).
//   --source <dossier> (défaut import/articles) ; --bucket <nom> (défaut <projet>.firebasestorage.app).
//
// Pour un vrai projet : clé de compte de service HORS du dépôt :
//   set GOOGLE_APPLICATION_CREDENTIALS=C:\Users\gmpcd\cles\alfamous-essai.json
// Les images du blog sont téléchargées (blogger.googleusercontent.com) et copiées dans Storage
// (articles/<id>/images/) ; une image introuvable garde son adresse Blogger et figure dans le rapport.
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash, randomUUID } from 'node:crypto';
import { createInterface } from 'node:readline/promises';
import { JSDOM } from 'jsdom';
import createDOMPurify from 'dompurify';
import { lireCsv } from './lib/csv.mjs';
import { creerAssainisseur } from '../src/js/articles-assainir.js';
import {
  lireFlux, famillesDepuisFiche, preparerImport, texteRapport, csvControle, SOURCE, AUTEUR, COURRIEL_AUTEUR, ID_FIL_PAGE,
} from './lib/import-articles.mjs';

const RACINE = join(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const valeur = (nom) => { const i = args.indexOf(nom); return i >= 0 ? args[i + 1] : null; };
const alias = valeur('--projet');
const source = valeur('--source') || join(RACINE, 'import/articles');
const forcer = args.includes('--forcer');
const mode = args.includes('--purger') ? 'purger' : args.includes('--verifier') ? 'verifier' : args.includes('--ecrire') ? 'ecrire' : 'a-blanc';
const arreter = (msg) => { console.error(msg); process.exit(1); };

// ---------- Lecture de la sauvegarde ----------
const cheminFlux = join(source, 'feed.atom');
if (!existsSync(cheminFlux)) arreter(`Introuvable : ${cheminFlux}\nDéposez Takeout\\Blogger\\Blogs\\Zoom-Coran\\feed.atom dans ${source}.`);
const { window } = new JSDOM('');
const assainir = creerAssainisseur(createDOMPurify(window));
const entrees = lireFlux(readFileSync(cheminFlux, 'utf8'), window.DOMParser);
const cheminFiche = join(source, 'controle-familles.csv');
const familles = existsSync(cheminFiche) ? famillesDepuisFiche(lireCsv(readFileSync(cheminFiche, 'utf8'), ';')) : new Map();
if (!familles.size) console.log(`Attention : fiche des familles absente (${cheminFiche}) : tous les articles iront en « Autres réflexions ».`);
const sourates = JSON.parse(readFileSync(join(RACINE, 'donnees/sourates.json'), 'utf8'));

// ---------- Firebase (sauf à blanc) ----------
let db = null; let auth = null; let bucket = null; let FieldValue = null; let projectId = 'demo-alfamous1';
if (mode !== 'a-blanc') {
  const { initializeApp, applicationDefault } = await import('firebase-admin/app');
  const fs = await import('firebase-admin/firestore');
  const { getAuth } = await import('firebase-admin/auth');
  const { getStorage } = await import('firebase-admin/storage');
  FieldValue = fs.FieldValue;
  let app;
  if (!alias) {
    process.env.FIRESTORE_EMULATOR_HOST ||= '127.0.0.1:8085';
    process.env.FIREBASE_AUTH_EMULATOR_HOST ||= '127.0.0.1:9099';
    process.env.FIREBASE_STORAGE_EMULATOR_HOST ||= '127.0.0.1:9199';
    app = initializeApp({ projectId, storageBucket: valeur('--bucket') || 'demo-alfamous1.appspot.com' });
    console.log('Cible : émulateurs (demo-alfamous1).');
  } else {
    const projets = JSON.parse(readFileSync(join(RACINE, '.firebaserc'), 'utf8')).projects;
    projectId = projets[alias];
    if (!projectId || alias === 'default') arreter(`Projet inconnu : ${alias} (essai ou prod).`);
    if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) arreter('Indiquez la clé de service : set GOOGLE_APPLICATION_CREDENTIALS=C:\\chemin\\hors\\depot\\cle.json');
    app = initializeApp({ credential: applicationDefault(), projectId, storageBucket: valeur('--bucket') || `${projectId}.firebasestorage.app` });
    console.log(`Cible : ${projectId}.`);
  }
  db = fs.getFirestore(app);
  auth = getAuth(app);
  bucket = getStorage(app).bucket();
}

// Compte de l'auteur (sur les émulateurs : admin@essai.local, pour pouvoir modifier les articles importés).
let uidAuteur = null;
if (auth) {
  for (const courriel of [COURRIEL_AUTEUR, ...(alias ? [] : ['admin@essai.local'])]) {
    try { uidAuteur = (await auth.getUserByEmail(courriel)).uid; console.log(`Articles reliés au compte ${courriel}.`); break; } catch { /* suivant */ }
  }
  if (!uidAuteur) console.log(`Attention : aucun compte ${COURRIEL_AUTEUR} : articles et commentaires d'${AUTEUR} reliés à aucun compte (non modifiables depuis le site).`);
}

if (alias === 'prod' && mode !== 'verifier' && mode !== 'a-blanc') {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const r = await rl.question(`PRODUCTION (alfamous-atelier) : ${mode === 'ecrire' ? 'écrire les articles et commentaires de Blogger' : 'supprimer tout ce qui a été importé de Blogger'} ? Tapez PROD : `);
  rl.close();
  if (r.trim() !== 'PROD') arreter('Annulé.');
}

// ---------- Images : Blogger → Storage ----------
const emulateurs = !alias;
const adresseStorage = (chemin, jeton) => `${emulateurs ? '' : 'https://firebasestorage.googleapis.com'}/v0/b/${bucket.name}/o/${encodeURIComponent(chemin)}?alt=media&token=${jeton}`;
async function copierImages(articles) {
  const remplacements = new Map(); const echecs = [];
  const total = articles.reduce((n, a) => n + a.images.length, 0);
  let fait = 0;
  for (const a of articles) {
    for (const im of a.images) {
      fait += 1;
      const empreinte = createHash('sha1').update(im.url).digest('hex').slice(0, 16);
      try {
        const reponse = await fetch(im.url);
        if (!reponse.ok) throw new Error(`HTTP ${reponse.status}`);
        const type = (reponse.headers.get('content-type') || 'image/jpeg').split(';')[0];
        if (!/^image\/(png|jpeg|gif|webp)$/.test(type)) throw new Error(`type ${type} refusé`);
        const ext = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/gif': 'gif', 'image/webp': 'webp' }[type];
        const chemin = `articles/${a.id}/images/blogger-${empreinte}.${ext}`;
        const fichier = bucket.file(chemin);
        let jeton;
        const [existe] = await fichier.exists();
        if (existe) jeton = (await fichier.getMetadata())[0].metadata?.firebaseStorageDownloadTokens;
        if (!jeton) {
          jeton = randomUUID();
          await fichier.save(Buffer.from(await reponse.arrayBuffer()), { contentType: type, metadata: { metadata: { firebaseStorageDownloadTokens: jeton, source: im.url } } });
        }
        remplacements.set(im.src, adresseStorage(chemin, jeton.split(',')[0]));
      } catch (e) { echecs.push(`Image non copiée (${a.titre}) : ${im.url} — ${e.message}`); }
      if (fait % 25 === 0) console.log(`  images : ${fait} / ${total}`);
    }
  }
  return { remplacements, echecs };
}

// ---------- Préparation ----------
let prep = preparerImport(entrees, { familles, assainir, sourates, uidAuteur });
let echecsImages = [];
if (mode === 'ecrire') {
  console.log(`Copie des images dans Storage (${bucket.name})…`);
  const r = await copierImages(prep.articles);
  echecsImages = r.echecs;
  prep = preparerImport(entrees, { familles, assainir, sourates, uidAuteur, remplacements: r.remplacements });
  prep.anomalies.push(...echecsImages);
}
mkdirSync(source, { recursive: true });
writeFileSync(join(source, 'rapport-import.txt'), texteRapport(prep, { cible: mode === 'a-blanc' ? 'à blanc' : `${mode} sur ${projectId}` }));
writeFileSync(join(source, 'controle-import.csv'), csvControle(prep.articles));
const nbPub = prep.articles.filter((a) => a.statut === 'publie').length;
console.log(`Préparé : ${prep.articles.length} articles (${nbPub} publiés), ${prep.commentaires.length} commentaires + ${prep.filPage.length} dans le fil de la page ; écartés ${prep.ecartes.length} ; anomalies ${prep.anomalies.length}.`);
console.log(`Détail : ${join(source, 'rapport-import.txt')} ; fiche : ${join(source, 'controle-import.csv')}`);
if (mode === 'a-blanc') process.exit(0);

// ---------- Écriture ----------
async function importes(collection) {
  return (await db.collection(collection).where('import.source', '==', SOURCE).get()).docs;
}
async function parLots(operations) {
  for (let i = 0; i < operations.length; i += 300) {
    const lot = db.batch();
    operations.slice(i, i + 300).forEach((op) => op(lot));
    await lot.commit();
  }
}

if (mode === 'purger') {
  const articles = await importes('articles');
  for (const d of articles) {
    const slug = d.data().slug;
    if (slug) { const s = await db.doc(`slugs/${slug}`).get(); if (s.exists && s.data().article === d.id) await s.ref.delete(); }
    await db.recursiveDelete(d.ref);
    await bucket.deleteFiles({ prefix: `articles/${d.id}/images/blogger-` }).catch(() => {});
  }
  const coms = await importes('commentaires');
  for (const d of coms) await db.recursiveDelete(d.ref);
  const fil = db.doc(`notes/${ID_FIL_PAGE}`);
  if ((await fil.get()).exists) await db.recursiveDelete(fil);
  console.log(`Supprimés : ${articles.length} articles, ${coms.length} commentaires, le fil de la page. Le reste n'a pas été touché.`);
  process.exit(0);
}

if (mode === 'ecrire') {
  const ts = FieldValue.serverTimestamp();
  let ignores = 0; let ecrits = 0;
  const operations = [];
  for (const a of prep.articles) {
    const ref = db.doc(`articles/${a.id}`);
    const avant = await ref.get();
    // Modifié dans l'atelier depuis l'import (version ou brouillon enregistré) : laissé tel quel, sauf --forcer.
    if (avant.exists && !forcer) {
      const atelier = await db.doc(`articles/${a.id}/atelier/brouillon`).get();
      const importLe = avant.data().import?.le?.toMillis?.() ?? 0;
      const majLe = atelier.data()?.majLe?.toMillis?.() ?? 0;
      if ((avant.data().nbVersions ?? 0) > (a.statut === 'publie' ? 1 : 0) || majLe > importLe + 60000) { ignores += 1; continue; }
    }
    let slug = a.slug;
    if (slug) {
      // Adresse déjà réservée par un autre article : suffixe -2, -3…
      for (let n = 2; ; n += 1) {
        const s = await db.doc(`slugs/${slug}`).get();
        if (!s.exists || s.data().article === a.id) break;
        slug = `${a.slug.slice(0, 95)}-${n}`;
        if (n === 2) prep.anomalies.push(`Adresse ${a.slug} déjà prise : ${a.id} reçoit ${slug}`);
      }
    }
    const publie = a.statut === 'publie';
    const pub = {
      titre: a.titre, slug: publie ? slug : null, famille: a.famille, libelles: a.libelles, resume: a.resume, image: a.image, corps: a.corps,
      statut: a.statut, auteurUid: a.auteurUid, auteurNom: a.auteurNom, creeLe: a.creeLe, modifieLe: a.modifieLe,
      publieLe: a.publieLe, republieLe: null, versets: a.versets, sourates: a.sourates, racines: [], lexique: [], sources: [], liens: [],
      nbVersions: publie ? 1 : 0, import: { ...a.import, le: ts },
    };
    const atelier = {
      titre: a.titre, famille: a.famille, libelles: a.libelles, resume: a.resume, image: a.image, corps: a.corps,
      contexte: { versets: a.versets.map((ref2) => ({ ref: ref2, cite: true, note: 'repéré à l\'import' })), sources: [], fichiers: [] },
      majLe: a.modifieLe, majPar: a.auteurUid || 'import',
    };
    operations.push((lot) => lot.set(ref, pub));
    operations.push((lot) => lot.set(db.doc(`articles/${a.id}/atelier/brouillon`), atelier));
    if (publie) {
      operations.push((lot) => lot.set(db.doc(`articles/${a.id}/versions/1`), {
        titre: a.titre, corps: a.corps, resume: a.resume, famille: a.famille, libelles: a.libelles,
        le: a.publieLe, parUid: a.auteurUid || 'import', parNom: AUTEUR, publiee: true,
      }));
      operations.push((lot) => lot.set(db.doc(`slugs/${slug}`), { article: a.id }));
    }
    ecrits += 1;
  }
  for (const c of prep.commentaires) {
    operations.push((lot) => lot.set(db.doc(`commentaires/${c.id}`), {
      type: 'article', cle: c.cle, auteurUid: c.auteurUid, auteurNom: c.auteurNom, texte: c.texte, creeLe: c.creeLe,
      modifieLe: null, nbVersions: 1, masque: null,
      import: { source: SOURCE, bloggerId: c.bloggerId, enReponseA: c.enReponseA, le: ts },
    }));
  }
  // Fil du forum pour les commentaires de la page brouillon « Zoom-Coran ».
  if (prep.filPage.length) {
    const premier = prep.filPage[0].creeLe; const dernier = prep.filPage[prep.filPage.length - 1].creeLe;
    const fil = db.doc(`notes/${ID_FIL_PAGE}`);
    await db.recursiveDelete(fil);
    operations.push((lot) => lot.set(fil, {
      auteurUid: uidAuteur, auteurNom: AUTEUR, titre: 'Commentaires de l\'ancienne page Zoom-Coran',
      texte: `Commentaires laissés sur la page « Zoom-Coran » du blog Blogger (${prep.filPage.length}), repris ici lors de l'import du ${new Date().toLocaleDateString('fr-CA')}.`,
      lien: null, publie: true, creeLe: premier, modifieLe: premier, publieLe: premier, activiteLe: dernier,
      nbReponses: prep.filPage.length, nbReponsesAutrui: prep.filPage.filter((c) => c.auteurNom !== AUTEUR).length, nbVersions: 1, masque: null,
      import: { source: SOURCE, le: ts },
    }));
    prep.filPage.forEach((c, i) => operations.push((lot) => lot.set(db.doc(`notes/${ID_FIL_PAGE}/reponses/${i + 1}`), {
      auteurUid: c.auteurUid, auteurNom: c.auteurNom, texte: c.texte, creeLe: c.creeLe, modifieLe: null, nbVersions: 1, masque: null,
    })));
  }
  await parLots(operations);
  console.log(`Écrits : ${ecrits} articles${ignores ? ` (${ignores} laissés tels quels : modifiés dans l'atelier depuis l'import ; --forcer pour les remplacer)` : ''}, ${prep.commentaires.length} commentaires, fil de la page (${prep.filPage.length} réponses).`);
  if (echecsImages.length) console.log(`${echecsImages.length} images non copiées : voir le rapport.`);
  writeFileSync(join(source, 'rapport-import.txt'), texteRapport(prep, { cible: `écriture sur ${projectId}` }));
}

// ---------- Vérification ----------
const lus = new Map((await importes('articles')).map((d) => [d.id, d.data()]));
const ecarts = [];
for (const a of prep.articles) {
  const l = lus.get(a.id);
  if (!l) { ecarts.push(`${a.id} : absent`); continue; }
  for (const champ of ['titre', 'statut', 'famille']) if (l[champ] !== a[champ]) ecarts.push(`${a.id} : ${champ} différent (${l[champ]} / ${a[champ]})`);
  if (/<style|<script/i.test(l.corps)) ecarts.push(`${a.id} : <style> ou <script> présent`);
  if (/blogger\.googleusercontent\.com|bp\.blogspot\.com/.test(l.corps)) ecarts.push(`${a.id} : image encore hébergée par Blogger`);
  if (l.statut === 'publie') {
    const s = await db.doc(`slugs/${l.slug}`).get();
    if (!s.exists || s.data().article !== a.id) ecarts.push(`${a.id} : adresse ${l.slug} non réservée`);
  }
  lus.delete(a.id);
}
for (const id of lus.keys()) ecarts.push(`${id} : importé auparavant, absent de la sauvegarde`);
const nbComs = (await importes('commentaires')).length;
if (nbComs !== prep.commentaires.length) ecarts.push(`commentaires : ${nbComs} dans Firestore, ${prep.commentaires.length} attendus`);
console.log(ecarts.length ? `Vérification : ${ecarts.length} écarts\n${ecarts.join('\n')}` : `Vérification : ${prep.articles.length} articles et ${nbComs} commentaires conformes à la sauvegarde.`);
process.exit(ecarts.length ? 1 : 0);
