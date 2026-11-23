# Droits d'accès (décidés le 23 nov. 2026)

## Niveaux
| Niveau | Qui | Comment on l'obtient |
| --- | --- | --- |
| 0 | Visiteur (non connecté) ou compte dont le courriel n'est pas vérifié | Par défaut |
| 1 | Inscrit, courriel vérifié | Automatiquement après la vérification du courriel |
| 2 | Modérateur | Attribué par un admin |
| 3 | Admin | Attribué par un admin |

Le niveau est une revendication (*custom claim*) Firebase Auth posée par une Cloud Function ; les règles
Firestore lisent `request.auth.token.niveau` et le client ne peut jamais le modifier.

## Grille
| Action | 0 | 1 | 2 | 3 |
| --- | --- | --- | --- | --- |
| Lire le Coran, les commentaires Alfamous, le lexique, les fils publiés | ✓ | ✓ | ✓ | ✓ |
| Écrire un commentaire sur un verset ou une entrée du lexique (publié tout de suite, sans validation) | — | ✓ | ✓ | ✓ |
| Modifier ses propres commentaires (historique conservé) | — | ✓ | ✓ | ✓ |
| Mes Notes : créer, modifier, supprimer ses notes privées | — | ✓ | ✓ | ✓ |
| Publier une note dans le forum ; répondre à un fil publié | — | ✓ | ✓ | ✓ |
| Dépublier son fil (seulement s'il n'a encore aucune réponse d'autrui) | — | ✓ | ✓ | ✓ |
| Signaler un commentaire aux modérateurs (une fois, pas le sien) | — | ✓ | ✓ | ✓ |
| Masquer un contenu d'autrui (réversible) | — | — | ✓ | ✓ |
| Supprimer définitivement ; changer le niveau d'un membre | — | — | — | ✓ |

## Règles complémentaires
- Pas de validation par un modérateur : le contenu est publié tout de suite ; le modérateur masque, l'admin supprime.
- Un commentaire masqué reste à sa place : tout le monde voit la mention « Commentaire masqué par un modérateur » ;
  seuls les modérateurs et l'admin en lisent le texte. Les modérateurs voient le nombre de signalements.
- Un auteur ne supprime pas son contenu publié (d'autres ont pu y répondre) ; il peut le modifier.
- Limite de fréquence contre les robots : environ 20 écritures par heure et par membre.
- Une note et un fil de discussion sont le même objet : privé dans « Mes Notes », public après « Publier ».
- Commentaires Alfamous, lexique et forum sont reliés (un fil peut porter sur un verset, une racine ou une
  expression du lexique, ou rester libre) mais ne sont pas fusionnés.

## Import des membres de l'ancienne application
Ancien niveau 0 ou 1 → 1 ; 2 → 2 ; 3 → 3 (l'ancien 0 désignait un membre inscrit, le nouveau 0 un visiteur).
