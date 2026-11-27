import { track } from "@vercel/analytics";
import { getPart } from "./sim/parts";
import type { GameState } from "./sim/economy";
import type { RaceConfig } from "./store";

export type TutorialStep = "install_turbo" | "set_boost" | "beat_kai";

export function currentTutorialStep(game: GameState): TutorialStep | null {
  if (game.tutorial === "done") return null;
  if (getPart("turbo", game.build.turbo).maximumFlow === 0) return "install_turbo";
  if (game.tune.boostTarget < 0.4) return "set_boost";
  return "beat_kai";
}

export function trackTutorialAbandoned(game: GameState, reason: "skipped" | "session_end"): void {
  const step = currentTutorialStep(game);
  if (step) track("tutorial_step_abandoned", { step, reason });
}

export function trackGameLoaded(details: {
  startupMs: number;
  sceneReadyMs: number;
  firstContentfulPaintMs: number | null;
  platform: string;
  quality: string;
  deviceMemoryGb: number | null;
  cpuCores: number | null;
}): void {
  track("game_loaded", {
    startup_ms: details.startupMs,
    scene_ready_ms: details.sceneReadyMs,
    first_contentful_paint_ms: details.firstContentfulPaintMs,
    platform: details.platform,
    quality: details.quality,
    device_memory_gb: details.deviceMemoryGb,
    cpu_cores: details.cpuCores,
  });
}

export function trackRaceStarted(config: RaceConfig): void {
  track("race_started", {
    event: config.eventId ?? "free_run",
    rival: config.rivalId,
    distance: config.distance,
  });
}

export function trackRaceFinished(details: {
  config: RaceConfig;
  won: boolean;
  foul: boolean;
  dnf: boolean;
  activeSeconds: number;
}): void {
  track("race_finished", {
    event: details.config.eventId ?? "free_run",
    rival: details.config.rivalId,
    distance: details.config.distance,
    won: details.won,
    foul: details.foul,
    dnf: details.dnf,
    active_seconds: Math.round(details.activeSeconds * 10) / 10,
  });
}

export function trackSessionLength(details: { game: GameState; durationMs: number }): void {
  track("session_length", {
    duration_seconds: Math.round(Math.max(0, details.durationMs) / 100) / 10,
  });
  trackTutorialAbandoned(details.game, "session_end");
}
