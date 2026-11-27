import { memo } from 'react';
import { shapesFor, type Shape } from '../render/pieces/shapes';
import type { PieceLook } from '../render/theme';
import type { PieceKind } from '../types/game';

const hex = (n: number) => `#${n.toString(16).padStart(6, '0')}`;

function pathOf(s: Shape): string {
  switch (s.t) {
    case 'poly': {
      const p = s.pts;
      let d = `M${p[0]} ${p[1]}`;
      for (let i = 2; i < p.length; i += 2) d += `L${p[i]} ${p[i + 1]}`;
      return d + 'Z';
    }
    case 'line': {
      const p = s.pts;
      let d = `M${p[0]} ${p[1]}`;
      for (let i = 2; i < p.length; i += 2) d += `L${p[i]} ${p[i + 1]}`;
      return d;
    }
    case 'path':
      return s.d.map((c) => (c[0] === 'Z' ? 'Z' : `${c[0]}${c.slice(1).join(' ')}`)).join('');
    default:
      return '';
  }
}

function ShapeEl({ s, ...paint }: { s: Shape } & React.SVGProps<SVGElement>) {
  const p = paint as React.SVGProps<SVGPathElement>;
  if (s.t === 'circle') return <circle cx={s.x} cy={s.y} r={s.r} {...(p as React.SVGProps<SVGCircleElement>)} />;
  if (s.t === 'ellipse') return <ellipse cx={s.x} cy={s.y} rx={s.rx} ry={s.ry} {...(p as React.SVGProps<SVGEllipseElement>)} />;
  if (s.t === 'rect') return <rect x={s.x} y={s.y} width={s.w} height={s.h} rx={s.r ?? 0} {...(p as React.SVGProps<SVGRectElement>)} />;
  return <path d={pathOf(s)} {...p} />;
}

/**
 * The board's procedural piece art as a small DOM SVG (captured-piece trays, labels).
 * Same shapes and paint rules as `drawPiece`, so it always matches the board.
 */
export const PieceIcon = memo(function PieceIcon({ kind, look, size = 24 }: { kind: PieceKind; look: PieceLook; size?: number }) {
  const shapes = shapesFor(kind);
  const bodies = shapes.filter((s) => (s.role ?? 'body') === 'body');
  const line = 5; // a touch heavier than the board's 4/100 so it reads at icon size
  return (
    <svg className="piece-icon" width={size} height={size} viewBox="12 8 76 86" aria-hidden="true">
      {look.rim !== null &&
        bodies.map((s, i) => (
          <ShapeEl key={`r${i}`} s={s} fill="none" stroke={hex(look.rim!)} strokeWidth={line * 2.4} strokeLinejoin="round" />
        ))}
      {shapes.map((s, i) => {
        const role = s.role ?? 'body';
        if (role === 'body')
          return (
            <ShapeEl
              key={i}
              s={s}
              fill={hex(look.fill)}
              fillOpacity={look.fillAlpha}
              stroke={hex(look.stroke)}
              strokeWidth={line}
              strokeLinejoin="round"
            />
          );
        if (role === 'accent') return <ShapeEl key={i} s={s} fill={hex(look.accent)} />;
        return (
          <ShapeEl key={i} s={s} fill="none" stroke={hex(look.accent)} strokeWidth={line * 0.75} strokeLinecap="round" strokeLinejoin="round" />
        );
      })}
    </svg>
  );
});
