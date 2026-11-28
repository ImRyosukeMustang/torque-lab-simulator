// Pure data types for the AUTOMECH simulation. No React, no three.js.

export type SlotId =
  | "engine" | "intake" | "camshaft" | "turbo" | "intercooler" | "injectors" | "fuel" | "exhaust" | "internals" | "cooling" | "ecu"
  | "gearbox" | "clutch" | "differential" | "drivetrain"
  | "aero" | "wing" | "body";

export type TransmissionType = "manual" | "sequential" | "dct" | "automatic";
export type DiffType = "open" | "clutch-lsd" | "helical-lsd";
export type DriveLayout = "fwd" | "rwd" | "awd";

interface PartBase {
  id: string;
  slot: SlotId;
  name: string;
  description: string;
  price: number;
  /** Challenge id that must be completed (any grade) before the part can be bought. */
  unlockAfter?: string;
  /** Weight added (+) or saved (−) versus the factory part (kg). Drivetrain and bodywork carry their own weights. */
  massDeltaKg?: number;
}

export interface IntakePart extends PartBase {
  slot: "intake";
  /** Air mass flow (kg/s) at which the intake costs ~50% of its pressure. */
  flowCapacity: number;
}

export interface EnginePart extends PartBase, EngineSpec {
  slot: "engine";
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
  /** Compressor map: flow (fraction of choke flow) and pressure ratio at peak efficiency. */
  islandFlow: number;
  islandPr: number;
}

export interface IntercoolerPart extends PartBase {
  slot: "intercooler";
  /** Heat-exchange effectiveness 0..1. */
  effectiveness: number;
  /** Core pressure drop at 0.25 kg/s and 2 bar/95°C inlet (bar). */
  pressureDrop: number;
  /** Temperature of the heat sink above ambient (K): 0 for air-to-air, coolant offset for water-to-air. */
  sinkOffsetK: number;
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
  /** Lower heating value (MJ/kg). */
  lhvMjKg: number;
  /** Latent heat of vaporisation (kJ/kg); drives evaporative charge cooling. */
  latentHeatKjKg: number;
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
  /** Lambda target range at wide-open throttle (1.00 = stoichiometric). */
  lambdaRange: [number, number];
  revLimitRange: [number, number];
  /** Two-step rev limiter: holds the engine at the ideal launch speed while staged. */
  launchControl: boolean;
  /** No-lift shifting: an ignition cut instead of lifting shortens manual and sequential shifts. */
  flatShift: boolean;
}

export interface GearboxPart extends PartBase {
  slot: "gearbox";
  transmission: TransmissionType;
  /** Default ratio per gear, 1st first. The gear count is ratios.length. */
  ratios: number[];
  /** Whether individual ratios can be re-cut (±20% of the default set). */
  adjustable: boolean;
  /** Mechanical efficiency of the gearbox (0..1). */
  efficiency: number;
  /** Input torque the gears and shafts survive continuously (Nm). */
  maxTorqueNm: number;
  /** Time a shift takes (s). */
  shiftTimeS: number;
  /** Share of drive torque still delivered during a shift (0 manual/sequential, ~0.85 dual-clutch). */
  torqueDuringShift: number;
  weightKg: number;
  /** Has its own clutch or torque converter, so the separate clutch part is bypassed. */
  integratedClutch: boolean;
  /** Torque-converter multiplication at stall (1 = none). */
  converterMultiplication: number;
  /** Engine speed the car launches at (stall speed for a converter, launch control for a DCT). */
  launchRpm: number;
}

export interface ClutchPart extends PartBase {
  slot: "clutch";
  /** Torque the clutch transmits before it slips (Nm). */
  capacityNm: number;
  /** Engine speed held while slipping the clutch at launch. */
  launchRpm: number;
  weightKg: number;
  /** Time for the clutch to bite fully when it is dropped (s): aggressive friction material grabs sooner. */
  engageS: number;
}

export interface DifferentialPart extends PartBase {
  slot: "differential";
  diffType: DiffType;
  /** 0 open .. 1 locked: how much torque can move to the wheel with grip. */
  lockFactor: number;
  efficiency: number;
  /** Default final-drive ratio and the ratios the crown wheel and pinion can be swapped to. */
  finalDrive: number;
  finalDriveRange: [number, number];
  weightKg: number;
}

export interface DrivetrainPart extends PartBase {
  slot: "drivetrain";
  layout: DriveLayout;
  /** Propshaft, transfer case, driveshaft and tyre losses (0..1). */
  efficiency: number;
  weightKg: number;
  /** Share of drive torque sent to the front axle (0 RWD, 1 FWD). */
  frontTorqueShare: number;
  /** Change in static front weight distribution from moving drivetrain mass. */
  frontWeightShift: number;
}

/** Bodywork that changes the car's aerodynamics, mass and tyre width. All values are changes from the factory body. */
interface BodyworkBase extends PartBase {
  /** Change in drag area Cd·A (m²). Factory car: 0.62 m² (Cd 0.33 × 1.88 m²). */
  dragAreaDelta: number;
  /** Downforce area -Cl·A (m²): downforce = ½ρv² × this. */
  downforceArea: number;
  /** Share of this part's downforce that acts on the front axle (0..1). */
  downforceFront: number;
  massKg: number;
  /** Extra tyre friction from wider rubber the arches can now clear. */
  gripBonus: number;
  /** Extra rolling resistance from wider tyres. */
  rollingDelta: number;
}

export interface AeroPart extends BodyworkBase {
  slot: "aero";
  style: "stock" | "lip" | "gt";
}
export interface WingPart extends BodyworkBase {
  slot: "wing";
  style: "ducktail" | "lip" | "gt" | "swan";
}
export interface BodyPart extends BodyworkBase {
  slot: "body";
  style: "stock" | "overfender" | "widebody";
  shape: "coupe" | "sedan" | "hatchback" | "light-coupe" | "four-door-coupe";
  tyreWidthMm: number;
  /** Extra half-track width (m) the wider arches allow. */
  trackDelta: number;
}

export type Part =
  | EnginePart
  | IntakePart
  | CamshaftPart
  | TurboPart
  | IntercoolerPart
  | InjectorPart
  | FuelPart
  | ExhaustPart
  | InternalsPart
  | CoolingPart
  | EcuPart
  | GearboxPart
  | ClutchPart
  | DifferentialPart
  | DrivetrainPart
  | AeroPart
  | WingPart
  | BodyPart;

export interface PartBySlot {
  engine: EnginePart;
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
  gearbox: GearboxPart;
  clutch: ClutchPart;
  differential: DifferentialPart;
  drivetrain: DrivetrainPart;
  aero: AeroPart;
  wing: WingPart;
  body: BodyPart;
}

/** Installed part id per slot. */
export type Build = { [K in SlotId]: string };

export interface Tune {
  /** Boost target (bar gauge). Ignored without a turbo. */
  boostTarget: number;
  /** Wide-open-throttle lambda target (1.00 = stoichiometric for whatever fuel is fitted). */
  lambdaTarget: number;
  /** Ignition advance offset from the base map (degrees). */
  timingOffset: number;
  revLimit: number;
  /** Ratio per gear (1st first); length always matches the fitted gearbox. */
  gearRatios: number[];
  finalDrive: number;
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
  /** Measured lambda. */
  lambda: number;
  /** Measured air-fuel ratio for the fitted fuel (lambda x fuel stoich). */
  afr: number;
  egtC: number;
  chargeTempC: number;
  airFlowKgS: number;
  injectorDuty: number;
  knockMargin: number;
  /** Compressor pressure ratio and isentropic efficiency (0 without a turbo). */
  pressureRatio: number;
  compressorEff: number;
  /** Intercooler effectiveness at this flow (0 without one). */
  icEffectiveness: number;
  /** Fuel mass delivered (g/s). */
  fuelFlowGs: number;
}

export type Severity = "info" | "warning" | "critical";

export interface Diagnostic {
  code: string;
  severity: Severity;
  slot?: SlotId;
  /** What was measured. */
  message: string;
  /** Why it happened, in engineering terms. */
  cause?: string;
  /** Concrete changes that address it. */
  fixes?: string[];
}

export interface GearInfo {
  gear: number;
  ratio: number;
  /** Gear × final drive. */
  overall: number;
  kmhPer1000: number;
  /** Road speed at the rev limit in this gear. */
  maxKmh: number;
  /** Peak torque at the wheels in this gear (after clutch limit and losses). */
  peakWheelTorqueNm: number;
  /** Engine speed after shifting into this gear at the rev limit (0 for 1st). */
  rpmAfterShift: number;
}

export interface AccelSample {
  t: number;
  kmh: number;
  rpm: number;
  gear: number;
  /** Drive force limited by tyre grip at this instant. */
  wheelspin: boolean;
}

export interface VehicleResult {
  massKg: number;
  frontWeight: number;
  /** Gearbox × differential × driveline efficiency. */
  drivetrainEfficiency: number;
  gears: GearInfo[];
  zeroTo100S: number | null;
  zeroTo200S: number | null;
  quarterMileS: number | null;
  quarterMileKmh: number | null;
  topSpeedKmh: number;
  topSpeedGear: number;
  topSpeedLimit: "drag" | "rev-limit";
  /** Speed below which the tyres cannot transmit the available drive force (0 = never traction-limited). */
  tractionLimitedToKmh: number;
  shiftRpm: number[];
  trace: AccelSample[];
}

export interface SimResult {
  curve: CurvePoint[];
  peakPowerHp: number;
  peakPowerRpm: number;
  peakTorqueNm: number;
  peakTorqueRpm: number;
  peakBoostBar: number;
  peakEgtC: number;
  minLambda: number;
  maxLambda: number;
  /** 0..1.5+, >1 means cooling cannot keep up. */
  thermalLoad: number;
  /** 0..100 */
  reliability: number;
  diagnostics: Diagnostic[];
  buildCost: number;
  /** Estimated power at the wheels after drivetrain losses (chassis dyno reading). */
  wheelPowerHp: number;
  vehicle: VehicleResult;
}
