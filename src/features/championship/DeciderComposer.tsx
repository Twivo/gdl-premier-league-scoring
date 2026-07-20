import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import type { EncounterRecord } from '@/data/types';
import { composeDecider } from '@/store/encounterService';
import { deciderPairAllowed } from '@/domain/championship/encounter';
import { useT } from '@/store/LangContext';
import type { Side } from '@/domain/championship/types';

/**
 * Compose the decisive doubles, played only when the regular fixtures end level
 * (e.g. 5-5). Each side must field a pair of two distinct players that has not
 * already played together in this encounter's doubles (hard-blocked).
 */
export function DeciderComposer({
  encounter,
  onComposed,
}: {
  encounter: EncounterRecord;
  onComposed: (updated: EncounterRecord) => void;
}) {
  const { t } = useT();
  const { teams } = encounter.plan;
  const [aPair, setAPair] = useState<string[]>(['', '']);
  const [bPair, setBPair] = useState<string[]>(['', '']);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pairs: Record<Side, string[]> = { A: aPair, B: bPair };
  const setPair = (side: Side, slot: number, value: string) => {
    setError(null);
    const upd = (p: string[]) => p.map((v, i) => (i === slot ? value : v));
    if (side === 'A') setAPair(upd);
    else setBPair(upd);
  };

  // Per-side message: only once both slots are filled (incomplete → no error).
  const sideError = (side: Side): string | null => {
    const p = pairs[side];
    if (!p[0] || !p[1]) return null;
    if (p[0] === p[1]) return t('champ.deciderSamePlayer');
    if (!deciderPairAllowed(encounter.plan, side, p))
      return t('champ.deciderPairUsed');
    return null;
  };

  const ready =
    deciderPairAllowed(encounter.plan, 'A', aPair) &&
    deciderPairAllowed(encounter.plan, 'B', bPair);

  const validate = async () => {
    if (!ready || busy) return;
    setBusy(true);
    try {
      const updated = await composeDecider(encounter, aPair, bPair);
      onComposed(updated);
    } catch (e) {
      setBusy(false);
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <div className="mx-auto flex min-h-0 w-full max-w-2xl flex-1 flex-col overflow-y-auto px-4 py-4">
      <div className="mb-1 flex flex-wrap items-center gap-2">
        <span className="rounded-md bg-[var(--color-accent-soft)] px-2 py-0.5 text-xs font-black uppercase tracking-wide text-[var(--color-accent)]">
          {t('champ.deciderTag')}
        </span>
        <h2 className="text-xl font-black">{t('champ.composeDecider')}</h2>
      </div>
      <p className="mb-1 text-sm text-[var(--color-text-dim)]">
        {teams.A.name} {t('common.vs')} {teams.B.name}
      </p>
      <p className="mb-4 text-sm text-[var(--color-text-dim)]">
        {t('champ.deciderHint')}
      </p>

      <div className="grid grid-cols-2 gap-3">
        {(['A', 'B'] as Side[]).map((side) => (
          <PairPicker
            key={side}
            label={teams[side].name}
            players={teams[side].players}
            values={pairs[side]}
            error={sideError(side)}
            onChange={(slot, v) => setPair(side, slot, v)}
          />
        ))}
      </div>

      {error && (
        <p className="mt-3 text-sm font-semibold text-[var(--color-warning)]">
          {error}
        </p>
      )}

      <Button
        variant="accent"
        size="xl"
        fullWidth
        className="mt-5"
        disabled={!ready || busy}
        onClick={validate}
      >
        {busy ? t('champ.starting') : t('champ.startDecider')}
      </Button>
    </div>
  );
}

function PairPicker({
  label,
  players,
  values,
  error,
  onChange,
}: {
  label: string;
  players: { id: string; name: string }[];
  values: string[];
  error: string | null;
  onChange: (slot: number, value: string) => void;
}) {
  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3">
      <div className="mb-1 truncate text-xs font-semibold text-[var(--color-text-dim)]">
        {label}
      </div>
      <div className="flex flex-col gap-1.5">
        {values.map((v, slot) => (
          <select
            key={slot}
            value={v}
            onChange={(e) => onChange(slot, e.target.value)}
            className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)] px-2 py-2 text-sm outline-none focus:border-[var(--color-accent)]"
          >
            <option value="">—</option>
            {players.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        ))}
      </div>
      {error && (
        <p className="mt-1.5 text-xs font-semibold text-[var(--color-warning)]">
          {error}
        </p>
      )}
    </div>
  );
}
