# Contrôle de santé et publication de LoVeR Watch Game

La branche de référence pour le VPS est `performance-safe-modules-20261029`.
Ne pas substituer `main` à cette branche lors d'un déploiement.

## Tests de maintenance

Depuis une copie de travail, avec les dépendances installées :

```bash
npm run check:css
npm run check:js
npm run check:deploy
npm test
```

Ces quatre commandes sont **en lecture seule** pour les fichiers du jeu et la base de données.
Le contrôle de ressources vérifie le HTML et les scripts exposés, pas les données des joueurs.

Avant une publication qui modifie l'application ou le style, reconstruire les bundles :

```bash
npm run build:css
npm run build:js
npm run check:css
npm run check:js
npm run check:deploy
npm test
```

`build:css` et `build:js` modifient **uniquement les fichiers compressés**,
et n'exécutent aucune requête PostgreSQL. Incrémenter les versions `?v=` des
fichiers servis en cache long dans `public/index.html` lorsqu'ils changent.

## Validation sur GitHub

Les workflows `Vérification du jeu` et `Contrôle visuel navigateur` s'exécutent
sur les demandes d'intégration vers `main` **et** vers
`performance-safe-modules-20261029`.
Le contrôle navigateur teste les pages PC/mobile/tablette avec des données simulées,
pas le contenu PostgreSQL réel.

Sur la branche performance, le workflow `Maintenir les fichiers CSS et JavaScript compressés`
reconstruit les bundles lorsque leurs sources changent. Il n'enregistre les sorties que
si les contrôles automatiques réussissent.

## Double XP administrateur

Les cadeaux 2h, 5h et 10h correspondent aux trois articles du catalogue :
`boost_xp_x2`, `boost_xp_x2_5h` et `boost_xp_x2_10h`.
Le compteur déjà activé est indépendant des objets en inventaire.

Les retraits administratifs demandent une confirmation et un solde suffisant.
Les tests `test/admin-double-xp.test.js` couvrent le don, les retraits des
deux soldes et les entrées invalides. En production, tester aussi le rendu du panneau
administrateur sur PC et mobile avec un compte de test avant toute opération réelle.

## Ancien fichier serveur statique

`public/server.js` est une ancienne copie. `server.js` bloque déjà l'accès
HTTP à `/server.js` avant `express.static('public')`.
Ne pas supprimer une copie du serveur sans confirmer qu'elle n'est plus utilisée,
et vérifier la réponse HTTP 404 sur la vraie instance.

## Sécurité du déploiement

Ne jamais appliquer `git reset --hard`, `git clean -fd`, ni fusionner
`main` directement dans la branche du VPS. Conserver `.env`, les dumps,
la base de données et toute modification locale (notamment les zones PvE).

Les vérifications GitHub ne prouvent pas que le VPS est synchronisé.
Vérifier le commit réellement déployé et les journaux de `loverwatchgame.service`
avant d'annoncer un déploiement réussi.
