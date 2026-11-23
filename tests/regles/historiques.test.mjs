// Règles de l'historique des recherches (docs/MODELE-DONNEES.md) : npm run test:regles
import { test, before, after, beforeEach } from 'node:test';
import { readFileSync } from 'node:fs';
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, deleteDoc, serverTimestamp, Timestamp, setLogLevel } from 'firebase/firestore';

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

const db = (uid, verifie = true) => (uid ? env.authenticatedContext(uid, { email_verified: verifie }) : env.unauthenticatedContext()).firestore();
const histo = (n = 2, extra = {}) => ({
  recherches: Array.from({ length: n }, (_, i) => ({ q: `r:بشر${i}`, t: 1000 + i })), majLe: serverTimestamp(), ...extra,
});
const semer = () => env.withSecurityRulesDisabled((c) => setDoc(doc(c.firestore(), 'historiques/membre'),
  { recherches: [{ q: '2:255', t: 1 }], majLe: Timestamp.now() }));

test('titulaire : crée, lit, met à jour et efface son historique', async () => {
  const d = db('membre');
  await assertSucceeds(setDoc(doc(d, 'historiques/membre'), histo()));
  await assertSucceeds(getDoc(doc(d, 'historiques/membre')));
  await assertSucceeds(setDoc(doc(d, 'historiques/membre'), histo(50)));
  await assertSucceeds(deleteDoc(doc(d, 'historiques/membre')));
});

test('compte au courriel non vérifié : a aussi son historique', async () => {
  await assertSucceeds(setDoc(doc(db('nv', false), 'historiques/nv'), histo()));
});

test('personne d\'autre ne lit ni n\'écrit l\'historique d\'un membre', async () => {
  await semer();
  for (const d of [db(null), db('autre')]) {
    await assertFails(getDoc(doc(d, 'historiques/membre')));
    await assertFails(setDoc(doc(d, 'historiques/membre'), histo()));
    await assertFails(deleteDoc(doc(d, 'historiques/membre')));
  }
  const modo = env.authenticatedContext('modo', { email_verified: true, niveau: 3 }).firestore();
  await assertFails(getDoc(doc(modo, 'historiques/membre')));
});

test('forme refusée : plus de 50 recherches, champ inconnu, date du client, pas une liste', async () => {
  const d = db('membre');
  await assertFails(setDoc(doc(d, 'historiques/membre'), histo(51)));
  await assertFails(setDoc(doc(d, 'historiques/membre'), histo(2, { autre: 1 })));
  await assertFails(setDoc(doc(d, 'historiques/membre'), histo(2, { majLe: Timestamp.now() })));
  await assertFails(setDoc(doc(d, 'historiques/membre'), { recherches: 'r:بشر', majLe: serverTimestamp() }));
});
