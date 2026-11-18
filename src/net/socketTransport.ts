import { io, type Socket } from 'socket.io-client';
import { createGameState } from '../engine';
import type { Color, GameEvent, GameState, MoveAction } from '../types/game';
import type { GameTransport, Presence, TransportMeta } from './transport';

/**
 * Online play against the CheX Rust server (cheX-BE). Protocol:
 *
 *   client → server  "room:join" { roomId, token? }  ack { ok, roomId, color, token, state, presence }
 *   client → server  "action"    MoveAction           ack { ok } | { ok:false, error }
 *   server → room    "game:update"   { state, events }
 *   server → room    "room:presence" Presence
 *
 * The seat token is kept in localStorage per room, so a refresh or a dropped
 * connection reclaims the same colour.
 */

type JoinAck =
  | { ok: true; roomId: string; color: Color | null; token: string; state: GameState; presence: Presence }
  | { ok: false; error: string };
type ActionAck = { ok: true } | { ok: false; error: string };

const tokenKey = (roomId: string) => `chex:seat:${roomId}`;

function readToken(roomId: string): string | null {
  try {
    return localStorage.getItem(tokenKey(roomId));
  } catch {
    return null;
  }
}

function writeToken(roomId: string, token: string) {
  try {
    localStorage.setItem(tokenKey(roomId), token);
  } catch {
    /* private mode etc. — reconnect just won't reclaim the seat */
  }
}

export class SocketTransport implements GameTransport {
  private socket: Socket;
  private state: GameState = createGameState();
  private meta: TransportMeta;
  private listeners = new Set<(s: GameState, e: GameEvent[]) => void>();
  private metaListeners = new Set<() => void>();

  constructor(
    private url: string,
    private roomId: string,
  ) {
    this.meta = { mode: 'online', roomId, seat: null, connection: 'connecting', presence: null, error: null };
    this.socket = io(url, { transports: ['websocket'], reconnection: true });

    this.socket.on('connect', () => void this.join());
    this.socket.on('disconnect', () => this.setMeta({ connection: 'disconnected' }));
    this.socket.on('connect_error', () =>
      this.setMeta({ connection: 'disconnected', error: `Can't reach the game server at ${this.url}` }),
    );
    this.socket.on('game:update', (p: { state: GameState; events: GameEvent[] }) => this.setState(p.state, p.events));
    this.socket.on('room:presence', (presence: Presence) => this.setMeta({ presence }));
  }

  private async join(attempt = 0): Promise<void> {
    let res: JoinAck;
    try {
      res = await this.socket.timeout(5000).emitWithAck('room:join', {
        roomId: this.roomId,
        token: readToken(this.roomId),
      });
    } catch {
      // No ack (dropped packet / server busy): retry while still connected.
      if (this.socket.connected && attempt < 5) return this.join(attempt + 1);
      this.setMeta({ error: 'Could not join the room — retrying on reconnect' });
      return;
    }
    if (!res.ok) {
      this.setMeta({ connection: 'connected', error: res.error === 'room not found' ? `Room ${this.roomId} not found` : res.error });
      return;
    }
    this.roomId = res.roomId;
    writeToken(res.roomId, res.token);
    this.setMeta({ roomId: res.roomId, seat: res.color, presence: res.presence, connection: 'connected', error: null });
    this.setState(res.state, [], true);
  }

  private setState(state: GameState, events: GameEvent[], force = false) {
    // Ignore out-of-order snapshots (e.g. a late update after a resync).
    if (!force && state.nextSeq < this.state.nextSeq) return;
    this.state = state;
    this.listeners.forEach((l) => l(state, events));
  }

  private setMeta(patch: Partial<TransportMeta>) {
    this.meta = { ...this.meta, ...patch };
    this.metaListeners.forEach((l) => l());
  }

  getState = () => this.state;
  getMeta = () => this.meta;

  send = (action: MoveAction) => {
    this.socket
      .timeout(8000)
      .emitWithAck('action', action)
      .then((res: ActionAck) => {
        if (!res.ok) this.setMeta({ error: res.error });
        else if (this.meta.error) this.setMeta({ error: null });
      })
      .catch(() => this.setMeta({ error: 'Server did not respond' }));
  };

  subscribe = (l: (s: GameState, e: GameEvent[]) => void) => {
    this.listeners.add(l);
    return () => this.listeners.delete(l);
  };

  subscribeMeta = (l: () => void) => {
    this.metaListeners.add(l);
    return () => this.metaListeners.delete(l);
  };

  disconnect() {
    this.socket.disconnect();
  }
}

/** Server base URL: VITE_SERVER_URL, else the page's host on port 4000 (works for LAN phone testing). */
export const SERVER_URL: string =
  (import.meta.env.VITE_SERVER_URL as string | undefined) ?? `${location.protocol}//${location.hostname}:4000`;

export async function createOnlineRoom(): Promise<string> {
  const res = await fetch(`${SERVER_URL}/api/rooms`, { method: 'POST' });
  const body = (await res.json()) as { ok: boolean; roomId?: string; error?: string };
  if (!body.ok || !body.roomId) throw new Error(body.error ?? 'Could not create room');
  return body.roomId;
}
