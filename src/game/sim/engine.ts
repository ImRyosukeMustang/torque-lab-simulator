// Deterministic engine model. Pure functions only: the same build + tune always
// yields the same curves. Rendering, dyno UI and challenge grading all read this.
import { buildCost, clampTune, ENGINE, getPart } from "./parts";
import type { Build, CurvePoint, Diagnostic, SimResult, Tune } from "./types";

export const AMBIENT = { pressureBar: 1.013, tempK: 298 };
const R_AIR = 287;
const LHV = 44e6; // J/kg gasoline
const STOICH = 14.7;
const FUEL_DENSITY = 0.745; // g/cc
const MAX_DUTY = 0.95;
const HEAT_SOAK_K = 10;
const RPM_START = 1500;
const RPM_STEP = 250;

export const LIMITS = {
  egtSafeC: 900,
  egtCriticalC: 950,
  chargeTempC: 70,
  dutyWarn: 0.85,
};

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const smoothstep = (a: number, b: number, x: number) => {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

/** Combustion quality vs AFR: best power near 12.8. */
export function afrPowerFactor(afr: number): number {
  const d = afr - 12.8;
  let f = d < 0 ? 1 - 0.02 * d * d : 1 - 0.012 * d * d;
  if (afr > 15.5) f -= (afr - 15.5) * 0.08;
  return clamp(f, 0.4, 1);
}

/** Ignition efficiency vs advance offset: small gain up to ~+5°, losses when retarded. */
export function timingFactor(offset: number): number {
  return 1 + 0.012 * offset - 0.0012 * offset * offset;
}

/** Cam-only volumetric efficiency at an RPM. */
export function camVE(build: Build, rpm: number): number {
  const cam = getPart("camshaft", build.camshaft);
  const d = rpm - cam.peakRpm;
  const spread = d < 0 ? cam.spreadLow : cam.spreadHigh;
  return cam.peakVE * Math.exp(-0.35 * (d / spread) ** 2);
}

interface PointState {
  point: CurvePoint;
  fuelEnergyKw: number;
  turboFlowRatio: number;
  overboost: number;
}

function simulatePoint(build: Build, tune: Tune, rpm: number): PointState {
  const intake = getPart("intake", build.intake);
  const turbo = getPart("turbo", build.turbo);
  const ic = getPart("intercooler", build.intercooler);
  const inj = getPart("injectors", build.injectors);
  const exh = getPart("exhaust", build.exhaust);
  const hasTurbo = turbo.maximumFlow > 0;

  const vd = ENGINE.displacementL / 1000; // m^3
  const cycleRate = rpm / 120; // intake events per second for the whole engine (4-stroke)
  const veCam = camVE(build, rpm);
  const rhoAmb = (AMBIENT.pressureBar * 1e5) / (R_AIR * AMBIENT.tempK);

  // Boost target, spool and overboost
  let boost = 0;
  let overboost = 0;
  if (hasTurbo) {
    const exhaustEnergy = veCam * rhoAmb * vd * cycleRate * (1 + exh.spoolAssist) * (turbo.turbineEfficiency / 0.7);
    const spoolStart = 0.025 * turbo.inertia + 0.01;
    const spoolFull = 0.045 * turbo.inertia + 0.02;
    const spool = smoothstep(spoolStart, spoolFull, exhaustEnergy);
    const cap = turbo.maximumBoost * 1.15;
    overboost = Math.max(0, tune.boostTarget - turbo.maximumBoost);
    boost = Math.min(tune.boostTarget, cap) * spool;
  }

  // Fixed-point solve: airflow depends on intake/exhaust losses which depend on airflow.
  let mdot = veCam * rhoAmb * vd * cycleRate;
  let map = AMBIENT.pressureBar;
  let chargeK = AMBIENT.tempK + HEAT_SOAK_K;
  let ve = veCam;
  let turboFlowRatio = 0;
  for (let i = 0; i < 6; i++) {
    const intakeDrop = clamp(0.15 * (mdot / intake.flowCapacity) ** 2, 0, 0.45);
    const p1 = AMBIENT.pressureBar * (1 - intakeDrop);
    const backPressure = clamp(0.12 * (mdot / exh.flowCapacity) ** 2, 0, 0.35);
    ve = veCam * (1 - backPressure) * (hasTurbo ? 1 - 0.04 * boost : 1);

    if (hasTurbo) {
      map = AMBIENT.pressureBar + boost;
      const chokeFlow = turbo.maximumFlow * (p1 / AMBIENT.pressureBar);
      turboFlowRatio = mdot / chokeFlow;
      if (turboFlowRatio > 1) {
        // Compressor choke: the turbo cannot deliver the target, manifold pressure falls.
        map = Math.max(p1, map / turboFlowRatio);
      }
      const icDrop = ic.pressureDrop * (mdot / 0.25) ** 2;
      const pr = Math.max(1, (map + icDrop) / p1);
      const etaC = turbo.compressorEfficiency * (1 - 0.3 * clamp((turboFlowRatio - 0.75) / 0.25, 0, 1.5));
      const t2 = AMBIENT.tempK * (1 + (pr ** 0.2857 - 1) / Math.max(0.4, etaC));
      chargeK = t2 - ic.effectiveness * (t2 - AMBIENT.tempK) + HEAT_SOAK_K;
    } else {
      map = p1;
      chargeK = AMBIENT.tempK + HEAT_SOAK_K;
    }
    const rho = (map * 1e5) / (R_AIR * chargeK);
    mdot = ve * rho * vd * cycleRate;
  }
  const boostActual = Math.max(0, map - AMBIENT.pressureBar);

  // Fuel delivery
  const injCapKgS = (inj.flowCc * ENGINE.cylinders * FUEL_DENSITY) / 60 / 1000;
  const fuelReq = mdot / tune.afrTarget;
  let duty = fuelReq / injCapKgS;
  let fuel = fuelReq;
  if (duty > MAX_DUTY) {
    duty = MAX_DUTY;
    fuel = MAX_DUTY * injCapKgS;
  }
  const afr = mdot / fuel;

  // Knock margin (>0 safe). Driven by manifold pressure, charge temp, advance and mixture.
  const knockIndex =
    0.45 * boostActual + (chargeK - 315) / 80 + 0.11 * tune.timingOffset + 0.2 * (afr - 12.5);
  const knockMargin = 1 - knockIndex;

  // Combustion and losses
  const fuelEnergyW = (mdot / STOICH) * LHV * afrPowerFactor(afr);
  let etaI = 0.45 * timingFactor(tune.timingOffset);
  if (knockMargin < 0) etaI *= 1 - Math.min(0.15, -knockMargin * 0.12);
  const indicatedW = fuelEnergyW * etaI;
  const k = rpm / 1000;
  const fmepBar = 0.5 + 0.07 * k + 0.018 * k * k;
  const frictionW = fmepBar * 1e5 * vd * cycleRate;
  const brakeW = Math.max(0, indicatedW - frictionW);
  const bmepBar = brakeW / (vd * cycleRate) / 1e5;
  const torqueNm = (bmepBar * 1e5 * vd) / (4 * Math.PI);
  const powerHp = brakeW / 745.7;

  const egtC =
    540 + 14 * bmepBar + 55 * (afr - 12.5) - 14 * tune.timingOffset + 60 * (rpm / 7000) +
    (knockMargin < 0 ? -knockMargin * 80 : 0);

  return {
    point: {
      rpm,
      ve,
      boostBar: boostActual,
      bmepBar,
      torqueNm,
      powerHp,
      afr,
      egtC,
      chargeTempC: chargeK - 273.15,
      airFlowKgS: mdot,
      injectorDuty: duty,
      knockMargin,
    },
    fuelEnergyKw: fuelEnergyW / 1000,
    turboFlowRatio,
    overboost,
  };
}

const round = (v: number, d = 1) => Math.round(v * 10 ** d) / 10 ** d;

export function simulate(build: Build, rawTune: Tune): SimResult {
  const tune = clampTune(build, rawTune);
  const cam = getPart("camshaft", build.camshaft);
  const turbo = getPart("turbo", build.turbo);

  const states: PointState[] = [];
  for (let rpm = RPM_START; rpm < tune.revLimit; rpm += RPM_STEP) states.push(simulatePoint(build, tune, rpm));
  states.push(simulatePoint(build, tune, tune.revLimit));
  const curve = states.map((s) => s.point);

  const maxBy = (f: (p: CurvePoint) => number) => curve.reduce((a, b) => (f(b) > f(a) ? b : a));
  const pPow = maxBy((p) => p.powerHp);
  const pTq = maxBy((p) => p.torqueNm);
  const peakBoost = Math.max(...curve.map((p) => p.boostBar));
  const peakEgt = Math.max(...curve.map((p) => p.egtC));
  const peakBmep = Math.max(...curve.map((p) => p.bmepBar));
  const maxCharge = Math.max(...curve.map((p) => p.chargeTempC));
  const maxDuty = Math.max(...curve.map((p) => p.injectorDuty));
  const minKnock = Math.min(...curve.map((p) => p.knockMargin));
  const maxFlowRatio = Math.max(...states.map((s) => s.turboFlowRatio));
  const loaded = curve.filter((p) => p.bmepBar > 6);
  const maxLoadedAfr = Math.max(...loaded.map((p) => p.afr), 0);
  const thermalLoad = Math.max(...states.map((s) => (s.fuelEnergyKw * 0.28) / ENGINE.coolingCapacityKw));

  const diagnostics: Diagnostic[] = [];
  let rel = 100;
  const hit = (amount: number) => {
    rel -= Math.max(0, amount);
  };

  // Internals stress
  if (peakBmep > 21) hit((peakBmep - 21) * 1.5);
  if (peakBmep > ENGINE.internalsBmepLimit) {
    hit((peakBmep - ENGINE.internalsBmepLimit) * 6);
    diagnostics.push({ code: "BMEP_OVER", severity: "critical", message: `Cylinder pressure ${round(peakBmep)} bar BMEP exceeds the stock internals limit of ${ENGINE.internalsBmepLimit} bar.` });
  } else if (peakBmep > 21) {
    diagnostics.push({ code: "BMEP_HIGH", severity: "warning", message: `BMEP ${round(peakBmep)} bar is approaching the internals limit (${ENGINE.internalsBmepLimit} bar).` });
  }

  // Exhaust temperature
  if (peakEgt > LIMITS.egtSafeC) {
    hit((peakEgt - LIMITS.egtSafeC) * 0.25);
    if (peakEgt > LIMITS.egtCriticalC) hit((peakEgt - LIMITS.egtCriticalC) * 0.6);
    diagnostics.push({
      code: "EGT_HIGH",
      severity: peakEgt > LIMITS.egtCriticalC ? "critical" : "warning",
      slot: "exhaust",
      message: `Exhaust gas temperature peaks at ${Math.round(peakEgt)}°C (safe limit ${LIMITS.egtSafeC}°C). Richer fuelling or more ignition advance lowers it.`,
    });
  }

  // Knock
  if (minKnock < 0) {
    hit(Math.min(45, 120 * -minKnock));
    diagnostics.push({ code: "KNOCK", severity: "critical", slot: "ecu", message: "Detonation detected. Reduce boost or ignition advance, enrich the mixture or cool the charge." });
  } else if (minKnock < 0.08) {
    diagnostics.push({ code: "KNOCK_MARGIN", severity: "warning", slot: "ecu", message: "Knock margin is thin. Small changes in conditions could cause detonation." });
  }

  // Lean mixture
  const boosted = peakBoost > 0.2;
  const leanLimit = boosted ? 13.0 : 13.8;
  if (maxLoadedAfr > leanLimit) {
    hit((maxLoadedAfr - leanLimit) * (boosted ? 25 : 15));
    diagnostics.push({ code: "LEAN", severity: maxLoadedAfr > leanLimit + 0.8 ? "critical" : "warning", slot: "injectors", message: `Mixture goes lean under load (AFR ${round(maxLoadedAfr)}). Target ${boosted ? "≤ 13.0 under boost" : "≤ 13.8"}.` });
  }

  // Injector duty
  if (maxDuty > LIMITS.dutyWarn) {
    hit((maxDuty - LIMITS.dutyWarn) * 100);
    diagnostics.push({ code: "INJ_DUTY", severity: maxDuty >= MAX_DUTY ? "critical" : "warning", slot: "injectors", message: `Injectors reach ${Math.round(maxDuty * 100)}% duty cycle. They are out of capacity.` });
  }

  // Turbo
  if (turbo.maximumFlow > 0) {
    const ob = Math.max(0, tune.boostTarget - turbo.maximumBoost);
    if (ob > 0) {
      hit(ob * 40);
      diagnostics.push({ code: "OVERBOOST", severity: "critical", slot: "turbo", message: `Boost target exceeds the ${turbo.name}'s safe maximum of ${turbo.maximumBoost} bar. Expect turbo overspeed.` });
    }
    if (maxFlowRatio > 0.97) {
      hit(8);
      diagnostics.push({ code: "CHOKE", severity: "warning", slot: "turbo", message: "Compressor is at its choke limit: it cannot flow more air, so boost falls away and outlet temperatures climb." });
    }
    if (maxCharge > LIMITS.chargeTempC) {
      hit((maxCharge - LIMITS.chargeTempC) * 0.4);
      diagnostics.push({ code: "CHARGE_HOT", severity: maxCharge > 100 ? "critical" : "warning", slot: "intercooler", message: `Intake charge reaches ${Math.round(maxCharge)}°C. An intercooler (or a better one) would cool and densify the air.` });
    }
  }

  // Valvetrain
  if (tune.revLimit > cam.valvetrainLimit) {
    hit((tune.revLimit - cam.valvetrainLimit) / 50);
    diagnostics.push({ code: "VALVE_FLOAT", severity: "critical", slot: "camshaft", message: `Rev limit ${tune.revLimit} rpm exceeds the valvetrain limit (${cam.valvetrainLimit} rpm). Risk of valve float.` });
  }

  // Cooling
  if (thermalLoad > 0.85) {
    hit((thermalLoad - 0.85) * 60);
    diagnostics.push({ code: "THERMAL", severity: thermalLoad > 1 ? "critical" : "warning", message: `Cooling system at ${Math.round(thermalLoad * 100)}% of capacity under sustained load.` });
  }

  // Intake restriction hint
  const intake = getPart("intake", build.intake);
  const peakFlow = Math.max(...curve.map((p) => p.airFlowKgS));
  if (peakFlow > intake.flowCapacity * 0.75) {
    diagnostics.push({ code: "INTAKE_RESTRICT", severity: "info", slot: "intake", message: `Peak airflow ${round(peakFlow * 1000, 0)} g/s is close to the intake's capacity. It is restricting power.` });
  }

  if (diagnostics.length === 0) {
    diagnostics.push({ code: "OK", severity: "info", message: "All systems within operating limits." });
  }

  return {
    curve,
    peakPowerHp: round(pPow.powerHp),
    peakPowerRpm: pPow.rpm,
    peakTorqueNm: round(pTq.torqueNm),
    peakTorqueRpm: pTq.rpm,
    peakBoostBar: round(peakBoost, 2),
    peakEgtC: Math.round(peakEgt),
    minAfr: round(Math.min(...curve.map((p) => p.afr))),
    maxAfr: round(Math.max(...curve.map((p) => p.afr))),
    thermalLoad: round(thermalLoad, 2),
    reliability: round(clamp(rel, 0, 100)),
    diagnostics,
    buildCost: buildCost(build),
  };
}

/** Linear interpolation of the curve at an RPM (for the live dyno sweep and challenge checks). */
export function sampleCurve(curve: CurvePoint[], rpm: number): CurvePoint {
  if (rpm <= curve[0].rpm) return curve[0];
  for (let i = 1; i < curve.length; i++) {
    const b = curve[i];
    if (rpm <= b.rpm) {
      const a = curve[i - 1];
      const t = (rpm - a.rpm) / (b.rpm - a.rpm);
      const out = { ...a };
      (Object.keys(a) as (keyof CurvePoint)[]).forEach((key) => {
        out[key] = a[key] + (b[key] - a[key]) * t;
      });
      return out;
    }
  }
  return curve[curve.length - 1];
}
