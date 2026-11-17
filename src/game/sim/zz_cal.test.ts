import { it } from "vitest";
import { simulate } from "./engine";
import { STOCK_BUILD, STOCK_TUNE, buildCost } from "./parts";
const run = (name: string, b: any, t: any) => {
  const build = { ...STOCK_BUILD, ...b }; const r = simulate(build, { ...STOCK_TUNE, ...t });
  const tq3 = r.curve.find((p) => p.rpm === 3000)!.torqueNm;
  console.log(name.padEnd(28), r.peakPowerHp, "hp", r.wheelPowerHp, "whp", Math.round(tq3), "Nm@3k rel", r.reliability, "egt", r.peakEgtC, "therm", r.thermalLoad, "cost", buildCost(build), r.diagnostics.map((d) => d.code).join(","));
};
it("cal", () => {
  const na = { intake: "intake-hf", camshaft: "cam-race", exhaust: "exh-header", ecu: "ecu-standalone", internals: "int-hicomp" };
  run("NA hdr hicomp", na, { afrTarget: 12.8, timingOffset: 2, revLimit: 8000 });
  run("NA hdr hicomp race", { ...na, fuel: "fuel-race" }, { afrTarget: 12.8, timingOffset: 6, revLimit: 8000 });
  run("NA hdr hicomp race 8200", { ...na, fuel: "fuel-race" }, { afrTarget: 12.8, timingOffset: 6, revLimit: 8200 });
  run("NA hdr hicomp 98", { ...na, fuel: "fuel-98" }, { afrTarget: 12.8, timingOffset: 4, revLimit: 8000 });
  run("NA 3in stockint 98", { ...na, exhaust:"exh-3in", internals: "int-stock", fuel: "fuel-98" }, { afrTarget: 12.8, timingOffset: 5, revLimit: 8000 });
  const e = { intake: "intake-hf", camshaft: "cam-race", turbo: "turbo-t45", intercooler: "ic-w2a", injectors: "inj-1300", exhaust: "exh-header", ecu: "ecu-standalone", fuel: "fuel-e85", internals: "int-race", cooling: "cool-race" };
  for (const [bt, afr, tm] of [[1.4,11.2,6],[1.5,11.0,6],[1.6,10.8,6],[1.5,11.4,6],[1.3,11.5,6],[1.6,11.0,6],[1.7,10.8,6]]) run(`e85 ${bt} ${afr} ${tm}`, e, { boostTarget: bt, afrTarget: afr, timingOffset: tm, revLimit: 8000 });
  run(`e85 cheap`, { ...e, intercooler: "ic-large", exhaust: "exh-3in", cooling: "cool-alu" }, { boostTarget: 1.4, afrTarget: 11.2, timingOffset: 6, revLimit: 8000 });
  run(`e85 forged`, { ...e, internals: "int-forged" }, { boostTarget: 1.3, afrTarget: 11.2, timingOffset: 6, revLimit: 8000 });
  run(`gas race fuel`, { ...e, fuel: "fuel-race", injectors: "inj-1000" }, { boostTarget: 1.4, afrTarget: 11.2, timingOffset: 2, revLimit: 8000 });
});
