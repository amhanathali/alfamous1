// Règles des témoignages (docs/MODELE-DONNEES.md, docs/DROITS.md) : npm run test:regles
import { test, before, after, beforeEach } from 'node:test';
import { readFileSync } from 'node:fs';
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { lotAvecLimite } from './limite.mjs';
import {
  doc, getDoc, setDoc, updateDoc, deleteDoc, writeBatch, serverTimestamp, Timestamp, setLogLevel,
} from 'firebase/firestore';

setLogLevel('silent');

let env;
before(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-alfamous1',
    firestore: { rules: readFileSync('firestore.rules', 'utf8'), host: '127.0.0.1', port: 8085 },
  });
});
after(async () => { await env?.cleanup(); });
beforeEach(async () => { await env.clearFirestore(); });

const PROFILS = {
  membre: { uid: 'membre', name: 'Membre Essai', email_verified: true },
  autre: { uid: 'autre', name: 'Autre Membre', email_verified: true },
  nonVerifie: { uid: 'nv', name: 'Non Vérifié', email_verified: false },
  modo: { uid: 'modo', name: 'Modo Essai', email_verified: true, niveau: 2 },
  admin: { uid: 'admin', name: 'Admin Essai', email_verified: true, niveau: 3 },
};
const db = (p) => {
  if (!p) return env.unauthenticatedContext().firestore();
  const { uid, ...jeton } = PROFILS[p];
  return env.authenticatedContext(uid, jeton).firestore();
};
const semer = (chemin, data) => env.withSecurityRulesDisabled((c) => setDoc(doc(c.firestore(), chemin), data));

const TEXTE = 'Un témoignage d\'essai assez long pour passer la limite des quarante caractères.';
const T0 = Timestamp.fromDate(new Date('2026-11-01T12:00:00Z'));
const ident = (p, anonyme) => (anonyme ? { anonyme: true, auteurUid: null, auteurNom: '' }
  : { anonyme: false, auteurUid: PROFILS[p].uid, auteurNom: PROFILS[p].name });
const nouveau = (p, anonyme, extra = {}) => ({
  titre: 'Mon témoignage', texte: TEXTE, ...ident(p, anonyme),
  creeLe: serverTimestamp(), modifieLe: null, nbVersions: 1, masque: null, ...extra,
});
// Publication comme le client : témoignage + prive/auteur + limite de fréquence, en un lot.
function publier(p, id, data, prive = { auteurUid: PROFILS[p]?.uid, auteurNom: PROFILS[p]?.name }) {
  const d = db(p);
  return lotAvecLimite(d, p ? PROFILS[p].uid : null, (b) => {
    b.set(doc(d, `temoignages/${id}`), data);
    if (prive) b.set(doc(d, `temoignages/${id}/prive/auteur`), prive);
  });
}
// Témoignage existant (anonyme ou non) de « membre ».
async function existant(id = 't1', anonyme = true, extra = {}) {
  await semer(`temoignages/${id}`, { ...nouveau('membre', anonyme), creeLe: T0, ...extra });
  await semer(`temoignages/${id}/prive/auteur`, { auteurUid: 'membre', auteurNom: 'Membre Essai' });
}
function modifier(p, id, avant, changements) {
  const d = db(p);
  const b = writeBatch(d);
  b.set(doc(d, `temoignages/${id}/versions/${avant.nbVersions}`), { titre: avant.titre, texte: avant.texte, le: avant.modifieLe ?? avant.creeLe });
  b.update(doc(d, `temoignages/${id}`), { ...changements, modifieLe: serverTimestamp(), nbVersions: avant.nbVersions + 1 });
  return b.commit();
}
function masquer(p, id, avant) {
  const d = db(p);
  const b = writeBatch(d);
  b.set(doc(d, `temoignages/${id}/prive/texte`), { titre: avant.titre, texte: avant.texte });
  b.update(doc(d, `temoignages/${id}`), { titre: '', texte: '', masque: { par: PROFILS[p].uid, parNom: PROFILS[p].name, le: serverTimestamp() } });
  return b.commit();
}

// ---------- Lecture ----------
test('lecture publique du témoignage ; prive/auteur lu par l\'auteur et l\'admin seulement', async () => {
  await existant();
  await assertSucceeds(getDoc(doc(db(null), 'temoignages/t1')));
  await assertSucceeds(getDoc(doc(db('membre'), 'temoignages/t1/prive/auteur')));
  await assertSucceeds(getDoc(doc(db('admin'), 'temoignages/t1/prive/auteur')));
  for (const p of [null, 'autre', 'modo']) await assertFails(getDoc(doc(db(p), 'temoignages/t1/prive/auteur')));
});

// ---------- Publication ----------
test('membre vérifié : publie signé ou anonyme', async () => {
  await assertSucceeds(publier('membre', 'a', nouveau('membre', false)));
  await assertSucceeds(publier('membre', 'b', nouveau('membre', true)));
});

test('refus : visiteur, courriel non vérifié', async () => {
  await assertFails(publier(null, 'a', nouveau('membre', true), null));
  await assertFails(publier('nonVerifie', 'a', nouveau('nonVerifie', true)));
});

test('anonyme : ni compte ni nom dans le document public', async () => {
  await assertFails(publier('membre', 'a', nouveau('membre', true, { auteurNom: 'Membre Essai' })));
  await assertFails(publier('membre', 'b', nouveau('membre', true, { auteurUid: 'membre' })));
});

test('signé : seulement de son propre compte et de son propre nom', async () => {
  await assertFails(publier('membre', 'a', nouveau('membre', false, { auteurNom: 'Quelqu\'un d\'autre' })));
  await assertFails(publier('membre', 'b', nouveau('membre', false, { auteurUid: 'autre' })));
});

test('prive/auteur obligatoire et au nom de celui qui publie', async () => {
  await assertFails(publier('membre', 'a', nouveau('membre', true), null));
  await assertFails(publier('membre', 'b', nouveau('membre', true), { auteurUid: 'autre', auteurNom: 'Autre Membre' }));
});

test('contenu : titre requis, texte de 40 à 20 000 caractères, champs connus seulement', async () => {
  await assertFails(publier('membre', 'a', nouveau('membre', true, { titre: '' })));
  await assertFails(publier('membre', 'b', nouveau('membre', true, { texte: 'trop court' })));
  await assertFails(publier('membre', 'c', nouveau('membre', true, { texte: 'x'.repeat(20001) })));
  await assertFails(publier('membre', 'd', nouveau('membre', true, { courriel: 'a@b.c' })));
  await assertFails(publier('membre', 'e', nouveau('membre', true, { nbVersions: 3 })));
});

test('impossible de s\'attribuer un témoignage existant (prive/auteur ajouté après coup)', async () => {
  await semer('temoignages/imp', { ...nouveau('membre', true), creeLe: T0 });
  await assertFails(setDoc(doc(db('membre'), 'temoignages/imp/prive/auteur'), { auteurUid: 'membre', auteurNom: 'Membre Essai' }));
});

// ---------- Modification ----------
test('l\'auteur d\'un témoignage anonyme le modifie et peut retirer l\'anonymat (version gardée)', async () => {
  await existant('t1', true);
  const avant = (await getDoc(doc(db('admin'), 'temoignages/t1'))).data();
  await assertSucceeds(modifier('membre', 't1', avant, { texte: `${TEXTE} Modifié.`, ...ident('membre', false) }));
  const apres = (await getDoc(doc(db('admin'), 'temoignages/t1'))).data();
  await assertSucceeds(modifier('membre', 't1', apres, ident('membre', true)));
});

test('modification refusée : autre membre, sans version, nom d\'un autre', async () => {
  await existant('t1', true);
  const avant = (await getDoc(doc(db('admin'), 'temoignages/t1'))).data();
  await assertFails(modifier('autre', 't1', avant, { texte: `${TEXTE} !` }));
  await assertFails(updateDoc(doc(db('membre'), 'temoignages/t1'), { texte: `${TEXTE} !`, modifieLe: serverTimestamp(), nbVersions: 2 }));
  await assertFails(modifier('membre', 't1', avant, { anonyme: false, auteurUid: 'membre', auteurNom: 'Faux Nom' }));
  await assertFails(modifier('membre', 't1', avant, { creeLe: serverTimestamp() }));
});

test('témoignage importé sans compte : personne ne le modifie depuis le site', async () => {
  await semer('temoignages/imp', { ...nouveau('membre', true), creeLe: T0 });
  await semer('temoignages/imp/prive/auteur', { auteurUid: null, auteurNom: 'anonyme' });
  const avant = (await getDoc(doc(db('admin'), 'temoignages/imp'))).data();
  await assertFails(modifier('membre', 'imp', avant, { texte: `${TEXTE} !` }));
});

// ---------- Modération ----------
test('masquer (2+) puis démasquer ; un membre ne masque pas ; l\'auteur ne modifie plus un témoignage masqué', async () => {
  await existant('t1', false);
  const avant = (await getDoc(doc(db('admin'), 'temoignages/t1'))).data();
  await assertFails(masquer('autre', 't1', avant));
  await assertSucceeds(masquer('modo', 't1', avant));
  await assertFails(getDoc(doc(db('membre'), 'temoignages/t1/prive/texte')));
  await assertSucceeds(getDoc(doc(db('modo'), 'temoignages/t1/prive/texte')));
  const masque = (await getDoc(doc(db('admin'), 'temoignages/t1'))).data();
  await assertFails(modifier('membre', 't1', masque, { texte: `${TEXTE} !` }));
  const d = db('modo');
  const b = writeBatch(d);
  b.update(doc(d, 'temoignages/t1'), { titre: avant.titre, texte: avant.texte, masque: null });
  b.delete(doc(d, 'temoignages/t1/prive/texte'));
  await assertSucceeds(b.commit());
});

test('suppression : admin seulement (auteur et modérateur refusés)', async () => {
  await existant();
  await assertFails(deleteDoc(doc(db('membre'), 'temoignages/t1')));
  await assertFails(deleteDoc(doc(db('modo'), 'temoignages/t1')));
  const d = db('admin');
  const b = writeBatch(d);
  b.delete(doc(d, 'temoignages/t1/prive/auteur'));
  b.delete(doc(d, 'temoignages/t1'));
  await assertSucceeds(b.commit());
});
