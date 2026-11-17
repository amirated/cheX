import { useMemo, useRef } from 'react';
import { GameCanvas } from './components/GameCanvas';
import { Hud } from './components/Hud';
import { useBoardSize } from './hooks/useBoardSize';
import { useChessGame } from './hooks/useChessGame';
import { LocalTransport } from './net/transport';

export default function App() {
  // Phase 2: replace with `new SocketTransport(url, roomId)` — nothing else changes.
  const transport = useMemo(() => new LocalTransport(), []);
  const { state, highlights, onSquare, reset, sanLog } = useChessGame(transport);

  const stageRef = useRef<HTMLDivElement>(null);
  const size = useBoardSize(stageRef);

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
      />
      <div className="stage" ref={stageRef}>
        {size > 0 && (
          <div className="board-frame" style={{ width: size, height: size }}>
            <GameCanvas board={state.board} size={size} highlights={highlights} onSquare={onSquare} />
          </div>
        )}
      </div>
      <footer className="movelog">{moves.length ? moves.join('   ') : 'Tap a piece to begin'}</footer>
    </main>
  );
}
