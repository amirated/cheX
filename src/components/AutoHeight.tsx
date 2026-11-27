import { useLayoutEffect, useRef, type ReactNode } from 'react';

/**
 * Animates its own height whenever its content grows or shrinks (e.g. the online bar
 * opening into the time-control picker). Content is never clipped at rest: overflow is
 * hidden only while the animation runs, so shadows and focus rings stay intact.
 */
export function AutoHeight({ children, className, duration = 280 }: { children: ReactNode; className?: string; duration?: number }) {
  const outer = useRef<HTMLDivElement>(null);
  const inner = useRef<HTMLDivElement>(null);
  const last = useRef<number | null>(null);

  useLayoutEffect(() => {
    const o = outer.current;
    const i = inner.current;
    if (!o || !i) return;
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const ro = new ResizeObserver(() => {
      const next = i.offsetHeight;
      const prev = last.current;
      last.current = next;
      if (prev === null || prev === next || reduced) return;
      o.getAnimations().forEach((a) => a.cancel());
      o.style.overflow = 'hidden';
      const anim = o.animate([{ height: `${prev}px` }, { height: `${next}px` }], {
        duration,
        easing: 'cubic-bezier(.2, .8, .2, 1)',
      });
      anim.onfinish = anim.oncancel = () => {
        if (!o.getAnimations().length) o.style.overflow = '';
      };
    });
    ro.observe(i);
    return () => ro.disconnect();
  }, [duration]);

  return (
    <div ref={outer} className={className}>
      <div ref={inner}>{children}</div>
    </div>
  );
}
