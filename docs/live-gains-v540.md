# Indicateur « Tu es actuellement en train d’XP ! » (v540)

L’accueil connecté affiche un petit bloc avec un voyant vert et le texte « Tu es actuellement en train d’XP ! » quand le tracker confirme un crédit récent pour ce joueur. La ligne dessous confirme que ses XP et LoVeR’Cash sont crédités grâce au live. L’indicateur devient « En attente de ta présence sur Twitch », « Progression en pause » (live hors ligne) ou « Vérification de ta progression… » selon l’état réel. Aucun tableau de montants cumulés.

`GET /api/game/live-gains` exige la session du joueur et utilise son ID Twitch serveur, sans accepter d’identité dans les paramètres. Une seule requête récupère la date de dernier crédit déjà enregistrée par le tracker et l’état du live. Le voyant vert exige un tracker sans erreur, actualisé depuis moins de 90 s, un live actif et un crédit joueur dans les 45 dernières secondes. Le timestamp existant est mis à jour dans la transaction qui crédite réellement les récompenses. Aucun changement aux taux, montants, tables ou colonnes d’économie.

Le navigateur réutilise les rafraîchissements existants du jeu/SSE et leur filet de sécurité, sans ajouter de polling. Requêtes concurrentes regroupées, délai d’abandon de 12 s, statut indisponible après 45 s sans confirmation. Les réponses périmées d’une autre session sont ignorées et aucun suivi n’est demandé dans un onglet masqué. Le bloc rappelle qu’ouvrir le site seul ne déclenche pas de récompenses et que les confirmations suivent le tracker, environ toutes les 15 s.

Validation : 113 tests Node/PGlite, dont une utilisation réelle de la requête de crédit du tracker pour vérifier les états privé/attente/confirmé/pause/erreur. Playwright vérifie le voyant, les textes, la pause, l’erreur réseau, le changement de compte, l’onglet masqué et l’absence de tableau de compteurs à 360, 390, 820 et 1440 px. Les tests Bot existants passent également. Aucun crédit ni appel Twitch de production pendant les tests.

Déploiement manuel : pull et redémarrage du service. Aucune migration ni dépendance supplémentaire. JS/CSS de l’accueil et script de suivi versionnés en v540 pour renouveler le cache.
