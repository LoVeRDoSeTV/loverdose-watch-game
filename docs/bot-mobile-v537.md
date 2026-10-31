# Administration Bot sur mobile

À 900 px ou moins, la rubrique Bot occupe toute la page et se place au-dessus de l’accueil Administration. Les cartes, les délais et les boutons passent sur une colonne. Les champs de texte et de nombres utilisent une police de 16 px et les boutons de modification/enregistrement ont une hauteur de 48 px. L’historique défile avec la page.

L’éditeur de messages garde ses actions accessibles dans une fenêtre réduite et respecte les marges de sécurité de l’écran. Le faux bloc « Chargement… » resté présent après récupération des paramètres est retiré. Les autorisations, routes et validations restent inchangées.

Vérification : 107 tests Node réussis. Le script `scripts/browser-bot-mobile.mjs` utilise les vrais formulaires et gestionnaires avec des données simulées : largeurs 360, 390, 820 et 1440 px, absence de débordement, fenêtre Bot devant l’administration, modification des délais et d’un message. Les boutons Enregistrer sont également testés avec une hauteur de fenêtre de 450 px sur mobile. Aucun message Twitch réel n’est envoyé. Ce contrôle fait partie de la CI navigateur.

Les styles et le JavaScript générés sont synchronisés, et leurs URL de cache portent la version 537.
