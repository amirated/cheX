import type { ActiveRuleModifier, BoardEffect, Color, GameState, Move, Piece, PieceKind } from '../../types/game';
import { getPieceDef } from '../pieces/registry';
import type { MovementRule } from '../pieces/types';

/**
 * Relics / rule-benders. State only lists `{ id, owner, data }`; the behaviour lives here.
 * Hooks are pure functions so the Rust server can host an identical registry later.
 */
export interface RuleModifierDefinition {
  id: string;
  name: string;
  description: string;
  /** Filter/extend the side-to-move's LEGAL moves (after king-safety filtering). */
  transformMoves?(moves: Move[], state: GameState, color: Color, active: ActiveRuleModifier): Move[];
  /** Extra board effects appended after a move resolves (e.g. "leave fire on origin tile"). */
  afterMove?(state: GameState, move: Move, active: ActiveRuleModifier): BoardEffect[];
  /**
   * Movement rules added to a piece kind while this modifier is active (game mods).
   * They count for attacks and check too, exactly like the piece's own rules.
   */
  extraMovement?(kind: PieceKind, color: Color, active: ActiveRuleModifier): MovementRule[];
}

const registry = new Map<string, RuleModifierDefinition>();

export function registerRuleModifier(def: RuleModifierDefinition): void {
  registry.set(def.id, def);
}

export function getRuleModifier(id: string): RuleModifierDefinition | undefined {
  return registry.get(id);
}

/** Active modifiers that apply to `color` (owned by it, or global). */
export function activeModifiersFor(state: GameState, color: Color) {
  return state.ruleset.modifiers
    .filter((m) => m.owner === null || m.owner === color)
    .map((active) => ({ active, def: registry.get(active.id) }))
    .filter((x): x is { active: ActiveRuleModifier; def: RuleModifierDefinition } => !!x.def);
}

const applies = (m: ActiveRuleModifier, color: Color) => m.owner === null || m.owner === color;

/** A piece's movement in this game: its definition plus whatever active mods add. */
export function movementOf(modifiers: ActiveRuleModifier[], piece: Piece): MovementRule[] {
  const base = getPieceDef(piece.kind).movement;
  let extra: MovementRule[] | null = null;
  for (const m of modifiers) {
    if (!applies(m, piece.color)) continue;
    const add = registry.get(m.id)?.extraMovement?.(piece.kind, piece.color, m);
    if (add?.length) extra = [...(extra ?? []), ...add];
  }
  return extra ? [...base, ...extra] : base;
}

/** Does any active mod change how this piece moves? */
export const isModified = (modifiers: ActiveRuleModifier[], piece: Piece): boolean =>
  movementOf(modifiers, piece) !== getPieceDef(piece.kind).movement;

export function registerExampleModifiers(): void {
  // Inactive by default — add `{ id: 'noCastling', owner: null, data: {} }` to a Ruleset to try it.
  registerRuleModifier({
    id: 'noCastling',
    name: 'Broken Towers',
    description: 'Castling is forbidden.',
    transformMoves: (moves) =>
      moves.filter((m) => !m.flags.includes('castleKingside') && !m.flags.includes('castleQueenside')),
  });
}
