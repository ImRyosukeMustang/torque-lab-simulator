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
      ];
    case "intercooler":
      if (p.effectiveness === 0) return [["Effectiveness", "—"]];
      return [
        ["Effectiveness", `${Math.round(p.effectiveness * 100)}%`],
        ["Pressure drop", `${p.pressureDrop} bar`],
      ];
    case "injectors":
      return [
        ["Flow", `${p.flowCc} cc/min`],
        ["Total", `${(p.flowCc * 4 * 0.745 / 60).toFixed(1)} g/s`],
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
        ["AFR", p.afrRange[0] === p.afrRange[1] ? "Locked" : `${p.afrRange[0]}–${p.afrRange[1]}`],
        ["Rev limit", p.revLimitRange[0] === p.revLimitRange[1] ? `${p.revLimitRange[0]}` : `${p.revLimitRange[0]}–${p.revLimitRange[1]}`],
      ];
  }
}
