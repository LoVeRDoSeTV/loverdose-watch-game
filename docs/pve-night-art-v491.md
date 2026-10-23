# Ruines Nocturnes — illustrations v491

Les six combats de la zone 3 utilisent désormais des illustrations WebP RGBA 768 × 768. Les images sont déclarées dans `src/combat/zones.js` pour l’API et dans `PVE_BESTIARY` (`public/app.js`) pour le rendu de secours. La sélection, les fiches et les combats PC, mobile et tablette utilisent le même moteur de rendu. `public/index.html` charge `app.js?v=491` et `styles.css?v=491` pour renouveler leur cache. La règle existante de taille des adversaires mobiles cible plus précisément la carte pour prendre priorité sur la taille générique des boss WebP ; ces boss ne sont plus réduits dans la présentation mobile.

| Combat | Fichier dans `public/pve/night/` | Direction du personnage |
| --- | --- | --- |
| `night_1` — Ombre errante | `ombre-errante-v491.webp` | Petit esprit flottant en goutte, corps violet translucide, queue vaporeuse, yeux cyan et cœur améthyste. |
| `night_2` — Veilleur brisé | `veilleur-brise-v491.webp` | Créature de pierre en forme de hibou, plumes de cristal fragmentées, énergie violette et yeux cyan. |
| `night_3` — Spectre du miroir | `spectre-miroir-v491.webp` | Phalène spectrale, ailes d’obsidienne réfléchissantes bordées de cristal lavande, petit corps violet. |
| `night_4` — Chevalier du Néant | `chevalier-neant-v491.webp` | Gardien quadrupède félin, plaques minérales naturelles, pattes épaisses et fissures violettes, sans équipement. |
| `night_mini` — Oracle des Ruines | `oracle-ruines-v491.webp` | Gardien hibou flottant, aigrettes cristallines en croissant, plumes d’améthyste et grands yeux lilas. |
| `night_boss` — Seigneur de l’Éclipse | `seigneur-eclipse-v491.webp` | Boss quadrupède massif, face féline, écailles de cristal sombre, cornes en croissant et cœur d’éclipse violet. |

## Création

Outil ImageGen intégré, un appel par créature. Références de style : `public/pve/zone1/germe-sauvage.webp` et `public/pve/zone2/roche-ardente.webp`. Consigne commune : illustration raster premium semi-cartoon détaillée, volumes peints, grands yeux brillants expressifs, matières tactiles et énergie intérieure lumineuse. Créature entière seule, de trois quarts vers la gauche, centrée avec marge sur un fond réellement transparent. Palette anthracite, violet profond, lavande et cyan discret. Pas de décor, plateforme, sol, texte, logo, interface, humain, armure ni arme. Chaque sujet suit la direction du tableau. Conversion WebP à qualité 88 en conservant le canal alpha.

Les identifiants des combats, niveaux, statistiques, mécaniques, récompenses et conditions de déblocage sont conservés. Les autres zones ne sont pas modifiées. Le changement est destiné à être déployé depuis GitHub ; il ne modifie pas directement le VPS.
