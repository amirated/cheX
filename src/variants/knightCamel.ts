import { symmetric } from '../engine/pieces/registry';
import type { RuleModifierDefinition } from '../engine/rules/modifiers';

/**
 * Mod NC-01 "Camel Knight": knights may also make a (3,1) camel leap.
 * Pure data so the Rust server (`engine/registry.rs`, `KnightCamel`) mirrors it exactly.
 */
export const KNIGHT_CAMEL: RuleModifierDefinition = {
  id: 'knightCamel',
  name: 'Camel Knight',
  description: 'Knights may also leap like a camel: three squares one way, one square the other.',
  extraMovement: (kind) => (kind === 'knight' ? [{ type: 'leap', vectors: symmetric(1, 3) }] : []),
};
