/** Name normalisation helpers shared by the import pipeline. */

const STOP_TOKENS = new Set([
  "fc", "afc", "cf", "sc", "ac", "as", "ss", "ssc", "us", "fk", "sv", "vfb", "vfl", "tsg", "bsc", "rcd", "ca", "cd", "ud", "sd", "rc",
  "club", "football", "futbol", "fútbol", "calcio", "de", "del", "la", "le", "the", "1899", "1900", "1904", "1907", "1909", "1913",
  "1919", "1846", "1892", "1898", "05", "04", "07", "1", "e", "v", "and", "&", "olympique", "stade", "association", "sportiva",
  "società", "sportive", "balompié", "deportivo", "deportiva", "real", "f", "c", "a", "s", "sad", "spa", "srl", "uc", "ssd", "lr", "acf", "asd", "usl", "ogc", "sco", "es", "ac",
]);

export function stripAccents(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "");
}

/** Loose key for cross-source matching: "Manchester United F.C." -> "manchester united". */
export function nameKey(name: string): string {
  const tokens = stripAccents(name)
    .toLowerCase()
    .replace(/['’`.]/g, "")
    .replace(/[^a-z0-9& ]+/g, " ")
    .split(/\s+/)
    .filter((t) => t && !/^\d{2,4}$/.test(t));
  const kept = tokens.filter((t) => !STOP_TOKENS.has(t));
  return (kept.length ? kept : tokens).join(" ");
}

export function slugify(s: string): string {
  return stripAccents(s)
    .toLowerCase()
    .replace(/['’`.]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Strip legal/club suffixes for display: "Arsenal F.C." -> "Arsenal". */
export function displayName(label: string): string {
  return label
    .replace(/\s+(F\.?C\.?|A\.?F\.?C\.?|C\.?F\.?|S\.?C\.?)$/i, "")
    .replace(/^(F\.?C\.?|A\.?C\.?|S\.?S\.?C\.?)\s+/i, (m) => m)
    .trim();
}

export function makeAbbreviation(name: string, taken: Set<string>): string {
  const words = stripAccents(name)
    .toUpperCase()
    .replace(/[^A-Z0-9 ]/g, " ")
    .split(/\s+/)
    .filter((w) => w && !["FC", "AFC", "CF", "SC", "AC", "SSC", "US", "CD", "UD", "SD", "RC", "FK", "SV", "VFB", "VFL", "TSG", "DE", "DEL", "LA", "LE", "THE", "1", "RCD"].includes(w) && !/^\d+$/.test(w));
  const candidates: string[] = [];
  if (words.length >= 3) candidates.push(words.slice(0, 3).map((w) => w[0]).join(""));
  if (words.length >= 2) {
    candidates.push(words[0].slice(0, 2) + words[1][0]);
    candidates.push(words[0][0] + words[1].slice(0, 2));
  }
  if (words[0]) {
    candidates.push(words[0].slice(0, 3));
    candidates.push(words[0][0] + words[0].slice(-2));
  }
  for (const c of candidates) {
    if (c.length === 3 && !taken.has(c)) {
      taken.add(c);
      return c;
    }
  }
  const base = (words[0] ?? "CLB").slice(0, 2).padEnd(2, "X");
  for (let i = 0; i < 36; i++) {
    const c = base + i.toString(36).toUpperCase();
    if (!taken.has(c)) {
      taken.add(c);
      return c;
    }
  }
  throw new Error(`cannot abbreviate ${name}`);
}

const COLOR_NAMES: Record<string, string> = {
  red: "#c8102e", white: "#f4f1ea", black: "#141414", blue: "#1d4fa3", "royal blue": "#1b3fa0", "navy blue": "#14213d", navy: "#14213d",
  "sky blue": "#6cabdd", "light blue": "#7cb7e3", "dark blue": "#0d2c6b", yellow: "#f6c700", gold: "#d4a017", green: "#1f7a3a",
  "dark green": "#0f4d2a", orange: "#f26b1d", purple: "#5b2a86", claret: "#7a1f3d", bordeaux: "#6d1a36", maroon: "#6b1d2e",
  amber: "#f4a300", grey: "#8a8d91", gray: "#8a8d91", silver: "#b9bcc0", granata: "#7b1e2b", garnet: "#7b1e2b", violet: "#6b3fa0",
  crimson: "#a6192e", "cherry red": "#b3001b", "wine red": "#7a1631", azure: "#2a7fd4", turquoise: "#20b2aa", pink: "#e88fb4",
  burgundy: "#7a1f3d", "dark red": "#8b0000", "light green": "#5fbf6b", cyan: "#3fb7d6", lime: "#9acd32", brown: "#6f4e37",
  "old gold": "#cfb53b", cream: "#efe6cf", teal: "#1f7f7f", "midnight blue": "#191970", "celeste": "#89c2e8",
};

export function colorToHex(label: string | undefined, hex: string | undefined): string | undefined {
  if (hex && /^[0-9a-f]{6}$/i.test(hex)) return `#${hex.toLowerCase()}`;
  if (!label) return undefined;
  return COLOR_NAMES[label.toLowerCase().trim()];
}

function luminance(hex: string): number {
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}

/** Choose primary/secondary from an unordered colour set: prefer a saturated colour as primary. */
export function pickColors(colors: string[], seedName: string): { primary: string; secondary: string } {
  const uniq = [...new Set(colors)];
  const neutral = (h: string) => {
    const l = luminance(h);
    return l > 0.88 || l < 0.12;
  };
  const strong = uniq.filter((c) => !neutral(c));
  const neutrals = uniq.filter(neutral);
  let primary = strong[0] ?? neutrals[0];
  let secondary = strong[1] ?? neutrals.find((c) => c !== primary) ?? undefined;
  if (!primary) {
    // Deterministic fallback palette for clubs without recorded colours.
    const palette = ["#1d4fa3", "#c8102e", "#1f7a3a", "#f6c700", "#5b2a86", "#f26b1d", "#14213d", "#7a1f3d"];
    let h = 0;
    for (const ch of seedName) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
    primary = palette[h % palette.length];
  }
  if (!secondary) secondary = luminance(primary) > 0.6 ? "#141414" : "#f4f1ea";
  return { primary, secondary };
}
