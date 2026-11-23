# Décisions

| Date | Décision | Raison |
| --- | --- | --- |
| 2026-11-22 | Nouvelle application reconstruite de zéro ; l'ancienne (`alfamous-amha`) n'est pas touchée | Sécurité, dette technique (fichier JS de 8 Mo comme base de données) |
| 2026-11-22 | Une seule application, deux projets Firebase : `alfamous-essai` (tests) et `alfamous-atelier` (production), forfait Blaze, alerte de budget 10 $ CA | Tester sans risque pour la version publique |
| 2026-11-22 | Sous-domaine `atelier.alfamous.ca` pendant la construction | L'ancienne application garde `alfamous.ca` jusqu'à la bascule |
| 2026-11-22 | Bascule des commentaires : copies d'essai pendant la construction, copie finale le jour de la bascule, puis écriture uniquement dans la nouvelle application | Éviter deux versions divergentes |
| 2026-11-22 | Code dans `C:\Users\gmpcd\Desktop\Alfamous1` (hors Google Drive) ; documents dans `G:\Mon disque\Gestion des projets Amha\Alfamous1` | Git et Drive se synchronisent mal |
| 2026-11-22 | Texte découpé par sourate en JSON servi par Hosting ; commentaires = un document Firestore par commentaire | Chargement rapide, écriture concurrente, historique |
| 2026-11-22 | Traductions au format tanzil.net, liste des langues dans `donnees/traductions/langues.json`, fichiers non versionnés | Demande de l'auteur ; conditions de tanzil.net |
| 2026-11-22 | Région des données : `northamerica-northeast1` (Montréal) | Choix de l'auteur : projet basé au Québec |
| 2026-11-22 | Traduction Mountadana laissée de côté (absente de tanzil.net) | Choix de l'auteur |
| 2026-11-23 | Les traductions tanzil.net sont des « commentaires traditionnels », affichés seulement pour la comparaison ; les commentaires d'Alfamous sont le contenu principal | Demande de l'auteur |
| 2026-11-23 | Essai local avant tout déploiement : LANCER_ALFAMOUS1.bat (port 5050) ; émulateurs Firebase (Auth, Firestore) à partir de la phase 2 | Demande de l'auteur |
| 2026-11-23 | Droits d'accès : niveaux 0 (visiteur) à 3 (admin), écriture dès le niveau 1 (courriel vérifié), sans validation ; modérateur = masquer, admin = supprimer ; détail dans docs/DROITS.md | Décision de l'auteur |
| 2026-11-23 | Trois espaces reliés sans fusion : commentaires Alfamous (versets et lexique), Mes Notes (privées), forum ; une note publiée devient un fil du forum | Décision de l'auteur |
| 2026-11-23 | Commentaires : sous le verset, fermés par défaut, un seul bouton ouvre et ferme ceux de ce verset ; les plus récents en premier (contributeur, date, texte), liste qui défile | Décision de l'auteur sur la maquette (docs/maquettes/commentaires.html) |
| 2026-11-23 | Pas de réponse à un commentaire : « Ouvrir une discussion » crée un fil du forum lié au verset ; texte simple avec liens automatiques (2:255, r:…), 4 000 caractères au plus | Décision de l'auteur |
| 2026-11-23 | Commentaire masqué : mention visible pour tous, texte réservé aux modérateurs ; bouton « Signaler » ajouté | Décision de l'auteur |
| 2026-11-23 | Niveau 1 déduit du courriel vérifié dans les règles (pas de Cloud Function) ; revendication `niveau` seulement pour 2 et 3 | Moins de pièces à maintenir ; modèle dans docs/MODELE-DONNEES.md |
