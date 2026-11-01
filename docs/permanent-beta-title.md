# Titre Bêta testeur

Titre violet `reward_title_beta_tester`, non achetable, non consommable et disponible dans l’inventaire des bénéficiaires. L’attribution ne remplace pas leur titre équipé ; ils choisissent de le porter.

La campagne unique `beta-testers-v1` recherche au prochain démarrage les comptes Twitch liés déjà présents : LoVeRMiyu (la variante saisie « lovermyiu » est aussi reconnue), LoVeRKiLLeR avec ou sans underscores, et l’unique login Twitch commençant par `lzk`. Les pseudos librement choisis dans le jeu ne servent pas à l’attribution.

Le compte du diffuseur est exclu. Si les deux logins complets sont reconnus et que les seuls trois autres comptes Twitch présents sont ceux des joueurs, le compte restant peut résoudre le surnom abrégé « lzk » (notamment une confusion I/l). Cette déduction exige la présence du compte diffuseur configuré et exactement trois autres comptes liés.

Les trois correspondances doivent être uniques et distinctes. Si un compte manque ou est ambigu, aucun titre n’est attribué et le journal serveur indique les correspondances non résolues. La campagne reste en attente ; les filtres doivent être précisés avant redémarrage si plusieurs comptes correspondent. Une fois terminée, elle ne recherche plus jamais de nouveaux bénéficiaires, même après changement de pseudo ou arrivée d’un autre joueur au nom similaire.

Les droits sont enregistrés dans `account_permanent_rewards`, associés à l’identifiant du compte et à l’identifiant Twitch d’origine. Les resets individuels et globaux préservent cette table, le marqueur de campagne et les objets d’inventaire correspondants. Les autres objets continuent d’être réinitialisés normalement. Un redémarrage restaure aussi un objet permanent éventuellement absent de l’inventaire, sans doublon.

Un reset peut déséquiper le titre, mais ne retire jamais sa possession. La suppression définitive du compte reste une suppression du compte, distincte d’une réinitialisation de progression.

Validation : résolution ambiguë refusée, attribution aux trois seuls comptes, deux resets globaux successifs, reset individuel, conservation de l’inventaire permanent et absence de nouveau bénéficiaire après renommage/arrivée d’un autre joueur. Tests sur base PGlite en mémoire ; aucun accès direct à la base de production.

La fiche joueur administrateur affiche un lien direct vers la chaîne Twitch et les titres permanents effectivement enregistrés.
