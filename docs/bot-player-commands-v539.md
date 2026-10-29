# Commandes du joueur dans LoVeRWatchBot (v539)

Trois commandes sont créées au démarrage dans Administration → Bot :

- `!profil` : niveau global (courbe existante, maximum 55), prestige et solde LoVeR’Cash arrondi à l’entier inférieur.
- `!oeufs` : état des trois emplacements d’incubation, œufs prêts et temps de visionnage en live restant. L’œuf de départ occupe le premier emplacement jusqu’à sa première éclosion. Le temps annoncé n’est pas une heure d’éclosion civile.
- `!classement` : position et top 3 du classement XP globale, dans le même ordre que `/api/leaderboard?metric=level` (XP décroissante puis ID), en excluant le diffuseur selon les mêmes règles que le site.

Chaque carte a un bouton ON/OFF accessible avec `role=switch` et un message modifiable depuis mobile, tablette ou PC. Les variables disponibles sont affichées dans l’éditeur. Les noms des commandes intégrées sont fixes ; on les désactive avec OFF. Les commandes personnalisées continuent de pouvoir être renommées et supprimées. Le délai des nouvelles commandes du jeu vaut 10 secondes, partagé entre spectateurs, et reste modifiable entre 5 et 3600 secondes. La limite commune d’une commande acceptée toutes les trois secondes reste appliquée.

Les données sont lues à l’envoi depuis le compte lié à l’ID Twitch du spectateur fourni par le webhook signé. Le texte ou les arguments du chat ne permettent pas de sélectionner un autre compte. Sans compte lié, le bot indique comment le créer et le lier. Les requêtes de progression restent en lecture seule : aucune récompense ni éclosion ne peut être déclenchée par ces commandes. Les lectures métier sont effectuées dans le passage du bot, sans ralentir l’acquittement du webhook Twitch.

La migration ajoute le type de commande et l’identité Twitch à la file. Elle ne réinitialise ni le message, ni le délai, ni l’état ON/OFF après redémarrage. Si une commande personnalisée existante porte déjà l’un des trois noms, elle est rattachée à cette fonction en conservant son texte et ses réglages. Les nouvelles commandes sont ON par défaut, mais n’envoient rien sans utilisation dans le chat et sans bot globalement ON.

Validation : 112 tests Node/PGlite passent, dont signatures, doublons, droits administrateur, !catch, anti-spam, compte non lié, identité Twitch du demandeur, niveaux, solde, incubateurs, classement et conservation des réglages au redémarrage. Le contrôle Playwright exerce les trois cartes et l’édition/passage OFF puis ON avec conservation du texte à 360, 390, 820 et 1440 px, ainsi que les commandes personnalisées existantes. Transport Twitch simulé, aucun message de test envoyé en production.

Déploiement manuel : pull de la branche puis redémarrage du service ; migrations automatiques, aucune nouvelle dépendance. `app.min.js` passe en `?v=539` pour renouveler le cache du navigateur.
