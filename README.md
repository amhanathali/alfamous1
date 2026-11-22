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

## Essayer et déployer (sur le PC)
```bat
npm test
npm run traductions      &REM facultatif : télécharge les traductions tanzil.net
npm run construire
npm run servir           &REM essai local : http://localhost:5005
firebase deploy --only hosting --project essai
```
Le déploiement en production (`--project prod`) se fait uniquement avec l'accord de l'auteur.
