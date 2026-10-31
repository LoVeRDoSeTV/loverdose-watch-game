# Réduire les requêtes répétées au chargement du profil

Le chargement connecté attend `/api/me`. Cette route synchronise les récompenses de niveaux sous verrou joueur. L’ancienne synchronisation retentait chaque insertion de récompense déjà attribuée et les cosmétiques à deux reprises, même lors d’une simple lecture.

La synchronisation lit désormais les marqueurs des trois familles pour le prestige courant en une requête, puis les cosmétiques possédés en une autre. Elle conserve le verrou joueur, les transactions et les contraintes `ON CONFLICT`. Les marqueurs locaux sont complétés pendant le calcul pour traiter les niveaux débloqués en cascade sans retenter les mêmes insertions. Les récompenses manquantes restent attribuées et chaque prestige garde ses propres marqueurs.

## Vérification

- Sur la même base PGlite et un joueur de niveau global 55 déjà récompensé : 92 requêtes avant, 5 après pour une synchronisation répétée (BEGIN, trois lectures dont le verrou, COMMIT).
- 107 tests passent, dont vérification de l’absence de réécriture des récompenses acquises, des soldes inchangés, du rattrapage d’une récompense manquante et des récompenses du prestige suivant.
- Le gain en requêtes concerne cette synchronisation, pas l’intégralité de `/api/me`. Aucun gain en secondes en production n’est affirmé.

Le HTML public actuellement servi référence les styles du lot v535. Une requête publique non authentifiée ne permet pas de mesurer le chargement du profil du joueur. Les délais serveur authentifiés restent à comparer après déploiement.
