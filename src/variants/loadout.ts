import { useSyncExternalStore } from 'react';
import { normalizeLoadout } from './catalog';

/**
 * The cartridges plugged into this device's mod bay: at most one per piece slot
 * (knight, rook, bishop, pawn), kept in slot order. Used for local games and as the
 * rules requested when creating an online room or entering quick match. (An online
 * room's own mods come from its game state, not from here.)
 */
const KEY = 'chex:loadout';
const listeners = new Set<() => void>();

function load(): string[] {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? '[]') as unknown;
    if (!Array.isArray(raw)) return [];
    return normalizeLoadout(raw.filter((id): id is string => typeof id === 'string'));
  } catch {
    return [];
  }
}

let current = load();

export function getLoadout(): string[] {
  return current;
}

export function setLoadout(ids: string[]) {
  current = normalizeLoadout(ids);
  try {
    localStorage.setItem(KEY, JSON.stringify(current));
  } catch {
    /* session only */
  }
  listeners.forEach((l) => l());
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

export function useLoadout(): string[] {
  return useSyncExternalStore(subscribe, () => current);
}
