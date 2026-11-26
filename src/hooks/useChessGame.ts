import { useCallback, useMemo, useState, useSyncExternalStore } from 'react';
import { findPiece, getPieceDef, isGameOver, legalMoves, pieceAt, sameCoord } from '../engine';
import type { HighlightModel } from '../render/board';
import { haptic } from '../feedback/haptics';
import { playSound } from '../feedback/sound';
import { controls, type GameTransport } from '../net/transport';
import type { Coord, GameState, Move } from '../types/game';
import { modInfo, modsOf } from '../variants/catalog';

/**
 * Bridges any GameTransport into React and owns *UI-only* state (selection).
 * Game truth always comes from the transport — never mutated here.
 */
export function useChessGame(transport: GameTransport) {
  const state: GameState = useSyncExternalStore(transport.subscribe, transport.getState);
  const meta = useSyncExternalStore(transport.subscribeMeta, transport.getMeta);
  const [selected, setSelected] = useState<Coord | null>(null);
  const myTurn = controls(meta, state.turn);

  const legal = useMemo(() => (isGameOver(state) || !myTurn ? [] : legalMoves(state)), [state, myTurn]);
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
      if (p && p.color === state.turn && myTurn && !sameCoord(selected, c)) {
        setSelected(c);
        playSound('select');
        haptic('select');
      } else {
        // A tap that can't do anything: an opponent's piece, or a square the selected piece can't reach.
        const pointless = !isGameOver(state) && ((p && !myTurn) || (selected && !sameCoord(selected, c) && (!p || p.color !== state.turn)));
        if (pointless) {
          playSound('illegal');
          haptic('illegal');
        }
        setSelected(null);
      }
    },
    [selectedMoves, selected, state, transport, myTurn],
  );

  const resign = useCallback(() => {
    if (meta.mode === 'online' && meta.seat) transport.send({ type: 'resign', color: meta.seat });
  }, [meta, transport]);

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
    // Moves that exist only because of a plugged-in mod get the cartridge's colour.
    const mods = modsOf(state.ruleset).flatMap((id) => modInfo(id) ?? []);
    const byMod = (m: Move) => {
      const kind = state.board.pieces[m.pieceId]?.kind;
      const df = m.to.file - m.from.file;
      const dr = m.to.rank - m.from.rank;
      return mods.find(
        (mod) =>
          mod.piece === kind &&
          mod.diagram.added.some((v) => v.dFile === df && v.dRank === dr) &&
          !mod.diagram.base.some((v) => v.dFile === df && v.dRank === dr),
      );
    };
    const modMoves = dests.filter((m) => byMod(m));
    const plain = dests.filter((m) => !byMod(m));
    const modColor = modMoves.length ? parseInt(byMod(modMoves[0])!.shell.slice(1), 16) : undefined;
    return {
      lastMove: last ? { from: last.from, to: last.to } : null,
      selected,
      quietTargets: plain.filter((m) => !m.flags.includes('capture')).map((m) => m.to),
      captureTargets: plain.filter((m) => m.flags.includes('capture')).map((m) => m.to),
      checkSquare,
      modTargets: modMoves.map((m) => ({ at: m.to, capture: m.flags.includes('capture') })),
      modColor,
    };
  }, [state, selected, selectedMoves]);

  const sanLog = useMemo(
    () => state.events.flatMap((e) => (e.type === 'moved' ? [e.san] : [])),
    [state.events],
  );

  // Drop a stale selection when the turn passes (e.g. opponent moved online).
  const activeSelected = myTurn ? selected : null;
  const activeHighlights =
    activeSelected === selected ? highlights : { ...highlights, selected: null, quietTargets: [], captureTargets: [], modTargets: [] };

  return { state, meta, myTurn, selected: activeSelected, highlights: activeHighlights, onSquare, reset, resign, sanLog };
}
