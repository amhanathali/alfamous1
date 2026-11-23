// Accès à Firebase (Auth, Firestore), chargé seulement quand on en a besoin.
//
// - En local (localhost) : émulateurs, projet fictif demo-alfamous1 (rien ne part vers le nuage).
//   Lancer LANCER_EMULATEURS.bat avant d'essayer les comptes et les commentaires.
// - En ligne : configuration fournie par Firebase Hosting (/__/firebase/init.json), donc
//   automatiquement alfamous-essai ou alfamous-atelier selon le site déployé.
// Le SDK est servi par l'application elle-même (vendor/firebase/, copié depuis node_modules).

export const LOCAL = ['localhost', '127.0.0.1'].includes(location.hostname);
const SDK = '../vendor/firebase';
let pret = null;

export function firebase() {
  if (!pret) pret = initialiser().catch((e) => { pret = null; throw e; });
  return pret;
}

async function initialiser() {
  const [{ initializeApp }, A, F] = await Promise.all([
    import(`${SDK}/firebase-app.js`), import(`${SDK}/firebase-auth.js`), import(`${SDK}/firebase-firestore.js`),
  ]);
  const config = LOCAL
    ? { projectId: 'demo-alfamous1', apiKey: 'cle-demo', authDomain: 'localhost' }
    : await fetch('/__/firebase/init.json').then((r) => { if (!r.ok) throw new Error('configuration Firebase introuvable'); return r.json(); });
  const app = initializeApp(config);
  const auth = A.getAuth(app);
  const db = F.getFirestore(app);
  if (LOCAL) {
    // Émulateurs joints par l'adresse de la page : scripts/servir.mjs relaie vers 9099 (Auth) et 8085 (Firestore).
    A.connectAuthEmulator(auth, location.origin, { disableWarnings: true });
    F.connectFirestoreEmulator(db, location.hostname, Number(location.port) || 80);
  }
  return { auth, db, A, F };
}

// Promesse limitée dans le temps (émulateurs éteints : Firestore réessaie longtemps sans répondre).
export function avecDelai(promesse, ms = 8000) {
  return Promise.race([promesse, new Promise((_, rej) => setTimeout(() => rej(Object.assign(new Error('délai dépassé'), { code: 'unavailable' })), ms))]);
}
