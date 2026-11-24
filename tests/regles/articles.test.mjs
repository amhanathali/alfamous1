// Règles des articles (docs/ARTICLES.md, docs/MODELE-DONNEES.md) : npm run test:regles
import { test, before, after, beforeEach } from 'node:test';
import { readFileSync } from 'node:fs';
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { lotAvecLimite } from './limite.mjs';
import {
  doc, getDoc, getDocs, collection, query, where, setDoc, updateDoc, deleteDoc, writeBatch,
  serverTimestamp, Timestamp, setLogLevel,
} from 'firebase/firestore';
import { ref, uploadString, getBytes } from 'firebase/storage';

setLogLevel('silent');

let env;
before(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-alfamous1',
    firestore: { rules: readFileSync('firestore.rules', 'utf8'), host: '127.0.0.1', port: 8085 },
    storage: { rules: readFileSync('storage.rules', 'utf8'), host: '127.0.0.1', port: 9199 },
  });
});
after(async () => { await env?.cleanup(); });
beforeEach(async () => { await env.clearFirestore(); await env.clearStorage(); });

const PROFILS = {
  membre: { uid: 'membre', name: 'Membre Essai', email_verified: true },
  modo: { uid: 'modo', name: 'Modo Essai', email_verified: true, niveau: 2 },
  modo2: { uid: 'modo2', name: 'Autre Modo', email_verified: true, niveau: 2 },
  modoNonVerifie: { uid: 'modonv', name: 'Modo NV', email_verified: false, niveau: 2 },
  admin: { uid: 'admin', name: 'Admin Essai', email_verified: true, niveau: 3 },
};
const ctx = (p) => {
  if (!p) return env.unauthenticatedContext();
  const { uid, ...jeton } = PROFILS[p];
  return env.authenticatedContext(uid, jeton);
};
const db = (p) => ctx(p).firestore();
const st = (p) => ctx(p).storage();
const T0 = Timestamp.fromDate(new Date('2026-11-01T12:00:00Z'));
const semer = (chemin, data) => env.withSecurityRulesDisabled((c) => setDoc(doc(c.firestore(), chemin), data));
async function lire(chemin) {
  let d;
  await env.withSecurityRulesDisabled(async (c) => { d = (await getDoc(doc(c.firestore(), chemin))).data(); });
  return d;
}

const contenu = (extra = {}) => ({
  titre: 'Aberration 1 — 19.26', famille: 'racines', libelles: ['Les mots du Coran'], resume: 'Résumé',
  image: null, corps: '<p>Texte</p>', versets: ['19:26'], sourates: [19], racines: ['صوم'], lexique: [], sources: [],
  liens: [], ...extra,
});
// Article existant (semé sans règles).
const brouillon = (extra = {}) => ({
  ...contenu(), slug: null, statut: 'brouillon', auteurUid: 'modo', auteurNom: 'Modo Essai',
  creeLe: T0, modifieLe: T0, publieLe: null, republieLe: null, nbVersions: 0, ...extra,
});
const publie = (extra = {}) => brouillon({ statut: 'publie', slug: 'aberration-1-1926', publieLe: T0, nbVersions: 1, ...extra });
// Nouvel article (écrit par le client).
const nouveau = (p = 'modo', extra = {}) => ({
  ...contenu({ titre: '' }), slug: null, statut: 'brouillon', auteurUid: PROFILS[p].uid, auteurNom: PROFILS[p].name,
  creeLe: serverTimestamp(), modifieLe: serverTimestamp(), publieLe: null, republieLe: null, nbVersions: 0, ...extra,
});
const atelier = (p = 'modo', extra = {}) => ({
  titre: 'Brouillon', famille: 'racines', libelles: [], resume: '', image: null, corps: '<p>…</p>',
  contexte: { versets: [{ ref: '19:26', cite: true }] }, majLe: serverTimestamp(), majPar: PROFILS[p].uid, ...extra,
});
const version = (p, data, publiee) => ({
  titre: data.titre, corps: data.corps, resume: data.resume, famille: data.famille, libelles: data.libelles,
  le: serverTimestamp(), parUid: PROFILS[p].uid, parNom: PROFILS[p].name, publiee,
});

// Lots du client.
function lotPublier(p, id, avant, { slug = 'aberration-1-1926', nouveauContenu = contenu({ titre: 'Titre publié' }),
  avecSlug = true, avecVersion = true, versionPubliee = true } = {}) {
  const d = db(p); const b = writeBatch(d);
  const n = avant.nbVersions + 1;
  const premiere = avant.slug == null;
  b.update(doc(d, `articles/${id}`), {
    ...nouveauContenu, statut: 'publie', modifieLe: serverTimestamp(), nbVersions: n,
    ...(premiere ? { slug, publieLe: serverTimestamp() } : { republieLe: serverTimestamp() }),
  });
  if (avecVersion) b.set(doc(d, `articles/${id}/versions/${n}`), version(p, nouveauContenu, versionPubliee));
  if (premiere && avecSlug) b.set(doc(d, `slugs/${slug}`), { article: id });
  return b.commit();
}
function lotVersion(p, id, avant, n = avant.nbVersions + 1) {
  const d = db(p); const b = writeBatch(d);
  b.set(doc(d, `articles/${id}/versions/${n}`), version(p, contenu({ titre: 'Version de travail' }), false));
  b.update(doc(d, `articles/${id}`), avant.statut === 'brouillon'
    ? { nbVersions: avant.nbVersions + 1, modifieLe: serverTimestamp() }
    : { nbVersions: avant.nbVersions + 1 });
  return b.commit();
}

// ---------- Lecture ----------
test('Lecture : article publié lu par tous ; brouillon et retiré lus par les rédacteurs seulement', async () => {
  await semer('articles/pub', publie());
  await semer('articles/br', brouillon());
  await semer('articles/ret', publie({ statut: 'retire', slug: 'retire-1' }));
  for (const p of [null, 'membre', 'modo', 'admin']) await assertSucceeds(getDoc(doc(db(p), 'articles/pub')), String(p));
  for (const p of [null, 'membre', 'modoNonVerifie']) {
    await assertFails(getDoc(doc(db(p), 'articles/br')), `${p} : brouillon`);
    await assertFails(getDoc(doc(db(p), 'articles/ret')), `${p} : retiré`);
  }
  for (const p of ['modo', 'modo2', 'admin']) await assertSucceeds(getDoc(doc(db(p), 'articles/br')), `${p} : brouillon`);
});

test('Lecture : liste publique filtrée sur statut == publie ; liste complète réservée aux rédacteurs', async () => {
  await semer('articles/pub', publie());
  await semer('articles/br', brouillon());
  await assertSucceeds(getDocs(query(collection(db(null), 'articles'), where('statut', '==', 'publie'))));
  await assertFails(getDocs(collection(db(null), 'articles')));
  await assertFails(getDocs(collection(db('membre'), 'articles')));
  await assertSucceeds(getDocs(collection(db('modo2'), 'articles')));
});

// ---------- Création ----------
test('Créer : niveau ≥ 2 (courriel vérifié), brouillon signé de son nom, avec atelier/brouillon dans le lot', async () => {
  const lot = (p, data = nouveau(p), at = atelier(p)) => {
    const d = db(p); const b = writeBatch(d);
    b.set(doc(d, 'articles/a1'), data);
    b.set(doc(d, 'articles/a1/atelier/brouillon'), at);
    return b.commit();
  };
  await assertFails(lot('membre', nouveau('membre')), 'membre');
  await assertFails(lot('modoNonVerifie', nouveau('modoNonVerifie')), 'courriel non vérifié');
  await assertFails(lot('modo', nouveau('modo', { auteurUid: 'admin' })), 'autre auteur');
  await assertFails(lot('modo', nouveau('modo', { auteurNom: 'Quelqu\'un' })), 'autre nom');
  await assertFails(lot('modo', nouveau('modo', { statut: 'publie' })), 'publié d\'emblée');
  await assertFails(lot('modo', nouveau('modo', { slug: 'mon-article' })), 'adresse avant publication');
  await assertFails(lot('modo', nouveau('modo', { nbVersions: 1 })), 'compteur');
  await assertFails(lot('modo', nouveau('modo', { famille: 'divers' })), 'famille inconnue');
  await assertFails(lot('modo', nouveau('modo', { libelles: Array(11).fill('x') })), '11 libellés');
  await assertFails(lot('modo', { ...nouveau('modo'), import: { source: 'Blogger' } }), 'champ import réservé au script');
  await assertSucceeds(lot('modo'));
  await assertSucceeds(lot('admin', nouveau('admin'), atelier('admin')));
});

// Diagnostic (24 nov.) : le lot « article + atelier » échouait ; ces deux tests isolent chaque écriture.
test('Créer (diagnostic) : article seul, sans atelier', async () => {
  await assertSucceeds(setDoc(doc(db('modo'), 'articles/d1'), nouveau('modo')));
});
test('Créer (diagnostic) : article puis atelier, en deux requêtes', async () => {
  await assertSucceeds(setDoc(doc(db('modo'), 'articles/d2'), nouveau('modo')));
  await assertSucceeds(setDoc(doc(db('modo'), 'articles/d2/atelier/brouillon'), atelier('modo')));
});

// ---------- Atelier (version de travail) ----------
test('Atelier : lu par les rédacteurs ; écrit par l\'auteur de l\'article ou l\'admin', async () => {
  await semer('articles/a1', brouillon());
  await semer('articles/a1/atelier/brouillon', { ...atelier(), majLe: T0 });
  const ecrire = (p, extra = {}) => setDoc(doc(db(p), 'articles/a1/atelier/brouillon'), atelier(p, extra));
  for (const p of [null, 'membre']) await assertFails(getDoc(doc(db(p), 'articles/a1/atelier/brouillon')), `${p} : lecture`);
  await assertSucceeds(getDoc(doc(db('modo2'), 'articles/a1/atelier/brouillon')), 'autre modo : lecture');
  await assertFails(ecrire('modo2'), 'autre modo : écriture');
  await assertFails(ecrire('membre'), 'membre');
  await assertFails(ecrire('modo', { majPar: 'admin' }), 'majPar d\'un autre');
  await assertFails(ecrire('modo', { contexte: 'texte' }), 'contexte non objet');
  await assertFails(setDoc(doc(db('modo'), 'articles/a1/atelier/autre'), atelier('modo')), 'autre document');
  await assertSucceeds(ecrire('modo'));
  await assertSucceeds(ecrire('admin'));
});

test('Brouillon jamais publié : titre et contenu du document public modifiables par son auteur', async () => {
  await semer('articles/a1', brouillon());
  const maj = (p, extra = {}) => updateDoc(doc(db(p), 'articles/a1'), { titre: 'Nouveau titre', modifieLe: serverTimestamp(), ...extra });
  await assertFails(maj('modo2'), 'autre modo');
  await assertFails(maj('modo', { statut: 'publie' }), 'publication sans version ni adresse');
  await assertFails(maj('modo', { auteurUid: 'modo2' }), 'changer d\'auteur');
  await assertSucceeds(maj('modo'));
  await assertSucceeds(maj('admin'));
});

// ---------- Publication ----------
test('Première publication : version « publiée » et adresse réservées dans le même lot', async () => {
  await semer('articles/a1', brouillon());
  await assertFails(lotPublier('modo2', 'a1', brouillon()), 'autre modo');
  await assertFails(lotPublier('modo', 'a1', brouillon(), { avecSlug: false }), 'sans slugs/{slug}');
  await assertFails(lotPublier('modo', 'a1', brouillon(), { avecVersion: false }), 'sans version');
  await assertFails(lotPublier('modo', 'a1', brouillon(), { versionPubliee: false }), 'version non marquée publiée');
  await assertFails(lotPublier('modo', 'a1', brouillon(), { slug: 'Mauvais Slug' }), 'adresse invalide');
  await assertFails(lotPublier('modo', 'a1', brouillon(), { nouveauContenu: contenu({ titre: '' }) }), 'titre vide');
  await assertSucceeds(lotPublier('modo', 'a1', brouillon()));
  const a = await lire('articles/a1');
  if (a.statut !== 'publie' || a.slug !== 'aberration-1-1926' || a.nbVersions !== 1) throw new Error('article mal publié');
  if ((await lire('slugs/aberration-1-1926')).article !== 'a1') throw new Error('adresse non réservée');
});

test('Publication : une adresse déjà prise est refusée ; l\'admin publie l\'article d\'un autre', async () => {
  await semer('articles/a1', brouillon());
  await semer('articles/a2', brouillon({ auteurUid: 'modo2', auteurNom: 'Autre Modo' }));
  await semer('slugs/deja-pris', { article: 'a2' });
  await assertFails(lotPublier('modo', 'a1', brouillon(), { slug: 'deja-pris' }), 'adresse prise');
  await assertSucceeds(lotPublier('admin', 'a2', brouillon(), { slug: 'article-de-modo2' }));
});

test('Publier les modifications : nouvelle version publiée, adresse inchangée ; republier un article retiré', async () => {
  await semer('articles/a1', publie());
  await assertFails(updateDoc(doc(db('modo'), 'articles/a1'), { titre: 'En direct', modifieLe: serverTimestamp() }), 'modification en direct');
  await assertFails(updateDoc(doc(db('modo'), 'articles/a1'), { slug: 'autre-adresse' }), 'changer d\'adresse');
  await assertFails(lotPublier('modo', 'a1', publie(), { avecVersion: false }), 'sans version');
  await assertFails(lotPublier('modo2', 'a1', publie()), 'autre modo');
  await assertSucceeds(lotPublier('modo', 'a1', publie()));
  const a = await lire('articles/a1');
  if (a.nbVersions !== 2 || a.slug !== 'aberration-1-1926' || !a.republieLe) throw new Error('republication');
  await semer('articles/r1', publie({ statut: 'retire', slug: 'retire-1' }));
  await assertSucceeds(lotPublier('modo', 'r1', publie({ statut: 'retire', slug: 'retire-1' })), 'republier un article retiré');
});

test('Retirer : auteur ou admin ; l\'article n\'est plus lu par les visiteurs', async () => {
  await semer('articles/a1', publie());
  const retirer = (p) => updateDoc(doc(db(p), 'articles/a1'), { statut: 'retire', modifieLe: serverTimestamp() });
  await assertFails(retirer('modo2'), 'autre modo');
  await assertFails(retirer('membre'), 'membre');
  await assertSucceeds(retirer('modo'));
  await assertFails(getDoc(doc(db(null), 'articles/a1')), 'visiteur après retrait');
});

// ---------- Versions ----------
test('Versions : lues par les rédacteurs, ajoutées par l\'auteur avec le compteur, jamais modifiées', async () => {
  await semer('articles/a1', publie());
  await semer('articles/br', brouillon());
  await assertFails(lotVersion('modo', 'a1', publie(), 5), 'numéro faux');
  await assertFails(lotVersion('modo2', 'a1', publie()), 'autre modo');
  await assertSucceeds(lotVersion('modo', 'a1', publie()), 'version d\'un article publié');
  await assertSucceeds(lotVersion('modo', 'br', brouillon()), 'version d\'un brouillon');
  for (const p of [null, 'membre']) await assertFails(getDoc(doc(db(p), 'articles/a1/versions/2')), `${p} : lecture`);
  await assertSucceeds(getDoc(doc(db('modo2'), 'articles/a1/versions/2')));
  await assertFails(updateDoc(doc(db('modo'), 'articles/a1/versions/2'), { titre: 'retouché' }), 'modifier une version');
  await assertFails(deleteDoc(doc(db('modo'), 'articles/a1/versions/2')), 'supprimer une version (modo)');
});

test('Supprimer un article : admin seulement ; une adresse réservée n\'est jamais réattribuée', async () => {
  await semer('articles/a1', publie());
  await semer('slugs/aberration-1-1926', { article: 'a1' });
  await assertFails(deleteDoc(doc(db('modo'), 'articles/a1')), 'auteur');
  await assertFails(setDoc(doc(db('modo'), 'slugs/aberration-1-1926'), { article: 'a9' }), 'écraser une adresse');
  await assertSucceeds(deleteDoc(doc(db('admin'), 'articles/a1')));
  await assertSucceeds(getDoc(doc(db(null), 'slugs/aberration-1-1926')), 'adresses lisibles par tous');
});

// ---------- Commentaires et forum ----------
test('Commentaires : sur un article publié seulement (même modèle que les versets)', async () => {
  await semer('articles/pub', publie());
  await semer('articles/br', brouillon());
  const commenter = (cle, id) => {
    const d = db('membre');
    return lotAvecLimite(d, 'membre', (b) => b.set(doc(d, `commentaires/${id}`), {
      type: 'article', cle, auteurUid: 'membre', auteurNom: 'Membre Essai', texte: 'Merci',
      creeLe: serverTimestamp(), modifieLe: null, nbVersions: 1, masque: null,
    }));
  };
  await assertSucceeds(commenter('pub', 'c1'));
  await assertFails(commenter('br', 'c2'), 'brouillon');
  await assertFails(commenter('inexistant', 'c3'), 'article inexistant');
  await assertFails(commenter('mauvais/id', 'c4'), 'identifiant invalide');
});

test('Forum : un fil peut être lié à un article', async () => {
  const d = db('membre');
  await assertSucceeds(lotAvecLimite(d, 'membre', (b) => b.set(doc(d, 'notes/n1'), {
    auteurUid: 'membre', auteurNom: 'Membre Essai', titre: 'Discussion', texte: 'Sur cet article',
    lien: { type: 'article', cle: 'pub' }, publie: true, creeLe: serverTimestamp(), modifieLe: serverTimestamp(),
    publieLe: serverTimestamp(), activiteLe: serverTimestamp(), nbReponses: 0, nbReponsesAutrui: 0, nbVersions: 1, masque: null,
  })));
});

// ---------- Storage ----------
const IMG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
const envoyer = (p, chemin, type = 'image/png') => uploadString(ref(st(p), chemin), IMG, 'base64', { contentType: type });

test('Storage : images d\'un article lues par tous, envoyées par son auteur ou l\'admin (pas de SVG)', async () => {
  await semer('articles/a1', brouillon());
  await assertFails(envoyer('membre', 'articles/a1/images/x.png'), 'membre');
  await assertFails(envoyer('modo2', 'articles/a1/images/x.png'), 'autre modo');
  await assertFails(envoyer('modo', 'articles/a1/images/x.svg', 'image/svg+xml'), 'SVG');
  await assertFails(envoyer('modo', 'articles/a1/images/x.pdf', 'application/pdf'), 'pas une image');
  await assertFails(envoyer('modo', 'articles/inexistant/images/x.png'), 'article inexistant');
  await assertSucceeds(envoyer('modo', 'articles/a1/images/x.png'));
  await assertSucceeds(envoyer('admin', 'articles/a1/images/y.png'));
  await assertSucceeds(getBytes(ref(st(null), 'articles/a1/images/x.png')), 'lecture publique');
});

test('Storage : fichiers de travail réservés aux rédacteurs', async () => {
  await semer('articles/a1', brouillon());
  await assertFails(envoyer('modo2', 'articles/a1/fichiers/notes.pdf', 'application/pdf'), 'autre modo');
  await assertSucceeds(envoyer('modo', 'articles/a1/fichiers/notes.pdf', 'application/pdf'));
  for (const p of [null, 'membre']) await assertFails(getBytes(ref(st(p), 'articles/a1/fichiers/notes.pdf')), `${p} : lecture`);
  await assertSucceeds(getBytes(ref(st('modo2'), 'articles/a1/fichiers/notes.pdf')), 'autre modo : lecture');
  await assertFails(envoyer('modo', 'ailleurs/x.png'), 'hors des articles');
});
