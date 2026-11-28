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
      modifiers: [{ id: 'knightCamel', owner: null, data: { level: 1 } }],
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

describe('mod charges and cooldown', () => {
  const sqr = (n: string) => ({ file: n.charCodeAt(0) - 97, rank: Number(n[1]) - 1 });
  const go = (s: GameState, from: string, to: string) => reduce(s, { type: 'move', from: sqr(from), to: sqr(to) });
  const leapsFrom = (s: GameState, from: string) =>
    legal(s).filter((m) => m.from.file === sqr(from).file && m.from.rank === sqr(from).rank && m.flags.some((f) => f.startsWith('mod:'))).length;

  it('level 2: two uses per knight, with a one-turn cooldown', () => {
    let s = createGameState(standardBoard(), rulesetFor(['knightCamel'], () => 2));
    s = go(s, 'b1', 'c4');
    expect(s.history[0].flags).toContain('mod:knightCamel');
    s = go(s, 'a7', 'a6');
    expect(leapsFrom(s, 'c4')).toBe(0); // cooling down
    s = go(go(s, 'g1', 'f3'), 'a6', 'a5');
    expect(leapsFrom(s, 'c4')).toBeGreaterThan(0); // ready again
    s = go(go(s, 'c4', 'f5'), 'a5', 'a4');
    s = go(go(s, 'f3', 'g1'), 'b7', 'b6');
    expect(leapsFrom(s, 'f5')).toBe(0); // spent
  });

  it('a spent knight no longer gives camel check', () => {
    const s = withModsState('8/5k2/8/8/4N3/8/8/4K3 b - - 0 1');
    const id = Object.values(s.board.pieces).find((p) => p.kind === 'knight')!.id;
    expect(sideCheck(s)).toBe(true);
    const spent = { ...s, ruleset: { ...s.ruleset, modifiers: [withUse(s.ruleset.modifiers[0], id, 0)] } };
    expect(sideCheck(spent)).toBe(false);
  });
});

import { sideInCheck as sideCheck, standardBoard } from '../src/engine';
import { withUse } from '../src/engine/rules/charges';
function withModsState(f: string): GameState {
  return { ...fen(f), ruleset: rulesetFor(['knightCamel']) };
}

describe('replayGame (move review + captured pieces)', () => {
  it('rebuilds every position and tracks captures by the side that took them', async () => {
    const { replayGame, materialOf } = await import('../src/engine/replay');
    let s = createGameState();
    const play = (from: string, to: string) => {
      const sq = (x: string) => ({ file: x.charCodeAt(0) - 97, rank: Number(x[1]) - 1 });
      s = gameReducer(s, { type: 'move', from: sq(from), to: sq(to) });
    };
    play('e2', 'e4'); play('d7', 'd5'); play('e4', 'd5'); play('d8', 'd5');
    const r = replayGame(s);
    expect(r.ok).toBe(true);
    expect(r.boards).toHaveLength(5);
    expect(r.boards[4].squares).toEqual(s.board.squares);
    expect(r.captures[2]).toEqual({ white: [], black: [] });
    expect(r.captures[3].white.map((p) => p.kind)).toEqual(['pawn']);
    expect(r.captures[4].black.map((p) => p.kind)).toEqual(['pawn']);
    expect(materialOf(r.captures[4].white)).toBe(1);
    // position 1 has the e-pawn on e4 and nothing taken
    expect(Object.keys(r.boards[1].pieces)).toHaveLength(32);
  });
});

describe('mod: pawnRam', () => {
  const sqr = (n: string) => ({ file: n.charCodeAt(0) - 97, rank: Number(n[1]) - 1 });
  const ram = (f: string, ids = ['pawnRam']) => ({ ...fen(f), ruleset: rulesetFor(ids) });
  const rams = (s: GameState) => legal(s).filter((m) => m.flags.includes('mod:pawnRam'));
  const at = (m: { from: { file: number; rank: number }; to: { file: number; rank: number } }) =>
    `${String.fromCharCode(97 + m.from.file)}${m.from.rank + 1}${String.fromCharCode(97 + m.to.file)}${m.to.rank + 1}`;

  it('captures the piece straight ahead, only with the mod, in each side’s direction', () => {
    const f = '4k3/8/8/3pn3/3BP3/8/8/4K3 w - - 0 1';
    expect(rams(ram(f, []))).toHaveLength(0);
    expect(rams(ram(f)).map(at)).toEqual(['e4e5']);
    expect(rams(ram('4k3/8/8/3pn3/3BP3/8/8/4K3 b - - 0 1')).map(at)).toEqual(['d5d4']);
  });

  it('never moves onto an empty square or a friendly piece', () => {
    expect(rams(ram('4k3/8/8/4N3/4P3/8/3P4/4K3 w - - 0 1'))).toHaveLength(0);
  });

  it('a ready ram checks the king in front of it; a spent one does not', () => {
    const s = ram('4k3/4P3/8/8/8/8/8/4K3 b - - 0 1');
    expect(sideCheck(s)).toBe(true);
    expect(sideCheck({ ...s, ruleset: rulesetFor([]) })).toBe(false);
    const id = Object.values(s.board.pieces).find((p) => p.kind === 'pawn')!.id;
    expect(sideCheck({ ...s, ruleset: { ...s.ruleset, modifiers: [withUse(s.ruleset.modifiers[0], id, 0)] } })).toBe(false);
  });

  it('ramming onto the last rank promotes and spends the charge', () => {
    const s = ram('3rk3/3P4/8/8/8/8/8/4K3 w - - 0 1');
    expect(rams(s)).toHaveLength(4);
    const next = reduce(s, { type: 'move', from: sqr('d7'), to: sqr('d8'), promotion: 'queen' });
    expect(next.board.pieces[next.board.squares[7 * 8 + 3]!].kind).toBe('queen');
    expect(next.history[0].flags).toContain('mod:pawnRam');
  });

  it('level 1: each pawn rams once', () => {
    let s = ram('4k3/8/3p4/3P4/8/4p3/4P3/4K3 w - - 0 1');
    expect(rams(s)).toHaveLength(2);
    s = reduce(reduce(s, { type: 'move', from: sqr('e2'), to: sqr('e3') }), { type: 'move', from: sqr('e8'), to: sqr('f8') });
    expect(rams(s).map(at)).toEqual(['d5d6']);
  });

  it('bay keeps one cartridge per piece slot, in slot order', async () => {
    const { normalizeLoadout } = await import('../src/variants/catalog');
    expect(normalizeLoadout(['pawnRam', 'knightCamel', 'nope', 'pawnRam'])).toEqual(['knightCamel', 'pawnRam']);
  });
});

describe('mods: rookSlip and bishopShift', () => {
  const sqr = (n: string) => ({ file: n.charCodeAt(0) - 97, rank: Number(n[1]) - 1 });
  const name = (c: { file: number; rank: number }) => `${String.fromCharCode(97 + c.file)}${c.rank + 1}`;
  const withMods = (f: string, ids: string[]) => ({ ...fen(f), ruleset: rulesetFor(ids) });
  const modMoves = (s: GameState, id: string) =>
    legal(s).filter((m) => m.flags.includes(`mod:${id}`)).map((m) => `${name(m.from)}${name(m.to)}`).sort();

  it('a rook steps one square diagonally, only with the mod', () => {
    const f = '4k3/8/8/8/3R4/8/8/4K3 w - - 0 1';
    expect(modMoves(withMods(f, []), 'rookSlip')).toEqual([]);
    expect(modMoves(withMods(f, ['rookSlip']), 'rookSlip')).toEqual(['d4c3', 'd4c5', 'd4e3', 'd4e5']);
  });

  it('a bishop steps one square orthogonally, changing colour', () => {
    const f = '4k3/8/8/8/3B4/8/8/4K3 w - - 0 1';
    expect(modMoves(withMods(f, ['bishopShift']), 'bishopShift')).toEqual(['d4c4', 'd4d3', 'd4d5', 'd4e4']);
  });

  it('ready pieces threaten their extra squares; plain ones do not', () => {
    // Black king e5; white rook d4 (diagonal neighbour) / bishop e4 (orthogonal neighbour).
    expect(sideCheck(withMods('8/8/8/4k3/3R4/8/8/K7 b - - 0 1', ['rookSlip']))).toBe(true);
    expect(sideCheck(withMods('8/8/8/4k3/3R4/8/8/K7 b - - 0 1', []))).toBe(false);
    expect(sideCheck(withMods('8/8/8/4k3/4B3/8/8/K7 b - - 0 1', ['bishopShift']))).toBe(true);
    expect(sideCheck(withMods('8/8/8/4k3/4B3/8/8/K7 b - - 0 1', []))).toBe(false);
  });

  it('level 1: one slip per rook, and a slipped rook can no longer castle', () => {
    let s = createGameState(standardBoard(), rulesetFor(['rookSlip']));
    const go = (a: string, b: string) => (s = reduce(s, { type: 'move', from: sqr(a), to: sqr(b) }));
    go('g2', 'g3'); go('a7', 'a6'); go('g1', 'f3'); go('b7', 'b6'); go('f1', 'g2'); go('c7', 'c6');
    expect(modMoves(s, 'rookSlip')).toEqual([]); // h1 rook's diagonal g2 is occupied
    go('g2', 'h3'); go('d7', 'd6');
    expect(modMoves(s, 'rookSlip')).toEqual(['h1g2']);
    go('h1', 'g2'); go('e7', 'e6');
    go('g2', 'h1'); go('f7', 'f6');
    expect(modMoves(s, 'rookSlip')).toEqual([]); // spent
    expect(legal(s).some((m) => m.flags.includes('castleKingside'))).toBe(false); // the rook has moved
  });

  it('the four slots each take one cartridge', async () => {
    const { normalizeLoadout } = await import('../src/variants/catalog');
    expect(normalizeLoadout(['pawnRam', 'bishopShift', 'rookSlip', 'knightCamel'])).toEqual(['knightCamel', 'rookSlip', 'bishopShift', 'pawnRam']);
  });
});

describe('rematch', () => {
  // Regression (room 8LD47D): a rematch kept the previous game's used charges.
  it('restores every charge and keeps the mods and their level', () => {
    const sqr = (n: string) => ({ file: n.charCodeAt(0) - 97, rank: Number(n[1]) - 1 });
    let s: GameState = { ...fen('4k3/8/8/3p4/3P4/8/8/4K3 b - - 0 1'), ruleset: rulesetFor(['bishopShift', 'knightCamel', 'pawnRam', 'rookSlip'], () => 2) };
    s = reduce(s, { type: 'move', from: sqr('d5'), to: sqr('d4') });
    expect(s.ruleset.modifiers.find((m) => m.id === 'pawnRam')!.data.uses).toBeDefined();
    for (const next of [reduce(s, { type: 'reset', ruleset: s.ruleset }), reduce(s, { type: 'reset' })]) {
      expect(next.ply).toBe(0);
      expect(next.ruleset).toEqual(rulesetFor(['bishopShift', 'knightCamel', 'pawnRam', 'rookSlip'], () => 2));
    }
  });
});
