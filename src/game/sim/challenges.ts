// Engineering challenges as data. Grading reads only the SimResult + Build,
// so the dyno, the workshop and the career screen can never disagree.
import { sampleCurve } from "./engine";
import { colorDistance, FINISH_LABEL, RIM_LABEL, STRIPE_LABEL, type Cosmetics, type PaintFinish, type RimStyle, type StripeStyle } from "./cosmetics";
import { findPart, getPart } from "./parts";
import type { Build, DriveLayout, SimResult, TransmissionType } from "./types";

export type Grade = "bronze" | "silver" | "gold";
export const GRADE_RANK: Record<Grade, number> = { bronze: 1, silver: 2, gold: 3 };

export type MetricKind = "peakHp" | "torqueAt" | "reliability" | "zeroTo100" | "topSpeed" | "quarterMile";

/** A client's requested look. Matching it pays a one-off bonus on top of the grade reward. */
export interface StyleBrief {
  summary: string;
  paint?: { hex: string; name: string; maxDistance: number };
  finish?: PaintFinish[];
  rimStyle?: RimStyle[];
  rimColor?: { hex: string; name: string; maxDistance: number };
  stripe?: StripeStyle[];
  bonus: number;
}

export interface Challenge {
  id: string;
  level: number;
  title: string;
  brief: string;
  skills: string[];
  constraints: {
    maxBudget: number;
    minReliability: number;
    minPeakHp?: number;
    minTorqueAt?: { rpm: number; nm: number };
    maxEgtC?: number;
    aspiration?: "na" | "turbo";
    /** A part that must be installed (e.g. a fuel type). */
    requirePart?: string;
    maxZeroTo100S?: number;
    minTopSpeedKmh?: number;
    maxQuarterMileS?: number;
    layout?: DriveLayout;
    transmission?: TransmissionType[];
  };
  /** lowerIsBetter metrics (times) grade silver/gold when at or below the threshold. */
  metric: { kind: MetricKind; rpm?: number; label: string; unit: string; silver: number; gold: number; lowerIsBetter?: boolean };
  reward: Record<Grade, number>;
  style?: StyleBrief;
}

export const CHALLENGES: Challenge[] = [
  {
    id: "c1",
    level: 1,
    title: "More Air, More Power",
    brief: "The AM-20 breathes through a restrictive airbox and a quiet factory exhaust. Free up the airflow and prove the gain on the dyno, without forced induction.",
    skills: ["Airflow", "Intake restriction", "Dyno testing"],
    constraints: { maxBudget: 1800, minReliability: 95, minPeakHp: 160, aspiration: "na" },
    metric: { kind: "peakHp", label: "Peak power", unit: "hp", silver: 165, gold: 170 },
    reward: { bronze: 1500, silver: 2200, gold: 3000 },
  },
  {
    id: "c2",
    level: 2,
    title: "Cam Theory",
    brief: "A client wants a sharper naturally aspirated engine that still pulls cleanly out of hairpins. Find top-end power without losing the low-end torque.",
    skills: ["Volumetric efficiency", "Valve timing", "Power band"],
    constraints: { maxBudget: 3500, minReliability: 90, minPeakHp: 180, minTorqueAt: { rpm: 3000, nm: 180 }, aspiration: "na" },
    metric: { kind: "peakHp", label: "Peak power", unit: "hp", silver: 185, gold: 188 },
    reward: { bronze: 2500, silver: 3500, gold: 4500 },
    style: { summary: "Club racer livery: Rosso Fuoco red with twin stripes.", paint: { hex: "#a8121a", name: "Rosso Fuoco", maxDistance: 70 }, stripe: ["twin"], bonus: 800 },
  },
  {
    id: "c3",
    level: 3,
    title: "First Boost",
    brief: "Fit a turbocharger and make 250 hp. The turbo is only the start: the fuel system, the charge temperature and the tune all have to keep up.",
    skills: ["Forced induction", "Fuel delivery", "Charge cooling"],
    constraints: { maxBudget: 6000, minReliability: 85, minPeakHp: 250, aspiration: "turbo" },
    metric: { kind: "peakHp", label: "Peak power", unit: "hp", silver: 270, gold: 285 },
    reward: { bronze: 4000, silver: 5500, gold: 7000 },
  },
  {
    id: "c4",
    level: 4,
    title: "Mountain Pass Torque",
    brief: "A rally-stage customer needs instant response out of tight corners. Deliver big torque at 3000 rpm and keep the engine durable for long stages.",
    skills: ["Turbo spool", "Boost curve", "Reliability"],
    constraints: { maxBudget: 7000, minReliability: 90, minTorqueAt: { rpm: 3000, nm: 320 } },
    metric: { kind: "torqueAt", rpm: 3000, label: "Torque @ 3000 rpm", unit: "Nm", silver: 340, gold: 360 },
    reward: { bronze: 5000, silver: 6500, gold: 8000 },
    style: { summary: "Rally-stage look: Glacier White body on gold wheels.", paint: { hex: "#e6e7e3", name: "Glacier White", maxDistance: 60 }, rimColor: { hex: "#b89234", name: "Gold", maxDistance: 60 }, bonus: 1500 },
  },
  {
    id: "c5",
    level: 5,
    title: "The Complete Package",
    brief: "The flagship build. Big power, but the engine must survive a 24-hour endurance programme: exhaust temperatures and stress have to stay in check.",
    skills: ["Complete optimisation", "Thermal management", "Cylinder pressure"],
    constraints: { maxBudget: 15000, minReliability: 80, minPeakHp: 360, maxEgtC: 940, aspiration: "turbo" },
    metric: { kind: "peakHp", label: "Peak power", unit: "hp", silver: 385, gold: 400 },
    reward: { bronze: 8000, silver: 11000, gold: 15000 },
  },
  {
    id: "c6",
    level: 6,
    title: "Atmospheric Peak",
    brief: "A hill-climb privateer wants razor throttle response: no turbo allowed. Squeeze every horsepower from compression, cam timing, fuel quality and exhaust flow.",
    skills: ["Compression ratio", "Octane and ignition", "Exhaust scavenging"],
    constraints: { maxBudget: 10000, minReliability: 95, minPeakHp: 230, aspiration: "na" },
    metric: { kind: "peakHp", label: "Peak power", unit: "hp", silver: 233, gold: 235 },
    reward: { bronze: 9000, silver: 12000, gold: 15000 },
    style: { summary: "Hill-climb privateer: Circuit Green in a satin or matte finish, cross-mesh wheels.", paint: { hex: "#1e4a33", name: "Circuit Green", maxDistance: 70 }, finish: ["satin", "matte"], rimStyle: ["mesh"], bonus: 2500 },
  },
  {
    id: "c7",
    level: 7,
    title: "Ethanol Era",
    brief: "A time-attack team runs on E85. Convert the fuel system, build the bottom end and make serious power while keeping exhaust temperatures inside the endurance limit. Over 500 Nm will also slip the stock clutch and strip the road gearbox.",
    skills: ["Alternative fuels", "Fuel system sizing", "Forged internals"],
    constraints: { maxBudget: 26000, minReliability: 90, minPeakHp: 480, maxEgtC: 920, aspiration: "turbo", requirePart: "fuel-e85" },
    metric: { kind: "peakHp", label: "Peak power", unit: "hp", silver: 505, gold: 512 },
    reward: { bronze: 12000, silver: 16000, gold: 20000 },
  },

  // Chapter 2 — Drivetrain engineering
  {
    id: "c8",
    level: 8,
    title: "Launch Control",
    brief: "A drag-strip client measures one number: 0-100 km/h. Power is useless if the tyres spin it away. Gear it, lock the axle, get the clutch to hold, and put the torque down.",
    skills: ["Traction", "Gearing", "Clutch capacity", "Differentials"],
    constraints: { maxBudget: 38000, minReliability: 85, maxZeroTo100S: 4.6 },
    metric: { kind: "zeroTo100", label: "0-100 km/h", unit: "s", silver: 3.7, gold: 3.4, lowerIsBetter: true },
    reward: { bronze: 14000, silver: 18000, gold: 23000 },
    style: { summary: "Stealth spec: Obsidian Black, matte finish, centre stripe.", paint: { hex: "#101113", name: "Obsidian Black", maxDistance: 45 }, finish: ["matte"], stripe: ["center"], bonus: 4000 },
  },
  {
    id: "c9",
    level: 9,
    title: "Autobahn Express",
    brief: "A grand-touring client wants a 270 km/h cruiser that stays reliable at full throttle for hours. Top speed is power against drag, but only if the gearing lets the engine reach its power peak in top gear.",
    skills: ["Top speed", "Final drive", "Aerodynamic drag", "Thermal load"],
    constraints: { maxBudget: 30000, minReliability: 90, minTopSpeedKmh: 270, maxEgtC: 930 },
    metric: { kind: "topSpeed", label: "Top speed", unit: "km/h", silver: 315, gold: 330 },
    reward: { bronze: 15000, silver: 19000, gold: 24000 },
  },
  {
    id: "c10",
    level: 10,
    title: "Front-Drive Hot Hatch",
    brief: "A touring-car team is homologating a front-drive version. Weight comes off the front tyres when you accelerate, and too much torque steers the car. Find the balance on a tight budget.",
    skills: ["Front-wheel drive", "Torque steer", "Weight transfer", "Budget"],
    constraints: { maxBudget: 16000, minReliability: 90, maxZeroTo100S: 6.8, layout: "fwd" },
    metric: { kind: "zeroTo100", label: "0-100 km/h", unit: "s", silver: 6.4, gold: 6.1, lowerIsBetter: true },
    reward: { bronze: 12000, silver: 15000, gold: 19000 },
    style: { summary: "Hot-hatch heritage: Signal Orange or Solar Yellow on gloss-black wheels.", paint: { hex: "#d9541a", name: "Signal Orange", maxDistance: 60 }, rimColor: { hex: "#16171a", name: "Gloss Black", maxDistance: 45 }, bonus: 3000 },
  },
  {
    id: "c11",
    level: 11,
    title: "Quarter-Mile King",
    brief: "The season finale: the fastest standing quarter mile you can build. Every system counts — power, traction, shift speed and gearing — and the car must survive the season.",
    skills: ["Complete drivetrain", "Shift time", "All-wheel drive", "Optimisation"],
    constraints: { maxBudget: 45000, minReliability: 85, maxQuarterMileS: 11.6, transmission: ["dct", "sequential"] },
    metric: { kind: "quarterMile", label: "Quarter mile", unit: "s", silver: 11.2, gold: 11.0, lowerIsBetter: true },
    reward: { bronze: 20000, silver: 26000, gold: 34000 },
  },
];

export interface RequirementCheck {
  label: string;
  target: string;
  actual: string;
  pass: boolean;
}

export interface Evaluation {
  checks: RequirementCheck[];
  passed: boolean;
  metricValue: number;
  grade: Grade | null;
  /** Style brief checks (empty when the contract has none). Never affect the grade. */
  styleChecks: RequirementCheck[];
  stylePassed: boolean;
}

const NO_TIME = 99;
const fmtS = (v: number | null) => (v === null ? "not reached" : `${v.toFixed(2)} s`);

export function metricValue(ch: Challenge, result: SimResult): number {
  switch (ch.metric.kind) {
    case "peakHp":
      return result.peakPowerHp;
    case "reliability":
      return result.reliability;
    case "torqueAt":
      return Math.round(sampleCurve(result.curve, ch.metric.rpm ?? 3000).torqueNm * 10) / 10;
    case "zeroTo100":
      return result.vehicle.zeroTo100S ?? NO_TIME;
    case "quarterMile":
      return result.vehicle.quarterMileS ?? NO_TIME;
    case "topSpeed":
      return result.vehicle.topSpeedKmh;
  }
}

export function evaluateStyle(ch: Challenge, look: Cosmetics): RequirementCheck[] {
  const st = ch.style;
  if (!st) return [];
  const out: RequirementCheck[] = [];
  if (st.paint) {
    // Hot-hatch brief accepts either heritage colour.
    const alt = ch.id === "c10" ? colorDistance(look.paint, "#d8a915") <= st.paint.maxDistance : false;
    out.push({ label: "Body colour", target: ch.id === "c10" ? "Signal Orange or Solar Yellow" : st.paint.name, actual: look.paint.toUpperCase(), pass: alt || colorDistance(look.paint, st.paint.hex) <= st.paint.maxDistance });
  }
  if (st.finish) out.push({ label: "Finish", target: st.finish.map((f) => FINISH_LABEL[f]).join(" or "), actual: FINISH_LABEL[look.finish], pass: st.finish.includes(look.finish) });
  if (st.rimStyle) out.push({ label: "Wheels", target: st.rimStyle.map((r) => RIM_LABEL[r]).join(" or "), actual: RIM_LABEL[look.rimStyle], pass: st.rimStyle.includes(look.rimStyle) });
  if (st.rimColor) out.push({ label: "Wheel colour", target: st.rimColor.name, actual: look.rimColor.toUpperCase(), pass: colorDistance(look.rimColor, st.rimColor.hex) <= st.rimColor.maxDistance });
  if (st.stripe) out.push({ label: "Stripes", target: st.stripe.map((x) => STRIPE_LABEL[x]).join(" or "), actual: STRIPE_LABEL[look.stripe], pass: st.stripe.includes(look.stripe) });
  return out;
}

export function evaluateChallenge(ch: Challenge, build: Build, result: SimResult, look?: Cosmetics): Evaluation {
  const c = ch.constraints;
  const checks: RequirementCheck[] = [];
  checks.push({ label: "Build cost", target: `≤ ${c.maxBudget.toLocaleString("en-US")} cr`, actual: `${result.buildCost.toLocaleString("en-US")} cr`, pass: result.buildCost <= c.maxBudget });
  checks.push({ label: "Reliability", target: `≥ ${c.minReliability}%`, actual: `${result.reliability}%`, pass: result.reliability >= c.minReliability });
  if (c.minPeakHp !== undefined) {
    checks.push({ label: "Peak power", target: `≥ ${c.minPeakHp} hp`, actual: `${result.peakPowerHp} hp`, pass: result.peakPowerHp >= c.minPeakHp });
  }
  if (c.minTorqueAt) {
    const tq = sampleCurve(result.curve, c.minTorqueAt.rpm).torqueNm;
    checks.push({ label: `Torque @ ${c.minTorqueAt.rpm} rpm`, target: `≥ ${c.minTorqueAt.nm} Nm`, actual: `${Math.round(tq)} Nm`, pass: tq >= c.minTorqueAt.nm });
  }
  if (c.maxEgtC !== undefined) {
    checks.push({ label: "Peak EGT", target: `≤ ${c.maxEgtC}°C`, actual: `${result.peakEgtC}°C`, pass: result.peakEgtC <= c.maxEgtC });
  }
  if (c.aspiration) {
    const turbo = getPart("turbo", build.turbo).maximumFlow > 0;
    checks.push({
      label: "Aspiration",
      target: c.aspiration === "na" ? "NA only" : "Turbo",
      actual: turbo ? "Turbo" : "NA",
      pass: c.aspiration === "turbo" ? turbo : !turbo,
    });
  }
  if (c.requirePart) {
    const need = findPart(c.requirePart);
    const has = need ? build[need.slot] === need.id : false;
    checks.push({ label: need ? `Fitted: ${need.name}` : "Required part", target: "Installed", actual: has ? "Installed" : "Missing", pass: has });
  }
  const veh = result.vehicle;
  if (c.maxZeroTo100S !== undefined) checks.push({ label: "0-100 km/h", target: `≤ ${c.maxZeroTo100S.toFixed(1)} s`, actual: fmtS(veh.zeroTo100S), pass: veh.zeroTo100S !== null && veh.zeroTo100S <= c.maxZeroTo100S });
  if (c.maxQuarterMileS !== undefined) checks.push({ label: "Quarter mile", target: `≤ ${c.maxQuarterMileS.toFixed(1)} s`, actual: fmtS(veh.quarterMileS), pass: veh.quarterMileS !== null && veh.quarterMileS <= c.maxQuarterMileS });
  if (c.minTopSpeedKmh !== undefined) checks.push({ label: "Top speed", target: `≥ ${c.minTopSpeedKmh} km/h`, actual: `${veh.topSpeedKmh} km/h`, pass: veh.topSpeedKmh >= c.minTopSpeedKmh });
  if (c.layout) {
    const lay = getPart("drivetrain", build.drivetrain).layout;
    checks.push({ label: "Drive layout", target: c.layout.toUpperCase(), actual: lay.toUpperCase(), pass: lay === c.layout });
  }
  if (c.transmission) {
    const tr = getPart("gearbox", build.gearbox).transmission;
    checks.push({ label: "Gearbox type", target: c.transmission.map(trLabel).join(" or "), actual: trLabel(tr), pass: c.transmission.includes(tr) });
  }
  const passed = checks.every((x) => x.pass);
  const value = metricValue(ch, result);
  let grade: Grade | null = null;
  const beats = (t: number) => (ch.metric.lowerIsBetter ? value <= t : value >= t);
  if (passed) grade = beats(ch.metric.gold) ? "gold" : beats(ch.metric.silver) ? "silver" : "bronze";
  const styleChecks = look ? evaluateStyle(ch, look) : [];
  return { checks, passed, metricValue: value, grade, styleChecks, stylePassed: styleChecks.length > 0 && styleChecks.every((x) => x.pass) };
}

/** Credits paid for a new grade: only the improvement over the best grade already earned. */
export function rewardFor(ch: Challenge, newGrade: Grade, previous: Grade | null): number {
  if (previous && GRADE_RANK[previous] >= GRADE_RANK[newGrade]) return 0;
  return ch.reward[newGrade] - (previous ? ch.reward[previous] : 0);
}

export function isChallengeUnlocked(ch: Challenge, progress: Record<string, Grade | undefined>): boolean {
  const idx = CHALLENGES.findIndex((c) => c.id === ch.id);
  const prev = CHALLENGES[idx - 1];
  return idx <= 0 || !prev || Boolean(progress[prev.id]);
}

/** Requirement labels and targets, for display before a build has been measured. */
export function describeRequirements(ch: Challenge): { label: string; target: string }[] {
  const c = ch.constraints;
  const out = [
    { label: "Build cost", target: `≤ ${c.maxBudget.toLocaleString("en-US")} cr` },
    { label: "Reliability", target: `≥ ${c.minReliability}%` },
  ];
  if (c.minPeakHp !== undefined) out.push({ label: "Peak power", target: `≥ ${c.minPeakHp} hp` });
  if (c.minTorqueAt) out.push({ label: `Torque @ ${c.minTorqueAt.rpm} rpm`, target: `≥ ${c.minTorqueAt.nm} Nm` });
  if (c.maxEgtC !== undefined) out.push({ label: "Peak EGT", target: `≤ ${c.maxEgtC}°C` });
  if (c.aspiration) out.push({ label: "Aspiration", target: c.aspiration === "na" ? "NA only" : "Turbo" });
  if (c.requirePart) out.push({ label: "Required part", target: findPart(c.requirePart)?.name ?? c.requirePart });
  if (c.maxZeroTo100S !== undefined) out.push({ label: "0-100 km/h", target: `≤ ${c.maxZeroTo100S.toFixed(1)} s` });
  if (c.maxQuarterMileS !== undefined) out.push({ label: "Quarter mile", target: `≤ ${c.maxQuarterMileS.toFixed(1)} s` });
  if (c.minTopSpeedKmh !== undefined) out.push({ label: "Top speed", target: `≥ ${c.minTopSpeedKmh} km/h` });
  if (c.layout) out.push({ label: "Drive layout", target: c.layout.toUpperCase() });
  if (c.transmission) out.push({ label: "Gearbox type", target: c.transmission.map(trLabel).join(" or ") });
  return out;
}

export function trLabel(t: TransmissionType): string {
  return { manual: "Manual", sequential: "Sequential", dct: "Dual-clutch", automatic: "Automatic" }[t];
}
