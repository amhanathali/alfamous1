# Journal des changements

## [Non publié]
### Ajouté
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
