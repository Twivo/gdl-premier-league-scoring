import type { PremierLeagueStanding } from '@/domain/premierLeague';
import { useT } from '@/store/LangContext';

export function StandingsTable({ standings }: { standings: PremierLeagueStanding[] }) {
  const { t } = useT();
  const headers: Array<[keyof PremierLeagueStanding, string]> = [
    ['position', 'premierLeague.table.position'],
    ['playerName', 'premierLeague.table.player'],
    ['points', 'premierLeague.table.points'],
    ['nightsPlayed', 'premierLeague.table.nights'],
    ['nightWins', 'premierLeague.table.nightWins'],
    ['finalsLost', 'premierLeague.table.finalsLost'],
    ['semiFinalsReached', 'premierLeague.table.semis'],
    ['matchesPlayed', 'premierLeague.table.matchesPlayed'],
    ['matchesWon', 'premierLeague.table.matchesWon'],
    ['matchesLost', 'premierLeague.table.matchesLost'],
    ['legsWon', 'premierLeague.table.legsWon'],
    ['legsLost', 'premierLeague.table.legsLost'],
    ['legDifference', 'premierLeague.table.legDifference'],
  ];
  return (
    <div className="overflow-x-auto rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)]">
      <table className="min-w-[980px] w-full border-collapse text-sm">
        <thead className="bg-[var(--color-surface-2)]">
          <tr>
            {headers.map(([key, label]) => (
              <th
                key={key}
                className={
                  'whitespace-nowrap px-3 py-3 font-bold ' +
                  (key === 'playerName' ? 'text-left' : 'text-center')
                }
              >
                {t(label)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {standings.map((standing) => (
            <tr
              key={standing.playerId}
              className="border-t border-[var(--color-border)] first:border-t-0"
            >
              <td className="px-3 py-3 text-center font-black text-[var(--color-accent)]">
                {standing.position}
              </td>
              <td className="whitespace-nowrap px-3 py-3 font-bold">{standing.playerName}</td>
              <td className="px-3 py-3 text-center text-lg font-black">{standing.points}</td>
              <td className="px-3 py-3 text-center">{standing.nightsPlayed}</td>
              <td className="px-3 py-3 text-center">{standing.nightWins}</td>
              <td className="px-3 py-3 text-center">{standing.finalsLost}</td>
              <td className="px-3 py-3 text-center">{standing.semiFinalsReached}</td>
              <td className="px-3 py-3 text-center">{standing.matchesPlayed}</td>
              <td className="px-3 py-3 text-center">{standing.matchesWon}</td>
              <td className="px-3 py-3 text-center">{standing.matchesLost}</td>
              <td className="px-3 py-3 text-center">{standing.legsWon}</td>
              <td className="px-3 py-3 text-center">{standing.legsLost}</td>
              <td className="px-3 py-3 text-center font-bold">
                {standing.legDifference > 0 ? '+' : ''}{standing.legDifference}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

