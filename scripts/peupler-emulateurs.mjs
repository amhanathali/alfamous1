#!/usr/bin/env node
// Crée dans l'émulateur Auth un compte d'essai par niveau (docs/DROITS.md) : npm run emulateurs:peupler
// À lancer pendant que « npm run emulateurs » tourne. Ne touche jamais un vrai projet :
// le script refuse de tourner si l'émulateur n'est pas visé.
//
//   visiteur@essai.local  niveau 0 (courriel non vérifié)
//   membre@essai.local    niveau 1
//   modo@essai.local      niveau 2
//   admin@essai.local     niveau 3
// Mot de passe de tous les comptes d'essai : essai123 (émulateur seulement).
import { initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

process.env.FIREBASE_AUTH_EMULATOR_HOST ||= '127.0.0.1:9099';
const PROJET = 'demo-alfamous1';
if (!PROJET.startsWith('demo-')) throw new Error('Projet réel refusé : ce script ne vise que l\'émulateur.');

const auth = getAuth(initializeApp({ projectId: PROJET }));
const COMPTES = [
  { email: 'visiteur@essai.local', nom: 'Visiteur Essai', niveau: 0, verifie: false },
  { email: 'membre@essai.local', nom: 'Membre Essai', niveau: 1, verifie: true },
  { email: 'modo@essai.local', nom: 'Modo Essai', niveau: 2, verifie: true },
  { email: 'admin@essai.local', nom: 'Admin Essai', niveau: 3, verifie: true },
];

for (const c of COMPTES) {
  let u;
  try {
    u = await auth.getUserByEmail(c.email);
  } catch {
    u = await auth.createUser({ email: c.email, password: 'essai123', displayName: c.nom, emailVerified: c.verifie });
  }
  await auth.setCustomUserClaims(u.uid, { niveau: c.niveau });
  console.log(`${c.email.padEnd(22)} niveau ${c.niveau}  uid ${u.uid}`);
}
console.log('Comptes d\'essai prêts (mot de passe : essai123).');
