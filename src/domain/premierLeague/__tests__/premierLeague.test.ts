import { describe, expect, it } from 'vitest';
import { buildGameState } from '@/domain/engine';
import { makeLegForfeit } from '@/domain/events';
import type { GameConfig } from '@/domain/types';
import {
  PREMIER_LEAGUE_SETTINGS,
  boardNumbers,
  calculateStandings,
  canStartFixture,
  generateLeagueNights,
  fixturesForBoard,
  isValidBoardNumber,
  recordFixtureResult,
  officialTerminalLegScore,
  correctionBlockReason,
  reopenFixtureResult,
  selectTopFour,
  validateCompetitionPlayers,
  withFinalsNight,
  type PremierLeagueCompetition,
  type PremierLeagueEntrant,
  type PremierLeagueFixture,
  type PremierLeagueRound,
} from '..';

let sequence = 0;
const idFactory = (prefix: string) => `${prefix}-${++sequence}`;

function entrants(): PremierLeagueEntrant[] {
  return Array.from({ length: 8 }, (_, index) => ({
    playerId: `p${index + 1}`,
    name: `Player ${index + 1}`,
    seed: index + 1,
  }));
}

function competition(): PremierLeagueCompetition {
  sequence = 0;
  const players = entrants();
  const id = 'competition-1';
  return {
    id,
    seasonId: 'season-1',
    name: 'Test Premier League',
    status: 'IN_PROGRESS',
    settings: PREMIER_LEAGUE_SETTINGS,
    players,
    nights: generateLeagueNights(id, players, idFactory),
    championPlayerId: null,
  };
}

function fixtureOf(
  value: PremierLeagueCompetition,
  nightId: string,
  round: PremierLeagueRound,
  order: number,
): PremierLeagueFixture {
  return value.nights
    .find((night) => night.id === nightId)!
    .fixtures.find((fixture) => fixture.round === round && fixture.fixtureOrder === order)!;
}

function finish(
  value: PremierLeagueCompetition,
  nightId: string,
  round: PremierLeagueRound,
  order: number,
  chooseWinner: (fixture: PremierLeagueFixture) => string = (fixture) => fixture.playerAId!,
): PremierLeagueCompetition {
  const fixtureToFinish = fixtureOf(value, nightId, round, order);
  const winner = chooseWinner(fixtureToFinish);
  return recordFixtureResult(value, nightId, fixtureToFinish.id, {
    winnerPlayerId: winner,
    legsA: winner === fixtureToFinish.playerAId ? fixtureToFinish.legsToWin : 1,
    legsB: winner === fixtureToFinish.playerBId ? fixtureToFinish.legsToWin : 1,
    finishedAt: new Date(2026, 0, sequence++).toISOString(),
  });
}

function finishNight(
  value: PremierLeagueCompetition,
  nightId: string,
  chooseWinner: (fixture: PremierLeagueFixture) => string = (fixture) => fixture.playerAId!,
): PremierLeagueCompetition {
  let next = value;
  for (let order = 1; order <= 4; order += 1) next = finish(next, nightId, 'QUARTER_FINAL', order, chooseWinner);
  for (let order = 1; order <= 2; order += 1) next = finish(next, nightId, 'SEMI_FINAL', order, chooseWinner);
  return finish(next, nightId, 'FINAL', 1, chooseWinner);
}

function finishLeague(value: PremierLeagueCompetition): PremierLeagueCompetition {
  let next = value;
  const seed = new Map(next.players.map((player) => [player.playerId, player.seed]));
  const chooseBestSeed = (fixture: PremierLeagueFixture) =>
    seed.get(fixture.playerAId!)! < seed.get(fixture.playerBId!)!
      ? fixture.playerAId!
      : fixture.playerBId!;
  for (const night of value.nights) next = finishNight(next, night.id, chooseBestSeed);
  return next;
}

function gameConfig(legsToWin: number): GameConfig {
  return {
    id: 'game',
    createdAt: 1,
    variant: 501,
    outRule: 'DOUBLE',
    mode: 'SINGLE',
    legsToWin,
    participants: [
      { id: 'A', label: 'A', playerIds: ['p1'] },
      { id: 'B', label: 'B', playerIds: ['p2'] },
    ],
    players: [
      { id: 'p1', name: 'A' },
      { id: 'p2', name: 'B' },
    ],
    startingPolicy: 'MANUAL',
    alternateStarter: true,
    firstStarterId: 'A',
  };
}

describe('Premier League brackets and fixed formats', () => {
  it('creates four quarter-finals, two semi-finals and one final per league Night', () => {
    const night = competition().nights[0]!;
    expect(night.fixtures.filter((f) => f.round === 'QUARTER_FINAL')).toHaveLength(4);
    expect(night.fixtures.filter((f) => f.round === 'SEMI_FINAL')).toHaveLength(2);
    expect(night.fixtures.filter((f) => f.round === 'FINAL')).toHaveLength(1);
  });

  it('uses Best of 5 for every match in Nights 1 to 7', () => {
    expect(competition().nights.flatMap((n) => n.fixtures).every((f) => f.bestOf === 5 && f.legsToWin === 3)).toBe(true);
  });

  it('ends a Best of 5 when a player wins three legs', () => {
    const config = gameConfig(3);
    const events = [makeLegForfeit('B'), makeLegForfeit('B'), makeLegForfeit('B')];
    const state = buildGameState(config, events);
    expect(state.status).toBe('GAME_OVER');
    expect(state.legsWon.A).toBe(3);
  });

  it('records an official terminal score when a match is forfeited', () => {
    expect(officialTerminalLegScore(3, 'B', 1, 0)).toEqual({ legsA: 1, legsB: 3 });
    expect(officialTerminalLegScore(5, 'A', 2, 2)).toEqual({ legsA: 5, legsB: 2 });
  });

  it('generates Finals Night semi-finals in Best of 9', () => {
    const nights = withFinalsNight(finishLeague(competition()), idFactory).nights;
    const finals = nights[nights.length - 1]!;
    expect(finals.fixtures.filter((f) => f.round === 'SEMI_FINAL').every((f) => f.bestOf === 9 && f.legsToWin === 5)).toBe(true);
  });

  it('ends a Finals Night semi-final at five legs', () => {
    const state = buildGameState(gameConfig(5), Array.from({ length: 5 }, () => makeLegForfeit('B')));
    expect(state.status).toBe('GAME_OVER');
    expect(state.legsWon.A).toBe(5);
  });

  it('generates the grand final in Best of 11', () => {
    const nights = withFinalsNight(finishLeague(competition()), idFactory).nights;
    const finals = nights[nights.length - 1]!;
    const final = finals.fixtures.find((f) => f.round === 'FINAL')!;
    expect(final.bestOf).toBe(11);
    expect(final.legsToWin).toBe(6);
  });

  it('ends the grand final at six legs', () => {
    const state = buildGameState(gameConfig(6), Array.from({ length: 6 }, () => makeLegForfeit('B')));
    expect(state.status).toBe('GAME_OVER');
    expect(state.legsWon.A).toBe(6);
  });

  it('uses all seven round-robin pairings without a repeated quarter-final', () => {
    const pairs = competition().nights.flatMap((night) =>
      night.fixtures
        .filter((f) => f.round === 'QUARTER_FINAL')
        .map((f) => [f.playerAId, f.playerBId].sort().join(':')),
    );
    expect(pairs).toHaveLength(28);
    expect(new Set(pairs)).toHaveLength(28);
  });
});

describe('Premier League progression', () => {
  it('advances quarter-final winners into the correct semi-finals', () => {
    let value = competition();
    const nightId = value.nights[0]!.id;
    const winners: string[] = [];
    for (let order = 1; order <= 4; order += 1) {
      winners.push(fixtureOf(value, nightId, 'QUARTER_FINAL', order).playerAId!);
      value = finish(value, nightId, 'QUARTER_FINAL', order);
    }
    expect(fixtureOf(value, nightId, 'SEMI_FINAL', 1)).toMatchObject({ playerAId: winners[0], playerBId: winners[1] });
    expect(fixtureOf(value, nightId, 'SEMI_FINAL', 2)).toMatchObject({ playerAId: winners[2], playerBId: winners[3] });
  });

  it('advances semi-final winners into the final', () => {
    let value = competition();
    const nightId = value.nights[0]!.id;
    for (let order = 1; order <= 4; order += 1) value = finish(value, nightId, 'QUARTER_FINAL', order);
    const first = fixtureOf(value, nightId, 'SEMI_FINAL', 1).playerAId!;
    value = finish(value, nightId, 'SEMI_FINAL', 1);
    const second = fixtureOf(value, nightId, 'SEMI_FINAL', 2).playerAId!;
    value = finish(value, nightId, 'SEMI_FINAL', 2);
    expect(fixtureOf(value, nightId, 'FINAL', 1)).toMatchObject({ playerAId: first, playerBId: second, status: 'AVAILABLE' });
  });

  it('never advances an eliminated player', () => {
    let value = competition();
    const nightId = value.nights[0]!.id;
    const quarter = fixtureOf(value, nightId, 'QUARTER_FINAL', 1);
    const loser = quarter.playerBId!;
    value = finish(value, nightId, 'QUARTER_FINAL', 1);
    expect(fixtureOf(value, nightId, 'SEMI_FINAL', 1).playerAId).not.toBe(loser);
  });

  it('does not start a blocked match', () => {
    const value = competition();
    const night = value.nights[0]!;
    const semi = night.fixtures.find((f) => f.round === 'SEMI_FINAL')!;
    expect(canStartFixture(value, night.id, semi.id)).toBe(false);
  });

  it('prevents a future Night before the previous Night is finished', () => {
    const value = competition();
    const nextNight = value.nights[1]!;
    expect(canStartFixture(value, nextNight.id, nextNight.fixtures[0]!.id)).toBe(false);
    expect(canStartFixture(value, nextNight.id, nextNight.fixtures[0]!.id, true)).toBe(true);
  });
});

describe('Premier League points and standings', () => {
  it('awards 5, 3, 2 and 0 points from a completed Night', () => {
    const base = competition();
    const complete = finishNight(base, base.nights[0]!.id);
    const night = complete.nights[0]!;
    const standings = new Map(calculateStandings(complete).map((s) => [s.playerId, s]));
    const final = night.fixtures.find((f) => f.round === 'FINAL')!;
    expect(standings.get(final.winnerPlayerId!)!.points).toBe(5);
    expect(standings.get(final.playerBId!)!.points).toBe(3);
    night.fixtures.filter((f) => f.round === 'SEMI_FINAL').forEach((semi) => expect(standings.get(semi.playerBId!)!.points).toBe(2));
    night.fixtures.filter((f) => f.round === 'QUARTER_FINAL').forEach((quarter) => expect(standings.get(quarter.playerBId!)!.points).toBe(0));
  });

  it('never awards points twice when standings are recalculated repeatedly', () => {
    const base = competition();
    const complete = finishNight(base, base.nights[0]!.id);
    expect(calculateStandings(complete)).toEqual(calculateStandings(complete));
    expect(calculateStandings(complete).reduce((sum, row) => sum + row.points, 0)).toBe(12);
  });

  it('accumulates all seven Nights from recorded results', () => {
    const standings = calculateStandings(finishLeague(competition()));
    expect(standings.every((standing) => standing.nightsPlayed === 7)).toBe(true);
    expect(standings.reduce((sum, standing) => sum + standing.points, 0)).toBe(84);
  });

  it('applies numeric tie-breakers before alphabetical order', () => {
    const base = competition();
    const complete = finishNight(base, base.nights[0]!.id);
    const standings = calculateStandings(complete);
    expect(standings[0]!.points).toBeGreaterThanOrEqual(standings[1]!.points);
    expect(standings.find((s) => s.points === 5)!.position).toBe(1);
  });

  it('selects the same top four as the calculated ranking', () => {
    const value = finishLeague(competition());
    expect(selectTopFour(value).map((p) => p.playerId)).toEqual(calculateStandings(value).slice(0, 4).map((s) => s.playerId));
  });
});

describe('Finals Night', () => {
  it('generates first vs fourth and second vs third', () => {
    const league = finishLeague(competition());
    const top = selectTopFour(league);
    const nights = withFinalsNight(league, idFactory).nights;
    const finals = nights[nights.length - 1]!;
    expect(finals.fixtures[0]).toMatchObject({ playerAId: top[0]!.playerId, playerBId: top[3]!.playerId, playerASeed: 1, playerBSeed: 4 });
    expect(finals.fixtures[1]).toMatchObject({ playerAId: top[1]!.playerId, playerBId: top[2]!.playerId, playerASeed: 2, playerBSeed: 3 });
  });

  it('does not change league points', () => {
    const league = finishLeague(competition());
    const before = calculateStandings(league);
    let value = withFinalsNight(league, idFactory);
    const finalsId = value.nights[value.nights.length - 1]!.id;
    value = finish(value, finalsId, 'SEMI_FINAL', 1);
    value = finish(value, finalsId, 'SEMI_FINAL', 2);
    value = finish(value, finalsId, 'FINAL', 1);
    expect(calculateStandings(value)).toEqual(before);
  });

  it('makes the grand-final winner the competition champion', () => {
    let value = withFinalsNight(finishLeague(competition()), idFactory);
    const finalsId = value.nights[value.nights.length - 1]!.id;
    value = finish(value, finalsId, 'SEMI_FINAL', 1);
    value = finish(value, finalsId, 'SEMI_FINAL', 2);
    const expected = fixtureOf(value, finalsId, 'FINAL', 1).playerAId!;
    value = finish(value, finalsId, 'FINAL', 1);
    expect(value.championPlayerId).toBe(expected);
    expect(value.status).toBe('FINISHED');
  });
});

describe('competition validation', () => {
  it('requires exactly eight distinct players', () => {
    expect(() => validateCompetitionPlayers(['1', '2'])).toThrow();
    expect(() => validateCompetitionPlayers(['1', '2', '3', '4', '5', '6', '7', '7'])).toThrow();
    expect(() => validateCompetitionPlayers(['1', '2', '3', '4', '5', '6', '7', '8'])).not.toThrow();
  });

  it('reopens a final and removes its Night points until the corrected result is finished', () => {
    const base = competition();
    const complete = finishNight(base, base.nights[0]!.id);
    const night = complete.nights[0]!;
    const final = fixtureOf(complete, night.id, 'FINAL', 1);
    const reopened = reopenFixtureResult(complete, night.id, final.id);
    expect(fixtureOf(reopened, night.id, 'FINAL', 1)).toMatchObject({
      status: 'IN_PROGRESS',
      winnerPlayerId: null,
    });
    expect(calculateStandings(reopened).reduce((sum, row) => sum + row.points, 0)).toBe(0);
  });

  it('blocks correction when the dependent next fixture has started', () => {
    let value = competition();
    const nightId = value.nights[0]!.id;
    const firstQuarterId = fixtureOf(value, nightId, 'QUARTER_FINAL', 1).id;
    value = finish(value, nightId, 'QUARTER_FINAL', 1);
    value = finish(value, nightId, 'QUARTER_FINAL', 2);
    value = finish(value, nightId, 'SEMI_FINAL', 1);
    expect(correctionBlockReason(value, nightId, firstQuarterId)).toBe(
      'DEPENDENT_FIXTURE_ALREADY_STARTED',
    );
  });
});

describe('scoring station boards', () => {
  it('accepts only integer board numbers from 1 to 999', () => {
    expect(isValidBoardNumber(1)).toBe(true);
    expect(isValidBoardNumber(999)).toBe(true);
    expect(isValidBoardNumber(0)).toBe(false);
    expect(isValidBoardNumber(2.5)).toBe(false);
    expect(isValidBoardNumber(1000)).toBe(false);
  });

  it('lists assigned board numbers once and in numeric order', () => {
    const value = competition();
    value.nights[0]!.fixtures[0]!.boardNumber = 12;
    value.nights[0]!.fixtures[1]!.boardNumber = 2;
    value.nights[1]!.fixtures[0]!.boardNumber = 12;
    expect(boardNumbers(value)).toEqual([2, 12]);
  });

  it('shows only matches assigned to the selected board and prioritizes the active match', () => {
    const value = competition();
    const first = value.nights[0]!.fixtures[0]!;
    const second = value.nights[0]!.fixtures[1]!;
    const other = value.nights[0]!.fixtures[2]!;
    first.boardNumber = 4;
    second.boardNumber = 4;
    second.status = 'IN_PROGRESS';
    other.boardNumber = 5;
    expect(fixturesForBoard(value, 4).map(({ fixture }) => fixture.id)).toEqual([
      second.id,
      first.id,
    ]);
  });
});
