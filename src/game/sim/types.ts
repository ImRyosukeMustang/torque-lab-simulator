// Pure data types for the AUTOMECH simulation. No React, no three.js.

export type SlotId = "intake" | "camshaft" | "turbo" | "intercooler" | "injectors" | "fuel" | "exhaust" | "internals" | "cooling" | "ecu";

interface PartBase {
  id: string;
  slot: SlotId;
  name: string;
  description: string;
  price: number;
  /** Challenge id that must be completed (any grade) before the part can be bought. */
  unlockAfter?: string;
}

export interface IntakePart extends PartBase {
  slot: "intake";
  /** Air mass flow (kg/s) at which the intake costs ~50% of its pressure. */
  flowCapacity: number;
}

export interface CamshaftPart extends PartBase {
  slot: "camshaft";
  durationDeg: number;
  liftMm: number;
  /** Peak volumetric efficiency reached at peakRpm. */
  peakVE: number;
  peakRpm: number;
  /** Gaussian spread of the VE curve below / above the peak (rpm). */
  spreadLow: number;
  spreadHigh: number;
  /** Safe valvetrain speed (rpm). */
  valvetrainLimit: number;
}

export interface TurboPart extends PartBase {
  slot: "turbo";
  compressorEfficiency: number;
  turbineEfficiency: number;
  /** Compressor choke flow (kg/s). */
  maximumFlow: number;
  /** Rotating assembly inertia (relative, 1 = medium). Drives spool. */
  inertia: number;
  /** Maximum safe boost (bar gauge). */
  maximumBoost: number;
}

export interface IntercoolerPart extends PartBase {
  slot: "intercooler";
  /** Heat-exchange effectiveness 0..1. */
  effectiveness: number;
  /** Core pressure drop at 0.25 kg/s (bar). */
  pressureDrop: number;
}

export interface InjectorPart extends PartBase {
  slot: "injectors";
  /** Flow per injector (cc/min). */
  flowCc: number;
}

export interface ExhaustPart extends PartBase {
  slot: "exhaust";
  /** Mass flow (kg/s) at which back-pressure becomes significant. */
  flowCapacity: number;
  /** Small spool assist factor (turbo-back systems help the turbine). */
  spoolAssist: number;
}

export interface FuelPart extends PartBase {
  slot: "fuel";
  /** Research octane number; higher resists knock. */
  octane: number;
  /** Stoichiometric AFR of the fuel (gasoline 14.7, E85 ~9.8). */
  stoichAfr: number;
  /** Evaporative charge cooling (K) at full load. */
  chargeCoolingK: number;
  /** Change in exhaust gas temperature (°C) from burn speed / composition. */
  egtOffsetC: number;
}

export interface InternalsPart extends PartBase {
  slot: "internals";
  /** Static compression ratio set by the piston crown. */
  compression: number;
  /** BMEP the pistons and rods tolerate continuously (bar). */
  bmepLimit: number;
  /** Extra friction from ring pack / heavier parts (bar FMEP). */
  frictionBar: number;
}

export interface CoolingPart extends PartBase {
  slot: "cooling";
  /** Heat the cooling system can reject (kW). */
  capacityKw: number;
  /** Intake heat soak from under-bonnet temperature (K). */
  heatSoakK: number;
}

export interface EcuPart extends PartBase {
  slot: "ecu";
  /** Tuning access limits. */
  maxBoostTarget: number;
  timingRange: number;
  afrRange: [number, number];
  revLimitRange: [number, number];
}

export type Part =
  | IntakePart
  | CamshaftPart
  | TurboPart
  | IntercoolerPart
  | InjectorPart
  | FuelPart
  | ExhaustPart
  | InternalsPart
  | CoolingPart
  | EcuPart;

export interface PartBySlot {
  intake: IntakePart;
  camshaft: CamshaftPart;
  turbo: TurboPart;
  intercooler: IntercoolerPart;
  injectors: InjectorPart;
  fuel: FuelPart;
  exhaust: ExhaustPart;
  internals: InternalsPart;
  cooling: CoolingPart;
  ecu: EcuPart;
}

/** Installed part id per slot. */
export type Build = { [K in SlotId]: string };

export interface Tune {
  /** Boost target (bar gauge). Ignored without a turbo. */
  boostTarget: number;
  /** Wide-open-throttle AFR target, gasoline-equivalent (lambda x 14.7). */
  afrTarget: number;
  /** Ignition advance offset from the base map (degrees). */
  timingOffset: number;
  revLimit: number;
}

export interface EngineSpec {
  name: string;
  layout: string;
  displacementL: number;
  cylinders: number;
  boreMm: number;
  strokeMm: number;
  idleRpm: number;
}

export interface CurvePoint {
  rpm: number;
  ve: number;
  boostBar: number;
  bmepBar: number;
  torqueNm: number;
  powerHp: number;
  afr: number;
  egtC: number;
  chargeTempC: number;
  airFlowKgS: number;
  injectorDuty: number;
  knockMargin: number;
}

export type Severity = "info" | "warning" | "critical";

export interface Diagnostic {
  code: string;
  severity: Severity;
  slot?: SlotId;
  message: string;
}

export interface SimResult {
  curve: CurvePoint[];
  peakPowerHp: number;
  peakPowerRpm: number;
  peakTorqueNm: number;
  peakTorqueRpm: number;
  peakBoostBar: number;
  peakEgtC: number;
  minAfr: number;
  maxAfr: number;
  /** 0..1.5+, >1 means cooling cannot keep up. */
  thermalLoad: number;
  /** 0..100 */
  reliability: number;
  diagnostics: Diagnostic[];
  buildCost: number;
  /** Estimated power at the wheels after drivetrain losses (chassis dyno reading). */
  wheelPowerHp: number;
}
