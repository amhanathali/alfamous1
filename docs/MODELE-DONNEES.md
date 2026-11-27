# Modèle de données Firestore

Règles : `firestore.rules` (tout fermé par défaut) ; tests : `tests/regles/` (`npm run test:regles`).
Droits : `docs/DROITS.md`.

## Niveau d'un compte
Lu dans le jeton Firebase Auth par les règles :
- pas connecté, ou courriel non vérifié → **0** ;
- courriel vérifié, sans revendication → **1** (aucune Cloud Function nécessaire) ;
- revendication `niveau` (2 ou 3) posée côté serveur (script admin ou Cloud Function) → **2** ou **3**.

Le nom affiché vient du compte (`displayName`, champ `name` du jeton) : un commentaire ne peut pas être signé d'un autre nom.

## `commentaires/{id}` — commentaires Alfamous (versets et lexique)
| Champ | Type | Contenu |
| --- | --- | --- |
| `type` | `'verset'` \| `'lexique'` | Ce qui est commenté |
| `cle` | texte | Verset `s:v` (ex. `112:1`) ou expression du lexique (≤ 200 caractères) |
| `auteurUid` | texte \| null | Compte de l'auteur (null pour les commentaires importés de l'ancienne application) |
| `auteurNom` | texte | Nom affiché (signature) |
| `texte` | texte | 1 à 4 000 caractères, texte simple ; vide si le commentaire est masqué |
| `creeLe` | horodatage serveur | Publication |
| `modifieLe` | horodatage serveur \| null | Dernière modification |
| `nbVersions` | entier | 1 à la création, +1 à chaque modification |
| `masque` | `{ par, parNom, le }` \| null | Masquage par un modérateur |

Lecture publique. Affichage : les plus récents en premier (`where type/cle`, `orderBy creeLe desc`).

### Sous-collections
| Chemin | Contenu | Lecture | Écriture |
| --- | --- | --- | --- |
| `versions/{n}` | `{ texte, le }` : texte de la version n (1 = première) | tous, sauf si le commentaire est masqué (modérateurs) | créée par l'auteur dans le même lot que la modification ; jamais modifiée |
| `prive/texte` | `{ texte }` : texte original d'un commentaire masqué | niveaux 2–3 | créé au masquage, supprimé au démasquage (même lot) |
| `signalements/{uid}` | `{ motif, le }` : un signalement par membre (motif ≤ 500 caractères, facultatif) | niveaux 2–3 | niveau ≥ 1, pas sur son propre commentaire, une seule fois |

### Opérations (toujours en un seul lot)
- **Publier** : créer le document (`nbVersions` 1, dates serveur).
- **Modifier** (auteur, commentaire non masqué) : créer `versions/{nbVersions}` avec l'ancien texte et l'ancienne date, puis mettre à jour `texte`, `modifieLe`, `nbVersions + 1`.
- **Masquer** (niveau ≥ 2) : créer `prive/texte` avec le texte, puis `texte = ''` et `masque = { par, parNom, le }`.
  Tout le monde voit la mention « Commentaire masqué par un modérateur » ; seuls les niveaux 2–3 lisent le texte.
- **Démasquer** (niveau ≥ 2) : remettre `texte` depuis `prive/texte`, `masque = null`, supprimer `prive/texte`.
- **Supprimer définitivement** (niveau 3) : supprimer les sous-collections puis le document.

## `notes/{id}` — Mes Notes et forum
Une note est **privée** (`publie: false`, lue par son auteur seulement) ; « Publier » en fait un **fil du forum**
(`publie: true`, lu par tous, visiteurs compris).

| Champ | Type | Contenu |
| --- | --- | --- |
| `auteurUid`, `auteurNom` | texte | Compte et signature de l'auteur |
| `titre` | texte | ≤ 140 caractères ; obligatoire pour publier ; vide si le fil est masqué |
| `texte` | texte | 1 à 20 000 caractères ; vide si le fil est masqué |
| `lien` | `{ type, cle }` \| null | `verset` (`112:1`), `racine` ou `lexique` (≤ 200 caractères), ou rien |
| `publie` | booléen | Note privée ou fil publié |
| `creeLe`, `modifieLe` | horodatage serveur | Création, dernière modification |
| `publieLe` | horodatage \| null | Publication |
| `activiteLe` | horodatage | Dernière activité (création, publication, réponse) : tri du forum |
| `nbReponses`, `nbReponsesAutrui` | entier | Réponses (toutes / d'autres membres que l'auteur : bloque la dépublication) |
| `nbVersions` | entier | Historique du fil publié |
| `masque` | `{ par, parNom, le }` \| null | Masquage par un modérateur |

Sous-collections : `versions/{n}` (fil publié : `{ titre, texte, lien, le }`), `prive/texte` (fil masqué :
`{ titre, texte }`, niveaux 2–3), `signalements/{uid}`, et `reponses/{n}` (n = 1, 2, 3…).

### `notes/{id}/reponses/{n}`
`{ auteurUid, auteurNom, texte (≤ 4 000), creeLe, modifieLe, nbVersions, masque }`, avec `versions/`, `prive/texte`,
`signalements/` comme les commentaires. Le numéro `n` vaut `nbReponses + 1` : la réponse et la mise à jour des
compteurs du fil (`nbReponses`, `nbReponsesAutrui`, `activiteLe`) se font dans le même lot, vérifié par les règles.

### Opérations
- **Note privée** : création, modification, suppression libres par l'auteur.
- **Publier** : `publie: true`, `publieLe`, `activiteLe` (titre obligatoire). **Dépublier** : seulement si
  `nbReponsesAutrui == 0`.
- **Modifier un fil publié** : `versions/{nbVersions}` + mise à jour, dans le même lot.
- **Masquer / démasquer** (2+), **supprimer** un fil publié et ses réponses (3).

## Lexique (phase 3)
Pas de collection à part : une **entrée** du lexique est l'ensemble des commentaires `type: 'lexique'` de même `cle`
(mot, racine ou expression). La clé est enregistrée **sans voyelles** (harakat, signes coraniques et tatwīl retirés par
`normaliserCle`, `src/js/lexique-outils.js`), espaces simples, 200 caractères au plus. Créer une entrée = publier sa
première définition. Mêmes règles, mêmes opérations que les commentaires de versets (ci-dessus).

Lecture : la liste (`#/lexique`) lit une fois par visite toutes les définitions (`where type == 'lexique'`, environ 360
documents après l'import) ; la fiche (`#/lexique/<clé>`) lit les définitions de la clé ; l'encadré des résultats et la
fiche d'un mot n'utilisent qu'une requête de comptage. À revoir (document d'index par clé) si le lexique dépasse
quelques milliers de définitions.

## `historiques/{uid}` — historique des recherches
`{ recherches: [{ q, t }], majLe }` : 50 recherches au plus (`q` ≤ 200 caractères, `t` en millisecondes), la plus récente
en premier. Lu, écrit et effacé par son seul titulaire (tout compte connecté, même au courriel non vérifié) ; personne
d'autre, modérateurs et admin compris. Le navigateur garde une copie locale ; à la connexion et à chaque recherche
(après 1,5 s), copie locale et document sont fusionnés dans une transaction (`fusionnerHistoriques`). Les visiteurs ont
seulement la copie locale. Pas de limite de fréquence (document privé, réécrit sur place).

## `journalNiveaux/{id}` — changements de niveau
`{ le, parUid, parNom, cibleUid, cibleNom, cibleCourriel, avant, apres }`, écrit par la Cloud Function
`changerNiveau` ; lu par la Cloud Function `membres` (50 derniers). Fermé à tous les clients (règles par défaut).
La liste des comptes (Firebase Auth) n'est lisible que par la Cloud Function `membres`, réservée aux admins.
Index : `reponses.auteurUid` en portée « groupe de collections » (nombre de réponses par membre).

## `limites/{uid}` — limite de fréquence
`{ debut, n, dernier }` : début de la fenêtre d'une heure, nombre de publications, dernière publication.
Chaque publication d'un membre (commentaire, note, réponse, signalement) écrit ce document dans le même lot :
`n + 1` dans la fenêtre (20 au plus), ou nouvelle fenêtre (`n = 1`) une heure après `debut`. Lu par son seul titulaire.
Modérateurs et admin exemptés.

## Commentaires importés (phase 4)
Écrits par `npm run importer` (script admin, hors règles) dans `commentaires/`, avec la même forme que ceux du site,
plus un champ `import` : `{ source: 'Lexique-Coran', origine, ordre, dateBrute, dateEstimee, le }` (`origine` = verset
`s:v` ou clé du lexique telle qu'écrite dans le classeur, avec voyelles). Identifiants stables : `imp-v-<s>-<v>-<ordre>`
et `imp-l-<empreinte de la clé d'origine>-<ordre>`. `creeLe` = date de la signature (heure de Montréal), ou 1er janvier
2024 si elle manque (`dateEstimee: true`). `auteurUid` = compte de l'auteur pour Amha Nathali, sinon null.
Le champ `import` n'est jamais modifié : les règles (modification, masquage) ne contrôlent que les champs changés.

## Articles (onglet Articles, docs/ARTICLES.md)
Rédacteurs = niveau ≥ 2 ; un modérateur modifie ses articles, l'admin tous. Règles : `firestore.rules`,
`storage.rules` ; tests : `tests/regles/articles.test.mjs`.

### `articles/{id}` — partie publique
`{ titre, slug, famille, libelles, resume, image, corps, statut, auteurUid, auteurNom, creeLe, modifieLe, publieLe,
republieLe, versets, sourates, racines, lexique, sources, liens, nbVersions }` (+ `import` pour les articles importés
de Blogger, écrit par le script). `statut` : `brouillon` (jamais publié) · `publie` · `retire`. `famille` : `racines`,
`critiques`, `identite`, `reflexions`. Limites : titre 200, résumé 500, 10 libellés, corps 300 000 caractères,
300 versets. Lecture : tous si publié, rédacteurs sinon (les listes publiques filtrent `statut == 'publie'`).

Opérations (en un seul lot, sauf la création) :
- **Créer** (niveau ≥ 2) : brouillon sans adresse, `nbVersions` 0, **puis** `atelier/brouillon` dans une seconde
  requête (dans un même lot, les deux règles dépassent la limite de 1 000 expressions par requête de Firestore ;
  l'éditeur recrée l'atelier s'il manque).
- **Brouillon jamais publié** : contenu du document public modifiable par son auteur (liste des rédacteurs).
- **Enregistrer une version** : `versions/{n}` (`publiee: false`) + `nbVersions + 1`.
- **Première publication** : contenu + `statut: 'publie'`, `slug`, `publieLe` + `versions/{n}` (`publiee: true`,
  même titre et texte) + `slugs/{slug}` (`{ article }`).
- **Publier les modifications** ou republier un article retiré : contenu + `republieLe` + `versions/{n}` ; l'adresse
  ne change plus. Un article publié n'est jamais modifié en direct.
- **Retirer** : `statut: 'retire'`. **Supprimer** : admin.

### `articles/{id}/atelier/brouillon` — version de travail (privée)
`{ titre, famille, libelles, resume, image, corps, contexte, majLe, majPar }` ; `contexte` = panneau Contexte (objet
libre : versets `{ ref, note, cite }`, racines, lexique, fichiers, sources, fils, notes, vérification, définition
proposée, recherches, articles liés). Lu par les rédacteurs, écrit par l'auteur ou l'admin.

### `articles/{id}/versions/{n}` — historique
`{ titre, corps, resume, famille, libelles, le, parUid, parNom, publiee }`, n = 1, 2, 3… ; lu par les rédacteurs ;
jamais modifié (supprimé par l'admin avec l'article). Une version `publiee` est identique à ce qui est mis en ligne.

### `slugs/{slug}` — adresses réservées
`{ article }`, créé à la première publication, jamais modifié ni réattribué. Lecture publique.

### Commentaires et forum
Commentaires d'articles : `commentaires/{id}` avec `type: 'article'`, `cle` = identifiant de l'article (publié).
Fil du forum lié à un article : `lien: { type: 'article', cle }`.

### Storage
- `articles/{id}/images/{fichier}` : lecture publique ; envoi par l'auteur de l'article ou l'admin ; PNG, JPEG, GIF,
  WebP (pas de SVG), 5 Mo au plus.
- `articles/{id}/fichiers/{fichier}` : lus par les rédacteurs ; envoyés par l'auteur ou l'admin ; 25 Mo au plus.
- L'auteur est lu dans Firestore par les règles Storage (`firestore.get`) : au premier déploiement, accepter le rôle
  « Firebase Rules Firestore Service Agent » proposé par la CLI.

Index : `firestore.indexes.json` (statut + publieLe ; famille ; libellés, sourates, versets, racines, lexique en
`array-contains` ; statut + modifieLe).

## Témoignages (onglet Témoignages)
Publiés tout de suite par un membre (niveau ≥ 1), lus par tous. Règles : `firestore.rules` ; tests :
`tests/regles/temoignages.test.mjs`.

### `temoignages/{id}` — partie publique
| Champ | Type | Contenu |
| --- | --- | --- |
| `titre` | texte | 1 à 200 caractères ; vide si masqué |
| `texte` | texte | 40 à 20 000 caractères, texte simple (ligne vide = paragraphe) ; vide si masqué |
| `anonyme` | booléen | Case « Masquer mon nom (publier en Anonyme) » |
| `auteurUid`, `auteurNom` | texte \| null | Compte et nom de l'auteur ; **`null` et `''` si anonyme** (le document est public : l'uid permettrait de retrouver la personne par ses commentaires) |
| `creeLe`, `modifieLe` | horodatage | Publication, dernière modification (`null` au départ) |
| `nbVersions` | entier | 1 à la création, +1 à chaque modification |
| `masque` | `{ par, parNom, le }` \| null | Masquage par un modérateur |
| `import` | objet | Témoignages importés seulement : `{ source: 'alfamous-amha', ancienId, publieLe, le }` |

Sous-collections :
| Chemin | Contenu | Lecture | Écriture |
| --- | --- | --- | --- |
| `prive/auteur` | `{ auteurUid, auteurNom }` : auteur réel, même anonyme | l'auteur lui-même, l'admin | créé dans le même lot que le témoignage, jamais ajouté à un témoignage existant |
| `versions/{n}` | `{ titre, texte, le }` (sans nom : l'anonymat est gardé) | tous, sauf témoignage masqué (2+) | l'auteur, dans le lot de la modification |
| `prive/texte` | `{ titre, texte }` d'un témoignage masqué | niveaux 2–3 | au masquage / démasquage |

Opérations (en un seul lot) :
- **Publier** : document + `prive/auteur` + `limites/{uid}`.
- **Modifier** (auteur réel d'après `prive/auteur`, témoignage non masqué) : `versions/{nbVersions}` + titre, texte,
  case anonyme (et donc `auteurUid`/`auteurNom`), `modifieLe`, `nbVersions + 1`.
- **Masquer / démasquer** (2+) : comme les fils du forum. **Supprimer** : admin (sous-collections comprises).

Import : `npm run importer:temoignages` lit publiquement l'ancienne collection `alfamous-amha/temoignages` (jamais
modifiée) ; approuvés seulement ; identifiants stables `imp-t-<ancien id>` ; courriel jamais recopié ; `prive/auteur`
relié au compte de l'auteur pour « Amha », sinon `auteurUid: null` (non modifiable depuis le site).
