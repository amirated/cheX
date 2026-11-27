import { useCallback, useEffect, useMemo, useState } from 'react';
import { replayGame, type Captures } from '../engine/replay';
import { haptic } from '../feedback/haptics';
import { playSound } from '../feedback/sound';
import type { BoardState, GameState } from '../types/game';

export interface Review {
  /** Ply on screen: 0 = start position … live = the current one. */
  ply: number;
  live: number;
  /** True while looking at an earlier position. */
  reviewing: boolean;
  board: BoardState;
  captures: Captures;
  /** The move that led to the position on screen (for the last-move highlight). */
  lastMove: GameState['history'][number] | null;
  canBack: boolean;
  canForward: boolean;
  go: (ply: number) => void;
  step: (delta: number) => void;
  toLive: () => void;
}

/**
 * Back/forward through the game. The position on screen is rebuilt from the move history;
 * any new ply (a move by either side, a reset) snaps the view back to the live game.
 */
export function useReview(state: GameState): Review {
  const replay = useMemo(() => replayGame(state), [state]);
  const live = state.history.length;
  // A reviewed ply is pinned to the game length it was chosen at: the moment a new ply lands
  // (the opponent moved, a reset…) it no longer applies and the live position shows, in the
  // same render — no flash of the old position.
  const [pinned, setPinned] = useState<{ ply: number; at: number } | null>(null);
  const view = pinned && pinned.at === live ? pinned.ply : null;
  const setView = useCallback((ply: number | null) => setPinned(ply === null ? null : { ply, at: live }), [live]);

  const ply = replay.ok && view !== null ? Math.min(view, live) : live;
  const reviewing = ply < live;

  const go = useCallback(
    (target: number) => {
      if (!replay.ok) return;
      const next = Math.max(0, Math.min(live, target));
      const from = view ?? live;
      if (next === from) return;
      setView(next === live ? null : next);
      // Feel: stepping onto a capture clacks, anything else ticks.
      const forward = next > from;
      const took = (k: number) => replay.captures[k].white.length + replay.captures[k].black.length;
      playSound(forward && took(next) > took(next - 1) ? 'capture' : 'move');
      haptic('select');
    },
    [replay, live, view, setView],
  );

  const step = useCallback((delta: number) => go((view ?? live) + delta), [go, view, live]);
  const toLive = useCallback(() => setView(null), [setView]);

  // ← / → step, Home / End jump. Ignored while typing.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === 'ArrowLeft') step(-1);
      else if (e.key === 'ArrowRight') step(1);
      else if (e.key === 'Home') go(0);
      else if (e.key === 'End') go(live);
      else return;
      e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [step, go, live]);

  return {
    ply,
    live,
    reviewing,
    board: reviewing ? replay.boards[ply] : state.board,
    captures: replay.captures[ply] ?? replay.captures[replay.captures.length - 1],
    lastMove: ply > 0 ? state.history[ply - 1] : null,
    canBack: replay.ok && ply > 0,
    canForward: replay.ok && reviewing,
    go,
    step,
    toLive,
  };
}
