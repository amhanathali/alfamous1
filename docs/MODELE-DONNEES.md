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

## À venir
- Limite de fréquence (≈ 20 écritures par heure et par membre) : compteur par membre vérifié par les règles, ou Cloud Function.
- `notes/{id}` (Mes Notes et forum : une note publiée devient un fil), réponses aux fils.
- Import des 335 commentaires et 369 entrées du lexique (phase 4, par script admin).
