/**
 * Repository & Auth contracts. The whole app depends on these interfaces, not
 * on a concrete backend — so we can swap LocalStorage (offline / dev) and
 * Supabase (cloud) without touching feature code, and add new backends later.
 */
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
} from './types';

export interface PlayerInput {
  name: string;
  color?: string | null;
  active?: boolean;
}

export interface DartsRepository {
  // players ---------------------------------------------------------------
  listPlayers(query?: PlayerQuery): Promise<PlayerRecord[]>;
  createPlayer(input: PlayerInput): Promise<PlayerRecord>;
  updatePlayer(id: string, patch: Partial<PlayerInput>): Promise<PlayerRecord>;
  deletePlayer(id: string): Promise<void>;

  // seasons ---------------------------------------------------------------
  listSeasons(): Promise<Season[]>;
  getCurrentSeason(): Promise<Season | null>;

  // matches (event-sourced) ----------------------------------------------
  listMatches(query?: MatchQuery): Promise<MatchRecord[]>;
  getMatch(id: string): Promise<MatchRecord | null>;
  /** Upsert — used by the transparent auto-save on every important action. */
  saveMatch(record: MatchRecord): Promise<void>;
  /** Matches still in progress (for the resume prompt). */
  listInProgress(): Promise<MatchRecord[]>;
  /** All in-progress matches (regular + championship) for the live view. */
  listLiveMatches(): Promise<MatchRecord[]>;

  // teams (championship) --------------------------------------------------
  listTeams(search?: string): Promise<TeamWithPlayers[]>;
  createTeam(name: string): Promise<TeamRecord>;
  updateTeam(id: string, patch: { name: string }): Promise<TeamRecord>;
  deleteTeam(id: string): Promise<void>;
  /** Replace a team's player membership. */
  setTeamPlayers(teamId: string, playerIds: string[]): Promise<void>;

  // encounters (championship) --------------------------------------------
  getEncounter(id: string): Promise<EncounterRecord | null>;
  saveEncounter(record: EncounterRecord): Promise<void>;
  listEncounters(seasonId?: string): Promise<EncounterRecord[]>;
  listEncountersInProgress(): Promise<EncounterRecord[]>;

  // team accounts (captain / admin logins) -------------------------------
  /** The signed-in account's role + team binding (null when not applicable). */
  getMyTeamAccount(): Promise<TeamAccount | null>;
  /** Admin: list every captain assignment with its login email. */
  listTeamAccounts(): Promise<TeamAccountAssignment[]>;
  /** Admin: bind an existing account (by email) to a team as its captain. */
  assignCaptain(email: string, teamId: string): Promise<void>;
  /** Admin: remove a team's captain binding. */
  unassignCaptain(teamId: string): Promise<void>;

  // Premier League (separate aggregate; standings remain derived) ----------
  listPremierLeagueCompetitions(): Promise<PremierLeagueCompetition[]>;
  getPremierLeagueCompetition(id: string): Promise<PremierLeagueCompetition | null>;
  savePremierLeagueCompetition(record: PremierLeagueCompetition): Promise<void>;
}

// --- Authentication --------------------------------------------------------

export interface AuthUser {
  id: string;
  email?: string;
}

export interface AuthProvider {
  getUser(): Promise<AuthUser | null>;
  signIn(email: string, password: string): Promise<void>;
  signOut(): Promise<void>;
  /** Subscribe to auth changes; returns an unsubscribe function. */
  onChange(cb: (user: AuthUser | null) => void): () => void;
}
