# Réinitialisation globale

Administration → Dashboard → Réinitialisation globale → Réinitialiser le jeu pour tout le monde.

Réservé au compte Twitch du diffuseur, vérifié côté serveur. Le propriétaire doit recopier exactement `REINITIALISER TOUT LE JEU`. L’installation du bouton ne déclenche aucune remise à zéro.

La remise à zéro concerne tous les utilisateurs, y compris le propriétaire et les profils détectés sans compte lié : XP, Prestige, monnaies, temps de visionnage, réserves, fragments, Lovys, incubations, inventaires, équipements, badges, défis, roues et progression PvE. Les échanges ouverts et drops actifs sont annulés. Les gains accumulés pendant l’absence sont remis à zéro. Le premier œuf de départ est de nouveau disponible selon le fonctionnement normal du jeu.

Sont conservés : comptes, mots de passe, liaisons Twitch et Discord, statut d’abonnement, sessions de connexion, historique des échanges finalisés, journal économique, journal d’administration, paramètres Twitch/bot et définitions des événements.

Le serveur effectue le changement dans une transaction avec verrous de tables. Une erreur, y compris lors de l’écriture obligatoire du journal d’audit, annule l’ensemble. Un identifiant de requête protège contre la répétition de la même demande ; une autre réinitialisation simultanée est refusée. Aucun remboursement d’échange n’est effectué, puisque toutes les ressources sont remises à zéro dans la même transaction. Les identifiants de lignes ne sont pas réutilisés.

L’événement `game-reset-all` actualise les pages connectées après validation de la transaction. En l’absence de connexion temps réel, le prochain rafraîchissement reçoit les nouvelles valeurs. `progress_reset_at` démarre un nouveau cycle d’animations d’évolution, sans rejouer les célébrations de l’ancien cycle.

Les tests utilisent uniquement une base PGlite en mémoire et des requêtes simulées : refus d’accès, phrase obligatoire, comptes liés/non liés, profils détectés, conservation des identités et historiques, annulation des échanges/drops, retour arrière complet, concurrence et déduplication. Le verrou consultatif PostgreSQL est simulé dans ces tests ; les requêtes de remise à zéro et transactions sont exécutées réellement sur la base de test.
