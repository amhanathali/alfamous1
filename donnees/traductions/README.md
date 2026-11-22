# Traductions (tanzil.net)

Les langues proposées dans l'application sont celles listées dans `langues.json`
(champ `actif: true`). Pour ajouter une langue : ajouter une ligne avec l'identifiant
tanzil (ex. `de.aburida`), puis télécharger le fichier.

## Format
Fichier `<id>.txt` téléchargé sur `https://tanzil.net/trans/<id>`,
format « Text (with aya numbers) » : une ligne par verset, `sourate|verset|texte`.
Exemple : `1|1|Au nom d'Allah, le Tout Miséricordieux, le Très Miséricordieux.`

## Conditions de tanzil.net
- Usage non commercial uniquement.
- Au-delà de trois traductions dans une application, lien obligatoire vers https://tanzil.net/trans/.
- Les fichiers `.txt` ne sont pas versionnés dans Git (voir `.gitignore`) :
  ils sont téléchargés localement, puis déployés avec l'application.
