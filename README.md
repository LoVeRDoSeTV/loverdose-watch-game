# LoVeRDoSeTV Watch Game

Jeu communautaire lié à Twitch. Un joueur crée un compte Watch Game, lie son compte Twitch, reçoit un œuf en incubation puis débloque un Lovys après avoir accumulé du temps de présence sur les lives.

## Parcours joueur

1. Création d'un compte Watch Game.
2. Liaison du compte Twitch.
3. Réception d'un œuf en incubation.
4. 6 heures de présence cumulée sont nécessaires avant l'éclosion.
5. À l'éclosion, le serveur tire un Lovys selon les probabilités définies ci-dessous.
6. Après l'éclosion, le Lovys gagne de l'XP et progresse avec le temps de présence.

La fenêtre d'explication s'affiche automatiquement uniquement pour les nouveaux joueurs. Elle reste accessible ensuite avec le bouton d'information `ⓘ`.

## Progression

- Viewer : **100 XP / heure**.
- Abonné Twitch : **120 XP / heure** (**+20 % XP**).
- LoVeR'Cash : **10 LoVeR'Cash / heure** pour tout le monde.
- Niveau maximum actuel : **50**.
- Paliers d'évolution prévus : **niveau 10, 25 et 50**.

## Œuf de départ

L'œuf de départ demande **6 heures** de présence cumulée avant de pouvoir éclore.

### Taux globaux par rareté

- Commun : **70 %**
- Rare : **22 %**
- Épique : **7 %**
- Mythique : **1 %**

### Lovys et probabilités

| Lovys | Affinité | Rareté | Chance |
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

**Conséquence actuelle : le temps d'incubation, l'XP et le LoVeR'Cash ne progresseront pas automatiquement tant que le nouveau tracker Twitch côté serveur n'aura pas été installé.**

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

Le dossier `public/` contient l'interface et les PNG des 10 Lovys. `server.js` contient l'authentification, la base de données, la logique d'œuf, les probabilités, la progression et les fonctions de gestion du compte.


## Tracker Twitch côté serveur

Le lecteur Twitch intégré a été supprimé. Le temps du Watch Game est maintenant prévu pour être compté par le serveur à partir de la **présence dans le chat Twitch pendant que la chaîne est en live**.

Important : l'API Twitch `Get Chatters` indique les comptes connectés au chat. Ce signal est utilisé comme estimation de présence pour le jeu ; Twitch ne fournit pas une durée individuelle certifiée de lecture vidéo.

Le tracker :

- vérifie que `loverdosetv` est en live ;
- récupère les comptes présents dans le chat toutes les 2 minutes ;
- ne crédite que les Twitch ID déjà liés à un compte Watch Game ;
- ajoute le temps d'incubation et 10 LoVeR'Cash/h dès le départ ;
- après l'éclosion, ajoute 100 XP/h ou 120 XP/h pour les abonnés ;
- synchronise périodiquement le statut d'abonnement Twitch ;
- renouvelle automatiquement le jeton OAuth du tracker quand Twitch renvoie `401`.

### Première activation

1. Dans la console développeur Twitch de l'application, ajoute comme OAuth Redirect URL :
   `https://TON-DOMAINE/auth/twitch/tracker/callback`
2. Vérifie sur Render que `TWITCH_BROADCASTER_ID` correspond bien au Twitch ID du diffuseur.
3. Déploie cette version.
4. Connecte-toi au Watch Game avec le compte du diffuseur puis ouvre **Mon compte**.
5. Dans la section **Tracker Twitch · diffuseur**, clique sur **Configurer le tracker** et autorise Twitch.
6. Reviens dans **Mon compte** et utilise **Tester maintenant** pour vérifier le statut.

Les autorisations demandées au diffuseur sont `moderator:read:chatters` et `channel:read:subscriptions`. Elles ne sont pas demandées aux joueurs ordinaires.

### Limite importante de Render Free

Un Web Service Render gratuit se met en veille après 15 minutes sans trafic entrant. Pendant cette veille, aucun intervalle Node.js ne tourne, donc le tracker ne peut pas compter en continu. Pour les tests, garder le site du jeu ouvert pendant le live provoque des actualisations régulières et permet de voir la progression. Pour un tracker réellement permanent sans page ouverte, il faut à terme un service toujours actif (par exemple un Web Service payant ou un Background Worker adapté).
