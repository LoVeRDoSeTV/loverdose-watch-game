# Stream Deck — les boosts du live

Chaque bouton active 60 minutes réelles de bonus pour les joueurs dont la présence est comptabilisée par le tracker Twitch. Les récompenses fixes de badges, défis et combats ne sont pas concernées. Les échéances sont conservées en base après un redémarrage.

Dans Stream Deck, dupliquer le bouton existant et conserver « Demande GET en arrière-plan » et le même paramètre privé `?token=...`. Modifier seulement le chemin avant `?token=` :

| Bouton | Chemin |
| --- | --- |
| XP Lovys ×2 | `/api/streamdeck/xp/on` |
| LoVeR’Cash ×2 | `/api/streamdeck/cash/on` |
| XP globale ×2 | `/api/streamdeck/global-xp/on` |
| Les 3 bonus ×2 | `/api/streamdeck/all/on` |
| Stop tous les bonus du live | `/api/streamdeck/boost/off` |

Exemple sans clé réelle : `https://loverwatchgame.fr/api/streamdeck/cash/on?token=VOTRE_CLE_EXISTANTE`.

- Les bonus peuvent coexister et possèdent chacun leur heure de fin.
- Un second clic sur un bonus actif ne prolonge pas son heure de fin et ne multiplie pas son effet.
- « Les 3 » démarre les bonus inactifs pour 60 minutes et conserve les échéances de ceux déjà actifs.
- « Stop » arrête les trois bonus collectifs, y compris ceux activés dans Administration. Les boosts personnels des joueurs restent en place.
- Pour arrêter un seul bonus Stream Deck, remplacer `/on` par `/off` dans son chemin. `/all/off` est aussi un alias de Stop.
- Les mêmes chemins acceptent POST avec l’en-tête `x-stream-deck-token`. La clé reste celle de `STREAM_DECK_TOKEN`.

## Compteurs du site et d’OBS

Le site PC/mobile affiche chaque bonus actif et son décompte. L’overlay OBS utilise le même état et se met à jour dès que le serveur confirme le changement.

Dans OBS, ajouter une source Navigateur de **600 × 140 px** :

`https://loverwatchgame.fr/overlays/xp-boost.html?v=448`

Le texte est sur fond transparent, sans contour ni barre décorative. L’affichage disparaît lorsqu’il n’y a plus de bonus actif. La clé privée n’est pas nécessaire dans OBS.
