import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { buildGameState } from '@/domain/engine';
import {
  aggregatePlayerStats,
  type PlayerSeasonStats,
} from '@/domain/playerStats';
import { participantDisplay } from '@/domain/presentation';
import { loadMatch } from '@/store/matchService';
import { useT } from '@/store/LangContext';
import type { EncounterRecord, MatchRecord } from '@/data/types';
import type { Fixture } from '@/domain/championship/types';

interface Col {
  key: string;
  labelKey: string;
  fmt: (s: PlayerSeasonStats) => string;
}
const COLS: Col[] = [
  { key: 'legs', labelKey: 'stats.row.legs', fmt: (s) => `${s.legsWon}` },
  { key: 'avg', labelKey: 'stats.row.avg', fmt: (s) => s.average3.toFixed(1) },
  { key: 'f9', labelKey: 'stats.row.first9', fmt: (s) => s.first9Average.toFixed(1) },
  { key: 'bco', labelKey: 'stats.row.bestCheckout', fmt: (s) => `${s.bestCheckout}` },
  { key: '180', labelKey: 'stats.row.180', fmt: (s) => `${s.count180}` },
  { key: '140', labelKey: 'stats.row.140', fmt: (s) => `${s.count140plus}` },
  { key: '100', labelKey: 'stats.row.100', fmt: (s) => `${s.count100plus}` },
  { key: 'darts', labelKey: 'stats.row.darts', fmt: (s) => `${s.totalDarts}` },
];

/** Mandatory recap shown after every championship match. */
export function MatchStatsScreen({
  fixture,
  onNext,
  onBack,
  isLast,
  toDecider,
}: {
  encounter: EncounterRecord;
  fixture: Fixture;
  onNext: () => void;
  onBack: () => void;
  isLast: boolean;
  /** True when the score is level (5-5): advancing opens the decisive doubles. */
  toDecider: boolean;
}) {
  const { t } = useT();
  const [match, setMatch] = useState<MatchRecord | null>(null);

  useEffect(() => {
    let alive = true;
    if (fixture.matchId)
      void loadMatch(fixture.matchId).then((m) => alive && setMatch(m));
    return () => {
      alive = false;
    };
  }, [fixture.matchId]);

  if (!match) {
    return (
      <div className="flex flex-1 items-center justify-center text-[var(--color-text-dim)]">
        {t('champ.loadingResult')}
      </div>
    );
  }

  const state = buildGameState(match.config, match.events);
  const stats = aggregatePlayerStats([
    { config: match.config, events: match.events },
  ]);
  const nameOf = (id: string) =>
    match.config.players.find((p) => p.id === id)?.name ?? '???';
  const winnerLabel = fixture.winner
    ? participantDisplay(match.config, fixture.winner)
    : '—';
  const legs = match.config.participants
    .map((p) => state.legsWon[p.id] ?? 0)
    .join('–');

  return (
    <div className="mx-auto flex min-h-0 w-full max-w-2xl flex-1 flex-col overflow-y-auto px-4 py-5">
      <div className="mb-4 text-center">
        <div className="text-xs uppercase tracking-wide text-[var(--color-text-dim)]">
          {t('common.match')} {fixture.index + 1} · {t(fixture.kind === 'DOUBLE' ? 'game.doubles' : 'game.singles')} {t('champ.result')}
        </div>
        <h2 className="text-2xl font-black">
          🏆 {winnerLabel}
        </h2>
        <div className="text-sm text-[var(--color-text-dim)]">
          {match.config.participants
            .map((p) => participantDisplay(match.config, p.id))
            .join(`  ${t('common.vs')}  `)}{' '}
          · {t('game.legs')} {legs}
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-[var(--color-border)]">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-[var(--color-surface-2)]">
              <th className="px-3 py-2 text-left font-semibold">{t('stats.row.player')}</th>
              {COLS.map((c) => (
                <th key={c.key} className="px-2.5 py-2 text-right font-semibold">
                  {t(c.labelKey)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {stats.map((s, i) => (
              <tr key={s.playerId} className={i % 2 ? 'bg-[var(--color-surface)]' : ''}>
                <td className="whitespace-nowrap px-3 py-2 font-semibold">
                  {nameOf(s.playerId)}
                </td>
                {COLS.map((c) => (
                  <td key={c.key} className="px-2.5 py-2 text-right tnum">
                    {c.fmt(s)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-5 flex flex-col gap-3">
        <Button variant="surface" size="lg" fullWidth onClick={onBack}>
          {t('stats.correctScore')}
        </Button>
        <Button variant="accent" size="xl" fullWidth onClick={onNext}>
          {toDecider
            ? t('champ.continueToDecider')
            : isLast
              ? t('champ.seeFinal')
              : t('champ.nextMatch')}
        </Button>
      </div>
    </div>
  );
}
