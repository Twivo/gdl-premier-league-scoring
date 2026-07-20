import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { getRepository } from '@/data';
import {
  aggregatePlayerStats,
  type PlayerSeasonStats,
} from '@/domain/playerStats';
import { Confetti } from '@/features/stats/Confetti';
import { useT } from '@/store/LangContext';
import type { EncounterRecord } from '@/data/types';

/** Final encounter screen: winner, team + individual stats, MVP and records. */
export function EncounterFinal({
  encounter,
  onFinish,
}: {
  encounter: EncounterRecord;
  onFinish: () => void;
}) {
  const { t } = useT();
  const repo = useMemo(() => getRepository(), []);
  const [stats, setStats] = useState<PlayerSeasonStats[]>([]);

  useEffect(() => {
    void repo
      .listMatches({ encounterId: encounter.id })
      .then((matches) =>
        setStats(
          aggregatePlayerStats(
            matches.map((m) => ({ config: m.config, events: m.events })),
          ),
        ),
      )
      .catch(() => setStats([]));
  }, [repo, encounter.id]);

  const { teams } = encounter.plan;
  const nameOf = (id: string) =>
    [...teams.A.players, ...teams.B.players].find((p) => p.id === id)?.name ??
    '???';
  const sideOf = (id: string): 'A' | 'B' =>
    teams.A.players.some((p) => p.id === id) ? 'A' : 'B';

  const winnerName =
    encounter.winner === 'B' ? teams.B.name : teams.A.name;

  const best = (pick: (s: PlayerSeasonStats) => number) =>
    stats.reduce<PlayerSeasonStats | null>(
      (b, s) => (!b || pick(s) > pick(b) ? s : b),
      null,
    );
  const mvp = best((s) => s.average3);
  const bestCheckout = best((s) => s.bestCheckout);
  const bestFirst9 = best((s) => s.first9Average);
  const most180 = best((s) => s.count180);

  const teamAvg = (side: 'A' | 'B') => {
    const rows = stats.filter((s) => sideOf(s.playerId) === side);
    const scored = rows.reduce((t, r) => t + r.totalScored, 0);
    const darts = rows.reduce((t, r) => t + r.totalDarts, 0);
    return darts ? (scored / darts) * 3 : 0;
  };

  return (
    <div className="relative mx-auto min-h-0 w-full max-w-3xl flex-1 overflow-y-auto px-4 py-6">
      <Confetti />
      <div className="relative z-50">
        <div className="mb-5 text-center">
          <div className="text-5xl">🏆</div>
          <h1 className="text-3xl font-black">{winnerName}</h1>
          <p className="text-[var(--color-text-dim)]">
            {teams.A.name} {encounter.scoreA} — {encounter.scoreB} {teams.B.name}
          </p>
        </div>

        {/* team stats */}
        <div className="mb-5 grid grid-cols-2 gap-2">
          {(['A', 'B'] as const).map((side) => (
            <div
              key={side}
              className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3 text-center"
            >
              <div className="truncate font-bold">{teams[side].name}</div>
              <div className="text-3xl font-black tnum">
                {side === 'A' ? encounter.scoreA : encounter.scoreB}
              </div>
              <div className="text-xs text-[var(--color-text-dim)]">
                {t('champ.teamAvg').replace('{value}', teamAvg(side).toFixed(1))}
              </div>
            </div>
          ))}
        </div>

        {/* records */}
        <div className="mb-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Record label={t('award.mvp')} who={mvp ? nameOf(mvp.playerId) : '—'} value={mvp ? mvp.average3.toFixed(1) : '—'} />
          <Record label={t('award.bestCheckout')} who={bestCheckout ? nameOf(bestCheckout.playerId) : '—'} value={bestCheckout ? `${bestCheckout.bestCheckout}` : '—'} />
          <Record label={t('award.bestFirst9')} who={bestFirst9 ? nameOf(bestFirst9.playerId) : '—'} value={bestFirst9 ? bestFirst9.first9Average.toFixed(1) : '—'} />
          <Record label={t('award.most180s')} who={most180 ? nameOf(most180.playerId) : '—'} value={most180 ? `${most180.count180}` : '—'} />
        </div>

        {/* individual stats */}
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-[var(--color-text-dim)]">
          {t('champ.individualStats')}
        </h2>
        <div className="overflow-x-auto rounded-xl border border-[var(--color-border)]">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[var(--color-surface-2)]">
                {[
                  t('stats.row.player'),
                  t('stats.row.avg'),
                  t('stats.row.first9'),
                  t('stats.row.bestCheckout'),
                  t('stats.row.180'),
                  t('stats.row.140'),
                  t('stats.row.100'),
                  t('stats.row.legs'),
                  t('stats.row.darts'),
                ].map((h) => (
                  <th key={h} className="px-2.5 py-2 text-right font-semibold first:text-left">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {stats.map((s, i) => (
                <tr key={s.playerId} className={i % 2 ? 'bg-[var(--color-surface)]' : ''}>
                  <td className="whitespace-nowrap px-2.5 py-2 font-semibold">{nameOf(s.playerId)}</td>
                  <td className="px-2.5 py-2 text-right tnum">{s.average3.toFixed(1)}</td>
                  <td className="px-2.5 py-2 text-right tnum">{s.first9Average.toFixed(1)}</td>
                  <td className="px-2.5 py-2 text-right tnum">{s.bestCheckout}</td>
                  <td className="px-2.5 py-2 text-right tnum">{s.count180}</td>
                  <td className="px-2.5 py-2 text-right tnum">{s.count140plus}</td>
                  <td className="px-2.5 py-2 text-right tnum">{s.count100plus}</td>
                  <td className="px-2.5 py-2 text-right tnum">{s.legsWon}</td>
                  <td className="px-2.5 py-2 text-right tnum">{s.totalDarts}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <Button variant="accent" size="xl" fullWidth className="mt-6" onClick={onFinish}>
          {t('champ.finishEncounter')}
        </Button>
      </div>
    </div>
  );
}

function Record({ label, who, value }: { label: string; who: string; value: string }) {
  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3 text-center">
      <div className="text-[10px] uppercase tracking-wide text-[var(--color-text-dim)]">{label}</div>
      <div className="text-lg font-black text-[var(--color-accent)]">{value}</div>
      <div className="truncate text-xs">{who}</div>
    </div>
  );
}
