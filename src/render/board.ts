import type { Graphics } from 'pixi.js';
import type { BoardState, Coord } from '../types/game';
import { THEME } from './theme';

/** How the board maps onto the screen. `flipped` puts Black at the bottom. */
export interface Orientation {
  tile: number;
  width: number;
  height: number;
  flipped: boolean;
}

/** Board coordinate → top-left pixel of the tile. */
export const tileOrigin = (c: Coord, o: Orientation) => ({
  x: (o.flipped ? o.width - 1 - c.file : c.file) * o.tile,
  y: (o.flipped ? c.rank : o.height - 1 - c.rank) * o.tile,
});

export const tileCenter = (c: Coord, o: Orientation) => {
  const t = tileOrigin(c, o);
  return { x: t.x + o.tile / 2, y: t.y + o.tile / 2 };
};

/** Pixel → board coordinate, or null when outside. */
export function pixelToCoord(x: number, y: number, o: Orientation): Coord | null {
  const col = Math.floor(x / o.tile);
  const row = Math.floor(y / o.tile);
  if (col < 0 || row < 0 || col >= o.width || row >= o.height) return null;
  return o.flipped ? { file: o.width - 1 - col, rank: row } : { file: col, rank: o.height - 1 - row };
}

export const isLightSquare = (c: Coord) => (c.file + c.rank) % 2 === 1;

/** Static checkerboard + tile modifiers. Redrawn only on resize or tile-modifier change. */
export function drawBoard(g: Graphics, board: BoardState, orient: Orientation): void {
  const tile = orient.tile;
  g.clear();
  const { light, dark } = THEME.board;
  // one fill call per color keeps the draw-call count minimal
  for (const [color, wantLight] of [
    [light, true],
    [dark, false],
  ] as const) {
    for (let rank = 0; rank < board.height; rank++) {
      for (let file = 0; file < board.width; file++) {
        if (isLightSquare({ file, rank }) !== wantLight) continue;
        const o = tileOrigin({ file, rank }, orient);
        g.rect(o.x, o.y, tile, tile);
      }
    }
    g.fill({ color });
  }

  // Tile modifiers (none on a V1 board) — a procedural hint so future levels are visible immediately.
  board.tiles.forEach((t, i) => {
    if (!t.modifiers.length) return;
    const c = { file: i % board.width, rank: Math.floor(i / board.width) };
    const o = tileOrigin(c, orient);
    if (t.modifiers.some((m) => m.kind === 'impassable')) {
      g.rect(o.x, o.y, tile, tile).fill({ color: 0x0b0a0f });
      g.moveTo(o.x + tile * 0.2, o.y + tile * 0.2).lineTo(o.x + tile * 0.8, o.y + tile * 0.8);
      g.moveTo(o.x + tile * 0.8, o.y + tile * 0.2).lineTo(o.x + tile * 0.2, o.y + tile * 0.8);
      g.stroke({ width: tile * 0.04, color: 0x3a3442 });
    }
  });
}

export interface HighlightModel {
  lastMove: { from: Coord; to: Coord } | null;
  selected: Coord | null;
  quietTargets: Coord[];
  captureTargets: Coord[];
  checkSquare: Coord | null;
}

/** Dynamic overlays. Cheap to redraw on every selection change. */
export function drawHighlights(g: Graphics, m: HighlightModel, orient: Orientation): void {
  const tile = orient.tile;
  g.clear();
  const H = THEME.highlight;

  if (m.lastMove) {
    for (const c of [m.lastMove.from, m.lastMove.to]) {
      const o = tileOrigin(c, orient);
      g.rect(o.x, o.y, tile, tile);
    }
    g.fill({ color: H.lastMove.color, alpha: H.lastMove.alpha });
  }

  if (m.checkSquare) {
    const c = tileCenter(m.checkSquare, orient);
    // stacked circles = radial glow without shaders
    for (let i = 5; i >= 1; i--) {
      g.circle(c.x, c.y, (tile / 2) * (0.35 + i * 0.13)).fill({ color: H.check, alpha: 0.13 });
    }
  }

  if (m.selected) {
    const o = tileOrigin(m.selected, orient);
    g.rect(o.x, o.y, tile, tile).fill({ color: H.selected.color, alpha: H.selected.alpha });
  }

  for (const t of m.quietTargets) {
    const c = tileCenter(t, orient);
    g.circle(c.x, c.y, tile * 0.15);
  }
  if (m.quietTargets.length) g.fill({ color: H.hint.color, alpha: H.hint.alpha });

  for (const t of m.captureTargets) {
    const c = tileCenter(t, orient);
    g.circle(c.x, c.y, tile * 0.44);
  }
  if (m.captureTargets.length) g.stroke({ width: tile * 0.075, color: H.hint.color, alpha: H.hint.alpha });
}
