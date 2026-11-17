import { Application, extend, useApplication } from '@pixi/react';
import { Container, Graphics, Text } from 'pixi.js';
import { useEffect } from 'react';
import type { HighlightModel } from '../render/board';
import type { BoardState, Coord } from '../types/game';
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
}

/** Cap DPR at 3: beyond that mobile GPUs pay a lot of fill-rate for no visible gain. */
const DPR = Math.min(window.devicePixelRatio || 1, 3);

export function GameCanvas({ board, size, highlights, onSquare }: Props) {
  return (
    <Application
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
      <BoardView board={board} size={size} highlights={highlights} onSquare={onSquare} />
    </Application>
  );
}
