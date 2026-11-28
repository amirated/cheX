import { DIAGONAL } from '../engine/pieces/registry';
import type { RuleModifierDefinition } from '../engine/rules/modifiers';

/**
 * Mod RS-01 "Slipping Rook": rooks may also step one square diagonally.
 * Pure data so the Rust server (`engine/registry.rs`, `RookSlip`) mirrors it exactly.
 */
export const ROOK_SLIP: RuleModifierDefinition = {
  id: 'rookSlip',
  name: 'Slipping Rook',
  description: 'Rooks may also step one square diagonally.',
  extraMovement: (kind) => (kind === 'rook' ? [{ type: 'leap', vectors: DIAGONAL }] : []),
};
