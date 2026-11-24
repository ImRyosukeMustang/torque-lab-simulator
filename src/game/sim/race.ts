// Interactive drag racing. Pure and deterministic: the same inputs always give the same run, so
// rival ghosts are pre-computed with the exact physics the player drives. Reads the engine's
// measured torque curve and the drivetrain spec, so race times agree with the dyno and track test.
import { bodyworkSpec, drivetrainSpec, engineTorqueAt, roadLoadN, speedFromRpm, tractionLimitN, VEHICLE, type DrivetrainSpec } from "./drivetrain";
import { simulate } from "./engine";
import { clampTune, getPart, STOCK_BUILD, STOCK_TUNE } from "./parts";
import { RIM_MASS_KG, type RimStyle } from "./cosmetics";
import type { Build, CurvePoint, SimResult, TransmissionType, Tune } from "./types";

export type RaceDistance = "quarter" | "half" | "mile";
export const RACE_DISTANCE_M: Record<RaceDistance, number> = { quarter: 402.336, half: 804.672, mile: 1609.344 };
export const RACE_DISTANCE_LABEL: Record<RaceDistance, string> = { quarter: "1/4 mile", half: "1/2 mile", mile: "1 mile" };
/** Sixty feet: the classic launch-quality split. */
export const SIXTY_FT_M = 18.288;

export const RACE_DT = 1 / 500;
const MAX_RACE_S = 90;
const G = 9.81;
const RPM_TO_RAD = (2 * Math.PI) / 60;
/** Engine, flywheel and gearbox input inertia (kg·m²). */
const ENGINE_INERTIA = 0.24;
/** Driven wheels, tyres, brakes and axle (kg·m² at the wheel). */
const WHEEL_INERTIA = 2.6;
/** A fully spinning tyre holds this share of its peak grip; up to PEAK_SLIP it holds all of it. */
const KINETIC_GRIP = 0.8;
const PEAK_SLIP = 0.18;
/** Tyre friction share at a slip ratio: flat to the peak, then falling toward sliding friction. */
export function tyreGripShare(slip: number): number {
  if (slip <= PEAK_SLIP) return 1;
  return Math.max(KINETIC_GRIP, 1 - ((slip - PEAK_SLIP) * (1 - KINETIC_GRIP)) / 0.6);
}
const IDLE_RPM = 900;
/** Bite time of a gearbox's built-in launch clutch or converter (s). */
const INTEGRATED_BITE_S = 0.08;
/** Flat-foot shifting cuts this share off a manual or sequential shift. */
const FLAT_SHIFT_SAVING = 0.3;
/** A shift landing within this many rpm of the ideal shift point counts as perfect. */
export const PERFECT_SHIFT_RPM = 300;

export interface RaceCar {
  spec: DrivetrainSpec;
  curve: CurvePoint[];
  massKg: number;
  transmission: TransmissionType;
  integratedClutch: boolean;
  /** Launch control / converter stall speed for boxes with built-in clutches (0 for a manual clutch). */
  launchHoldRpm: number;
  clutchCapNm: number;
  revLimit: number;
  /** Best upshift rpm per gear (index = gear being left). */
  shiftRpm: number[];
  /** Pre-launch rpm that gives the quickest 60 ft, and the band around it. */
  idealLaunchRpm: number;
  launchWindow: [number, number];
  peakPowerHp: number;
  /** Rotating engine-side inertia (kg·m²): lighter clutches and rods rev quicker. */
  engineInertia: number;
  /** Driven-wheel inertia (kg·m²): lighter wheels spin up quicker. */
  wheelInertia: number;
  /** Clutch bite time when dropped (s). */
  clutchEngageS: number;
  /** Two-step launch limiter rpm while staged (0 = none). */
  launchControlRpm: number;
  flatShift: boolean;
}

export interface RaceCarOptions {
  /** Wheel style: wheel weight changes the car's mass and rotating inertia. */
  rimStyle?: RimStyle;
}

export interface CarState {
  /** Time since green (s); negative before it. */
  t: number;
  x: number;
  v: number;
  a: number;
  gear: number;
  rpm: number;
  /** Driven-wheel speed expressed as engine rpm in the current gear. */
  wheelRpm: number;
  launched: boolean;
  launchT: number | null;
  /** Engine speed held while the clutch slips off the line. */
  launchRpm: number;
  shiftLeft: number;
  /** Engine rpm the shift is synchronising to. */
  shiftTarget: number;
  clutchBite: number;
  spinning: boolean;
  /** 0..1 how hard the tyres are spinning (smoke). */
  spin: number;
  limiter: boolean;
  cutLeft: number;
  /** 0..1 exhaust pop/flame intensity, decays. */
  pop: number;
  sixtyFt: number | null;
  finishT: number | null;
  trapKmh: number | null;
  /** Peak speed so far (km/h). */
  topKmh: number;
}

export type ShiftQuality = "perfect" | "early" | "late" | "ok" | "denied" | "none";

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** Engine-limited wheel force in a gear at a road speed (N), at full throttle and locked clutch. */
function forceInGear(car: RaceCar, gear: number, v: number): number {
  const G = car.spec.ratios[gear]! * car.spec.finalDrive;
  const rpm = (v / VEHICLE.tyreRadiusM) * G * (60 / (2 * Math.PI));
  if (rpm > car.revLimit) return 0;
  return (engineTorqueAt(car.curve, Math.max(rpm, IDLE_RPM)) * G * car.spec.efficiency) / VEHICLE.tyreRadiusM;
}

/** Upshift points: where the next gear starts pulling harder, or just under the limiter. */
export function optimalShiftRpm(car: Pick<RaceCar, "spec" | "curve" | "revLimit">): number[] {
  const out: number[] = [];
  const c = car as RaceCar;
  for (let g = 0; g < car.spec.ratios.length - 1; g++) {
    const overall = car.spec.ratios[g]! * car.spec.finalDrive;
    const vMax = speedFromRpm(car.revLimit, overall);
    let best = car.revLimit - 150;
    for (let v = vMax * 0.4; v <= vMax; v += 0.2) {
      if (forceInGear(c, g + 1, v) >= forceInGear(c, g, v)) {
        best = Math.min(car.revLimit - 150, Math.round(((v / VEHICLE.tyreRadiusM) * overall * 60) / (2 * Math.PI)));
        break;
      }
    }
    out.push(best);
  }
  return out;
}

export function makeRaceCar(build: Build, tune: Tune, result: SimResult = simulate(build, tune), opts: RaceCarOptions = {}): RaceCar {
  const t = clampTune(build, tune);
  const spec = drivetrainSpec(build, t);
  const box = getPart("gearbox", build.gearbox);
  const clutch = getPart("clutch", build.clutch);
  const ecu = getPart("ecu", build.ecu);
  const internals = getPart("internals", build.internals);
  const rimDelta = RIM_MASS_KG[opts.rimStyle ?? "five"] - RIM_MASS_KG.five;
  const car: RaceCar = {
    spec,
    curve: result.curve,
    massKg: spec.massKg + VEHICLE.testLoadKg + 4 * rimDelta,
    transmission: box.transmission,
    integratedClutch: box.integratedClutch,
    launchHoldRpm: box.integratedClutch ? box.launchRpm : 0,
    clutchCapNm: spec.clutchCapNm,
    revLimit: t.revLimit,
    shiftRpm: [],
    idealLaunchRpm: 3500,
    launchWindow: [3000, 4000],
    peakPowerHp: result.peakPowerHp,
    // Flywheel + clutch assembly, plus lighter reciprocating parts on forged internals.
    engineInertia: ENGINE_INERTIA + (box.integratedClutch ? 0 : (clutch.weightKg - 9) * 0.012) + Math.min(0, internals.massDeltaKg ?? 0) * 0.006,
    // Two driven wheels: rim weight sits near the rim radius (~0.2 m).
    wheelInertia: WHEEL_INERTIA + 2 * rimDelta * 0.2 * 0.2 * 0.8,
    clutchEngageS: box.integratedClutch ? INTEGRATED_BITE_S : clutch.engageS,
    launchControlRpm: 0,
    flatShift: ecu.flatShift && (box.transmission === "manual" || box.transmission === "sequential"),
  };
  car.shiftRpm = optimalShiftRpm(car);
  const w = findLaunchWindow(car);
  car.idealLaunchRpm = w.ideal;
  car.launchWindow = [w.lo, w.hi];
  // Two-step: boxes with their own launch control already hold rpm; a manual clutch gets the ECU's.
  if (ecu.launchControl && !box.integratedClutch) car.launchControlRpm = w.ideal;
  return car;
}

export function newCarState(): CarState {
  return {
    t: 0, x: 0, v: 0, a: 0, gear: 0, rpm: IDLE_RPM, wheelRpm: 0, launched: false, launchT: null, launchRpm: 0, shiftLeft: 0, shiftTarget: 0, clutchBite: 0,
    spinning: false, spin: 0, limiter: false, cutLeft: 0, pop: 0, sixtyFt: null, finishT: null, trapKmh: null, topKmh: 0,
  };
}

/** Net engine torque (Nm) at an rpm and throttle: curve torque at full throttle, engine braking when closed. */
function engineTorque(car: RaceCar, rpm: number, throttle: number, cut: boolean): number {
  const friction = 14 + rpm * 0.0055;
  if (cut) return -friction;
  return engineTorqueAt(car.curve, Math.max(rpm, IDLE_RPM)) * throttle - friction * (1 - throttle);
}

/** Drop the clutch / release the brake. Returns false (red light) if the tree has not gone green. */
export function launch(s: CarState, car?: RaceCar): boolean {
  if (s.launched) return true;
  s.launched = true;
  s.launchT = s.t;
  s.launchRpm = car && car.launchHoldRpm > 0 ? car.launchHoldRpm : s.rpm;
  s.clutchBite = 0;
  return s.t >= 0;
}

/** Request an upshift. Shift quality compares the rpm with the ideal shift point. */
export function shiftUp(car: RaceCar, s: CarState): ShiftQuality {
  if (!s.launched || s.shiftLeft > 0 || s.gear >= car.spec.ratios.length - 1) return "denied";
  const ideal = car.shiftRpm[s.gear] ?? car.revLimit;
  const rpm = s.rpm;
  const from = car.spec.ratios[s.gear]!;
  s.gear += 1;
  s.shiftLeft = getShiftTime(car);
  s.shiftTarget = (rpm * car.spec.ratios[s.gear]!) / from;
  s.pop = Math.max(s.pop, car.transmission === "automatic" ? 0.2 : 0.8);
  if (s.limiter || rpm >= car.revLimit - 60) return "late";
  if (Math.abs(rpm - ideal) <= PERFECT_SHIFT_RPM) return "perfect";
  return rpm < ideal ? "early" : "ok";
}

/** Request a downshift; refused if it would over-rev the engine. */
export function shiftDown(car: RaceCar, s: CarState): ShiftQuality {
  if (!s.launched || s.shiftLeft > 0 || s.gear === 0) return "denied";
  const next = (s.wheelRpm * car.spec.ratios[s.gear - 1]!) / car.spec.ratios[s.gear]!;
  if (next > car.revLimit + 200) return "denied";
  s.gear -= 1;
  s.shiftLeft = getShiftTime(car);
  s.shiftTarget = next;
  return "ok";
}

function getShiftTime(car: RaceCar): number {
  return car.spec.shiftTimeS * (car.flatShift ? 1 - FLAT_SHIFT_SAVING : 1);
}

/** Advance one car by dt with a throttle position (0..1). Mutates the state. */
export function stepCar(car: RaceCar, s: CarState, throttle: number, distanceM: number, dt = RACE_DT): void {
  const spec = car.spec;
  const r = VEHICLE.tyreRadiusM;
  const revLimitRad = car.revLimit * RPM_TO_RAD;
  s.t += dt;
  s.pop = Math.max(0, s.pop - dt * 3.5);
  let we = s.rpm * RPM_TO_RAD;
  // Rev limiter: a hard ignition cut for a few milliseconds, with pops.
  if (s.cutLeft > 0) s.cutLeft -= dt;
  if (we >= revLimitRad && s.cutLeft <= 0) {
    s.cutLeft = 0.045;
    s.pop = Math.max(s.pop, 0.9);
  }
  const cut = s.cutLeft > 0;
  s.limiter = cut;
  const th = clamp(throttle, 0, 1);

  if (!s.launched) {
    // Staged: the engine revs freely; launch control / converter stall caps it on boxes with built-in clutches.
    let tq = engineTorque(car, s.rpm, th, cut);
    if (car.launchHoldRpm > 0 && s.rpm >= car.launchHoldRpm * Math.max(0.35, th)) tq = Math.min(tq, -20);
    // Two-step launch limiter: cuts sparks to hold the launch rpm (with the classic pops).
    if (car.launchControlRpm > 0 && th > 0 && s.rpm >= car.launchControlRpm) {
      tq = Math.min(tq, -20);
      s.pop = Math.max(s.pop, 0.45);
    }
    we += (tq / car.engineInertia) * dt;
    we = Math.max(we, IDLE_RPM * RPM_TO_RAD * (th > 0 ? 1 : 0.98));
    if (we < IDLE_RPM * RPM_TO_RAD) we += (IDLE_RPM * RPM_TO_RAD - we) * Math.min(1, dt * 8);
    s.rpm = we / RPM_TO_RAD;
    s.wheelRpm = 0;
    return;
  }

  const overall = spec.ratios[s.gear]! * spec.finalDrive;
  const k = (s.v / r) * overall; // engine-side rad/s if the tyres rolled without slip
  let ww = Math.max(s.wheelRpm * RPM_TO_RAD, k);
  const mass = car.massKg;
  const load = roadLoadN(s.v, mass, spec);
  const grip = tractionLimitN(spec, Math.max(0, s.a), s.v);
  const jw = car.wheelInertia / (overall * overall);
  const toForce = (engineSideTorque: number) => (engineSideTorque * overall * spec.efficiency) / r;
  const fromForce = (f: number) => (f * r) / (overall * spec.efficiency);
  let tEng = engineTorque(car, s.rpm, th, cut);
  // Converter torque multiplication fades out as the turbine catches the impeller.
  const mult = spec.converter > 1 && car.launchHoldRpm > 0 ? 1 + (spec.converter - 1) * clamp(1 - ww / (car.launchHoldRpm * RPM_TO_RAD), 0, 1) : 1;

  // Clutch torque available: dumped clutch on a manual, modulated launch clutch on DCT / converter.
  s.clutchBite = Math.min(1, s.clutchBite + dt / car.clutchEngageS);
  let shiftShare = 1;
  if (s.shiftLeft > 0) {
    s.shiftLeft -= dt;
    shiftShare = spec.torqueDuringShift;
    // Synchronising: engine speed falls toward the new gear's speed while drive is interrupted.
    const target = Math.max(k, s.shiftTarget * RPM_TO_RAD);
    we += (target - we) * Math.min(1, dt / 0.07);
    if (shiftShare === 0) {
      ww = k;
      s.spinning = false;
      const aCoast = -load / (mass * 1.04);
      s.v = Math.max(0, s.v + aCoast * dt);
      s.a = aCoast;
      s.x += s.v * dt;
      s.rpm = we / RPM_TO_RAD;
      s.wheelRpm = (s.v / r) * overall / RPM_TO_RAD;
      finishChecks(s, distanceM);
      if (s.shiftLeft <= 0) s.rpm = Math.max(s.rpm, s.wheelRpm);
      return;
    }
  }

  const capNm = car.clutchCapNm * 0.95 * s.clutchBite;
  // Below about idle speed the clutch cannot lock: the engine would stall, so it slips.
  const minLock = IDLE_RPM * 1.25 * RPM_TO_RAD;
  let slipping = we > ww + 3 || ww < minLock;
  let tc: number; // torque through the clutch / converter (engine side)
  if (slipping) {
    // The driver (or launch control) slips the clutch to hold the engine at the launch speed it was revved to.
    const hold = Math.max(minLock, k, s.gear === 0 ? s.launchRpm * RPM_TO_RAD : 0);
    tc = clamp(tEng + ((we - hold) * car.engineInertia) / 0.03, 0, capNm);
  } else if (tEng > capNm) {
    slipping = true; // the engine out-torques the clutch: it slips under load
    tc = capNm;
  } else {
    tc = tEng;
  }
  tc *= shiftShare;

  const drive = toForce(tc) * mult;
  if (!s.spinning && drive > grip) s.spinning = true;
  let a: number;
  if (s.spinning) {
    const slipRatio = ww > 1 ? Math.max(0, (ww - k) / ww) : 0;
    const ft = grip * tyreGripShare(slipRatio);
    a = (ft - load) / (mass * 1.04);
    const reaction = fromForce(ft) / mult;
    if (slipping) {
      we += ((tEng - tc / Math.max(shiftShare, 1e-6)) / car.engineInertia) * dt;
      ww = Math.min(we, ww + ((tc - reaction) / jw) * dt);
    } else {
      we += ((tEng * shiftShare - reaction) / (car.engineInertia + jw)) * dt;
      ww = we;
    }
    s.v = Math.max(0, s.v + a * dt);
    const kNow = (s.v / r) * overall;
    // The tyres hook up once the torque that would reach them with grip no longer overpowers it.
    // Hooking up never locks the clutch instantly: it slips the engine down to road speed.
    const holdAfter = Math.max(minLock, kNow, s.gear === 0 ? s.launchRpm * RPM_TO_RAD : 0);
    const tqHooked = Math.min(engineTorque(car, Math.min(we, holdAfter) / RPM_TO_RAD, th, cut), capNm);
    if (ww <= kNow || toForce(tqHooked * shiftShare) * mult <= grip) {
      ww = kNow;
      s.spinning = false;
    }
    s.spin = clamp(((ww > 1 ? (ww - kNow) / ww : 0) - 0.04) / 0.4, 0, 1);
  } else {
    if (slipping) {
      a = (drive - load) / (mass * 1.04);
      we += ((tEng - tc / Math.max(shiftShare, 1e-6)) / car.engineInertia) * dt;
    } else {
      const rot = (car.engineInertia * overall * overall) / (r * r);
      a = (drive - load) / (mass * 1.04 + rot);
    }
    s.v = Math.max(0, s.v + a * dt);
    ww = (s.v / r) * overall;
    if (!slipping) we = ww;
    s.spin = Math.max(0, s.spin - dt * 4);
  }
  // Engine cannot run below idle while the clutch slips; locked, it turns with the wheels.
  if (slipping) we = Math.max(we, ww, IDLE_RPM * RPM_TO_RAD);
  else we = Math.max(we, ww);
  s.a = a;
  s.x += s.v * dt;
  s.rpm = Math.min(we / RPM_TO_RAD, car.revLimit + 120);
  s.wheelRpm = ww / RPM_TO_RAD;
  if (s.spin > 0.05 && s.rpm >= car.revLimit - 40) s.pop = Math.max(s.pop, 0.5);
  finishChecks(s, distanceM);
}

function finishChecks(s: CarState, distanceM: number) {
  const kmh = s.v * 3.6;
  if (kmh > s.topKmh) s.topKmh = kmh;
  if (s.sixtyFt === null && s.x >= SIXTY_FT_M && s.launchT !== null) s.sixtyFt = s.t - s.launchT;
  if (s.finishT === null && s.x >= distanceM) {
    s.finishT = s.t;
    s.trapKmh = kmh;
  }
}

/** Quickest 60 ft from a standing start, searched over launch rpm (stops early, cheap). */
function sixtyFtTime(car: RaceCar, launchRpm: number): number {
  const s = newCarState();
  s.t = -0.6;
  for (let i = 0; i < 600 && s.t < 0; i++) {
    stepCar(car, s, s.rpm < launchRpm ? 1 : 0, 1e9);
  }
  s.rpm = car.launchHoldRpm > 0 ? Math.min(launchRpm, car.launchHoldRpm) : launchRpm;
  launch(s, car);
  while (s.sixtyFt === null && s.t < 8) {
    const ideal = car.shiftRpm[s.gear];
    if (ideal !== undefined && s.rpm >= ideal && s.shiftLeft <= 0 && !s.spinning) shiftUp(car, s);
    stepCar(car, s, 1, 1e9);
  }
  return s.sixtyFt ?? 99;
}

/** Launch rpm band whose 60 ft is within 0.03 s of the best, and its middle. */
export function findLaunchWindow(car: RaceCar): { ideal: number; lo: number; hi: number } {
  if (car.launchHoldRpm > 0) return { ideal: car.launchHoldRpm, lo: car.launchHoldRpm - 300, hi: car.launchHoldRpm + 300 };
  const rows: [number, number][] = [];
  for (let rpm = 1800; rpm <= car.revLimit - 300; rpm += 250) rows.push([rpm, sixtyFtTime(car, rpm)]);
  const bestT = Math.min(...rows.map((r) => r[1]));
  const good = rows.filter((r) => r[1] <= bestT + 0.03).map((r) => r[0]);
  const best = rows.find((r) => r[1] === bestT)![0];
  return { ideal: best, lo: Math.min(...good), hi: Math.max(...good) };
}

export function findIdealLaunchRpm(car: RaceCar): number {
  return findLaunchWindow(car).ideal;
}

// ───────────── Rival drivers and ghosts ─────────────

export interface DriverSkill {
  /** Reaction to the green light (s). */
  reactionS: number;
  /** Launch rpm as a fraction of the car's ideal launch rpm. */
  launchFactor: number;
  /** Upshift rpm as a fraction of the ideal shift point (>1 = late, may hit the limiter). */
  shiftFactor: number;
}

export interface GhostSample {
  t: number;
  x: number;
  kmh: number;
  rpm: number;
  gear: number;
  spin: number;
  pop: number;
}

export interface RaceRun {
  samples: GhostSample[];
  reactionS: number;
  elapsedS: number | null;
  sixtyFtS: number | null;
  trapKmh: number | null;
  /** Elapsed time from green, including reaction (decides heads-up races). */
  totalS: number | null;
}

/** Simulate a computer-driven run from the tree going green. */
export function driveRun(car: RaceCar, skill: DriverSkill, distance: RaceDistance): RaceRun {
  const dist = RACE_DISTANCE_M[distance];
  const s = newCarState();
  s.t = -1.2;
  const launchRpm = clamp(car.idealLaunchRpm * skill.launchFactor, IDLE_RPM + 300, car.revLimit - 100);
  const samples: GhostSample[] = [];
  let nextSample = -1;
  while (s.t < MAX_RACE_S && s.finishT === null) {
    if (!s.launched && s.t >= skill.reactionS) launch(s, car);
    const throttle = s.launched ? 1 : s.rpm < launchRpm ? 1 : 0;
    if (s.launched && s.shiftLeft <= 0) {
      const ideal = car.shiftRpm[s.gear];
      if (ideal !== undefined && s.rpm >= Math.min(car.revLimit - 20, ideal * skill.shiftFactor)) shiftUp(car, s);
    }
    stepCar(car, s, throttle, dist);
    if (s.t >= nextSample) {
      samples.push({ t: s.t, x: s.x, kmh: s.v * 3.6, rpm: s.rpm, gear: s.gear + 1, spin: s.spin, pop: s.pop });
      nextSample += 1 / 60;
    }
  }
  samples.push({ t: s.t, x: s.x, kmh: s.v * 3.6, rpm: s.rpm, gear: s.gear + 1, spin: s.spin, pop: s.pop });
  return summarize(s, samples);
}

export function summarize(s: CarState, samples: GhostSample[] = []): RaceRun {
  const reaction = s.launchT ?? 0;
  const elapsed = s.finishT !== null && s.launchT !== null ? s.finishT - s.launchT : null;
  return { samples, reactionS: reaction, elapsedS: elapsed, sixtyFtS: s.sixtyFt, trapKmh: s.trapKmh, totalS: s.finishT };
}

/** Ghost position at a time since green (linear between samples). */
export function ghostAt(run: RaceRun, t: number): GhostSample {
  const ss = run.samples;
  if (ss.length === 0) return { t, x: 0, kmh: 0, rpm: IDLE_RPM, gear: 1, spin: 0, pop: 0 };
  if (t <= ss[0]!.t) return ss[0]!;
  let lo = 0;
  let hi = ss.length - 1;
  if (t >= ss[hi]!.t) return ss[hi]!;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (ss[mid]!.t <= t) lo = mid;
    else hi = mid;
  }
  const a = ss[lo]!;
  const b = ss[hi]!;
  const f = (t - a.t) / (b.t - a.t || 1);
  return { t, x: a.x + (b.x - a.x) * f, kmh: a.kmh + (b.kmh - a.kmh) * f, rpm: a.rpm + (b.rpm - a.rpm) * f, gear: f < 0.5 ? a.gear : b.gear, spin: a.spin, pop: Math.max(a.pop, b.pop) };
}

export interface Rival {
  id: string;
  name: string;
  car: string;
  /** Short tagline shown in the race list. */
  tagline: string;
  level: number;
  build: Partial<Build>;
  tune: Partial<Tune>;
  skill: DriverSkill;
  paint: string;
}

/** Rival ghosts, weakest first. They drive the same platform and parts as the player. */
export const RIVALS: Rival[] = [
  { id: "kai", name: "Kai", car: "220 hp turbo hatch", tagline: "Front-drive, boosty, sloppy launches.", level: 1, paint: "#2b67b0",
    build: { turbo: "turbo-t25", intercooler: "ic-small", drivetrain: "dt-fwd" }, tune: { boostTarget: 0.5 },
    skill: { reactionS: 0.38, launchFactor: 0.7, shiftFactor: 0.86 } },
  { id: "mara", name: "Mara", car: "260 hp street coupe", tagline: "Decent driver, piggyback tune.", level: 2, paint: "#d8a915",
    build: { intake: "intake-cai", turbo: "turbo-t25", intercooler: "ic-small", injectors: "inj-440", ecu: "ecu-piggy", exhaust: "exh-catback" }, tune: { boostTarget: 0.85, lambdaTarget: 0.82 },
    skill: { reactionS: 0.34, launchFactor: 0.85, shiftFactor: 0.92 } },
  { id: "dex", name: "Dex", car: "330 hp club racer", tagline: "LSD, short gears, quick hands.", level: 3, paint: "#1e4a33",
    build: { intake: "intake-hf", turbo: "turbo-t35", intercooler: "ic-small", injectors: "inj-750", ecu: "ecu-standalone", exhaust: "exh-3in", differential: "diff-helical", clutch: "clutch-stage2", gearbox: "gbx-6cr", internals: "int-forged" }, tune: { boostTarget: 1.0, lambdaTarget: 0.8, timingOffset: 2, revLimit: 7400, finalDrive: 4.1 },
    skill: { reactionS: 0.28, launchFactor: 0.92, shiftFactor: 0.96 } },
  { id: "rook", name: "Rook", car: "430 hp tuner boss", tagline: "Big single turbo, E85, sticky tyres.", level: 4, paint: "#43484e",
    build: { intake: "intake-hf", camshaft: "cam-race", turbo: "turbo-t45", intercooler: "ic-large", injectors: "inj-1300", fuel: "fuel-e85", ecu: "ecu-standalone", exhaust: "exh-3in", internals: "int-forged", cooling: "cool-alu", differential: "diff-clutch", clutch: "clutch-twin", gearbox: "gbx-6cr", body: "body-wide", wing: "wing-lip" }, tune: { boostTarget: 1.15, lambdaTarget: 0.78, timingOffset: 4, revLimit: 7800, finalDrive: 4.0 },
    skill: { reactionS: 0.24, launchFactor: 0.95, shiftFactor: 0.98 } },
  { id: "vex", name: "Vex", car: "520 hp AWD pro street", tagline: "Dual-clutch, all-wheel drive, no mercy.", level: 5, paint: "#e6e7e3",
    build: { intake: "intake-hf", camshaft: "cam-race", turbo: "turbo-t45", intercooler: "ic-w2a", injectors: "inj-1300", fuel: "fuel-e85", ecu: "ecu-standalone", exhaust: "exh-header", internals: "int-race", cooling: "cool-race", differential: "diff-clutch", gearbox: "gbx-dct7", drivetrain: "dt-awd", body: "body-wide", aero: "aero-lip", wing: "wing-lip" }, tune: { boostTarget: 1.2, lambdaTarget: 0.78, timingOffset: 6, revLimit: 8000 },
    skill: { reactionS: 0.24, launchFactor: 1, shiftFactor: 0.97 } },
  { id: "nova", name: "Nova", car: "620 hp legend", tagline: "Sequential dog box. Perfect every time.", level: 6, paint: "#101113",
    build: { intake: "intake-hf", camshaft: "cam-race", turbo: "turbo-t45", intercooler: "ic-w2a", injectors: "inj-1300", fuel: "fuel-e85", ecu: "ecu-standalone", exhaust: "exh-header", internals: "int-race", cooling: "cool-race", differential: "diff-clutch", gearbox: "gbx-seq6", clutch: "clutch-twin", drivetrain: "dt-awd", body: "body-wide", aero: "aero-lip", wing: "wing-lip" }, tune: { boostTarget: 1.85, lambdaTarget: 0.76, timingOffset: 6, revLimit: 8200, finalDrive: 4.3 },
    skill: { reactionS: 0.15, launchFactor: 1, shiftFactor: 1 } },
  // Free-run field: more drivers across every level, each with a rating from their quarter-mile pace.
  { id: "gus", name: "Gus", car: "Bone-stock automatic", tagline: "Never misses a shift. Never hurries one either.", level: 1, paint: "#a7abb0",
    build: { gearbox: "gbx-auto6" }, tune: {},
    skill: { reactionS: 0.46, launchFactor: 0.6, shiftFactor: 0.8 } },
  { id: "lena", name: "Lena", car: "Naturally aspirated screamer", tagline: "Race cams, high compression, 7,400 rpm.", level: 1, paint: "#d9541a",
    build: { intake: "intake-hf", camshaft: "cam-race", exhaust: "exh-header", internals: "int-hicomp", ecu: "ecu-piggy", cooling: "cool-alu" }, tune: { revLimit: 7400, timingOffset: 2 },
    skill: { reactionS: 0.3, launchFactor: 0.92, shiftFactor: 0.97 } },
  { id: "tomas", name: "Tomas", car: "Front-drive twin-scroll", tagline: "Helical diff, decent hands, spins second gear.", level: 2, paint: "#195a62",
    build: { turbo: "turbo-t30", intercooler: "ic-small", injectors: "inj-440", ecu: "ecu-piggy", drivetrain: "dt-fwd", differential: "diff-helical", exhaust: "exh-catback" }, tune: { boostTarget: 0.8, lambdaTarget: 0.8 },
    skill: { reactionS: 0.32, launchFactor: 0.88, shiftFactor: 0.93 } },
  { id: "ivy", name: "Ivy", car: "Automatic sleeper", tagline: "Looks stock. Converter launch, big boost.", level: 2, paint: "#16264a",
    build: { intake: "intake-cai", turbo: "turbo-t30", intercooler: "ic-large", injectors: "inj-750", fuel: "fuel-98", ecu: "ecu-piggy", exhaust: "exh-3in", gearbox: "gbx-auto6" }, tune: { boostTarget: 1.0, lambdaTarget: 0.8 },
    skill: { reactionS: 0.3, launchFactor: 1, shiftFactor: 0.95 } },
  { id: "jax", name: "Jax", car: "Drift missile", tagline: "Locked diff, big wing, all smoke off the line.", level: 3, paint: "#a8121a",
    build: { intake: "intake-hf", turbo: "turbo-t35", intercooler: "ic-small", injectors: "inj-750", ecu: "ecu-standalone", exhaust: "exh-3in", internals: "int-forged", differential: "diff-clutch", clutch: "clutch-twin", gearbox: "gbx-6cr", body: "body-overfender", wing: "wing-gt" }, tune: { boostTarget: 0.95, lambdaTarget: 0.8, timingOffset: 2 },
    skill: { reactionS: 0.3, launchFactor: 1.25, shiftFactor: 0.94 } },
  { id: "sora", name: "Sora", car: "Dual-clutch time-attack", tagline: "Race fuel, full aero, lightning shifts. Built for corners, not the strip.", level: 4, paint: "#e6c229",
    build: { intake: "intake-hf", camshaft: "cam-vvt", turbo: "turbo-t35", intercooler: "ic-large", injectors: "inj-1000", fuel: "fuel-race", ecu: "ecu-standalone", exhaust: "exh-header", internals: "int-forged", cooling: "cool-alu", differential: "diff-clutch", gearbox: "gbx-dct7", body: "body-wide", aero: "aero-gt", wing: "wing-gt" }, tune: { boostTarget: 1.3, lambdaTarget: 0.79, timingOffset: 3, revLimit: 7600 },
    skill: { reactionS: 0.26, launchFactor: 1, shiftFactor: 0.97 } },
  { id: "brick", name: "Brick", car: "Heavy widebody automatic", tagline: "E85 and a converter. Slow to react, brutal on top.", level: 4, paint: "#2f7a3e",
    build: { intake: "intake-hf", turbo: "turbo-t45", intercooler: "ic-large", injectors: "inj-1300", fuel: "fuel-e85", ecu: "ecu-standalone", exhaust: "exh-3in", internals: "int-forged", cooling: "cool-race", differential: "diff-clutch", gearbox: "gbx-auto6", body: "body-wide", wing: "wing-swan" }, tune: { boostTarget: 1.4, lambdaTarget: 0.78, timingOffset: 3, revLimit: 7400 },
    skill: { reactionS: 0.36, launchFactor: 1, shiftFactor: 0.97 } },
  { id: "zed", name: "Zed", car: "AWD sequential", tagline: "Dog box, all-wheel drive, quick on the tree.", level: 5, paint: "#4b5056",
    build: { intake: "intake-hf", camshaft: "cam-race", turbo: "turbo-t45", intercooler: "ic-w2a", injectors: "inj-1300", fuel: "fuel-e85", ecu: "ecu-standalone", exhaust: "exh-header", internals: "int-race", cooling: "cool-race", differential: "diff-clutch", gearbox: "gbx-seq6", clutch: "clutch-twin", drivetrain: "dt-awd", body: "body-wide", aero: "aero-lip", wing: "wing-lip" }, tune: { boostTarget: 1.5, lambdaTarget: 0.77, timingOffset: 5, revLimit: 8000, finalDrive: 4.1 },
    skill: { reactionS: 0.2, launchFactor: 1, shiftFactor: 0.99 } },
  { id: "phantom", name: "Phantom", car: "Sequential AWD monster", tagline: "Nova's spec with a near-perfect light. The final ghost.", level: 7, paint: "#0d1320",
    build: { intake: "intake-hf", camshaft: "cam-race", turbo: "turbo-t45", intercooler: "ic-w2a", injectors: "inj-1300", fuel: "fuel-e85", ecu: "ecu-standalone", exhaust: "exh-header", internals: "int-race", cooling: "cool-race", differential: "diff-clutch", gearbox: "gbx-seq6", clutch: "clutch-twin", drivetrain: "dt-awd", body: "body-wide", aero: "aero-lip", wing: "wing-lip" }, tune: { boostTarget: 1.85, lambdaTarget: 0.76, timingOffset: 6, revLimit: 8200, finalDrive: 4.3 },
    skill: { reactionS: 0.1, launchFactor: 1, shiftFactor: 1 } },
];

/** Rating 1-99 from the rival's own quarter-mile time (18 s = 1, 10 s = 99). Cached: rivals never change. */
const ratingCache = new Map<string, number>();
export function rivalRating(rivalId: string): number {
  const hit = ratingCache.get(rivalId);
  if (hit !== undefined) return hit;
  const t = rivalGhost(rivalId, "quarter").totalS ?? 30;
  const rating = Math.round(Math.min(99, Math.max(1, 1 + ((18 - t) / 8) * 98)));
  ratingCache.set(rivalId, rating);
  return rating;
}

/** Label for a rating band. */
export function ratingTier(rating: number): string {
  if (rating < 20) return "Rookie";
  if (rating < 40) return "Street";
  if (rating < 55) return "Club";
  if (rating < 70) return "Pro";
  if (rating < 85) return "Elite";
  return "Legend";
}

export function rivalBuild(r: Rival): { build: Build; tune: Tune } {
  const build = { ...STOCK_BUILD, ...r.build };
  const tune = clampTune(build, { ...STOCK_TUNE, gearRatios: [...getPart("gearbox", build.gearbox).ratios], finalDrive: getPart("differential", build.differential).finalDrive, ...r.tune });
  return { build, tune };
}

const ghostCache = new Map<string, RaceRun>();
const rivalCars = new Map<string, RaceCar>();
function rivalCar(r: Rival): RaceCar {
  let car = rivalCars.get(r.id);
  if (!car) {
    const { build, tune } = rivalBuild(r);
    car = makeRaceCar(build, tune);
    rivalCars.set(r.id, car);
  }
  return car;
}
/** The rival's pre-computed run over a distance (cached: it never changes). */
export function rivalGhost(rivalId: string, distance: RaceDistance): RaceRun {
  const key = `${rivalId}|${distance}`;
  const hit = ghostCache.get(key);
  if (hit) return hit;
  const r = RIVALS.find((x) => x.id === rivalId);
  if (!r) throw new Error(`Unknown rival ${rivalId}`);
  const run = driveRun(rivalCar(r), r.skill, distance);
  ghostCache.set(key, run);
  return run;
}

export function rivalPower(rivalId: string): number {
  const r = RIVALS.find((x) => x.id === rivalId)!;
  return rivalCar(r).peakPowerHp;
}

// ───────────── Career race ladder ─────────────

export interface RaceEvent {
  id: string;
  title: string;
  rival: string;
  distance: RaceDistance;
  /** Paid the first time the event is won. */
  purse: number;
}

/** Re-winning an event already won pays this share of its purse. */
export const REMATCH_SHARE = 0.1;

export const RACE_EVENTS: RaceEvent[] = [
  { id: "r1", title: "Street Rival", rival: "kai", distance: "quarter", purse: 2500 },
  { id: "r2", title: "Friday Night Heads-Up", rival: "mara", distance: "quarter", purse: 3000 },
  { id: "r3", title: "Industrial Half", rival: "mara", distance: "half", purse: 3800 },
  { id: "r4", title: "Club Shootout", rival: "dex", distance: "quarter", purse: 5000 },
  { id: "r5", title: "Club Half-Mile", rival: "dex", distance: "half", purse: 6000 },
  { id: "r6", title: "Airfield Mile", rival: "dex", distance: "mile", purse: 7500 },
  { id: "r7", title: "Boss Battle: Rook", rival: "rook", distance: "quarter", purse: 9000 },
  { id: "r8", title: "Rook's Half", rival: "rook", distance: "half", purse: 10500 },
  { id: "r9", title: "Rook's Mile", rival: "rook", distance: "mile", purse: 12000 },
  { id: "r10", title: "Pro Street Qualifier", rival: "vex", distance: "quarter", purse: 15000 },
  { id: "r11", title: "Pro Street Mile", rival: "vex", distance: "mile", purse: 18000 },
  { id: "r12", title: "Legend: Quarter", rival: "nova", distance: "quarter", purse: 22000 },
  { id: "r13", title: "Legend: Half", rival: "nova", distance: "half", purse: 26000 },
  { id: "r14", title: "Legend: The Mile", rival: "nova", distance: "mile", purse: 32000 },
];

export function isRaceUnlocked(eventId: string, wins: Record<string, number>): boolean {
  const i = RACE_EVENTS.findIndex((e) => e.id === eventId);
  if (i < 0) return false;
  const prev = RACE_EVENTS[i - 1];
  return i === 0 || !prev || (wins[prev.id] ?? 0) > 0 || (wins[eventId] ?? 0) > 0;
}

/** Purse for a win: the full purse the first time, a rematch share afterwards. */
export function purseFor(event: RaceEvent, previousWins: number): number {
  return previousWins > 0 ? Math.round(event.purse * REMATCH_SHARE) : event.purse;
}

/** Re-exported for the race scene's wheel drawing. */
export const TYRE_RADIUS_M = VEHICLE.tyreRadiusM;
export { bodyworkSpec };
