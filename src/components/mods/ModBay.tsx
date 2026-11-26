import { MAX_SLOTS, modInfo } from '../../variants/catalog';
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
}

/**
 * The console's cartridge bay, mounted on the board's top edge. One slot per mod;
 * a combo game simply shows several cartridges side by side.
 */
export function ModBay({ mods, editable, onOpenLibrary, onEject, fresh }: Props) {
  const slots = Array.from({ length: MAX_SLOTS }, (_, i) => mods[i] ?? null);
  const loaded = mods.length;
  return (
    <div
      className={`mod-bay${loaded ? ' is-powered' : ''}`}
      aria-label="Mod bay"
      style={{ ['--mod-color' as string]: modInfo(mods[0] ?? '')?.shell ?? 'var(--accent)' }}
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
        {slots.map((id, i) => {
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
                <BayCartridge mod={mod} />
                <span className="bay-port" />
              </button>
            );
          }
          return (
            <button
              key={`empty-${i}`}
              type="button"
              className="bay-slot is-empty"
              disabled={!editable}
              onClick={onOpenLibrary}
              aria-label={editable ? 'Empty slot: open the mod library' : 'Empty slot'}
            >
              <span className="bay-empty-label">{editable ? '+ MOD' : `SLOT ${i + 1}`}</span>
              <span className="bay-port" />
            </button>
          );
        })}
      </div>
    </div>
  );
}
