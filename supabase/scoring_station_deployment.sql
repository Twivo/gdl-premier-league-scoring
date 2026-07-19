-- Standalone deployment for an existing database already migrated through 0006.
-- Safe to execute more than once in the Supabase SQL Editor.

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

