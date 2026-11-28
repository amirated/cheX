/**
 * Records a modded game with the TS engine for the Rust parity tests (cheX-BE/tests/parity.rs).
 * Deterministic (fixed seed). Defaults reproduce the camel-knight fixture.
 *
 *   npx vite-node scripts/mod-parity-fixture.ts [out.json] [mods=knightCamel] [level=2] [seed] [plies=90]
 *   npx vite-node scripts/mod-parity-fixture.ts ../cheX-BE/tests/fixtures/ts_ram_game.json knightCamel+pawnRam 2 20261127 120
 */
import { writeFileSync } from 'node:fs';
import { createGameState, gameReducer, isGameOver, legalMoves, standardBoard } from '../src/engine';
import { rulesetFor } from '../src/variants/catalog';
import type { MoveAction } from '../src/types/game';

const [, , outArg, modsArg = 'knightCamel', levelArg = '2', seedArg = '20261126', pliesArg = '90'] = process.argv;
let seed = Number(seedArg);
const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
// Level 2 by default: each enhanced piece may use its mod twice, with a cooldown in between.
const initial = createGameState(standardBoard(), rulesetFor(modsArg.split('+'), () => Number(levelArg)));
let s = initial;
const actions: MoveAction[] = [];
const states: { after: number; state: unknown }[] = [];
const keep = (i: number, st: unknown) => { if (i % 15 === 14) states.push({ after: i, state: st }); };
const used: Record<string, number> = {};
for (let i = 0; i < Number(pliesArg) && !isGameOver(s); i++) {
  const legal = legalMoves(s);
  // Prefer mod moves when available so the fixture exercises the mods heavily.
  const modded = legal.filter((m) => m.flags.some((f) => f.startsWith('mod:')));
  const pool = modded.length && rnd() < 0.7 ? modded : legal;
  const m = pool[Math.floor(rnd() * pool.length)];
  for (const f of m.flags) if (f.startsWith('mod:')) used[f] = (used[f] ?? 0) + 1;
  const a: MoveAction = { type: 'move', from: m.from, to: m.to, promotion: m.promotion ?? undefined };
  actions.push(a);
  s = gameReducer(s, a);
  keep(actions.length - 1, s);
}
if (states.at(-1)?.after !== actions.length - 1) states.push({ after: actions.length - 1, state: s });
// End with a rematch (mods must persist) and an illegal-without-mod check is covered in Rust tests.
actions.push({ type: 'reset' });
s = gameReducer(s, { type: 'reset' });
states.push({ after: actions.length - 1, state: s });
writeFileSync(outArg ?? '../cheX-BE/tests/fixtures/ts_camel_game.json', JSON.stringify({ initial, actions, states }));
console.log('plies', actions.length - 1, 'mod moves', used, 'final', (states[states.length - 2].state as { status: string }).status);
