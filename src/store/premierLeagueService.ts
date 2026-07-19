import { getRepository } from '@/data';
import { buildGameState } from '@/domain/engine';
import {
  PREMIER_LEAGUE_SETTINGS,
  canStartFixture,
  correctionBlockReason,
  generateLeagueNights,
  recordFixtureResult,
  reopenFixtureResult,
  replaceQuarterFinals,
  validateCompetitionPlayers,
  withFinalsNight,
  type PremierLeagueCompetition,
  type PremierLeagueFixture,
} from '@/domain/premierLeague';
import { createUuid } from '@/lib/id';
import type { MatchRecord } from '@/data/types';
import { persistMatch } from './matchService';

export interface CreatePremierLeagueInput {
  name: string;
  seasonId: string;
  playerIds: string[];
  nightDates?: Array<string | null>;
  finalsDate?: string | null;
}

const uuidFactory = () => createUuid();

export async function listPremierLeagueCompetitions(): Promise<PremierLeagueCompetition[]> {
  try {
    return await getRepository().listPremierLeagueCompetitions();
  } catch {
    return [];
  }
}

export async function loadPremierLeagueCompetition(
  id: string,
): Promise<PremierLeagueCompetition | null> {
  try {
    return await getRepository().getPremierLeagueCompetition(id);
  } catch {
    return null;
  }
}

export async function loadCurrentPremierLeagueCompetition(): Promise<PremierLeagueCompetition | null> {
  const competitions = await listPremierLeagueCompetitions();
  return (
    competitions.find((competition) => competition.status !== 'FINISHED') ??
    competitions[0] ??
    null
  );
}

export async function persistPremierLeagueCompetition(
  competition: PremierLeagueCompetition,
): Promise<void> {
  await getRepository().savePremierLeagueCompetition(competition);
}

export async function createPremierLeagueCompetition(
  input: CreatePremierLeagueInput,
): Promise<PremierLeagueCompetition> {
  const name = input.name.trim();
  if (!name) throw new Error('COMPETITION_NAME_REQUIRED');
  validateCompetitionPlayers(input.playerIds);
  const repo = getRepository();
  const [seasons, roster] = await Promise.all([
    repo.listSeasons(),
    repo.listPlayers(),
  ]);
  if (!seasons.length || !seasons.some((season) => season.id === input.seasonId)) {
    throw new Error('SEASON_REQUIRED');
  }
  const byId = new Map(roster.map((player) => [player.id, player]));
  if (input.playerIds.some((id) => !byId.has(id))) throw new Error('PLAYER_NOT_FOUND');

  const id = createUuid();
  const players = input.playerIds.map((playerId, index) => ({
    playerId,
    name: byId.get(playerId)!.name,
    seed: index + 1,
  }));
  const now = new Date().toISOString();
  const competition: PremierLeagueCompetition = {
    id,
    seasonId: input.seasonId,
    name,
    status: 'IN_PROGRESS',
    settings: PREMIER_LEAGUE_SETTINGS,
    players,
    nights: generateLeagueNights(id, players, uuidFactory, input.nightDates),
    finalsScheduledAt: input.finalsDate ?? null,
    championPlayerId: null,
    createdAt: now,
    updatedAt: now,
    finishedAt: null,
  };
  await repo.savePremierLeagueCompetition(competition);
  return competition;
}

function fixtureConfig(
  competition: PremierLeagueCompetition,
  fixture: PremierLeagueFixture,
  firstStarterPlayerId: string,
) {
  if (!fixture.playerAId || !fixture.playerBId) throw new Error('FIXTURE_PLAYERS_UNKNOWN');
  if (![fixture.playerAId, fixture.playerBId].includes(firstStarterPlayerId)) {
    throw new Error('INVALID_FIRST_STARTER');
  }
  const nameOf = (id: string) =>
    competition.players.find((player) => player.playerId === id)?.name ?? '???';
  return {
    id: createUuid(),
    createdAt: Date.now(),
    variant: 501 as const,
    outRule: 'DOUBLE' as const,
    mode: 'SINGLE' as const,
    legsToWin: fixture.legsToWin,
    participants: [
      { id: 'A', label: nameOf(fixture.playerAId), playerIds: [fixture.playerAId] },
      { id: 'B', label: nameOf(fixture.playerBId), playerIds: [fixture.playerBId] },
    ],
    players: [
      { id: fixture.playerAId, name: nameOf(fixture.playerAId) },
      { id: fixture.playerBId, name: nameOf(fixture.playerBId) },
    ],
    startingPolicy: 'MANUAL' as const,
    alternateStarter: true,
    firstStarterId: firstStarterPlayerId === fixture.playerAId ? 'A' : 'B',
  };
}

export async function launchPremierLeagueFixture(
  competitionId: string,
  nightId: string,
  fixtureId: string,
  firstStarterPlayerId: string,
  adminOverride = false,
): Promise<string> {
  const repo = getRepository();
  const competition = await repo.getPremierLeagueCompetition(competitionId);
  if (!competition) throw new Error('COMPETITION_NOT_FOUND');
  const night = competition.nights.find((candidate) => candidate.id === nightId);
  const fixture = night?.fixtures.find((candidate) => candidate.id === fixtureId);
  if (!night || !fixture) throw new Error('FIXTURE_NOT_FOUND');
  if (fixture.matchId) return fixture.matchId;
  if (!canStartFixture(competition, nightId, fixtureId, adminOverride)) {
    throw new Error('FIXTURE_NOT_AVAILABLE');
  }
  const config = fixtureConfig(competition, fixture, firstStarterPlayerId);
  const matchId = createUuid();
  const match: MatchRecord = {
    id: matchId,
    seasonId: competition.seasonId,
    config,
    events: [],
    mode: 'SINGLE',
    variant: 501,
    status: 'SCHEDULED',
    winnerParticipant: null,
    encounterId: null,
    fixtureIndex: null,
    premierLeagueCompetitionId: competition.id,
    premierLeagueNightId: night.id,
    premierLeagueFixtureId: fixture.id,
  };
  await persistMatch(match);
  fixture.matchId = matchId;
  fixture.status = 'IN_PROGRESS';
  night.status = 'IN_PROGRESS';
  if (night.stage === 'FINALS') competition.status = 'FINALS_IN_PROGRESS';
  await repo.savePremierLeagueCompetition(competition);
  return matchId;
}

export async function completePremierLeagueFixture(
  match: MatchRecord,
  winnerPlayerId: string,
  legsA: number,
  legsB: number,
): Promise<PremierLeagueCompetition> {
  const competitionId = match.premierLeagueCompetitionId;
  const nightId = match.premierLeagueNightId;
  const fixtureId = match.premierLeagueFixtureId;
  if (!competitionId || !nightId || !fixtureId) throw new Error('PREMIER_LEAGUE_LINK_MISSING');
  const repo = getRepository();
  const competition = await repo.getPremierLeagueCompetition(competitionId);
  if (!competition) throw new Error('COMPETITION_NOT_FOUND');
  const existing = competition.nights
    .find((night) => night.id === nightId)
    ?.fixtures.find((fixture) => fixture.id === fixtureId);
  if (existing?.status === 'FINISHED') return competition;

  let updated = recordFixtureResult(competition, nightId, fixtureId, {
    winnerPlayerId,
    legsA,
    legsB,
  });
  if (updated.status === 'FINALS_READY' && !updated.nights.some((night) => night.stage === 'FINALS')) {
    updated = withFinalsNight(updated, uuidFactory, updated.finalsScheduledAt);
  }
  await repo.savePremierLeagueCompetition(updated);
  return updated;
}

export async function updatePremierLeagueQuarterFinals(
  competitionId: string,
  nightId: string,
  pairings: Array<[string, string]>,
  force = false,
): Promise<PremierLeagueCompetition> {
  const repo = getRepository();
  const competition = await repo.getPremierLeagueCompetition(competitionId);
  if (!competition) throw new Error('COMPETITION_NOT_FOUND');
  const updated = replaceQuarterFinals(competition, nightId, pairings, force);
  await repo.savePremierLeagueCompetition(updated);
  return updated;
}

export async function setPremierLeagueNightAdminOverride(
  competitionId: string,
  nightNumber: number,
  unlocked: boolean,
): Promise<PremierLeagueCompetition> {
  const repo = getRepository();
  const competition = await repo.getPremierLeagueCompetition(competitionId);
  if (!competition) throw new Error('COMPETITION_NOT_FOUND');
  if (nightNumber < 2 || nightNumber > 7) throw new Error('INVALID_NIGHT_NUMBER');
  const values = new Set(competition.settings.adminUnlockedNightNumbers);
  if (unlocked) values.add(nightNumber);
  else values.delete(nightNumber);
  const updated = {
    ...competition,
    settings: {
      ...competition.settings,
      adminUnlockedNightNumbers: [...values].sort((a, b) => a - b),
    },
  };
  await repo.savePremierLeagueCompetition(updated);
  return updated;
}

export interface ReopenedPremierLeagueFixture {
  competition: PremierLeagueCompetition;
  matchId: string;
  nightId: string;
}

export async function reopenLastPremierLeagueResult(
  competitionId: string,
): Promise<ReopenedPremierLeagueFixture> {
  const repo = getRepository();
  const competition = await repo.getPremierLeagueCompetition(competitionId);
  if (!competition) throw new Error('COMPETITION_NOT_FOUND');
  const finished = competition.nights
    .flatMap((night) => night.fixtures.map((fixture) => ({ night, fixture })))
    .filter(({ fixture }) => fixture.status === 'FINISHED' && fixture.matchId)
    .sort((a, b) => (a.fixture.finishedAt ?? '') < (b.fixture.finishedAt ?? '') ? 1 : -1)[0];
  if (!finished?.fixture.matchId) throw new Error('NO_FINISHED_RESULT');
  const reason = correctionBlockReason(competition, finished.night.id, finished.fixture.id);
  if (reason) throw new Error(reason);
  const match = await repo.getMatch(finished.fixture.matchId);
  if (!match) throw new Error('MATCH_NOT_FOUND');

  const events = [...match.events];
  while (events.length && buildGameState(match.config, events).status === 'GAME_OVER') {
    events.pop();
  }
  const reopenedMatch: MatchRecord = {
    ...match,
    events,
    status: 'IN_PROGRESS',
    winnerParticipant: null,
    finishedAt: null,
  };
  const reopenedCompetition = reopenFixtureResult(
    competition,
    finished.night.id,
    finished.fixture.id,
  );
  await persistMatch(reopenedMatch);
  await repo.savePremierLeagueCompetition(reopenedCompetition);
  return {
    competition: reopenedCompetition,
    matchId: match.id,
    nightId: finished.night.id,
  };
}
