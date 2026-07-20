/** Championship (team encounter) domain types. */

export type FixtureKind = 'SINGLE' | 'DOUBLE';
export type Side = 'A' | 'B';

export interface FixtureFormatSlot {
  kind: FixtureKind;
  count: number;
}

export interface EncounterSettings {
  legsToWin: number;
  startingPolicy: 'BULL' | 'MANUAL';
  alternateStarter: boolean;
  /** Which side throws first in each match (applied to not-yet-started matches). */
  starterSide?: Side;
}

/** One match of the encounter (composed lazily, locked once played). */
export interface Fixture {
  index: number;
  kind: FixtureKind;
  aPlayerIds: string[]; // 1 (single) or 2 (double); empty = not composed
  bPlayerIds: string[];
  /** Bull winner: which side throws first (set on the pre-match screen). */
  starterSide?: Side;
  matchId: string | null; // linked `matches` row once launched
  winner: Side | null; // set when the match is finished -> locked
}

export interface TeamSnapshot {
  id: string;
  name: string;
  players: { id: string; name: string }[];
}

/** The whole plan, stored as jsonb on the encounter (self-contained). */
export interface EncounterPlan {
  format: FixtureFormatSlot[];
  settings: EncounterSettings;
  teams: { A: TeamSnapshot; B: TeamSnapshot };
  fixtures: Fixture[];
  /**
   * Decisive doubles: an extra DOUBLE played only when the regular fixtures
   * end level (e.g. 5-5). Its pair on each side must be one not already used
   * in the earlier doubles. Absent on existing encounters (jsonb — no
   * migration): `undefined` means "not composed yet".
   */
  decider?: Fixture | null;
}

export type EncounterPhase = 'COMPOSE' | 'PLAY' | 'MATCH_DONE' | 'FINAL';

export interface ComposeBlock {
  slotIndex: number;
  kind: FixtureKind;
  start: number;
  end: number;
}

export interface EncounterState {
  phase: EncounterPhase;
  total: number;
  played: number;
  remaining: number;
  scoreA: number;
  scoreB: number;
  currentIndex: number;
  currentFixture: Fixture | null;
  /** The block that needs composing (phase === 'COMPOSE'). */
  composeBlock: ComposeBlock | null;
  /** Set only when phase === 'FINAL'. Always a side — a match can never end level. */
  finalWinner: Side | null;
  /** True while composing/playing the decisive doubles (level score). */
  isDecider: boolean;
}
