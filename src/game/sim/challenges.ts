// Engineering challenges as data. Grading reads only the SimResult + Build,
// so the dyno, the workshop and the career screen can never disagree.
import { sampleCurve } from "./engine";
import { colorDistance, FINISH_LABEL, RIM_LABEL, STRIPE_LABEL, type Cosmetics, type PaintFinish, type RimStyle, type StripeStyle } from "./cosmetics";
import { findPart, getPart } from "./parts";
import type { Build, DriveLayout, SimResult, TransmissionType } from "./types";
import { CHALLENGE_DATA } from "./challengeData";

export type Grade = "bronze" | "silver" | "gold";
export const GRADE_RANK: Record<Grade, number> = { bronze: 1, silver: 2, gold: 3 };

export type MetricKind = "peakHp" | "torqueAt" | "reliability" | "zeroTo100" | "zeroTo200" | "topSpeed" | "quarterMile" | "buildCost" | "peakEgt" | "wheelHp";

/** A client's requested look. Matching it pays a one-off bonus on top of the grade reward. */
export interface StyleBrief {
  summary: string;
  /** `alt` lists other accepted colours (same distance tolerance). */
  paint?: { hex: string; name: string; maxDistance: number; alt?: string[] };
  finish?: PaintFinish[];
  rimStyle?: RimStyle[];
  rimColor?: { hex: string; name: string; maxDistance: number };
  stripe?: StripeStyle[];
  bonus: number;
}

export interface Challenge {
  id: string;
  level: number;
  chapter: number;
  title: string;
  brief: string;
  skills: string[];
  constraints: {
    maxBudget: number;
    minReliability: number;
    minPeakHp?: number;
    /** Class power cap. */
    maxPeakHp?: number;
    minWheelHp?: number;
    minTorqueAt?: { rpm: number; nm: number };
    maxEgtC?: number;
    aspiration?: "na" | "turbo";
    /** Parts that must be installed (e.g. a fuel type, or the factory exhaust). */
    requireParts?: string[];
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

/** Contract chapters, in career order. */
export const CHAPTERS: { id: number; title: string; blurb: string }[] = [
  { id: 1, title: "Street engineering", blurb: "Airflow, cams, compression and a first taste of boost on a small budget." },
  { id: 2, title: "Forced induction", blurb: "Turbo sizing, charge cooling, fuels and cylinder pressure." },
  { id: 3, title: "Drivetrain engineering", blurb: "Gearing, clutches, differentials and putting the power down." },
  { id: 4, title: "Client commissions", blurb: "Specialist briefs where one wrong system sinks the whole build." },
  { id: 5, title: "Championship", blurb: "Every system at its limit. Budgets are tight and margins are thin." },
];

/** Career order. Levels are the position in this list, so contracts can be inserted without renumbering. */
export const CHALLENGES: Challenge[] = CHALLENGE_DATA.map((c, i) => ({ ...c, level: i + 1 }));

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
    case "zeroTo200":
      return result.vehicle.zeroTo200S ?? NO_TIME;
    case "buildCost":
      return result.buildCost;
    case "peakEgt":
      return result.peakEgtC;
    case "wheelHp":
      return Math.round(result.wheelPowerHp * 10) / 10;
  }
}

export function evaluateStyle(ch: Challenge, look: Cosmetics): RequirementCheck[] {
  const st = ch.style;
  if (!st) return [];
  const out: RequirementCheck[] = [];
  if (st.paint) {
    const p = st.paint;
    const pass = [p.hex, ...(p.alt ?? [])].some((hex) => colorDistance(look.paint, hex) <= p.maxDistance);
    out.push({ label: "Body colour", target: p.name, actual: look.paint.toUpperCase(), pass });
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
  if (c.maxPeakHp !== undefined) {
    checks.push({ label: "Power cap", target: `≤ ${c.maxPeakHp} hp`, actual: `${result.peakPowerHp} hp`, pass: result.peakPowerHp <= c.maxPeakHp });
  }
  if (c.minWheelHp !== undefined) {
    checks.push({ label: "Wheel power", target: `≥ ${c.minWheelHp} whp`, actual: `${Math.round(result.wheelPowerHp)} whp`, pass: result.wheelPowerHp >= c.minWheelHp });
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
  for (const id of c.requireParts ?? []) {
    const need = findPart(id);
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

/** Open when the previous contract is graded. A contract already graded stays open, so saves from before
 * contracts were inserted keep their progress. */
export function isChallengeUnlocked(ch: Challenge, progress: Record<string, Grade | undefined>): boolean {
  const idx = CHALLENGES.findIndex((c) => c.id === ch.id);
  const prev = CHALLENGES[idx - 1];
  return idx <= 0 || !prev || Boolean(progress[prev.id]) || Boolean(progress[ch.id]);
}

/** Requirement labels and targets, for display before a build has been measured. */
export function describeRequirements(ch: Challenge): { label: string; target: string }[] {
  const c = ch.constraints;
  const out = [
    { label: "Build cost", target: `≤ ${c.maxBudget.toLocaleString("en-US")} cr` },
    { label: "Reliability", target: `≥ ${c.minReliability}%` },
  ];
  if (c.minPeakHp !== undefined) out.push({ label: "Peak power", target: `≥ ${c.minPeakHp} hp` });
  if (c.maxPeakHp !== undefined) out.push({ label: "Power cap", target: `≤ ${c.maxPeakHp} hp` });
  if (c.minWheelHp !== undefined) out.push({ label: "Wheel power", target: `≥ ${c.minWheelHp} whp` });
  if (c.minTorqueAt) out.push({ label: `Torque @ ${c.minTorqueAt.rpm} rpm`, target: `≥ ${c.minTorqueAt.nm} Nm` });
  if (c.maxEgtC !== undefined) out.push({ label: "Peak EGT", target: `≤ ${c.maxEgtC}°C` });
  if (c.aspiration) out.push({ label: "Aspiration", target: c.aspiration === "na" ? "NA only" : "Turbo" });
  for (const id of c.requireParts ?? []) out.push({ label: "Required part", target: findPart(id)?.name ?? id });
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
