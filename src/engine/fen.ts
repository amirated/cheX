import './setup';
import type { Color, GameState } from '../types/game';
import { createEmptyBoard, indexOf, parseSquare } from './board';
import { createGameState, makePiece } from './game';
import { pieceKindFromSymbol } from './pieces/registry';

/**
 * FEN import (tests, puzzles, debug). Castling rights are mapped onto `hasMoved`
 * flags; pawns off their start rank are marked as moved.
 */
export function fromFEN(fen: string): GameState {
  const [placement, turn = 'w', castling = '-', ep = '-', half = '0', full = '1'] = fen.trim().split(/\s+/);
  const board = createEmptyBoard(8, 8);
  let n = 0;

  placement.split('/').forEach((row, i) => {
    const rank = 7 - i;
    let file = 0;
    for (const ch of row) {
      if (/\d/.test(ch)) {
        file += parseInt(ch, 10);
        continue;
      }
      const kind = pieceKindFromSymbol(ch);
      if (!kind) throw new Error(`Bad FEN piece "${ch}"`);
      const color: Color = ch === ch.toUpperCase() ? 'white' : 'black';
      const id = `p${n++}`;
      const startRank = color === 'white' ? 1 : 6;
      board.pieces[id] = makePiece(id, kind, color, kind === 'pawn' ? rank !== startRank : true);
      board.squares[indexOf(board, { file, rank })] = id;
      file++;
    }
  });

  const unmove = (sq: string) => {
    const id = board.squares[indexOf(board, parseSquare(sq))];
    if (id) board.pieces[id] = { ...board.pieces[id], hasMoved: false };
  };
  if (castling.includes('K')) unmove('e1'), unmove('h1');
  if (castling.includes('Q')) unmove('e1'), unmove('a1');
  if (castling.includes('k')) unmove('e8'), unmove('h8');
  if (castling.includes('q')) unmove('e8'), unmove('a8');

  const state = createGameState(board);
  return {
    ...state,
    turn: turn === 'b' ? 'black' : 'white',
    enPassant: ep === '-' ? null : parseSquare(ep),
    halfmoveClock: parseInt(half, 10),
    fullmoveNumber: parseInt(full, 10),
  };
}
