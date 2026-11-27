# Alfamous1 — règles de travail (obligatoires)

Nouvelle application « atelier du codex » (recherche, racines, commentaires signés).
L'ancienne application (dépôt `amhanathali/alfamous`, projet Firebase `alfamous-amha`)
ne doit JAMAIS être modifiée depuis ce dépôt.

## Projets Firebase
- `alfamous-essai` : tests (alias `essai`, par défaut).
- `alfamous-atelier` : production (alias `prod`), sous-domaine prévu `atelier.alfamous.ca`.
- Région des données : `northamerica-northeast1` (Montréal).

## Règles
1. Aucune fusion dans `main` et aucun déploiement sans l'accord explicite de l'auteur.
2. Travailler sur une branche, puis pull request vers `main`.
3. Aucun secret dans Git (clés de compte de service, `.env`, mots de passe SMTP).
   La configuration Web Firebase (`src/config/*.json`) n'est pas un secret.
4. Règles Firestore et Storage fermées par défaut ; toute ouverture est testée avec l'émulateur.
5. Les fichiers de traduction de tanzil.net ne sont jamais commités (voir `donnees/traductions/`).
6. Les données éditoriales (commentaires) vivent dans Firestore, pas dans des fichiers du dépôt.
7. Expliquer chaque changement ; tenir `CHANGELOG.md` à jour.
8. Langue du projet : français (code commenté en français, noms de variables en anglais ou français cohérents).
9. Essai local par l'auteur : une seule procédure, **ESSAI_LOCAL.bat** (double-clic). Il ferme les autres fenêtres
   cmd, puis essaie la branche modifiée le plus récemment sur GitHub. Avant de demander un essai, Claude pousse
   sa branche (et la remet à jour sur `main` si nécessaire) pour qu'elle soit la plus récente, et dit à l'auteur
   quelle version le script affichera.
