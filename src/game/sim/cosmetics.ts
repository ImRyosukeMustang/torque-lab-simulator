// Visual customisation choices. Pure data: no effect on the engine simulation (wheel weight only matters on the drag strip).
export type PaintFinish = "gloss" | "metallic" | "pearl" | "satin" | "matte";
export type RimStyle = "five" | "mesh" | "dish" | "turbine";
export type StripeStyle = "none" | "twin" | "center" | "side";

export interface Cosmetics {
  paint: string;
  finish: PaintFinish;
  rimStyle: RimStyle;
  rimColor: string;
  caliper: string;
  stripe: StripeStyle;
  stripeColor: string;
  /** Window tint 0 (light) .. 1 (limo). */
  tint: number;
}

export const DEFAULT_COSMETICS: Cosmetics = {
  paint: "#9e3b1a",
  finish: "metallic",
  rimStyle: "five",
  rimColor: "#9ea3a8",
  caliper: "#c58a1c",
  stripe: "none",
  stripeColor: "#e6e7e3",
  tint: 0.6,
};

export const PAINT_PRESETS: { name: string; hex: string }[] = [
  { name: "Ember Copper", hex: "#9e3b1a" },
  { name: "Rosso Fuoco", hex: "#a8121a" },
  { name: "Signal Orange", hex: "#d9541a" },
  { name: "Solar Yellow", hex: "#d8a915" },
  { name: "Circuit Green", hex: "#1e4a33" },
  { name: "Petrol Teal", hex: "#195a62" },
  { name: "Midnight Blue", hex: "#16264a" },
  { name: "Riviera Blue", hex: "#2b67b0" },
  { name: "Glacier White", hex: "#e6e7e3" },
  { name: "Silverstone", hex: "#a7abb0" },
  { name: "Gunmetal", hex: "#43484e" },
  { name: "Obsidian Black", hex: "#101113" },
];

export const RIM_COLORS: { name: string; hex: string }[] = [
  { name: "Silver", hex: "#9ea3a8" },
  { name: "Gloss Black", hex: "#16171a" },
  { name: "Gunmetal", hex: "#4b5056" },
  { name: "Bronze", hex: "#8a6a3a" },
  { name: "Gold", hex: "#b89234" },
  { name: "White", hex: "#e4e5e2" },
];

export const CALIPER_COLORS: { name: string; hex: string }[] = [
  { name: "Yellow", hex: "#c58a1c" },
  { name: "Red", hex: "#b3221a" },
  { name: "Blue", hex: "#2758a8" },
  { name: "Green", hex: "#2f7a3e" },
  { name: "Black", hex: "#1b1c1e" },
  { name: "Silver", hex: "#a7abb0" },
];

export const FINISH_LABEL: Record<PaintFinish, string> = {
  gloss: "Solid gloss",
  metallic: "Metallic",
  pearl: "Pearlescent",
  satin: "Satin",
  matte: "Matte",
};

/** Weight of one wheel by style (kg). Wheels are unsprung, rotating mass, so lighter ones launch harder in a race. */
export const RIM_MASS_KG: Record<RimStyle, number> = { five: 9.5, mesh: 7.8, dish: 11.6, turbine: 10.3 };
/** Short note shown next to each wheel style. */
export const RIM_NOTE: Record<RimStyle, string> = { five: "cast, 9.5 kg", mesh: "forged, 7.8 kg", dish: "deep cast, 11.6 kg", turbine: "flow-formed, 10.3 kg" };

export const RIM_LABEL: Record<RimStyle, string> = {
  five: "5-spoke",
  mesh: "Cross mesh",
  dish: "Deep dish",
  turbine: "Turbine",
};

export const STRIPE_LABEL: Record<StripeStyle, string> = {
  none: "None",
  twin: "Twin stripes",
  center: "Centre stripe",
  side: "Side flash",
};

/** Euclidean RGB distance between two #rrggbb colours (0 = identical, ~441 = black vs white). */
export function colorDistance(a: string, b: string): number {
  const rgb = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const [r1, g1, b1] = rgb(a);
  const [r2, g2, b2] = rgb(b);
  return Math.hypot(r1! - r2!, g1! - g2!, b1! - b2!);
}
