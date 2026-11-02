# Référence navigateur — performance locale

Exécution GitHub Actions : 40943443314, commit 02bba931434f020cabb839fec35d7e5cf5c796d3.

| Format | Largeur page / écran | Feuilles CSS | Ressources | Octets transférés (API Performance) | DOMContentLoaded |
| --- | --- | --- | --- | --- | --- |
| PC 1440×900 | 1440 / 1440 px | 6 | 15 | 2 051 488 | 133 ms |
| Mobile 390×844 | 390 / 390 px | 6 | 15 | 2 051 488 | 78 ms |
| Tablette 820×1180 | 820 / 820 px | 6 | 15 | 2 051 488 | 84 ms |

**Interprétation :** mesures du navigateur Chromium sur serveur statique local GitHub Actions, sans authentification, réseau public ni charge du VPS. Elles ne décrivent pas le ressenti des joueurs et ne prouvent aucun gain avant/après.

**À conserver** pour comparer les nouvelles exécutions du smoke test :
- absence de débordement sur les trois tailles ;
- 6 feuilles CSS chargées sans erreur ;
- mêmes conditions de mesure pour détecter les régressions.

Prochaines validations : pages authentifiées, temps de réponse API, navigation PvE/boutique, et mesures de Web Vitals sur appareils réels.
