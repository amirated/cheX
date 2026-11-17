import type { Color, Coord, GameState, Move } from '../types/game';
import { isInCheck } from './attacks';
import { sameCoord } from './board';
import { applyEffects } from './effects';
import { pseudoLegalMoves } from './movegen';
import { activeModifiersFor } from './rules/modifiers';
import type { MoveGenContext } from './rules/specialRegistry';

export const contextOf = (state: GameState): MoveGenContext => ({
  board: state.board,
  enPassant: state.enPassant,
});

/** Fully legal moves: pseudo-legal → drop those leaving own royal attacked → relic hooks. */
export function legalMoves(state: GameState, color: Color = state.turn): Move[] {
  const pseudo = pseudoLegalMoves(contextOf(state), color);
  let moves = pseudo.filter((m) => !isInCheck(applyEffects(state.board, m.effects).board, color));
  for (const { active, def } of activeModifiersFor(state, color)) {
    if (def.transformMoves) moves = def.transformMoves(moves, state, color, active);
  }
  return moves;
}

export function legalMovesFrom(state: GameState, from: Coord): Move[] {
  return legalMoves(state).filter((m) => sameCoord(m.from, from));
}

export const sideInCheck = (state: GameState, color: Color = state.turn): boolean =>
  isInCheck(state.board, color, state.enPassant);
