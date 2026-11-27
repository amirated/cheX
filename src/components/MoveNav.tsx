import type { Review } from '../hooks/useReview';

const Icon = ({ d }: { d: string }) => (
  <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
    <path d={d} fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
const FIRST = 'M17 6l-6 6 6 6M7 6v12';
const BACK = 'M15 6l-6 6 6 6';
const FORWARD = 'M9 6l6 6-6 6';
const LAST = 'M7 6l6 6-6 6M17 6v12';

/** ⏮ ◀ … ▶ ⏭ — step through the game's positions. `children` sits between the arrows. */
export function MoveNav({ review, children }: { review: Review; children?: React.ReactNode }) {
  return (
    <div className={`move-nav${review.reviewing ? ' is-reviewing' : ''}`}>
      <button type="button" className="nav-btn" aria-label="First position" disabled={!review.canBack} onClick={() => review.go(0)}>
        <Icon d={FIRST} />
      </button>
      <button type="button" className="nav-btn" aria-label="Previous move" disabled={!review.canBack} onClick={() => review.step(-1)}>
        <Icon d={BACK} />
      </button>
      <div className="move-nav-mid">{children}</div>
      <button type="button" className="nav-btn" aria-label="Next move" disabled={!review.canForward} onClick={() => review.step(1)}>
        <Icon d={FORWARD} />
      </button>
      <button
        type="button"
        className={`nav-btn${review.reviewing ? ' is-live-cta' : ''}`}
        aria-label="Back to the live position"
        disabled={!review.canForward}
        onClick={() => review.go(review.live)}
      >
        <Icon d={LAST} />
      </button>
    </div>
  );
}
