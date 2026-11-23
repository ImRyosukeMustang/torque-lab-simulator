import type { Part } from "../sim/types";

export const fmtCredits = (n: number) => `${Math.round(n).toLocaleString("en-US")} cr`;

/** Engineering specs shown for a part (no predicted horsepower: the dyno reveals that). */
export function partSpecs(p: Part): [string, string][] {
  switch (p.slot) {
    case "intake":
      return [["Flow capacity", `${Math.round(p.flowCapacity * 1000)} g/s`]];
    case "camshaft":
      return [
        ["Duration", `${p.durationDeg}°`],
        ["Lift", `${p.liftMm} mm`],
        ["VE peak", `${Math.round(p.peakVE * 100)}% @ ${p.peakRpm}`],
        ["Valvetrain", `${p.valvetrainLimit} rpm`],
      ];
    case "turbo":
      if (p.maximumFlow === 0) return [["Boost", "None"]];
      return [
        ["Compressor η", `${Math.round(p.compressorEfficiency * 100)}%`],
        ["Turbine η", `${Math.round(p.turbineEfficiency * 100)}%`],
        ["Max flow", `${Math.round(p.maximumFlow * 1000)} g/s`],
        ["Inertia", p.inertia.toFixed(1)],
        ["Max boost", `${p.maximumBoost} bar`],
        ["Efficiency island", `${Math.round(p.islandFlow * p.maximumFlow * 1000)} g/s @ PR ${p.islandPr}`],
      ];
    case "intercooler":
      if (p.effectiveness === 0) return [["Effectiveness", "—"]];
      return [
        ["Effectiveness", `${Math.round(p.effectiveness * 100)}% @ 250 g/s`],
        ["Pressure drop", `${p.pressureDrop} bar @ 250 g/s`],
        ["Cooled by", p.sinkOffsetK > 0 ? `Coolant (+${p.sinkOffsetK} °C)` : "Ambient air"],
      ];
    case "injectors":
      return [
        ["Flow", `${p.flowCc} cc/min`],
        ["Total", `${(p.flowCc * 4 * 0.745 / 60).toFixed(1)} g/s`],
      ];
    case "fuel":
      return [
        ["Octane", `${p.octane} RON`],
        ["Stoich AFR", `${p.stoichAfr}:1`],
        ["Energy (LHV)", `${p.lhvMjKg} MJ/kg`],
        ["Latent heat", `${p.latentHeatKjKg} kJ/kg`],
      ];
    case "internals":
      return [
        ["Compression", `${p.compression}:1`],
        ["BMEP limit", `${p.bmepLimit} bar`],
      ];
    case "cooling":
      return [
        ["Heat rejection", `${p.capacityKw} kW`],
        ["Heat soak", `+${p.heatSoakK} °C`],
      ];
    case "exhaust":
      return [
        ["Flow capacity", `${Math.round(p.flowCapacity * 1000)} g/s`],
        ["Spool assist", p.spoolAssist ? `+${Math.round(p.spoolAssist * 100)}%` : "—"],
      ];
    case "ecu":
      return [
        ["Boost", `≤ ${p.maxBoostTarget} bar`],
        ["Timing", p.timingRange ? `±${p.timingRange}°` : "Locked"],
        ["Lambda", p.lambdaRange[0] === p.lambdaRange[1] ? `Locked λ ${p.lambdaRange[0].toFixed(2)}` : `λ ${p.lambdaRange[0].toFixed(2)}–${p.lambdaRange[1].toFixed(2)}`],
        ["Rev limit", p.revLimitRange[0] === p.revLimitRange[1] ? `${p.revLimitRange[0]}` : `${p.revLimitRange[0]}–${p.revLimitRange[1]}`],
      ];
    case "gearbox":
      return [
        ["Type", { manual: "Manual", sequential: "Sequential", dct: "Dual-clutch", automatic: "Automatic" }[p.transmission]],
        ["Gears", `${p.ratios.length}${p.adjustable ? " · adjustable" : ""}`],
        ["Ratios", p.ratios.join(" / ")],
        ["Efficiency", `${Math.round(p.efficiency * 1000) / 10}%`],
        ["Max torque", `${p.maxTorqueNm} Nm`],
        ["Shift time", `${Math.round(p.shiftTimeS * 1000)} ms`],
        ["Weight", `${p.weightKg} kg`],
      ];
    case "clutch":
      return [
        ["Capacity", `${p.capacityNm} Nm`],
        ["Launch", `${p.launchRpm} rpm`],
        ["Weight", `${p.weightKg} kg`],
      ];
    case "differential":
      return [
        ["Type", { open: "Open", "clutch-lsd": "Clutch-pack LSD", "helical-lsd": "Helical LSD" }[p.diffType]],
        ["Lock", `${Math.round(p.lockFactor * 100)}%`],
        ["Final drive", p.finalDriveRange[0] === p.finalDriveRange[1] ? `${p.finalDrive}` : `${p.finalDriveRange[0]}–${p.finalDriveRange[1]}`],
        ["Efficiency", `${Math.round(p.efficiency * 1000) / 10}%`],
      ];
    case "drivetrain":
      return [
        ["Layout", p.layout.toUpperCase()],
        ["Efficiency", `${Math.round(p.efficiency * 1000) / 10}%`],
        ["Front torque", `${Math.round(p.frontTorqueShare * 100)}%`],
        ["Weight", `${p.weightKg} kg`],
      ];
    case "aero":
    case "wing":
    case "body": {
      const rows: [string, string][] = [
        ["Drag area", p.dragAreaDelta === 0 ? "Factory" : `${p.dragAreaDelta > 0 ? "+" : ""}${p.dragAreaDelta.toFixed(3)} m²`],
        ["Downforce @ 200 km/h", p.downforceArea > 0 ? `${Math.round(0.5 * 1.2 * (200 / 3.6) ** 2 * p.downforceArea / 9.81)} kg` : "—"],
        ["Weight", p.massKg ? `+${p.massKg} kg` : "—"],
      ];
      if (p.slot === "body") rows.push(["Tyre grip", p.gripBonus ? `+${Math.round((p.gripBonus / 1.05) * 100)}%` : "Factory"]);
      return rows;
    }
  }
}
