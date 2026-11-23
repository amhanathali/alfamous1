# Droits d'accès (décidés le 23 nov. 2026)

## Niveaux
| Niveau | Qui | Comment on l'obtient |
| --- | --- | --- |
| 0 | Visiteur (non connecté) ou compte dont le courriel n'est pas vérifié | Par défaut |
| 1 | Inscrit, courriel vérifié | Automatiquement après la vérification du courriel |
| 2 | Modérateur | Attribué par un admin |
| 3 | Admin | Attribué par un admin |

Le niveau 1 est déduit du courriel vérifié. Les niveaux 2 et 3 (et 0 pour bloquer un compte) sont une revendication
(*custom claim*) Firebase Auth posée côté serveur par `npm run niveau` (voir le README) ; les règles Firestore lisent
`request.auth.token.niveau` et le client ne peut jamais le modifier.

## Grille
| Action | 0 | 1 | 2 | 3 |
| --- | --- | --- | --- | --- |
| Lire le Coran, les commentaires Alfamous, le lexique, les fils publiés | ✓ | ✓ | ✓ | ✓ |
| Écrire un commentaire sur un verset, ou une définition du lexique (publié tout de suite, sans validation) ; créer une entrée du lexique (sa première définition) | — | ✓ | ✓ | ✓ |
| Modifier ses propres commentaires (historique conservé) | — | ✓ | ✓ | ✓ |
| Mes Notes : créer, modifier, supprimer ses notes privées | — | ✓ | ✓ | ✓ |
| Historique de ses recherches synchronisé entre ses machines (privé : personne d'autre ne le lit) | compte connecté | ✓ | ✓ | ✓ |
| Publier une note dans le forum ; répondre à un fil publié | — | ✓ | ✓ | ✓ |
| Dépublier son fil (seulement s'il n'a encore aucune réponse d'autrui) | — | ✓ | ✓ | ✓ |
| Signaler un commentaire aux modérateurs (une fois, pas le sien) | — | ✓ | ✓ | ✓ |
| Masquer un contenu d'autrui (réversible) | — | — | ✓ | ✓ |
| Supprimer définitivement ; changer le niveau d'un membre (onglet « Membres », pas le sien) | — | — | — | ✓ |

## Règles complémentaires
- Pas de validation par un modérateur : le contenu est publié tout de suite ; le modérateur masque, l'admin supprime.
- Un commentaire masqué reste à sa place : tout le monde voit la mention « Commentaire masqué par un modérateur » ;
  seuls les modérateurs et l'admin en lisent le texte. Les modérateurs voient le nombre de signalements.
- Un auteur ne supprime pas son contenu publié (d'autres ont pu y répondre) ; il peut le modifier.
- Limite de fréquence contre les robots : 20 publications par heure et par membre (commentaires, notes, réponses,
  signalements ; les modifications ne comptent pas) ; modérateurs et admin exemptés. Vérifiée par les règles (`limites/{uid}`).
- Une note et un fil de discussion sont le même objet : privé dans « Mes Notes », public après « Publier ».
- Commentaires Alfamous, lexique et forum sont reliés (un fil peut porter sur un verset, une racine ou une
  expression du lexique, ou rester libre) mais ne sont pas fusionnés.

## Import des membres de l'ancienne application
Ancien niveau 0 ou 1 → 1 ; 2 → 2 ; 3 → 3 (l'ancien 0 désignait un membre inscrit, le nouveau 0 un visiteur).

## Changer un niveau
- **Onglet « Membres »** (admins seulement, `#/membres`) : liste des inscrits (courriel vérifié, dates, nombre de
  commentaires et de définitions, de fils et réponses du forum) ; niveau changé par un menu, avec confirmation.
  Passe par les Cloud Functions `membres` et `changerNiveau` (région de Montréal), qui vérifient que l'appelant est
  admin. Un admin ne change jamais son propre niveau (il reste toujours au moins un admin). Chaque changement est
  inscrit dans `journalNiveaux` (fermé aux clients), affiché sous la liste.
- Bloquer (0) : la personne garde son compte et lit tout, mais n'écrit plus rien ; ses sessions sont fermées.
  Ses contenus déjà publiés restent (à masquer à part).
- En secours, sur le PC : `npm run niveau -- courriel 2 --projet essai` (clé de compte de service hors du dépôt).
