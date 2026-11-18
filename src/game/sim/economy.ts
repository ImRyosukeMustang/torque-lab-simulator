// Credits economy and the save-game shape. Pure: every action returns a new state.
import { z } from "zod";
import { CHALLENGES, evaluateChallenge, rewardFor, type Evaluation, type Grade, GRADE_RANK } from "./challenges";
import { simulate } from "./engine";
import { DEFAULT_COSMETICS, type Cosmetics } from "./cosmetics";
import { clampTune, findPart, getPart, PARTS, SLOT_ORDER, STOCK_BUILD, STOCK_TUNE } from "./parts";
import type { Build, Tune } from "./types";

export const STARTING_CREDITS = 3000;
export const SELL_RATE = 0.6;
export const SAVE_VERSION = 3;

export interface GameState {
  version: number;
  credits: number;
  owned: string[];
  build: Build;
  tune: Tune;
  progress: Record<string, Grade>;
  /** Key of the build+tune last measured on the dyno; challenges grade that run. */
  lastRunKey: string | null;
  runCount: number;
  cosmetics: Cosmetics;
}

export function newGame(): GameState {
  return {
    version: SAVE_VERSION,
    credits: STARTING_CREDITS,
    owned: PARTS.filter((p) => p.price === 0).map((p) => p.id),
    build: { ...STOCK_BUILD },
    tune: { ...STOCK_TUNE },
    progress: {},
    lastRunKey: null,
    runCount: 0,
    cosmetics: { ...DEFAULT_COSMETICS },
  };
}

export function setCosmetics(state: GameState, c: Partial<Cosmetics>): GameState {
  return { ...state, cosmetics: { ...state.cosmetics, ...c } };
}

export function configKey(build: Build, tune: Tune): string {
  const t = clampTune(build, tune);
  return [...SLOT_ORDER.map((s) => build[s]), t.boostTarget.toFixed(2), t.lambdaTarget.toFixed(2), t.timingOffset, t.revLimit].join("|");
}

export type PurchaseBlock = "owned" | "locked" | "credits" | null;

export function purchaseBlock(state: GameState, partId: string): PurchaseBlock {
  const part = findPart(partId);
  if (!part) return "locked";
  if (state.owned.includes(partId)) return "owned";
  if (part.unlockAfter && !state.progress[part.unlockAfter]) return "locked";
  if (state.credits < part.price) return "credits";
  return null;
}

export function buyPart(state: GameState, partId: string): GameState {
  if (purchaseBlock(state, partId) !== null) return state;
  const part = findPart(partId)!;
  return { ...state, credits: state.credits - part.price, owned: [...state.owned, partId] };
}

export function sellPart(state: GameState, partId: string): GameState {
  const part = findPart(partId);
  if (!part || part.price === 0 || !state.owned.includes(partId)) return state;
  if (state.build[part.slot] === partId) return state;
  return {
    ...state,
    credits: state.credits + Math.round(part.price * SELL_RATE),
    owned: state.owned.filter((id) => id !== partId),
  };
}

export function installPart(state: GameState, partId: string): GameState {
  const part = findPart(partId);
  if (!part || !state.owned.includes(partId)) return state;
  const build = { ...state.build, [part.slot]: partId };
  return { ...state, build, tune: clampTune(build, state.tune) };
}

export function setTune(state: GameState, tune: Partial<Tune>): GameState {
  return { ...state, tune: clampTune(state.build, { ...state.tune, ...tune }) };
}

export function recordDynoRun(state: GameState): GameState {
  return { ...state, lastRunKey: configKey(state.build, state.tune), runCount: state.runCount + 1 };
}

export interface SubmitOutcome {
  state: GameState;
  evaluation: Evaluation | null;
  reward: number;
  /** Why a submission was refused before grading. */
  refused?: "no-run" | "stale-run" | "locked";
}

export function submitChallenge(state: GameState, challengeId: string): SubmitOutcome {
  const ch = CHALLENGES.find((c) => c.id === challengeId);
  if (!ch) return { state, evaluation: null, reward: 0, refused: "locked" };
  const idx = CHALLENGES.indexOf(ch);
  const prevCh = CHALLENGES[idx - 1];
  if (idx > 0 && prevCh && !state.progress[prevCh.id]) return { state, evaluation: null, reward: 0, refused: "locked" };
  if (!state.lastRunKey) return { state, evaluation: null, reward: 0, refused: "no-run" };
  if (state.lastRunKey !== configKey(state.build, state.tune)) return { state, evaluation: null, reward: 0, refused: "stale-run" };
  const evaluation = evaluateChallenge(ch, state.build, simulate(state.build, state.tune));
  if (!evaluation.grade) return { state, evaluation, reward: 0 };
  const prev = state.progress[ch.id] ?? null;
  const reward = rewardFor(ch, evaluation.grade, prev);
  const best = prev && GRADE_RANK[prev] >= GRADE_RANK[evaluation.grade] ? prev : evaluation.grade;
  return {
    state: { ...state, credits: state.credits + reward, progress: { ...state.progress, [ch.id]: best } },
    evaluation,
    reward,
  };
}

const gradeSchema = z.enum(["bronze", "silver", "gold"]);
const hex = z.string().regex(/^#[0-9a-f]{6}$/i);
const cosmeticsSchema = z.object({
  paint: hex,
  finish: z.enum(["gloss", "metallic", "pearl", "satin", "matte"]),
  rimStyle: z.enum(["five", "mesh", "dish", "turbine"]),
  rimColor: hex,
  caliper: hex,
  stripe: z.enum(["none", "twin", "center", "side"]),
  stripeColor: hex,
  tint: z.number().min(0).max(1),
});
// Accepts v1 saves (7 engine slots, no cosmetics) and v2 saves (AFR tune) and migrates them on load.
const tuneSchema = z.union([
  z.object({ boostTarget: z.number(), lambdaTarget: z.number(), timingOffset: z.number(), revLimit: z.number() }),
  // v1/v2 stored a gasoline-equivalent AFR target; lambda = AFR / 14.7.
  z
    .object({ boostTarget: z.number(), afrTarget: z.number(), timingOffset: z.number(), revLimit: z.number() })
    .transform(({ afrTarget, ...t }) => ({ ...t, lambdaTarget: Math.round((afrTarget / 14.7) * 100) / 100 })),
]);
const saveSchema = z.object({
  version: z.union([z.literal(1), z.literal(2), z.literal(SAVE_VERSION)]),
  credits: z.number().finite().min(0),
  owned: z.array(z.string()),
  build: z.record(z.string()),
  tune: tuneSchema,
  progress: z.record(gradeSchema),
  lastRunKey: z.string().nullable(),
  runCount: z.number().int().min(0),
  cosmetics: z.unknown().optional(),
});

export function serialize(state: GameState): string {
  return JSON.stringify(state);
}

/** Parse a save, falling back to a new game if it is missing, corrupt or references unknown parts. */
export function deserialize(raw: string | null): GameState {
  if (!raw) return newGame();
  try {
    const parsed = saveSchema.parse(JSON.parse(raw));
    const owned = Array.from(new Set([...newGame().owned, ...parsed.owned.filter((id) => findPart(id))]));
    const build = { ...STOCK_BUILD };
    for (const s of SLOT_ORDER) {
      const id = parsed.build[s];
      if (!id) continue; // slot added after this save was written
      try {
        getPart(s, id);
        if (owned.includes(id)) build[s] = id;
      } catch {
        /* keep stock part */
      }
    }
    const cos = cosmeticsSchema.safeParse(parsed.cosmetics);
    const tune = clampTune(build, parsed.tune);
    // A run key from an older save no longer matches the current key format.
    const lastRunKey = parsed.lastRunKey === configKey(build, tune) ? parsed.lastRunKey : null;
    return {
      version: SAVE_VERSION,
      credits: parsed.credits,
      owned,
      build,
      tune,
      progress: parsed.progress,
      lastRunKey,
      runCount: parsed.runCount,
      cosmetics: cos.success ? cos.data : { ...DEFAULT_COSMETICS },
    };
  } catch {
    return newGame();
  }
}
