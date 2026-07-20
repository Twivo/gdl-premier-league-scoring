import { describe, it, expect } from 'vitest';
import {
  buildEncounterState,
  computeBlocks,
  createFixtures,
  deciderIndex,
  deciderPairAllowed,
  totalFixtures,
  withFixtureComposition,
  withFixtureWinner,
} from '../encounter';
import { DEFAULT_ENCOUNTER_SETTINGS, ENCOUNTER_FORMAT } from '../format';
import type { EncounterPlan, TeamSnapshot } from '../types';

function basePlan(): EncounterPlan {
  return {
    format: ENCOUNTER_FORMAT,
    settings: DEFAULT_ENCOUNTER_SETTINGS,
    teams: {
      A: { id: 'ta', name: 'Team A', players: [] },
      B: { id: 'tb', name: 'Team B', players: [] },
    },
    fixtures: createFixtures(ENCOUNTER_FORMAT),
  };
}

/** Compose every fixture of a block with placeholder players. */
function composeBlock(plan: EncounterPlan, start: number, end: number): EncounterPlan {
  let p = plan;
  for (let i = start; i < end; i++) {
    const kind = p.fixtures[i]!.kind;
    const a = kind === 'DOUBLE' ? ['a1', 'a2'] : ['a1'];
    const b = kind === 'DOUBLE' ? ['b1', 'b2'] : ['b1'];
    p = withFixtureComposition(p, i, a, b);
  }
  return p;
}

describe('encounter format', () => {
  it('is 10 matches: 4 singles, 2 doubles, 4 singles', () => {
    expect(totalFixtures(ENCOUNTER_FORMAT)).toBe(10);
    const blocks = computeBlocks(ENCOUNTER_FORMAT);
    expect(blocks).toHaveLength(3);
    expect(blocks[0]).toMatchObject({ kind: 'SINGLE', start: 0, end: 4 });
    expect(blocks[1]).toMatchObject({ kind: 'DOUBLE', start: 4, end: 6 });
    expect(blocks[2]).toMatchObject({ kind: 'SINGLE', start: 6, end: 10 });
  });
});

describe('encounter state machine', () => {
  it('asks to compose the first singles block before playing', () => {
    const s = buildEncounterState(basePlan(), 0);
    expect(s.phase).toBe('COMPOSE');
    expect(s.composeBlock).toMatchObject({ start: 0, end: 4 });
  });

  it('plays once the current block is composed', () => {
    const plan = composeBlock(basePlan(), 0, 4);
    const s = buildEncounterState(plan, 0);
    expect(s.phase).toBe('PLAY');
    expect(s.currentFixture?.index).toBe(0);
  });

  it('shows MATCH_DONE after a fixture has a winner', () => {
    let plan = composeBlock(basePlan(), 0, 4);
    plan = withFixtureWinner(plan, 0, 'A');
    const s = buildEncounterState(plan, 0);
    expect(s.phase).toBe('MATCH_DONE');
    expect(s.scoreA).toBe(1);
    expect(s.remaining).toBe(9);
  });

  it('requires composing the doubles block when reaching index 4', () => {
    let plan = composeBlock(basePlan(), 0, 4);
    for (let i = 0; i < 4; i++) plan = withFixtureWinner(plan, i, 'A');
    const s = buildEncounterState(plan, 4);
    expect(s.phase).toBe('COMPOSE');
    expect(s.composeBlock).toMatchObject({ kind: 'DOUBLE', start: 4, end: 6 });
  });

  it('reaches FINAL with the right winner after 10 matches', () => {
    let plan = composeBlock(basePlan(), 0, 4);
    plan = composeBlock(plan, 4, 6);
    plan = composeBlock(plan, 6, 10);
    // A wins 6, B wins 4
    for (let i = 0; i < 10; i++) plan = withFixtureWinner(plan, i, i < 6 ? 'A' : 'B');
    const s = buildEncounterState(plan, 10);
    expect(s.phase).toBe('FINAL');
    expect(s.scoreA).toBe(6);
    expect(s.scoreB).toBe(4);
    expect(s.finalWinner).toBe('A');
  });
});

function team(id: string, ids: string[]): TeamSnapshot {
  return { id, name: id, players: ids.map((p) => ({ id: p, name: p })) };
}

/** A plan taken to 5-5 over the 10 regular fixtures, with rosters of `size`. */
function tiedPlan(size = 4): EncounterPlan {
  const a = Array.from({ length: size }, (_, i) => `a${i + 1}`);
  const b = Array.from({ length: size }, (_, i) => `b${i + 1}`);
  let plan: EncounterPlan = {
    ...basePlan(),
    teams: { A: team('A', a), B: team('B', b) },
  };
  plan = composeBlock(plan, 0, 4);
  plan = composeBlock(plan, 4, 6); // both doubles use a1|a2 and b1|b2
  plan = composeBlock(plan, 6, 10);
  for (let i = 0; i < 10; i++) plan = withFixtureWinner(plan, i, i % 2 === 0 ? 'A' : 'B');
  return plan;
}

describe('decisive doubles (decider)', () => {
  it('asks to compose a decider when level after 10 matches', () => {
    const s = buildEncounterState(tiedPlan(), 10);
    expect(s.phase).toBe('COMPOSE');
    expect(s.isDecider).toBe(true);
    expect(s.scoreA).toBe(5);
    expect(s.scoreB).toBe(5);
  });

  it('blocks already-used pairs and same-player pairs, allows fresh ones', () => {
    const plan = tiedPlan();
    expect(deciderPairAllowed(plan, 'A', ['a1', 'a2'])).toBe(false); // used in doubles
    expect(deciderPairAllowed(plan, 'A', ['a1', 'a1'])).toBe(false); // same player
    expect(deciderPairAllowed(plan, 'A', ['a3', 'a4'])).toBe(true);
    expect(deciderPairAllowed(plan, 'A', ['a2', 'a1'])).toBe(false); // order-independent
    expect(deciderPairAllowed(plan, 'B', ['b2', 'b3'])).toBe(true);
  });

  it('plays the decider then finalises 6-5 for its winner', () => {
    let plan = tiedPlan();
    const di = deciderIndex(plan);
    expect(di).toBe(10);
    plan = withFixtureComposition(plan, di, ['a3', 'a4'], ['b3', 'b4']);
    let s = buildEncounterState(plan, 10);
    expect(s.phase).toBe('PLAY');
    expect(s.isDecider).toBe(true);
    expect(s.currentFixture?.index).toBe(di);

    plan = withFixtureWinner(plan, di, 'A');
    s = buildEncounterState(plan, 10);
    expect(s.phase).toBe('FINAL');
    expect(s.isDecider).toBe(false);
    expect(s.finalWinner).toBe('A');
    expect(s.scoreA).toBe(6);
    expect(s.scoreB).toBe(5);
  });

  it('still forces a decider (never a draw) when no fresh pair remains', () => {
    let plan = tiedPlan(2); // 2 players/side → the only pair is already used
    // The decider is still required — the score can never stand level.
    const s = buildEncounterState(plan, 10);
    expect(s.phase).toBe('COMPOSE');
    expect(s.isDecider).toBe(true);
    // With no fresh pair left, the exhausted side may reuse its only pair.
    expect(deciderPairAllowed(plan, 'A', ['a1', 'a2'])).toBe(true);
    expect(deciderPairAllowed(plan, 'B', ['b1', 'b2'])).toBe(true);
    // Played to completion, it produces a winner — not a draw.
    const di = deciderIndex(plan);
    plan = withFixtureComposition(plan, di, ['a1', 'a2'], ['b1', 'b2']);
    plan = withFixtureWinner(plan, di, 'A');
    const f = buildEncounterState(plan, 10);
    expect(f.phase).toBe('FINAL');
    expect(f.finalWinner).toBe('A');
    expect(f.scoreA).toBe(6);
    expect(f.scoreB).toBe(5);
  });

  it('does not trigger a decider when the score is not level', () => {
    let plan = tiedPlan();
    plan = withFixtureWinner(plan, 1, 'A'); // flip one B win → 6-4
    const s = buildEncounterState(plan, 10);
    expect(s.phase).toBe('FINAL');
    expect(s.isDecider).toBe(false);
    expect(s.finalWinner).toBe('A');
  });
});
