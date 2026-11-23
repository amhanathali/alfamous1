// Règles des commentaires Alfamous (docs/DROITS.md, docs/MODELE-DONNEES.md) : npm run test:regles
import { test, before, after, beforeEach } from 'node:test';
import { readFileSync } from 'node:fs';
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import {
  doc, getDoc, getDocs, collection, setDoc, updateDoc, deleteDoc, writeBatch, serverTimestamp, Timestamp,
} from 'firebase/firestore';

let env;
before(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-alfamous1',
    firestore: { rules: readFileSync('firestore.rules', 'utf8'), host: '127.0.0.1', port: 8085 },
  });
});
after(async () => { await env?.cleanup(); });
beforeEach(async () => { await env.clearFirestore(); });

// ---------- Profils ----------
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

// ---------- Données ----------
const T0 = Timestamp.fromDate(new Date('2026-11-01T12:00:00Z'));
const existant = (extra = {}) => ({
  type: 'verset', cle: '112:1', auteurUid: 'membre', auteurNom: 'Membre Essai', texte: 'Texte d\'essai',
  creeLe: T0, modifieLe: null, nbVersions: 1, masque: null, ...extra,
});
const semer = (chemin, data) => env.withSecurityRulesDisabled((c) => setDoc(doc(c.firestore(), chemin), data));
const nouveau = (extra = {}) => ({
  type: 'verset', cle: '112:1', auteurUid: 'membre', auteurNom: 'Membre Essai', texte: 'Nouveau commentaire',
  creeLe: serverTimestamp(), modifieLe: null, nbVersions: 1, masque: null, ...extra,
});

// Lots utilisés par l'application (mêmes écritures que le client).
function lotModifier(d, id, ancien, texte) {
  const b = writeBatch(d);
  b.set(doc(d, `commentaires/${id}/versions/${ancien.nbVersions}`), { texte: ancien.texte, le: ancien.modifieLe ?? ancien.creeLe });
  b.update(doc(d, `commentaires/${id}`), { texte, modifieLe: serverTimestamp(), nbVersions: ancien.nbVersions + 1 });
  return b.commit();
}
function lotMasquer(d, id, texte, p = 'modo') {
  const b = writeBatch(d);
  b.set(doc(d, `commentaires/${id}/prive/texte`), { texte });
  b.update(doc(d, `commentaires/${id}`), {
    texte: '', masque: { par: PROFILS[p].uid, parNom: PROFILS[p].name, le: serverTimestamp() },
  });
  return b.commit();
}
function lotDemasquer(d, id, texte) {
  const b = writeBatch(d);
  b.delete(doc(d, `commentaires/${id}/prive/texte`));
  b.update(doc(d, `commentaires/${id}`), { texte, masque: null });
  return b.commit();
}

// ---------- Lecture ----------
test('lecture publique des commentaires (visiteur compris)', async () => {
  await semer('commentaires/c1', existant());
  await assertSucceeds(getDoc(doc(db(), 'commentaires/c1')));
  await assertSucceeds(getDocs(collection(db(), 'commentaires')));
});

// ---------- Écriture ----------
test('niveau 1 écrit un commentaire valide (verset et lexique)', async () => {
  await assertSucceeds(setDoc(doc(db('membre'), 'commentaires/n1'), nouveau()));
  await assertSucceeds(setDoc(doc(db('membre'), 'commentaires/n2'), nouveau({ type: 'lexique', cle: 'صمد' })));
});

test('visiteur et courriel non vérifié ne peuvent pas écrire', async () => {
  await assertFails(setDoc(doc(db(), 'commentaires/n1'), nouveau()));
  await assertFails(setDoc(doc(db('nonVerifie'), 'commentaires/n1'), nouveau({ auteurUid: 'nv', auteurNom: 'Non Vérifié' })));
});

test('commentaire refusé s\'il est mal formé', async () => {
  const d = db('membre');
  const cas = {
    'signé d\'un autre nom': nouveau({ auteurNom: 'Amha Nathali' }),
    'au nom d\'un autre compte': nouveau({ auteurUid: 'autre' }),
    'texte vide': nouveau({ texte: '' }),
    'texte de 4 001 caractères': nouveau({ texte: 'x'.repeat(4001) }),
    'référence de verset invalide': nouveau({ cle: '2-255' }),
    'type inconnu': nouveau({ type: 'forum' }),
    'date fournie par le client': nouveau({ creeLe: T0 }),
    'déjà masqué': nouveau({ masque: { par: 'membre' } }),
    'plusieurs versions': nouveau({ nbVersions: 2 }),
    'champ en trop': nouveau({ niveau: 3 }),
  };
  for (const [nom, data] of Object.entries(cas)) {
    await assertFails(setDoc(doc(d, `commentaires/${nom.length}`), data), nom);
  }
  await assertSucceeds(setDoc(doc(d, 'commentaires/limite'), nouveau({ texte: 'x'.repeat(4000) })));
});

// ---------- Modification ----------
test('l\'auteur modifie son commentaire ; l\'ancienne version est gardée', async () => {
  await semer('commentaires/c1', existant());
  await assertSucceeds(lotModifier(db('membre'), 'c1', existant(), 'Version 2'));
  await assertSucceeds(getDoc(doc(db(), 'commentaires/c1/versions/1')));
  const apres = (await env.withSecurityRulesDisabled((c) => getDoc(doc(c.firestore(), 'commentaires/c1')))).data();
  await assertSucceeds(lotModifier(db('membre'), 'c1', apres, 'Version 3'));
});

test('modification refusée sans version, par un autre, ou en réécrivant l\'historique', async () => {
  await semer('commentaires/c1', existant());
  await assertFails(updateDoc(doc(db('membre'), 'commentaires/c1'),
    { texte: 'Sans version', modifieLe: serverTimestamp(), nbVersions: 2 }));
  await assertFails(lotModifier(db('autre'), 'c1', existant(), 'Pas à moi'));
  await assertFails(lotModifier(db('modo'), 'c1', existant(), 'Pas à moi non plus'));
  // Version falsifiée (texte différent de l'original).
  const d = db('membre');
  const b = writeBatch(d);
  b.set(doc(d, 'commentaires/c1/versions/1'), { texte: 'Faux original', le: T0 });
  b.update(doc(d, 'commentaires/c1'), { texte: 'V2', modifieLe: serverTimestamp(), nbVersions: 2 });
  await assertFails(b.commit());
  // Changer la cible ou l'auteur.
  await assertFails(updateDoc(doc(d, 'commentaires/c1'), { cle: '1:1' }));
});

test('l\'auteur ne supprime pas son commentaire publié', async () => {
  await semer('commentaires/c1', existant());
  await assertFails(deleteDoc(doc(db('membre'), 'commentaires/c1')));
});

// ---------- Masquage ----------
test('le modérateur masque puis démasque ; le texte masqué reste privé', async () => {
  await semer('commentaires/c1', existant());
  await assertFails(lotMasquer(db('membre'), 'c1', 'Texte d\'essai', 'membre'));
  await assertSucceeds(lotMasquer(db('modo'), 'c1', 'Texte d\'essai'));

  // Mention visible par tous, texte vide ; original et historique réservés aux modérateurs.
  const vu = (await getDoc(doc(db(), 'commentaires/c1'))).data();
  if (vu.texte !== '' || !vu.masque) throw new Error('le commentaire masqué devrait avoir un texte vide');
  await assertFails(getDoc(doc(db(), 'commentaires/c1/prive/texte')));
  await assertFails(getDoc(doc(db('membre'), 'commentaires/c1/prive/texte')));
  await assertSucceeds(getDoc(doc(db('modo'), 'commentaires/c1/prive/texte')));
  await assertFails(getDoc(doc(db(), 'commentaires/c1/versions/1')));

  // L'auteur ne modifie pas un commentaire masqué.
  const masque = (await getDoc(doc(db(), 'commentaires/c1'))).data();
  await assertFails(lotModifier(db('membre'), 'c1', masque, 'Contourner'));

  await assertFails(lotDemasquer(db('membre'), 'c1', 'Texte d\'essai'));
  await assertFails(lotDemasquer(db('modo'), 'c1', 'Autre texte'));
  await assertSucceeds(lotDemasquer(db('modo'), 'c1', 'Texte d\'essai'));
});

test('masquage refusé si l\'original n\'est pas mis de côté à l\'identique', async () => {
  await semer('commentaires/c1', existant());
  await assertFails(updateDoc(doc(db('modo'), 'commentaires/c1'),
    { texte: '', masque: { par: 'modo', parNom: 'Modo Essai', le: serverTimestamp() } }));
  await assertFails(lotMasquer(db('modo'), 'c1', 'Texte modifié'));
});

// ---------- Signalements ----------
test('signaler : un membre, une fois, pas son propre commentaire ; lu par les modérateurs', async () => {
  await semer('commentaires/c1', existant());
  const chemin = 'commentaires/c1/signalements/autre';
  await assertFails(setDoc(doc(db(), chemin), { motif: '', le: serverTimestamp() }));
  await assertFails(setDoc(doc(db('membre'), 'commentaires/c1/signalements/membre'), { motif: '', le: serverTimestamp() }));
  await assertFails(setDoc(doc(db('autre'), 'commentaires/c1/signalements/membre'), { motif: '', le: serverTimestamp() }));
  await assertFails(setDoc(doc(db('autre'), chemin), { motif: 'x'.repeat(501), le: serverTimestamp() }));
  await assertSucceeds(setDoc(doc(db('autre'), chemin), { motif: 'Hors sujet', le: serverTimestamp() }));
  await assertFails(setDoc(doc(db('autre'), chemin), { motif: 'Encore', le: serverTimestamp() }));
  await assertFails(getDocs(collection(db('membre'), 'commentaires/c1/signalements')));
  await assertSucceeds(getDocs(collection(db('modo'), 'commentaires/c1/signalements')));
});

// ---------- Suppression ----------
test('suppression définitive : admin seulement', async () => {
  await semer('commentaires/c1', existant());
  await semer('commentaires/c1/versions/1', { texte: 'v1', le: T0 });
  await assertFails(deleteDoc(doc(db('modo'), 'commentaires/c1')));
  await assertFails(deleteDoc(doc(db('modo'), 'commentaires/c1/versions/1')));
  await assertSucceeds(deleteDoc(doc(db('admin'), 'commentaires/c1/versions/1')));
  await assertSucceeds(deleteDoc(doc(db('admin'), 'commentaires/c1')));
});

// ---------- Rien d'autre n'est ouvert ----------
test('les autres collections restent fermées', async () => {
  await assertFails(getDoc(doc(db('admin'), 'membres/x')));
  await assertFails(setDoc(doc(db('admin'), 'notes/x'), { texte: 'x' }));
});
