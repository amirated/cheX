import type { Color } from './game';

/**
 * Chess clock types. Mirrors cheX-BE `clock.rs`. The clock is deliberately kept
 * outside `GameState`: the server owns it, and clients only ever *render* it.
 */

export interface TimeControl {
  initialMs: number;
  incrementMs: number;
}

/** Authoritative clock as sent by the server. Balances are as of `serverNow`. */
export interface ClockSnapshot {
  timeControl: TimeControl;
  remainingMs: { white: number; black: number };
  /** Whose clock is running; null before the first move and after the game ends. */
  running: Color | null;
  flagged: Color | null;
  serverNow: number;
}

/**
 * A snapshot pinned to the moment this client received it, on the *monotonic*
 * `performance.now()` clock. Counting down from here is immune to the device's
 * wall clock being wrong or changed, and to timer throttling in background tabs.
 */
export interface ClockView extends ClockSnapshot {
  receivedAt: number;
  /** Estimated one-way network delay: the snapshot was already this old on arrival. */
  latencyMs: number;
}

export const PRESETS: { label: string; family: 'Bullet' | 'Blitz' | 'Rapid'; tc: TimeControl }[] = [
  { label: '1+0', family: 'Bullet', tc: { initialMs: 60_000, incrementMs: 0 } },
  { label: '2+1', family: 'Bullet', tc: { initialMs: 120_000, incrementMs: 1_000 } },
  { label: '3+0', family: 'Blitz', tc: { initialMs: 180_000, incrementMs: 0 } },
  { label: '5+3', family: 'Blitz', tc: { initialMs: 300_000, incrementMs: 3_000 } },
  { label: '10+0', family: 'Rapid', tc: { initialMs: 600_000, incrementMs: 0 } },
  { label: '15+10', family: 'Rapid', tc: { initialMs: 900_000, incrementMs: 10_000 } },
];

/** Limits shared with the server's `TimeControl::validate`. */
export const LIMITS = { minMinutes: 1, maxMinutes: 180, maxIncrementSec: 60 } as const;

/** "5+3" style label. */
export function formatTimeControl(tc: TimeControl): string {
  if (tc.initialMs < 60_000) return `${Math.round(tc.initialMs / 1000)}s+${Math.round(tc.incrementMs / 1000)}`;
  const min = tc.initialMs / 60_000;
  const minLabel = Number.isInteger(min) ? String(min) : min.toFixed(1);
  return `${minLabel}+${Math.round(tc.incrementMs / 1000)}`;
}

/** Remaining time for `color` at local monotonic time `nowPerf`. */
export function remainingAt(view: ClockView, color: Color, nowPerf: number): number {
  if (view.flagged === color) return 0;
  const base = view.remainingMs[color];
  if (view.running !== color) return base;
  const elapsed = nowPerf - view.receivedAt + view.latencyMs;
  return Math.max(0, base - Math.max(0, elapsed));
}

/** Warning thresholds scale with the time control (bullet warns later than rapid). */
export function thresholds(tc: TimeControl): { lowMs: number; criticalMs: number } {
  const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
  return {
    lowMs: clamp(tc.initialMs * 0.2, 10_000, 30_000),
    criticalMs: clamp(tc.initialMs * 0.08, 5_000, 10_000),
  };
}

/** 1:05:03 · 4:07 · 0:09.4 (tenths under 10 seconds). */
export function formatClock(ms: number): string {
  const t = Math.max(0, ms);
  if (t < 10_000) {
    // floor to tenths so the display never shows time the player doesn't have
    const tenths = Math.floor(t / 100);
    return `0:0${Math.floor(tenths / 10)}.${tenths % 10}`;
  }
  const total = Math.ceil(t / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const ss = String(s).padStart(2, '0');
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`;
}
