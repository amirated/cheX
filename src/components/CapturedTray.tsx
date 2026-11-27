import type { PieceLook } from '../render/theme';
import type { Piece } from '../types/game';
import { PieceIcon } from './PieceIcon';

const ORDER = ['pawn', 'knight', 'bishop', 'rook', 'queen'];
const rank = (kind: string) => {
  const i = ORDER.indexOf(kind);
  return i < 0 ? ORDER.length : i;
};

interface Props {
  /** Pieces this side has taken (they belong to the other side). */
  pieces: Piece[];
  /** How the taken pieces are painted (the other side's look). */
  look: PieceLook;
  /** Material lead of this side, shown as "+N" when positive. */
  lead: number;
  /** 'row' runs along the board's top/bottom edge (portrait); 'column' along its side (landscape). */
  direction: 'row' | 'column';
  /** Which end of the tray the pieces gather at (towards the owning player). */
  align: 'start' | 'end';
  label: string;
  iconSize: number;
}

/** One side's captured pieces: grouped by kind, same kinds overlapping, newest pops in. */
export function CapturedTray({ pieces, look, lead, direction, align, label, iconSize }: Props) {
  const groups = new Map<string, Piece[]>();
  for (const p of [...pieces].sort((a, b) => rank(a.kind) - rank(b.kind))) {
    const g = groups.get(p.kind) ?? [];
    g.push(p);
    groups.set(p.kind, g);
  }
  return (
    <div
      className={`captured is-${direction} is-${align}`}
      role="group"
      aria-label={`${label}: ${pieces.length ? pieces.map((p) => p.kind).join(', ') : 'nothing yet'}`}
      style={{ ['--icon' as string]: `${iconSize}px` }}
    >
      {[...groups.entries()].map(([kind, list]) => (
        <span key={kind} className="captured-group">
          {list.map((p) => (
            <span key={p.id} className="captured-piece">
              <PieceIcon kind={p.kind} look={look} size={iconSize} />
            </span>
          ))}
        </span>
      ))}
      {lead > 0 && <span className="captured-lead">+{lead}</span>}
    </div>
  );
}
