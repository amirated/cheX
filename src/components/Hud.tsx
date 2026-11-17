import type { Color, GameStatus } from '../types/game';

const STATUS_LABEL: Record<GameStatus, string> = {
  inProgress: 'In Progress',
  check: 'Check',
  checkmate: 'Checkmate',
  stalemate: 'Stalemate',
  draw: 'Draw',
};

const cap = (c: Color) => (c === 'white' ? 'White' : 'Black');

interface Props {
  turn: Color;
  status: GameStatus;
  winner: Color | null;
  moveNumber: number;
  onReset: () => void;
}

export function Hud({ turn, status, winner, moveNumber, onReset }: Props) {
  const over = status === 'checkmate' || status === 'stalemate' || status === 'draw';
  return (
    <header className="hud">
      <div className="hud-turn" aria-live="polite">
        <span className={`swatch swatch-${over && winner ? winner : turn}`} />
        <div className="hud-text">
          <strong>{over ? (winner ? `${cap(winner)} wins` : 'Game drawn') : `${cap(turn)} to move`}</strong>
          <span className="hud-sub">Move {moveNumber}</span>
        </div>
      </div>
      <span className={`status status-${status}`}>{STATUS_LABEL[status]}</span>
      <button className="reset" onClick={onReset} type="button">
        Reset Board
      </button>
    </header>
  );
}
