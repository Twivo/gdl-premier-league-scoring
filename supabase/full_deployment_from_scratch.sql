-- ============================================================================
-- DEPLOIEMENT COMPLET DEPUIS ZERO — DARTS SCORING / PREMIER LEAGUE
-- ============================================================================
--
-- Usage :
--   1. Créer un projet Supabase vide.
--   2. Ouvrir SQL Editor > New query.
--   3. Coller puis exécuter l’intégralité de ce fichier UNE SEULE FOIS.
--   4. Créer ensuite le compte organisateur dans Authentication > Users.
--
-- Ce script regroupe, dans l’ordre, les migrations 0001 à 0007. Il crée :
--   - les saisons, joueurs, matchs et participants aux matchs ;
--   - le championnat historique par équipes (compatibilité des données) ;
--   - le verrou de scoring, le temps réel et l’identification des entraînements ;
--   - toutes les tables et liaisons du module Premier League ;
--   - l’affectation des fixtures aux cibles physiques de scoring ;
--   - les contraintes, index, fonctions et triggers ;
--   - la Row-Level Security et toutes les policies nécessaires ;
--   - la saison initiale 2026/2027.
--
-- Important :
--   - ce script cible une base vide et n’est pas prévu pour être rejoué ;
--   - il ne crée aucun utilisateur Auth et ne contient aucun secret ;
--   - aucune clé service_role ne doit être placée dans le frontend ;
--   - pour une base existante, appliquer uniquement les migrations manquantes.
--
-- ============================================================================

-- SOURCE: 0001_init.sql
-- ============================================================================
-- Darts platform — initial schema (multi-season, event-sourced matches)
--
-- Design notes
--  * Matches stay EVENT-SOURCED: we persist { config, events } as jsonb and
--    recompute every stat with the same pure TypeScript engine. No stat is
--    ever stored denormalized -> always consistent and correctable.
--  * Multi-season is data-driven: adding 2027/2028, 2028/2029, ... is just a
--    new row in `seasons`. No schema change required.
--  * Security: anonymous = read-only; only authenticated users (the single
--    admin account) can write. Enforced by Row-Level Security (RLS).
-- ============================================================================

create extension if not exists "pgcrypto";

-- updated_at helper -----------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- seasons ---------------------------------------------------------------------
create table if not exists public.seasons (
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique,            -- e.g. '2026/2027'
  starts_on   date,
  ends_on     date,
  is_current  boolean not null default false,
  created_at  timestamptz not null default now()
);

-- Only one current season at a time.
create unique index if not exists seasons_one_current
  on public.seasons (is_current) where (is_current);

-- players ---------------------------------------------------------------------
create table if not exists public.players (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  color       text,
  active      boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists players_active_idx on public.players (active);
create index if not exists players_name_idx on public.players (lower(name));

drop trigger if exists trg_players_updated on public.players;
create trigger trg_players_updated before update on public.players
  for each row execute function public.set_updated_at();

-- matches (event log lives here) ----------------------------------------------
create table if not exists public.matches (
  id                  uuid primary key default gen_random_uuid(),
  season_id           uuid not null references public.seasons(id) on delete restrict,
  config              jsonb not null,                 -- GameConfig snapshot
  events              jsonb not null default '[]',    -- GameEvent[]
  -- denormalized columns for fast filtering (kept in sync from config/state)
  mode                text not null,                  -- 'SINGLE' | 'DOUBLE'
  variant             integer not null,               -- 501 | 601
  status              text not null default 'IN_PROGRESS', -- IN_PROGRESS|GAME_OVER|ABANDONED
  winner_participant  text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  finished_at         timestamptz
);
create index if not exists matches_season_idx on public.matches (season_id);
create index if not exists matches_status_idx on public.matches (status);
create index if not exists matches_created_idx on public.matches (created_at);
create index if not exists matches_mode_idx on public.matches (mode);

drop trigger if exists trg_matches_updated on public.matches;
create trigger trg_matches_updated before update on public.matches
  for each row execute function public.set_updated_at();

-- match_players (link table -> fast per-player season filtering) ---------------
create table if not exists public.match_players (
  match_id        uuid not null references public.matches(id) on delete cascade,
  player_id       uuid not null references public.players(id) on delete restrict,
  participant_id  text not null,                      -- side within the match
  primary key (match_id, player_id)
);
create index if not exists match_players_player_idx on public.match_players (player_id);

-- ============================================================================
-- Seed: first season
-- ============================================================================
insert into public.seasons (name, starts_on, ends_on, is_current)
values ('2026/2027', '2026-09-01', '2027-08-31', true)
on conflict (name) do nothing;

-- ============================================================================
-- Row-Level Security: read = everyone, write = authenticated (admin) only
-- ============================================================================
alter table public.seasons       enable row level security;
alter table public.players       enable row level security;
alter table public.matches       enable row level security;
alter table public.match_players enable row level security;

-- helper to (re)create a read+write policy pair on a table
do $$
declare t text;
begin
  foreach t in array array['seasons','players','matches','match_players'] loop
    execute format('drop policy if exists "%s_read" on public.%I', t, t);
    execute format('drop policy if exists "%s_write" on public.%I', t, t);
    execute format(
      'create policy "%s_read" on public.%I for select using (true)', t, t);
    execute format(
      'create policy "%s_write" on public.%I for all to authenticated using (true) with check (true)', t, t);
  end loop;
end$$;


-- SOURCE: 0002_public_scoring.sql
-- ============================================================================
-- Open scoring: matches can be created & scored WITHOUT signing in.
--
-- Players and seasons remain admin-only (authenticated). For matches, anyone
-- (anon) may insert and update; only the admin (authenticated) may delete, so
-- match history can't be wiped by anonymous users.
-- ============================================================================

-- matches: replace the admin-only write policy with granular public ones
drop policy if exists "matches_write" on public.matches;

create policy "matches_insert" on public.matches
  for insert with check (true);                 -- anon + authenticated

create policy "matches_update" on public.matches
  for update using (true) with check (true);    -- anon + authenticated

create policy "matches_delete" on public.matches
  for delete to authenticated using (true);     -- admin only

-- match_players: anon may link players to a match; admin may remove
drop policy if exists "match_players_write" on public.match_players;

create policy "match_players_insert" on public.match_players
  for insert with check (true);

create policy "match_players_delete" on public.match_players
  for delete to authenticated using (true);


-- SOURCE: 0003_championship.sql
-- ============================================================================
-- Championship mode: teams (many-to-many with players) and encounters.
--
-- An "encounter" is a tie between two teams made of a fixed sequence of
-- fixtures (4 singles, 2 doubles, 4 singles). Each played fixture reuses the
-- normal `matches` engine, tagged with encounter_id + fixture_index so it stays
-- out of the regular stats and feeds the championship stats instead.
--
-- Security: teams and encounters (championship scoring) require the admin
-- account (authenticated). Regular matches stay public.
-- ============================================================================

-- teams -----------------------------------------------------------------------
create table if not exists public.teams (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists teams_name_idx on public.teams (lower(name));

drop trigger if exists trg_teams_updated on public.teams;
create trigger trg_teams_updated before update on public.teams
  for each row execute function public.set_updated_at();

-- team_players (many-to-many; a player may belong to several teams) -----------
create table if not exists public.team_players (
  team_id   uuid not null references public.teams(id) on delete cascade,
  player_id uuid not null references public.players(id) on delete cascade,
  primary key (team_id, player_id)
);
create index if not exists team_players_player_idx on public.team_players (player_id);

-- encounters ------------------------------------------------------------------
create table if not exists public.encounters (
  id            uuid primary key default gen_random_uuid(),
  season_id     uuid not null references public.seasons(id) on delete restrict,
  team_a_id     uuid not null references public.teams(id) on delete restrict,
  team_b_id     uuid not null references public.teams(id) on delete restrict,
  plan          jsonb not null,            -- fixtures + compositions + settings
  status        text not null default 'IN_PROGRESS', -- IN_PROGRESS|FINISHED|ABANDONED
  current_index integer not null default 0,
  score_a       integer not null default 0,
  score_b       integer not null default 0,
  winner        text,                       -- 'A' | 'B' | null
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  finished_at   timestamptz
);
create index if not exists encounters_status_idx on public.encounters (status);
create index if not exists encounters_season_idx on public.encounters (season_id);

drop trigger if exists trg_encounters_updated on public.encounters;
create trigger trg_encounters_updated before update on public.encounters
  for each row execute function public.set_updated_at();

-- link matches to encounters (nullable -> regular matches unaffected) ----------
alter table public.matches add column if not exists encounter_id uuid
  references public.encounters(id) on delete cascade;
alter table public.matches add column if not exists fixture_index integer;
create index if not exists matches_encounter_idx on public.matches (encounter_id);

-- ============================================================================
-- Row-Level Security
-- ============================================================================
alter table public.teams        enable row level security;
alter table public.team_players enable row level security;
alter table public.encounters   enable row level security;

-- teams / team_players / encounters: read public, write admin (authenticated)
do $$
declare t text;
begin
  foreach t in array array['teams','team_players','encounters'] loop
    execute format('drop policy if exists "%s_read" on public.%I', t, t);
    execute format('drop policy if exists "%s_write" on public.%I', t, t);
    execute format('create policy "%s_read" on public.%I for select using (true)', t, t);
    execute format('create policy "%s_write" on public.%I for all to authenticated using (true) with check (true)', t, t);
  end loop;
end$$;

-- matches: championship matches (encounter_id set) require authentication;
-- regular matches (encounter_id null) stay publicly writable.
drop policy if exists "matches_insert" on public.matches;
drop policy if exists "matches_update" on public.matches;

create policy "matches_insert" on public.matches
  for insert
  with check (encounter_id is null or (select auth.role()) = 'authenticated');

create policy "matches_update" on public.matches
  for update
  using (encounter_id is null or (select auth.role()) = 'authenticated')
  with check (encounter_id is null or (select auth.role()) = 'authenticated');


-- SOURCE: 0004_live_and_lock.sql
-- ============================================================================
-- Live spectating + single-scorer lock.
--
-- 1. Realtime: broadcast `matches` row changes so read-only spectators can
--    follow a game live (no polling needed).
-- 2. Scoring lock: the device actively scoring a match holds a short-lived
--    heartbeat lock (locked_by + locked_at). Another device can only WATCH
--    while the lock is fresh; it can take control once the lock goes stale
--    (the scoring device closed / lost connection).
--
-- Idempotent: safe to re-run.
-- ============================================================================

-- 1. Enable realtime on matches (ignore if already in the publication).
do $$
begin
  alter publication supabase_realtime add table public.matches;
exception
  when duplicate_object then null;
end $$;

-- 2. Lock columns. RLS already governs who may UPDATE a match row:
--    regular matches are anon-updatable, championship matches require the
--    admin — so locking inherits exactly the right permissions.
alter table public.matches add column if not exists locked_by text;
alter table public.matches add column if not exists locked_at timestamptz;


-- SOURCE: 0005_training_flag.sql
-- ============================================================================
-- Clearly distinguish training (New Game) matches from championship matches.
--
-- A match belongs to a championship exactly when it is linked to an encounter.
-- `is_training` makes that explicit and queryable at the DB level: training
-- games must never feed championship / player stats, rankings or averages.
-- Generated, so it can never drift from encounter_id.
-- ============================================================================
alter table public.matches
  add column if not exists is_training boolean
  generated always as (encounter_id is null) stored;

comment on column public.matches.is_training is
  'True for New Game (training) matches; false for championship matches. Stats use championship only.';


-- SOURCE: 0006_premier_league.sql
-- ============================================================================
-- Individual Premier League: 7 league Nights plus Finals Night.
--
-- The X01 event log remains in public.matches. These tables only orchestrate
-- competition membership and brackets. Standings and points are deliberately
-- derived from completed fixtures, so a retry can never award points twice.
-- Idempotent and safe to run after migrations 0001 through 0005.
-- ============================================================================

-- Competitions ---------------------------------------------------------------
create table if not exists public.premier_league_competitions (
  id                   uuid primary key default gen_random_uuid(),
  season_id            uuid not null references public.seasons(id) on delete restrict,
  name                 text not null check (length(btrim(name)) > 0),
  status               text not null default 'DRAFT'
                         check (status in ('DRAFT','IN_PROGRESS','FINALS_READY','FINALS_IN_PROGRESS','FINISHED')),
  settings             jsonb not null default '{"variant":501,"outRule":"DOUBLE","alternateStarter":true,"adminUnlockedNightNumbers":[],"leagueBestOf":5,"finalsSemiBestOf":9,"finalsFinalBestOf":11}'::jsonb,
  finals_scheduled_at  timestamptz,
  champion_player_id   uuid references public.players(id) on delete restrict,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  finished_at          timestamptz
);
create index if not exists premier_league_competitions_season_idx
  on public.premier_league_competitions (season_id);
create index if not exists premier_league_competitions_status_idx
  on public.premier_league_competitions (status);

drop trigger if exists trg_premier_league_competitions_updated
  on public.premier_league_competitions;
create trigger trg_premier_league_competitions_updated
  before update on public.premier_league_competitions
  for each row execute function public.set_updated_at();

-- Exactly eight distinct entrants, with stable seeds 1 through 8. --------------
create table if not exists public.premier_league_players (
  competition_id uuid not null references public.premier_league_competitions(id) on delete cascade,
  player_id      uuid not null references public.players(id) on delete restrict,
  seed           integer not null check (seed between 1 and 8),
  created_at     timestamptz not null default now(),
  primary key (competition_id, player_id),
  unique (competition_id, seed)
);
create index if not exists premier_league_players_player_idx
  on public.premier_league_players (player_id);

create or replace function public.premier_league_limit_eight_players()
returns trigger language plpgsql as $$
begin
  if exists (
    select 1 from public.premier_league_players
    where competition_id = new.competition_id and player_id = new.player_id
  ) then
    return new;
  end if;
  if (select count(*) from public.premier_league_players
      where competition_id = new.competition_id) >= 8 then
    raise exception 'A Premier League competition cannot contain more than eight players';
  end if;
  return new;
end;
$$;
drop trigger if exists trg_premier_league_limit_eight_players
  on public.premier_league_players;
create trigger trg_premier_league_limit_eight_players
  before insert on public.premier_league_players
  for each row execute function public.premier_league_limit_eight_players();

create or replace function public.premier_league_require_eight_to_start()
returns trigger language plpgsql as $$
begin
  if new.status <> 'DRAFT' and
     (select count(*) from public.premier_league_players
      where competition_id = new.id) <> 8 then
    raise exception 'A Premier League competition requires exactly eight players before it can start';
  end if;
  return new;
end;
$$;
drop trigger if exists trg_premier_league_require_eight_to_start
  on public.premier_league_competitions;
create trigger trg_premier_league_require_eight_to_start
  before insert or update of status on public.premier_league_competitions
  for each row execute function public.premier_league_require_eight_to_start();

-- Nights ---------------------------------------------------------------------
create table if not exists public.premier_league_nights (
  id                uuid primary key default gen_random_uuid(),
  competition_id    uuid not null references public.premier_league_competitions(id) on delete cascade,
  night_number      integer,
  type              text not null check (type in ('LEAGUE','FINALS')),
  scheduled_at      timestamptz,
  status            text not null default 'SCHEDULED'
                      check (status in ('SCHEDULED','IN_PROGRESS','FINISHED')),
  winner_player_id  uuid references public.players(id) on delete restrict,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  finished_at       timestamptz,
  constraint premier_league_night_number_check check (
    (type = 'LEAGUE' and night_number between 1 and 7) or
    (type = 'FINALS' and night_number is null)
  )
);
create unique index if not exists premier_league_nights_league_slot_uidx
  on public.premier_league_nights (competition_id, night_number)
  where type = 'LEAGUE';
create unique index if not exists premier_league_nights_one_finals_uidx
  on public.premier_league_nights (competition_id)
  where type = 'FINALS';
create index if not exists premier_league_nights_competition_idx
  on public.premier_league_nights (competition_id);
create index if not exists premier_league_nights_status_idx
  on public.premier_league_nights (status);

drop trigger if exists trg_premier_league_nights_updated
  on public.premier_league_nights;
create trigger trg_premier_league_nights_updated
  before update on public.premier_league_nights
  for each row execute function public.set_updated_at();

-- Fixtures. match_id points at the existing event-sourced X01 match. ---------
create table if not exists public.premier_league_fixtures (
  id                uuid primary key default gen_random_uuid(),
  night_id          uuid not null references public.premier_league_nights(id) on delete cascade,
  round             text not null check (round in ('QUARTER_FINAL','SEMI_FINAL','FINAL')),
  fixture_order     integer not null,
  player_a_id       uuid references public.players(id) on delete restrict,
  player_b_id       uuid references public.players(id) on delete restrict,
  player_a_seed     integer check (player_a_seed between 1 and 4),
  player_b_seed     integer check (player_b_seed between 1 and 4),
  winner_player_id  uuid references public.players(id) on delete restrict,
  match_id          uuid unique references public.matches(id) on delete set null,
  status            text not null default 'BLOCKED'
                      check (status in ('BLOCKED','AVAILABLE','IN_PROGRESS','FINISHED')),
  best_of           integer not null check (best_of in (5,9,11)),
  legs_to_win       integer not null check (legs_to_win in (3,5,6)),
  legs_a            integer not null default 0 check (legs_a >= 0),
  legs_b            integer not null default 0 check (legs_b >= 0),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  finished_at       timestamptz,
  constraint premier_league_fixture_players_differ
    check (player_a_id is null or player_b_id is null or player_a_id <> player_b_id),
  constraint premier_league_fixture_slot_check check (
    (round = 'QUARTER_FINAL' and fixture_order between 1 and 4) or
    (round = 'SEMI_FINAL' and fixture_order between 1 and 2) or
    (round = 'FINAL' and fixture_order = 1)
  ),
  constraint premier_league_fixture_format_check check (
    (best_of = 5 and legs_to_win = 3) or
    (best_of = 9 and legs_to_win = 5) or
    (best_of = 11 and legs_to_win = 6)
  ),
  unique (night_id, round, fixture_order)
);
create index if not exists premier_league_fixtures_night_idx
  on public.premier_league_fixtures (night_id);
create index if not exists premier_league_fixtures_status_idx
  on public.premier_league_fixtures (status);
create index if not exists premier_league_fixtures_players_idx
  on public.premier_league_fixtures (player_a_id, player_b_id);

drop trigger if exists trg_premier_league_fixtures_updated
  on public.premier_league_fixtures;
create trigger trg_premier_league_fixtures_updated
  before update on public.premier_league_fixtures
  for each row execute function public.set_updated_at();

-- Enforce fixed formats against the parent Night and membership. --------------
create or replace function public.validate_premier_league_fixture()
returns trigger language plpgsql as $$
declare
  night_type text;
  competition uuid;
begin
  select n.type, n.competition_id into night_type, competition
  from public.premier_league_nights n where n.id = new.night_id;
  if night_type = 'LEAGUE' and (new.best_of <> 5 or new.round not in ('QUARTER_FINAL','SEMI_FINAL','FINAL')) then
    raise exception 'League Night fixtures must be Best of 5';
  end if;
  if night_type = 'FINALS' and
     ((new.round = 'SEMI_FINAL' and new.best_of <> 9) or
      (new.round = 'FINAL' and new.best_of <> 11) or
      new.round = 'QUARTER_FINAL') then
    raise exception 'Invalid Finals Night fixture format';
  end if;
  if new.player_a_id is not null and not exists (
    select 1 from public.premier_league_players p
    where p.competition_id = competition and p.player_id = new.player_a_id
  ) then raise exception 'Player A is not in this competition'; end if;
  if new.player_b_id is not null and not exists (
    select 1 from public.premier_league_players p
    where p.competition_id = competition and p.player_id = new.player_b_id
  ) then raise exception 'Player B is not in this competition'; end if;
  if new.winner_player_id is not null and
     new.winner_player_id is distinct from new.player_a_id and
     new.winner_player_id is distinct from new.player_b_id then
    raise exception 'Fixture winner must be one of its players';
  end if;
  return new;
end;
$$;
drop trigger if exists trg_validate_premier_league_fixture
  on public.premier_league_fixtures;
create trigger trg_validate_premier_league_fixture
  before insert or update on public.premier_league_fixtures
  for each row execute function public.validate_premier_league_fixture();

-- Dedicated links on matches; encounter_id remains team-championship-only. ----
alter table public.matches add column if not exists premier_league_competition_id uuid
  references public.premier_league_competitions(id) on delete cascade;
alter table public.matches add column if not exists premier_league_night_id uuid
  references public.premier_league_nights(id) on delete cascade;
alter table public.matches add column if not exists premier_league_fixture_id uuid
  references public.premier_league_fixtures(id) on delete cascade;
create unique index if not exists matches_premier_league_fixture_uidx
  on public.matches (premier_league_fixture_id)
  where premier_league_fixture_id is not null;
create index if not exists matches_premier_league_competition_idx
  on public.matches (premier_league_competition_id);
create index if not exists matches_premier_league_night_idx
  on public.matches (premier_league_night_id);

alter table public.matches drop constraint if exists matches_premier_league_links_check;
alter table public.matches add constraint matches_premier_league_links_check check (
  (premier_league_competition_id is null and premier_league_night_id is null and premier_league_fixture_id is null) or
  (premier_league_competition_id is not null and premier_league_night_id is not null and premier_league_fixture_id is not null)
);
alter table public.matches drop constraint if exists matches_competition_mode_check;
alter table public.matches add constraint matches_competition_mode_check check (
  encounter_id is null or premier_league_fixture_id is null
);

-- Keep the generated training flag accurate for all three match families. -----
alter table public.matches drop column if exists is_training;
alter table public.matches add column is_training boolean
  generated always as (
    encounter_id is null and premier_league_fixture_id is null
  ) stored;
comment on column public.matches.is_training is
  'True only for standalone training matches; false for team championship and Premier League.';

-- RLS: brackets/results are public; writes are organizer-only. ----------------
alter table public.premier_league_competitions enable row level security;
alter table public.premier_league_players enable row level security;
alter table public.premier_league_nights enable row level security;
alter table public.premier_league_fixtures enable row level security;

do $$
declare table_name text;
begin
  foreach table_name in array array[
    'premier_league_competitions',
    'premier_league_players',
    'premier_league_nights',
    'premier_league_fixtures'
  ] loop
    execute format('drop policy if exists "%s_read" on public.%I', table_name, table_name);
    execute format('drop policy if exists "%s_write" on public.%I', table_name, table_name);
    execute format('create policy "%s_read" on public.%I for select using (true)', table_name, table_name);
    execute format(
      'create policy "%s_write" on public.%I for all to authenticated using (true) with check (true)',
      table_name,
      table_name
    );
  end loop;
end $$;

-- Training stays publicly scoreable. Team championship and Premier League
-- matches require an authenticated organizer for insert/update.
drop policy if exists "matches_insert" on public.matches;
drop policy if exists "matches_update" on public.matches;
create policy "matches_insert" on public.matches
  for insert with check (
    (encounter_id is null and premier_league_fixture_id is null) or
    (select auth.role()) = 'authenticated'
  );
create policy "matches_update" on public.matches
  for update using (
    (encounter_id is null and premier_league_fixture_id is null) or
    (select auth.role()) = 'authenticated'
  ) with check (
    (encounter_id is null and premier_league_fixture_id is null) or
    (select auth.role()) = 'authenticated'
  );

drop policy if exists "match_players_insert" on public.match_players;
create policy "match_players_insert" on public.match_players
  for insert with check (
    (select auth.role()) = 'authenticated' or exists (
      select 1 from public.matches m
      where m.id = match_id
        and m.encounter_id is null
        and m.premier_league_fixture_id is null
    )
  );

-- Realtime keeps public brackets in sync between the scoring and display device.
do $$
begin
  alter publication supabase_realtime add table public.premier_league_competitions;
exception when duplicate_object then null;
end $$;
do $$
begin
  alter publication supabase_realtime add table public.premier_league_nights;
exception when duplicate_object then null;
end $$;
do $$
begin
  alter publication supabase_realtime add table public.premier_league_fixtures;
exception when duplicate_object then null;
end $$;

-- SOURCE: 0007_scoring_station_targets.sql
-- Scoring stations: assignment of each fixture to a physical dartboard.
-- The tournament management site writes target_number; scoring clients only
-- read it and filter the fixtures shown on their selected target.

alter table public.premier_league_fixtures
  add column if not exists target_number integer;

alter table public.premier_league_fixtures
  drop constraint if exists premier_league_fixtures_target_number_check;

alter table public.premier_league_fixtures
  add constraint premier_league_fixtures_target_number_check
  check (target_number is null or target_number between 1 and 999);

create index if not exists premier_league_fixtures_target_number_idx
  on public.premier_league_fixtures (target_number, status)
  where target_number is not null;

comment on column public.premier_league_fixtures.target_number is
  'Physical dartboard number assigned by the external tournament manager (1-999).';
