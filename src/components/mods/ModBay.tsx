import type { CSSProperties, ReactNode } from 'react';
import { MAX_SLOTS, MODS, SLOT_PIECES, modInfo, slotMod } from '../../variants/catalog';
import { PieceIcon } from '../PieceIcon';
import type { PieceLook } from '../../render/theme';
import { BayCartridge } from './Cartridge';

interface Props {
  /** Mod ids seated in the bay, in slot order. */
  mods: string[];
  /** Local game: slots can be filled/emptied. Online: locked to the room's rules. */
  editable: boolean;
  onOpenLibrary: () => void;
  onEject: (id: string) => void;
  /** Mod id that was just inserted (plays the insert animation once). */
  fresh: string | null;
  /** Level each mod runs at in this game. */
  levels: Record<string, number>;
  /** Mounted on the board's left edge (landscape) instead of its top edge (portrait). */
  vertical?: boolean;
  /** Board edge length in px (the bay spans it). */
  length: number;
}

/** Depth of the bay (px) across the board edge it is mounted on. Keep in sync with CSS. */
export const BAY_DEPTH = 72;
const RAIL = 14;
const GAP = 6;
const PAD = 6;

/** Muted outline used for the piece badge on each slot. */
const SLOT_LOOK: PieceLook = { fill: 0x2a2d3a, fillAlpha: 1, stroke: 0x8a8fa3, accent: 0x8a8fa3, rim: null, glowAlpha: 0 };

/**
 * The console's cartridge bay, mounted on the board's edge. One slot per enhanceable piece
 * (knight, rook, bishop, pawn); a combo game shows several cartridges side by side. In
 * landscape the bay runs down the board's left edge and the cartridges turn to face the board.
 */
export function ModBay({ mods, editable, onOpenLibrary, onEject, fresh, levels, vertical = false, length }: Props) {
  const slots = SLOT_PIECES.map((piece) => ({ piece, id: slotMod(mods, piece) ?? null }));
  const loaded = mods.length;
  // In vertical mode each slot's contents are laid out horizontally, then rotated.
  const slotLen = (length - PAD * 2 - GAP * (MAX_SLOTS - 1)) / MAX_SLOTS;
  const inner: CSSProperties | undefined = vertical ? { width: slotLen, height: BAY_DEPTH - RAIL - PAD } : undefined;
  const wrap = (content: ReactNode) => (
    <span className="bay-slot-inner" style={inner}>
      {content}
    </span>
  );

  return (
    <div
      className={`mod-bay${loaded ? ' is-powered' : ''}${vertical ? ' is-vertical' : ''}`}
      aria-label="Mod bay"
      style={{
        ['--mod-color' as string]: modInfo(mods[0] ?? '')?.shell ?? 'var(--accent)',
        ['--slots' as string]: MAX_SLOTS,
        ...(vertical ? { height: length } : {}),
      }}
    >
      <div className="bay-rail">
        <span className="bay-title">MOD BAY</span>
        <span className="bay-status">
          <span className="bay-led" />
          {loaded ? `${loaded} LOADED` : 'CLASSIC'}
        </span>
        {!editable && (
          <span className="bay-lock" title="Rules are fixed for this game">
            <svg width="10" height="12" viewBox="0 0 10 12" aria-hidden>
              <rect x="1" y="5" width="8" height="6.5" rx="1" fill="currentColor" />
              <path d="M3 5V3.5a2 2 0 0 1 4 0V5" fill="none" stroke="currentColor" strokeWidth="1.4" />
            </svg>
            LOCKED
          </span>
        )}
      </div>
      <div className="bay-slots">
        {slots.map(({ piece, id }) => {
          const mod = id ? modInfo(id) : undefined;
          if (mod) {
            return (
              <button
                key={id}
                type="button"
                className={`bay-slot is-loaded${fresh === id ? ' is-fresh' : ''}`}
                disabled={!editable}
                onClick={() => onEject(mod.id)}
                aria-label={editable ? `Eject ${mod.name}` : `${mod.name} is active`}
                title={editable ? `Eject ${mod.name}` : mod.name}
              >
                {wrap(
                  <>
                    <BayCartridge mod={mod} level={levels[mod.id] ?? 1} />
                    <span className="bay-port" />
                  </>,
                )}
              </button>
            );
          }
          // Empty slot: the piece it takes, and whether any cartridge exists for it yet.
          const inLab = !MODS.some((m) => m.piece === piece);
          return (
            <button
              key={`empty-${piece}`}
              type="button"
              className={`bay-slot is-empty${inLab ? ' is-lab' : ''}`}
              disabled={!editable}
              onClick={onOpenLibrary}
              aria-label={
                inLab ? `${piece} slot: no cartridge yet` : editable ? `Empty ${piece} slot: open the mod library` : `Empty ${piece} slot`
              }
            >
              {wrap(
                <>
                  <span className="bay-empty-label">
                    <PieceIcon kind={piece} look={SLOT_LOOK} size={18} />
                    <span>
                      {piece.toUpperCase()}
                      <small>{inLab ? 'IN LAB' : editable ? '+ MOD' : 'EMPTY'}</small>
                    </span>
                  </span>
                  <span className="bay-port" />
                </>,
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
