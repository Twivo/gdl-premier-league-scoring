import type { EncounterRecord } from '@/data/types';
import type { EncounterState } from '@/domain/championship/types';
import { cn } from '@/lib/cn';
import { useT } from '@/store/LangContext';

/** Permanent championship scoreboard — shown during and between matches. */
export function EncounterHeader({
  encounter,
  state,
  onConfigure,
}: {
  encounter: EncounterRecord;
  state: EncounterState;
  onConfigure?: () => void;
}) {
  const { t } = useT();
  const { teams } = encounter.plan;
  const leader =
    state.scoreA > state.scoreB ? 'A' : state.scoreB > state.scoreA ? 'B' : null;

  return (
    <div className="flex shrink-0 items-stretch justify-between gap-2 border-b border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2">
      <Team name={teams.A.name} score={state.scoreA} lead={leader === 'A'} />
      <div className="flex flex-col items-center justify-center px-2 text-center">
        {state.isDecider ? (
          <span className="rounded-md bg-[var(--color-accent-soft)] px-2 py-0.5 text-[11px] font-black uppercase tracking-wide text-[var(--color-accent)]">
            {t('champ.decider')}
          </span>
        ) : (
          <>
            <span className="text-[10px] uppercase tracking-wide text-[var(--color-text-dim)]">
              {t('champ.matchOf')
                .replace('{current}', String(Math.min(state.currentIndex + 1, state.total)))
                .replace('{total}', String(state.total))}
            </span>
            <span className="text-xs font-semibold text-[var(--color-accent)]">
              {t('champ.left').replace('{count}', String(state.remaining))}
            </span>
          </>
        )}
        {onConfigure && state.phase !== 'FINAL' && (
          <button
            onClick={onConfigure}
            className="mt-0.5 rounded-md px-1.5 py-0.5 text-[10px] font-semibold text-[var(--color-text-dim)] hover:bg-[var(--color-surface-2)] hover:text-[var(--color-text)]"
          >
            {t('champ.configure')}
          </button>
        )}
      </div>
      <Team
        name={teams.B.name}
        score={state.scoreB}
        lead={leader === 'B'}
        right
      />
    </div>
  );
}

function Team({
  name,
  score,
  lead,
  right,
}: {
  name: string;
  score: number;
  lead: boolean;
  right?: boolean;
}) {
  return (
    <div className={cn('flex flex-1 items-center gap-2', right && 'flex-row-reverse')}>
      <span
        className={cn(
          'text-3xl font-black tnum',
          lead ? 'text-[var(--color-accent)]' : 'text-[var(--color-text)]',
        )}
      >
        {score}
      </span>
      <span className="truncate text-sm font-semibold">{name}</span>
    </div>
  );
}
