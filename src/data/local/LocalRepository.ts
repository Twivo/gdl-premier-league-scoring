/**
 * LocalStorage fallback (used when Supabase isn't configured, and as an
 * offline cache). Keeps the app fully usable with no backend.
 */
import { createId } from '@/lib/id';
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

const PLAYERS_KEY = 'darts:players:v2';
const MATCHES_KEY = 'darts:matches:v2';
const TEAMS_KEY = 'darts:teams:v1';
const TEAM_PLAYERS_KEY = 'darts:team-players:v1';
const ENCOUNTERS_KEY = 'darts:encounters:v1';
export const PREMIER_LEAGUE_KEY = 'darts:premier-league:competitions:v1';

function withLegacyLocalBoards(
  competition: PremierLeagueCompetition,
): PremierLeagueCompetition {
  return {
    ...competition,
    nights: competition.nights.map((night) => ({
      ...night,
      fixtures: night.fixtures.map((fixture) => {
        const legacyFixture = fixture as typeof fixture & {
          targetNumber?: number | null;
        };
        const { targetNumber: legacyBoardNumber, ...currentFixture } =
          legacyFixture;
        return {
          ...currentFixture,
          boardNumber:
            fixture.boardNumber !== undefined
              ? fixture.boardNumber
              : legacyBoardNumber !== undefined
                ? legacyBoardNumber
                : fixture.fixtureOrder,
        };
      }),
    })),
  };
}

const LOCAL_SEASON: Season = {
  id: 'local-2026-2027',
  name: '2026/2027',
  isCurrent: true,
};

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}
function write<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* ignore quota errors */
  }
}

export class LocalRepository implements DartsRepository {
  async listPlayers(query: PlayerQuery = {}): Promise<PlayerRecord[]> {
    let players = read<PlayerRecord[]>(PLAYERS_KEY, []);
    if (query.activeOnly) players = players.filter((p) => p.active);
    if (query.search) {
      const s = query.search.toLowerCase();
      players = players.filter((p) => p.name.toLowerCase().includes(s));
    }
    const dir = (query.sortDir ?? 'asc') === 'asc' ? 1 : -1;
    players.sort((a, b) =>
      query.sortBy === 'createdAt'
        ? ((a.createdAt ?? '') < (b.createdAt ?? '') ? -1 : 1) * dir
        : a.name.localeCompare(b.name) * dir,
    );
    return players;
  }

  async createPlayer(input: PlayerInput): Promise<PlayerRecord> {
    const players = read<PlayerRecord[]>(PLAYERS_KEY, []);
    const player: PlayerRecord = {
      id: createId('p'),
      name: input.name,
      color: input.color ?? null,
      active: input.active ?? true,
      createdAt: new Date().toISOString(),
    };
    write(PLAYERS_KEY, [...players, player]);
    return player;
  }

  async updatePlayer(
    id: string,
    patch: Partial<PlayerInput>,
  ): Promise<PlayerRecord> {
    const players = read<PlayerRecord[]>(PLAYERS_KEY, []);
    const next = players.map((p) => (p.id === id ? { ...p, ...patch } : p));
    write(PLAYERS_KEY, next);
    return next.find((p) => p.id === id)!;
  }

  async deletePlayer(id: string): Promise<void> {
    const players = read<PlayerRecord[]>(PLAYERS_KEY, []);
    write(
      PLAYERS_KEY,
      players.filter((p) => p.id !== id),
    );
  }

  async listSeasons(): Promise<Season[]> {
    return [LOCAL_SEASON];
  }
  async getCurrentSeason(): Promise<Season> {
    return LOCAL_SEASON;
  }

  async listMatches(query: MatchQuery = {}): Promise<MatchRecord[]> {
    let matches = read<MatchRecord[]>(MATCHES_KEY, []);
    if (query.premierLeagueCompetitionId) {
      matches = matches.filter(
        (m) => m.premierLeagueCompetitionId === query.premierLeagueCompetitionId,
      );
    } else if (query.premierLeague) {
      matches = matches.filter((m) => !!m.premierLeagueFixtureId);
    } else if (query.encounterId) {
      matches = matches.filter((m) => m.encounterId === query.encounterId);
    } else if (query.championship) {
      matches = matches.filter((m) => !!m.encounterId);
    } else {
      matches = matches.filter((m) => !m.encounterId && !m.premierLeagueFixtureId);
    }
    if (query.mode) matches = matches.filter((m) => m.mode === query.mode);
    if (query.status) matches = matches.filter((m) => m.status === query.status);
    if (query.playerId)
      matches = matches.filter((m) =>
        m.config.players.some((p) => p.id === query.playerId),
      );
    return matches.sort((a, b) =>
      (a.createdAt ?? '') < (b.createdAt ?? '') ? 1 : -1,
    );
  }

  async getMatch(id: string): Promise<MatchRecord | null> {
    return read<MatchRecord[]>(MATCHES_KEY, []).find((m) => m.id === id) ?? null;
  }

  async saveMatch(record: MatchRecord): Promise<void> {
    const matches = read<MatchRecord[]>(MATCHES_KEY, []);
    const idx = matches.findIndex((m) => m.id === record.id);
    const stamped = { ...record, updatedAt: new Date().toISOString() };
    if (idx >= 0) matches[idx] = stamped;
    else matches.push({ ...stamped, createdAt: new Date().toISOString() });
    write(MATCHES_KEY, matches);
  }

  async listInProgress(): Promise<MatchRecord[]> {
    return (await this.listMatches({ status: 'IN_PROGRESS' })).sort((a, b) =>
      (a.updatedAt ?? '') < (b.updatedAt ?? '') ? 1 : -1,
    );
  }

  async listLiveMatches(): Promise<MatchRecord[]> {
    const all = read<MatchRecord[]>(MATCHES_KEY, []).filter(
      (m) => m.status === 'IN_PROGRESS' && !m.premierLeagueFixtureId,
    );
    return all.sort((a, b) =>
      (a.updatedAt ?? '') < (b.updatedAt ?? '') ? 1 : -1,
    );
  }

  // --- teams ---------------------------------------------------------------

  async listTeams(search?: string): Promise<TeamWithPlayers[]> {
    const teams = read<TeamRecord[]>(TEAMS_KEY, []);
    const links = read<{ teamId: string; playerId: string }[]>(
      TEAM_PLAYERS_KEY,
      [],
    );
    const s = search?.trim().toLowerCase();
    return teams
      .filter((t) => !s || t.name.toLowerCase().includes(s))
      .map((t) => ({
        ...t,
        playerIds: links.filter((l) => l.teamId === t.id).map((l) => l.playerId),
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  async createTeam(name: string): Promise<TeamRecord> {
    const teams = read<TeamRecord[]>(TEAMS_KEY, []);
    const team: TeamRecord = {
      id: createId('team'),
      name: name.trim(),
      createdAt: new Date().toISOString(),
    };
    write(TEAMS_KEY, [...teams, team]);
    return team;
  }

  async updateTeam(id: string, patch: { name: string }): Promise<TeamRecord> {
    const teams = read<TeamRecord[]>(TEAMS_KEY, []).map((t) =>
      t.id === id ? { ...t, ...patch } : t,
    );
    write(TEAMS_KEY, teams);
    return teams.find((t) => t.id === id)!;
  }

  async deleteTeam(id: string): Promise<void> {
    write(
      TEAMS_KEY,
      read<TeamRecord[]>(TEAMS_KEY, []).filter((t) => t.id !== id),
    );
    write(
      TEAM_PLAYERS_KEY,
      read<{ teamId: string; playerId: string }[]>(TEAM_PLAYERS_KEY, []).filter(
        (l) => l.teamId !== id,
      ),
    );
  }

  async setTeamPlayers(teamId: string, playerIds: string[]): Promise<void> {
    const others = read<{ teamId: string; playerId: string }[]>(
      TEAM_PLAYERS_KEY,
      [],
    ).filter((l) => l.teamId !== teamId);
    write(TEAM_PLAYERS_KEY, [
      ...others,
      ...playerIds.map((playerId) => ({ teamId, playerId })),
    ]);
  }

  // --- encounters ----------------------------------------------------------

  async getEncounter(id: string): Promise<EncounterRecord | null> {
    return (
      read<EncounterRecord[]>(ENCOUNTERS_KEY, []).find((e) => e.id === id) ?? null
    );
  }

  async saveEncounter(record: EncounterRecord): Promise<void> {
    const list = read<EncounterRecord[]>(ENCOUNTERS_KEY, []);
    const idx = list.findIndex((e) => e.id === record.id);
    const stamped = { ...record, updatedAt: new Date().toISOString() };
    if (idx >= 0) list[idx] = stamped;
    else list.push({ ...stamped, createdAt: new Date().toISOString() });
    write(ENCOUNTERS_KEY, list);
  }

  async listEncounters(seasonId?: string): Promise<EncounterRecord[]> {
    return read<EncounterRecord[]>(ENCOUNTERS_KEY, [])
      .filter((e) => !seasonId || e.seasonId === seasonId)
      .sort((a, b) => ((a.createdAt ?? '') < (b.createdAt ?? '') ? 1 : -1));
  }

  async listEncountersInProgress(): Promise<EncounterRecord[]> {
    return (await this.listEncounters()).filter(
      (e) => e.status === 'IN_PROGRESS',
    );
  }

  // --- team accounts -------------------------------------------------------
  // The local fallback has no real auth, so captain accounts don't exist here.
  // The captain space is a cloud-only feature (like the admin area).

  async getMyTeamAccount(): Promise<TeamAccount | null> {
    return null;
  }
  async listTeamAccounts(): Promise<TeamAccountAssignment[]> {
    return [];
  }
  async assignCaptain(): Promise<void> {
    throw new Error('Team accounts require the cloud backend (Supabase).');
  }
  async unassignCaptain(): Promise<void> {
    throw new Error('Team accounts require the cloud backend (Supabase).');
  }

  // --- Premier League -------------------------------------------------------

  async listPremierLeagueCompetitions(): Promise<PremierLeagueCompetition[]> {
    return read<PremierLeagueCompetition[]>(PREMIER_LEAGUE_KEY, [])
      .map(withLegacyLocalBoards)
      .sort((a, b) =>
        (a.createdAt ?? '') < (b.createdAt ?? '') ? 1 : -1,
      );
  }

  async getPremierLeagueCompetition(
    id: string,
  ): Promise<PremierLeagueCompetition | null> {
    return (
      read<PremierLeagueCompetition[]>(PREMIER_LEAGUE_KEY, [])
        .map(withLegacyLocalBoards)
        .find((competition) => competition.id === id) ?? null
    );
  }

  async savePremierLeagueCompetition(
    record: PremierLeagueCompetition,
  ): Promise<void> {
    const competitions = read<PremierLeagueCompetition[]>(PREMIER_LEAGUE_KEY, []);
    const index = competitions.findIndex((competition) => competition.id === record.id);
    const now = new Date().toISOString();
    const stamped = { ...record, updatedAt: now };
    if (index >= 0) competitions[index] = stamped;
    else competitions.push({ ...stamped, createdAt: record.createdAt ?? now });
    write(PREMIER_LEAGUE_KEY, competitions);
  }
}
