# Boutique de fragments — v492

Le premier clic sur « Acheter » affiche la quantité, le coût total et le solde restant. Le joueur peut confirmer ou annuler. Le prix reste de 10 fragments par œuf ; la quantité est limitée au solde disponible et au maximum de 99 accepté par le serveur.

Après confirmation, les contrôles d’achat sont verrouillés pendant la requête. Une fois la réponse du serveur reçue, huit fragments convergent vers le centre et révèlent l’œuf, avec les images existantes du jeu. L’animation dure 1,5 seconde ; la préférence de réduction des animations passe directement au résultat. Le résultat reste affiché avec les montants réellement renvoyés par le serveur, le solde restant, et les boutons « Terminé » et « Acheter d’autres œufs » lorsque le solde le permet.

Un achat refusé affiche une erreur et ne débite aucun montant localement. Fermer puis rouvrir la fenêtre pendant la requête conserve la commande en cours. Un échec d’actualisation du jeu après une réponse d’achat réussie ne présente pas l’achat comme échoué. Le serveur et ses transactions de débit/crédit ne sont pas modifiés.

Validation : 20 tests Node, dont quatre nouveaux cas de confirmation/annulation, clics répétés et réouverture, rejet serveur, solde insuffisant ou modifié et limite de quantité. Essais Chromium avec API simulée sur PC 1440×1000, téléphone 390×844 et 320×568, tablette tactile 1024×1366 et 1366×1024 ; contrôle visuel de la confirmation, de l’animation et du résultat, du clavier, du focus et de la réduction des animations. Ces essais ne représentent pas des achats sur le site en production.
