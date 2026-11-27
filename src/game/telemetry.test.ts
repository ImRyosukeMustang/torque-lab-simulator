import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@vercel/analytics", () => ({ track: vi.fn() }));

import { track } from "@vercel/analytics";
import { buyPart, installPart, newGame, setTune } from "./sim/economy";
import { STOCK_TUNE } from "./sim/parts";
import {
  currentTutorialStep,
  trackGameLoaded,
  trackRaceFinished,
  trackRaceStarted,
  trackSessionLength,
  trackTutorialAbandoned,
} from "./telemetry";

const mockTrack = vi.mocked(track);

describe("game telemetry", () => {
  beforeEach(() => mockTrack.mockClear());

  it("reports the current unfinished intro step and skips completed tutorials", () => {
    const fresh = newGame();
    expect(currentTutorialStep(fresh)).toBe("install_turbo");

    const turboFitted = setTune(installPart(buyPart(fresh, "turbo-t25"), "turbo-t25"), {
      boostTarget: 0.3,
    });
    expect(currentTutorialStep(turboFitted)).toBe("set_boost");

    const boosted = setTune(turboFitted, { boostTarget: 0.5 });
    expect(currentTutorialStep(boosted)).toBe("beat_kai");
    expect(currentTutorialStep({ ...boosted, tutorial: "done" })).toBeNull();
  });

  it("tracks tutorial abandonment and foreground session duration", () => {
    const game = setTune(installPart(buyPart(newGame(), "turbo-t25"), "turbo-t25"), {
      boostTarget: 0.5,
    });
    trackTutorialAbandoned(game, "skipped");
    trackSessionLength({ game, durationMs: 11650 });

    expect(mockTrack).toHaveBeenNthCalledWith(1, "tutorial_step_abandoned", {
      step: "beat_kai",
      reason: "skipped",
    });
    expect(mockTrack).toHaveBeenNthCalledWith(2, "session_length", { duration_seconds: 11.7 });
    expect(mockTrack).toHaveBeenNthCalledWith(3, "tutorial_step_abandoned", {
      step: "beat_kai",
      reason: "session_end",
    });
  });

  it("does not report tutorial abandonment after completion", () => {
    trackTutorialAbandoned({ ...newGame(), tutorial: "done" }, "session_end");
    expect(mockTrack).not.toHaveBeenCalled();
  });

  it("reports load milestones and race outcomes with bounded gameplay details", () => {
    const config = { eventId: "r1", rivalId: "kai", distance: "quarter" } as const;
    trackGameLoaded({
      startupMs: 1200,
      sceneReadyMs: 2400,
      firstContentfulPaintMs: 800,
      platform: "browser",
      quality: "low",
      deviceMemoryGb: 2,
      cpuCores: 2,
    });
    trackRaceStarted(config);
    trackRaceFinished({
      config,
      won: false,
      foul: false,
      dnf: false,
      activeSeconds: 6.28,
    });

    expect(mockTrack).toHaveBeenNthCalledWith(1, "game_loaded", {
      startup_ms: 1200,
      scene_ready_ms: 2400,
      first_contentful_paint_ms: 800,
      platform: "browser",
      quality: "low",
      device_memory_gb: 2,
      cpu_cores: 2,
    });
    expect(mockTrack).toHaveBeenNthCalledWith(2, "race_started", {
      event: "r1",
      rival: "kai",
      distance: "quarter",
    });
    expect(mockTrack).toHaveBeenNthCalledWith(3, "race_finished", {
      event: "r1",
      rival: "kai",
      distance: "quarter",
      won: false,
      foul: false,
      dnf: false,
      active_seconds: 6.3,
    });
  });
});
