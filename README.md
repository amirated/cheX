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

## Layout and fullscreen

- **Portrait** (phones, narrow windows): everything is stacked and the board is as wide as the screen. The mod bay sits on its top edge, and in online games the player bars hug the board above and below.
- **Landscape** (computers, tablets or phones on their side, any window at least 700px wide and 5:4 or wider): the board fills the full height on the left, the mod bay runs down its left edge, and the HUD, players, mod status and the full move list sit in a side panel.
- The board takes the largest whole-pixel size that fits (`useBoardSize`). Both layouts share one DOM order and CSS grid areas place the pieces, so rotating a device never reloads the board.
- **Fullscreen:** the corner button in the header, or the F key (Esc to leave), with the screen kept awake while fullscreen. iPhone Safari has no fullscreen button; there, "Add to Home Screen" opens CheX as a full-screen app (`public/manifest.webmanifest`).

## Themes

There are two cyber themes, **Neon grid** and **Night city** (the default), and each can show pieces **filled** or as **outlines**. Players pick these in the settings panel (the sliders icon in the header). The choice is saved per device in `localStorage` and never sent to the server, so each player sees their own look.

- **Pixi side:** `src/render/theme.ts` holds board, highlight and piece colours for every theme and piece-style pair. The glow is a wide, faint stroke drawn once, with no filters, so it costs nothing per frame.
- **UI side:** `src/index.css` defines matching CSS tokens under `[data-theme="…"]`. Night city's cut corners use `clip-path`; Neon grid's glow uses `box-shadow`.
- **Adding a theme:** add an entry to `THEMES`, add a `[data-theme]` block in the CSS, and it appears in the settings panel automatically.

## Mods (game variants)

A mod changes one rule and can be switched on or off per game; classic chess is simply a game with no mods. The first one is **NC-01 Camel Knight**: knights may also make a (3,1) camel leap.

- **In the app:** mods are cartridges. The **mod bay** on top of the board has three slots. Tap an empty slot (or the cartridge icon in the header) to open the **mod library**, which shows each mod's description, rules, a move diagram and lab notes from the cheX-research study. Plugging or ejecting a cartridge restarts a local game with the new rules. Quick match and "Play a friend" use whatever is in the bay; online rooms lock their mods for the whole room, rematches included. Pieces changed by a mod carry a small chip in the cartridge colour, and moves that only exist because of a mod are drawn as diamonds in that colour.
- **Levels, charges, cooldown:** each enhanced piece may use its mod as many times per game as its level (1–3), with a one-turn cooldown after every use. A spent or cooling piece moves and threatens only normally. Levels will come from player progression; for now everyone is level 1 (`src/variants/progression.ts`), and online games use the lower of the two players' levels (decided by the server). The library's **Rules** tab explains all this and the **Codex** tab holds the lore; both live in `src/variants/codex.ts`.
- **In the engine:** a mod is a rule modifier with an `extraMovement(kind, color)` hook (`src/engine/rules/modifiers.ts`). Charges and cooldown are generic (`src/engine/rules/charges.ts`): move generation adds a piece's enhanced moves only while it has a charge and is off cooldown, flags them `mod:<id>`, and applying such a move records the use in the modifier's `data` (`{ level, uses: { pieceId: [count, lastPly] } }`). Attacks, check, mate and the insufficient-material rule all use the same availability, judged at the owner's next move. `rulesetFor(ids, levelOf)` in `src/variants/catalog.ts` builds the canonical ruleset.
- **On screen, for any piece mod:** chips on each enhanced piece show its charges (bright, dim while cooling, hollow when spent); moves that spend a charge are drawn as diamonds in the cartridge colour; selecting the piece shows a status line under the board; ◆ marks charged moves in the log; firing a charge plays its own sound and a burst in the cartridge colour.
- **Combos:** several mods in one ruleset just stack their extra movement. The bay shows one cartridge per mod.
- **Adding a mod** (charges, cooldown, levels, chips, highlights, status line and rules text then work on their own):
  1. Define it in `src/variants/` (an `extraMovement` for its piece kind) and register it in `src/engine/setup.ts`.
  2. Add its library entry (code, rules, diagram, shell colour) to `MODS` in `src/variants/catalog.ts`.
  3. Add the same id to the Rust registry in `cheX-BE/src/engine/registry.rs`, and to the bot's search board if it should play it (`cheX-BE/src/bot/position.rs`).
  4. Record a parity game: `npx vite-node scripts/mod-parity-fixture.ts` (adapt the script for the new mod) and keep the Rust parity test green.

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
│   ├── SettingsPanel.tsx      # theme, piece style, sound, haptics
│   ├── mods/                  # ModBay (cartridge slots on the board), ModLibrary, Cartridge art, MoveDiagram
│   └── TimeControlPicker.tsx  # presets / custom / no clock
├── hooks/                     # useChessGame (transport → React), useBoardSize
├── net/                       # GameTransport seam: LocalTransport (offline), SocketTransport (cheX-BE server), matchmaking
├── variants/                  # mod catalog (library text, rulesetFor), loadout (this device's bay), knightCamel
└── App.tsx / main.tsx / index.css
tests/engine.test.ts           # perft: start d4, Kiwipete d3, positions 3/4/5, reducer tests, mods
scripts/mod-parity-fixture.ts  # records a camel-knight game for the Rust parity test
```

## Extending

- **Fairy piece:** call `registerPiece({...movement rules})` and optionally `registerPieceShape(kind, shapes)`. If you skip the shape, the piece is drawn as a generic medallion.
- **Tile effect:** call `registerTileModifier`, then put `{ kind, ... }` into `board.tiles[i].modifiers`.
- **Relic:** call `registerRuleModifier({ transformMoves?, afterMove? })` and add `{ id, owner }` to `state.ruleset.modifiers`.
- **Rules changes:** the server runs a Rust port of `src/engine`. Change both, then run the parity test in `cheX-BE` (see its README).
