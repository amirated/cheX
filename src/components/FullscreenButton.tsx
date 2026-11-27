import { useFullscreen } from '../hooks/useFullscreen';

/** Header button: enter/leave fullscreen (hidden where the browser can't do it). */
export function FullscreenButton() {
  const { active, supported, toggle } = useFullscreen();
  if (!supported) return null;
  return (
    <button
      type="button"
      className={`icon-btn${active ? ' is-on' : ''}`}
      aria-label={active ? 'Exit fullscreen (F)' : 'Fullscreen (F)'}
      aria-pressed={active}
      title={active ? 'Exit fullscreen (F)' : 'Fullscreen (F)'}
      onClick={() => void toggle()}
    >
      <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
        {active ? (
          <path d="M7 2v5H2M11 2v5h5M7 16v-5H2M11 16v-5h5" />
        ) : (
          <path d="M2 7V2h5M16 7V2h-5M2 11v5h5M16 11v5h-5" />
        )}
      </svg>
    </button>
  );
}
