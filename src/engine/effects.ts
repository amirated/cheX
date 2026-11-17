import type { BoardEffect, BoardState, Piece } from '../types/game';
import { cloneBoard, indexOf } from './board';

export interface EffectResult {
  board: BoardState;
  removed: Piece[];
}

/**
 * The single place where the board is mutated. Pure: returns a new BoardState.
 * Mirrors 1:1 to a Rust `fn apply_effects(board, &[BoardEffect]) -> BoardState`.
 */
export function applyEffects(input: BoardState, effects: BoardEffect[]): EffectResult {
  const board = cloneBoard(input);
  const removed: Piece[] = [];

  for (const e of effects) {
    switch (e.type) {
      case 'relocate': {
        const fromIdx = indexOf(board, e.from);
        if (board.squares[fromIdx] === e.pieceId) board.squares[fromIdx] = null;
        board.squares[indexOf(board, e.to)] = e.pieceId;
        const p = board.pieces[e.pieceId];
        if (!p.hasMoved) board.pieces[e.pieceId] = { ...p, hasMoved: true };
        break;
      }
      case 'remove': {
        const i = indexOf(board, e.at);
        if (board.squares[i] === e.pieceId) board.squares[i] = null;
        const p = board.pieces[e.pieceId];
        if (p) removed.push(p);
        delete board.pieces[e.pieceId];
        break;
      }
      case 'transform': {
        const p = board.pieces[e.pieceId];
        board.pieces[e.pieceId] = { ...p, kind: e.toKind };
        break;
      }
      case 'spawn': {
        board.pieces[e.piece.id] = e.piece;
        board.squares[indexOf(board, e.at)] = e.piece.id;
        break;
      }
      case 'addTileModifier': {
        const i = indexOf(board, e.at);
        board.tiles[i] = { modifiers: [...board.tiles[i].modifiers, e.modifier] };
        break;
      }
      case 'removeTileModifier': {
        const i = indexOf(board, e.at);
        board.tiles[i] = { modifiers: board.tiles[i].modifiers.filter((m) => m.id !== e.modifierId) };
        break;
      }
    }
  }
  return { board, removed };
}
