import type { CSSProperties } from 'react';
import type { Burst } from '../feedback/useGameFeedback';
import type { Coord } from '../types/game';

interface Props {
  size: number;
  files: number;
  ranks: number;
  flipped: boolean;
  bursts: Burst[];
  /** King in check (or mated). */
  checkSquare: Coord | null;
  mate: boolean;
}

const SHARDS = 10;

/**
 * DOM effects layered over the Pixi board (pointer-events: none): capture bursts and
 * a pulsing ring around a king in check. CSS-only animation, so it costs no frames on
 * the canvas and respects prefers-reduced-motion.
 */
export function BoardFx({ size, files, ranks, flipped, bursts, checkSquare, mate }: Props) {
  const tile = size / files;
  const place = (c: Coord): CSSProperties => {
    const col = flipped ? files - 1 - c.file : c.file;
    const row = flipped ? c.rank : ranks - 1 - c.rank;
    return { left: col * tile, top: row * tile, width: tile, height: tile };
  };

  return (
    <div className="board-fx" aria-hidden>
      {checkSquare && <div className={`fx-check${mate ? ' fx-mate' : ''}`} style={place(checkSquare)} />}
      {bursts.map((b) => (
        <div
          key={b.id}
          className={`fx-burst fx-burst-${b.color}${b.tint ? ' fx-burst-mod' : ''}`}
          style={{ ...place(b.at), ...(b.tint ? ({ '--c': b.tint } as CSSProperties) : {}) }}
        >
          <span className="fx-flash" />
          {Array.from({ length: SHARDS }, (_, i) => (
            <span
              key={i}
              className="fx-shard"
              style={
                {
                  '--a': `${(360 / SHARDS) * i + (b.id * 37) % 36}deg`,
                  '--d': `${0.55 + ((i * 7 + b.id) % 5) * 0.12}`,
                } as CSSProperties
              }
            />
          ))}
        </div>
      ))}
    </div>
  );
}
