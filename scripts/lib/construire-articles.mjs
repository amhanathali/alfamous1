// Lecture des articles publiés dans Firestore et écriture de leurs pages dans dist/ (docs/ARTICLES.md § 8).
// Appelé par scripts/construire.mjs --articles. Les pages elles-mêmes : scripts/lib/pages-articles.mjs.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { JSDOM } from 'jsdom';
import createDOMPurify from 'dompurify';
import { creerAssainisseur } from '../../src/js/articles-assainir.js';
import { pagesArticles } from './pages-articles.mjs';

// Adresses des pages selon la cible. Seule la production est indexée par les moteurs de recherche.
export const SITES = {
  emulateurs: { base: 'http://localhost:5050', atelier: 'http://localhost:5050', indexer: false },
  essai: { base: 'https://alfamous-essai.web.app', atelier: 'https://alfamous-essai.web.app', indexer: false },
  prod: { base: 'https://blog.alfamous.ca', atelier: 'https://atelier.alfamous.ca', indexer: true },
};

export async function construirePagesArticles({ racine, dist, alias }) {
  const cible = alias || 'emulateurs';
  const site = SITES[cible];
  if (!site) throw new Error(`Projet inconnu : ${alias} (essai ou prod).`);
  const { initializeApp, applicationDefault, deleteApp } = await import('firebase-admin/app');
  const { getFirestore } = await import('firebase-admin/firestore');
  let app;
  if (cible === 'emulateurs') {
    process.env.FIRESTORE_EMULATOR_HOST ||= '127.0.0.1:8085';
    app = initializeApp({ projectId: 'demo-alfamous1' }, 'pages-articles');
  } else {
    const projectId = JSON.parse(readFileSync(join(racine, '.firebaserc'), 'utf8')).projects[cible];
    if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
      throw new Error('Pages des articles : indiquez la clé de service (set GOOGLE_APPLICATION_CREDENTIALS=C:\\chemin\\hors\\depot\\cle.json).');
    }
    app = initializeApp({ credential: applicationDefault(), projectId }, 'pages-articles');
  }
  const snap = await getFirestore(app).collection('articles').where('statut', '==', 'publie').get();
  const liste = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  await deleteApp(app); // libère la connexion : la construction se termine d'elle-même
  const assainir = creerAssainisseur(createDOMPurify(new JSDOM('').window));
  const { fichiers, nb } = pagesArticles(liste, site, { assainir });
  for (const [chemin, contenu] of Object.entries(fichiers)) {
    const f = join(dist, chemin);
    mkdirSync(dirname(f), { recursive: true });
    writeFileSync(f, contenu);
  }
  return { nb, site };
}
