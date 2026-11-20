import { useSyncExternalStore } from 'react';
import { DEFAULT_PIECE_STYLE, DEFAULT_THEME, THEMES, type PieceStyle, type ThemeId } from '../render/theme';

/**
 * Per-device display preferences. Purely cosmetic and local: they never touch
 * game state or the server, so each player sees their own look.
 */
export interface Preferences {
  theme: ThemeId;
  pieceStyle: PieceStyle;
}

const KEY = 'chex:prefs';
const listeners = new Set<() => void>();

function load(): Preferences {
  const fallback: Preferences = { theme: DEFAULT_THEME, pieceStyle: DEFAULT_PIECE_STYLE };
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? 'null') as Partial<Preferences> | null;
    return {
      theme: raw?.theme && raw.theme in THEMES ? raw.theme : fallback.theme,
      pieceStyle: raw?.pieceStyle === 'outline' || raw?.pieceStyle === 'filled' ? raw.pieceStyle : fallback.pieceStyle,
    };
  } catch {
    return fallback; // private mode / corrupt value
  }
}

let current = load();
applyToDocument(current);

/** Lets CSS pick the matching UI palette: `[data-theme="neonGrid"]`. */
function applyToDocument(p: Preferences) {
  document.documentElement.dataset.theme = p.theme;
  document.documentElement.dataset.pieces = p.pieceStyle;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', THEMES[p.theme].pageBg);
}

export function setPreferences(patch: Partial<Preferences>) {
  current = { ...current, ...patch };
  try {
    localStorage.setItem(KEY, JSON.stringify(current));
  } catch {
    /* still applies for this session */
  }
  applyToDocument(current);
  listeners.forEach((l) => l());
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

export function usePreferences(): Preferences {
  return useSyncExternalStore(subscribe, () => current);
}
