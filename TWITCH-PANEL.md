# LoVeR Watch Game — Panel Twitch, version 1

Le panel est une extension Twitch de consultation : Lovys actif, niveau et rang,
trois emplacements d’incubation, XP en réserve et jusqu’à quatre types d’objets.
Il redirige vers le site pour jouer. Aucune action d’incubation, de combat,
d’achat ou d’utilisation d’objet n’est exposée par son API.

## Parcours du joueur

1. Dans le panel, « Connecter mon compte sur le site » ouvre
   https://loverwatchgame.fr/twitch-panel/connect.html dans un nouvel onglet.
2. Le joueur ouvre le jeu, se connecte ou crée son compte, et relie son compte
   Twitch depuis Mon compte s’il ne l’a pas encore fait. Il revient sur la page
   de liaison : la connexion y est revérifiée automatiquement.
3. Il choisit « Autoriser mon aperçu sur Twitch » sur le site.
4. De retour dans le panel, « Déjà lié ? Afficher ma progression » déclenche la
   demande de partage d’identité de Twitch. Il doit utiliser le même compte
   Twitch que celui lié au jeu.
5. Le résumé se met à jour toutes les 30 secondes lorsque le panel est visible.
   Un bouton permet une actualisation manuelle. Les temps des œufs représentent
   le visionnage restant ; ils ne diminuent pas avec une horloge locale.

La connexion du site n’est jamais supposée accessible depuis l’iframe Twitch.
Le serveur vérifie la signature et la durée du JWT Twitch ainsi que la chaîne.
L’identifiant Twitch provient exclusivement de ce jeton. L’accord enregistré
sur le site doit aussi être actif. La page de liaison permet de le retirer.
Le panel n’ajoute pas de présence en jeu ou de temps de visionnage au Tracker.

## Déploiement du serveur

Les fichiers modifiés sont `server.js` et les deux nouveaux modules
`src/twitch-panel.js`, `src/routes/twitch-panel.js`. Les fichiers du panel sont
dans `public/twitch-panel/`. Aucune dépendance npm supplémentaire n’est requise.

Au démarrage, une migration idempotente ajoute uniquement la colonne
`accounts.twitch_panel_enabled`, avec la valeur FALSE pour tous les comptes.
Elle ne modifie ni la progression, ni la monnaie, ni les récompenses.

Récupérer le commit et redémarrer le service habituel :

```bash
cd ~/loverdose-watch-game &&
GIT_SSH_COMMAND='ssh -i /home/ubuntu/.ssh/loverwatchgame_deploy -o IdentitiesOnly=yes' git pull --ff-only origin main &&
sudo systemctl restart loverwatchgame &&
sudo systemctl status loverwatchgame --no-pager -l
```

Le déploiement du code ne crée pas et n’active pas automatiquement l’extension
dans Twitch. Sans configuration, l’API privée répond « panel en préparation ».

## Créer l’extension Twitch

Dans https://dev.twitch.tv/console/extensions, créer une nouvelle extension.
Ce n’est pas l’application OAuth déjà utilisée par le jeu.

- Nom proposé : **LoVeR Watch Game**.
- Description : « Retrouve ton Lovys, tes œufs et tes objets, puis rejoins le jeu
  sur loverwatchgame.fr. »
- Type : **Panel**, hauteur proposée **500 px**. Le contenu peut défiler.
- Support mobile : activer, avec le même chemin **index.html**.
- Panel Viewer Path : **index.html**.
- Mobile Viewer Path : **index.html**.
- Configuration : aucune configuration par diffuseur.
- Capabilities : activer **Request Identity Link**.
- Bits, chat, statut d’abonnement : non utilisés par cette version.
- URL Fetching Domains : ajouter **https://loverwatchgame.fr**.
- Image/Media Domains : ajouter **https://loverwatchgame.fr**.
- Navigation / liens externes : autoriser **https://loverwatchgame.fr** si le
  formulaire de la console le demande.
- Privacy Policy URL :
  **https://loverwatchgame.fr/twitch-panel/privacy.html**.
- Support URL : **https://loverwatchgame.fr**.

Uploader le fichier **twitch-extension-upload.zip**, livré à l’intérieur du ZIP
du correctif. Il contient seulement `index.html`, `panel.css`, `panel.js` et
`config.js`, directement à la racine. Il ne contient aucun secret ni fichier
serveur. Le code source correspondant est dans `public/twitch-panel/`.

Les fichiers de cette archive doivent être hébergés par Twitch pour Hosted
Test puis pour la publication. Le jeu conserve ses en-têtes de protection ;
ne pas ouvrir l’intégration de toutes les pages du site dans une iframe.

## Configuration privée sur le VPS

Ajouter ces deux variables au `.env` existant, avec les valeurs de la nouvelle
extension. La clé est la valeur Base64 de **Secret Keys** dans la console :

```dotenv
TWITCH_EXTENSION_CLIENT_ID=identifiant_de_la_nouvelle_extension
TWITCH_EXTENSION_SECRET=cle_base64_de_la_nouvelle_extension
```

Conserver `TWITCH_BROADCASTER_ID`, qui doit être l’ID numérique de LoVeRDoSeTV.
Ne pas remplacer `TWITCH_CLIENT_ID`, `TWITCH_CLIENT_SECRET`, `SESSION_SECRET`
ou `DATABASE_URL`. La clé d’extension reste uniquement sur le serveur : jamais
dans le ZIP, `config.js`, GitHub ou la configuration publique Twitch.

Redémarrer `loverwatchgame` après cette configuration. Le routage CORS autorise
uniquement l’origine exacte `https://<extension-client-id>.ext-twitch.tv` et
l’origine du jeu pour l’aperçu. Il n’utilise pas les cookies du site dans Twitch.

## Aperçus sur le site après déploiement

- Visiteur : https://loverwatchgame.fr/twitch-panel/preview.html?view=guest
- Joueur : https://loverwatchgame.fr/twitch-panel/preview.html?view=player
- Liaison réelle : https://loverwatchgame.fr/twitch-panel/connect.html

Les deux aperçus sont explicitement marqués **données fictives**. Ils ne
permettent pas de vérifier une identité Twitch ou d’accéder à des données
personnelles. La liaison réelle et le résumé personnel doivent être vérifiés
dans le Hosted Test de Twitch avec la configuration privée.

## Vérifications

```bash
node --test tests/twitch-panel.test.mjs
```

Les tests couvrent les signatures JWT, expiration, chaîne et rôle, la sélection
du compte par identité vérifiée, l’absence de consentement, la révocation,
les prévols CORS et les valeurs réelles du résumé via une base simulée. Ils
vérifient aussi que la lecture ne modifie pas l’économie du jeu.

Avant activation publique, vérifier dans Twitch : visiteur non connecté,
compte sans jeu, compte avec jeu et consentement, identité différente,
révocation, œuf prêt, aucun objet et affichage mobile. La publication publique
reste soumise au processus de validation Twitch ; cette version est préparée
pour les tests et n’est pas annoncée comme déjà installée sur la chaîne.

Références utilisées :
https://dev.twitch.tv/docs/extensions/building/
https://dev.twitch.tv/docs/extensions/reference/
