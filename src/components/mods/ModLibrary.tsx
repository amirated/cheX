import { MAX_SLOTS, MODS } from '../../variants/catalog';
import { Cartridge } from './Cartridge';
import { MoveDiagram } from './MoveDiagram';

interface Props {
  /** Mods in this device's bay. */
  loadout: string[];
  /** Mods of the game on screen (online rooms are fixed). */
  active: string[];
  /** False in an online room: the bay is locked to the room's rules. */
  editable: boolean;
  onToggle: (id: string) => void;
  onClose: () => void;
}

/** The mod library: every cartridge with its rules, a move diagram and lab notes. */
export function ModLibrary({ loadout, active, editable, onToggle, onClose }: Props) {
  const full = loadout.length >= MAX_SLOTS;
  return (
    <section className="mod-library" aria-label="Mod library">
      <header className="lib-head">
        <div>
          <strong>Mod library</strong>
          <span>
            Plug cartridges into the bay to change the rules. Unplug them all for classic chess.
            {!editable && ' This online game has its rules locked; changes apply to your next game.'}
          </span>
        </div>
        <button className="ghost" type="button" onClick={onClose}>
          Done
        </button>
      </header>

      {MODS.map((mod) => {
        const inBay = loadout.includes(mod.id);
        const inGame = active.includes(mod.id);
        return (
          <article key={mod.id} className={`lib-card${inBay ? ' is-in-bay' : ''}`} style={{ ['--shell' as string]: mod.shell }}>
            <div className="lib-top">
              <Cartridge mod={mod} plugged={inBay} className="lib-cart" />
              <div className="lib-title">
                <span className="lib-code">
                  {mod.code}
                  <em className={`lib-badge lib-${mod.status}`}>{mod.status}</em>
                  {inGame && <em className="lib-badge lib-live">in this game</em>}
                </span>
                <h3>{mod.name}</h3>
                <p className="lib-tagline">{mod.tagline}</p>
                <button
                  type="button"
                  className={inBay ? 'ghost' : 'reset'}
                  disabled={!inBay && full}
                  onClick={() => onToggle(mod.id)}
                >
                  {inBay ? 'Eject' : full ? 'Bay full' : 'Plug in'}
                </button>
              </div>
            </div>
            <p className="lib-desc">{mod.description}</p>
            <div className="lib-body">
              <figure className="lib-figure">
                <MoveDiagram mod={mod} />
                <figcaption>
                  <span className="md-key md-key-base" /> classic move
                  <span className="md-key md-key-added" /> added by mod
                </figcaption>
              </figure>
              <div>
                <h4>Rules</h4>
                <ul className="lib-rules">
                  {mod.rules.map((r) => (
                    <li key={r}>{r}</li>
                  ))}
                </ul>
              </div>
            </div>
            {mod.lab && (
              <div className="lib-lab">
                <h4>Lab notes · 1,000 engine games</h4>
                <dl>
                  {mod.lab.map((l) => (
                    <div key={l.label}>
                      <dt>{l.label}</dt>
                      <dd>{l.value}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            )}
          </article>
        );
      })}

      <p className="lib-more">More cartridges are in the lab. Combos: plug up to {MAX_SLOTS} at once.</p>
    </section>
  );
}

/** Header button for the library: a tiny cartridge glyph. */
export function ModsButton({ open, count, onClick }: { open: boolean; count: number; onClick: () => void }) {
  return (
    <button
      type="button"
      className={`icon-btn mods-btn${open ? ' is-on' : ''}`}
      aria-label="Mod library"
      aria-expanded={open}
      onClick={onClick}
    >
      <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden>
        <path d="M4 2h9l2 2v9H3V3z" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
        <rect x="5.5" y="5.5" width="7" height="4.5" fill="currentColor" opacity=".55" />
        <path d="M5 13v3M7.6 13v3M10.2 13v3M12.8 13v3" stroke="currentColor" strokeWidth="1.4" />
      </svg>
      {count > 0 && <span className="mods-count">{count}</span>}
    </button>
  );
}
