import { useEffect, useState, useSyncExternalStore } from 'react';
import type { GameTransport } from '../net/transport';
import { remainingAt, type ClockView, type TimeControl } from '../types/clock';
import type { Color } from '../types/game';

export interface ClockDisplay {
  timeControl: TimeControl;
  white: number;
  black: number;
  running: Color | null;
  flagged: Color | null;
}

/**
 * Locally rendered countdown from the latest authoritative snapshot.
 * Re-renders ~10×/s only while a clock is running (enough for the tenths shown
 * under 10 s); nothing is sent over the network per tick.
 */
export function useClock(transport: GameTransport): ClockDisplay | null {
  const view: ClockView | null = useSyncExternalStore(transport.subscribeClock, transport.getClock);
  const [now, setNow] = useState(() => performance.now());

  useEffect(() => {
    setNow(performance.now());
    if (!view?.running) return;
    const id = window.setInterval(() => setNow(performance.now()), 100);
    // Background tabs throttle timers; repaint immediately on return.
    const onVisible = () => document.visibilityState === 'visible' && setNow(performance.now());
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [view]);

  if (!view) return null;
  return {
    timeControl: view.timeControl,
    white: remainingAt(view, 'white', now),
    black: remainingAt(view, 'black', now),
    running: view.running,
    flagged: view.flagged,
  };
}
