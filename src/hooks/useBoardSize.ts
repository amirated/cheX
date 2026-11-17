import { useLayoutEffect, useState, type RefObject } from 'react';

/** Largest whole-pixel square that fits inside `ref`, tracked with ResizeObserver. Snapped to a multiple of 8 so every tile is an integer size (crisp edges). */
export function useBoardSize(ref: RefObject<HTMLElement | null>, max = 640): number {
  const [size, setSize] = useState(0);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => {
      const s = Math.min(el.clientWidth, el.clientHeight, max);
      setSize(Math.max(8, Math.floor(s / 8) * 8));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref, max]);
  return size;
}
