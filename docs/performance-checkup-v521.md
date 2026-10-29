# Contrôle de performance — 29 octobre 2026

## Périmètre

Analyse du code des entrées HTML, CSS, JavaScript, routes serveur, images, présence, événements SSE, classement, communauté, administration et progression. Mesures HTTP publiques sans compte connecté. Aucune mesure de FPS ou de charge PostgreSQL en production n’a été réalisée ; les routes de compte ont renvoyé une session non authentifiée.

## Corrections

- Après réception du profil et des incubations, les quatre modules indépendants (aperçu PvE, badges, défis, roues) démarrent ensemble plutôt qu’en chaîne. Le rendu final attend leur résolution, même si un module échoue.
- Les chargements du profil ne se chevauchent plus : un appel survenant pendant un chargement provoque un rafraîchissement supplémentaire après celui-ci. Cela conserve un état frais après une mutation sans lancer plusieurs cascades de requêtes simultanées.
- L’accueil et l’incubateur partagent les lectures du statut du live. Les demandes concurrentes sont regroupées ; une réponse est réutilisée pendant une seconde. Les erreurs ne sont pas mises en cache et le délai maximal est de huit secondes.
- L’incubateur utilise la petite route `/api/game/live-status`, au lieu de charger `/api/lobby` et sa liste de joueurs pour lire un simple statut.
- Le classement n’est plus préchargé systématiquement. Les mises à jour SSE et le filet de sécurité ne le rechargent que lorsqu’il est visible. L’ouverture explicite du classement conserve son chargement immédiat.
- Une ancienne réponse du classement ne remplace plus une recherche plus récente.
- Le filet de sécurité ne recharge pas le profil si une mise à jour a déjà réussi dans les 25 dernières secondes. Il reste actif toutes les 30 secondes lorsque nécessaire.
- Les rafraîchissements périodiques du jeu, du live, des notifications, des boosts, des événements et du panneau bot sont suspendus en arrière-plan. Le retour visible déclenche une remise à jour du jeu et du live. Les commandes du bot et les gains du tracker restent gérés côté serveur.
- Les recalculs de dimensions du tableau de bord sont regroupés par image d’animation.
- Les gestionnaires globaux du glissement de la progression sont retirés avant un nouveau branchement, pour ne plus retenir les anciennes pages.

## Éléments déjà vérifiés

Compression HTTP et cache long des images/CSS/JS déjà en place ; HTML revalidé à chaque ouverture. Le logo et les badges ont été allégés lors des mises à jour précédentes. Les pages fermées utilisent déjà largement des images différées. Le PvE et la communauté ont leurs propres gardes d’actualisation. Les abonnements aux événements et les observateurs du tableau de bord disposent déjà de gardes d’initialisation.

## Contrôles et limites

85 tests réussis, dont dix nouveaux sur les rafraîchissements concurrents, le partage du statut, l’expiration du cache, les erreurs réseau, le démarrage parallèle, les mises à jour en arrière-plan, les recherches successives, le regroupement du rendu et le nettoyage des gestionnaires de souris. La pause du bandeau de boost en arrière-plan est également testée avec une exception explicite pour les overlays OBS. Syntaxe JavaScript et différences Git vérifiées.

Une série HTTP publique a renvoyé des réponses 200. Sur connexion réutilisée : compte non authentifié ~69 ms, profil non authentifié ~77 ms, classement public ~236 ms et statut des boosts ~150 ms avant le premier octet. La première connexion a pris plusieurs secondes dans l’environnement de test ; elle traverse une passerelle et ne permet pas d’attribuer ce temps au VPS.

Le classement et le calcul du rang du profil restent des requêtes à surveiller avec le nombre réel de joueurs. Un diagnostic serveur plus poussé demande des mesures de CPU/mémoire, des temps de requêtes authentifiées et des plans PostgreSQL en conditions réelles. La feuille de style principale et le script principal restent volumineux : leur séparation demande une vérification visuelle PC/mobile/tablette avant modification. Aucun score Lighthouse ni gain en secondes ou en FPS n’est annoncé sans mesure du navigateur après déploiement.
