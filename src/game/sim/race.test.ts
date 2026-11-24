import { describe, expect, it } from "vitest";
import { addCredits, AD_REWARD, deserialize, newGame, recordRace, serialize } from "./economy";
import { simulate } from "./engine";
import { clampTune, STOCK_BUILD, STOCK_TUNE } from "./parts";
import { driveRun, isRaceUnlocked, launch, makeRaceCar, newCarState, purseFor, RACE_DISTANCE_M, RACE_EVENTS, RIVALS, rivalBuild, rivalGhost, rivalRating, stepCar } from "./race";

const perfect = { reactionS: 0.2, launchFactor: 1, shiftFactor: 1 };
const stockCar = makeRaceCar(STOCK_BUILD, STOCK_TUNE);

describe("drag race physics", () => {
  it("race distances are a quarter, half and full mile", () => {
    expect(RACE_DISTANCE_M.quarter).toBeCloseTo(402.3, 1);
    expect(RACE_DISTANCE_M.half).toBeCloseTo(804.7, 1);
    expect(RACE_DISTANCE_M.mile).toBeCloseTo(1609.3, 1);
  });

  it("a perfect quarter mile agrees with the track test within half a second", () => {
    const run = driveRun(stockCar, perfect, "quarter");
    const sim = simulate(STOCK_BUILD, STOCK_TUNE).vehicle.quarterMileS!;
    expect(Math.abs(run.elapsedS! - sim)).toBeLessThan(0.5);
  });

  it("shifting early is slower than shifting at the ideal point", () => {
    const good = driveRun(stockCar, perfect, "quarter");
    const early = driveRun(stockCar, { ...perfect, shiftFactor: 0.7 }, "quarter");
    expect(early.totalS!).toBeGreaterThan(good.totalS! + 0.2);
  });

  it("a bad launch (bogging the engine) costs time over the ideal launch", () => {
    const good = driveRun(stockCar, perfect, "quarter");
    const bog = driveRun(stockCar, { ...perfect, launchFactor: 0.35 }, "quarter");
    expect(bog.sixtyFtS!).toBeGreaterThan(good.sixtyFtS!);
  });

  it("dropping the clutch before green is a red light", () => {
    const s = newCarState();
    s.t = -0.3;
    expect(launch(s, stockCar)).toBe(false);
  });

  it("the car only moves after launch", () => {
    const s = newCarState();
    s.t = -1;
    for (let i = 0; i < 400; i++) stepCar(stockCar, s, 1, 402);
    expect(s.v).toBe(0);
    expect(s.rpm).toBeGreaterThan(3000);
  });

  it("a bolt-on turbo beats the 220 hp Street Rival with clean driving, the stock car does not", () => {
    const kai = rivalGhost("kai", "quarter").totalS!;
    const turboB = { ...STOCK_BUILD, turbo: "turbo-t25" };
    const turbo = driveRun(makeRaceCar(turboB, clampTune(turboB, STOCK_TUNE)), perfect, "quarter").totalS!;
    const stock = driveRun(stockCar, perfect, "quarter").totalS!;
    expect(turbo).toBeLessThan(kai);
    expect(stock).toBeGreaterThan(kai);
  });

  it("rival ghosts get faster up the ladder", () => {
    const times = ["kai", "mara", "dex", "rook", "vex", "nova"].map((id) => rivalGhost(id, "quarter").totalS!);
    for (let i = 1; i < times.length; i++) expect(times[i]!).toBeLessThan(times[i - 1]!);
  });
});

describe("race rewards", () => {
  it("the first win pays the full purse, rematches pay 10%", () => {
    const r1 = RACE_EVENTS[0]!;
    const g = newGame();
    const first = recordRace(g, "r1", { won: true, totalS: 16 });
    expect(first.purse).toBe(2500);
    expect(first.state.credits).toBe(g.credits + 2500);
    const again = recordRace(first.state, "r1", { won: true, totalS: 15.9 });
    expect(again.purse).toBe(250);
    expect(purseFor(r1, 1)).toBe(250);
  });

  it("a loss pays nothing but keeps the best time", () => {
    const out = recordRace(newGame(), "r1", { won: false, totalS: 17.2 });
    expect(out.purse).toBe(0);
    expect(out.state.raceBest["r1"]).toBe(17.2);
  });

  it("events unlock in order and a locked event pays nothing", () => {
    expect(isRaceUnlocked("r2", {})).toBe(false);
    expect(recordRace(newGame(), "r2", { won: true, totalS: 14 }).purse).toBe(0);
    expect(isRaceUnlocked("r2", { r1: 1 })).toBe(true);
  });

  it("winning the Street Rival race finishes the intro and survives a save", () => {
    const g = newGame();
    expect(g.tutorial).toBe("street-rival");
    const out = recordRace(g, "r1", { won: true, totalS: 16 }).state;
    expect(out.tutorial).toBe("done");
    const back = deserialize(serialize(out));
    expect(back.tutorial).toBe("done");
    expect(back.raceWins["r1"]).toBe(1);
  });

  it("a rewarded ad pays 2,500 credits", () => {
    expect(AD_REWARD).toBe(2500);
    expect(addCredits(newGame(), AD_REWARD).credits).toBe(3000 + 2500);
    expect(addCredits(newGame(), -5).credits).toBe(3000);
  });
});

describe("rival field", () => {
  it("there are 15 rivals, each rated 1-99", () => {
    expect(RIVALS).toHaveLength(15);
    for (const r of RIVALS) {
      const rating = rivalRating(r.id);
      expect(rating).toBeGreaterThanOrEqual(1);
      expect(rating).toBeLessThanOrEqual(99);
    }
  });

  it("a faster quarter mile means a higher rating", () => {
    const sorted = [...RIVALS].sort((a, b) => rivalGhost(a.id, "quarter").totalS! - rivalGhost(b.id, "quarter").totalS!);
    for (let i = 1; i < sorted.length; i++) expect(rivalRating(sorted[i]!.id)).toBeLessThanOrEqual(rivalRating(sorted[i - 1]!.id));
  });

  it("a rival without a body kit races on the stock body, not the player's", () => {
    expect(rivalBuild(RIVALS.find((r) => r.id === "kai")!).build.body).toBe(STOCK_BUILD.body);
  });

  it("lighter wheels run a quicker quarter mile than heavy ones", () => {
    const light = driveRun(makeRaceCar(STOCK_BUILD, STOCK_TUNE, undefined, { rimStyle: "mesh" }), perfect, "quarter");
    const heavy = driveRun(makeRaceCar(STOCK_BUILD, STOCK_TUNE, undefined, { rimStyle: "dish" }), perfect, "quarter");
    expect(light.totalS!).toBeLessThan(heavy.totalS!);
  });
});

describe("ghost driving", () => {
  it("a ghost never shifts into second while the clutch is still slipping off the line", () => {
    for (const r of RIVALS) {
      const early = rivalGhost(r.id, "quarter").samples.find((s) => s.gear >= 2);
      expect(early?.kmh ?? 999).toBeGreaterThan(25);
    }
  });

  it("Nova and Phantom are Legend-rated (85+), Phantom the fastest", () => {
    expect(rivalRating("nova")).toBeGreaterThanOrEqual(85);
    expect(rivalRating("phantom")).toBeGreaterThanOrEqual(85);
    for (const r of RIVALS) expect(rivalGhost("phantom", "quarter").totalS!).toBeLessThanOrEqual(rivalGhost(r.id, "quarter").totalS!);
  });
});
