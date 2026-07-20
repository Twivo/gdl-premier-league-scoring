import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGame } from '@/store/GameContext';
import { useT } from '@/store/LangContext';
import { useConfirm } from '@/components/ui/ConfirmProvider';
import { playerName } from '@/domain/presentation';
import {
  isOnFinish,
  validateVisitInput,
  type VisitErrorCode,
} from '@/domain/rules/validation';
import { minDartsToCheckout } from '@/domain/rules/checkout';
import { cn } from '@/lib/cn';
import { StatsScreen } from '@/features/stats/StatsScreen';
import { Header } from './Header';
import { ScoreBoard } from './ScoreBoard';
import { Keypad } from './Keypad';
import { LegEndModal } from './LegEndModal';
import { VisitHistory } from './VisitHistory';
import { EditVisitModal } from './EditVisitModal';

export function GameScreen({
  onGameOver,
  gameOverContent,
  embedded,
  onConfigure,
}: {
  /** Championship: called once the match is finished (winner participant id). */
  onGameOver?: (winnerParticipantId: string | undefined) => void;
  /** Championship: replaces the default end screen (StatsScreen). */
  gameOverContent?: React.ReactNode;
  /** Fill the parent instead of the whole viewport (embedded in a wrapper). */
  embedded?: boolean;
  /** Championship: opens the encounter configuration (button next to Undo). */
  onConfigure?: () => void;
} = {}) {
  const navigate = useNavigate();
  const confirm = useConfirm();
  const { t } = useT();
  const { config, state, addVisit, addBust, undo, forfeitLeg, forfeitGame } =
    useGame();

  const [buffer, setBuffer] = useState('');
  const [pendingCheckout, setPendingCheckout] = useState<number | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const firedGameOver = useRef(false);

  // Physical-keyboard support (desktop): the latest input API is stashed in a
  // ref so a single window listener stays valid across renders. Set to null
  // once the game is over or a modal owns the keyboard, disabling capture.
  const keyApi = useRef<{
    onDigit: (d: string) => void;
    onBackspace: () => void;
    onCommit: () => void;
    onClear: () => void;
  } | null>(null);

  useEffect(() => {
    if (state.status === 'GAME_OVER' && onGameOver && !firedGameOver.current) {
      firedGameOver.current = true;
      onGameOver(state.winnerId);
    }
  }, [state.status, state.winnerId, onGameOver]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const api = keyApi.current;
      if (!api || e.metaKey || e.ctrlKey || e.altKey) return;
      const el = e.target as HTMLElement | null;
      if (
        el &&
        (el.tagName === 'INPUT' ||
          el.tagName === 'TEXTAREA' ||
          el.isContentEditable)
      ) {
        return;
      }
      if (e.key >= '0' && e.key <= '9') {
        e.preventDefault();
        api.onDigit(e.key);
      } else if (e.key === 'Backspace') {
        e.preventDefault();
        api.onBackspace();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        api.onCommit();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        api.onClear();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  if (state.status === 'GAME_OVER') {
    keyApi.current = null;
    if (onGameOver || gameOverContent) return <>{gameOverContent}</>;
    return <StatsScreen />;
  }

  const activeId = state.activeParticipantId;
  const remainingBefore = state.remaining[activeId] ?? 0;
  const legNumber = state.currentLegIndex + 1;

  const parsed = buffer === '' ? null : parseInt(buffer, 10);

  // A visit can never score more than 180, so anything above that can only be
  // an entry of the REMAINING score (type-the-remaining), not a score thrown.
  const isRemainingEntry = parsed !== null && parsed > 180;

  // Score interpretation: buffer = points SCORED this visit (live decrement).
  const scoreValidation =
    parsed !== null && !isRemainingEntry
      ? validateVisitInput(remainingBefore, parsed)
      : null;

  // Remaining interpretation: buffer = the REMAINING after the visit.
  const remainingValidation =
    parsed !== null
      ? validateVisitInput(remainingBefore, remainingBefore - parsed)
      : null;
  const leaveEnabled = !!remainingValidation?.ok;

  const liveRemaining =
    parsed === null
      ? remainingBefore
      : isRemainingEntry
        ? parsed
        : remainingBefore - parsed;

  let error: string | null = null;
  if (parsed !== null) {
    if (isRemainingEntry) {
      if (!remainingValidation?.ok) {
        error =
          parsed > remainingBefore
            ? t('validation.leaveMore').replace('{remaining}', String(remainingBefore))
            : parsed === 1
              ? t('validation.leavesOne')
              : t('validation.exceeds180');
      }
    } else if (scoreValidation && !scoreValidation.ok && scoreValidation.code) {
      error = visitErrorText(t, scoreValidation.code, remainingBefore);
    }
  }

  const onFinish = isOnFinish(remainingBefore);
  const finishMinDarts = minDartsToCheckout(remainingBefore) ?? 3;

  // --- input -------------------------------------------------------------
  const onDigit = (d: string) => {
    setBuffer((b) => {
      const next = (b + d).replace(/^0+(?=\d)/, '');
      return next.length > 3 ? b : next;
    });
  };
  const onBackspace = () => setBuffer((b) => b.slice(0, -1));

  /** Validate and record a gross visit score (or open the checkout modal). */
  const commitGross = (gross: number) => {
    const v = validateVisitInput(remainingBefore, gross);
    if (!v.ok) {
      setBuffer(String(gross)); // surface the failing score + its error
      return;
    }
    if (v.isCheckout) {
      setPendingCheckout(gross);
      setBuffer('');
      return;
    }
    addVisit(gross);
    setBuffer('');
  };

  /** Commit the buffer as the REMAINING after the visit (type-the-remaining). */
  const commitRemaining = () => {
    if (parsed === null || !leaveEnabled) return;
    commitGross(remainingBefore - parsed);
  };

  /**
   * Primary commit (VALIDATE / central tap / ✓): interprets the buffer as a
   * score thrown, unless it's > 180 in which case it can only be a remaining.
   */
  const commitSmart = () => {
    if (parsed === null) return;
    if (isRemainingEntry) commitRemaining();
    else commitGross(parsed);
  };

  // Wire the physical keyboard to the live input, but hand control to a modal
  // (checkout / edit visit) when one is open so it can own the keyboard.
  keyApi.current =
    pendingCheckout !== null || editingId !== null
      ? null
      : {
          onDigit,
          onBackspace,
          onCommit: commitSmart,
          onClear: () => setBuffer(''),
        };

  const confirmCheckout = (darts: number) => {
    if (pendingCheckout === null) return;
    addVisit(pendingCheckout, darts);
    setPendingCheckout(null);
  };

  /** Long-press finish: close the leg with the held number of darts. */
  const finishWith = (darts: number) => {
    if (!onFinish || darts < finishMinDarts) return;
    addVisit(remainingBefore, darts);
    setBuffer('');
  };

  /** Miss in a finish: a no-score visit (0), not a bust. */
  const onMiss = () => {
    addVisit(0, 3);
    setBuffer('');
  };

  const onBust = () => {
    addBust();
    setBuffer('');
  };

  // --- forfeits ----------------------------------------------------------
  const forfeitCurrentLeg = async () => {
    const ok = await confirm({
      title: t('game.forfeitLegTitle'),
      message: t('game.forfeitLegMessage').replace(
        '{player}',
        playerName(config, state.activePlayerId),
      ),
      danger: true,
      confirmLabel: t('game.forfeitLeg'),
    });
    if (ok) {
      forfeitLeg(activeId);
      setBuffer('');
    }
  };

  const forfeitCurrentGame = async () => {
    const ok = await confirm({
      title: t('game.forfeitMatchTitle'),
      message: t('game.forfeitMatchMessage'),
      danger: true,
      confirmLabel: t('game.forfeitMatch'),
    });
    if (ok) forfeitGame(activeId);
  };

  return (
    <div
      className={cn(
        'flex flex-col bg-[var(--color-bg)]',
        embedded
          ? 'h-full min-h-0 flex-1'
          : 'mx-auto h-[100dvh] max-w-6xl',
      )}
    >
      {/* top control bar (compact single line) */}
      <div className="flex shrink-0 items-center justify-between border-b border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-1 text-lg">
        <button
          onClick={() => navigate('/')}
          className="rounded-md px-3 py-1.5 font-semibold text-[var(--color-text-dim)] hover:bg-[var(--color-surface-2)]"
        >
          {t('common.home')}
        </button>
        <div className="flex items-center gap-1">
          {onConfigure && (
            <button
              onClick={onConfigure}
              className="rounded-md px-3 py-1.5 font-semibold text-[var(--color-text-dim)] hover:bg-[var(--color-surface-2)]"
            >
              {t('champ.configure')}
            </button>
          )}
          <button
            onClick={undo}
            className="rounded-md px-3 py-1.5 font-semibold hover:bg-[var(--color-surface-2)]"
          >
            {t('game.undo')}
          </button>
          <button
            onClick={forfeitCurrentLeg}
            className="rounded-md px-3 py-1.5 font-semibold text-[var(--color-warning)] hover:bg-[var(--color-surface-2)]"
          >
            {t('game.forfeitLeg')}
          </button>
          <button
            onClick={forfeitCurrentGame}
            className="rounded-md px-3 py-1.5 font-semibold text-[var(--color-accent)] hover:bg-[var(--color-surface-2)]"
          >
            {t('game.forfeitMatch')}
          </button>
        </div>
      </div>

      <Header />

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        {/* scores + finish + history (right under the remaining score) */}
        <div className="flex min-h-0 flex-1 flex-col">
          <ScoreBoard
            liveRemaining={liveRemaining}
            hasInput={parsed !== null}
            error={error}
            onCommit={commitRemaining}
          />
          <div className="min-h-0 flex-1 overflow-y-auto border-t border-[var(--color-border)]">
            <VisitHistory onEdit={(id) => setEditingId(id)} />
          </div>
        </div>

        {/* keypad — finish long-press is integrated into the 1/2/3 keys */}
        <div className="shrink-0 border-t border-[var(--color-border)] lg:flex lg:w-[520px] lg:flex-col lg:justify-center lg:border-l lg:border-t-0">
          <Keypad
            buffer={buffer}
            remainingBefore={remainingBefore}
            onFinish={onFinish}
            finishMinDarts={finishMinDarts}
            onDigit={onDigit}
            onBackspace={onBackspace}
            onCommit={commitSmart}
            onQuickScore={commitGross}
            onBust={onBust}
            onMiss={onMiss}
            onFinishWith={finishWith}
          />
        </div>
      </div>

      <LegEndModal
        open={pendingCheckout !== null}
        playerName={playerName(config, state.activePlayerId)}
        legNumber={legNumber}
        checkoutScore={pendingCheckout ?? 0}
        onConfirm={confirmCheckout}
        onCancel={() => setPendingCheckout(null)}
      />

      <EditVisitModal eventId={editingId} onClose={() => setEditingId(null)} />
    </div>
  );
}

function visitErrorText(
  t: (key: string) => string,
  code: VisitErrorCode,
  remainingBefore: number,
): string {
  switch (code) {
    case 'SCORE_RANGE':
      return t('validation.scoreRange');
    case 'IMPOSSIBLE_SCORE':
      return t('validation.impossible');
    case 'OVER_REMAINING':
      return t('validation.overRemaining').replace(
        '{remaining}',
        String(remainingBefore),
      );
    case 'LEAVES_ONE':
      return t('validation.leavesOne');
    case 'INVALID_CHECKOUT':
      return t('validation.invalidCheckout').replace(
        '{remaining}',
        String(remainingBefore),
      );
  }
}
