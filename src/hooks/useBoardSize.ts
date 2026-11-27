import { useLayoutEffect, useState, type RefObject } from 'react';

/**
 * Largest whole-pixel square that fits inside `ref` after reserving room for things that
 * share its box (the mod bay: above the board in portrait, beside it in landscape).
 * Tracked with ResizeObserver; snapped to a multiple of 8 so every tile is a whole pixel.
 * `layoutKey` re-attaches the observer when the layout swaps the measured element.
 */
export function useBoardSize(
  ref: RefObject<HTMLElement | null>,
  reserve: { x?: number; y?: number } = {},
  layoutKey = '',
): number {
  const [size, setSize] = useState(0);
  const rx = reserve.x ?? 0;
  const ry = reserve.y ?? 0;
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => {
      const s = Math.min(el.clientWidth - rx, el.clientHeight - ry);
      setSize(Math.max(8, Math.floor(s / 8) * 8));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref, rx, ry, layoutKey]);
  return size;
}
