import { useT } from '@/store/LangContext';

/** Full-screen centered loading placeholder. */
export function Loading({ label }: { label?: string }) {
  const { t } = useT();
  return (
    <div className="flex min-h-screen items-center justify-center text-[var(--color-text-dim)]">
      {label ?? t('common.loading')}
    </div>
  );
}
