# Journal des changements

## [Non publié]
### Ajouté — phase 1 : lecture et recherche
- Application web sans connexion (`src/`) : recherche par verset (2:255, 2:1-5), sourate, page Warsh,
  mot arabe ou translittéré (option mot entier), racine ; mot à mot au clic (lecture, racine, sens) ;
  vue racine avec amis, amis contigus et répartition par sourate ; thème clair/sombre ; mobile.
- Moteur de recherche testé (`src/js/recherche.js`, `npm test`).
- `npm run construire` (dossier `dist/` pour Firebase Hosting, sans `import/`), `npm run servir` (essai local),
  `npm run traductions` (téléchargement tanzil.net, à lancer sur le PC).
- Basmala séparée du verset 1 (112 sourates), affichée en tête de sourate.

- Socle du dépôt : licence GPL v3, README, règles de travail (CLAUDE.md), décisions.
- Configuration Firebase des projets `alfamous-essai` et `alfamous-atelier`.
- Règles Firestore et Storage fermées par défaut.
- Liste des traductions tanzil.net (`donnees/traductions/langues.json`).
- Script `scripts/convertir-classeur.mjs` : conversion des exports CSV du classeur Lexique-Coran
  (Versets1, Lexique1, Feuille22) en données découpées par sourate.
- Translittération savante calculée à partir de l'arabe (`scripts/lib/translitteration.mjs`),
  en remplacement des transcriptions de coran-seul.com.
- Données du texte : `donnees/texte/` (arabe, racines, page Warsh, translittération),
  `donnees/mots/` (mot à mot : translittération, racine, arabe, sens), `donnees/racines.json`
  (index des 1 797 racines → occurrences), `donnees/sourates.json`.
- Commentaires et lexique préparés pour Firestore dans `import/` (non versionné).
