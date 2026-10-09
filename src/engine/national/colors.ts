import type { CountryCode } from "../types";

const LIGHT = "#1b1712";
const WHITE = "#ffffff";

/** Home-shirt background and a readable text colour for every simulated nation. */
const NATION_KIT: Record<string, { bg: string; fg: string }> = {
  ENG: { bg: "#f5f5f5", fg: "#1c2a6b" },
  ESP: { bg: "#c8102e", fg: "#ffc400" },
  GER: { bg: "#f2f2f2", fg: LIGHT },
  ITA: { bg: "#0a5ab4", fg: WHITE },
  FRA: { bg: "#1b3a8a", fg: WHITE },
  SCO: { bg: "#0b2a6f", fg: WHITE },
  WAL: { bg: "#c8102e", fg: WHITE },
  NIR: { bg: "#1c8a3c", fg: WHITE },
  IRL: { bg: "#169b62", fg: WHITE },
  POR: { bg: "#a4161a", fg: "#ffd500" },
  NED: { bg: "#f26b1d", fg: LIGHT },
  BEL: { bg: "#c8102e", fg: "#ffd500" },
  SUI: { bg: "#d52b1e", fg: WHITE },
  AUT: { bg: "#d52b1e", fg: WHITE },
  DEN: { bg: "#c8102e", fg: WHITE },
  SWE: { bg: "#f7c600", fg: "#00529b" },
  NOR: { bg: "#c8102e", fg: WHITE },
  POL: { bg: "#f2f2f2", fg: "#c8102e" },
  CRO: { bg: "#d8232a", fg: WHITE },
  SRB: { bg: "#b5121b", fg: WHITE },
  CZE: { bg: "#c8102e", fg: WHITE },
  TUR: { bg: "#e30a17", fg: WHITE },
  UKR: { bg: "#ffd500", fg: "#0057b8" },
  BRA: { bg: "#f7d117", fg: "#00853f" },
  ARG: { bg: "#74acdf", fg: LIGHT },
  URU: { bg: "#6cb8e6", fg: LIGHT },
  COL: { bg: "#fcd116", fg: "#003893" },
  MEX: { bg: "#006847", fg: WHITE },
  USA: { bg: "#1b2a5e", fg: WHITE },
  CAN: { bg: "#d52b1e", fg: WHITE },
  SEN: { bg: "#00853f", fg: "#fdef42" },
  CIV: { bg: "#f77f00", fg: WHITE },
  NGA: { bg: "#008751", fg: WHITE },
  GHA: { bg: "#f2f2f2", fg: "#006b3f" },
  CMR: { bg: "#007a5e", fg: "#fcd116" },
  MAR: { bg: "#c1272d", fg: "#006233" },
  ALG: { bg: "#f2f2f2", fg: "#006233" },
  EGY: { bg: "#ce1126", fg: WHITE },
  JPN: { bg: "#1b3a8a", fg: WHITE },
  KOR: { bg: "#c60c30", fg: WHITE },
  AUS: { bg: "#f7c600", fg: "#00573f" },
};

/** Shirt colours for a nation, or undefined when none are known (callers keep the default button). */
export const nationKit = (code: CountryCode | undefined) => (code ? NATION_KIT[code] : undefined);
