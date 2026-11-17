import { createGameState, gameReducer } from '../engine';
import type { GameEvent, GameState, MoveAction } from '../types/game';

/**
 * The seam between UI and game authority. V1 uses `LocalTransport` (the reducer
 * runs in the browser). Phase 2 swaps in `SocketTransport` with zero UI changes:
 * the Rust server runs the same reducer and broadcasts the resulting state/events.
 */
export interface GameTransport {
  getState(): GameState;
  send(action: MoveAction): void;
  /** Listener receives the new state plus only the events appended since the last update. */
  subscribe(listener: (state: GameState, newEvents: GameEvent[]) => void): () => void;
}

export class LocalTransport implements GameTransport {
  private state: GameState;
  private listeners = new Set<(s: GameState, e: GameEvent[]) => void>();

  constructor(initial: GameState = createGameState()) {
    this.state = initial;
  }

  getState = (): GameState => this.state;

  send = (action: MoveAction): void => {
    const prev = this.state;
    this.state = gameReducer(prev, action);
    const fresh = this.state.events.filter((e) => e.seq >= prev.nextSeq);
    this.listeners.forEach((l) => l(this.state, fresh));
  };

  subscribe = (listener: (s: GameState, e: GameEvent[]) => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };
}
