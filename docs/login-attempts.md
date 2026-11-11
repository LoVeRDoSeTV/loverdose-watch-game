# Connexion du compte et parcours Twitch

Le message « Trop de tentatives de connexion » vient du POST `/api/account/login`, et non du démarrage ou du retour OAuth Twitch.

Le formulaire principal et son secours partagent désormais un verrou pendant la requête. Le secours annule immédiatement l’envoi HTML natif et reconnaît le traitement de chaque événement par le gestionnaire principal, même si celui-ci affiche déjà une erreur. Un clic répété ou un envoi par Entrée ne multiplie pas les demandes.

Les limites portent sur les refus d’authentification HTTP 401 : 10 par identifiant normalisé et adresse IP sur 15 minutes, avec un plafond de 60 refus par IP sur la même fenêtre pour freiner les essais sur plusieurs identifiants. Les réussites, champs invalides et erreurs techniques ne consomment pas ce quota. Les clés d’identifiants sont hachées ; aucun mot de passe n’est inclus. Les réponses HTTP 429 donnent le délai restant via Retry-After, retryAfterSeconds et un message explicite.

Les protections OAuth (état, durée de validité, session, usage unique) restent appliquées. Ces limites en mémoire sont réinitialisées au redémarrage du service.

Validation : serveur Express réel pour le seuil, le partage d’IP, le compteur des seuls 401, le plafond réseau et le délai de reprise ; tests du formulaire principal avec son secours et du secours seul pour les doubles envois, erreurs immédiates et nouvelles tentatives.
