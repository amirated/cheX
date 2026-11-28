import { DEFAULT_LEVEL, initialData } from '../engine/rules/charges';
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
  /** Short name of the move it grants, for the HUD ("Camel leap"). */
  ability: string;
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
    ability: 'Camel leap',
    tagline: 'Knights grow a longer leg.',
    description:
      'Every knight keeps its usual L-shaped jump and gains a longer one: three squares in a straight line, then one to the side. It still jumps over anything in between.',
    rules: [
      'Knights move as normal, or make a camel leap (3,1): three squares one way and one square at a right angle.',
      'Each knight has as many camel leaps as your level: one at level 1, up to three at level 3. Normal knight moves are always free.',
      'After a leap the knight cools down: it skips one of your turns before it can leap again.',
      'The leap jumps over pieces and can capture. A knight that can leap on its next move threatens those squares, so it gives check and pins like any move. A spent or cooling knight only threatens normally.',
      'Watch your king early: a ready knight on d4/f4 hits e1, and one on d5/f5 hits e8.',
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
  {
    id: 'pawnRam',
    code: 'PR-01',
    name: 'Battering Ram',
    ability: 'Ram',
    tagline: 'Pawns punch straight ahead.',
    description:
      'Every pawn keeps its usual moves and gains one more: it can capture the enemy piece standing directly in front of it. Two pawns locked nose to nose are no longer stuck.',
    rules: [
      'Pawns move as normal, or ram: capture the enemy piece directly in front of them, one square straight ahead.',
      'Each pawn has as many rams as your level: one at level 1, up to three at level 3. Normal pawn moves are always free.',
      'After a ram the pawn cools down: it skips one of your turns before it can ram again.',
      'A ram only captures, one square ahead. Stepping forward onto an empty square, the two-square first move and en passant work as in classic chess.',
      'A pawn that can ram on its next move threatens the square in front of it: it gives check to a king standing there, and the enemy king cannot step there. A spent or cooling pawn only threatens diagonally.',
      'Ramming onto the last rank promotes, like any pawn move.',
    ],
    piece: 'pawn',
    diagram: { base: [v(0, 1), v(-1, 1), v(1, 1)], added: [v(0, 1)] },
    lab: [
      { label: 'Draws', value: '16% → 16%' },
      { label: 'Game length', value: '5 plies shorter' },
      { label: 'Colour balance', value: 'unchanged' },
      { label: 'Verdict', value: 'a light touch, even unlimited' },
    ],
    shell: '#ff4d8d',
    status: 'experimental',
  },
  {
    id: 'rookSlip',
    code: 'RS-01',
    name: 'Slipping Rook',
    ability: 'Slip',
    tagline: 'Rooks slip out of the corner.',
    description:
      'Every rook keeps its straight lines and gains one small move: a single step diagonally. It gets a boxed-in rook out of the corner before the files open, or sidesteps onto a better file.',
    rules: [
      'Rooks move as normal, or slip: one step diagonally, to an empty square or onto an enemy piece.',
      'Each rook has as many slips as your level: one at level 1, up to three at level 3. Normal rook moves are always free.',
      'After a slip the rook cools down: it skips one of your turns before it can slip again.',
      'A rook that can slip on its next move threatens its four diagonal neighbours: it gives check and pins like any move. A spent or cooling rook only threatens along its lines.',
      'A slip counts as moving the rook, so that rook can no longer castle.',
      'Everything else is classic chess.',
    ],
    piece: 'rook',
    diagram: { base: [v(0, 1), v(0, 2), v(0, 3), v(0, -1), v(0, -2), v(0, -3), v(1, 0), v(2, 0), v(3, 0), v(-1, 0), v(-2, 0), v(-3, 0)], added: ring(1, 1) },
    lab: [
      { label: 'Rook worth', value: '≈ 5.5 pawns (was ≈ 4)' },
      { label: 'Draws', value: '16% → 15%' },
      { label: 'Game length', value: '12 plies shorter' },
      { label: 'Colour balance', value: 'unchanged' },
    ],
    shell: '#3ddc97',
    status: 'experimental',
  },
  {
    id: 'bishopShift',
    code: 'BS-01',
    name: 'Shifting Bishop',
    ability: 'Shift',
    tagline: 'Bishops cross to the other colour.',
    description:
      'Every bishop keeps its diagonals and gains one step straight up, down or sideways. That step lands on the other square colour, so a bishop is no longer stuck on the squares it started on.',
    rules: [
      'Bishops move as normal, or shift: one step up, down, left or right, to an empty square or onto an enemy piece.',
      'Each bishop has as many shifts as your level: one at level 1, up to three at level 3. Normal bishop moves are always free.',
      'After a shift the bishop cools down: it skips one of your turns before it can shift again.',
      'A shift changes the bishop’s square colour, so two bishops can end up on the same colour.',
      'A bishop that can shift on its next move threatens its four orthogonal neighbours: it gives check and pins like any move. A spent or cooling bishop only threatens diagonally.',
      'Everything else is classic chess.',
    ],
    piece: 'bishop',
    diagram: { base: [1, 2, 3].flatMap((d) => [v(d, d), v(-d, d), v(d, -d), v(-d, -d)]), added: [v(0, 1), v(0, -1), v(1, 0), v(-1, 0)] },
    lab: [
      { label: 'Bishop worth', value: '≈ 4.9 pawns (was ≈ 2.5)' },
      { label: 'Draws', value: '16% → 12%' },
      { label: 'Game length', value: '11 plies shorter' },
      { label: 'Colour balance', value: 'slight White edge' },
    ],
    shell: '#9b7bff',
    status: 'experimental',
  },
];

/** The bay has one slot per enhanceable piece, in this order. A slot holds at most one mod. */
export const SLOT_PIECES: PieceKind[] = ['knight', 'rook', 'bishop', 'pawn'];
export const MAX_SLOTS = SLOT_PIECES.length;

/** Mod ids for a loadout, one per piece slot, in slot order (the later id wins a slot). */
export function normalizeLoadout(ids: string[]): string[] {
  const bySlot = new Map<PieceKind, string>();
  for (const id of ids) {
    const info = MODS.find((m) => m.id === id);
    if (info && SLOT_PIECES.includes(info.piece)) bySlot.set(info.piece, id);
  }
  return SLOT_PIECES.flatMap((p) => (bySlot.has(p) ? [bySlot.get(p)!] : []));
}

/** The mod seated in a piece's slot, if any. */
export const slotMod = (ids: string[], piece: PieceKind): string | undefined =>
  ids.find((id) => MODS.find((m) => m.id === id)?.piece === piece);

export const modInfo = (id: string): ModInfo | undefined => MODS.find((m) => m.id === id);

/**
 * Ruleset for a set of mods (global, both sides), each at `levelOf(id)`. Canonical: sorted,
 * de-duplicated, name = ids joined by "+" or "standard", data `{ level }`.
 * Must match `Ruleset::with_levels` in cheX-BE.
 */
export function rulesetFor(ids: string[], levelOf: (id: string) => number = () => DEFAULT_LEVEL): Ruleset {
  const sorted = [...new Set(ids)].sort();
  if (!sorted.length) return { name: 'standard', modifiers: [] };
  return { name: sorted.join('+'), modifiers: sorted.map((id) => ({ id, owner: null, data: initialData(levelOf(id)) })) };
}

export const modsOf = (ruleset: Ruleset): string[] => ruleset.modifiers.map((m) => m.id);
