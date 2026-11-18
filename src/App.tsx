import { useMemo, useRef, useState } from 'react';
import { GameCanvas } from './components/GameCanvas';
import { Hud } from './components/Hud';
import { OnlineBar } from './components/OnlineBar';
import { useBoardSize } from './hooks/useBoardSize';
import { useChessGame } from './hooks/useChessGame';
import { createOnlineRoom, SERVER_URL, SocketTransport } from './net/socketTransport';
import { LocalTransport, type GameTransport } from './net/transport';

/** `?room=CODE` → online game against the Rust server; otherwise local pass-and-play.
 *  Created once at module scope so React StrictMode's double-mount can't open two sockets. */
function createTransport(): GameTransport {
  const room = new URLSearchParams(location.search).get('room');
  return room ? new SocketTransport(SERVER_URL, room.toUpperCase()) : new LocalTransport();
}
const transport = createTransport();

export default function App() {
  const { state, meta, highlights, onSquare, reset, sanLog } = useChessGame(transport);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const stageRef = useRef<HTMLDivElement>(null);
  const size = useBoardSize(stageRef);

  const playOnline = async () => {
    setCreating(true);
    setCreateError(null);
    try {
      const id = await createOnlineRoom();
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

  return (
    <main className="app">
      <Hud
        turn={state.turn}
        status={state.status}
        winner={state.winner}
        moveNumber={state.fullmoveNumber}
        onReset={reset}
        seat={meta.mode === 'online' ? meta.seat : undefined}
      />
      <OnlineBar meta={meta} onPlayOnline={playOnline} creating={creating} createError={createError} />
      <div className="stage" ref={stageRef}>
        {size > 0 && (
          <div className="board-frame" style={{ width: size, height: size }}>
            <GameCanvas
              board={state.board}
              size={size}
              highlights={highlights}
              onSquare={onSquare}
              flipped={meta.seat === 'black'}
            />
          </div>
        )}
      </div>
      <footer className="movelog">{moves.length ? moves.join('   ') : 'Tap a piece to begin'}</footer>
    </main>
  );
}
