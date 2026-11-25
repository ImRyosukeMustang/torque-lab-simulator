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

export const ENGINE_SLOTS: SlotId[] = ["intake", "camshaft", "turbo", "intercooler", "injectors", "fuel", "exhaust", "internals", "cooling", "ecu"];
export const DRIVETRAIN_SLOTS: SlotId[] = ["gearbox", "clutch", "differential", "drivetrain"];
export const BODY_SLOTS: SlotId[] = ["aero", "wing", "body"];
export const SLOT_ORDER: SlotId[] = [...ENGINE_SLOTS, ...DRIVETRAIN_SLOTS, ...BODY_SLOTS];

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
  gearbox: "Gearbox",
  clutch: "Clutch",
  differential: "Differential",
  drivetrain: "Drive Layout",
  aero: "Aero Kit",
  wing: "Rear Wing",
  body: "Body & Tyres",
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
  gearbox: "Multiplies engine torque. Ratios decide how fast each gear accelerates and how fast the car can go; shift time, efficiency and torque capacity differ by type.",
  clutch: "Couples the engine to the gearbox. If engine torque exceeds its capacity it slips: power never reaches the wheels and the friction plate overheats.",
  differential: "Splits torque between the driven wheels and sets the final-drive ratio. An open diff sends power to the wheel with least grip; an LSD keeps both pushing.",
  drivetrain: "Which wheels are driven. Weight moves to the rear under acceleration: rear-drive gains grip, front-drive loses it, all-wheel drive uses all four tyres but adds weight and losses.",
  aero: "Front splitter, skirts and diffuser. Downforce presses the tyres into the road at speed for more grip, but every wing and fence also adds drag that costs top speed and trap speed.",
  wing: "Rear downforce. Grows with the square of speed: little help off the line, a lot at 200 km/h. Big wings add drag, so drag racers often run small spoilers and road racers big wings.",
  body: "Wider arches let you fit wider tyres: more contact patch, more grip at launch. Flares add frontal area (drag), weight and rolling resistance.",
};

export const PARTS: Part[] = [
  // Intake
  { id: "intake-stock", slot: "intake", name: "OEM Airbox", description: "Quiet, paper-element airbox with a narrow snorkel.", price: 0, flowCapacity: 0.14 },
  { id: "intake-cai", massDeltaKg: -1, slot: "intake", name: "Cold Air Intake", description: "Shielded cone filter drawing from the bumper.", price: 450, flowCapacity: 0.22 },
  { id: "intake-hf", massDeltaKg: -1.5, slot: "intake", name: "High-Flow Intake + 70mm Throttle", description: "Large-bore pipework and an oversized throttle body.", price: 950, flowCapacity: 0.36 },

  // Camshaft
  { id: "cam-stock", slot: "camshaft", name: "OEM Cams", description: "Mild profile tuned for drivability.", price: 0, durationDeg: 228, liftMm: 9.2, peakVE: 0.95, peakRpm: 4800, spreadLow: 3400, spreadHigh: 3600, valvetrainLimit: 7200 },
  { id: "cam-street", slot: "camshaft", name: "Street Cams 256°", description: "More duration and lift; stronger mid-range and top end.", price: 1100, durationDeg: 256, liftMm: 10.4, peakVE: 0.99, peakRpm: 5400, spreadLow: 3100, spreadHigh: 3400, valvetrainLimit: 7600 },
  { id: "cam-vvt", slot: "camshaft", name: "Variable Cam Phasers 260°", description: "Hydraulic phasers move valve timing with RPM: a wide, flat power band rather than a peaky one.", price: 1900, durationDeg: 260, liftMm: 10.6, peakVE: 1.0, peakRpm: 5700, spreadLow: 3900, spreadHigh: 3500, valvetrainLimit: 7800, unlockAfter: "c2" },
  { id: "cam-race", slot: "camshaft", name: "Race Cams 272° + Springs", description: "High-RPM profile with uprated springs. Soft below 4000 rpm.", price: 2200, durationDeg: 272, liftMm: 11.5, peakVE: 1.05, peakRpm: 6300, spreadLow: 2700, spreadHigh: 3300, valvetrainLimit: 8200, unlockAfter: "c2" },

  // Turbo
  { id: "turbo-none", slot: "turbo", name: "Naturally Aspirated", description: "No forced induction.", price: 0, compressorEfficiency: 0, turbineEfficiency: 0, maximumFlow: 0, inertia: 0, maximumBoost: 0, islandFlow: 0, islandPr: 0 },
  { id: "turbo-t25", massDeltaKg: 13, slot: "turbo", name: "AT-25 Ball Bearing", description: "Small, quick-spooling turbo. Runs out of breath at high flow.", price: 2400, compressorEfficiency: 0.7, turbineEfficiency: 0.68, maximumFlow: 0.2, inertia: 0.6, maximumBoost: 1.1, islandFlow: 0.6, islandPr: 1.9 },
  { id: "turbo-t30", massDeltaKg: 15, slot: "turbo", name: "AT-30 Twin-Scroll", description: "Divided turbine housing keeps exhaust pulses separate, so it spools sooner than its size suggests.", price: 4300, compressorEfficiency: 0.74, turbineEfficiency: 0.76, maximumFlow: 0.26, inertia: 0.75, maximumBoost: 1.4, islandFlow: 0.62, islandPr: 2.1, unlockAfter: "c3" },
  { id: "turbo-t35", massDeltaKg: 17, slot: "turbo", name: "AT-35 Dual Ball", description: "Mid-frame turbo with a broad efficiency island.", price: 3600, compressorEfficiency: 0.74, turbineEfficiency: 0.72, maximumFlow: 0.3, inertia: 1.0, maximumBoost: 1.6, islandFlow: 0.6, islandPr: 2.2, unlockAfter: "c2" },
  { id: "turbo-t45", massDeltaKg: 21, slot: "turbo", name: "AT-45 Billet", description: "Large billet-wheel turbo. Huge flow, lazy spool.", price: 5400, compressorEfficiency: 0.77, turbineEfficiency: 0.74, maximumFlow: 0.42, inertia: 1.5, maximumBoost: 2.2, islandFlow: 0.62, islandPr: 2.5, unlockAfter: "c3" },

  // Intercooler
  { id: "ic-none", slot: "intercooler", name: "No Intercooler", description: "Compressed air goes straight to the engine.", price: 0, effectiveness: 0, pressureDrop: 0, sinkOffsetK: 0 },
  { id: "ic-small", massDeltaKg: 7, slot: "intercooler", name: "Bar & Plate 450mm", description: "Compact front-mount core.", price: 650, effectiveness: 0.62, pressureDrop: 0.06, sinkOffsetK: 0, unlockAfter: "c2" },
  { id: "ic-large", massDeltaKg: 11, slot: "intercooler", name: "Bar & Plate 600mm Race", description: "Large core, high effectiveness, slightly more pressure drop.", price: 1300, effectiveness: 0.8, pressureDrop: 0.08, sinkOffsetK: 0, unlockAfter: "c3" },
  { id: "ic-w2a", massDeltaKg: 13, slot: "intercooler", name: "Water-to-Air Chargecooler", description: "Liquid-cooled core in the intake tract: short pipework, very effective cooling.", price: 2000, effectiveness: 0.88, pressureDrop: 0.05, sinkOffsetK: 8, unlockAfter: "c4" },

  // Injectors
  { id: "inj-stock", slot: "injectors", name: "OEM 290cc", description: "Factory injectors sized for the stock engine.", price: 0, flowCc: 290 },
  { id: "inj-440", slot: "injectors", name: "440cc High-Impedance", description: "Supports a mild turbo build.", price: 520, flowCc: 440 },
  { id: "inj-750", slot: "injectors", name: "750cc", description: "Room for serious boost.", price: 880, flowCc: 750, unlockAfter: "c2" },
  { id: "inj-1000", slot: "injectors", name: "1000cc Motorsport", description: "Massive flow. Idle quality suffers, power does not.", price: 1250, flowCc: 1000, unlockAfter: "c3" },
  { id: "inj-1300", massDeltaKg: 2, slot: "injectors", name: "1300cc + Twin Pumps", description: "Ethanol-rated injectors with twin in-tank pumps for big E85 builds.", price: 1700, flowCc: 1300, unlockAfter: "c4" },

  // Fuel
  { id: "fuel-95", slot: "fuel", name: "Pump 95 RON", description: "Standard unleaded from any forecourt.", price: 0, octane: 95, stoichAfr: 14.7, lhvMjKg: 43.4, latentHeatKjKg: 350, egtOffsetC: 0 },
  { id: "fuel-98", slot: "fuel", name: "Premium 98 RON", description: "Higher-octane pump fuel: a little more knock headroom.", price: 250, octane: 98, stoichAfr: 14.7, lhvMjKg: 43.2, latentHeatKjKg: 360, egtOffsetC: 0 },
  { id: "fuel-race", slot: "fuel", name: "Race Fuel 102 RON", description: "Leaded race gasoline. Strong knock resistance, slightly cooler burn.", price: 900, octane: 102, stoichAfr: 14.7, lhvMjKg: 44.0, latentHeatKjKg: 380, egtOffsetC: -10, unlockAfter: "c3" },
  { id: "fuel-e85", massDeltaKg: 3, slot: "fuel", name: "E85 Ethanol Conversion", description: "Flex sensor, ethanol-safe lines and E85. Huge knock resistance and charge cooling, but needs about 45% more injector flow.", price: 1400, octane: 105, stoichAfr: 9.8, lhvMjKg: 29.2, latentHeatKjKg: 850, egtOffsetC: -45, unlockAfter: "c3" },

  // Exhaust
  { id: "exh-stock", slot: "exhaust", name: "OEM Exhaust", description: "Two catalysts and two silencers.", price: 0, flowCapacity: 0.17, spoolAssist: 0 },
  { id: "exh-catback", massDeltaKg: -5, slot: "exhaust", name: "Sport Cat-Back 2.5in", description: "Free-flowing rear section with a single silencer.", price: 700, flowCapacity: 0.26, spoolAssist: 0.03 },
  { id: "exh-3in", massDeltaKg: -6, slot: "exhaust", name: "3in Turbo-Back System", description: "Full 3-inch system with a high-flow cat.", price: 1350, flowCapacity: 0.42, spoolAssist: 0.08 },
  { id: "exh-header", massDeltaKg: -9, slot: "exhaust", name: "Tubular Manifold + 3.5in", description: "Equal-length tubular manifold and a 3.5-inch system. Best flow and spool, but loud.", price: 2300, flowCapacity: 0.5, spoolAssist: 0.12, unlockAfter: "c4" },

  // Internals
  { id: "int-stock", slot: "internals", name: "OEM Cast Pistons 9.5:1", description: "Factory cast pistons and powdered-metal rods.", price: 0, compression: 9.5, bmepLimit: 24, frictionBar: 0 },
  { id: "int-hicomp", massDeltaKg: -0.5, slot: "internals", name: "Forged High-Comp 11.0:1", description: "Domed forged pistons for naturally aspirated builds. More efficient, but knock-prone under boost.", price: 1500, compression: 11.0, bmepLimit: 27, frictionBar: 0.02, unlockAfter: "c1" },
  { id: "int-forged", massDeltaKg: -1, slot: "internals", name: "Forged Pistons 9.0:1", description: "Dished forged pistons sized for boost.", price: 1800, compression: 9.0, bmepLimit: 30, frictionBar: 0.02, unlockAfter: "c2" },
  { id: "int-race", massDeltaKg: -2, slot: "internals", name: "Forged Pistons + H-Beam Rods 8.5:1", description: "Low-compression forged pistons and billet H-beam rods for very high cylinder pressure.", price: 3200, compression: 8.5, bmepLimit: 36, frictionBar: 0.03, unlockAfter: "c4" },

  // Cooling
  { id: "cool-stock", slot: "cooling", name: "OEM Radiator", description: "Single-core plastic-tank radiator and one fan.", price: 0, capacityKw: 260, heatSoakK: 10 },
  { id: "cool-alu", massDeltaKg: -2, slot: "cooling", name: "Aluminium Dual-Core Radiator", description: "All-aluminium core with twin fans.", price: 600, capacityKw: 330, heatSoakK: 8 },
  { id: "cool-race", massDeltaKg: 3, slot: "cooling", name: "Race Radiator + Oil Cooler", description: "Thick race core, oil cooler and vented bonnet airflow.", price: 1500, capacityKw: 420, heatSoakK: 5, unlockAfter: "c3" },

  // ECU
  { id: "ecu-stock", slot: "ecu", name: "OEM ECU", description: "Locked factory map. Runs safe fuelling with mild boost control.", price: 0, maxBoostTarget: 0.5, timingRange: 0, lambdaRange: [0.85, 0.85], revLimitRange: [7000, 7000], launchControl: false, flatShift: false },
  { id: "ecu-piggy", slot: "ecu", name: "Piggyback Controller", description: "Adjust boost, fuel and a little ignition on top of the factory map. Adds a two-step launch limiter.", price: 750, maxBoostTarget: 1.1, timingRange: 3, lambdaRange: [0.78, 0.92], revLimitRange: [6500, 7400], launchControl: true, flatShift: false },
  { id: "ecu-standalone", slot: "ecu", name: "Standalone ECU", description: "Full control of every map, two-step launch control and no-lift (flat-foot) shifting.", price: 1800, maxBoostTarget: 2.2, timingRange: 6, lambdaRange: [0.73, 1.0], revLimitRange: [6000, 8200], launchControl: true, flatShift: true, unlockAfter: "c2" },

  // Gearbox
  { id: "gbx-oem5", slot: "gearbox", name: "OEM 5-Speed Manual", description: "Wide-ratio road box with synchromesh and a long throw.", price: 0, transmission: "manual", ratios: [3.36, 2.06, 1.42, 1.09, 0.87], adjustable: false, efficiency: 0.955, maxTorqueNm: 420, shiftTimeS: 0.45, torqueDuringShift: 0, weightKg: 40, integratedClutch: false, converterMultiplication: 1, launchRpm: 0 },
  { id: "gbx-6cr", slot: "gearbox", name: "Close-Ratio 6-Speed Manual", description: "Six closely spaced gears that keep the engine in its power band. Ratios can be re-cut.", price: 2200, transmission: "manual", ratios: [3.15, 2.19, 1.64, 1.29, 1.06, 0.89], adjustable: true, efficiency: 0.96, maxTorqueNm: 500, shiftTimeS: 0.35, torqueDuringShift: 0, weightKg: 42, integratedClutch: false, converterMultiplication: 1, launchRpm: 0, unlockAfter: "c2" },
  { id: "gbx-auto6", slot: "gearbox", name: "6-Speed Torque-Converter Auto", description: "Fluid coupling multiplies torque off the line and shifts under load, but churning oil costs efficiency.", price: 2600, transmission: "automatic", ratios: [4.04, 2.37, 1.55, 1.16, 0.86, 0.69], adjustable: false, efficiency: 0.915, maxTorqueNm: 620, shiftTimeS: 0.25, torqueDuringShift: 0.5, weightKg: 78, integratedClutch: true, converterMultiplication: 1.9, launchRpm: 2700, unlockAfter: "c3" },
  { id: "gbx-dct7", slot: "gearbox", name: "7-Speed Dual-Clutch", description: "Two wet clutches pre-select the next gear: near-seamless shifts and launch control, but heavy.", price: 5200, transmission: "dct", ratios: [3.6, 2.32, 1.62, 1.24, 1.0, 0.83, 0.69], adjustable: true, efficiency: 0.95, maxTorqueNm: 650, shiftTimeS: 0.1, torqueDuringShift: 0.85, weightKg: 74, integratedClutch: true, converterMultiplication: 1, launchRpm: 4200, unlockAfter: "c5" },
  { id: "gbx-seq6", slot: "gearbox", name: "6-Speed Sequential Dog Box", description: "Straight-cut dog-engagement gears: 60 ms shifts, the highest torque capacity and audible gear whine.", price: 7400, transmission: "sequential", ratios: [2.85, 2.05, 1.62, 1.33, 1.12, 0.96], adjustable: true, efficiency: 0.975, maxTorqueNm: 800, shiftTimeS: 0.06, torqueDuringShift: 0, weightKg: 34, integratedClutch: false, converterMultiplication: 1, launchRpm: 0, unlockAfter: "c7" },

  // Clutch
  { id: "clutch-oem", slot: "clutch", name: "OEM Organic Clutch", description: "Single organic plate with a light pedal.", price: 0, capacityNm: 400, launchRpm: 3000, weightKg: 9, engageS: 0.11 },
  { id: "clutch-stage2", slot: "clutch", name: "Stage 2 Kevlar Clutch", description: "Uprated pressure plate and Kevlar facing: more clamp load, still streetable.", price: 650, capacityNm: 520, launchRpm: 3600, weightKg: 9, engageS: 0.07, unlockAfter: "c2" },
  { id: "clutch-twin", slot: "clutch", name: "Twin-Plate Sintered Clutch", description: "Two sintered plates double the friction area: huge capacity and a hard, aggressive launch.", price: 1600, capacityNm: 800, launchRpm: 4500, weightKg: 7, engageS: 0.035, unlockAfter: "c4" },

  // Differential
  { id: "diff-open", slot: "differential", name: "OEM Open Differential 3.91", description: "Splits torque equally, so the wheel with less grip sets the limit.", price: 0, diffType: "open", lockFactor: 0, efficiency: 0.96, finalDrive: 3.91, finalDriveRange: [3.91, 3.91], weightKg: 30 },
  { id: "diff-helical", slot: "differential", name: "Helical LSD", description: "Gear-type limited slip: smooth, maintenance-free torque biasing. Choice of final-drive ratios.", price: 1100, diffType: "helical-lsd", lockFactor: 0.45, efficiency: 0.962, finalDrive: 3.91, finalDriveRange: [3.2, 4.6], weightKg: 31, unlockAfter: "c2" },
  { id: "diff-clutch", slot: "differential", name: "1.5-Way Clutch-Pack LSD", description: "Friction plates lock the axle hard under power: the best traction, with a little drag.", price: 1500, diffType: "clutch-lsd", lockFactor: 0.7, efficiency: 0.955, finalDrive: 3.91, finalDriveRange: [3.2, 4.6], weightKg: 32, unlockAfter: "c3" },

  // Drive layout
  { id: "dt-rwd", slot: "drivetrain", name: "Rear-Wheel Drive (OEM)", description: "Front engine, propshaft to a rear axle. Grip grows as weight shifts back under acceleration.", price: 0, layout: "rwd", efficiency: 0.94, weightKg: 22, frontTorqueShare: 0, frontWeightShift: 0 },
  { id: "dt-fwd", slot: "drivetrain", name: "Front-Drive Transaxle Conversion", description: "No propshaft: lighter and more efficient, but the front tyres lose load under acceleration and big torque steers the wheel.", price: 3000, layout: "fwd", efficiency: 0.955, weightKg: 12, frontTorqueShare: 1, frontWeightShift: 0.05, unlockAfter: "c3" },
  { id: "dt-awd", slot: "drivetrain", name: "All-Wheel Drive Conversion", description: "Transfer case, front diff and driveshafts. Four tyres put power down, at the cost of weight and friction.", price: 6500, layout: "awd", efficiency: 0.895, weightKg: 95, frontTorqueShare: 0.4, frontWeightShift: 0.02, unlockAfter: "c7" },

  // Aero kit (changes vs the factory bumpers)
  { id: "aero-stock", slot: "aero", name: "OEM Bumpers", description: "Factory front bumper and sills. Slight lift at speed, as on most road cars.", price: 0, style: "stock", dragAreaDelta: 0, downforceArea: 0, downforceFront: 0.5, massKg: 0, gripBonus: 0, rollingDelta: 0 },
  { id: "aero-lip", slot: "aero", name: "Front Lip & Side Skirts", description: "Polyurethane lip and sill extensions. Cleaner underbody flow: a touch less drag and a little front downforce.", price: 650, style: "lip", dragAreaDelta: -0.012, downforceArea: 0.06, downforceFront: 0.9, massKg: 4, gripBonus: 0, rollingDelta: 0 },
  { id: "aero-gt", slot: "aero", name: "GT Aero Kit", description: "Carbon splitter, dive planes, flat floor and a four-fin diffuser. Real downforce on both axles, paid for with drag.", price: 2600, style: "gt", dragAreaDelta: 0.015, downforceArea: 0.32, downforceFront: 0.55, massKg: 11, gripBonus: 0, rollingDelta: 0, unlockAfter: "c3" },

  // Rear wing
  { id: "wing-ducktail", slot: "wing", name: "OEM Ducktail", description: "Small factory lip on the boot lid that cancels rear lift.", price: 0, style: "ducktail", dragAreaDelta: 0, downforceArea: 0, downforceFront: 0, massKg: 0, gripBonus: 0, rollingDelta: 0 },
  { id: "wing-lip", slot: "wing", name: "Carbon Lip Spoiler", description: "Low, sharp trailing edge. Trims drag slightly and adds a little rear grip: the drag-racer's choice.", price: 380, style: "lip", dragAreaDelta: -0.008, downforceArea: 0.05, downforceFront: 0, massKg: 1, gripBonus: 0, rollingDelta: 0 },
  { id: "wing-gt", slot: "wing", name: "GT Wing 1500 mm", description: "Twin-element adjustable wing on pedestal mounts. Strong rear downforce, noticeable drag.", price: 1800, style: "gt", dragAreaDelta: 0.055, downforceArea: 0.5, downforceFront: 0, massKg: 7, gripBonus: 0, rollingDelta: 0, unlockAfter: "c2" },
  { id: "wing-swan", slot: "wing", name: "Swan-Neck Race Wing", description: "Top-mounted swan-neck uprights leave the wing's suction side clean: more downforce per unit of drag.", price: 2900, style: "swan", dragAreaDelta: 0.045, downforceArea: 0.62, downforceFront: 0, massKg: 6, gripBonus: 0, rollingDelta: 0, unlockAfter: "c4" },

  // Body width and tyres
  { id: "body-stock", slot: "body", name: "OEM Body + 225 Tyres", description: "Factory steel arches on 225/45 R18 tyres.", price: 0, style: "stock", dragAreaDelta: 0, downforceArea: 0, downforceFront: 0.5, massKg: 0, gripBonus: 0, rollingDelta: 0, tyreWidthMm: 225, trackDelta: 0 },
  { id: "body-overfender", slot: "body", name: "Bolt-On Overfenders + 255 Tyres", description: "Riveted fibreglass flares over 255/40 R18 semi-slicks. More grip off the line, a little more drag.", price: 2200, style: "overfender", dragAreaDelta: 0.03, downforceArea: 0, downforceFront: 0.5, massKg: 14, gripBonus: 0.06, rollingDelta: 0.0006, tyreWidthMm: 255, trackDelta: 0.035, unlockAfter: "c2" },
  { id: "body-wide", slot: "body", name: "Full Wide-Body + 285 Tyres", description: "Moulded wide-body panels and 285/35 R18 tyres. Huge contact patch for launches, more frontal area and weight.", price: 4600, style: "widebody", dragAreaDelta: 0.05, downforceArea: 0.04, downforceFront: 0.3, massKg: 22, gripBonus: 0.11, rollingDelta: 0.0011, tyreWidthMm: 285, trackDelta: 0.06, unlockAfter: "c4" },
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
  gearbox: "gbx-oem5",
  clutch: "clutch-oem",
  differential: "diff-open",
  drivetrain: "dt-rwd",
  aero: "aero-stock",
  wing: "wing-ducktail",
  body: "body-stock",
};

export const STOCK_TUNE: Tune = { boostTarget: 0.5, lambdaTarget: 0.85, timingOffset: 0, revLimit: 7000, gearRatios: [3.36, 2.06, 1.42, 1.09, 0.87], finalDrive: 3.91 };

/** Gear ratios may be re-cut within this fraction of the box's default set. */
export const GEAR_RATIO_RANGE = 0.2;
/** Neighbouring gears must differ by at least this ratio. */
export const MIN_GEAR_STEP = 0.05;

/** Re-cut ratio limits for one gear of a gearbox. */
export function gearRatioLimits(defaultRatio: number): [number, number] {
  return [Math.round(defaultRatio * (1 - GEAR_RATIO_RANGE) * 100) / 100, Math.round(defaultRatio * (1 + GEAR_RATIO_RANGE) * 100) / 100];
}

export function buildCost(build: Build): number {
  return SLOT_ORDER.reduce((sum, s) => sum + getPart(s, build[s]).price, 0);
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** Ratios as the fitted gearbox allows: defaults on a fixed box, otherwise each within range and strictly descending. */
function clampRatios(build: Build, ratios: number[] | undefined): number[] {
  const box = getPart("gearbox", build.gearbox);
  if (!box.adjustable || !ratios || ratios.length !== box.ratios.length || ratios.some((r) => !Number.isFinite(r))) return [...box.ratios];
  const out: number[] = [];
  box.ratios.forEach((def, i) => {
    const [lo, hi] = gearRatioLimits(def);
    let r = clamp(Math.round(ratios[i]! * 100) / 100, lo, hi);
    const prev = out[i - 1];
    if (prev !== undefined) r = Math.min(r, Math.round((prev - MIN_GEAR_STEP) * 100) / 100);
    out.push(r);
  });
  return out;
}

/** Clamp a tune to what the installed ECU, gearbox and differential allow. */
export function clampTune(build: Build, tune: Tune): Tune {
  const ecu = getPart("ecu", build.ecu);
  const diff = getPart("differential", build.differential);
  return {
    boostTarget: clamp(tune.boostTarget, 0, ecu.maxBoostTarget),
    lambdaTarget: clamp(tune.lambdaTarget, ecu.lambdaRange[0], ecu.lambdaRange[1]),
    timingOffset: clamp(tune.timingOffset, -ecu.timingRange, ecu.timingRange),
    revLimit: clamp(tune.revLimit, ecu.revLimitRange[0], ecu.revLimitRange[1]),
    gearRatios: clampRatios(build, tune.gearRatios),
    finalDrive: clamp(Number.isFinite(tune.finalDrive) ? tune.finalDrive : diff.finalDrive, diff.finalDriveRange[0], diff.finalDriveRange[1]),
  };
}
