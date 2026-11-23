#!/usr/bin/env node
// Crée dans les émulateurs un compte d'essai par niveau (docs/DROITS.md) et quelques commentaires
// d'essai sur 112:1 et 112:2 : npm run emulateurs:peupler
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
import { getFirestore, Timestamp } from 'firebase-admin/firestore';

process.env.FIREBASE_AUTH_EMULATOR_HOST ||= '127.0.0.1:9099';
process.env.FIRESTORE_EMULATOR_HOST ||= '127.0.0.1:8085';
const PROJET = 'demo-alfamous1';
if (!PROJET.startsWith('demo-')) throw new Error('Projet réel refusé : ce script ne vise que l\'émulateur.');

const app = initializeApp({ projectId: PROJET });
const auth = getAuth(app);
const db = getFirestore(app);
const uids = {};
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
  uids[c.niveau] = u.uid;
  console.log(`${c.email.padEnd(22)} niveau ${c.niveau}  uid ${u.uid}`);
}
console.log('Comptes d\'essai prêts (mot de passe : essai123).');

// Commentaires d'essai (textes fictifs, identifiants fixes : relancer le script les remet à zéro).
const jour = (j) => Timestamp.fromDate(new Date(Date.UTC(2026, 10, j, 15)));
const com = (cle, auteurUid, auteurNom, texte, j, extra = {}) => ({
  type: 'verset', cle, auteurUid, auteurNom, texte, creeLe: jour(j), modifieLe: null, nbVersions: 1, masque: null, ...extra,
});
const ESSAIS = {
  'essai-1': com('112:1', null, 'Amha Nathali', "[Texte d'essai] Commentaire importé (sans compte). Renvois : 2:255, r:أحد.", 2),
  'essai-2': com('112:1', uids[1], 'Membre Essai', "[Texte d'essai] Commentaire du membre, déjà modifié une fois.", 19,
    { modifieLe: jour(20), nbVersions: 2 }),
  'essai-3': com('112:1', uids[2], 'Modo Essai', '', 21,
    { masque: { par: uids[2], parNom: 'Modo Essai', le: jour(22) } }),
  'essai-4': com('112:1', uids[3], 'Admin Essai', "[Texte d'essai] Le plus récent s'affiche en haut.", 23),
};
for (const [id, data] of Object.entries(ESSAIS)) await db.doc(`commentaires/${id}`).set(data);
await db.doc('commentaires/essai-2/versions/1').set({ texte: "[Texte d'essai] Première version.", le: jour(19) });
await db.doc('commentaires/essai-3/prive/texte').set({ texte: "[Texte d'essai] Commentaire masqué par un modérateur." });
await db.doc(`commentaires/essai-4/signalements/${uids[1]}`).set({ motif: 'Essai de signalement', le: jour(23) });
console.log('Commentaires d\'essai prêts sur 112:1 (ouvrir http://localhost:5050/#/q/112).');
