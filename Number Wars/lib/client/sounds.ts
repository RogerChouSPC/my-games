'use client';
// Tiny synthesized sound effects (Web Audio API) — retro arcade style, no audio
// files needed. Every effect is built from short oscillator/noise envelopes.

export type SoundName =
  | 'place' // chip placed on the board
  | 'remove' // a chip popped off (Minus)
  | 'bomb' // 2×2 blast
  | 'freeze' // ice crack
  | 'skip' // frozen player's turn skipped
  | 'steal' // card swiped
  | 'shield' // shield applied
  | 'shieldblock' // attack blocked by a hidden shield
  | 'reroll' // cards shuffled
  | 'plus' // wild card sparkle
  | 'turn' // your turn started
  | 'win' // line win / game win
  | 'super'; // super line win fanfare

const MUTE_KEY = 'nw_muted';
let ctx: AudioContext | null = null;
let muted: boolean | null = null;

export function isMuted(): boolean {
  if (muted === null) {
    muted = typeof window !== 'undefined' && localStorage.getItem(MUTE_KEY) === '1';
  }
  return muted;
}

export function setMuted(m: boolean): void {
  muted = m;
  localStorage.setItem(MUTE_KEY, m ? '1' : '0');
}

function audio(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!ctx) {
    const AC =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

// Mobile browsers only allow audio after a user gesture — call this on first tap.
export function unlockAudio(): void {
  void audio();
}

interface ToneOpts {
  freq: number;
  end?: number; // glide target frequency
  type?: OscillatorType;
  dur?: number; // seconds
  vol?: number; // 0..1
  at?: number; // delay from now, seconds
}

function tone(c: AudioContext, { freq, end, type = 'sine', dur = 0.15, vol = 0.2, at = 0 }: ToneOpts) {
  const t = c.currentTime + at;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  o.frequency.exponentialRampToValueAtTime(Math.max(20, end ?? freq), t + dur);
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(c.destination);
  o.start(t);
  o.stop(t + dur + 0.05);
}

// Filtered noise burst (explosions, swipes, cracks).
function noise(
  c: AudioContext,
  { dur = 0.3, vol = 0.3, at = 0, from = 1500, to = 150 }: { dur?: number; vol?: number; at?: number; from?: number; to?: number }
) {
  const t = c.currentTime + at;
  const len = Math.ceil(c.sampleRate * dur);
  const buf = c.createBuffer(1, len, c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  const src = c.createBufferSource();
  src.buffer = buf;
  const f = c.createBiquadFilter();
  f.type = 'lowpass';
  f.frequency.setValueAtTime(from, t);
  f.frequency.exponentialRampToValueAtTime(Math.max(40, to), t + dur);
  const g = c.createGain();
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(f).connect(g).connect(c.destination);
  src.start(t);
  src.stop(t + dur + 0.05);
}

const FX: Record<SoundName, (c: AudioContext) => void> = {
  place: (c) => tone(c, { freq: 620, end: 480, type: 'triangle', dur: 0.09, vol: 0.18 }),
  remove: (c) => {
    tone(c, { freq: 300, end: 70, type: 'square', dur: 0.14, vol: 0.14 });
    noise(c, { dur: 0.1, vol: 0.12, from: 2500, to: 300 });
  },
  bomb: (c) => {
    noise(c, { dur: 0.55, vol: 0.5, from: 900, to: 50 });
    tone(c, { freq: 130, end: 35, type: 'sine', dur: 0.5, vol: 0.45 });
  },
  freeze: (c) => {
    tone(c, { freq: 1300, end: 500, type: 'sine', dur: 0.28, vol: 0.16 });
    tone(c, { freq: 1750, end: 700, type: 'sine', dur: 0.24, vol: 0.1, at: 0.06 });
    noise(c, { dur: 0.12, vol: 0.08, from: 6000, to: 2000, at: 0.02 });
  },
  skip: (c) => {
    noise(c, { dur: 0.14, vol: 0.18, from: 5000, to: 800 });
    tone(c, { freq: 900, end: 350, type: 'triangle', dur: 0.16, vol: 0.12, at: 0.03 });
  },
  steal: (c) => {
    noise(c, { dur: 0.2, vol: 0.16, from: 4000, to: 400 });
    tone(c, { freq: 500, end: 900, type: 'sine', dur: 0.16, vol: 0.1, at: 0.04 });
  },
  shield: (c) => {
    tone(c, { freq: 1320, dur: 0.3, vol: 0.13 });
    tone(c, { freq: 1980, dur: 0.24, vol: 0.07, at: 0.02 });
  },
  shieldblock: (c) => {
    tone(c, { freq: 220, dur: 0.3, type: 'square', vol: 0.14 });
    tone(c, { freq: 333, dur: 0.26, type: 'square', vol: 0.1, at: 0.01 });
    noise(c, { dur: 0.12, vol: 0.12, from: 3000, to: 500 });
  },
  reroll: (c) => {
    for (let i = 0; i < 3; i++)
      tone(c, { freq: 700 + i * 180, end: 600 + i * 180, type: 'triangle', dur: 0.06, vol: 0.13, at: i * 0.07 });
  },
  plus: (c) => {
    tone(c, { freq: 740, end: 1480, type: 'sine', dur: 0.18, vol: 0.14 });
    tone(c, { freq: 1110, end: 2220, type: 'sine', dur: 0.16, vol: 0.08, at: 0.05 });
  },
  turn: (c) => {
    tone(c, { freq: 880, dur: 0.22, vol: 0.18 });
    tone(c, { freq: 1320, dur: 0.3, vol: 0.1, at: 0.1 });
  },
  win: (c) => {
    [523, 659, 784].forEach((f, i) => tone(c, { freq: f, dur: 0.22, vol: 0.16, at: i * 0.11 }));
  },
  super: (c) => {
    [392, 523, 659, 784].forEach((f, i) => tone(c, { freq: f, dur: 0.26, vol: 0.18, at: i * 0.13 }));
    tone(c, { freq: 1046, dur: 0.5, vol: 0.16, at: 0.52 });
  },
};

export function play(name: SoundName): void {
  if (isMuted()) return;
  const c = audio();
  if (!c) return;
  try {
    FX[name](c);
  } catch {
    // Audio is best-effort — never break the game over a sound.
  }
}
