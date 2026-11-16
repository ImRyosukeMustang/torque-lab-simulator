// Engineering challenges as data. Grading reads only the SimResult + Build,
// so the dyno, the workshop and the career screen can never disagree.
import { sampleCurve } from "./engine";
import { getPart } from "./parts";
import type { Build, SimResult } from "./types";

export type Grade = "bronze" | "silver" | "gold";
export const GRADE_RANK: Record<Grade, number> = { bronze: 1, silver: 2, gold: 3 };

export type MetricKind = "peakHp" | "torqueAt" | "reliability";

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
  };
  metric: { kind: MetricKind; rpm?: number; label: string; unit: string; silver: number; gold: number };
  reward: Record<Grade, number>;
}

export const CHALLENGES: Challenge[] = [
  {
    id: "c1",
    level: 1,
    title: "More Air, More Power",
    brief: "The AM-20 breathes through a restrictive airbox and a quiet factory exhaust. Free up the airflow and prove the gain on the dyno, without forced induction.",
    skills: ["Airflow", "Intake restriction", "Dyno testing"],
    constraints: { maxBudget: 1800, minReliability: 95, minPeakHp: 160, aspiration: "na" },
    metric: { kind: "peakHp", label: "Peak power", unit: "hp", silver: 163, gold: 166 },
    reward: { bronze: 1500, silver: 2200, gold: 3000 },
  },
  {
    id: "c2",
    level: 2,
    title: "Cam Theory",
    brief: "A client wants a sharper naturally aspirated engine that still pulls cleanly out of hairpins. Find top-end power without losing the low-end torque.",
    skills: ["Volumetric efficiency", "Valve timing", "Power band"],
    constraints: { maxBudget: 3500, minReliability: 90, minPeakHp: 180, minTorqueAt: { rpm: 3000, nm: 180 }, aspiration: "na" },
    metric: { kind: "peakHp", label: "Peak power", unit: "hp", silver: 184, gold: 188 },
    reward: { bronze: 2500, silver: 3500, gold: 4500 },
  },
  {
    id: "c3",
    level: 3,
    title: "First Boost",
    brief: "Fit a turbocharger and make 250 hp. The turbo is only the start: the fuel system, the charge temperature and the tune all have to keep up.",
    skills: ["Forced induction", "Fuel delivery", "Charge cooling"],
    constraints: { maxBudget: 6000, minReliability: 85, minPeakHp: 250, aspiration: "turbo" },
    metric: { kind: "peakHp", label: "Peak power", unit: "hp", silver: 262, gold: 272 },
    reward: { bronze: 4000, silver: 5500, gold: 7000 },
  },
  {
    id: "c4",
    level: 4,
    title: "Mountain Pass Torque",
    brief: "A rally-stage customer needs instant response out of tight corners. Deliver big torque at 3000 rpm and keep the engine durable for long stages.",
    skills: ["Turbo spool", "Boost curve", "Reliability"],
    constraints: { maxBudget: 7000, minReliability: 90, minTorqueAt: { rpm: 3000, nm: 320 } },
    metric: { kind: "torqueAt", rpm: 3000, label: "Torque @ 3000 rpm", unit: "Nm", silver: 335, gold: 350 },
    reward: { bronze: 5000, silver: 6500, gold: 8000 },
  },
  {
    id: "c5",
    level: 5,
    title: "The Complete Package",
    brief: "The flagship build. Big power, but the engine must survive a 24-hour endurance programme: exhaust temperatures and stress have to stay in check.",
    skills: ["Complete optimisation", "Thermal management", "Cylinder pressure"],
    constraints: { maxBudget: 15000, minReliability: 80, minPeakHp: 360, maxEgtC: 940, aspiration: "turbo" },
    metric: { kind: "peakHp", label: "Peak power", unit: "hp", silver: 380, gold: 400 },
    reward: { bronze: 8000, silver: 11000, gold: 15000 },
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
}

export function metricValue(ch: Challenge, result: SimResult): number {
  switch (ch.metric.kind) {
    case "peakHp":
      return result.peakPowerHp;
    case "reliability":
      return result.reliability;
    case "torqueAt":
      return Math.round(sampleCurve(result.curve, ch.metric.rpm ?? 3000).torqueNm * 10) / 10;
  }
}

export function evaluateChallenge(ch: Challenge, build: Build, result: SimResult): Evaluation {
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
      target: c.aspiration === "na" ? "Naturally aspirated" : "Turbocharged",
      actual: turbo ? "Turbocharged" : "Naturally aspirated",
      pass: c.aspiration === "turbo" ? turbo : !turbo,
    });
  }
  const passed = checks.every((x) => x.pass);
  const value = metricValue(ch, result);
  let grade: Grade | null = null;
  if (passed) grade = value >= ch.metric.gold ? "gold" : value >= ch.metric.silver ? "silver" : "bronze";
  return { checks, passed, metricValue: value, grade };
}

/** Credits paid for a new grade: only the improvement over the best grade already earned. */
export function rewardFor(ch: Challenge, newGrade: Grade, previous: Grade | null): number {
  if (previous && GRADE_RANK[previous] >= GRADE_RANK[newGrade]) return 0;
  return ch.reward[newGrade] - (previous ? ch.reward[previous] : 0);
}

export function isChallengeUnlocked(ch: Challenge, progress: Record<string, Grade | undefined>): boolean {
  const idx = CHALLENGES.findIndex((c) => c.id === ch.id);
  return idx === 0 || Boolean(progress[CHALLENGES[idx - 1].id]);
}
