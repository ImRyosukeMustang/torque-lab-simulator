import { getPart } from './sim/parts';
import type { Build, TransmissionType } from './sim/types';

/** Levels/depths are normalized 0..1; frequencies are Hz and times seconds. */
export interface SoundProfile {
  firingFrequencyFactor: number;
  engineScale: number;
  intakeLevel: number; /** Induction honk amplitude. */
  intakeHz: number; /** Idle induction band centre, Hz. */
  lopeDepth: number; /** Irregular cam-speed amplitude/pitch modulation. */
  brightness: number; /** Combustion lowpass openness. */
  exhaustLevel: number; /** Exhaust amplitude before master volume. */
  rasp: number; /** Firing-gated high-frequency noise and distortion drive. */
  crackle: number; /** Header overrun crackle amount. */
  turbo: boolean;
  whistleHz: number; /** Base whistle frequency, Hz. */
  whistleLevel: number;
  flutter: number; /** Spool modulation depth. */
  bovHz: number; /** Initial blow-off band centre, Hz. */
  bovDurationS: number;
  bovLevel: number;
  turboMuffling: number;
  pipeWhoosh: number;
  injectorTick: number;
  popSharpness: number; /** Fuel-dependent transient brightness. */
  attack: number; /** Compression-dependent combustion sharpness. */
  pistonSlap: number;
  fanLevel: number;
  fanHz: number;
  limiterHardness: number; /** Zero soft fuel cut, one hard ignition cut. */
  transmission: TransmissionType;
  gearWhine: number;
  gearPitchFactor: number; /** Whine Hz per crankshaft Hz. */
  shiftTimeS: number;
  shiftRetained: number; /** Torque retained during shift. */
  clutchClack: number;
  diffChatter: number;
  /** Wind roar at speed from bodywork drag and wing turbulence. */
  windNoise: number;
  /** Tyre roar from wider, softer rubber. */
  tyreRoar: number;
}
const unit = (n: number) => Math.max(0, Math.min(1, n));
export function soundProfile(build: Build): SoundProfile {
  const engine = getPart('engine', build.engine);
  const intake = getPart('intake', build.intake), cam = getPart('camshaft', build.camshaft);
  const turbo = getPart('turbo', build.turbo), ic = getPart('intercooler', build.intercooler);
  const inj = getPart('injectors', build.injectors), fuel = getPart('fuel', build.fuel);
  const exh = getPart('exhaust', build.exhaust), pistons = getPart('internals', build.internals);
  const cooling = getPart('cooling', build.cooling), ecu = getPart('ecu', build.ecu);
  const box = getPart('gearbox', build.gearbox), clutch = getPart('clutch', build.clutch);
  const diff = getPart('differential', build.differential), drive = getPart('drivetrain', build.drivetrain);
  const aero = getPart('aero', build.aero), wing = getPart('wing', build.wing), body = getPart('body', build.body);
  const forced = turbo.maximumFlow > 0;
  return {
    firingFrequencyFactor: engine.cylinders / 4,
    engineScale: unit(engine.displacementL / 4),
    intakeLevel: unit(intake.flowCapacity * 1.8), intakeHz: 150 + intake.flowCapacity * 380,
    lopeDepth: unit(0.025 + (cam.durationDeg - 228) / 80 + (cam.peakRpm - 4800) / 18000),
    brightness: unit(0.2 + (cam.peakRpm - 4000) / 5000),
    exhaustLevel: unit(0.34 + exh.flowCapacity), rasp: unit(exh.flowCapacity * 1.2 + exh.spoolAssist * 2),
    crackle: unit(exh.spoolAssist * 6), turbo: forced,
    whistleHz: forced ? 7800 / (1 + turbo.maximumFlow * 4) : 0,
    whistleLevel: unit(turbo.maximumBoost * 0.25), flutter: unit(turbo.inertia * 0.45),
    bovHz: forced ? 6800 / (1 + turbo.maximumFlow * 5) : 0,
    bovDurationS: 0.12 + turbo.inertia * 0.13, bovLevel: unit(turbo.maximumFlow * 1.6),
    turboMuffling: forced ? unit(0.18 + turbo.inertia * 0.14) : 0,
    pipeWhoosh: unit(ic.effectiveness * 0.15 + ic.pressureDrop + ic.sinkOffsetK * 0.002),
    injectorTick: unit((inj.flowCc - 200) / 1500),
    popSharpness: unit(0.45 + (fuel.octane - 95) * 0.035 - (14.7 - fuel.stoichAfr) * 0.1),
    attack: unit((pistons.compression - 7) / 5), pistonSlap: unit(pistons.frictionBar * 15),
    fanLevel: unit(cooling.capacityKw / 1800), fanHz: 180 + cooling.capacityKw * 0.7 + cooling.heatSoakK * 3,
    limiterHardness: unit(0.15 + ecu.timingRange * 0.14), transmission: box.transmission,
    gearWhine: unit((box.transmission === 'sequential' ? 0.65 : 0.025) + (1 - drive.efficiency) + (drive.layout === 'awd' ? 0.16 : 0) + diff.lockFactor * 0.06),
    gearPitchFactor: (box.transmission === 'sequential' ? 1.3 : 1.05) + diff.finalDrive * 0.04 + drive.frontTorqueShare * 0.08,
    shiftTimeS: box.shiftTimeS, shiftRetained: box.torqueDuringShift,
    clutchClack: unit(clutch.capacityNm / 1200 + (9 - clutch.weightKg) * 0.06), diffChatter: unit(diff.lockFactor * 0.8),
    windNoise: unit(0.1 + (aero.dragAreaDelta + wing.dragAreaDelta + body.dragAreaDelta) * 4 + (aero.downforceArea + wing.downforceArea + body.downforceArea) * 0.3),
    tyreRoar: unit(0.1 + body.gripBonus * 2.5 + body.rollingDelta * 100),
  };
}
export function describeSound(p: SoundProfile): string[] {
  const out = [p.lopeDepth > 0.25 ? 'Lumpy cam idle' : 'Smooth idle', p.rasp > 0.5 ? 'Raspy open exhaust' : 'Muted exhaust'];
  if (p.intakeLevel > 0.35) out.push('Induction honk');
  if (p.turbo) out.push(`Turbo whistle (${p.whistleHz > 3800 ? 'high' : 'low'} pitch)`);
  if (p.gearWhine > 0.5) out.push('Straight-cut gear whine');
  else if (p.gearWhine > 0.2) out.push('Transmission whine');
  if (p.injectorTick > 0.35) out.push('Injector idle tick');
  if (p.pistonSlap > 0.1) out.push('Forged piston tick');
  if (p.limiterHardness > 0.7) out.push('Hard-cut limiter bangs');
  if (p.transmission === 'dct') out.push('Dual-clutch shift brap');
  if (p.transmission === 'automatic') out.push('Slurred automatic shifts');
  return out;
}
