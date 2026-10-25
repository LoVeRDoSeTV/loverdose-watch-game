# Progression Lovys — v498

Les niveaux 1 à 25 conservent leurs seuils : 1 000 XP au niveau 10, 3 500 au niveau 25. Après le niveau 25, le coût de chaque niveau augmente de 50 XP : 260 XP pour passer de 25 à 26, puis 310, 360, jusqu’à 1 460 XP pour passer de 49 à 50.

| Niveau | Ancienne XP totale | Nouvelle XP totale |
| --- | ---: | ---: |
| 10 | 1 000 | 1 000 |
| 25 | 3 500 | 3 500 |
| 30 | 4 800 | 5 300 |
| 35 | 6 100 | 8 350 |
| 40 | 7 400 | 12 650 |
| 45 | 8 700 | 18 200 |
| 50 | 10 000 | 25 000 |

Le niveau 50 représente 250 heures de live normal depuis zéro, avant tout bonus, contre 100 heures auparavant. Les taux restent de 100 XP/h et 120 XP/h pour les abonnés. Les évolutions restent aux niveaux 10, 25 et 50. La progression globale, les potions, les boosts, les défis et les montants des récompenses ne sont pas changés.

Le budget PvE reste fixé sur l’ancienne courbe, soit 1 920 XP de première victoire pour les 100 combats. Augmenter les seuils n’augmente donc pas automatiquement les récompenses. Les zones actuelles restent conseillées jusqu’au niveau 30. Une simulation comptable des seuils conseillés, avec les premières victoires immédiates, atteint ce parcours avec environ 34,44 h de live après éclosion, hors autres récompenses, boosts et durée des combats ; ce chiffre ne garantit pas de gagner chaque combat au niveau conseillé.

## Conversion au premier démarrage

La migration transactionnelle `v498-lovys-curve` s’exécute une seule fois avant la réconciliation habituelle, au démarrage du serveur mis à jour. Elle traite les Lovys actifs et inactifs. Elle conserve le niveau et le pourcentage de progression dans le niveau : les totaux d’XP au-dessus de 3 500 sont convertis sur la nouvelle échelle. Un ancien niveau 50 à 10 000 XP devient donc un niveau 50 à 25 000 XP. Les Lovys plus jeunes ne changent pas.

L’XP en réserve n’est pas multipliée. Les éventuels dépassements historiques de l’ancien maximum sont d’abord reversés en réserve à leur valeur réelle, une seule fois. Le marqueur et les changements d’XP sont validés dans la même transaction ; une interruption annule l’ensemble et permet de réessayer au démarrage suivant.

Les dons et les crédits de combat/live utilisent le nouveau plafond de 25 000. La collection communique ce plafond au navigateur, qui l’utilise pour calculer la capacité de don. Le serveur reste responsable du plafonnement et de la conservation des excédents en réserve.

Validation : 47 tests Node réussis. Vérification des 50 seuils et des évolutions, de plusieurs fractions de chaque ancien niveau, des conversions actives/inactives avec PostgreSQL local via PGlite, de l’absence de double conversion, de l’annulation complète d’une migration interrompue, des dons au-delà de l’ancienne limite, du maximum et de ses excédents, et des parcours PvE existants. Le VPS n’a pas été modifié lors de cette intervention.
