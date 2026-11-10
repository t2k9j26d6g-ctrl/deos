# D27 — Production : CODIR et Engagements Direction

La production conserve ses dépôts et sa synchronisation cloud habituels. Aucun module de stockage TEST isolé n’est chargé.

Les demandes de Soumia du 4 novembre 2026 sont transformées en 11 actions natives, avec source, numéro d’engagement, pilote Ludovic et interlocuteurs suggérés. Les échéances absentes restent à définir. Les projets existants sont réutilisés par identifiant stable puis correspondance univoque ; quatre projets sont créés si absents : benchmark Cholet, pilotage managérial, retraites/transmission et Wi-Fi. Les deux actions benchmark partagent le même projet et la comparaison des heures est aussi reliée au projet existant des heures indirectes.

Engagements Direction est une vue interne calculée depuis ces actions. Les boutons ouvrent les éditeurs habituels. Elle ne stocke ni statut ni échéance parallèles.

Au premier chargement connecté, les modifications locales sont d’abord synchronisées. La version courante des sept collections est lue depuis le workspace authentifié. Une sauvegarde et un plan de reprise sont enregistrés avant les écritures. Le marqueur distant archivé conserve le plan, les valeurs avant/après et un verrou de migration optimiste. Les versions serveur sont obligatoires pour toutes les mises à jour ; tout changement concurrent divergent interrompt le traitement sans l’écraser.

Les six dossiers permanents sont renommés ; les sept dossiers thématiques deviennent des projets et leurs références sont réécrites. Les dossiers d’origine sont archivés, jamais supprimés. Les opérations sont reprenables après une coupure. Les pilotes de synchronisation habituels ne sont réactivés qu’après vérification des six dossiers actifs et de chaque écriture. Aucun export privé ni jeton ne figure dans le dépôt.

Validation : tests du plan, des relations réciproques, de la réexécution, de la conservation des champs modifiés par l’utilisateur, de la reprise réseau, du verrou multi-appareils et des conflits de version. Tests DOM de l’application complète et validation complémentaire sur copie privée de la sauvegarde de travail.

La publication du code ne prouve pas l’exécution sur les données réelles : la migration se lance depuis la session DEOS connectée de l’utilisateur et affiche sa progression.

## D27.1 — Reprise des saisies TEST

La production lit, dans le même profil de navigateur et sur la même origine GitHub Pages, la copie IndexedDB TEST et sa sauvegarde initiale. Elle compare la version de départ transformée CODIR, les saisies TEST courantes et les données PROD courantes. Seuls les ajouts/modifications TEST sont repris. Les liens ajoutés depuis en PROD sont conservés. Un conflit sur un même champ conserve la version PROD et dépose la variante TEST dans un document d’arbitrage. Les suppressions TEST ne suppriment aucun objet PROD. Les documents système Journal/Priorités sont exclus du transfert brut ; les notes et To-Do récupérées passent par les mécanismes de synchronisation existants. Le prototype Engagements Direction est également repris vers les actions natives.

Sauvegarde avant écriture, versions serveur obligatoires, reprise après coupure et point de reprise par workspace/hash évitent écrasements et réimports. Le point de reprise n’est validé qu’après la synchronisation des notes et priorités. Les clés source TEST et leur sauvegarde ne sont ni supprimées ni modifiées. Aucun fichier utilisateur n’est envoyé dans GitHub.

Limite : un autre navigateur/profil ou appareil ne peut pas lire la copie locale du navigateur où TEST a été utilisé. L’utilisateur doit charger PROD une fois dans ce navigateur pour lancer la récupération automatique.

La reprise automatique est ponctuelle : après un transfert validé pour ce workspace, les essais et nouvelles saisies ultérieurs dans TEST restent isolés. Le point de reprise et la copie TEST sont conservés.

## D27.2 — Actions lisibles et rendez-vous

Les champs longs de l’éditeur Action grandissent avec leur contenu, y compris après redimensionnement. Titre et contexte utilisent désormais des champs multilignes. La synthèse Action conserve descriptions, objectif, contexte, résultat attendu, risques, prochaines étapes et notes sans limite de caractères, ainsi que tous les rendez-vous liés. Les paragraphes et retours à la ligne sont conservés. Le document A5 se pagine au lieu de forcer le contenu dans une page ; les règles de largeur et marges de l’impression isolée sont adaptées pour éviter toute coupe latérale.

Un bouton Lier un rendez-vous ouvre le sélecteur dans la fiche Action. Les rendez-vous DEOS et Google déjà chargés peuvent être recherchés et cochés. L’enregistrement conserve les références et leurs informations dans l’Action synchronisée, ainsi que les associations réciproques DEOS. Le retrait supprime les deux sens du lien. La confidentialité existante reste protégée dans la synthèse. Aucun rendez-vous Google ni invitation n’est créé ou modifié.

Validation : tests complets d’édition, sauvegarde, synthèse, sélection et retrait des liens DEOS/Google, recherche, confidentialité et références sur appareil dépourvu du cache d’agenda. Contrôle d’un PDF A5 de huit pages : 117 paragraphes et toutes les fins de section présents, contrôle des coordonnées de tous les mots et inspection visuelle des premières/dernières pages. Les données enregistrées ne sont pas tronquées par cette mise à jour.
