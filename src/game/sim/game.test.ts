import { describe, expect, it } from "vitest";
import { CHALLENGES, evaluateChallenge, rewardFor } from "./challenges";
import { simulate } from "./engine";
import { buyPart, configKey, deserialize, installPart, newGame, recordDynoRun, sellPart, serialize, setCosmetics, setTune, STARTING_CREDITS, submitChallenge, type GameState } from "./economy";
import { findPart, STOCK_BUILD, STOCK_TUNE } from "./parts";
import type { Build, Tune } from "./types";

const ch = (id: string) => CHALLENGES.find((c) => c.id === id)!;

// One known solution per challenge; each must pass and the stock car must fail.
const SOLUTIONS: Record<string, { build: Partial<Build>; tune: Partial<Tune> }> = {
  c1: { build: { intake: "intake-cai", exhaust: "exh-catback" }, tune: {} },
  c2: { build: { intake: "intake-hf", camshaft: "cam-street", exhaust: "exh-catback", ecu: "ecu-piggy" }, tune: { afrTarget: 12.8, timingOffset: 3 } },
  c3: { build: { intake: "intake-hf", turbo: "turbo-t25", intercooler: "ic-small", injectors: "inj-440", exhaust: "exh-catback", ecu: "ecu-piggy" }, tune: { boostTarget: 1.1, afrTarget: 11.8 } },
  c4: { build: { intake: "intake-hf", turbo: "turbo-t25", intercooler: "ic-large", injectors: "inj-440", ecu: "ecu-piggy" }, tune: { boostTarget: 1.1, afrTarget: 12.2, timingOffset: 2 } },
  c6: { build: { intake: "intake-hf", camshaft: "cam-race", exhaust: "exh-header", ecu: "ecu-standalone", internals: "int-hicomp", fuel: "fuel-race" }, tune: { afrTarget: 12.8, timingOffset: 6, revLimit: 8000 } },
  c7: { build: { intake: "intake-hf", camshaft: "cam-race", turbo: "turbo-t45", intercooler: "ic-w2a", injectors: "inj-1300", exhaust: "exh-header", ecu: "ecu-standalone", fuel: "fuel-e85", internals: "int-race", cooling: "cool-race" }, tune: { boostTarget: 1.5, afrTarget: 11.4, timingOffset: 6, revLimit: 8000 } },
  c5: { build: { intake: "intake-hf", camshaft: "cam-race", turbo: "turbo-t45", intercooler: "ic-large", injectors: "inj-750", exhaust: "exh-3in", ecu: "ecu-standalone" }, tune: { boostTarget: 0.9, afrTarget: 12.2, timingOffset: 4, revLimit: 8000 } },
};

describe("challenges", () => {
  it("there are seven challenges", () => expect(CHALLENGES).toHaveLength(7));

  it("every known solution only uses parts unlocked before that challenge", () => {
    for (const c of CHALLENGES) {
      const idx = CHALLENGES.indexOf(c);
      const done = new Set(CHALLENGES.slice(0, idx).map((x) => x.id));
      for (const id of Object.values(SOLUTIONS[c.id]!.build)) {
        const p = findPart(id!)!;
        expect(!p.unlockAfter || done.has(p.unlockAfter), `${c.id} uses locked ${id}`).toBe(true);
      }
    }
  });

  it("c7 refuses a gasoline build even if it makes the numbers", () => {
    const s = SOLUTIONS["c7"]!;
    const b = { ...STOCK_BUILD, ...s.build, fuel: "fuel-race" };
    const ev = evaluateChallenge(ch("c7"), b, simulate(b, { ...STOCK_TUNE, ...s.tune }));
    expect(ev.checks.find((x) => x.label.startsWith("Fitted"))!.pass).toBe(false);
  });

  for (const c of CHALLENGES) {
    it(`${c.id} fails on the stock car and passes with a known build`, () => {
      expect(evaluateChallenge(c, STOCK_BUILD, simulate(STOCK_BUILD, STOCK_TUNE)).passed).toBe(false);
      const s = SOLUTIONS[c.id]!;
      const b = { ...STOCK_BUILD, ...s.build };
      const ev = evaluateChallenge(c, b, simulate(b, { ...STOCK_TUNE, ...s.tune }));
      expect(ev.checks.filter((x) => !x.pass)).toEqual([]);
      expect(ev.grade).not.toBeNull();
    });
  }

  it("c1 rejects a turbocharged build", () => {
    const b = { ...STOCK_BUILD, intake: "intake-cai", turbo: "turbo-t25" };
    const ev = evaluateChallenge(ch("c1"), b, simulate(b, STOCK_TUNE));
    expect(ev.checks.find((x) => x.label === "Aspiration")!.pass).toBe(false);
  });

  it("rewards only pay the improvement over a previous grade", () => {
    expect(rewardFor(ch("c1"), "bronze", null)).toBe(1500);
    expect(rewardFor(ch("c1"), "gold", "bronze")).toBe(1500);
    expect(rewardFor(ch("c1"), "silver", "gold")).toBe(0);
  });
});

describe("economy and saves", () => {
  it("starts with 3000 credits and the stock parts", () => {
    const g = newGame();
    expect(g.credits).toBe(STARTING_CREDITS);
    expect(g.credits).toBe(3000);
    expect(g.owned).toContain("intake-stock");
  });

  it("buying deducts the price and cannot overspend", () => {
    let g = buyPart(newGame(), "intake-cai");
    expect(g.credits).toBe(2550);
    g = { ...g, credits: 100 };
    expect(buyPart(g, "exh-catback")).toBe(g);
  });

  it("locked parts cannot be bought", () => {
    const g = newGame();
    expect(buyPart(g, "turbo-t25")).toBe(g);
  });

  it("selling refunds 60% and never sells the installed part", () => {
    let g = installPart(buyPart(newGame(), "intake-cai"), "intake-cai");
    expect(sellPart(g, "intake-cai")).toBe(g);
    g = installPart(g, "intake-stock");
    expect(sellPart(g, "intake-cai").credits).toBe(2550 + 270);
  });

  it("challenges grade only a dyno run of the current configuration", () => {
    let g: GameState = installPart(buyPart(buyPart(newGame(), "intake-cai"), "exh-catback"), "intake-cai");
    g = installPart(g, "exh-catback");
    expect(submitChallenge(g, "c1").refused).toBe("no-run");
    g = recordDynoRun(g);
    const changed = setTune(installPart(g, "intake-stock"), {});
    expect(submitChallenge(changed, "c1").refused).toBe("stale-run");
    const out = submitChallenge(g, "c1");
    expect(out.evaluation?.passed).toBe(true);
    expect(out.reward).toBe(1500);
    expect(out.state.credits).toBe(g.credits + 1500);
    expect(submitChallenge(out.state, "c1").reward).toBe(0);
  });

  it("later challenges are locked until the previous one is completed", () => {
    const g = recordDynoRun(newGame());
    expect(submitChallenge(g, "c2").refused).toBe("locked");
  });

  it("save round-trips and corrupt saves fall back to a new game", () => {
    const g = recordDynoRun(installPart(buyPart(newGame(), "intake-cai"), "intake-cai"));
    expect(deserialize(serialize(g))).toEqual(g);
    expect(deserialize("{bad json")).toEqual(newGame());
    expect(deserialize(null)).toEqual(newGame());
    expect(configKey(g.build, g.tune)).toBe(g.lastRunKey);
  });

  it("a version 1 save keeps credits, parts and grades and gains the new slots as stock", () => {
    const v1 = {
      version: 1,
      credits: 4200,
      owned: ["intake-stock", "cam-stock", "turbo-none", "ic-none", "inj-stock", "exh-stock", "ecu-stock", "intake-cai"],
      build: { intake: "intake-cai", camshaft: "cam-stock", turbo: "turbo-none", intercooler: "ic-none", injectors: "inj-stock", exhaust: "exh-stock", ecu: "ecu-stock" },
      tune: STOCK_TUNE,
      progress: { c1: "gold" },
      lastRunKey: "old|key",
      runCount: 3,
    };
    const g = deserialize(JSON.stringify(v1));
    expect(g.version).toBe(2);
    expect(g.credits).toBe(4200);
    expect(g.progress).toEqual({ c1: "gold" });
    expect(g.build.intake).toBe("intake-cai");
    expect(g.build.fuel).toBe("fuel-95");
    expect(g.build.internals).toBe("int-stock");
    expect(g.build.cooling).toBe("cool-stock");
    expect(g.owned).toContain("fuel-95");
    expect(g.cosmetics.paint).toBe("#9e3b1a");
    expect(g.lastRunKey).toBeNull();
  });

  it("paint choices persist through a save and invalid colours are rejected", () => {
    const g = setCosmetics(newGame(), { paint: "#16264a", finish: "matte", rimStyle: "dish" });
    const back = deserialize(serialize(g));
    expect(back.cosmetics.paint).toBe("#16264a");
    expect(back.cosmetics.finish).toBe("matte");
    expect(back.cosmetics.rimStyle).toBe("dish");
    const bad = JSON.parse(serialize(g));
    bad.cosmetics.paint = "red";
    expect(deserialize(JSON.stringify(bad)).cosmetics.paint).toBe("#9e3b1a");
    expect(deserialize(JSON.stringify(bad)).credits).toBe(g.credits);
  });
});
