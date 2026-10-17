# Boost XP Lovys ×2 — Stream Deck et OBS

Le bouton active 60 minutes réelles de bonus XP Lovys pour les joueurs dont la présence est comptabilisée par le tracker Twitch. Il ne multiplie ni les récompenses fixes (défis, badges, combats), ni le LoVeR’Cash, ni l’XP globale. Le boost expire même si le live s’arrête. Il persiste après un redémarrage du serveur.

## Stream Deck

Utiliser l’action Site Web, option « Demande GET en arrière-plan », comme pour le mode Zombie. Remplacer uniquement la partie `/zombie/on` de l’URL actuelle par `/xp/on` et conserver le même paramètre privé `?token=...`.

- Activer : `https://loverwatchgame.fr/api/streamdeck/xp/on?token=VOTRE_CLE_EXISTANTE`
- Arrêter : `https://loverwatchgame.fr/api/streamdeck/xp/off?token=VOTRE_CLE_EXISTANTE`

Un second clic pendant les 60 minutes ne prolonge pas le boost. L’arrêt ne retire pas un autre boost lancé depuis l’administration. Les multiplicateurs XP globaux ne s’additionnent pas : deux boosts ×2 restent ×2.

Les mêmes chemins acceptent POST avec l’en-tête `x-stream-deck-token`, pour une action compatible. La clé est celle de `STREAM_DECK_TOKEN` déjà configurée ; aucune clé n’est présente dans l’overlay public.

## OBS

Ajouter une source Navigateur :

- URL : `https://loverwatchgame.fr/overlays/xp-boost.html?v=447`
- Largeur : 600 px
- Hauteur : 140 px
- Conserver le fond transparent et déplacer la source à l’endroit souhaité.

Le texte apparaît dès que le serveur confirme l’activation grâce à un flux temps réel public réservé aux changements du boost, puis disparaît à l’expiration. Le fond, le contour et la barre décorative sont retirés de l’overlay OBS : ajouter son propre rectangle dans OBS sous la source Navigateur. Il reste invisible sans boost. Le compteur se cale sur l’heure du serveur et reprend le temps restant lorsqu’on change de scène ou recharge la source.

## Site

Le même décompte apparaît dans l’en-tête du jeu sur PC et mobile. Les connexions déjà ouvertes sont averties immédiatement par le flux du jeu ; une lecture régulière du statut assure aussi la reprise après une coupure réseau. Aucune recharge de la page n’est nécessaire.
