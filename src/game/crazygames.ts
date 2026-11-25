// CrazyGames SDK v3 wrapper. Loads lazily in the browser; every call is a no-op outside the portal,
// so the game runs the same on any host. Docs: https://docs.crazygames.com/sdk/
type Env = "crazygames" | "local" | "disabled" | "unavailable";
interface CgSdk {
  init: () => Promise<void>;
  environment: Env;
  ad: { requestAd: (type: "rewarded" | "midgame", cb: { adStarted?: () => void; adFinished?: () => void; adError?: (e: unknown) => void }) => void };
  game: { gameplayStart: () => void; gameplayStop: () => void; happytime: () => void; loadingStart?: () => void; loadingStop?: () => void };
  data?: { getItem: (k: string) => string | null; setItem: (k: string, v: string) => void };
}
declare global {
  interface Window {
    CrazyGames?: { SDK: CgSdk };
  }
}

const SDK_URL = "https://sdk.crazygames.com/crazygames-sdk-v3.js";
let initPromise: Promise<Env> | null = null;
let env: Env = "unavailable";
let playing = false;

function sdk(): CgSdk | null {
  return typeof window !== "undefined" && window.CrazyGames?.SDK ? window.CrazyGames.SDK : null;
}

export function initCrazyGames(): Promise<Env> {
  if (initPromise) return initPromise;
  initPromise = new Promise<Env>((resolve) => {
    if (typeof document === "undefined") return resolve("unavailable");
    const done = async () => {
      const s = sdk();
      if (!s) return resolve("unavailable");
      try {
        await s.init();
        env = s.environment;
      } catch {
        env = "disabled";
      }
      resolve(env);
    };
    if (sdk()) return void done();
    const tag = document.createElement("script");
    tag.src = SDK_URL;
    tag.async = true;
    tag.onload = () => void done();
    tag.onerror = () => resolve("unavailable");
    // Never block the game on the portal script.
    window.setTimeout(() => resolve(env), 6000);
    document.head.appendChild(tag);
  });
  return initPromise;
}

/** True when real CrazyGames ads can play (on the portal, or its local test mode). */
export function adsAvailable(): boolean {
  return env === "crazygames" || env === "local";
}

export function onPortal(): boolean {
  return env === "crazygames";
}

export function gameplayStart(): void {
  if (playing) return;
  playing = true;
  try {
    sdk()?.game.gameplayStart();
  } catch {
    /* outside the portal */
  }
}
export function gameplayStop(): void {
  if (!playing) return;
  playing = false;
  try {
    sdk()?.game.gameplayStop();
  } catch {
    /* outside the portal */
  }
}
export function happytime(): void {
  try {
    sdk()?.game.happytime();
  } catch {
    /* outside the portal */
  }
}
export function loadingStop(): void {
  try {
    sdk()?.game.loadingStop?.();
  } catch {
    /* outside the portal */
  }
}

/** Play a rewarded ad. Resolves "ok" only when the ad finished, so the reward is earned. */
export function showRewardedAd(): Promise<"ok" | "error" | "unavailable"> {
  const s = sdk();
  if (!s || !adsAvailable()) return Promise.resolve("unavailable");
  return new Promise((resolve) => {
    const wasPlaying = playing;
    gameplayStop();
    const end = (r: "ok" | "error") => {
      if (wasPlaying) gameplayStart();
      resolve(r);
    };
    try {
      s.ad.requestAd("rewarded", { adFinished: () => end("ok"), adError: () => end("error") });
    } catch {
      end("error");
    }
  });
}

/** Cloud-synced storage on the portal (falls back to the caller's localStorage elsewhere). */
export function portalStorage(): { getItem: (k: string) => string | null; setItem: (k: string, v: string) => void } | null {
  const s = sdk();
  return s && env === "crazygames" && s.data ? s.data : null;
}
