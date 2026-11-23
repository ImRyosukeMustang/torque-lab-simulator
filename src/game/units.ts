// Display units. The simulation always works in SI/metric; only what the player reads changes.
export type Units = "metric" | "imperial";

export const KMH_PER_MPH = 1.609344;
export const NM_PER_LBFT = 1.3558179;
export const KG_PER_LB = 0.45359237;
export const BAR_PER_PSI = 0.0689476;
export const M_PER_FT = 0.3048;

const r = (v: number, d = 0) => {
  const f = 10 ** d;
  return Math.round(v * f) / f;
};
const num = (v: number, d = 0) => r(v, d).toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });

export const speed = (kmh: number, u: Units, d = 0) => (u === "imperial" ? `${num(kmh / KMH_PER_MPH, d)} mph` : `${num(kmh, d)} km/h`);
export const speedValue = (kmh: number, u: Units) => (u === "imperial" ? kmh / KMH_PER_MPH : kmh);
export const speedUnit = (u: Units) => (u === "imperial" ? "mph" : "km/h");
export const torque = (nm: number, u: Units) => (u === "imperial" ? `${num(nm / NM_PER_LBFT)} lb-ft` : `${num(nm)} Nm`);
export const torqueValue = (nm: number, u: Units) => (u === "imperial" ? nm / NM_PER_LBFT : nm);
export const torqueUnit = (u: Units) => (u === "imperial" ? "lb-ft" : "Nm");
export const temp = (c: number, u: Units) => (u === "imperial" ? `${num((c * 9) / 5 + 32)}°F` : `${num(c)}°C`);
export const tempValue = (c: number, u: Units) => (u === "imperial" ? (c * 9) / 5 + 32 : c);
export const tempUnit = (u: Units) => (u === "imperial" ? "°F" : "°C");
export const mass = (kg: number, u: Units) => (u === "imperial" ? `${num(kg / KG_PER_LB)} lb` : `${num(kg)} kg`);
export const pressure = (bar: number, u: Units, d = 2) => (u === "imperial" ? `${num(bar / BAR_PER_PSI, 1)} psi` : `${num(bar, d)} bar`);
export const pressureValue = (bar: number, u: Units) => (u === "imperial" ? bar / BAR_PER_PSI : bar);
export const pressureUnit = (u: Units) => (u === "imperial" ? "psi" : "bar");
export const distance = (m: number, u: Units) => (u === "imperial" ? `${num(m / M_PER_FT)} ft` : `${num(m)} m`);

/**
 * Rewrite metric quantities inside free text (diagnostics, requirement targets) for imperial players.
 * Handles "123 km/h", "320 Nm", "850°C", "1,350 kg", "1.2 bar" and "0-100 km/h".
 */
export function localizeText(text: string, u: Units): string {
  if (u === "metric") return text;
  const n = (s: string) => Number(s.replace(/,/g, ""));
  return text
    .replace(/0-100 km\/h/g, "0-62 mph")
    .replace(/0-200 km\/h/g, "0-124 mph")
    .replace(/(-?[\d,]+(?:\.\d+)?) km\/h/g, (_, v: string) => speed(n(v), u))
    .replace(/(-?[\d,]+(?:\.\d+)?) ?Nm\b/g, (_, v: string) => torque(n(v), u))
    .replace(/(-?[\d,]+(?:\.\d+)?) ?°C/g, (_, v: string) => temp(n(v), u))
    .replace(/(-?[\d,]+(?:\.\d+)?) kg\b/g, (_, v: string) => mass(n(v), u))
    .replace(/(-?[\d,]+(?:\.\d+)?) bar\b/g, (_, v: string) => pressure(n(v), u));
}
