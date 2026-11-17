import { Rectangle, TextStyle, type FederatedPointerEvent, type Graphics } from 'pixi.js';
import { useCallback, useMemo } from 'react';
import { FILES, indexOf } from '../engine';
import { drawBoard, drawHighlights, isLightSquare, pixelToCoord, type HighlightModel } from '../render/board';
import { THEME } from '../render/theme';
import type { BoardState, Coord } from '../types/game';
import { PieceView } from './PieceView';

interface Props {
  board: BoardState;
  size: number;
  highlights: HighlightModel;
  onSquare: (c: Coord) => void;
}

/** Board + labels + highlight overlay + piece layer, all procedural. */
export function BoardView({ board, size, highlights, onSquare }: Props) {
  const tile = size / board.width;

  // Board geometry only depends on size + tile modifiers, not on piece moves.
  const tilesKey = useMemo(() => board.tiles.map((t) => t.modifiers.map((m) => m.kind).join('+')).join('|'), [board.tiles]);
  const tilesBoard = useMemo(() => board, [tilesKey, board.width, board.height]); // eslint-disable-line react-hooks/exhaustive-deps
  const drawTiles = useCallback((g: Graphics) => drawBoard(g, tilesBoard, tile), [tilesBoard, tile]);
  const drawHl = useCallback((g: Graphics) => drawHighlights(g, highlights, tile, board.height), [highlights, tile, board.height]);
  const hitArea = useMemo(() => new Rectangle(0, 0, size, size), [size]);

  const onDown = useCallback(
    (e: FederatedPointerEvent) => {
      const p = e.getLocalPosition(e.currentTarget);
      const c = pixelToCoord(p.x, p.y, tile, board);
      if (c) onSquare(c);
    },
    [tile, board, onSquare],
  );

  // Coordinate labels: files on the bottom row, ranks on the left column.
  const labels = useMemo(() => {
    const fontSize = Math.max(8, Math.round(tile * 0.19));
    const pad = tile * 0.06;
    const style = (light: boolean) =>
      new TextStyle({
        fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif',
        fontSize,
        fontWeight: '700',
        fill: light ? THEME.board.labelOnLight : THEME.board.labelOnDark,
      });
    const out: { key: string; text: string; x: number; y: number; anchor: [number, number]; style: TextStyle }[] = [];
    for (let f = 0; f < board.width; f++) {
      const c = { file: f, rank: 0 };
      out.push({ key: `f${f}`, text: FILES[f], x: (f + 1) * tile - pad, y: size - pad * 0.6, anchor: [1, 1], style: style(isLightSquare(c)) });
    }
    for (let r = 0; r < board.height; r++) {
      const c = { file: 0, rank: r };
      out.push({ key: `r${r}`, text: String(r + 1), x: pad, y: (board.height - 1 - r) * tile + pad * 0.6, anchor: [0, 0], style: style(isLightSquare(c)) });
    }
    return out;
  }, [tile, size, board.width, board.height]);

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
          <PieceView key={p.id} piece={p} at={at} tile={tile} boardHeight={board.height} lifted={p.id === selectedId} />
        ))}
      </pixiContainer>
    </pixiContainer>
  );
}
