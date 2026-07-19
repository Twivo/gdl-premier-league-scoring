import type {
  PremierLeagueCompetition,
  PremierLeagueEntrant,
  PremierLeagueFixture,
  PremierLeagueStanding,
} from './types';

function blank(player: PremierLeagueEntrant): PremierLeagueStanding {
  return {
    position: 0,
    playerId: player.playerId,
    playerName: player.name,
    points: 0,
    nightsPlayed: 0,
    nightWins: 0,
    finalsLost: 0,
    semiFinalsReached: 0,
    matchesPlayed: 0,
    matchesWon: 0,
    matchesLost: 0,
    legsWon: 0,
    legsLost: 0,
    legDifference: 0,
  };
}

function loserOf(fixture: PremierLeagueFixture): string | null {
  if (!fixture.winnerPlayerId) return null;
  return fixture.winnerPlayerId === fixture.playerAId
    ? fixture.playerBId
    : fixture.playerAId;
}

function directWins(
  playerAId: string,
  playerBId: string,
  fixtures: PremierLeagueFixture[],
): [number, number] {
  let a = 0;
  let b = 0;
  fixtures
    .filter(
      (f) =>
        f.status === 'FINISHED' &&
        new Set([f.playerAId, f.playerBId]).has(playerAId) &&
        new Set([f.playerAId, f.playerBId]).has(playerBId),
    )
    .forEach((f) => {
      if (f.winnerPlayerId === playerAId) a += 1;
      if (f.winnerPlayerId === playerBId) b += 1;
    });
  return [a, b];
}

export function calculateStandings(
  competition: PremierLeagueCompetition,
): PremierLeagueStanding[] {
  const byPlayer = new Map(
    competition.players.map((player) => [player.playerId, blank(player)]),
  );
  const leagueNights = competition.nights.filter((night) => night.stage === 'LEAGUE');
  const completedFixtures = leagueNights.flatMap((night) =>
    night.fixtures.filter((fixture) => fixture.status === 'FINISHED'),
  );

  for (const night of leagueNights) {
    if (night.status === 'FINISHED') {
      for (const standing of byPlayer.values()) standing.nightsPlayed += 1;
      const final = night.fixtures.find((f) => f.round === 'FINAL');
      if (final?.winnerPlayerId) {
        byPlayer.get(final.winnerPlayerId)!.points += 5;
        byPlayer.get(final.winnerPlayerId)!.nightWins += 1;
        const finalist = loserOf(final);
        if (finalist) {
          byPlayer.get(finalist)!.points += 3;
          byPlayer.get(finalist)!.finalsLost += 1;
        }
      }
      night.fixtures
        .filter((f) => f.round === 'SEMI_FINAL')
        .forEach((semi) => {
          const eliminated = loserOf(semi);
          if (eliminated) {
            byPlayer.get(eliminated)!.points += 2;
            byPlayer.get(eliminated)!.semiFinalsReached += 1;
          }
        });
    }
  }

  for (const fixture of completedFixtures) {
    if (!fixture.playerAId || !fixture.playerBId || !fixture.winnerPlayerId) continue;
    const a = byPlayer.get(fixture.playerAId)!;
    const b = byPlayer.get(fixture.playerBId)!;
    a.matchesPlayed += 1;
    b.matchesPlayed += 1;
    a.legsWon += fixture.legsA;
    a.legsLost += fixture.legsB;
    b.legsWon += fixture.legsB;
    b.legsLost += fixture.legsA;
    const winner = fixture.winnerPlayerId === fixture.playerAId ? a : b;
    const loser = winner === a ? b : a;
    winner.matchesWon += 1;
    loser.matchesLost += 1;
  }
  for (const standing of byPlayer.values()) {
    standing.legDifference = standing.legsWon - standing.legsLost;
  }

  const sorted = [...byPlayer.values()].sort((a, b) => {
    const numeric =
      b.points - a.points ||
      b.nightWins - a.nightWins ||
      b.legDifference - a.legDifference ||
      b.legsWon - a.legsWon ||
      b.matchesWon - a.matchesWon;
    if (numeric) return numeric;
    const [aDirect, bDirect] = directWins(a.playerId, b.playerId, completedFixtures);
    if (aDirect !== bDirect) return bDirect - aDirect;
    return a.playerName.localeCompare(b.playerName, undefined, { sensitivity: 'base' });
  });
  return sorted.map((standing, index) => ({ ...standing, position: index + 1 }));
}

export function selectTopFour(
  competition: PremierLeagueCompetition,
): PremierLeagueEntrant[] {
  const entrants = new Map(competition.players.map((p) => [p.playerId, p]));
  return calculateStandings(competition)
    .slice(0, 4)
    .map((standing) => entrants.get(standing.playerId)!);
}

