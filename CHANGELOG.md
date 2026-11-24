# Journal des changements

## [Non publié]
### Ajouté — onglet Articles, étape 2 : données et règles (pas encore d'écran)
- `firestore.rules` : `articles/{id}` (lu par tous une fois publié, par les rédacteurs sinon), `atelier/brouillon`
  (version de travail privée), `versions/{n}` (historique), `slugs/{slug}` (adresses réservées) ; rédaction dès le
  niveau 2, un modérateur sur ses articles, l'admin sur tous ; publication en un seul lot (version « publiée » +
  adresse) ; un article publié n'est jamais modifié en direct. Commentaires de type `article` (article publié
  seulement) ; fil du forum lié à un article (`lien.type = 'article'`).
- `storage.rules` : `articles/{id}/images/` (lecture publique, images PNG/JPEG/GIF/WebP ≤ 5 Mo) et
  `articles/{id}/fichiers/` (rédacteurs, ≤ 25 Mo) ; propriétaire lu dans Firestore ; le reste reste fermé.
- `firestore.indexes.json` : 8 index pour les listes d'articles.
- `src/js/articles-outils.js` (slug, slug depuis Blogger, versets repérés dans un texte, sourates, libellés, versets
  cités) et 8 tests (`tests/articles.test.mjs`) ; 15 tests des règles (`tests/regles/articles.test.mjs`, à lancer sur
  le PC avec `npm run test:regles`).
- Sauvegarde Blogger examinée (`docs/ARTICLES.md` § 6) ; fiche `import/articles/controle-familles.csv` (hors Git).

### Ajouté — onglet Articles : cadrage (rien de codé)
- `docs/ARTICLES.md` : modèle de données (`articles`, brouillon privé `atelier/brouillon`, `versions`, `slugs`,
  commentaires de type `article`, Storage), droits, éditeur, HTML assaini, import depuis Blogger, « Dossier pour
  Claude », pages publiques et redirection de blog.alfamous.ca ; 9 questions pour l'auteur.
- Maquette cliquable `docs/maquettes/articles.html` : liste et filtres, lecture et commentaires, éditeur et panneau
  Contexte, historique, Dossier pour Claude, ligne « Articles » sous un verset, fiche du lexique, page publique,
  fiche de contrôle de l'import. Titres et dates copiés de Blogger ; versets copiés de `donnees/` ; textes fictifs.
- Décisions de l'auteur du 24 nov. reportées (cadrage, maquette, `docs/DECISIONS.md`) : rédaction dès le niveau 2 ;
  éditeur maison simple avec « Importer un fichier » (Word `.docx`, HTML, Markdown, texte) ; commentaires Blogger
  importés (67 annoncés) ; éléments du panneau Contexte retenus. 7 questions restent ouvertes.
- Cadrage accepté par l'auteur (« ok pour tout ») ; import de tous les articles et commentaires depuis la sauvegarde
  complète de Blogger (.xml), articles signés Amha Nathali.

### Ajouté — phase 4 : import des commentaires de l'ancienne application
- `npm run importer` (`scripts/importer.mjs`) : lit les exports CSV de Versets1 et Lexique1 (dossier `import/`, hors Git)
  et écrit les commentaires dans `commentaires/` (types `verset` et `lexique`). À blanc par défaut (rapport
  `import/rapport-import.txt` et fiche de contrôle `import/controle-import.csv` avec un lien par commentaire) ;
  `--ecrire`, `--verifier` (Firestore relu et comparé au classeur), `--purger` (seulement les documents importés) ;
  émulateurs, `--projet essai` ou `--projet prod` (confirmation PROD).
- Décisions de l'auteur appliquées : seuls les commentaires d'Amha Nathali et d'Afrukh Ifereles ; signatures
  harmonisées ; clés du lexique sans voyelles (clés confondues regroupées et listées) ; date du 1er janvier 2024
  (midi, Montréal) pour les commentaires sans date, marquée `import.dateEstimee` ; commentaires d'Amha Nathali reliés
  à son compte (gmpcdz@gmail.com) ; comptes des anciens membres non importés ; ni les commentaires « Validé par »
  (commentaire validé et mention), ni les blocs non signés suivis d'une signature seule, ni les essais (lexique
  « todo », verset 5:1 « - »). Classeur du 22 nov. : 673 commentaires (320 de versets, 353 définitions sur 345 entrées).
- Identifiants stables (`imp-v-…`, `imp-l-…`) : relancer l'import remplace sans doublon. Champ `import`
  (source, clé d'origine, ordre, date brute, date estimée, date de l'import), toléré par les règles.
- 7 tests (`tests/import.test.mjs`).

### Corrigé — outils
- Dépendances des Cloud Functions installées par `npm ci` (ESSAI_LOCAL.bat, deployerAlfamous1.bat, `npm run emulateurs`) :
  `npm install` récrivait `functions/package.json` et `package-lock.json` sur le PC, ce qui bloquait ensuite
  `git checkout main` dans deployerAlfamous1.bat.

### Ajouté — onglet Membres (admins)
- Onglet **Membres** (`#/membres`, visible des seuls admins) : inscrits (nom, courriel, vérifié, inscription, dernière
  connexion, commentaires et définitions, fils et réponses du forum), recherche et filtres, niveau changé avec
  confirmation (jamais le sien), journal des changements. Maquette : `docs/maquettes/membres.html`.
- Premières **Cloud Functions** (`functions/`, Node 22, Montréal) : `membres` et `changerNiveau`, réservées aux admins ;
  blocage = sessions fermées ; journal dans `journalNiveaux` (fermé aux clients). 5 tests des fonctions pures
  (`tests/membres.test.mjs`) ; 1 test de règles (journal fermé).
- Émulateur Cloud Functions en local (port 5001, relayé par `servir.mjs`) ; `deployerAlfamous1.bat` déploie aussi les
  fonctions ; index `reponses.auteurUid` (groupe de collections).
- Messages en français pour « connexion par courriel non activée » et pour les erreurs des Cloud Functions.

### Ajouté — outils
- `deployerAlfamous1.bat` : mise à jour du code (main), tests, tests des règles, construction, puis déploiement du site
  et des règles et index Firestore (essai par défaut ; `prod` avec confirmation).

### Ajouté — phase 3 : lexique, racines proches, historique, copie de versets
- Onglet **Lexique** (`#/lexique`) : toutes les entrées par ordre alphabétique arabe, nombre de définitions, occurrences
  dans le Coran, extrait ; filtre sur la clé et le texte des définitions ; Racines du Coran / Expressions et autres ;
  « + Nouvelle entrée » (niveau 1 : clé sans voyelles et première définition).
- Fiche d'une entrée (`#/lexique/<clé>`) : occurrences, versets et sourates (si la clé est une racine), lien vers les
  versets, les amis et les déclinaisons ; définitions (même code que les commentaires : publier, modifier avec
  historique, signaler, masquer, supprimer) ; fils du forum et « Ouvrir une discussion » ; racines proches.
- **Racines proches (lettres communes)**, reprise des « synonymes » de l'ancienne application, calculées sur les
  racines du Coran, avec l'option « Sens inverse » ; entrées du lexique marquées.
- Encadré « Lexique » en tête des résultats d'une racine ; ligne « Lexique » dans la fiche d'un mot.
- **Historique des recherches** sous le champ (flèches, Entrée, Échap ; « Effacer ») suivi des clés du lexique qui
  commencent par la saisie ; synchronisé entre les machines d'un compte connecté (`historiques/{uid}`), local pour
  un visiteur.
- **Copie de versets** : case « Choisir » sur chaque verset, barre Aperçu · Copier · Vider, options (translittération,
  commentaire traditionnel, lien), texte simple et texte mis en forme.
- Règles Firestore de `historiques/{uid}` et 4 tests (`tests/regles/historiques.test.mjs`) ; tests des fonctions pures
  (`tests/lexique.test.mjs`, `historique.test.mjs`, `selection.test.mjs`) ; définitions d'essai dans
  `npm run emulateurs:peupler`.
- Liens « lexique » des notes et du forum cliquables ; ligne du forum aussi sous une entrée du lexique.

### Ajouté — phase 3 : cadrage du lexique
- Maquette cliquable `docs/maquettes/lexique.html` : liste du lexique, fiche d'une entrée (occurrences, définitions,
  racines proches, forum), encadré « Lexique » dans les résultats, historique des recherches, sélection et copie de
  versets ; 8 questions en attente. Versets et chiffres copiés de `donnees/` ; définitions fictives.

### Ajouté — phase 2 : limite de fréquence et niveaux
- Limite de 20 publications par heure et par membre (commentaires, notes, réponses, signalements), vérifiée par les
  règles (`limites/{uid}`, écrit dans le même lot) ; message clair avec l'heure de reprise ; modérateurs et admin exemptés.
- `npm run niveau` : nommer modérateur (2) ou admin (3), bloquer (0), lister ; émulateurs ou `--projet essai|prod`
  (confirmation pour la production) ; le niveau est relu au chargement de la page.
- Tests : 6 tests de la limite (`tests/regles/limite.test.mjs`) ; tous les tests de création passent par le compteur.

### Ajouté — phase 2 : Mes Notes et forum
- `ESSAI_LOCAL.bat` : émulateurs, données d'essai, application et navigateur en un double-clic.
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
