import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getRepository } from '@/data';
import type { MatchRecord } from '@/data/types';
import { aggregatePlayerStats } from '@/domain/playerStats';
import { useRoster } from '@/store/RosterContext';
import { useT } from '@/store/LangContext';
import { useMyTeam } from './TeamLayout';

/**
 * Per-player championship overview for the captain's squad. Reuses the pure
 * stats aggregator (nothing stored); each row opens the full player profile.
 */
export function TeamStats() {
  const { team } = useMyTeam();
  const navigate = useNavigate();
  const repo = useMemo(() => getRepository(), []);
  const { players } = useRoster();
  const { t } = useT();

  const [matches, setMatches] = useState<MatchRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    void repo
      .listMatches({ championship: true })
      .then((m) => alive && setMatches(m))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [repo]);

  const rows = useMemo(() => {
    return team.playerIds
      .map((pid) => {
        const name = players.find((p) => p.id === pid)?.name ?? '???';
        const mine = matches.filter((m) =>
          m.config.players.some((p) => p.id === pid),
        );
        const stats = aggregatePlayerStats(
          mine.map((m) => ({ config: m.config, events: m.events })),
        ).find((s) => s.playerId === pid);
        return {
          id: pid,
          name,
          played: stats?.matchesPlayed ?? 0,
          won: stats?.matchesWon ?? 0,
          winRatio: stats?.winRatio ?? 0,
          average3: stats?.average3 ?? 0,
        };
      })
      .sort((a, b) => b.average3 - a.average3 || a.name.localeCompare(b.name));
  }, [team.playerIds, players, matches]);

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
        {t('team.noMembers')}
      </p>
    );
  }

  return (
    <div>
      <div className="mb-2 grid grid-cols-[1fr_auto_auto_auto] gap-x-3 px-3 text-[11px] font-semibold uppercase tracking-wide text-[var(--color-text-dim)]">
        <span>{t('stats.row.player')}</span>
        <span className="w-10 text-right">{t('stats.row.played')}</span>
        <span className="w-12 text-right">{t('stats.row.winPct')}</span>
        <span className="w-14 text-right">{t('stats.row.avg')}</span>
      </div>
      <ul className="flex flex-col gap-1.5">
        {rows.map((r) => (
          <li key={r.id}>
            <button
              onClick={() => navigate(`/team/players/${r.id}`)}
              className="grid w-full grid-cols-[1fr_auto_auto_auto] items-center gap-x-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2.5 text-left transition-colors hover:border-[var(--color-accent)]"
            >
              <span className="min-w-0 truncate text-lg font-semibold">
                {r.name}
              </span>
              <span className="w-10 text-right tnum">{r.played}</span>
              <span className="w-12 text-right tnum">
                {Math.round(r.winRatio * 100)}%
              </span>
              <span className="w-14 text-right font-black text-[var(--color-accent)] tnum">
                {r.average3.toFixed(1)}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
