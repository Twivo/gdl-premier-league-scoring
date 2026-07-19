import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { useConfirm } from '@/components/ui/ConfirmProvider';
import { getRepository } from '@/data';
import type { Season } from '@/data/types';
import type { PremierLeagueCompetition, PremierLeagueNight } from '@/domain/premierLeague';
import { AdminLogin } from '@/features/admin/AdminLogin';
import { useAuth } from '@/store/AuthContext';
import { LangToggle, useT } from '@/store/LangContext';
import { useRoster } from '@/store/RosterContext';
import {
  createPremierLeagueCompetition,
  loadCurrentPremierLeagueCompetition,
  reopenLastPremierLeagueResult,
  setPremierLeagueNightAdminOverride,
  updatePremierLeagueQuarterFinals,
} from '@/store/premierLeagueService';
import { premierLeagueErrorText } from './errors';

export function PremierLeagueAdminRoute() {
  const { user, loading, adminAvailable } = useAuth();
  const { t } = useT();
  if (loading) {
    return <div className="flex min-h-screen items-center justify-center">{t('common.loading')}</div>;
  }
  if (adminAvailable && !user) return <AdminLogin />;
  return <PremierLeagueAdmin />;
}

function PremierLeagueAdmin() {
  const navigate = useNavigate();
  const confirm = useConfirm();
  const { t } = useT();
  const { activePlayers, addPlayer, reload: reloadRoster } = useRoster();
  const [competition, setCompetition] = useState<PremierLeagueCompetition | null>(null);
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [seasonId, setSeasonId] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [dates, setDates] = useState<string[]>(Array(8).fill(''));
  const [newPlayer, setNewPlayer] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = async () => {
    const [current, seasonRows] = await Promise.all([
      loadCurrentPremierLeagueCompetition(),
      getRepository().listSeasons().catch(() => []),
    ]);
    setCompetition(current);
    setSeasons(seasonRows);
    setSeasonId((value) => value || seasonRows.find((season) => season.isCurrent)?.id || seasonRows[0]?.id || '');
    setLoading(false);
  };

  useEffect(() => {
    void reload();
  }, []);

  const togglePlayer = (id: string) => {
    setSelected((current) =>
      current.includes(id)
        ? current.filter((playerId) => playerId !== id)
        : current.length < 8
          ? [...current, id]
          : current,
    );
  };

  const create = async () => {
    setCreating(true);
    setError(null);
    try {
      const created = await createPremierLeagueCompetition({
        name,
        seasonId,
        playerIds: selected,
        nightDates: dates.slice(0, 7).map((date) => date || null),
        finalsDate: dates[7] || null,
      });
      setCompetition(created);
      navigate('/premier-league/night/1');
    } catch (cause) {
      setError(premierLeagueErrorText(t, cause));
      setCreating(false);
    }
  };

  const addInlinePlayer = async () => {
    if (!newPlayer.trim()) return;
    setError(null);
    try {
      await addPlayer(newPlayer.trim());
      setNewPlayer('');
      await reloadRoster();
    } catch (cause) {
      setError(premierLeagueErrorText(t, cause));
    }
  };

  const correctLast = async () => {
    if (!competition) return;
    const ok = await confirm({
      title: t('premierLeague.admin.correctTitle'),
      message: t('premierLeague.admin.correctMessage'),
      confirmLabel: t('premierLeague.admin.correctAction'),
      danger: true,
    });
    if (!ok) return;
    setError(null);
    try {
      const reopened = await reopenLastPremierLeagueResult(competition.id);
      navigate(`/game/${reopened.matchId}`);
    } catch (cause) {
      setError(premierLeagueErrorText(t, cause));
    }
  };

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center">{t('common.loading')}</div>;
  }

  return (
    <div className="mx-auto min-h-screen max-w-4xl px-4 py-6">
      <header className="mb-7 flex items-start justify-between gap-4">
        <div>
          <button
            type="button"
            onClick={() => navigate('/')}
            className="mb-2 text-sm font-bold text-[var(--color-accent)] hover:underline"
          >
            {t('common.backToApp')}
          </button>
          <h1 className="text-3xl font-black">{t('premierLeague.admin.title')}</h1>
        </div>
        <LangToggle />
      </header>

      {error && (
        <p className="mb-5 rounded-xl border border-[var(--color-warning)] p-3 text-sm text-[var(--color-warning)]">
          {error}
        </p>
      )}

      {!competition ? (
        <section className="space-y-6 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
          <div>
            <label className="mb-2 block text-sm font-bold" htmlFor="competition-name">
              {t('premierLeague.admin.competitionName')}
            </label>
            <input
              id="competition-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)] px-4 py-3 outline-none focus:border-[var(--color-accent)]"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-bold" htmlFor="competition-season">
              {t('admin.season')}
            </label>
            <select
              id="competition-season"
              value={seasonId}
              onChange={(event) => setSeasonId(event.target.value)}
              className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)] px-4 py-3"
            >
              <option value="">{t('premierLeague.admin.chooseSeason')}</option>
              {seasons.map((season) => <option key={season.id} value={season.id}>{season.name}</option>)}
            </select>
            {!seasons.length && <p className="mt-2 text-sm text-[var(--color-warning)]">{t('premierLeague.admin.noSeason')}</p>}
          </div>

          <div>
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2 className="font-bold">{t('premierLeague.admin.selectEight')}</h2>
              <span className="rounded-full bg-[var(--color-surface-2)] px-3 py-1 text-sm font-black text-[var(--color-accent)]">
                {selected.length}/8
              </span>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              {activePlayers.map((player) => (
                <label
                  key={player.id}
                  className="flex cursor-pointer items-center gap-3 rounded-xl border border-[var(--color-border)] p-3 hover:border-[var(--color-accent)]"
                >
                  <input
                    type="checkbox"
                    checked={selected.includes(player.id)}
                    disabled={!selected.includes(player.id) && selected.length >= 8}
                    onChange={() => togglePlayer(player.id)}
                  />
                  <span className="font-semibold">{player.name}</span>
                </label>
              ))}
            </div>
            <div className="mt-3 flex gap-2">
              <input
                value={newPlayer}
                onChange={(event) => setNewPlayer(event.target.value)}
                placeholder={t('admin.newPlayerName')}
                className="min-w-0 flex-1 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)] px-4 py-2.5"
              />
              <Button variant="surface" size="md" onClick={() => void addInlinePlayer()}>
                {t('admin.addPlayer')}
              </Button>
            </div>
          </div>

          <div>
            <h2 className="mb-3 font-bold">{t('premierLeague.admin.optionalDates')}</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              {dates.map((date, index) => (
                <label key={index} className="text-sm font-semibold">
                  <span className="mb-1 block text-[var(--color-text-dim)]">
                    {index < 7
                      ? t('premierLeague.night').replace('{number}', String(index + 1))
                      : t('premierLeague.finalsNight')}
                  </span>
                  <input
                    type="date"
                    value={date}
                    onChange={(event) => setDates((current) => current.map((value, dateIndex) => dateIndex === index ? event.target.value : value))}
                    className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 py-2.5"
                  />
                </label>
              ))}
            </div>
          </div>

          <Button
            variant="accent"
            size="xl"
            fullWidth
            disabled={creating || selected.length !== 8 || !name.trim() || !seasonId}
            onClick={() => void create()}
          >
            {creating ? t('premierLeague.admin.creating') : t('premierLeague.createCompetition')}
          </Button>
        </section>
      ) : (
        <>
          <section className="mb-6 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="text-2xl font-black">{competition.name}</h2>
                <p className="text-sm text-[var(--color-text-dim)]">{t(`premierLeague.competitionStatus.${competition.status}`)}</p>
              </div>
              <Button variant="surface" size="md" onClick={() => void correctLast()}>
                {t('premierLeague.admin.correctLast')}
              </Button>
            </div>
          </section>

          <section>
            <h2 className="mb-2 text-xl font-black">{t('premierLeague.admin.brackets')}</h2>
            <p className="mb-4 text-sm text-[var(--color-text-dim)]">{t('premierLeague.admin.bracketHelp')}</p>
            <div className="space-y-3">
              {competition.nights
                .filter((night) => night.stage === 'LEAGUE')
                .map((night) => (
                  <BracketEditor
                    key={night.id}
                    competition={competition}
                    night={night}
                    onUpdated={(updated) => setCompetition(updated)}
                    onError={(cause) => setError(premierLeagueErrorText(t, cause))}
                  />
                ))}
            </div>
          </section>
        </>
      )}
    </div>
  );
}

function BracketEditor({
  competition,
  night,
  onUpdated,
  onError,
}: {
  competition: PremierLeagueCompetition;
  night: PremierLeagueNight;
  onUpdated: (competition: PremierLeagueCompetition) => void;
  onError: (cause: unknown) => void;
}) {
  const confirm = useConfirm();
  const { t } = useT();
  const quarters = night.fixtures
    .filter((fixture) => fixture.round === 'QUARTER_FINAL')
    .sort((a, b) => a.fixtureOrder - b.fixtureOrder);
  const [pairings, setPairings] = useState<Array<[string, string]>>(
    quarters.map((fixture) => [fixture.playerAId!, fixture.playerBId!]),
  );
  const started = night.fixtures.some((fixture) => ['IN_PROGRESS', 'FINISHED'].includes(fixture.status));
  const unlocked = competition.settings.adminUnlockedNightNumbers.includes(night.nightNumber ?? 0);

  const save = async () => {
    let force = false;
    if (started) {
      force = await confirm({
        title: t('premierLeague.admin.lockedTitle'),
        message: t('premierLeague.admin.lockedMessage'),
        confirmLabel: t('premierLeague.admin.forceEdit'),
        danger: true,
      });
      if (!force) return;
    }
    try {
      onUpdated(await updatePremierLeagueQuarterFinals(competition.id, night.id, pairings, force));
    } catch (cause) {
      onError(cause);
    }
  };

  const toggleOverride = async () => {
    if (!night.nightNumber || night.nightNumber === 1) return;
    if (!unlocked) {
      const ok = await confirm({
        title: t('premierLeague.admin.unlockTitle'),
        message: t('premierLeague.admin.unlockMessage'),
        confirmLabel: t('premierLeague.admin.unlockAction'),
        danger: true,
      });
      if (!ok) return;
    }
    try {
      onUpdated(await setPremierLeagueNightAdminOverride(competition.id, night.nightNumber, !unlocked));
    } catch (cause) {
      onError(cause);
    }
  };

  return (
    <details className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
      <summary className="cursor-pointer font-black">
        {t('premierLeague.night').replace('{number}', String(night.nightNumber))} · {t(`premierLeague.nightStatus.${night.status}`)}
      </summary>
      <div className="mt-4 space-y-3">
        {pairings.map((pairing, pairIndex) => (
          <div key={pairIndex} className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
            {[0, 1].map((side) => (
              <span key={side} className="contents">
                {side === 1 && <span className="text-center text-xs text-[var(--color-text-dim)]">{t('common.vs')}</span>}
                <select
                  value={pairing[side]}
                  onChange={(event) => setPairings((current) => current.map((pair, index) => index === pairIndex ? (side === 0 ? [event.target.value, pair[1]] : [pair[0], event.target.value]) : pair))}
                  className="min-w-0 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 py-2"
                >
                  {competition.players.map((player) => <option key={player.playerId} value={player.playerId}>{player.name}</option>)}
                </select>
              </span>
            ))}
          </div>
        ))}
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button variant="accent" size="md" onClick={() => void save()}>
            {t('premierLeague.admin.saveBracket')}
          </Button>
          {night.nightNumber !== 1 && (
            <Button variant="surface" size="md" onClick={() => void toggleOverride()}>
              {unlocked ? t('premierLeague.admin.removeOverride') : t('premierLeague.admin.allowFuture')}
            </Button>
          )}
        </div>
      </div>
    </details>
  );
}
