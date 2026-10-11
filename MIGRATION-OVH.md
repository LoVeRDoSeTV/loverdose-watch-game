# Migration LoVeR Watch Game vers OVH

Patch basé sur le commit 5fdc507, fourni le 11 octobre 2026. Aucun fichier .env,
export PostgreSQL, visuel ou fichier CSS du jeu n'est inclus. Ce patch ne remplace
pas la base et ne change pas les montants des récompenses.

## Installer le patch

1. Sur GitHub, déposer les fichiers du ZIP à leur emplacement exact sur main
   (server.js à la racine, config.js dans src, scripts dans scripts). Ne pas
   placer le ZIP lui-même comme fichier du projet.
2. Dans PowerShell : `ssh ubuntu@15.235.101.218`.
3. Sur le VPS :

```bash
cd ~/loverdose-watch-game
GIT_SSH_COMMAND='ssh -i /home/ubuntu/.ssh/loverwatchgame_deploy -o IdentitiesOnly=yes' git pull --ff-only origin main
```

Si Git affiche une erreur, s'arrêter et transmettre l'erreur. Ne pas lancer de
reset ni supprimer les fichiers non suivis (ils incluent les sauvegardes).
Aucune dépendance nouvelle n'a été ajoutée.

4. Préparer puis appliquer la correction de l'adresse publique :

```bash
npm run migrate:ovh
npm run migrate:ovh -- --apply
```

Cette commande conserve les secrets, DATABASE_URL et toutes les autres lignes.
Elle garde une copie privée de l'ancien .env à côté du fichier. Ne pas uploader
cette copie sur GitHub. Ne pas remplacer le .env par env.example.

## Réglages du .env

Vérifier dans `nano .env` :

- BASE_URL=https://loverwatchgame.fr (aucun chemin après le domaine).
- NODE_ENV=production, PORT=3000 (conserver le port configuré dans Nginx si différent).
- TWITCH_CLIENT_ID et TWITCH_CLIENT_SECRET : reprendre les valeurs de la même
  application Twitch que sur Render ; ne pas créer une nouvelle application.
- TWITCH_BROADCASTER_ID : véritable ID numérique de LoVeRDoSeTV.
- TWITCH_CHANNEL=loverdosetv.
- SESSION_SECRET : reprendre le secret existant de Render si possible, au moins
  32 caractères. Il chiffre aussi les jetons du tracker. Si un autre secret a été
  utilisé sur OVH, la reconnexion du tracker permet d'enregistrer de nouveaux
  jetons, sans perdre les joueurs.
- DATABASE_URL : conserver la connexion OVH déjà testée, pas la base Render.
- STREAM_DECK_TOKEN : reprendre sa valeur Render si des boutons sont utilisés.
- DISCORD_CLIENT_ID, DISCORD_CLIENT_SECRET, DISCORD_GUILD_ID : recopier si la
  liaison Discord est utilisée.
- DISCORD_FEEDBACK_WEBHOOK_URL et DISCORD_FEEDBACK_MENTION_USER_ID : recopier si
  les signalements du jeu étaient relayés sur Discord.
- ALLOWED_ORIGINS : retirer l'ancien domaine Render s'il y est ajouté ; la base
  publique OVH est déjà autorisée par le serveur.

Enregistrer : Ctrl+O, Entrée, puis Ctrl+X. Ne pas partager les valeurs secrètes.

## Twitch : les deux adresses à enregistrer

Ouvrir https://dev.twitch.tv/console/apps, gérer l'application existante et ajouter
ces OAuth Redirect URLs, exactement :

```text
https://loverwatchgame.fr/auth/twitch/callback
https://loverwatchgame.fr/auth/twitch/tracker/callback
```

Conserver temporairement les anciennes adresses si nécessaire, mais les nouveaux
liens doivent pointer vers OVH. L'adresse utilisée par le code et celle enregistrée
chez Twitch doivent correspondre. Ne pas générer un nouveau Client Secret.
Documentation : https://dev.twitch.tv/docs/authentication/register-app/

## Discord, Wizebot et Stream Deck

- Discord, si utilisé : dans l'application existante du Developer Portal, ajouter
  `https://loverwatchgame.fr/auth/discord/callback` aux Redirects OAuth2. Réessayer
  la liaison depuis le profil sur OVH.
- Wizebot : dans Administration, charger le relais des alertes et recopier son
  script dans la commande/annonce Wizebot existante. Le script contient le jeton
  conservé dans la base, mais son URL change avec BASE_URL. Vérifier aussi toutes
  les commandes qui affichent un lien au jeu (remplacer le domaine Render par
  https://loverwatchgame.fr). Ne pas partager le script du relais.
- Stream Deck : conserver la méthode POST et le header X-Stream-Deck-Token.
  Remplacer seulement le domaine dans les boutons utilisés :
  `https://loverwatchgame.fr/api/streamdeck/zombie/on`
  `https://loverwatchgame.fr/api/streamdeck/zombie/off`
  Pour lire l'état : GET `https://loverwatchgame.fr/api/streamdeck/zombie/status`.
  Aucun bouton n'est activé automatiquement par ce patch.

## Redémarrer et reconnecter le tracker

```bash
sudo systemctl restart loverwatchgame
sudo systemctl status loverwatchgame --no-pager -l
```

Attendre active (running), puis ouvrir https://loverwatchgame.fr et reconnecter
le tracker avec LoVeRDoSeTV depuis Administration. Autoriser la lecture des
utilisateurs du chat et des abonnements. Un changement de SESSION_SECRET impose
une reconnexion même si la base contient l'ancienne autorisation.

Après environ 30 secondes :

```bash
cd ~/loverdose-watch-game
npm run check:ovh -- --twitch
```

Le diagnostic est en lecture seule, n'affiche aucun secret et ne donne aucune
récompense. Il vérifie l'origine, l'ID diffuseur, les tables/comptes, le chiffrement
et les permissions du tracker, son dernier contrôle et le jeton auprès de Twitch.
Si un point est À CORRIGER, transmettre la sortie sans le .env.

## Vérifications en conditions réelles

1. Connecter un ancien compte Twitch et vérifier Lovys, Cash et progression.
2. Vérifier Administration et l'exclusion du diffuseur du classement.
3. Vérifier dans Administration → Tracker qu'un contrôle réussit hors live.
   Hors live, zéro récompense et zéro viewer sont attendus.
4. Pendant un live, utiliser un compte joueur lié à Twitch et connecté au chat.
   Observer plusieurs passages du tracker : temps regardé, Cash, XP globale,
   XP du Lovys actif et incubation doivent progresser. Les arrondis à l'écran
   peuvent nécessiter plusieurs minutes. Comparer aussi les abonnements et boosts.
5. Vérifier un œuf prêt, les défis quotidiens et les roues selon leurs conditions
   normales. Ne pas distribuer des récompenses de test à tous les joueurs.
6. Si Wizebot était utilisé, lancer son test depuis Administration puis appeler
   la commande de relais dans le chat. Les messages automatiques nécessitent
   un tracker sain, un live et les alertes ON.
7. Actualiser le site et vérifier que la progression reste enregistrée.

Le tracker reconnaît les comptes présents dans la liste Twitch des utilisateurs
connectés au chat. Il ne peut pas identifier tous les spectateurs anonymes ni
faire correspondre cette liste au compteur total de viewers. Ce fonctionnement
existait avant la migration.

Le tracker et la collecte des alertes se lancent dans node server.js : pas de
cron ni de second service de récompenses à créer. Garder le service Render
suspendu afin de ne pas avoir deux serveurs qui distribuent des récompenses sur
la même base. Conserver sa base et l'export tant que les vérifications ci-dessus
ne sont pas terminées.

Pour les mises à jour suivantes : git pull avec la clé dédiée, redémarrage du
service et contrôle du site. Si les dépendances changent, npm install est
également nécessaire avant le redémarrage.

## Nginx et démarrage automatique

Le site fonctionne déjà : ne pas écraser les configurations OVH valides.
Le reverse proxy doit transmettre Host, X-Forwarded-Proto et X-Forwarded-For vers
le port Node existant. Pour /api/live-updates (les mises à jour en direct), désactiver
proxy_buffering et utiliser un proxy_read_timeout d'au moins 90 secondes.
Le serveur envoie déjà X-Accel-Buffering: no pour ce flux.
Le service doit avoir WorkingDirectory=/home/ubuntu/loverdose-watch-game,
ExecStart=/usr/bin/node /home/ubuntu/loverdose-watch-game/server.js et
Restart=on-failure ou always, et être enabled. Ne jamais mettre les secrets dans
les commandes de diagnostic ou les captures.

## Limite de validation

Les contrôles locaux vérifient la syntaxe, la normalisation des URL et la
conservation du .env. La connexion à la base OVH, les autorisations Twitch,
la configuration Nginx et les gains pendant un live doivent être confirmés sur
le VPS : ils ne sont pas accessibles depuis l'environnement où le patch est créé.
