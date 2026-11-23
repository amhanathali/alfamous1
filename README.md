# Alfamous1 — l'atelier du codex

Application web pour étudier le texte coranique par le texte lui-même :
recherche (sourate, verset, page, mot, racine), outils de racines
(occurrences, « amis », amis contigus), et commentaires signés sur chaque
verset et chaque entrée du lexique.

Successeur de l'application Alfamous (`amhanathali/alfamous`), reconstruite de zéro.

## Organisation
| Dossier | Contenu |
| --- | --- |
| `src/` | Code de l'application (JavaScript en modules, sans framework) |
| `donnees/` | Données du texte, découpées par sourate (JSON) |
| `donnees/traductions/` | Traductions au format tanzil.net (non versionnées, voir le README du dossier) |
| `scripts/` | Conversion des données, téléchargement des traductions |
| `docs/` | Décisions et documentation |

## Licence
Code sous GPL v3 (voir `LICENSE`). Les traductions proviennent de
[tanzil.net/trans](https://tanzil.net/trans/) et restent soumises à leurs propres conditions
(usage non commercial).

## Invite de commandes
Double-cliquer sur **INVITE_ALFAMOUS1.bat** : une fenêtre cmd s'ouvre directement dans ce dossier et affiche la branche en cours.

## Essayer en local (sans déployer)
Double-cliquer sur **LANCER_ALFAMOUS1.bat** : le navigateur s'ouvre sur http://localhost:5050.
Toute modification du code se voit en rechargeant la page (F5). Fermer la fenêtre noire arrête le serveur.
(Équivalent : `npm run servir`. Pour essayer exactement ce qui sera déployé : `npm run construire` puis `npm run servir:dist`.)

## Émulateurs Firebase (phase 2 : comptes, commentaires)
Double-cliquer sur **LANCER_EMULATEURS.bat** (la première fois, il installe les outils avec `npm install`).
Auth, Firestore et Storage tournent sur le PC, avec un projet fictif `demo-alfamous1` : rien n'est écrit
dans `alfamous-essai` ni dans `alfamous-atelier`. Console : http://localhost:4000.
Les données d'essai sont gardées dans `.emulateurs/` (non versionné) ; supprimer ce dossier pour repartir de zéro.

| Commande | Effet |
| --- | --- |
| `npm run emulateurs` | Lance les émulateurs (comme le .bat) |
| `npm run emulateurs:peupler` | Crée 4 comptes d'essai, niveaux 0 à 3 (`visiteur`, `membre`, `modo`, `admin` @essai.local, mot de passe `essai123`) |
| `npm run test:regles` | Démarre les émulateurs, teste les règles Firestore et Storage (`tests/regles/`), puis les arrête |

Prérequis : Java 21 (déjà installé sur le PC).

### Essayer les comptes et les commentaires en local
**Le plus simple : double-cliquer sur ESSAI_LOCAL.bat** (émulateurs, données d'essai, application et navigateur en une fois).
Étape par étape :
1. Fenêtre 1 : **LANCER_EMULATEURS.bat** (laisser ouverte).
2. Fenêtre 2 : `npm run emulateurs:peupler` (comptes d'essai + commentaires d'essai sur 112:1).
3. **LANCER_ALFAMOUS1.bat**, puis http://localhost:5050/#/q/112 : bouton « commentaires » sous chaque verset,
   « Se connecter » en haut à droite. Sur localhost, l'application utilise toujours les émulateurs.

En ligne, la configuration Firebase vient de Hosting (`/__/firebase/init.json`) : le site d'essai écrit dans
`alfamous-essai`, la production dans `alfamous-atelier`. Le SDK Firebase est servi par l'application (`vendor/firebase/`).

## Déployer (sur le PC)
```bat
npm test
npm run traductions      &REM facultatif : télécharge les commentaires traditionnels (tanzil.net)
npm run construire
firebase deploy --only hosting --project essai
```
Le déploiement en production (`--project prod`) se fait uniquement avec l'accord de l'auteur.
