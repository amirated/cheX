/**
 * CheX — core, serializable game schema.
 *
 * Rules for this file:
 *  - Plain data only: no classes, functions, Maps, Sets, or undefined-vs-null tricks.
 *    Everything here must round-trip through JSON.stringify/parse unchanged so the
 *    same shapes can be mirrored 1:1 as `serde` structs in the Rust backend.
 *  - Behaviour lives in registries (src/engine/**) keyed by string ids
 *    (`PieceKind`, `TileModifierKind`, `RuleModifierId`). State only *references*
 *    behaviour by id, so adding a fairy piece / relic never changes this schema.
 */

// ───────────────────────────── primitives ─────────────────────────────

export type Color = 'white' | 'black';

/** JSON-safe value for extensible `data` bags on pieces, tiles, modifiers. */
export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

export type JsonObject = { [key: string]: JsonValue };

/** 0-based board coordinate. file 0 = 'a'; rank 0 = White's back rank ('1'). */
export interface Coord {
  file: number;
  rank: number;
}

/** Relative vector. For directional pieces `dRank` is "forward" from the mover's POV. */
export interface Vec {
  dFile: number;
  dRank: number;
}

// ───────────────────────────── pieces ─────────────────────────────

/** Open string so fairy pieces ("archbishop", "ouroboros", …) need no schema change. */
export type PieceKind = 'pawn' | 'knight' | 'bishop' | 'rook' | 'queen' | 'king' | (string & {});

export type PieceId = string;

export interface Piece {
  id: PieceId;
  kind: PieceKind;
  color: Color;
  /** Used by castling, pawn double-push, and future "first move" abilities. */
  hasMoved: boolean;
  /** Free-form labels for relics/abilities, e.g. ["shielded", "cursed"]. */
  tags: string[];
  /** Per-instance ability state (charges, cooldowns, HP…). */
  data: JsonObject;
}

// ───────────────────────────── tiles ─────────────────────────────

export type TileModifierKind = 'impassable' | (string & {});

export interface TileModifier {
  id: string;
  kind: TileModifierKind;
  /** Turns remaining; null = permanent. */
  duration: number | null;
  data: JsonObject;
}

export interface Tile {
  modifiers: TileModifier[];
}

// ───────────────────────────── board ─────────────────────────────

export interface BoardState {
  width: number;
  height: number;
  /** Row-major occupancy: index = rank * width + file. Holds a PieceId or null. */
  squares: (PieceId | null)[];
  /** All pieces currently on the board, by id. */
  pieces: Record<PieceId, Piece>;
  /** Row-major tile data, same indexing as `squares`. */
  tiles: Tile[];
}

// ───────────────────────────── moves ─────────────────────────────

/**
 * Atomic board mutations. Every move (including castling, en passant, promotion,
 * and any future ability) is expressed as an ordered list of these, so one
 * generic `applyEffects` executes them — on the client and on the server.
 */
export type BoardEffect =
  | { type: 'relocate'; pieceId: PieceId; from: Coord; to: Coord }
  | { type: 'remove'; pieceId: PieceId; at: Coord }
  | { type: 'transform'; pieceId: PieceId; toKind: PieceKind }
  | { type: 'spawn'; piece: Piece; at: Coord }
  | { type: 'addTileModifier'; at: Coord; modifier: TileModifier }
  | { type: 'removeTileModifier'; at: Coord; modifierId: string };

export type MoveFlag =
  | 'capture'
  | 'doublePush'
  | 'enPassant'
  | 'castleKingside'
  | 'castleQueenside'
  | 'promotion'
  | (string & {});

/** A fully resolved, legal (or pseudo-legal) move produced by the engine. */
export interface Move {
  pieceId: PieceId;
  from: Coord;
  to: Coord;
  flags: MoveFlag[];
  promotion: PieceKind | null;
  /** Square that becomes en-passant-capturable after this move, if any. */
  enPassantTarget: Coord | null;
  effects: BoardEffect[];
}

// ───────────────────────────── actions (client → authority) ─────────────────────────────

/** Intent sent by a client. Over the wire in Phase 2 this is the socket payload. */
export type MoveAction =
  | {
      type: 'move';
      from: Coord;
      to: Coord;
      /** Defaults to 'queen' if the move promotes and none is given. */
      promotion?: PieceKind;
      /** Phase 2: server validates this matches the socket's seat. */
      color?: Color;
    }
  | { type: 'reset'; ruleset?: Ruleset };

// ───────────────────────────── events (authority → clients) ─────────────────────────────

interface EventBase {
  /** Monotonic sequence number — lets clients detect gaps / resync after reconnect. */
  seq: number;
  ply: number;
}

export type GameEvent =
  | (EventBase & { type: 'gameStarted' })
  | (EventBase & { type: 'moved'; move: Move; san: string; color: Color })
  | (EventBase & { type: 'captured'; piece: Piece; at: Coord })
  | (EventBase & { type: 'promoted'; pieceId: PieceId; toKind: PieceKind })
  | (EventBase & { type: 'check'; color: Color })
  | (EventBase & { type: 'gameOver'; status: GameStatus; winner: Color | null })
  | (EventBase & { type: 'rejected'; action: MoveAction; reason: string });

// ───────────────────────────── rules config ─────────────────────────────

export type RuleModifierId = string;

export interface ActiveRuleModifier {
  id: RuleModifierId;
  /** Which side owns the relic; null = global rule. */
  owner: Color | null;
  data: JsonObject;
}

export interface Ruleset {
  /** Display/debug name, e.g. "standard", "run-3-floor-2". */
  name: string;
  /** Relics / rule-benders currently in effect, resolved via the rule-modifier registry. */
  modifiers: ActiveRuleModifier[];
}

// ───────────────────────────── top-level state ─────────────────────────────

export type GameStatus = 'inProgress' | 'check' | 'checkmate' | 'stalemate' | 'draw';

export interface GameState {
  /** Bump when the schema changes incompatibly (client/server handshake). */
  schemaVersion: 1;
  board: BoardState;
  turn: Color;
  status: GameStatus;
  winner: Color | null;
  /** Square a pawn may capture into via en passant this turn. */
  enPassant: Coord | null;
  halfmoveClock: number;
  fullmoveNumber: number;
  /** Plies played so far. */
  ply: number;
  ruleset: Ruleset;
  history: Move[];
  /** Append-only log; UI animations and network sync are driven from this. */
  events: GameEvent[];
  /** Next GameEvent.seq. */
  nextSeq: number;
  /** Monotonic id counter for spawned pieces. */
  nextPieceId: number;
}
