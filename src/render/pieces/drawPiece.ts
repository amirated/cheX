import type { Graphics } from 'pixi.js';
import type { Color, PieceKind } from '../../types/game';
import { THEME } from '../theme';
import { shapesFor, type ShapeGeom } from './shapes';

/** Trace one shape into the Graphics' current path, mapping the 100-unit box onto `size` px, centred at (0,0). */
function trace(g: Graphics, s: ShapeGeom, k: number): void {
  const X = (x: number) => (x - 50) * k;
  const Y = (y: number) => (y - 50) * k;
  switch (s.t) {
    case 'poly':
      g.poly(s.pts.map((v, i) => (i % 2 ? Y(v) : X(v))), true);
      break;
    case 'line': {
      g.moveTo(X(s.pts[0]), Y(s.pts[1]));
      for (let i = 2; i < s.pts.length; i += 2) g.lineTo(X(s.pts[i]), Y(s.pts[i + 1]));
      break;
    }
    case 'circle':
      g.circle(X(s.x), Y(s.y), s.r * k);
      break;
    case 'ellipse':
      g.ellipse(X(s.x), Y(s.y), s.rx * k, s.ry * k);
      break;
    case 'rect':
      g.roundRect(X(s.x), Y(s.y), s.w * k, s.h * k, (s.r ?? 0) * k);
      break;
    case 'path':
      for (const c of s.d) {
        if (c[0] === 'M') g.moveTo(X(c[1]), Y(c[2]));
        else if (c[0] === 'L') g.lineTo(X(c[1]), Y(c[2]));
        else if (c[0] === 'Q') g.quadraticCurveTo(X(c[1]), Y(c[2]), X(c[3]), Y(c[4]));
        else if (c[0] === 'C') g.bezierCurveTo(X(c[1]), Y(c[2]), X(c[3]), Y(c[4]), X(c[5]), Y(c[6]));
        else g.closePath();
      }
      break;
  }
}

/**
 * Draw a piece into `g`, centred on the Graphics' origin, fitting a `size`×`size` box.
 * Pure vector geometry — no textures. Called only when kind/color/size change.
 */
export function drawPiece(g: Graphics, kind: PieceKind, color: Color, size: number): void {
  const k = size / 100;
  const style = THEME.pieces[color];
  const shapes = shapesFor(kind);
  const line = Math.max(1.25, 4 * k);

  g.clear();

  // Pass 1 — dark rim behind black pieces so they pop on any tile color.
  if (style.rim !== null) {
    for (const s of shapes) {
      if ((s.role ?? 'body') !== 'body') continue;
      trace(g, s, k);
      g.stroke({ width: line * 2.4, color: style.rim, join: 'round' });
    }
  }

  // Pass 2 — fills, outlines, details.
  for (const s of shapes) {
    const role = s.role ?? 'body';
    trace(g, s, k);
    if (role === 'body') {
      g.fill({ color: style.fill });
      g.stroke({ width: line, color: style.stroke, join: 'round' });
    } else if (role === 'accent') {
      g.fill({ color: style.stroke });
    } else {
      g.stroke({ width: line * 0.75, color: style.stroke, cap: 'round', join: 'round' });
    }
  }
}

/** Soft elliptical contact shadow, drawn once; animated via alpha/scale/offset. */
export function drawShadow(g: Graphics, size: number): void {
  g.clear();
  const rx = size * 0.3;
  const ry = size * 0.09;
  // three stacked ellipses fake a blur without filters (cheap on mobile GPUs)
  for (let i = 0; i < 3; i++) {
    g.ellipse(0, 0, rx * (1 + i * 0.18), ry * (1 + i * 0.3)).fill({ color: THEME.shadow, alpha: 0.18 - i * 0.05 });
  }
}
