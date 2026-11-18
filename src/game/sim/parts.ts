import type { Build, EngineSpec, Part, PartBySlot, SlotId, Tune } from "./types";

export const ENGINE: EngineSpec = {
  name: "AM-20 Inline-4",
  layout: "Inline-4, DOHC 16v",
  displacementL: 2.0,
  cylinders: 4,
  boreMm: 86,
  strokeMm: 86,
  idleRpm: 850,
};

export const SLOT_ORDER: SlotId[] = ["intake", "camshaft", "turbo", "intercooler", "injectors", "fuel", "exhaust", "internals", "cooling", "ecu"];

export const SLOT_LABEL: Record<SlotId, string> = {
  intake: "Air Intake",
  camshaft: "Camshafts",
  turbo: "Turbocharger",
  intercooler: "Intercooler",
  injectors: "Fuel Injectors",
  fuel: "Fuel",
  exhaust: "Exhaust",
  internals: "Pistons & Rods",
  cooling: "Cooling",
  ecu: "ECU",
};

export const SLOT_HELP: Record<SlotId, string> = {
  intake: "Feeds air to the engine. A restrictive intake throttles airflow at high RPM and starves a turbo.",
  camshaft: "Valve timing and lift shape the volumetric efficiency curve: aggressive cams trade low-end torque for top-end power.",
  turbo: "Uses exhaust energy to compress intake air. Bigger units flow more but spool later and heat the charge.",
  intercooler: "Cools compressed air. Cooler charge is denser and far less prone to knock.",
  injectors: "Deliver fuel. If they cannot keep up with airflow the mixture goes lean, temperatures spike and parts fail.",
  fuel: "Octane rating sets how much boost and ignition advance the engine tolerates before knocking. Ethanol (E85) resists knock and cools the charge, but needs about 45% more fuel flow.",
  exhaust: "Removes spent gas. Back-pressure lowers VE and slows turbo response.",
  internals: "Compression ratio and piston/rod strength. Higher compression is more efficient but knocks sooner; forged parts survive far higher cylinder pressure.",
  cooling: "Rejects combustion heat. If heat output exceeds capacity the engine overheats on long runs; hot under-bonnet air also heats the intake charge.",
  ecu: "Engine management. Better ECUs unlock boost, fuel and ignition tuning.",
};

export const PARTS: Part[] = [
  // Intake
  { id: "intake-stock", slot: "intake", name: "OEM Airbox", description: "Quiet, paper-element airbox with a narrow snorkel.", price: 0, flowCapacity: 0.14 },
  { id: "intake-cai", slot: "intake", name: "Cold Air Intake", description: "Shielded cone filter drawing from the bumper.", price: 450, flowCapacity: 0.22 },
  { id: "intake-hf", slot: "intake", name: "High-Flow Intake + 70mm Throttle", description: "Large-bore pipework and an oversized throttle body.", price: 950, flowCapacity: 0.36 },

  // Camshaft
  { id: "cam-stock", slot: "camshaft", name: "OEM Cams", description: "Mild profile tuned for drivability.", price: 0, durationDeg: 228, liftMm: 9.2, peakVE: 0.95, peakRpm: 4800, spreadLow: 3400, spreadHigh: 3600, valvetrainLimit: 7200 },
  { id: "cam-street", slot: "camshaft", name: "Street Cams 256°", description: "More duration and lift; stronger mid-range and top end.", price: 1100, durationDeg: 256, liftMm: 10.4, peakVE: 0.99, peakRpm: 5400, spreadLow: 3100, spreadHigh: 3400, valvetrainLimit: 7600 },
  { id: "cam-vvt", slot: "camshaft", name: "Variable Cam Phasers 260°", description: "Hydraulic phasers move valve timing with RPM: a wide, flat power band rather than a peaky one.", price: 1900, durationDeg: 260, liftMm: 10.6, peakVE: 1.0, peakRpm: 5700, spreadLow: 3900, spreadHigh: 3500, valvetrainLimit: 7800, unlockAfter: "c2" },
  { id: "cam-race", slot: "camshaft", name: "Race Cams 272° + Springs", description: "High-RPM profile with uprated springs. Soft below 4000 rpm.", price: 2200, durationDeg: 272, liftMm: 11.5, peakVE: 1.05, peakRpm: 6300, spreadLow: 2700, spreadHigh: 3300, valvetrainLimit: 8200, unlockAfter: "c2" },

  // Turbo
  { id: "turbo-none", slot: "turbo", name: "Naturally Aspirated", description: "No forced induction.", price: 0, compressorEfficiency: 0, turbineEfficiency: 0, maximumFlow: 0, inertia: 0, maximumBoost: 0, islandFlow: 0, islandPr: 0 },
  { id: "turbo-t25", slot: "turbo", name: "AT-25 Ball Bearing", description: "Small, quick-spooling turbo. Runs out of breath at high flow.", price: 2400, compressorEfficiency: 0.7, turbineEfficiency: 0.68, maximumFlow: 0.2, inertia: 0.6, maximumBoost: 1.1, islandFlow: 0.6, islandPr: 1.9, unlockAfter: "c2" },
  { id: "turbo-t30", slot: "turbo", name: "AT-30 Twin-Scroll", description: "Divided turbine housing keeps exhaust pulses separate, so it spools sooner than its size suggests.", price: 4300, compressorEfficiency: 0.74, turbineEfficiency: 0.76, maximumFlow: 0.26, inertia: 0.75, maximumBoost: 1.4, islandFlow: 0.62, islandPr: 2.1, unlockAfter: "c3" },
  { id: "turbo-t35", slot: "turbo", name: "AT-35 Dual Ball", description: "Mid-frame turbo with a broad efficiency island.", price: 3600, compressorEfficiency: 0.74, turbineEfficiency: 0.72, maximumFlow: 0.3, inertia: 1.0, maximumBoost: 1.6, islandFlow: 0.6, islandPr: 2.2, unlockAfter: "c2" },
  { id: "turbo-t45", slot: "turbo", name: "AT-45 Billet", description: "Large billet-wheel turbo. Huge flow, lazy spool.", price: 5400, compressorEfficiency: 0.77, turbineEfficiency: 0.74, maximumFlow: 0.42, inertia: 1.5, maximumBoost: 2.2, islandFlow: 0.62, islandPr: 2.5, unlockAfter: "c3" },

  // Intercooler
  { id: "ic-none", slot: "intercooler", name: "No Intercooler", description: "Compressed air goes straight to the engine.", price: 0, effectiveness: 0, pressureDrop: 0, sinkOffsetK: 0 },
  { id: "ic-small", slot: "intercooler", name: "Bar & Plate 450mm", description: "Compact front-mount core.", price: 650, effectiveness: 0.62, pressureDrop: 0.06, sinkOffsetK: 0, unlockAfter: "c2" },
  { id: "ic-large", slot: "intercooler", name: "Bar & Plate 600mm Race", description: "Large core, high effectiveness, slightly more pressure drop.", price: 1300, effectiveness: 0.8, pressureDrop: 0.08, sinkOffsetK: 0, unlockAfter: "c3" },
  { id: "ic-w2a", slot: "intercooler", name: "Water-to-Air Chargecooler", description: "Liquid-cooled core in the intake tract: short pipework, very effective cooling.", price: 2000, effectiveness: 0.88, pressureDrop: 0.05, sinkOffsetK: 8, unlockAfter: "c4" },

  // Injectors
  { id: "inj-stock", slot: "injectors", name: "OEM 290cc", description: "Factory injectors sized for the stock engine.", price: 0, flowCc: 290 },
  { id: "inj-440", slot: "injectors", name: "440cc High-Impedance", description: "Supports a mild turbo build.", price: 520, flowCc: 440 },
  { id: "inj-750", slot: "injectors", name: "750cc", description: "Room for serious boost.", price: 880, flowCc: 750, unlockAfter: "c2" },
  { id: "inj-1000", slot: "injectors", name: "1000cc Motorsport", description: "Massive flow. Idle quality suffers, power does not.", price: 1250, flowCc: 1000, unlockAfter: "c3" },
  { id: "inj-1300", slot: "injectors", name: "1300cc + Twin Pumps", description: "Ethanol-rated injectors with twin in-tank pumps for big E85 builds.", price: 1700, flowCc: 1300, unlockAfter: "c4" },

  // Fuel
  { id: "fuel-95", slot: "fuel", name: "Pump 95 RON", description: "Standard unleaded from any forecourt.", price: 0, octane: 95, stoichAfr: 14.7, lhvMjKg: 43.4, latentHeatKjKg: 350, egtOffsetC: 0 },
  { id: "fuel-98", slot: "fuel", name: "Premium 98 RON", description: "Higher-octane pump fuel: a little more knock headroom.", price: 250, octane: 98, stoichAfr: 14.7, lhvMjKg: 43.2, latentHeatKjKg: 360, egtOffsetC: 0 },
  { id: "fuel-race", slot: "fuel", name: "Race Fuel 102 RON", description: "Leaded race gasoline. Strong knock resistance, slightly cooler burn.", price: 900, octane: 102, stoichAfr: 14.7, lhvMjKg: 44.0, latentHeatKjKg: 380, egtOffsetC: -10, unlockAfter: "c3" },
  { id: "fuel-e85", slot: "fuel", name: "E85 Ethanol Conversion", description: "Flex sensor, ethanol-safe lines and E85. Huge knock resistance and charge cooling, but needs about 45% more injector flow.", price: 1400, octane: 105, stoichAfr: 9.8, lhvMjKg: 29.2, latentHeatKjKg: 850, egtOffsetC: -45, unlockAfter: "c3" },

  // Exhaust
  { id: "exh-stock", slot: "exhaust", name: "OEM Exhaust", description: "Two catalysts and two silencers.", price: 0, flowCapacity: 0.17, spoolAssist: 0 },
  { id: "exh-catback", slot: "exhaust", name: "Sport Cat-Back 2.5in", description: "Free-flowing rear section with a single silencer.", price: 700, flowCapacity: 0.26, spoolAssist: 0.03 },
  { id: "exh-3in", slot: "exhaust", name: "3in Turbo-Back System", description: "Full 3-inch system with a high-flow cat.", price: 1350, flowCapacity: 0.42, spoolAssist: 0.08 },
  { id: "exh-header", slot: "exhaust", name: "Tubular Manifold + 3.5in", description: "Equal-length tubular manifold and a 3.5-inch system. Best flow and spool, but loud.", price: 2300, flowCapacity: 0.5, spoolAssist: 0.12, unlockAfter: "c4" },

  // Internals
  { id: "int-stock", slot: "internals", name: "OEM Cast Pistons 9.5:1", description: "Factory cast pistons and powdered-metal rods.", price: 0, compression: 9.5, bmepLimit: 24, frictionBar: 0 },
  { id: "int-hicomp", slot: "internals", name: "Forged High-Comp 11.0:1", description: "Domed forged pistons for naturally aspirated builds. More efficient, but knock-prone under boost.", price: 1500, compression: 11.0, bmepLimit: 27, frictionBar: 0.02, unlockAfter: "c1" },
  { id: "int-forged", slot: "internals", name: "Forged Pistons 9.0:1", description: "Dished forged pistons sized for boost.", price: 1800, compression: 9.0, bmepLimit: 30, frictionBar: 0.02, unlockAfter: "c2" },
  { id: "int-race", slot: "internals", name: "Forged Pistons + H-Beam Rods 8.5:1", description: "Low-compression forged pistons and billet H-beam rods for very high cylinder pressure.", price: 3200, compression: 8.5, bmepLimit: 36, frictionBar: 0.03, unlockAfter: "c4" },

  // Cooling
  { id: "cool-stock", slot: "cooling", name: "OEM Radiator", description: "Single-core plastic-tank radiator and one fan.", price: 0, capacityKw: 260, heatSoakK: 10 },
  { id: "cool-alu", slot: "cooling", name: "Aluminium Dual-Core Radiator", description: "All-aluminium core with twin fans.", price: 600, capacityKw: 330, heatSoakK: 8 },
  { id: "cool-race", slot: "cooling", name: "Race Radiator + Oil Cooler", description: "Thick race core, oil cooler and vented bonnet airflow.", price: 1500, capacityKw: 420, heatSoakK: 5, unlockAfter: "c3" },

  // ECU
  { id: "ecu-stock", slot: "ecu", name: "OEM ECU", description: "Locked factory map. Runs safe fuelling with mild boost control.", price: 0, maxBoostTarget: 0.5, timingRange: 0, lambdaRange: [0.85, 0.85], revLimitRange: [7000, 7000] },
  { id: "ecu-piggy", slot: "ecu", name: "Piggyback Controller", description: "Adjust boost, fuel and a little ignition on top of the factory map.", price: 750, maxBoostTarget: 1.1, timingRange: 3, lambdaRange: [0.78, 0.92], revLimitRange: [6500, 7400] },
  { id: "ecu-standalone", slot: "ecu", name: "Standalone ECU", description: "Full control of every map.", price: 1800, maxBoostTarget: 2.2, timingRange: 6, lambdaRange: [0.73, 1.0], revLimitRange: [6000, 8200], unlockAfter: "c2" },
] as Part[];


const BY_ID = new Map(PARTS.map((p) => [p.id, p]));

export function getPart<K extends SlotId>(slot: K, id: string): PartBySlot[K] {
  const p = BY_ID.get(id);
  if (!p || p.slot !== slot) throw new Error(`Unknown ${slot} part: ${id}`);
  return p as PartBySlot[K];
}

export function findPart(id: string): Part | undefined {
  return BY_ID.get(id);
}

export function partsForSlot(slot: SlotId): Part[] {
  return PARTS.filter((p) => p.slot === slot);
}

export const STOCK_BUILD: Build = {
  intake: "intake-stock",
  camshaft: "cam-stock",
  turbo: "turbo-none",
  intercooler: "ic-none",
  injectors: "inj-stock",
  fuel: "fuel-95",
  exhaust: "exh-stock",
  internals: "int-stock",
  cooling: "cool-stock",
  ecu: "ecu-stock",
};

export const STOCK_TUNE: Tune = { boostTarget: 0.5, lambdaTarget: 0.85, timingOffset: 0, revLimit: 7000 };

export function buildCost(build: Build): number {
  return SLOT_ORDER.reduce((sum, s) => sum + getPart(s, build[s]).price, 0);
}

/** Clamp a tune to what the installed ECU allows. */
export function clampTune(build: Build, tune: Tune): Tune {
  const ecu = getPart("ecu", build.ecu);
  const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
  return {
    boostTarget: clamp(tune.boostTarget, 0, ecu.maxBoostTarget),
    lambdaTarget: clamp(tune.lambdaTarget, ecu.lambdaRange[0], ecu.lambdaRange[1]),
    timingOffset: clamp(tune.timingOffset, -ecu.timingRange, ecu.timingRange),
    revLimit: clamp(tune.revLimit, ecu.revLimitRange[0], ecu.revLimitRange[1]),
  };
}
