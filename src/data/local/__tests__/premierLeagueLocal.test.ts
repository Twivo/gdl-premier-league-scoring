import { beforeEach, describe, expect, it } from 'vitest';
import { LocalRepository, PREMIER_LEAGUE_KEY } from '../LocalRepository';
import {
  PREMIER_LEAGUE_SETTINGS,
  generateLeagueNights,
  type PremierLeagueCompetition,
} from '@/domain/premierLeague';
import type { MatchRecord } from '@/data/types';

class MemoryStorage implements Storage {
  private values = new Map<string, string>();
  get length() { return this.values.size; }
  clear() { this.values.clear(); }
  getItem(key: string) { return this.values.get(key) ?? null; }
  key(index: number) { return [...this.values.keys()][index] ?? null; }
  removeItem(key: string) { this.values.delete(key); }
  setItem(key: string, value: string) { this.values.set(key, value); }
}

let id = 0;
const nextId = (prefix: string) => `${prefix}-${++id}`;

function localCompetition(): PremierLeagueCompetition {
  const players = Array.from({ length: 8 }, (_, index) => ({
    playerId: `player-${index + 1}`,
    name: `Player ${index + 1}`,
    seed: index + 1,
  }));
  return {
    id: 'pl-competition',
    seasonId: 'local-2026-2027',
    name: 'Local Premier League',
    status: 'IN_PROGRESS',
    settings: PREMIER_LEAGUE_SETTINGS,
    players,
    nights: generateLeagueNights('pl-competition', players, nextId),
    finalsScheduledAt: null,
    championPlayerId: null,
  };
}

function match(idValue: string, links: Partial<MatchRecord> = {}): MatchRecord {
  return {
    id: idValue,
    seasonId: 'local-2026-2027',
    config: {
      id: `config-${idValue}`,
      createdAt: 1,
      variant: 501,
      outRule: 'DOUBLE',
      mode: 'SINGLE',
      legsToWin: 3,
      participants: [
        { id: 'A', label: 'A', playerIds: ['player-1'] },
        { id: 'B', label: 'B', playerIds: ['player-2'] },
      ],
      players: [
        { id: 'player-1', name: 'A' },
        { id: 'player-2', name: 'B' },
      ],
      startingPolicy: 'MANUAL',
      alternateStarter: true,
      firstStarterId: 'A',
    },
    events: [],
    mode: 'SINGLE',
    variant: 501,
    status: 'IN_PROGRESS',
    ...links,
  };
}

beforeEach(() => {
  Object.defineProperty(globalThis, 'localStorage', {
    value: new MemoryStorage(),
    configurable: true,
  });
  id = 0;
});

describe('local Premier League persistence', () => {
  it('keeps the full competition and linked match after a repository reload', async () => {
    const first = new LocalRepository();
    const competition = localCompetition();
    const fixture = competition.nights[0]!.fixtures[0]!;
    await first.savePremierLeagueCompetition(competition);
    await first.saveMatch(match('pl-match', {
      premierLeagueCompetitionId: competition.id,
      premierLeagueNightId: competition.nights[0]!.id,
      premierLeagueFixtureId: fixture.id,
    }));

    const reloaded = new LocalRepository();
    expect(await reloaded.getPremierLeagueCompetition(competition.id)).toEqual(
      expect.objectContaining({ name: competition.name, nights: expect.any(Array) }),
    );
    expect((await reloaded.getMatch('pl-match'))?.premierLeagueFixtureId).toBe(fixture.id);
  });

  it('keeps Premier League, training and team championship match lists separate', async () => {
    const repository = new LocalRepository();
    await repository.saveMatch(match('training'));
    await repository.saveMatch(match('championship', { encounterId: 'encounter-1' }));
    await repository.saveMatch(match('premier', {
      premierLeagueCompetitionId: 'competition-1',
      premierLeagueNightId: 'night-1',
      premierLeagueFixtureId: 'fixture-1',
    }));

    expect((await repository.listMatches()).map((row) => row.id)).toEqual(['training']);
    expect((await repository.listMatches({ championship: true })).map((row) => row.id)).toEqual(['championship']);
    expect((await repository.listMatches({ premierLeague: true })).map((row) => row.id)).toEqual(['premier']);
    expect((await repository.listInProgress()).map((row) => row.id)).toEqual(['training']);
  });

  it('keeps legacy local competitions visible and migrates their board assignments', async () => {
    const competition = localCompetition();
    competition.nights.forEach((night) =>
      night.fixtures.forEach((fixture) => {
        const legacyFixture = fixture as typeof fixture & {
          targetNumber?: number | null;
        };
        legacyFixture.targetNumber = fixture.fixtureOrder + 10;
        delete legacyFixture.boardNumber;
      }),
    );
    localStorage.setItem(PREMIER_LEAGUE_KEY, JSON.stringify([competition]));

    const reloaded = await new LocalRepository().getPremierLeagueCompetition(
      competition.id,
    );
    expect(reloaded?.nights[0]?.fixtures[0]?.boardNumber).toBe(11);
    expect(reloaded?.nights[0]?.fixtures[3]?.boardNumber).toBe(14);
  });

  it('keeps a current unassigned board as null', async () => {
    const competition = localCompetition();
    localStorage.setItem(PREMIER_LEAGUE_KEY, JSON.stringify([competition]));

    const reloaded = await new LocalRepository().getPremierLeagueCompetition(
      competition.id,
    );
    expect(reloaded?.nights[0]?.fixtures[0]?.boardNumber).toBeNull();
  });
});
