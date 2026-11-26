import { useSyncExternalStore } from 'react';
import { MAX_SLOTS, MODS } from './catalog';

/**
 * The cartridges plugged into this device's mod bay. Used for local games and as the
 * rules requested when creating an online room or entering quick match. (An online
 * room's own mods come from its game state, not from here.)
 */
const KEY = 'chex:loadout';
const listeners = new Set<() => void>();

function load(): string[] {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? '[]') as unknown;
    if (!Array.isArray(raw)) return [];
    return [...new Set(raw.filter((id): id is string => typeof id === 'string' && MODS.some((m) => m.id === id)))].slice(0, MAX_SLOTS);
  } catch {
    return [];
  }
}

let current = load();

export function getLoadout(): string[] {
  return current;
}

export function setLoadout(ids: string[]) {
  current = [...new Set(ids)].slice(0, MAX_SLOTS);
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
