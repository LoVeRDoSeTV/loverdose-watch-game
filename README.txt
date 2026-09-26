LoVeRDoSeTV Watch Game
======================

Jeu communautaire web lié à Twitch : temps de visionnage, LoVeR'Cash, Lovys,
œufs, incubateur, défis, badges, boutique, progression globale, Prestige et PvE.

ÉTAT DU PROJET
--------------
- Frontend : public/index.html (responsive PC + mobile)
- Backend : Node.js / Express dans server.js
- Base de données : PostgreSQL
- Authentification : compte du jeu + liaison Twitch / Discord
- Suivi Twitch : tracker diffuseur et temps de visionnage
- Progression globale : niveaux 1 à 55 puis Prestige
- Progression Lovys : XP, niveaux, collection multi-Lovys et Lovys actif
- Incubateur : jusqu'à 3 œufs en parallèle
- Boutique / inventaire : titres, fonds, encadrements, cadres de profil et objets
- Défis / badges / classement / profils joueurs
- PvE : carte d'aventure, combats, récompenses et Fragments d'œuf

ARBORESCENCE IMPORTANTE
-----------------------
server.js
package.json
env.example
public/
  index.html
  assets/
    egg-premium.png       -> visuel officiel des œufs
    fragment-premium.png  -> visuel officiel des Fragments d'œuf
    fond-zone-1.png       -> fond de la Zone 1 PvE
  pve/
    zone1/                -> les 10 monstres de la Forêt des Premiers Éclats
    enemies/              -> anciens visuels / visuels de secours des autres zones

PVE — ZONE 1
------------
Nom : Forêt des Premiers Éclats
Nombre de combats : 10

1. Germe sauvage
2. Rôdeur mousseux
3. Sentinelle des racines
4. Lucibulle sylvestre
5. Mycélium vif
6. Gardien des Racines (mini-boss)
7. Esprit du sous-bois
8. Sylve fractale
9. Grand mycéliarque
10. Monarque des Premiers Éclats (boss de zone)

Le fond officiel de la Zone 1 est :
  public/assets/fond-zone-1.png

Le chemin est directement intégré dans cette image. Le frontend masque donc le
ancien chemin/décor CSS de secours sur la Zone 1 et conserve les ronds de combat,
les noms, le Lovys actif et les interactions par-dessus l'image.

Les zones PvE sont révélées progressivement :
- au départ, seule la Zone 1 est visible ;
- une fois la Zone 1 terminée, la Zone 2 apparaît ;
- la Zone 3 apparaît après avoir terminé la Zone 2.

ŒUFS ET FRAGMENTS
-----------------
- Visuel œuf : public/assets/egg-premium.png
- Visuel fragment : public/assets/fragment-premium.png
- Les œufs supplémentaires peuvent être placés dans l'incubateur.
- Les emplacements actifs progressent simultanément avec le temps de visionnage Twitch.
- Les Fragments d'œuf sont principalement gagnés en PvE.
- La boutique de fragments permet d'échanger des fragments contre des œufs.

PROGRESSION
-----------
- Le niveau affiché sur la carte joueur est le Niveau global.
- Niveau global maximum : 55.
- Après avoir rempli la barre du niveau 55, le joueur peut passer Prestige.
- L'XP globale est appliquée immédiatement.
- Les récompenses bonus d'XP destinées aux Lovys sont stockées dans la réserve XP Lovys.
- Le joueur peut transférer cette réserve vers un Lovys de sa collection.
- Le temps de visionnage normal fait progresser directement le Lovys actif.

INSTALLATION LOCALE
-------------------
1. Installer Node.js 18+ et PostgreSQL.
2. Installer les dépendances :
     npm install
3. Copier env.example vers .env et remplir les valeurs.
4. Démarrer :
     npm start
5. Ouvrir l'URL définie dans BASE_URL (par défaut http://localhost:3000).

VARIABLES D'ENVIRONNEMENT
-------------------------
DATABASE_URL            URL PostgreSQL
TWITCH_CLIENT_ID        Client ID Twitch
TWITCH_CLIENT_SECRET    Secret Twitch
TWITCH_CHANNEL          Chaîne suivie (loverdosetv)
TWITCH_BROADCASTER_ID   ID du diffuseur Twitch
SESSION_SECRET          Secret long et aléatoire pour les sessions
BASE_URL                URL publique de l'application
PORT                    Port HTTP (3000 par défaut)

Pour le tracker Twitch, enregistrer le callback :
  https://VOTRE-DOMAINE/auth/twitch/tracker/callback

DÉPLOIEMENT RENDER
------------------
- Build command : npm install
- Start command : npm start
- Renseigner toutes les variables de env.example dans les variables d'environnement Render.
- Utiliser l'URL Render publique dans BASE_URL.
- SESSION_SECRET doit être défini avec une valeur longue et aléatoire en production.
- Le serveur crée/complète automatiquement les tables et colonnes PostgreSQL nécessaires au démarrage.

NOTES
-----
- Les ressources statiques sont servies depuis public/.
- Les chemins d'assets doivent respecter exactement la casse des noms de fichiers.
- Ne pas renommer egg-premium.png, fragment-premium.png ou fond-zone-1.png sans mettre à jour index.html.
- Les modifications PC et mobile partagent la même progression serveur et le même compte.
