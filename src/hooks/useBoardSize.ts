import { useLayoutEffect, useState, type RefObject } from 'react';

/**
 * Largest whole-pixel square that fits inside `ref`, tracked with ResizeObserver.
 * Snapped to a multiple of 8 so every tile is an integer size (crisp edges).
 * `reserveY` keeps room for things stacked with the board (e.g. player bars).
 */
export function useBoardSize(ref: RefObject<HTMLElement | null>, max = 640, reserveY = 0): number {
  const [size, setSize] = useState(0);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => {
      const s = Math.min(el.clientWidth, el.clientHeight - reserveY, max);
      setSize(Math.max(8, Math.floor(s / 8) * 8));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref, max, reserveY]);
  return size;
}
