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

## À venir
- Import des 335 commentaires et 369 entrées du lexique (phase 4, par script admin) ; les clés du lexique passent par
  `normaliserCle` à l'import.
