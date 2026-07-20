# Reproduire la couche « GDL Premier League + poste de scoring »

> Document de reproduction. Il décrit **exactement** ce qui a été ajouté à l'app
> de base pour la transformer en poste de scoring Premier League, afin de
> refaire la même chose sur une autre application.

## 1. Point de départ et périmètre

| | Dépôt | Dernier commit |
|---|---|---|
| **App de base** | `github.com/Twivo/darts-scoring` (remote `origin`) | `faf3d92` |
| **App cible (celle-ci)** | `github.com/Twivo/gdl-premier-league-scoring` (remote `gdlpl`) | `af1e8e0` |

Tout le travail tient en **2 commits** au-dessus de la base :

1. `a7ac2a7` — **Add Premier League competition + scoring-station features**
   (introduit toute la couche PL : domaine, UI, repositories, realtime, migrations).
2. `af1e8e0` — **Strip tournament-management surface: scoring station only**
   (retire l'UI d'organisation/admin ; ne reste que le poste de scoring).

Diff total : **35 fichiers, +4 407 / −912**. Pour rejouer le diff exact :

```bash
git diff faf3d92 af1e8e0            # tout le changement
git show a7ac2a7                    # l'ajout complet
git show af1e8e0                    # le strip
```

## 2. Idée générale

L'app de base était un scoreur de fléchettes X01 complet (501/601, championnat
par équipes, stats, création de tournoi). On la transforme en **poste de scoring
« bête »** dédié à une compétition individuelle « Premier League » :

- **Un site de gestion externe** (pas dans cette app) crée la compétition, les
  joueurs, les Nights, les brackets et **affecte chaque match à une cible
  physique** (`target_number`).
- **Cette app** ne fait plus que : lire la compétition en cours → afficher les
  matchs affectés à la cible choisie → lancer le match → scorer avec le moteur
  X01 existant → **réécrire le résultat en base** (enregistrement du match +
  résultat de la fixture + avancement du bracket) → revenir au menu.
- Le **moteur de scoring X01 d'origine reste inchangé** et partagé.

Concept clé : **le classement et les points ne sont jamais stockés**, ils sont
toujours **recalculés** à partir des fixtures terminées (un renvoi de résultat
ne peut donc jamais compter deux fois).

## 3. Modèle de données Supabase (le socle à reproduire en premier)

Fichiers : `supabase/migrations/0006_premier_league.sql` (schéma) et
`0007_scoring_station_targets.sql` (cible). Scripts « tout-en-un » aussi fournis :
`full_deployment_from_scratch.sql`, `premier_league_deployment.sql`,
`scoring_station_deployment.sql`, `seed_premier_league_players.sql`.

### 3.1 Quatre nouvelles tables

**`premier_league_competitions`**
- `id`, `season_id → seasons`, `name`
- `status` ∈ `DRAFT | IN_PROGRESS | FINALS_READY | FINALS_IN_PROGRESS | FINISHED`
- `settings` jsonb (défaut : `{variant:501, outRule:DOUBLE, alternateStarter:true, leagueBestOf:5, finalsSemiBestOf:9, finalsFinalBestOf:11, adminUnlockedNightNumbers:[]}`)
- `champion_player_id`, timestamps + trigger `set_updated_at`.

**`premier_league_players`** (les entrants) — clé `(competition_id, player_id)`
- `seed` entier **1 à 8**, `unique(competition_id, seed)`.
- Trigger `premier_league_limit_eight_players` : **max 8** joueurs.
- Trigger `premier_league_require_eight_to_start` : impossible de quitter
  `DRAFT` sans **exactement 8** joueurs.

**`premier_league_nights`**
- `night_number` (1–7 pour `type=LEAGUE`, `null` pour `type=FINALS`)
- `type` ∈ `LEAGUE | FINALS`, `status` ∈ `SCHEDULED | IN_PROGRESS | FINISHED`
- `winner_player_id`.
- Index uniques partiels : **une seule** Night par numéro de ligue, **une seule**
  Finals Night par compétition.

**`premier_league_fixtures`** (les matchs du bracket)
- `night_id`, `round` ∈ `QUARTER_FINAL | SEMI_FINAL | FINAL`, `fixture_order`
- `player_a_id`, `player_b_id`, `player_a_seed`/`player_b_seed` (1–4, affichés en Finals)
- `winner_player_id`, `match_id → matches` (**unique**, le vrai match X01)
- `status` ∈ `BLOCKED | AVAILABLE | IN_PROGRESS | FINISHED`
- `best_of` ∈ {5,9,11}, `legs_to_win` ∈ {3,5,6}, `legs_a`, `legs_b`
- **`target_number`** (migration 0007) : entier **1–999** ou `null`, écrit par le
  site de gestion, index partiel `(target_number, status)`.
- Contraintes : joueurs distincts ; slots valides par round (4 QF / 2 SF / 1 F) ;
  **format fixe** `best_of=5↔legs=3`, `9↔5`, `11↔6` ; `unique(night_id, round, fixture_order)`.
- Trigger `validate_premier_league_fixture` : Night LEAGUE ⇒ Best of 5 ;
  Finals ⇒ SF en 9 et F en 11, pas de QF ; joueurs présents dans la compétition ;
  vainqueur = un des deux joueurs.

### 3.2 Modifications de la table `matches` existante

```sql
add column premier_league_competition_id → premier_league_competitions
add column premier_league_night_id       → premier_league_nights
add column premier_league_fixture_id      → premier_league_fixtures (unique)
```
- Contrainte `matches_premier_league_links_check` : **les 3 liens ensemble, ou aucun**.
- Contrainte `matches_competition_mode_check` : `encounter_id` **XOR**
  `premier_league_fixture_id` (un match ne peut pas être à la fois championnat par
  équipes ET Premier League).
- Colonne générée `is_training` recalculée : `true` **seulement** si ni
  `encounter_id` ni `premier_league_fixture_id`.

### 3.3 Sécurité (RLS) et Realtime

- Les 4 tables PL : RLS activée, **lecture publique** (`using (true)`), **écriture
  réservée au rôle `authenticated`** (`for all to authenticated`).
- Policies `matches` durcies : insert/update d'un match PL (ou championnat) exige
  `auth.role() = 'authenticated'` ; un match d'entraînement reste public.
- `alter publication supabase_realtime add table …` sur `premier_league_competitions`,
  `premier_league_nights`, `premier_league_fixtures` (pour la synchro live).
- **Front = clé anon uniquement**, aucune clé `service_role`.

## 4. Couche domaine (pure, testée, portable) — `src/domain/premierLeague/`

C'est le cœur réutilisable, sans dépendance à React ni à Supabase.
Point d'entrée : `index.ts` (ré-exporte tout). Fichiers :

**`types.ts`** — types + `PREMIER_LEAGUE_SETTINGS`. Formats figés :
ligue Best of 5, Finals demies Best of 9, finale Best of 11 ; 501 Double Out ;
alternance du starter.

**`bracket.ts`** — génération du bracket, déterministe via une `IdFactory` injectée :
- `generateQuarterFinalPairings(playerIds)` : **méthode du cercle**. Sur **7 rounds**,
  chaque paire des 8 joueurs se rencontre **exactement une fois** en quart. L'ordre
  d'entrée rend le résultat reproductible.
- `generateLeagueNights(...)` : 7 Nights × {4 quarts + 2 demies + 1 finale}, tous Best of 5.
- `generateFinalsNight(...)` : à partir du **top 4**, 2 demies Best of 9 avec seeding
  **1v4 / 2v3**, 1 finale Best of 11. Refuse si les 7 Nights de ligue ne sont pas finies.
- `getFixture`, `validateQuarterFinalLineup`.

**`progression.ts`** — machine à états du bracket :
- `canStartFixture(...)` : une fixture est jouable si `AVAILABLE`/`IN_PROGRESS`, les
  deux joueurs connus, et la Night précédente terminée (sauf override admin ou
  `adminUnlockedNightNumbers`). La Finals exige les 7 Nights de ligue finies.
  Un match déjà `IN_PROGRESS` reste toujours reprenable.
- `recordFixtureResult(...)` : valide le score, marque `FINISHED`, **fait avancer
  le vainqueur** vers la fixture dépendante (QF 1/2→SF1, QF 3/4→SF2, SF→Finale ;
  slot A/B selon la parité de l'ordre), et met à jour les statuts Night/compétition
  (fin de finale ⇒ Night finie ; toutes les Nights de ligue finies ⇒ `FINALS_READY` ;
  finale de la Finals ⇒ compétition `FINISHED` + `champion_player_id`).
- `officialTerminalLegScore(...)` : normalise le score de legs quand X01 se termine
  par forfait, pour toujours exposer un score de bracket valide.
- `reopenFixtureResult` / `correctionBlockReason` : correction d'un résultat tant
  que la fixture dépendante n'a pas démarré.
- Fonctions **pures** : `structuredClone` de la compétition, aucune mutation en place.

**`standings.ts`** — `calculateStandings(competition)` **dérivé** des Nights de ligue
terminées. **Barème par Night de ligue** : vainqueur **+5**, finaliste perdant **+3**,
demi-finaliste perdant **+2**. Départage : points → victoires de Night →
différence de legs → legs gagnés → matchs gagnés → **confrontation directe** → nom.
`selectTopFour` alimente la Finals.

**`competition.ts`** — `validateCompetitionPlayers` (8 uniques), `withFinalsNight`,
`replaceQuarterFinals` (édition des quarts tant que non démarrés).

**`targets.ts`** — logique du poste de scoring :
- `isValidTargetNumber` (1–999), `targetNumbers(competition)` (cibles distinctes triées).
- `fixturesForTarget(competition, n)` : filtre les fixtures dont `targetNumber === n`
  et les **ordonne** par priorité de statut (`IN_PROGRESS < AVAILABLE < BLOCKED <
  FINISHED`), puis LEAGUE avant FINALS, puis numéro de Night, puis round, puis ordre.

Tests : `src/domain/premierLeague/__tests__/premierLeague.test.ts` (≈372 lignes) et
`src/data/local/__tests__/premierLeagueLocal.test.ts`.

## 5. Couche d'accès aux données — `src/data/`

**`data/types.ts`** — `MatchRecord` gagne 3 champs optionnels :
`premierLeagueCompetitionId | premierLeagueNightId | premierLeagueFixtureId`.
`MatchQuery` gagne `premierLeague?` et `premierLeagueCompetitionId?`.

**`data/repository.ts`** — l'interface `DartsRepository` (contrat commun local/cloud)
gagne 3 méthodes :
```ts
listPremierLeagueCompetitions(): Promise<PremierLeagueCompetition[]>;
getPremierLeagueCompetition(id): Promise<PremierLeagueCompetition | null>;
savePremierLeagueCompetition(record): Promise<void>;
```
Ces méthodes **assemblent/aplatissent** l'agrégat compétition → Nights → fixtures.

**Implémentations** :
- `data/local/LocalRepository.ts` (+70) — persistance LocalStorage (mode hors-ligne/dev).
- `data/supabase/SupabaseRepository.ts` (+247) — lecture des 4 tables + upsert de
  l'agrégat, mapping colonnes snake_case ↔ champs camelCase.

## 6. Stores / logique applicative — `src/store/`

**`premierLeagueService.ts`** — orchestration (poste de scoring **uniquement**, en
lecture + écriture de résultat) :
- `loadCurrentPremierLeagueCompetition()` : 1re compétition non `FINISHED`.
- `launchPremierLeagueFixture(...)` : vérifie `canStartFixture`, construit la
  `GameConfig` X01 (501, Double Out, `legsToWin` de la fixture, starter choisi,
  alternance), **crée le `MatchRecord`** avec les 3 liens PL, persiste, passe la
  fixture/Night en `IN_PROGRESS`. Idempotent : si `matchId` existe déjà, le renvoie.
- `completePremierLeagueFixture(...)` : à la fin du match, appelle
  `recordFixtureResult` et sauvegarde. Ré-entrant (si déjà `FINISHED`, no-op).
- ⚠️ Ce fichier a été **fortement réduit** au commit `af1e8e0` (−168 lignes) : toutes
  les fonctions de création/édition/admin/réouverture ont été retirées (déléguées
  au site externe).

**`premierLeagueLive.ts`** — `subscribePremierLeagueChanges(onChange)` : abonnement
Supabase Realtime sur `premier_league_competitions/nights/fixtures` **et** `matches`.
Renvoie une fonction de désabonnement. No-op si Supabase non configuré (le **polling
5 s** prend le relais).

**`GameContext.tsx`** (+12) — `GameProvider` accepte et persiste les 3 liens PL dans
le `MatchRecord` auto-sauvegardé.

## 7. Interface utilisateur — `src/features/`

**`scoringStation/ScoringStationHome.tsx`** (≈589 lignes, écran principal `#/`) :
- Choix de la cible (`TargetPicker`, saisie 1–999 + raccourcis des cibles connues) ;
  le numéro est mémorisé dans **LocalStorage `darts:scoring-station:target:v1`**.
- Rafraîchissement : `subscribePremierLeagueChanges` + `setInterval 5000` + refresh
  au `focus`. Calcule les scores de legs en direct via `buildGameState` du moteur.
- Deux sections : « Matchs à jouer » / « Terminés ». Met en évidence le **prochain
  match jouable** (`canStartFixture`). Modale de choix du **starter** avant lancement.
- `ConnectionAction` : indicateur connecté/local + login/logout.

**`scoringStation/ScoringLogin.tsx`** — connexion du compte de scoring (réutilise
`AdminLogin`).

**`premierLeague/errors.ts`** — `premierLeagueErrorText(t, cause)` : mappe les codes
d'erreur du domaine (`FIXTURE_NOT_AVAILABLE`, `INVALID_LEG_SCORE`, …) vers des
messages i18n.

**`game/GameRoute.tsx`** (+102) — intégration au moteur existant :
- Si le match porte un `premierLeagueFixtureId`, rend `PremierLeagueGameSession`
  (sinon le `GameScreen` normal).
- **Reprendre** un match PL exige le mot de passe organisateur (`AdminLogin`) ;
  **verrou multi-appareil** (heartbeat) conservé, bascule vers `#/live/:id` si un
  autre appareil score.
- En fin de partie : persiste le match, appelle `completePremierLeagueFixture`
  (avec `officialTerminalLegScore`), puis revient à `#/`. Bouton **Réessayer** si
  l'écriture échoue.

## 8. Routing — `src/App.tsx`

Réduit à **4 routes** :
```
#/          → ScoringStationHome
#/login     → ScoringLogin
#/game/:id  → GameRoute (moteur X01)
#/live/:id  → LiveMatch (lecture seule si verrou ailleurs)
*           → redirige vers #/
```
Toutes les routes de création de tournoi / entraînement / stats / championnat /
admin PL **ne sont plus exposées** (`HashRouter` conservé).

## 9. Internationalisation — `src/store/LangContext.tsx`

**+115 clés** FR/EN sous les préfixes `scoringStation.*` et `premierLeague.*`
(format `"clé": { en: "...", fr: "..." }`). Inclut libellés de rounds, statuts de
fixture, Night/Finals, formats Best of, messages d'attente et d'erreur.

## 10. Config, PWA, déploiement

- `index.html` : titre → « GenevaDartsConnect — poste de scoring ».
- `vite.config.ts` : manifest PWA renommé (« scoring station », description
  « target assignments »). Vite + `base` GitHub Pages conservés.
- `.github/workflows/deploy.yml` : déploiement GitHub Pages conservé.
- Docs réécrites : `README.md`, `MODE_D_EMPLOI.md`, `SUPABASE_SETUP.md`,
  `TEST_PLAN.md`, `agent.md`.

## 11. Ce que le commit « strip » (`af1e8e0`) a supprimé

Fichiers retirés (l'app n'est plus un gestionnaire de tournoi) :
- `features/premierLeague/PremierLeagueHome.tsx` (accueil compétition)
- `features/premierLeague/PremierLeagueAdmin.tsx` (création/édition/overrides)
- `features/premierLeague/NightBracket.tsx` (affichage bracket)
- `features/premierLeague/StandingsTable.tsx` (classement)
- + les fonctions d'écriture d'organisation dans `premierLeagueService.ts`.

⚠️ Le **domaine `src/domain/premierLeague/` et ses tests sont conservés** (utilisés
par le chemin de scoring : `canStartFixture`, `recordFixtureResult`,
`officialTerminalLegScore`, `fixturesForTarget`).

---

## 12. Checklist de reproduction sur une autre app

1. **Base de données** : rejouer `0006_premier_league.sql` puis
   `0007_scoring_station_targets.sql` (ou `full_deployment_from_scratch.sql` sur une
   base neuve). Vérifier RLS (lecture publique / écriture `authenticated`) + Realtime.
2. **Domaine** : porter tel quel `src/domain/premierLeague/` (pur TypeScript, aucune
   dépendance) + ses tests. C'est le composant le plus réutilisable.
3. **Types & repository** : ajouter les 3 liens PL au `MatchRecord`, les champs de
   `MatchQuery`, et les 3 méthodes `…PremierLeagueCompetition…` à l'interface
   repository, puis les implémenter (local + backend).
4. **Stores** : `premierLeagueService.ts` (launch + complete) et
   `premierLeagueLive.ts` (realtime + fallback polling).
5. **Moteur** : brancher `GameProvider`/`GameRoute` pour porter les 3 liens PL et
   appeler `completePremierLeagueFixture` en fin de partie.
6. **UI** : `ScoringStationHome` (choix de cible + liste + starter) et `ScoringLogin`,
   avec la clé LocalStorage `darts:scoring-station:target:v1`.
7. **Routing** : réduire aux 4 routes, rediriger le reste vers `#/`.
8. **i18n** : ajouter les clés `scoringStation.*` / `premierLeague.*`.
9. **PWA/déploiement** : manifest + workflow Pages si nécessaire.

### Règles métier à ne pas perdre (résumé)
- 8 joueurs · 7 Nights de ligue + 1 Finals Night.
- Night de ligue : 4 QF + 2 SF + 1 F, **tous Best of 5** ; méthode du cercle.
- Finals : top 4 · SF **1v4 / 2v3** en Best of 9 · Finale en Best of 11.
- Points de ligue : **+5 / +3 / +2** (vainqueur / finaliste / demi-finaliste).
- Classement **toujours recalculé**, jamais stocké.
- Une cible = `target_number` (1–999) écrit par le site externe ; l'app **lit** et filtre.
- Reprise d'un match PL protégée par mot de passe organisateur + verrou multi-appareil.
