// Tests des règles avec les émulateurs : npm run test:regles
// Tout ce qui n'est pas ouvert explicitement reste fermé, pour tous les niveaux (docs/DROITS.md).
// Chaque collection ouverte ensuite aura ses propres tests dans ce dossier.
import { test, before, after } from 'node:test';
import { readFileSync } from 'node:fs';
import { initializeTestEnvironment, assertFails } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, setLogLevel } from 'firebase/firestore';

setLogLevel('silent');
import { ref, getBytes, uploadString } from 'firebase/storage';

let env;
before(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-alfamous1',
    firestore: { rules: readFileSync('firestore.rules', 'utf8'), host: '127.0.0.1', port: 8085 },
    storage: { rules: readFileSync('storage.rules', 'utf8'), host: '127.0.0.1', port: 9199 },
  });
});
after(async () => { await env?.cleanup(); });

// Un contexte par niveau : le niveau est une revendication posée par une Cloud Function.
const profils = () => ({
  visiteur: env.unauthenticatedContext(),
  'niveau 1': env.authenticatedContext('membre', { niveau: 1, email_verified: true }),
  'niveau 2': env.authenticatedContext('modo', { niveau: 2, email_verified: true }),
  'niveau 3': env.authenticatedContext('admin', { niveau: 3, email_verified: true }),
});

test('Firestore : collection non déclarée fermée à tous', async () => {
  for (const [nom, ctx] of Object.entries(profils())) {
    const db = ctx.firestore();
    await assertFails(getDoc(doc(db, 'inconnue/x')), `${nom} : lecture`);
    await assertFails(setDoc(doc(db, 'inconnue/x'), { texte: 'essai' }), `${nom} : écriture`);
  }
});

test('Storage fermé : personne ne lit ni n\'écrit', async () => {
  for (const [nom, ctx] of Object.entries(profils())) {
    const st = ctx.storage();
    await assertFails(getBytes(ref(st, 'x.txt')), `${nom} : lecture`);
    await assertFails(uploadString(ref(st, 'x.txt'), 'essai'), `${nom} : écriture`);
  }
});

test('Firestore : journalNiveaux fermé à tous, admin compris (lu et écrit par les Cloud Functions seulement)', async () => {
  for (const [nom, ctx] of Object.entries(profils())) {
    const db = ctx.firestore();
    await assertFails(getDoc(doc(db, 'journalNiveaux/x')), `${nom} : lecture`);
    await assertFails(setDoc(doc(db, 'journalNiveaux/x'), { avant: 1, apres: 3 }), `${nom} : écriture`);
  }
});
