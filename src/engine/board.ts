import type { BoardState, Color, Coord, Piece, PieceId, Tile } from '../types/game';

export const FILES = 'abcdefghijklmnopqrstuvwxyz';

export const opposite = (c: Color): Color => (c === 'white' ? 'black' : 'white');

/** +1 for White (moves up the ranks), -1 for Black. */
export const forwardOf = (c: Color): 1 | -1 => (c === 'white' ? 1 : -1);

export const coord = (file: number, rank: number): Coord => ({ file, rank });

export const sameCoord = (a: Coord | null, b: Coord | null): boolean =>
  !!a && !!b && a.file === b.file && a.rank === b.rank;

export const inBounds = (b: BoardState, c: Coord): boolean =>
  c.file >= 0 && c.rank >= 0 && c.file < b.width && c.rank < b.height;

export const indexOf = (b: BoardState, c: Coord): number => c.rank * b.width + c.file;

export const coordOfIndex = (b: BoardState, i: number): Coord => ({
  file: i % b.width,
  rank: Math.floor(i / b.width),
});

export const squareName = (c: Coord): string => `${FILES[c.file]}${c.rank + 1}`;

export const parseSquare = (s: string): Coord => ({
  file: FILES.indexOf(s[0]),
  rank: parseInt(s.slice(1), 10) - 1,
});

export function pieceIdAt(b: BoardState, c: Coord): PieceId | null {
  return inBounds(b, c) ? b.squares[indexOf(b, c)] : null;
}

export function pieceAt(b: BoardState, c: Coord): Piece | null {
  const id = pieceIdAt(b, c);
  return id ? b.pieces[id] : null;
}

export function tileAt(b: BoardState, c: Coord): Tile {
  return b.tiles[indexOf(b, c)];
}

/** Locate a piece's square (O(n); boards are tiny). */
export function findPiece(b: BoardState, id: PieceId): Coord | null {
  const i = b.squares.indexOf(id);
  return i < 0 ? null : coordOfIndex(b, i);
}

export function createEmptyBoard(width = 8, height = 8): BoardState {
  const n = width * height;
  return {
    width,
    height,
    squares: new Array<PieceId | null>(n).fill(null),
    pieces: {},
    tiles: Array.from({ length: n }, () => ({ modifiers: [] })),
  };
}

/**
 * Cheap structural clone. Arrays/records are copied; individual Piece/Tile
 * objects are shared and must be replaced (never mutated) when changed.
 */
export function cloneBoard(b: BoardState): BoardState {
  return {
    width: b.width,
    height: b.height,
    squares: b.squares.slice(),
    pieces: { ...b.pieces },
    tiles: b.tiles.slice(),
  };
}

/** Iterate all occupied squares. */
export function* occupied(b: BoardState): Generator<{ piece: Piece; at: Coord }> {
  for (let i = 0; i < b.squares.length; i++) {
    const id = b.squares[i];
    if (id) yield { piece: b.pieces[id], at: coordOfIndex(b, i) };
  }
}
