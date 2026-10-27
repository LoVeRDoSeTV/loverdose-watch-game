# Bot Twitch du jeu (v506)

Le bot utilise un compte Twitch distinct de la chaîne, un abonnement EventSub `channel.chat.message` par webhook et l’API officielle d’envoi de messages. Aucun jeton ne doit être collé dans le navigateur ou le dépôt. Les jetons OAuth sont chiffrés en base avec le secret de session du serveur.

## Mise en service

1. Créer un compte Twitch dédié au jeu et le rendre modérateur du chat de la chaîne.
2. Ajouter `https://loverwatchgame.fr/api/game-bot/callback` aux URL de redirection de l’application Twitch existante (même client ID que le jeu). Garder le secret de session et les identifiants Twitch existants sur le VPS.
3. Déployer le code, ouvrir Administration → Tracker → « Bot Twitch du jeu » depuis le PC du diffuseur, puis cliquer « Connecter le compte bot ». Sur Twitch, sélectionner le nouveau compte bot et autoriser les permissions de chat demandées.
4. Vérifier que l’abonnement au chat est configuré. Sinon cliquer « Relancer la connexion au chat » après avoir rendu le bot modérateur. Activer le bot, puis utiliser « Tester le chat » : le message doit apparaître dans Twitch.
5. Pendant un live détecté par le tracker, « Déclencher un drop » choisit le lot et annonce l’ouverture dans le chat. Chaque compte lié à Twitch peut participer une seule fois avec `!catch`. Le bot ferme le tirage après 60 secondes, crédite les gagnants, puis les annonce dans le chat.

Le panneau de gestion est une page web utilisable sur PC ; le site peut être installé comme application via le navigateur. Il n’y a pas de logiciel exécutable distinct à maintenir.

## Répartition et sécurité

- Lots : 20 LoVeR’Cash (50 %), 2 fragments d’œuf (25 %), une bouteille de 100 XP en inventaire (20 %), un œuf mystère en inventaire (5 %).
- Nombre de gagnants : 1 (70 %), 2 (25 %), 3 (5 %), plafonné au nombre de participants éligibles.
- Le message EventSub doit avoir une signature HMAC et une date récente. Son identifiant unique empêche de traiter deux fois la même participation. Un joueur doit avoir lié son compte Twitch au jeu ; le texte du chat ne sert jamais à identifier un gagnant.
- Les crédits sont effectués dans une transaction. Si l’envoi du résultat Twitch échoue, la transaction est annulée et le bot réessaie. Les anciens drops sont annulés si le live s’arrête ou si le bot est désactivé.
- Une fois le bot activé, les annonces du jeu ne sont plus remises à Wizebot ; il continue à gérer les autres annonces de la chaîne. Si le bot est désactivé, Wizebot reprend les annonces du jeu encore activées dans son panneau.

Le webhook doit être accessible publiquement en HTTPS sans transformation du corps JSON, afin que la signature Twitch soit vérifiable. L’abonnement est créé avec un jeton d’application ; le compte bot autorise `user:read:chat`, `user:write:chat` et `user:bot`.
