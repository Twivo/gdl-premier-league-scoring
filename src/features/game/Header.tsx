import { useGame } from '@/store/GameContext';
import { participantLabel, playerName } from '@/domain/presentation';
import { cn } from '@/lib/cn';
import { useT } from '@/store/LangContext';

export function Header() {
  const { config, state, saveStatus, swapStarter } = useGame();
  const { t } = useT();
  const { activeParticipantId, activePlayerId } = state;

  const isDouble = config.mode === 'DOUBLE';
  const legNumber = state.currentLegIndex + 1;
  // Starter can only be swapped before the very first dart of the match.
  const canSwapStarter =
    state.currentLegIndex === 0 && (state.legs[0]?.visits.length ?? 0) === 0;

  return (
    <header className="game-header grid shrink-0 grid-cols-[1fr_auto_1fr] items-center gap-2 border-b border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1.5 text-sm">
      <div
        key={activePlayerId}
        className="animate-player-switch flex min-w-0 items-baseline gap-2 truncate justify-self-start"
      >
        <span className="game-header-player text-3xl font-black 2xl:text-4xl">
          {playerName(config, activePlayerId)}
        </span>
        {isDouble && (
          <span className="rounded bg-[var(--color-accent)] px-2 py-0.5 text-base font-bold text-white">
            {participantLabel(config, activeParticipantId)}
          </span>
        )}
        <span className="game-header-suffix text-lg text-[var(--color-text-dim)]">{t('game.toThrowSuffix')}</span>
      </div>

      <div className="flex shrink-0 items-center gap-2 justify-self-center">
        {saveStatus !== 'saved' && (
          <span
            className={cn(
              'inline-flex shrink-0 items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-semibold',
              saveStatus === 'offline'
                ? 'text-[var(--color-warning)]'
                : 'text-[var(--color-text-dim)]',
            )}
            title={
              saveStatus === 'offline'
                ? t('game.offlineTitle')
                : t('game.savingTitle')
            }
          >
            <span
              className={cn(
                'h-1.5 w-1.5 rounded-full',
                saveStatus === 'offline'
                  ? 'bg-[var(--color-warning)]'
                  : 'animate-pulse bg-[var(--color-accent)]',
              )}
            />
            {saveStatus === 'offline' ? t('game.offlineRetrying') : t('common.saving')}
          </span>
        )}
        {canSwapStarter && (
          <button
            type="button"
            onClick={swapStarter}
            title={t('game.swapStarter')}
            aria-label={t('game.swapStarter')}
            className="game-swap-starter flex h-11 w-11 items-center justify-center rounded-lg border-2 border-[var(--color-border-strong)] bg-[var(--color-surface-2)] text-2xl font-black leading-none text-[var(--color-text)] transition-all active:scale-90 hover:border-[var(--color-text-dim)] hover:bg-[var(--color-surface-3)]"
          >
            ⇄
          </button>
        )}
      </div>

      <div className="game-header-format shrink-0 text-right text-lg text-[var(--color-text-dim)] justify-self-end">
        <span className="font-semibold text-[var(--color-accent)]">
          {t('game.leg')} {legNumber}
        </span>
        <span className="ml-1 hidden sm:inline">
          · {t('game.shortInfo')
            .replace('{variant}', String(config.variant))
            .replace('{legs}', String(config.legsToWin))}
        </span>
      </div>
    </header>
  );
}
