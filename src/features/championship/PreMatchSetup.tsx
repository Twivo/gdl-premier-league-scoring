import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/cn';
import { useT } from '@/store/LangContext';
import type { EncounterRecord } from '@/data/types';
import type { Fixture, Side } from '@/domain/championship/types';

/**
 * Shown before every match: pick the players (settable/changeable at any time,
 * so a match can always be started even if it wasn't composed beforehand), the
 * throwing order (doubles), and who won the bull-up (which side throws first).
 */
export function PreMatchSetup({
  encounter,
  fixture,
  onConfirm,
  onBack,
}: {
  encounter: EncounterRecord;
  fixture: Fixture;
  onConfirm: (v: { aOrder: string[]; bOrder: string[]; starter: Side }) => void;
  onBack: () => void;
}) {
  const { t } = useT();
  const { teams } = encounter.plan;
  const isDouble = fixture.kind === 'DOUBLE';
  const isDeciderMatch = fixture.index >= encounter.plan.fixtures.length;
  const per = isDouble ? 2 : 1;
  const pad = (ids: string[]) =>
    Array.from({ length: per }, (_, i) => ids[i] ?? '');
  const [aOrder, setAOrder] = useState<string[]>(pad(fixture.aPlayerIds));
  const [bOrder, setBOrder] = useState<string[]>(pad(fixture.bPlayerIds));
  const [starter, setStarter] = useState<Side | null>(null);

  const nameOf = (id: string) =>
    [...teams.A.players, ...teams.B.players].find((p) => p.id === id)?.name ??
    '—';
  const setSlot = (side: Side, slot: number, value: string) => {
    const [order, set] = side === 'A' ? [aOrder, setAOrder] : [bOrder, setBOrder];
    set(order.map((v, i) => (i === slot ? value : v)));
  };
  const sideOk = (order: string[]) =>
    order.every(Boolean) && new Set(order).size === per;
  const complete = sideOk(aOrder) && sideOk(bOrder);

  return (
    <div className="mx-auto flex min-h-0 w-full max-w-lg flex-1 flex-col overflow-y-auto px-4 py-5">
      {encounter.currentIndex > 0 && (
        <button
          onClick={onBack}
          className="mb-1 self-start rounded-lg px-2 py-1 text-sm text-[var(--color-text-dim)] hover:bg-[var(--color-surface-2)]"
        >
          {t('champ.previousMatch')}
        </button>
      )}
      <div className="mb-4 text-center">
        <div className="text-xs uppercase tracking-wide text-[var(--color-text-dim)]">
          {isDeciderMatch ? t('champ.decider') : `${t('common.match')} ${fixture.index + 1}`}
          {' · '}
          {t(isDouble ? 'game.doubles' : 'game.singles')}
        </div>
        <h2 className="text-xl font-black">{t('champ.bullUp')}</h2>
      </div>

      {/* players (settable / changeable here at any time) */}
      <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-[var(--color-text-dim)]">
        {isDouble ? t('champ.playersOrder') : t('champ.players')}
      </h3>
      <div className="mb-4 grid grid-cols-2 gap-3">
        {(['A', 'B'] as Side[]).map((side) => (
          <SidePicker
            key={side}
            team={side === 'A' ? teams.A.name : teams.B.name}
            players={side === 'A' ? teams.A.players : teams.B.players}
            values={side === 'A' ? aOrder : bOrder}
            count={per}
            onChange={(slot, v) => setSlot(side, slot, v)}
          />
        ))}
      </div>

      <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-[var(--color-text-dim)]">
        {t('champ.whoWonBull')}
      </h3>
      <div className="grid grid-cols-2 gap-3">
        {(['A', 'B'] as Side[]).map((side) => {
          const order = side === 'A' ? aOrder : bOrder;
          const teamName = side === 'A' ? teams.A.name : teams.B.name;
          return (
            <button
              key={side}
              onClick={() => setStarter(side)}
              className={cn(
                'rounded-xl border-2 px-4 py-4 text-center transition-all active:scale-[0.98]',
                starter === side
                  ? 'border-[var(--color-accent)] bg-[var(--color-accent)] text-white'
                  : 'border-[var(--color-border)] bg-[var(--color-surface)]',
              )}
            >
              <div className="text-xs opacity-80">{teamName}</div>
              <div className="font-black">
                {order.filter(Boolean).map(nameOf).join(' & ') || '—'}
              </div>
            </button>
          );
        })}
      </div>

      {!complete && (
        <p className="mt-3 text-center text-xs text-[var(--color-warning)]">
          {t('champ.selectPlayersToStart').replace(
            '{text}',
            t(isDouble ? 'champ.twoPlayers' : 'champ.onePlayer'),
          )}
        </p>
      )}

      <Button
        variant="accent"
        size="xl"
        fullWidth
        className="mt-4"
        disabled={!complete || !starter}
        onClick={() => starter && onConfirm({ aOrder, bOrder, starter })}
      >
        {t('champ.startMatch')}
      </Button>
    </div>
  );
}

function SidePicker({
  team,
  players,
  values,
  count,
  onChange,
}: {
  team: string;
  players: { id: string; name: string }[];
  values: string[];
  count: number;
  onChange: (slot: number, value: string) => void;
}) {
  const { t } = useT();
  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3">
      <div className="mb-1.5 truncate text-xs font-semibold text-[var(--color-text-dim)]">
        {team}
      </div>
      <div className="flex flex-col gap-1.5">
        {Array.from({ length: count }, (_, slot) => (
          <select
            key={slot}
            value={values[slot] ?? ''}
            onChange={(e) => onChange(slot, e.target.value)}
            className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)] px-2 py-2 text-sm outline-none focus:border-[var(--color-accent)]"
          >
            <option value="">
              {count > 1
                ? t('setup.playerSlot').replace('{number}', String(slot + 1))
                : t('champ.selectPlayer')}
            </option>
            {players.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        ))}
      </div>
    </div>
  );
}
