/**
 * Records a camel-knight game with the TS engine for the Rust parity test
 * (cheX-BE/tests/parity.rs, `camel_knight_game_matches_ts`). Deterministic (fixed seed).
 *
 *   npx vite-node scripts/mod-parity-fixture.ts [out.json]
 */
import { writeFileSync } from 'node:fs';
import { createGameState, gameReducer, isGameOver, legalMoves, standardBoard } from '../src/engine';
import { rulesetFor } from '../src/variants/catalog';
import type { MoveAction } from '../src/types/game';

let seed = 20261126;
const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
// Level 2: each knight may leap twice, with a one-turn cooldown in between.
const initial = createGameState(standardBoard(), rulesetFor(['knightCamel'], () => 2));
let s = initial;
const actions: MoveAction[] = [];
const states: { after: number; state: unknown }[] = [];
const keep = (i: number, st: unknown) => { if (i % 15 === 14) states.push({ after: i, state: st }); };
let camel = 0;
for (let i = 0; i < 90 && !isGameOver(s); i++) {
  const legal = legalMoves(s);
  // Prefer camel leaps when available so the fixture exercises the mod heavily.
  const camels = legal.filter((m) => m.flags.some((f) => f.startsWith('mod:')));
  const pool = camels.length && rnd() < 0.7 ? camels : legal;
  const m = pool[Math.floor(rnd() * pool.length)];
  if (camels.includes(m)) camel++;
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
writeFileSync(process.argv[2] ?? '../cheX-BE/tests/fixtures/ts_camel_game.json', JSON.stringify({ initial, actions, states }));
console.log('plies', actions.length - 1, 'camel leaps', camel, 'final', (states[states.length - 2].state as { status: string }).status);
