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

  const boosted = { intake: "intake-hf", turbo: "turbo-t45", intercooler: "ic-large", injectors: "inj-1000", exhaust: "exh-3in", ecu: "ecu-standalone" } as const;
  const minKnock = (r: ReturnType<typeof simulate>) => Math.min(...r.curve.map((p) => p.knockMargin));
  const maxDuty = (r: ReturnType<typeof simulate>) => Math.max(...r.curve.map((p) => p.injectorDuty));

  it("E85 adds knock margin but needs more injector flow than gasoline", () => {
    const tune = T({ boostTarget: 1.2, afrTarget: 11.8 });
    const gas = simulate(B({ ...boosted }), tune);
    const e85 = simulate(B({ ...boosted, fuel: "fuel-e85" }), tune);
    expect(minKnock(e85)).toBeGreaterThan(minKnock(gas) + 0.5);
    expect(maxDuty(e85)).toBeGreaterThan(maxDuty(gas) * 1.4);
  });

  it("higher octane fuel adds knock margin", () => {
    const tune = T({ boostTarget: 1.0, afrTarget: 11.8 });
    const r95 = simulate(B({ ...boosted }), tune);
    const r98 = simulate(B({ ...boosted, fuel: "fuel-98" }), tune);
    expect(minKnock(r98)).toBeGreaterThan(minKnock(r95));
  });

  it("forged internals survive cylinder pressure that breaks the stock pistons", () => {
    const tune = T({ boostTarget: 1.4, afrTarget: 11.4, timingOffset: 3, revLimit: 8000 });
    const b = { ...boosted, fuel: "fuel-e85", injectors: "inj-1300", cooling: "cool-race" } as const;
    const cast = simulate(B(b), tune);
    const forged = simulate(B({ ...b, internals: "int-race" }), tune);
    expect(cast.diagnostics.some((d) => d.code === "BMEP_OVER")).toBe(true);
    expect(forged.diagnostics.some((d) => d.code === "BMEP_OVER")).toBe(false);
    expect(forged.reliability).toBeGreaterThan(cast.reliability + 20);
  });

  it("high compression makes more NA power but less knock margin", () => {
    const na = { intake: "intake-hf", camshaft: "cam-street", exhaust: "exh-3in", ecu: "ecu-piggy" } as const;
    const lo = simulate(B({ ...na }), T({ afrTarget: 12.8 }));
    const hi = simulate(B({ ...na, internals: "int-hicomp" }), T({ afrTarget: 12.8 }));
    expect(hi.peakPowerHp).toBeGreaterThan(lo.peakPowerHp);
    expect(minKnock(hi)).toBeLessThan(minKnock(lo));
  });

  it("a bigger radiator lowers thermal load", () => {
    const tune = T({ boostTarget: 1.2, afrTarget: 11.8 });
    const stock = simulate(B({ ...boosted }), tune);
    const race = simulate(B({ ...boosted, cooling: "cool-race" }), tune);
    expect(race.thermalLoad).toBeLessThan(stock.thermalLoad * 0.7);
  });

  it("wheel power is about 14% below crank power", () => {
    const r = simulate(STOCK_BUILD, STOCK_TUNE);
    expect(r.wheelPowerHp).toBeCloseTo(r.peakPowerHp * 0.86, 0);
  });
});
