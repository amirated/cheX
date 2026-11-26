import type { Coord, Move } from '../../types/game';
import { forwardOf, inBounds, opposite, pieceAt } from '../board';
import { isInCheck, isSquareAttacked } from '../attacks';
import { basicMove } from '../movegen';
import { getPieceDef } from '../pieces/registry';
import { canOccupy, canSlideThrough } from '../tiles';
import { registerSpecialMove } from './specialRegistry';

export function registerStandardSpecials(): void {
  /** Pawn-style first move: N steps forward through empty squares; marks the skipped square for en passant. */
  registerSpecialMove({
    id: 'firstMoveDoubleStep',
    generate(ctx, piece, from, params) {
      if (piece.hasMoved) return [];
      const steps = typeof params.steps === 'number' ? params.steps : 2;
      const fwd = forwardOf(piece.color);
      for (let s = 1; s <= steps; s++) {
        const c = { file: from.file, rank: from.rank + fwd * s };
        if (!inBounds(ctx.board, c) || pieceAt(ctx.board, c) || !canOccupy(ctx.board, c)) return [];
        if (s < steps && !canSlideThrough(ctx.board, c)) return [];
      }
      const to = { file: from.file, rank: from.rank + fwd * steps };
      const m = basicMove(ctx, piece, from, to, ['doublePush']);
      m.enPassantTarget = { file: from.file, rank: from.rank + fwd * (steps - 1) };
      return [m];
    },
  });

  /** Capture a pawn that just double-stepped past us. */
  registerSpecialMove({
    id: 'enPassant',
    generate(ctx, piece, from) {
      const ep = ctx.enPassant;
      if (!ep) return [];
      const fwd = forwardOf(piece.color);
      if (ep.rank !== from.rank + fwd || Math.abs(ep.file - from.file) !== 1) return [];
      const victimAt: Coord = { file: ep.file, rank: from.rank };
      const victim = pieceAt(ctx.board, victimAt);
      if (!victim || victim.color === piece.color || pieceAt(ctx.board, ep)) return [];
      const move: Move = {
        pieceId: piece.id,
        from,
        to: ep,
        flags: ['capture', 'enPassant'],
        promotion: null,
        enPassantTarget: null,
        effects: [
          { type: 'remove', pieceId: victim.id, at: victimAt },
          { type: 'relocate', pieceId: piece.id, from, to: ep },
        ],
      };
      return [move];
    },
  });

  /**
   * Castling, written generically: the royal piece scans left/right along its rank
   * for the nearest unmoved `castlePartner`. King lands two files from the board edge
   * side (c/g on 8 files), partner lands on the inner adjacent square.
   */
  registerSpecialMove({
    id: 'castling',
    generate(ctx, piece, from) {
      const { board } = ctx;
      if (piece.hasMoved || isInCheck(board, piece.color, ctx.enPassant, ctx.modifiers)) return [];
      const out: Move[] = [];

      for (const dir of [1, -1] as const) {
        // find nearest piece in this direction
        let f = from.file + dir;
        let partnerAt: Coord | null = null;
        while (f >= 0 && f < board.width) {
          const c = { file: f, rank: from.rank };
          if (pieceAt(board, c)) {
            partnerAt = c;
            break;
          }
          f += dir;
        }
        if (!partnerAt) continue;
        const partner = pieceAt(board, partnerAt)!;
        if (partner.color !== piece.color || partner.hasMoved || !getPieceDef(partner.kind).castlePartner) continue;

        const kingTo = { file: dir > 0 ? board.width - 2 : 2, rank: from.rank };
        const rookTo = { file: kingTo.file - dir, rank: from.rank };

        // destination squares must be empty (or occupied by the two castling pieces)
        const clear = [kingTo, rookTo].every((c) => {
          const occ = pieceAt(board, c);
          return (!occ || occ.id === piece.id || occ.id === partner.id) && canOccupy(board, c);
        });
        if (!clear) continue;

        // king may not pass through or land on an attacked square
        const enemy = opposite(piece.color);
        const step = Math.sign(kingTo.file - from.file);
        let safe = true;
        for (let x = from.file + step; step !== 0; x += step) {
          const c = { file: x, rank: from.rank };
          if (isSquareAttacked(ctx, c, enemy)) {
            safe = false;
            break;
          }
          if (x === kingTo.file) break;
        }
        if (!safe) continue;

        out.push({
          pieceId: piece.id,
          from,
          to: kingTo,
          flags: [dir > 0 ? 'castleKingside' : 'castleQueenside'],
          promotion: null,
          enPassantTarget: null,
          effects: [
            // King first, then partner: with guarded relocation this order is also
            // correct for Chess960-style overlaps (king landing on the rook's square).
            { type: 'relocate', pieceId: piece.id, from, to: kingTo },
            { type: 'relocate', pieceId: partner.id, from: partnerAt, to: rookTo },
          ],
        });
      }
      return out;
    },
  });
}
