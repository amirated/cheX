import { describe, expect, it } from 'vitest';
import {
  applyEffects,
  createGameState,
  fromFEN,
  gameReducer,
  legalMoves,
  opposite,
  parseSquare,
} from '../src/engine';
import type { GameState, MoveAction } from '../src/types/game';

/** Minimal state advance for perft (skips SAN/status bookkeeping). */
function perft(state: GameState, depth: number): number {
  const moves = legalMoves(state);
  if (depth === 1) return moves.length;
  let n = 0;
  for (const m of moves) {
    n += perft(
      { ...state, board: applyEffects(state.board, m.effects).board, turn: opposite(state.turn), enPassant: m.enPassantTarget },
      depth - 1,
    );
  }
  return n;
}

const mv = (from: string, to: string): MoveAction => ({ type: 'move', from: parseSquare(from), to: parseSquare(to) });
const play = (s: GameState, ...moves: [string, string][]) => moves.reduce((st, [a, b]) => gameReducer(st, mv(a, b)), s);

describe('perft (move generator correctness)', () => {
  it('start position', () => {
    const s = createGameState();
    expect(perft(s, 1)).toBe(20);
    expect(perft(s, 2)).toBe(400);
    expect(perft(s, 3)).toBe(8902);
    expect(perft(s, 4)).toBe(197281);
  });
  it('kiwipete (castling, en passant, promotion, pins)', () => {
    const s = fromFEN('r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1');
    expect(perft(s, 1)).toBe(48);
    expect(perft(s, 2)).toBe(2039);
    expect(perft(s, 3)).toBe(97862);
  });
  it('position 3 (en passant discovered checks)', () => {
    const s = fromFEN('8/2p5/3p4/KP5r/1R3p1k/8/4P1P1/8 w - - 0 1');
    expect(perft(s, 4)).toBe(43238);
  });
  it('position 4 (promotions + castling under fire)', () => {
    const s = fromFEN('r3k2r/Pppp1ppp/1b3nbN/nP6/BBP1P3/q4N2/Pp1P2PP/R2Q1RK1 w kq - 0 1');
    expect(perft(s, 3)).toBe(9467);
  });
  it('position 5', () => {
    const s = fromFEN('rnbq1k1r/pp1Pbppp/2p5/8/2B5/8/PPP1NnPP/RNBQK2R w KQ - 1 8');
    expect(perft(s, 3)).toBe(62379);
  });
});

describe('game reducer', () => {
  it("fool's mate → checkmate, black wins", () => {
    const s = play(createGameState(), ['f2', 'f3'], ['e7', 'e5'], ['g2', 'g4'], ['d8', 'h4']);
    expect(s.status).toBe('checkmate');
    expect(s.winner).toBe('black');
    const last = s.events.filter((e) => e.type === 'moved').at(-1);
    expect(last && last.type === 'moved' && last.san).toBe('Qh4#');
  });
  it('stalemate detection', () => {
    const s = gameReducer(fromFEN('7k/5Q2/6K1/8/8/8/8/8 w - - 0 1'), mv('f7', 'f6'));
    expect(s.status).not.toBe('stalemate');
    const s2 = gameReducer(fromFEN('7k/8/5QK1/8/8/8/8/8 w - - 0 1'), mv('f6', 'f7'));
    expect(s2.status).toBe('stalemate');
  });
  it('rejects illegal moves without changing the board', () => {
    const s0 = createGameState();
    const s = gameReducer(s0, mv('e2', 'e5'));
    expect(s.board).toBe(s0.board);
    expect(s.events.at(-1)?.type).toBe('rejected');
  });
  it('auto-promotes to queen', () => {
    const s = gameReducer(fromFEN('8/P6k/8/8/8/8/8/K7 w - - 0 1'), mv('a7', 'a8'));
    const id = s.board.squares[7 * 8 + 0]!;
    expect(s.board.pieces[id].kind).toBe('queen');
  });
  it('castling moves the rook; en passant removes the pawn', () => {
    let s = fromFEN('r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1');
    s = gameReducer(s, mv('e1', 'g1'));
    expect(s.board.pieces[s.board.squares[5]!].kind).toBe('rook');
    let e = play(createGameState(), ['e2', 'e4'], ['a7', 'a6'], ['e4', 'e5'], ['d7', 'd5']);
    e = gameReducer(e, mv('e5', 'd6'));
    expect(e.board.squares[4 * 8 + 3]).toBeNull();
  });
  it('state is JSON round-trippable', () => {
    const s = play(createGameState(), ['e2', 'e4'], ['e7', 'e5']);
    expect(JSON.parse(JSON.stringify(s))).toEqual(s);
  });
  it('rule modifiers plug in without engine changes', () => {
    const s = fromFEN('r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1');
    const relic = { ...s, ruleset: { name: 'test', modifiers: [{ id: 'noCastling', owner: null, data: {} }] } };
    expect(legalMoves(s).some((m) => m.flags.includes('castleKingside'))).toBe(true);
    expect(legalMoves(relic).some((m) => m.flags.includes('castleKingside'))).toBe(false);
  });
});

// ───────────────────────────── game mods ─────────────────────────────

import { rulesetFor } from '../src/variants/catalog';
import { isInCheck as inCheck, legalMoves as legal, fromFEN as fen, gameReducer as reduce, canPossiblyMate as canMate } from '../src/engine';

describe('mod: knightCamel', () => {
  const withMods = (f: string, ids: string[]) => ({ ...fen(f), ruleset: rulesetFor(ids) });
  const d4 = { file: 3, rank: 3 };

  it('canonical ruleset', () => {
    expect(rulesetFor(['knightCamel', 'knightCamel'])).toEqual({
      name: 'knightCamel',
      modifiers: [{ id: 'knightCamel', owner: null, data: {} }],
    });
    expect(rulesetFor([])).toEqual({ name: 'standard', modifiers: [] });
  });

  it('adds camel leaps only when plugged in', () => {
    const f = '4k3/8/8/8/3N4/8/8/4K3 w - - 0 1';
    const from = (s: ReturnType<typeof withMods>) => legal(s).filter((m) => m.from.file === d4.file && m.from.rank === d4.rank);
    expect(from(withMods(f, []))).toHaveLength(8);
    expect(from(withMods(f, ['knightCamel']))).toHaveLength(15);
  });

  it('camel leaps give check', () => {
    const s = withMods('8/5k2/8/8/4N3/8/8/4K3 b - - 0 1', ['knightCamel']);
    expect(inCheck(s.board, 'black', null, s.ruleset.modifiers)).toBe(true);
    expect(inCheck(s.board, 'black')).toBe(false);
  });

  it('a lone camel knight is mating material; rematch keeps mods', () => {
    const s = withMods('4k3/8/8/8/3N4/8/8/4K3 w - - 0 1', ['knightCamel']);
    expect(canMate(s.board, 'white', s.ruleset.modifiers)).toBe(true);
    expect(canMate(s.board, 'white')).toBe(false);
    expect(reduce(s, { type: 'reset' }).ruleset.name).toBe('knightCamel');
  });
});
