import { describe, expect, it } from "vitest";
import { localizeText, pressure, speed, temp, torque } from "./units";

describe("display units", () => {
  it("converts speed, torque, temperature and boost for imperial players", () => {
    expect(speed(100, "imperial")).toBe("62 mph");
    expect(speed(100, "metric")).toBe("100 km/h");
    expect(torque(400, "imperial")).toBe("295 lb-ft");
    expect(temp(850, "imperial")).toBe("1,562°F");
    expect(pressure(1, "imperial")).toBe("14.5 psi");
  });
  it("rewrites metric figures inside diagnostic text", () => {
    expect(localizeText("Top gear runs out at 240 km/h with 320 Nm and EGT 900°C", "imperial")).toBe("Top gear runs out at 149 mph with 236 lb-ft and EGT 1,652°F");
    expect(localizeText("0-100 km/h ≤ 7.0 s", "imperial")).toBe("0-62 mph ≤ 7.0 s");
    expect(localizeText("320 Nm", "metric")).toBe("320 Nm");
  });
});
