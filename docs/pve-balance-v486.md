# PvE — v486

La campagne compte 10 zones et 96 combats (26 conservés, 70 ajoutés). Les clés et les récompenses des anciens combats restent identiques : les victoires enregistrées continuent de débloquer les étapes suivantes, sans redonner de première récompense.

## Progression

La campagne vise le niveau 30, sans changer le plafond Lovys ni les évolutions aux niveaux 10, 25 et 50. Les niveaux conseillés ne constituent pas une interdiction de combattre à un niveau inférieur. Le rang 1 reste utilisable ; aucun rang supérieur n’est exigé.

| Zone | Niveaux conseillés | Particularité |
| --- | --- | --- |
| Forêt des Premiers Éclats | 1–10 | Racines et régénération |
| Forges du Cœur Ardent | 10–14 | Armure et surchauffe |
| Ruines Nocturnes | 14–17 | Esquives et phases |
| Récifs des Marées oubliées | 17–19 | Bouclier consommable |
| Sommets du Givre éternel | 19–21 | Ralentissement de 2 tours |
| Dunes du Soleil brisé | 21–23 | Préparation puis frappe chargée |
| Jardins des Songes | 23–25 | Deux postures alternées |
| Cimes de la Tempête | 25–27 | Décharge toutes les 3 attaques |
| Forges des Automates | 27–29 | Surchauffe puis refroidissement |
| Sanctuaire des Éclats originels | 29–30 | Trois phases et décharge |

Chaque nouvelle zone contient 8 ennemis, 1 mini-boss et 1 boss. La première étape se débloque après le dernier combat de la zone précédente. Les anciens retours de niveau 10→5 et 15→10 sont remplacés par une progression continue. La difficulté dépend des PV, ATQ, DEF, VIT, de la silhouette et de la mécanique. Les boss de givre et du sanctuaire reçoivent une correction d’ATQ pour éviter de bloquer les Lovys fragiles.

## XP

Les taux actuels sont 100 XP/h de live et 120 XP/h pour les abonnés, avant bonus. Le niveau 30 demande 4 800 XP : 48 h / 40 h depuis zéro sans récompense. Le niveau 50 demande 10 000 XP : 100 h / 83 h 20. Les premières victoires des 96 combats donnent au total 2 583 XP Lovys. Le temps réel dépend de la répartition de cette XP entre Lovys, des bonus, des victoires et du temps de live ; ce total ne garantit pas un temps de campagne.

## Vérification

`node --test test/pve.test.js`

10 tests : ordre et clés, présence des 77 WebP, recharges et actions invalides, bouclier, givre, annonces des charges, postures sans accumulation de statistiques, phases, limite de tours, reprise d’anciens combats JSON et campagne au niveau 50 pour les 10 espèces.

Simulation de 57 600 combats : 96 combats × 10 espèces × 60 essais, rang 1 au niveau conseillé, affinités réelles, choix automatique de la dernière compétence disponible. Graine déterministe pour comparaison. Résultats moyens des boss de zone :

| Boss | Avant | Après | Tours moyens après |
| --- | --- | --- | --- |
| forest_boss | 95 % | 100 % | 5.5 |
| ember_boss | 54 % | 100 % | 5.6 |
| night_boss | 35 % | 97 % | 6.5 |
| tide_boss | Nouveau | 100 % | 7.6 |
| frost_boss | Nouveau | 95 % | 8 |
| dune_boss | Nouveau | 100 % | 7.5 |
| dream_boss | Nouveau | 100 % | 7.9 |
| storm_boss | Nouveau | 96 % | 7.3 |
| automata_boss | Nouveau | 100 % | 8.7 |
| origin_boss | Nouveau | 92 % | 8.7 |

Ces résultats sont des simulations du moteur, pas des mesures en production ni une garantie individuelle. Les affinités et les talents produisent des écarts : Voltis reste fragile face au givre et au boss final. Une autre affinité, un rang amélioré ou quelques niveaux supplémentaires peuvent aider, sans viser le niveau 50.

La victoire exige désormais de vaincre l’ennemi, même à la limite de 30 tours ; la comparaison ancienne de PV bruts à l’expiration pouvait donner une victoire sans tuer l’ennemi. Une victoire au 30e tour reste valable. Les actions impossibles sont rejetées avant toute mutation. Les recharges affichées sur PC suivent le même début de tour que sur mobile.

Les décors sont générés puis convertis en WebP. Les nouvelles créatures sont des illustrations vectorielles originales rendues en WebP transparent, avec une ligne de sol commune et sans halo rectangulaire intégré. Les thèmes réutilisent la disposition mobile/tablette validée ; l’atlas montre les conditions de déblocage des zones à venir.
