import type {
  PremierLeagueCompetition,
  PremierLeagueFixture,
  PremierLeagueNight,
} from './types';

export const MIN_TARGET_NUMBER = 1;
export const MAX_TARGET_NUMBER = 999;

export interface TargetFixture {
  night: PremierLeagueNight;
  fixture: PremierLeagueFixture;
}

export function isValidTargetNumber(value: number): boolean {
  return (
    Number.isInteger(value) &&
    value >= MIN_TARGET_NUMBER &&
    value <= MAX_TARGET_NUMBER
  );
}

export function targetNumbers(
  competition: PremierLeagueCompetition,
): number[] {
  return [
    ...new Set(
      competition.nights
        .flatMap((night) => night.fixtures)
        .map((fixture) => fixture.targetNumber)
        .filter(
          (value): value is number =>
            value != null && isValidTargetNumber(value),
        ),
    ),
  ].sort((a, b) => a - b);
}

const STATUS_PRIORITY: Record<PremierLeagueFixture['status'], number> = {
  IN_PROGRESS: 0,
  AVAILABLE: 1,
  BLOCKED: 2,
  FINISHED: 3,
};

/**
 * Fixtures shown by one scoring station. The tournament manager remains the
 * source of truth for target assignment; this function only filters and
 * orders that data for the scorer.
 */
export function fixturesForTarget(
  competition: PremierLeagueCompetition,
  targetNumber: number,
): TargetFixture[] {
  if (!isValidTargetNumber(targetNumber)) return [];
  return competition.nights
    .flatMap((night) =>
      night.fixtures.map((fixture) => ({ night, fixture })),
    )
    .filter(({ fixture }) => fixture.targetNumber === targetNumber)
    .sort((a, b) => {
      const status =
        STATUS_PRIORITY[a.fixture.status] - STATUS_PRIORITY[b.fixture.status];
      if (status) return status;
      const stage =
        (a.night.stage === 'LEAGUE' ? 0 : 1) -
        (b.night.stage === 'LEAGUE' ? 0 : 1);
      if (stage) return stage;
      const night =
        (a.night.nightNumber ?? Number.MAX_SAFE_INTEGER) -
        (b.night.nightNumber ?? Number.MAX_SAFE_INTEGER);
      if (night) return night;
      const rounds = { QUARTER_FINAL: 0, SEMI_FINAL: 1, FINAL: 2 };
      return (
        rounds[a.fixture.round] - rounds[b.fixture.round] ||
        a.fixture.fixtureOrder - b.fixture.fixtureOrder
      );
    });
}
