import { describe, expect, it } from "vitest";
import { launchFeedback, photoFinishMargin, raceLossTip } from "./raceFeedback";

describe("race feedback", () => {
  it("calls out an in-window launch and shows the target for an off-target launch", () => {
    expect(launchFeedback(4100, 4200, [3900, 4400])).toEqual({
      text: "GREAT LAUNCH · 4,100 RPM",
      tone: "good",
    });
    expect(launchFeedback(3500, 4200, [3900, 4400])).toEqual({
      text: "3,500 RPM · LOW · TARGET 4,200",
      tone: "info",
    });
  });

  it("marks only close completed runs as photo finishes", () => {
    expect(photoFinishMargin(10, 10.04)).toBeCloseTo(0.04);
    expect(photoFinishMargin(10, 10.1)).toBeCloseTo(0.1);
    expect(photoFinishMargin(10, 10.11)).toBeNull();
    expect(photoFinishMargin(null, 10)).toBeNull();
  });

  it("gives a loss tip based on the measured launch rpm and car ideal", () => {
    expect(
      raceLossTip({
        launchRpm: 3500,
        idealLaunchRpm: 4200,
        reactionS: 0.2,
        sixtyFtS: 1.9,
        rivalSixtyFtS: 1.8,
      }),
    ).toContain("Try holding 4,200 rpm before green.");
  });
});
