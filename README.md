# CheX: V1 frontend prototype

Mobile-first procedural chess built with React, Vite, TypeScript and PixiJS v8. It loads no image assets and does not use chess.js.

```bash
npm install
npm run dev        # http://localhost:5173 (also exposed on LAN for phone testing)
npm test           # perft and rules tests
npm run build
```

## Folder structure

```
src/
├── types/game.ts              # Serializable schema (BoardState, Piece, TileModifier, Move, MoveAction, GameEvent…)
├── engine/                    # Pure TS rules engine with no React or Pixi imports, ready to port to Rust
│   ├── board.ts               # coords, indexing, cloning helpers
│   ├── pieces/
│   │   ├── types.ts           # PieceDefinition + MovementRule DSL (slide / leap / special)
│   │   ├── registry.ts        # registerPiece(), vector helpers (symmetric, ORTHOGONAL…)
│   │   └── standard.ts        # the 6 standard pieces, as data
│   ├── rules/
│   │   ├── specialRegistry.ts # pluggable special moves
│   │   ├── standardSpecials.ts# double-step, en passant, castling
│   │   └── modifiers.ts       # relic / rule-modifier hooks (transformMoves, afterMove)
│   ├── tiles.ts               # tile-modifier registry (blocksOccupation / blocksSliding)
│   ├── movegen.ts             # data-driven pseudo-legal generation + promotion expansion
│   ├── attacks.ts             # attack maps & check detection (royal pieces)
│   ├── effects.ts             # applyEffects(): the only board mutation
│   ├── legal.ts               # king-safety filter + modifier hooks
│   ├── game.ts                # createGameState, gameReducer(state, action), SAN, status
│   ├── fen.ts                 # FEN import (tests/puzzles)
│   └── setup.ts / index.ts    # registry bootstrap + public API
├── render/                    # Pixi drawing functions (no React)
│   ├── theme.ts
│   ├── board.ts               # tiles, highlights, pixel<->coord
│   └── pieces/{shapes,drawPiece}.ts  # piece silhouettes as vector data → PIXI.Graphics
├── components/                # React + @pixi/react
│   ├── GameCanvas.tsx         # <Application>, DPR-aware, resizes renderer
│   ├── BoardView.tsx          # board, labels, highlights, input
│   ├── PieceView.tsx          # per-piece ticker animation (slide, Z-lift, shadow)
│   └── Hud.tsx
├── hooks/                     # useChessGame (transport → React), useBoardSize
├── net/                       # GameTransport seam: LocalTransport (V1), SocketTransport (Phase 2 sketch)
└── App.tsx / main.tsx / index.css
tests/engine.test.ts           # perft: start d4, Kiwipete d3, positions 3/4/5, plus reducer tests
```

## Extending

- **Fairy piece:** call `registerPiece({...movement rules})` and optionally `registerPieceShape(kind, shapes)`. If you skip the shape, the piece is drawn as a generic medallion.
- **Tile effect:** call `registerTileModifier`, then put `{ kind, ... }` into `board.tiles[i].modifiers`.
- **Relic:** call `registerRuleModifier({ transformMoves?, afterMove? })` and add `{ id, owner }` to `state.ruleset.modifiers`.
- **Multiplayer:** swap `LocalTransport` for `SocketTransport` in `App.tsx`. The server runs the same `(state, action) → state` reducer.
