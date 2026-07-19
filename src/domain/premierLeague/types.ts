export type PremierLeagueStage = 'LEAGUE' | 'FINALS';

export type PremierLeagueStatus =
  | 'IN_PROGRESS'
  | 'FINALS_READY'
  | 'FINALS_IN_PROGRESS'
  | 'FINISHED';

export type PremierLeagueNightStatus =
  | 'SCHEDULED'
  | 'IN_PROGRESS'
  | 'FINISHED';

export type PremierLeagueFixtureStatus =
  | 'BLOCKED'
  | 'AVAILABLE'
  | 'IN_PROGRESS'
  | 'FINISHED';

export type PremierLeagueRound =
  | 'QUARTER_FINAL'
  | 'SEMI_FINAL'
  | 'FINAL';

export interface PremierLeagueSettings {
  leagueBestOf: 5;
  finalsSemiBestOf: 9;
  finalsFinalBestOf: 11;
  variant: 501;
  outRule: 'DOUBLE';
  alternateStarter: true;
  /** Explicit organizer exceptions for starting a future league Night. */
  adminUnlockedNightNumbers: number[];
}

export interface PremierLeagueEntrant {
  playerId: string;
  name: string;
  seed: number;
}

export interface PremierLeagueFixture {
  id: string;
  nightId: string;
  /** Physical dartboard assigned by the external tournament manager. */
  targetNumber?: number | null;
  round: PremierLeagueRound;
  fixtureOrder: number;
  playerAId: string | null;
  playerBId: string | null;
  /** Original league position, displayed on Finals Night. */
  playerASeed?: number | null;
  playerBSeed?: number | null;
  winnerPlayerId: string | null;
  matchId: string | null;
  status: PremierLeagueFixtureStatus;
  bestOf: 5 | 9 | 11;
  legsToWin: 3 | 5 | 6;
  legsA: number;
  legsB: number;
  createdAt?: string;
  updatedAt?: string;
  finishedAt?: string | null;
}

export interface PremierLeagueNight {
  id: string;
  competitionId: string;
  nightNumber: number | null;
  stage: PremierLeagueStage;
  scheduledAt?: string | null;
  status: PremierLeagueNightStatus;
  winnerPlayerId: string | null;
  fixtures: PremierLeagueFixture[];
  createdAt?: string;
  updatedAt?: string;
  finishedAt?: string | null;
}

export interface PremierLeagueCompetition {
  id: string;
  seasonId: string;
  name: string;
  status: PremierLeagueStatus;
  settings: PremierLeagueSettings;
  players: PremierLeagueEntrant[];
  nights: PremierLeagueNight[];
  finalsScheduledAt?: string | null;
  championPlayerId: string | null;
  createdAt?: string;
  updatedAt?: string;
  finishedAt?: string | null;
}

export interface PremierLeagueStanding {
  position: number;
  playerId: string;
  playerName: string;
  points: number;
  nightsPlayed: number;
  nightWins: number;
  finalsLost: number;
  semiFinalsReached: number;
  matchesPlayed: number;
  matchesWon: number;
  matchesLost: number;
  legsWon: number;
  legsLost: number;
  legDifference: number;
}

export const PREMIER_LEAGUE_SETTINGS: PremierLeagueSettings = {
  leagueBestOf: 5,
  finalsSemiBestOf: 9,
  finalsFinalBestOf: 11,
  variant: 501,
  outRule: 'DOUBLE',
  alternateStarter: true,
  adminUnlockedNightNumbers: [],
};
