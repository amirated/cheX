import { io, type Socket } from 'socket.io-client';
import type { TimeControl } from '../types/clock';
import type { Color } from '../types/game';
import { markMatched, writeToken } from './socketTransport';

/**
 * Quick match. Protocol (cheX-BE `matchmaking.rs`):
 *
 *   client → server  "match:find"   { timeControl?, mods }   ack { ok }   (paired only on identical rules)
 *   client → server  "match:cancel" {}                 ack { ok, cancelled }
 *   server → client  "match:found"  { roomId, color, token }
 *   server → client  "match:error"  { error }
 *
 * On `match:found` the seat token is saved exactly like a normal join, so the room page
 * claims the right colour when it opens.
 */

export interface MatchFound {
  roomId: string;
  color: Color;
  token: string;
}

export interface MatchSearch {
  cancel(): void;
}

export function findMatch(
  url: string,
  timeControl: TimeControl | null,
  mods: string[],
  handlers: { onFound: (m: MatchFound) => void; onError: (message: string) => void },
): MatchSearch {
  const socket: Socket = io(url, { transports: ['websocket'], reconnection: true });
  let done = false;

  const finish = () => {
    done = true;
    socket.disconnect();
  };

  // (Re)enter the queue on every connect: a dropped connection drops the server-side ticket.
  socket.on('connect', () => {
    if (done) return;
    socket
      .timeout(5000)
      .emitWithAck('match:find', { ...(timeControl ? { timeControl } : {}), mods })
      .then((res: { ok: boolean; error?: string }) => {
        if (!res.ok && !done) {
          finish();
          handlers.onError(res.error ?? 'Could not start matchmaking');
        }
      })
      .catch(() => {
        /* no ack: the next reconnect re-queues */
      });
  });

  socket.on('connect_error', () => {
    if (!done) handlers.onError(`Can't reach the game server at ${url}`);
  });

  socket.on('match:found', (m: MatchFound) => {
    if (done) return;
    writeToken(m.roomId, m.token);
    markMatched(m.roomId);
    finish();
    handlers.onFound(m);
  });

  socket.on('match:error', (e: { error: string }) => {
    if (done) return;
    finish();
    handlers.onError(e.error);
  });

  return {
    cancel() {
      if (done) return;
      done = true;
      socket.timeout(2000).emitWithAck('match:cancel', {}).catch(() => {}).finally(() => socket.disconnect());
    },
  };
}
