# Réclamation des défis — v497

Depuis « À faire maintenant », le raccourci ouvrait la fiche du défi. Son bouton envoyait bien la demande, mais le message de résultat restait dans la liste derrière la fenêtre et la fiche n’était pas reconstruite après la réponse. Le bouton « Réclamer » pouvait donc rester affiché après une réussite.

La fiche possède désormais un message de résultat visible. Pendant la demande, les boutons du même défi sont désactivés dans la fiche et dans la liste. Après validation du serveur, le défi passe immédiatement à l’état réclamé, son raccourci est retiré et la fiche affiche les montants effectivement reçus, y compris la mention d’XP Lovys en attente. Une erreur apparaît dans la fiche et rend le bouton disponible pour réessayer.

Les résultats sont associés au défi et à la date. Une réponse de liste ancienne ne réactive pas un défi déjà réclamé ; le changement de journée réinitialise ces résultats. Fermer la fiche pendant une demande ne la rouvre pas à la fin de celle-ci. Un échec d’actualisation annexe ne transforme pas une réclamation réussie en échec. Les règles et les transactions d’attribution des récompenses côté serveur sont inchangées.

Validation : quatre tests de régression Node (clics répétés et réponse de liste ancienne, refus puis nouvel essai, fermeture pendant une demande, nouvelle journée). Essais Chromium avec réponses API simulées sur PC 1440×1000, téléphone 390×844 et 320×568, tablette tactile 1024×1366. Le défaut a été reproduit avec le code précédent ; les parcours par raccourci et par liste, le résultat visible, les erreurs et l’échec d’actualisation ont été vérifiés après correction. Aucun gain réel n’a été réclamé sur le site en production pendant ces essais.
