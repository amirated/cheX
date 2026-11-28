import { ORTHOGONAL } from '../engine/pieces/registry';
import type { RuleModifierDefinition } from '../engine/rules/modifiers';

/**
 * Mod BS-01 "Shifting Bishop": bishops may also step one square orthogonally, which puts
 * them on the other square colour. Pure data so the Rust server (`engine/registry.rs`,
 * `BishopShift`) mirrors it exactly.
 */
export const BISHOP_SHIFT: RuleModifierDefinition = {
  id: 'bishopShift',
  name: 'Shifting Bishop',
  description: 'Bishops may also step one square orthogonally, onto the other colour.',
  extraMovement: (kind) => (kind === 'bishop' ? [{ type: 'leap', vectors: ORTHOGONAL }] : []),
};
