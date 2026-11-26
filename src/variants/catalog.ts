import type { PieceKind, Ruleset, Vec } from '../types/game';

/**
 * The mod library: everything players read about a mod (cartridge label, rules,
 * research notes). Behaviour lives in the engine registry under the same `id`.
 */
export interface ModInfo {
  id: string;
  /** Cartridge code printed on the label. */
  code: string;
  name: string;
  tagline: string;
  description: string;
  rules: string[];
  /** Piece the mod changes (drives the diagram and the piece marker). */
  piece: PieceKind;
  /** For the move diagram: what the piece already does, and what the mod adds. */
  diagram: { base: Vec[]; added: Vec[] };
  /** Findings from the cheX-research self-play study, shown as "lab notes". */
  lab?: { label: string; value: string }[];
  /** Cartridge shell colour. */
  shell: string;
  status: 'stable' | 'experimental';
}

const v = (dFile: number, dRank: number): Vec => ({ dFile, dRank });
const ring = (a: number, b: number): Vec[] => {
  const out: Vec[] = [];
  for (const [x, y] of [[a, b], [b, a]])
    for (const sx of [1, -1]) for (const sy of [1, -1]) {
      const vec = v(x * sx, y * sy);
      if (!out.some((o) => o.dFile === vec.dFile && o.dRank === vec.dRank)) out.push(vec);
    }
  return out;
};

export const MODS: ModInfo[] = [
  {
    id: 'knightCamel',
    code: 'NC-01',
    name: 'Camel Knight',
    tagline: 'Knights grow a longer leg.',
    description:
      'Every knight keeps its usual L-shaped jump and gains a longer one: three squares in a straight line, then one to the side. It still jumps over anything in between.',
    rules: [
      'Knights move as normal, or leap (3,1): three squares one way and one square at a right angle.',
      'The camel leap jumps over pieces and can capture, just like a normal knight move.',
      'Camel leaps give check, pin and fork exactly like ordinary moves.',
      'Watch your king early: a knight on d4/f4 hits e1, and one on d5/f5 hits e8. Mate in two is possible if you sleep on it.',
      'A king and a lone knight can still deliver mate here, so it is not an automatic draw.',
      'Everything else is classic chess: castling, en passant, promotion and the 50-move rule.',
    ],
    piece: 'knight',
    diagram: { base: ring(1, 2), added: ring(1, 3) },
    lab: [
      { label: 'Knight worth', value: '≈ 5 pawns (rook ≈ 4)' },
      { label: 'Draws', value: '16% → 10%' },
      { label: 'Game length', value: '21 plies shorter' },
      { label: 'Colour balance', value: 'unchanged' },
    ],
    shell: '#ff9f1c',
    status: 'experimental',
  },
];

export const MAX_SLOTS = 3;

export const modInfo = (id: string): ModInfo | undefined => MODS.find((m) => m.id === id);

/**
 * Ruleset for a set of mods (global, both sides). Canonical: sorted, de-duplicated,
 * name = ids joined by "+" or "standard". Must match `Ruleset::with_mods` in cheX-BE.
 */
export function rulesetFor(ids: string[]): Ruleset {
  const sorted = [...new Set(ids)].sort();
  if (!sorted.length) return { name: 'standard', modifiers: [] };
  return { name: sorted.join('+'), modifiers: sorted.map((id) => ({ id, owner: null, data: {} })) };
}

export const modsOf = (ruleset: Ruleset): string[] => ruleset.modifiers.map((m) => m.id);
