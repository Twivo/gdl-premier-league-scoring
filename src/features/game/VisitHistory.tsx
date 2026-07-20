import { useGame } from '@/store/GameContext';
import { participantLabel } from '@/domain/presentation';
import { cn } from '@/lib/cn';
import { useT } from '@/store/LangContext';
import type { ResolvedVisit } from '@/domain/types';

/**
 * DartConnect-style visit history for the current leg: one column per
 * participant, one row per round. Each cell shows the score, the remaining
 * after the visit, and the darts used. Tap a cell to edit that visit.
 */
export function VisitHistory({ onEdit }: { onEdit: (eventId: string) => void }) {
  const { config, state } = useGame();
  const { t } = useT();
  const leg = state.legs[state.currentLegIndex];

  const columns = config.participants.map((p) => ({
    participant: p,
    visits: leg ? leg.visits.filter((v) => v.participantId === p.id) : [],
  }));
  const rounds = Math.max(0, ...columns.map((c) => c.visits.length));

  const rowIdx = Array.from({ length: rounds }, (_, i) => i).reverse();

  const Cell = ({ v }: { v: ResolvedVisit | undefined }) => {
    if (!v) return <div className="rounded-lg px-2 py-2" />;
    const label = v.isBust
      ? t('game.bust')
      : v.isCheckout
        ? `${v.effectiveScore}`
        : `${v.effectiveScore}`;
    return (
      <button
        onClick={() => onEdit(v.event.id)}
        className="flex items-center justify-between rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-[var(--color-surface-2)]"
      >
        <span
          className={cn(
            'text-5xl font-black tnum',
            v.isBust && 'text-[var(--color-accent)]',
            v.isCheckout && 'text-[var(--color-success)]',
          )}
        >
          {label}
          {v.isCheckout && ' ✓'}
        </span>
        <span className="flex flex-col items-end leading-tight">
          <span className="text-2xl font-semibold tnum text-[var(--color-text-dim)]">
            {v.remainingAfter}
          </span>
          <span className="text-sm text-[var(--color-text-mute)]">
            {v.event.darts}d
          </span>
        </span>
      </button>
    );
  };

  return (
    <div className="flex flex-col">
      <div className="sticky top-0 z-10 grid grid-cols-2 gap-2 border-b border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2.5">
        {columns.map((c) => (
          <div
            key={c.participant.id}
            className={cn(
              'flex items-center justify-between truncate text-lg font-bold uppercase tracking-wide',
              c.participant.id === state.activeParticipantId
                ? 'text-[var(--color-accent)]'
                : 'text-[var(--color-text-dim)]',
            )}
          >
            <span className="truncate">
              {participantLabel(config, c.participant.id)}
            </span>
            <span className="text-[var(--color-text-mute)]">
              {state.remaining[c.participant.id] ?? 0}
            </span>
          </div>
        ))}
      </div>

      {rounds === 0 ? (
        <p className="px-3 py-4 text-xl text-[var(--color-text-dim)]">
          {t('visitHistory.empty')}
        </p>
      ) : (
        <div className="px-1 py-1">
          {rowIdx.map((r) => (
            <div
              key={r}
              className="grid grid-cols-2 gap-2 border-b border-[var(--color-border)]/40 last:border-0"
            >
              {columns.map((c) => (
                <Cell key={c.participant.id} v={c.visits[r]} />
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
