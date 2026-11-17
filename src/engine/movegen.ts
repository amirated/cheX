import type { BoardEffect, Coord, Move, MoveFlag, Piece } from '../types/game';
import { forwardOf, inBounds, occupied, pieceAt } from './board';
import { getPieceDef } from './pieces/registry';
import type { MoveMode } from './pieces/types';
import { getSpecialMove, type MoveGenContext } from './rules/specialRegistry';
import { canOccupy, canSlideThrough } from './tiles';

/** Build a plain move/capture with its effect list. */
export function basicMove(
  ctx: MoveGenContext,
  piece: Piece,
  from: Coord,
  to: Coord,
  extraFlags: MoveFlag[] = [],
): Move {
  const effects: BoardEffect[] = [];
  const flags: MoveFlag[] = [...extraFlags];
  const victim = pieceAt(ctx.board, to);
  if (victim) {
    effects.push({ type: 'remove', pieceId: victim.id, at: to });
    flags.push('capture');
  }
  effects.push({ type: 'relocate', pieceId: piece.id, from, to });
  return { pieceId: piece.id, from, to, flags, promotion: null, enPassantTarget: null, effects };
}

function targetAllowed(ctx: MoveGenContext, piece: Piece, to: Coord, mode: MoveMode): 'move' | 'capture' | null {
  if (!canOccupy(ctx.board, to)) return null;
  const occ = pieceAt(ctx.board, to);
  if (!occ) return mode === 'capture' ? null : 'move';
  if (occ.color === piece.color) return null;
  return mode === 'move' ? null : 'capture';
}

/** Expand moves that land on the far rank into one move per promotion option. */
function expandPromotions(ctx: MoveGenContext, piece: Piece, moves: Move[]): Move[] {
  const promo = getPieceDef(piece.kind).promotion;
  if (!promo) return moves;
  const farRank = piece.color === 'white' ? ctx.board.height - 1 : 0;
  const out: Move[] = [];
  for (const m of moves) {
    if (m.to.rank !== farRank || m.flags.includes('promotion')) {
      out.push(m);
      continue;
    }
    for (const kind of promo.options) {
      out.push({
        ...m,
        flags: [...m.flags, 'promotion'],
        promotion: kind,
        effects: [...m.effects, { type: 'transform', pieceId: piece.id, toKind: kind }],
      });
    }
  }
  return out;
}

/** Pseudo-legal moves for one piece (may leave own royal in check). */
export function pieceMoves(ctx: MoveGenContext, piece: Piece, from: Coord): Move[] {
  const def = getPieceDef(piece.kind);
  const fwd = def.directional ? forwardOf(piece.color) : 1;
  const moves: Move[] = [];

  for (const rule of def.movement) {
    if (rule.type === 'special') {
      moves.push(...getSpecialMove(rule.id).generate(ctx, piece, from, rule.params ?? {}));
      continue;
    }
    const mode = rule.mode ?? 'both';
    for (const v of rule.vectors) {
      const df = v.dFile;
      const dr = v.dRank * fwd;
      const max = rule.type === 'leap' ? 1 : (rule.maxSteps ?? Infinity);
      for (let step = 1; step <= max; step++) {
        const to = { file: from.file + df * step, rank: from.rank + dr * step };
        if (!inBounds(ctx.board, to)) break;
        const kind = targetAllowed(ctx, piece, to, mode);
        if (kind) moves.push(basicMove(ctx, piece, from, to));
        if (rule.type === 'slide' && (pieceAt(ctx.board, to) || !canSlideThrough(ctx.board, to))) break;
      }
    }
  }
  return expandPromotions(ctx, piece, moves);
}

export function pseudoLegalMoves(ctx: MoveGenContext, color: Piece['color']): Move[] {
  const out: Move[] = [];
  for (const { piece, at } of occupied(ctx.board)) {
    if (piece.color === color) out.push(...pieceMoves(ctx, piece, at));
  }
  return out;
}
