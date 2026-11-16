import { describe, expect, it } from "vitest";
import { simulate } from "./engine";
import { STOCK_BUILD, STOCK_TUNE, buildCost } from "./parts";
import type { Build, Tune } from "./types";

const B = (o: Partial<Build>): Build => ({ ...STOCK_BUILD, ...o });
const T = (o: Partial<Tune>): Tune => ({ ...STOCK_TUNE, ...o });

describe("engine simulation", () => {
  it("is deterministic", () => {
    const b = B({ turbo: "turbo-t35", ecu: "ecu-piggy", injectors: "inj-440", intercooler: "ic-small" });
    expect(simulate(b, T({ boostTarget: 1 }))).toEqual(simulate(b, T({ boostTarget: 1 })));
  });

  it("stock AM-20 makes about 150 hp and is fully reliable", () => {
    const r = simulate(STOCK_BUILD, STOCK_TUNE);
    expect(r.peakPowerHp).toBeGreaterThan(140);
    expect(r.peakPowerHp).toBeLessThan(160);
    expect(r.reliability).toBe(100);
    expect(r.buildCost).toBe(0);
  });

  it("a freer intake adds power on an NA engine", () => {
    expect(simulate(B({ intake: "intake-cai" }), STOCK_TUNE).peakPowerHp).toBeGreaterThan(simulate(STOCK_BUILD, STOCK_TUNE).peakPowerHp);
  });

  it("the race cam trades low-end torque for top-end power", () => {
    const tune = T({});
    const stock = simulate(B({ ecu: "ecu-standalone" }), T({ revLimit: 8000 }));
    const race = simulate(B({ camshaft: "cam-race", ecu: "ecu-standalone" }), T({ revLimit: 8000 }));
    expect(race.peakPowerHp).toBeGreaterThan(stock.peakPowerHp);
    const at = (r: typeof stock, rpm: number) => r.curve.find((p) => p.rpm === rpm)!.torqueNm;
    expect(at(race, 3000)).toBeLessThan(at(stock, 3000));
    expect(tune).toBeTruthy();
  });

  it("a turbo raises boost, power and EGT rather than adding a fixed bonus", () => {
    const na = simulate(STOCK_BUILD, STOCK_TUNE);
    const t = simulate(B({ turbo: "turbo-t25", ecu: "ecu-piggy", injectors: "inj-440", intercooler: "ic-small" }), T({ boostTarget: 1.0, afrTarget: 11.8 }));
    expect(t.peakBoostBar).toBeGreaterThan(0.9);
    expect(t.peakPowerHp).toBeGreaterThan(na.peakPowerHp * 1.4);
    expect(t.peakEgtC).toBeGreaterThan(na.peakEgtC);
  });

  it("a bigger turbo spools later", () => {
    const base = { ecu: "ecu-standalone", injectors: "inj-1000", intercooler: "ic-large" } as const;
    const tune = T({ boostTarget: 1.0, afrTarget: 11.8 });
    const small = simulate(B({ ...base, turbo: "turbo-t25" }), tune);
    const big = simulate(B({ ...base, turbo: "turbo-t45" }), tune);
    const boostAt = (r: typeof small, rpm: number) => r.curve.find((p) => p.rpm === rpm)!.boostBar;
    expect(boostAt(small, 3000)).toBeGreaterThan(boostAt(big, 3000) + 0.3);
  });

  it("stock injectors on a boosted engine run out of fuel and hurt reliability", () => {
    const tune = T({ boostTarget: 1.1, afrTarget: 11.8 });
    const base = { turbo: "turbo-t35", ecu: "ecu-piggy", intercooler: "ic-small", intake: "intake-hf", exhaust: "exh-3in" } as const;
    const stockInj = simulate(B({ ...base }), tune);
    const bigInj = simulate(B({ ...base, injectors: "inj-750" }), tune);
    expect(stockInj.diagnostics.some((d) => d.code === "INJ_DUTY" || d.code === "LEAN")).toBe(true);
    expect(stockInj.reliability).toBeLessThan(bigInj.reliability);
  });

  it("no intercooler at 1 bar causes detonation", () => {
    const r = simulate(B({ turbo: "turbo-t25", ecu: "ecu-piggy", injectors: "inj-440" }), T({ boostTarget: 1.0, afrTarget: 11.8 }));
    expect(r.diagnostics.some((d) => d.code === "KNOCK")).toBe(true);
  });

  it("revving past the valvetrain limit is flagged", () => {
    const r = simulate(B({ ecu: "ecu-standalone" }), T({ revLimit: 8000 }));
    expect(r.diagnostics.some((d) => d.code === "VALVE_FLOAT")).toBe(true);
    expect(r.reliability).toBeLessThan(100);
  });

  it("the stock ECU locks the tune", () => {
    const r = simulate(STOCK_BUILD, T({ timingOffset: 6, revLimit: 8000, afrTarget: 11 }));
    expect(r.curve.at(-1)!.rpm).toBe(7000);
    expect(r).toEqual(simulate(STOCK_BUILD, STOCK_TUNE));
  });

  it("build cost sums the installed part prices", () => {
    expect(buildCost(B({ intake: "intake-cai", exhaust: "exh-catback" }))).toBe(1150);
  });
});
