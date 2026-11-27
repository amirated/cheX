import { useLayoutEffect, useRef, useState } from 'react';
import { MAX_SLOTS, MODS } from '../../variants/catalog';
import { CODEX, LEVELS, RULES } from '../../variants/codex';
import { MAX_LEVEL, playerLevel } from '../../variants/progression';
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
type Tab = 'cartridges' | 'rules' | 'codex';

export function ModLibrary({ loadout, active, editable, onToggle, onClose }: Props) {
  const full = loadout.length >= MAX_SLOTS;
  const [tab, setTab] = useState<Tab>('cartridges');
  const scrollRef = useRef<HTMLDivElement>(null);
  // Each tab opens at its top; only this panel scrolls, the header and tabs stay put.
  useLayoutEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 });
  }, [tab]);
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
      <div className="lib-tabs" role="tablist">
        {(['cartridges', 'rules', 'codex'] as Tab[]).map((t) => (
          <button key={t} type="button" role="tab" aria-selected={tab === t} className={tab === t ? 'is-on' : ''} onClick={() => setTab(t)}>
            {t === 'cartridges' ? 'Cartridges' : t === 'rules' ? 'Rules' : 'Codex'}
          </button>
        ))}
      </div>
      <div className="lib-scroll" ref={scrollRef} role="tabpanel">
      {tab === 'rules' && <RulesTab />}
      {tab === 'codex' && <CodexTab />}
      {tab === 'cartridges' && (
        <>

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
                <span className="lib-levelline">
                  <LevelMeter level={playerLevel(mod.id)} />
                  {playerLevel(mod.id)} {mod.ability.toLowerCase()}
                  {playerLevel(mod.id) === 1 ? '' : 's'} per {mod.piece} · levels {MAX_LEVEL > 1 ? `2–${MAX_LEVEL}` : ''} via progression
                </span>
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
        </>
      )}
      </div>
    </section>
  );
}

function LevelMeter({ level }: { level: number }) {
  return (
    <span className="lib-level" aria-label={`Level ${level} of ${MAX_LEVEL}`}>
      {Array.from({ length: MAX_LEVEL }, (_, i) => (
        <i key={i} className={i < level ? 'on' : ''} />
      ))}
      <b>LV{level}</b>
    </span>
  );
}

function RulesTab() {
  return (
    <div className="lib-doc">
      <table className="lib-levels">
        <thead>
          <tr>
            <th>Level</th>
            <th>Charges per piece</th>
            <th>Cooldown</th>
          </tr>
        </thead>
        <tbody>
          {LEVELS.map((l) => (
            <tr key={l.level}>
              <td>
                <LevelMeter level={l.level} />
              </td>
              <td>{l.charges}</td>
              <td>skip 1 turn</td>
            </tr>
          ))}
        </tbody>
      </table>
      {RULES.map((r) => (
        <section key={r.title}>
          <h4>{r.title}</h4>
          {r.body.map((p) => (
            <p key={p}>{p}</p>
          ))}
        </section>
      ))}
    </div>
  );
}

function CodexTab() {
  return (
    <div className="lib-doc lib-codex">
      {CODEX.map((c) => (
        <article key={c.title}>
          {c.kicker && <span className="codex-kicker">{c.kicker}</span>}
          <h3>{c.title}</h3>
          {c.title === 'Terms' ? (
            <dl className="codex-terms">
              {c.body.map((line) => {
                const [term, def] = line.split(': ');
                return (
                  <div key={term}>
                    <dt>{term}</dt>
                    <dd>{def}</dd>
                  </div>
                );
              })}
            </dl>
          ) : (
            c.body.map((p) => <p key={p}>{p}</p>)
          )}
        </article>
      ))}
    </div>
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
