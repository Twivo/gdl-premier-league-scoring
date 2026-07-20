/**
 * Championship encounter persistence & orchestration helpers.
 *
 * The database is the single source of truth — nothing is cached locally.
 * Encounter saves happen at discrete transitions (compose / advance), so a
 * failed write is retried a few times before surfacing. Each fixture reuses
 * the normal match engine.
 */
import { getRepository } from '@/data';
import type { EncounterRecord } from '@/data/types';
import { persistMatch } from '@/store/matchService';
import { createId, createUuid } from '@/lib/id';
import {
  ENCOUNTER_FORMAT,
  DEFAULT_ENCOUNTER_SETTINGS,
} from '@/domain/championship/format';
import {
  createFixtures,
  withFixtureComposition,
  withFixtureCompositionMany,
  withFixtureMatchId,
  withFixtureReopened,
  withFixtureWinner,
  deciderIndex,
  deciderPairAllowed,
} from '@/domain/championship/encounter';
import type {
  ComposeBlock,
  EncounterPlan,
  Fixture,
  Side,
  TeamSnapshot,
} from '@/domain/championship/types';
import type { GameConfig } from '@/domain/types';

/** Save to the DB, retrying a few times to ride out a brief network blip. */
export async function persistEncounter(record: EncounterRecord): Promise<void> {
  let lastError: unknown;
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      await getRepository().saveEncounter(record);
      return;
    } catch (err) {
      lastError = err;
      await new Promise((r) => setTimeout(r, 500 * (attempt + 1)));
    }
  }
  throw lastError;
}

export async function loadEncounter(
  id: string,
): Promise<EncounterRecord | null> {
  try {
    return await getRepository().getEncounter(id);
  } catch {
    return null;
  }
}

export async function listResumableEncounters(): Promise<EncounterRecord[]> {
  try {
    return await getRepository().listEncountersInProgress();
  } catch {
    return [];
  }
}

export function createEncounter(
  seasonId: string,
  teamA: TeamSnapshot,
  teamB: TeamSnapshot,
): EncounterRecord {
  return {
    id: createUuid(),
    seasonId,
    teamAId: teamA.id,
    teamBId: teamB.id,
    plan: {
      format: ENCOUNTER_FORMAT,
      settings: DEFAULT_ENCOUNTER_SETTINGS,
      teams: { A: teamA, B: teamB },
      fixtures: createFixtures(ENCOUNTER_FORMAT),
    },
    status: 'IN_PROGRESS',
    currentIndex: 0,
    scoreA: 0,
    scoreB: 0,
    winner: null,
  };
}

/** Build a normal match config for a fixture (participant ids = 'A' / 'B'). */
export function fixtureMatchConfig(
  encounter: EncounterRecord,
  fixture: Fixture,
): GameConfig {
  const { settings, teams } = encounter.plan;
  const all = [...teams.A.players, ...teams.B.players];
  const nameOf = (id: string) => all.find((p) => p.id === id)?.name ?? '???';
  const isDouble = fixture.kind === 'DOUBLE';

  return {
    id: createId('cfg'),
    createdAt: Date.now(),
    variant: 501,
    outRule: 'DOUBLE',
    mode: fixture.kind,
    legsToWin: settings.legsToWin,
    participants: [
      {
        id: 'A',
        label: isDouble ? teams.A.name : nameOf(fixture.aPlayerIds[0] ?? ''),
        playerIds: fixture.aPlayerIds,
      },
      {
        id: 'B',
        label: isDouble ? teams.B.name : nameOf(fixture.bPlayerIds[0] ?? ''),
        playerIds: fixture.bPlayerIds,
      },
    ],
    players: [...fixture.aPlayerIds, ...fixture.bPlayerIds].map((id) => ({
      id,
      name: nameOf(id),
    })),
    startingPolicy: settings.startingPolicy,
    alternateStarter: settings.alternateStarter,
    // Bull winner for this match, else the encounter default.
    firstStarterId: fixture.starterSide ?? settings.starterSide ?? 'A',
  };
}

/** Ensure the fixture has a linked match; create it on first launch. */
export async function launchFixture(
  encounter: EncounterRecord,
  fixture: Fixture,
): Promise<{ encounter: EncounterRecord; matchId: string }> {
  if (fixture.matchId) return { encounter, matchId: fixture.matchId };

  const config = fixtureMatchConfig(encounter, fixture);
  const matchId = createUuid();
  await persistMatch({
    id: matchId,
    seasonId: encounter.seasonId,
    config,
    events: [],
    mode: config.mode,
    variant: config.variant,
    // Created but NOT started: it becomes IN_PROGRESS only when the scoring
    // page is reached (GameProvider's auto-save flips it). Until then it stays
    // out of Resume / Watch Live / active-match checks.
    status: 'SCHEDULED',
    encounterId: encounter.id,
    fixtureIndex: fixture.index,
  });

  const plan = withFixtureMatchId(encounter.plan, fixture.index, matchId);
  const updated = { ...encounter, plan };
  await persistEncounter(updated);
  return { encounter: updated, matchId };
}

/** Record the winner of a fixture (called when its match finishes). */
export async function recordFixtureResult(
  encounter: EncounterRecord,
  fixtureIndex: number,
  winner: Side,
): Promise<EncounterRecord> {
  const plan = withFixtureWinner(encounter.plan, fixtureIndex, winner);
  const regularA = plan.fixtures.filter((f) => f.winner === 'A').length;
  const regularB = plan.fixtures.filter((f) => f.winner === 'B').length;
  const allRegularPlayed =
    plan.fixtures.filter((f) => f.winner !== null).length >= plan.fixtures.length;
  const tied = allRegularPlayed && regularA === regularB;
  const deciderResolved = plan.decider?.winner != null;

  // A level score (e.g. 5-5) is only final once the decisive doubles is played:
  // that double is always won or lost, so the encounter can never end level.
  const finished = (allRegularPlayed && !tied) || (tied && deciderResolved);

  let winnerSide: Side | null = null;
  if (finished) {
    winnerSide = tied
      ? (plan.decider?.winner ?? null) // the decisive doubles settles the tie
      : regularA > regularB
        ? 'A'
        : 'B';
  }

  const { scoreA, scoreB } = scoresFor(plan);
  const updated: EncounterRecord = {
    ...encounter,
    plan,
    scoreA,
    scoreB,
    status: finished ? 'FINISHED' : 'IN_PROGRESS',
    winner: winnerSide,
    finishedAt: finished ? new Date().toISOString() : null,
  };
  await persistEncounter(updated);
  return updated;
}

/**
 * Reopen a just-finished fixture to correct a mis-entry: clears its result and
 * marks the encounter in progress again. The caller also rewinds the match
 * itself (removes the winning visit) so it can be finished correctly.
 */
export async function reopenFixture(
  encounter: EncounterRecord,
  fixtureIndex: number,
): Promise<EncounterRecord> {
  const plan = withFixtureReopened(encounter.plan, fixtureIndex);
  const { scoreA, scoreB } = scoresFor(plan);
  const updated: EncounterRecord = {
    ...encounter,
    plan,
    scoreA,
    scoreB,
    status: 'IN_PROGRESS',
    winner: null,
    finishedAt: null,
  };
  await persistEncounter(updated);
  return updated;
}

/** Move on to the next fixture (the "Next match" action). */
export async function advanceEncounter(
  encounter: EncounterRecord,
): Promise<EncounterRecord> {
  const updated = { ...encounter, currentIndex: encounter.currentIndex + 1 };
  await persistEncounter(updated);
  return updated;
}

/** Step back to the previous fixture (the bull-up "Back" action). */
export async function unadvanceEncounter(
  encounter: EncounterRecord,
): Promise<EncounterRecord> {
  const updated = {
    ...encounter,
    currentIndex: Math.max(0, encounter.currentIndex - 1),
  };
  await persistEncounter(updated);
  return updated;
}

/** Compose a block's fixtures (assign players), then persist. */
export async function composeBlock(
  encounter: EncounterRecord,
  block: ComposeBlock,
  compositions: { index: number; a: string[]; b: string[] }[],
): Promise<EncounterRecord> {
  void block;
  const plan = withFixtureCompositionMany(encounter.plan, compositions);
  const updated = { ...encounter, plan };
  await persistEncounter(updated);
  return updated;
}

/** Sum fixture wins per side, including the decisive doubles once it is won. */
function scoresFor(plan: EncounterPlan): { scoreA: number; scoreB: number } {
  const won = (side: Side) =>
    plan.fixtures.filter((f) => f.winner === side).length +
    (plan.decider?.winner === side ? 1 : 0);
  return { scoreA: won('A'), scoreB: won('B') };
}

/**
 * Compose the decisive doubles (played only at a level score). Each side's pair
 * must be two distinct players not already paired in this encounter's doubles.
 */
export async function composeDecider(
  encounter: EncounterRecord,
  aPair: string[],
  bPair: string[],
): Promise<EncounterRecord> {
  if (
    !deciderPairAllowed(encounter.plan, 'A', aPair) ||
    !deciderPairAllowed(encounter.plan, 'B', bPair)
  ) {
    throw new Error(
      'Chaque paire du double décisif doit être deux joueurs distincts non déjà associés dans cette rencontre.',
    );
  }
  const plan = withFixtureComposition(
    encounter.plan,
    deciderIndex(encounter.plan),
    aPair,
    bPair,
  );
  const updated = { ...encounter, plan };
  await persistEncounter(updated);
  return updated;
}
