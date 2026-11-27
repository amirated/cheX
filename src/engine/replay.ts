import type { BoardState, Color, GameState, Piece } from '../types/game';
import { applyEffects } from './effects';
import { standardBoard } from './game';

/** Pieces taken so far, keyed by the side that took them. */
export type Captures = Record<Color, Piece[]>;

/** Every position of the game so far, rebuilt from the move history. */
export interface Replay {
  /** boards[k] = the board after k plies (boards[0] is the start). */
  boards: BoardState[];
  /** captures[k] = what each side had taken after k plies. */
  captures: Captures[];
  /** False if the rebuilt final position doesn't match the live one (review is then disabled). */
  ok: boolean;
}

const sameSquares = (a: BoardState, b: BoardState) =>
  a.squares.length === b.squares.length && a.squares.every((id, i) => id === b.squares[i]);

/**
 * Replays `state.history` from the standard start. Every game starts from `standardBoard()`
 * (a reset rebuilds it), and every move carries its own board effects, so this is exact
 * for any mix of mods without re-running move generation.
 */
export function replayGame(state: GameState): Replay {
  const boards: BoardState[] = [standardBoard()];
  let taken: Captures = { white: [], black: [] };
  const captures: Captures[] = [taken];
  try {
    for (const move of state.history) {
      const before = boards[boards.length - 1];
      const mover = before.pieces[move.pieceId];
      const { board, removed } = applyEffects(before, move.effects);
      boards.push(board);
      if (removed.length && mover) taken = { ...taken, [mover.color]: [...taken[mover.color], ...removed] };
      captures.push(taken);
    }
  } catch {
    return { boards: [state.board], captures: [{ white: [], black: [] }], ok: false };
  }
  return { boards, captures, ok: sameSquares(boards[boards.length - 1], state.board) };
}

/** Classic material values; unknown fairy pieces count 3. Kings never leave the board. */
const VALUE: Record<string, number> = { pawn: 1, knight: 3, bishop: 3, rook: 5, queen: 9, king: 0 };
export const materialOf = (pieces: Piece[]) => pieces.reduce((n, p) => n + (VALUE[p.kind] ?? 3), 0);
