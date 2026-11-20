# CheX: V1 frontend prototype

Mobile-first procedural chess built with React, Vite, TypeScript and PixiJS v8. It loads no image assets and does not use chess.js.

```bash
npm install
npm run dev        # http://localhost:5173 (also exposed on LAN for phone testing)
npm test           # perft and rules tests
npm run build
```

## Online multiplayer

Start the Rust server from `cheX-BE` (`cargo run`, which listens on :4000), then tap **Play online** and pick a time control (six presets, Custom, or No clock). The game creates a room and moves you to `?room=CODE`. Tap **Invite** to share the link. The first player to join is White, the second is Black, and anyone after that spectates. The board is flipped for Black. Your seat is saved in `localStorage`, so refreshing the page or losing the connection gives you the same colour back. Set `VITE_SERVER_URL` if the server isn't on `<page host>:4000` (see `.env.example`).

Online games show a player bar with each clock above and below the board. The server owns the clocks; the page only renders them, counting down locally between updates. Clocks turn amber when time is low and red, with tenths of a second, when it's critical. You can resign (tap twice), and the rematch keeps the same time control.

Without `?room=`, the game runs fully offline as local pass-and-play, exactly as before.

## Themes

There are two cyber themes, **Neon grid** and **Night city** (the default), and each can show pieces **filled** or as **outlines**. Players pick these in the settings panel (the sliders icon in the header). The choice is saved per device in `localStorage` and never sent to the server, so each player sees their own look.

- **Pixi side:** `src/render/theme.ts` holds board, highlight and piece colours for every theme and piece-style pair. The glow is a wide, faint stroke drawn once, with no filters, so it costs nothing per frame.
- **UI side:** `src/index.css` defines matching CSS tokens under `[data-theme="…"]`. Night city's cut corners use `clip-path`; Neon grid's glow uses `box-shadow`.
- **Adding a theme:** add an entry to `THEMES`, add a `[data-theme]` block in the CSS, and it appears in the settings panel automatically.

## Folder structure

```
src/
├── types/clock.ts             # clock types, presets, local countdown + formatting
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
├── prefs/preferences.ts       # per-device theme + piece style (localStorage)
├── render/                    # Pixi drawing functions (no React)
│   ├── theme.ts               # Neon grid / Night city, filled + outline piece looks
│   ├── board.ts               # tiles, highlights, pixel<->coord
│   └── pieces/{shapes,drawPiece}.ts  # piece silhouettes as vector data → PIXI.Graphics
├── components/                # React + @pixi/react
│   ├── GameCanvas.tsx         # <Application>, DPR-aware, resizes renderer
│   ├── BoardView.tsx          # board, labels, highlights, input
│   ├── PieceView.tsx          # per-piece ticker animation (slide, Z-lift, shadow)
│   ├── Hud.tsx
│   ├── OnlineBar.tsx          # room code, seat, opponent presence, invite/leave
│   ├── PlayerBar.tsx          # player identity + clock
│   ├── SettingsPanel.tsx      # theme + piece-style picker
│   └── TimeControlPicker.tsx  # presets / custom / no clock
├── hooks/                     # useChessGame (transport → React), useBoardSize
├── net/                       # GameTransport seam: LocalTransport (offline), SocketTransport (cheX-BE server)
└── App.tsx / main.tsx / index.css
tests/engine.test.ts           # perft: start d4, Kiwipete d3, positions 3/4/5, plus reducer tests
```

## Extending

- **Fairy piece:** call `registerPiece({...movement rules})` and optionally `registerPieceShape(kind, shapes)`. If you skip the shape, the piece is drawn as a generic medallion.
- **Tile effect:** call `registerTileModifier`, then put `{ kind, ... }` into `board.tiles[i].modifiers`.
- **Relic:** call `registerRuleModifier({ transformMoves?, afterMove? })` and add `{ id, owner }` to `state.ruleset.modifiers`.
- **Rules changes:** the server runs a Rust port of `src/engine`. Change both, then run the parity test in `cheX-BE` (see its README).
