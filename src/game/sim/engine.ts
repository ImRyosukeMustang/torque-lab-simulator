// Deterministic engine model. Pure functions only: the same build + tune always
// yields the same curves. Rendering, dyno UI and challenge grading all read this.
import { drivetrainEfficiency, simulateVehicle } from "./drivetrain";
import { buildCost, clampTune, getPart } from "./parts";
import type { Build, CurvePoint, Diagnostic, SimResult, Tune } from "./types";

export const AMBIENT = { pressureBar: 1.013, tempK: 298 };
const R_AIR = 287;
const CP_AIR = 1.005; // kJ/kg·K
const GAMMA_EXP = 0.2857; // (gamma - 1) / gamma for air
const FUEL_DENSITY = 0.745; // g/cc, injector flow is rated on gasoline-like test fluid
const MAX_DUTY = 0.95;
/** Compression ratio and octane the base efficiency / knock maps were calibrated on. */
const BASE_CR = 9.5;
const BASE_RON = 95;
/** Indicated thermal efficiency of the AM-20 at 9.5:1 with MBT timing (calibrated on 95 RON). */
const BASE_INDICATED_EFF = 0.456;
/** Share of the fuel's latent heat that cools the charge before the intake valve closes (port injection). */
const EVAP_FRACTION = 0.148;
/** Share of fuel energy rejected to coolant and oil. */
const COOLANT_SHARE = 0.28;
/** Intercooler pressure-drop rating conditions. */
const IC_REF_FLOW = 0.25;
const IC_REF_DENSITY = (2.0e5) / (R_AIR * 368);
const RPM_START = 1500;
const RPM_STEP = 250;

export const LIMITS = {
  egtSafeC: 900,
  egtCriticalC: 950,
  chargeTempC: 70,
  dutyWarn: 0.85,
  /** Leanest safe lambda under boost / naturally aspirated at full load. */
  lambdaLeanBoost: 0.88,
  lambdaLeanNa: 0.94,
  /** Richer than this wastes fuel and washes oil from the bores. */
  lambdaRich: 0.75,
};

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const smoothstep = (a: number, b: number, x: number) => {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

/**
 * Burn quality vs lambda. Peak torque sits slightly rich (λ ≈ 0.87) from faster flame speed and
 * extra charge moles; richer still, unburned fuel absorbs heat. Lean of stoichiometric the burn
 * slows; the missing fuel energy itself is accounted for separately from delivered fuel mass.
 */
export function burnFactor(lambda: number): number {
  const d = (Math.min(lambda, 1) - 0.87) * 14.7;
  let f = d < 0 ? 1 - 0.02 * d * d : 1 - 0.012 * d * d;
  if (lambda > 1) f *= 1 - 1.25 * (lambda - 1);
  return clamp(f, 0.4, 1);
}

/** Ignition efficiency vs advance offset: small gain up to ~+5°, losses when retarded. */
export function timingFactor(offset: number): number {
  return 1 + 0.012 * offset - 0.0012 * offset * offset;
}

/** Otto-cycle efficiency relative to the base compression ratio (effective gamma-1 = 0.3). */
export function compressionFactor(cr: number): number {
  return (1 - cr ** -0.3) / (1 - BASE_CR ** -0.3);
}

/** Compressor isentropic efficiency from a simple map: an efficiency island plus surge and choke fall-off. */
export function compressorEfficiency(peak: number, islandFlow: number, islandPr: number, flowRatio: number, pr: number): number {
  const df = (flowRatio - islandFlow) / 0.5;
  const dp = (pr - islandPr) / 1.2;
  let eta = peak * (1 - 0.35 * df * df - 0.12 * dp * dp);
  // Choke: past ~92% of the wheel's flow the inducer reaches sonic speed and efficiency collapses.
  eta -= peak * 0.25 * clamp((flowRatio - 0.92) / 0.15, 0, 1.5);
  // Surge: too little flow for the pressure ratio and the air recirculates.
  const surge = surgeFlow(pr);
  if (flowRatio < surge) eta -= peak * 0.25 * clamp((surge - flowRatio) / 0.1, 0, 1);
  return clamp(eta, peak * 0.45, peak);
}

/** Lowest stable flow (fraction of choke) at a pressure ratio. */
export function surgeFlow(pr: number): number {
  return 0.12 + 0.1 * Math.max(0, pr - 1.3);
}

/** Intercooler effectiveness at a mass flow (ε-NTU: conductance grows ~m^0.6, so NTU ∝ m^-0.4). */
export function intercoolerEffectiveness(rated: number, mdot: number): number {
  if (rated <= 0) return 0;
  const ntu0 = -Math.log(1 - rated);
  return 1 - Math.exp(-ntu0 * (IC_REF_FLOW / Math.max(0.02, mdot)) ** 0.4);
}

/** Camshaft-only volumetric efficiency at an RPM. */
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
  surgeRatio: number;
  icDropBar: number;
  compressorOutC: number;
  evapCoolK: number;
}

function simulatePoint(build: Build, tune: Tune, rpm: number): PointState {
  const engine = getPart("engine", build.engine);
  const intake = getPart("intake", build.intake);
  const turbo = getPart("turbo", build.turbo);
  const ic = getPart("intercooler", build.intercooler);
  const inj = getPart("injectors", build.injectors);
  const exh = getPart("exhaust", build.exhaust);
  const fuelP = getPart("fuel", build.fuel);
  const internals = getPart("internals", build.internals);
  const cooling = getPart("cooling", build.cooling);
  const hasTurbo = turbo.maximumFlow > 0;

  const vd = engine.displacementL / 1000; // m^3
  const cycleRate = rpm / 120; // 4-stroke cycles per second per cylinder
  const veCam = camVE(build, rpm);
  const rhoAmb = (AMBIENT.pressureBar * 1e5) / (R_AIR * AMBIENT.tempK);
  const lambdaT = tune.lambdaTarget;

  // Boost target and spool
  let boost = 0;
  if (hasTurbo) {
    const exhaustEnergy = veCam * rhoAmb * vd * cycleRate * (1 + exh.spoolAssist) * (turbo.turbineEfficiency / 0.7);
    const spoolStart = 0.025 * turbo.inertia + 0.01;
    const spoolFull = 0.045 * turbo.inertia + 0.02;
    const spool = smoothstep(spoolStart, spoolFull, exhaustEnergy);
    boost = Math.min(tune.boostTarget, turbo.maximumBoost * 1.15) * spool;
  }

  // Evaporative cooling from the fuel sprayed per kg of air, at the target mixture.
  const fuelAirTarget = 1 / (lambdaT * fuelP.stoichAfr);
  const evapCoolK = (fuelAirTarget * fuelP.latentHeatKjKg * EVAP_FRACTION) / CP_AIR;

  // Fixed-point solve: airflow depends on intake/exhaust/intercooler losses which depend on airflow.
  let mdot = veCam * rhoAmb * vd * cycleRate;
  let map = AMBIENT.pressureBar;
  let chargeK = AMBIENT.tempK + cooling.heatSoakK - evapCoolK;
  let ve = veCam;
  let turboFlowRatio = 0;
  let pr = 1;
  let etaC = 0;
  let epsIc = 0;
  let icDrop = 0;
  let t2 = AMBIENT.tempK;
  for (let i = 0; i < 8; i++) {
    const intakeDrop = clamp(0.15 * (mdot / intake.flowCapacity) ** 2, 0, 0.45);
    const p1 = AMBIENT.pressureBar * (1 - intakeDrop);
    const backPressure = clamp(0.12 * (mdot / exh.flowCapacity) ** 2, 0, 0.35);
    ve = veCam * (1 - backPressure) * (hasTurbo ? 1 - 0.04 * boost : 1);

    if (hasTurbo) {
      map = AMBIENT.pressureBar + boost;
      const chokeFlow = turbo.maximumFlow * (p1 / AMBIENT.pressureBar);
      turboFlowRatio = mdot / chokeFlow;
      if (turboFlowRatio > 1) map = Math.max(p1, map / turboFlowRatio); // choke: target unreachable
      // Intercooler pressure drop scales with flow squared over core density (Δp ∝ ṁ²/ρ).
      const rho2 = ((map + icDrop) * 1e5) / (R_AIR * t2);
      icDrop = ic.pressureDrop * (mdot / IC_REF_FLOW) ** 2 * (IC_REF_DENSITY / rho2);
      pr = Math.max(1, (map + icDrop) / p1);
      etaC = compressorEfficiency(turbo.compressorEfficiency, turbo.islandFlow, turbo.islandPr, turboFlowRatio, pr);
      t2 = AMBIENT.tempK * (1 + (pr ** GAMMA_EXP - 1) / etaC);
      epsIc = intercoolerEffectiveness(ic.effectiveness, mdot);
      const sinkK = AMBIENT.tempK + ic.sinkOffsetK;
      const t3 = t2 - epsIc * (t2 - sinkK);
      chargeK = t3 + cooling.heatSoakK - evapCoolK;
    } else {
      map = p1;
      chargeK = AMBIENT.tempK + cooling.heatSoakK - evapCoolK;
    }
    const rho = (map * 1e5) / (R_AIR * chargeK);
    mdot = ve * rho * vd * cycleRate;
  }
  const boostActual = Math.max(0, map - AMBIENT.pressureBar);

  // Fuel delivery: injectors are flow-limited, so lambda can go lean of the target.
  const injCapKgS = (inj.flowCc * engine.cylinders * FUEL_DENSITY) / 60 / 1000;
  const fuelReq = mdot * fuelAirTarget;
  let duty = fuelReq / injCapKgS;
  let fuel = fuelReq;
  if (duty > MAX_DUTY) {
    duty = MAX_DUTY;
    fuel = MAX_DUTY * injCapKgS;
  }
  const lambda = mdot / fuel / fuelP.stoichAfr;
  const afr = lambda * fuelP.stoichAfr;

  // Knock margin (>0 safe). Driven by manifold pressure, charge temp, advance, mixture, compression and octane.
  const knockIndex =
    0.45 * boostActual + (chargeK - 315) / 80 + 0.11 * tune.timingOffset + 2.94 * (lambda - 0.85) +
    0.2 * (internals.compression - BASE_CR) - 0.055 * (fuelP.octane - BASE_RON);
  const knockMargin = 1 - knockIndex;

  // Combustion: energy comes from the fuel that can actually burn. Rich of stoichiometric the oxygen
  // runs out first (burnable fuel = air / stoich); lean, every gram delivered burns.
  const burnable = Math.min(fuel, mdot / fuelP.stoichAfr);
  const fuelEnergyW = burnable * fuelP.lhvMjKg * 1e6 * burnFactor(lambda);
  let etaI = BASE_INDICATED_EFF * timingFactor(tune.timingOffset) * compressionFactor(internals.compression);
  if (knockMargin < 0) etaI *= 1 - Math.min(0.15, -knockMargin * 0.12);
  const indicatedW = fuelEnergyW * etaI;
  const k = rpm / 1000;
  const fmepBar = 0.5 + 0.07 * k + 0.018 * k * k + internals.frictionBar * k;
  const frictionW = fmepBar * 1e5 * vd * cycleRate;
  const brakeW = Math.max(0, indicatedW - frictionW);
  const bmepBar = brakeW / (vd * cycleRate) / 1e5;
  const torqueNm = (bmepBar * 1e5 * vd) / (4 * Math.PI);
  const powerHp = brakeW / 745.7;

  const egtC =
    540 + 14 * bmepBar + 808 * (lambda - 0.85) - 14 * tune.timingOffset + 60 * (rpm / 7000) +
    fuelP.egtOffsetC - 25 * (internals.compression - BASE_CR) +
    (knockMargin < 0 ? -knockMargin * 80 : 0);

  return {
    point: {
      rpm,
      ve,
      boostBar: boostActual,
      bmepBar,
      torqueNm,
      powerHp,
      lambda,
      afr,
      egtC,
      chargeTempC: chargeK - 273.15,
      airFlowKgS: mdot,
      injectorDuty: duty,
      knockMargin,
      pressureRatio: hasTurbo ? pr : 0,
      compressorEff: hasTurbo ? etaC : 0,
      icEffectiveness: hasTurbo ? epsIc : 0,
      fuelFlowGs: fuel * 1000,
    },
    fuelEnergyKw: fuelEnergyW / 1000,
    turboFlowRatio,
    surgeRatio: hasTurbo && pr > 1.5 ? turboFlowRatio / surgeFlow(pr) : Infinity,
    icDropBar: icDrop,
    compressorOutC: t2 - 273.15,
    evapCoolK,
  };
}

const round = (v: number, d = 1) => Math.round(v * 10 ** d) / 10 ** d;

export function simulate(build: Build, rawTune: Tune): SimResult {
  const tune = clampTune(build, rawTune);
  const engine = getPart("engine", build.engine);
  const cam = getPart("camshaft", build.camshaft);
  const turbo = getPart("turbo", build.turbo);
  const internals = getPart("internals", build.internals);
  const cooling = getPart("cooling", build.cooling);
  const ic = getPart("intercooler", build.intercooler);
  const inj = getPart("injectors", build.injectors);
  const fuelP = getPart("fuel", build.fuel);
  const intake = getPart("intake", build.intake);
  const exh = getPart("exhaust", build.exhaust);
  const ecu = getPart("ecu", build.ecu);
  const hasTurbo = turbo.maximumFlow > 0;
  const bmepLimit = internals.bmepLimit;
  const bmepWarn = bmepLimit - 3;

  const states: PointState[] = [];
  for (let rpm = RPM_START; rpm < tune.revLimit; rpm += RPM_STEP) states.push(simulatePoint(build, tune, rpm));
  states.push(simulatePoint(build, tune, tune.revLimit));
  const curve = states.map((s) => s.point);

  const maxBy = <T,>(arr: T[], f: (p: T) => number) => arr.reduce((a, b) => (f(b) > f(a) ? b : a));
  const pPow = maxBy(curve, (p) => p.powerHp);
  const pTq = maxBy(curve, (p) => p.torqueNm);
  const peakBoost = Math.max(...curve.map((p) => p.boostBar));
  const pEgt = maxBy(curve, (p) => p.egtC);
  const pBmep = maxBy(curve, (p) => p.bmepBar);
  const pCharge = maxBy(curve, (p) => p.chargeTempC);
  const pDuty = maxBy(curve, (p) => p.injectorDuty);
  const pKnock = maxBy(curve, (p) => -p.knockMargin);
  const sFlow = maxBy(states, (s) => s.turboFlowRatio);
  const sSurge = maxBy(states, (s) => -s.surgeRatio);
  const loaded = curve.filter((p) => p.bmepBar > 6);
  const pLean = loaded.length ? maxBy(loaded, (p) => p.lambda) : null;
  const sThermal = maxBy(states, (s) => s.fuelEnergyKw);
  const thermalLoad = (sThermal.fuelEnergyKw * COOLANT_SHARE) / cooling.capacityKw;
  const peakBmep = pBmep.bmepBar;
  const peakEgt = pEgt.egtC;
  const maxDuty = pDuty.injectorDuty;
  const minKnock = pKnock.knockMargin;

  const diagnostics: Diagnostic[] = [];
  let rel = 100;
  const hit = (amount: number) => {
    rel -= Math.max(0, amount);
  };
  const at = (rpm: number) => `${Math.round(rpm).toLocaleString("en-US")} rpm`;

  // Internals stress
  if (peakBmep > bmepWarn) hit((peakBmep - bmepWarn) * 1.5);
  if (peakBmep > bmepLimit) {
    hit((peakBmep - bmepLimit) * 6);
    diagnostics.push({
      code: "BMEP_OVER",
      severity: "critical",
      slot: "internals",
      message: `Cylinder pressure reaches ${round(peakBmep)} bar BMEP at ${at(pBmep.rpm)}, beyond the ${bmepLimit} bar the ${internals.name} survive.`,
      cause: `BMEP is the average pressure pushing each piston down. ${hasTurbo ? `${round(pBmep.boostBar, 2)} bar of boost packs` : "This much airflow packs"} enough air and fuel into each cycle that the pistons and rods are loaded past their fatigue limit.`,
      fixes: [hasTurbo ? "Lower the boost target until peak BMEP sits below the limit." : "Reduce ignition advance.", "Fit forged pistons or forged pistons with H-beam rods: they raise the BMEP limit."],
    });
  } else if (peakBmep > bmepWarn) {
    diagnostics.push({
      code: "BMEP_HIGH",
      severity: "warning",
      slot: "internals",
      message: `BMEP ${round(peakBmep)} bar at ${at(pBmep.rpm)} is within 3 bar of the pistons' and rods' limit (${bmepLimit} bar).`,
      cause: "Near the limit the rods and ring lands wear faster; long endurance runs cost reliability.",
      fixes: ["Trim boost slightly at peak torque.", "Stronger internals give more headroom."],
    });
  }

  // Exhaust temperature
  if (peakEgt > LIMITS.egtSafeC) {
    hit((peakEgt - LIMITS.egtSafeC) * 0.25);
    if (peakEgt > LIMITS.egtCriticalC) hit((peakEgt - LIMITS.egtCriticalC) * 0.6);
    const lean = pEgt.lambda > 0.86;
    const retarded = tune.timingOffset < 0;
    diagnostics.push({
      code: "EGT_HIGH",
      severity: peakEgt > LIMITS.egtCriticalC ? "critical" : "warning",
      slot: "exhaust",
      message: `Exhaust gas temperature peaks at ${Math.round(peakEgt)}°C at ${at(pEgt.rpm)} (safe limit ${LIMITS.egtSafeC}°C).`,
      cause: [
        `Heat in the exhaust rises with cylinder load (${round(pEgt.bmepBar)} bar BMEP here)`,
        lean ? `, and a lean mixture (λ ${pEgt.lambda.toFixed(2)}) burns hotter with less spare fuel to absorb heat` : "",
        retarded ? `, while retarded ignition (${tune.timingOffset}°) leaves combustion still burning as the exhaust valve opens` : "",
        ".",
      ].join(""),
      fixes: [
        lean ? "Richen the lambda target (lower value): extra fuel cools the burn." : "Richen the mixture a little.",
        ecu.timingRange > 0 ? "Add ignition advance if knock margin allows: an earlier burn sends less heat down the exhaust." : "A tunable ECU lets you correct mixture and ignition.",
        fuelP.egtOffsetC > -20 ? "E85 or race fuel burn cooler." : "Reduce boost.",
      ],
    });
  }

  // Knock
  if (minKnock < 0.08) {
    const p = pKnock;
    const drivers: string[] = [];
    if (p.boostBar > 0.6) drivers.push(`${round(p.boostBar, 2)} bar of manifold pressure`);
    if (p.chargeTempC > 50) drivers.push(`a hot ${Math.round(p.chargeTempC)}°C intake charge`);
    if (tune.timingOffset > 2) drivers.push(`+${tune.timingOffset}° of extra ignition advance`);
    if (p.lambda > 0.86) drivers.push(`a lean λ ${p.lambda.toFixed(2)} mixture`);
    if (internals.compression > 10) drivers.push(`${internals.compression}:1 compression`);
    if (fuelP.octane < 98) drivers.push(`${fuelP.octane} RON fuel`);
    const fixes: string[] = [];
    if (tune.timingOffset > 0) fixes.push("Pull ignition advance back toward 0°.");
    if (p.chargeTempC > 50) fixes.push(ic.effectiveness === 0 ? "Fit an intercooler to cool the compressed air." : "A more effective intercooler lowers charge temperature.");
    if (p.lambda > 0.82) fixes.push("Richen the lambda target: fuel evaporation cools the charge.");
    if (fuelP.octane < 102) fixes.push("Higher-octane fuel (98, race fuel or E85) resists detonation.");
    if (hasTurbo) fixes.push("Lower the boost target.");
    diagnostics.push({
      code: minKnock < 0 ? "KNOCK" : "KNOCK_MARGIN",
      severity: minKnock < 0 ? "critical" : "warning",
      slot: "ecu",
      message: minKnock < 0 ? `Detonation detected at ${at(p.rpm)}.` : `Knock margin is thin at ${at(p.rpm)}: small changes in conditions could cause detonation.`,
      cause: `The end-gas ignites on its own before the flame reaches it when pressure and temperature get too high. Main contributors: ${drivers.length ? drivers.join(", ") : "the combination of load and advance"}.${minKnock < 0 ? " The ECU pulls timing, so power and efficiency fall while EGT rises." : ""}`,
      fixes,
    });
    if (minKnock < 0) hit(Math.min(50, 10 + 150 * -minKnock));
  }

  // Lean mixture
  const boosted = peakBoost > 0.2;
  const leanLimit = boosted ? LIMITS.lambdaLeanBoost : LIMITS.lambdaLeanNa;
  if (pLean && pLean.lambda > leanLimit) {
    hit((pLean.lambda - leanLimit) * 14.7 * (boosted ? 25 : 15));
    const injLimited = pLean.injectorDuty >= MAX_DUTY - 0.001;
    diagnostics.push({
      code: "LEAN",
      severity: pLean.lambda > leanLimit + 0.05 ? "critical" : "warning",
      slot: injLimited ? "injectors" : "ecu",
      message: `Mixture goes lean under load: λ ${pLean.lambda.toFixed(2)} (${round(pLean.afr)}:1 on ${fuelP.name}) at ${at(pLean.rpm)}. Target ${boosted ? "≤ 0.88 under boost" : "≤ 0.94"}.`,
      cause: injLimited
        ? `The injectors are flat out (${Math.round(MAX_DUTY * 100)}% duty) and still deliver only ${round(pLean.fuelFlowGs)} g/s for ${round(pLean.airFlowKgS * 1000, 0)} g/s of air.`
        : `The lambda target (${tune.lambdaTarget.toFixed(2)}) is set leaner than this load can tolerate.`,
      fixes: injLimited
        ? ["Fit larger injectors: required flow rises with airflow and with low-stoich fuels like E85.", "Or reduce boost until the injectors keep up."]
        : ["Lower the lambda target (richer) for full-load cells."],
    });
  }

  // Overly rich
  const richest = Math.min(...curve.map((p) => p.lambda));
  if (richest < LIMITS.lambdaRich) {
    diagnostics.push({
      code: "RICH",
      severity: "info",
      slot: "ecu",
      message: `Running very rich (λ ${richest.toFixed(2)}).`,
      cause: "Past about λ 0.75 the extra fuel cannot find oxygen to burn: it only cools, wastes fuel and dilutes cylinder-wall oil.",
      fixes: ["Lean the target toward λ 0.78–0.82 if knock and EGT allow: you may gain power."],
    });
  }

  // Injector duty
  if (maxDuty > LIMITS.dutyWarn) {
    hit((maxDuty - LIMITS.dutyWarn) * 100);
    const needCc = (pDuty.airFlowKgS / (tune.lambdaTarget * fuelP.stoichAfr)) * 1000 * 60 / FUEL_DENSITY / engine.cylinders / 0.8;
    diagnostics.push({
      code: "INJ_DUTY",
      severity: maxDuty >= MAX_DUTY ? "critical" : "warning",
      slot: "injectors",
      message: `Injectors reach ${Math.round(maxDuty * 100)}% duty cycle at ${at(pDuty.rpm)}: they are out of capacity.`,
      cause: `At ${round(pDuty.airFlowKgS * 1000, 0)} g/s of air and λ ${tune.lambdaTarget.toFixed(2)}, ${fuelP.name} needs ${round((pDuty.airFlowKgS / (tune.lambdaTarget * fuelP.stoichAfr)) * 1000)} g/s of fuel. The ${inj.flowCc} cc injectors cannot open long enough between cycles.`,
      fixes: [`Fit injectors of at least ${Math.ceil(needCc / 10) * 10} cc/min to keep duty near 80%.`],
    });
  }

  // Turbo
  if (hasTurbo) {
    const ob = Math.max(0, tune.boostTarget - turbo.maximumBoost);
    if (ob > 0) {
      hit(ob * 40);
      diagnostics.push({
        code: "OVERBOOST",
        severity: "critical",
        slot: "turbo",
        message: `Boost target ${tune.boostTarget} bar exceeds the ${turbo.name}'s safe maximum of ${turbo.maximumBoost} bar.`,
        cause: "To make that pressure the wheel must spin past its rated shaft speed; bearings and the compressor wheel are overstressed.",
        fixes: [`Set boost at or below ${turbo.maximumBoost} bar.`, "Step up to a larger turbo frame for more boost."],
      });
    }
    if (sFlow.turboFlowRatio > 0.97) {
      hit(8);
      const p = sFlow.point;
      diagnostics.push({
        code: "CHOKE",
        severity: "warning",
        slot: "turbo",
        message: `Compressor is at its choke limit at ${at(p.rpm)}: efficiency falls to ${Math.round(p.compressorEff * 100)}%, boost tapers and outlet air reaches ${Math.round(sFlow.compressorOutC)}°C.`,
        cause: `The engine asks for ${round(p.airFlowKgS * 1000, 0)} g/s but the ${turbo.name} wheel chokes near ${round(turbo.maximumFlow * 1000, 0)} g/s.${intake.flowCapacity < 0.3 ? " The intake restriction lowers inlet pressure and makes it worse." : ""}`,
        fixes: ["A larger compressor moves the operating point back into its efficiency island.", "Lowering the rev limit avoids the choked region."],
      });
    }
    if (sSurge.surgeRatio < 1 && sSurge.point.boostBar > 0.3) {
      hit(4);
      diagnostics.push({
        code: "SURGE",
        severity: "warning",
        slot: "turbo",
        message: `Compressor surge at ${at(sSurge.point.rpm)}: pressure ratio ${sSurge.point.pressureRatio.toFixed(2)} with too little airflow.`,
        cause: "On the left of the compressor map air stalls and flows backwards through the wheel, causing pressure pulsations and thrust-bearing wear. Big turbos on small engines at low RPM are prone to it.",
        fixes: ["Ramp boost in later (lower the target) or choose a smaller or twin-scroll turbo.", "A freer exhaust or tubular manifold helps the engine move more air at low RPM."],
      });
    }
    if (pCharge.chargeTempC > LIMITS.chargeTempC) {
      hit((pCharge.chargeTempC - LIMITS.chargeTempC) * 0.4);
      const p = pCharge;
      diagnostics.push({
        code: "CHARGE_HOT",
        severity: p.chargeTempC > 100 ? "critical" : "warning",
        slot: "intercooler",
        message: `Intake charge reaches ${Math.round(p.chargeTempC)}°C at ${at(p.rpm)}.`,
        cause:
          ic.effectiveness === 0
            ? `Compressing air to ${p.pressureRatio.toFixed(2)}:1 at ${Math.round(p.compressorEff * 100)}% efficiency heats it; without an intercooler it reaches the cylinders hot, which costs density and knock margin.`
            : `At ${round(p.airFlowKgS * 1000, 0)} g/s the ${ic.name} only achieves ${Math.round(p.icEffectiveness * 100)}% effectiveness (rated ${Math.round(ic.effectiveness * 100)}% at 250 g/s): there is not enough core to reject the compressor's heat.`,
        fixes: ic.effectiveness === 0 ? ["Fit an intercooler."] : ["Fit a larger or water-to-air intercooler.", "A compressor running nearer its efficiency island makes less heat."],
      });
    }
    const pDrop = maxBy(states, (s) => s.icDropBar);
    if (ic.effectiveness > 0 && pDrop.icDropBar > 0.12) {
      diagnostics.push({
        code: "IC_DROP",
        severity: "info",
        slot: "intercooler",
        message: `The intercooler costs ${round(pDrop.icDropBar, 2)} bar of pressure at ${at(pDrop.point.rpm)}.`,
        cause: "Pressure drop rises with the square of flow. The turbo has to compress harder to hold manifold boost, adding heat and pushing it toward choke.",
        fixes: ["A larger core flows the same air with less drop."],
      });
    }
  }

  // Valvetrain
  if (tune.revLimit > cam.valvetrainLimit) {
    hit((tune.revLimit - cam.valvetrainLimit) / 50);
    diagnostics.push({
      code: "VALVE_FLOAT",
      severity: "critical",
      slot: "camshaft",
      message: `Rev limit ${tune.revLimit} rpm exceeds the valvetrain limit (${cam.valvetrainLimit} rpm).`,
      cause: "Above this speed the valve springs cannot close the valves fast enough to follow the cam: valves float and can hit the pistons.",
      fixes: [`Lower the rev limit to ${cam.valvetrainLimit} rpm.`, "Race cams come with uprated springs for higher RPM."],
    });
  }

  // Cooling
  if (thermalLoad > 0.85) {
    hit((thermalLoad - 0.85) * 60);
    diagnostics.push({
      code: "THERMAL",
      severity: thermalLoad > 1 ? "critical" : "warning",
      slot: "cooling",
      message: `Cooling system at ${Math.round(thermalLoad * 100)}% of capacity under sustained load.`,
      cause: `About ${Math.round(COOLANT_SHARE * 100)}% of the fuel's energy (${Math.round(sThermal.fuelEnergyKw * COOLANT_SHARE)} kW at ${at(sThermal.point.rpm)}) ends up in the coolant and oil; the ${cooling.name} can reject ${cooling.capacityKw} kW.`,
      fixes: ["Fit a larger radiator or oil cooler.", "More power always means more waste heat: cooling has to grow with it."],
    });
  }

  // Parts that cannot help this configuration
  if (!hasTurbo && ic.effectiveness > 0) {
    diagnostics.push({
      code: "IC_UNUSED",
      severity: "info",
      slot: "intercooler",
      message: "The intercooler does nothing on this engine.",
      cause: "An intercooler only removes heat added by compressing air. Without a turbocharger it adds pipework and cost but no benefit.",
      fixes: ["Remove it to save budget, or fit a turbo."],
    });
  }
  if (fuelP.stoichAfr < 14 && maxDuty > 0.8) {
    diagnostics.push({
      code: "E85_FLOW",
      severity: "info",
      slot: "fuel",
      message: `E85 needs ${Math.round((14.7 / fuelP.stoichAfr - 1) * 100)}% more fuel mass than gasoline for the same air.`,
      cause: `Ethanol carries less energy per kg (${fuelP.lhvMjKg} vs 43.4 MJ/kg) but also needs less air to burn, so power per kg of air is similar while injector demand rises sharply.`,
      fixes: ["Size injectors for ethanol: around 1.5× the gasoline requirement."],
    });
  }
  if (internals.compression > 10.5 && hasTurbo) {
    diagnostics.push({
      code: "HICOMP_BOOST",
      severity: "warning",
      slot: "internals",
      message: `A ${internals.compression}:1 compression ratio under boost leaves very little knock margin.`,
      cause: "Boost multiplies the already-high compression pressure and temperature at the end of the compression stroke.",
      fixes: ["Low-compression forged pistons suit turbo builds."],
    });
  }

  // Intake / exhaust restriction hints
  const pFlow = maxBy(curve, (p) => p.airFlowKgS);
  if (pFlow.airFlowKgS > intake.flowCapacity * 0.75) {
    diagnostics.push({
      code: "INTAKE_RESTRICT",
      severity: "info",
      slot: "intake",
      message: `Peak airflow ${round(pFlow.airFlowKgS * 1000, 0)} g/s is close to the intake's capacity (${Math.round(intake.flowCapacity * 1000)} g/s).`,
      cause: "Pressure losses rise with the square of flow, so the engine (or turbo) draws from below atmospheric pressure at high RPM.",
      fixes: ["A higher-flow intake recovers that pressure."],
    });
  }
  if (pFlow.airFlowKgS > exh.flowCapacity * 0.8) {
    diagnostics.push({
      code: "EXHAUST_RESTRICT",
      severity: "info",
      slot: "exhaust",
      message: `Exhaust back-pressure is limiting the engine at ${at(pFlow.rpm)}.`,
      cause: `${round(pFlow.airFlowKgS * 1000, 0)} g/s of gas through a system rated for ${Math.round(exh.flowCapacity * 1000)} g/s leaves residual gas in the cylinders and lowers volumetric efficiency.`,
      fixes: ["A larger-bore exhaust raises VE and helps turbo spool."],
    });
  }

  // Drivetrain: gearing, clutch, differential, traction and road performance.
  const drive = simulateVehicle(build, tune, curve);
  hit(drive.reliabilityHit);
  diagnostics.push(...drive.diagnostics);
  // Chassis-dyno wheel power: a slipping clutch caps the torque that reaches the rollers.
  const box = getPart("gearbox", build.gearbox);
  const clutchCap = box.integratedClutch ? Infinity : getPart("clutch", build.clutch).capacityNm;
  const wheelPeak = Math.max(...curve.map((p) => (Math.min(p.torqueNm, clutchCap) * p.rpm * 2 * Math.PI) / 60 / 745.7)) * drivetrainEfficiency(build);

  if (diagnostics.length === 0) {
    diagnostics.push({ code: "OK", severity: "info", message: "All systems within operating limits.", cause: "No limits approached during the sweep." });
  }

  return {
    curve,
    peakPowerHp: round(pPow.powerHp),
    peakPowerRpm: pPow.rpm,
    peakTorqueNm: round(pTq.torqueNm),
    peakTorqueRpm: pTq.rpm,
    peakBoostBar: round(peakBoost, 2),
    peakEgtC: Math.round(peakEgt),
    minLambda: round(Math.min(...curve.map((p) => p.lambda)), 2),
    maxLambda: round(Math.max(...curve.map((p) => p.lambda)), 2),
    thermalLoad: round(thermalLoad, 2),
    reliability: round(clamp(rel, 0, 100)),
    diagnostics,
    buildCost: buildCost(build),
    wheelPowerHp: round(wheelPeak),
    vehicle: drive.vehicle,
  };
}

/** Last point of a (non-empty) curve. */
export function lastPoint(curve: CurvePoint[]): CurvePoint {
  const p = curve[curve.length - 1];
  if (!p) throw new Error("Empty curve");
  return p;
}

/** Linear interpolation of the curve at an RPM (for the live dyno sweep and challenge checks). */
export function sampleCurve(curve: CurvePoint[], rpm: number): CurvePoint {
  const first = curve[0];
  if (!first) throw new Error("Empty curve");
  if (rpm <= first.rpm) return first;
  for (let i = 1; i < curve.length; i++) {
    const a = curve[i - 1]!;
    const b = curve[i]!;
    if (rpm <= b.rpm) {
      const t = (rpm - a.rpm) / (b.rpm - a.rpm);
      const out: CurvePoint = { ...a };
      (Object.keys(a) as (keyof CurvePoint)[]).forEach((key) => {
        out[key] = a[key] + (b[key] - a[key]) * t;
      });
      return out;
    }
  }
  return lastPoint(curve);
}
