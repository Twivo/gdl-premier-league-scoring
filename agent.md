# Guide agent IA

Ce fichier est la référence rapide pour travailler sur GenevaDartsConnect.

## Objectif produit actuel

L’interface publique est uniquement un poste de scoring. La création du tournoi,
des tableaux, des joueurs et l’affectation des cibles appartiennent à un site de
gestion externe.

Le parcours principal est : choisir une cible, afficher automatiquement ses
matchs, scorer avec le moteur X01 existant, puis revenir au même menu de cible.

L’application reste mobile/tablette, PWA, compatible GitHub Pages, utilisable
sans Supabase et compatible avec les données historiques.

## Architecture

- `src/domain` : logique métier pure.
- `src/domain/rules` : validation X01, bust, checkout et ordre de lancer.
- `src/domain/premierLeague` : tableaux, progression, points et filtrage cible.
- `src/features/scoringStation` : accueil, sélection de cible et connexion.
- `src/features/game` : unique écran de scoring partagé.
- `src/data` : contrats et dépôts LocalStorage/Supabase.
- `src/store/premierLeagueService.ts` : création du match et résultat.
- `src/store/premierLeagueLive.ts` : Realtime avec polling côté écran.
- `src/store/LangContext.tsx` : tous les textes visibles FR/EN.
- `supabase/migrations` : schéma et RLS.

## Routes exposées

- `/` : menu de cible et matchs affectés.
- `/login` : connexion du compte de scoring.
- `/game/:id` : scoring partagé.
- `/live/:id` : lecture seule en cas de verrou.

Le routeur reste un `HashRouter`. Les écrans de création, entraînement,
statistiques et championnat peuvent rester dans le code mais ne doivent pas
être routés dans la PWA de scoring.

## Affectation des cibles

`premier_league_fixtures.target_number` est la source de vérité. Valeur
autorisée : null ou entier de 1 à 999.

Le numéro sélectionné sur le poste est conservé sous
`darts:scoring-station:target:v1`. Ne pas le mélanger aux données de match.

La liste se met à jour par Realtime, polling cinq secondes et focus de fenêtre.
Un match est cliquable seulement si ses joueurs sont connus, sa progression le
permet et il n’est pas terminé.

## Moteur et séparation des données

Ne jamais dupliquer le moteur X01 dans React ou dans la Premier League. Un match
reste reconstruit depuis `config + events`.

- championnat historique : `encounter_id` ;
- Premier League : `premier_league_competition_id`,
  `premier_league_night_id`, `premier_league_fixture_id` ;
- entraînement : aucun de ces liens.

Conserver clavier, boutons rapides, Bust, checkout, fléchettes, édition, stats,
alternance du starter, auto-save, reprise et verrou multi-appareil.

Après un résultat Premier League, sauvegarder, progresser le tableau puis
naviguer vers `/`. La cible mémorisée doit rester sélectionnée.

## Local et Supabase

Les anciennes clés LocalStorage ne doivent jamais être renommées ou supprimées.
Le mode local conserve `darts:premier-league:competitions:v1`.

Les données sont lisibles publiquement mais modifiables uniquement par
`authenticated`. Aucun secret ni clé `service_role` dans le frontend.

Migration actuelle : `0007_scoring_station_targets.sql`.
Script manuel : `supabase/scoring_station_deployment.sql`.
Script base neuve : `supabase/full_deployment_from_scratch.sql`.

## Internationalisation

Aucun texte visible hardcodé. Ajouter chaque libellé en anglais et français dans
`DICT`, puis utiliser `useT()`.

## Commandes obligatoires

```bash
npm install
npm test
npm run build
npm audit --json
```

## Conventions

- changements minimaux et ciblés ;
- aucun refactoring global inutile ;
- aucune dépendance sans justification ;
- conserver les formats et données historiques ;
- vérifier `git status --short` avant de terminer ;
- mettre à jour README, mode d’emploi, Supabase et plan de test avec tout
  changement de comportement.
