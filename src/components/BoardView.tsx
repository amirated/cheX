import { Rectangle, TextStyle, type FederatedPointerEvent, type Graphics } from 'pixi.js';
import { useCallback, useMemo, useRef } from 'react';
import { FILES, indexOf } from '../engine';
import { drawBoard, drawHighlights, isLightSquare, pixelToCoord, type HighlightModel, type Orientation } from '../render/board';
import type { PieceStyle, Theme } from '../render/theme';
import type { BoardState, Coord } from '../types/game';
import { PieceView } from './PieceView';

interface Props {
  board: BoardState;
  size: number;
  highlights: HighlightModel;
  onSquare: (c: Coord) => void;
  /** Black at the bottom (online play as Black). */
  flipped?: boolean;
  theme: Theme;
  pieceStyle: PieceStyle;
}

/** Board + labels + highlight overlay + piece layer, all procedural. */
export function BoardView({ board, size, highlights, onSquare, flipped = false, theme, pieceStyle }: Props) {
  const tile = size / board.width;
  const orient: Orientation = useMemo(
    () => ({ tile, width: board.width, height: board.height, flipped }),
    [tile, board.width, board.height, flipped],
  );

  // Board geometry only depends on size + tile modifiers, not on piece moves.
  const tilesKey = useMemo(() => board.tiles.map((t) => t.modifiers.map((m) => m.kind).join('+')).join('|'), [board.tiles]);
  const tilesBoard = useMemo(() => board, [tilesKey, board.width, board.height]); // eslint-disable-line react-hooks/exhaustive-deps
  const drawTiles = useCallback((g: Graphics) => drawBoard(g, tilesBoard, orient, theme), [tilesBoard, orient, theme]);
  const drawHl = useCallback((g: Graphics) => drawHighlights(g, highlights, orient, theme), [highlights, orient, theme]);
  const hitArea = useMemo(() => new Rectangle(0, 0, size, size), [size]);

  // Pixi keeps the first pointer handler it was given, so a handler closing over props
  // can go stale (e.g. still thinking it isn't your turn after joining an online room).
  // Register one stable handler that always reads the latest props through a ref.
  const latest = useRef({ orient, onSquare });
  latest.current = { orient, onSquare };
  const onDown = useCallback((e: FederatedPointerEvent) => {
    const { orient: o, onSquare: cb } = latest.current;
    const p = e.getLocalPosition(e.currentTarget);
    const c = pixelToCoord(p.x, p.y, o);
    if (c) cb(c);
  }, []);

  // Coordinate labels: files on the bottom row, ranks on the left column.
  const labels = useMemo(() => {
    const fontSize = Math.max(8, Math.round(tile * 0.19));
    const pad = tile * 0.06;
    const style = (light: boolean) =>
      new TextStyle({
        fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif',
        fontSize,
        fontWeight: '700',
        fill: light ? theme.board.labelOnLight : theme.board.labelOnDark,
      });
    const out: { key: string; text: string; x: number; y: number; anchor: [number, number]; style: TextStyle }[] = [];
    // Labels follow screen position: files along the bottom row, ranks down the left column.
    for (let col = 0; col < board.width; col++) {
      const c = { file: flipped ? board.width - 1 - col : col, rank: flipped ? board.height - 1 : 0 };
      out.push({ key: `f${col}`, text: FILES[c.file], x: (col + 1) * tile - pad, y: size - pad * 0.6, anchor: [1, 1], style: style(isLightSquare(c)) });
    }
    for (let row = 0; row < board.height; row++) {
      const c = { file: flipped ? board.width - 1 : 0, rank: flipped ? row : board.height - 1 - row };
      out.push({ key: `r${row}`, text: String(c.rank + 1), x: pad, y: row * tile + pad * 0.6, anchor: [0, 0], style: style(isLightSquare(c)) });
    }
    return out;
  }, [tile, size, board.width, board.height, flipped, theme]);

  // Stable order by id so React keys map 1:1 to Pixi containers (enables move animation).
  const pieces = useMemo(
    () =>
      Object.values(board.pieces)
        .map((p) => {
          const i = board.squares.indexOf(p.id);
          return { p, at: { file: i % board.width, rank: Math.floor(i / board.width) } };
        })
        .sort((a, b) => (a.p.id < b.p.id ? -1 : 1)),
    [board],
  );

  const sel = highlights.selected;
  const selectedId = sel ? board.squares[indexOf(board, sel)] : null;

  return (
    <pixiContainer eventMode="static" hitArea={hitArea} onPointerDown={onDown} cursor="pointer">
      <pixiGraphics draw={drawTiles} />
      {labels.map((l) => (
        <pixiText key={l.key} text={l.text} x={l.x} y={l.y} anchor={{ x: l.anchor[0], y: l.anchor[1] }} style={l.style} />
      ))}
      <pixiGraphics draw={drawHl} />
      <pixiContainer sortableChildren>
        {pieces.map(({ p, at }) => (
          <PieceView
            key={p.id}
            piece={p}
            at={at}
            orient={orient}
            lifted={p.id === selectedId}
            look={theme.pieces[pieceStyle][p.color]}
            shadow={theme.shadow}
          />
        ))}
      </pixiContainer>
    </pixiContainer>
  );
}
