import { describe, expect, it } from "vitest";
import { aeroLoads } from "./drivetrain";
import { STOCK_BUILD } from "./parts";

describe("aerodynamic loads", () => {
  it("scales drag with speed squared and gives the factory body no downforce", () => {
    const at100 = aeroLoads(STOCK_BUILD, 100);
    const at200 = aeroLoads(STOCK_BUILD, 200);

    expect(at100.downforceN).toBe(0);
    expect(at200.dragN / at100.dragN).toBeCloseTo(4);
  });

  it("uses fitted bodywork for drag and axle downforce", () => {
    const build = { ...STOCK_BUILD, aero: "aero-gt", wing: "wing-gt" };
    const stock = aeroLoads(STOCK_BUILD, 200);
    const fitted = aeroLoads(build, 200);

    expect(fitted.dragN).toBeGreaterThan(stock.dragN);
    expect(fitted.downforceN).toBeGreaterThan(0);
    expect(fitted.frontDownforceN + fitted.rearDownforceN).toBeCloseTo(fitted.downforceN);
    expect(fitted.rearDownforceN).toBeGreaterThan(fitted.frontDownforceN);
  });
});
