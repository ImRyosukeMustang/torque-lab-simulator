import { create } from "zustand";
import {
  buyPart,
  deserialize,
  installPart,
  newGame,
  recordDynoRun,
  sellPart,
  serialize,
  setCosmetics,
  setTune,
  submitChallenge,
  type GameState,
  type SubmitOutcome,
} from "./sim/economy";
import { simulate } from "./sim/engine";
import { findPart } from "./sim/parts";
import { uiSound } from "./uiSound";
import type { Cosmetics } from "./sim/cosmetics";
import type { SimResult, SlotId, Tune } from "./sim/types";

export type Tab = "workshop" | "dyno" | "drivetrain" | "paint" | "career";
export type Quality = "high" | "medium" | "low";
export interface Settings {
  quality: Quality;
  sound: boolean;
  volume: number;
  /** Clicks and workshop sound effects. */
  uiSound: boolean;
}
export type CameraView = "exterior" | "bay" | "dyno" | "paint" | SlotId;

const SAVE_KEY = "automech.save.v1";
const SETTINGS_KEY = "automech.settings.v1";
const DEFAULT_SETTINGS: Settings = { quality: "high", sound: true, volume: 0.7, uiSound: true };

function loadSettings(): Settings {
  try {
    const raw = JSON.parse(window.localStorage.getItem(SETTINGS_KEY) ?? "null") as Partial<Settings> | null;
    if (!raw) return DEFAULT_SETTINGS;
    return {
      quality: raw.quality === "low" || raw.quality === "medium" || raw.quality === "high" ? raw.quality : DEFAULT_SETTINGS.quality,
      sound: typeof raw.sound === "boolean" ? raw.sound : DEFAULT_SETTINGS.sound,
      volume: typeof raw.volume === "number" && raw.volume >= 0 && raw.volume <= 1 ? raw.volume : DEFAULT_SETTINGS.volume,
      uiSound: typeof raw.uiSound === "boolean" ? raw.uiSound : DEFAULT_SETTINGS.uiSound,
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

interface Store {
  game: GameState;
  loaded: boolean;
  tab: Tab;
  selectedSlot: SlotId;
  view: CameraView;
  hoodOpen: boolean;
  hoveredSlot: SlotId | null;
  /** Result of the previous completed dyno run, for before/after comparison. */
  baseline: SimResult | null;
  lastResult: SimResult | null;
  settings: Settings;
  /** True while a dyno pull is running; the UI locks part changes. */
  dynoRunning: boolean;
  load: () => void;
  setSettings: (s: Partial<Settings>) => void;
  setDynoRunning: (r: boolean) => void;
  updateCosmetics: (c: Partial<Cosmetics>) => void;
  resetSave: () => void;
  setTab: (t: Tab) => void;
  selectSlot: (s: SlotId, focus?: boolean) => void;
  setView: (v: CameraView) => void;
  setHoodOpen: (o: boolean) => void;
  setHovered: (s: SlotId | null) => void;
  buy: (id: string) => void;
  sell: (id: string) => void;
  install: (id: string) => void;
  updateTune: (t: Partial<Tune>) => void;
  completeDynoRun: () => void;
  submit: (challengeId: string) => SubmitOutcome;
}

function persist(game: GameState) {
  try {
    window.localStorage.setItem(SAVE_KEY, serialize(game));
  } catch {
    /* storage unavailable: keep playing in memory */
  }
}

export const useGame = create<Store>((set, get) => {
  const commit = (game: GameState) => {
    set({ game });
    persist(game);
  };
  return {
    game: newGame(),
    loaded: false,
    tab: "workshop",
    selectedSlot: "intake",
    view: "exterior",
    hoodOpen: false,
    hoveredSlot: null,
    baseline: null,
    lastResult: null,
    settings: DEFAULT_SETTINGS,
    dynoRunning: false,
    setSettings: (partial) => {
      const settings = { ...get().settings, ...partial };
      set({ settings });
      uiSound.configure({ enabled: settings.sound && settings.uiSound, volume: settings.volume });
      try {
        window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
      } catch {
        /* ignore */
      }
    },
    setDynoRunning: (dynoRunning) => set({ dynoRunning }),
    updateCosmetics: (c) => {
      uiSound.spray();
      commit(setCosmetics(get().game, c));
    },
    load: () => {
      let raw: string | null = null;
      try {
        raw = window.localStorage.getItem(SAVE_KEY);
      } catch {
        raw = null;
      }
      const game = deserialize(raw);
      const lastResult = game.lastRunKey ? simulate(game.build, game.tune) : null;
      const settings = loadSettings();
      uiSound.configure({ enabled: settings.sound && settings.uiSound, volume: settings.volume });
      set({ game, loaded: true, lastResult, settings });
    },
    resetSave: () => {
      const game = newGame();
      commit(game);
      set({ baseline: null, lastResult: null, tab: "workshop", view: "exterior", hoodOpen: false, hoveredSlot: null });
    },
    setTab: (tab) => {
      if (get().dynoRunning && tab !== get().tab) return;
      if (tab === "paint") {
        set({ tab, view: "paint", hoodOpen: false });
        return;
      }
      const cur = get().view;
      const view: CameraView = tab === "dyno" ? "dyno" : tab === "drivetrain" ? "drivetrain" : tab === "workshop" ? (cur === "dyno" || cur === "drivetrain" ? "bay" : cur) : "exterior";
      set({ tab, view, hoodOpen: view !== "exterior" ? true : get().hoodOpen });
    },
    selectSlot: (selectedSlot, focus = true) => {
      if (get().dynoRunning) return;
      set(focus ? { selectedSlot, view: selectedSlot, hoodOpen: true, tab: "workshop" } : { selectedSlot });
    },
    setView: (view) => set({ view, hoodOpen: view === "exterior" ? get().hoodOpen : view === "paint" ? false : true }),
    setHoodOpen: (hoodOpen) => {
      if (hoodOpen !== get().hoodOpen) uiSound.hood(hoodOpen);
      set({ hoodOpen });
    },
    setHovered: (hoveredSlot) => set({ hoveredSlot }),
    buy: (id) => {
      const next = buyPart(get().game, id);
      if (next === get().game) return uiSound.deny();
      uiSound.buy();
      commit(next);
    },
    sell: (id) => {
      const next = sellPart(get().game, id);
      if (next === get().game) return uiSound.deny();
      uiSound.sell();
      commit(next);
    },
    install: (id) => {
      if (get().dynoRunning) return uiSound.deny();
      const next = installPart(get().game, id);
      const part = findPart(id);
      if (next === get().game || !part) return uiSound.deny();
      uiSound.install(part.slot);
      commit(next);
    },
    updateTune: (t) => {
      if (get().dynoRunning) return;
      commit(setTune(get().game, t));
    },
    completeDynoRun: () => {
      const { game, lastResult } = get();
      const result = simulate(game.build, game.tune);
      commit(recordDynoRun(game));
      set({ baseline: lastResult, lastResult: result });
    },
    submit: (challengeId) => {
      const out = submitChallenge(get().game, challengeId);
      if (out.evaluation?.grade) uiSound.gradeAward(out.evaluation.grade);
      else uiSound.deny();
      if (out.state !== get().game) commit(out.state);
      return out;
    },
  };
});
