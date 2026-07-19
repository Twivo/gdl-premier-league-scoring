# GenevaDartsConnect — poste de scoring

PWA dédiée au scoring de fléchettes pendant une compétition. La création du
tournoi, des tableaux et l’affectation des cibles sont déléguées à un site de
gestion séparé. Cette application se concentre sur un parcours très court :

1. choisir le numéro de la cible ;
2. ouvrir un match attribué à cette cible ;
3. scorer avec le moteur X01 existant ;
4. revenir automatiquement au menu de la cible après le résultat.

Le moteur historique reste inchangé : clavier, boutons rapides, Bust, checkout,
fléchettes utilisées, historique, modification de visite, moyennes, alternance
du starter, sauvegarde automatique, reprise et verrou multi-appareil.

## Interface

La route `#/` affiche le poste de scoring. Le numéro de cible choisi est
conservé dans la clé LocalStorage versionnée
`darts:scoring-station:target:v1`.

Les fixtures dont `target_number` correspond à la cible sont affichées
automatiquement. Les mises à jour utilisent Supabase Realtime avec un polling
de secours toutes les cinq secondes.

Une carte indique :

- la Night et le tour ;
- le format Best of ;
- les deux joueurs ;
- le score en legs ;
- le statut ;
- l’action Démarrer ou Reprendre.

Le prochain match jouable est mis en évidence. Un match bloqué ou terminé
n’ouvre jamais le scoring.

Routes exposées :

- `#/` : choix de la cible et matchs affectés ;
- `#/login` : connexion du compte de scoring ;
- `#/game/:id` : écran X01 existant ;
- `#/live/:id` : lecture seule lorsque le verrou est détenu ailleurs.

Les écrans de création de tournoi, d’entraînement, de statistiques et de
championnat ne sont plus routés dans cette PWA. Leur code et leurs données
historiques sont conservés pour éviter un refactoring destructif.

## Contrat avec le futur site de tournoi

Le schéma existant Premier League reste le contrat de données. Le site de
gestion crée les saisons, joueurs, compétitions, entrants, Nights et fixtures.
Pour rendre un match visible sur un poste, il renseigne :

```sql
update public.premier_league_fixtures
set target_number = 4
where id = '<fixture-id>';
```

`target_number` accepte un entier de 1 à 999 ou `null` pour un match non
affecté. Le site de tournoi reste responsable de l’affectation. La PWA crée la
ligne `matches` au premier démarrage du match, puis conserve les liens :

- `premier_league_competition_id` ;
- `premier_league_night_id` ;
- `premier_league_fixture_id`.

`encounter_id` reste réservé au championnat historique par équipes.

## Architecture

```text
src/domain/premierLeague/targets.ts       filtrage et ordre par cible
src/features/scoringStation/              menu de cible et connexion
src/features/game/                        moteur de scoring X01 partagé
src/store/premierLeagueLive.ts            Realtime + fallback
src/store/premierLeagueService.ts         création du match et résultat
src/data/                                 dépôts LocalStorage/Supabase
supabase/migrations/0007_scoring_station_targets.sql
supabase/scoring_station_deployment.sql
```

## Supabase

Pour une base neuve, exécuter
`supabase/full_deployment_from_scratch.sql`.

Pour une base déjà migrée jusqu’à `0006`, exécuter
`supabase/scoring_station_deployment.sql` ou la migration
`0007_scoring_station_targets.sql`.

La lecture des tableaux reste publique. Le scoring et les écritures restent
réservés au rôle `authenticated`. Le frontend utilise uniquement la clé anon ;
aucune clé `service_role` n’est requise.

Voir [SUPABASE_SETUP.md](SUPABASE_SETUP.md).

## Mode local

Sans variables Supabase, les matchs et compétitions déjà présents dans le
LocalStorage restent utilisables. Le numéro de cible est conservé séparément et
aucune ancienne clé n’est renommée ou supprimée.

La création de tournoi n’est plus proposée dans l’interface, y compris en mode
local : les données doivent être préparées par le futur gestionnaire ou par un
jeu de données de développement.

## Développement

```bash
npm install
npm run dev
npm test
npm run build
```

Vite, le `HashRouter`, GitHub Pages et la PWA sont conservés.

Guides : [MODE_D_EMPLOI.md](MODE_D_EMPLOI.md) ·
[TEST_PLAN.md](TEST_PLAN.md) · [agent.md](agent.md)
