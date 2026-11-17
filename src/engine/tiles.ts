import type { BoardState, Coord, TileModifierKind } from '../types/game';
import { tileAt } from './board';

/**
 * Behaviour for tile modifiers. Movement generation only asks two questions,
 * so new tile types (lava, ice, portals…) plug in here without touching movegen.
 * Effects that fire on enter/turn-end belong in rule modifiers' `afterMove`.
 */
export interface TileModifierDefinition {
  kind: TileModifierKind;
  name: string;
  /** Pieces cannot stop on this tile. */
  blocksOccupation?: boolean;
  /** Sliders cannot pass through this tile (leapers can jump it). */
  blocksSliding?: boolean;
}

const registry = new Map<TileModifierKind, TileModifierDefinition>();

export function registerTileModifier(def: TileModifierDefinition): void {
  registry.set(def.kind, def);
}

export function getTileModifierDef(kind: TileModifierKind): TileModifierDefinition | undefined {
  return registry.get(kind);
}

function anyModifier(b: BoardState, c: Coord, pred: (d: TileModifierDefinition) => boolean): boolean {
  const mods = tileAt(b, c).modifiers;
  for (let i = 0; i < mods.length; i++) {
    const d = registry.get(mods[i].kind);
    if (d && pred(d)) return true;
  }
  return false;
}

export const canOccupy = (b: BoardState, c: Coord): boolean =>
  !anyModifier(b, c, (d) => !!d.blocksOccupation);

export const canSlideThrough = (b: BoardState, c: Coord): boolean =>
  !anyModifier(b, c, (d) => !!d.blocksSliding);

export function registerStandardTiles(): void {
  // Not placed on the V1 board — registered so tests / future levels can use it.
  registerTileModifier({ kind: 'impassable', name: 'Chasm', blocksOccupation: true, blocksSliding: true });
}
