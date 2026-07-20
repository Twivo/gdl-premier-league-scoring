/**
 * Championship encounter state machine — pure and testable.
 *
 * The encounter drives a fixed sequence of fixtures (composition blocks derived
 * from the format). Each played fixture reuses the normal match engine; here we
 * only orchestrate composition → play → per-match stats → next → final.
 */
import type {
  ComposeBlock,
  EncounterPlan,
  EncounterState,
  Fixture,
  FixtureFormatSlot,
  Side,
} from './types';

export function totalFixtures(format: FixtureFormatSlot[]): number {
  return format.reduce((s, f) => s + f.count, 0);
}

/** Composition blocks (one per format slot): [singles 0-3][doubles 4-5][singles 6-9]. */
export function computeBlocks(format: FixtureFormatSlot[]): ComposeBlock[] {
  const blocks: ComposeBlock[] = [];
  let start = 0;
  format.forEach((slot, slotIndex) => {
    blocks.push({ slotIndex, kind: slot.kind, start, end: start + slot.count });
    start += slot.count;
  });
  return blocks;
}

/** Empty fixtures for a format (compositions filled in later, block by block). */
export function createFixtures(format: FixtureFormatSlot[]): Fixture[] {
  const fixtures: Fixture[] = [];
  let index = 0;
  for (const slot of format) {
    for (let k = 0; k < slot.count; k++) {
      fixtures.push({
        index: index++,
        kind: slot.kind,
        aPlayerIds: [],
        bPlayerIds: [],
        matchId: null,
        winner: null,
      });
    }
  }
  return fixtures;
}

function blockAt(blocks: ComposeBlock[], index: number): ComposeBlock | null {
  return blocks.find((b) => index >= b.start && index < b.end) ?? null;
}

export function isBlockComposed(plan: EncounterPlan, block: ComposeBlock): boolean {
  // Filter by fixture identity (index), not array position: the play order can
  // be freely reordered, so fixtures of a block may sit anywhere in the array.
  return plan.fixtures
    .filter((f) => f.index >= block.start && f.index < block.end)
    .every((f) => f.aPlayerIds.length > 0 && f.bPlayerIds.length > 0);
}

export function buildEncounterState(
  plan: EncounterPlan,
  currentIndex: number,
): EncounterState {
  const blocks = computeBlocks(plan.format);
  const total = plan.fixtures.length;
  const played = plan.fixtures.filter((f) => f.winner !== null).length;
  const regularA = plan.fixtures.filter((f) => f.winner === 'A').length;
  const regularB = plan.fixtures.filter((f) => f.winner === 'B').length;
  const decider = plan.decider ?? null;
  // Displayed score includes the decisive doubles once it is won (e.g. 6-5).
  const scoreA = regularA + (decider?.winner === 'A' ? 1 : 0);
  const scoreB = regularB + (decider?.winner === 'B' ? 1 : 0);
  const base = {
    total,
    played,
    remaining: total - played,
    scoreA,
    scoreB,
    currentIndex,
  };

  if (currentIndex >= total) {
    // A clear regular-fixtures leader wins outright.
    if (regularA !== regularB) {
      return {
        ...base,
        phase: 'FINAL',
        currentFixture: null,
        composeBlock: null,
        finalWinner: regularA > regularB ? 'A' : 'B',
        isDecider: false,
      };
    }

    // Level after the regular fixtures (e.g. 5-5) → the decisive doubles
    // settles it. A match can never end level: it is won or lost on that
    // double, so the decider is always played to completion.
    const dec = decider ?? createDeciderFixture(total);
    if (dec.winner !== null) {
      return {
        ...base,
        phase: 'FINAL',
        currentFixture: null,
        composeBlock: null,
        finalWinner: dec.winner,
        isDecider: false,
      };
    }

    const composed = dec.aPlayerIds.length > 0 && dec.bPlayerIds.length > 0;
    return {
      ...base,
      phase: composed ? 'PLAY' : 'COMPOSE',
      currentFixture: dec,
      composeBlock: null,
      finalWinner: null,
      isDecider: true,
    };
  }

  // Play in ARRAY order (the reorderable sequence); each fixture keeps its
  // identity `index`, which is what maps to its composition block and match.
  const fixture = plan.fixtures[currentIndex]!;
  const block = blockAt(blocks, fixture.index)!;
  let phase: EncounterState['phase'];
  let composeBlock: ComposeBlock | null = null;

  if (fixture.winner !== null) {
    phase = 'MATCH_DONE';
  } else if (!isBlockComposed(plan, block)) {
    phase = 'COMPOSE';
    composeBlock = block;
  } else {
    phase = 'PLAY';
  }

  return {
    ...base,
    phase,
    currentFixture: fixture,
    composeBlock,
    finalWinner: null,
    isDecider: false,
  };
}

/** Immutably set a fixture's winner (called when its match finishes). */
export function withFixtureWinner(
  plan: EncounterPlan,
  index: number,
  winner: Side,
): EncounterPlan {
  return patchFixtureOrDecider(plan, index, { winner });
}

/** Immutably compose a fixture (assign players + a match id). */
export function withFixtureComposition(
  plan: EncounterPlan,
  index: number,
  aPlayerIds: string[],
  bPlayerIds: string[],
): EncounterPlan {
  return patchFixtureOrDecider(plan, index, { aPlayerIds, bPlayerIds });
}

/** Immutably link a fixture (or the decider) to its match row. */
export function withFixtureMatchId(
  plan: EncounterPlan,
  index: number,
  matchId: string,
): EncounterPlan {
  return patchFixtureOrDecider(plan, index, { matchId });
}

/** Immutably set a fixture's (or the decider's) lineup + bull winner before launch. */
export function withFixtureLineup(
  plan: EncounterPlan,
  index: number,
  aPlayerIds: string[],
  bPlayerIds: string[],
  starterSide: Side,
): EncounterPlan {
  return patchFixtureOrDecider(plan, index, { aPlayerIds, bPlayerIds, starterSide });
}

/** Immutably clear a fixture's (or the decider's) result to correct a mis-entry. */
export function withFixtureReopened(
  plan: EncounterPlan,
  index: number,
): EncounterPlan {
  return patchFixtureOrDecider(plan, index, { winner: null });
}

/** Compose several fixtures at once (a whole block). */
export function withFixtureCompositionMany(
  plan: EncounterPlan,
  compositions: { index: number; a: string[]; b: string[] }[],
): EncounterPlan {
  const byIndex = new Map(compositions.map((c) => [c.index, c]));
  return {
    ...plan,
    fixtures: plan.fixtures.map((f) => {
      const c = byIndex.get(f.index);
      return c ? { ...f, aPlayerIds: c.a, bPlayerIds: c.b } : f;
    }),
  };
}

// ---------------------------------------------------------------------------
// Decisive doubles ("double décisif") — an extra DOUBLE played only when the
// regular fixtures end level (e.g. 5-5). Its identity index sits just past the
// regular fixtures, so it never collides with a real fixture index.
// ---------------------------------------------------------------------------

/** The decider slot index (one past the last regular fixture). */
export function deciderIndex(plan: EncounterPlan): number {
  return plan.fixtures.length;
}

/** Is `index` the decider slot? */
export function isDeciderIndex(plan: EncounterPlan, index: number): boolean {
  return index === plan.fixtures.length;
}

/** A blank decider fixture (DOUBLE, composed later, bull like any match). */
export function createDeciderFixture(index: number): Fixture {
  return {
    index,
    kind: 'DOUBLE',
    aPlayerIds: [],
    bPlayerIds: [],
    matchId: null,
    winner: null,
  };
}

/** Look up a fixture by identity, including the decider. */
export function getFixtureOrDecider(
  plan: EncounterPlan,
  index: number,
): Fixture | undefined {
  if (isDeciderIndex(plan, index)) return plan.decider ?? undefined;
  return plan.fixtures.find((f) => f.index === index);
}

/** Immutably patch a regular fixture or the decider by identity index. */
function patchFixtureOrDecider(
  plan: EncounterPlan,
  index: number,
  patch: Partial<Fixture>,
): EncounterPlan {
  if (isDeciderIndex(plan, index)) {
    const base = plan.decider ?? createDeciderFixture(index);
    return { ...plan, decider: { ...base, ...patch } };
  }
  return {
    ...plan,
    fixtures: plan.fixtures.map((f) => (f.index === index ? { ...f, ...patch } : f)),
  };
}

/** Order-independent key for a pair of player ids. */
export function pairKey(ids: string[]): string {
  return [...ids].sort().join('|');
}

/** Pairs already used in this encounter's doubles, for one side. */
export function usedDoublesPairs(plan: EncounterPlan, side: Side): Set<string> {
  const keys = new Set<string>();
  for (const f of plan.fixtures) {
    if (f.kind !== 'DOUBLE') continue;
    const ids = side === 'A' ? f.aPlayerIds : f.bPlayerIds;
    if (ids.length === 2) keys.add(pairKey(ids));
  }
  return keys;
}

/** Does this side still have at least one pair it has not already used? */
function sideHasUnusedPair(plan: EncounterPlan, side: Side): boolean {
  const players = plan.teams[side].players;
  const used = usedDoublesPairs(plan, side);
  for (let i = 0; i < players.length; i++) {
    for (let j = i + 1; j < players.length; j++) {
      if (!used.has(pairKey([players[i]!.id, players[j]!.id]))) return true;
    }
  }
  return false;
}

/**
 * Is this decider pair valid? Two distinct players are always required, and a
 * fresh pair (not already used in this encounter's doubles) is preferred. While
 * a side still has an unused pair we require one; only once a side has run out of
 * fresh pairs may it reuse one — the decisive doubles must always be playable so
 * the encounter can never end level.
 */
export function deciderPairAllowed(
  plan: EncounterPlan,
  side: Side,
  ids: string[],
): boolean {
  if (ids.length !== 2 || ids[0] === ids[1]) return false;
  if (sideHasUnusedPair(plan, side)) {
    return !usedDoublesPairs(plan, side).has(pairKey(ids));
  }
  return true;
}
