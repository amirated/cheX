import { describe, expect, it } from 'vitest';
import { canPossiblyMate, createGameState, fromFEN, gameReducer } from '../src/engine';
import { formatClock, formatTimeControl, PRESETS, remainingAt, thresholds, type ClockView } from '../src/types/clock';

describe('game-ending actions', () => {
  it('resignation ends the game for the opponent', () => {
    const s = gameReducer(createGameState(), { type: 'resign', color: 'white' });
    expect(s.status).toBe('resigned');
    expect(s.winner).toBe('black');
    expect(s.events.at(-1)?.type).toBe('gameOver');
  });
  it('timeout loses when the opponent can still mate', () => {
    const s = gameReducer(createGameState(), { type: 'timeout', color: 'black' });
    expect(s.status).toBe('timeout');
    expect(s.winner).toBe('white');
  });
  it('timeout draws against insufficient material', () => {
    const bare = fromFEN('7k/8/8/8/8/8/8/K1N5 w - - 0 1');
    expect(canPossiblyMate(bare.board, 'black')).toBe(false); // bare king
    expect(canPossiblyMate(bare.board, 'white')).toBe(false); // K+N vs bare K
    expect(gameReducer(bare, { type: 'timeout', color: 'white' }).winner).toBeNull();
    const withPawn = fromFEN('7k/7p/8/8/8/8/8/K1N5 w - - 0 1');
    expect(canPossiblyMate(withPawn.board, 'white')).toBe(true); // mate possible with the pawn blocking
  });
  it('no moves or further endings after the game is over', () => {
    const s = gameReducer(createGameState(), { type: 'resign', color: 'black' });
    expect(gameReducer(s, { type: 'timeout', color: 'white' }).events.at(-1)?.type).toBe('rejected');
    expect(gameReducer(s, { type: 'move', from: { file: 4, rank: 1 }, to: { file: 4, rank: 3 } }).ply).toBe(0);
  });
});

const view = (over: Partial<ClockView> = {}): ClockView => ({
  timeControl: { initialMs: 180_000, incrementMs: 2_000 },
  remainingMs: { white: 100_000, black: 50_000 },
  running: 'black',
  flagged: null,
  serverNow: 0,
  receivedAt: 1_000,
  latencyMs: 40,
  ...over,
});

describe('local clock rendering', () => {
  it('only the running side counts down, corrected for latency', () => {
    expect(remainingAt(view(), 'white', 6_000)).toBe(100_000);
    expect(remainingAt(view(), 'black', 6_000)).toBe(50_000 - 5_000 - 40);
  });
  it('never goes negative and shows 0 when flagged', () => {
    expect(remainingAt(view(), 'black', 1_000_000)).toBe(0);
    expect(remainingAt(view({ flagged: 'white', running: null }), 'white', 0)).toBe(0);
  });
  it('a stopped clock is frozen', () => {
    expect(remainingAt(view({ running: null }), 'black', 999_999)).toBe(50_000);
  });
  it('formats clocks', () => {
    expect(formatClock(3_725_000)).toBe('1:02:05');
    expect(formatClock(247_000)).toBe('4:07');
    expect(formatClock(59_001)).toBe('1:00');
    expect(formatClock(10_000)).toBe('0:10');
    expect(formatClock(9_499)).toBe('0:09.4');
    expect(formatClock(0)).toBe('0:00.0');
  });
  it('labels and thresholds', () => {
    expect(PRESETS.map((p) => formatTimeControl(p.tc))).toEqual(['1+0', '2+1', '3+0', '5+3', '10+0', '15+10']);
    expect(formatTimeControl({ initialMs: 12_000, incrementMs: 0 })).toBe('12s+0');
    expect(formatTimeControl({ initialMs: 150_000, incrementMs: 2_000 })).toBe('2.5+2');
    expect(thresholds({ initialMs: 60_000, incrementMs: 0 })).toEqual({ lowMs: 12_000, criticalMs: 5_000 });
    expect(thresholds({ initialMs: 900_000, incrementMs: 0 })).toEqual({ lowMs: 30_000, criticalMs: 10_000 });
  });
});
