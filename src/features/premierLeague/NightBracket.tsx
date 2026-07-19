import { cn } from '@/lib/cn';
import type {
  PremierLeagueCompetition,
  PremierLeagueFixture,
  PremierLeagueNight,
  PremierLeagueRound,
} from '@/domain/premierLeague';
import { canStartFixture } from '@/domain/premierLeague';
import { useT } from '@/store/LangContext';

export interface FixtureLiveScore {
  legsA: number;
  legsB: number;
}

const ROUNDS: PremierLeagueRound[] = ['QUARTER_FINAL', 'SEMI_FINAL', 'FINAL'];

export function NightBracket({
  competition,
  night,
  liveScores,
  onFixture,
}: {
  competition: PremierLeagueCompetition;
  night: PremierLeagueNight;
  liveScores: Record<string, FixtureLiveScore>;
  onFixture: (fixture: PremierLeagueFixture) => void;
}) {
  const { t } = useT();
  const available = night.fixtures.find(
    (fixture) =>
      fixture.status !== 'FINISHED' &&
      canStartFixture(competition, night.id, fixture.id),
  )?.id;
  const nameOf = (id: string | null) =>
    id
      ? competition.players.find((player) => player.playerId === id)?.name ?? t('common.dash')
      : t('premierLeague.toBeDetermined');

  return (
    <div className="space-y-7">
      {ROUNDS.map((round) => {
        const fixtures = night.fixtures.filter((fixture) => fixture.round === round);
        if (!fixtures.length) return null;
        return (
          <section key={round}>
            <h3 className="mb-3 text-sm font-black uppercase tracking-widest text-[var(--color-text-dim)]">
              {t(`premierLeague.round.${round}`)}
            </h3>
            <div className="grid gap-3 md:grid-cols-2">
              {fixtures.map((fixture) => {
                const playable = canStartFixture(competition, night.id, fixture.id);
                const score =
                  fixture.status === 'FINISHED'
                    ? { legsA: fixture.legsA, legsB: fixture.legsB }
                    : liveScores[fixture.id] ?? {
                        legsA: fixture.legsA,
                        legsB: fixture.legsB,
                      };
                const action = fixture.status === 'IN_PROGRESS'
                  ? t('premierLeague.resume')
                  : fixture.status === 'AVAILABLE' && playable
                    ? t('premierLeague.start')
                    : fixture.status === 'FINISHED'
                      ? t('premierLeague.finished')
                      : t('premierLeague.blocked');
                return (
                  <button
                    key={fixture.id}
                    type="button"
                    disabled={!playable || fixture.status === 'FINISHED'}
                    onClick={() => onFixture(fixture)}
                    className={cn(
                      'relative rounded-2xl border bg-[var(--color-surface)] p-4 text-left transition-all',
                      playable && fixture.status !== 'FINISHED'
                        ? 'cursor-pointer hover:-translate-y-0.5 hover:border-[var(--color-accent)] hover:shadow-lg'
                        : 'cursor-default opacity-75',
                      fixture.id === available
                        ? 'border-[var(--color-accent)] shadow-[0_0_28px_-14px_var(--color-accent)]'
                        : 'border-[var(--color-border)]',
                    )}
                  >
                    <div className="mb-3 flex items-center justify-between gap-3 text-xs font-bold">
                      <span className="text-[var(--color-text-dim)]">
                        {t('premierLeague.matchNumber').replace('{number}', String(fixture.fixtureOrder))}
                      </span>
                      <span className="rounded-full bg-[var(--color-surface-2)] px-2.5 py-1 text-[var(--color-accent)]">
                        {t('premierLeague.bestOf').replace('{number}', String(fixture.bestOf))}
                      </span>
                    </div>
                    <PlayerLine
                      name={nameOf(fixture.playerAId)}
                      seed={fixture.playerASeed}
                      legs={score.legsA}
                      winner={
                        fixture.winnerPlayerId != null &&
                        fixture.winnerPlayerId === fixture.playerAId
                      }
                    />
                    <PlayerLine
                      name={nameOf(fixture.playerBId)}
                      seed={fixture.playerBSeed}
                      legs={score.legsB}
                      winner={
                        fixture.winnerPlayerId != null &&
                        fixture.winnerPlayerId === fixture.playerBId
                      }
                    />
                    <div className="mt-3 flex items-center justify-between border-t border-[var(--color-border)] pt-3 text-xs">
                      <span className="text-[var(--color-text-dim)]">
                        {t(`premierLeague.fixtureStatus.${fixture.status}`)}
                      </span>
                      <span className={cn('font-black', playable && fixture.status !== 'FINISHED' && 'text-[var(--color-accent)]')}>
                        {action}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function PlayerLine({
  name,
  seed,
  legs,
  winner,
}: {
  name: string;
  seed?: number | null;
  legs: number;
  winner: boolean;
}) {
  return (
    <div className={cn('flex items-center justify-between gap-3 rounded-lg px-2 py-2', winner && 'bg-[color-mix(in_srgb,var(--color-accent)_15%,transparent)]')}>
      <span className="min-w-0 truncate font-bold">
        {seed ? <span className="mr-2 text-[var(--color-accent)]">{seed}.</span> : null}
        {name}
        {winner ? <span className="ml-2">🏆</span> : null}
      </span>
      <span className="text-xl font-black tabular-nums">{legs}</span>
    </div>
  );
}
