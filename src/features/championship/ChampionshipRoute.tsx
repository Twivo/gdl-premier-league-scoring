import { useEffect, useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import {
  advanceEncounter,
  unadvanceEncounter,
  loadEncounter,
  recordFixtureResult,
  reopenFixture,
} from '@/store/encounterService';
import { loadMatch, persistMatch } from '@/store/matchService';
import { buildEncounterState } from '@/domain/championship/encounter';
import { useT } from '@/store/LangContext';
import { Loading } from '@/components/ui/Loading';
import type { EncounterRecord } from '@/data/types';
import type { Side } from '@/domain/championship/types';
import { EncounterHeader } from './EncounterHeader';
import { EncounterConfig } from './EncounterConfig';
import { FixtureComposer } from './FixtureComposer';
import { DeciderComposer } from './DeciderComposer';
import { EncounterPlay } from './EncounterPlay';
import { MatchStatsScreen } from './MatchStatsScreen';
import { EncounterFinal } from './EncounterFinal';

/** Orchestrates one encounter: compose → play → per-match stats → next → final. */
export function ChampionshipRoute() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t } = useT();
  const [encounter, setEncounter] = useState<EncounterRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [configOpen, setConfigOpen] = useState(false);

  useEffect(() => {
    let alive = true;
    if (!id) {
      setLoading(false);
      return;
    }
    loadEncounter(id)
      .then((e) => alive && setEncounter(e))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [id]);

  if (loading) {
    return <Loading label={t('champ.loadingEncounter')} />;
  }
  if (!encounter) return <Navigate to="/" replace />;

  const state = buildEncounterState(encounter.plan, encounter.currentIndex);
  const isPlay = state.phase === 'PLAY';
  // Once the fixture's match is launched, the scoring screen takes the whole
  // height: the championship scoreboard line is dropped to free vertical space
  // (Configure moves into the scoring screen's control bar).
  const isScoring = isPlay && !!state.currentFixture?.matchId;

  return (
    <div className="mx-auto flex h-[100dvh] max-w-6xl flex-col bg-[var(--color-bg)]">
      {!isPlay && (
        <div className="flex shrink-0 items-center justify-between border-b border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-1.5 text-sm">
          <button
            onClick={() => navigate('/')}
            className="rounded-md px-2 py-1 text-[var(--color-text-dim)] hover:bg-[var(--color-surface-2)]"
          >
            {t('common.home')}
          </button>
          <span className="font-semibold">{t('admin.championship')}</span>
          <span className="w-14" />
        </div>
      )}

      {!isScoring && (
        <EncounterHeader
          encounter={encounter}
          state={state}
          onConfigure={() => setConfigOpen(true)}
        />
      )}

      <div className="flex min-h-0 flex-1 flex-col">
        {state.phase === 'COMPOSE' && state.isDecider && (
          <DeciderComposer encounter={encounter} onComposed={setEncounter} />
        )}

        {state.phase === 'COMPOSE' && !state.isDecider && state.composeBlock && (
          <FixtureComposer
            encounter={encounter}
            block={state.composeBlock}
            onComposed={setEncounter}
          />
        )}

        {state.phase === 'PLAY' && state.currentFixture && (
          <EncounterPlay
            encounter={encounter}
            fixture={state.currentFixture}
            onEncounterUpdate={setEncounter}
            onConfigure={() => setConfigOpen(true)}
            onBack={() =>
              void unadvanceEncounter(encounter).then(setEncounter)
            }
            onResult={(winner: Side) =>
              void recordFixtureResult(
                encounter,
                // identity index of the fixture being played (not the play
                // position — the order can be freely reordered)
                state.currentFixture!.index,
                winner,
              ).then(setEncounter)
            }
          />
        )}

        {state.phase === 'MATCH_DONE' && state.currentFixture && (
          <MatchStatsScreen
            encounter={encounter}
            fixture={state.currentFixture}
            isLast={state.currentIndex + 1 >= state.total}
            // A level score (5-5) after the last regular match sends us to the
            // decisive doubles, not the final screen.
            toDecider={
              state.currentIndex + 1 >= state.total &&
              state.scoreA === state.scoreB
            }
            onNext={() => void advanceEncounter(encounter).then(setEncounter)}
            onBack={async () => {
              const f = state.currentFixture!;
              // rewind the match (drop the winning visit) so it can be corrected
              if (f.matchId) {
                const m = await loadMatch(f.matchId);
                if (m && m.events.length > 0) {
                  await persistMatch({
                    ...m,
                    events: m.events.slice(0, -1),
                    status: 'IN_PROGRESS',
                    winnerParticipant: null,
                    finishedAt: null,
                  });
                }
              }
              const reopened = await reopenFixture(encounter, f.index);
              setEncounter(reopened);
            }}
          />
        )}

        {state.phase === 'FINAL' && (
          <EncounterFinal
            encounter={encounter}
            onFinish={() => navigate('/', { replace: true })}
          />
        )}
      </div>

      {configOpen && (
        <EncounterConfig
          encounter={encounter}
          onClose={() => setConfigOpen(false)}
          onUpdated={setEncounter}
        />
      )}
    </div>
  );
}
