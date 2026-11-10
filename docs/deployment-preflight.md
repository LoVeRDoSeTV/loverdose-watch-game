# Prévol de déploiement — lecture seule

La branche `performance-safe-modules-20261029` charge des scripts compressés (notamment
`public/app.min.js`) et conserve leurs sources non compressées (`public/app.js`).
Une mise à jour de la source seule n'est pas visible dans le navigateur.

## Avant une future publication

Exécuter `npm run check:deploy` **sur une copie du code à déployer**.

Le prévol vérifie sans écrire :
- l'existence des ressources CSS/JS déclarées dans `public/index.html` ;
- la syntaxe de `server.js`, `public/app.js` et des deux JavaScript compressés ;
- la présence dans les versions compressées des marqueurs d'actions administrateur
  déclarés dans leurs sources, dont les dons Double XP.

Il émet aussi un avertissement pour `public/server.js`, copie serveur potentiellement
inutile et située dans le répertoire statique. **Ne pas la supprimer sur cette seule
base** : vérifier d'abord les usages et la configuration du serveur.

Ce contrôle n'est pas une preuve d'équivalence intégrale des bundles, ni un remplacement
des tests ou d'une vérification visuelle PC/mobile. Il ne minifie pas les scripts, ne
répare pas le jeu, ne se connecte pas à PostgreSQL et ne redémarre aucun service.

## Règles de maintenance

1. Modifier la branche réellement déployée, et non `main` par défaut.
2. Quand `app.js` ou `bot-studio.js` change, mettre à jour le fichier `.min.js`
   correspondant avec l'outil de minification déjà validé pour le projet.
3. Ne pas toucher aux scripts de corrections historiques, aux fichiers SQL et aux
   images apparemment redondantes sans audit des références.
4. Tester les ressources, les interactions et la connexion sur une copie de préproduction
   avant de remplacer les fichiers en production.

Aucun nettoyage de fichiers n'est inclus dans cette amélioration.
