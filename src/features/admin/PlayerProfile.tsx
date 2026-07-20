import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { getRepository } from '@/data';
import { buildGameState } from '@/domain/engine';
import { aggregatePlayerStats } from '@/domain/playerStats';
import { participantDisplay } from '@/domain/presentation';
import { cn } from '@/lib/cn';
import { useT } from '@/store/LangContext';
import { MatchDetail } from './MatchDetail';
import type { MatchRecord, Season } from '@/data/types';

type TrendPoint = {
  key: string;
  matchNo: number;
  average: number;
  dateLabel: string;
  opponent: string;
  result: 'W' | 'L';
  score: string;
};

/**
 * Player profile: career overview, per-match average trend, personal records,
 * match history, and head-to-head against any opponent. Championship matches
 * only (training games never count), reusing the pure engine — nothing stored.
 */
export function PlayerProfile() {
  const { id = '' } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useT();
  // The profile is reused by the captain space under /team/players/:id.
  const backTo = location.pathname.startsWith('/team') ? '/team/stats' : '/admin/stats';
  const repo = useMemo(() => getRepository(), []);
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [seasonId, setSeasonId] = useState<string>('');
  const [matches, setMatches] = useState<MatchRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [opponent, setOpponent] = useState('ALL');
  const [detailId, setDetailId] = useState<string | null>(null);
  const [rosterName, setRosterName] = useState('');

  useEffect(() => {
    void repo
      .listPlayers()
      .then((ps) => setRosterName(ps.find((p) => p.id === id)?.name ?? ''));
  }, [repo, id]);

  useEffect(() => {
    void repo.listSeasons().then((s) => {
      setSeasons(s);
      const cur = s.find((x) => x.isCurrent) ?? s[0];
      if (cur) setSeasonId(cur.id);
    });
  }, [repo]);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    void repo
      .listMatches({ championship: true, ...(seasonId ? { seasonId } : {}) })
      .then((m) => alive && setMatches(m))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [repo, seasonId]);

  // Everything derives from the player's matches (recomputed by the engine).
  const data = useMemo(() => {
    const mine = matches.filter((m) => m.config.players.some((p) => p.id === id));
    const name =
      mine.flatMap((m) => m.config.players).find((p) => p.id === id)?.name ?? '—';

    const per = mine
      .map((m) => {
        const state = buildGameState(m.config, m.events);
        const mySide = m.config.participants.find((p) => p.playerIds.includes(id));
        const oppSide = m.config.participants.find((p) => p.id !== mySide?.id);
        const stats = aggregatePlayerStats([{ config: m.config, events: m.events }]);
        const myAvg = stats.find((s) => s.playerId === id)?.average3 ?? 0;
        const won = state.status === 'GAME_OVER' && state.winnerId === mySide?.id;
        const decided = state.status === 'GAME_OVER';
        return {
          m,
          state,
          stats,
          mySideId: mySide?.id ?? '',
          oppSideId: oppSide?.id ?? '',
          myLegs: state.legsWon[mySide?.id ?? ''] ?? 0,
          oppLegs: state.legsWon[oppSide?.id ?? ''] ?? 0,
          myAvg,
          won,
          decided,
          date: m.createdAt ?? '',
        };
      })
      .sort((a, b) => (a.date < b.date ? -1 : 1)); // chronological

    const overall = aggregatePlayerStats(
      mine.map((m) => ({ config: m.config, events: m.events })),
    ).find((s) => s.playerId === id);

    // personal records (best single-match figures)
    const bestMatchAvg = Math.max(0, ...per.map((p) => p.myAvg));
    const most180Match = Math.max(
      0,
      ...per.map((p) => p.stats.find((s) => s.playerId === id)?.count180 ?? 0),
    );

    // opponents ever faced (individual players on the other side)
    const opponents = new Map<string, string>();
    for (const p of per) {
      for (const part of p.m.config.participants) {
        if (part.id === p.mySideId) continue;
        for (const pid of part.playerIds) {
          if (!opponents.has(pid))
            opponents.set(
              pid,
              p.m.config.players.find((pl) => pl.id === pid)?.name ?? '—',
            );
        }
      }
    }

    return { mine, name, per, overall, bestMatchAvg, most180Match, opponents };
  }, [matches, id]);

  const trend: TrendPoint[] = data.per
    .filter((p) => p.decided)
    .map((p, index) => ({
      key: p.m.id,
      matchNo: index + 1,
      average: p.myAvg,
      dateLabel: p.date ? new Date(p.date).toLocaleDateString() : '-',
      opponent: participantDisplay(p.m.config, p.oppSideId),
      result: p.won ? 'W' : 'L',
      score: `${p.myLegs}-${p.oppLegs}`,
    }));

  // head-to-head vs the selected opponent
  const h2h = useMemo(() => {
    if (opponent === 'ALL') return null;
    const rows = data.per.filter((p) =>
      p.m.config.participants.some(
        (part) => part.id === p.oppSideId && part.playerIds.includes(opponent),
      ),
    );
    let wins = 0,
      legsFor = 0,
      legsAgainst = 0;
    let sumMyAvg = 0,
      sumOppAvg = 0,
      avgN = 0;
    for (const p of rows) {
      if (p.won) wins += 1;
      legsFor += p.myLegs;
      legsAgainst += p.oppLegs;
      const oppAvg = p.stats.find((s) => s.playerId === opponent)?.average3 ?? 0;
      if (p.myAvg || oppAvg) {
        sumMyAvg += p.myAvg;
        sumOppAvg += oppAvg;
        avgN += 1;
      }
    }
    const decided = rows.filter((p) => p.decided).length;
    return {
      rows: [...rows].reverse(),
      played: rows.length,
      wins,
      losses: decided - wins,
      legsFor,
      legsAgainst,
      avgFor: avgN ? sumMyAvg / avgN : 0,
      avgAgainst: avgN ? sumOppAvg / avgN : 0,
      name: data.opponents.get(opponent) ?? '—',
    };
  }, [opponent, data]);

  const historyDesc = [...data.per].reverse();
  const displayName = rosterName || data.name;

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <button
          onClick={() => navigate(backTo)}
          className="rounded-lg px-2 py-1 text-sm text-[var(--color-text-dim)] hover:bg-[var(--color-surface-2)]"
        >
          {t('common.back')} {t('admin.title')}
        </button>
        <h2 className="text-2xl font-black">{displayName}</h2>
        <select
          value={seasonId}
          onChange={(e) => setSeasonId(e.target.value)}
          className="ml-auto rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1.5 text-sm outline-none"
        >
          <option value="">{t('admin.allSeasons')}</option>
          {seasons.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
              {s.isCurrent ? ` (${t('common.current')})` : ''}
            </option>
          ))}
        </select>
      </div>

      {loading ? (
        <p className="py-8 text-center text-[var(--color-text-dim)]">{t('common.loading')}</p>
      ) : data.mine.length === 0 ? (
        <p className="rounded-xl border border-dashed border-[var(--color-border)] p-8 text-center text-[var(--color-text-dim)]">
          {t('admin.noPlayerMatches')}
        </p>
      ) : (
        <>
          {/* overview */}
          <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Metric label={t('common.matches')} value={`${data.overall?.matchesPlayed ?? 0}`} />
            <Metric
              label={t('admin.wonLost')}
              value={`${data.overall?.matchesWon ?? 0} / ${(data.overall?.matchesPlayed ?? 0) - (data.overall?.matchesWon ?? 0)}`}
            />
            <Metric
              label={t('admin.winRate')}
              value={`${Math.round((data.overall?.winRatio ?? 0) * 100)}%`}
            />
            <Metric label={t('stats.row.avg')} value={(data.overall?.average3 ?? 0).toFixed(1)} accent />
          </div>

          {/* key stats */}
          <div className="mb-5 grid grid-cols-3 gap-2 sm:grid-cols-6">
            <Metric small label={t('stats.row.first9')} value={(data.overall?.first9Average ?? 0).toFixed(1)} />
            <Metric small label={t('stats.row.180')} value={`${data.overall?.count180 ?? 0}`} />
            <Metric small label="140+" value={`${data.overall?.count140plus ?? 0}`} />
            <Metric small label={t('stats.row.bestCheckout')} value={`${data.overall?.bestCheckout ?? 0}`} />
            <Metric
              small
              label={t('stats.row.bestLeg')}
              value={
                data.overall?.bestLegDarts != null && data.overall.bestLegDarts >= 9
                  ? `${data.overall.bestLegDarts}`
                  : '—'
              }
            />
            <Metric small label={t('stats.row.legs')} value={`${data.overall?.legsWon ?? 0}`} />
          </div>

          {/* average trend */}
          <Section title={t('admin.avgTrendTitle')}>
            <AverageTrend points={trend} />
          </Section>

          {/* personal records */}
          <Section title={t('admin.records')}>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <Record label={t('award.bestCheckout')} value={`${data.overall?.bestCheckout ?? 0}`} />
              <Record label={t('admin.bestMatchAvg')} value={data.bestMatchAvg.toFixed(1)} />
              <Record label={t('admin.most180Match')} value={`${data.most180Match}`} />
              <Record
                label={t('stats.row.best')}
                value={
                  data.overall?.bestLegDarts != null && data.overall.bestLegDarts >= 9
                    ? `${data.overall.bestLegDarts}`
                    : '—'
                }
              />
            </div>
          </Section>

          {/* head-to-head */}
          <Section title={t('admin.headToHead')}>
            <div className="mb-3 flex items-center gap-2 text-sm">
              <span className="text-[var(--color-text-dim)]">{t('common.vs')}</span>
              <select
                value={opponent}
                onChange={(e) => setOpponent(e.target.value)}
                className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1.5 outline-none"
              >
                <option value="ALL">{t('admin.selectOpponent')}</option>
                {[...data.opponents.entries()]
                  .sort((a, b) => a[1].localeCompare(b[1]))
                  .map(([pid, n]) => (
                    <option key={pid} value={pid}>
                      {n}
                    </option>
                  ))}
              </select>
            </div>

            {h2h && (
              <>
                <div className="mb-3 grid grid-cols-3 gap-2 sm:grid-cols-5">
                  <Metric small label={t('common.matches')} value={`${h2h.played}`} />
                  <Metric small label={`${t('admin.winShort')} – ${t('admin.lossShort')}`} value={`${h2h.wins} – ${h2h.losses}`} />
                  <Metric small label={t('game.legs')} value={`${h2h.legsFor} – ${h2h.legsAgainst}`} />
                  <Metric small label={`${displayName} ${t('game.avg')}`} value={h2h.avgFor.toFixed(1)} />
                  <Metric small label={`${h2h.name} ${t('game.avg')}`} value={h2h.avgAgainst.toFixed(1)} />
                </div>
                <ul className="flex flex-col gap-1.5">
                  {h2h.rows.map((p) => (
                    <li key={p.m.id}>
                      <button
                        onClick={() => setDetailId(p.m.id)}
                        className="flex w-full items-center gap-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-left text-sm transition-colors hover:border-[var(--color-accent)]"
                      >
                        <ResultBadge result={p.decided ? (p.won ? 'W' : 'L') : '…'} />
                        <span className="min-w-0 flex-1 truncate text-[var(--color-text-dim)]">
                          {p.date ? new Date(p.date).toLocaleDateString() : '—'} ·{' '}
                          {t(p.m.mode === 'DOUBLE' ? 'game.doubles' : 'game.singles')}
                        </span>
                        <span className="font-black tnum">
                          {p.myLegs}–{p.oppLegs}
                        </span>
                        <span className="text-[var(--color-text-dim)]">›</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </Section>

          {/* match history */}
          <Section title={`${t('admin.matchHistory')} (${data.per.length})`}>
            <ul className="flex flex-col gap-1.5">
              {historyDesc.map((p) => (
                <li key={p.m.id}>
                  <button
                    onClick={() => setDetailId(p.m.id)}
                    className="flex w-full items-center gap-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-left text-sm transition-colors hover:border-[var(--color-accent)]"
                  >
                    <ResultBadge result={p.decided ? (p.won ? 'W' : 'L') : '…'} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold">
                        {t('common.vs')} {participantDisplay(p.m.config, p.oppSideId)}
                      </span>
                      <span className="text-xs text-[var(--color-text-dim)]">
                        {p.date ? new Date(p.date).toLocaleDateString() : '—'} ·{' '}
                        {t(p.m.mode === 'DOUBLE' ? 'game.doubles' : 'game.singles')}
                      </span>
                    </span>
                    <span className="text-right">
                      <span className="block font-black tnum">
                        {p.myLegs}–{p.oppLegs}
                      </span>
                      <span className="text-xs text-[var(--color-text-dim)]">
                        {t('game.avg')} {p.myAvg.toFixed(1)}
                      </span>
                    </span>
                    <span className="text-[var(--color-text-dim)]">›</span>
                  </button>
                </li>
              ))}
            </ul>
          </Section>
        </>
      )}

      <MatchDetail
        match={data.mine.find((m) => m.id === detailId) ?? null}
        onClose={() => setDetailId(null)}
      />
    </div>
  );
}

function Metric({
  label,
  value,
  accent,
  small,
}: {
  label: string;
  value: string;
  accent?: boolean;
  small?: boolean;
}) {
  return (
    <div className="rounded-xl bg-[var(--color-surface)] p-3 text-center">
      <div className="text-[11px] uppercase tracking-wide text-[var(--color-text-dim)]">
        {label}
      </div>
      <div
        className={cn(
          'font-black tnum',
          small ? 'text-lg' : 'text-2xl',
          accent && 'text-[var(--color-accent)]',
        )}
      >
        {value}
      </div>
    </div>
  );
}

function Record({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3 text-center">
      <div className="text-[10px] uppercase tracking-wide text-[var(--color-text-dim)]">
        {label}
      </div>
      <div className="text-xl font-black text-[var(--color-accent)] tnum">{value}</div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-5">
      <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-[var(--color-text-dim)]">
        {title}
      </h3>
      {children}
    </div>
  );
}

function ResultBadge({ result }: { result: 'W' | 'L' | '…' }) {
  const { t } = useT();
  return (
    <span
      className={cn(
        'flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-sm font-black',
        result === 'W'
          ? 'bg-[var(--color-success-dim)] text-[var(--color-success)]'
          : result === 'L'
            ? 'bg-[var(--color-accent-soft)] text-[var(--color-accent)]'
            : 'bg-[var(--color-surface-2)] text-[var(--color-text-dim)]',
      )}
    >
      {result === 'W' ? t('admin.winShort') : result === 'L' ? t('admin.lossShort') : result}
    </span>
  );
}

/** Dependency-free SVG line chart with readable labels and recent match context. */
function AverageTrend({ points }: { points: TrendPoint[] }) {
  const { t } = useT();
  if (points.length < 2) {
    return (
      <p className="rounded-xl border border-dashed border-[var(--color-border)] p-4 text-center text-xs text-[var(--color-text-dim)]">
        {t('admin.notEnoughTrend')}
      </p>
    );
  }

  const w = 640;
  const h = 190;
  const margin = { top: 22, right: 26, bottom: 34, left: 50 };
  const rawMin = Math.min(...points.map((p) => p.average));
  const rawMax = Math.max(...points.map((p) => p.average));
  const spread = Math.max(5, rawMax - rawMin);
  const min = Math.max(0, Math.floor((rawMin - spread * 0.18) / 5) * 5);
  const max = Math.ceil((rawMax + spread * 0.18) / 5) * 5;
  const range = max - min || 1;
  const plotW = w - margin.left - margin.right;
  const plotH = h - margin.top - margin.bottom;
  const x = (i: number) =>
    margin.left + (i / (points.length - 1)) * plotW;
  const y = (v: number) =>
    margin.top + (1 - (v - min) / range) * plotH;
  const path = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${x(i).toFixed(1)} ${y(p.average).toFixed(1)}`)
    .join(' ');
  const best = points.reduce((top, p) => (p.average > top.average ? p : top));
  const latest = points[points.length - 1]!;
  const gridValues = [max, (max + min) / 2, min];
  const tickEvery = Math.max(1, Math.ceil(points.length / 6));
  const recent = [...points].slice(-5).reverse();

  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-xs font-semibold text-[var(--color-text-dim)]">
          <span className="h-2.5 w-6 rounded-full bg-[var(--color-accent)]" />
          <span>{t('admin.avgLegend')}</span>
        </div>
        <div className="flex flex-wrap gap-2 text-[11px] font-semibold text-[var(--color-text-dim)]">
          <span>{t('admin.best').replace('{value}', best.average.toFixed(1))}</span>
          <span>{t('admin.latest').replace('{value}', latest.average.toFixed(1))}</span>
          <span>{points.length} {t('common.matches')}</span>
        </div>
      </div>
      <svg
        viewBox={`0 0 ${w} ${h}`}
        preserveAspectRatio="none"
        className="h-52 w-full overflow-visible"
        role="img"
        aria-label={t('admin.trendAria')}
      >
        {gridValues.map((value) => (
          <g key={value}>
            <line
              x1={margin.left}
              y1={y(value)}
              x2={w - margin.right}
              y2={y(value)}
              stroke="var(--color-border)"
              strokeDasharray="4 6"
              vectorEffect="non-scaling-stroke"
            />
            <text
              x={margin.left - 8}
              y={y(value) + 4}
              textAnchor="end"
              fontSize="11"
              fill="var(--color-text-dim)"
            >
              {value.toFixed(0)}
            </text>
          </g>
        ))}
        <line
          x1={margin.left}
          y1={h - margin.bottom}
          x2={w - margin.right}
          y2={h - margin.bottom}
          stroke="var(--color-border-strong)"
          vectorEffect="non-scaling-stroke"
        />
        <path
          d={path}
          fill="none"
          stroke="var(--color-accent)"
          strokeWidth="3"
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
        {points.map((p, i) => {
          const cx = x(i);
          const cy = y(p.average);
          const labelAbove = cy > margin.top + 18;
          const showLabel =
            points.length <= 10 || i === points.length - 1 || p.key === best.key;

          return (
            <g key={p.key}>
              <circle
                cx={cx}
                cy={cy}
                r={p.key === latest.key || p.key === best.key ? 4.5 : 3.5}
                fill={p.result === 'W' ? 'var(--color-success)' : 'var(--color-accent)'}
                stroke="var(--color-surface)"
                strokeWidth="2"
                vectorEffect="non-scaling-stroke"
              />
              {showLabel && (
                <text
                  x={cx}
                  y={cy + (labelAbove ? -9 : 16)}
                  textAnchor="middle"
                  fontSize="10"
                  fontWeight="700"
                  fill="var(--color-text)"
                >
                  {p.average.toFixed(1)}
                </text>
              )}
              {(i % tickEvery === 0 || i === points.length - 1) && (
                <text
                  x={cx}
                  y={h - 10}
                  textAnchor="middle"
                  fontSize="10"
                  fill="var(--color-text-dim)"
                >
                  #{p.matchNo}
                </text>
              )}
              <title>
                {p.dateLabel} {t('common.vs')} {p.opponent}: {p.average.toFixed(1)} {t('game.avg')}, {p.result}{' '}
                {p.score}
              </title>
            </g>
          );
        })}
      </svg>

      <div className="mt-3 border-t border-[var(--color-border)] pt-3">
        <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-[var(--color-text-dim)]">
          {t('admin.recentMatches')}
        </div>
        <ul className="grid gap-1.5 sm:grid-cols-2">
          {recent.map((p) => (
            <li
              key={p.key}
              className="flex min-w-0 items-center gap-2 rounded-lg bg-[var(--color-surface-2)] px-2.5 py-2 text-xs"
            >
              <span
                className={cn(
                  'flex h-6 w-6 shrink-0 items-center justify-center rounded-md font-black',
                  p.result === 'W'
                    ? 'bg-[var(--color-success-dim)] text-[var(--color-success)]'
                    : 'bg-[var(--color-accent-soft)] text-[var(--color-accent)]',
                )}
              >
                {p.result}
              </span>
              <span className="min-w-0 flex-1 truncate text-[var(--color-text-dim)]">
                #{p.matchNo} {p.dateLabel} {t('common.vs')} {p.opponent}
              </span>
              <span className="shrink-0 font-black text-[var(--color-text)] tnum">
                {p.average.toFixed(1)}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
