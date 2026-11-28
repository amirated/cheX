import { registerStandardPieces } from './pieces/standard';
import { KNIGHT_CAMEL } from '../variants/knightCamel';
import { PAWN_RAM } from '../variants/pawnRam';
import { ROOK_SLIP } from '../variants/rookSlip';
import { BISHOP_SHIFT } from '../variants/bishopShift';
import { registerExampleModifiers, registerRuleModifier } from './rules/modifiers';
import { registerStandardSpecials } from './rules/standardSpecials';
import { registerStandardTiles } from './tiles';

let done = false;

/** Idempotent registry bootstrap. Imported for side-effects by the engine entry. */
export function setupEngine(): void {
  if (done) return;
  done = true;
  registerStandardPieces();
  registerStandardSpecials();
  registerStandardTiles();
  registerExampleModifiers();
  // Game mods (see src/variants/catalog.ts). Inactive unless listed in a game's ruleset.
  registerRuleModifier(KNIGHT_CAMEL);
  registerRuleModifier(PAWN_RAM);
  registerRuleModifier(ROOK_SLIP);
  registerRuleModifier(BISHOP_SHIFT);
}

setupEngine();
