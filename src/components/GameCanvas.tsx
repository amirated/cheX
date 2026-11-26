import { Application, extend, useApplication } from '@pixi/react';
import { Container, Graphics, Text } from 'pixi.js';
import { useCallback, useEffect, useState } from 'react';
import type { HighlightModel } from '../render/board';
import type { PieceStyle, Theme } from '../render/theme';
import type { BoardState, Coord, PieceKind } from '../types/game';
import { BoardView } from './BoardView';

// Register only the Pixi classes we use as JSX (<pixiContainer/>, <pixiGraphics/>, <pixiText/>).
extend({ Container, Graphics, Text });

/** Keeps the renderer's backing store in sync with the CSS size. */
function RendererSize({ size }: { size: number }) {
  const { app, isInitialised } = useApplication();
  useEffect(() => {
    if (isInitialised) app.renderer.resize(size, size);
  }, [app, isInitialised, size]);
  return null;
}

interface Props {
  board: BoardState;
  size: number;
  highlights: HighlightModel;
  onSquare: (c: Coord) => void;
  flipped?: boolean;
  theme: Theme;
  pieceStyle: PieceStyle;
  /** Piece kinds changed by plugged-in mods → marker colour. */
  pips?: Partial<Record<PieceKind, number>>;
}

/** Cap DPR at 3: beyond that mobile GPUs pay a lot of fill-rate for no visible gain. */
const DPR = Math.min(window.devicePixelRatio || 1, 3);

export function GameCanvas({ board, size, highlights, onSquare, flipped, theme, pieceStyle, pips }: Props) {
  // @pixi/react's first render awaits WebGL init, then commits the children it started
  // with — overwriting any newer props rendered meanwhile (e.g. the room state that
  // arrived while the canvas was initialising). Re-render once init completes so the
  // scene always reflects current props.
  const [, setInitialised] = useState(false);
  const onInit = useCallback(() => setInitialised(true), []);

  return (
    <Application
      onInit={onInit}
      width={size}
      height={size}
      resolution={DPR}
      autoDensity
      antialias
      backgroundAlpha={0}
      powerPreference="high-performance"
      className="board-canvas"
    >
      <RendererSize size={size} />
      <BoardView
        board={board}
        size={size}
        highlights={highlights}
        onSquare={onSquare}
        flipped={flipped}
        theme={theme}
        pieceStyle={pieceStyle}
        pips={pips}
      />
    </Application>
  );
}
