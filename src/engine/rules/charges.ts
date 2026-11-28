import type { ActiveRuleModifier, JsonObject, Ruleset } from '../../types/game';

/**
 * Mod charges and cooldown.
 *
 * A piece mod gives a piece kind extra movement, but each piece may use it only `level`
 * times per game (1–3, from player progression; both sides play the lower of their two
 * levels). After a use the piece **cools down**: its owner's next turn passes without it,
 * then it is ready again while charges remain. A spent or cooling piece moves — and
 * threatens — only normally.
 *
 * State lives in the active modifier's `data`, so it needs no per-mod code:
 *   { level: 2, uses: { "<pieceId>": [count, lastUsePly] } }
 * Mirrors `cheX-BE/src/engine/charges.rs`.
 */

export const MAX_LEVEL = 3;
export const DEFAULT_LEVEL = 1;
/** Plies between a use and the next: the owner's next turn is skipped (2 plies per turn). */
export const COOLDOWN_PLIES = 4;

export const clampLevel = (level: number): number => Math.min(MAX_LEVEL, Math.max(1, Math.floor(level) || 1));

export const initialData = (level: number): JsonObject => ({ level: clampLevel(level) });

export function levelOf(active: ActiveRuleModifier): number {
  const l = active.data.level;
  return clampLevel(typeof l === 'number' ? l : DEFAULT_LEVEL);
}

/** [times used, ply of last use | null] for one piece. */
export function usesOf(active: ActiveRuleModifier, pieceId: string): [number, number | null] {
  const uses = active.data.uses as Record<string, unknown> | undefined;
  const entry = uses?.[pieceId];
  if (!Array.isArray(entry)) return [0, null];
  return [typeof entry[0] === 'number' ? entry[0] : 0, typeof entry[1] === 'number' ? entry[1] : null];
}

export const chargesLeft = (active: ActiveRuleModifier, pieceId: string): number =>
  Math.max(0, levelOf(active) - usesOf(active, pieceId)[0]);

/** Can the piece use the mod on ply `atPly`? `null` ignores the cooldown (charges only). */
export function isAvailable(active: ActiveRuleModifier, pieceId: string, atPly: number | null): boolean {
  const [n, last] = usesOf(active, pieceId);
  if (n >= levelOf(active)) return false;
  return atPly === null || last === null || atPly >= last + COOLDOWN_PLIES;
}

/** The modifier after `pieceId` spends a charge on ply `ply` (pure). */
export function withUse(active: ActiveRuleModifier, pieceId: string, ply: number): ActiveRuleModifier {
  const [n] = usesOf(active, pieceId);
  const uses = { ...((active.data.uses as JsonObject | undefined) ?? {}), [pieceId]: [n + 1, ply] };
  return { ...active, data: { ...active.data, uses } };
}

export const MOD_FLAG_PREFIX = 'mod:';
export const modFlag = (modId: string) => `${MOD_FLAG_PREFIX}${modId}`;
export const modOfFlag = (flag: string): string | null => (flag.startsWith(MOD_FLAG_PREFIX) ? flag.slice(MOD_FLAG_PREFIX.length) : null);
/** The mod a move used, if any. */
export const modOfMove = (move: { flags: string[] }): string | null =>
  move.flags.map(modOfFlag).find((m): m is string => m !== null) ?? null;

/**
 * The same rules with every piece's charges full again: a new game (rematch, reset) keeps
 * each mod and its level but forgets the previous game's uses.
 * Mirrors `fresh_ruleset` in cheX-BE `engine/charges.rs`.
 */
export function freshRuleset(ruleset: Ruleset): Ruleset {
  if (!ruleset.modifiers.some((m) => 'uses' in m.data)) return ruleset;
  return {
    ...ruleset,
    modifiers: ruleset.modifiers.map((m) => {
      if (!('uses' in m.data)) return m;
      const { uses: _spent, ...data } = m.data;
      return { ...m, data };
    }),
  };
}
