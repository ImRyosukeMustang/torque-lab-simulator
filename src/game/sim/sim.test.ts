import { describe, expect, it } from "vitest";
import { burnFactor, compressorEfficiency, intercoolerEffectiveness, simulate } from "./engine";
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

  it.each(["engine-i5-25", "engine-v6-32", "engine-v8-40"])("%s raises output and adds engine mass", (engine) => {
    const stock = simulate(STOCK_BUILD, STOCK_TUNE);
    const swapped = simulate(B({ engine }), STOCK_TUNE);
    expect(swapped.peakPowerHp).toBeGreaterThan(stock.peakPowerHp);
    expect(swapped.vehicle.massKg).toBeGreaterThan(stock.vehicle.massKg);
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
    const t = simulate(B({ turbo: "turbo-t25", ecu: "ecu-piggy", injectors: "inj-440", intercooler: "ic-small" }), T({ boostTarget: 1.0, lambdaTarget: 0.80 }));
    expect(t.peakBoostBar).toBeGreaterThan(0.9);
    expect(t.peakPowerHp).toBeGreaterThan(na.peakPowerHp * 1.4);
    expect(t.peakEgtC).toBeGreaterThan(na.peakEgtC);
  });

  it("a bigger turbo spools later", () => {
    const base = { ecu: "ecu-standalone", injectors: "inj-1000", intercooler: "ic-large" } as const;
    const tune = T({ boostTarget: 1.0, lambdaTarget: 0.80 });
    const small = simulate(B({ ...base, turbo: "turbo-t25" }), tune);
    const big = simulate(B({ ...base, turbo: "turbo-t45" }), tune);
    const boostAt = (r: typeof small, rpm: number) => r.curve.find((p) => p.rpm === rpm)!.boostBar;
    expect(boostAt(small, 3000)).toBeGreaterThan(boostAt(big, 3000) + 0.3);
  });

  it("stock injectors on a boosted engine run out of fuel and hurt reliability", () => {
    const tune = T({ boostTarget: 1.1, lambdaTarget: 0.80 });
    const base = { turbo: "turbo-t35", ecu: "ecu-piggy", intercooler: "ic-small", intake: "intake-hf", exhaust: "exh-3in" } as const;
    const stockInj = simulate(B({ ...base }), tune);
    const bigInj = simulate(B({ ...base, injectors: "inj-750" }), tune);
    expect(stockInj.diagnostics.some((d) => d.code === "INJ_DUTY" || d.code === "LEAN")).toBe(true);
    expect(stockInj.reliability).toBeLessThan(bigInj.reliability);
  });

  it("no intercooler at 1 bar causes detonation", () => {
    const r = simulate(B({ turbo: "turbo-t25", ecu: "ecu-piggy", injectors: "inj-440" }), T({ boostTarget: 1.0, lambdaTarget: 0.80 }));
    expect(r.diagnostics.some((d) => d.code === "KNOCK")).toBe(true);
  });

  it("revving past the valvetrain limit is flagged", () => {
    const r = simulate(B({ ecu: "ecu-standalone" }), T({ revLimit: 8000 }));
    expect(r.diagnostics.some((d) => d.code === "VALVE_FLOAT")).toBe(true);
    expect(r.reliability).toBeLessThan(100);
  });

  it("the stock ECU locks the tune", () => {
    const r = simulate(STOCK_BUILD, T({ timingOffset: 6, revLimit: 8000, lambdaTarget: 0.75 }));
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
    const tune = T({ boostTarget: 1.2, lambdaTarget: 0.80 });
    const gas = simulate(B({ ...boosted }), tune);
    const e85 = simulate(B({ ...boosted, fuel: "fuel-e85" }), tune);
    expect(minKnock(e85)).toBeGreaterThan(minKnock(gas) + 0.5);
    expect(maxDuty(e85)).toBeGreaterThan(maxDuty(gas) * 1.4);
  });

  it("higher octane fuel adds knock margin", () => {
    const tune = T({ boostTarget: 1.0, lambdaTarget: 0.80 });
    const r95 = simulate(B({ ...boosted }), tune);
    const r98 = simulate(B({ ...boosted, fuel: "fuel-98" }), tune);
    expect(minKnock(r98)).toBeGreaterThan(minKnock(r95));
  });

  it("forged internals survive cylinder pressure that breaks the stock pistons", () => {
    const tune = T({ boostTarget: 1.4, lambdaTarget: 0.78, timingOffset: 3, revLimit: 8000 });
    const b = { ...boosted, fuel: "fuel-e85", injectors: "inj-1300", cooling: "cool-race" } as const;
    const cast = simulate(B(b), tune);
    const forged = simulate(B({ ...b, internals: "int-race" }), tune);
    expect(cast.diagnostics.some((d) => d.code === "BMEP_OVER")).toBe(true);
    expect(forged.diagnostics.some((d) => d.code === "BMEP_OVER")).toBe(false);
    expect(forged.reliability).toBeGreaterThan(cast.reliability + 20);
  });

  it("high compression makes more NA power but less knock margin", () => {
    const na = { intake: "intake-hf", camshaft: "cam-street", exhaust: "exh-3in", ecu: "ecu-piggy" } as const;
    const lo = simulate(B({ ...na }), T({ lambdaTarget: 0.87 }));
    const hi = simulate(B({ ...na, internals: "int-hicomp" }), T({ lambdaTarget: 0.87 }));
    expect(hi.peakPowerHp).toBeGreaterThan(lo.peakPowerHp);
    expect(minKnock(hi)).toBeLessThan(minKnock(lo));
  });

  it("a bigger radiator lowers thermal load", () => {
    const tune = T({ boostTarget: 1.2, lambdaTarget: 0.80 });
    const stock = simulate(B({ ...boosted }), tune);
    const race = simulate(B({ ...boosted, cooling: "cool-race" }), tune);
    expect(race.thermalLoad).toBeLessThan(stock.thermalLoad * 0.7);
  });

  it("wheel power is about 14% below crank power", () => {
    const r = simulate(STOCK_BUILD, STOCK_TUNE);
    expect(r.wheelPowerHp).toBeCloseTo(r.peakPowerHp * 0.86, 0);
  });

  it("lambda means the same thing on every fuel: E85 at λ 0.80 runs a 7.8:1 AFR, gasoline 11.8:1", () => {
    const b = { ...boosted, injectors: "inj-1300" } as const;
    const tune = T({ boostTarget: 1.0, lambdaTarget: 0.8 });
    const gas = simulate(B(b), tune).curve.at(-1)!;
    const e85 = simulate(B({ ...b, fuel: "fuel-e85" }), tune).curve.at(-1)!;
    expect(gas.lambda).toBeCloseTo(0.8, 2);
    expect(e85.lambda).toBeCloseTo(0.8, 2);
    expect(gas.afr).toBeCloseTo(11.76, 1);
    expect(e85.afr).toBeCloseTo(7.84, 1);
    // ~50% more fuel mass for the same air
    expect(e85.fuelFlowGs / e85.airFlowKgS).toBeGreaterThan((gas.fuelFlowGs / gas.airFlowKgS) * 1.45);
  });

  it("energy comes from delivered fuel: an injector-limited build goes lean, gains nothing and loses reliability", () => {
    const tune = T({ boostTarget: 1.1, lambdaTarget: 0.8 });
    const base = { turbo: "turbo-t35", ecu: "ecu-piggy", intercooler: "ic-small", intake: "intake-hf", exhaust: "exh-3in" } as const;
    const starvedR = simulate(B(base), tune);
    const fedR = simulate(B({ ...base, injectors: "inj-750" }), tune);
    const starved = starvedR.curve.at(-1)!;
    const fed = fedR.curve.at(-1)!;
    expect(starved.lambda).toBeGreaterThan(0.95);
    expect(starved.fuelFlowGs).toBeLessThan(fed.fuelFlowGs * 0.85);
    expect(starved.powerHp).toBeLessThan(fed.powerHp);
    expect(starvedR.diagnostics.some((d) => d.code === "LEAN")).toBe(true);
    expect(starvedR.reliability).toBeLessThan(fedR.reliability - 20);
  });

  it("burn quality peaks slightly rich of stoichiometric", () => {
    expect(burnFactor(0.87)).toBe(1);
    expect(burnFactor(1.0)).toBeLessThan(1);
    expect(burnFactor(0.72)).toBeLessThan(burnFactor(0.8));
    expect(burnFactor(1.2)).toBeLessThan(burnFactor(1.0));
  });

  it("compressor efficiency peaks in its island and falls toward choke and surge", () => {
    const peak = compressorEfficiency(0.76, 0.6, 2.0, 0.6, 2.0);
    expect(peak).toBeCloseTo(0.76, 3);
    expect(compressorEfficiency(0.76, 0.6, 2.0, 1.0, 2.0)).toBeLessThan(peak * 0.75);
    expect(compressorEfficiency(0.76, 0.6, 2.0, 0.15, 2.5)).toBeLessThan(peak * 0.7);
  });

  it("intercooler effectiveness meets its rating at 250 g/s and drops at higher flow", () => {
    expect(intercoolerEffectiveness(0.8, 0.25)).toBeCloseTo(0.8, 3);
    expect(intercoolerEffectiveness(0.8, 0.4)).toBeLessThan(0.77);
    expect(intercoolerEffectiveness(0.8, 0.1)).toBeGreaterThan(0.85);
    expect(intercoolerEffectiveness(0, 0.3)).toBe(0);
  });

  it("every warning explains why it happened and suggests a fix", () => {
    const r = simulate(B({ turbo: "turbo-t35", ecu: "ecu-piggy", intake: "intake-hf" }), T({ boostTarget: 1.1, timingOffset: 3 }));
    const problems = r.diagnostics.filter((d) => d.severity !== "info");
    expect(problems.length).toBeGreaterThan(1);
    for (const d of problems) {
      expect(d.cause, d.code).toBeTruthy();
      expect(d.fixes?.length, d.code).toBeGreaterThan(0);
    }
  });

  const bigTurbo = { intake: "intake-hf", camshaft: "cam-race", turbo: "turbo-t45", intercooler: "ic-w2a", injectors: "inj-1300", exhaust: "exh-header", ecu: "ecu-standalone", fuel: "fuel-e85", internals: "int-race", cooling: "cool-race" } as const;
  const bigTune = T({ boostTarget: 1.5, lambdaTarget: 0.78, timingOffset: 6, revLimit: 8000 });

  it("stock drivetrain loses about 14% between crank and rollers", () => {
    const r = simulate(STOCK_BUILD, STOCK_TUNE);
    expect(r.vehicle.drivetrainEfficiency).toBeCloseTo(0.862, 2);
  });

  it("the stock coupe does 0-100 km/h in 8.5-10 s and tops out between 200 and 240 km/h", () => {
    const v = simulate(STOCK_BUILD, STOCK_TUNE).vehicle;
    expect(v.zeroTo100S!).toBeGreaterThan(8.5);
    expect(v.zeroTo100S!).toBeLessThan(10);
    expect(v.topSpeedKmh).toBeGreaterThan(200);
    expect(v.topSpeedKmh).toBeLessThan(240);
  });

  it("body-shape swaps change race mass and acceleration", () => {
    const stock = simulate(STOCK_BUILD, STOCK_TUNE).vehicle;
    const hatch = simulate(B({ body: "body-hatch" }), STOCK_TUNE).vehicle;
    const sedan = simulate(B({ body: "body-sedan" }), STOCK_TUNE).vehicle;
    expect(hatch.massKg).toBeLessThan(stock.massKg);
    expect(sedan.massKg).toBeGreaterThan(stock.massKg);
    expect(hatch.zeroTo100S).not.toBe(stock.zeroTo100S);
    expect(sedan.topSpeedKmh).not.toBe(stock.topSpeedKmh);
  });

  it("torque over the clutch's capacity slips it: less wheel power and lower reliability", () => {
    const slip = simulate(B({ ...bigTurbo, gearbox: "gbx-auto6" }), bigTune);
    const r = simulate(B({ ...bigTurbo }), bigTune);
    expect(r.diagnostics.some((d) => d.code === "CLUTCH_SLIP")).toBe(true);
    expect(r.diagnostics.some((d) => d.code === "GEARBOX_TORQUE")).toBe(true);
    expect(r.wheelPowerHp).toBeLessThan(slip.wheelPowerHp);
    expect(r.reliability).toBeLessThan(slip.reliability - 20);
  });

  it("AWD puts big power down far better than RWD, an LSD better than an open diff", () => {
    const base = { ...bigTurbo, gearbox: "gbx-dct7" } as const;
    const rwdOpen = simulate(B(base), bigTune).vehicle.zeroTo100S!;
    const rwdLsd = simulate(B({ ...base, differential: "diff-clutch" }), bigTune).vehicle.zeroTo100S!;
    const awd = simulate(B({ ...base, differential: "diff-clutch", drivetrain: "dt-awd" }), bigTune).vehicle.zeroTo100S!;
    expect(rwdLsd).toBeLessThan(rwdOpen);
    expect(awd).toBeLessThan(rwdLsd - 1);
  });

  it("FWD loses grip under acceleration that RWD gains", () => {
    const base = { intake: "intake-hf", turbo: "turbo-t25", intercooler: "ic-small", injectors: "inj-440", exhaust: "exh-catback", ecu: "ecu-piggy" } as const;
    const tune = T({ boostTarget: 1.0, lambdaTarget: 0.8 });
    const rwd = simulate(B(base), tune).vehicle;
    const fwd = simulate(B({ ...base, drivetrain: "dt-fwd" }), tune).vehicle;
    expect(fwd.zeroTo100S!).toBeGreaterThan(rwd.zeroTo100S!);
  });

  it("a shorter final drive accelerates harder but lowers a rev-limited top speed", () => {
    const b = B({ differential: "diff-helical" });
    const short = simulate(b, T({ finalDrive: 4.6 })).vehicle;
    const tall = simulate(b, T({ finalDrive: 3.2 })).vehicle;
    expect(short.gears[0]!.peakWheelTorqueNm).toBeGreaterThan(tall.gears[0]!.peakWheelTorqueNm);
    expect(short.gears[4]!.maxKmh).toBeLessThan(tall.gears[4]!.maxKmh);
  });

  it("wheel speed per gear follows ratio, final drive and tyre size", () => {
    const g1 = simulate(STOCK_BUILD, STOCK_TUNE).vehicle.gears[0]!;
    // 1000 rpm / (3.36 × 3.91) × 2π × 0.33 m → 9.46 km/h
    expect(g1.kmhPer1000).toBeCloseTo(9.5, 1);
    expect(g1.overall).toBeCloseTo(13.14, 2);
  });
});
