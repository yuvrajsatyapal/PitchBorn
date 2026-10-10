import assets from "./career-assets.json";

export type StageKey = keyof typeof assets;

export interface Stage {
  key: StageKey;
  label: string;
  caption: string;
  /** Where the frame keeps the artwork when its aspect ratio differs from the source's (the subject's head and number). */
  position: string;
  /** Zoom pivot for the slow push-in, as a percentage of the frame. */
  origin: string;
  /** Tint of the soft light wash, as "r g b" so CSS can mix its own alpha. */
  glow: string;
}

export const STAGES: Stage[] = [
  {
    key: "academy",
    label: "Academy",
    caption: "A young prospect watches training at the academy.",
    position: "56% 50%",
    origin: "56% 40%",
    glow: "255 200 100",
  },
  {
    key: "debut",
    label: "Debut",
    caption: "A first professional appearance under the floodlights.",
    position: "50% 50%",
    origin: "50% 45%",
    glow: "230 240 255",
  },
  { key: "transfer", label: "Transfer", caption: "A big move to a new club, landing at sunset.", position: "50% 10%", origin: "55% 15%", glow: "255 160 80" },
  {
    key: "trophies",
    label: "Trophies",
    caption: "A championship trophy lifted high amid the confetti.",
    position: "50% 0%",
    origin: "50% 0%",
    glow: "255 215 110",
  },
  {
    key: "legend",
    label: "Legend",
    caption: "A veteran reflects on his career as the sun goes down.",
    position: "50% 35%",
    origin: "55% 35%",
    glow: "255 140 70",
  },
];
