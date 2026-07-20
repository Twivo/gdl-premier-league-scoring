import { useCallback, useRef } from 'react';

/**
 * Long-press detection for touch and mouse. Fires `onLongPress` after `ms`,
 * and `onClick` for a short tap (when no long-press fired and not disabled).
 * Returns props to spread on the interactive element.
 */
export function useLongPress(
  onLongPress: () => void,
  options: { ms?: number; onClick?: () => void; disabled?: boolean } = {},
) {
  const { ms = 450, onClick, disabled } = options;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fired = useRef(false);

  const start = useCallback(() => {
    if (disabled) return;
    fired.current = false;
    timer.current = setTimeout(() => {
      fired.current = true;
      onLongPress();
    }, ms);
  }, [disabled, ms, onLongPress]);

  const cancel = useCallback(
    (runClick: boolean) => {
      if (timer.current) {
        clearTimeout(timer.current);
        timer.current = null;
      }
      if (runClick && !fired.current && !disabled) onClick?.();
    },
    [disabled, onClick],
  );

  return {
    onPointerDown: start,
    onPointerUp: () => cancel(true),
    onPointerLeave: () => cancel(false),
    onPointerCancel: () => cancel(false),
  };
}
