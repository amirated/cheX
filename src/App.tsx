import { useMemo, useRef, useState } from 'react';
import { GameCanvas } from './components/GameCanvas';
import { Hud } from './components/Hud';
import { OnlineBar } from './components/OnlineBar';
import { PlayerBar } from './components/PlayerBar';
import { useBoardSize } from './hooks/useBoardSize';
import { useChessGame } from './hooks/useChessGame';
import { useClock } from './hooks/useClock';
import { createOnlineRoom, SERVER_URL, SocketTransport } from './net/socketTransport';
import { LocalTransport, type GameTransport } from './net/transport';
import type { TimeControl } from './types/clock';
import type { Color } from './types/game';

/** `?room=CODE` → online game against the Rust server; otherwise local pass-and-play.
 *  Created once at module scope so React StrictMode's double-mount can't open two sockets. */
function createTransport(): GameTransport {
  const room = new URLSearchParams(location.search).get('room');
  return room ? new SocketTransport(SERVER_URL, room.toUpperCase()) : new LocalTransport();
}
const transport = createTransport();

/** Height of one player bar incl. its gap (keep in sync with .player-bar in index.css). */
const PLAYER_BAR_PX = 48;

export default function App() {
  const { state, meta, highlights, onSquare, reset, resign, sanLog } = useChessGame(transport);
  const clock = useClock(transport);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const online = meta.mode === 'online';
  const stageRef = useRef<HTMLDivElement>(null);
  const size = useBoardSize(stageRef, 640, online ? PLAYER_BAR_PX * 2 : 0);

  const playOnline = async (tc: TimeControl | null) => {
    setCreating(true);
    setCreateError(null);
    try {
      const id = await createOnlineRoom(tc);
      location.search = `?room=${id}`; // reload into the room
    } catch {
      setCreateError(`Can't reach the game server at ${SERVER_URL}`);
      setCreating(false);
    }
  };

  // Pair plies into "1. e4 e5" and show the most recent few.
  const moves = useMemo(() => {
    const rows: string[] = [];
    for (let i = 0; i < sanLog.length; i += 2) rows.push(`${i / 2 + 1}. ${sanLog[i]}${sanLog[i + 1] ? ' ' + sanLog[i + 1] : ''}`);
    return rows.slice(-4);
  }, [sanLog]);

  // You at the bottom; spectators see White at the bottom.
  const bottom: Color = meta.seat ?? 'white';
  const top: Color = bottom === 'white' ? 'black' : 'white';
  const over = ['checkmate', 'stalemate', 'draw', 'timeout', 'resigned'].includes(state.status);

  const bar = (color: Color) => {
    const seat = meta.presence?.[color];
    const name = meta.seat ? (color === meta.seat ? 'You' : 'Opponent') : color === 'white' ? 'White' : 'Black';
    return (
      <PlayerBar
        color={color}
        name={name}
        connected={color === meta.seat ? undefined : !seat?.taken ? null : seat.connected}
        toMove={!over && state.turn === color}
        clock={
          clock
            ? {
                remainingMs: clock[color],
                running: clock.running === color,
                flagged: clock.flagged === color,
                timeControl: clock.timeControl,
              }
            : null
        }
      />
    );
  };

  return (
    <main className="app">
      <Hud
        turn={state.turn}
        status={state.status}
        winner={state.winner}
        moveNumber={state.fullmoveNumber}
        onReset={reset}
        onResign={resign}
        seat={online ? meta.seat : undefined}
      />
      <OnlineBar
        meta={meta}
        onPlayOnline={playOnline}
        creating={creating}
        createError={createError}
        timeControl={meta.presence ? (clock?.timeControl ?? null) : undefined}
      />
      <div className="stage" ref={stageRef}>
        {size > 0 && (
          <div className="board-column" style={{ width: size }}>
            {online && bar(top)}
            <div className="board-frame" style={{ width: size, height: size }}>
              <GameCanvas
                board={state.board}
                size={size}
                highlights={highlights}
                onSquare={onSquare}
                flipped={meta.seat === 'black'}
              />
            </div>
            {online && bar(bottom)}
          </div>
        )}
      </div>
      <footer className="movelog">{moves.length ? moves.join('   ') : 'Tap a piece to begin'}</footer>
    </main>
  );
}
