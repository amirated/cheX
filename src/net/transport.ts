import { createGameState, gameReducer } from '../engine';
import type { ClockView } from '../types/clock';
import type { Color, GameEvent, GameState, MoveAction } from '../types/game';

export interface SeatPresence {
  taken: boolean;
  connected: boolean;
}

/** Mirrors the server's `Presence` (chex_server::rooms::Presence). */
export interface Presence {
  white: SeatPresence;
  black: SeatPresence;
  spectators: number;
}

export interface TransportMeta {
  mode: 'local' | 'online';
  roomId: string | null;
  /** Online: the colour this client controls; null = spectator. Local: null (controls both). */
  seat: Color | null;
  connection: 'connecting' | 'connected' | 'disconnected';
  presence: Presence | null;
  /** Last error from the server (rejected action, room not found, unreachable…). */
  error: string | null;
}

/**
 * The seam between UI and game authority. `LocalTransport` runs the reducer in
 * the browser; `SocketTransport` sends intents to the Rust server, which runs the
 * same reducer and broadcasts the result. The UI can't tell the difference.
 */
export interface GameTransport {
  getState(): GameState;
  send(action: MoveAction): void;
  /** Listener receives the new state plus only the events appended since the last update. */
  subscribe(listener: (state: GameState, newEvents: GameEvent[]) => void): () => void;
  getMeta(): TransportMeta;
  subscribeMeta(listener: () => void): () => void;
  /** Latest authoritative clock, or null for untimed / local games. */
  getClock(): ClockView | null;
  subscribeClock(listener: () => void): () => void;
}

/** True when this client may move pieces of `color`. */
export const controls = (meta: TransportMeta, color: Color): boolean =>
  meta.mode === 'local' || meta.seat === color;

const LOCAL_META: TransportMeta = {
  mode: 'local',
  roomId: null,
  seat: null,
  connection: 'connected',
  presence: null,
  error: null,
};

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

  getMeta = (): TransportMeta => LOCAL_META;
  subscribeMeta = (): (() => void) => () => {};
  // Local pass-and-play is untimed.
  getClock = (): ClockView | null => null;
  subscribeClock = (): (() => void) => () => {};
}
