import { useCallback, useEffect, useSyncExternalStore } from 'react';

/**
 * Fullscreen for immersion. Uses the Fullscreen API (with the webkit prefix for Safari
 * on iPad/macOS). iPhone Safari has no element fullscreen: `supported` is false there,
 * and "Add to Home Screen" gives a full-screen app instead (see index.html meta tags).
 * While fullscreen, the screen is kept awake (Wake Lock API, where available).
 */
type FsDocument = Document & {
  webkitFullscreenElement?: Element | null;
  webkitFullscreenEnabled?: boolean;
  webkitExitFullscreen?: () => Promise<void> | void;
};
type FsElement = HTMLElement & { webkitRequestFullscreen?: () => Promise<void> | void };

const doc = document as FsDocument;
const current = () => doc.fullscreenElement ?? doc.webkitFullscreenElement ?? null;
export const fullscreenSupported = !!(doc.fullscreenEnabled || doc.webkitFullscreenEnabled);

const subscribe = (cb: () => void) => {
  document.addEventListener('fullscreenchange', cb);
  document.addEventListener('webkitfullscreenchange', cb);
  return () => {
    document.removeEventListener('fullscreenchange', cb);
    document.removeEventListener('webkitfullscreenchange', cb);
  };
};

export function useFullscreen() {
  const active = useSyncExternalStore(subscribe, () => current() !== null);

  const toggle = useCallback(async () => {
    try {
      if (current()) {
        await (doc.exitFullscreen?.() ?? doc.webkitExitFullscreen?.());
      } else {
        const el = document.documentElement as FsElement;
        await (el.requestFullscreen?.({ navigationUI: 'hide' }) ?? el.webkitRequestFullscreen?.());
      }
    } catch {
      /* the browser refused (e.g. not from a user gesture): nothing to do */
    }
  }, []);

  // Keyboard: F toggles fullscreen (Esc exits natively).
  useEffect(() => {
    if (!fullscreenSupported) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() !== 'f' || e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
      void toggle();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [toggle]);

  // Keep the screen awake while immersed.
  useEffect(() => {
    if (!active || !('wakeLock' in navigator)) return;
    let lock: WakeLockSentinel | null = null;
    let cancelled = false;
    const acquire = () =>
      navigator.wakeLock
        .request('screen')
        .then((l) => {
          if (cancelled) void l.release();
          else lock = l;
        })
        .catch(() => {});
    void acquire();
    // The lock is dropped when the tab is hidden; take it again on return.
    const onVisible = () => {
      if (document.visibilityState === 'visible' && (!lock || lock.released)) void acquire();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisible);
      void lock?.release();
    };
  }, [active]);

  return { active, supported: fullscreenSupported, toggle };
}
