import { create } from "zustand";
import {
  buyPart,
  deserialize,
  installPart,
  newGame,
  recordDynoRun,
  sellPart,
  serialize,
  setTune,
  submitChallenge,
  type GameState,
  type SubmitOutcome,
} from "./sim/economy";
import { simulate } from "./sim/engine";
import type { SimResult, SlotId, Tune } from "./sim/types";

export type Tab = "workshop" | "dyno" | "career";
export type CameraView = "exterior" | "bay" | "dyno" | SlotId;

const SAVE_KEY = "automech.save.v1";

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
  load: () => void;
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
    load: () => {
      let raw: string | null = null;
      try {
        raw = window.localStorage.getItem(SAVE_KEY);
      } catch {
        raw = null;
      }
      const game = deserialize(raw);
      const lastResult = game.lastRunKey ? simulate(game.build, game.tune) : null;
      set({ game, loaded: true, lastResult });
    },
    resetSave: () => {
      const game = newGame();
      commit(game);
      set({ baseline: null, lastResult: null, tab: "workshop", view: "exterior", hoodOpen: false });
    },
    setTab: (tab) => {
      const view: CameraView = tab === "dyno" ? "dyno" : tab === "workshop" ? get().view === "dyno" ? "bay" : get().view : "exterior";
      set({ tab, view, hoodOpen: view !== "exterior" ? true : get().hoodOpen });
    },
    selectSlot: (selectedSlot, focus = true) =>
      set(focus ? { selectedSlot, view: selectedSlot, hoodOpen: true, tab: "workshop" } : { selectedSlot }),
    setView: (view) => set({ view, hoodOpen: view === "exterior" ? get().hoodOpen : true }),
    setHoodOpen: (hoodOpen) => set({ hoodOpen }),
    setHovered: (hoveredSlot) => set({ hoveredSlot }),
    buy: (id) => commit(buyPart(get().game, id)),
    sell: (id) => commit(sellPart(get().game, id)),
    install: (id) => commit(installPart(get().game, id)),
    updateTune: (t) => commit(setTune(get().game, t)),
    completeDynoRun: () => {
      const { game, lastResult } = get();
      const result = simulate(game.build, game.tune);
      commit(recordDynoRun(game));
      set({ baseline: lastResult, lastResult: result });
    },
    submit: (challengeId) => {
      const out = submitChallenge(get().game, challengeId);
      if (out.state !== get().game) commit(out.state);
      return out;
    },
  };
});
