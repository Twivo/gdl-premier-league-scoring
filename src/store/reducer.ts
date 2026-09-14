/**
 * The game reducer. It manipulates ONLY { config, events } — never derived
 * state. Score, stats, turns are all recomputed by the engine from events.
 */
import type { GameConfig, GameEvent, VisitEvent } from '@/domain/types';

export interface GameStore {
  config: GameConfig;
  events: GameEvent[];
}

export type GameAction =
  | { type: 'LOAD'; config: GameConfig; events: GameEvent[] }
  | { type: 'APPEND_EVENT'; event: GameEvent }
  | { type: 'UNDO' }
  | { type: 'EDIT_VISIT'; eventId: string; scored: number; darts?: number }
  | { type: 'SWAP_STARTER' }
  | { type: 'RESET_EVENTS' };

export function gameReducer(
  state: GameStore,
  action: GameAction,
): GameStore {
  switch (action.type) {
    case 'LOAD':
      return { config: action.config, events: action.events };

    case 'APPEND_EVENT':
      return { ...state, events: [...state.events, action.event] };

    case 'UNDO':
      if (state.events.length === 0) return state;
      return { ...state, events: state.events.slice(0, -1) };

    case 'EDIT_VISIT': {
      const events = state.events.map((e) => {
        if (e.id !== action.eventId || e.type !== 'VISIT') return e;
        const updated: VisitEvent = {
          ...e,
          scored: action.scored,
          darts: action.darts ?? e.darts,
        };
        return updated;
      });
      return { ...state, events };
    }

    case 'SWAP_STARTER': {
      const [a, b] = state.config.participants;
      if (!a || !b) return state;
      const firstStarterId =
        state.config.firstStarterId === a.id ? b.id : a.id;
      return { ...state, config: { ...state.config, firstStarterId } };
    }

    case 'RESET_EVENTS':
      return { ...state, events: [] };

    default:
      return state;
  }
}
