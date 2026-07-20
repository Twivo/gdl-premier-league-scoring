-- ============================================================================
-- Team accounts: one generic login per team (the "captain"), plus the admin.
--
-- Design notes
--  * A single account per team (1:1) — enforced by a unique index on team_id.
--  * Roles: 'admin' (full access, like today) and 'captain' (scoped to one
--    team). The admin account created in the Supabase dashboard needs NO row:
--    an authenticated user WITHOUT a captain row is treated as admin, which
--    keeps the documented setup flow working and stays backward compatible.
--  * READS stay public everywhere (the live/spectator/stats screens rely on it).
--    Only WRITES are scoped: a captain may write only data that involves their
--    own team; the admin may write anything.
--  * All rules are enforced here by Row-Level Security, not only in the UI.
-- ============================================================================

-- team_accounts ---------------------------------------------------------------
create table if not exists public.team_accounts (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  team_id    uuid references public.teams(id) on delete cascade,
  role       text not null default 'captain' check (role in ('admin', 'captain')),
  created_at timestamptz not null default now()
);

-- One captain account per team (nulls allowed for admin rows).
create unique index if not exists team_accounts_team_unique
  on public.team_accounts (team_id) where team_id is not null;

-- ============================================================================
-- Helper functions (SECURITY DEFINER so policies can read team_accounts
-- without recursing through its own RLS).
-- ============================================================================

-- An authenticated user is an admin unless they have a 'captain' row.
create or replace function public.current_is_admin()
returns boolean
language sql stable security definer set search_path = public as $$
  select auth.uid() is not null
     and not exists (
       select 1 from public.team_accounts
       where user_id = auth.uid() and role = 'captain'
     );
$$;

-- The team a captain is bound to (null for admins / anon).
create or replace function public.current_team_id()
returns uuid
language sql stable security definer set search_path = public as $$
  select team_id from public.team_accounts
  where user_id = auth.uid() and role = 'captain';
$$;

-- ============================================================================
-- Admin RPCs to manage captain accounts. The frontend uses the anon key and
-- cannot read auth.users directly, so assignment goes through these
-- SECURITY DEFINER functions (which check the caller is an admin).
-- ============================================================================

-- List captain assignments joined with the account email (admin only).
create or replace function public.admin_list_team_accounts()
returns table (user_id uuid, email text, team_id uuid, role text)
language sql stable security definer set search_path = public as $$
  select ta.user_id, u.email::text, ta.team_id, ta.role
  from public.team_accounts ta
  join auth.users u on u.id = ta.user_id
  where public.current_is_admin()
  order by u.email;
$$;

-- Bind an existing auth account (by email) to a team as its captain.
create or replace function public.admin_assign_captain(p_email text, p_team_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid;
begin
  if not public.current_is_admin() then
    raise exception 'Not authorized';
  end if;

  select id into v_uid from auth.users where lower(email) = lower(trim(p_email));
  if v_uid is null then
    raise exception 'No account found for email %', p_email;
  end if;

  insert into public.team_accounts (user_id, team_id, role)
  values (v_uid, p_team_id, 'captain')
  on conflict (user_id)
    do update set team_id = excluded.team_id, role = 'captain';
end;
$$;

-- Remove the captain binding for a team.
create or replace function public.admin_unassign_captain(p_team_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.current_is_admin() then
    raise exception 'Not authorized';
  end if;
  delete from public.team_accounts where team_id = p_team_id and role = 'captain';
end;
$$;

-- ============================================================================
-- Row-Level Security
-- ============================================================================
alter table public.team_accounts enable row level security;

-- A user may read their own row; an admin may read all.
drop policy if exists "team_accounts_read" on public.team_accounts;
create policy "team_accounts_read" on public.team_accounts
  for select using (user_id = auth.uid() or (select public.current_is_admin()));

-- Only admins may change bindings (normally via the RPCs above).
drop policy if exists "team_accounts_write" on public.team_accounts;
create policy "team_accounts_write" on public.team_accounts
  for all to authenticated
  using ((select public.current_is_admin()))
  with check ((select public.current_is_admin()));

-- seasons: previously any authenticated user could write. Now that captains
-- are authenticated too, restrict season management to admins only. (The app
-- never writes seasons from the frontend, so this has no functional impact.)
drop policy if exists "seasons_write" on public.seasons;
create policy "seasons_write" on public.seasons
  for all to authenticated
  using ((select public.current_is_admin()))
  with check ((select public.current_is_admin()));

-- players: admin full write; captain may create players and edit ONLY the
-- players on their own roster (no destructive delete — deactivate instead).
drop policy if exists "players_write" on public.players;
create policy "players_admin_write" on public.players
  for all to authenticated
  using ((select public.current_is_admin()))
  with check ((select public.current_is_admin()));
create policy "players_captain_insert" on public.players
  for insert to authenticated
  with check ((select public.current_team_id()) is not null);
create policy "players_captain_update" on public.players
  for update to authenticated
  using (
    exists (
      select 1 from public.team_players tp
      where tp.player_id = players.id
        and tp.team_id = (select public.current_team_id())
    )
  )
  with check (
    exists (
      select 1 from public.team_players tp
      where tp.player_id = players.id
        and tp.team_id = (select public.current_team_id())
    )
  );

-- teams: admin-only writes (a captain does not rename its own team).
drop policy if exists "teams_write" on public.teams;
create policy "teams_write" on public.teams
  for all to authenticated
  using ((select public.current_is_admin()))
  with check ((select public.current_is_admin()));

-- team_players: admin full; captain may add/remove members of THEIR team only.
drop policy if exists "team_players_write" on public.team_players;
create policy "team_players_admin_write" on public.team_players
  for all to authenticated
  using ((select public.current_is_admin()))
  with check ((select public.current_is_admin()));
create policy "team_players_captain_insert" on public.team_players
  for insert to authenticated
  with check (team_id = (select public.current_team_id()));
create policy "team_players_captain_delete" on public.team_players
  for delete to authenticated
  using (team_id = (select public.current_team_id()));

-- encounters: admin full; captain may create/score encounters that involve
-- their own team (as either side — home or away).
drop policy if exists "encounters_write" on public.encounters;
create policy "encounters_admin_write" on public.encounters
  for all to authenticated
  using ((select public.current_is_admin()))
  with check ((select public.current_is_admin()));
create policy "encounters_captain_insert" on public.encounters
  for insert to authenticated
  with check ((select public.current_team_id()) in (team_a_id, team_b_id));
create policy "encounters_captain_update" on public.encounters
  for update to authenticated
  using ((select public.current_team_id()) in (team_a_id, team_b_id))
  with check ((select public.current_team_id()) in (team_a_id, team_b_id));

-- matches: training matches (encounter_id null) stay publicly writable.
-- Championship matches require the admin OR a captain of one of the two teams.
drop policy if exists "matches_insert" on public.matches;
drop policy if exists "matches_update" on public.matches;
drop policy if exists "matches_delete" on public.matches;

create policy "matches_insert" on public.matches
  for insert
  with check (
    encounter_id is null
    or (select public.current_is_admin())
    or exists (
      select 1 from public.encounters e
      where e.id = encounter_id
        and (select public.current_team_id()) in (e.team_a_id, e.team_b_id)
    )
  );

create policy "matches_update" on public.matches
  for update
  using (
    encounter_id is null
    or (select public.current_is_admin())
    or exists (
      select 1 from public.encounters e
      where e.id = matches.encounter_id
        and (select public.current_team_id()) in (e.team_a_id, e.team_b_id)
    )
  )
  with check (
    encounter_id is null
    or (select public.current_is_admin())
    or exists (
      select 1 from public.encounters e
      where e.id = matches.encounter_id
        and (select public.current_team_id()) in (e.team_a_id, e.team_b_id)
    )
  );

-- Deleting a match stays admin-only (captains never wipe history).
create policy "matches_delete" on public.matches
  for delete to authenticated
  using ((select public.current_is_admin()));

-- match_players: linking rows for a training match stays public; for a
-- championship match it follows the same team scoping as the match itself.
drop policy if exists "match_players_insert" on public.match_players;
drop policy if exists "match_players_delete" on public.match_players;

create policy "match_players_insert" on public.match_players
  for insert
  with check (
    exists (
      select 1 from public.matches m
      where m.id = match_id and m.encounter_id is null
    )
    or (select public.current_is_admin())
    or exists (
      select 1
      from public.matches m
      join public.encounters e on e.id = m.encounter_id
      where m.id = match_id
        and (select public.current_team_id()) in (e.team_a_id, e.team_b_id)
    )
  );

create policy "match_players_delete" on public.match_players
  for delete to authenticated
  using ((select public.current_is_admin()));
