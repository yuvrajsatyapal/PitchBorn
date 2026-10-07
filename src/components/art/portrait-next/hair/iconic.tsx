/**
 * Iconic styles that need a technique of their own: the frosted faux hawk (a raised crest over short sides), the
 * ponytail (swept back, tied behind the skull, the tail showing beside the head) and long curls held back by a
 * headband (rear volume behind the ears, a crown above the band, ringlets in front of it). Lion Afro and Dutch Dreads
 * are designs of the coily and locs techniques.
 */
import { CX, along, clamp, hash01, lerp, sub, unit, type Pt } from "../../portrait/geometry";
import { HeadbandNext } from "../accessories";
import { anchorsFor } from "../anchors";
import { lodCount, lodNow, noise1, resample, ring, strokeLine } from "../ink";
import { INK, hairTones, mixHex } from "../palette";
import {
  ClipDefs,
  P,
  ShapeDefs,
  bend,
  castBelow,
  coilyCluster,
  curlMark,
  extentOf,
  fadeRegion,
  hairStroke,
  hairline,
  hanging,
  last,
  lobe,
  lobedEdge,
  lockOutline,
  offset,
  resampleN,
  rnd,
  scalpRegion,
  shell,
  silhouetteInk,
  smooth,
  tuft,
  type HairArt,
  type HairInput,
} from "./core";

// ------------------------------------------------------------------ frosted faux hawk

/**
 * Short sides in tone on the scalp; a raised, textured crest down the middle that follows the skull's curve, highest
 * a little off centre, its top broken into irregular spikes that lean in towards the peak. The front edge breaks
 * into a few short spikes over the hairline. A second colour, if chosen, frosts the spike ends.
 */
export function fauxHawkHair(i: HairInput): HairArt {
  const { f, head, color, skin, uid, d, recede, seed, tip } = i;
  const T = hairTones(color, i.skin.base);
  const hl = hairline(f, head, "straight", recede, seed);
  let slot = 0;
  const r = (lo: number, hi: number) => rnd(seed + 71, slot++, lo, hi);
  const yS = f.ear.top - 6;
  // The crest: base half-width from the temples, height and peak position from the seed.
  const cw = f.templeW * 0.64;
  const peakX = CX + r(-5, 5);
  const H = 21 + r(0, 5);
  const spikes = Array.from({ length: 9 }, (_, k) => {
    const u = lerp(-0.84, 0.84, (k + r(0.2, 0.8)) / 9);
    return { u, a: r(8, 16) * (1 - Math.abs(u) * 0.3), w: r(0.07, 0.1), lean: -Math.sign(u) * r(1.5, 4.5) };
  });
  const lift = (x: number) => {
    const u = (x - peakX) / cw;
    if (Math.abs(u) >= 1) return { e: 0, lean: 0, sp: 0 };
    const dome = H * Math.pow(1 - Math.pow(Math.abs(u), 2.1), 1.4);
    let sum = 0;
    let lean = 0;
    for (const s of spikes) {
      const v = s.a * tuft((u - s.u) / s.w);
      if (v <= 0) continue;
      sum += v ** 3;
      lean += s.lean * v;
    }
    const sp = Math.cbrt(sum) * smooth((1 - Math.abs(u)) / 0.35);
    return { e: dome + sp, lean: lean / 8, sp };
  };
  const base = resample(shell(f, head, yS, 0.8, 1.6), 1.2);
  const outer: Pt[] = [];
  for (const p of base) {
    const { e, lean } = lift(p[0]);
    // The crest leans in towards its peak: hair is pushed up from both sides. Spikes lean but never fold back over
    // their neighbours (the edge keeps moving left to right).
    let x = e ? p[0] - Math.sign(p[0] - peakX) * e * 0.16 + lean : p[0];
    const prev = outer[outer.length - 1];
    if (e && prev && p[1] < f.top + 30 && x < prev[0] + 0.2) x = prev[0] + 0.2;
    outer.push(P(x, p[1] - e));
  }
  const iL = outer.findIndex((p, k) => Math.abs(base[k][0] - peakX) < cw);
  const iR = outer.length - 1 - outer.slice().reverse().findIndex((p, k) => Math.abs(base[outer.length - 1 - k][0] - peakX) < cw);
  const crestTop = outer.slice(Math.max(0, iL - 1), iR + 2);
  // Front edge: the hairline under the crest, breaking into short irregular spikes over the forehead.
  const front = hl.front.filter((p) => Math.abs(p[0] - peakX) < cw * 0.92);
  const hung = hanging(resample(front.slice().reverse(), 1.2), [
    { u: r(0.25, 0.35), w: 0.07, a: r(4, 7), lean: -1.5 },
    { u: r(0.48, 0.56), w: 0.08, a: r(6, 9), lean: 1 },
    { u: r(0.68, 0.76), w: 0.06, a: r(3, 5), lean: 2 },
  ]);
  const flank = (from: Pt, to: Pt, s: 1 | -1) => along([from, P(lerp(from[0], to[0], 0.5) + s * 3, lerp(from[1], to[1], 0.5)), to], 4);
  const region = [...crestTop, ...flank(last(crestTop), hung[0], 1).slice(1), ...hung.slice(1), ...flank(last(hung), crestTop[0], -1).slice(1, -1)];
  const regionD = ring(region);
  const clip = `${uid}fh`;
  const peak = crestTop.reduce((m, p) => (p[1] < m[1] ? p : m), crestTop[0]);

  // Flow: from the front edge up into the crest, converging on the peak.
  const flow = (u: number, reach: number) => {
    const b = hung[Math.round(clamp(u, 0, 1) * (hung.length - 1))];
    const top = P(lerp(b[0], peak[0], 0.55), peak[1] + 4);
    return [P(b[0], b[1] - 3), P(lerp(b[0], top[0], 0.4) + r(-2, 2), lerp(b[1], top[1], 0.5)), P(lerp(b[0], top[0], reach), lerp(b[1], top[1], reach))];
  };
  const seps: string[] = [];
  const lights: string[] = [];
  if (d > 0) {
    [0.2, 0.42, 0.63, 0.82].forEach((u, k) => {
      if (d === 1 && k % 2) return;
      seps.push(hairStroke(flow(u + r(-0.03, 0.03), r(0.6, 0.9)), { from: 0.1, to: 0.9, w: d === 2 ? 1.2 : 1.6, seed: seed + k, start: 0.8, end: 0.1 }));
    });
    [0.7, 0.85, 0.55].forEach((u, k) => {
      const path = flow(1 - u, 0.85);
      lights.push(hairStroke(path, { from: 0.25 + k * 0.05, to: 0.75, w: d === 2 ? 2.6 : 3, seed: seed + k + 20 }));
    });
  }
  // The right side of the crest turns away from the light.
  const split = along([P(lerp(hung[0][0], last(hung)[0], 0.4), hung[0][1] + 2), P(peakX + 4, lerp(peak[1], hl.y, 0.5)), P(peak[0] + 3, peak[1] - 4)], 4).map((p, k) => P(p[0] + noise1(seed + 9, k * 0.5) * 2, p[1]));
  const shade = ring([...split, P(CX + 140, peak[1] - 20), P(CX + 140, hl.y + 20)]);
  // Frosting: only some spikes (the taller ones, chosen by the seed) carry the second colour, from their tip part of
  // the way down; between them the crest keeps its own colour, so the frosting never runs round the top as a band.
  // A couple of the lit strands on the crest catch it too.
  const frost = tip
    ? (() => {
        const chosen = spikes.filter((sp, k) => sp.a > 6 && hash01(seed, k + 140) < 0.75);
        const caps: string[] = [];
        for (const sp of chosen) {
          const pts: Pt[] = [];
          const low: Pt[] = [];
          crestTop.forEach((p, k) => {
            const b = base[Math.max(0, iL - 1) + k];
            const u = (b[0] - peakX) / cw;
            const v = sp.a * tuft((u - sp.u) / sp.w);
            if (v < 1.2) return;
            pts.push(p);
            low.push(P(p[0], p[1] + v * 0.85 + 1.5 + noise1(seed + 4, k * 0.35)));
          });
          if (pts.length > 2) caps.push(ring([...pts, ...low.reverse()]));
        }
        const streaks = d > 0 ? [0.3, 0.62].map((u, k) => hairStroke(flow(u + (hash01(seed, k + 160) - 0.5) * 0.08, 0.92), { from: 0.62, to: 0.95, w: d === 2 ? 2 : 2.6, seed: seed + k + 150 })) : [];
        return { band: caps.join(""), streaks, tones: hairTones(tip) };
      })()
    : null;
  const sideTone = mixHex(color, skin.deep, 0.2);
  // Short sides: a close cap of hair just off the skull, from the hairline and temples, thinning downwards.
  const capOuter = shell(f, head, yS, 2.2, 2.8);
  const capTemple = (s: 1 | -1, end: Pt, temple: Pt[]) => [end, ...temple.filter((p) => p[1] < yS).reverse()];
  const cap = [...capOuter, ...capTemple(1, last(capOuter), hl.templeR).slice(1), ...hl.front.slice().reverse().slice(1), ...capTemple(-1, capOuter[0], hl.templeL).reverse().slice(1)];
  return {
    onSkin: (
      <g>
        {/* Below the cap the sides fade out down the temples. */}
        {fadeRegion(`${uid}fs`, ring(scalpRegion(hl, f)), sideTone, d, { y0: yS - 14, y1: last(hl.templeR)[1], o0: 0.6, o1: 0.08 })}
        <path d={castBelow(hung, 1.3, 3, f.top)} fill={skin.shade} opacity={0.6} />
      </g>
    ),
    mid: (
      <g>
        {fadeRegion(`${uid}fc`, ring(cap), sideTone, d === 2 ? 1 : d, { y0: f.top, y1: yS, o0: 0.96, mid: [0.5, 0.8], o1: 0.3 })}
        <path d={silhouetteInk(capOuter, d, seed + 6, [[0.04, 0.4], [0.6, 0.96]], 1.3)} fill={INK} opacity={0.8} />
        <ShapeDefs id={clip} d={regionD} />
        <use href={`#${clip}s`} fill={T.base} />
        <g clipPath={`url(#${clip})`}>
          <path d={shade} fill={T.shade} />
          <path d={ring([...hung, ...hung.slice().reverse().map((p) => P(p[0], p[1] - 5))])} fill={T.shade} opacity={0.7} />
          {seps.length > 0 && <path d={seps.join("")} fill={T.deep} opacity={0.75} />}
          {lights.length > 0 && <path d={lights.join("")} fill={T.light} opacity={0.7} />}
          {frost && (
            <g>
              <ClipDefs id={`${clip}f`} shapes={[frost.band]} />
              <path d={frost.band} fill={frost.tones.base} />
              {/* The frosted ends turn into shadow with the rest of the crest. */}
              <path d={shade} fill={frost.tones.shade} opacity={0.75} clipPath={`url(#${clip}f)`} />
              {frost.streaks.length > 0 && <path d={frost.streaks.join("")} fill={frost.tones.light} opacity={0.75} />}
            </g>
          )}
        </g>
        <path d={silhouetteInk(crestTop, d, seed + 5, [[0, 0.32], [0.38, 1]], 1.9)} fill={INK} />
      </g>
    ),
    extent: extentOf(outer),
    ears: "visible",
  };
}

// ------------------------------------------------------------------ ponytail

/**
 * Hair swept back from the forehead with a little controlled volume on top, sides flat above the ears, a strand or
 * two loose at one temple. Behind the skull it is gathered and tied; the tail shows beside the head on one side and
 * falls behind the shoulder. The tie sits where this head's hair outline is at tie height, so it moves with head size
 * and hair volume.
 */
export function ponytailHair(i: HairInput): HairArt {
  const { f, head, color, skin, uid, d, recede, seed, band } = i;
  const T = hairTones(color, i.skin.base);
  const hl = hairline(f, head, "mature", recede, seed);
  let slot = 0;
  const r = (lo: number, hi: number) => rnd(seed + 83, slot++, lo, hi);
  const ts: 1 | -1 = hash01(seed, 13) < 0.5 ? -1 : 1;
  const cornerL = hl.front[0];
  const cornerR = last(hl.front);
  const yS = f.ear.top - 3;
  const outer = shell(f, head, yS, 2.4 + (ts < 0 ? 1.2 : 0), 10 + r(0, 2), 2.4 + (ts > 0 ? 1.2 : 0));
  const extent = extentOf(outer);
  // Sides: swept back over the temples, ending just above the ear.
  const sideFront = (s: 1 | -1, end: Pt, corner: Pt, temple: Pt[]) => {
    const y = temple.filter((p) => p[1] < yS - 4);
    return along([end, P(CX + s * (head.half(yS - 6, s) - 2), yS - 6), ...y.slice(-2).reverse(), corner], 4);
  };
  const sR = sideFront(1, last(outer), cornerR, hl.templeR);
  const sL = sideFront(-1, outer[0], cornerL, hl.templeL);
  const region = [...outer, ...sR.slice(1), ...hl.front.slice().reverse().slice(1), ...sL.slice().reverse().slice(1)];
  const regionD = ring(region);
  const clip = `${uid}pt`;

  // Combed back: lines from the hairline running up and back to a point behind the crown, towards the tie.
  const vp = P(CX + ts * 18, f.top - 26);
  const comb = (u: number) => {
    const b = hl.front[Math.round(clamp(u, 0, 1) * (hl.front.length - 1))];
    return [P(b[0], b[1] + 0.5), P(lerp(b[0], vp[0], 0.35), lerp(b[1], vp[1], 0.42) - 3), P(lerp(b[0], vp[0], 0.7), lerp(b[1], vp[1], 0.75))];
  };
  const seps: string[] = [];
  const sheen: string[] = [];
  if (d > 0) {
    const us = d === 2 ? [0.08, 0.2, 0.33, 0.45, 0.57, 0.7, 0.82, 0.93] : [0.15, 0.38, 0.62, 0.85];
    us.forEach((u, k) => seps.push(hairStroke(comb(u + r(-0.02, 0.02)), { from: 0.02, to: r(0.6, 0.95), w: d === 2 ? 1.1 : 1.5, seed: seed + k, start: 0.8, end: 0.1, peak: 0.2 })));
    // Over the temples the hair is combed back towards the tie.
    for (const s of [-1, 1] as const) {
      const t = s > 0 ? hl.templeR : hl.templeL;
      for (let k = 0; k < (d === 2 ? 2 : 1); k++) {
        const p = t[Math.min(t.length - 1, 2 + k * 3)];
        seps.push(hairStroke([P(p[0] + s * 1, p[1]), P(p[0] + s * 5, p[1] - 10), P(p[0] + s * 8, p[1] - 22)], { from: 0, to: 1, w: 1.1, seed: seed + 30 + k, start: 0.7, end: 0.1 }));
      }
    }
    // Sheen: long streaks between the comb lines where the dome turns to the light, strongest on the lit side.
    us.slice(0, -1).forEach((u, k) => {
      const u2 = (u + us[k + 1]) / 2;
      if (u2 > 0.7 && k % 2) return;
      sheen.push(hairStroke(comb(u2), { from: 0.12 + r(0, 0.08), to: 0.55 + r(0, 0.12), w: (d === 2 ? 3.6 : 4.4) * (u2 < 0.55 ? 1.15 : 0.7), seed: seed + k + 10, peak: 0.45, start: 0.25, end: 0.2 }));
    });
  }
  const shadeR = ring([P(CX + 10, f.top - 30), P(CX + 22 + r(-3, 3), hl.y - 2), P(CX + 30, yS + 10), P(CX + 140, yS + 10), P(CX + 140, f.top - 30)]);

  // Loose strands vary from player to player: none, one or two; escaping at the temple opposite the tail or from
  // the front of the hairline; short or long, straight, curving in towards the face or flicking out.
  const ls: 1 | -1 = -ts as 1 | -1;
  const roll = hash01(seed, 14);
  const count = roll < 0.2 ? 0 : roll < 0.65 ? 1 : 2;
  const strands = Array.from({ length: count }, (_, k) => {
    // Along the hairline from the temple corner (0) towards the centre (0.45).
    const u = k === 0 ? (hash01(seed, 15) < 0.7 ? rnd(seed, 16, 0, 0.12) : rnd(seed, 16, 0.25, 0.42)) : rnd(seed, 17, 0.05, 0.2);
    const front = ls > 0 ? hl.front.slice().reverse() : hl.front;
    const root0 = front[Math.round(u * (front.length - 1))];
    const root = P(root0[0], root0[1] - 2);
    const len = rnd(seed, 18 + k, 24, 56) - k * 10;
    const curve = (hash01(seed, 20 + k) < 0.5 ? 1 : -1) * rnd(seed, 22 + k, 2, 6);
    const path = bend([root, P(root[0] + ls * 3, root[1] + len * 0.35), P(root[0] + ls * 2 + curve, root[1] + len * 0.7), P(root[0] + ls * 4 + curve * 1.6, root[1] + len)], seed + k, 2);
    return lockOutline(path, { w: rnd(seed, 24 + k, 2.8, 4) - k * 0.6, root: 0.7, peak: 0.25, tip: 0.1, wobble: 0.1, seed: seed + 40 + k });
  });

  // The tie and the tail, behind the skull: tied high at the back, so the tie and the gathered hair show just over
  // the top of the head, off centre; the tail springs up and out over the side of the head, then falls behind the
  // shoulder. Everything is placed from this hair's own outline, so it follows head size and volume.
  const topY = Math.min(...outer.map((p) => p[1]));
  const yTie = topY + 7 + r(-1.5, 1.5);
  const xTie = CX + ts * extent(yTie + 6, ts) * r(0.42, 0.52);
  // Clear of the side of the head: the tail hangs behind it, it is never stuck to it.
  const out = Math.max(extent(f.top + 24, ts), head.half(f.eyeY, ts)) + 22 + r(0, 6);
  const tailPath = bend([P(xTie - ts * 6, yTie + 10), P(xTie + ts * 6, yTie - 7), P(xTie + ts * 20, yTie - 9), P(CX + ts * (out + 4), f.top + 14), P(CX + ts * (out + 10), f.eyeY + 8), P(CX + ts * (head.half(f.jawY, ts) + 30 + r(0, 6)), f.jawY + 6), P(CX + ts * (f.neckW + 38 + r(0, 8)), 316)], seed + 3, 3);
  const tail = lockOutline(tailPath, { w: 30, root: 0.55, peak: 0.3, tip: 0.14, wobble: 0.06, swell: 0.18, seed: seed + 5 });
  const split = lockOutline(offset(tailPath.slice(3), ts * 6, -2), { w: 11, root: 1, peak: 0.2, tip: 0.1, seed: seed + 6 });
  const tailLight = hairStroke(offset(tailPath.slice(1), -ts * 5, 0), { from: 0.08, to: 0.6, w: d === 2 ? 3 : 3.6, seed: seed + 7 });
  const tailShade = lockOutline(offset(tailPath, ts * 7, 0), { w: 14, root: 0.5, peak: 0.3, tip: 0.1, seed: seed + 5 });
  // The tie: a short band round the gathered hair, in the headband colour, square to the tail where it leaves.
  const tieBand = (() => {
    const c = P(xTie + ts * 2, yTie - 4);
    const ax = P(ts * 0.8, -0.6);
    const ay = P(0.6, 0.8 * ts);
    const at = (u: number, v: number) => P(c[0] + ax[0] * u + ay[0] * v, c[1] + ax[1] * u + ay[1] * v);
    return ring(along([at(-3.5, -9), at(-4.2, 0), at(-3.5, 9), at(3.5, 9.5), at(4.2, 0), at(3.5, -9.5), at(-3.5, -9)], 3));
  })();
  const tieTones = hairTones(band);
  return {
    back: (
      <g>
        {d === 2 && <path d={ring(offset(tail, ts * 1.6, 2))} fill={T.deep} opacity={0.35} />}
        <path d={ring(tail)} fill={T.base} />
        {d > 0 && <path d={ring(tailShade)} fill={T.shade} opacity={0.7} />}
        <path d={ring(split)} fill={mixHex(T.base, T.shade, 0.5)} />
        {d > 0 && <path d={tailLight} fill={T.light} opacity={0.6} />}
        {/* Gathered hair bulges just past the tie. */}
        {/* Gathered hair bulging just past the tie. */}
        <path d={ring(lockOutline([P(xTie + ts * 5, yTie - 7), P(xTie + ts * 13, yTie - 12), P(xTie + ts * 22, yTie - 10)], { w: 20, root: 0.85, peak: 0.4, tip: 0.6, round: true, seed: seed + 8 }))} fill={mixHex(T.base, T.light, 0.12)} />
        {d > 0 && <path d={hairStroke([P(xTie + ts * 8, yTie - 15), P(xTie + ts * 15, yTie - 18), P(xTie + ts * 23, yTie - 14)], { from: 0, to: 1, w: 2.6, seed: seed + 9 })} fill={T.light} opacity={0.7} />}
        <path d={tieBand} fill={tieTones.base} stroke={INK} strokeWidth={d === 0 ? 1.8 : 1.1} strokeLinejoin="round" />
        <path d={silhouetteInk(tailPath.slice(1).map((p) => P(p[0] + ts * 9, p[1])), d, seed + 9, [[0.05, 0.8]], 1.6)} fill={INK} opacity={0.8} />
      </g>
    ),
    onSkin: (
      <g fill={skin.shade}>
        {/* Swept back, the hair barely shades the forehead: only a thin line under the hairline, and the strands. */}
        <path d={castBelow(hl.front.slice().reverse(), 0.8, 1.8, f.top)} opacity={0.45} />
        {strands.length > 0 && <path d={strands.map((s) => ring(offset(s, 1.5, 2))).join("")} opacity={0.5} />}
      </g>
    ),
    mid: (
      <g>
        <ShapeDefs id={clip} d={regionD} />
        <use href={`#${clip}s`} fill={T.base} />
        <g clipPath={`url(#${clip})`}>
          <path d={shadeR} fill={T.shade} opacity={0.85} />
          {seps.length > 0 && <path d={seps.join("")} fill={T.deep} opacity={0.6} />}
          {sheen.length > 0 && <path d={sheen.join("")} fill={T.light} opacity={0.8} />}
          {/* Darker just above the hairline, where the hair turns back. */}
          <path d={strokeLine(hl.front.map((p) => P(p[0], p[1] - 2)), { w: 3, start: 0.2, end: 0.2, seed: seed + 2 })} fill={T.shade} opacity={0.6} />
        </g>
        <path d={silhouetteInk(outer, d, seed + 5, [[0, 0.3], [0.37, 1]], 1.8)} fill={INK} />
        {strands.length > 0 && <path d={strands.map(ring).join("")} fill={T.base} />}
        {d > 0 && strands.length > 0 && <path d={strands.map((s) => ring(offset(s.slice(0, Math.floor(s.length / 2)), 0.6, 0))).join("")} fill={T.shade} opacity={0.5} />}
      </g>
    ),
    extent,
    ears: "visible",
  };
}

// ------------------------------------------------------------------ long curls with a headband

interface Corkscrew {
  /** A thin core lock holding the coils together, then the coils (seen from the front: overlapping lobes). */
  core: Pt[];
  coils: { c: Pt; rx: number; ry: number; rot: number }[];
  k: number;
}

/**
 * A corkscrew curl seen from the front: a chain of overlapping coils that swing a little from side to side and get
 * smaller towards the end, on a thin core so no gaps show between them.
 */
function corkscrew(path: readonly Pt[], o: { w: number; coils: number; swing: number; seed: number; k: number }): Corkscrew {
  const line = resampleN(along(path, 6), 40);
  const n = line.length;
  const coils: Corkscrew["coils"] = [];
  // Fewer, rounder coils at thumbnail size: the chain still reads as a curl, with a fraction of the geometry.
  const count = lodCount(o.coils, 3);
  const fat = lodNow() === 0 ? 1.2 : 1;
  for (let j = 0; j < count; j++) {
    const u = (j + 0.6) / count;
    const i = Math.min(n - 2, Math.round(u * (n - 1)));
    const t = unit(sub(line[i + 1], line[Math.max(0, i - 1)]));
    const side = (j % 2 ? 1 : -1) * (hash01(o.seed, j) < 0.2 ? -0.4 : 1);
    const rx = (o.w / 2) * fat * lerp(1, 0.62, u) * (0.9 + 0.2 * hash01(o.seed, j + 9));
    coils.push({ c: P(line[i][0] - t[1] * o.swing * side, line[i][1] + t[0] * o.swing * side), rx, ry: rx * (lodNow() === 0 ? 0.85 : 0.72), rot: Math.atan2(t[1], t[0]) + Math.PI / 2 });
  }
  return { core: lockOutline(path, { w: o.w * 0.55, root: 0.8, peak: 0.2, tip: 0.4, round: true, seed: o.seed }), coils, k: o.k };
}

const ellipse = (c: Pt, rx: number, ry: number, rot: number, from = 0, to = Math.PI * 2, steps = lodCount(14, 6)): Pt[] =>
  Array.from({ length: steps + 1 }, (_, i) => {
    const a = lerp(from, to, i / steps);
    const x = Math.cos(a) * rx;
    const y = Math.sin(a) * ry;
    return P(c[0] + x * Math.cos(rot) - y * Math.sin(rot), c[1] + x * Math.sin(rot) + y * Math.cos(rot));
  });

/**
 * Medium-long curls held back by a headband. Layers: the rear volume behind the head and ears (lobed, darker, falling
 * to the shoulders); the crown above the band and the hair over the temples tucked behind the ears; the band (its own
 * colour); and a few ringlets in front of it, two over the band and two or three falling beside the face.
 */
export function headbandCurlsHair(i: HairInput): HairArt {
  const { f, head, color, skin, uid, d, recede, seed, band } = i;
  const T = hairTones(color, i.skin.base);
  const a = anchorsFor(f, head);
  const hl = hairline(f, head, "rounded", recede, seed);
  let slot = 0;
  const r = (lo: number, hi: number) => rnd(seed + 97, slot++, lo, hi);
  const yBand = Math.max(a.foreheadTop[1] - 2, hl.y - 3);
  const yS = f.ear.top + 2;
  // Crown: a curly mass over the skull. The band squeezes it in a little where it passes; below the band the curls
  // spring out again.
  const crown = lobedEdge(shell(f, head, yS, 10 + r(0, 2), 21 + r(0, 3), 10 + r(0, 2)), { seed: seed + 1, spacing: [8, 14], amp: [1.8, 4], big: 0.3 }).map((p) => {
    const s = p[0] >= CX ? 1 : -1;
    const k = -5.5 * lobe((p[1] - yBand - 3) / 13) + 3 * smooth((p[1] - yBand - 10) / 22);
    return P(CX + s * Math.max(head.half(p[1], s) + 2, Math.abs(p[0] - CX) + k), p[1]);
  });
  const extent = extentOf(crown);
  // Over the temples the hair hugs the face and tucks behind the top of each ear.
  const sideIn = (s: 1 | -1, end: Pt) => {
    const yE = (s > 0 ? a.earR : a.earL).top[1] + 6;
    const x = (y: number) => CX + s * (head.half(y, s) - 4);
    return along([end, P(CX + s * (head.half(yE, s) + 1), yE), P(x(yE - 14), yE - 14), P(x(yBand + 12), yBand + 12), P(CX + s * f.templeW * 0.55, yBand + 4)], 4);
  };
  const sR = sideIn(1, last(crown));
  const sL = sideIn(-1, crown[0]);
  const region = [...crown, ...sR.slice(1), P(CX, yBand + 2), ...sL.slice().reverse().slice(0, -1)];
  const regionD = ring(region);
  const clip = `${uid}hb`;

  // Rear volume: behind the head from the temples to the shoulders, wider as it falls, its bottom in hanging curls.
  const rear = (s: 1 | -1): Pt[] => {
    const w = (y: number, k: number) => CX + s * (Math.max(extent(Math.min(y, yS), s), head.half(y, s)) + k);
    return [P(w(yBand, 2), yBand), P(w(yS, 14), yS), P(w(f.eyeY + 30, 30 + r(0, 6)), f.eyeY + 30), P(w(f.jawY, 36 + r(0, 6)), f.jawY), P(CX + s * (f.neckW + 52 + r(0, 8)), 300 + r(-14, 10))];
  };
  const rL = rear(-1);
  const rR = rear(1);
  const bottom = hanging(
    resample(along([last(rR), P(CX + 30, 318), P(CX - 30, 318), last(rL)], 4), 2),
    // Curl ends of uneven length: some short, a few hanging well below the rest.
    Array.from({ length: 8 }, (_, k) => ({ u: (k + 0.5) / 8 + r(-0.03, 0.03), w: r(0.05, 0.09), a: r(4, 16), lean: r(-2.5, 2.5) })),
  );
  const rearPts = lobedEdge(along([...rL.slice().reverse(), ...rR], 5), { seed: seed + 2, spacing: [10, 18], amp: [2.5, 6], big: 0.35, sign: -1 });
  const rearD = ring([...rearPts, ...bottom.slice(1, -1)]);

  // Light and shadow on the crown: lumpy masses, then a few curls at close-up size.
  const xs = crown.map((p) => p[0]);
  const top = Math.min(...crown.map((p) => p[1]));
  const cx = (Math.min(...xs) + Math.max(...xs)) / 2;
  const rx = (Math.max(...xs) - Math.min(...xs)) / 2;
  const lightC: string[] = [];
  const curls: string[] = [];
  if (d > 0) {
    for (let g = 0; g < (d === 2 ? 4 : 2); g++) {
      const th = lerp(3.5, 4.75, (g + 0.5) / 4) + r(-0.12, 0.12);
      const p = P(cx + Math.cos(th) * rx * 0.62, lerp(top, yBand, 0.55) + Math.sin(th) * (yBand - top) * 0.4);
      lightC.push(coilyCluster(p, r(5, 8), { seed: seed + g * 9, lobes: 5, squash: 0.65, rot: th + 1.57 }));
    }
    if (d === 2)
      for (let k = 0; k < 5; k++) curls.push(curlMark(P(lerp(cx - rx * 0.7, cx + rx * 0.7, (k + r(0.2, 0.8)) / 5), lerp(top + 8, yBand - 6, r(0.2, 0.8))), r(2, 3), { seed: seed + k, rot: r(0, 6.28) }));
  }
  // The rear volume is curls too: clusters of light down each side (more on the lit side), a few curls up close.
  const rearLights: string[] = [];
  const rearCurls: string[] = [];
  if (d > 0)
    for (const s of [-1, 1] as const)
      for (let k = 0; k < (s < 0 ? 4 : 3); k++) {
        const y = lerp(yS, f.jawY + 26, (k + 0.5) / 4);
        const c = P(CX + s * (head.half(Math.min(y, f.jawY), s) + 14 + r(0, 10)), y + r(-5, 5));
        rearLights.push(coilyCluster(c, r(5, 8), { seed: seed + 50 + k + (s > 0 ? 10 : 0), lobes: 4, squash: 0.7 }));
        if (d === 2 && k % 2 === 0) rearCurls.push(curlMark(P(c[0] + s * 8, c[1] + 9), r(2, 3), { seed: seed + 70 + k, rot: r(0, 6.28) }));
      }

  // Ringlets in front: two over the band, then two or three beside the face (more on one side).
  const more: 1 | -1 = hash01(seed, 15) < 0.5 ? -1 : 1;
  const curlsFront: Corkscrew[] = [];
  [r(0.3, 0.4), r(0.58, 0.68)].forEach((u, k) => {
    const x = lerp(CX - f.templeW * 0.6, CX + f.templeW * 0.6, u);
    const root = P(x, yBand - 9);
    const len = k === 0 ? r(38, 46) : r(26, 32);
    const dir = k === 0 ? -1 : 1;
    curlsFront.push(corkscrew([root, P(x + dir * 2, yBand + 8), P(x + dir * 5, root[1] + len)], { w: 15, coils: Math.max(4, Math.round(len / 6)), swing: 2, seed: seed + k, k }));
  });
  for (const s of [-1, 1] as const) {
    const n = s === more ? 2 : 1;
    for (let j = 0; j < n; j++) {
      const yR = yBand + 10 + j * 8;
      const root = P(CX + s * (head.half(yR, s) - 7 - j * 3), yR);
      const end = lerp(f.mouthY, f.jawY + 6, r(0, 1)) - j * 16;
      // The first falls just in front of the ear's front edge (the ear shows beside it); a second one lies further out.
      const x2 = CX + s * (head.half(f.eyeY + 20, s) - 1 + j * 9);
      const len = end - yR;
      curlsFront.push(corkscrew([root, P(x2, lerp(yR, end, 0.4)), P(x2 + s * r(0, 5), end)], { w: 15.5 + r(0, 2.5), coils: Math.max(5, Math.round(len / 6.5)), swing: 2.6 + r(0, 1.2), seed: seed + 20 + j + (s > 0 ? 5 : 0), k: 10 + j + (s > 0 ? 5 : 0) }));
    }
  }
  // Behind: a few corkscrews in the rear volume, so it reads as curls (not a mass), their ends hanging out of its
  // lower edge at different lengths. Close-up sizes only.
  const rearCoils: Corkscrew[] = [];
  if (d > 0)
    for (const s of [-1, 1] as const)
      for (let j = 0; j < (s === more ? 3 : 2); j++) {
        const y0 = lerp(yS, f.jawY, j / 3) + r(-4, 6);
        const x0 = CX + s * (head.half(Math.min(y0, f.jawY), s) + 12 + j * 9 + r(0, 5));
        const y1 = 296 + r(-16, 18) - j * 6;
        rearCoils.push(corkscrew([P(x0, y0), P(x0 + s * r(2, 8), lerp(y0, y1, 0.5)), P(x0 + s * r(4, 14), y1)], { w: 14 + r(0, 3), coils: Math.max(5, Math.round((y1 - y0) / 7)), swing: 2.4, seed: seed + 60 + j + (s > 0 ? 7 : 0), k: 40 + j + (s > 0 ? 7 : 0) }));
      }

  // Where the band runs into the side hair, curls spring out over its ends, so it disappears into the hair.
  const tufts: { c: Pt; r: number; k: number }[] = [];
  for (const s of [-1, 1] as const) {
    const x = CX + s * (head.half(yBand + 5, s) + 3);
    tufts.push({ c: P(x + s * r(0, 3), yBand + 4 + r(-2, 2)), r: r(5.5, 7.5), k: s > 0 ? 1 : 0 });
    if (hash01(seed, s > 0 ? 17 : 18) < 0.6) tufts.push({ c: P(x + s * r(5, 8), yBand + r(8, 13)), r: r(4, 5.5), k: s > 0 ? 3 : 2 });
  }
  const tuftD = tufts.map((t) => coilyCluster(t.c, t.r, { seed: seed + 200 + t.k, lobes: 4, squash: 0.85 }));
  const tuftShade = tufts.map((t) => coilyCluster(P(t.c[0] + t.r * 0.35, t.c[1] + t.r * 0.35), t.r * 0.7, { seed: seed + 210 + t.k, lobes: 3, squash: 0.8 }));
  // Each coil: its body, a dark crescent where it turns under (lower edge), a light where it faces up to the light.
  const curlArt = (c: Corkscrew, behind = false) => {
    const bodies = c.coils.map((q) => ring(ellipse(q.c, q.rx, q.ry, q.rot)));
    const under = c.coils.map((q) => ring([...ellipse(q.c, q.rx, q.ry, q.rot, 0.15, Math.PI - 0.15, 8), ...ellipse(P(q.c[0] - Math.sin(q.rot) * -q.ry * 0.35, q.c[1] + Math.cos(q.rot) * -q.ry * 0.35), q.rx * 0.85, q.ry * 0.6, q.rot, Math.PI - 0.3, 0.3, 8)]));
    const lit = c.coils.map((q) => ring(ellipse(P(q.c[0] - q.rx * 0.25 + Math.sin(q.rot) * q.ry * 0.3, q.c[1] - Math.cos(q.rot) * q.ry * 0.3), q.rx * 0.42, q.ry * 0.3, q.rot - 0.3, 0, Math.PI * 2, 8)));
    return (
      <g key={c.k}>
        {d === 2 && !behind && <path d={[ring(offset(c.core, 1.3, 1.6)), ...c.coils.map((q) => ring(ellipse(P(q.c[0] + 1.3, q.c[1] + 1.6), q.rx, q.ry, q.rot)))].join("")} fill={T.deep} opacity={0.35} />}
        <path d={ring(c.core)} fill={behind ? T.deep : T.shade} />
        <path d={bodies.join("")} fill={behind ? mixHex(T.base, T.shade, 0.45) : T.base} />
        {d > 0 && <path d={under.join("")} fill={T.deep} opacity={0.55} />}
        {d > 0 && <path d={lit.join("")} fill={T.light} opacity={behind ? 0.25 : d === 2 ? 0.55 : 0.4} />}
      </g>
    );
  };
  return {
    back: (
      <g>
        <path d={rearD} fill={mixHex(T.shade, T.deep, 0.2)} />
        {rearLights.length > 0 && <path d={rearLights.join("")} fill={T.base} opacity={0.9} />}
        {rearCoils.map((c) => curlArt(c, true))}
        {rearCurls.length > 0 && <path d={rearCurls.join("")} fill={T.light} opacity={0.5} />}
        <path d={silhouetteInk([...rearPts.slice(0, Math.floor(rearPts.length * 0.42))], d, seed + 3, [[0.05, 1]], 1.6)} fill={INK} opacity={0.85} />
        <path d={silhouetteInk([...rearPts.slice(Math.ceil(rearPts.length * 0.58))], d, seed + 4, [[0, 0.95]], 1.6)} fill={INK} opacity={0.85} />
      </g>
    ),
    onSkin: (
      <g fill={skin.shade}>
        <path d={castBelow(along([P(CX - 90, yBand + 9), P(CX, yBand + 12), P(CX + 90, yBand + 9)], 3), 0.5, 2.5, f.top)} opacity={0.55} />
        <path d={curlsFront.map((c) => [ring(offset(c.core, 1.8, 2.6)), ...(d === 0 ? [] : c.coils.map((q) => ring(ellipse(P(q.c[0] + 1.8, q.c[1] + 2.6), q.rx, q.ry, q.rot, 0, Math.PI * 2, 8))))].join("")).join("")} opacity={0.5} />
      </g>
    ),
    mid: (
      <g>
        <ShapeDefs id={clip} d={regionD} />
        <use href={`#${clip}s`} fill={mixHex(T.shade, T.deep, 0.2)} />
        <g clipPath={`url(#${clip})`}>
          <path d={ring(crown.map((p) => P(cx - 6 + (p[0] - cx) * 0.82, top + 2 + (p[1] - top) * 0.78)))} fill={T.base} />
          {lightC.length > 0 && <path d={lightC.join("")} fill={mixHex(T.base, T.light, 0.5)} opacity={0.9} />}
          {curls.length > 0 && <path d={curls.join("")} fill={T.deep} opacity={0.5} />}
        </g>
        <path d={silhouetteInk(crown, d, seed + 5, [[0, 0.25], [0.31, 1]], 1.8)} fill={INK} />
      </g>
    ),
    band: HeadbandNext({ head, a, color: band, d, extent, y: yBand, h: 11 }),
    front: (
      <g>
        <path d={tuftD.join("")} fill={T.base} />
        {d > 0 && <path d={tuftShade.join("")} fill={T.shade} opacity={0.7} />}
        {curlsFront.map((c) => curlArt(c))}
      </g>
    ),
    extent,
    ears: "partial",
  };
}
