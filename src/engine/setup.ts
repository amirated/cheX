import { registerStandardPieces } from './pieces/standard';
import { registerExampleModifiers } from './rules/modifiers';
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
}

setupEngine();
