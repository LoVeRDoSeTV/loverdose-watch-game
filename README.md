# LoVeRDoSe Watch Game — V1

Base du jeu : connexion Twitch, choix d'une créature, lecteur Twitch intégré et progression XP/points pendant la lecture.

## Règles V1
- 100 XP / heure pour un viewer.
- +10% XP pour un Sub, soit 110 XP / heure.
- XP calculée à la minute via des heartbeats.
- 10 points / heure pour tout le monde.
- 5 créatures de départ : Feu, Eau, Plante, Obscur, Rêve.
- Le choix de la créature est définitif en V1.
- Pas encore de cosmétiques, coffres ou évolutions visuelles : ils seront ajoutés ensuite.

## Important sur le suivi du temps
Twitch ne fournit pas à une application tierce un compteur individuel fiable du temps de visionnage de chaque viewer. Cette V1 compte donc le temps lorsque le lecteur Twitch intégré au site est effectivement en lecture. Cela évite de prétendre qu'un utilisateur regarde le live alors que le site n'en a aucune preuve.

## Installation
1. Installer Node.js 20+.
2. Copier `.env.example` vers `.env`.
3. Créer une application Twitch et mettre le Client ID/Secret dans `.env`.
4. Ajouter comme Redirect URL : `http://localhost:3000/auth/twitch/callback`.
5. Lancer `npm install`, puis `npm start`.
6. Ouvrir `http://localhost:3000`.

Pour le contrôle Sub, renseigner `TWITCH_BROADCASTER_ID` avec l'ID Twitch de la chaîne. Le scope `user:read:subscriptions` est demandé à la connexion.

Pour un déploiement public, utiliser HTTPS et ajouter le domaine comme `parent` du lecteur Twitch.
