import { useSyncExternalStore } from 'react';

export type LayoutMode = 'portrait' | 'landscape';

/**
 * Landscape (board left, side panel right) when the viewport is clearly wider than tall
 * and wide enough for both; portrait (everything stacked) otherwise — phones held
 * upright, narrow windows, tablets in portrait.
 */
const QUERY = '(min-aspect-ratio: 5/4) and (min-width: 700px)';

const subscribe = (cb: () => void) => {
  const mq = matchMedia(QUERY);
  mq.addEventListener('change', cb);
  return () => mq.removeEventListener('change', cb);
};

export function useLayoutMode(): LayoutMode {
  return useSyncExternalStore(subscribe, () => (matchMedia(QUERY).matches ? 'landscape' : 'portrait'));
}
