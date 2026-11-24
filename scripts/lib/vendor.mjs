// Bibliothèques tierces servies par l'application (vendor/), copiées de node_modules (versions figées par
// package-lock.json) : aucun script chargé depuis un autre domaine.
//   - DOMPurify (MPL-2.0 ou Apache-2.0) : assainit le HTML des articles (affichage, enregistrement).
//   - mammoth.js (BSD-2-Clause) : convertit un fichier Word (.docx) en HTML dans l'éditeur d'articles.
import { join } from 'node:path';

export const VENDOR = {
  // Module ES, servi en .js (type MIME sûr sur Firebase Hosting).
  'dompurify/purify.es.js': 'node_modules/dompurify/dist/purify.es.mjs',
  'mammoth/mammoth.browser.min.js': 'node_modules/mammoth/mammoth.browser.min.js',
};
export const cheminVendor = (racine, nom) => (VENDOR[nom] ? join(racine, VENDOR[nom]) : null);
