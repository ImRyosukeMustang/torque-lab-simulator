import { it } from "vitest";
import { simulate } from "./engine";
import { STOCK_BUILD, STOCK_TUNE, buildCost } from "./parts";
const run = (name: string, b: any, t: any) => {
  const build = { ...STOCK_BUILD, ...b }; const r = simulate(build, { ...STOCK_TUNE, ...t });
  const tq3 = r.curve.find((p) => p.rpm === 3000)!.torqueNm;
  console.log(name.padEnd(28), r.peakPowerHp, "hp", r.wheelPowerHp, "whp", Math.round(tq3), "Nm@3k rel", r.reliability, "egt", r.peakEgtC, "therm", r.thermalLoad, "cost", buildCost(build), r.diagnostics.map((d) => d.code).join(","));
};
it("cal", () => {
  const na = { intake: "intake-hf", camshaft: "cam-race", exhaust: "exh-3in", ecu: "ecu-standalone" };
  run("NA race cam", na, { afrTarget: 12.8, timingOffset: 3, revLimit: 8000 });
  run("NA race hicomp", { ...na, internals: "int-hicomp" }, { afrTarget: 12.8, timingOffset: 2, revLimit: 8000 });
  run("NA race hicomp 98", { ...na, internals: "int-hicomp", fuel: "fuel-98" }, { afrTarget: 12.8, timingOffset: 4, revLimit: 8000 });
  run("NA vvt hicomp 98", { ...na, camshaft: "cam-vvt", internals: "int-hicomp", fuel: "fuel-98" }, { afrTarget: 12.8, timingOffset: 4, revLimit: 7800 });
  run("NA race hicomp race", { ...na, internals: "int-hicomp", fuel: "fuel-race" }, { afrTarget: 12.8, timingOffset: 6, revLimit: 8000 });
  const big = { intake: "intake-hf", camshaft: "cam-race", turbo: "turbo-t45", intercooler: "ic-large", injectors: "inj-1000", exhaust: "exh-3in", ecu: "ecu-standalone" };
  run("c5ish", { ...big, injectors: "inj-750" }, { boostTarget: 0.9, afrTarget: 12.2, timingOffset: 4, revLimit: 8000 });
  run("t45 1.4 gas", big, { boostTarget: 1.4, afrTarget: 11.8, timingOffset: 0, revLimit: 8000 });
  run("t45 1.4 forged", { ...big, internals: "int-forged" }, { boostTarget: 1.4, afrTarget: 11.8, timingOffset: 0, revLimit: 8000 });
  for (const bt of [1.4, 1.6, 1.8, 2.0, 2.2]) {
    run(`e85 race ${bt}`, { ...big, injectors: "inj-1300", fuel: "fuel-e85", internals: "int-race", cooling: "cool-race", intercooler: "ic-w2a", exhaust: "exh-header" }, { boostTarget: bt, afrTarget: 11.8, timingOffset: 3, revLimit: 8000 });
    run(`e85 forged 1000 ${bt}`, { ...big, injectors: "inj-1000", fuel: "fuel-e85", internals: "int-forged", cooling: "cool-alu" }, { boostTarget: bt, afrTarget: 11.8, timingOffset: 2, revLimit: 8000 });
  }
  run("t30 e85", { intake: "intake-hf", camshaft: "cam-vvt", turbo: "turbo-t30", intercooler: "ic-large", injectors: "inj-1000", exhaust: "exh-3in", ecu: "ecu-standalone", fuel: "fuel-e85", internals: "int-forged", cooling: "cool-alu" }, { boostTarget: 1.4, afrTarget: 11.8, timingOffset: 4, revLimit: 7800 });
});
