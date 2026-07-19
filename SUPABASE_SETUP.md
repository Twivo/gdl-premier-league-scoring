# Configuration Supabase — poste de scoring

Sans Supabase, l’application utilise le mode local. Cette procédure active le
backend partagé, les affectations de cibles et l’authentification du scoring.

## 1. Projet et compte de scoring

1. Créer un projet Supabase dans une région proche.
2. Dans Authentication > Users, créer le compte utilisé par les postes de scoring.
3. Désactiver les inscriptions publiques si elles ne sont pas nécessaires.
4. Ne jamais exposer le mot de passe de base ni une clé `service_role`.

## 2. Appliquer le SQL

Pour une nouvelle base vide, coller et exécuter une seule fois le fichier
complet `supabase/full_deployment_from_scratch.sql` dans SQL Editor.

Il est également possible d’appliquer séparément, dans l’ordre, les migrations
qu’il regroupe :

1. `supabase/migrations/0001_init.sql`
2. `0002_public_scoring.sql`
3. `0003_championship.sql`
4. `0004_live_and_lock.sql`
5. `0005_training_flag.sql`
6. `0006_premier_league.sql`
7. `0007_scoring_station_targets.sql`

Pour une base existante déjà au niveau 0005, coller et exécuter le fichier
complet `supabase/premier_league_deployment.sql` dans SQL Editor. Il est
commenté, idempotent et équivalent à la migration 0006.

Pour une base déjà au niveau 0006, exécuter uniquement
`supabase/scoring_station_deployment.sql`. Ce script idempotent est équivalent à
la migration 0007.

La migration crée :

- `premier_league_competitions` ;
- `premier_league_players` ;
- `premier_league_nights` ;
- `premier_league_fixtures` ;
- la colonne `target_number` sur les fixtures, limitée à 1–999 ou `null` ;
- les colonnes `premier_league_competition_id`,
  `premier_league_night_id` et `premier_league_fixture_id` sur `matches` ;
- contraintes de statut, Night, tour, emplacement, format et joueurs distincts ;
- limite à huit joueurs et contrôle des huit joueurs avant démarrage ;
- indexes, triggers `updated_at` et publication Realtime ;
- recalcul du champ généré `is_training` pour exclure championnat et Premier
  League.

Aucune table de classement n’est créée : le frontend dérive le classement des
fixtures terminées.

## 3. RLS et policies

RLS est activée explicitement sur les quatre nouvelles tables.

- SELECT : public pour compétitions, entrants, tableaux et résultats.
- INSERT/UPDATE/DELETE : rôle `authenticated` uniquement.
- `matches` : les entraînements restent publiquement scorables ; tout match
  ayant `encounter_id` ou `premier_league_fixture_id` exige
  `authenticated` pour l’insertion et la mise à jour.
- `match_players` : un utilisateur anonyme ne peut ajouter des liens que sur un
  match d’entraînement.

Vérification recommandée dans SQL Editor :

```sql
select tablename, policyname, cmd, roles
from pg_policies
where schemaname = 'public'
  and (
    tablename like 'premier_league_%'
    or tablename in ('matches', 'match_players')
  )
order by tablename, policyname;
```

## 4. Variables frontend

Créer `.env.local` sans le committer :

```bash
VITE_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR-ANON-PUBLIC-KEY
```

La clé anon est publique par conception ; la sécurité vient des policies RLS.
Ne placer aucun secret ou `service_role` dans une variable `VITE_*`.

## 5. Contrat d’affectation des cibles

Le futur site de gestion du tournoi est responsable de la création des
compétitions et de l’affectation des fixtures. Pour envoyer un match à la cible
4 :

```sql
update public.premier_league_fixtures
set target_number = 4
where id = '<fixture-id>';
```

Pour retirer une affectation :

```sql
update public.premier_league_fixtures
set target_number = null
where id = '<fixture-id>';
```

L’index `premier_league_fixtures_target_number_idx` accélère la récupération
des matchs d’un poste. La table est déjà publiée dans Supabase Realtime et
protégée par ses policies RLS existantes.

## 6. Saisons

Au moins une saison est obligatoire lorsque le site externe crée la compétition :

```sql
update public.seasons set is_current = false where is_current = true;

insert into public.seasons (name, starts_on, ends_on, is_current)
values ('2026/2027', '2026-09-01', '2027-08-31', true)
on conflict (name) do update
set starts_on = excluded.starts_on,
    ends_on = excluded.ends_on,
    is_current = excluded.is_current;
```

L’index existant garantit une seule saison courante.

## 7. Vérification fonctionnelle

1. Affecter au moins une fixture avec `target_number` depuis SQL ou le site externe.
2. Ouvrir `#/` sans session et sélectionner cette cible : lecture publique.
3. Essayer de démarrer le match sans session : authentification requise.
4. Ouvrir `#/login`, se connecter puis démarrer le match.
5. Scorer et vérifier `matches.premier_league_fixture_id`.
6. Terminer le match et vérifier le retour automatique au menu de cible.
7. Vérifier que `encounter_id is null` et `is_training = false`.
8. Vérifier qu’une requête anonyme UPDATE sur un match Premier League est
   refusée.

## 8. GitHub Pages et PWA

Définir les mêmes valeurs publiques dans les variables/secrets du workflow
GitHub Pages :

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

Le `HashRouter` et le service worker PWA ne demandent aucune règle serveur
supplémentaire.

## 9. Sauvegarde et retour arrière

Avant la migration, sauvegarder `matches`, `players`, `seasons`,
`encounters` et `match_players`. La migration n’efface aucune ligne
historique ; elle remplace uniquement la définition du champ généré
`is_training` pour tenir compte du troisième type de match.
