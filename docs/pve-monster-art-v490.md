# Bestiaire PvE — nouveaux visuels (v490)

Les 70 combats des sept zones ajoutées en v486 disposent chacun d'une illustration. Pour 66 combats, un nouveau sprite WebP 768 × 768 transparent est lié par `src/combat/zones.js` au chemin `public/pve/<zone>/1.webp` à `10.webp`, dans l'ordre des combats. Le paramètre `?v=490` recharge les images déjà mises en cache. Quatre illustrations détaillées intégrées en v489 restent prioritaires : `tide_1`, `tide_3`, `tide_4` et `frost_2`. Leurs fichiers nommés et leurs liens ne sont pas écrasés.

| Zone | Dossier | Palette et matière | Boss final |
| --- | --- | --- | --- |
| Récifs des Marées oubliées | `tide` | Corail, nacre, eau turquoise | Léviathan des profondeurs |
| Sommets du Givre éternel | `frost` | Givre, cristal, aurores | Gardien du Cœur gelé |
| Dunes du Soleil brisé | `dune` | Grès, ambre, lumière solaire | Sphinx des mirages |
| Jardins des Songes | `dream` | Fleurs, pétales, rose et lilas | Chimère des rêves |
| Cimes de la Tempête | `storm` | Nuages, foudre, bleu cobalt | Roc de l’Orage |
| Forges des Automates | `automata` | Cuivre patiné, rouages, énergie | Titan du Noyau ancien |
| Sanctuaire des Éclats originels | `origin` | Constellations, opale, or pâle | Chimère des Éclats originels |

Les 66 nouveaux sprites ont été générés avec l'outil ImageGen intégré. Les illustrations de `public/pve/zone1/germe-sauvage.webp` et `public/pve/zone2/roche-ardente.webp` ont servi de **références de style** : volume peint détaillé, matière lumineuse, grands yeux expressifs et silhouette entière. Elles n'ont pas été copiées comme personnages. Pour chaque combat, le prompt décrivait le nom, l'anatomie correspondant à sa famille, la palette de sa zone et son rôle (rencontre, gardien ou boss), puis demandait un seul monstre isolé, de trois quarts, pieds visibles, sans décor, sol, interface ni texte, sur un vrai fond transparent. Chaque résultat PNG a été converti en WebP RGBA 768 × 768 à qualité 88.

Les règles de combat, niveaux, récompenses et images des trois premières zones ne changent pas dans cette version.
