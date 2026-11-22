# Données du texte

Produites par `node scripts/convertir-classeur.mjs <dossier des CSV>` à partir du classeur Lexique-Coran.
Ne pas modifier à la main : corriger le classeur, exporter, relancer le script.

| Fichier | Contenu |
| --- | --- |
| `texte/NNN.json` | `{ sourate, versets: [{ v, ar, racines[], page, tr }] }` — arabe, racines du verset, page Warsh, translittération |
| `mots/NNN.json` | `{ sourate, versets: { "v": [[translittération, racine, arabe, sens], …] } }` — mot à mot produit par la fonction VBA de l'auteur (référence pour les racines) |
| `racines.json` | `{ racine: ["s:v:n", …] }` — toutes les occurrences de chaque racine |
| `sourates.json` | `[{ n, versets, pageDebut, pageFin }]` |
| `traductions/` | Traductions tanzil.net (fichiers non versionnés) |

Provenance du texte arabe (graphie uthmanie) : à documenter (probablement tanzil.net, CC BY 3.0, copie verbatim).

## Translittération
Calculée par Alfamous1 (`scripts/lib/translitteration.mjs`) à partir du texte arabe vocalisé,
selon un système proche de la norme DIN 31635 : ā ī ū ṯ ǧ ḥ ḫ ḏ š ṣ ḍ ṭ ẓ ʿ ġ ʾ.
Chaque mot est translittéré isolément (forme de citation). Exemple (1:1) : `bismi allāhi ar-raḥmāni ar-raḥīmi`.

## Sources exclues du dépôt
- Traductions : tanzil.net (voir `traductions/`).
- Définitions de racines « CSC-Tradition » et transcriptions de coran-seul.com : non publiées ici
  (pas d'autorisation de l'éditeur à ce jour).
