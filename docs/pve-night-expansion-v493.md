# Ruines Nocturnes : dix combats (v493)

La zone 3 passe de six à dix rencontres : les quatre premières restent à leur place, quatre nouveaux monstres occupent les étapes 5 à 8, l’Oracle des Ruines est explicitement le mini-boss à l’étape 9 et le Seigneur de l’Éclipse le boss de zone à l’étape 10. Les dix zones comptent maintenant dix combats chacune (100 au total).

| Étape | Identifiant | Adversaire | Niveau conseillé | Rôle |
| --- | --- | --- | --- | --- |
| 1 | `night_1` | Ombre errante | 14 | Créature |
| 2 | `night_2` | Veilleur brisé | 15 | Créature |
| 3 | `night_3` | Spectre du miroir | 15 | Créature |
| 4 | `night_4` | Chevalier du Néant | 16 | Créature |
| 5 | `night_5` | Chauvebrume astrale | 16 | Créature |
| 6 | `night_6` | Arachnuit des arches | 16 | Créature |
| 7 | `night_7` | Salamandre lunaire | 16 | Créature |
| 8 | `night_8` | Basilic d’obsidienne | 16 | Créature |
| 9 | `night_mini` | Oracle des Ruines | 16 | Mini-boss |
| 10 | `night_boss` | Seigneur de l’Éclipse | 17 | Boss de zone |

Les quatre nouveaux combats utilisent les statistiques équilibrées de leurs familles (créature volante, arachnide défensive, quadrupède et reptile). Leurs premières victoires ajoutent au total 62 XP Lovys, 26 XP globale et 8 fragments d’œuf. Les six identifiants historiques, illustrations et récompenses restent inchangés ; aucune victoire n’est effacée et aucune migration n’est nécessaire. Les autres zones ne sont pas modifiées.

## Progression existante

Un joueur ayant gagné les six anciens combats conserve ses victoires et son accès à la zone suivante. Il peut commencer les nouvelles rencontres à `night_5`, puis les débloquer une à une. L’API autorise toujours à rejouer un combat déjà gagné, même si de nouvelles étapes ont été insérées avant lui. Le contrôle de déblocage au lancement utilise exclusivement les victoires enregistrées en base. Les récompenses restent limitées à la première victoire sur chaque identifiant.

Les félicitations de fin de zone demandent désormais que les dix rencontres soient gagnées, en tenant compte de la victoire en cours. Elles fonctionnent aussi si un ancien joueur termine la zone en gagnant la dernière des quatre nouvelles rencontres après avoir déjà vaincu le boss.

Les libellés distinguent mini-boss et boss de zone dans les fiches PC, les cartes et l’historique mobile/tablette, et le titre du combat. Le cache de `app.js` passe à `v493`.

## Images

Quatre appels à l’outil ImageGen intégré, un par créature, puis conversion WebP RGBA 768 × 768 à qualité 88. Références de style : `public/pve/zone1/germe-sauvage.webp`, `public/pve/zone2/roche-ardente.webp` et Ombre errante v491 pour la palette nocturne. Consigne commune : rendu raster premium semi-cartoon détaillé, volume peint, grands yeux expressifs brillants, matière tactile et énergie intérieure lumineuse ; créature seule entière de trois quarts vers la gauche, sur un vrai fond transparent, avec marge autour de ses extrémités ; anthracite, violet profond, lavande et cyan discret ; sans décor, plateforme, texte, interface, humain, arme ni armure.

- `public/pve/night/chauvebrume-astrale-v493.webp` : chauve-souris au corps duveteux violet sombre, grandes oreilles, ailes lavande translucides aux veines nébuleuses, yeux violet-bleu et queue vaporeuse.
- `public/pve/night/arachnuit-arches-v493.webp` : araignée d’obsidienne et d’améthyste, huit pattes minérales segmentées, deux grands yeux lilas et quatre petits yeux secondaires, abdomen illuminé d’une énergie soyeuse, sans toile ni décor.
- `public/pve/night/salamandre-lunaire-v493.webp` : salamandre souple à quatre pattes et longue queue, peau anthracite lisse, petites branchies cristallines lavande, marques lumineuses en croissant et yeux cyan-violet.
- `public/pve/night/basilic-obsidienne-v493.webp` : lézard agile aux écailles de pierre sombre, quatre pattes courtes, longue queue enroulée, yeux améthyste et crête de cristaux lavande.
