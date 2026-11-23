// Limite de fréquence : 20 publications par heure et par membre (docs/DROITS.md) : npm run test:regles
import { test, before, after, beforeEach } from 'node:test';
import { readFileSync } from 'node:fs';
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { doc, setDoc, serverTimestamp, Timestamp, setLogLevel } from 'firebase/firestore';
import { lotAvecLimite } from './limite.mjs';

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
  modo: { uid: 'modo', name: 'Modo Essai', email_verified: true, niveau: 2 },
};
const db = (p) => { const { uid, ...jeton } = PROFILS[p]; return env.authenticatedContext(uid, jeton).firestore(); };
const commentaire = (p, i) => ({
  type: 'verset', cle: '1:1', auteurUid: PROFILS[p].uid, auteurNom: PROFILS[p].name, texte: `Essai ${i}`,
  creeLe: serverTimestamp(), modifieLe: null, nbVersions: 1, masque: null,
});
const publier = (p, i) => { const d = db(p); return lotAvecLimite(d, PROFILS[p].uid, (b) => b.set(doc(d, `commentaires/c${i}`), commentaire(p, i))); };

test('20 publications dans l\'heure, la 21e est refusée', async () => {
  for (let i = 1; i <= 20; i++) await assertSucceeds(publier('membre', i), `publication ${i}`);
  await assertFails(publier('membre', 21));
});

test('publier sans passer par le compteur est refusé (membre)', async () => {
  await assertFails(setDoc(doc(db('membre'), 'commentaires/x'), commentaire('membre', 0)));
});

test('la fenêtre ne peut pas être remise à zéro avant l\'heure', async () => {
  await assertSucceeds(publier('membre', 1));
  await assertFails(setDoc(doc(db('membre'), 'limites/membre'), { debut: serverTimestamp(), n: 1, dernier: serverTimestamp() }));
});

test('une heure après, une nouvelle fenêtre s\'ouvre', async () => {
  const ilYa2h = Timestamp.fromMillis(Date.now() - 2 * 3600e3);
  await env.withSecurityRulesDisabled((c) => setDoc(doc(c.firestore(), 'limites/membre'), { debut: ilYa2h, n: 20, dernier: ilYa2h }));
  await assertSucceeds(publier('membre', 1));
});

test('personne n\'écrit le compteur d\'un autre', async () => {
  await assertFails(setDoc(doc(db('membre'), 'limites/autre'), { debut: serverTimestamp(), n: 1, dernier: serverTimestamp() }));
});

test('modérateurs et admin : pas de limite', async () => {
  for (let i = 1; i <= 3; i++) await assertSucceeds(setDoc(doc(db('modo'), `commentaires/m${i}`), commentaire('modo', i)));
});
