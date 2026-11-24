# Onglet « Articles » — cadrage (24 nov. 2026)

Chantier : un onglet **Articles** dans Alfamous1, prolongement du lexique, pour remplacer à terme le blog Blogger
« Zoom-Coran » (blog.alfamous.ca). Branche `articles/onglet`. Maquette : `docs/maquettes/articles.html`.
**Rien n'est codé** tant que ce cadrage et la maquette ne sont pas acceptés. Décisions de l'auteur du 24 nov. :
droits dès le niveau 2, éditeur maison simple avec import de fichiers Word, commentaires Blogger importés, éléments
du panneau Contexte choisis par Claude (§ 2). Le 24 nov., l'auteur a accepté toutes les autres propositions : le cadrage est accepté (décisions à la fin).

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
| Éditeur : texte + panneau « Contexte » ; brouillon, aperçu, publication, historique, « Dossier pour Claude » | `#/article/<id>/modifier`, `#/articles/nouveau` | rédacteurs (niveau ≥ 2) |
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
Un article publié n'est **pas** modifié en direct  : « Publier les modifications » recopie le brouillon dans
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

Éléments ajoutés (choisis par Claude le 24 nov., à la demande de l'auteur : ceux qui servent à écrire juste et à
préparer le « Dossier pour Claude ») :
- **Vérification** : points classés *fait / déduction / hypothèse*, « vérifié » coché ou non (méthode de l'auteur) ;
  les points non vérifiés sont rappelés à la publication, sans bloquer ; ils passent dans le dossier ;
- **Définition proposée pour le lexique** : clé + texte, statut « à valider » ; publiée au lexique (définition
  signée) seulement sur décision de l'auteur ; le dossier la confronte aux définitions existantes, conflits signalés ;
- **Recherches Alfamous** gardées (ex. `r:صوم`, `صوم 2:183`) avec leurs chiffres, rejouables d'un clic : les chiffres
  cités dans l'article restent vérifiables ;
- **Articles liés** : articles déjà publiés sur la même racine ou le même thème (affichés en bas de l'article) ;
  le dossier en donne les définitions pour repérer les écarts (comme ḥajj / ḥujja) ;
- **Mes Notes liées** : notes privées de l'auteur, jamais publiées.

Écartés : les *commentaires traditionnels* (traductions tanzil.net) dans le contexte — restent consultables dans la
lecture, mais ne doivent pas entrer dans le dossier qui sert à déduire le sens (règle d'or) ; le *résumé court*
(le champ « résumé » suffit).

### `articles/{id}/versions/{n}` — historique
`{ titre, corps, resume, famille, libelles, le, parUid, parNom, publiee }`. Une version à chaque
« Enregistrer une version » et à chaque publication (`publiee: true`)  ; l'éditeur garde en plus une copie
locale du brouillon toutes les 30 s (perte de connexion). Écran : liste, aperçu, comparaison avec la version
actuelle, « Restaurer dans le brouillon ». Versions jamais modifiées ni supprimées (sauf suppression de l'article,
niveau 3).

### Commentaires sur les articles — même modèle que les versets
`commentaires/{id}` avec `type: 'article'` et `cle` = identifiant de l'article : mêmes champs, versions, masquage,
signalements, limite de 20 publications par heure. Règle ajoutée : on ne commente qu'un article publié.
Les discussions longues passent par le forum (« Ouvrir une discussion » crée un fil lié à l'article).

### Storage (aujourd'hui tout fermé)
- `articles/{id}/images/{fichier}` : images du texte et de couverture ; **lecture publique** (noms aléatoires),
  écriture par les rédacteurs (niveau ≥ 2) ; images seulement, ≤ 5 Mo.
- `articles/{id}/fichiers/{fichier}` : fichiers de travail du contexte (PDF, captures, fichiers Word importés…) ;
  lecture et écriture par les rédacteurs ; ≤ 25 Mo.
- Tout le reste reste fermé. Règles testées à l'émulateur Storage (`npm run test:regles`, sur le PC).

## 3. Droits — qui écrit et publie un article (décidé le 24 nov. : niveau 2 et plus)
Un article est un texte d'auteur, pas une contribution de la communauté. Écriture et publication dès le niveau 2.

| Action | 0 | 1 | 2 | 3 |
| --- | --- | --- | --- | --- |
| Lire les articles publiés, leurs commentaires et sources | ✓ | ✓ | ✓ | ✓ |
| Commenter un article publié ; signaler un commentaire ; ouvrir une discussion | — | ✓ | ✓ | ✓ |
| Masquer un commentaire d'article | — | — | ✓ | ✓ |
| Créer un article, le modifier, le publier, le retirer — **ses propres articles** | — | — | ✓ | ✓ |
| Voir les brouillons des autres rédacteurs (lecture seule) | — | — | ✓ | ✓ |
| Modifier, publier, retirer l'article d'un autre | — | — | — | ✓ |
| Supprimer définitivement un article | — | — | — | ✓ |

Décidé : un modérateur ne modifie que ses articles, l'admin peut intervenir sur tous ; les
articles importés de Blogger appartiennent au compte d'Amha Nathali. Aucune revendication nouvelle : les règles
lisent le niveau déjà en place (`request.auth.token.niveau >= 2`).
La règle d'or du Blog s'applique à tout contenu coranique, quel que soit l'auteur.

## 4. Éditeur (décidé le 24 nov. : maison, simple, + import de fichiers Word)
Éditeur maison, sans dépendance lourde, dans l'esprit du code actuel :
- **mode Visuel** (`contenteditable`) avec une barre courte : titre de section, gras, italique, citation, liste,
  lien, image, tableau simple, encadré, « + Verset » (insère l'arabe et la translittération copiés de `donnees/`,
  jamais tapés à la main), sens d'écriture droite-à-gauche ;
- **mode HTML** : le code de l'article, pour coller le HTML produit avec Claude ou corriger finement ;
- collage nettoyé (le HTML collé passe par l'assainissement du § 5).

**Écrire ailleurs (Word, LibreOffice, Google Docs)** : bouton « Importer un fichier » dans l'éditeur.
- `.docx` (Word ; Google Docs et LibreOffice l'exportent) : converti en HTML dans le navigateur par **mammoth.js**
  (licence BSD-2, petite, servie par l'application comme le SDK Firebase), puis assaini. Gardés : titres (styles
  « Titre 1/2/3 »), paragraphes, gras, italique, listes, tableaux, liens, images (copiées dans Storage).
  Perdus : couleurs, polices, mises en page. Les paragraphes en arabe reçoivent `dir="auto"`.
- `.html`, `.md` et `.txt` aussi acceptés.
- Choix au moment de l'import : **remplacer** le brouillon ou **insérer** à l'endroit du curseur ; le fichier
  d'origine est rangé dans les Fichiers du contexte (privé), ce qui permet de le relire ou de le rejoindre à une
  conversation avec Claude ; le « Dossier pour Claude » reprend le texte converti.
- Pas d'aller-retour automatique : après l'import, la référence est le brouillon de l'atelier (le fichier Word n'est
  pas resynchronisé). Un export `.docx` du brouillon pourra s'ajouter plus tard si besoin.

## 5. HTML assaini
Un seul module (`src/js/articles-assainir.js`), utilisé à l'enregistrement, à l'affichage et à la génération des
pages publiques (DOMPurify, servi par l'application ; côté Node avec jsdom) :
- retirés : `<style>`, `<script>`, `<link>`, `<meta>`, `<form>`, attributs `on…`, liens `javascript:` ;
- attributs `style=""` : seules `text-align` et `direction` gardées (les couleurs et fonds codés en dur rendaient
  des passages illisibles en thème sombre, chantier 7 de l'ancienne application) ;
- `<iframe>` : retirés, sauf vidéos YouTube converties en `youtube-nocookie.com` ;
- liens externes : `rel="noopener"`, ouverture dans un nouvel onglet.

Effet à connaître : les **35 articles avec une feuille `<style>`** perdent leur mise en forme propre. Proposition :
une feuille commune des articles dans l'application (titres, encadrés, citations, versets, tableaux), lisible en
clair et en sombre ; la fiche de contrôle de l'import liste ces 35 articles pour une relecture.

## 6. Import des articles existants
**Source : Blogger, pour tous les articles** (décision de l'auteur, 24 nov.) ; `articles-format-html.js` n'est pas
utilisé. Tous les articles du blog sont d'Amha Nathali : ils sont signés de son nom et reliés à son compte.

| | Blogger | articles-format-html.js |
| --- | --- | --- |
| Identifiant, URL d'origine (redirections) | ✓ | — |
| Date de publication et de mise à jour | ✓ | date de mise à jour seulement, au format local |
| Libellés | ✓ | — |
| Contenu complet | ✓ | modifié (image de tête sortie du texte, liens d'images retirés) |
| À jour | ✓ | copie dérivée (écart 219 / 207) |

**Sauvegarde reçue le 24 nov.** (export Google Takeout de Blogger, `Takeout/Blogger/Blogs/Zoom-Coran/feed.atom`,
2,6 Mo, rangé dans `Desktop\Alfamous1\import\articles`, hors Git) — contenu constaté :
- **210 articles** (`POST`) : 207 publiés (du 24 nov. 2022 au 4 août 2026) et 3 brouillons ; aucun dans la corbeille ;
  tous signés « Amha NathAli » ; 70 portent un libellé (Les mots du Coran 41, Développement personnel 21, Société 10,
  Politique 7, Divers 5, Conférences 4, Livres 3, Outils 3, Sciences & Philosophie 2) ;
- **8 pages** (`PAGE`) : Bienvenue, Contact, Iqra, Abonnement, 🔍 (recherche), une page sans titre (modèle de fiche),
  et 2 brouillons (« À propos du projet Alfamous.ca », « Zoom-Coran ») — ce ne sont pas des articles ;
- **67 commentaires** : 65 publiés et 2 supprimés (`GHOSTED_COMMENT`, non importés) ; 40 anonymes sans nom,
  22 d'Amha NathAli, 1 chacun de Lynda, Yasmine, David Beaulieu ; 33 réponses (`inReplyTo`) ; **16 sont rattachés à
  la page brouillon « Zoom-Coran »** et non à un article : importés dans un fil du forum « Commentaires de
  l'ancienne page Zoom-Coran » (décision de Claude, l'auteur lui ayant laissé le choix le 24 nov.) ;
- dans les articles : 35 `<style>` (34 articles), 1 `<script>`, 6 `<iframe>`, 63 tableaux, 407 images sur
  `blogger.googleusercontent.com` (202 articles) ; plus gros texte 32 Ko.
- **Écart 219 / 207 expliqué** : l'ancienne copie de `articles-format-html.js` contient des doublons (6 titres) et des
  titres renommés depuis (« Qui est ton rassoul » → « Qui est ton rassoul (رسل) », etc.) ; 2 titres n'existent plus
  sur Blogger (« L'islam perdu dans la narration historique… », « الكُفْر ↔ الشُّكْر… »). La sauvegarde fait foi.
- Fiche de contrôle des familles (207 publiés + 3 brouillons) : `import/articles/controle-familles.csv`
  (familles relues titre par titre par Claude le 24 nov., à la demande de l'auteur : 92 racines, 54 autres
  réflexions, 50 critiques, 11 identité ; la colonne `famille_choisie` permet à l'auteur d'en corriger une ;
  versets repérés automatiquement, à vérifier).

**Fichier lu : la sauvegarde complète du blog** (Blogger › Paramètres › Gérer le blog › « Sauvegarder le contenu »,
fichier `.xml` au format Atom). Contrairement au flux public et à l'API avec clé, elle contient **tout** : articles
publiés, brouillons et articles programmés, pages statiques, et tous les commentaires avec le commentaire parent des
réponses. Le fichier est rangé dans `import/articles/` (hors Git). Le flux public sert seulement de contrôle (nombre
d'articles publiés : 207 le 24 nov.).
- Articles publiés → `statut: 'publie'` ; brouillons et articles programmés Blogger → `statut: 'brouillon'`
  (privés dans l'atelier, à reprendre) ; pages statiques Blogger → listées dans la fiche de contrôle (décision au cas
  par cas). L'écart 219 / 207 avec `articles-format-html.js` sera expliqué par cette sauvegarde.

Étapes (script `npm run importer:articles`, sur le modèle de la phase 4, lancé sur le PC) :
1. **À blanc** (par défaut) : lecture de Blogger, assainissement, slug repris de l'URL Blogger
   (`/2026/02/aberration-1-1926-et-le-sawm-fige-en.html` → `aberration-1-1926-et-le-sawm-fige-en` ; slugs
   génériques comme `blog-post` complétés par la date), famille **proposée** (libellé « Les mots du Coran » ou titre
   « racine … » → `racines` ; sinon à choisir), versets cités repérés dans le texte (`19:26`, `19.26`, `(2:183)`).
   Sortie : `import/articles/rapport.txt` et `import/articles/controle.csv` (une ligne par article : titre, URL,
   famille proposée, libellés, versets repérés, images, `<style>` retirés, iframes).
2. **Relecture par l'auteur** de la fiche : famille de chaque article (colonne à remplir), versets à garder.
3. **Écriture** (`--ecrire`) : images téléchargées de `blogger.googleusercontent.com` vers
   `articles/{id}/images/`, `src` réécrits ; articles écrits avec leur statut (§ ci-dessus), dates Blogger, signés
   Amha Nathali (relié à son compte), champ `import` ; identifiants stables (`imp-b-<id Blogger>`) pour relancer
   sans doublon.
4. **Vérification** (`--verifier`) : nombre d'articles, titres, images toutes copiées, aucun `<style>`/`<script>`.
5. Émulateurs, puis `--projet essai`, puis `--projet prod` (confirmation PROD) le jour de la bascule.

**Commentaires Blogger (décidé le 24 nov. : importés).** Lus dans la même sauvegarde. Le flux public
`/feeds/comments/default` en annonçait 67 le 24 nov. (sur 60 lisibles : 29 « Anonymous », 13 « Amha NathAli », 16 sans nom — supprimés sur Blogger —,
2 autres noms ; 30 portent un lien vers un autre commentaire). Règles (acceptées le 24 nov.), comme la phase 4 :
- écrits dans `commentaires/` avec `type: 'article'`, `cle` = identifiant de l'article, date Blogger, champ
  `import: { source: 'Blogger', bloggerId, parentId }`, identifiant stable `imp-bc-<id Blogger>` ;
- signatures harmonisées : « Amha NathAli » → « Amha Nathali » (relié à son compte) ; « Anonymous » → « Anonyme » ;
  autres noms gardés tels quels, sans compte ;
- commentaires supprimés sur Blogger (sans nom ni texte) : non importés ;
- réponses : pas de fil de réponses dans le modèle ; texte précédé de « ↪ en réponse à <nom> (<date>) : » ;
- listés dans la fiche de contrôle (une ligne par commentaire) avant l'écriture.

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

**Étape 2 — appel direct à l'API (plus tard, à discuter)** : une Cloud Function réservée aux rédacteurs (niveau ≥ 2),
clé dans Secret Manager (jamais dans Git ni dans le navigateur), plafond mensuel, journal des appels, réponse
déposée dans le brouillon (jamais publiée directement). Coût à chiffrer avant.

## 8. Pages publiques et redirection
- **Génération au déploiement** : `npm run construire -- --articles --projet essai|prod` lit les articles publiés
  (clé de compte de service hors dépôt, comme `npm run importer`) et écrit dans `dist/` : `/articles/<slug>/index.html`
  (HTML assaini de nouveau, titre, description, `canonical`, Open Graph, données structurées `Article`, date Blogger
  pour les articles importés, liens vers les versets dans l'atelier), `/articles/index.html` (liste par famille,
  aussi servie à `/articles/libelle/<libellé>/`, filtrée), `/sitemap.xml`, `/robots.txt`, `/articles/flux.xml`
  (flux Atom, 50 derniers articles, texte complet). Une publication apparaît sur ces pages au déploiement suivant
  (`deployerAlfamous1.bat`, qui prend la clé dans `%USERPROFILE%\cles\`) ; l'onglet Articles, lui, est à jour tout de
  suite. Code : `scripts/lib/pages-articles.mjs` (fonctions pures, testées), `scripts/lib/construire-articles.mjs`.
- **Indexation** : seule la production (`blog.alfamous.ca`) est indexée. Sur alfamous-essai : `noindex` sur chaque
  page et `robots.txt` fermé, pour que Google ne voie pas les articles en double.
- **Commentaires** : sur la page publique, lien « Lire et commenter dans l'atelier » (la page reste statique).
- **Redirection de blog.alfamous.ca (le jour de la bascule)** : le domaine est ajouté à Firebase Hosting
  (même site), puis le DNS de `blog` est changé chez le registraire (aujourd'hui vers Blogger). Redirections 301,
  générées une fois depuis l'import et inscrites dans `firebase.json` (déjà actives sur les sites de Firebase,
  sans effet tant que `blog` pointe vers Blogger) : les 207 `/AAAA/MM/<nom>.html` → `/articles/<slug>/` ;
  `/search/label/<libellé>` → `/articles/libelle/<libellé>` (Firebase ne remplace pas une variable dans une
  requête `?…`) ; `/feeds/**` → `/articles/flux.xml` ; `/search…`, `/p/…`, `/AAAA…` → `/articles/`. Sur
  `blog.alfamous.ca`, l'accueil `/` mène à `/articles/` (script de `index.html`) : l'application reste à `/`
  pour `atelier.alfamous.ca`. Vérifié avec l'émulateur Hosting (`firebase emulators:start --only hosting`). Le blog Blogger reste en archive (privé), jamais supprimé.
  Domaine des pages : `blog.alfamous.ca/articles/…` (décidé le 24 nov.) ; l'atelier reste sur `atelier.alfamous.ca`.

## 9. Affichage dans le reste de l'application
- **Sous un verset cité** (lecture d'une sourate, résultats) : ligne « Articles : <titre> » à côté de la ligne du
  forum. Une requête par sourate affichée (`sourates array-contains n`), puis tri par verset côté navigateur ; pour les
  résultats de recherche, une requête par lot de 30 versets. Seuls les versets marqués « cité » comptent.
- **Fiche du lexique** : bloc « Articles » (articles dont `lexique` ou `racines` contient la clé), après les
  définitions.
- **Sélection de versets** : la barre Aperçu · Copier · Vider gagne « Ajouter au contexte… » (choix de l'article,
  rédacteurs seulement, niveau ≥ 2).

## 10. Étapes proposées (une PR chacune, rien dans main sans accord)
1. Cadrage + maquette (cette PR).
2. Données et règles : `articles`, `atelier`, `versions`, `slugs`, type de commentaire `article`, Storage ;
   tests à l'émulateur.
3. Onglet Articles (liste, lecture, commentaires) + éditeur, brouillon, publication, historique — **3a** (24 nov.) :
   tout cela avec un panneau Contexte réduit (versets, sources, fichiers) ; **3b** (24 nov.) : panneau complet,
   « Ajouter au contexte… », articles sous les versets et dans le lexique, « Dossier pour Claude » (l'étape 4 est faite avec).
4. Panneau Contexte, « Ajouter au contexte », encadrés sous les versets et dans le lexique, « Dossier pour Claude ».
5. Import depuis Blogger (à blanc, relecture, émulateurs, essai) — script `npm run importer:articles` (24 nov.) :
   à blanc sur la sauvegarde : 210 articles (207 publiés), 205 images, 51 commentaires + 14 dans le fil de la page,
   2 écartés, 3 cadres non YouTube retirés ; rapport et fiche dans `import/articles/`.
6. Pages publiques, plan du site, flux ; redirections préparées (activées le jour de la bascule) — fait le 24 nov. :
   207 pages, liste, flux, plan du site ; 213 redirections dans `firebase.json`.

## Décisions du 24 nov. 2026
- **Droits** : écriture et publication dès le niveau 2 (détail § 3).
- **Éditeur** : maison, simple (Visuel + HTML), avec import de fichiers Word (`.docx`), HTML, Markdown, texte (§ 4).
- **Commentaires Blogger** : importés (§ 6).
- **Panneau Contexte** : Vérification, Définition proposée, Recherches Alfamous, Articles liés, Mes Notes liées
  ajoutés ; commentaires traditionnels et résumé court écartés (§ 2).

- **Questions 2 à 10** : propositions acceptées (« ok pour tout », 24 nov.) — modifications d'un article publié en
  brouillon jusqu'à « Publier les modifications » ; une version à chaque « Enregistrer une version » et à chaque
  publication, plus une copie locale ; feuille commune des articles et relecture des 35 articles à `<style>` ;
  vidéos YouTube gardées (`youtube-nocookie.com`) ; pages publiques sur `blog.alfamous.ca/articles/…` ; article
  affiché sous les versets marqués « cité » ; un modérateur modifie ses articles, l'admin tous.
- **Import** : tous les articles depuis Blogger (sauvegarde complète), tous signés Amha Nathali.

Cadrage accepté. Plus aucune question ouverte.
