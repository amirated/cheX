import './setup';

export * from './board';
export * from './attacks';
export * from './effects';
export * from './legal';
export * from './movegen';
export * from './game';
export * from './fen';
export { getPieceDef, registerPiece, allPieceDefs, symmetric, ORTHOGONAL, DIAGONAL, ALL_8 } from './pieces/registry';
export type { PieceDefinition, MovementRule } from './pieces/types';
export { registerSpecialMove } from './rules/specialRegistry';
export { registerRuleModifier } from './rules/modifiers';
export { registerTileModifier } from './tiles';
