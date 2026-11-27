// Credits economy and the save-game shape. Pure: every action returns a new state.
import { z } from "zod";
import { CHALLENGES, evaluateChallenge, isChallengeUnlocked, rewardFor, type Evaluation, type Grade, GRADE_RANK } from "./challenges";
import { isRaceUnlocked, purseFor, RACE_EVENTS } from "./race";
import { simulate } from "./engine";
import { DEFAULT_COSMETICS, type Cosmetics } from "./cosmetics";
import { clampTune, findPart, getPart, PARTS, partsForSlot, SLOT_ORDER, STOCK_BUILD, STOCK_TUNE } from "./parts";
import { RESEARCH_PROJECTS, researchProjectForPart } from "./research";
import type { Build, SlotId, Tune } from "./types";

export const STARTING_CREDITS = 3000;
export const SELL_RATE = 0.6;
export const SAVE_VERSION = 8;
/** Credits paid for watching a rewarded ad. */
export const AD_REWARD = 2500;

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
  /** Wins per drag race event. */
  raceWins: Record<string, number>;
  /** Best elapsed time from green (s) per race event or free-race key. */
  raceBest: Record<string, number>;
  researchPoints: number;
  researched: string[];
  /** New careers start with the Street Rival race; the full workshop opens after the first win. */
  tutorial: "street-rival" | "done";
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
    raceWins: {},
    raceBest: {},
    researchPoints: 0,
    researched: [],
    tutorial: "street-rival",
  };
}

export interface RaceOutcome {
  state: GameState;
  purse: number;
  firstWin: boolean;
  refused?: "locked";
}

/** Record a finished race. A win pays the event's purse the first time and a rematch share after that. */
export function recordRace(state: GameState, eventId: string, result: { won: boolean; totalS: number | null }): RaceOutcome {
  const ev = RACE_EVENTS.find((e) => e.id === eventId);
  if (!ev || !isRaceUnlocked(eventId, state.raceWins)) return { state, purse: 0, firstWin: false, refused: "locked" };
  const prevBest = state.raceBest[eventId];
  const raceBest = result.totalS !== null && (prevBest === undefined || result.totalS < prevBest) ? { ...state.raceBest, [eventId]: Math.round(result.totalS * 1000) / 1000 } : state.raceBest;
  if (!result.won) return { state: { ...state, raceBest }, purse: 0, firstWin: false };
  const wins = state.raceWins[eventId] ?? 0;
  const purse = purseFor(ev, wins);
  return {
    state: {
      ...state,
      credits: state.credits + purse,
      raceWins: { ...state.raceWins, [eventId]: wins + 1 },
      raceBest,
      tutorial: eventId === "r1" ? "done" : state.tutorial,
    },
    purse,
    firstWin: wins === 0,
  };
}

/** Best time for a free race (no purse). */
export function recordFreeRace(state: GameState, key: string, totalS: number | null): GameState {
  if (totalS === null) return state;
  const prev = state.raceBest[key];
  if (prev !== undefined && prev <= totalS) return state;
  return { ...state, raceBest: { ...state.raceBest, [key]: Math.round(totalS * 1000) / 1000 } };
}

/** Credits from a rewarded ad or a doubled purse. */
export function addCredits(state: GameState, amount: number): GameState {
  if (!Number.isFinite(amount) || amount <= 0) return state;
  return { ...state, credits: state.credits + Math.round(amount) };
}

export function finishTutorial(state: GameState): GameState {
  return state.tutorial === "done" ? state : { ...state, tutorial: "done" };
}

export function setCosmetics(state: GameState, c: Partial<Cosmetics>): GameState {
  return { ...state, cosmetics: { ...state.cosmetics, ...c } };
}

export function configKey(build: Build, tune: Tune): string {
  const t = clampTune(build, tune);
  return [...SLOT_ORDER.map((s) => build[s]), t.boostTarget.toFixed(2), t.lambdaTarget.toFixed(2), t.timingOffset, t.revLimit, t.gearRatios.map((r) => r.toFixed(2)).join(","), t.finalDrive.toFixed(2)].join("|");
}

export type PurchaseBlock = "owned" | "locked" | "research" | "credits" | null;

/** Parts stay out of the workshop catalogue until their career or research gate is cleared. */
export function visiblePartsForSlot(state: GameState, slot: SlotId) {
  return partsForSlot(slot).filter((part) => {
    if (part.unlockAfter && !state.progress[part.unlockAfter]) return false;
    const project = researchProjectForPart(part.id);
    return !project || Boolean(state.progress[project.requiredChallenge]);
  });
}

export function purchaseBlock(state: GameState, partId: string): PurchaseBlock {
  const part = findPart(partId);
  if (!part) return "locked";
  if (state.owned.includes(partId)) return "owned";
  if (part.unlockAfter && !state.progress[part.unlockAfter]) return "locked";
  const project = researchProjectForPart(partId);
  if (project && !state.researched.includes(project.id)) return "research";
  if (state.credits < part.price) return "credits";
  return null;
}

export type ResearchBlock = "unknown" | "researched" | "locked" | "points" | null;

export function researchProjectBlock(state: GameState, projectId: string): ResearchBlock {
  const project = RESEARCH_PROJECTS.find((entry) => entry.id === projectId);
  if (!project) return "unknown";
  if (state.researched.includes(projectId)) return "researched";
  if (!state.progress[project.requiredChallenge]) return "locked";
  if (state.researchPoints < project.cost) return "points";
  return null;
}

export function startResearch(state: GameState, projectId: string): GameState {
  if (researchProjectBlock(state, projectId) !== null) return state;
  const project = RESEARCH_PROJECTS.find((entry) => entry.id === projectId)!;
  return {
    ...state,
    researchPoints: state.researchPoints - project.cost,
    researched: [...state.researched, projectId],
  };
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
  researchPoints: number;
  /** Extra credits paid for matching the client's style brief (first time only). */
  styleBonus: number;
  /** Why a submission was refused before grading. */
  refused?: "no-run" | "stale-run" | "locked";
}

export function submitChallenge(state: GameState, challengeId: string): SubmitOutcome {
  const refuse = (refused: SubmitOutcome["refused"]): SubmitOutcome => ({ state, evaluation: null, reward: 0, researchPoints: 0, styleBonus: 0, ...(refused ? { refused } : {}) });
  const ch = CHALLENGES.find((c) => c.id === challengeId);
  if (!ch) return refuse("locked");
  // Same rule as the career screen: open once the previous contract is graded, and always open once graded.
  if (!isChallengeUnlocked(ch, state.progress)) return refuse("locked");
  if (!state.lastRunKey) return refuse("no-run");
  if (state.lastRunKey !== configKey(state.build, state.tune)) return refuse("stale-run");
  const evaluation = evaluateChallenge(ch, state.build, simulate(state.build, state.tune), state.cosmetics);
  if (!evaluation.grade) return { state, evaluation, reward: 0, researchPoints: 0, styleBonus: 0 };
  const prev = state.progress[ch.id] ?? null;
  const reward = rewardFor(ch, evaluation.grade, prev);
  const researchPoints = Math.max(0, GRADE_RANK[evaluation.grade] - (prev ? GRADE_RANK[prev] : 0));
  const best = prev && GRADE_RANK[prev] >= GRADE_RANK[evaluation.grade] ? prev : evaluation.grade;
  const payStyle = Boolean(ch.style && evaluation.stylePassed && !state.styleBonusPaid.includes(ch.id));
  const styleBonus = payStyle && ch.style ? ch.style.bonus : 0;
  return {
    state: {
      ...state,
      credits: state.credits + reward + styleBonus,
      progress: { ...state.progress, [ch.id]: best },
      researchPoints: state.researchPoints + researchPoints,
      styleBonusPaid: payStyle ? [...state.styleBonusPaid, ch.id] : state.styleBonusPaid,
    },
    evaluation,
    reward,
    researchPoints,
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
  underglow: z.boolean().default(DEFAULT_COSMETICS.underglow),
  underglowColor: hex.default(DEFAULT_COSMETICS.underglowColor),
});
// Accepts v1 saves (7 engine slots, no cosmetics) and v2 saves (AFR tune) and migrates them on load.
// v4 added gear ratios and final drive; older tunes get the fitted gearbox's defaults on load.
// v6 adds researched blueprints; older contract grades are converted into research points.
// v7 adds customizable underglow; v8 adds the engine slot and defaults old builds to the stock engine.
const gearFields = { gearRatios: z.array(z.number()).optional(), finalDrive: z.number().optional() };
const tuneSchema = z.union([
  z.object({ boostTarget: z.number(), lambdaTarget: z.number(), timingOffset: z.number(), revLimit: z.number(), ...gearFields }),
  // v1/v2 stored a gasoline-equivalent AFR target; lambda = AFR / 14.7.
  z
    .object({ boostTarget: z.number(), afrTarget: z.number(), timingOffset: z.number(), revLimit: z.number(), ...gearFields })
    .transform(({ afrTarget, ...t }) => ({ ...t, lambdaTarget: Math.round((afrTarget / 14.7) * 100) / 100 })),
]);
const saveSchema = z.object({
  version: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5), z.literal(6), z.literal(7), z.literal(SAVE_VERSION)]),
  credits: z.number().finite().min(0),
  owned: z.array(z.string()),
  build: z.record(z.string(), z.string()),
  tune: tuneSchema,
  progress: z.record(z.string(), gradeSchema),
  lastRunKey: z.string().nullable(),
  runCount: z.number().int().min(0),
  cosmetics: z.unknown().optional(),
  styleBonusPaid: z.array(z.string()).optional(),
  raceWins: z.record(z.string(), z.number().int().min(0)).optional(),
  raceBest: z.record(z.string(), z.number().positive()).optional(),
  researchPoints: z.number().int().min(0).optional(),
  researched: z.array(z.string()).optional(),
  tutorial: z.enum(["street-rival", "done"]).optional(),
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
      raceWins: Object.fromEntries(Object.entries(parsed.raceWins ?? {}).filter(([id]) => RACE_EVENTS.some((e) => e.id === id))),
      raceBest: parsed.raceBest ?? {},
      researchPoints: parsed.researchPoints ?? Object.values(parsed.progress).reduce((total, grade) => total + GRADE_RANK[grade], 0),
      researched: (parsed.researched ?? []).filter((id) => RESEARCH_PROJECTS.some((project) => project.id === id)),
      // Saves from before the Street Rival intro belong to players who already know the workshop.
      tutorial: parsed.tutorial ?? "done",
    };
  } catch {
    return newGame();
  }
}
