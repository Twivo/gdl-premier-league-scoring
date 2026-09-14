import { useEffect, useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { useGame } from '@/store/GameContext';
import { useT } from '@/store/LangContext';
import { validateVisitInput, type VisitErrorCode } from '@/domain/rules/validation';
import { minDartsToCheckout } from '@/domain/rules/checkout';
import { cn } from '@/lib/cn';
import { PlainKey } from './Keypad';

const DIGIT_ROWS = [
  ['1', '2', '3'],
  ['4', '5', '6'],
  ['7', '8', '9'],
];

export function EditVisitModal({
  eventId,
  onClose,
}: {
  eventId: string | null;
  onClose: () => void;
}) {
  const { events, state, editVisit } = useGame();
  const { t } = useT();
  const event = events.find((e) => e.id === eventId) ?? null;
  const isVisit = event?.type === 'VISIT';

  // Remaining the participant had BEFORE this visit (from the engine), so a
  // correction is validated with exactly the same rules as a normal live entry.
  const resolved = state.legs
    .flatMap((l) => l.visits)
    .find((v) => v.event.id === eventId);
  const remainingBefore = resolved?.remainingBefore ?? state.config.variant;

  const [value, setValue] = useState('');
  const [darts, setDarts] = useState(3);

  useEffect(() => {
    if (event?.type === 'VISIT') {
      setValue(String(event.scored));
      setDarts(event.darts);
    } else {
      setValue('');
    }
  }, [event]);

  if (!event) return null;

  const parsed = value === '' ? NaN : parseInt(value, 10);
  const validation = Number.isNaN(parsed)
    ? null
    : validateVisitInput(remainingBefore, parsed);
  const isCheckout = !!validation?.ok && validation.isCheckout;
  const minDarts = minDartsToCheckout(remainingBefore) ?? 1;
  const dartsOk = !isCheckout || darts >= minDarts;
  const canSave = !!validation?.ok && dartsOk;
  const error =
    validation && !validation.ok && validation.code
      ? visitErrorText(t, validation.code, remainingBefore)
      : null;

  const save = () => {
    if (!canSave) return;
    // Non-checkout visits always use 3 darts (as in normal entry); a checkout
    // uses the chosen 1/2/3, never fewer than the minimum required.
    editVisit(event.id, parsed, isCheckout ? darts : 3);
    onClose();
  };

  const appendDigit = (d: string) => setValue((prev) => (prev + d).slice(0, 3));
  const backspace = () => setValue((prev) => prev.slice(0, -1));

  return (
    <Modal
      open={eventId !== null}
      onClose={onClose}
      title={isVisit ? t('editVisit.title') : t('editVisit.specialTitle')}
    >
      {isVisit ? (
        <>
          <p className="mb-2 text-sm text-[var(--color-text-dim)]">
            {t('editVisit.help')}
          </p>
          <div
            className={cn(
              'flex h-16 w-full items-center justify-center rounded-xl border bg-[var(--color-surface-2)] px-4 text-4xl font-black tabular-nums tracking-wider',
              error
                ? 'border-[var(--color-accent)]'
                : 'border-[var(--color-border)]',
            )}
          >
            {value ? (
              value
            ) : (
              <span className="text-lg font-semibold text-[var(--color-text-mute)]">
                {t('game.typeScore')}
              </span>
            )}
          </div>
          <div className="mb-3 mt-1 h-5 text-center text-sm font-semibold text-[var(--color-accent)]">
            {error ?? ''}
          </div>

          <div className="mb-4 grid grid-cols-3 gap-1.5">
            {DIGIT_ROWS.flat().map((d) => (
              <PlainKey key={d} label={d} onClick={() => appendDigit(d)} className="h-14" />
            ))}
            <PlainKey label="0" onClick={() => appendDigit('0')} className="h-14" />
            <PlainKey
              label="⌫"
              onClick={backspace}
              className="h-14 text-[var(--color-text-dim)]"
            />
            <PlainKey
              label="✓"
              onClick={save}
              disabled={!canSave}
              className="h-14 bg-[var(--color-accent)] text-white active:bg-[var(--color-accent-hover)]"
            />
          </div>

          {isCheckout && (
            <div className="mb-4">
              <p className="mb-1.5 text-xs text-[var(--color-text-dim)]">
                {t('editVisit.dartsUsed')}
              </p>
              <div className="flex gap-2">
                {[1, 2, 3].map((d) => (
                  <button
                    key={d}
                    disabled={d < minDarts}
                    onClick={() => setDarts(d)}
                    className={cn(
                      'flex-1 rounded-lg border py-2 text-lg font-bold transition-colors disabled:opacity-30',
                      darts === d
                        ? 'border-[var(--color-accent)] bg-[var(--color-accent)] text-white'
                        : 'border-[var(--color-border)] text-[var(--color-text-dim)]',
                    )}
                  >
                    {d}
                  </button>
                ))}
              </div>
            </div>
          )}
        </>
      ) : (
        <p className="mb-4 text-[var(--color-text-dim)]">
          {t('editVisit.notEditable').replace('{type}', event.type)}
        </p>
      )}

      <div className="flex gap-2">
        {isVisit && (
          <Button
            variant="primary"
            size="lg"
            fullWidth
            disabled={!canSave}
            onClick={save}
          >
            {t('common.save')}
          </Button>
        )}
      </div>
    </Modal>
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
