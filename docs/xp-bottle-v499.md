# v499 — Bouteille d’XP

- Boutique → Objets : bouteille consommable de 100 XP Lovys à 200 LoVeR’Cash.
- L’achat ajoute la bouteille à l’inventaire. Son utilisation demande confirmation, consomme une bouteille et crédite la réserve d’XP. Le joueur choisit ensuite son Lovys avec « Donner de l’XP ».
- Le montant est fixe, sans multiplicateur de booster, et reste disponible avant l’éclosion ou avec un Lovys au niveau maximal. La courbe des niveaux ne change pas.
- Le serveur fixe le prix et la récompense. Consommation, crédit et historique sont atomiques. Une erreur de notification après validation ne transforme pas l’utilisation réussie en échec.
- Confirmation et résultat accessibles au clavier sur PC, mobile et tablette. Les clics répétés sont bloqués pendant la confirmation et l’utilisation ; une erreur d’actualisation ne masque pas le succès.

Validation : 51 tests réussis avec `node --test test/*.test.js tests/*.test.mjs`, vérification syntaxique de `server.js` et `public/app.js`, et `git diff --check`. Parcours navigateur avec API simulée sur PC 1440 px, téléphones 390 et 320 px, et tablette 1024 px : annulation, confirmation, clics répétés, crédit, refus serveur et échec d’actualisation.

Publication du code sur GitHub uniquement ; aucun changement du VPS.
