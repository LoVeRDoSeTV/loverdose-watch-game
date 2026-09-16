# LoVeRDoSeTV Watch Game

Jeu communautaire lié à Twitch. Un joueur crée un compte Watch Game, lie son compte Twitch, reçoit un œuf en incubation puis débloque une créature après avoir accumulé du temps de présence sur les lives.

## Parcours joueur

1. Création d'un compte Watch Game.
2. Liaison du compte Twitch.
3. Réception d'un œuf en incubation.
4. 6 heures de présence cumulée sont nécessaires avant l'éclosion.
5. À l'éclosion, le serveur tire une créature selon les probabilités définies ci-dessous.
6. Après l'éclosion, la créature gagne de l'XP et progresse avec le temps de présence.

La fenêtre d'explication s'affiche automatiquement uniquement pour les nouveaux joueurs. Elle reste accessible ensuite avec le bouton d'information `ⓘ`.

## Progression

- Viewer : **100 XP / heure**.
- Abonné Twitch : **120 XP / heure** (**+20 % XP**).
- Points : **10 points / heure** pour tout le monde.
- Niveau maximum actuel : **50**.
- Paliers d'évolution prévus : **niveau 10, 25 et 50**.

## Œuf de départ

L'œuf de départ demande **6 heures** de présence cumulée avant de pouvoir éclore.

### Taux globaux par rareté

- Commun : **70 %**
- Rare : **22 %**
- Épique : **7 %**
- Mythique : **1 %**

### Créatures et probabilités

| Créature | Affinité | Rareté | Chance |
| --- | --- | --- | ---: |
| Mossy | Verdance | Commun | 17,5 % |
| Nyméa | Abyssal | Commun | 17,5 % |
| Voltis | Foudre | Commun | 17,5 % |
| Brumee | Brume | Commun | 17,5 % |
| Flamby | Cendre | Rare | 8 % |
| Crysal | Cristal | Rare | 7 % |
| Ferox | Forge | Rare | 7 % |
| Nocty | Néant | Épique | 3,5 % |
| Solka | Solaire | Épique | 3,5 % |
| Mimo | Mirage | Mythique | 1 % |

Le tirage est effectué côté serveur.

## Compte joueur

La fenêtre **Mon compte** permet actuellement de :

- modifier le pseudo Watch Game ;
- se déconnecter ;
- réinitialiser uniquement la progression du jeu ;
- supprimer définitivement le compte et sa progression.

Le pseudo Watch Game est indépendant du pseudo Twitch. Les pseudos sont contrôlés côté serveur afin de limiter les termes interdits, les tentatives d'usurpation du staff et certains contournements simples.

## État du suivi de présence Twitch

Le lecteur Twitch intégré a été retiré du site. La route historique `/api/watch/heartbeat` existe encore dans le backend, mais elle n'est plus appelée par l'interface.

**Conséquence actuelle : le temps d'incubation, l'XP et les points ne progresseront pas automatiquement tant que le nouveau tracker Twitch côté serveur n'aura pas été installé.**

La prochaine étape technique prévue est un tracker serveur basé sur l'identité Twitch et la présence détectée pendant les lives. Ce suivi devra être traité comme une estimation de présence et non comme une mesure officielle et exacte du temps vidéo regardé.

## Installation locale

1. Installer Node.js 20 ou plus récent.
2. Créer une base PostgreSQL.
3. Copier `.env.example` vers `.env`.
4. Renseigner `DATABASE_URL`, les identifiants Twitch et `SESSION_SECRET`.
5. Dans l'application Twitch, ajouter comme URL de redirection :
   `http://localhost:3000/auth/twitch/callback`
6. Installer les dépendances :
   `npm install`
7. Démarrer le serveur :
   `npm start`
8. Ouvrir :
   `http://localhost:3000`

## Variables d'environnement

- `DATABASE_URL` : connexion PostgreSQL.
- `TWITCH_CLIENT_ID` : Client ID de l'application Twitch.
- `TWITCH_CLIENT_SECRET` : secret de l'application Twitch.
- `TWITCH_CHANNEL` : login de la chaîne, actuellement `loverdosetv` par défaut.
- `TWITCH_BROADCASTER_ID` : ID Twitch numérique du diffuseur, utilisé notamment pour la vérification du statut d'abonné.
- `SESSION_SECRET` : secret long et aléatoire utilisé pour les sessions.
- `BASE_URL` : URL publique de l'application ou URL locale.
- `PORT` : port HTTP local, `3000` par défaut.

Ne jamais publier les vraies valeurs de `DATABASE_URL`, `TWITCH_CLIENT_SECRET` ou `SESSION_SECRET` dans GitHub.

## Déploiement

Le projet utilise PostgreSQL pour les comptes, les sessions et la progression. En production, `BASE_URL` doit correspondre à l'URL HTTPS publique et cette même URL doit être configurée dans l'application Twitch pour le callback OAuth.

Le dossier `public/` contient l'interface et les PNG des 10 créatures. `server.js` contient l'authentification, la base de données, la logique d'œuf, les probabilités, la progression et les fonctions de gestion du compte.
