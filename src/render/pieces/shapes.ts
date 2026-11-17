import type { PieceKind } from '../../types/game';

/**
 * Procedural piece silhouettes as vector primitives in a 100×100 design box
 * (origin top-left, base sits near y=90). Nothing here is an image: these are
 * coordinates fed straight into PIXI.Graphics at runtime.
 *
 *  - 'body' shapes are filled with the side's fill color and outlined.
 *  - 'detail' shapes are stroked only, in the outline color (eyes, slits, seams).
 *  - 'accent' shapes are filled with the outline color (eye dots, crown jewels).
 */
export type PathCmd =
  | ['M', number, number]
  | ['L', number, number]
  | ['Q', number, number, number, number]
  | ['C', number, number, number, number, number, number]
  | ['Z'];

export type ShapeGeom =
  | { t: 'poly'; pts: number[] }
  | { t: 'circle'; x: number; y: number; r: number }
  | { t: 'ellipse'; x: number; y: number; rx: number; ry: number }
  | { t: 'rect'; x: number; y: number; w: number; h: number; r?: number }
  | { t: 'path'; d: PathCmd[] }
  | { t: 'line'; pts: number[] };

export type ShapeRole = 'body' | 'detail' | 'accent';
export type Shape = ShapeGeom & { role?: ShapeRole };

const base = (y = 80, h = 10, x0 = 22, x1 = 78): Shape => ({ t: 'rect', x: x0, y, w: x1 - x0, h, r: 3 });
const collar = (y: number, x0: number, x1: number, h = 6): Shape => ({ t: 'rect', x: x0, y, w: x1 - x0, h, r: 2.5 });

const PAWN: Shape[] = [
  { t: 'poly', pts: [33, 81, 67, 81, 59, 58, 41, 58] },
  collar(54, 36, 64),
  { t: 'circle', x: 50, y: 41, r: 13 },
  base(80, 10, 25, 75),
];

const ROOK: Shape[] = [
  { t: 'poly', pts: [30, 81, 70, 81, 66, 42, 34, 42] },
  {
    t: 'poly',
    pts: [26, 44, 26, 18, 36, 18, 36, 26, 45, 26, 45, 18, 55, 18, 55, 26, 64, 26, 64, 18, 74, 18, 74, 44],
  },
  collar(42, 30, 70, 6),
  { t: 'line', pts: [36, 58, 64, 58], role: 'detail' },
  { t: 'line', pts: [35, 68, 65, 68], role: 'detail' },
  base(),
];

const KNIGHT: Shape[] = [
  {
    t: 'path',
    d: [
      ['M', 30, 81],
      ['L', 71, 81],
      ['C', 73, 62, 72, 40, 60, 26],
      ['L', 58, 14],
      ['L', 50, 21],
      ['C', 42, 21, 34, 26, 28, 36],
      ['L', 20, 50],
      ['C', 19, 55, 23, 59, 28, 57],
      ['L', 36, 52],
      ['C', 40, 50, 44, 50, 47, 50],
      ['C', 44, 58, 36, 66, 32, 72],
      ['Z'],
    ],
  },
  { t: 'circle', x: 43, y: 33, r: 3, role: 'accent' },
  { t: 'line', pts: [58, 30, 64, 44, 66, 58], role: 'detail' },
  { t: 'circle', x: 25, y: 51, r: 1.6, role: 'accent' },
  base(),
];

const BISHOP: Shape[] = [
  { t: 'poly', pts: [33, 81, 67, 81, 58, 64, 42, 64] },
  {
    t: 'path',
    d: [
      ['M', 50, 18],
      ['C', 64, 26, 70, 44, 61, 62],
      ['L', 39, 62],
      ['C', 30, 44, 36, 26, 50, 18],
      ['Z'],
    ],
  },
  { t: 'line', pts: [57, 30, 47, 44], role: 'detail' },
  collar(60, 36, 64),
  { t: 'circle', x: 50, y: 14, r: 5 },
  base(),
];

const QUEEN: Shape[] = [
  { t: 'poly', pts: [31, 81, 69, 81, 62, 52, 38, 52] },
  {
    // five-point crown
    t: 'poly',
    pts: [33, 54, 24, 26, 38, 40, 42, 20, 50, 38, 58, 20, 62, 40, 76, 26, 67, 54],
  },
  { t: 'circle', x: 24, y: 24, r: 4.2 },
  { t: 'circle', x: 42, y: 18, r: 4.2 },
  { t: 'circle', x: 58, y: 18, r: 4.2 },
  { t: 'circle', x: 76, y: 24, r: 4.2 },
  { t: 'circle', x: 50, y: 33, r: 3, role: 'accent' },
  collar(52, 33, 67),
  base(),
];

const KING: Shape[] = [
  { t: 'poly', pts: [31, 81, 69, 81, 63, 50, 37, 50] },
  {
    t: 'path',
    d: [
      ['M', 34, 52],
      ['C', 22, 42, 26, 28, 38, 30],
      ['C', 42, 30, 46, 33, 50, 38],
      ['C', 54, 33, 58, 30, 62, 30],
      ['C', 74, 28, 78, 42, 66, 52],
      ['Z'],
    ],
  },
  // cross
  {
    t: 'poly',
    pts: [47, 37, 47, 23, 41, 23, 41, 17, 47, 17, 47, 10, 53, 10, 53, 17, 59, 17, 59, 23, 53, 23, 53, 37],
  },
  collar(49, 32, 68),
  base(),
];

/** Fallback for any fairy piece without a bespoke silhouette: medallion + glyph ring. */
export const GENERIC: Shape[] = [
  { t: 'circle', x: 50, y: 46, r: 26 },
  { t: 'circle', x: 50, y: 46, r: 17, role: 'detail' },
  base(),
];

export const PIECE_SHAPES: Record<string, Shape[]> = {
  pawn: PAWN,
  rook: ROOK,
  knight: KNIGHT,
  bishop: BISHOP,
  queen: QUEEN,
  king: KING,
};

export function registerPieceShape(kind: PieceKind, shapes: Shape[]): void {
  PIECE_SHAPES[kind] = shapes;
}

export const shapesFor = (kind: PieceKind): Shape[] => PIECE_SHAPES[kind] ?? GENERIC;
