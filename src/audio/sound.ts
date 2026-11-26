/**
 * Match sound, made on the fly with the Web Audio API (no audio files to download): a crowd bed of filtered noise that swells
 * with the action, the referee's whistle, a goal roar with a stadium horn, the "ooh" of a near miss and a sting for a card.
 * Off until the player turns it on; the choice is kept per browser. Every call is a no-op when audio is unavailable or muted.
 */
const KEY = "pitchborn:sound";

type Ctx = AudioContext;
let ctx: Ctx | null = null;
let master: GainNode | null = null;
let crowd: { gain: GainNode; filter: BiquadFilterNode; src: AudioBufferSourceNode; muffle: BiquadFilterNode; away: boolean } | null = null;
let chantTimer: ReturnType<typeof setInterval> | null = null;
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

export interface CrowdOptions {
  /** The user's side is the away team: the home crowd sounds further off, through the stand. */
  away?: boolean;
  /** Club ids whose chants ring out now and then: the home end first, the away end second. */
  homeClub?: string;
  awayClub?: string;
}

/** The crowd murmur under the whole match. `level` 0–1. */
export function startCrowd(level = 0.25, opts: CrowdOptions = {}): void {
  const c = audio();
  if (!c || !master || crowd) return;
  const src = c.createBufferSource();
  src.buffer = noiseBuffer(c, 4);
  src.loop = true;
  const filter = c.createBiquadFilter();
  filter.type = "bandpass";
  filter.frequency.value = 700;
  filter.Q.value = 0.6;
  const muffle = c.createBiquadFilter();
  muffle.type = "lowpass";
  // Away from home the noise reaches you through concrete: no top end.
  muffle.frequency.value = opts.away ? 650 : 6000;
  const gain = c.createGain();
  gain.gain.value = 0;
  gain.gain.setTargetAtTime(opts.away ? level * 0.8 : level, c.currentTime, 0.8);
  src.connect(filter).connect(muffle).connect(gain).connect(master);
  src.start();
  crowd = { gain, filter, src, muffle, away: !!opts.away };
  if (chantTimer) clearInterval(chantTimer);
  if (opts.homeClub || opts.awayClub) {
    let n = 0;
    // A chant every 40 seconds or so, mostly from the home end; the travelling fans get every third one.
    chantTimer = setInterval(() => {
      n++;
      const fromAway = n % 3 === 0 && opts.awayClub;
      const club = fromAway ? opts.awayClub : opts.homeClub ?? opts.awayClub;
      if (club) chant(club, { muffled: fromAway ? !opts.away : !!opts.away, quiet: !!fromAway });
    }, 40_000);
  }
}

export function stopCrowd(): void {
  if (chantTimer) {
    clearInterval(chantTimer);
    chantTimer = null;
  }
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

export function goalSting(forUs: boolean, clubId?: string): void {
  const c = audio();
  if (!c) return;
  // Score away from home and only the away end goes up; concede away and the whole ground roars.
  const away = crowd?.away ?? false;
  swell(forUs ? (away ? 0.7 : 0.95) : away ? 0.9 : 0.6, forUs ? 3.5 : 1.6);
  if (forUs && clubId) setTimeout(() => chant(clubId, { muffled: false, quiet: away }), 3200);
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

function hashOf(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Each club's chant: a tempo, an eight-note tune on a pentatonic scale and a clap rhythm, all from the club id. */
export function chantPattern(clubId: string): { bpm: number; notes: number[]; claps: boolean[] } {
  let h = hashOf(clubId);
  const next = (n: number) => {
    h = Math.imul(h ^ (h >>> 15), 2246822507) >>> 0;
    return h % n;
  };
  const scale = [0, 2, 4, 7, 9, 12];
  const bpm = 96 + next(36);
  const notes = Array.from({ length: 8 }, (_, i) => (i === 0 || i === 7 ? 0 : scale[next(scale.length)]));
  const claps = Array.from({ length: 8 }, (_, i) => i % 2 === 1 || next(4) === 0);
  return { bpm, notes, claps };
}

/** A few thousand voices singing the club's tune: detuned saws through a vowel-like band, with claps. */
export function chant(clubId: string, opts: { muffled?: boolean; quiet?: boolean } = {}): void {
  const c = audio();
  if (!c || !master) return;
  const { bpm, notes, claps } = chantPattern(clubId);
  const beat = 60 / bpm;
  const base = 196 * Math.pow(2, (hashOf(clubId + ":key") % 5) / 12);
  const out = c.createGain();
  out.gain.value = opts.quiet ? 0.35 : 0.6;
  const vowel = c.createBiquadFilter();
  vowel.type = "bandpass";
  vowel.frequency.value = 850;
  vowel.Q.value = 1.2;
  const lp = c.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.value = opts.muffled ? 700 : 4000;
  vowel.connect(lp).connect(out).connect(master);
  const t0 = c.currentTime + 0.05;
  for (let rep = 0; rep < 2; rep++) {
    notes.forEach((semi, i) => {
      const start = t0 + (rep * 8 + i) * beat;
      const f = base * Math.pow(2, semi / 12);
      for (const detune of [-9, -3, 4, 10]) {
        const o = c.createOscillator();
        o.type = "sawtooth";
        o.frequency.value = f;
        o.detune.value = detune;
        const g = c.createGain();
        g.gain.setValueAtTime(0, start);
        g.gain.linearRampToValueAtTime(0.018, start + 0.05);
        g.gain.linearRampToValueAtTime(0, start + beat * 0.92);
        o.connect(g).connect(vowel);
        o.start(start);
        o.stop(start + beat);
      }
      if (claps[i]) {
        const n = c.createBufferSource();
        n.buffer = noiseBuffer(c, 0.08);
        const g = c.createGain();
        g.gain.setValueAtTime(0.25, start);
        g.gain.exponentialRampToValueAtTime(0.001, start + 0.08);
        const hp = c.createBiquadFilter();
        hp.type = "highpass";
        hp.frequency.value = 1200;
        n.connect(hp).connect(g).connect(lp);
        n.start(start);
      }
    });
  }
}

export type FinalOutcome = "win" | "draw" | "loss";

/** After the final whistle: a roar for a win, applause for a draw, groans (and boos at home) for a defeat. */
export function finalWhistleCrowd(outcome: FinalOutcome): void {
  const c = audio();
  if (!c) return;
  const away = crowd?.away ?? false;
  if (outcome === "win") {
    swell(away ? 0.7 : 1, 4);
    return;
  }
  if (outcome === "draw") {
    swell(0.45, 2.5);
    applause(c, 2.5);
    return;
  }
  swell(away ? 0.75 : 0.35, 2);
  if (!away) {
    // Boos: low, wavering voices sliding down.
    const t = c.currentTime + 0.2;
    for (const f of [110, 117, 131]) {
      const o = c.createOscillator();
      o.type = "sawtooth";
      o.frequency.setValueAtTime(f, t);
      o.frequency.linearRampToValueAtTime(f * 0.85, t + 2.2);
      const g = c.createGain();
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.025, t + 0.3);
      g.gain.linearRampToValueAtTime(0, t + 2.4);
      const lp = c.createBiquadFilter();
      lp.type = "lowpass";
      lp.frequency.value = 500;
      o.connect(lp).connect(g).connect(master as GainNode);
      o.start(t);
      o.stop(t + 2.5);
    }
  }
}

function applause(c: Ctx, seconds: number): void {
  if (!master) return;
  const n = c.createBufferSource();
  const buf = c.createBuffer(1, Math.floor(c.sampleRate * seconds), c.sampleRate);
  const d = buf.getChannelData(0);
  // Many hands: sparse random clicks, denser at the start.
  for (let i = 0; i < d.length; i++) d[i] = Math.random() < 0.02 * (1 - i / d.length) + 0.004 ? Math.random() * 2 - 1 : 0;
  n.buffer = buf;
  const hp = c.createBiquadFilter();
  hp.type = "highpass";
  hp.frequency.value = 1500;
  const g = c.createGain();
  g.gain.value = 0.3;
  n.connect(hp).connect(g).connect(master);
  n.start();
}
