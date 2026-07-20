import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/cn';
import { getRepository } from '@/data';
import type { TeamWithPlayers } from '@/data/types';
import { useRoster } from '@/store/RosterContext';
import { useT } from '@/store/LangContext';
import { createEncounter, persistEncounter } from '@/store/encounterService';
import type { TeamSnapshot } from '@/domain/championship/types';
import { useMyTeam } from './TeamLayout';

/**
 * Captain's championship setup: the home side is fixed to the captain's own
 * team (RLS only lets them create encounters involving it); they pick any
 * opponent. Mirrors the admin EncounterSetup but with one side locked.
 */
export function TeamEncounterSetup() {
  const { team } = useMyTeam();
  const navigate = useNavigate();
  const repo = useMemo(() => getRepository(), []);
  const { players } = useRoster();
  const { t } = useT();

  const [teams, setTeams] = useState<TeamWithPlayers[]>([]);
  const [opponentId, setOpponentId] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void repo
      .listTeams()
      .then(setTeams)
      .catch(() => setTeams([]));
  }, [repo]);

  const snapshot = (tm: TeamWithPlayers): TeamSnapshot => ({
    id: tm.id,
    name: tm.name,
    players: tm.playerIds.map((id) => ({
      id,
      name: players.find((p) => p.id === id)?.name ?? '???',
    })),
  });

  const opponents = useMemo(
    () => teams.filter((tm) => tm.id !== team.id),
    [teams, team.id],
  );
  const opponent = opponents.find((tm) => tm.id === opponentId);

  const valid =
    !!opponent &&
    team.playerIds.length >= 4 &&
    opponent.playerIds.length >= 4;

  const hint = !opponent
    ? t('team.pickOpponent')
    : team.playerIds.length < 4
      ? t('team.needFourOwn')
      : opponent.playerIds.length < 4
        ? t('encounterSetup.minPlayers')
        : null;

  const start = async () => {
    if (!valid || !opponent || busy) return;
    setBusy(true);
    setError(null);
    try {
      const season = await repo.getCurrentSeason();
      if (!season) throw new Error(t('encounterSetup.noSeason'));
      const encounter = createEncounter(
        season.id,
        snapshot(team),
        snapshot(opponent),
      );
      await persistEncounter(encounter);
      navigate(`/championship/${encounter.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : t('encounterSetup.createFailed'));
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto flex max-w-lg flex-col">
      <p className="mb-4 text-sm text-[var(--color-text-dim)]">
        {t('encounterSetup.description')}
      </p>

      {/* Home team — locked to the captain's own team */}
      <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-[var(--color-text-dim)]">
        {t('encounterSetup.homeTeam')}
      </h2>
      <div className="mb-5 flex items-center justify-between gap-3 rounded-xl border border-[var(--color-accent)] bg-[var(--color-accent)] px-4 py-3 text-white">
        <span className="flex min-w-0 items-center gap-2">
          <span className="truncate font-semibold">{team.name}</span>
          <span className="shrink-0 rounded-md bg-white/20 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide">
            {t('encounterSetup.homeBadge')}
          </span>
        </span>
        <span className="shrink-0 text-xs text-white/80">
          {team.playerIds.length}{' '}
          {team.playerIds.length === 1
            ? t('common.player')
            : t('common.players')}
        </span>
      </div>

      <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-[var(--color-text-dim)]">
        {t('encounterSetup.opponent')}
      </h2>
      {opponents.length === 0 ? (
        <p className="rounded-xl border border-dashed border-[var(--color-border)] p-6 text-center text-sm text-[var(--color-text-dim)]">
          {t('team.noOpponents')}
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {opponents
            .slice()
            .sort((a, b) => a.name.localeCompare(b.name))
            .map((tm) => {
              const selected = tm.id === opponentId;
              return (
                <button
                  key={tm.id}
                  onClick={() => setOpponentId(tm.id)}
                  className={cn(
                    'flex items-center justify-between gap-3 rounded-xl border px-4 py-3 text-left text-sm transition-all',
                    selected
                      ? 'border-[var(--color-accent)] bg-[var(--color-accent)] text-white'
                      : 'border-[var(--color-border)] bg-[var(--color-surface)]',
                  )}
                >
                  <span className="truncate font-semibold">{tm.name}</span>
                  <span
                    className={cn(
                      'shrink-0 text-xs',
                      selected ? 'text-white/80' : 'text-[var(--color-text-dim)]',
                    )}
                  >
                    {tm.playerIds.length}{' '}
                    {tm.playerIds.length === 1
                      ? t('common.player')
                      : t('common.players')}
                  </span>
                </button>
              );
            })}
        </div>
      )}

      {hint && opponents.length > 0 && (
        <p className="mt-4 text-center text-sm text-[var(--color-warning)]">
          {hint}
        </p>
      )}
      {error && (
        <p className="mt-3 text-center text-sm text-[var(--color-accent)]">
          {error}
        </p>
      )}

      <Button
        variant="accent"
        size="xl"
        fullWidth
        className="mt-6"
        disabled={!valid || busy}
        onClick={start}
      >
        {busy ? t('encounterSetup.creating') : t('encounterSetup.composeFirst')}
      </Button>
    </div>
  );
}
