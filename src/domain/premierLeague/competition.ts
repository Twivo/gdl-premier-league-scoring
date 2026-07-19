import { generateFinalsNight, validateQuarterFinalLineup } from './bracket';
import { selectTopFour } from './standings';
import type { PremierLeagueCompetition } from './types';

type IdFactory = (prefix: string) => string;

export function validateCompetitionPlayers(playerIds: string[]): void {
  if (playerIds.length !== 8 || new Set(playerIds).size !== 8) {
    throw new Error('PREMIER_LEAGUE_REQUIRES_EIGHT_UNIQUE_PLAYERS');
  }
}

export function withFinalsNight(
  competition: PremierLeagueCompetition,
  idFactory: IdFactory,
  scheduledAt?: string | null,
): PremierLeagueCompetition {
  if (competition.nights.some((night) => night.stage === 'FINALS')) return competition;
  const finals = generateFinalsNight(
    competition,
    selectTopFour(competition),
    idFactory,
    scheduledAt,
  );
  return {
    ...competition,
    status: 'FINALS_READY',
    nights: [...competition.nights, finals],
  };
}

export function replaceQuarterFinals(
  competition: PremierLeagueCompetition,
  nightId: string,
  pairings: Array<[string, string]>,
  force = false,
): PremierLeagueCompetition {
  const next = structuredClone(competition);
  const night = next.nights.find((candidate) => candidate.id === nightId);
  if (!night || night.stage !== 'LEAGUE') throw new Error('LEAGUE_NIGHT_NOT_FOUND');
  if (pairings.length !== 4) throw new Error('FOUR_QUARTER_FINALS_REQUIRED');
  const ids = pairings.flat();
  validateCompetitionPlayers(ids);
  if (ids.some((id) => !next.players.some((player) => player.playerId === id))) {
    throw new Error('PLAYER_NOT_IN_COMPETITION');
  }
  const started = night.fixtures.some((fixture) => fixture.status === 'IN_PROGRESS' || fixture.status === 'FINISHED');
  if (started && !force) throw new Error('BRACKET_LOCKED');

  const quarters = night.fixtures
    .filter((fixture) => fixture.round === 'QUARTER_FINAL')
    .sort((a, b) => a.fixtureOrder - b.fixtureOrder);
  quarters.forEach((fixture, index) => {
    const [a, b] = pairings[index]!;
    const changed = fixture.playerAId !== a || fixture.playerBId !== b;
    if (changed && ['IN_PROGRESS', 'FINISHED'].includes(fixture.status)) {
      throw new Error('STARTED_FIXTURE_CANNOT_BE_CHANGED');
    }
    fixture.playerAId = a;
    fixture.playerBId = b;
  });
  if (!validateQuarterFinalLineup(night, ids)) throw new Error('INVALID_QUARTER_FINAL_LINEUP');
  return next;
}
