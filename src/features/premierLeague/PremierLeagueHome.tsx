import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { getRepository } from '@/data';
import { buildGameState } from '@/domain/engine';
import {
  calculateStandings,
  canStartFixture,
  type PremierLeagueCompetition,
  type PremierLeagueFixture,
  type PremierLeagueNight,
} from '@/domain/premierLeague';
import { useAuth } from '@/store/AuthContext';
import { LangToggle, useT } from '@/store/LangContext';
import {
  launchPremierLeagueFixture,
  loadCurrentPremierLeagueCompetition,
} from '@/store/premierLeagueService';
import { NightBracket, type FixtureLiveScore } from './NightBracket';
import { StandingsTable } from './StandingsTable';
import { premierLeagueErrorText } from './errors';

export function PremierLeagueHome() {
  const navigate = useNavigate();
  const location = useLocation();
  const { nightNumber } = useParams<{ nightNumber: string }>();
  const { t, lang } = useT();
  const { user, adminAvailable } = useAuth();
  const [competition, setCompetition] = useState<PremierLeagueCompetition | null>(null);
  const [loading, setLoading] = useState(true);
  const [liveScores, setLiveScores] = useState<Record<string, FixtureLiveScore>>({});
  const [starterFixture, setStarterFixture] = useState<PremierLeagueFixture | null>(null);
  const [launching, setLaunching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const current = await loadCurrentPremierLeagueCompetition();
    setCompetition(current);
    if (current) {
      const fixtures = current.nights.flatMap((night) => night.fixtures).filter((fixture) => fixture.matchId);
      const rows = await Promise.all(
        fixtures.map(async (fixture) => {
          const match = await getRepository().getMatch(fixture.matchId!);
          if (!match) return null;
          const state = buildGameState(match.config, match.events);
          return [fixture.id, { legsA: state.legsWon.A ?? 0, legsB: state.legsWon.B ?? 0 }] as const;
        }),
      );
      setLiveScores(Object.fromEntries(rows.filter((row): row is NonNullable<typeof row> => !!row)));
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void refresh();
    const poll = window.setInterval(() => void refresh(), 5000);
    return () => window.clearInterval(poll);
  }, [refresh]);

  const standings = useMemo(
    () => (competition ? calculateStandings(competition) : []),
    [competition],
  );
  const isStandings = location.pathname.endsWith('/standings');
  const isFinals = location.pathname.endsWith('/finals');
  const selectedNight = useMemo((): PremierLeagueNight | undefined => {
    if (!competition) return undefined;
    if (isFinals) return competition.nights.find((night) => night.stage === 'FINALS');
    if (nightNumber) {
      return competition.nights.find(
        (night) => night.stage === 'LEAGUE' && night.nightNumber === Number(nightNumber),
      );
    }
    return (
      competition.nights.find((night) => night.stage === 'LEAGUE' && night.status !== 'FINISHED') ??
      competition.nights.find((night) => night.stage === 'FINALS') ??
      competition.nights[6]
    );
  }, [competition, isFinals, nightNumber]);

  const onFixture = (fixture: PremierLeagueFixture) => {
    if (!competition || !selectedNight) return;
    if (fixture.status === 'IN_PROGRESS' && fixture.matchId) {
      navigate(`/game/${fixture.matchId}`);
      return;
    }
    if (!canStartFixture(competition, selectedNight.id, fixture.id)) return;
    if (adminAvailable && !user) {
      navigate('/premier-league/admin');
      return;
    }
    setStarterFixture(fixture);
  };

  const launch = async (starterPlayerId: string) => {
    if (!competition || !selectedNight || !starterFixture || launching) return;
    setLaunching(true);
    setError(null);
    try {
      const matchId = await launchPremierLeagueFixture(
        competition.id,
        selectedNight.id,
        starterFixture.id,
        starterPlayerId,
      );
      navigate(`/game/${matchId}`);
    } catch (cause) {
      setError(premierLeagueErrorText(t, cause));
      setLaunching(false);
    }
  };

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center">{t('common.loading')}</div>;
  }

  if (!competition) {
    return (
      <div className="mx-auto flex min-h-screen max-w-lg flex-col items-center justify-center gap-6 px-6 text-center">
        <LangToggle />
        <div className="text-6xl">🎯</div>
        <h1 className="text-3xl font-black">{t('premierLeague.title')}</h1>
        <p className="text-[var(--color-text-dim)]">{t('premierLeague.noCompetition')}</p>
        <Button variant="accent" size="xl" fullWidth onClick={() => navigate('/premier-league/admin')}>
          {t('premierLeague.createCompetition')}
        </Button>
      </div>
    );
  }

  const finals = competition.nights.find((night) => night.stage === 'FINALS');
  const nameOf = (id: string | null | undefined) =>
    competition.players.find((player) => player.playerId === id)?.name ?? t('common.dash');

  return (
    <div className="mx-auto min-h-screen max-w-7xl px-3 py-4 sm:px-6 sm:py-6">
      <header className="mb-5 flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.2em] text-[var(--color-accent)]">
            {t('premierLeague.title')}
          </p>
          <h1 className="mt-1 text-2xl font-black sm:text-4xl">{competition.name}</h1>
          <p className="mt-1 text-sm text-[var(--color-text-dim)]">
            {t('premierLeague.fixedFormat')}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <LangToggle />
          <button
            type="button"
            onClick={() => navigate('/premier-league/admin')}
            className="rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-sm text-[var(--color-text-dim)] hover:border-[var(--color-accent)]"
            aria-label={t('premierLeague.organizer')}
            title={t('premierLeague.organizer')}
          >
            ⚙
          </button>
        </div>
      </header>

      <nav className="mb-6 flex flex-wrap gap-2" aria-label={t('premierLeague.navigation')}>
        {Array.from({ length: 7 }, (_, index) => index + 1).map((number) => (
          <NavButton
            key={number}
            active={!isFinals && !isStandings && selectedNight?.nightNumber === number}
            onClick={() => navigate(`/premier-league/night/${number}`)}
            label={t('premierLeague.night').replace('{number}', String(number))}
          />
        ))}
        <NavButton
          active={isFinals}
          disabled={!finals}
          onClick={() => navigate('/premier-league/finals')}
          label={t('premierLeague.finalsNight')}
        />
        <NavButton
          active={isStandings}
          onClick={() => navigate('/premier-league/standings')}
          label={t('premierLeague.standings')}
        />
      </nav>

      {competition.status === 'FINISHED' && finals && (
        <section className="mb-7 rounded-3xl border border-[var(--color-accent)] bg-[var(--color-surface)] p-6 text-center shadow-[0_12px_50px_-25px_var(--color-accent)]">
          <div className="text-5xl">🏆</div>
          <h2 className="mt-2 text-2xl font-black">
            {t('premierLeague.champion').replace('{player}', nameOf(competition.championPlayerId))}
          </h2>
          <FinalPodium competition={competition} finals={finals} />
        </section>
      )}

      {isStandings ? (
        <section>
          <h2 className="mb-4 text-2xl font-black">{t('premierLeague.generalStandings')}</h2>
          <StandingsTable standings={standings} />
        </section>
      ) : selectedNight ? (
        <>
          <section className="mb-8">
            <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="text-2xl font-black">
                  {selectedNight.stage === 'FINALS'
                    ? t('premierLeague.finalsNight')
                    : t('premierLeague.night').replace('{number}', String(selectedNight.nightNumber))}
                </h2>
                {selectedNight.scheduledAt && (
                  <p className="mt-1 text-sm text-[var(--color-text-dim)]">
                    {new Intl.DateTimeFormat(lang, { dateStyle: 'long' }).format(new Date(selectedNight.scheduledAt))}
                  </p>
                )}
              </div>
              <span className="rounded-full bg-[var(--color-surface-2)] px-3 py-1 text-sm font-bold text-[var(--color-accent)]">
                {t(`premierLeague.nightStatus.${selectedNight.status}`)}
              </span>
            </div>
            <NightBracket
              competition={competition}
              night={selectedNight}
              liveScores={liveScores}
              onFixture={onFixture}
            />
          </section>
          <section>
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className="text-2xl font-black">{t('premierLeague.generalStandings')}</h2>
              <button
                type="button"
                onClick={() => navigate('/premier-league/standings')}
                className="text-sm font-bold text-[var(--color-accent)] hover:underline"
              >
                {t('premierLeague.fullStandings')}
              </button>
            </div>
            <StandingsTable standings={standings} />
          </section>
        </>
      ) : (
        <p className="rounded-2xl border border-[var(--color-border)] p-6 text-center text-[var(--color-text-dim)]">
          {t('premierLeague.finalsUnavailable')}
        </p>
      )}

      <Modal
        open={!!starterFixture}
        onClose={() => !launching && setStarterFixture(null)}
        title={t('premierLeague.chooseStarter')}
        closeOnBackdrop={!launching}
      >
        <p className="mb-4 text-sm text-[var(--color-text-dim)]">
          {t('premierLeague.starterAlternates')}
        </p>
        <div className="flex flex-col gap-3">
          {[starterFixture?.playerAId, starterFixture?.playerBId]
            .filter((id): id is string => !!id)
            .map((id) => (
              <Button key={id} variant="accent" size="xl" fullWidth disabled={launching} onClick={() => void launch(id)}>
                {nameOf(id)}
              </Button>
            ))}
          {error && <p className="text-sm text-[var(--color-warning)]">{error}</p>}
        </div>
      </Modal>
    </div>
  );
}

function NavButton({
  active,
  disabled,
  onClick,
  label,
}: {
  active: boolean;
  disabled?: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={
        'rounded-xl border px-3 py-2 text-sm font-bold transition-colors ' +
        (active
          ? 'border-[var(--color-accent)] bg-[var(--color-accent)] text-white'
          : 'border-[var(--color-border)] bg-[var(--color-surface)] hover:border-[var(--color-accent)]') +
        (disabled ? ' cursor-not-allowed opacity-40' : '')
      }
    >
      {label}
    </button>
  );
}

function FinalPodium({
  competition,
  finals,
}: {
  competition: PremierLeagueCompetition;
  finals: PremierLeagueNight;
}) {
  const { t } = useT();
  const nameOf = (id: string | null | undefined) =>
    competition.players.find((player) => player.playerId === id)?.name ?? t('common.dash');
  const final = finals.fixtures.find((fixture) => fixture.round === 'FINAL');
  const finalist = final?.winnerPlayerId === final?.playerAId ? final?.playerBId : final?.playerAId;
  const semiFinalists = finals.fixtures
    .filter((fixture) => fixture.round === 'SEMI_FINAL')
    .map((fixture) => fixture.winnerPlayerId === fixture.playerAId ? fixture.playerBId : fixture.playerAId);
  return (
    <p className="mt-3 text-sm text-[var(--color-text-dim)]">
      {t('premierLeague.finalist')}: {nameOf(finalist)} · {t('premierLeague.semiFinalists')}: {semiFinalists.map(nameOf).join(', ')}
    </p>
  );
}
