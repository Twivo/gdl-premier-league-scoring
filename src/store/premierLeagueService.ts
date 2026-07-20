import { getRepository } from '@/data';
import {
  canStartFixture,
  recordFixtureResult,
  type PremierLeagueCompetition,
  type PremierLeagueFixture,
} from '@/domain/premierLeague';
import { createUuid } from '@/lib/id';
import type { MatchRecord } from '@/data/types';
import { persistMatch } from './matchService';

// This app is a scoring station only. Creating competitions, seeding players,
// scheduling Nights, editing brackets, generating the Finals bracket and
// admin overrides are owned by the external tournament website. Here we only
// read the assignments it publishes, run the match, and write results back.

export async function listPremierLeagueCompetitions(): Promise<PremierLeagueCompetition[]> {
  try {
    return await getRepository().listPremierLeagueCompetitions();
  } catch {
    return [];
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

  const findLinkedMatch = async () =>
    (await repo.listMatches({ premierLeagueCompetitionId: competition.id })).find(
      (candidate) => candidate.premierLeagueFixtureId === fixture.id,
    );
  const linkMatch = async (matchId: string) => {
    await repo.linkPremierLeagueMatch({
      competitionId: competition.id,
      nightId: night.id,
      fixtureId: fixture.id,
      matchId,
      finals: night.stage === 'FINALS',
    });
  };
  const resumeMatch = async (matchId: string) => {
    // The match row is sufficient to continue scoring. Linking the board is a
    // repair step, so a temporary bracket-write failure must not hide a match
    // whose event log is already safely stored.
    await linkMatch(matchId).catch(() => undefined);
    return matchId;
  };

  // A previous launch may have saved the event-sourced match before its board
  // link was written (or an external bracket sync may have cleared that link).
  // Resume that match instead of creating a duplicate and losing its darts.
  const existingMatch = await findLinkedMatch();
  if (existingMatch) return resumeMatch(existingMatch.id);
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
  try {
    await persistMatch(match);
    await linkMatch(matchId);
    return matchId;
  } catch (cause) {
    // Two scoring stations can tap the same board at nearly the same time.
    // The database uniqueness constraint chooses one match; both stations
    // should then resume that winner rather than surface a generic error.
    const concurrentMatch = await findLinkedMatch().catch(() => undefined);
    if (!concurrentMatch) throw cause;
    return resumeMatch(concurrentMatch.id);
  }
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

  const updated = recordFixtureResult(competition, nightId, fixtureId, {
    winnerPlayerId,
    legsA,
    legsB,
  });
  await repo.savePremierLeagueCompetition(updated);
  return updated;
}
