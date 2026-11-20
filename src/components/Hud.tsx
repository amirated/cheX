import { useEffect, useState } from 'react';
import type { Color, GameStatus } from '../types/game';

const STATUS_LABEL: Record<GameStatus, string> = {
  inProgress: 'In Progress',
  check: 'Check',
  checkmate: 'Checkmate',
  stalemate: 'Stalemate',
  draw: 'Draw',
  timeout: 'Time out',
  resigned: 'Resigned',
};

const OVER: ReadonlySet<GameStatus> = new Set(['checkmate', 'stalemate', 'draw', 'timeout', 'resigned']);

const cap = (c: Color) => (c === 'white' ? 'White' : 'Black');

interface Props {
  turn: Color;
  status: GameStatus;
  winner: Color | null;
  moveNumber: number;
  onReset: () => void;
  onResign?: () => void;
  /** Online only: the colour this client plays; null = spectating. undefined = local game. */
  seat?: Color | null;
}

function headline(over: boolean, turn: Color, winner: Color | null, seat: Color | null | undefined): string {
  if (over) {
    if (!winner) return 'Game drawn';
    if (seat) return winner === seat ? 'You win' : 'You lose';
    return `${cap(winner)} wins`;
  }
  if (seat === undefined) return `${cap(turn)} to move`;
  if (seat === null) return `${cap(turn)} to move · watching`;
  return turn === seat ? 'Your move' : "Opponent's move";
}

/** How the game ended, in words. The loser is the side that isn't the winner. */
function reason(status: GameStatus, winner: Color | null, turn: Color): string {
  const loser = winner ? cap(winner === 'white' ? 'black' : 'white') : null;
  switch (status) {
    case 'checkmate':
      return 'by checkmate';
    case 'resigned':
      return `${loser} resigned`;
    case 'timeout':
      // winner null = the side with time left had no way to checkmate
      return loser ? `${loser} ran out of time` : `${cap(turn)} ran out of time · no mating material`;
    case 'stalemate':
      return 'by stalemate';
    case 'draw':
      return '50-move rule';
    default:
      return '';
  }
}

export function Hud({ turn, status, winner, moveNumber, onReset, onResign, seat }: Props) {
  const over = OVER.has(status);
  const [confirming, setConfirming] = useState(false);

  // A pending "Resign?" confirmation expires on its own, and never survives the game ending.
  useEffect(() => {
    if (!confirming) return;
    const id = window.setTimeout(() => setConfirming(false), 3000);
    return () => window.clearTimeout(id);
  }, [confirming]);
  useEffect(() => setConfirming(false), [over]);

  const canResign = !!seat && !over && !!onResign;

  return (
    <header className="hud">
      <div className="hud-turn" aria-live="polite">
        <span className={`swatch swatch-${over && winner ? winner : turn}`} />
        <div className="hud-text">
          <strong>{headline(over, turn, winner, seat)}</strong>
          <span className="hud-sub">{over ? reason(status, winner, turn) : `Move ${moveNumber}`}</span>
        </div>
      </div>
      <span className={`status status-${status}`}>{STATUS_LABEL[status]}</span>
      {(seat === undefined || (seat !== null && over)) && (
        <button className="reset" onClick={onReset} type="button">
          {seat === undefined ? 'Reset Board' : 'Rematch'}
        </button>
      )}
      {canResign && (
        <button
          className={confirming ? 'reset danger' : 'ghost'}
          type="button"
          onClick={() => {
            if (confirming) {
              setConfirming(false);
              onResign();
            } else setConfirming(true);
          }}
        >
          {confirming ? 'Confirm?' : 'Resign'}
        </button>
      )}
    </header>
  );
}
