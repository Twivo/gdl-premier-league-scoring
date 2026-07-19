import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { getRepository } from '@/data';
import { buildGameState } from '@/domain/engine';
import {
  canStartFixture,
  fixturesForTarget,
  isValidTargetNumber,
  targetNumbers,
  type PremierLeagueCompetition,
  type TargetFixture,
} from '@/domain/premierLeague';
import { cn } from '@/lib/cn';
import { useAuth } from '@/store/AuthContext';
import { LangToggle, useT } from '@/store/LangContext';
import { subscribePremierLeagueChanges } from '@/store/premierLeagueLive';
import {
  launchPremierLeagueFixture,
  loadCurrentPremierLeagueCompetition,
} from '@/store/premierLeagueService';
import { premierLeagueErrorText } from '@/features/premierLeague/errors';

const TARGET_STORAGE_KEY = 'darts:scoring-station:target:v1';

interface LiveScore {
  legsA: number;
  legsB: number;
}

function storedTarget(): number | null {
  try {
    const value = Number(localStorage.getItem(TARGET_STORAGE_KEY));
    return isValidTargetNumber(value) ? value : null;
  } catch {
    return null;
  }
}

function rememberTarget(value: number | null): void {
  try {
    if (value == null) localStorage.removeItem(TARGET_STORAGE_KEY);
    else localStorage.setItem(TARGET_STORAGE_KEY, String(value));
  } catch {
    // The station remains usable when browser storage is unavailable.
  }
}

export function ScoringStationHome() {
  const navigate = useNavigate();
  const { t } = useT();
  const { user, adminAvailable, signOut } = useAuth();
  const [competition, setCompetition] =
    useState<PremierLeagueCompetition | null>(null);
  const [selectedTarget, setSelectedTarget] = useState<number | null>(
    storedTarget,
  );
  const [loading, setLoading] = useState(true);
  const [liveScores, setLiveScores] = useState<Record<string, LiveScore>>({});
  const [starterSelection, setStarterSelection] =
    useState<TargetFixture | null>(null);
  const [launching, setLaunching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const current = await loadCurrentPremierLeagueCompetition();
    setCompetition(current);
    if (!current) {
      setLiveScores({});
      setLoading(false);
      return;
    }
    const fixtures = current.nights
      .flatMap((night) => night.fixtures)
      .filter((fixture) => fixture.matchId);
    const rows = await Promise.all(
      fixtures.map(async (fixture) => {
        const match = await getRepository().getMatch(fixture.matchId!);
        if (!match) return null;
        const state = buildGameState(match.config, match.events);
        return [
          fixture.id,
          { legsA: state.legsWon.A ?? 0, legsB: state.legsWon.B ?? 0 },
        ] as const;
      }),
    );
    setLiveScores(
      Object.fromEntries(
        rows.filter((row): row is NonNullable<typeof row> => !!row),
      ),
    );
    setLoading(false);
  }, []);

  useEffect(() => {
    void refresh();
    const unsubscribe = subscribePremierLeagueChanges(() => void refresh());
    const poll = window.setInterval(() => void refresh(), 5000);
    const onFocus = () => void refresh();
    window.addEventListener('focus', onFocus);
    return () => {
      unsubscribe();
      window.clearInterval(poll);
      window.removeEventListener('focus', onFocus);
    };
  }, [refresh]);

  const knownTargets = useMemo(
    () => (competition ? targetNumbers(competition) : []),
    [competition],
  );
  const assigned = useMemo(
    () =>
      competition && selectedTarget != null
        ? fixturesForTarget(competition, selectedTarget)
        : [],
    [competition, selectedTarget],
  );
  const active = assigned.filter(({ fixture }) => fixture.status !== 'FINISHED');
  const finished = assigned.filter(({ fixture }) => fixture.status === 'FINISHED');
  const nextFixtureId = active.find(({ night, fixture }) =>
    canStartFixture(competition!, night.id, fixture.id),
  )?.fixture.id;

  const selectTarget = (targetNumber: number) => {
    setSelectedTarget(targetNumber);
    rememberTarget(targetNumber);
  };

  const changeTarget = () => {
    setSelectedTarget(null);
    rememberTarget(null);
    setStarterSelection(null);
    setError(null);
  };

  const openFixture = (selection: TargetFixture) => {
    if (!competition) return;
    const { night, fixture } = selection;
    if (!canStartFixture(competition, night.id, fixture.id)) return;
    if (adminAvailable && !user) {
      navigate('/login');
      return;
    }
    if (fixture.matchId) {
      navigate(`/game/${fixture.matchId}`);
      return;
    }
    setStarterSelection(selection);
  };

  const launch = async (starterPlayerId: string) => {
    if (!competition || !starterSelection || launching) return;
    setLaunching(true);
    setError(null);
    try {
      const matchId = await launchPremierLeagueFixture(
        competition.id,
        starterSelection.night.id,
        starterSelection.fixture.id,
        starterPlayerId,
      );
      navigate(`/game/${matchId}`);
    } catch (cause) {
      setError(premierLeagueErrorText(t, cause));
      setLaunching(false);
    }
  };

  const nameOf = (id: string | null | undefined) =>
    competition?.players.find((player) => player.playerId === id)?.name ??
    t('premierLeague.toBeDetermined');

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        {t('common.loading')}
      </div>
    );
  }

  return (
    <div className="mx-auto min-h-screen max-w-5xl px-4 py-5 sm:px-6 sm:py-8">
      <header className="mb-7 flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.22em] text-[var(--color-accent)]">
            {t('scoringStation.eyebrow')}
          </p>
          <h1 className="mt-1 text-3xl font-black sm:text-5xl">
            {selectedTarget == null
              ? t('scoringStation.title')
              : t('scoringStation.targetTitle').replace(
                  '{number}',
                  String(selectedTarget),
                )}
          </h1>
          {competition && (
            <p className="mt-2 text-sm text-[var(--color-text-dim)] sm:text-base">
              {competition.name} · {t('premierLeague.fixedFormat')}
            </p>
          )}
        </div>
        <div className="flex flex-col items-end gap-2">
          <LangToggle />
          <ConnectionAction
            connected={!!user || !adminAvailable}
            local={!adminAvailable}
            onLogin={() => navigate('/login')}
            onLogout={() => void signOut()}
          />
        </div>
      </header>

      {selectedTarget == null ? (
        <TargetPicker knownTargets={knownTargets} onSelect={selectTarget} />
      ) : (
        <>
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
            <div>
              <p className="font-black">
                {t('scoringStation.stationReady').replace(
                  '{number}',
                  String(selectedTarget),
                )}
              </p>
              <p className="mt-1 text-sm text-[var(--color-text-dim)]">
                {t('scoringStation.autoRefresh')}
              </p>
            </div>
            <Button variant="surface" onClick={changeTarget}>
              {t('scoringStation.changeTarget')}
            </Button>
          </div>

          {!competition ? (
            <EmptyState
              icon="↻"
              title={t('scoringStation.waitingTournament')}
              text={t('scoringStation.waitingTournamentHelp')}
            />
          ) : active.length === 0 && finished.length === 0 ? (
            <EmptyState
              icon="🎯"
              title={t('scoringStation.noAssignedMatches')}
              text={t('scoringStation.noAssignedMatchesHelp')}
            />
          ) : (
            <div className="space-y-8">
              <section>
                <h2 className="mb-4 text-xl font-black sm:text-2xl">
                  {t('scoringStation.matchesToPlay')}
                </h2>
                {active.length ? (
                  <div className="grid gap-4 md:grid-cols-2">
                    {active.map((selection) => (
                      <TargetMatchCard
                        key={selection.fixture.id}
                        competition={competition}
                        selection={selection}
                        liveScore={liveScores[selection.fixture.id]}
                        highlighted={selection.fixture.id === nextFixtureId}
                        onClick={() => openFixture(selection)}
                      />
                    ))}
                  </div>
                ) : (
                  <p className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 text-center text-[var(--color-text-dim)]">
                    {t('scoringStation.noPendingMatches')}
                  </p>
                )}
              </section>

              {finished.length > 0 && (
                <section>
                  <h2 className="mb-4 text-lg font-black text-[var(--color-text-dim)]">
                    {t('scoringStation.finishedMatches')}
                  </h2>
                  <div className="grid gap-3 opacity-75 md:grid-cols-2">
                    {finished.map((selection) => (
                      <TargetMatchCard
                        key={selection.fixture.id}
                        competition={competition}
                        selection={selection}
                        liveScore={liveScores[selection.fixture.id]}
                        highlighted={false}
                        onClick={() => undefined}
                      />
                    ))}
                  </div>
                </section>
              )}
            </div>
          )}
        </>
      )}

      <Modal
        open={!!starterSelection}
        onClose={() => !launching && setStarterSelection(null)}
        title={t('premierLeague.chooseStarter')}
        closeOnBackdrop={!launching}
      >
        <p className="mb-4 text-sm text-[var(--color-text-dim)]">
          {t('premierLeague.starterAlternates')}
        </p>
        <div className="flex flex-col gap-3">
          {[
            starterSelection?.fixture.playerAId,
            starterSelection?.fixture.playerBId,
          ]
            .filter((id): id is string => !!id)
            .map((id) => (
              <Button
                key={id}
                variant="accent"
                size="xl"
                fullWidth
                disabled={launching}
                onClick={() => void launch(id)}
              >
                {nameOf(id)}
              </Button>
            ))}
          {error && (
            <p className="text-sm text-[var(--color-warning)]">{error}</p>
          )}
        </div>
      </Modal>
    </div>
  );
}

function TargetPicker({
  knownTargets,
  onSelect,
}: {
  knownTargets: number[];
  onSelect: (targetNumber: number) => void;
}) {
  const { t } = useT();
  const [draft, setDraft] = useState(
    knownTargets.length === 1 ? String(knownTargets[0]) : '',
  );
  const value = Number(draft);
  const valid = isValidTargetNumber(value);

  return (
    <section className="mx-auto max-w-xl rounded-3xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 text-center shadow-xl sm:p-10">
      <div className="text-6xl">🎯</div>
      <h2 className="mt-4 text-2xl font-black sm:text-3xl">
        {t('scoringStation.chooseTarget')}
      </h2>
      <p className="mx-auto mt-2 max-w-md text-[var(--color-text-dim)]">
        {t('scoringStation.chooseTargetHelp')}
      </p>
      <form
        className="mt-7 flex flex-col gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          if (valid) onSelect(value);
        }}
      >
        <label htmlFor="target-number" className="text-left text-sm font-bold">
          {t('scoringStation.targetNumber')}
        </label>
        <input
          id="target-number"
          type="number"
          inputMode="numeric"
          min="1"
          max="999"
          step="1"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder={t('scoringStation.targetPlaceholder')}
          list="known-targets"
          autoFocus
          className="h-24 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-2)] px-5 text-center text-5xl font-black tabular-nums outline-none focus:border-[var(--color-accent)]"
        />
        <datalist id="known-targets">
          {knownTargets.map((number) => (
            <option key={number} value={number} />
          ))}
        </datalist>
        {knownTargets.length > 0 && (
          <div className="flex flex-wrap justify-center gap-2">
            {knownTargets.map((number) => (
              <button
                key={number}
                type="button"
                onClick={() => setDraft(String(number))}
                className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)] px-4 py-2 font-black hover:border-[var(--color-accent)]"
              >
                {number}
              </button>
            ))}
          </div>
        )}
        <Button
          type="submit"
          variant="accent"
          size="xl"
          fullWidth
          disabled={!valid}
        >
          {t('scoringStation.openTarget')}
        </Button>
      </form>
    </section>
  );
}

function TargetMatchCard({
  competition,
  selection,
  liveScore,
  highlighted,
  onClick,
}: {
  competition: PremierLeagueCompetition;
  selection: TargetFixture;
  liveScore?: LiveScore;
  highlighted: boolean;
  onClick: () => void;
}) {
  const { t } = useT();
  const { night, fixture } = selection;
  const playable = canStartFixture(competition, night.id, fixture.id);
  const score =
    fixture.status === 'FINISHED'
      ? { legsA: fixture.legsA, legsB: fixture.legsB }
      : liveScore ?? { legsA: fixture.legsA, legsB: fixture.legsB };
  const nameOf = (id: string | null) =>
    id
      ? competition.players.find((player) => player.playerId === id)?.name ??
        t('common.dash')
      : t('premierLeague.toBeDetermined');
  const action =
    fixture.status === 'FINISHED'
      ? t('premierLeague.finished')
      : fixture.matchId
        ? t('premierLeague.resume')
        : playable
          ? t('premierLeague.start')
          : t('premierLeague.blocked');
  const nightLabel =
    night.stage === 'FINALS'
      ? t('premierLeague.finalsNight')
      : t('premierLeague.night').replace(
          '{number}',
          String(night.nightNumber),
        );

  return (
    <button
      type="button"
      disabled={!playable || fixture.status === 'FINISHED'}
      onClick={onClick}
      className={cn(
        'rounded-2xl border bg-[var(--color-surface)] p-5 text-left transition-all',
        playable && fixture.status !== 'FINISHED'
          ? 'cursor-pointer hover:-translate-y-0.5 hover:border-[var(--color-accent)] hover:shadow-xl'
          : 'cursor-default',
        highlighted
          ? 'border-[var(--color-accent)] shadow-[0_0_34px_-15px_var(--color-accent)]'
          : 'border-[var(--color-border)]',
      )}
    >
      <div className="mb-4 flex items-start justify-between gap-3 text-xs font-black uppercase tracking-wide">
        <div>
          <p className="text-[var(--color-accent)]">{nightLabel}</p>
          <p className="mt-1 text-[var(--color-text-dim)]">
            {t(`premierLeague.round.${fixture.round}`)} ·{' '}
            {t('premierLeague.bestOf').replace(
              '{number}',
              String(fixture.bestOf),
            )}
          </p>
        </div>
        {highlighted && (
          <span className="rounded-full bg-[var(--color-accent)] px-2.5 py-1 text-white">
            {t('scoringStation.next')}
          </span>
        )}
      </div>
      <PlayerScore
        name={nameOf(fixture.playerAId)}
        legs={score.legsA}
        winner={fixture.winnerPlayerId === fixture.playerAId}
      />
      <PlayerScore
        name={nameOf(fixture.playerBId)}
        legs={score.legsB}
        winner={fixture.winnerPlayerId === fixture.playerBId}
      />
      <div className="mt-4 flex items-center justify-between border-t border-[var(--color-border)] pt-4 text-sm">
        <span className="text-[var(--color-text-dim)]">
          {t(`premierLeague.fixtureStatus.${fixture.status}`)}
        </span>
        <span
          className={cn(
            'font-black',
            playable && fixture.status !== 'FINISHED' &&
              'text-[var(--color-accent)]',
          )}
        >
          {action}
        </span>
      </div>
    </button>
  );
}

function PlayerScore({
  name,
  legs,
  winner,
}: {
  name: string;
  legs: number;
  winner: boolean;
}) {
  return (
    <div
      className={cn(
        'flex items-center justify-between gap-3 rounded-xl px-3 py-3',
        winner &&
          'bg-[color-mix(in_srgb,var(--color-accent)_15%,transparent)]',
      )}
    >
      <span className="min-w-0 truncate text-lg font-black">
        {name} {winner && '🏆'}
      </span>
      <span className="text-3xl font-black tabular-nums">{legs}</span>
    </div>
  );
}

function EmptyState({
  icon,
  title,
  text,
}: {
  icon: string;
  title: string;
  text: string;
}) {
  return (
    <section className="rounded-3xl border border-dashed border-[var(--color-border)] bg-[var(--color-surface)] p-10 text-center">
      <div className="text-5xl">{icon}</div>
      <h2 className="mt-4 text-2xl font-black">{title}</h2>
      <p className="mx-auto mt-2 max-w-lg text-[var(--color-text-dim)]">{text}</p>
    </section>
  );
}

function ConnectionAction({
  connected,
  local,
  onLogin,
  onLogout,
}: {
  connected: boolean;
  local: boolean;
  onLogin: () => void;
  onLogout: () => void;
}) {
  const { t } = useT();
  return (
    <button
      type="button"
      onClick={connected && !local ? onLogout : local ? undefined : onLogin}
      className="text-right text-xs font-bold text-[var(--color-text-dim)] hover:text-[var(--color-text)]"
    >
      <span
        className={cn(
          'mr-1 inline-block h-2 w-2 rounded-full',
          connected ? 'bg-[var(--color-success)]' : 'bg-[var(--color-warning)]',
        )}
      />
      {local
        ? t('scoringStation.localMode')
        : connected
          ? t('scoringStation.connectedLogout')
          : t('scoringStation.login')}
    </button>
  );
}
