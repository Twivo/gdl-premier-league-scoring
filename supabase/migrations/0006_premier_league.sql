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
