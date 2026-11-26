import { COOLDOWN_PLIES, MAX_LEVEL } from '../engine/rules/charges';

/**
 * The rulebook and lore shown in the library's "Rules" and "Codex" tabs. Rules text is
 * derived from the engine constants so it can't drift from the actual behaviour.
 */

export const LEVELS = Array.from({ length: MAX_LEVEL }, (_, i) => ({
  level: i + 1,
  charges: i + 1,
}));

export const COOLDOWN_TURNS = COOLDOWN_PLIES / 2 - 1;

export interface RuleSection {
  title: string;
  body: string[];
}

export const RULES: RuleSection[] = [
  {
    title: 'Cartridges',
    body: [
      'A mod is a cartridge that enhances one kind of piece. Plug up to three into the mod bay; with an empty bay you play classic chess.',
      'Online, the mods are fixed when the room is created and stay for every rematch in that room. Quick match only pairs players running the same cartridges.',
    ],
  },
  {
    title: 'Charges',
    body: [
      'Every enhanced piece carries charges, one per level. Using the enhanced move spends a charge; its ordinary moves are always free.',
      'Charges belong to each piece, not to the piece type: two level-2 knights have four camel leaps between them.',
      'A pawn that promotes into an enhanced piece arrives with full charges.',
    ],
  },
  {
    title: 'Cooldown',
    body: [
      `After spending a charge the piece cools down: it sits out ${COOLDOWN_TURNS === 1 ? 'one of your turns' : `${COOLDOWN_TURNS} of your turns`} before it can use the next one. It can still make its ordinary moves meanwhile.`,
    ],
  },
  {
    title: 'Threats, check and mate',
    body: [
      'A piece threatens with its enhanced move only if it could use it on its next turn. A cooling or spent piece threatens only with its ordinary moves.',
      'That one rule settles check, pins, mate and stalemate. A king and a lone enhanced piece with charges left still count as mating material.',
    ],
  },
  {
    title: 'Levels',
    body: [
      `Levels run from 1 to ${MAX_LEVEL} for each piece mod and come from player progression. Progression isn't live yet, so everyone plays at level 1.`,
      'When two players meet, both play at the lower of their two levels, so the rules are always the same on both sides of the board.',
    ],
  },
  {
    title: 'Reading the board',
    body: [
      'Chips on a piece are its charges: bright = ready, dim = cooling down, hollow = spent.',
      'When you pick up an enhanced piece, moves that cost a charge are drawn as diamonds in the cartridge colour, and the line under the board shows its charges.',
      'In the move list, ◆ marks a move that spent a charge.',
    ],
  },
  {
    title: 'Everything else',
    body: ['It is still chess: checkmate wins, and castling, en passant, promotion, the 50-move rule and the clock work as always.'],
  },
];

export interface CodexEntry {
  title: string;
  kicker?: string;
  body: string[];
}

export const CODEX: CodexEntry[] = [
  {
    kicker: 'Origin',
    title: 'The board that learned to update',
    body: [
      'For fifteen centuries the rules of chess were firmware: burned in, never patched. Then the grid cities wired their boards into the net, and somebody bolted a cartridge bay to the edge of one.',
      'The first cartridges were crude. Pieces gained moves they could spend forever, and the games burned out in a dozen turns. The fix was power: every enhancement draws on a charge, and charges are scarce.',
    ],
  },
  {
    kicker: 'Doctrine',
    title: 'Charge, cooldown, level',
    body: [
      'A charge is one use of an enhancement. A piece that fires one runs hot and needs a turn to cool before it fires again. How many charges a piece carries is its level, earned over many games, never bought.',
      'Old players call this the Thermal Rule: power you can spend is power your opponent can count.',
    ],
  },
  {
    kicker: 'Cartridge NC-01',
    title: 'Camel Knight',
    body: [
      'Burned in the Sand Grid, where caravan routes run long and straight. The knight keeps its crooked step and learns the camel stride: three squares out, one aside.',
      'Grid players spend the leap late and loud: a fork from nowhere, an escape across the board, a mate the defender never saw coming. Spent early, it is just a horse again.',
    ],
  },
  {
    kicker: 'Glossary',
    title: 'Terms',
    body: [
      'Bay: the three cartridge slots mounted on the board.',
      'Charge: one use of a piece’s enhanced move.',
      'Cooldown: the turn a piece sits out after firing a charge.',
      'Spent: a piece with no charges left; it moves like the classic piece.',
      'Level: charges per piece, 1 to 3, from progression.',
    ],
  },
];
