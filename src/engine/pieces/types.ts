import type { JsonObject, PieceKind, Vec } from '../../types/game';

/**
 * How a movement rule may interact with the destination square.
 *  - 'both'    : move to empty squares or capture enemies (most pieces)
 *  - 'move'    : only to empty squares (pawn push)
 *  - 'capture' : only onto enemies (pawn diagonal) — still *attacks* empty squares
 */
export type MoveMode = 'both' | 'move' | 'capture';

/** Repeats a vector until blocked (rook, bishop) or up to `maxSteps` (king, pawn push). */
export interface SlideRule {
  type: 'slide';
  vectors: Vec[];
  maxSteps?: number;
  mode?: MoveMode;
}

/** Jumps straight to the target, ignoring blockers (knight, camel, zebra…). */
export interface LeapRule {
  type: 'leap';
  vectors: Vec[];
  mode?: MoveMode;
}

/** Hand-written generator looked up by id in the special-move registry. */
export interface SpecialRule {
  type: 'special';
  id: string;
  params?: JsonObject;
}

export type MovementRule = SlideRule | LeapRule | SpecialRule;

export interface PieceDefinition {
  kind: PieceKind;
  name: string;
  /** Single-letter SAN / FEN symbol (uppercase). Pawns use '' in SAN. */
  symbol: string;
  /** Material value, for AI / shops / UI. */
  value: number;
  /** Losing all royal pieces' safety = check/checkmate. */
  royal?: boolean;
  /** Can be the rook-side partner when a royal piece castles. */
  castlePartner?: boolean;
  /** Vectors' dRank is flipped for Black when true (pawns, future "forward-only" pieces). */
  directional?: boolean;
  /** Promotes on reaching the far rank. First option is the UI default. */
  promotion?: { options: PieceKind[] };
  movement: MovementRule[];
}
