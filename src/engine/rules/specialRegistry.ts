import type { ActiveRuleModifier, BoardState, Color, Coord, JsonObject, Move, Piece } from '../../types/game';

export interface MoveGenContext {
  board: BoardState;
  enPassant: Coord | null;
  /** Rule modifiers in effect (game mods such as `knightCamel` extend piece movement). */
  modifiers: ActiveRuleModifier[];
  /** Side to move and current ply: mod charges/cooldown are judged at `ownerPly`. */
  turn: Color;
  ply: number;
}

/** The ply on which `color` next moves, from this position. */
export const ownerPly = (ctx: MoveGenContext, color: Color): number => (color === ctx.turn ? ctx.ply : ctx.ply + 1);

/**
 * A hand-written movement ability (castling, en passant, a future "swap with ally",
 * "teleport to any portal", …). Referenced from piece definitions by `id`.
 */
export interface SpecialMoveDefinition {
  id: string;
  /** Produce pseudo-legal moves (own-king safety is checked later, generically). */
  generate(ctx: MoveGenContext, piece: Piece, from: Coord, params: JsonObject): Move[];
  /**
   * Squares this ability *threatens* for check detection. Omit for non-capturing
   * abilities (castling, double push) — that also avoids recursion in check tests.
   */
  attacks?(ctx: MoveGenContext, piece: Piece, from: Coord, params: JsonObject): Coord[];
}

const registry = new Map<string, SpecialMoveDefinition>();

export function registerSpecialMove(def: SpecialMoveDefinition): void {
  registry.set(def.id, def);
}

export function getSpecialMove(id: string): SpecialMoveDefinition {
  const def = registry.get(id);
  if (!def) throw new Error(`Unknown special move "${id}"`);
  return def;
}
