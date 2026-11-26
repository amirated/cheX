import type { ActiveRuleModifier, BoardState, Color, Coord, Piece } from '../types/game';
import { forwardOf, inBounds, occupied, opposite, pieceIdAt } from './board';
import { getPieceDef } from './pieces/registry';
import { movementOf } from './rules/modifiers';
import { getSpecialMove, type MoveGenContext } from './rules/specialRegistry';
import { canSlideThrough } from './tiles';

/** Does `piece` standing on `from` threaten `target`? Data-driven from its definition. */
export function pieceAttacks(ctx: MoveGenContext, piece: Piece, from: Coord, target: Coord): boolean {
  const { board } = ctx;
  const def = getPieceDef(piece.kind);
  const fwd = def.directional ? forwardOf(piece.color) : 1;

  for (const rule of movementOf(ctx.modifiers, piece)) {
    if (rule.type === 'special') {
      const sp = getSpecialMove(rule.id);
      if (sp.attacks) {
        const hit = sp.attacks(ctx, piece, from, rule.params ?? {});
        if (hit.some((c) => c.file === target.file && c.rank === target.rank)) return true;
      }
      continue;
    }
    if (rule.mode === 'move') continue; // push-only rules never attack

    for (const v of rule.vectors) {
      const df = v.dFile;
      const dr = v.dRank * fwd;
      if (rule.type === 'leap') {
        if (from.file + df === target.file && from.rank + dr === target.rank) return true;
        continue;
      }
      // slide: quick direction rejection before stepping
      const max = rule.maxSteps ?? Infinity;
      let f = from.file + df;
      let r = from.rank + dr;
      for (let step = 1; step <= max; step++, f += df, r += dr) {
        const c = { file: f, rank: r };
        if (!inBounds(board, c)) break;
        if (f === target.file && r === target.rank) return true;
        if (pieceIdAt(board, c) || !canSlideThrough(board, c)) break;
      }
    }
  }
  return false;
}

export function isSquareAttacked(ctx: MoveGenContext, target: Coord, by: Color): boolean {
  for (const { piece, at } of occupied(ctx.board)) {
    if (piece.color === by && pieceAttacks(ctx, piece, at, target)) return true;
  }
  return false;
}

/** A side is in check if ANY of its royal pieces is attacked. No royals → never in check. */
export function isInCheck(
  board: BoardState,
  color: Color,
  enPassant: Coord | null = null,
  modifiers: ActiveRuleModifier[] = [],
): boolean {
  const ctx: MoveGenContext = { board, enPassant, modifiers };
  for (const { piece, at } of occupied(board)) {
    if (piece.color === color && getPieceDef(piece.kind).royal) {
      if (isSquareAttacked(ctx, at, opposite(color))) return true;
    }
  }
  return false;
}
