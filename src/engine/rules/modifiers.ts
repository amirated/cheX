import type { ActiveRuleModifier, BoardEffect, Color, GameState, Move } from '../../types/game';

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
