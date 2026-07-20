import { cn } from '@/lib/cn';
import { useLongPress } from '@/hooks/useLongPress';
import { useT } from '@/store/LangContext';

const QUICK_LEFT = [26, 41, 45, 59];
const QUICK_RIGHT = [60, 81, 99, 100];
const QUICK_BOTTOM = [140, 180];
// 1 at the top, 9 at the bottom.
const DIGITS = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];
// Numpad key height, shared by every key (incl. FinishKey) so they stay aligned.
const KEY_H = 'h-14 sm:h-16 lg:h-20';

/**
 * Numeric keypad. Buffer = the SCORE thrown (✓ / VALIDATE / quick scores
 * deduct it). When the player is on a finish, the 1/2/3 keys turn green and a
 * LONG PRESS on them closes the leg with that many darts (short tap still types
 * the digit).
 */
export function Keypad({
  buffer,
  remainingBefore,
  onFinish,
  finishMinDarts,
  onDigit,
  onBackspace,
  onCommit,
  onQuickScore,
  onBust,
  onMiss,
  onFinishWith,
  disabled,
}: {
  buffer: string;
  remainingBefore: number;
  onFinish: boolean;
  finishMinDarts: number;
  onDigit: (d: string) => void;
  onBackspace: () => void;
  onCommit: () => void;
  onQuickScore: (gross: number) => void;
  onBust: () => void;
  onMiss: () => void;
  onFinishWith: (darts: number) => void;
  disabled?: boolean;
}) {
  const { t } = useT();
  const hasInput = buffer !== '';
  const canBust = remainingBefore <= 180;

  const isFinishKey = (d: string) =>
    onFinish && (d === '1' || d === '2' || d === '3') && Number(d) >= finishMinDarts;

  const Quick = ({ value }: { value: number }) => (
    <button
      onClick={() => onQuickScore(value)}
      disabled={disabled}
      className="flex-1 rounded-lg bg-[var(--color-surface)] text-2xl font-bold text-[var(--color-text-dim)] transition-all active:scale-95 hover:text-[var(--color-text)] disabled:opacity-40"
    >
      {value}
    </button>
  );

  return (
    <div className="select-none px-2 pb-1 pt-1">
      {/* keypad input preview / finish hint */}
      <div className="mb-1 flex h-10 items-center justify-center rounded-lg bg-[var(--color-surface)] px-3">
        {hasInput ? (
          <span className="text-4xl font-black tnum tracking-wider">{buffer}</span>
        ) : onFinish ? (
          <span className="text-lg font-semibold text-[var(--color-success)]">
            {t('game.finishHint')}
          </span>
        ) : (
          <span className="text-lg text-[var(--color-text-mute)]">{t('game.typeScore')}</span>
        )}
      </div>

      <div className="flex gap-1.5">
        {/* left quick column */}
        <div className="flex w-16 flex-col gap-1.5 sm:w-20">
          {QUICK_LEFT.map((v) => (
            <Quick key={v} value={v} />
          ))}
        </div>

        {/* numpad */}
        <div className="grid flex-1 grid-cols-3 gap-1.5">
          {DIGITS.map((d) =>
            isFinishKey(d) ? (
              <FinishKey
                key={d}
                digit={d}
                disabled={disabled}
                onDigit={onDigit}
                onFinishWith={onFinishWith}
              />
            ) : (
              <PlainKey
                key={d}
                label={d}
                onClick={() => onDigit(d)}
                disabled={disabled}
                className={KEY_H}
              />
            ),
          )}
          <PlainKey label="0" onClick={() => onDigit('0')} disabled={disabled} className={KEY_H} />
          <PlainKey
            label="⌫"
            onClick={onBackspace}
            disabled={disabled}
            className={cn(KEY_H, 'text-[var(--color-text-dim)]')}
          />
          <PlainKey
            label="✓"
            onClick={onCommit}
            disabled={disabled}
            className={cn(KEY_H, 'bg-[var(--color-accent)] text-white active:bg-[var(--color-accent-hover)]')}
          />
        </div>

        {/* right quick column */}
        <div className="flex w-16 flex-col gap-1.5 sm:w-20">
          {QUICK_RIGHT.map((v) => (
            <Quick key={v} value={v} />
          ))}
        </div>
      </div>

      {/* bottom row */}
      <div className="mt-1.5 flex gap-1.5">
        {onFinish ? (
          <button
            onClick={onMiss}
            disabled={disabled}
            className="flex-1 rounded-xl border border-[var(--color-border-strong)] bg-[var(--color-surface-2)] py-3 text-2xl font-black transition-all active:scale-95 disabled:opacity-40"
          >
            {t('game.miss')}
          </button>
        ) : (
          QUICK_BOTTOM.map((v) => (
            <button
              key={v}
              onClick={() => onQuickScore(v)}
              disabled={disabled}
              className="flex-1 rounded-xl bg-[var(--color-surface-2)] py-3 text-2xl font-black transition-all active:scale-95 disabled:opacity-40"
            >
              {v}
            </button>
          ))
        )}
        {canBust && (
          <button
            onClick={onBust}
            disabled={disabled}
            className="flex-[1.2] rounded-xl border-2 border-[var(--color-accent)] bg-[var(--color-accent-soft)] py-3 text-2xl font-black text-[var(--color-accent-hover)] transition-all active:scale-95 disabled:opacity-40"
          >
            {t('game.bust')}
          </button>
        )}
      </div>

      {/* validate (buffer = score thrown) */}
      <button
        onClick={onCommit}
        disabled={disabled || !hasInput}
        className="mt-1.5 w-full rounded-2xl bg-white py-4 text-3xl font-black text-black transition-all active:scale-[0.99] disabled:opacity-30"
      >
        {t('game.validate').toUpperCase()}
      </button>
    </div>
  );
}

function PlainKey({
  label,
  onClick,
  disabled,
  className,
}: {
  label: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'flex items-center justify-center rounded-xl bg-[var(--color-surface-2)] text-3xl font-bold transition-all active:scale-95 active:bg-[var(--color-surface-3)] disabled:opacity-40',
        className,
      )}
    >
      {label}
    </button>
  );
}

/** A finish-capable digit key: tap types the digit, long-press closes the leg. */
function FinishKey({
  digit,
  disabled,
  onDigit,
  onFinishWith,
}: {
  digit: string;
  disabled?: boolean;
  onDigit: (d: string) => void;
  onFinishWith: (darts: number) => void;
}) {
  const handlers = useLongPress(() => onFinishWith(Number(digit)), {
    ms: 420,
    onClick: () => onDigit(digit),
    disabled,
  });
  return (
    <button
      {...handlers}
      disabled={disabled}
      className={cn(
        KEY_H,
        'relative flex items-center justify-center rounded-xl bg-[var(--color-success)] text-3xl font-black text-white transition-all active:scale-95 disabled:opacity-40',
      )}
    >
      {digit}
      <span className="absolute bottom-1 text-xs font-semibold uppercase opacity-80">
        <FinishHoldLabel />
      </span>
    </button>
  );
}

function FinishHoldLabel() {
  const { t } = useT();
  return <>{t('game.hold')}</>;
}
