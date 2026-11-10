# D27 — Production : CODIR et Engagements Direction

La production conserve ses dépôts et sa synchronisation cloud habituels. Aucun module de stockage TEST isolé n’est chargé.

Les demandes de Soumia du 4 novembre 2026 sont transformées en 11 actions natives, avec source, numéro d’engagement, pilote Ludovic et interlocuteurs suggérés. Les échéances absentes restent à définir. Les projets existants sont réutilisés par identifiant stable puis correspondance univoque ; quatre projets sont créés si absents : benchmark Cholet, pilotage managérial, retraites/transmission et Wi-Fi. Les deux actions benchmark partagent le même projet et la comparaison des heures est aussi reliée au projet existant des heures indirectes.

Engagements Direction est une vue interne calculée depuis ces actions. Les boutons ouvrent les éditeurs habituels. Elle ne stocke ni statut ni échéance parallèles.

Au premier chargement connecté, les modifications locales sont d’abord synchronisées. La version courante des sept collections est lue depuis le workspace authentifié. Une sauvegarde et un plan de reprise sont enregistrés avant les écritures. Le marqueur distant archivé conserve le plan, les valeurs avant/après et un verrou de migration optimiste. Les versions serveur sont obligatoires pour toutes les mises à jour ; tout changement concurrent divergent interrompt le traitement sans l’écraser.

Les six dossiers permanents sont renommés ; les sept dossiers thématiques deviennent des projets et leurs références sont réécrites. Les dossiers d’origine sont archivés, jamais supprimés. Les opérations sont reprenables après une coupure. Les pilotes de synchronisation habituels ne sont réactivés qu’après vérification des six dossiers actifs et de chaque écriture. Aucun export privé ni jeton ne figure dans le dépôt.

Validation : tests du plan, des relations réciproques, de la réexécution, de la conservation des champs modifiés par l’utilisateur, de la reprise réseau, du verrou multi-appareils et des conflits de version. Tests DOM de l’application complète et validation complémentaire sur copie privée de la sauvegarde de travail.

La publication du code ne prouve pas l’exécution sur les données réelles : la migration se lance depuis la session DEOS connectée de l’utilisateur et affiche sa progression.
