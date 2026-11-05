# Récompenses PvE

- Combat normal : 3 à 5 LoVeR’Cash au hasard ; mini-boss et boss : 10.
- Première victoire du compte : XP Lovys, XP globale, fragments et cash.
- Première victoire du même combat avec un autre Lovys : XP Lovys de base et cash uniquement.
- Toute répétition avec le même Lovys, même avant le boss : aucun gain.
- Badge et classement PvE : nombre de combats différents gagnés. Les compteurs existants sont recalculés ; les récompenses de badges déjà payées ne sont pas repêchées ni versées à nouveau.
- Au démarrage, migration automatique des victoires historiques identifiables par espèce de Lovys. Aucun versement rétroactif. Les historiques sans espèce identifiable ne permettent pas de reconstituer le combattant.
- Les remises à zéro effacent aussi le suivi par Lovys.

Validation : npm test, 89 tests réussis ; contrôles de syntaxe JS et git diff --check.

Installation après mise à jour de main :
```bash
cd ~/loverdose-watch-game
GIT_SSH_COMMAND='ssh -i /home/ubuntu/.ssh/loverwatchgame_deploy -o IdentitiesOnly=yes' git pull --ff-only origin main
sudo systemctl restart loverwatchgame
```
Si git pull échoue, s’arrêter avant le redémarrage. La migration s’exécute au démarrage, sans nouvelle dépendance.
