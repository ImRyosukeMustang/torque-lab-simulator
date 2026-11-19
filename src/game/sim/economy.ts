// Credits economy and the save-game shape. Pure: every action returns a new state.
import { z } from "zod";
import { CHALLENGES, evaluateChallenge, rewardFor, type Evaluation, type Grade, GRADE_RANK } from "./challenges";
import { simulate } from "./engine";
import { DEFAULT_COSMETICS, type Cosmetics } from "./cosmetics";
import { clampTune, findPart, getPart, PARTS, SLOT_ORDER, STOCK_BUILD, STOCK_TUNE } from "./parts";
import type { Build, Tune } from "./types";

export const STARTING_CREDITS = 3000;
export const SELL_RATE = 0.6;
export const SAVE_VERSION = 4;

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
  /** Contracts whose client style bonus has already been paid. */
  styleBonusPaid: string[];
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
    styleBonusPaid: [],
  };
}

export function setCosmetics(state: GameState, c: Partial<Cosmetics>): GameState {
  return { ...state, cosmetics: { ...state.cosmetics, ...c } };
}

export function configKey(build: Build, tune: Tune): string {
  const t = clampTune(build, tune);
  return [...SLOT_ORDER.map((s) => build[s]), t.boostTarget.toFixed(2), t.lambdaTarget.toFixed(2), t.timingOffset, t.revLimit, t.gearRatios.map((r) => r.toFixed(2)).join(","), t.finalDrive.toFixed(2)].join("|");
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
  let tune = state.tune;
  // A new gearbox or differential arrives with its own ratios.
  if (part.slot === "gearbox") tune = { ...tune, gearRatios: [...part.ratios] };
  if (part.slot === "differential") tune = { ...tune, finalDrive: part.finalDrive };
  return { ...state, build, tune: clampTune(build, tune) };
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
  /** Extra credits paid for matching the client's style brief (first time only). */
  styleBonus: number;
  /** Why a submission was refused before grading. */
  refused?: "no-run" | "stale-run" | "locked";
}

export function submitChallenge(state: GameState, challengeId: string): SubmitOutcome {
  const refuse = (refused: SubmitOutcome["refused"]): SubmitOutcome => ({ state, evaluation: null, reward: 0, styleBonus: 0, ...(refused ? { refused } : {}) });
  const ch = CHALLENGES.find((c) => c.id === challengeId);
  if (!ch) return refuse("locked");
  const idx = CHALLENGES.indexOf(ch);
  const prevCh = CHALLENGES[idx - 1];
  if (idx > 0 && prevCh && !state.progress[prevCh.id]) return refuse("locked");
  if (!state.lastRunKey) return refuse("no-run");
  if (state.lastRunKey !== configKey(state.build, state.tune)) return refuse("stale-run");
  const evaluation = evaluateChallenge(ch, state.build, simulate(state.build, state.tune), state.cosmetics);
  if (!evaluation.grade) return { state, evaluation, reward: 0, styleBonus: 0 };
  const prev = state.progress[ch.id] ?? null;
  const reward = rewardFor(ch, evaluation.grade, prev);
  const best = prev && GRADE_RANK[prev] >= GRADE_RANK[evaluation.grade] ? prev : evaluation.grade;
  const payStyle = Boolean(ch.style && evaluation.stylePassed && !state.styleBonusPaid.includes(ch.id));
  const styleBonus = payStyle && ch.style ? ch.style.bonus : 0;
  return {
    state: {
      ...state,
      credits: state.credits + reward + styleBonus,
      progress: { ...state.progress, [ch.id]: best },
      styleBonusPaid: payStyle ? [...state.styleBonusPaid, ch.id] : state.styleBonusPaid,
    },
    evaluation,
    reward,
    styleBonus,
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
// v4 added gear ratios and final drive; older tunes get the fitted gearbox's defaults on load.
const gearFields = { gearRatios: z.array(z.number()).optional(), finalDrive: z.number().optional() };
const tuneSchema = z.union([
  z.object({ boostTarget: z.number(), lambdaTarget: z.number(), timingOffset: z.number(), revLimit: z.number(), ...gearFields }),
  // v1/v2 stored a gasoline-equivalent AFR target; lambda = AFR / 14.7.
  z
    .object({ boostTarget: z.number(), afrTarget: z.number(), timingOffset: z.number(), revLimit: z.number(), ...gearFields })
    .transform(({ afrTarget, ...t }) => ({ ...t, lambdaTarget: Math.round((afrTarget / 14.7) * 100) / 100 })),
]);
const saveSchema = z.object({
  version: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(SAVE_VERSION)]),
  credits: z.number().finite().min(0),
  owned: z.array(z.string()),
  build: z.record(z.string()),
  tune: tuneSchema,
  progress: z.record(gradeSchema),
  lastRunKey: z.string().nullable(),
  runCount: z.number().int().min(0),
  cosmetics: z.unknown().optional(),
  styleBonusPaid: z.array(z.string()).optional(),
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
    const box = getPart("gearbox", build.gearbox);
    const diff = getPart("differential", build.differential);
    const tune = clampTune(build, {
      ...parsed.tune,
      gearRatios: parsed.tune.gearRatios ?? [...box.ratios],
      finalDrive: parsed.tune.finalDrive ?? diff.finalDrive,
    });
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
      styleBonusPaid: (parsed.styleBonusPaid ?? []).filter((id) => CHALLENGES.some((c) => c.id === id)),
    };
  } catch {
    return newGame();
  }
}
