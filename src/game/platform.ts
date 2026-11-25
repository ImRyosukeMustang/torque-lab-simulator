import { setMasterMuted } from "./audioCore";
import {
  adsAvailable,
  happytime as crazyGamesHappytime,
  gameplayStart as crazyGamesGameplayStart,
  gameplayStop as crazyGamesGameplayStop,
  initCrazyGames,
  loadingStop,
  portalStorage,
  showRewardedAd,
} from "./crazygames";

export type PlatformId = "browser" | "crazygames" | "poki" | "playgama";

type LifecycleEvent = "pause" | "resume";
type Listener = (event: LifecycleEvent) => void;

export interface GamePlatform {
  id: PlatformId;
  initialize: () => Promise<void>;
  ready: () => Promise<void>;
  gameplayStart: () => void;
  gameplayStop: () => void;
  happytime: () => void;
  canShowRewarded: () => boolean;
  showRewarded: () => Promise<boolean>;
  load: (key: string) => Promise<string | null>;
  save: (key: string, value: string) => Promise<void>;
  subscribe: (listener: Listener) => () => void;
}

interface PokiSdk {
  init: () => Promise<void>;
  gameLoadingFinished: () => void;
  gameplayStart: () => void;
  gameplayStop: () => void;
  rewardedBreak: () => Promise<boolean>;
}

interface PlaygamaBridge {
  initialize: () => Promise<void>;
  on: (event: string, listener: (state: string) => void) => void;
  off: (event: string, listener: (state: string) => void) => void;
  platform: {
    sendMessage: (message: string) => void | Promise<void>;
  };
  advertisement: {
    isRewardedSupported: boolean;
    showRewarded: () => void;
  };
  storage: {
    get: (keys: string[]) => Promise<(string | null)[]>;
    set: (keys: string[], values: string[]) => Promise<void>;
  };
}

declare global {
  interface Window {
    PokiSDK?: PokiSdk;
    bridge?: PlaygamaBridge;
  }
}

const memoryStorage = new Map<string, string>();
let warnedStorageUnavailable = false;

function warnStorageUnavailable() {
  if (warnedStorageUnavailable) return;
  warnedStorageUnavailable = true;
  console.warn("Browser storage is unavailable; progress will only last for this session.");
}

function localLoad(key: string): string | null {
  try {
    return window.localStorage.getItem(key) ?? memoryStorage.get(key) ?? null;
  } catch {
    warnStorageUnavailable();
    return memoryStorage.get(key) ?? null;
  }
}

function localSave(key: string, value: string): void {
  memoryStorage.set(key, value);
  try {
    window.localStorage.setItem(key, value);
  } catch {
    warnStorageUnavailable();
  }
}

interface PlatformAdapter {
  initialize: () => Promise<void>;
  ready: () => Promise<void>;
  start: () => void;
  stop: () => void;
  happytime: () => void;
  canShowRewarded: () => boolean;
  rewarded: () => Promise<boolean>;
  load: (key: string) => Promise<string | null>;
  save: (key: string, value: string) => Promise<void>;
}

function createPlatform(id: PlatformId, adapter: PlatformAdapter): GamePlatform {
  const listeners = new Set<Listener>();
  let gameplayActive = false;
  let interruptionPaused = false;
  let rewardedActive = false;
  let initialized: Promise<void> | null = null;
  let initializationSucceeded = false;
  let readySent = false;

  const onVisibilityChange = () => {
    interruptionPaused = document.hidden;
    setMasterMuted(interruptionPaused || rewardedActive);
    const event: LifecycleEvent = interruptionPaused ? "pause" : "resume";
    listeners.forEach((listener) => listener(event));
  };
  const initialize = () => {
    if (!initialized) {
      initialized = adapter.initialize().then(() => {
        initializationSucceeded = true;
      });
      document.addEventListener("visibilitychange", onVisibilityChange);
    }
    return initialized;
  };

  const start = () => {
    if (gameplayActive) return;
    adapter.start();
    gameplayActive = true;
  };

  const stop = () => {
    if (!gameplayActive) return;
    gameplayActive = false;
    adapter.stop();
  };

  return {
    id,
    initialize,
    ready: async () => {
      if (!initialized)
        throw new Error(`${id} platform must be initialized before it is marked ready.`);
      await initialized;
      if (readySent) return;
      await adapter.ready();
      readySent = true;
    },
    gameplayStart: start,
    gameplayStop: stop,
    happytime: adapter.happytime,
    canShowRewarded: () => initializationSucceeded && !rewardedActive && adapter.canShowRewarded(),
    showRewarded: async () => {
      if (!initializationSucceeded || rewardedActive || !adapter.canShowRewarded()) return false;
      const resumeGameplay = gameplayActive;
      stop();
      rewardedActive = true;
      setMasterMuted(true);
      try {
        return await adapter.rewarded();
      } finally {
        rewardedActive = false;
        setMasterMuted(interruptionPaused);
        if (resumeGameplay && !document.hidden) start();
      }
    },
    load: async (key) => {
      await initialize();
      return adapter.load(key);
    },
    save: async (key, value) => {
      localSave(key, value);
      await initialize();
      await adapter.save(key, value);
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

export function createBrowserPlatform(): GamePlatform {
  return createPlatform("browser", {
    initialize: async () => undefined,
    ready: async () => undefined,
    start: () => undefined,
    stop: () => undefined,
    happytime: () => undefined,
    canShowRewarded: () => false,
    rewarded: async () => false,
    load: async (key) => localLoad(key),
    save: async () => undefined,
  });
}

const crazyGamesAdapter: PlatformAdapter = {
  initialize: async () => {
    await initCrazyGames();
  },
  ready: async () => loadingStop(),
  start: crazyGamesGameplayStart,
  stop: crazyGamesGameplayStop,
  happytime: crazyGamesHappytime,
  canShowRewarded: adsAvailable,
  rewarded: async () => (await showRewardedAd()) === "ok",
  load: async (key) => {
    try {
      return portalStorage()?.getItem(key) ?? localLoad(key);
    } catch (error) {
      console.error("CrazyGames cloud save load failed; using browser storage:", error);
      return localLoad(key);
    }
  },
  save: async (key, value) => portalStorage()?.setItem(key, value),
};

export function createCrazyGamesPlatform(): GamePlatform {
  return createPlatform("crazygames", crazyGamesAdapter);
}

export function createPokiPlatform(source: PokiSdk | (() => PokiSdk)): GamePlatform {
  const sdk = typeof source === "function" ? source : () => source;
  return createPlatform("poki", {
    initialize: () => sdk().init(),
    ready: async () => sdk().gameLoadingFinished(),
    start: () => sdk().gameplayStart(),
    stop: () => sdk().gameplayStop(),
    happytime: () => undefined,
    canShowRewarded: () => true,
    rewarded: () => sdk().rewardedBreak(),
    load: async (key) => localLoad(key),
    save: async () => undefined,
  });
}

export function createPlaygamaPlatform(
  source: PlaygamaBridge | (() => PlaygamaBridge),
): GamePlatform {
  const bridge = typeof source === "function" ? source : () => source;
  let saveQueue = Promise.resolve();
  const sendMessage = (message: string) => {
    try {
      void Promise.resolve(bridge().platform.sendMessage(message)).catch((error: unknown) =>
        console.error(`Playgama ${message} message failed:`, error),
      );
    } catch (error) {
      console.error(`Playgama ${message} message failed:`, error);
    }
  };
  return createPlatform("playgama", {
    initialize: () => bridge().initialize(),
    ready: async () => sendMessage("game_ready"),
    start: () => sendMessage("gameplay_started"),
    stop: () => sendMessage("gameplay_stopped"),
    happytime: () => undefined,
    canShowRewarded: () => {
      try {
        return bridge().advertisement.isRewardedSupported;
      } catch {
        return false;
      }
    },
    rewarded: () =>
      new Promise<boolean>((resolve, reject) => {
        const sdk = bridge();
        const eventName = "rewarded_state_changed";
        const onState = (state: string) => {
          if (state !== "rewarded" && state !== "closed" && state !== "failed") return;
          sdk.off(eventName, onState);
          resolve(state === "rewarded");
        };
        sdk.on(eventName, onState);
        try {
          sdk.advertisement.showRewarded();
        } catch (error) {
          sdk.off(eventName, onState);
          reject(error);
        }
      }),
    load: async (key) => {
      try {
        const [value] = await bridge().storage.get([key]);
        return value ?? localLoad(key);
      } catch (error) {
        console.error("Playgama cloud save load failed; using browser storage:", error);
        return localLoad(key);
      }
    },
    save: async (key, value) => {
      const nextSave = saveQueue.then(() => bridge().storage.set([key], [value]));
      saveQueue = nextSave.catch(() => undefined);
      await nextSave;
    },
  });
}

let platformInstance: GamePlatform | null = null;

function configuredPlatform(): PlatformId | null {
  const mode = import.meta.env.MODE;
  const configured =
    import.meta.env["VITE_GAME_PLATFORM"] ??
    (mode === "browser" || mode === "crazygames" || mode === "poki" || mode === "playgama"
      ? mode
      : undefined);
  return configured === "browser" ||
    configured === "crazygames" ||
    configured === "poki" ||
    configured === "playgama"
    ? configured
    : null;
}

function requiredSdk<T>(value: T | undefined, platform: PlatformId): T {
  if (!value) {
    throw new Error(
      `${platform} SDK is unavailable. Use the platform's hosted build or select browser mode.`,
    );
  }
  return value;
}

export function getGamePlatform(): GamePlatform {
  if (platformInstance) return platformInstance;
  const configured = configuredPlatform();
  if (configured === "browser") return (platformInstance = createBrowserPlatform());
  if (configured === "crazygames") return (platformInstance = createCrazyGamesPlatform());
  if (configured === "poki")
    return (platformInstance = createPokiPlatform(() => requiredSdk(window.PokiSDK, "poki")));
  if (configured === "playgama")
    return (platformInstance = createPlaygamaPlatform(() =>
      requiredSdk(window.bridge, "playgama"),
    ));
  if (window.CrazyGames?.SDK) return (platformInstance = createCrazyGamesPlatform());
  if (window.PokiSDK)
    return (platformInstance = createPokiPlatform(() => requiredSdk(window.PokiSDK, "poki")));
  if (window.bridge)
    return (platformInstance = createPlaygamaPlatform(() =>
      requiredSdk(window.bridge, "playgama"),
    ));
  return (platformInstance = createBrowserPlatform());
}
