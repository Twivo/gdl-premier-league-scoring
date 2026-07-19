import { getFixture } from './bracket';
import type {
  PremierLeagueCompetition,
  PremierLeagueFixture,
  PremierLeagueNight,
} from './types';

export interface FixtureResult {
  winnerPlayerId: string;
  legsA: number;
  legsB: number;
  finishedAt?: string;
}

/** GAME_FORFEIT ends X01 immediately; expose a valid official bracket score. */
export function officialTerminalLegScore(
  legsToWin: 3 | 5 | 6,
  winnerSide: 'A' | 'B',
  legsA: number,
  legsB: number,
): { legsA: number; legsB: number } {
  if (Math.max(legsA, legsB) >= legsToWin) return { legsA, legsB };
  return winnerSide === 'A'
    ? { legsA: legsToWin, legsB }
    : { legsA, legsB: legsToWin };
}

export function validateFixtureResult(
  fixture: PremierLeagueFixture,
  result: FixtureResult,
): void {
  if (!fixture.playerAId || !fixture.playerBId) throw new Error('FIXTURE_PLAYERS_UNKNOWN');
  if (![fixture.playerAId, fixture.playerBId].includes(result.winnerPlayerId)) {
    throw new Error('WINNER_NOT_IN_FIXTURE');
  }
  const winnerLegs =
    result.winnerPlayerId === fixture.playerAId ? result.legsA : result.legsB;
  const loserLegs =
    result.winnerPlayerId === fixture.playerAId ? result.legsB : result.legsA;
  if (winnerLegs !== fixture.legsToWin || loserLegs >= winnerLegs) {
    throw new Error('INVALID_LEG_SCORE');
  }
}

export function canStartFixture(
  competition: PremierLeagueCompetition,
  nightId: string,
  fixtureId: string,
  adminOverride = false,
): boolean {
  const night = competition.nights.find((n) => n.id === nightId);
  const fixture = night?.fixtures.find((f) => f.id === fixtureId);
  if (!night || !fixture || !fixture.playerAId || !fixture.playerBId) return false;
  if (!['AVAILABLE', 'IN_PROGRESS'].includes(fixture.status)) return false;
  // Once a match has started it must always remain resumable, even if an
  // organizer later removes the early-start override that originally allowed it.
  if (fixture.status === 'IN_PROGRESS') return true;
  if (night.stage === 'FINALS') {
    return adminOverride || competition.nights.filter((n) => n.stage === 'LEAGUE').every((n) => n.status === 'FINISHED');
  }
  const previous = competition.nights.find(
    (n) => n.stage === 'LEAGUE' && n.nightNumber === (night.nightNumber ?? 1) - 1,
  );
  const explicitlyUnlocked =
    night.nightNumber != null &&
    competition.settings.adminUnlockedNightNumbers.includes(night.nightNumber);
  return adminOverride || explicitlyUnlocked || !previous || previous.status === 'FINISHED';
}

function advanceWinner(night: PremierLeagueNight, fixture: PremierLeagueFixture): void {
  const winner = fixture.winnerPlayerId;
  if (!winner) return;
  const target = dependentFixture(night, fixture);
  if (!target) return;
  target[dependentSlot(fixture)] = winner;
  if (target.playerAId && target.playerBId) target.status = 'AVAILABLE';
}

export function recordFixtureResult(
  competition: PremierLeagueCompetition,
  nightId: string,
  fixtureId: string,
  result: FixtureResult,
): PremierLeagueCompetition {
  const next = structuredClone(competition);
  const night = next.nights.find((n) => n.id === nightId);
  const fixture = night?.fixtures.find((f) => f.id === fixtureId);
  if (!night || !fixture) throw new Error('FIXTURE_NOT_FOUND');
  validateFixtureResult(fixture, result);
  const finishedAt = result.finishedAt ?? new Date().toISOString();
  Object.assign(fixture, {
    winnerPlayerId: result.winnerPlayerId,
    legsA: result.legsA,
    legsB: result.legsB,
    status: 'FINISHED' as const,
    finishedAt,
    updatedAt: finishedAt,
  });
  night.status = 'IN_PROGRESS';
  advanceWinner(night, fixture);

  if (fixture.round === 'FINAL') {
    night.status = 'FINISHED';
    night.winnerPlayerId = result.winnerPlayerId;
    night.finishedAt = finishedAt;
    const leagueFinished = next.nights
      .filter((n) => n.stage === 'LEAGUE')
      .every((n) => n.status === 'FINISHED');
    if (night.stage === 'FINALS') {
      next.status = 'FINISHED';
      next.championPlayerId = result.winnerPlayerId;
      next.finishedAt = finishedAt;
    } else if (leagueFinished) {
      next.status = 'FINALS_READY';
    } else {
      next.status = 'IN_PROGRESS';
    }
  }
  return next;
}

function dependentFixture(
  night: PremierLeagueNight,
  fixture: PremierLeagueFixture,
): PremierLeagueFixture | undefined {
  if (fixture.round === 'QUARTER_FINAL') {
    return getFixture(night, 'SEMI_FINAL', fixture.fixtureOrder <= 2 ? 1 : 2);
  }
  if (fixture.round === 'SEMI_FINAL') return getFixture(night, 'FINAL', 1);
  return undefined;
}

/** Which slot of the dependent fixture this fixture's winner feeds into. */
function dependentSlot(fixture: PremierLeagueFixture): 'playerAId' | 'playerBId' {
  const feedsPlayerA =
    fixture.round === 'QUARTER_FINAL'
      ? fixture.fixtureOrder % 2 === 1
      : fixture.fixtureOrder === 1;
  return feedsPlayerA ? 'playerAId' : 'playerBId';
}

export function correctionBlockReason(
  competition: PremierLeagueCompetition,
  nightId: string,
  fixtureId: string,
): string | null {
  const night = competition.nights.find((n) => n.id === nightId);
  const fixture = night?.fixtures.find((f) => f.id === fixtureId);
  if (!night || !fixture || fixture.status !== 'FINISHED') return 'RESULT_NOT_FINISHED';
  const dependent = dependentFixture(night, fixture);
  if (dependent && ['IN_PROGRESS', 'FINISHED'].includes(dependent.status)) {
    return 'DEPENDENT_FIXTURE_ALREADY_STARTED';
  }
  return null;
}

export function reopenFixtureResult(
  competition: PremierLeagueCompetition,
  nightId: string,
  fixtureId: string,
): PremierLeagueCompetition {
  const reason = correctionBlockReason(competition, nightId, fixtureId);
  if (reason) throw new Error(reason);
  const next = structuredClone(competition);
  const night = next.nights.find((n) => n.id === nightId)!;
  const fixture = night.fixtures.find((f) => f.id === fixtureId)!;
  const dependent = dependentFixture(night, fixture);
  if (dependent) {
    dependent[dependentSlot(fixture)] = null;
    dependent.status = dependent.playerAId && dependent.playerBId ? 'AVAILABLE' : 'BLOCKED';
  }
  Object.assign(fixture, {
    winnerPlayerId: null,
    legsA: 0,
    legsB: 0,
    status: 'IN_PROGRESS' as const,
    finishedAt: null,
  });
  night.status = 'IN_PROGRESS';
  night.winnerPlayerId = null;
  night.finishedAt = null;
  next.championPlayerId = null;
  next.finishedAt = null;
  next.status = night.stage === 'FINALS' ? 'FINALS_IN_PROGRESS' : 'IN_PROGRESS';
  return next;
}
