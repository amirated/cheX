import './setup';
import type {
  ActiveRuleModifier,
  BoardState,
  Color,
  GameEvent,
  GameState,
  GameStatus,
  Move,
  MoveAction,
  Piece,
  PieceKind,
  Ruleset,
} from '../types/game';
import { createEmptyBoard, indexOf, opposite, sameCoord, squareName } from './board';
import { applyEffects } from './effects';
import { legalMoves, sideInCheck } from './legal';
import { getPieceDef } from './pieces/registry';
import { activeModifiersFor, isModified } from './rules/modifiers';

export const STANDARD_RULESET: Ruleset = { name: 'standard', modifiers: [] };

const BACK_RANK: PieceKind[] = ['rook', 'knight', 'bishop', 'queen', 'king', 'bishop', 'knight', 'rook'];

export function makePiece(id: string, kind: PieceKind, color: Color, hasMoved = false): Piece {
  return { id, kind, color, hasMoved, tags: [], data: {} };
}

export function standardBoard(): BoardState {
  const b = createEmptyBoard(8, 8);
  let n = 0;
  const put = (kind: PieceKind, color: Color, file: number, rank: number) => {
    const id = `${color[0]}${kind[0]}${n++}`;
    b.pieces[id] = makePiece(id, kind, color);
    b.squares[indexOf(b, { file, rank })] = id;
  };
  BACK_RANK.forEach((k, f) => {
    put(k, 'white', f, 0);
    put('pawn', 'white', f, 1);
    put('pawn', 'black', f, 6);
    put(k, 'black', f, 7);
  });
  return b;
}

/** `nextSeq` lets a reset keep event sequence numbers monotonic across games in a room. */
export function createGameState(
  board: BoardState = standardBoard(),
  ruleset: Ruleset = STANDARD_RULESET,
  nextSeq = 0,
): GameState {
  const state: GameState = {
    schemaVersion: 1,
    board,
    turn: 'white',
    status: 'inProgress',
    winner: null,
    enPassant: null,
    halfmoveClock: 0,
    fullmoveNumber: 1,
    ply: 0,
    ruleset,
    history: [],
    events: [],
    nextSeq,
    nextPieceId: Object.keys(board.pieces).length,
  };
  return pushEvents(state, [{ type: 'gameStarted' }]);
}

// ───────────────────────────── events ─────────────────────────────

type EventDraft = GameEvent extends infer E ? (E extends GameEvent ? Omit<E, 'seq' | 'ply'> : never) : never;

/** Keep only the tail of the event log in memory; the server is the durable store. */
const MAX_EVENTS = 200;

function pushEvents(state: GameState, drafts: EventDraft[]): GameState {
  let seq = state.nextSeq;
  const stamped = drafts.map((d) => ({ ...d, seq: seq++, ply: state.ply }) as GameEvent);
  const events = [...state.events, ...stamped];
  return { ...state, events: events.slice(-MAX_EVENTS), nextSeq: seq };
}

// ───────────────────────────── status ─────────────────────────────

function evaluateStatus(state: GameState): { status: GameStatus; winner: Color | null } {
  const inCheck = sideInCheck(state);
  const hasMove = legalMoves(state).length > 0;
  if (!hasMove) {
    return inCheck ? { status: 'checkmate', winner: opposite(state.turn) } : { status: 'stalemate', winner: null };
  }
  if (state.halfmoveClock >= 100) return { status: 'draw', winner: null };
  return { status: inCheck ? 'check' : 'inProgress', winner: null };
}

const GAME_OVER: ReadonlySet<GameStatus> = new Set(['checkmate', 'stalemate', 'draw', 'timeout', 'resigned']);

export const isGameOver = (s: GameState): boolean => GAME_OVER.has(s.status);

/**
 * Could `color` deliver checkmate by any sequence of legal moves? Used to decide
 * whether running out of time loses or draws. Deliberately conservative: only a
 * bare king, or king + one bishop/knight against a bare king, counts as "cannot".
 */
export function canPossiblyMate(board: BoardState, color: Color, modifiers: ActiveRuleModifier[] = []): boolean {
  const others = (c: Color) =>
    Object.values(board.pieces).filter((p) => p.color === c && !getPieceDef(p.kind).royal);
  const mine = others(color);
  if (mine.length === 0) return false;
  // A lone knight/bishop only counts as "cannot mate" while no game mod extends how it moves.
  if (
    mine.length === 1 &&
    (mine[0].kind === 'knight' || mine[0].kind === 'bishop') &&
    !isModified(modifiers, mine[0]) &&
    others(opposite(color)).length === 0
  ) {
    return false;
  }
  return true;
}

/** End the game without a move (resignation, flag fall). */
function endGame(state: GameState, status: GameStatus, winner: Color | null): GameState {
  return pushEvents({ ...state, status, winner }, [{ type: 'gameOver', status, winner }]);
}

// ───────────────────────────── SAN ─────────────────────────────

function toSAN(before: GameState, move: Move, legal: Move[], after: GameState): string {
  let san: string;
  if (move.flags.includes('castleKingside')) san = 'O-O';
  else if (move.flags.includes('castleQueenside')) san = 'O-O-O';
  else {
    const piece = before.board.pieces[move.pieceId];
    const def = getPieceDef(piece.kind);
    const capture = move.flags.includes('capture');
    const dest = squareName(move.to);
    if (piece.kind === 'pawn') {
      san = capture ? `${'abcdefgh'[move.from.file]}x${dest}` : dest;
    } else {
      const rivals = legal.filter(
        (m) =>
          m.pieceId !== move.pieceId &&
          sameCoord(m.to, move.to) &&
          before.board.pieces[m.pieceId].kind === piece.kind,
      );
      let dis = '';
      if (rivals.length) {
        const sameFile = rivals.some((m) => m.from.file === move.from.file);
        const sameRank = rivals.some((m) => m.from.rank === move.from.rank);
        const from = squareName(move.from);
        dis = !sameFile ? from[0] : !sameRank ? from.slice(1) : from;
      }
      san = `${def.symbol}${dis}${capture ? 'x' : ''}${dest}`;
    }
    if (move.promotion) san += `=${getPieceDef(move.promotion).symbol}`;
  }
  if (after.status === 'checkmate') san += '#';
  else if (after.status === 'check') san += '+';
  return san;
}

// ───────────────────────────── applying moves ─────────────────────────────

/** Apply an already-validated legal move. Pure. */
export function applyMove(state: GameState, move: Move, legalBefore: Move[] = legalMoves(state)): GameState {
  const mover = state.board.pieces[move.pieceId];
  let { board, removed } = applyEffects(state.board, move.effects);

  // relic post-move hooks
  for (const { active, def } of activeModifiersFor(state, mover.color)) {
    const extra = def.afterMove?.(state, move, active);
    if (extra?.length) {
      const r = applyEffects(board, extra);
      board = r.board;
      removed = [...removed, ...r.removed];
    }
  }

  const resetClock = mover.kind === 'pawn' || removed.length > 0;
  let next: GameState = {
    ...state,
    board,
    turn: opposite(state.turn),
    enPassant: move.enPassantTarget,
    halfmoveClock: resetClock ? 0 : state.halfmoveClock + 1,
    fullmoveNumber: state.turn === 'black' ? state.fullmoveNumber + 1 : state.fullmoveNumber,
    ply: state.ply + 1,
    history: [...state.history, move],
  };
  const { status, winner } = evaluateStatus(next);
  next = { ...next, status, winner };

  const drafts: EventDraft[] = [
    { type: 'moved', move, san: toSAN(state, move, legalBefore, next), color: mover.color },
    ...removed.map((p): EventDraft => ({ type: 'captured', piece: p, at: move.to })),
  ];
  if (move.promotion) drafts.push({ type: 'promoted', pieceId: move.pieceId, toKind: move.promotion });
  if (status === 'check') drafts.push({ type: 'check', color: next.turn });
  if (isGameOver(next)) drafts.push({ type: 'gameOver', status, winner });
  return pushEvents(next, drafts);
}

/**
 * The authoritative reducer. Same signature the Phase-2 server will run:
 *   (state, action) -> state'   (+ the new tail of state'.events is broadcast)
 */
export function gameReducer(state: GameState, action: MoveAction): GameState {
  switch (action.type) {
    case 'reset':
      return createGameState(standardBoard(), action.ruleset ?? state.ruleset, state.nextSeq);

    case 'resign':
    case 'timeout': {
      if (isGameOver(state)) return pushEvents(state, [{ type: 'rejected', action, reason: 'Game is over' }]);
      const opponent = opposite(action.color);
      if (action.type === 'resign') return endGame(state, 'resigned', opponent);
      return endGame(state, 'timeout', canPossiblyMate(state.board, opponent, state.ruleset.modifiers) ? opponent : null);
    }

    case 'move': {
      const reject = (reason: string) => pushEvents(state, [{ type: 'rejected', action, reason }]);
      if (isGameOver(state)) return reject('Game is over');
      if (action.color && action.color !== state.turn) return reject('Not your turn');

      const legal = legalMoves(state);
      const candidates = legal.filter((m) => sameCoord(m.from, action.from) && sameCoord(m.to, action.to));
      if (!candidates.length) return reject('Illegal move');

      const wanted = action.promotion ?? 'queen';
      const move = candidates.find((m) => m.promotion === null || m.promotion === wanted) ?? candidates[0];
      return applyMove(state, move, legal);
    }
  }
}
