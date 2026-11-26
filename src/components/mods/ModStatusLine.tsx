import { pieceAt } from '../../engine/board';
import { pieceModStatus } from '../../engine/rules/modifiers';
import type { Coord, GameState } from '../../types/game';
import { modInfo } from '../../variants/catalog';

/**
 * One line under the board about the selected piece's mod: how many charges are left and
 * whether it can use one this turn. Works for any piece mod (driven by engine state).
 */
export function ModStatusLine({ state, selected }: { state: GameState; selected: Coord | null }) {
  const piece = selected ? pieceAt(state.board, selected) : null;
  if (!piece) return null;
  const statuses = pieceModStatus(state, piece);
  if (!statuses.length) return null;
  return (
    <div className="mod-status" role="status">
      {statuses.map((st) => {
        const info = modInfo(st.modId);
        if (!info) return null;
        const state_ = st.charges === 0 ? 'spent' : st.cooling ? 'cooling' : 'ready';
        const text =
          state_ === 'spent'
            ? `spent · moves as a normal ${info.piece}`
            : state_ === 'cooling'
              ? 'cooling down · ready next turn'
              : 'ready';
        return (
          <span key={st.modId} className={`mod-status-item is-${state_}`} style={{ ['--shell' as string]: info.shell }}>
            <span className="mod-status-code">{info.code}</span>
            <span className="mod-status-name">{info.ability}</span>
            <span className="mod-status-charges" aria-label={`${st.charges} of ${st.level} charges left`}>
              {Array.from({ length: st.level }, (_, i) => (
                <i key={i} className={i < st.charges ? 'on' : ''} />
              ))}
            </span>
            <span className="mod-status-text">{text}</span>
          </span>
        );
      })}
    </div>
  );
}
