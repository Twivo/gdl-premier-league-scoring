import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { QrCode } from '@/components/QrCode';
import { buildGameState } from '@/domain/engine';
import { listResumable } from '@/store/matchService';
import { listResumableEncounters } from '@/store/encounterService';
import { listLiveMatches } from '@/store/liveMatch';
import { useT, LangToggle } from '@/store/LangContext';
import { useAuth } from '@/store/AuthContext';
import { participantLabel } from '@/domain/presentation';
import type { EncounterRecord, MatchRecord } from '@/data/types';

const CELEBRATION_RULE_KEYS = Array.from(
  { length: 10 },
  (_, i) => `home.celebrationRule.${i + 1}`,
);

export function HomeScreen() {
  const navigate = useNavigate();
  const { t } = useT();
  const { user, isCaptain, signOut } = useAuth();
  const [resumable, setResumable] = useState<MatchRecord[]>([]);
  const [encounters, setEncounters] = useState<EncounterRecord[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [liveCount, setLiveCount] = useState(0);
  const [rulesOpen, setRulesOpen] = useState(false);
  const liveUrl = `${window.location.origin}${window.location.pathname}${window.location.search}#/live`;

  useEffect(() => {
    let alive = true;
    const refresh = () =>
      listLiveMatches().then((m) => alive && setLiveCount(m.length));
    void refresh();
    const poll = window.setInterval(() => void refresh(), 8000);
    return () => {
      alive = false;
      window.clearInterval(poll);
    };
  }, []);

  useEffect(() => {
    let alive = true;
    Promise.all([listResumable(), listResumableEncounters()])
      .then(([m, e]) => {
        if (!alive) return;
        setResumable(m);
        setEncounters(e);
      })
      .finally(() => alive && setLoaded(true));
    return () => {
      alive = false;
    };
  }, []);

  const describe = (m: MatchRecord) => {
    const state = buildGameState(m.config, m.events);
    const sides = m.config.participants
      .map((p) => participantLabel(m.config, p.id))
      .join(` ${t('common.vs')} `);
    const legs = Object.values(state.legsWon).join(' – ');
    return { sides, legs };
  };

  return (
    <div className="relative mx-auto flex min-h-screen max-w-lg flex-col items-center justify-center gap-10 px-6 py-12">
      <div className="absolute right-4 top-4 flex items-center gap-2">
        <button
          onClick={user ? () => void signOut() : () => navigate('/login')}
          className="rounded-lg border border-[var(--color-border)] px-2.5 py-1 text-xs font-bold text-[var(--color-text-dim)] transition-colors hover:text-[var(--color-text)]"
        >
          {t(user ? 'admin.signOut' : 'admin.signIn')}
        </button>
        <LangToggle />
      </div>
      <div className="text-center">
        <img
          src="./home-logo.png"
          alt="GenevaDartsConnect"
          className="mx-auto mb-4 h-auto w-64 max-w-[82vw] drop-shadow-2xl sm:w-72"
          draggable={false}
        />
        <h1 className="text-4xl font-black tracking-tight sm:text-5xl">
          GenevaDarts
          <span className="block text-[var(--color-accent)] sm:inline">Connect</span>
        </h1>
        <p className="mt-2 text-sm text-[var(--color-text-dim)]">
          {t('home.tagline')}
        </p>
      </div>

      {encounters.length > 0 && (
        <div className="w-full rounded-2xl border border-[var(--color-accent)] bg-[var(--color-surface)] p-5 shadow-[0_8px_40px_-12px_var(--color-accent)]">
          <p className="mb-3 text-lg font-bold">{t('home.champInProgress')}</p>
          <div className="flex flex-col gap-2">
            {encounters.map((e) => (
              <button
                key={e.id}
                onClick={() => navigate(`/championship/${e.id}`)}
                className="flex items-center justify-between rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)] px-4 py-3 text-left transition-colors hover:border-[var(--color-accent)]"
              >
                <span>
                  <span className="block font-semibold">
                    {e.plan.teams.A.name} {t('common.vs')} {e.plan.teams.B.name}
                  </span>
                  <span className="text-xs text-[var(--color-text-dim)]">
                    {e.scoreA} – {e.scoreB} · {t('home.match')}{' '}
                    {Math.min(e.currentIndex + 1, e.plan.fixtures.length)}/
                    {e.plan.fixtures.length}
                  </span>
                </span>
                <span className="text-sm font-bold text-[var(--color-accent)]">
                  {t('home.resume')}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {resumable.length > 0 && (
        <div className="w-full rounded-2xl border border-[var(--color-accent)] bg-[var(--color-surface)] p-5 shadow-[0_8px_40px_-12px_var(--color-accent)]">
          <p className="mb-3 text-lg font-bold">
            {resumable.length === 1
              ? t('home.gameInProgress')
              : `${resumable.length} ${t('home.gamesInProgress')}`}
          </p>
          <div className="flex flex-col gap-2">
            {resumable.map((m) => {
              const { sides, legs } = describe(m);
              return (
                <button
                  key={m.id}
                  onClick={() => navigate(`/game/${m.id}`)}
                  className="flex items-center justify-between rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)] px-4 py-3 text-left transition-colors hover:border-[var(--color-accent)]"
                >
                  <span>
                    <span className="block font-semibold">{sides}</span>
                    <span className="text-xs text-[var(--color-text-dim)]">
                      {m.variant} {t(m.mode === 'DOUBLE' ? 'game.doubles' : 'game.singles')} ·
                      {t('game.legs')} {legs}
                    </span>
                  </span>
                  <span className="text-sm font-bold text-[var(--color-accent)]">
                    {t('home.resume')}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      <Button
        variant="accent"
        size="xl"
        fullWidth
        onClick={() => navigate('/new')}
      >
        {t('home.new')}
      </Button>

      <Button
        variant="surface"
        size="xl"
        fullWidth
        onClick={() => navigate('/team')}
      >
        {t('home.championship')}
      </Button>

      <Button
        variant="surface"
        size="lg"
        fullWidth
        onClick={() => navigate('/live')}
      >
        {t('home.live')}
        {liveCount > 0 && (
          <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-[var(--color-accent)] px-2 py-0.5 text-xs font-bold text-white">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" />
            {liveCount}
          </span>
        )}
      </Button>

      <Button
        variant="surface"
        size="lg"
        fullWidth
        onClick={() => navigate(isCaptain ? '/team/stats' : '/admin/players')}
      >
        {t('home.admin')}
      </Button>

      <div className="flex w-full items-center gap-4 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
        <QrCode value={liveUrl} size={104} />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold">{t('live.scanShort')}</p>
          <p className="mt-1 text-xs font-semibold text-[var(--color-accent)]">
            {t('home.live')}
          </p>
        </div>
      </div>

      <button
        onClick={() => setRulesOpen(true)}
        className="-mt-7 rounded-lg px-3 py-1.5 text-xs font-semibold text-[var(--color-text-mute)] underline-offset-4 hover:text-[var(--color-accent)] hover:underline"
      >
        {t('home.celebrationRulesButton')}
      </button>

      {!loaded && (
        <p className="text-xs text-[var(--color-text-mute)]">{t('home.syncing')}</p>
      )}

      <Modal
        open={rulesOpen}
        onClose={() => setRulesOpen(false)}
        title={t('home.celebrationRulesTitle')}
      >
        <ol className="space-y-3 text-sm leading-relaxed text-[var(--color-text-dim)]">
          {CELEBRATION_RULE_KEYS.map((key, i) => (
            <li key={key} className="flex gap-3">
              <span className="shrink-0 font-black text-[var(--color-accent)]">
                {i + 1}.
              </span>
              <span>{t(key)}</span>
            </li>
          ))}
        </ol>
        <Button
          variant="ghost"
          size="md"
          fullWidth
          className="mt-5"
          onClick={() => setRulesOpen(false)}
        >
          {t('common.close')}
        </Button>
      </Modal>
    </div>
  );
}
