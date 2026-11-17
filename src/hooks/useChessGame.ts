import { useCallback, useMemo, useState, useSyncExternalStore } from 'react';
import { findPiece, getPieceDef, isGameOver, legalMoves, pieceAt, sameCoord } from '../engine';
import type { HighlightModel } from '../render/board';
import type { GameTransport } from '../net/transport';
import type { Coord, GameState } from '../types/game';

/**
 * Bridges any GameTransport into React and owns *UI-only* state (selection).
 * Game truth always comes from the transport — never mutated here.
 */
export function useChessGame(transport: GameTransport) {
  const state: GameState = useSyncExternalStore(transport.subscribe, transport.getState);
  const [selected, setSelected] = useState<Coord | null>(null);

  const legal = useMemo(() => (isGameOver(state) ? [] : legalMoves(state)), [state]);
  const selectedMoves = useMemo(
    () => (selected ? legal.filter((m) => sameCoord(m.from, selected)) : []),
    [legal, selected],
  );

  const onSquare = useCallback(
    (c: Coord) => {
      const move = selectedMoves.find((m) => sameCoord(m.to, c));
      if (move) {
        transport.send({ type: 'move', from: move.from, to: move.to, promotion: 'queen' });
        setSelected(null);
        return;
      }
      const p = pieceAt(state.board, c);
      if (p && p.color === state.turn && !sameCoord(selected, c)) setSelected(c);
      else setSelected(null);
    },
    [selectedMoves, selected, state, transport],
  );

  const reset = useCallback(() => {
    setSelected(null);
    transport.send({ type: 'reset' });
  }, [transport]);

  const highlights: HighlightModel = useMemo(() => {
    const last = state.history.at(-1);
    let checkSquare: Coord | null = null;
    if (state.status === 'check' || state.status === 'checkmate') {
      for (const id of Object.keys(state.board.pieces)) {
        const p = state.board.pieces[id];
        if (p.color === state.turn && getPieceDef(p.kind).royal) checkSquare = findPiece(state.board, id);
      }
    }
    const dests = selectedMoves.filter((m, i, arr) => arr.findIndex((o) => sameCoord(o.to, m.to)) === i);
    return {
      lastMove: last ? { from: last.from, to: last.to } : null,
      selected,
      quietTargets: dests.filter((m) => !m.flags.includes('capture')).map((m) => m.to),
      captureTargets: dests.filter((m) => m.flags.includes('capture')).map((m) => m.to),
      checkSquare,
    };
  }, [state, selected, selectedMoves]);

  const sanLog = useMemo(
    () => state.events.flatMap((e) => (e.type === 'moved' ? [e.san] : [])),
    [state.events],
  );

  return { state, selected, highlights, onSquare, reset, sanLog };
}
