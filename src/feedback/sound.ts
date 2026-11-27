/**
 * Procedural sound effects (Web Audio). No audio files: every sound is synthesised
 * from oscillators and filtered noise, so it costs no downloads and can follow the theme.
 *
 * Browsers only allow audio after a user gesture, so the context is created/resumed on
 * the first pointer or key press (`unlockAudio`, wired in main.tsx).
 */

export type SoundName =
  | 'select'
  | 'move'
  | 'opponentMove'
  | 'capture'
  | 'castle'
  | 'check'
  | 'promote'
  | 'illegal'
  | 'start'
  | 'win'
  | 'lose'
  | 'draw'
  | 'lowTime'
  | 'tick'
  | 'plug'
  | 'eject'
  | 'enhance';

/** Tonal flavour per theme: Neon grid is synth-wave, Night city is punchier and darker. */
export type SoundFlavour = 'synth' | 'street';

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let noiseBuf: AudioBuffer | null = null;
let enabled = true;
let flavour: SoundFlavour = 'street';

export function setSoundEnabled(on: boolean) {
  enabled = on;
}

export function setSoundFlavour(f: SoundFlavour) {
  flavour = f;
}

function context(): AudioContext | null {
  if (ctx) return ctx;
  const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) return null;
  ctx = new AC({ latencyHint: 'interactive' });
  master = ctx.createGain();
  master.gain.value = 1;
  // A gentle compressor keeps stacked sounds (capture + check) from clipping.
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -8;
  comp.ratio.value = 4;
  master.connect(comp).connect(ctx.destination);
  noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 0.5, ctx.sampleRate);
  const data = noiseBuf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  return ctx;
}

/** Call from a user gesture. Safe to call repeatedly. */
export function unlockAudio() {
  const c = context();
  if (c && c.state === 'suspended') void c.resume();
}

// ───────────────────────────── building blocks ─────────────────────────────

interface ToneOpts {
  freq: number;
  /** End frequency for a glide. */
  to?: number;
  type?: OscillatorType;
  at?: number;
  dur: number;
  gain?: number;
  attack?: number;
  /** Optional low-pass cutoff. */
  cutoff?: number;
}

function tone(c: BaseAudioContext, out: AudioNode, o: ToneOpts) {
  const t0 = c.currentTime + (o.at ?? 0);
  const osc = c.createOscillator();
  osc.type = o.type ?? 'sine';
  osc.frequency.setValueAtTime(o.freq, t0);
  if (o.to) osc.frequency.exponentialRampToValueAtTime(o.to, t0 + o.dur);
  const g = c.createGain();
  const peak = o.gain ?? 0.3;
  const attack = o.attack ?? 0.004;
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(peak, t0 + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + o.dur);
  let node: AudioNode = osc;
  if (o.cutoff) {
    const f = c.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = o.cutoff;
    osc.connect(f);
    node = f;
  }
  node.connect(g).connect(out);
  osc.start(t0);
  osc.stop(t0 + o.dur + 0.02);
}

interface NoiseOpts {
  at?: number;
  dur: number;
  gain?: number;
  /** Band-pass centre and Q: shapes the noise into a click, thock or crunch. */
  freq: number;
  q?: number;
  /** Sweep the band to this frequency over the duration. */
  to?: number;
  /** 'highpass' keeps only the bright top: a dry tick with no body. Default 'bandpass'. */
  filter?: BiquadFilterType;
}

function noise(c: BaseAudioContext, out: AudioNode, o: NoiseOpts) {
  if (!noiseBuf) return;
  const t0 = c.currentTime + (o.at ?? 0);
  const src = c.createBufferSource();
  src.buffer = noiseBuf;
  src.loop = true;
  const f = c.createBiquadFilter();
  f.type = o.filter ?? 'bandpass';
  f.frequency.setValueAtTime(o.freq, t0);
  if (o.to) f.frequency.exponentialRampToValueAtTime(o.to, t0 + o.dur);
  f.Q.value = o.q ?? 1.2;
  const g = c.createGain();
  g.gain.setValueAtTime(o.gain ?? 0.5, t0);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + o.dur);
  src.connect(f).connect(g).connect(out);
  src.start(t0, Math.random() * 0.3);
  src.stop(t0 + o.dur + 0.02);
}

const note = (semitonesFromA4: number) => 440 * Math.pow(2, semitonesFromA4 / 12);

// ───────────────────────────── the sounds ─────────────────────────────

/**
 * A piece landing: crisp, wooden "tok". Short and bright on purpose: a dry high-passed
 * transient, a quickly decaying mid "wood" partial (plus its inharmonic overtone), and only
 * a 30 ms hint of low body, so it never smears into mud on small speakers.
 */
function tok(c: BaseAudioContext, out: AudioNode, at = 0, weight = 1, pitch = 1) {
  const p = pitch * (flavour === 'synth' ? 1.12 : 1);
  noise(c, out, { at, dur: 0.014, freq: 3200, filter: 'highpass', q: 0.7, gain: 0.55 * weight });
  tone(c, out, { at, freq: 1180 * p, to: 940 * p, dur: 0.07, gain: 0.32 * weight, attack: 0.001 });
  tone(c, out, { at, freq: 2950 * p, dur: 0.022, gain: 0.08 * weight, attack: 0.001 });
  tone(c, out, { at, freq: 340 * p, to: 260 * p, dur: 0.03, gain: 0.16 * weight, attack: 0.001 });
}

/** Piece strikes piece: a hard double "clack", a bright snap and a short glassy sparkle. */
function clack(c: BaseAudioContext, out: AudioNode) {
  const p = flavour === 'synth' ? 1.1 : 1;
  noise(c, out, { dur: 0.012, freq: 4200, filter: 'highpass', q: 0.7, gain: 0.7 });
  tone(c, out, { freq: 1650 * p, to: 1250 * p, dur: 0.045, gain: 0.3, attack: 0.001 });
  tone(c, out, { freq: 3900 * p, dur: 0.02, gain: 0.08, attack: 0.001 });
  // the captured piece knocked aside a beat later
  noise(c, out, { at: 0.028, dur: 0.012, freq: 3000, filter: 'highpass', q: 0.7, gain: 0.5 });
  tone(c, out, { at: 0.028, freq: 1320 * p, to: 990 * p, dur: 0.06, gain: 0.26, attack: 0.001 });
  tone(c, out, { at: 0.028, freq: 420 * p, to: 300 * p, dur: 0.035, gain: 0.14, attack: 0.001 });
  // bright shatter tail
  noise(c, out, { at: 0.03, dur: 0.11, freq: 7500, filter: 'highpass', q: 0.7, gain: 0.12 });
  tone(c, out, { at: 0.04, freq: note(31) * p, to: note(26) * p, dur: 0.09, gain: 0.035, type: 'triangle', attack: 0.001 });
}

const SOUNDS: Record<SoundName, (c: BaseAudioContext, out: AudioNode) => void> = {
  select: (c, o) => tone(c, o, { freq: 1900, dur: 0.03, gain: 0.07, type: 'sine' }),
  move: (c, o) => tok(c, o),
  // Same tok a fourth lower: you can tell their move from yours without looking.
  opponentMove: (c, o) => tok(c, o, 0, 1, 0.78),
  capture: (c, o) => clack(c, o),
  castle: (c, o) => {
    tok(c, o, 0, 0.9);
    tok(c, o, 0.085, 0.85, 1.12);
  },
  check: (c, o) => {
    const type: OscillatorType = flavour === 'synth' ? 'square' : 'sawtooth';
    tone(c, o, { freq: note(15), dur: 0.09, gain: 0.16, type, cutoff: 3200 });
    tone(c, o, { freq: note(20), dur: 0.16, gain: 0.16, type, cutoff: 3200, at: 0.1 });
  },
  promote: (c, o) => {
    tone(c, o, { freq: note(3), to: note(15), dur: 0.25, gain: 0.14, type: 'triangle' });
    [15, 19, 22, 27].forEach((s, i) => tone(c, o, { freq: note(s), dur: 0.25, gain: 0.1, at: 0.18 + i * 0.06, type: 'sine' }));
  },
  illegal: (c, o) => tone(c, o, { freq: 150, dur: 0.09, gain: 0.12, type: 'square', cutoff: 600 }),
  start: (c, o) => {
    tone(c, o, { freq: note(-2), dur: 0.16, gain: 0.14, type: 'triangle' });
    tone(c, o, { freq: note(5), dur: 0.3, gain: 0.14, type: 'triangle', at: 0.13 });
  },
  win: (c, o) => {
    const type: OscillatorType = flavour === 'synth' ? 'square' : 'triangle';
    [3, 7, 10, 15].forEach((s, i) => tone(c, o, { freq: note(s), dur: 0.22, gain: 0.13, type, cutoff: 4000, at: i * 0.11 }));
    tone(c, o, { freq: note(15), dur: 1.1, gain: 0.12, type: 'triangle', at: 0.44, attack: 0.02 });
    tone(c, o, { freq: note(19), dur: 1.1, gain: 0.08, type: 'sine', at: 0.44, attack: 0.02 });
    noise(c, o, { at: 0.44, dur: 0.8, freq: 7000, q: 0.7, gain: 0.08 });
  },
  lose: (c, o) => {
    [7, 3, 0, -5].forEach((s, i) =>
      tone(c, o, { freq: note(s - 12), dur: 0.35, gain: 0.16, type: 'sawtooth', cutoff: 900, at: i * 0.17 }),
    );
    tone(c, o, { freq: note(-17), to: note(-29), dur: 1.0, gain: 0.18, type: 'sine', at: 0.5 });
  },
  draw: (c, o) => {
    tone(c, o, { freq: note(0), dur: 0.3, gain: 0.12, type: 'triangle' });
    tone(c, o, { freq: note(0), dur: 0.5, gain: 0.12, type: 'triangle', at: 0.25 });
  },
  lowTime: (c, o) => {
    tone(c, o, { freq: 1050, dur: 0.06, gain: 0.12, type: 'square', cutoff: 2500 });
  },
  tick: (c, o) => noise(c, o, { dur: 0.03, freq: 3500, q: 3, gain: 0.25 }),
  plug: (c, o) => {
    // cartridge seats (two-stage clunk), then the bay powers up
    noise(c, o, { dur: 0.05, freq: 1400, q: 1.5, gain: 0.5 });
    tone(c, o, { freq: 140, to: 70, dur: 0.12, gain: 0.45, at: 0.01 });
    noise(c, o, { at: 0.07, dur: 0.04, freq: 3200, q: 2, gain: 0.35 });
    const type: OscillatorType = flavour === 'synth' ? 'square' : 'sawtooth';
    tone(c, o, { freq: note(-12), to: note(12), dur: 0.32, gain: 0.07, type, cutoff: 2400, at: 0.16 });
    tone(c, o, { freq: note(12), dur: 0.12, gain: 0.08, type: 'sine', at: 0.46 });
    tone(c, o, { freq: note(19), dur: 0.18, gain: 0.08, type: 'sine', at: 0.55 });
  },
  enhance: (c, o) => {
    // a mod charge fires: rising zap with a sparkle on top
    const type: OscillatorType = flavour === 'synth' ? 'square' : 'sawtooth';
    tone(c, o, { freq: 180, to: 1400, dur: 0.18, gain: 0.12, type, cutoff: 3000 });
    noise(c, o, { dur: 0.2, freq: 3000, to: 8000, q: 1.5, gain: 0.18 });
    [24, 28, 31].forEach((s, i) => tone(c, o, { freq: note(s), dur: 0.1, gain: 0.06, at: 0.12 + i * 0.04 }));
  },
  eject: (c, o) => {
    noise(c, o, { dur: 0.06, freq: 2600, to: 900, q: 1.2, gain: 0.4 });
    tone(c, o, { freq: note(12), to: note(-12), dur: 0.28, gain: 0.07, type: 'triangle', at: 0.04 });
    tone(c, o, { freq: 220, to: 110, dur: 0.08, gain: 0.3, at: 0.02 });
  },
};

/** Per-sound loudness trim (measured offline so a move reads clearly on a phone speaker). */
const LEVEL: Record<SoundName, number> = {
  select: 3.5,
  move: 3.2,
  opponentMove: 3.4,
  capture: 3.4,
  castle: 1.2,
  check: 3,
  promote: 3,
  illegal: 5,
  start: 3,
  win: 2.4,
  lose: 2.2,
  draw: 3.2,
  lowTime: 6,
  tick: 9,
  plug: 3,
  eject: 3,
  enhance: 3,
};

/** Render one sound into any context (offline loudness checks in tests/tools). */
export function renderSound(c: BaseAudioContext, out: AudioNode, name: SoundName) {
  context(); // the shared noise buffer
  const trim = c.createGain();
  trim.gain.value = LEVEL[name];
  trim.connect(out);
  SOUNDS[name](c, trim);
}

export function playSound(name: SoundName) {
  if (!enabled) return;
  const c = context();
  if (!c || !master || c.state !== 'running') return;
  try {
    const trim = c.createGain();
    trim.gain.value = LEVEL[name];
    trim.connect(master);
    SOUNDS[name](c, trim);
  } catch {
    /* audio is decoration: never let it break the game */
  }
}
