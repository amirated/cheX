import { io, type Socket } from 'socket.io-client';
import { createGameState, gameReducer } from '../engine';
import type { ClockSnapshot, ClockView, TimeControl } from '../types/clock';
import type { Color, GameEvent, GameState, MoveAction } from '../types/game';
import type { GameTransport, Presence, TransportMeta } from './transport';

/**
 * Online play against the CheX Rust server (cheX-BE). Protocol:
 *
 *   client → server  "room:join" { roomId, token? }            ack { ok, roomId, color, token, state, clock, presence }
 *   client → server  "action"    MoveAction & { expectedSeq }  ack { ok } | { ok:false, error, code }
 *   client → server  "sync"      {}                            ack { ok, state, clock, presence }
 *   server → room    "game:update"   { state, events, clock }
 *   server → room    "room:presence" Presence
 *
 * The seat token is kept in localStorage per room, so a refresh or a dropped
 * connection reclaims the same colour.
 *
 * Optimistic moves: our own move is played through the same reducer the server runs
 * the moment it is sent, so the piece moves (and sounds) with no network wait. The
 * server's update for that move then lands on an identical state and replaces it
 * silently (its events are already known); if the server refuses the move we resync
 * to the authoritative position.
 *
 * Clocks: the server sends a snapshot only when something changes (a move, a flag
 * fall, a join/resync). We count down locally from that snapshot on the monotonic
 * clock, corrected by an estimate of the network delay, and resync whenever the tab
 * becomes visible again or the connection comes back.
 */

type Fail = { ok: false; error: string; code?: string };
type JoinAck =
  | {
      ok: true;
      roomId: string;
      color: Color | null;
      token: string;
      state: GameState;
      clock: ClockSnapshot | null;
      presence: Presence;
    }
  | Fail;
type SyncAck = { ok: true; state: GameState; clock: ClockSnapshot | null; presence: Presence } | Fail;
type ActionAck = { ok: true } | Fail;
type Update = { state: GameState; events: GameEvent[]; clock: ClockSnapshot | null };

const tokenKey = (roomId: string) => `chex:seat:${roomId}`;

function readToken(roomId: string): string | null {
  try {
    return localStorage.getItem(tokenKey(roomId));
  } catch {
    return null;
  }
}

export function writeToken(roomId: string, token: string) {
  try {
    localStorage.setItem(tokenKey(roomId), token);
  } catch {
    /* private mode etc. — reconnect just won't reclaim the seat */
  }
}

const matchedKey = (roomId: string) => `chex:matched:${roomId}`;

/** Remember that this room came from quick match (no invite link; offer "New opponent"). */
export function markMatched(roomId: string) {
  try {
    localStorage.setItem(matchedKey(roomId), '1');
  } catch {
    /* cosmetic only */
  }
}

export function isMatched(roomId: string | null): boolean {
  if (!roomId) return false;
  try {
    return localStorage.getItem(matchedKey(roomId)) === '1';
  } catch {
    return false;
  }
}

/** Cap on the one-way delay correction, so one terrible round trip can't distort the clock. */
const MAX_LATENCY_MS = 1000;

export class SocketTransport implements GameTransport {
  private socket: Socket;
  private state: GameState = createGameState();
  private meta: TransportMeta;
  private clock: ClockView | null = null;
  /** Smoothed one-way network delay (half the measured round trip). */
  private latencyMs = 0;
  /** Our own move, shown before the server confirmed it (the state it was played from). */
  private pending: { before: GameState } | null = null;
  private listeners = new Set<(s: GameState, e: GameEvent[]) => void>();
  private metaListeners = new Set<() => void>();
  private clockListeners = new Set<() => void>();

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
    this.socket.on('game:update', (p: Update) => this.apply(p.state, p.events, p.clock));
    this.socket.on('room:presence', (presence: Presence) => this.setMeta({ presence }));

    // A suspended/background tab may have missed updates or drifted: resync on return.
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && this.socket.connected) void this.sync();
    });
  }

  /** Emit with an ack and fold the round-trip time into the latency estimate. */
  private async timedCall<T>(event: string, payload: unknown, timeoutMs: number): Promise<T> {
    const t0 = performance.now();
    const res = (await this.socket.timeout(timeoutMs).emitWithAck(event, payload)) as T;
    const oneWay = Math.min(MAX_LATENCY_MS, (performance.now() - t0) / 2);
    this.latencyMs = this.latencyMs === 0 ? oneWay : this.latencyMs * 0.7 + oneWay * 0.3;
    return res;
  }

  private async join(attempt = 0): Promise<void> {
    let res: JoinAck;
    try {
      res = await this.timedCall<JoinAck>('room:join', { roomId: this.roomId, token: readToken(this.roomId) }, 5000);
    } catch {
      // No ack (dropped packet / server busy): retry while still connected.
      if (this.socket.connected && attempt < 5) return this.join(attempt + 1);
      this.setMeta({ error: 'Could not join the room — retrying on reconnect' });
      return;
    }
    if (!res.ok) {
      this.setMeta({
        connection: 'connected',
        error: res.code === 'notFound' ? `Room ${this.roomId} not found` : res.error,
      });
      return;
    }
    this.roomId = res.roomId;
    writeToken(res.roomId, res.token);
    this.setMeta({ roomId: res.roomId, seat: res.color, presence: res.presence, connection: 'connected', error: null });
    this.apply(res.state, [], res.clock, true);
  }

  /** Pull the authoritative state + clock (after tab suspension, a stale move, etc.). */
  private async sync(): Promise<void> {
    try {
      const res = await this.timedCall<SyncAck>('sync', {}, 5000);
      if (res.ok) {
        this.setMeta({ presence: res.presence });
        this.apply(res.state, [], res.clock, true);
      }
    } catch {
      /* the next update or reconnect will resync */
    }
  }

  private apply(state: GameState, events: GameEvent[], clock: ClockSnapshot | null, force = false) {
    // Ignore out-of-order snapshots (e.g. a late update after a resync).
    if (!force && state.nextSeq < this.state.nextSeq) return;
    // Events we already showed optimistically are not news.
    const fresh = force ? events : events.filter((e) => e.seq >= this.state.nextSeq);
    this.pending = null;
    this.state = state;
    this.clock = clock ? { ...clock, receivedAt: performance.now(), latencyMs: this.latencyMs } : null;
    this.listeners.forEach((l) => l(state, fresh));
    this.clockListeners.forEach((l) => l());
  }

  /** Play our own move locally before the server confirms it. Returns false if it changed nothing. */
  private predict(action: MoveAction): boolean {
    if (action.type !== 'move' || !this.meta.seat || this.state.turn !== this.meta.seat) return false;
    const prev = this.state;
    const next = gameReducer(prev, { ...action, color: this.meta.seat });
    const fresh = next.events.filter((e) => e.seq >= prev.nextSeq);
    if (next.ply === prev.ply || fresh.some((e) => e.type === 'rejected')) return false;
    this.pending = { before: prev };
    this.state = next;
    // Stop our clock and start theirs right away, as the server will (cheX-BE clock::on_move).
    if (this.clock && !this.clock.flagged) {
      const now = performance.now();
      const mine = this.meta.seat;
      const over = !(next.status === 'inProgress' || next.status === 'check');
      const remaining = { ...this.clock.remainingMs };
      if (this.clock.running === mine) {
        const elapsed = Math.max(0, now - this.clock.receivedAt + this.clock.latencyMs);
        remaining[mine] = Math.max(0, remaining[mine] - elapsed) + (over ? 0 : this.clock.timeControl.incrementMs);
      }
      this.clock = { ...this.clock, remainingMs: remaining, running: over ? null : next.turn, receivedAt: now, latencyMs: 0 };
      this.clockListeners.forEach((l) => l());
    }
    this.listeners.forEach((l) => l(next, fresh));
    return true;
  }

  /** The server refused our predicted move: show the position it was played from again. */
  private rollback() {
    if (!this.pending) return;
    const { before } = this.pending;
    this.pending = null;
    this.state = before;
    this.listeners.forEach((l) => l(before, []));
    void this.sync();
  }

  private setMeta(patch: Partial<TransportMeta>) {
    this.meta = { ...this.meta, ...patch };
    this.metaListeners.forEach((l) => l());
  }

  getState = () => this.state;
  getMeta = () => this.meta;
  getClock = () => this.clock;

  send = (action: MoveAction) => {
    // expectedSeq lets the server refuse duplicates and moves made on an outdated position.
    const expectedSeq = this.state.nextSeq;
    this.predict(action);
    this.socket
      .timeout(8000)
      .emitWithAck('action', { ...action, expectedSeq })
      .then((res: ActionAck) => {
        if (res.ok) {
          if (this.meta.error) this.setMeta({ error: null });
          return;
        }
        if (res.code === 'stale' || res.code === 'timeUp') {
          void this.sync(); // our view was behind: show the real position/clock instead of an error
          return;
        }
        this.rollback();
        this.setMeta({ error: res.error });
      })
      .catch(() => {
        this.setMeta({ error: 'Server did not respond' });
        void this.sync(); // the move may or may not have landed: ask
      });
  };

  subscribe = (l: (s: GameState, e: GameEvent[]) => void) => {
    this.listeners.add(l);
    return () => this.listeners.delete(l);
  };

  subscribeMeta = (l: () => void) => {
    this.metaListeners.add(l);
    return () => this.metaListeners.delete(l);
  };

  subscribeClock = (l: () => void) => {
    this.clockListeners.add(l);
    return () => this.clockListeners.delete(l);
  };

  disconnect() {
    this.socket.disconnect();
  }
}

/** Server base URL: VITE_SERVER_URL, else the page's host on port 4000 (works for LAN phone testing). */
export const SERVER_URL: string =
  (import.meta.env.VITE_SERVER_URL as string | undefined) ?? `${location.protocol}//${location.hostname}:4000`;

/** Create a room. `timeControl: null` = untimed. */
export async function createOnlineRoom(timeControl: TimeControl | null, mods: string[] = []): Promise<string> {
  const res = await fetch(`${SERVER_URL}/api/rooms`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...(timeControl ? { timeControl } : {}), mods }),
  });
  const body = (await res.json()) as { ok: boolean; roomId?: string; error?: string };
  if (!body.ok || !body.roomId) throw new Error(body.error ?? 'Could not create room');
  return body.roomId;
}
