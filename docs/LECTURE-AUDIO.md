# Écouter et suivre la lecture — cadrage (25 nov. 2026)

Chantier : reprendre de l'ancienne application la fonction « écouter et suivre la lecture », avec une interface
adaptée à Alfamous1. Branche `lecture/ecouter-suivre`. Maquette : `docs/maquettes/lecteur.html`.
**Rien n'est codé** tant que ce cadrage et la maquette ne sont pas acceptés.

## 1. Ce que fait l'ancienne application (lecture seule, dépôt `amhanathali/alfamous`)

Deux fonctions distinctes, qui ne se parlent pas :

| Fonction | Code | Ce qu'elle fait | Limites |
| --- | --- | --- | --- |
| Récitation de Saad al-Ghamidi | `public/jsZC/Ghamidi.js` : `lireAudio` → `playSurah` ; liens `lienAudioFb` dans `fTabNomSouraNombreVersets.js` | un mp3 par sourate (114 liens vers Storage d'`alfamous-amha`, dossier `MesDonnes/Coran`, jeton dans chaque lien) ; enchaîne avec la sourate suivante (114 → 1) ; option boucle sur la sourate | commence toujours au début de la sourate ; aucun repère par verset, donc ni départ en 3.14 ni surlignage |
| « Suivre la lecture » | `Ghamidi.js` : `litAfficheVerset`, `lireCoranPopup` ; appelé depuis `pageWarshJpg.js` | synthèse vocale du navigateur (`speechSynthesis`, voix `ar-SA`), verset par verset, surlignage mot à mot (`onboundary`, avec repli par blocs), enchaînement automatique, pause/reprise | ce n'est pas la voix de Ghamidi ; qualité selon l'appareil ; l'orthographe coranique (ٱ, ـٰ, petites lettres) est mal lue |

Les données d'Alfamous1 sont numérotées comme Hafs (6 236 versets, basmala = 1:1, 286 versets en 2), comme la
récitation de Ghamidi : un audio par verset s'aligne donc sans conversion.

## 2. Décisions de l'auteur (25 nov.)

1. **Source audio** : un audio par verset maintenant (option A) ; la synthèse vocale avec suivi mot à mot (option C)
   pourra être ajoutée plus tard comme option. Les repères temps/verset sur les mp3 actuels (option B) sont écartés
   pour l'instant (6 236 repères à produire ; dépendance envers `alfamous-amha`).
2. **Verset hors de la page** : en lecture d'une sourate ou d'une page, la page ouvre la sourate suivie (fin de
   sourate → sourate suivante) ; depuis des résultats de recherche, la liste reste à l'écran et la fenêtre affiche le
   verset avec « Aller au verset ».
3. **Vitesses** : 0,75 · 1 · 1,25 · 1,5 (hauteur de la voix conservée).

## 3. Source audio retenue (option A)

- Récitation de Saad al-Ghamidi verset par verset, publiée par EveryAyah : dossier `Ghamadi_40kbps`
  (seul débit disponible pour ce récitateur), fichiers `SSSVVV.mp3` (ex. `003014.mp3`).
- **Lue sur place** : rien n'est copié dans le dépôt ni dans Storage, rien n'est déplacé d'`alfamous-amha`.
- **Droits** : la page d'EveryAyah n'affiche aucune licence. À vérifier par l'auteur avant la mise en production
  (contact EveryAyah, ou autre source dont la licence est connue). La source est isolée dans une seule fonction
  (`urlAudio(s, v)` de `lecteur-outils.js`) : changer de source ou de récitateur ne touche pas au lecteur.
- Pas de règle Firestore ni Storage à modifier. Le site n'a pas de Content-Security-Policy : l'audio externe est
  permis sans changer `firebase.json`.

## 4. Périmètre essentiel (codé après acceptation de la maquette)

1. **Bouton « écouter »** rond, juste à droite de la référence de chaque verset (`carteVerset` dans `app.js`) ;
   nom accessible « Écouter à partir du verset 3:14 » ; zone de toucher de 44 px.
2. **Lecture continue** : verset suivant à la fin de chaque verset, y compris d'une sourate à l'autre (114:6 = fin) ;
   le verset en cours est encadré et surligné ; la page défile pour le garder visible au-dessus de la fenêtre ;
   le verset suivant est préchargé pour réduire le silence entre deux versets.
3. **Fenêtre de lecture** flottante (carte en bas à droite sur ordinateur, panneau en bas sur iPhone) :
   référence et sourate, texte arabe et translittération du verset (copiés des données), lecture/pause,
   précédent/suivant, vitesse, réduire (pastille ⏯ + référence), fermer (= arrêt). Elle reste ouverte quand on
   change d'onglet (Lecture, Articles, Forum…).
4. **« Reprendre à »** : champ dans la fenêtre, analysé par `analyserRequete` de `recherche.js` (la même fonction,
   pas une copie) : `p3` / `p 3` / `page 3` → premier verset de la page 3 ; `3` → 3:1 ; `3.14` ou `3:14` → 3:14 ;
   `2:1-5` → 2:1 (la plage elle-même viendra avec « répéter ») ; tout autre texte est refusé avec un message.
5. **Accessibilité et iPhone de base** : boutons étiquetés, ordre de tabulation, Échap réduit la fenêtre, annonce
   discrète du verset en cours au lecteur d'écran (`aria-live="polite"`), champ à 16 px, lecture lancée par un geste
   (exigence de Safari), `playsinline`.
6. **Erreurs** : fichier introuvable ou réseau coupé → message dans la fenêtre et lecture en pause (pas de saut
   silencieux au verset suivant).

## 5. Plus tard (sur accord de l'auteur)

| Proposition | Intérêt | Remarque |
| --- | --- | --- |
| Répéter un verset ou une plage (`2:1-5`, n fois) | mémorisation, étude | l'analyse de `2:1-5` existe déjà |
| Minuterie d'arrêt (15, 30, 60 min, fin de sourate) | écoute du soir | |
| Raccourcis clavier globaux (espace, ← →) | ordinateur | à éviter quand on écrit dans un champ |
| Reprise à la dernière position | confort | `localStorage`, rien dans Firestore |
| Écran verrouillé et commandes de l'iPhone (Media Session) | iPhone | l'enchaînement de fichiers peut être freiné par iOS écran verrouillé ; à essayer sur un vrai iPhone |
| Mise en cache hors ligne d'une sourate | voyage | service worker, poids à surveiller |
| Interface en arabe, de droite à gauche | lecteurs arabophones | à faire pour toute l'application, pas seulement la fenêtre |
| Synthèse vocale avec suivi mot à mot (option C) | suivre mot par mot | à partir de la logique de `Ghamidi.js` (lecture seule) |
| Choix du récitateur | goût | une ligne par récitateur dans `urlAudio` |

## 6. Fichiers

| Fichier | Rôle |
| --- | --- |
| `src/js/lecteur-outils.js` (nouveau) | fonctions pures : point de départ d'une saisie, verset suivant/précédent, fin du texte, URL audio, vitesses |
| `src/js/lecteur.js` (nouveau) | fenêtre, élément `<audio>`, enchaînement, suivi dans la page |
| `src/js/app.js` | bouton dans `carteVerset`, suivi (sourate suivante) |
| `src/index.html`, `src/css/app.css` | fenêtre et styles (thèmes clair et sombre) |
| `tests/lecteur.test.mjs` (nouveau) | analyse de saisie, enchaînement, changement de sourate, arrêt (lecteur avec un faux audio) |
| `CHANGELOG.md` | entrée « Ajouté — écouter et suivre la lecture » |

Données coraniques : les versets affichés viennent de `donnees/texte/*.json` ; `fTabVersets1.js` et
`fTabLexique1.js` ne sont ni lus ni modifiés.
