// Règles de Mes Notes et du forum (docs/DROITS.md, docs/MODELE-DONNEES.md) : npm run test:regles
import { test, before, after, beforeEach } from 'node:test';
import { readFileSync } from 'node:fs';
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import {
  doc, getDoc, getDocs, collection, query, where, orderBy, setDoc, updateDoc, deleteDoc, writeBatch,
  serverTimestamp, Timestamp, increment, setLogLevel,
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
const T0 = Timestamp.fromDate(new Date('2026-11-01T12:00:00Z'));
const semer = (chemin, data) => env.withSecurityRulesDisabled((c) => setDoc(doc(c.firestore(), chemin), data));
async function lire(chemin) {
  let d;
  await env.withSecurityRulesDisabled(async (c) => { d = (await getDoc(doc(c.firestore(), chemin))).data(); });
  return d;
}

// Note existante (semée sans règles).
const existante = (extra = {}) => ({
  auteurUid: 'membre', auteurNom: 'Membre Essai', titre: 'Titre', texte: 'Texte d\'essai',
  lien: { type: 'verset', cle: '112:1' }, publie: false, creeLe: T0, modifieLe: T0, publieLe: null, activiteLe: T0,
  nbReponses: 0, nbReponsesAutrui: 0, nbVersions: 1, masque: null, ...extra,
});
const publiee = (extra = {}) => existante({ publie: true, publieLe: T0, ...extra });
// Nouvelle note (écrite par le client).
const nouvelle = (extra = {}) => {
  const publie = extra.publie ?? false;
  return {
    auteurUid: 'membre', auteurNom: 'Membre Essai', titre: '', texte: 'Ma note', lien: null, publie,
    creeLe: serverTimestamp(), modifieLe: serverTimestamp(), activiteLe: serverTimestamp(),
    publieLe: publie ? serverTimestamp() : null, nbReponses: 0, nbReponsesAutrui: 0, nbVersions: 1, masque: null, ...extra,
  };
};

// Lots du client.
function lotRepondre(d, idNote, note, p, texte = 'Ma réponse') {
  const b = writeBatch(d);
  const n = note.nbReponses + 1;
  b.set(doc(d, `notes/${idNote}/reponses/${n}`), {
    auteurUid: PROFILS[p].uid, auteurNom: PROFILS[p].name, texte,
    creeLe: serverTimestamp(), modifieLe: null, nbVersions: 1, masque: null,
  });
  b.update(doc(d, `notes/${idNote}`), {
    nbReponses: increment(1), nbReponsesAutrui: increment(note.auteurUid === PROFILS[p].uid ? 0 : 1), activiteLe: serverTimestamp(),
  });
  return b.commit();
}
function lotModifierFil(d, idNote, note, champs) {
  const b = writeBatch(d);
  b.set(doc(d, `notes/${idNote}/versions/${note.nbVersions}`), { titre: note.titre, texte: note.texte, lien: note.lien, le: note.modifieLe });
  b.update(doc(d, `notes/${idNote}`), { ...champs, modifieLe: serverTimestamp(), nbVersions: note.nbVersions + 1 });
  return b.commit();
}
function lotMasquerFil(d, idNote, note) {
  const b = writeBatch(d);
  b.set(doc(d, `notes/${idNote}/prive/texte`), { titre: note.titre, texte: note.texte });
  b.update(doc(d, `notes/${idNote}`), { titre: '', texte: '', masque: { par: 'modo', parNom: 'Modo Essai', le: serverTimestamp() } });
  return b.commit();
}

// ---------- Lecture ----------
test('note privée : lue par son auteur seulement ; fil publié : lu par tous', async () => {
  await semer('notes/p', existante());
  await semer('notes/f', publiee());
  await assertSucceeds(getDoc(doc(db('membre'), 'notes/p')));
  for (const p of [undefined, 'autre', 'modo', 'admin']) await assertFails(getDoc(doc(db(p), 'notes/p')), `${p} lit une note privée`);
  for (const p of [undefined, 'autre']) await assertSucceeds(getDoc(doc(db(p), 'notes/f')));
});

test('requêtes : forum (publiés) pour tous, Mes Notes pour l\'auteur', async () => {
  await semer('notes/p', existante());
  await semer('notes/f', publiee());
  await assertSucceeds(getDocs(query(collection(db(), 'notes'), where('publie', '==', true), orderBy('activiteLe', 'desc'))));
  await assertSucceeds(getDocs(query(collection(db('membre'), 'notes'), where('auteurUid', '==', 'membre'))));
  await assertFails(getDocs(query(collection(db('autre'), 'notes'), where('auteurUid', '==', 'membre'))));
  await assertFails(getDocs(collection(db(), 'notes')));
});

// ---------- Création ----------
test('créer une note privée ou un fil publié (titre obligatoire pour publier)', async () => {
  const d = db('membre');
  await assertSucceeds(setDoc(doc(d, 'notes/a'), nouvelle()));
  await assertSucceeds(setDoc(doc(d, 'notes/b'), nouvelle({ publie: true, titre: 'Mon fil', lien: { type: 'verset', cle: '2:255' } })));
  await assertSucceeds(setDoc(doc(d, 'notes/c'), nouvelle({ lien: { type: 'racine', cle: 'أحد' } })));
  await assertFails(setDoc(doc(d, 'notes/d'), nouvelle({ publie: true, titre: '' })), 'publier sans titre');
  await assertFails(setDoc(doc(d, 'notes/e'), nouvelle({ texte: '' })), 'texte vide');
  await assertFails(setDoc(doc(d, 'notes/f'), nouvelle({ lien: { type: 'verset', cle: 'deux' } })), 'lien invalide');
  await assertFails(setDoc(doc(d, 'notes/g'), nouvelle({ auteurNom: 'Amha Nathali' })), 'autre nom');
  await assertFails(setDoc(doc(d, 'notes/h'), nouvelle({ nbReponses: 3 })), 'compteur faux');
  await assertFails(setDoc(doc(db(), 'notes/i'), nouvelle()), 'visiteur');
  await assertFails(setDoc(doc(db('nonVerifie'), 'notes/j'), nouvelle({ auteurUid: 'nv', auteurNom: 'Non Vérifié' })), 'non vérifié');
});

// ---------- Modification, publication, dépublication ----------
test('note privée : modifiée et supprimée librement par son auteur', async () => {
  await semer('notes/p', existante());
  await assertSucceeds(updateDoc(doc(db('membre'), 'notes/p'), { texte: 'Nouveau', titre: '', modifieLe: serverTimestamp() }));
  await assertFails(updateDoc(doc(db('autre'), 'notes/p'), { texte: 'Pirate', modifieLe: serverTimestamp() }));
  await assertFails(deleteDoc(doc(db('autre'), 'notes/p')));
  await assertSucceeds(deleteDoc(doc(db('membre'), 'notes/p')));
});

test('publier puis dépublier tant que personne d\'autre n\'a répondu', async () => {
  await semer('notes/p', existante({ titre: '' }));
  const d = db('membre');
  const pub = { publie: true, publieLe: serverTimestamp(), activiteLe: serverTimestamp(), modifieLe: serverTimestamp() };
  await assertFails(updateDoc(doc(d, 'notes/p'), pub), 'publier sans titre');
  await assertSucceeds(updateDoc(doc(d, 'notes/p'), { ...pub, titre: 'Mon fil' }));
  await assertFails(deleteDoc(doc(d, 'notes/p')), 'supprimer un fil publié');
  await assertSucceeds(updateDoc(doc(d, 'notes/p'), { publie: false, publieLe: null }));
  // Avec une réponse d'autrui : plus de dépublication.
  await semer('notes/q', publiee({ nbReponses: 1, nbReponsesAutrui: 1 }));
  await assertFails(updateDoc(doc(d, 'notes/q'), { publie: false, publieLe: null }));
});

test('fil publié : modification avec historique seulement', async () => {
  await semer('notes/f', publiee());
  const d = db('membre');
  await assertFails(updateDoc(doc(d, 'notes/f'), { texte: 'Sans historique', modifieLe: serverTimestamp() }));
  await assertSucceeds(lotModifierFil(d, 'f', publiee(), { texte: 'Version 2' }));
  await assertSucceeds(getDoc(doc(db(), 'notes/f/versions/1')));
  await assertFails(lotModifierFil(db('autre'), 'f', await lire('notes/f'), { texte: 'Pas à moi' }));
});

// ---------- Réponses ----------
test('répondre à un fil publié ; compteurs et activité tenus à jour', async () => {
  await semer('notes/f', publiee());
  await assertSucceeds(lotRepondre(db('autre'), 'f', publiee(), 'autre'));
  let n = await lire('notes/f');
  if (n.nbReponses !== 1 || n.nbReponsesAutrui !== 1) throw new Error('compteurs faux');
  await assertSucceeds(lotRepondre(db('membre'), 'f', n, 'membre'));
  n = await lire('notes/f');
  if (n.nbReponses !== 2 || n.nbReponsesAutrui !== 1) throw new Error('la réponse de l\'auteur ne compte pas comme « autrui »');
  await assertSucceeds(getDocs(collection(db(), 'notes/f/reponses')));
});

test('réponses refusées : visiteur, note privée, numéro faux, compteur gonflé', async () => {
  await semer('notes/f', publiee());
  await semer('notes/p', existante());
  await assertFails(lotRepondre(db(), 'f', publiee(), 'autre'), 'visiteur');
  await assertFails(lotRepondre(db('autre'), 'p', existante(), 'autre'), 'note privée');
  // Mauvais numéro de réponse.
  const d = db('autre');
  const b = writeBatch(d);
  b.set(doc(d, 'notes/f/reponses/5'), { auteurUid: 'autre', auteurNom: 'Autre Membre', texte: 'x', creeLe: serverTimestamp(), modifieLe: null, nbVersions: 1, masque: null });
  b.update(doc(d, 'notes/f'), { nbReponses: increment(1), nbReponsesAutrui: increment(1), activiteLe: serverTimestamp() });
  await assertFails(b.commit(), 'numéro faux');
  // Compteur sans réponse.
  await assertFails(updateDoc(doc(d, 'notes/f'), { nbReponses: increment(1), nbReponsesAutrui: increment(1), activiteLe: serverTimestamp() }), 'compteur seul');
});

test('réponse : modifiée par son auteur avec historique, jamais supprimée par lui', async () => {
  await semer('notes/f', publiee({ nbReponses: 1, nbReponsesAutrui: 1 }));
  await semer('notes/f/reponses/1', { auteurUid: 'autre', auteurNom: 'Autre Membre', texte: 'v1', creeLe: T0, modifieLe: null, nbVersions: 1, masque: null });
  const d = db('autre');
  const b = writeBatch(d);
  b.set(doc(d, 'notes/f/reponses/1/versions/1'), { texte: 'v1', le: T0 });
  b.update(doc(d, 'notes/f/reponses/1'), { texte: 'v2', modifieLe: serverTimestamp(), nbVersions: 2 });
  await assertSucceeds(b.commit());
  await assertFails(updateDoc(doc(db('membre'), 'notes/f/reponses/1'), { texte: 'v3', modifieLe: serverTimestamp(), nbVersions: 3 }));
  await assertFails(deleteDoc(doc(d, 'notes/f/reponses/1')));
});

// ---------- Modération ----------
test('masquer un fil : titre et texte mis à part, lus par les modérateurs seulement', async () => {
  await semer('notes/f', publiee());
  await assertFails(lotMasquerFil(db('autre'), 'f', publiee()));
  await assertSucceeds(lotMasquerFil(db('modo'), 'f', publiee()));
  const vu = (await getDoc(doc(db(), 'notes/f'))).data();
  if (vu.titre !== '' || vu.texte !== '' || !vu.masque) throw new Error('fil masqué mal formé');
  await assertFails(getDoc(doc(db('membre'), 'notes/f/prive/texte')));
  await assertSucceeds(getDoc(doc(db('modo'), 'notes/f/prive/texte')));
  // Plus de réponse ni de modification sur un fil masqué.
  await assertFails(lotRepondre(db('autre'), 'f', vu, 'autre'));
  // Démasquer.
  const d = db('modo');
  const b = writeBatch(d);
  b.delete(doc(d, 'notes/f/prive/texte'));
  b.update(doc(d, 'notes/f'), { titre: 'Titre', texte: 'Texte d\'essai', masque: null });
  await assertSucceeds(b.commit());
});

test('masquer une réponse ; signaler un fil et une réponse', async () => {
  await semer('notes/f', publiee({ nbReponses: 1, nbReponsesAutrui: 1 }));
  await semer('notes/f/reponses/1', { auteurUid: 'autre', auteurNom: 'Autre Membre', texte: 'r1', creeLe: T0, modifieLe: null, nbVersions: 1, masque: null });
  const d = db('modo');
  const b = writeBatch(d);
  b.set(doc(d, 'notes/f/reponses/1/prive/texte'), { texte: 'r1' });
  b.update(doc(d, 'notes/f/reponses/1'), { texte: '', masque: { par: 'modo', parNom: 'Modo Essai', le: serverTimestamp() } });
  await assertSucceeds(b.commit());
  await assertFails(getDoc(doc(db('membre'), 'notes/f/reponses/1/prive/texte')));

  const sig = { motif: '', le: serverTimestamp() };
  await assertSucceeds(setDoc(doc(db('autre'), 'notes/f/signalements/autre'), sig));
  await assertFails(setDoc(doc(db('membre'), 'notes/f/signalements/membre'), sig), 'son propre fil');
  await assertSucceeds(setDoc(doc(db('membre'), 'notes/f/reponses/1/signalements/membre'), sig));
  await assertFails(setDoc(doc(db('autre'), 'notes/f/reponses/1/signalements/autre'), sig), 'sa propre réponse');
  await assertFails(getDocs(collection(db('membre'), 'notes/f/signalements')));
  await assertSucceeds(getDocs(collection(db('modo'), 'notes/f/signalements')));
});

test('suppression d\'un fil publié : admin seulement', async () => {
  await semer('notes/f', publiee());
  await assertFails(deleteDoc(doc(db('membre'), 'notes/f')));
  await assertFails(deleteDoc(doc(db('modo'), 'notes/f')));
  await assertSucceeds(deleteDoc(doc(db('admin'), 'notes/f')));
});
