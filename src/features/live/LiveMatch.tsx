import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { getRepository } from '@/data';
import { buildGameState } from '@/domain/engine';
import { loadMatch } from '@/store/matchService';
import { loadEncounter } from '@/store/encounterService';
import { subscribeMatch } from '@/store/liveMatch';
import { useT } from '@/store/LangContext';
import { QrCode } from '@/components/QrCode';
import type { EncounterRecord, MatchRecord } from '@/data/types';
import { LiveBoard, type EncounterContext } from './LiveBoard';
import { LiveEncounterRecap } from './LiveEncounterRecap';

/** Read-only live view of one match. Never scores — pure spectating. */
export function LiveMatch() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t } = useT();
  const [match, setMatch] = useState<MatchRecord | null>(null);
  const [encounter, setEncounter] = useState<EncounterRecord | null>(null);
  const [encMatches, setEncMatches] = useState<MatchRecord[]>([]);
  const [loading, setLoading] = useState(true);

  // Current match: initial load + realtime push + polling fallback.
  useEffect(() => {
    if (!id) return;
    let alive = true;
    const refresh = () =>
      loadMatch(id).then((m) => {
        if (alive && m) setMatch(m);
      });
    void refresh().finally(() => alive && setLoading(false));
    const unsub = subscribeMatch(id, () => void refresh());
    const poll = window.setInterval(() => void refresh(), 4000);
    return () => {
      alive = false;
      unsub();
      window.clearInterval(poll);
    };
  }, [id]);

  // Championship context: the encounter + every fixture's match (for the tie
  // score, the recap table, and detecting the next live match).
  const encounterId = match?.encounterId ?? null;
  useEffect(() => {
    if (!encounterId) {
      setEncounter(null);
      setEncMatches([]);
      return;
    }
    let alive = true;
    const repo = getRepository();
    const refresh = async () => {
      const [enc, ms] = await Promise.all([
        loadEncounter(encounterId),
        repo.listMatches({ encounterId }).catch(() => [] as MatchRecord[]),
      ]);
      if (!alive) return;
      if (enc) setEncounter(enc);
      setEncMatches(ms);
    };
    void refresh();
    const poll = window.setInterval(() => void refresh(), 4000);
    return () => {
      alive = false;
      window.clearInterval(poll);
    };
  }, [encounterId]);

  const state = useMemo(
    () => (match ? buildGameState(match.config, match.events) : null),
    [match],
  );
  const isOver = state?.status === 'GAME_OVER';
  const encounterFinished = !!encounter && encounter.status === 'FINISHED';

  // (#1) When the viewed match is over, jump straight to the next live fixture.
  useEffect(() => {
    if (!isOver || !match) return;
    const next = encMatches.find(
      (m) => m.id !== match.id && m.status === 'IN_PROGRESS',
    );
    if (next) navigate(`/live/${next.id}`, { replace: true });
  }, [isOver, match, encMatches, navigate]);

  const context: EncounterContext | null = useMemo(() => {
    if (!encounter || !match) return null;
    const total = encounter.plan.fixtures.length;
    const fixtureIndex = match.fixtureIndex ?? 0;
    const isDeciderMatch = fixtureIndex >= total; // decider sits just past the fixtures
    const kind = t(
      match.mode === 'DOUBLE' ? 'game.doubles' : 'game.singles',
    ).toLowerCase();
    return {
      aName: encounter.plan.teams.A.name,
      bName: encounter.plan.teams.B.name,
      scoreA: encounter.scoreA,
      scoreB: encounter.scoreB,
      label: isDeciderMatch
        ? `${t('champ.decider')} · ${kind}`
        : `${t('live.matchLabel')
            .replace('{n}', String(fixtureIndex + 1))
            .replace('{total}', String(total))} · ${kind}`,
    };
  }, [encounter, match, t]);

  return (
    <div className="mx-auto min-h-screen max-w-3xl px-3 py-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <button
          onClick={() => navigate('/live')}
          className="rounded-lg px-2 py-1 text-sm text-[var(--color-text-dim)] hover:bg-[var(--color-surface-2)]"
        >
          {t('live.back')}
        </button>
        <div className="flex items-center gap-2">
          <span className="hidden text-xs text-[var(--color-text-dim)] sm:inline">
            {t('live.scan')}
          </span>
          <QrCode value={typeof window !== 'undefined' ? window.location.href : ''} size={72} />
        </div>
      </div>

      {loading ? (
        <p className="py-16 text-center text-[var(--color-text-dim)]">{t('common.loading')}</p>
      ) : !state ? (
        <p className="py-16 text-center text-[var(--color-text-dim)]">
          {t('live.gone')}
        </p>
      ) : (
        <>
          <LiveBoard state={state} encounter={context} />

          {isOver && encounter && (
            <div
              className={cnBanner(encounterFinished)}
            >
              {encounterFinished ? t('live.finished') : t('live.waiting')}
            </div>
          )}

          {encounter && (
            <LiveEncounterRecap
              encounter={encounter}
              matches={encMatches}
              currentMatchId={match?.id}
            />
          )}
        </>
      )}
    </div>
  );
}

function cnBanner(finished: boolean): string {
  return finished
    ? 'mt-4 rounded-xl border border-[var(--color-success)] bg-[var(--color-success-dim)] px-4 py-3 text-center text-sm font-semibold text-[var(--color-success)]'
    : 'mt-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3 text-center text-sm text-[var(--color-text-dim)]';
}
