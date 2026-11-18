import { useTick } from '@pixi/react';
import type { Container, Graphics, Ticker } from 'pixi.js';
import { useCallback, useEffect, useRef } from 'react';
import { drawPiece, drawShadow } from '../render/pieces/drawPiece';
import { tileCenter, type Orientation } from '../render/board';
import { THEME } from '../render/theme';
import type { Coord, Piece } from '../types/game';

interface Props {
  piece: Piece;
  at: Coord;
  orient: Orientation;
  lifted: boolean;
}

const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

/**
 * One piece. Geometry is drawn only when kind/color/size change; all motion
 * (slide between tiles, simulated Z-lift, shadow offset) is done by mutating
 * transforms inside the Pixi ticker — no React re-renders per frame.
 */
export function PieceView({ piece, at, orient, lifted }: Props) {
  const tile = orient.tile;
  const root = useRef<Container>(null);
  const body = useRef<Container>(null);
  const shadow = useRef<Graphics>(null);

  const pieceSize = tile * 0.86;
  const target = tileCenter(at, orient);

  // Animation state lives in a ref: survives re-renders, never triggers them.
  const anim = useRef({
    x: target.x,
    y: target.y,
    fromX: target.x,
    fromY: target.y,
    toX: target.x,
    toY: target.y,
    t: 1,
    lift: 0,
    tile,
    flipped: orient.flipped,
  });

  // New destination → start a slide from wherever we are now. A resize snaps instead.
  useEffect(() => {
    const a = anim.current;
    if (a.tile !== tile || a.flipped !== orient.flipped) {
      Object.assign(a, { x: target.x, y: target.y, fromX: target.x, fromY: target.y, toX: target.x, toY: target.y, t: 1, tile, flipped: orient.flipped });
      return;
    }
    if (a.toX === target.x && a.toY === target.y) return;
    Object.assign(a, { fromX: a.x, fromY: a.y, toX: target.x, toY: target.y, t: 0 });
  }, [target.x, target.y, tile, orient.flipped]);

  const drawBody = useCallback((g: Graphics) => drawPiece(g, piece.kind, piece.color, pieceSize), [piece.kind, piece.color, pieceSize]);
  const drawShadowCb = useCallback((g: Graphics) => drawShadow(g, pieceSize), [pieceSize]);

  const liftedRef = useRef(lifted);
  liftedRef.current = lifted;

  const tick = useCallback((ticker: Ticker) => {
    const a = anim.current;
    const r = root.current;
    const b = body.current;
    const s = shadow.current;
    if (!r || !b || !s) return;

    const want = liftedRef.current ? 1 : 0;
    const settled = a.t >= 1 && a.lift === want && r.x === a.x && r.y === a.y;
    if (settled) return; // idle pieces cost ~nothing

    const dt = ticker.deltaMS;
    if (a.t < 1) {
      a.t = Math.min(1, a.t + dt / THEME.anim.move);
      const e = easeInOut(a.t);
      a.x = a.fromX + (a.toX - a.fromX) * e;
      a.y = a.fromY + (a.toY - a.fromY) * e;
    }
    const step = dt / THEME.anim.lift;
    a.lift = want > a.lift ? Math.min(want, a.lift + step) : Math.max(want, a.lift - step);

    // a hop arc while travelling, so moving pieces read as "picked up"
    const arc = a.t < 1 ? Math.sin(Math.PI * a.t) : 0;
    const z = Math.max(a.lift, arc);

    r.x = a.x;
    r.y = a.y;
    r.zIndex = z > 0.001 || a.t < 1 ? 10 : 0;
    b.y = -z * tile * 0.1;
    b.scale.set(1 + 0.1 * z);
    s.x = z * tile * 0.07;
    s.y = pieceSize * 0.4 + z * tile * 0.05;
    s.scale.set(1 + 0.3 * z);
    s.alpha = 1 - 0.45 * z;
  }, [tile, pieceSize]);

  useTick(tick);

  const a = anim.current;
  return (
    <pixiContainer ref={root} x={a.x} y={a.y}>
      <pixiGraphics ref={shadow} draw={drawShadowCb} y={pieceSize * 0.4} />
      <pixiContainer ref={body}>
        <pixiGraphics draw={drawBody} />
      </pixiContainer>
    </pixiContainer>
  );
}
