import type {
  PremierLeagueCompetition,
  PremierLeagueEntrant,
  PremierLeagueFixture,
  PremierLeagueNight,
  PremierLeagueRound,
} from './types';
import { PREMIER_LEAGUE_SETTINGS } from './types';

type IdFactory = (prefix: string) => string;

function fixture(
  nightId: string,
  round: PremierLeagueRound,
  fixtureOrder: number,
  idFactory: IdFactory,
  playerAId: string | null,
  playerBId: string | null,
  bestOf: 5 | 9 | 11,
  seeds?: [number | null, number | null],
): PremierLeagueFixture {
  const legsToWin = bestOf === 5 ? 3 : bestOf === 9 ? 5 : 6;
  return {
    id: idFactory('plf'),
    nightId,
    boardNumber: null,
    round,
    fixtureOrder,
    playerAId,
    playerBId,
    playerASeed: seeds?.[0] ?? null,
    playerBSeed: seeds?.[1] ?? null,
    winnerPlayerId: null,
    matchId: null,
    status: playerAId && playerBId ? 'AVAILABLE' : 'BLOCKED',
    bestOf,
    legsToWin,
    legsA: 0,
    legsB: 0,
  };
}

/**
 * Circle-method schedule. Across seven rounds each pair of eight players meets
 * exactly once in a quarter-final. Input order makes the result deterministic.
 */
export function generateQuarterFinalPairings(playerIds: string[]): string[][][] {
  if (playerIds.length !== 8 || new Set(playerIds).size !== 8) {
    throw new Error('PREMIER_LEAGUE_REQUIRES_EIGHT_UNIQUE_PLAYERS');
  }
  const rotating = [...playerIds];
  const rounds: string[][][] = [];
  for (let round = 0; round < 7; round += 1) {
    const pairs: string[][] = [];
    for (let i = 0; i < 4; i += 1) {
      pairs.push([rotating[i]!, rotating[7 - i]!]);
    }
    rounds.push(pairs);
    rotating.splice(1, 0, rotating.pop()!);
  }
  return rounds;
}

export function generateLeagueNights(
  competitionId: string,
  entrants: PremierLeagueEntrant[],
  idFactory: IdFactory,
  scheduledDates: Array<string | null> = [],
): PremierLeagueNight[] {
  const rounds = generateQuarterFinalPairings(entrants.map((p) => p.playerId));
  return rounds.map((pairs, index) => {
    const nightId = idFactory('pln');
    const fixtures = [
      ...pairs.map(([a, b], order) =>
        fixture(nightId, 'QUARTER_FINAL', order + 1, idFactory, a!, b!, 5),
      ),
      fixture(nightId, 'SEMI_FINAL', 1, idFactory, null, null, 5),
      fixture(nightId, 'SEMI_FINAL', 2, idFactory, null, null, 5),
      fixture(nightId, 'FINAL', 1, idFactory, null, null, 5),
    ];
    return {
      id: nightId,
      competitionId,
      nightNumber: index + 1,
      stage: 'LEAGUE',
      scheduledAt: scheduledDates[index] ?? null,
      status: 'SCHEDULED',
      winnerPlayerId: null,
      fixtures,
    };
  });
}

export function generateFinalsNight(
  competition: PremierLeagueCompetition,
  topFour: PremierLeagueEntrant[],
  idFactory: IdFactory,
  scheduledAt?: string | null,
): PremierLeagueNight {
  if (competition.nights.filter((n) => n.stage === 'LEAGUE' && n.status === 'FINISHED').length !== 7) {
    throw new Error('LEAGUE_PHASE_NOT_FINISHED');
  }
  if (topFour.length !== 4 || new Set(topFour.map((p) => p.playerId)).size !== 4) {
    throw new Error('FINALS_REQUIRES_TOP_FOUR');
  }
  const nightId = idFactory('pln');
  const [first, second, third, fourth] = topFour;
  return {
    id: nightId,
    competitionId: competition.id,
    nightNumber: null,
    stage: 'FINALS',
    scheduledAt: scheduledAt ?? null,
    status: 'SCHEDULED',
    winnerPlayerId: null,
    fixtures: [
      fixture(nightId, 'SEMI_FINAL', 1, idFactory, first!.playerId, fourth!.playerId, 9, [1, 4]),
      fixture(nightId, 'SEMI_FINAL', 2, idFactory, second!.playerId, third!.playerId, 9, [2, 3]),
      fixture(nightId, 'FINAL', 1, idFactory, null, null, 11),
    ],
  };
}

export function getFixture(
  night: PremierLeagueNight,
  round: PremierLeagueRound,
  order: number,
): PremierLeagueFixture | undefined {
  return night.fixtures.find(
    (candidate) => candidate.round === round && candidate.fixtureOrder === order,
  );
}

export function validateQuarterFinalLineup(
  night: PremierLeagueNight,
  competitionPlayerIds: string[],
): boolean {
  const ids = night.fixtures
    .filter((f) => f.round === 'QUARTER_FINAL')
    .flatMap((f) => [f.playerAId, f.playerBId]);
  return (
    ids.length === 8 &&
    ids.every((id): id is string => !!id && competitionPlayerIds.includes(id)) &&
    new Set(ids).size === 8
  );
}

export { PREMIER_LEAGUE_SETTINGS };
