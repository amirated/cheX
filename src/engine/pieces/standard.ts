import { ALL_8, DIAGONAL, ORTHOGONAL, registerPiece, symmetric, vec } from './registry';
import type { PieceDefinition } from './types';

/**
 * Standard chess, expressed purely as data. A fairy piece is just another entry:
 *
 *   registerPiece({ kind: 'archbishop', name: 'Archbishop', symbol: 'A', value: 7,
 *     movement: [{ type: 'slide', vectors: DIAGONAL }, { type: 'leap', vectors: symmetric(1, 2) }] });
 */
export const STANDARD_PIECES: PieceDefinition[] = [
  {
    kind: 'pawn',
    name: 'Pawn',
    symbol: 'P',
    value: 1,
    directional: true,
    promotion: { options: ['queen', 'rook', 'bishop', 'knight'] },
    movement: [
      { type: 'slide', vectors: [vec(0, 1)], maxSteps: 1, mode: 'move' },
      { type: 'leap', vectors: [vec(-1, 1), vec(1, 1)], mode: 'capture' },
      { type: 'special', id: 'firstMoveDoubleStep', params: { steps: 2 } },
      { type: 'special', id: 'enPassant' },
    ],
  },
  {
    kind: 'knight',
    name: 'Knight',
    symbol: 'N',
    value: 3,
    movement: [{ type: 'leap', vectors: symmetric(1, 2) }],
  },
  {
    kind: 'bishop',
    name: 'Bishop',
    symbol: 'B',
    value: 3,
    movement: [{ type: 'slide', vectors: DIAGONAL }],
  },
  {
    kind: 'rook',
    name: 'Rook',
    symbol: 'R',
    value: 5,
    castlePartner: true,
    movement: [{ type: 'slide', vectors: ORTHOGONAL }],
  },
  {
    kind: 'queen',
    name: 'Queen',
    symbol: 'Q',
    value: 9,
    movement: [{ type: 'slide', vectors: ALL_8 }],
  },
  {
    kind: 'king',
    name: 'King',
    symbol: 'K',
    value: 0,
    royal: true,
    movement: [
      { type: 'slide', vectors: ALL_8, maxSteps: 1 },
      { type: 'special', id: 'castling' },
    ],
  },
];

export function registerStandardPieces(): void {
  STANDARD_PIECES.forEach(registerPiece);
}
