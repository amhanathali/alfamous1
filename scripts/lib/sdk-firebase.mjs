// SDK Firebase pour le navigateur, servi par l'application (vendor/firebase/) au lieu d'un CDN :
// version figée par package-lock.json, aucun script tiers chargé depuis un autre domaine.
// Les modules de node_modules/firebase importent firebase-app.js depuis gstatic : l'adresse est
// remplacée par le fichier voisin.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export const MODULES_SDK = ['firebase-app.js', 'firebase-auth.js', 'firebase-firestore.js', 'firebase-functions.js'];

export function lireModuleSdk(racine, nom) {
  if (!MODULES_SDK.includes(nom)) return null;
  const brut = readFileSync(join(racine, 'node_modules', 'firebase', nom), 'utf8');
  return brut.replace(/https:\/\/www\.gstatic\.com\/firebasejs\/[\d.]+\/firebase-app\.js/g, './firebase-app.js');
}
