import { useState } from 'react';
import { LIMITS, PRESETS, type TimeControl } from '../types/clock';

interface Props {
  busy: boolean;
  onPick: (tc: TimeControl | null) => void;
  onCancel: () => void;
}

/** Inline (no modal) time-control chooser shown when creating an online game. */
export function TimeControlPicker({ busy, onPick, onCancel }: Props) {
  const [custom, setCustom] = useState(false);
  const [minutes, setMinutes] = useState('5');
  const [increment, setIncrement] = useState('0');

  const m = Number(minutes);
  const inc = Number(increment);
  const customValid =
    Number.isFinite(m) && m >= LIMITS.minMinutes && m <= LIMITS.maxMinutes &&
    Number.isInteger(inc) && inc >= 0 && inc <= LIMITS.maxIncrementSec;

  return (
    <div className="tc-picker" role="group" aria-label="Choose a time control">
      <div className="tc-grid">
        {PRESETS.map((p, i) => (
          <button
            key={p.label}
            type="button"
            className="tc-option"
            style={{ ['--i' as string]: i }}
            disabled={busy}
            onClick={() => onPick(p.tc)}
          >
            <strong>{p.label}</strong>
            <span>{p.family}</span>
          </button>
        ))}
      </div>

      {custom ? (
        <form
          className="tc-custom is-swap"
          onSubmit={(e) => {
            e.preventDefault();
            if (customValid) onPick({ initialMs: Math.round(m * 60_000), incrementMs: inc * 1000 });
          }}
        >
          <label>
            Minutes
            <input
              type="number"
              inputMode="decimal"
              min={LIMITS.minMinutes}
              max={LIMITS.maxMinutes}
              step="0.5"
              value={minutes}
              onChange={(e) => setMinutes(e.target.value)}
            />
          </label>
          <label>
            Increment (s)
            <input
              type="number"
              inputMode="numeric"
              min={0}
              max={LIMITS.maxIncrementSec}
              step="1"
              value={increment}
              onChange={(e) => setIncrement(e.target.value)}
            />
          </label>
          <button type="submit" className="reset" disabled={busy || !customValid}>
            Create
          </button>
        </form>
      ) : null}

      <div className="tc-footer">
        <button type="button" className="ghost" onClick={() => setCustom((c) => !c)} disabled={busy}>
          {custom ? 'Hide custom' : 'Custom…'}
        </button>
        <button type="button" className="ghost" onClick={() => onPick(null)} disabled={busy}>
          No clock
        </button>
        <button type="button" className="ghost" onClick={onCancel} disabled={busy}>
          Cancel
        </button>
      </div>
    </div>
  );
}
