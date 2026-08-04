# Supabase Test Setup - DEOS V5.21C

Ce dossier prepare uniquement un backend Supabase de test pour l'authentification, l'isolation workspace et la table `deos_test_records`.

## Regles de securite

- Ne jamais mettre `service_role`, secret OAuth, mot de passe base, URL PostgreSQL, token admin ou cle privee dans le frontend.
- Seules les valeurs publiques suivantes peuvent apparaitre dans DEOS:
  - `SUPABASE_URL`
  - `SUPABASE_PUBLISHABLE_KEY`
- Toutes les tables creees par la migration ont la RLS activee.
- Aucune table metier DEOS n'est exposee dans cette version.

## Fichier frontend utilise

- `config.example.js` est charge avant `app.js` avec des valeurs inoffensives par defaut.
- Vous pouvez y renseigner ultérieurement uniquement:
  - `supabaseUrl`
  - `supabasePublishableKey`
  - `enabled`
  - `environment`
  - `authRedirectUrl`
  - `debug`
- Le panneau Parametres DEOS peut aussi enregistrer ces valeurs publiques dans `deos_settings.remoteSync` sans creer une nouvelle cle locale DEOS.

## Etapes manuelles d'installation

1. Creer un projet Supabase de test heberge.
2. Ouvrir SQL Editor.
3. Executer le fichier `supabase/migrations/001_v5_21c_auth_workspace.sql`.
4. Verifier que la RLS est activee sur:
   - `profiles`
   - `workspaces`
   - `workspace_members`
   - `sites`
   - `deos_test_records`
5. Activer Email/Password dans Supabase Auth.
6. Creer au moins un utilisateur de test dans Auth.
7. Pour un premier login, executer ensuite la fonction SQL `public.deos_initialize_workspace(...)` depuis SQL Editor ou un client admin hors frontend.

## URLs a configurer dans Supabase Auth

### Site URL

- Local Live Server: `http://127.0.0.1:5500/index.html`
- GitHub Pages: `https://t2k9j26d6g-ctrl.github.io/deos/`

### Redirect URLs

Ajouter les URL exactes utilisees:

- `http://127.0.0.1:5500/index.html`
- `https://t2k9j26d6g-ctrl.github.io/deos/`

Notes importantes:

- `file://` n'est pas pris en charge pour le mode distant V5.21C.
- Le slash final de GitHub Pages doit correspondre exactement a l'URL declaree.
- Si vous testez une URL locale differente (`localhost`, autre port, sous-dossier), ajoutez-la explicitement.
- Une mauvaise URL de redirection empechera le retour de session apres lien magique ou recuperation de mot de passe.

## Recuperation mot de passe et lien magique

- `authRedirectUrl` doit pointer vers une page DEOS servie en `http://` ou `https://`.
- Au retour de Supabase, `supabase-js` detecte la session dans l'URL et la nettoie.
- Si le retour ne correspond pas exactement a l'URL declaree, l'utilisateur verra un echec de connexion ou de recuperation.

## Workspace initial

Fonction prevue: `public.deos_initialize_workspace(p_display_name, p_workspace_name, p_site_name, p_site_code)`

Comportement:

- cree le profil si absent ;
- si l'utilisateur a deja un membership, retourne son premier workspace/site sans lui attribuer un nouveau role ;
- sinon cree un workspace ;
- cree le premier site ;
- ajoute le createur comme `owner`.

Cette approche evite qu'un frontend s'attribue arbitrairement `owner` sur un workspace existant.

## Table distante autorisee dans V5.21C

Seule `deos_test_records` est utilisee par le frontend.

Contraintes volontaires:

- label oblige a commencer par `Test` ;
- payload JSON limite a un objet de test ;
- guard frontend dans `remote-adapter.js` pour refuser les cles metier DEOS ;
- `owner_id = auth.uid()` a la creation ;
- `version` sert au controle de conflit.

## Ce qui ne doit pas etre envoye vers Supabase dans cette version

- managers reels ;
- actions reelles ;
- documents ;
- comptes-rendus ;
- agenda ;
- performance ;
- imports ;
- parametres personnels ;
- donnees Google Calendar.

## Tests manuels restants

1. Creer le projet Supabase test.
2. Executer la migration SQL.
3. Creer un utilisateur A.
4. Initialiser son workspace.
5. Se connecter depuis DEOS en Live Server.
6. Creer un `deos_test_record`.
7. Recharger et verifier la persistence.
8. Se connecter depuis un second navigateur ou appareil.
9. Verifier que le meme workspace voit les memes tests.
10. Creer un utilisateur B dans un autre workspace.
11. Verifier l'absence de visibilite croisee.
12. Verifier qu'un role `reader` ne peut pas ecrire.
13. Verifier qu'un role `contributor` peut ecrire.
14. Simuler un conflit de version.
15. Verifier la suppression logique.
16. Verifier la deconnexion.
17. Verifier une session expiree.
18. Verifier une Redirect URL incorrecte.
19. Verifier iPad/Safari.
20. Verifier GitHub Pages.