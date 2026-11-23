# Journal des changements

## [Non publié]
### Ajouté — phase 2 : Mes Notes et forum
- Onglets **Lecture · Mes Notes · Forum** sous le titre.
- Mes Notes (`#/notes`, `#/note/…`) : notes privées (titre facultatif, lien vers un verset, une racine ou une entrée du
  lexique), publication au forum, dépublication tant qu'aucun autre membre n'a répondu, suppression des notes privées.
- Forum (`#/forum`, `#/fil/…`) : fils par dernière activité, filtres, verset cité, réponses de la plus ancienne à la plus
  récente ; modifier (historique), signaler, masquer, supprimer selon le niveau.
- Sous les commentaires d'un verset : fils du forum sur ce verset, « Ouvrir une discussion », « Mes notes sur ce verset ».
- Règles Firestore de la collection `notes` (et `reponses`) ; 12 tests (`tests/regles/notes.test.mjs`) ; index ;
  notes et fils d'essai dans `npm run emulateurs:peupler`.

### Ajouté — phase 2 : écran des commentaires et comptes
- Bouton sous chaque verset (à droite de ⌃ / ⌄) : nombre de commentaires, ouvre et ferme ceux de ce verset seulement ;
  les plus récents en premier (contributeur, date, texte), liste qui défile ; liens automatiques 2:255 et r:….
- Écrire (niveau 1), modifier le sien avec historique, signaler, masquer / démasquer (niveau 2), supprimer (niveau 3).
- Comptes : connexion, création de compte (nom affiché = signature), vérification du courriel, mot de passe oublié,
  déconnexion ; niveau lu dans le jeton.
- `src/js/firebase.js` : émulateurs sur localhost, configuration de Hosting en ligne ; SDK Firebase 13.4.0 servi par
  l'application (`vendor/firebase/`, copié depuis node_modules par `construire` et `servir`).
- Serveur local : relais des appels vers les émulateurs (Auth, Firestore) par l'adresse de la page, pour les
  navigateurs qui refusent qu'une page joigne un autre port.
- `firestore.indexes.json` : index (type, cle, creeLe décroissant) pour la liste des commentaires.
- `npm run emulateurs:peupler` crée aussi des commentaires d'essai sur 112:1.

### Ajouté — phase 2 : commentaires (règles)
- Collection `commentaires` (versets et lexique) ouverte dans `firestore.rules` : lecture publique ; écriture dès le
  niveau 1 (courriel vérifié), signée du nom du compte, 4 000 caractères au plus ; modification par l'auteur avec
  historique (`versions/`) ; masquage réversible par les modérateurs (texte mis à part dans `prive/texte`) ;
  signalements (`signalements/{uid}`) ; suppression par l'admin.
- 12 tests de règles (`tests/regles/commentaires.test.mjs`) ; modèle de données dans `docs/MODELE-DONNEES.md`.
- Maquette v2 des commentaires avec les décisions de l'auteur ; « Signaler » ajouté à `docs/DROITS.md`.

### Ajouté — phase 2 : émulateurs Firebase
- `LANCER_EMULATEURS.bat` / `npm run emulateurs` : Auth, Firestore et Storage en local sur le projet fictif
  `demo-alfamous1` (aucun accès au nuage), console http://localhost:4000, données d'essai gardées dans `.emulateurs/`.
- `npm run emulateurs:peupler` : comptes d'essai des niveaux 0 à 3 (revendication `niveau`, docs/DROITS.md).
- `npm run test:regles` : tests des règles avec les émulateurs (`tests/regles/`) ; premier test : tout est fermé
  pour tous les niveaux.
- Outils de développement : firebase-tools, firebase, firebase-admin, @firebase/rules-unit-testing.

### Ajouté
- Lancement local rapide : double-clic sur `LANCER_ALFAMOUS1.bat` (http://localhost:5050), mode développement
  sans reconstruction (F5 suffit) ; `npm run servir:dist` pour essayer exactement ce qui sera déployé.
- Croix pour effacer le champ de recherche (aussi : touche Échap).
### Modifié
- Les « traductions » sont présentées comme des **commentaires traditionnels**, cités seulement pour la comparaison
  (« Comparer avec … », mention « (tradition) » sous chaque verset).

### Ajouté
- Bas de chaque verset : boutons ⌃ / ⌄ (centrés) pour afficher le verset précédent ou suivant juste
  au-dessus ou au-dessous, sans quitter les résultats (passage d'une sourate à l'autre géré).
- Aide quand « Mots contigus » ne donne aucun résultat (nombre de versets sans l'option, bouton pour la décocher).

### Ajouté — phase 1 : lecture et recherche
- Application web sans connexion (`src/`) : recherche par verset (2:255, 2:1-5), sourate, page Warsh,
  mot arabe ou translittéré (option mot entier), racine ; mot à mot au clic (lecture, racine, sens) ;
  vue racine avec amis, amis contigus et répartition par sourate ; thème clair/sombre ; mobile.
- Moteur de recherche testé (`src/js/recherche.js`, `npm test`).
- `npm run construire` (dossier `dist/` pour Firebase Hosting, sans `import/`), `npm run servir` (essai local),
  `npm run traductions` (téléchargement tanzil.net, à lancer sur le PC).
- Basmala séparée du verset 1 (112 sourates), affichée en tête de sourate.

### Ajouté — recherche avancée (parité avec l'ancienne application)
- Plusieurs mots ou racines (espace ou « + ») : versets contenant TOUS les termes ; option « mots contigus »
  (fenêtre de k mots, ordre libre) ; « mot entier » ; préfixes `r:` (racines) et `m:` (mots).
- Normalisation de l'ancienne application : lettres ا و ي non tapées ignorées (AWY), ة → ت, formes d'alif unifiées.
- Recherche dans la traduction tanzil choisie (« chercher le latin dans la traduction »), avec surlignage.
- Vue racine : onglets Versets, Amis (N paires, versets, distance moyenne et minimale, lien = N / distance
  moyenne, tri), Amis contigus (distance 1), Déclinaisons (formes et fréquences) ; répartition par sourate.
- Statistiques de toutes les racines (`#/stats`), filtre par première lettre.
- Index des racines construit sur la colonne Racines de Versets1 (alignée mot à mot), comme l'ancienne application.

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
