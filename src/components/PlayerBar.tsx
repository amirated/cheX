import { formatClock, thresholds, type TimeControl } from '../types/clock';
import type { Color } from '../types/game';

interface Props {
  color: Color;
  /** "You", "Opponent", or the colour name for spectators. */
  name: string;
  /** null = seat empty / unknown; undefined = don't show presence. */
  connected?: boolean | null;
  /** It's this side's turn (highlighted even in untimed games). */
  toMove: boolean;
  clock: { remainingMs: number; running: boolean; flagged: boolean; timeControl: TimeControl } | null;
}

/** One player's identity and clock, shown above (opponent) or below (you) the board. */
export function PlayerBar({ color, name, connected, toMove, clock }: Props) {
  let level = '';
  if (clock) {
    const { lowMs, criticalMs } = thresholds(clock.timeControl);
    if (clock.flagged) level = 'flagged';
    else if (clock.remainingMs <= criticalMs) level = 'critical';
    else if (clock.remainingMs <= lowMs) level = 'low';
  }
  const active = clock ? clock.running : toMove;

  return (
    <div className={`player-bar${active ? ' is-active' : ''}`} data-color={color}>
      <span className={`swatch swatch-${color}`} aria-hidden />
      <span className="player-name">
        {name}
        {connected === false && <span className="player-status"> · offline</span>}
        {connected === null && <span className="player-status"> · waiting</span>}
      </span>
      {clock && (
        <span
          className={`clock${clock.running ? ' clock-running' : ''}${level ? ` clock-${level}` : ''}`}
          role="timer"
          aria-label={`${name} clock`}
        >
          {clock.flagged ? 'Time out' : formatClock(clock.remainingMs)}
        </span>
      )}
    </div>
  );
}
