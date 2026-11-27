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

## Vérifier une modification en local — procédure fixe
**Un seul geste : double-cliquer sur ESSAI_LOCAL.bat.** Le script :
1. ferme toutes les autres fenêtres cmd.exe, les émulateurs et le serveur local encore ouverts ;
2. récupère la **dernière version préparée par Claude** (la branche modifiée le plus récemment sur GitHub,
   ou `main` si c'est elle), l'affiche en grand, et s'arrête sans rien toucher s'il y a des modifications locales ;
3. met les outils à jour (npm install), lance les émulateurs et les données d'essai ;
4. ouvre l'application sur http://localhost:5050 (comptes d'essai : `admin@essai.local`, mot de passe `essai123`).

Tous les .bat se placent eux-mêmes dans le dossier Alfamous1 et ferment d'abord ce qui pourrait les bloquer
(émulateurs, serveur local ; pour ESSAI_LOCAL et deployerAlfamous1, aussi les autres fenêtres cmd).

Autres usages : `ESSAI_LOCAL.bat main` (ce qui est en ligne), `ESSAI_LOCAL.bat <branche>` (une branche précise).
Le serveur local envoie les fichiers sans cache : un simple rechargement (F5) suffit après une modification.

## Essayer en local sans émulateurs
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

### Nommer un modérateur ou un admin
```bat
npm run niveau -- modo@essai.local 2          &REM émulateurs
npm run niveau -- --liste                      &REM comptes de niveau 0, 2 ou 3
npm run niveau -- nom@exemple.com 2 --projet essai
```
Niveaux : 0 bloqué, 1 membre (par défaut), 2 modérateur, 3 admin. Pour `--projet essai` ou `prod`, une clé de compte de
service gardée **hors du dépôt** : `set GOOGLE_APPLICATION_CREDENTIALS=C:\chemin\cle.json`. La production demande de taper OUI.

### Essayer les comptes et les commentaires en local
**Le plus simple : double-cliquer sur ESSAI_LOCAL.bat** (voir « Vérifier une modification en local » plus haut).
Étape par étape :
1. Fenêtre 1 : **LANCER_EMULATEURS.bat** (laisser ouverte).
2. Fenêtre 2 : `npm run emulateurs:peupler` (comptes d'essai + commentaires d'essai sur 112:1).
3. **LANCER_ALFAMOUS1.bat**, puis http://localhost:5050/#/q/112 : bouton « commentaires » sous chaque verset,
   « Se connecter » en haut à droite. Sur localhost, l'application utilise toujours les émulateurs.

En ligne, la configuration Firebase vient de Hosting (`/__/firebase/init.json`) : le site d'essai écrit dans
`alfamous-essai`, la production dans `alfamous-atelier`. Le SDK Firebase est servi par l'application (`vendor/firebase/`).

## Importer les commentaires de l'ancienne application (phase 4)
1. Exporter du classeur Lexique-Coran les onglets **Versets1** et **Lexique1** (Fichier › Télécharger › CSV) et les poser
   dans `import/` (jamais dans Git) : « Lexique-Coran - Versets1.csv », « Lexique-Coran - Lexique1.csv ».
2. `npm run importer` : à blanc ; lire `import/rapport-import.txt` (chiffres, signatures, clés regroupées, écarts).
3. Essai local : `npm run importer -- --ecrire` avec les émulateurs lancés.
4. Site d'essai : `set GOOGLE_APPLICATION_CREDENTIALS=C:\Users\gmpcd\cles\alfamous-essai.json`, puis
   `npm run importer -- --projet essai --ecrire` et `npm run importer -- --projet essai --verifier` ;
   contrôler quelques lignes de `import/controle-import.csv` (lien direct vers chaque commentaire).
5. Recommencer : `--purger` retire seulement les commentaires importés. Production : `--projet prod` (confirmation PROD),
   le jour de la bascule, avec l'accord de l'auteur.

## Déployer (sur le PC)
**Double-cliquer sur deployerAlfamous1.bat** (site d'essai), ou `deployerAlfamous1.bat prod` (production, confirmation
« PROD » demandée). Arrêter d'abord les émulateurs d'ESSAI_LOCAL.bat (les tests des règles en lancent d'autres).
Le script met le code à jour (branche `main`, `git pull --ff-only`), lance `npm test` et `npm run test:regles`,
construit `dist/` avec les pages publiques des articles (clé de service `%USERPROFILE%\cles\alfamous-essai.json` ou
`alfamous-atelier.json`, hors dépôt), puis déploie le site, les règles et index Firestore, les règles Storage et les
Cloud Functions (`functions/`) :
```bat
npm run traductions      &REM facultatif, une fois : télécharge les commentaires traditionnels (tanzil.net)
npx firebase deploy --only hosting,firestore,functions,storage --project essai
```
Tout déploiement se fait uniquement avec l'accord de l'auteur ; la production (`prod`) aussi.
