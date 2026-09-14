/**
 * Game store provider. Holds { config, events } in a reducer, derives the
 * full GameState via the engine (memoized), and auto-saves the match to the
 * database after every change. The DB is the single source of truth — nothing
 * is written locally. Saves keep the events in memory and retry until the DB
 * accepts them, so a network drop never loses a visit; `saveStatus` surfaces
 * that state to the UI.
 */
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { buildGameState } from '@/domain/engine';
import {
  makeBust,
  makeGameForfeit,
  makeLegForfeit,
  makeVisit,
} from '@/domain/events';
import type { GameConfig, GameEvent, GameState } from '@/domain/types';
import type { MatchRecord } from '@/data/types';
import { persistMatch } from './matchService';
import { gameReducer, type GameStore } from './reducer';

/** Persistence state of the live match, for a small header indicator. */
export type SaveStatus = 'saved' | 'saving' | 'offline';

interface GameContextValue {
  config: GameConfig;
  events: GameEvent[];
  state: GameState;
  /** Whether the latest change has reached the database. */
  saveStatus: SaveStatus;
  /** Add a normal scoring visit for the currently active thrower. */
  addVisit: (scored: number, darts?: number) => void;
  /** Add a bust for the currently active thrower. */
  addBust: (darts?: number) => void;
  forfeitLeg: (participantId: string) => void;
  forfeitGame: (participantId: string) => void;
  undo: () => void;
  editVisit: (eventId: string, scored: number, darts?: number) => void;
  /** Swap who starts leg 1 — only possible before the first dart is thrown. */
  swapStarter: () => void;
  endGame: () => void;
}

const GameContext = createContext<GameContextValue | null>(null);

export function GameProvider({
  matchId,
  seasonId,
  config,
  initialEvents,
  encounterId,
  fixtureIndex,
  premierLeagueCompetitionId,
  premierLeagueNightId,
  premierLeagueFixtureId,
  onEnd,
  children,
}: {
  matchId: string;
  seasonId: string;
  config: GameConfig;
  initialEvents: GameEvent[];
  /** Championship link, preserved on every auto-save. */
  encounterId?: string | null;
  fixtureIndex?: number | null;
  /** Premier League links, preserved on every auto-save. */
  premierLeagueCompetitionId?: string | null;
  premierLeagueNightId?: string | null;
  premierLeagueFixtureId?: string | null;
  onEnd?: () => void;
  children: ReactNode;
}) {
  const [store, dispatch] = useReducer(gameReducer, {
    config,
    events: initialEvents,
  } satisfies GameStore);

  // Derived state — recomputed from scratch whenever events change.
  const state = useMemo(
    () => buildGameState(store.config, store.events),
    [store.config, store.events],
  );

  // Auto-save to the DB after every change. The latest record to save is held
  // in a ref (each save carries the full event log, so only the newest matters)
  // and drained by a single long-lived loop that retries on failure.
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('saved');
  const pendingRef = useRef<MatchRecord | null>(null);
  const wakeRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    pendingRef.current = {
      id: matchId,
      seasonId,
      config: store.config,
      events: store.events,
      mode: store.config.mode,
      variant: store.config.variant,
      status: state.status === 'GAME_OVER' ? 'GAME_OVER' : 'IN_PROGRESS',
      winnerParticipant: state.winnerId ?? null,
      encounterId: encounterId ?? null,
      fixtureIndex: fixtureIndex ?? null,
      premierLeagueCompetitionId: premierLeagueCompetitionId ?? null,
      premierLeagueNightId: premierLeagueNightId ?? null,
      premierLeagueFixtureId: premierLeagueFixtureId ?? null,
      finishedAt:
        state.status === 'GAME_OVER' ? new Date().toISOString() : null,
    };
    wakeRef.current?.(); // nudge the drain loop
  }, [
    matchId,
    seasonId,
    store.config,
    store.events,
    state.status,
    state.winnerId,
    encounterId,
    fixtureIndex,
    premierLeagueCompetitionId,
    premierLeagueNightId,
    premierLeagueFixtureId,
  ]);

  useEffect(() => {
    let alive = true;
    void (async () => {
      while (alive) {
        const record = pendingRef.current;
        if (!record) {
          await new Promise<void>((resolve) => {
            wakeRef.current = resolve;
          });
          wakeRef.current = null;
          continue;
        }
        setSaveStatus('saving');
        try {
          await persistMatch(record);
          if (pendingRef.current === record) pendingRef.current = null;
          if (alive && !pendingRef.current) setSaveStatus('saved');
        } catch {
          if (alive) setSaveStatus('offline');
          await new Promise((r) => setTimeout(r, 2500)); // back off, then retry
        }
      }
    })();
    return () => {
      alive = false;
      wakeRef.current?.(); // release the loop if it's waiting
    };
  }, []);

  const value = useMemo<GameContextValue>(() => {
    const append = (event: GameEvent) =>
      dispatch({ type: 'APPEND_EVENT', event });

    return {
      config: store.config,
      events: store.events,
      state,
      saveStatus,
      addVisit: (scored, darts) => {
        if (state.status !== 'IN_PROGRESS') return;
        append(
          makeVisit({
            participantId: state.activeParticipantId,
            playerId: state.activePlayerId,
            scored,
            darts,
          }),
        );
      },
      addBust: (darts) => {
        if (state.status !== 'IN_PROGRESS') return;
        append(
          makeBust({
            participantId: state.activeParticipantId,
            playerId: state.activePlayerId,
            darts,
          }),
        );
      },
      forfeitLeg: (participantId) =>
        append(makeLegForfeit(participantId)),
      forfeitGame: (participantId) =>
        append(makeGameForfeit(participantId)),
      undo: () => dispatch({ type: 'UNDO' }),
      editVisit: (eventId, scored, darts) =>
        dispatch({ type: 'EDIT_VISIT', eventId, scored, darts }),
      swapStarter: () => {
        if (state.currentLegIndex !== 0) return;
        if ((state.legs[0]?.visits.length ?? 0) > 0) return;
        dispatch({ type: 'SWAP_STARTER' });
      },
      endGame: () => {
        onEnd?.();
      },
    };
  }, [store.config, store.events, state, saveStatus, onEnd]);

  return (
    <GameContext.Provider value={value}>{children}</GameContext.Provider>
  );
}

export function useGame(): GameContextValue {
  const ctx = useContext(GameContext);
  if (!ctx) throw new Error('useGame must be used within a GameProvider');
  return ctx;
}
