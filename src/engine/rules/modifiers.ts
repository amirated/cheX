import type { ActiveRuleModifier, BoardEffect, Color, GameState, Move, Piece, PieceKind } from '../../types/game';
import { chargesLeft, COOLDOWN_PLIES, isAvailable, levelOf, usesOf } from './charges';
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

/**
 * Mod enhancements a piece can use, as [mod id, extra rules]. With `atPly` the piece must
 * also be off cooldown on that ply; `null` checks charges only.
 */
export function enhancementsOf(
  modifiers: ActiveRuleModifier[],
  piece: Piece,
  atPly: number | null,
): [string, MovementRule[]][] {
  const out: [string, MovementRule[]][] = [];
  for (const m of modifiers) {
    if (!applies(m, piece.color)) continue;
    const rules = registry.get(m.id)?.extraMovement?.(piece.kind, piece.color, m) ?? [];
    if (rules.length && isAvailable(m, piece.id, atPly)) out.push([m.id, rules]);
  }
  return out;
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

/** What a piece's mods look like right now (for the UI: pips, status line). */
export interface PieceModStatus {
  modId: string;
  level: number;
  charges: number;
  /** Usable on its owner's next move. */
  ready: boolean;
  /** Cooling down (charges left, but not on the owner's next move). */
  cooling: boolean;
}

export function pieceModStatus(state: GameState, piece: Piece): PieceModStatus[] {
  const out: PieceModStatus[] = [];
  const atPly = piece.color === state.turn ? state.ply : state.ply + 1;
  for (const m of state.ruleset.modifiers) {
    if (!applies(m, piece.color)) continue;
    if (!registry.get(m.id)?.extraMovement?.(piece.kind, piece.color, m).length) continue;
    const charges = chargesLeft(m, piece.id);
    const ready = isAvailable(m, piece.id, atPly);
    out.push({ modId: m.id, level: levelOf(m), charges, ready, cooling: charges > 0 && !ready });
  }
  return out;
}

/** Plies until a cooling piece is ready (0 when ready or spent). */
export function pliesUntilReady(state: GameState, active: ActiveRuleModifier, pieceId: string): number {
  const [, last] = usesOf(active, pieceId);
  return last === null ? 0 : Math.max(0, last + COOLDOWN_PLIES - state.ply);
}
