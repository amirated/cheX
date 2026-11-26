import { DEFAULT_LEVEL, MAX_LEVEL } from '../engine/rules/charges';

/**
 * Player progression → mod levels.
 *
 * A mod's level (1–3) is how many times each enhanced piece may use it per game. Levels
 * will come from player progression; there are no accounts yet, so everyone is level 1.
 * Online, the server decides: both players play the **lower** of their two levels.
 * This is the single place to change when progression arrives (mirrors cheX-BE
 * `progression.rs`).
 */
export { MAX_LEVEL };

export function playerLevel(_modId: string): number {
  return DEFAULT_LEVEL;
}
