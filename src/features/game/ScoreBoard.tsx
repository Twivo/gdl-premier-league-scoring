import { useGame } from '@/store/GameContext';
import { cn } from '@/lib/cn';
import { participantLabel } from '@/domain/presentation';
import { useT } from '@/store/LangContext';

/**
 * Scoreboard with the big central remaining score.
 *
 * The central score decrements LIVE as the player types (liveRemaining =
 * remainingBefore - typed). Touching it commits the visit (same as VALIDATE).
 * Validation errors are surfaced right under the score.
 */
export function ScoreBoard({
  liveRemaining,
  hasInput,
  error,
  onCommit,
}: {
  liveRemaining: number;
  hasInput: boolean;
  error: string | null;
  onCommit: () => void;
}) {
  const { config, state } = useGame();
  const { t } = useT();
  const { activeParticipantId, legStarterId, remaining, legsWon, stats } = state;

  return (
    <div className="game-scoreboard px-4 pt-2">
      <div className="game-player-grid grid grid-cols-2 gap-2">
        {config.participants.map((p) => {
          const isActive = p.id === activeParticipantId;
          const s = stats.byParticipant[p.id];
          return (
            <div
              key={p.id}
              className={cn(
                'game-player-card rounded-xl border px-3 py-2 transition-all',
                isActive
                  ? 'border-[var(--color-accent)] bg-[var(--color-surface-2)] shadow-[0_2px_16px_-8px_var(--color-accent)]'
                  : 'border-[var(--color-border)] bg-[var(--color-surface)] opacity-65',
              )}
            >
              <div className="flex items-center justify-between">
                <span className="flex min-w-0 items-center gap-1.5">
                  <span className="game-player-name truncate text-[24px] font-bold leading-tight sm:text-[26px] 2xl:text-[32px]">
                    {participantLabel(config, p.id)}
                  </span>
                  {p.id === legStarterId && (
                    <span
                      className="shrink-0 text-base text-[var(--color-text-mute)]"
                      title={t('game.startsLegTitle')}
                      aria-label={t('game.startsLegTitle')}
                    >
                      ★
                    </span>
                  )}
                </span>
                <span className="game-player-legs shrink-0 text-lg font-bold text-[var(--color-accent)] sm:text-xl">
                  ● {legsWon[p.id] ?? 0}
                </span>
              </div>
              <div className="game-player-score text-[68px] font-black tnum leading-none sm:text-[76px] 2xl:text-[96px]">
                {remaining[p.id] ?? 0}
              </div>
              <div className="game-player-meta mt-0.5 flex items-center gap-1 whitespace-nowrap text-sm text-[var(--color-text-dim)] 2xl:gap-2 2xl:text-base">
                <span>{t('game.avg')} {s ? s.average3.toFixed(1) : '0.0'}</span>
                <span className="text-[var(--color-text-mute)]">·</span>
                <span>{s ? s.totalDarts : 0} {t('game.darts')}</span>
              </div>
            </div>
          );
        })}
      </div>

      <button
        onClick={onCommit}
        className={cn(
          'game-main-score-button mt-1 w-full rounded-2xl border-2 py-0 text-center transition-all active:scale-[0.99]',
          error
            ? 'animate-shake border-[var(--color-accent)] bg-[var(--color-accent-soft)]'
            : 'border-transparent',
        )}
      >
        <div className="game-main-score-label text-sm leading-5 uppercase tracking-wide text-[var(--color-text-dim)]">
          {hasInput ? t('game.remainingTap') : t('game.remaining')}
        </div>
        <div
          className={cn(
            'game-main-score font-black tnum leading-none text-[118px] sm:text-[120px] 2xl:text-[210px]',
            error ? 'text-[var(--color-accent)]' : 'text-[var(--color-text)]',
          )}
        >
          {liveRemaining}
        </div>
        <div className="game-main-score-error h-6 text-base font-semibold leading-6">
          {error ? (
            <span className="text-[var(--color-accent)]">{error}</span>
          ) : (
            <span className="text-transparent">.</span>
          )}
        </div>
      </button>
    </div>
  );
}
