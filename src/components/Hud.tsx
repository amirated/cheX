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

export function Hud({ turn, status, winner, moveNumber, onReset, seat }: Props) {
  const over = status === 'checkmate' || status === 'stalemate' || status === 'draw';
  return (
    <header className="hud">
      <div className="hud-turn" aria-live="polite">
        <span className={`swatch swatch-${over && winner ? winner : turn}`} />
        <div className="hud-text">
          <strong>{headline(over, turn, winner, seat)}</strong>
          <span className="hud-sub">Move {moveNumber}</span>
        </div>
      </div>
      <span className={`status status-${status}`}>{STATUS_LABEL[status]}</span>
      {(seat === undefined || (seat !== null && over)) && (
        <button className="reset" onClick={onReset} type="button">
          {seat === undefined ? 'Reset Board' : 'Rematch'}
        </button>
      )}
    </header>
  );
}
