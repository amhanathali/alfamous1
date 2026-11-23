#!/usr/bin/env node
// Lance les émulateurs Firebase en local (Auth, Firestore, Storage, Cloud Functions) : npm run emulateurs
//
// - Projet « demo-alfamous1 » : le préfixe demo- garantit qu'aucune requête ne part vers
//   alfamous-essai ou alfamous-atelier (rien n'est écrit dans le nuage, rien n'est facturé).
// - Les données d'essai (comptes, commentaires, notes) sont gardées dans .emulateurs/
//   (non versionné) et rechargées au lancement suivant ; supprimer ce dossier pour repartir de zéro.
// - Console des émulateurs : http://localhost:4000
// - Comptes d'essai (niveaux 0 à 3) : npm run emulateurs:peupler, dans une 2e fenêtre.
// Prérequis sur le PC : Java 21 (déjà installé pour l'ancienne application).
import { spawn, execSync } from 'node:child_process';
import { mkdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const RACINE = join(dirname(fileURLToPath(import.meta.url)), '..');
const DOSSIER = '.emulateurs';
mkdirSync(join(RACINE, DOSSIER), { recursive: true });
// Cloud Functions (onglet Membres) : leurs dépendances sont installées à part, dans functions/.
if (!existsSync(join(RACINE, 'functions', 'node_modules'))) {
  console.log('Première fois : installation des dépendances des Cloud Functions (functions/)...');
  execSync('npm install --prefix functions --no-audit --no-fund', { cwd: RACINE, stdio: 'inherit' });
}

// Commande en une seule chaîne (arguments fixes, sans saisie de l'utilisateur) : pas d'avertissement DEP0190.
const commande = `npx firebase emulators:start --project demo-alfamous1 --only auth,firestore,storage,functions --import ${DOSSIER} --export-on-exit ${DOSSIER}`;
const proc = spawn(commande, { cwd: RACINE, stdio: 'inherit', shell: true });
proc.on('exit', (code) => process.exit(code ?? 0));
