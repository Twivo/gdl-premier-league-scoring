/**
 * Data-layer types — the persistence model shared by every repository
 * implementation (local or Supabase). The domain stays untouched: a match
 * still persists exactly { config, events } and the engine recomputes the rest.
 */
import type { GameConfig, GameEvent } from '@/domain/types';
import type { EncounterPlan, Side } from '@/domain/championship/types';
import type { PremierLeagueCompetition } from '@/domain/premierLeague';

export type { PremierLeagueCompetition };

export interface Season {
  id: string;
  name: string; // "2026/2027"
  startsOn?: string | null;
  endsOn?: string | null;
  isCurrent: boolean;
}

export interface PlayerRecord {
  id: string;
  name: string;
  color?: string | null;
  active: boolean;
  createdAt?: string;
}

export type MatchStatus =
  | 'SCHEDULED' // created but not started (no scoring page reached yet)
  | 'IN_PROGRESS'
  | 'GAME_OVER'
  | 'ABANDONED';

export interface MatchRecord {
  id: string;
  seasonId: string;
  config: GameConfig;
  events: GameEvent[];
  mode: GameConfig['mode'];
  variant: GameConfig['variant'];
  status: MatchStatus;
  winnerParticipant?: string | null;
  /** Championship link (null for regular matches). */
  encounterId?: string | null;
  fixtureIndex?: number | null;
  /** Premier League links (always null for training and team championship). */
  premierLeagueCompetitionId?: string | null;
  premierLeagueNightId?: string | null;
  premierLeagueFixtureId?: string | null;
  createdAt?: string;
  updatedAt?: string;
  finishedAt?: string | null;
}

// --- query inputs ----------------------------------------------------------

export interface PlayerQuery {
  search?: string;
  activeOnly?: boolean;
  sortBy?: 'name' | 'createdAt';
  sortDir?: 'asc' | 'desc';
}

export interface MatchQuery {
  seasonId?: string;
  playerId?: string;
  mode?: GameConfig['mode'];
  status?: MatchStatus;
  /** ISO date range on created_at. */
  from?: string;
  to?: string;
  /** Regular matches only (encounter_id IS NULL) unless overridden. */
  encounterId?: string | null;
  /** All championship matches (encounter_id IS NOT NULL) — for stats screens. */
  championship?: boolean;
  /** All Premier League matches, or those from one competition. */
  premierLeague?: boolean;
  premierLeagueCompetitionId?: string;
}

// --- championship ----------------------------------------------------------

export interface TeamRecord {
  id: string;
  name: string;
  createdAt?: string;
}

export interface TeamWithPlayers extends TeamRecord {
  playerIds: string[];
}

// --- team accounts (captain / admin logins) --------------------------------

export type AccountRole = 'admin' | 'captain';

/** The signed-in account's binding: a captain is scoped to one team. */
export interface TeamAccount {
  userId: string;
  teamId: string | null;
  role: AccountRole;
}

/** A captain assignment as seen by the admin (includes the login email). */
export interface TeamAccountAssignment {
  userId: string;
  email: string;
  teamId: string | null;
  role: AccountRole;
}

export type EncounterStatus = 'IN_PROGRESS' | 'FINISHED' | 'ABANDONED';

export interface EncounterRecord {
  id: string;
  seasonId: string;
  teamAId: string;
  teamBId: string;
  plan: EncounterPlan;
  status: EncounterStatus;
  currentIndex: number;
  scoreA: number;
  scoreB: number;
  winner: Side | null;
  createdAt?: string;
  updatedAt?: string;
  finishedAt?: string | null;
}
