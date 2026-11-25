import { afterEach, describe, expect, it, vi } from "vitest";
import { createBrowserPlatform, createPokiPlatform, createPlaygamaPlatform } from "./platform";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("platform adapters", () => {
  it("uses browser storage and never awards an offline rewarded ad", async () => {
    const platform = createBrowserPlatform();
    window.localStorage.clear();

    const saving = platform.save("save", "state");
    expect(window.localStorage.getItem("save")).toBe("state");
    await saving;

    await expect(platform.load("save")).resolves.toBe("state");
    await expect(platform.showRewarded()).resolves.toBe(false);
  });

  it("keeps progress available in-memory when browser storage is blocked", async () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("storage blocked");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("storage blocked");
    });
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const platform = createBrowserPlatform();

    await platform.save("blocked-save", "session-state");

    await expect(platform.load("blocked-save")).resolves.toBe("session-state");
  });

  it("initializes Poki once and restores gameplay after a rewarded break", async () => {
    const sdk = {
      init: vi.fn().mockResolvedValue(undefined),
      gameLoadingFinished: vi.fn(),
      gameplayStart: vi.fn(),
      gameplayStop: vi.fn(),
      rewardedBreak: vi.fn().mockResolvedValue(true),
    };
    const platform = createPokiPlatform(sdk);

    expect(platform.canShowRewarded()).toBe(false);
    await platform.initialize();
    await platform.initialize();
    expect(platform.canShowRewarded()).toBe(true);
    await platform.ready();
    await platform.ready();
    platform.gameplayStart();
    platform.gameplayStart();
    await expect(platform.showRewarded()).resolves.toBe(true);
    platform.gameplayStop();
    platform.gameplayStop();

    expect(sdk.init).toHaveBeenCalledTimes(1);
    expect(sdk.gameLoadingFinished).toHaveBeenCalledTimes(1);
    expect(sdk.gameplayStart).toHaveBeenCalledTimes(2);
    expect(sdk.gameplayStop).toHaveBeenCalledTimes(2);
    expect(sdk.rewardedBreak).toHaveBeenCalledTimes(1);
  });

  it("uses Playgama storage rather than browser storage", async () => {
    const values = new Map<string, string>();
    let rewardStateListener: ((state: string) => void) | undefined;
    let rewardState = "rewarded";
    const bridge = {
      initialize: vi.fn().mockResolvedValue(undefined),
      on: vi.fn((_event: string, listener: (state: string) => void) => {
        rewardStateListener = listener;
      }),
      off: vi.fn(),
      platform: { sendMessage: vi.fn().mockResolvedValue(undefined) },
      advertisement: {
        isRewardedSupported: true,
        showRewarded: vi.fn(() => rewardStateListener?.(rewardState)),
      },
      storage: {
        get: vi.fn(async (keys: string[]) => keys.map((key) => values.get(key) ?? null)),
        set: vi.fn(async (keys: string[], entries: string[]) => {
          if (entries[0] === "older-state") await new Promise((resolve) => setTimeout(resolve, 10));
          keys.forEach((key, index) => {
            const value = entries[index];
            if (value !== undefined) values.set(key, value);
          });
        }),
      },
    };
    const platform = createPlaygamaPlatform(bridge);
    await platform.initialize();
    await platform.ready();
    await Promise.all([
      platform.save("save", "older-state"),
      platform.save("save", "bridge-state"),
    ]);

    await expect(platform.load("save")).resolves.toBe("bridge-state");
    await expect(platform.showRewarded()).resolves.toBe(true);
    rewardState = "showing";
    const pendingReward = platform.showRewarded();
    await expect(platform.showRewarded()).resolves.toBe(false);
    rewardState = "rewarded";
    rewardStateListener?.(rewardState);
    await expect(pendingReward).resolves.toBe(true);
    rewardState = "closed";
    await expect(platform.showRewarded()).resolves.toBe(false);
    expect(bridge.platform.sendMessage).toHaveBeenCalledWith("game_ready");
  });

  it("does not offer or award unsupported Playgama rewarded ads", async () => {
    const bridge = {
      initialize: vi.fn().mockResolvedValue(undefined),
      on: vi.fn(),
      off: vi.fn(),
      platform: { sendMessage: vi.fn().mockResolvedValue(undefined) },
      advertisement: {
        isRewardedSupported: false,
        showRewarded: vi.fn(),
      },
      storage: {
        get: vi.fn().mockResolvedValue([null]),
        set: vi.fn().mockResolvedValue(undefined),
      },
    };
    const platform = createPlaygamaPlatform(bridge);
    await platform.initialize();
    await platform.ready();

    expect(platform.canShowRewarded()).toBe(false);
    await expect(platform.showRewarded()).resolves.toBe(false);
    expect(bridge.advertisement.showRewarded).not.toHaveBeenCalled();
  });
});
