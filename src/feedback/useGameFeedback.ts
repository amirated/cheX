import { useEffect, useRef, useState } from 'react';
import type { ClockDisplay } from '../hooks/useClock';
import type { TransportMeta } from '../net/transport';
import type { Color, Coord, GameEvent, GameState, GameStatus } from '../types/game';
import { haptic } from './haptics';
import { playSound, type SoundName } from './sound';
import { modOfMove } from '../engine/rules/charges';
import { modInfo } from '../variants/catalog';

/** Pieces slide for ~190 ms (ANIM.move): land the sound with the piece, not before it. */
const LANDING_MS = 150;
const later = (fn: () => void, ms: number) => window.setTimeout(fn, ms);

export interface Burst {
  id: number;
  at: Coord;
  /** Colour of the captured piece (shards take its colour). */
  color: Color;
  /** Override colour (a mod move bursts in its cartridge colour). */
  tint?: string;
}

export interface GameOverInfo {
  /** Seq of the gameOver event: identifies this ending (a rematch gets a new one). */
  seq: number;
  status: GameStatus;
  winner: Color | null;
  /** Whether it ended in this session (animate + sound) or was already over on load. */
  live: boolean;
}

export interface GameFx {
  bursts: Burst[];
  /** Increments on checkmate: the board frame shakes once per change. */
  shake: number;
  over: GameOverInfo | null;
}

const OVER = new Set<GameStatus>(['checkmate', 'stalemate', 'draw', 'timeout', 'resigned']);

function lastGameOver(state: GameState): GameOverInfo | null {
  if (!OVER.has(state.status)) return null;
  const e = [...state.events].reverse().find((x) => x.type === 'gameOver');
  return { seq: e?.seq ?? state.nextSeq, status: state.status, winner: state.winner, live: false };
}

/**
 * Turns the authoritative event stream into feel: sounds, haptics and short-lived
 * visual effects. Only events that arrive while the page is open play; history loaded
 * on join/refresh is silent.
 */
export function useGameFeedback(state: GameState, meta: TransportMeta, clock: ClockDisplay | null): GameFx {
  const seat = meta.mode === 'online' ? meta.seat : undefined;
  const lastSeq = useRef<number | null>(null);
  const burstId = useRef(0);
  const [bursts, setBursts] = useState<Burst[]>([]);
  const [shake, setShake] = useState(0);
  const [over, setOver] = useState<GameOverInfo | null>(() => lastGameOver(state));

  useEffect(() => {
    // First snapshot (page load / join): remember where we are, play nothing.
    if (lastSeq.current === null || state.nextSeq < lastSeq.current) {
      lastSeq.current = state.nextSeq;
      setOver(lastGameOver(state));
      return;
    }
    const fresh = state.events.filter((e) => e.seq >= (lastSeq.current ?? 0));
    lastSeq.current = state.nextSeq;
    if (!fresh.length) return;

    if (fresh.some((e) => e.type === 'gameStarted')) setOver(null); // rematch / reset

    const moved = fresh.filter((e): e is Extract<GameEvent, { type: 'moved' }> => e.type === 'moved').at(-1);
    const captured = fresh.filter((e): e is Extract<GameEvent, { type: 'captured' }> => e.type === 'captured');
    const checked = fresh.some((e) => e.type === 'check');
    const promoted = fresh.some((e) => e.type === 'promoted');
    const ended = fresh.find((e): e is Extract<GameEvent, { type: 'gameOver' }> => e.type === 'gameOver');

    const usedMod = moved ? modOfMove(moved.move) : null;
    const modTint = usedMod ? modInfo(usedMod)?.shell : undefined;
    if (captured.length || modTint) {
      const add: Burst[] = captured.map((c) => ({ id: ++burstId.current, at: c.at, color: c.piece.color, tint: modTint }));
      if (moved && modTint && !captured.length) add.push({ id: ++burstId.current, at: moved.move.to, color: moved.color, tint: modTint });
      setBursts((b) => [...b, ...add]);
      const ids = new Set(add.map((a) => a.id));
      later(() => setBursts((b) => b.filter((x) => !ids.has(x.id))), 1100);
    }

    if (ended) {
      const info: GameOverInfo = { seq: ended.seq, status: ended.status, winner: ended.winner, live: true };
      setOver(info);
      if (ended.status === 'checkmate') setShake((s) => s + 1);
      // The landing sound of the final move first, then the result.
      if (moved) later(() => playSound(captured.length ? 'capture' : 'move'), LANDING_MS);
      if (ended.status === 'checkmate') later(() => playSound('check'), LANDING_MS + 90);
      const outcome = !ended.winner ? 'draw' : seat ? (ended.winner === seat ? 'win' : 'lose') : 'win';
      later(() => {
        playSound(outcome);
        haptic(outcome);
      }, moved ? 800 : 0); // with the result card
      return;
    }

    if (moved) {
      const theirs = seat != null && moved.color !== seat;
      const castle = moved.move.flags.some((f) => f === 'castleKingside' || f === 'castleQueenside');
      const land: SoundName = captured.length ? 'capture' : castle ? 'castle' : theirs ? 'opponentMove' : 'move';
      if (usedMod) playSound('enhance'); // the charge fires as the piece takes off
      later(() => {
        playSound(land);
        if (promoted) playSound('promote');
        haptic(checked ? 'check' : captured.length ? 'capture' : 'move');
      }, LANDING_MS);
      if (checked) later(() => playSound('check'), LANDING_MS + 90);
    }
  }, [state, seat]);

  // "Game on": both players are at the board and nothing has been played yet.
  const startKey = meta.mode === 'online' && meta.presence?.white.connected && meta.presence?.black.connected && state.ply === 0 && meta.seat
    ? `${meta.roomId}:${state.nextSeq}`
    : null;
  const startedFor = useRef<string | null>(null);
  useEffect(() => {
    if (startKey && startedFor.current !== startKey) {
      startedFor.current = startKey;
      playSound('start');
      haptic('start');
    }
  }, [startKey]);

  // Low-time warning for the side this device plays (both sides in a local game).
  const mine = clock?.running && (seat ? clock.running === seat : seat === undefined) ? clock.running : null;
  const secs = mine && clock ? Math.ceil(clock[mine] / 1000) : null;
  const lastSecs = useRef<number | null>(null);
  useEffect(() => {
    const prev = lastSecs.current;
    lastSecs.current = secs;
    if (secs === null || prev === null || secs >= prev) return;
    if (secs === 10) {
      playSound('lowTime');
      haptic('lowTime');
    } else if (secs <= 5 && secs > 0) {
      playSound('tick');
      haptic('lowTime');
    }
  }, [secs]);

  return { bursts, shake, over };
}
