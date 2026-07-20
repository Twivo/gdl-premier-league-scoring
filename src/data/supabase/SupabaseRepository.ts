/** Supabase-backed implementation of DartsRepository. */
import type { SupabaseClient } from '@supabase/supabase-js';
import type { DartsRepository, PlayerInput } from '../repository';
import type {
  EncounterRecord,
  MatchQuery,
  MatchRecord,
  PlayerQuery,
  PlayerRecord,
  Season,
  TeamAccount,
  TeamAccountAssignment,
  TeamRecord,
  TeamWithPlayers,
  PremierLeagueCompetition,
} from '../types';

interface DbPlayer {
  id: string;
  name: string;
  color: string | null;
  active: boolean;
  created_at: string;
}
interface DbSeason {
  id: string;
  name: string;
  starts_on: string | null;
  ends_on: string | null;
  is_current: boolean;
}
interface DbMatch {
  id: string;
  season_id: string;
  config: MatchRecord['config'];
  events: MatchRecord['events'];
  mode: MatchRecord['mode'];
  variant: MatchRecord['variant'];
  status: MatchRecord['status'];
  winner_participant: string | null;
  encounter_id: string | null;
  fixture_index: number | null;
  premier_league_competition_id: string | null;
  premier_league_night_id: string | null;
  premier_league_fixture_id: string | null;
  created_at: string;
  updated_at: string;
  finished_at: string | null;
}

const toPlayer = (r: DbPlayer): PlayerRecord => ({
  id: r.id,
  name: r.name,
  color: r.color,
  active: r.active,
  createdAt: r.created_at,
});
const toSeason = (r: DbSeason): Season => ({
  id: r.id,
  name: r.name,
  startsOn: r.starts_on,
  endsOn: r.ends_on,
  isCurrent: r.is_current,
});
const toMatch = (r: DbMatch): MatchRecord => ({
  id: r.id,
  seasonId: r.season_id,
  config: r.config,
  events: r.events,
  mode: r.mode,
  variant: r.variant,
  status: r.status,
  winnerParticipant: r.winner_participant,
  encounterId: r.encounter_id,
  fixtureIndex: r.fixture_index,
  premierLeagueCompetitionId: r.premier_league_competition_id,
  premierLeagueNightId: r.premier_league_night_id,
  premierLeagueFixtureId: r.premier_league_fixture_id,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
  finishedAt: r.finished_at,
});

export class SupabaseRepository implements DartsRepository {
  constructor(private readonly sb: SupabaseClient) {}

  async listPlayers(query: PlayerQuery = {}): Promise<PlayerRecord[]> {
    let q = this.sb.from('players').select('*');
    if (query.activeOnly) q = q.eq('active', true);
    if (query.search) q = q.ilike('name', `%${query.search}%`);
    q = q.order(query.sortBy === 'createdAt' ? 'created_at' : 'name', {
      ascending: (query.sortDir ?? 'asc') === 'asc',
    });
    const { data, error } = await q;
    if (error) throw error;
    return (data as DbPlayer[]).map(toPlayer);
  }

  async createPlayer(input: PlayerInput): Promise<PlayerRecord> {
    const { data, error } = await this.sb
      .from('players')
      .insert({
        name: input.name,
        color: input.color ?? null,
        active: input.active ?? true,
      })
      .select('*')
      .single();
    if (error) throw error;
    return toPlayer(data as DbPlayer);
  }

  async updatePlayer(
    id: string,
    patch: Partial<PlayerInput>,
  ): Promise<PlayerRecord> {
    const { data, error } = await this.sb
      .from('players')
      .update(patch)
      .eq('id', id)
      .select('*')
      .single();
    if (error) throw error;
    return toPlayer(data as DbPlayer);
  }

  async deletePlayer(id: string): Promise<void> {
    const { error } = await this.sb.from('players').delete().eq('id', id);
    if (error) throw error;
  }

  async listSeasons(): Promise<Season[]> {
    const { data, error } = await this.sb
      .from('seasons')
      .select('*')
      .order('name', { ascending: false });
    if (error) throw error;
    return (data as DbSeason[]).map(toSeason);
  }

  async getCurrentSeason(): Promise<Season | null> {
    const { data, error } = await this.sb
      .from('seasons')
      .select('*')
      .eq('is_current', true)
      .maybeSingle();
    if (error) throw error;
    return data ? toSeason(data as DbSeason) : null;
  }

  async listMatches(query: MatchQuery = {}): Promise<MatchRecord[]> {
    let q = this.sb.from('matches').select('*');
    // Training matches (New Game, encounter_id IS NULL) and championship
    // matches are kept strictly apart: stats screens pass `championship` to
    // aggregate only championship play, never training games.
    if (query.premierLeagueCompetitionId) {
      q = q.eq('premier_league_competition_id', query.premierLeagueCompetitionId);
    } else if (query.premierLeague) {
      q = q.not('premier_league_fixture_id', 'is', null);
    } else if (query.encounterId) q = q.eq('encounter_id', query.encounterId);
    else if (query.championship) q = q.not('encounter_id', 'is', null);
    else q = q.is('encounter_id', null).is('premier_league_fixture_id', null);
    if (query.seasonId) q = q.eq('season_id', query.seasonId);
    if (query.mode) q = q.eq('mode', query.mode);
    if (query.status) q = q.eq('status', query.status);
    if (query.from) q = q.gte('created_at', query.from);
    if (query.to) q = q.lte('created_at', query.to);
    q = q.order('created_at', { ascending: false });
    const { data, error } = await q;
    if (error) throw error;
    let rows = (data as DbMatch[]).map(toMatch);
    // player filter: match_players is the source of truth, but for simplicity
    // we filter on the config snapshot which contains the real player ids.
    if (query.playerId) {
      rows = rows.filter((m) =>
        m.config.players.some((p) => p.id === query.playerId),
      );
    }
    return rows;
  }

  async getMatch(id: string): Promise<MatchRecord | null> {
    const { data, error } = await this.sb
      .from('matches')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (error) throw error;
    return data ? toMatch(data as DbMatch) : null;
  }

  async saveMatch(record: MatchRecord): Promise<void> {
    const { error } = await this.sb.from('matches').upsert({
      id: record.id,
      season_id: record.seasonId,
      config: record.config,
      events: record.events,
      mode: record.mode,
      variant: record.variant,
      status: record.status,
      winner_participant: record.winnerParticipant ?? null,
      encounter_id: record.encounterId ?? null,
      fixture_index: record.fixtureIndex ?? null,
      premier_league_competition_id: record.premierLeagueCompetitionId ?? null,
      premier_league_night_id: record.premierLeagueNightId ?? null,
      premier_league_fixture_id: record.premierLeagueFixtureId ?? null,
      finished_at: record.finishedAt ?? null,
    });
    if (error) throw error;

    // Link players for fast per-player queries (idempotent).
    const links = record.config.participants.flatMap((part) =>
      part.playerIds.map((pid) => ({
        match_id: record.id,
        player_id: pid,
        participant_id: part.id,
      })),
    );
    if (links.length) {
      await this.sb
        .from('match_players')
        .upsert(links, { onConflict: 'match_id,player_id', ignoreDuplicates: true });
    }
  }

  async listInProgress(): Promise<MatchRecord[]> {
    const { data, error } = await this.sb
      .from('matches')
      .select('*')
      .eq('status', 'IN_PROGRESS')
      .is('encounter_id', null) // regular matches only
      .is('premier_league_fixture_id', null)
      .order('updated_at', { ascending: false });
    if (error) throw error;
    return (data as DbMatch[]).map(toMatch);
  }

  async listLiveMatches(): Promise<MatchRecord[]> {
    // Every in-progress match, regular and championship — for the live view.
    const { data, error } = await this.sb
      .from('matches')
      .select('*')
      .eq('status', 'IN_PROGRESS')
      .is('premier_league_fixture_id', null)
      .order('updated_at', { ascending: false });
    if (error) throw error;
    return (data as DbMatch[]).map(toMatch);
  }

  // --- teams ---------------------------------------------------------------

  async listTeams(search?: string): Promise<TeamWithPlayers[]> {
    let q = this.sb
      .from('teams')
      .select('id, name, created_at, team_players(player_id)')
      .order('name');
    if (search) q = q.ilike('name', `%${search}%`);
    const { data, error } = await q;
    if (error) throw error;
    return (data as Array<{
      id: string;
      name: string;
      created_at: string;
      team_players: { player_id: string }[];
    }>).map((r) => ({
      id: r.id,
      name: r.name,
      createdAt: r.created_at,
      playerIds: r.team_players.map((tp) => tp.player_id),
    }));
  }

  async createTeam(name: string): Promise<TeamRecord> {
    const { data, error } = await this.sb
      .from('teams')
      .insert({ name })
      .select('id, name, created_at')
      .single();
    if (error) throw error;
    const r = data as { id: string; name: string; created_at: string };
    return { id: r.id, name: r.name, createdAt: r.created_at };
  }

  async updateTeam(id: string, patch: { name: string }): Promise<TeamRecord> {
    const { data, error } = await this.sb
      .from('teams')
      .update(patch)
      .eq('id', id)
      .select('id, name, created_at')
      .single();
    if (error) throw error;
    const r = data as { id: string; name: string; created_at: string };
    return { id: r.id, name: r.name, createdAt: r.created_at };
  }

  async deleteTeam(id: string): Promise<void> {
    const { error } = await this.sb.from('teams').delete().eq('id', id);
    if (error) throw error;
  }

  async setTeamPlayers(teamId: string, playerIds: string[]): Promise<void> {
    const del = await this.sb.from('team_players').delete().eq('team_id', teamId);
    if (del.error) throw del.error;
    if (playerIds.length) {
      const ins = await this.sb
        .from('team_players')
        .insert(playerIds.map((pid) => ({ team_id: teamId, player_id: pid })));
      if (ins.error) throw ins.error;
    }
  }

  // --- encounters ----------------------------------------------------------

  async getEncounter(id: string): Promise<EncounterRecord | null> {
    const { data, error } = await this.sb
      .from('encounters')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (error) throw error;
    return data ? toEncounter(data as DbEncounter) : null;
  }

  async saveEncounter(record: EncounterRecord): Promise<void> {
    const { error } = await this.sb.from('encounters').upsert({
      id: record.id,
      season_id: record.seasonId,
      team_a_id: record.teamAId,
      team_b_id: record.teamBId,
      plan: record.plan,
      status: record.status,
      current_index: record.currentIndex,
      score_a: record.scoreA,
      score_b: record.scoreB,
      winner: record.winner,
      finished_at: record.finishedAt ?? null,
    });
    if (error) throw error;
  }

  async listEncounters(seasonId?: string): Promise<EncounterRecord[]> {
    let q = this.sb.from('encounters').select('*').order('created_at', {
      ascending: false,
    });
    if (seasonId) q = q.eq('season_id', seasonId);
    const { data, error } = await q;
    if (error) throw error;
    return (data as DbEncounter[]).map(toEncounter);
  }

  async listEncountersInProgress(): Promise<EncounterRecord[]> {
    const { data, error } = await this.sb
      .from('encounters')
      .select('*')
      .eq('status', 'IN_PROGRESS')
      .order('updated_at', { ascending: false });
    if (error) throw error;
    return (data as DbEncounter[]).map(toEncounter);
  }

  // --- team accounts -------------------------------------------------------

  async getMyTeamAccount(): Promise<TeamAccount | null> {
    const { data: auth } = await this.sb.auth.getUser();
    if (!auth.user) return null;
    const { data, error } = await this.sb
      .from('team_accounts')
      .select('team_id, role')
      .eq('user_id', auth.user.id)
      .maybeSingle();
    if (error) throw error;
    if (!data) return null;
    const r = data as { team_id: string | null; role: TeamAccount['role'] };
    return { userId: auth.user.id, teamId: r.team_id, role: r.role };
  }

  async listTeamAccounts(): Promise<TeamAccountAssignment[]> {
    const { data, error } = await this.sb.rpc('admin_list_team_accounts');
    if (error) throw error;
    return (data as Array<{
      user_id: string;
      email: string;
      team_id: string | null;
      role: TeamAccountAssignment['role'];
    }>).map((r) => ({
      userId: r.user_id,
      email: r.email,
      teamId: r.team_id,
      role: r.role,
    }));
  }

  async assignCaptain(email: string, teamId: string): Promise<void> {
    const { error } = await this.sb.rpc('admin_assign_captain', {
      p_email: email,
      p_team_id: teamId,
    });
    if (error) throw error;
  }

  async unassignCaptain(teamId: string): Promise<void> {
    const { error } = await this.sb.rpc('admin_unassign_captain', {
      p_team_id: teamId,
    });
    if (error) throw error;
  }

  // --- Premier League -------------------------------------------------------

  async listPremierLeagueCompetitions(): Promise<PremierLeagueCompetition[]> {
    const { data, error } = await this.sb
      .from('premier_league_competitions')
      .select(PL_SELECT)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data as unknown as DbPremierLeagueCompetition[]).map(toPremierLeagueCompetition);
  }

  async getPremierLeagueCompetition(
    id: string,
  ): Promise<PremierLeagueCompetition | null> {
    const { data, error } = await this.sb
      .from('premier_league_competitions')
      .select(PL_SELECT)
      .eq('id', id)
      .maybeSingle();
    if (error) throw error;
    return data
      ? toPremierLeagueCompetition(data as unknown as DbPremierLeagueCompetition)
      : null;
  }

  async savePremierLeagueCompetition(
    record: PremierLeagueCompetition,
  ): Promise<void> {
    const competitionResult = await this.sb.from('premier_league_competitions').upsert({
      id: record.id,
      season_id: record.seasonId,
      name: record.name,
      // The DB validates exactly eight entrants when leaving DRAFT. Creating
      // the parent as DRAFT lets the normalized player rows be inserted first.
      status: 'DRAFT',
      champion_player_id: record.championPlayerId,
      finals_scheduled_at: record.finalsScheduledAt ?? null,
      settings: record.settings,
      finished_at: record.finishedAt ?? null,
    });
    if (competitionResult.error) throw competitionResult.error;

    const playerResult = await this.sb.from('premier_league_players').upsert(
      record.players.map((player) => ({
        competition_id: record.id,
        player_id: player.playerId,
        seed: player.seed,
      })),
      { onConflict: 'competition_id,player_id' },
    );
    if (playerResult.error) throw playerResult.error;

    const nightResult = await this.sb.from('premier_league_nights').upsert(
      record.nights.map((night) => ({
        id: night.id,
        competition_id: record.id,
        night_number: night.nightNumber,
        type: night.stage,
        scheduled_at: night.scheduledAt ?? null,
        status: night.status,
        winner_player_id: night.winnerPlayerId,
        finished_at: night.finishedAt ?? null,
      })),
    );
    if (nightResult.error) throw nightResult.error;

    const fixtureResult = await this.sb.from('premier_league_fixtures').upsert(
      record.nights.flatMap((night) =>
        night.fixtures.map((fixture) => ({
          id: fixture.id,
          night_id: night.id,
          // `target_number` is the deployed database column; the app-facing
          // model deliberately uses darts vocabulary (`boardNumber`).
          target_number: fixture.boardNumber ?? null,
          round: fixture.round,
          fixture_order: fixture.fixtureOrder,
          player_a_id: fixture.playerAId,
          player_b_id: fixture.playerBId,
          player_a_seed: fixture.playerASeed ?? null,
          player_b_seed: fixture.playerBSeed ?? null,
          winner_player_id: fixture.winnerPlayerId,
          match_id: fixture.matchId,
          status: fixture.status,
          best_of: fixture.bestOf,
          legs_to_win: fixture.legsToWin,
          legs_a: fixture.legsA,
          legs_b: fixture.legsB,
          finished_at: fixture.finishedAt ?? null,
        })),
      ),
    );
    if (fixtureResult.error) throw fixtureResult.error;

    const finalResult = await this.sb
      .from('premier_league_competitions')
      .update({ status: record.status })
      .eq('id', record.id);
    if (finalResult.error) throw finalResult.error;
  }

  async linkPremierLeagueMatch(input: {
    competitionId: string;
    nightId: string;
    fixtureId: string;
    matchId: string;
    finals: boolean;
  }): Promise<void> {
    // Scoring stations only own the active board. Updating these rows directly
    // avoids overwriting fixtures maintained by the tournament website.
    const fixtureResult = await this.sb
      .from('premier_league_fixtures')
      .update({ match_id: input.matchId, status: 'IN_PROGRESS' })
      .eq('id', input.fixtureId)
      .eq('night_id', input.nightId)
      .select('id')
      .single();
    if (fixtureResult.error) throw fixtureResult.error;

    const nightResult = await this.sb
      .from('premier_league_nights')
      .update({ status: 'IN_PROGRESS' })
      .eq('id', input.nightId)
      .eq('competition_id', input.competitionId);
    if (nightResult.error) throw nightResult.error;

    if (input.finals) {
      const competitionResult = await this.sb
        .from('premier_league_competitions')
        .update({ status: 'FINALS_IN_PROGRESS' })
        .eq('id', input.competitionId);
      if (competitionResult.error) throw competitionResult.error;
    }
  }
}

const PL_SELECT = `
  *,
  premier_league_players(*, players(name)),
  premier_league_nights(*, premier_league_fixtures(*))
`;

interface DbPremierLeagueCompetition {
  id: string;
  season_id: string;
  name: string;
  status: PremierLeagueCompetition['status'];
  settings: PremierLeagueCompetition['settings'];
  champion_player_id: string | null;
  finals_scheduled_at: string | null;
  created_at: string;
  updated_at: string;
  finished_at: string | null;
  premier_league_players: Array<{
    player_id: string;
    seed: number;
    players: { name: string } | Array<{ name: string }>;
  }>;
  premier_league_nights: Array<{
    id: string;
    competition_id: string;
    night_number: number | null;
    type: PremierLeagueCompetition['nights'][number]['stage'];
    scheduled_at: string | null;
    status: PremierLeagueCompetition['nights'][number]['status'];
    winner_player_id: string | null;
    created_at: string;
    updated_at: string;
    finished_at: string | null;
    premier_league_fixtures: Array<{
      id: string;
      night_id: string;
      target_number: number | null;
      round: PremierLeagueCompetition['nights'][number]['fixtures'][number]['round'];
      fixture_order: number;
      player_a_id: string | null;
      player_b_id: string | null;
      player_a_seed: number | null;
      player_b_seed: number | null;
      winner_player_id: string | null;
      match_id: string | null;
      status: PremierLeagueCompetition['nights'][number]['fixtures'][number]['status'];
      best_of: 5 | 9 | 11;
      legs_to_win: 3 | 5 | 6;
      legs_a: number;
      legs_b: number;
      created_at: string;
      updated_at: string;
      finished_at: string | null;
    }>;
  }>;
}

function relationName(value: { name: string } | Array<{ name: string }>): string {
  return Array.isArray(value) ? value[0]?.name ?? '' : value.name;
}

const toPremierLeagueCompetition = (
  row: DbPremierLeagueCompetition,
): PremierLeagueCompetition => ({
  id: row.id,
  seasonId: row.season_id,
  name: row.name,
  status: row.status,
  settings: {
    ...row.settings,
    adminUnlockedNightNumbers: row.settings.adminUnlockedNightNumbers ?? [],
  },
  championPlayerId: row.champion_player_id,
  finalsScheduledAt: row.finals_scheduled_at,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  finishedAt: row.finished_at,
  players: row.premier_league_players
    .map((player) => ({
      playerId: player.player_id,
      name: relationName(player.players),
      seed: player.seed,
    }))
    .sort((a, b) => a.seed - b.seed),
  nights: row.premier_league_nights
    .map((night) => ({
      id: night.id,
      competitionId: night.competition_id,
      nightNumber: night.night_number,
      stage: night.type,
      scheduledAt: night.scheduled_at,
      status: night.status,
      winnerPlayerId: night.winner_player_id,
      createdAt: night.created_at,
      updatedAt: night.updated_at,
      finishedAt: night.finished_at,
      fixtures: night.premier_league_fixtures
        .map((fixture) => ({
          id: fixture.id,
          nightId: fixture.night_id,
          boardNumber: fixture.target_number,
          round: fixture.round,
          fixtureOrder: fixture.fixture_order,
          playerAId: fixture.player_a_id,
          playerBId: fixture.player_b_id,
          playerASeed: fixture.player_a_seed,
          playerBSeed: fixture.player_b_seed,
          winnerPlayerId: fixture.winner_player_id,
          matchId: fixture.match_id,
          status: fixture.status,
          bestOf: fixture.best_of,
          legsToWin: fixture.legs_to_win,
          legsA: fixture.legs_a,
          legsB: fixture.legs_b,
          createdAt: fixture.created_at,
          updatedAt: fixture.updated_at,
          finishedAt: fixture.finished_at,
        }))
        .sort((a, b) => {
          const rounds = { QUARTER_FINAL: 0, SEMI_FINAL: 1, FINAL: 2 };
          return rounds[a.round] - rounds[b.round] || a.fixtureOrder - b.fixtureOrder;
        }),
    }))
    .sort((a, b) => {
      if (a.stage !== b.stage) return a.stage === 'LEAGUE' ? -1 : 1;
      return (a.nightNumber ?? 8) - (b.nightNumber ?? 8);
    }),
});

interface DbEncounter {
  id: string;
  season_id: string;
  team_a_id: string;
  team_b_id: string;
  plan: EncounterRecord['plan'];
  status: EncounterRecord['status'];
  current_index: number;
  score_a: number;
  score_b: number;
  winner: EncounterRecord['winner'];
  created_at: string;
  updated_at: string;
  finished_at: string | null;
}

const toEncounter = (r: DbEncounter): EncounterRecord => ({
  id: r.id,
  seasonId: r.season_id,
  teamAId: r.team_a_id,
  teamBId: r.team_b_id,
  plan: r.plan,
  status: r.status,
  currentIndex: r.current_index,
  scoreA: r.score_a,
  scoreB: r.score_b,
  winner: r.winner,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
  finishedAt: r.finished_at,
});
