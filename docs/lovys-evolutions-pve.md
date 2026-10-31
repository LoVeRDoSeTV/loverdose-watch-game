# Lovys : évolutions et PvE jusqu’au niveau 50

## Évolution et rang

- Forme de départ jusqu’au niveau 24 inclus.
- Niveau 25 : forme évoluée, bonus total de 15 % sur PV, ATQ, DEF et VIT.
- Niveau 50 : évolution maximale, bonus total de 30 % sur ces statistiques (remplace le bonus de 15 %).
- Le rang reste indépendant : fragments, étoiles de 1 à 5, +2 % de statistiques par rang au-delà du premier, talent renforcé aux rangs 3 et 5.
- Les bonus de rang et d’évolution se multiplient. Les valeurs sont arrondies une seule fois, après calcul.
- Aucun transfert ou changement d’XP, niveau ou rang existant. Les Lovys déjà au niveau 25 ou 50 obtiennent automatiquement la forme correspondante.
- Les combats déjà démarrés conservent leurs statistiques enregistrées ; les nouveaux calculs prennent effet au prochain combat.

## Difficulté PvE

Les trois premières zones gardent leurs niveaux. Les sept suivantes couvrent 17–50. Les clés des 100 combats et les victoires existantes sont conservées. Les budgets de récompenses restent basés sur les anciens niveaux : 1 920 XP Lovys au total, sans nouvelle attribution pour les combats déjà gagnés.

| Zone | Niveaux conseillés |
| --- | --- |
| Forêt | 1–10 |
| Forges ardentes | 10–14 |
| Ruines nocturnes | 14–17 |
| Récifs | 17–21 |
| Givre | 21–25 |
| Dunes | 25–30 |
| Songes | 30–35 |
| Tempête | 35–40 |
| Automates | 40–45 |
| Sanctuaire | 45–50 |

## Simulation

`node scripts/check-evolution-balance.mjs` : 12 000 combats en mémoire, dix espèces avec leurs affinités réelles, 40 essais par boss et rang 1/3/5, graine fixe 563. Actions identiques au combat automatique. Ces taux ne garantissent pas une victoire individuelle.

| Boss | Niveau | Victoires rang 1 | Rang 3 | Rang 5 | Tours moyens rang 1 |
| --- | --- | --- | --- | --- | --- |
| forest | 10 | 100 % | 100 % | 100 % | 5.5 |
| ember | 14 | 100 % | 100 % | 100 % | 5.6 |
| night | 17 | 93 % | 99 % | 99 % | 6.4 |
| tide | 21 | 100 % | 100 % | 100 % | 7.8 |
| frost | 25 | 96 % | 100 % | 100 % | 8.8 |
| dune | 30 | 97 % | 100 % | 100 % | 9.5 |
| dream | 35 | 91 % | 99 % | 100 % | 10.2 |
| storm | 40 | 84 % | 87 % | 100 % | 9.7 |
| automata | 45 | 95 % | 99 % | 100 % | 12.1 |
| origin | 50 | 88 % | 91 % | 96 % | 13.2 |

`SIM_LEVEL=30 node scripts/check-evolution-balance.mjs` : au niveau 30, le rang 1 gagne environ 96 % contre le boss des Dunes, 52 % contre les Songes, et 0 % contre les trois derniers boss. Au niveau conseillé, la majorité des espèces reste viable ; les affinités et les rangs deviennent utiles.

## Images

Les vingt formes individuelles sont dérivées des planches validées par le propriétaire, avec le générateur d’images intégré : extraire fidèlement la forme centrale « Niveau 25 » ou la forme droite « Niveau 50 MAX », conserver anatomie, pose, couleurs et matériaux, supprimer la planche, le texte et le fond, fournir une seule créature entière avec transparence réelle et marge autour des oreilles, pattes et queue.

Fichiers : `public/{Flamby,Nymea,Mossy,Nocty,Mimo,Voltis,Crysal,Brumee,Solka,Ferox}-evolution-{25,50}.webp`. Les images de départ sont conservées.
