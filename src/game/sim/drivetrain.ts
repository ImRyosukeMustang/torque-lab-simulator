// Vehicle and drivetrain model: gearing, clutch, differential, drive layout, traction,
// acceleration and top speed. Pure and deterministic like the engine model; it reads the
// engine's measured torque curve so the track figures always agree with the dyno.
import { getPart } from "./parts";
import type { AccelSample, Build, CurvePoint, Diagnostic, GearInfo, Tune, VehicleResult } from "./types";

export const VEHICLE = {
  /** Body, engine and interior without gearbox, clutch, differential or drive layout parts. */
  baseMassKg: 1180,
  /** Driver and fuel on the test strip. */
  testLoadKg: 90,
  frontWeight: 0.53,
  wheelbaseM: 2.66,
  cgHeightM: 0.48,
  tyreRadiusM: 0.33,
  tyreMu: 1.05,
  dragCdA: 0.62,
  rollingCoeff: 0.013,
  airDensity: 1.2,
};
const G = 9.81;
const DT = 0.01;
const TRACE_EVERY = 0.1;
const QUARTER_MILE_M = 402.3;
const MAX_TIME_S = 60;
/** Fraction of the open-diff traction loss an LSD recovers per unit lock factor. */
const OPEN_DIFF_TRACTION = 0.88;
/** Rotating-inertia mass factor per (overall ratio)² — engine, flywheel and gearbox spun up with the car. */
const ROTATING_INERTIA = 0.0018;

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const round = (v: number, d = 1) => Math.round(v * 10 ** d) / 10 ** d;

function torqueAt(curve: CurvePoint[], rpm: number): number {
  const first = curve[0]!;
  const last = curve[curve.length - 1]!;
  if (rpm <= first.rpm) return first.torqueNm * clamp(rpm / first.rpm, 0.6, 1);
  if (rpm >= last.rpm) return last.torqueNm;
  for (let i = 1; i < curve.length; i++) {
    const b = curve[i]!;
    if (rpm <= b.rpm) {
      const a = curve[i - 1]!;
      return a.torqueNm + ((b.torqueNm - a.torqueNm) * (rpm - a.rpm)) / (b.rpm - a.rpm);
    }
  }
  return last.torqueNm;
}

export interface DrivetrainSpec {
  ratios: number[];
  finalDrive: number;
  efficiency: number;
  massKg: number;
  frontWeight: number;
  /** Torque cap from clutch / gearbox input (Nm). */
  clutchCapNm: number;
  launchRpm: number;
  converter: number;
  shiftTimeS: number;
  torqueDuringShift: number;
  layout: "fwd" | "rwd" | "awd";
  frontTorqueShare: number;
  tractionFactor: number;
  revLimit: number;
  /** Aerodynamics and tyres after body kit changes. */
  dragCdA: number;
  downforceArea: number;
  downforceFront: number;
  tyreMu: number;
  rollingCoeff: number;
}

/** Combined effect of the fitted aero kit, wing and body on drag, downforce, mass and tyres. */
export function bodyworkSpec(build: Build) {
  const parts = [getPart("aero", build.aero), getPart("wing", build.wing), getPart("body", build.body)];
  const downforceArea = parts.reduce((s, p) => s + p.downforceArea, 0);
  const frontDown = parts.reduce((s, p) => s + p.downforceArea * p.downforceFront, 0);
  return {
    dragCdA: VEHICLE.dragCdA + parts.reduce((s, p) => s + p.dragAreaDelta, 0),
    downforceArea,
    downforceFront: downforceArea > 0 ? frontDown / downforceArea : 0.5,
    massKg: parts.reduce((s, p) => s + p.massKg, 0),
    tyreMu: VEHICLE.tyreMu + parts.reduce((s, p) => s + p.gripBonus, 0),
    rollingCoeff: VEHICLE.rollingCoeff + parts.reduce((s, p) => s + p.rollingDelta, 0),
  };
}

export function drivetrainSpec(build: Build, tune: Tune): DrivetrainSpec {
  const box = getPart("gearbox", build.gearbox);
  const clutch = getPart("clutch", build.clutch);
  const diff = getPart("differential", build.differential);
  const dt = getPart("drivetrain", build.drivetrain);
  const body = bodyworkSpec(build);
  const massKg = VEHICLE.baseMassKg + box.weightKg + diff.weightKg + dt.weightKg + (box.integratedClutch ? 0 : clutch.weightKg) + body.massKg;
  return {
    ratios: tune.gearRatios,
    finalDrive: tune.finalDrive,
    efficiency: box.efficiency * diff.efficiency * dt.efficiency,
    massKg,
    frontWeight: VEHICLE.frontWeight + dt.frontWeightShift,
    clutchCapNm: box.integratedClutch ? box.maxTorqueNm * 1.25 : clutch.capacityNm,
    launchRpm: box.integratedClutch ? box.launchRpm : clutch.launchRpm,
    converter: box.converterMultiplication,
    shiftTimeS: box.shiftTimeS,
    torqueDuringShift: box.torqueDuringShift,
    layout: dt.layout,
    frontTorqueShare: dt.frontTorqueShare,
    tractionFactor: OPEN_DIFF_TRACTION + (1 - OPEN_DIFF_TRACTION) * diff.lockFactor,
    revLimit: tune.revLimit,
    dragCdA: body.dragCdA,
    downforceArea: body.downforceArea,
    downforceFront: body.downforceFront,
    tyreMu: body.tyreMu,
    rollingCoeff: body.rollingCoeff,
  };
}

/** Overall drivetrain efficiency (gearbox × diff × layout): the wheel-power fraction on a chassis dyno. */
export function drivetrainEfficiency(build: Build): number {
  return getPart("gearbox", build.gearbox).efficiency * getPart("differential", build.differential).efficiency * getPart("drivetrain", build.drivetrain).efficiency;
}

export const rpmFromSpeed = (v: number, overall: number) => ((v / VEHICLE.tyreRadiusM) * overall * 60) / (2 * Math.PI);
export const speedFromRpm = (rpm: number, overall: number) => (rpm * 2 * Math.PI * VEHICLE.tyreRadiusM) / 60 / overall;

/** Drag plus rolling resistance (N) at a road speed (m/s). Downforce adds tyre load, so it adds rolling resistance too. */
export function roadLoadN(v: number, massKg: number, aero: { dragCdA: number; rollingCoeff: number; downforceArea: number } = { dragCdA: VEHICLE.dragCdA, rollingCoeff: VEHICLE.rollingCoeff, downforceArea: 0 }): number {
  const q = 0.5 * VEHICLE.airDensity * v * v;
  return q * aero.dragCdA + aero.rollingCoeff * (massKg * G + q * aero.downforceArea);
}

/** Engine torque (Nm) at an engine speed, read from the measured curve. */
export function engineTorqueAt(curve: CurvePoint[], rpm: number): number {
  return torqueAt(curve, rpm);
}

/** Engine-limited drive force (N) in a gear at a road speed, ignoring tyre grip. */
export function driveForceN(spec: DrivetrainSpec, curve: CurvePoint[], gear: number, v: number): number {
  const overall = spec.ratios[gear]! * spec.finalDrive;
  const wheelRpm = rpmFromSpeed(v, overall);
  if (wheelRpm > spec.revLimit + 1) return 0;
  const engineRpm = Math.max(wheelRpm, gear === 0 ? spec.launchRpm : 0);
  let tq = Math.min(torqueAt(curve, engineRpm), spec.clutchCapNm);
  if (spec.converter > 1 && spec.launchRpm > 0) tq *= 1 + (spec.converter - 1) * clamp(1 - wheelRpm / spec.launchRpm, 0, 1);
  return (tq * overall * spec.efficiency) / VEHICLE.tyreRadiusM;
}

/** Maximum force the driven tyres can transmit (N) at a longitudinal acceleration (m/s²) and road speed (m/s). */
export function tractionLimitN(spec: DrivetrainSpec, accel: number, v = 0): number {
  const m = spec.massKg + VEHICLE.testLoadKg;
  const transfer = (m * accel * VEHICLE.cgHeightM) / VEHICLE.wheelbaseM;
  const down = 0.5 * VEHICLE.airDensity * v * v * spec.downforceArea;
  const front = Math.max(0, m * G * spec.frontWeight - transfer + down * spec.downforceFront);
  const rear = Math.max(0, m * G * (1 - spec.frontWeight) + transfer + down * (1 - spec.downforceFront));
  const mu = spec.tyreMu * spec.tractionFactor;
  if (spec.layout === "fwd") return mu * front;
  if (spec.layout === "rwd") return mu * rear;
  // AWD: the fixed torque split saturates whichever axle runs out of grip first.
  const s = spec.frontTorqueShare;
  return Math.min((mu * front) / Math.max(s, 0.01), (mu * rear) / Math.max(1 - s, 0.01));
}

export function simulateVehicle(build: Build, tune: Tune, curve: CurvePoint[]): { vehicle: VehicleResult; diagnostics: Diagnostic[]; reliabilityHit: number } {
  const spec = drivetrainSpec(build, tune);
  const box = getPart("gearbox", build.gearbox);
  const clutch = getPart("clutch", build.clutch);
  const diff = getPart("differential", build.differential);
  const layout = getPart("drivetrain", build.drivetrain);
  const n = spec.ratios.length;
  const m = spec.massKg + VEHICLE.testLoadKg;
  const peakTq = Math.max(...curve.map((p) => p.torqueNm));
  const peakPowerRpm = curve.reduce((a, b) => (b.powerHp > a.powerHp ? b : a)).rpm;

  // Per-gear figures
  const gears: GearInfo[] = spec.ratios.map((ratio, i) => {
    const overall = ratio * spec.finalDrive;
    const prev = spec.ratios[i - 1];
    return {
      gear: i + 1,
      ratio,
      overall: round(overall, 2),
      kmhPer1000: round(speedFromRpm(1000, overall) * 3.6, 1),
      maxKmh: Math.round(speedFromRpm(spec.revLimit, overall) * 3.6),
      peakWheelTorqueNm: Math.round(Math.min(peakTq, spec.clutchCapNm) * overall * spec.efficiency),
      rpmAfterShift: prev ? Math.round((spec.revLimit * ratio) / prev) : 0,
    };
  });

  // Acceleration run from a standing start, shifting at the point of best wheel force.
  let v = 0;
  let x = 0;
  let t = 0;
  let gear = 0;
  let a = 0;
  let shiftLeft = 0;
  let nextTrace = 0;
  let tractionTo = 0;
  let t100: number | null = null;
  let t200: number | null = null;
  let tQm: number | null = null;
  let vQm: number | null = null;
  const shiftRpm: number[] = [];
  const trace: AccelSample[] = [];
  while (t < MAX_TIME_S && (t200 === null || tQm === null)) {
    const overall = spec.ratios[gear]! * spec.finalDrive;
    const wheelRpm = rpmFromSpeed(v, overall);
    let force = driveForceN(spec, curve, gear, v);
    if (shiftLeft > 0) {
      force *= spec.torqueDuringShift;
      shiftLeft -= DT;
    }
    const grip = tractionLimitN(spec, a, v);
    const spinning = force > grip;
    if (spinning) {
      force = grip;
      tractionTo = v;
    }
    // While the clutch slips or the tyres spin, the engine is not being accelerated by the road speed.
    const coupled = !spinning && wheelRpm >= (gear === 0 ? spec.launchRpm : 0);
    const meff = m * (1.04 + (coupled ? ROTATING_INERTIA * overall * overall : 0));
    a = (force - roadLoadN(v, m, spec)) / meff;
    if (a <= 0 && shiftLeft <= 0 && gear >= n - 1) break; // reached top speed in top gear
    v = Math.max(0, v + a * DT);
    x += v * DT;
    t += DT;
    if (t100 === null && v >= 100 / 3.6) t100 = t;
    if (t200 === null && v >= 200 / 3.6) t200 = t;
    if (tQm === null && x >= QUARTER_MILE_M) {
      tQm = t;
      vQm = v * 3.6;
    }
    const rpm = Math.max(wheelRpm, gear === 0 ? spec.launchRpm : 0);
    if (t >= nextTrace) {
      trace.push({ t: round(t, 2), kmh: round(v * 3.6, 1), rpm: Math.round(Math.min(rpm, spec.revLimit)), gear: gear + 1, wheelspin: spinning });
      nextTrace += TRACE_EVERY;
    }
    if (shiftLeft <= 0 && gear < n - 1) {
      const atLimit = rpmFromSpeed(v, overall) >= spec.revLimit - 40;
      const better = v > 3 && driveForceN(spec, curve, gear + 1, v) > driveForceN(spec, curve, gear, v) * 1.0;
      if (atLimit || better) {
        shiftRpm.push(Math.round(Math.min(rpmFromSpeed(v, overall), spec.revLimit)));
        gear += 1;
        shiftLeft = spec.shiftTimeS;
      }
    }
  }

  // Top speed: highest road speed where some gear's drive force still meets road load.
  let top = 0;
  let topGear = n;
  let topLimit: "drag" | "rev-limit" = "drag";
  for (let g = 0; g < n; g++) {
    const overall = spec.ratios[g]! * spec.finalDrive;
    const vMax = speedFromRpm(spec.revLimit, overall);
    let best = 0;
    for (let vv = 5; vv <= vMax + 1e-6; vv += 0.25) {
      if (driveForceN(spec, curve, g, Math.min(vv, vMax)) >= roadLoadN(Math.min(vv, vMax), m, spec)) best = Math.min(vv, vMax);
      else if (vv > 10) break;
    }
    if (best > top) {
      top = best;
      topGear = g + 1;
      topLimit = best >= vMax - 0.3 ? "rev-limit" : "drag";
    }
  }

  // Diagnostics and drivetrain stress
  const diagnostics: Diagnostic[] = [];
  let hit = 0;
  const kmh = (ms: number) => `${Math.round(ms * 3.6)} km/h`;
  if (!box.integratedClutch && peakTq > clutch.capacityNm) {
    const over = peakTq / clutch.capacityNm - 1;
    hit += over * 80;
    diagnostics.push({
      code: "CLUTCH_SLIP",
      severity: over > 0.1 ? "critical" : "warning",
      slot: "clutch",
      message: `The clutch slips: the engine makes ${Math.round(peakTq)} Nm but the ${clutch.name} holds ${clutch.capacityNm} Nm.`,
      cause: "Clamp force times friction sets how much torque the plate can carry. Beyond that it slides, so power turns into heat instead of reaching the wheels, and the facing glazes and burns.",
      fixes: ["Fit a stronger clutch (Stage 2 or twin-plate).", "Or lower peak torque with less boost.", "A dual-clutch or automatic gearbox brings its own clutches."],
    });
  }
  if (peakTq > box.maxTorqueNm) {
    const over = peakTq / box.maxTorqueNm - 1;
    hit += over * 60;
    diagnostics.push({
      code: "GEARBOX_TORQUE",
      severity: over > 0.1 ? "critical" : "warning",
      slot: "gearbox",
      message: `Engine torque (${Math.round(peakTq)} Nm) exceeds the ${box.name}'s ${box.maxTorqueNm} Nm rating.`,
      cause: "Gear teeth and shafts are sized for a torque load. Above it, tooth root stress and synchro wear rise sharply, so failures come long before the end of an endurance programme.",
      fixes: ["Fit a gearbox with a higher torque rating (dual-clutch, automatic or sequential).", "Or reduce boost at peak torque."],
    });
  }
  if (box.integratedClutch && build.clutch !== "clutch-oem") {
    diagnostics.push({
      code: "CLUTCH_UNUSED",
      severity: "info",
      slot: "clutch",
      message: "The aftermarket clutch is not used.",
      cause: `The ${box.name} has its own ${box.transmission === "automatic" ? "torque converter" : "wet clutches"}, so the separate clutch is bypassed.`,
      fixes: ["Sell it to recover budget."],
    });
  }
  if (tractionTo > 30 / 3.6) {
    const fixes: string[] = [];
    if (diff.lockFactor < 0.6) fixes.push(diff.lockFactor === 0 ? "A limited-slip differential stops the unloaded wheel spinning away the torque." : "A clutch-pack LSD locks the axle harder.");
    if (layout.layout !== "awd") fixes.push("All-wheel drive spreads the force across four tyres.");
    fixes.push("A taller first gear or final drive lowers wheel torque at launch.");
    diagnostics.push({
      code: "WHEELSPIN",
      severity: tractionTo > 100 / 3.6 ? "warning" : "info",
      slot: layout.layout === "awd" ? "differential" : "drivetrain",
      message: `The tyres are traction-limited up to ${kmh(tractionTo)}: the engine can deliver more force than the ${layout.layout.toUpperCase()} layout can put down.`,
      cause: `${layout.layout === "fwd" ? "Under acceleration weight moves off the front driven tyres" : layout.layout === "rwd" ? "Only the rear tyres push, even with weight transfer onto them" : "Even with four driven tyres"} the grip available is lower than the wheel force in the low gears${diff.lockFactor === 0 ? ", and the open differential lets the lighter-loaded wheel spin" : ""}.`,
      fixes,
    });
  }
  if (layout.layout === "fwd" && peakTq > 330) {
    diagnostics.push({
      code: "TORQUE_STEER",
      severity: "warning",
      slot: "drivetrain",
      message: `${Math.round(peakTq)} Nm through the front wheels causes torque steer.`,
      cause: "Unequal-length driveshafts and steering geometry turn drive force into a pull at the steering wheel under hard acceleration.",
      fixes: [diff.lockFactor === 0 ? "A helical LSD calms the front axle." : "Keep peak torque under about 330 Nm, or switch layout."],
    });
    hit += 2;
  }
  const topGearInfo = gears[n - 1]!;
  if (topLimit === "rev-limit" && topGear === n) {
    diagnostics.push({
      code: "GEARING_SHORT",
      severity: "info",
      slot: box.adjustable ? "gearbox" : "differential",
      message: `Top gear runs out of revs at ${topGearInfo.maxKmh} km/h before drag stops the car.`,
      cause: "The engine hits the rev limiter while it still has power to accelerate.",
      fixes: ["A taller (lower) final drive or top-gear ratio raises top speed.", "A higher rev limit also helps if the valvetrain allows."],
    });
  } else if (topGear < n) {
    diagnostics.push({
      code: "GEARING_TALL",
      severity: "info",
      slot: box.adjustable ? "gearbox" : "differential",
      message: `Top speed is reached in gear ${topGear}: gear ${n} is too tall to pull against drag.`,
      cause: "In the overdrive ratio the engine falls below its power band, so it makes less power at the wheels than one gear lower.",
      fixes: ["A shorter final drive or top-gear ratio uses the power band at top speed."],
    });
  }
  const worstDrop = gears.slice(1).reduce((w, g) => (g.rpmAfterShift && g.rpmAfterShift < w.rpm ? { rpm: g.rpmAfterShift, gear: g.gear } : w), { rpm: Infinity, gear: 0 });
  if (Number.isFinite(worstDrop.rpm) && worstDrop.rpm < peakPowerRpm * 0.62) {
    diagnostics.push({
      code: "GEAR_GAP",
      severity: "info",
      slot: "gearbox",
      message: `Shifting into gear ${worstDrop.gear} drops the engine to ${worstDrop.rpm} rpm, far below peak power (${peakPowerRpm} rpm).`,
      cause: "A large ratio step leaves the engine off its power band after the shift.",
      fixes: [box.adjustable ? "Close the gap: lower the previous gear or raise this one." : "A close-ratio gearbox keeps the engine in its power band."],
    });
  }

  return {
    vehicle: {
      massKg: Math.round(m),
      frontWeight: round(spec.frontWeight, 2),
      drivetrainEfficiency: round(spec.efficiency, 3),
      gears,
      zeroTo100S: t100 === null ? null : round(t100, 2),
      zeroTo200S: t200 === null ? null : round(t200, 2),
      quarterMileS: tQm === null ? null : round(tQm, 2),
      quarterMileKmh: vQm === null ? null : Math.round(vQm),
      topSpeedKmh: Math.round(top * 3.6),
      topSpeedGear: topGear,
      topSpeedLimit: topLimit,
      tractionLimitedToKmh: Math.round(tractionTo * 3.6),
      shiftRpm,
      trace,
    },
    diagnostics,
    reliabilityHit: hit,
  };
}

/** Wheel force per gear across road speed, for the tractive-force chart (km/h, N). */
export function tractiveForceCurves(build: Build, tune: Tune, curve: CurvePoint[], stepKmh = 5) {
  const spec = drivetrainSpec(build, tune);
  const m = spec.massKg + VEHICLE.testLoadKg;
  const rows: Record<string, number>[] = [];
  const vTop = speedFromRpm(spec.revLimit, spec.ratios[spec.ratios.length - 1]! * spec.finalDrive) * 3.6;
  for (let kmh = 0; kmh <= vTop + stepKmh; kmh += stepKmh) {
    const v = kmh / 3.6;
    const row: Record<string, number> = { kmh, load: Math.round(roadLoadN(v, m, spec)) };
    spec.ratios.forEach((r, g) => {
      const overall = r * spec.finalDrive;
      const rpm = rpmFromSpeed(v, overall);
      if (rpm <= spec.revLimit && (g === 0 || rpm >= 1500)) row[`g${g + 1}`] = Math.round(driveForceN(spec, curve, g, v));
    });
    rows.push(row);
  }
  return rows;
}
