import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getRepository } from '@/data';
import type { MatchQuery, MatchRecord, Season } from '@/data/types';
import {
  aggregatePlayerStats,
  type PlayerSeasonStats,
} from '@/domain/playerStats';
import { buildGameState } from '@/domain/engine';
import { participantLabel } from '@/domain/presentation';
import { cn } from '@/lib/cn';
import { useT } from '@/store/LangContext';
import { MatchDetail } from './MatchDetail';

type Period = 'all' | 'today' | 'week' | 'month' | 'year' | 'custom';

/** Column registry — add a stat = add one entry here. Fully extensible. */
interface Column {
  key: string;
  labelKey: string;
  get: (s: PlayerSeasonStats) => number;
  fmt: (s: PlayerSeasonStats) => string;
}
const COLUMNS: Column[] = [
  { key: 'played', labelKey: 'stats.row.played', get: (s) => s.matchesPlayed, fmt: (s) => `${s.matchesPlayed}` },
  { key: 'won', labelKey: 'stats.row.wonShort', get: (s) => s.matchesWon, fmt: (s) => `${s.matchesWon}` },
  { key: 'winpct', labelKey: 'stats.row.winPct', get: (s) => s.winRatio, fmt: (s) => `${(s.winRatio * 100).toFixed(0)}%` },
  { key: 'legs', labelKey: 'stats.row.legs', get: (s) => s.legsWon, fmt: (s) => `${s.legsWon}` },
  { key: 'avg', labelKey: 'stats.row.avg', get: (s) => s.average3, fmt: (s) => s.average3.toFixed(1) },
  { key: 'first9', labelKey: 'stats.row.first9', get: (s) => s.first9Average, fmt: (s) => s.first9Average.toFixed(1) },
  { key: 'first3', labelKey: 'stats.row.first3', get: (s) => s.first3Average, fmt: (s) => s.first3Average.toFixed(1) },
  { key: 'coavg', labelKey: 'stats.row.avgCheckout', get: (s) => s.averageCheckout, fmt: (s) => s.averageCheckout.toFixed(0) },
  { key: 'cobest', labelKey: 'stats.row.bestCheckout', get: (s) => s.bestCheckout, fmt: (s) => `${s.bestCheckout}` },
  { key: 't180', labelKey: 'stats.row.180', get: (s) => s.count180, fmt: (s) => `${s.count180}` },
  { key: 't140', labelKey: 'stats.row.140', get: (s) => s.count140plus, fmt: (s) => `${s.count140plus}` },
  { key: 't100', labelKey: 'stats.row.100', get: (s) => s.count100plus, fmt: (s) => `${s.count100plus}` },
  { key: 't60', labelKey: 'stats.row.60', get: (s) => s.count60plus, fmt: (s) => `${s.count60plus}` },
  { key: 'busts', labelKey: 'stats.row.bust', get: (s) => s.busts, fmt: (s) => `${s.busts}` },
  { key: 'high', labelKey: 'stats.row.highShort', get: (s) => s.highestVisit, fmt: (s) => `${s.highestVisit}` },
  { key: 'bestleg', labelKey: 'stats.row.bestLeg', get: (s) => (s.bestLegDarts != null && s.bestLegDarts >= 9 ? s.bestLegDarts : 999), fmt: (s) => (s.bestLegDarts != null && s.bestLegDarts >= 9 ? `${s.bestLegDarts}` : '—') },
  { key: 'darts', labelKey: 'stats.row.darts', get: (s) => s.totalDarts, fmt: (s) => `${s.totalDarts}` },
];

function periodRange(period: Period, from: string, to: string): Partial<MatchQuery> {
  const now = new Date();
  const iso = (d: Date) => d.toISOString();
  switch (period) {
    case 'today': {
      const d = new Date(now);
      d.setHours(0, 0, 0, 0);
      return { from: iso(d) };
    }
    case 'week': {
      const d = new Date(now);
      d.setDate(d.getDate() - 7);
      return { from: iso(d) };
    }
    case 'month':
      return { from: iso(new Date(now.getFullYear(), now.getMonth(), 1)) };
    case 'year':
      return { from: iso(new Date(now.getFullYear(), 0, 1)) };
    case 'custom':
      return {
        from: from ? iso(new Date(from)) : undefined,
        to: to ? iso(new Date(`${to}T23:59:59`)) : undefined,
      };
    default:
      return {};
  }
}

const CSV_FORMULA_TRIGGER = /^[\t\r\n]|^\s*[=+\-@]/;

function csvCell(value: unknown): string {
  const raw = String(value ?? '');
  const safe = CSV_FORMULA_TRIGGER.test(raw) ? `'${raw}` : raw;
  return `"${safe.replace(/"/g, '""')}"`;
}

function safeFilePart(value: string | undefined): string {
  const safe = (value ?? 'season')
    .trim()
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return safe || 'season';
}

function downloadCsv(filename: string, rows: unknown[][]): void {
  const csv = rows.map((row) => row.map(csvCell).join(',')).join('\r\n');
  const blob = new Blob(['\uFEFF', csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  try {
    a.href = url;
    a.download = filename;
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
  } finally {
    a.remove();
    URL.revokeObjectURL(url);
  }
}

export function AdminDashboard() {
  const navigate = useNavigate();
  const { t } = useT();
  const repo = useMemo(() => getRepository(), []);
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [seasonId, setSeasonId] = useState('');
  const [mode, setMode] = useState<'ALL' | 'SINGLE' | 'DOUBLE'>('ALL');
  const [variant, setVariant] = useState<'ALL' | '501' | '601'>('ALL');
  const [period, setPeriod] = useState<Period>('all');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [playerFilter, setPlayerFilter] = useState('ALL');

  const [rows, setRows] = useState<PlayerSeasonStats[]>([]);
  const [matches, setMatches] = useState<MatchRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortKey, setSortKey] = useState('avg');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [detailId, setDetailId] = useState<string | null>(null);

  useEffect(() => {
    void repo.listSeasons().then((s) => {
      setSeasons(s);
      const cur = s.find((x) => x.isCurrent) ?? s[0];
      if (cur) setSeasonId(cur.id);
    });
  }, [repo]);

  useEffect(() => {
    if (!seasonId) return;
    let alive = true;
    setLoading(true);
    // Championship matches only: New Game (training) never counts in stats,
    // rankings or averages.
    const query: MatchQuery = {
      seasonId,
      championship: true,
      ...(mode !== 'ALL' ? { mode } : {}),
      ...periodRange(period, from, to),
    };
    void repo
      .listMatches(query)
      .then((all) => {
        if (!alive) return;
        const filtered =
          variant === 'ALL'
            ? all
            : all.filter((m) => m.variant === Number(variant));
        setMatches(filtered);
        setRows(
          aggregatePlayerStats(
            filtered.map((m) => ({ config: m.config, events: m.events })),
          ),
        );
      })
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [repo, seasonId, mode, variant, period, from, to]);

  const players = useMemo(
    () => [...rows].map((r) => r.name).sort(),
    [rows],
  );

  const displayed = useMemo(() => {
    let list = rows;
    if (playerFilter !== 'ALL') list = list.filter((r) => r.name === playerFilter);
    const col = COLUMNS.find((c) => c.key === sortKey);
    if (col) {
      const dir = sortDir === 'asc' ? 1 : -1;
      list = [...list].sort((a, b) => (col.get(a) - col.get(b)) * dir);
    }
    return list;
  }, [rows, playerFilter, sortKey, sortDir]);

  const sort = (key: string) => {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else {
      setSortKey(key);
      setSortDir('desc');
    }
  };

  // Export the current filtered table without pulling vulnerable spreadsheet parsers.
  const exportCsv = () => {
    const header = [t('stats.row.player'), ...COLUMNS.map((c) => t(c.labelKey))];
    const rows = displayed.map((r) => [r.name, ...COLUMNS.map((c) => c.fmt(r))]);
    const season = safeFilePart(seasons.find((s) => s.id === seasonId)?.name);
    downloadCsv(`darts-stats-${season}.csv`, [header, ...rows]);
  };

  // Per-player match history (shown when a single player is selected).
  const history = useMemo(() => {
    if (playerFilter === 'ALL') return [];
    const selectedPlayer = rows.find((r) => r.name === playerFilter);
    if (!selectedPlayer) return [];
    const pid = selectedPlayer.playerId;
    return matches
      .filter((m) => m.config.players.some((p) => p.id === pid))
      .map((m) => {
        const state = buildGameState(m.config, m.events);
        const mine = m.config.participants.find((p) => p.playerIds.includes(pid));
        const opp = m.config.participants.find((p) => p.id !== mine?.id);
        const myLegs = state.legsWon[mine?.id ?? ''] ?? 0;
        const oppLegs = state.legsWon[opp?.id ?? ''] ?? 0;
        const result =
          state.status === 'GAME_OVER'
            ? state.winnerId === mine?.id
              ? 'W'
              : 'L'
            : '…';
        const avg =
          aggregatePlayerStats([{ config: m.config, events: m.events }]).find(
            (s) => s.playerId === pid,
          )?.average3 ?? 0;
        return {
          id: m.id,
          date: m.createdAt ?? '',
          opponent: opp ? participantLabel(m.config, opp.id) : '?',
          mode: m.mode,
          variant: m.variant,
          myLegs,
          oppLegs,
          result,
          avg,
        };
      })
      .sort((a, b) => (a.date < b.date ? 1 : -1));
  }, [matches, playerFilter, rows]);

  return (
    <div>
      {/* filters */}
      <div className="mb-4 flex flex-wrap items-center gap-2 text-sm">
        <Select value={seasonId} onChange={setSeasonId}>
          {seasons.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
              {s.isCurrent ? ` (${t('common.current')})` : ''}
            </option>
          ))}
        </Select>
        <Select value={playerFilter} onChange={setPlayerFilter}>
          <option value="ALL">{t('admin.allPlayers')}</option>
          {players.map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </Select>
        <Select value={mode} onChange={(v) => setMode(v as typeof mode)}>
          <option value="ALL">{t('admin.singlesAndDoubles')}</option>
          <option value="SINGLE">{t('game.singles')}</option>
          <option value="DOUBLE">{t('game.doubles')}</option>
        </Select>
        <Select value={variant} onChange={(v) => setVariant(v as typeof variant)}>
          <option value="ALL">501 & 601</option>
          <option value="501">501</option>
          <option value="601">601</option>
        </Select>
        <Select value={period} onChange={(v) => setPeriod(v as Period)}>
          <option value="all">{t('admin.allTime')}</option>
          <option value="today">{t('admin.today')}</option>
          <option value="week">{t('admin.last7')}</option>
          <option value="month">{t('admin.thisMonth')}</option>
          <option value="year">{t('admin.thisYear')}</option>
          <option value="custom">{t('admin.custom')}</option>
        </Select>
        {period === 'custom' && (
          <>
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-1.5"
            />
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-1.5"
            />
          </>
        )}
        <div className="ml-auto flex items-center gap-2">
          <span className="text-[var(--color-text-dim)]">
            {t('admin.counts')
              .replace('{matches}', String(matches.length))
              .replace('{players}', String(rows.length))}
          </span>
          <button
            onClick={exportCsv}
            disabled={displayed.length === 0}
            className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1.5 text-sm font-semibold hover:border-[var(--color-accent)] disabled:opacity-50"
          >
            {t('admin.exportCsv')}
          </button>
        </div>
      </div>

      {loading ? (
        <p className="py-8 text-center text-[var(--color-text-dim)]">{t('common.loading')}</p>
      ) : displayed.length === 0 ? (
        <p className="rounded-xl border border-dashed border-[var(--color-border)] p-8 text-center text-[var(--color-text-dim)]">
          {t('admin.noStats')}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-[var(--color-border)]">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="bg-[var(--color-surface-2)]">
                <th className="sticky left-0 z-10 bg-[var(--color-surface-2)] px-3 py-2 text-left">
                  {t('stats.row.player')}
                </th>
                {COLUMNS.map((c) => (
                  <th
                    key={c.key}
                    onClick={() => sort(c.key)}
                    className={cn(
                      'cursor-pointer whitespace-nowrap px-2.5 py-2 text-right font-semibold hover:text-[var(--color-text)]',
                      sortKey === c.key
                        ? 'text-[var(--color-accent)]'
                        : 'text-[var(--color-text-dim)]',
                    )}
                  >
                    {t(c.labelKey)}
                    {sortKey === c.key ? (sortDir === 'asc' ? ' ▲' : ' ▼') : ''}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {displayed.map((r, i) => (
                <tr key={r.playerId} className={i % 2 ? 'bg-[var(--color-surface)]' : ''}>
                  <td className="sticky left-0 z-10 whitespace-nowrap bg-[inherit] px-3 py-2 font-semibold">
                    <button
                      onClick={() => navigate(`/admin/players/${r.playerId}`)}
                      className="text-left hover:text-[var(--color-accent)] hover:underline"
                    >
                      {r.name}
                    </button>
                  </td>
                  {COLUMNS.map((c) => (
                    <td
                      key={c.key}
                      className="whitespace-nowrap px-2.5 py-2 text-right tnum"
                    >
                      {c.fmt(r)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* per-player match history */}
      {playerFilter !== 'ALL' && (
        <div className="mt-6">
          <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-[var(--color-text-dim)]">
            {playerFilter} — {t('admin.matchHistory')} ({history.length})
          </h3>
          {history.length === 0 ? (
            <p className="rounded-xl border border-dashed border-[var(--color-border)] p-4 text-center text-sm text-[var(--color-text-dim)]">
              {t('admin.noMatchesFilters')}
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {history.map((h) => (
                <li key={h.id}>
                  <button
                    onClick={() => setDetailId(h.id)}
                    className="flex w-full items-center gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-2.5 text-left transition-colors hover:border-[var(--color-accent)]"
                  >
                    <span
                      className={cn(
                        'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-sm font-black',
                        h.result === 'W'
                          ? 'bg-[var(--color-success-dim)] text-[var(--color-success)]'
                          : h.result === 'L'
                            ? 'bg-[var(--color-accent-soft)] text-[var(--color-accent)]'
                            : 'bg-[var(--color-surface-2)] text-[var(--color-text-dim)]',
                      )}
                    >
                      {h.result}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-semibold">{t('common.vs')} {h.opponent}</div>
                      <div className="text-xs text-[var(--color-text-dim)]">
                        {h.date ? new Date(h.date).toLocaleDateString() : '—'} ·{' '}
                        {h.variant} {t(h.mode === 'DOUBLE' ? 'game.doubles' : 'game.singles')}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-black tnum">
                        {h.myLegs}–{h.oppLegs}
                      </div>
                      <div className="text-xs text-[var(--color-text-dim)]">
                        {t('game.avg')} {h.avg.toFixed(1)}
                      </div>
                    </div>
                    <span className="text-[var(--color-text-dim)]">›</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <MatchDetail
        match={matches.find((m) => m.id === detailId) ?? null}
        onClose={() => setDetailId(null)}
      />
    </div>
  );
}

function Select({
  value,
  onChange,
  children,
}: {
  value: string;
  onChange: (v: string) => void;
  children: React.ReactNode;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1.5 outline-none"
    >
      {children}
    </select>
  );
}
