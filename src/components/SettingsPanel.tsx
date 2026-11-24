import { haptic } from '../feedback/haptics';
import { playSound, unlockAudio } from '../feedback/sound';
import { setPreferences, usePreferences, type Preferences } from '../prefs/preferences';
import { THEMES, type PieceStyle, type ThemeId } from '../render/theme';

const hex = (n: number) => `#${n.toString(16).padStart(6, '0')}`;

/** Tiny vector preview of a theme: 2×2 tiles plus one piece of each side. */
function ThemeSwatch({ id, style }: { id: ThemeId; style: PieceStyle }) {
  const t = THEMES[id];
  const w = t.pieces[style].white;
  const b = t.pieces[style].black;
  const grid = t.board.grid;
  return (
    <svg width="44" height="44" viewBox="0 0 44 44" aria-hidden>
      <rect x="0" y="0" width="22" height="22" fill={hex(t.board.light)} />
      <rect x="22" y="0" width="22" height="22" fill={hex(t.board.dark)} />
      <rect x="0" y="22" width="22" height="22" fill={hex(t.board.dark)} />
      <rect x="22" y="22" width="22" height="22" fill={hex(t.board.light)} />
      {grid && (
        <path d="M22 0V44M0 22H44" stroke={hex(grid.color)} strokeOpacity={grid.alpha * 1.6} strokeWidth="1" />
      )}
      <circle cx="11" cy="33" r="6.5" fill={hex(w.fill)} fillOpacity={w.fillAlpha} stroke={hex(w.stroke)} strokeWidth="2" />
      <circle cx="33" cy="11" r="6.5" fill={hex(b.fill)} fillOpacity={b.fillAlpha} stroke={hex(b.stroke)} strokeWidth="2" />
    </svg>
  );
}

/** Inline (no modal) display settings: theme and piece style. Applied instantly, saved per device. */
export function SettingsPanel({ onClose }: { onClose: () => void }) {
  const prefs = usePreferences();

  return (
    <section className="settings" aria-label="Display settings">
      <div className="settings-group" role="radiogroup" aria-label="Theme">
        <span className="settings-label">Theme</span>
        <div className="settings-options">
          {(Object.keys(THEMES) as ThemeId[]).map((id) => (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={prefs.theme === id}
              className={`settings-option${prefs.theme === id ? ' is-on' : ''}`}
              onClick={() => setPreferences({ theme: id })}
            >
              <ThemeSwatch id={id} style={prefs.pieceStyle} />
              <span>{THEMES[id].name}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="settings-group" role="radiogroup" aria-label="Pieces">
        <span className="settings-label">Pieces</span>
        <div className="settings-segment">
          {(['filled', 'outline'] as PieceStyle[]).map((s) => (
            <button
              key={s}
              type="button"
              role="radio"
              aria-checked={prefs.pieceStyle === s}
              className={prefs.pieceStyle === s ? 'is-on' : ''}
              onClick={() => setPreferences({ pieceStyle: s })}
            >
              <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden>
                <circle
                  cx="7"
                  cy="7"
                  r="5"
                  fill={s === 'filled' ? 'currentColor' : 'none'}
                  stroke="currentColor"
                  strokeWidth="1.8"
                />
              </svg>
              {s === 'filled' ? 'Filled' : 'Outline'}
            </button>
          ))}
        </div>
      </div>

      <div className="settings-group settings-toggles">
        <Toggle label="Sound" k="sound" on={prefs.sound} preview={() => playSound('capture')} />
        <Toggle label="Haptics" k="haptics" on={prefs.haptics} preview={() => haptic('capture')} />
      </div>

      <div className="settings-footer">
        <button type="button" className="ghost" onClick={onClose}>
          Done
        </button>
      </div>
    </section>
  );
}

function Toggle({ label, k, on, preview }: { label: string; k: keyof Pick<Preferences, 'sound' | 'haptics'>; on: boolean; preview: () => void }) {
  return (
    <div className="settings-toggle">
      <span className="settings-label">{label}</span>
      <div className="settings-segment" role="radiogroup" aria-label={label}>
        {[true, false].map((v) => (
          <button
            key={String(v)}
            type="button"
            role="radio"
            aria-checked={on === v}
            className={on === v ? 'is-on' : ''}
            onClick={() => {
              setPreferences({ [k]: v });
              if (v) {
                unlockAudio();
                preview(); // a sample, so the switch is felt/heard immediately
              }
            }}
          >
            {v ? 'On' : 'Off'}
          </button>
        ))}
      </div>
    </div>
  );
}

/** Header button that opens the settings panel (a sliders icon drawn inline, no assets). */
export function SettingsButton({ open, onClick }: { open: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      className={`icon-btn${open ? ' is-on' : ''}`}
      aria-label="Display settings"
      aria-expanded={open}
      onClick={onClick}
    >
      <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden>
        <path d="M3 5h12M3 13h12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        <circle cx="7" cy="5" r="2.2" fill="var(--panel)" stroke="currentColor" strokeWidth="1.6" />
        <circle cx="11" cy="13" r="2.2" fill="var(--panel)" stroke="currentColor" strokeWidth="1.6" />
      </svg>
    </button>
  );
}
