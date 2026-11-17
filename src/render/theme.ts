import type { Color } from '../types/game';

export const THEME = {
  pageBg: '#14131a',
  board: {
    light: 0xe2d4b7,
    dark: 0x7b5e70,
    frame: 0x2a2531,
    labelOnLight: 0x7b5e70,
    labelOnDark: 0xe2d4b7,
  },
  highlight: {
    lastMove: { color: 0xf1c75b, alpha: 0.38 },
    selected: { color: 0xffe08a, alpha: 0.55 },
    hint: { color: 0x1a1720, alpha: 0.32 },
    check: 0xe0413a,
  },
  pieces: {
    white: { fill: 0xf6f0e4, stroke: 0x2a231f, rim: null as number | null },
    black: { fill: 0x26232e, stroke: 0xe6dac3, rim: 0x0e0c12 as number | null },
  } satisfies Record<Color, { fill: number; stroke: number; rim: number | null }>,
  shadow: 0x000000,
  /** Animation timings (ms) */
  anim: { move: 190, lift: 110 },
} as const;
