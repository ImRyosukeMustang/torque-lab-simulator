import type { Build, EngineSpec, Part, PartBySlot, SlotId, Tune } from "./types";

export const ENGINE: EngineSpec = {
  name: "AM-20 Inline-4",
  layout: "Inline-4, DOHC 16v",
  displacementL: 2.0,
  cylinders: 4,
  boreMm: 86,
  strokeMm: 86,
  compression: 9.5,
  internalsBmepLimit: 21,
  coolingCapacityKw: 215,
  idleRpm: 850,
};

export const SLOT_ORDER: SlotId[] = ["intake", "camshaft", "turbo", "intercooler", "injectors", "exhaust", "ecu"];

export const SLOT_LABEL: Record<SlotId, string> = {
  intake: "Air Intake",
  camshaft: "Camshafts",
  turbo: "Turbocharger",
  intercooler: "Intercooler",
  injectors: "Fuel Injectors",
  exhaust: "Exhaust",
  ecu: "ECU",
};

export const SLOT_HELP: Record<SlotId, string> = {
  intake: "Feeds air to the engine. A restrictive intake throttles airflow at high RPM and starves a turbo.",
  camshaft: "Valve timing and lift shape the volumetric efficiency curve: aggressive cams trade low-end torque for top-end power.",
  turbo: "Uses exhaust energy to compress intake air. Bigger units flow more but spool later and heat the charge.",
  intercooler: "Cools compressed air. Cooler charge is denser and far less prone to knock.",
  injectors: "Deliver fuel. If they cannot keep up with airflow the mixture goes lean, temperatures spike and parts fail.",
  exhaust: "Removes spent gas. Back-pressure lowers VE and slows turbo response.",
  ecu: "Engine management. Better ECUs unlock boost, fuel and ignition tuning.",
};

export const PARTS: Part[] = [
  // Intake
  { id: "intake-stock", slot: "intake", name: "OEM Airbox", description: "Quiet, paper-element airbox with a narrow snorkel.", price: 0, flowCapacity: 0.17 },
  { id: "intake-cai", slot: "intake", name: "Cold Air Intake", description: "Shielded cone filter drawing from the bumper.", price: 450, flowCapacity: 0.26 },
  { id: "intake-hf", slot: "intake", name: "High-Flow Intake + 70mm Throttle", description: "Large-bore pipework and an oversized throttle body.", price: 950, flowCapacity: 0.4 },

  // Camshaft
  { id: "cam-stock", slot: "camshaft", name: "OEM Cams", description: "Mild profile tuned for drivability.", price: 0, durationDeg: 228, liftMm: 9.2, peakVE: 0.92, peakRpm: 4600, spreadLow: 3400, spreadHigh: 3600, valvetrainLimit: 7200 },
  { id: "cam-street", slot: "camshaft", name: "Street Cams 256°", description: "More duration and lift; stronger mid-range and top end.", price: 1100, durationDeg: 256, liftMm: 10.4, peakVE: 0.99, peakRpm: 5400, spreadLow: 3100, spreadHigh: 3400, valvetrainLimit: 7600 },
  { id: "cam-race", slot: "camshaft", name: "Race Cams 272° + Springs", description: "High-RPM profile with uprated springs. Soft below 4000 rpm.", price: 2200, durationDeg: 272, liftMm: 11.5, peakVE: 1.05, peakRpm: 6300, spreadLow: 2700, spreadHigh: 3300, valvetrainLimit: 8200, unlockAfter: "c2" },

  // Turbo
  { id: "turbo-none", slot: "turbo", name: "Naturally Aspirated", description: "No forced induction.", price: 0, compressorEfficiency: 0, turbineEfficiency: 0, maximumFlow: 0, inertia: 0, maximumBoost: 0 },
  { id: "turbo-t25", slot: "turbo", name: "AT-25 Ball Bearing", description: "Small, quick-spooling turbo. Runs out of breath at high flow.", price: 2400, compressorEfficiency: 0.7, turbineEfficiency: 0.68, maximumFlow: 0.2, inertia: 0.6, maximumBoost: 1.1, unlockAfter: "c2" },
  { id: "turbo-t35", slot: "turbo", name: "AT-35 Dual Ball", description: "Mid-frame turbo with a broad efficiency island.", price: 3600, compressorEfficiency: 0.74, turbineEfficiency: 0.72, maximumFlow: 0.3, inertia: 1.0, maximumBoost: 1.6, unlockAfter: "c2" },
  { id: "turbo-t45", slot: "turbo", name: "AT-45 Billet", description: "Large billet-wheel turbo. Huge flow, lazy spool.", price: 5400, compressorEfficiency: 0.77, turbineEfficiency: 0.74, maximumFlow: 0.42, inertia: 1.5, maximumBoost: 2.2, unlockAfter: "c3" },

  // Intercooler
  { id: "ic-none", slot: "intercooler", name: "No Intercooler", description: "Compressed air goes straight to the engine.", price: 0, effectiveness: 0, pressureDrop: 0 },
  { id: "ic-small", slot: "intercooler", name: "Bar & Plate 450mm", description: "Compact front-mount core.", price: 650, effectiveness: 0.62, pressureDrop: 0.06, unlockAfter: "c2" },
  { id: "ic-large", slot: "intercooler", name: "Bar & Plate 600mm Race", description: "Large core, high effectiveness, slightly more pressure drop.", price: 1300, effectiveness: 0.8, pressureDrop: 0.08, unlockAfter: "c3" },

  // Injectors
  { id: "inj-stock", slot: "injectors", name: "OEM 290cc", description: "Factory injectors sized for the stock engine.", price: 0, flowCc: 290 },
  { id: "inj-440", slot: "injectors", name: "440cc High-Impedance", description: "Supports a mild turbo build.", price: 520 },
  { id: "inj-750", slot: "injectors", name: "750cc", description: "Room for serious boost.", price: 880, unlockAfter: "c2" },
  { id: "inj-1000", slot: "injectors", name: "1000cc Motorsport", description: "Massive flow. Idle quality suffers, power does not.", price: 1250, unlockAfter: "c3" },

  // Exhaust
  { id: "exh-stock", slot: "exhaust", name: "OEM Exhaust", description: "Two catalysts and two silencers.", price: 0, flowCapacity: 0.2, spoolAssist: 0 },
  { id: "exh-catback", slot: "exhaust", name: "Sport Cat-Back 2.5in", description: "Free-flowing rear section with a single silencer.", price: 700, flowCapacity: 0.3, spoolAssist: 0.03 },
  { id: "exh-3in", slot: "exhaust", name: "3in Turbo-Back System", description: "Full 3-inch system with a high-flow cat.", price: 1350, flowCapacity: 0.46, spoolAssist: 0.08 },

  // ECU
  { id: "ecu-stock", slot: "ecu", name: "OEM ECU", description: "Locked factory map. Runs safe fuelling with mild boost control.", price: 0, maxBoostTarget: 0.5, timingRange: 0, afrRange: [12.5, 12.5], revLimitRange: [7000, 7000] },
  { id: "ecu-piggy", slot: "ecu", name: "Piggyback Controller", description: "Adjust boost, fuel and a little ignition on top of the factory map.", price: 750, maxBoostTarget: 1.1, timingRange: 3, afrRange: [11.5, 13.5], revLimitRange: [6500, 7400] },
  { id: "ecu-standalone", slot: "ecu", name: "Standalone ECU", description: "Full control of every map.", price: 1800, maxBoostTarget: 2.2, timingRange: 6, afrRange: [10.8, 14.7], revLimitRange: [6000, 8200], unlockAfter: "c2" },
] as Part[];

// Fill injector flow for entries declared without the field above.
for (const p of PARTS) {
  if (p.slot === "injectors" && !(p as { flowCc?: number }).flowCc) {
    (p as { flowCc: number }).flowCc = Number(p.id.split("-")[1]);
  }
}

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
  exhaust: "exh-stock",
  ecu: "ecu-stock",
};

export const STOCK_TUNE: Tune = { boostTarget: 0.5, afrTarget: 12.5, timingOffset: 0, revLimit: 7000 };

export function buildCost(build: Build): number {
  return SLOT_ORDER.reduce((sum, s) => sum + getPart(s, build[s]).price, 0);
}

/** Clamp a tune to what the installed ECU allows. */
export function clampTune(build: Build, tune: Tune): Tune {
  const ecu = getPart("ecu", build.ecu);
  const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
  return {
    boostTarget: clamp(tune.boostTarget, 0, ecu.maxBoostTarget),
    afrTarget: clamp(tune.afrTarget, ecu.afrRange[0], ecu.afrRange[1]),
    timingOffset: clamp(tune.timingOffset, -ecu.timingRange, ecu.timingRange),
    revLimit: clamp(tune.revLimit, ecu.revLimitRange[0], ecu.revLimitRange[1]),
  };
}
