# Journal des changements

## [Non publié]
### Modifié — tous les .bat : bon dossier et rien qui bloque (branche `outils/bat-robustes`)
- Les cinq .bat (`ESSAI_LOCAL`, `deployerAlfamous1`, `LANCER_ALFAMOUS1`, `LANCER_EMULATEURS`, `INVITE_ALFAMOUS1`) se
  placent explicitement dans le dossier Alfamous1 (celui du fichier, sinon `%USERPROFILE%\Desktop\Alfamous1`) et
  vérifient que c'est bien lui (package.json « alfamous1 ») ; sinon arrêt avec un message. Plus jamais le dossier par
  défaut de cmd (réglage AutoRun du PC vers Desktop\Alfamous).
- Avant de commencer, ils ferment ce qui peut les bloquer : processus qui écoutent sur les ports des émulateurs
  (4000, 4400, 4500, 5001, 5005, 8085, 9099, 9150, 9199) et du serveur local (5050). `ESSAI_LOCAL` et
  `deployerAlfamous1` ferment aussi les processus node/java d'Alfamous1 ou de Firebase et les autres fenêtres cmd
  (la leur et ses parents sont gardées). `LANCER_ALFAMOUS1` ne libère que le port 5050, `LANCER_EMULATEURS` que ceux
  des émulateurs.
- `deployerAlfamous1` remet aussi les `package-lock.json` (régénérés par npm) à leur version GitHub avant de passer
  sur main.

### Corrigé — `ESSAI_LOCAL.bat` restait sur main (branche `outils/essai-local-2`)
- Causes trouvées sur le PC : `functions/package-lock.json` modifié localement le 23 nov. (lien « alfamous1: file:.. »
  ajouté par une installation npm) faisait arrêter le script sur « modifications locales » ; et les commandes git
  lancées dans des sous-invites (`for /f`) subissaient le réglage AutoRun du PC, qui les renvoie vers Desktop\Alfamous.
- Correctifs : les deux `package-lock.json` (régénérés par npm) sont remis à leur version GitHub avant la
  vérification ; plus aucune commande git en sous-invite (fichiers temporaires dans %TEMP%\essai-alfamous1) ;
  la fermeture des fenêtres garde la fenêtre du script et tous ses parents ; journal `essai-local.log` dans le
  dossier (non versionné) pour le diagnostic à distance.

### Modifié — procédure fixe d'essai local (`ESSAI_LOCAL.bat`, branche `outils/essai-local`)
- Un double-clic : ferme toutes les autres fenêtres cmd.exe, les émulateurs et le serveur local ; récupère la
  dernière version préparée (branche la plus récente sur GitHub, ou `main`) et l'affiche ; s'arrête sans rien changer
  s'il y a des modifications locales ; puis outils, émulateurs, données d'essai, application et navigateur.
  `ESSAI_LOCAL.bat main` ou `ESSAI_LOCAL.bat <branche>` pour une version précise. Le script s'exécute depuis une
  copie dans %TEMP% (changer de branche ne le modifie pas en cours de route). README et CLAUDE.md (règle 9) à jour.
### Modifié — lecture, commentaires et champs (branche `interface/lecture-commentaires`, demande de l'auteur du 26 nov.)
- En-tête : le choix de la traduction passe sous la ligne des exemples et s'appelle « Commentaires traditionnels »
  (option « aucun ») ; une note ℹ️ sous les exemples : « Le latin est cherché dans la translittération, les
  commentaires Alfamous et le commentaire traditionnel choisi ». Le choix « Chercher le latin dans » est supprimé.
- Recherche en lettres latines (`chercherLatin`, `recherche.js`) : à la fois dans la translittération, dans le
  commentaire traditionnel choisi et dans les commentaires Alfamous des versets (lus une fois par session sur le
  serveur, masqués exclus, relus après chaque écriture). Chaque résultat indique « Trouvé dans : … » ; la
  translittération s'ouvre quand elle contient le mot, le commentaire traditionnel s'affiche surligné quand c'est lui.
- Le commentaire traditionnel choisi n'est plus sous chaque verset : il s'affiche en tête des commentaires du verset
  (bouton Commentaires), et le bouton le compte (ex. « 3 commentaires » = 2 Alfamous + 1 traditionnel).
- Translittération masquée par défaut ; bouton « Aa » à côté de ▶ sur chaque verset pour l'afficher ou la masquer.
- Onglet « Mes Notes » renommé « Notes », visible pour tous : sans connexion, « Connectez-vous pour utiliser Notes »
  avec Se connecter / Créer un compte ; courriel non vérifié, message dédié. « Mes Notes liées » → « Notes liées ».
- Icônes devant les boutons Modifier, Supprimer… et Enregistrer… de tous les écrans, et « Copier » / « Effacer »
  (avec « Annuler » pendant 8 s) sous chaque champ d'édition (commentaires, définitions, notes, réponses, motifs,
  article, Dossier pour Claude en copie seule) : module `src/js/champs.js`.
- Renvois dans les commentaires, définitions et notes : en plus de 3:14 et r:رحم, `r:3.14` (verset), `r:1`
  (sourate, dès 1:1), `p50` (page), `m:رحم+سلم` et `m:abc+xyz` (recherche de mots) ; un nombre seul reste du texte.
  Aide des champs mise à jour (`AIDE_RENVOIS`).
- Tests : `tests/lecture-commentaires.test.mjs` (recherche latine, icônes) et renvois ; `npm test` 96/96. Essai dans
  Chrome (ordinateur et 375 px), avec une traduction d'essai non versionnée.

### Ajouté — écouter et suivre la lecture (branche `lecture/ecouter-suivre`, cadrage `docs/LECTURE-AUDIO.md`)
- Bouton « écouter » rond à côté de la référence de chaque verset (onglet Lecture) : lit à partir de ce verset.
  Nom accessible « Écouter à partir du verset 3:14 », zone de toucher de 44 px.
- Lecture continue, un audio par verset : verset suivant à la fin de chaque verset, y compris d'une sourate à
  l'autre ; arrêt avec « Fin du texte » après 114:6 ; verset suivant préchargé. Récitation de Muhammad Ayyoub
  (récitateur du complexe du roi Fahd, choix de l'auteur), 128 kbps, publiée par EveryAyah
  (`Muhammad_Ayyoub_128kbps`), lue sur place, rien copié dans le dépôt ni dans Storage ; source isolée
  dans `urlAudio` (`src/js/lecteur-outils.js`) pour pouvoir en changer. Droits à vérifier avant la production.
- Suivi dans la page : le verset en cours est encadré et surligné, et placé entre l'en-tête et la fenêtre. Lecture
  lancée depuis une sourate ou une page : la page suit (versets de plus chargés, sourate ou page suivante ouverte,
  sans noter ces changements dans l'historique des recherches), seulement si elle suivait déjà (on peut consulter
  autre chose pendant l'écoute). Depuis une recherche : la liste reste, la fenêtre propose « Aller au verset ».
- Fenêtre de lecture (`src/js/lecteur.js`) attachée à la page entière : reste ouverte d'un onglet à l'autre.
  Référence et sourate, texte arabe et translittération (données du dépôt), lecture/pause, précédent/suivant,
  vitesse 0,75 · 1 · 1,25 · 1,5 (retenue dans le navigateur), réduire (pastille, aussi par Échap), fermer (= arrêt).
  Carte en bas à droite sur ordinateur, panneau en bas sur téléphone ; thèmes clair et sombre ; masquée à l'impression.
- « Reprendre à » : `p3` → premier verset de la page 3, `3` → 3:1, `3.14` → 3:14, analysés par `analyserRequete`
  (la même fonction que le champ de recherche) ; autre saisie refusée avec un message.
- Erreurs : fichier ou réseau indisponible → pause et message (pas de saut silencieux) ; lecture refusée par le
  navigateur → « Appuyez sur lecture pour démarrer ». Annonce du verset au lecteur d'écran (`aria-live`).
- `versetVoisin` partagé entre les boutons ⌃/⌄ des versets et le lecteur (plus de copie dans `app.js`).
- Tests `tests/lecteur.test.mjs` (14) : saisie, enchaînement, changement de sourate, fin du texte, pause, précédent/
  suivant, arrêt, erreurs, vitesse ; `npm test` 91/91. Essai dans Chrome (ordinateur et 375 px, sons de remplacement) :
  2:284 → 3:1 avec ouverture de la sourate 3, au-delà du 50e verset, onglet Forum, retour à Lecture, recherche puis
  « Aller au verset », Échap, fermeture sans son résiduel.

### Ajouté — sous-domaine forum.alfamous.ca
- Sur `forum.alfamous.ca` (même site Hosting que l'atelier), l'accueil ouvre directement l'onglet Forum (`/#/forum`), comme `blog.alfamous.ca` ouvre les articles. Aucun effet sur les autres domaines.

### Modifié — champ de recherche et champs de saisie (branche `interface/recherche`, maquette `docs/maquettes/recherche.html`)
- Bouton de recherche : une loupe (SVG intégré) au lieu du texte « Chercher » ; nom accessible « Chercher »
  (`aria-label`, info-bulle), la touche Entrée valide toujours. Bouton de 46 px au lieu de 102 px : le champ gagne
  56 px sur iPhone (233 → 289 px en largeur 375 px).
- Police d'au moins 16 px dans tous les champs de saisie (en dessous, l'iPhone zoome quand on touche le champ ; le zoom
  reste permis, pas de `maximum-scale` ni de `user-scalable=no`). Champs corrigés : « Comparer avec » et « Chercher
  le latin dans » (en-tête, 14 px), niveau d'un membre (14 px), panneau Contexte des articles — 11 champs « Ajouter »
  (14 px), type de point à vérifier et note d'un verset (13 px) —, code HTML de l'article et Dossier pour Claude
  (13 px), texte d'une note dans l'éditeur de Mes Notes (14 px : `font: inherit` reprenait la taille du libellé ; trouvé
  par le relevé dans le navigateur). Règle de base `input, select, textarea { font-size: max(16px, 1em) }` : un champ
  prend la taille de son parent, jamais moins de 16 px (couvre aussi les champs ajoutés plus tard). Les autres champs
  étaient déjà à 16, 17 ou 18 px.
- Thème sombre : la croix d'effacement du champ de recherche était de la couleur du fond (règle qui visait tous les
  boutons de la recherche) ; la règle ne vise plus que la loupe.
- Test `tests/champs-16px.test.mjs` : aucune règle de `app.css` ne met un champ sous 16 px, zoom non bloqué, loupe
  avec son nom accessible, champ en `font: inherit` sans taille ; `npm test` 77/77.
- Relevé dans le navigateur intégré sur les émulateurs du PC, connecté en admin d'essai : 82 champs en largeur 375 px
  et 65 en largeur ordinateur (lecture et commentaires, lexique et entrée, nouvelle entrée, articles, éditeur et
  panneau Contexte, Dossier pour Claude, insérer un verset, Mes Notes et nouvelle note, forum et fil, membres), tous à
  16 px ou plus. Recherche lancée par Entrée et par la loupe.
- Clavier arabe à l'écran : maquette faite, mise en œuvre remise à plus tard à la demande de l'auteur.

### Ajouté — onglet Articles, étape 6 : pages publiques, plan du site, flux, redirections de l'ancien blog
- `npm run construire -- --articles --projet essai|prod` : lit les articles publiés (clé de service hors dépôt) et écrit
  dans `dist/` une page par article (`/articles/<slug>/` : HTML assaini de nouveau, canonical, Open Graph, données
  structurées, date Blogger, versets liés vers l'atelier, « Lire et commenter dans l'atelier »), la liste par famille
  (`/articles/`, filtrée par libellé à `/articles/libelle/<libellé>/`), le flux Atom (`/articles/flux.xml`, 50 derniers
  articles), `/sitemap.xml` et `/robots.txt`. Feuille `src/css/articles-public.css`.
- alfamous-essai : pages `noindex` et `robots.txt` fermé ; seule la production (`blog.alfamous.ca`) est indexée.
- `firebase.json` : 213 redirections 301 de l'ancien blog (207 articles, libellés, flux, recherche, pages, archives)
  et la réécriture des pages de libellé ; vérifiées avec l'émulateur Hosting. Sur `blog.alfamous.ca`, l'accueil mène
  à `/articles/`.
- `deployerAlfamous1.bat` construit les pages avec la clé `%USERPROFILE%\cles\alfamous-<projet>.json` ; sans clé, il
  demande s'il faut continuer sans les pages. 13 tests (`tests/pages-articles.test.mjs`) ; `npm test` 72/72.

### Ajouté — onglet Articles, étape 5 : import du blog Blogger « Zoom-Coran »
- `npm run importer:articles` (`scripts/importer-articles.mjs`, `scripts/lib/import-articles.mjs`) : lit la sauvegarde
  Takeout `import/articles/feed.atom` et la fiche `import/articles/controle-familles.csv` (hors Git). À blanc par
  défaut (rapport `rapport-import.txt`, fiche `controle-import.csv`) ; `--ecrire`, `--verifier`, `--purger` ;
  émulateurs, `--projet essai`, `--projet prod` (confirmation PROD) ; `--forcer`.
- Articles : publiés → `publie` (adresse reprise de Blogger ; adresses identiques → titre complet), brouillons →
  `brouillon` ; signés Amha Nathali et reliés à son compte ; famille d'après la fiche ; libellés Blogger ; HTML
  assaini (34 `<style>`, 1 `<script>`, 3 cadres non YouTube retirés) ; versets repérés marqués « cités » ; version 1
  publiée, atelier, adresse réservée ; champ `import` (source, URL, dates et libellés Blogger).
- Images (205) téléchargées depuis Blogger et copiées dans Storage (`articles/<id>/images/blogger-…`), adresses
  réécrites ; une image introuvable garde son adresse Blogger et figure dans le rapport.
- Commentaires (51) : type `article`, « Anonymous » → Anonyme, « Amha NathAli » → Amha Nathali (relié à son compte),
  supprimés écartés (2), réponses précédées de « ↪ en réponse à … » ; les 14 de la page brouillon « Zoom-Coran » →
  fil du forum « Commentaires de l'ancienne page Zoom-Coran ».
- Un article modifié dans l'atelier depuis l'import n'est pas écrasé par un nouvel import (sauf `--forcer`).
- `deployerAlfamous1.bat` et le README déploient aussi les règles Storage (`--only hosting,firestore,functions,storage`),
  nécessaires aux images et fichiers des articles.
- Essai complet sur les émulateurs : 210 articles et 51 commentaires écrits, vérification conforme.
- `lireCsv` accepte un séparateur (« ; »). 6 tests (`tests/import-articles.test.mjs`) ; `npm test` 58/58.

### Ajouté — onglet Articles, étape 3b : panneau Contexte complet, liens, Dossier pour Claude
- Panneau **Contexte** (`src/js/articles-contexte.js`) : versets, racines (occurrences et versets d'après
  `racines.json`), entrées du lexique, sources, fichiers, discussions du forum (fils liés à l'article repérés
  automatiquement, ou ajoutés par leur adresse), Mes Notes liées, **vérification** (fait / déduction / hypothèse,
  « vérifié » ; rappel à la publication, sans bloquer), **définitions proposées** « à valider » (publiées au lexique
  seulement sur décision, avec confirmation), recherches Alfamous, articles liés (affichés en bas de l'article).
- **Dossier pour Claude** : brouillon et contexte en Markdown (consignes selon la famille, règle d'or, versets copiés
  de `donnees/texte`, occurrences des racines, définitions publiées du lexique, vérification, sources, notes, fils,
  articles liés, demande) ; modifiable, copier ou télécharger `.md`.
- **Articles sous les versets** (`src/js/articles-liens.js`) : ligne « Articles : … » sous chaque verset cité par un
  article publié (une requête par lot de 10 sourates affichées). **Fiche du lexique** : bloc « Articles ».
- **Ajouter au contexte…** (rédacteurs) : depuis la barre de sélection des versets et depuis la fiche du lexique.

### Ajouté — onglet Articles, étape 3a : liste, lecture, éditeur, publication
- Onglet **Articles** dans le menu (`src/js/articles.js`) : liste `#/articles` (familles, libellés, filtre des titres
  et résumés, 30 par page ; brouillons et articles retirés visibles des rédacteurs), lecture `#/article/<adresse>`
  (texte assaini, versets cités, sources, commentaires de type `article`, ligne du forum « cet article »).
- **Éditeur maison** (niveau ≥ 2) : modes Visuel et HTML, barre courte (titres, gras, italique, citation, listes,
  lien, image envoyée dans Storage, tableau, encadré, droite-à-gauche), « + Verset » (arabe et translittération copiés
  de `donnees/texte`), collage assaini, **import de fichiers** Word `.docx` (mammoth.js ; images envoyées dans
  Storage), HTML, Markdown, texte ; fichier d'origine rangé dans le contexte. Brouillon privé (`atelier/brouillon`),
  copie locale automatique (reprise proposée), « Enregistrer une version », historique (aperçu, restaurer),
  aperçu, publier (adresse vérifiée puis réservée), publier les modifications, retirer, republier.
- Panneau **Contexte** (étape 3a) : versets (cité, note, insérer), sources (publiées ou non), fichiers.
- `src/js/articles-assainir.js` (DOMPurify) : un seul assainissement pour l'affichage et l'enregistrement ;
  `src/js/articles-import.js` (Markdown, texte, Word). 8 tests (`tests/articles-assainir.test.mjs`,
  `tests/articles-import.test.mjs`, avec jsdom). `npm test` : 52/52.
- Bibliothèques servies par l'application (`vendor/`, `scripts/lib/vendor.mjs`) : DOMPurify 3.5 (MPL-2.0 ou
  Apache-2.0), mammoth.js 1.13 (BSD-2-Clause) ; SDK Firebase Storage ; relais de l'émulateur Storage (9199) dans
  `servir.mjs`. Index : libellé + famille.
- Articles d'essai dans `npm run emulateurs:peupler` (2 publiés, 1 brouillon, 1 commentaire).

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
- Création d'un article en deux requêtes (article, puis `atelier/brouillon`) : réunies dans un lot, les deux règles
  dépassaient la limite de 1 000 expressions par requête (tests sur le PC, 24 nov.). Comparaisons d'ensembles et
  garde-fou `resource != null` dans les règles des articles.

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
