import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/cn';
import { getRepository } from '@/data';
import type { EncounterRecord } from '@/data/types';
import { useT } from '@/store/LangContext';
import { useMyTeam } from './TeamLayout';

type Row = {
  encounter: EncounterRecord;
  opponentName: string;
  myScore: number;
  oppScore: number;
  outcome: 'W' | 'L' | '…';
};

/** All championship encounters the captain's team took part in (any season). */
export function TeamHistory() {
  const { team } = useMyTeam();
  const navigate = useNavigate();
  const repo = useMemo(() => getRepository(), []);
  const { t } = useT();

  const [encounters, setEncounters] = useState<EncounterRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    void repo
      .listEncounters()
      .then((list) => alive && setEncounters(list))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [repo]);

  const rows = useMemo<Row[]>(() => {
    return encounters
      .filter((e) => e.teamAId === team.id || e.teamBId === team.id)
      .map((e) => {
        const iAmA = e.teamAId === team.id;
        const myScore = iAmA ? e.scoreA : e.scoreB;
        const oppScore = iAmA ? e.scoreB : e.scoreA;
        const opponentName = iAmA ? e.plan.teams.B.name : e.plan.teams.A.name;
        const mySide = iAmA ? 'A' : 'B';
        const outcome: Row['outcome'] =
          e.status === 'IN_PROGRESS'
            ? '…'
            : e.winner === mySide
              ? 'W'
              : 'L';
        return { encounter: e, opponentName, myScore, oppScore, outcome };
      });
  }, [encounters, team.id]);

  const record = useMemo(() => {
    let w = 0,
      l = 0;
    for (const r of rows) {
      if (r.outcome === 'W') w += 1;
      else if (r.outcome === 'L') l += 1;
    }
    return { w, l };
  }, [rows]);

  if (loading) {
    return (
      <p className="py-8 text-center text-[var(--color-text-dim)]">
        {t('common.loading')}
      </p>
    );
  }

  if (rows.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-[var(--color-border)] p-8 text-center text-[var(--color-text-dim)]">
        {t('team.noEncounters')}
      </p>
    );
  }

  return (
    <div>
      <div className="mb-4 grid grid-cols-3 gap-2">
        <Metric label={t('common.encounters')} value={`${rows.length}`} />
        <Metric label={t('admin.winShort')} value={`${record.w}`} />
        <Metric label={t('admin.lossShort')} value={`${record.l}`} />
      </div>

      <ul className="flex flex-col gap-1.5">
        {rows.map((r) => (
          <li key={r.encounter.id}>
            <button
              onClick={() => navigate(`/championship/${r.encounter.id}`)}
              className="flex w-full items-center gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2.5 text-left transition-colors hover:border-[var(--color-accent)]"
            >
              <span
                className={cn(
                  'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-sm font-black',
                  r.outcome === 'W'
                    ? 'bg-[var(--color-success-dim)] text-[var(--color-success)]'
                    : r.outcome === 'L'
                      ? 'bg-[var(--color-accent-soft)] text-[var(--color-accent)]'
                      : 'bg-[var(--color-surface-2)] text-[var(--color-text-dim)]',
                )}
              >
                {r.outcome === 'W'
                  ? t('admin.winShort')
                  : r.outcome === 'L'
                    ? t('admin.lossShort')
                    : '…'}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold">
                  {t('common.vs')} {r.opponentName}
                </span>
                <span className="text-xs text-[var(--color-text-dim)]">
                  {r.encounter.createdAt
                    ? new Date(r.encounter.createdAt).toLocaleDateString()
                    : '—'}
                  {r.outcome === '…' ? ` · ${t('common.inProgress')}` : ''}
                </span>
              </span>
              <span className="shrink-0 text-lg font-black tnum">
                {r.myScore}–{r.oppScore}
              </span>
              <span className="text-[var(--color-text-dim)]">›</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-[var(--color-surface)] p-3 text-center">
      <div className="text-[11px] uppercase tracking-wide text-[var(--color-text-dim)]">
        {label}
      </div>
      <div className="text-2xl font-black tnum">{value}</div>
    </div>
  );
}
