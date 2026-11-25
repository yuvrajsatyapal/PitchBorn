/**
 * Match sound, made on the fly with the Web Audio API (no audio files to download): a crowd bed of filtered noise that swells
 * with the action, the referee's whistle, a goal roar with a stadium horn, the "ooh" of a near miss and a sting for a card.
 * Off until the player turns it on; the choice is kept per browser. Every call is a no-op when audio is unavailable or muted.
 */
const KEY = "pitchborn:sound";

type Ctx = AudioContext;
let ctx: Ctx | null = null;
let master: GainNode | null = null;
let crowd: { gain: GainNode; filter: BiquadFilterNode; src: AudioBufferSourceNode } | null = null;
let enabled: boolean | null = null;
const listeners = new Set<(on: boolean) => void>();

export function soundEnabled(): boolean {
  if (enabled !== null) return enabled;
  try {
    enabled = localStorage.getItem(KEY) === "on";
  } catch {
    enabled = false;
  }
  return enabled;
}

export function setSoundEnabled(on: boolean): void {
  enabled = on;
  try {
    localStorage.setItem(KEY, on ? "on" : "off");
  } catch {
    // Storage blocked: the choice lasts for this visit.
  }
  if (!on) stopCrowd();
  if (master && ctx) master.gain.setTargetAtTime(on ? 0.8 : 0, ctx.currentTime, 0.05);
  listeners.forEach((f) => f(on));
}

export function onSoundChange(f: (on: boolean) => void): () => void {
  listeners.add(f);
  return () => listeners.delete(f);
}

function audio(): Ctx | null {
  if (!soundEnabled() || typeof window === "undefined") return null;
  if (!ctx) {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.8;
    master.connect(ctx.destination);
  }
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

function noiseBuffer(c: Ctx, seconds: number): AudioBuffer {
  const buf = c.createBuffer(1, Math.floor(c.sampleRate * seconds), c.sampleRate);
  const data = buf.getChannelData(0);
  // Pink-ish noise: a running average of white noise sounds like a distant crowd rather than static.
  let last = 0;
  for (let i = 0; i < data.length; i++) {
    last = (last + 0.04 * (Math.random() * 2 - 1)) / 1.04;
    data[i] = last * 3.5;
  }
  return buf;
}

/** The crowd murmur under the whole match. `level` 0–1. */
export function startCrowd(level = 0.25): void {
  const c = audio();
  if (!c || !master || crowd) return;
  const src = c.createBufferSource();
  src.buffer = noiseBuffer(c, 4);
  src.loop = true;
  const filter = c.createBiquadFilter();
  filter.type = "bandpass";
  filter.frequency.value = 700;
  filter.Q.value = 0.6;
  const gain = c.createGain();
  gain.gain.value = 0;
  gain.gain.setTargetAtTime(level, c.currentTime, 0.8);
  src.connect(filter).connect(gain).connect(master);
  src.start();
  crowd = { gain, filter, src };
}

export function stopCrowd(): void {
  if (!crowd || !ctx) return;
  const { gain, src } = crowd;
  gain.gain.setTargetAtTime(0, ctx.currentTime, 0.3);
  src.stop(ctx.currentTime + 1.5);
  crowd = null;
}

/** Lift the crowd for a moment (a chance, a goal), then let it settle back. */
function swell(peak: number, hold: number, base = 0.25): void {
  if (!crowd || !ctx) return;
  const t = ctx.currentTime;
  crowd.gain.gain.cancelScheduledValues(t);
  crowd.gain.gain.setTargetAtTime(peak, t, 0.08);
  crowd.gain.gain.setTargetAtTime(base, t + hold, 0.9);
  crowd.filter.frequency.setTargetAtTime(1100, t, 0.1);
  crowd.filter.frequency.setTargetAtTime(700, t + hold, 0.9);
}

function tone(c: Ctx, freq: number, start: number, dur: number, vol: number, type: OscillatorType = "sine", vibrato = 0): void {
  if (!master) return;
  const o = c.createOscillator();
  o.type = type;
  o.frequency.value = freq;
  const g = c.createGain();
  g.gain.setValueAtTime(0, start);
  g.gain.linearRampToValueAtTime(vol, start + 0.02);
  g.gain.setValueAtTime(vol, start + dur - 0.05);
  g.gain.linearRampToValueAtTime(0, start + dur);
  if (vibrato) {
    const lfo = c.createOscillator();
    lfo.frequency.value = 28;
    const depth = c.createGain();
    depth.gain.value = vibrato;
    lfo.connect(depth).connect(o.frequency);
    lfo.start(start);
    lfo.stop(start + dur);
  }
  o.connect(g).connect(master);
  o.start(start);
  o.stop(start + dur + 0.02);
}

/** Pea whistle: short blasts, long for the end of a half. */
export function whistle(kind: "short" | "long" | "triple" = "short"): void {
  const c = audio();
  if (!c) return;
  const t = c.currentTime;
  const blasts = kind === "triple" ? [0.25, 0.25, 0.9] : kind === "long" ? [0.9] : [0.3];
  let at = t;
  for (const d of blasts) {
    tone(c, 2900, at, d, 0.08, "sine", 90);
    at += d + 0.12;
  }
}

export function goalSting(forUs: boolean): void {
  const c = audio();
  if (!c) return;
  swell(forUs ? 0.95 : 0.6, forUs ? 3.5 : 1.6);
  if (!forUs) return;
  const t = c.currentTime + 0.1;
  // A stadium horn: two rising notes over a low fifth.
  tone(c, 220, t, 0.7, 0.06, "sawtooth");
  tone(c, 330, t, 0.7, 0.04, "sawtooth");
  tone(c, 277, t + 0.75, 1.1, 0.06, "sawtooth");
  tone(c, 415, t + 0.75, 1.1, 0.04, "sawtooth");
}

export function nearMiss(): void {
  swell(0.6, 0.9);
}

export function cardSting(red: boolean): void {
  const c = audio();
  if (!c) return;
  const t = c.currentTime;
  tone(c, red ? 196 : 392, t, 0.18, 0.05, "square");
  if (red) tone(c, 147, t + 0.2, 0.35, 0.05, "square");
  swell(red ? 0.55 : 0.4, 0.8);
}
