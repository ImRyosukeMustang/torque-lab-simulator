import { describe, expect, it } from "vitest";
import { engineSamplePlaybackRate } from "./audio";
import { findEngineLoopRegion } from "./audioSamples";

describe("engine sample RPM tracking", () => {
  it("keeps idle playback proportional to engine RPM", () => {
    expect(engineSamplePlaybackRate(850, 5500)).toBeCloseTo(850 / 5500);
  });

  it("continues to rise with the rev counter across the operating range", () => {
    const atBase = engineSamplePlaybackRate(5500, 5500);
    const aboveBase = engineSamplePlaybackRate(9000, 5500);

    expect(atBase).toBe(1);
    expect(aboveBase).toBeCloseTo(9000 / 5500);
    expect(aboveBase).toBeGreaterThan(atBase);
  });

  it.each([4, 6, 8])("finds the %s-cylinder firing RPM in a bounded loop window", (cylinders) => {
    const sampleRate = 8000;
    const sourceRpm = 4800;
    const firingHz = (sourceRpm * cylinders) / 120;
    const samples = Float32Array.from({ length: sampleRate }, (_, i) => Math.sin((i / sampleRate) * firingHz * Math.PI * 2));
    const region = findEngineLoopRegion([samples], sampleRate, cylinders, 5500);

    expect(region.sourceRpm).toBeCloseTo(sourceRpm, -2);
    expect(region.endFrame - region.startFrame).toBeGreaterThanOrEqual(1024);
    expect(region.endFrame).toBeLessThanOrEqual(samples.length);
  });
});
