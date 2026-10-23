# PvE — v489

- Les dix zones sont visibles dans le menu PC. Les zones verrouillées peuvent être consultées ; les boutons de combat restent verrouillés et le serveur garde les mêmes contrôles de progression.
- La première victoire contre le dernier adversaire de chaque zone affiche « Félicitations ! », le nom de la zone et du boss, les récompenses réelles et des confettis. La fenêtre reste ouverte jusqu’à une action du joueur.
- Sur PC, téléphone et tablette, le bouton permet de découvrir la zone suivante sans démarrer son premier combat. La dernière zone affiche un message de fin d’aventure. Les défaites et les combats rejoués ne déclenchent pas les confettis.
- La préférence de réduction des animations masque les confettis. Le clavier reste dans le résultat ; Échap le ferme et le focus revient au sélecteur de zone.
- Quatre illustrations détaillées existantes ont été récupérées et associées à leurs combats : Perlune des récifs (`tide_1`), Raie des courants (`tide_3`), Hippocampe d’écume (`tide_4`) et Renardeau givré (`frost_2`). Les fichiers sont versionnés pour éviter le cache immuable des anciennes images. Les autres illustrations existantes restent inchangées. Aucune image générée pendant cette intervention n’est incluse.

Validation : 16 tests Node réussis ; essais Chromium avec réponses API simulées sur PC 1440×1000, téléphone 390×844 et 844×390, tablette tactile 1024×1366 et 1366×1024. Vérification des zones visibles, des combats verrouillés, de la popup de fin de zone et de fin d’aventure, de la navigation vers la zone suivante, des rejouages, des défaites, de la réduction des animations et de l’absence de dépassement de la popup. Ces essais ne remplacent pas une vérification sur les appareils réels après déploiement.
