import { useEffect, useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/cn';
import { getRepository } from '@/data';
import { useT } from '@/store/LangContext';
import { fixtureMatchConfig, persistEncounter } from '@/store/encounterService';
import { loadMatch, persistMatch } from '@/store/matchService';
import type { EncounterRecord } from '@/data/types';
import type {
  EncounterSettings,
  Fixture,
  Side,
} from '@/domain/championship/types';

/**
 * Configure the encounter at any time: edit not-yet-started matches (players,
 * order) and settings. Started/finished matches are locked. Saves immediately.
 */
export function EncounterConfig({
  encounter,
  onClose,
  onUpdated,
}: {
  encounter: EncounterRecord;
  onClose: () => void;
  onUpdated: (e: EncounterRecord) => void;
}) {
  const { t } = useT();
  const { teams } = encounter.plan;
  const [settings, setSettings] = useState<EncounterSettings>({
    starterSide: 'A',
    ...encounter.plan.settings,
  });
  const [fixtures, setFixtures] = useState<Fixture[]>(encounter.plan.fixtures);
  const [busy, setBusy] = useState(false);
  // Fixture indices whose linked match has no recorded visit yet (0 events).
  const [zeroEventIdx, setZeroEventIdx] = useState<Set<number>>(new Set());

  useEffect(() => {
    let alive = true;
    void getRepository()
      .listMatches({ encounterId: encounter.id })
      .then((ms) => {
        if (!alive) return;
        const s = new Set<number>();
        for (const m of ms)
          if ((m.events?.length ?? 0) === 0 && m.fixtureIndex != null)
            s.add(m.fixtureIndex);
        setZeroEventIdx(s);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [encounter.id]);

  // Players stay editable until a visit is recorded: a fixture that isn't
  // launched, or is launched with no darts thrown yet. Reordering the play
  // sequence stays limited to fixtures that haven't been launched at all.
  const canEditPlayers = (f: Fixture) =>
    f.winner === null && (f.matchId === null || zeroEventIdx.has(f.index));
  const canReorder = (f: Fixture) => f.matchId === null && f.winner === null;
  const per = (f: Fixture) => (f.kind === 'DOUBLE' ? 2 : 1);

  const setSlot = (index: number, side: 'a' | 'b', slot: number, value: string) => {
    setFixtures((prev) =>
      prev.map((f) => {
        if (f.index !== index) return f;
        const key = side === 'a' ? 'aPlayerIds' : 'bPlayerIds';
        const arr = [...f[key]];
        arr[slot] = value;
        return { ...f, [key]: arr };
      }),
    );
  };

  /**
   * Reorder the PLAY sequence: move a not-yet-played fixture up or down by
   * swapping it with the adjacent one. Any single or double can go anywhere —
   * fully flexible order — while played / in-progress matches stay locked in
   * place (a fixture keeps its identity, only its position in the array moves).
   */
  const move = (pos: number, dir: -1 | 1) => {
    setFixtures((prev) => {
      const destination = pos + dir;
      const a = prev[pos];
      const b = prev[destination];
      if (!a || !b || !canReorder(a) || !canReorder(b)) return prev;
      const next = [...prev];
      next[pos] = b;
      next[destination] = a;
      return next;
    });
  };

  const save = async () => {
    setBusy(true);
    const updated: EncounterRecord = {
      ...encounter,
      plan: { ...encounter.plan, settings, fixtures },
    };
    await persistEncounter(updated);
    // Keep linked data in sync: rebuild the config of launched-but-unscored
    // fixtures so edited participants apply to the actual match too.
    for (const f of updated.plan.fixtures) {
      if (f.matchId && zeroEventIdx.has(f.index)) {
        const m = await loadMatch(f.matchId);
        if (m && m.events.length === 0) {
          const config = fixtureMatchConfig(updated, f);
          await persistMatch({
            ...m,
            config,
            mode: config.mode,
            variant: config.variant,
          });
        }
      }
    }
    onUpdated(updated);
    setBusy(false);
    onClose();
  };

  return (
    <Modal open onClose={onClose} className="max-w-2xl" title={t('champ.configureTitle')}>
      <div className="max-h-[78vh] overflow-y-auto pr-1">
        {/* settings */}
        <div className="mb-4 rounded-xl border border-[var(--color-border)] p-3">
          <Row label={t('champ.legsToWin')}>
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map((n) => (
                <Chip
                  key={n}
                  active={settings.legsToWin === n}
                  onClick={() => setSettings((s) => ({ ...s, legsToWin: n }))}
                >
                  {n}
                </Chip>
              ))}
            </div>
          </Row>
          <Row label={t('champ.starts')}>
            <div className="flex gap-1">
              {(['A', 'B'] as Side[]).map((side) => (
                <Chip
                  key={side}
                  active={(settings.starterSide ?? 'A') === side}
                  onClick={() => setSettings((s) => ({ ...s, starterSide: side }))}
                >
                  {side === 'A' ? teams.A.name : teams.B.name}
                </Chip>
              ))}
            </div>
          </Row>
          <Row label={t('champ.startMode')}>
            <div className="flex gap-1">
              {(['BULL', 'MANUAL'] as const).map((p) => (
                <Chip
                  key={p}
                  active={settings.startingPolicy === p}
                  onClick={() => setSettings((s) => ({ ...s, startingPolicy: p }))}
                >
                  {p === 'BULL' ? t('champ.bull') : t('champ.fixed')}
                </Chip>
              ))}
              <Chip
                active={settings.alternateStarter}
                onClick={() =>
                  setSettings((s) => ({ ...s, alternateStarter: !s.alternateStarter }))
                }
              >
                {t('champ.alternate')}
              </Chip>
            </div>
          </Row>
          <p className="mt-1 text-xs text-[var(--color-text-mute)]">
            {t('champ.notStartedApply')}
          </p>
        </div>

        {/* fixtures */}
        <div className="flex flex-col gap-2">
          {fixtures.map((f, pos) => {
            const editP = canEditPlayers(f);
            const reord = canReorder(f);
            const prev = fixtures[pos - 1];
            const nextF = fixtures[pos + 1];
            const canUp = reord && !!prev && canReorder(prev);
            const canDown = reord && !!nextF && canReorder(nextF);
            const lockLabel = f.winner ? t('champ.played') : !editP ? t('common.inProgress') : null;
            return (
              <div
                key={f.index}
                className={cn(
                  'rounded-xl border p-2.5',
                  editP
                    ? 'border-[var(--color-border)] bg-[var(--color-surface)]'
                    : 'border-[var(--color-border)] bg-[var(--color-surface-2)] opacity-60',
                )}
              >
                <div className="mb-1.5 flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wide text-[var(--color-accent)]">
                    {t('common.match')} {pos + 1} · {f.kind === 'DOUBLE' ? t('champ.double') : t('champ.single')}
                    {lockLabel && (
                      <span className="ml-2 text-[var(--color-text-mute)]">
                        🔒 {lockLabel}
                      </span>
                    )}
                  </span>
                  {reord && (
                    <span className="flex gap-1">
                      <MiniBtn disabled={!canUp} onClick={() => move(pos, -1)}>
                        ▲
                      </MiniBtn>
                      <MiniBtn disabled={!canDown} onClick={() => move(pos, 1)}>
                        ▼
                      </MiniBtn>
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Slots
                    disabled={!editP}
                    players={teams.A.players}
                    values={f.aPlayerIds}
                    count={per(f)}
                    onChange={(slot, v) => setSlot(f.index, 'a', slot, v)}
                  />
                  <Slots
                    disabled={!editP}
                    players={teams.B.players}
                    values={f.bPlayerIds}
                    count={per(f)}
                    onChange={(slot, v) => setSlot(f.index, 'b', slot, v)}
                  />
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-4 flex gap-2">
          <Button variant="ghost" size="lg" fullWidth onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button
            variant="accent"
            size="lg"
            fullWidth
            disabled={busy}
            onClick={save}
          >
            {busy ? t('common.saving') : t('common.save')}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-2 flex items-center justify-between gap-2">
      <span className="text-sm text-[var(--color-text-dim)]">{label}</span>
      {children}
    </div>
  );
}
function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'rounded-lg border px-3 py-1.5 text-sm font-semibold',
        active
          ? 'border-[var(--color-accent)] bg-[var(--color-accent)] text-white'
          : 'border-[var(--color-border)] text-[var(--color-text-dim)]',
      )}
    >
      {children}
    </button>
  );
}
function MiniBtn({
  disabled,
  onClick,
  children,
}: {
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      disabled={disabled}
      onClick={onClick}
      className="rounded-md border border-[var(--color-border)] px-2 py-0.5 text-xs disabled:opacity-25"
    >
      {children}
    </button>
  );
}
function Slots({
  disabled,
  players,
  values,
  count,
  onChange,
}: {
  disabled: boolean;
  players: { id: string; name: string }[];
  values: string[];
  count: number;
  onChange: (slot: number, value: string) => void;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      {Array.from({ length: count }, (_, slot) => (
        <select
          key={slot}
          disabled={disabled}
          value={values[slot] ?? ''}
          onChange={(e) => onChange(slot, e.target.value)}
          className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)] px-2 py-1.5 text-sm outline-none focus:border-[var(--color-accent)] disabled:opacity-60"
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
  );
}
