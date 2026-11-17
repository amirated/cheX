import type { PieceKind, Vec } from '../../types/game';
import type { PieceDefinition } from './types';

const registry = new Map<PieceKind, PieceDefinition>();

export function registerPiece(def: PieceDefinition): void {
  registry.set(def.kind, def);
}

export function getPieceDef(kind: PieceKind): PieceDefinition {
  const def = registry.get(kind);
  if (!def) throw new Error(`Unknown piece kind "${kind}" — did you register it?`);
  return def;
}

export function hasPieceDef(kind: PieceKind): boolean {
  return registry.has(kind);
}

export function allPieceDefs(): PieceDefinition[] {
  return [...registry.values()];
}

export function pieceKindFromSymbol(symbol: string): PieceKind | null {
  const s = symbol.toUpperCase();
  for (const d of registry.values()) if (d.symbol === s) return d.kind;
  return null;
}

// ── vector helpers for concise definitions ──

const v = (dFile: number, dRank: number): Vec => ({ dFile, dRank });

/** All sign/axis permutations of (a, b): (1,0) → 4 orthogonals, (1,1) → 4 diagonals, (1,2) → 8 knight hops. */
export function symmetric(a: number, b: number): Vec[] {
  const out: Vec[] = [];
  const seen = new Set<string>();
  for (const [x, y] of [
    [a, b],
    [b, a],
  ]) {
    for (const sx of [1, -1]) {
      for (const sy of [1, -1]) {
        const vec = v(x * sx, y * sy);
        const key = `${vec.dFile},${vec.dRank}`;
        if (!seen.has(key) && (vec.dFile !== 0 || vec.dRank !== 0)) {
          seen.add(key);
          out.push(vec);
        }
      }
    }
  }
  return out;
}

export const ORTHOGONAL = symmetric(1, 0);
export const DIAGONAL = symmetric(1, 1);
export const ALL_8 = [...ORTHOGONAL, ...DIAGONAL];
export { v as vec };
