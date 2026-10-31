# CSS allégé — lot v535

Les feuilles `styles-extended`, `pve-expansion`, `return-summary`, `live-xp-boost` et `tablet` sont servies sous forme `.min.css`, dans le même ordre. Les sources restent éditables ; `npm run build:css` régénère les fichiers et `npm run check:css` détecte un fichier périmé en CI.

Seuls les commentaires autonomes et les espaces de mise en forme hors des sélecteurs et valeurs sont retirés. Les déclarations, doublons, priorités, conditions et leur ordre sont conservés. Aucun visuel n'est recompressé.

- Taille des cinq feuilles : 389 993 → 358 029 octets (−31 964, soit −8,2 %).
- Simulation gzip Node : 73 753 → 63 111 octets (−10 642, soit −14,4 %). Les en-têtes et réglages du serveur réel peuvent modifier le transfert.
- 106 tests passent, dont comparaison des arbres CSS complets et synchronisation source/fichiers servis.
- Chromium 143 : les règles CSSOM sérialisées des cinq originaux et fichiers allégés sont strictement identiques (811 / 25 / 11 / 39 / 3 règles de premier niveau).

La feuille `styles.css` reste inchangée : le parseur strict signale une accolade fermante inattendue à la ligne 2038. Modifier cette ancienne syntaxe pourrait changer la récupération des règles par le navigateur ; cette correction demande un lot séparé avec comparaison des parcours authentifiés.

Les contrôles navigateur PC/mobile/tablette de la PR restent requis. La validation locale CSSOM ne constitue pas un test des parcours connectés ou une mesure des performances du VPS.
