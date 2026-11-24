# Onglet « Articles » — cadrage (24 nov. 2026)

Chantier : un onglet **Articles** dans Alfamous1, prolongement du lexique, pour remplacer à terme le blog Blogger
« Zoom-Coran » (blog.alfamous.ca). Branche `articles/onglet`. Maquette : `docs/maquettes/articles.html`.
**Rien n'est codé** tant que ce cadrage et la maquette ne sont pas acceptés. Les points marqués **[Q n]** attendent
une décision de l'auteur (liste à la fin).

Constats de départ (vérifiés le 24 nov.) :
- Blogger : **207 articles** publiés (flux public `blog.alfamous.ca/feeds/posts/summary?alt=json`), 9 libellés :
  Les mots du Coran, Développement personnel, Société, Politique, Divers, Conférences, Livres, Outils,
  Sciences & Philosophie. La plupart des articles récents n'ont aucun libellé.
- `articles-format-html.js` (copie du dépôt de l'ancienne application) : 219 blocs, environ 2 Mo ; plus gros article
  34 Ko ; 35 balises `<style>`, 1 `<script>`, 6 `<iframe>`, 63 tableaux, 3 139 attributs `style=""` ;
  images sur `blogger.googleusercontent.com`. L'écart 219 / 207 est à expliquer avant l'import (copie ancienne,
  articles supprimés ou passés en brouillon sur Blogger).

## 1. Ce que l'onglet fait

| Écran | Adresse | Qui |
| --- | --- | --- |
| Liste des articles (comme Lecture liste les sourates) : filtres par famille et par libellé, recherche dans les titres et résumés, tri par date | `#/articles` | tous |
| Lecture d'un article : titre, famille, libellés, date, auteur, texte, versets cités, sources, commentaires, discussions du forum liées | `#/article/<slug>` | tous (publié) |
| Éditeur : texte + panneau « Contexte » ; brouillon, aperçu, publication, historique, « Dossier pour Claude » | `#/article/<id>/modifier`, `#/articles/nouveau` | rédacteurs **[Q1]** |
| Encadré « Articles » sous un verset cité et dans la fiche du lexique | (lecture, résultats, `#/lexique/<clé>`) | tous |
| Page publique indexable, une par article, générée au déploiement | `/articles/<slug>/` | tous, moteurs de recherche |

Familles (fixes, celles du hub Blog) : `racines` (analyses de racines), `critiques`, `identite` (identité amazighe
& kabyle), `reflexions` (autres réflexions). Libellés : libres (10 au plus par article), proposés à partir des
libellés existants.

## 2. Modèle de données

### `articles/{id}` — l'article (partie publique)
Identifiant automatique ; l'adresse lisible est le `slug`, fixé à la première publication (réservé dans
`slugs/{slug}` dans le même lot, pour l'unicité).

| Champ | Type | Contenu |
| --- | --- | --- |
| `titre` | texte | ≤ 200 caractères |
| `slug` | texte \| null | `[a-z0-9-]{3,100}` ; null tant que l'article n'a jamais été publié |
| `famille` | texte | `racines` \| `critiques` \| `identite` \| `reflexions` |
| `libelles` | liste | ≤ 10 libellés de ≤ 40 caractères |
| `resume` | texte | ≤ 500 caractères (liste, page publique, réseaux sociaux) |
| `image` | texte \| null | Chemin Storage de l'image de couverture |
| `corps` | texte | HTML assaini (§ 5), ≤ 300 000 caractères (le plus gros article actuel fait 34 Ko) |
| `statut` | texte | `brouillon` (jamais publié) \| `publie` \| `retire` (dépublié, lisible des rédacteurs seulement) |
| `auteurUid`, `auteurNom` | texte | Signature (nom du compte, comme les commentaires) |
| `creeLe`, `modifieLe`, `publieLe`, `republieLe` | horodatages serveur | `publieLe` = première publication |
| `versets` | liste | Versets cités `s:v` (≤ 300) : affichage sous les versets |
| `sourates` | liste d'entiers | Sourates des versets cités : **une seule requête** par sourate affichée |
| `racines`, `lexique` | listes | Racines et clés du lexique liées (sans voyelles) : encadré de la fiche du lexique |
| `sources` | liste | `{ titre, url, note }` publiées en bas de l'article |
| `nbVersions` | entier | Versions enregistrées |
| `import` | objet \| absent | `{ source: 'Blogger', bloggerId, url, publieBlogger, modifieBlogger, libellesBlogger }` |

Lecture : tout le monde si `statut == 'publie'` ; rédacteurs toujours. Les listes publiques filtrent
`where statut == 'publie'` (index composites : statut + publieLe, statut + famille + publieLe,
statut + libelles + publieLe, statut + sourates, statut + versets, statut + racines, statut + lexique).

### `articles/{id}/atelier/brouillon` — la version de travail (privée)
`{ titre, famille, libelles, resume, image, corps, contexte, majLe, majPar }`. C'est elle que l'éditeur modifie.
Un article publié n'est **pas** modifié en direct **[Q2]** : « Publier les modifications » recopie le brouillon dans
le document public (et crée une version) dans un seul lot. Lisible et modifiable par les rédacteurs seulement.

### Le panneau « Contexte » (`contexte` dans le brouillon)
| Élément | Contenu | D'où il vient |
| --- | --- | --- |
| Versets | `{ ref, note, cite }` ; `cite` = affiché publiquement sous le verset | Sélection existante → « Ajouter au contexte » ; ou saisie `2:183` |
| Racines | clés ; nombre d'occurrences calculé depuis `donnees/racines.json` | Fiche d'un mot, résultats `r:…`, saisie |
| Entrées du lexique | clés ; définitions lues dans `commentaires` (type lexique) | Fiche du lexique → « Ajouter au contexte » |
| Fichiers et images | `{ chemin, nom, type, taille }` dans Storage | Dépôt par glisser-déposer |
| Sources et liens | `{ titre, url, note, publique }` | Saisie |
| Discussions du forum | identifiants de fils (`notes` publiées) | Fil → « Ajouter au contexte » ; un fil peut être lié à l'article (`lien.type = 'article'`) |

Éléments proposés en plus :
- **Mes Notes liées** (notes privées de l'auteur, jamais publiées) ;
- **Vérification** : liste de points classés *fait / déduction / hypothèse*, avec « vérifié » coché ou non
  (méthode de l'auteur) ; un point non vérifié est signalé à la publication, sans bloquer ;
- **Définition proposée pour le lexique** : texte + clé, statut « à valider » ; elle n'est publiée au lexique
  (comme définition signée) que sur décision de l'auteur, jamais automatiquement ;
- **Recherches Alfamous** gardées (ex. `r:صوم`, `صوم 2:183`) avec leurs chiffres, rejouables d'un clic ;
- **Commentaires traditionnels** des versets du contexte (traductions tanzil.net) pour la comparaison, surtout
  pour la famille « critiques » ;
- **Articles liés** (affichés en bas de l'article) ;
- **Résumé court** pour les réseaux sociaux (≤ 280 caractères).

### `articles/{id}/versions/{n}` — historique
`{ titre, corps, resume, famille, libelles, le, parUid, parNom, publiee }`. Une version à chaque
« Enregistrer une version » et à chaque publication (`publiee: true`) **[Q3]** ; l'éditeur garde en plus une copie
locale du brouillon toutes les 30 s (perte de connexion). Écran : liste, aperçu, comparaison avec la version
actuelle, « Restaurer dans le brouillon ». Versions jamais modifiées ni supprimées (sauf suppression de l'article,
niveau 3).

### Commentaires sur les articles — même modèle que les versets
`commentaires/{id}` avec `type: 'article'` et `cle` = identifiant de l'article : mêmes champs, versions, masquage,
signalements, limite de 20 publications par heure. Règle ajoutée : on ne commente qu'un article publié.
Les discussions longues passent par le forum (« Ouvrir une discussion » crée un fil lié à l'article).

### Storage (aujourd'hui tout fermé)
- `articles/{id}/images/{fichier}` : images du texte et de couverture ; **lecture publique** (noms aléatoires),
  écriture par les rédacteurs ; images seulement, ≤ 5 Mo.
- `articles/{id}/fichiers/{fichier}` : fichiers de travail du contexte (PDF, captures…) ; lecture et écriture par
  les rédacteurs ; ≤ 25 Mo.
- Tout le reste reste fermé. Règles testées à l'émulateur Storage (`npm run test:regles`, sur le PC).

## 3. Droits — qui écrit et publie un article [Q1]
Proposition : un article est un texte d'auteur, pas une contribution de la communauté.

| Action | 0 | 1 | 2 | 3 |
| --- | --- | --- | --- | --- |
| Lire les articles publiés, leurs commentaires et sources | ✓ | ✓ | ✓ | ✓ |
| Commenter un article publié ; signaler un commentaire ; ouvrir une discussion | — | ✓ | ✓ | ✓ |
| Masquer un commentaire d'article | — | — | ✓ | ✓ |
| Créer, modifier, publier, retirer un article ; voir les brouillons ; contexte et fichiers | — | — | — | ✓ |
| Supprimer définitivement un article | — | — | — | ✓ |

Option à trancher : un rôle **rédacteur** (revendication `redacteur: true`, posée dans l'onglet Membres) pour
ouvrir l'écriture à d'autres sans les rendre admins ; un rédacteur ne modifierait que ses propres articles.
La règle d'or du Blog s'applique à tout contenu coranique, quel que soit l'auteur.

## 4. Éditeur [Q4]
Les articles existants sont du HTML riche (sections, tableaux, encadrés, arabe en ligne). L'éditeur doit le garder.

| Choix | Pour | Contre |
| --- | --- | --- |
| **TinyMCE 7, auto-hébergé (recommandé)** | Garde le HTML existant (éléments autorisés réglables), mode « code source », tableaux, droite-à-gauche, collage nettoyé, envoi d'images vers Storage ; servi par l'application comme le SDK Firebase (`vendor/`), chargé seulement dans l'éditeur | Lourd (quelques centaines de Ko, chargé à la demande) ; licence GPL v2+ annoncée pour l'auto-hébergement, **compatible GPL v3 à vérifier** avant de l'ajouter |
| Éditeur maison (`contenteditable` + barre d'outils + mode HTML) | Aucune dépendance, dans l'esprit du code actuel | Plus de code à maintenir ; collage et tableaux fragiles |
| Quill, CKEditor 5, TipTap | Modernes | Modèle de document strict : perdent les sections, encadrés et tableaux des articles importés |

Dans tous les cas : deux modes, **Visuel** et **HTML** (pour coller le HTML produit avec Claude) ; arabe seul sur sa
ligne et translittération dans le texte (gabarit du blog) ; bouton « Insérer un verset » qui insère le texte copié
de `donnees/` (jamais tapé à la main).

## 5. HTML assaini
Un seul module (`src/js/articles-assainir.js`), utilisé à l'enregistrement, à l'affichage et à la génération des
pages publiques (DOMPurify, servi par l'application ; côté Node avec jsdom) :
- retirés : `<style>`, `<script>`, `<link>`, `<meta>`, `<form>`, attributs `on…`, liens `javascript:` ;
- attributs `style=""` : seules `text-align` et `direction` gardées (les couleurs et fonds codés en dur rendaient
  des passages illisibles en thème sombre, chantier 7 de l'ancienne application) ;
- `<iframe>` : retirés, sauf vidéos YouTube converties en `youtube-nocookie.com` **[Q6]** ;
- liens externes : `rel="noopener"`, ouverture dans un nouvel onglet.

Effet à connaître : les **35 articles avec une feuille `<style>`** perdent leur mise en forme propre. Proposition :
une feuille commune des articles dans l'application (titres, encadrés, citations, versets, tableaux), lisible en
clair et en sombre ; la fiche de contrôle de l'import liste ces 35 articles pour une relecture **[Q5]**.

## 6. Import des articles existants
**Source recommandée : Blogger** (pas `articles-format-html.js`).

| | Blogger | articles-format-html.js |
| --- | --- | --- |
| Identifiant, URL d'origine (redirections) | ✓ | — |
| Date de publication et de mise à jour | ✓ | date de mise à jour seulement, au format local |
| Libellés | ✓ | — |
| Contenu complet | ✓ | modifié (image de tête sortie du texte, liens d'images retirés) |
| À jour | ✓ | copie dérivée (écart 219 / 207) |

Lecture par le flux public (`/feeds/posts/default?alt=json`, sans clé) ou par l'API Blogger v3 avec la clé déjà
utilisée par LexData (gardée hors du dépôt). Les brouillons Blogger ne sont pas lus.

Étapes (script `npm run importer:articles`, sur le modèle de la phase 4, lancé sur le PC) :
1. **À blanc** (par défaut) : lecture de Blogger, assainissement, slug repris de l'URL Blogger
   (`/2026/02/aberration-1-1926-et-le-sawm-fige-en.html` → `aberration-1-1926-et-le-sawm-fige-en` ; slugs
   génériques comme `blog-post` complétés par la date), famille **proposée** (libellé « Les mots du Coran » ou titre
   « racine … » → `racines` ; sinon à choisir), versets cités repérés dans le texte (`19:26`, `19.26`, `(2:183)`).
   Sortie : `import/articles/rapport.txt` et `import/articles/controle.csv` (une ligne par article : titre, URL,
   famille proposée, libellés, versets repérés, images, `<style>` retirés, iframes).
2. **Relecture par l'auteur** de la fiche : famille de chaque article (colonne à remplir), versets à garder.
3. **Écriture** (`--ecrire`) : images téléchargées de `blogger.googleusercontent.com` vers
   `articles/{id}/images/`, `src` réécrits ; articles écrits avec `statut: 'publie'`, dates Blogger, signés
   Amha Nathali (relié à son compte), champ `import` ; identifiants stables (`imp-b-<id Blogger>`) pour relancer
   sans doublon.
4. **Vérification** (`--verifier`) : nombre d'articles, titres, images toutes copiées, aucun `<style>`/`<script>`.
5. Émulateurs, puis `--projet essai`, puis `--projet prod` (confirmation PROD) le jour de la bascule.

Commentaires Blogger : à importer ou non **[Q7]**.

## 7. Production assistée par IA
**Étape 1 — bouton « Dossier pour Claude »** (aucun coût, aucune clé) : texte structuré copié dans le presse-papiers
et téléchargeable (`dossier-<slug>.md`) :
1. en-tête : titre, famille, libellés, consignes de la famille (règle d'or si contenu coranique) ;
2. brouillon actuel (HTML) ;
3. versets du contexte : référence, arabe, translittération, **copiés des fichiers `donnees/`** au moment de la
   création du dossier, avec la mention de la source ; jamais reconstitués de mémoire ;
4. racines : nombre d'occurrences et liste des références (`donnees/racines.json`) ;
5. définitions du lexique liées (texte, signature, date), conflits laissés visibles ;
6. sources, points de vérification, notes ;
7. demande à Claude (modifiable).
On colle le dossier dans une conversation « [Blog] … », on recolle le HTML obtenu dans le mode HTML de l'éditeur.

**Étape 2 — appel direct à l'API (plus tard, à discuter)** : une Cloud Function réservée aux rédacteurs,
clé dans Secret Manager (jamais dans Git ni dans le navigateur), plafond mensuel, journal des appels, réponse
déposée dans le brouillon (jamais publiée directement). Coût à chiffrer avant.

## 8. Pages publiques et redirection
- **Génération au déploiement** : `npm run construire -- --articles` lit les articles publiés (clé de compte de
  service hors dépôt, comme `npm run importer`) et écrit dans `dist/` : `/articles/<slug>/index.html` (HTML assaini,
  titre, description, `canonical`, Open Graph, données structurées `Article`, liens vers les versets dans
  l'application), `/articles/index.html` (liste par famille), `/sitemap.xml`, `/robots.txt`, `/articles/flux.xml`
  (flux Atom pour les abonnés du flux Blogger). Une publication apparaît sur ces pages au déploiement suivant
  (`deployerAlfamous1.bat`) ; l'onglet Articles, lui, est à jour tout de suite.
- **Commentaires** : sur la page publique, lien « Lire et commenter dans l'atelier » (la page reste statique).
- **Redirection de blog.alfamous.ca (le jour de la bascule)** : le domaine est ajouté à Firebase Hosting
  (même site), puis le DNS de `blog` est changé chez le registraire (aujourd'hui vers Blogger). Redirections 301,
  générées une fois depuis l'import et inscrites dans `firebase.json` : chaque `/AAAA/MM/<slug>.html` →
  `/articles/<slug>/` ; `/search/label/<libellé>` → `/articles/?libelle=…` ; `/feeds/posts/default` →
  `/articles/flux.xml` ; le reste → `/articles/`. Le blog Blogger reste en archive (privé), jamais supprimé.
  Domaine des pages : `atelier.alfamous.ca/articles/…` ou `blog.alfamous.ca/articles/…` **[Q8]**.

## 9. Affichage dans le reste de l'application
- **Sous un verset cité** (lecture d'une sourate, résultats) : ligne « Articles : <titre> » à côté de la ligne du
  forum. Une requête par sourate affichée (`sourates array-contains n`), puis tri par verset côté navigateur ; pour les
  résultats de recherche, une requête par lot de 30 versets. Seuls les versets marqués « cité » comptent **[Q9]**.
- **Fiche du lexique** : bloc « Articles » (articles dont `lexique` ou `racines` contient la clé), après les
  définitions.
- **Sélection de versets** : la barre Aperçu · Copier · Vider gagne « Ajouter au contexte… » (choix de l'article,
  rédacteurs seulement).

## 10. Étapes proposées (une PR chacune, rien dans main sans accord)
1. Cadrage + maquette (cette PR).
2. Données et règles : `articles`, `atelier`, `versions`, `slugs`, type de commentaire `article`, Storage ;
   tests à l'émulateur.
3. Onglet Articles (liste, lecture, commentaires) + éditeur, brouillon, publication, historique.
4. Panneau Contexte, « Ajouter au contexte », encadrés sous les versets et dans le lexique, « Dossier pour Claude ».
5. Import depuis Blogger (à blanc, relecture, émulateurs, essai).
6. Pages publiques, plan du site, flux ; redirections préparées (activées le jour de la bascule).

## Questions pour l'auteur
- **Q1** Qui écrit et publie : admins seulement (proposé), ou rôle « rédacteur » attribué dans Membres ?
- **Q2** Article publié : modifications en brouillon jusqu'à « Publier les modifications » (proposé), ou en direct ?
- **Q3** Versions : à chaque « Enregistrer une version » et à chaque publication (proposé), ou à chaque enregistrement ?
- **Q4** Éditeur : TinyMCE auto-hébergé (proposé, licence à vérifier) ou éditeur maison ?
- **Q5** Les 35 articles à `<style>` : feuille commune + relecture (proposé) ?
- **Q6** Vidéos YouTube intégrées : garder (proposé) ou remplacer par un lien ?
- **Q7** Commentaires Blogger : importer ou laisser ?
- **Q8** Adresse des pages publiques : `blog.alfamous.ca/articles/…` (garde le nom connu des lecteurs, proposé) ou
  `atelier.alfamous.ca/articles/…` ?
- **Q9** Sous les versets : seulement les versets marqués « cité » (proposé), ou tous les versets du contexte ?
