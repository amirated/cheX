import type { RuleModifierDefinition } from '../engine/rules/modifiers';

/**
 * Mod PR-01 "Battering Ram": pawns may also capture the piece directly in front of them.
 * A capture-only leap one square forward (flipped for Black, since pawns are directional).
 * Pure data so the Rust server (`engine/registry.rs`, `PawnRam`) mirrors it exactly.
 */
export const PAWN_RAM: RuleModifierDefinition = {
  id: 'pawnRam',
  name: 'Battering Ram',
  description: 'Pawns may also capture the piece directly in front of them.',
  extraMovement: (kind) => (kind === 'pawn' ? [{ type: 'leap', vectors: [{ dFile: 0, dRank: 1 }], mode: 'capture' }] : []),
};
