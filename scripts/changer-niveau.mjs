#!/usr/bin/env node
// Changer le niveau d'un compte (docs/DROITS.md) : revendication « niveau » posée côté serveur.
//
//   npm run niveau -- modo@essai.local 2            émulateurs (par défaut)
//   npm run niveau -- --liste                        comptes de niveau 0, 2 ou 3 posé à la main
//   npm run niveau -- nom@exemple.com 2 --projet essai
//   npm run niveau -- nom@exemple.com 3 --projet prod   (confirmation demandée)
//
// Niveaux : 0 = bloqué (lecture seule), 1 = membre (par défaut, courriel vérifié), 2 = modérateur, 3 = admin.
// Pour un vrai projet (essai, prod) : clé de compte de service HORS du dépôt, indiquée par
//   set GOOGLE_APPLICATION_CREDENTIALS=C:\chemin\hors\depot\cle.json
// Le membre voit son nouveau niveau après s'être reconnecté (ou en rechargeant la page).
import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { readFileSync } from 'node:fs';
import { createInterface } from 'node:readline/promises';

const args = process.argv.slice(2);
const iProjet = args.indexOf('--projet');
const alias = iProjet >= 0 ? args[iProjet + 1] : null;
const liste = args.includes('--liste');
const [email, niveauTexte] = args.filter((a, i) => !a.startsWith('--') && (iProjet < 0 || i !== iProjet + 1));
const NOMS = ['bloqué (lecture seule)', 'membre', 'modérateur', 'admin'];

function arreter(msg) { console.error(msg); process.exit(1); }

let app;
if (!alias) {
  process.env.FIREBASE_AUTH_EMULATOR_HOST ||= '127.0.0.1:9099';
  app = initializeApp({ projectId: 'demo-alfamous1' });
  console.log('Cible : émulateurs (demo-alfamous1).');
} else {
  const projets = JSON.parse(readFileSync(new URL('../.firebaserc', import.meta.url))).projects;
  const projectId = projets[alias];
  if (!projectId) arreter(`Projet inconnu : ${alias} (essai ou prod).`);
  if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) arreter('Indiquez la clé de service : set GOOGLE_APPLICATION_CREDENTIALS=C:\\chemin\\hors\\depot\\cle.json');
  app = initializeApp({ credential: applicationDefault(), projectId });
  console.log(`Cible : ${projectId}.`);
}
const auth = getAuth(app);

if (liste) {
  let page;
  do {
    page = await auth.listUsers(1000, page?.pageToken);
    for (const u of page.users) {
      const n = u.customClaims?.niveau;
      if (Number.isInteger(n)) console.log(`${u.email.padEnd(32)} niveau ${n} (${NOMS[n]})`);
    }
  } while (page.pageToken);
  process.exit(0);
}

const niveau = Number(niveauTexte);
if (!email || !Number.isInteger(niveau) || niveau < 0 || niveau > 3) {
  arreter('Usage : npm run niveau -- <courriel> <0|1|2|3> [--projet essai|prod]   ou   npm run niveau -- --liste');
}
const u = await auth.getUserByEmail(email).catch(() => arreter(`Aucun compte pour ${email}.`));
const avant = u.customClaims?.niveau;
console.log(`${email} : ${u.displayName || '(sans nom)'} · courriel ${u.emailVerified ? 'vérifié' : 'NON vérifié'} · niveau actuel ${avant ?? '1 (par défaut)'}`);

if (alias === 'prod') {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const r = await rl.question(`PRODUCTION : passer ${email} au niveau ${niveau} (${NOMS[niveau]}) ? Tapez OUI : `);
  rl.close();
  if (r.trim() !== 'OUI') arreter('Annulé.');
}

// Niveau 1 = pas de revendication (le niveau par défaut d'un compte vérifié).
const autres = { ...(u.customClaims || {}) };
delete autres.niveau;
await auth.setCustomUserClaims(u.uid, niveau === 1 ? autres : { ...autres, niveau });
console.log(`Fait : ${email} → niveau ${niveau} (${NOMS[niveau]}). Visible pour lui après reconnexion ou rechargement de la page.`);
if (!u.emailVerified && niveau >= 1) console.log('Attention : tant que son courriel n\'est pas vérifié, ce compte reste au niveau 0.');
