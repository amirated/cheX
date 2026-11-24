import { useEffect, useRef, type CSSProperties } from 'react';
import type { GameOverInfo } from '../feedback/useGameFeedback';
import type { Color, GameStatus } from '../types/game';

interface Props {
  info: GameOverInfo;
  /** Online seat; null = spectator; undefined = local game. */
  seat: Color | null | undefined;
  onRematch?: () => void;
  onNewOpponent?: () => void;
  onDismiss: () => void;
}

const TITLE: Record<GameStatus, string> = {
  checkmate: 'Checkmate',
  stalemate: 'Stalemate',
  draw: 'Draw',
  timeout: 'Time out',
  resigned: 'Resigned',
  inProgress: '',
  check: '',
};

const cap = (c: Color) => (c === 'white' ? 'White' : 'Black');

function subtitle(info: GameOverInfo, seat: Color | null | undefined): string {
  const { status, winner } = info;
  if (!winner) {
    if (status === 'stalemate') return 'No legal moves · drawn';
    if (status === 'timeout') return 'Time ran out · no mating material';
    return '50-move rule · drawn';
  }
  const loser = cap(winner === 'white' ? 'black' : 'white');
  if (seat) {
    const won = winner === seat;
    switch (status) {
      case 'resigned':
        return won ? 'Your opponent resigned' : 'You resigned';
      case 'timeout':
        return won ? 'Your opponent ran out of time' : 'You ran out of time';
      default:
        return won ? 'You delivered mate' : 'Your king has fallen';
    }
  }
  if (status === 'resigned') return `${loser} resigned`;
  if (status === 'timeout') return `${loser} ran out of time`;
  return `The ${loser.toLowerCase()} king is mated`;
}

const CONFETTI = 36;

/**
 * Full-board result card: impossible to miss, but one tap ("View board") gets it out
 * of the way to study the final position.
 */
export function GameOverOverlay({ info, seat, onRematch, onNewOpponent, onDismiss }: Props) {
  const outcome: 'win' | 'lose' | 'draw' | 'neutral' = !info.winner
    ? 'draw'
    : seat
      ? info.winner === seat
        ? 'win'
        : 'lose'
      : 'neutral';
  const headline = outcome === 'win' ? 'You win' : outcome === 'lose' ? 'You lose' : outcome === 'draw' ? 'Draw' : `${cap(info.winner!)} wins`;
  const primary = useRef<HTMLButtonElement>(null);
  useEffect(() => primary.current?.focus({ preventScroll: true }), []);

  return (
    <div
      className={`gameover gameover-${outcome}${info.live ? ' is-live' : ''}`}
      role="dialog"
      aria-modal="false"
      aria-label={`${TITLE[info.status]}. ${headline}.`}
    >
      {outcome === 'win' && info.live && (
        <div className="confetti" aria-hidden>
          {Array.from({ length: CONFETTI }, (_, i) => (
            <span
              key={i}
              style={
                {
                  '--x': `${(i * 97) % 100}%`,
                  '--delay': `${((i * 53) % 40) / 100}s`,
                  '--dur': `${1.6 + ((i * 31) % 10) / 10}s`,
                  '--spin': `${(i % 2 ? 1 : -1) * (180 + ((i * 41) % 360))}deg`,
                  '--drift': `${((i * 29) % 60) - 30}px`,
                } as CSSProperties
              }
            />
          ))}
        </div>
      )}
      <div className="gameover-card">
        <span className="gameover-kicker">{TITLE[info.status]}</span>
        <strong className="gameover-title" data-text={headline}>
          {headline}
        </strong>
        <span className="gameover-sub">{subtitle(info, seat)}</span>
        <div className="gameover-actions">
          {onNewOpponent && (
            <button ref={primary} className="reset" type="button" onClick={onNewOpponent}>
              New opponent
            </button>
          )}
          {onRematch && (
            <button ref={onNewOpponent ? undefined : primary} className={onNewOpponent ? 'ghost' : 'reset'} type="button" onClick={onRematch}>
              {seat === undefined ? 'Play again' : 'Rematch'}
            </button>
          )}
          <button className="ghost" type="button" onClick={onDismiss}>
            View board
          </button>
        </div>
      </div>
    </div>
  );
}
