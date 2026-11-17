import { io, type Socket } from 'socket.io-client';
import { createGameState } from '../engine';
import type { GameEvent, GameState, MoveAction } from '../types/game';
import type { GameTransport } from './transport';

/**
 * Phase 2 sketch — NOT wired into the app yet. Wire protocol (mirrors the Rust
 * `socketioxide` handlers you'll write later):
 *
 *   client → server  "action"    MoveAction
 *   server → client  "state"     GameState            (full snapshot on join / resync)
 *   server → client  "events"    { state, events }    (after each accepted/rejected action)
 */
export class SocketTransport implements GameTransport {
  private socket: Socket;
  private state: GameState = createGameState();
  private listeners = new Set<(s: GameState, e: GameEvent[]) => void>();

  constructor(url: string, roomId: string) {
    this.socket = io(url, { transports: ['websocket'], query: { roomId } });
    this.socket.on('state', (s: GameState) => this.emit(s, []));
    this.socket.on('events', (p: { state: GameState; events: GameEvent[] }) => this.emit(p.state, p.events));
  }

  private emit(s: GameState, e: GameEvent[]) {
    this.state = s;
    this.listeners.forEach((l) => l(s, e));
  }

  getState = () => this.state;
  send = (action: MoveAction) => void this.socket.emit('action', action);
  subscribe = (l: (s: GameState, e: GameEvent[]) => void) => {
    this.listeners.add(l);
    return () => this.listeners.delete(l);
  };

  disconnect() {
    this.socket.disconnect();
  }
}
