import { buildGameState } from '@/domain/engine';
import { cn } from '@/lib/cn';
import { useT } from '@/store/LangContext';
import type { MatchRecord, EncounterRecord } from '@/data/types';

/**
 * Full championship recap for the live page: every fixture in play order —
 * already played, the one in progress, and the ones still to come — with the
 * players, each match's leg score, and a clear indicator of the live match.
 */
export function LiveEncounterRecap({
  encounter,
  matches,
  currentMatchId,
}: {
  encounter: EncounterRecord;
  matches: MatchRecord[];
  currentMatchId?: string;
}) {
  const { t } = useT();
  const { teams, fixtures, decider } = encounter.plan;
  const nameOf = (id: string) =>
    [...teams.A.players, ...teams.B.players].find((p) => p.id === id)?.name ?? '—';
  const side = (ids: string[]) => (ids.length ? ids.map(nameOf).join(' & ') : '—');
  const byFixture = new Map(
    matches.map((m) => [m.fixtureIndex ?? -1, m] as const),
  );
  // Include the decisive doubles (played only at a level score) as a final row.
  const rows = decider ? [...fixtures, decider] : fixtures;

  return (
    <div className="mt-4">
      <div className="mb-2 flex items-center justify-between px-1">
        <h2 className="text-sm font-bold uppercase tracking-wide text-[var(--color-text-dim)]">
          {t('home.championship').replace('🏆 ', '')}
        </h2>
        <span className="text-sm font-black tnum">
          {teams.A.name} {encounter.scoreA}
          <span className="mx-1 text-[var(--color-text-mute)]">–</span>
          {encounter.scoreB} {teams.B.name}
        </span>
      </div>

      <div className="overflow-hidden rounded-xl border border-[var(--color-border)]">
        <table className="w-full text-sm">
          <tbody>
            {rows.map((f) => {
              const isDeciderRow = f.index >= fixtures.length;
              const m = byFixture.get(f.index);
              const st = m ? buildGameState(m.config, m.events) : null;
              const legsA = st ? st.legsWon['A'] ?? 0 : 0;
              const legsB = st ? st.legsWon['B'] ?? 0 : 0;
              const isLive =
                !!m && m.status === 'IN_PROGRESS' && f.winner === null;
              const isCurrent = m?.id === currentMatchId;
              const played = f.winner !== null;
              return (
                <tr
                  key={f.index}
                  className={cn(
                    'border-t border-[var(--color-border)] first:border-t-0',
                    isCurrent
                      ? 'bg-[var(--color-accent-soft)]'
                      : isLive
                        ? 'bg-[var(--color-surface-2)]'
                        : !played && 'opacity-60',
                  )}
                >
                  <td className="w-9 py-2 pl-2 pr-1 align-middle text-[10px] font-bold uppercase text-[var(--color-accent)]">
                    {isDeciderRow
                      ? '★'
                      : `${f.kind === 'DOUBLE' ? 'D' : 'S'}${f.index + 1}`}
                  </td>
                  <td className="py-2 pr-1 align-middle">
                    <div className="flex items-center gap-1.5">
                      <span
                        className={cn(
                          'min-w-0 flex-1 truncate text-right',
                          f.winner === 'A' && 'font-bold text-[var(--color-success)]',
                        )}
                      >
                        {side(f.aPlayerIds)}
                      </span>
                      <span className="shrink-0 px-1 tnum text-[var(--color-text-dim)]">
                        {m ? `${legsA}–${legsB}` : t('common.vs')}
                      </span>
                      <span
                        className={cn(
                          'min-w-0 flex-1 truncate',
                          f.winner === 'B' && 'font-bold text-[var(--color-success)]',
                        )}
                      >
                        {side(f.bPlayerIds)}
                      </span>
                    </div>
                  </td>
                  <td className="w-16 py-2 pl-1 pr-2 text-right align-middle">
                    {isLive ? (
                      <span className="inline-flex items-center gap-1 rounded bg-[var(--color-accent)] px-1.5 py-0.5 text-[10px] font-bold text-white">
                        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" />
                        {t('common.live').toUpperCase()}
                      </span>
                    ) : played ? (
                      <span className="text-[var(--color-success)]">✓</span>
                    ) : (
                      <span className="text-[var(--color-text-mute)]">·</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
