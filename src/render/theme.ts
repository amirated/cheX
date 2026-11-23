import type { Color } from '../types/game';

/**
 * Visual themes for the Pixi scene. All values are plain numbers/data so the
 * renderer stays procedural (zero image assets). The DOM UI reads the matching
 * CSS variables from `[data-theme="…"]` in index.css.
 */

export type ThemeId = 'neonGrid' | 'nightCity';
export type PieceStyle = 'filled' | 'outline';

/** How one side's pieces are painted in one piece style. */
export interface PieceLook {
  fill: number;
  fillAlpha: number;
  stroke: number;
  /** Colour for eyes, jewels, seams. */
  accent: number;
  /** Dark halo behind the silhouette so it reads on any tile (null = none). */
  rim: number | null;
  /** Soft outer glow: a wide, faint stroke in the stroke colour (0 = none). Drawn once, no filters. */
  glowAlpha: number;
}

export interface Theme {
  id: ThemeId;
  name: string;
  /** Page background; mirrored in index.css and used for the browser's theme-color. */
  pageBg: string;
  board: {
    light: number;
    dark: number;
    /** Neon grid lines over the tiles. */
    grid: { color: number; alpha: number } | null;
    labelOnLight: number;
    labelOnDark: number;
  };
  highlight: {
    lastMove: { color: number; alpha: number };
    /** 'frame' draws a bracket outline; 'fill' tints the whole tile. */
    selected: { color: number; alpha: number; mode: 'fill' | 'frame' };
    hint: { color: number; alpha: number };
    check: number;
  };
  pieces: Record<PieceStyle, Record<Color, PieceLook>>;
  shadow: { color: number; alpha: number };
}

const NEON_CYAN = 0x22d3ee;
const NEON_PINK = 0xf472d0;
const CITY_YELLOW = 0xfcee0a;
const CITY_CYAN = 0x00e5ff;
const CITY_RED = 0xff2a55;

export const THEMES: Record<ThemeId, Theme> = {
  neonGrid: {
    id: 'neonGrid',
    name: 'Neon grid',
    pageBg: '#05051a',
    board: {
      light: 0x10123a,
      dark: 0x0a0b24,
      grid: { color: NEON_CYAN, alpha: 0.3 },
      labelOnLight: 0x4a5aa0,
      labelOnDark: 0x4a5aa0,
    },
    highlight: {
      lastMove: { color: NEON_CYAN, alpha: 0.18 },
      selected: { color: NEON_PINK, alpha: 1, mode: 'frame' },
      hint: { color: NEON_PINK, alpha: 0.85 },
      check: 0xff3b6b,
    },
    pieces: {
      outline: {
        white: { fill: NEON_CYAN, fillAlpha: 0.14, stroke: NEON_CYAN, accent: NEON_CYAN, rim: null, glowAlpha: 0.22 },
        black: { fill: NEON_PINK, fillAlpha: 0.14, stroke: NEON_PINK, accent: NEON_PINK, rim: null, glowAlpha: 0.22 },
      },
      filled: {
        white: { fill: NEON_CYAN, fillAlpha: 1, stroke: 0x07071a, accent: 0x07071a, rim: null, glowAlpha: 0.3 },
        black: { fill: NEON_PINK, fillAlpha: 1, stroke: 0x07071a, accent: 0x07071a, rim: null, glowAlpha: 0.3 },
      },
    },
    shadow: { color: 0x000000, alpha: 0.35 },
  },
  nightCity: {
    id: 'nightCity',
    name: 'Night city',
    pageBg: '#0b0b10',
    board: {
      light: 0x20222c,
      dark: 0x14151b,
      grid: null,
      labelOnLight: 0x6a6a80,
      labelOnDark: 0x5a5a6e,
    },
    highlight: {
      lastMove: { color: CITY_YELLOW, alpha: 0.2 },
      selected: { color: CITY_RED, alpha: 1, mode: 'frame' },
      hint: { color: CITY_CYAN, alpha: 0.8 },
      check: CITY_RED,
    },
    pieces: {
      filled: {
        white: { fill: CITY_YELLOW, fillAlpha: 1, stroke: 0x0b0b10, accent: 0x0b0b10, rim: null, glowAlpha: 0 },
        black: { fill: 0x1c1d26, fillAlpha: 1, stroke: CITY_CYAN, accent: CITY_CYAN, rim: 0x000000, glowAlpha: 0 },
      },
      outline: {
        white: { fill: CITY_YELLOW, fillAlpha: 0.12, stroke: CITY_YELLOW, accent: CITY_YELLOW, rim: 0x000000, glowAlpha: 0 },
        black: { fill: CITY_CYAN, fillAlpha: 0.1, stroke: CITY_CYAN, accent: CITY_CYAN, rim: 0x000000, glowAlpha: 0 },
      },
    },
    shadow: { color: 0x000000, alpha: 0.4 },
  },
};

export const DEFAULT_THEME: ThemeId = 'nightCity';
export const DEFAULT_PIECE_STYLE: PieceStyle = 'filled';

/** Animation timings (ms) — theme-independent. */
export const ANIM = { move: 190, lift: 110 } as const;
