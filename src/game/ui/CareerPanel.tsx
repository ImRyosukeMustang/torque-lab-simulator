import { Check, ChevronDown, CircleHelp, Lock, Medal, X, Send, Paintbrush } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  CHAPTERS,
  CHALLENGES,
  describeRequirements,
  evaluateChallenge,
  isChallengeUnlocked,
  type Grade,
} from "../sim/challenges";
import { configKey, researchProjectBlock } from "../sim/economy";
import { findPart, getPart, SLOT_LABEL, SLOT_ORDER, STOCK_BUILD } from "../sim/parts";
import { SOLUTIONS } from "../sim/challengeSolutions";
import { RESEARCH_PROJECTS } from "../sim/research";
import { useGame } from "../store";
import { fmtCredits } from "./format";

const gradeText: Record<Grade, string> = {
  bronze: "text-grade-bronze",
  silver: "text-grade-silver",
  gold: "text-grade-gold",
};
const gradeLabel: Record<Grade, string> = { bronze: "Bronze", silver: "Silver", gold: "Gold" };

export function CareerPanel() {
  const game = useGame((s) => s.game);
  const lastResult = useGame((s) => s.lastResult);
  const submit = useGame((s) => s.submit);
  const research = useGame((s) => s.research);
  const setTab = useGame((s) => s.setTab);
  const firstOpen = CHALLENGES.find((c) => !game.progress[c.id]) ?? CHALLENGES[0];
  const [openId, setOpenId] = useState(firstOpen?.id ?? "c1");
  const [openChapter, setOpenChapter] = useState<number | null>(firstOpen?.chapter ?? 1);
  const [helpOpenId, setHelpOpenId] = useState<string | null>(null);
  const medals = (["gold", "silver", "bronze"] as Grade[]).map(
    (g) => [g, Object.values(game.progress).filter((x) => x === g).length] as const,
  );
  const fresh = Boolean(lastResult && game.lastRunKey === configKey(game.build, game.tune));
  const completed = Object.keys(game.progress).length;

  const onSubmit = (id: string) => {
    const out = submit(id);
    if (out.refused === "no-run" || out.refused === "stale-run") {
      toast.error("Test the build first", {
        description: "Contracts are graded on a dyno run or track test of the current build.",
      });
      return;
    }
    if (!out.evaluation) return;
    if (!out.evaluation.grade) {
      toast.error("Requirements not met", {
        description: out.evaluation.checks
          .filter((c) => !c.pass)
          .map((c) => `${c.label}: ${c.actual} (needs ${c.target})`)
          .join(" · "),
      });
      return;
    }
    const paid = [
      out.reward > 0
        ? `Contract paid ${fmtCredits(out.reward)}.`
        : "No extra payment for the grade: you already hold it or better.",
      out.researchPoints > 0 ? `Earned ${out.researchPoints} R&D ${out.researchPoints === 1 ? "point" : "points"}.` : "",
      out.styleBonus > 0 ? `Style brief matched: +${fmtCredits(out.styleBonus)}.` : "",
    ];
    toast.success(`${gradeLabel[out.evaluation.grade]} grade`, {
      description: paid.filter(Boolean).join(" "),
    });
  };

  return (
    <div className="space-y-4 p-4">
      <div>
        <h2 className="font-display text-2xl font-semibold leading-none">Career</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          {completed} of {CHALLENGES.length} contracts complete. Bronze meets the brief; Silver and
          Gold reward a better result.
        </p>
        <div className="mt-2 flex gap-3 font-mono text-xs">
          {medals.map(([g, n]) => (
            <span key={g} className={cn("flex items-center gap-1", gradeText[g])}>
              <Medal className="h-3.5 w-3.5" /> {n} {gradeLabel[g]}
            </span>
          ))}
        </div>
      </div>
      <section className="space-y-2 rounded-md border border-border bg-card p-3">
        <div className="flex items-baseline justify-between gap-2">
          <div>
            <h3 className="text-[10px] font-semibold uppercase tracking-[0.16em] text-primary">Engineering research</h3>
            <p className="mt-1 text-[11px] text-muted-foreground">Improve contract grades to earn R&D points and develop optional part blueprints.</p>
          </div>
          <span className="shrink-0 font-mono text-sm tabular">{game.researchPoints} RP</span>
        </div>
        {RESEARCH_PROJECTS.map((project) => {
          const block = researchProjectBlock(game, project.id);
          const required = CHALLENGES.find((c) => c.id === project.requiredChallenge);
          const part = findPart(project.partId);
          const researched = block === "researched";
          return (
            <article key={project.id} className="flex flex-wrap items-center justify-between gap-3 rounded border border-border bg-background/40 p-2.5">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline gap-x-2">
                  <h4 className="text-sm font-semibold">{project.name}</h4>
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{project.field}</span>
                </div>
                <p className="mt-0.5 text-xs text-muted-foreground">{project.description}</p>
                <p className="mt-1 text-[10px] text-muted-foreground">
                  Unlocks {part?.name ?? project.partId}
                  {required ? ` · Requires Level ${required.level}: ${required.title}` : ""}
                  {!researched && block === "points" ? ` · Need ${project.cost - game.researchPoints} more RP` : ""}
                </p>
              </div>
              <Button
                size="sm"
                variant={researched ? "secondary" : "outline"}
                disabled={block !== null}
                onClick={() => {
                  if (research(project.id)) {
                    toast.success("Research complete", { description: `${part?.name ?? project.partId} blueprint unlocked.` });
                  }
                }}
              >
                {researched ? "Researched" : `Research · ${project.cost} RP`}
              </Button>
            </article>
          );
        })}
      </section>
      {CHAPTERS.map((chap) => {
        const list = CHALLENGES.filter((c) => c.chapter === chap.id);
        const done = list.filter((c) => game.progress[c.id]).length;
        const reachable = list.some((c) => isChallengeUnlocked(c, game.progress));
        const isOpen = openChapter === chap.id;
        return (
          <section key={chap.id} className="space-y-2">
            <button
              onClick={() => setOpenChapter(isOpen ? null : chap.id)}
              className={cn(
                "flex w-full items-center gap-3 rounded-md border border-border bg-card/60 px-3 py-2.5 text-left",
                !reachable && "opacity-60",
              )}
              aria-expanded={isOpen}
            >
              <div className="min-w-0 flex-1">
                <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-primary">
                  Chapter {chap.id}
                </div>
                <div className="font-display text-lg font-semibold leading-tight">{chap.title}</div>
                <div className="text-[11px] text-muted-foreground">{chap.blurb}</div>
              </div>
              <span className="font-mono text-xs tabular text-muted-foreground">
                {done}/{list.length}
              </span>
              {reachable ? (
                <ChevronDown
                  className={cn("h-4 w-4 transition-transform", isOpen && "rotate-180")}
                />
              ) : (
                <Lock className="h-4 w-4 text-muted-foreground" />
              )}
            </button>
            {isOpen &&
              list.map((ch) => {
                const unlocked = isChallengeUnlocked(ch, game.progress);
                const grade = game.progress[ch.id];
                const open = openId === ch.id && unlocked;
                const ev =
                  fresh && lastResult
                    ? evaluateChallenge(ch, game.build, lastResult, game.cosmetics)
                    : null;
                const styleChecks = ev?.styleChecks ?? [];
                const stylePaid = game.styleBonusPaid.includes(ch.id);
                const solution = SOLUTIONS[ch.id]!;
                return (
                  <div
                    key={ch.id}
                    className={cn(
                      "rounded-md border bg-card",
                      open ? "border-primary/50" : "border-border",
                      !unlocked && "opacity-60",
                    )}
                  >
                    <button
                      disabled={!unlocked}
                      onClick={() => setOpenId(ch.id)}
                      className="flex w-full items-center gap-3 p-3 text-left"
                    >
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded border border-border font-mono text-sm">
                        {ch.level}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="font-display text-lg font-semibold leading-tight">
                          {ch.title}
                        </div>
                        <div className="text-[11px] text-muted-foreground">
                          {ch.skills.join(" · ")}
                        </div>
                      </div>
                      {!unlocked ? (
                        <Lock className="h-4 w-4 text-muted-foreground" />
                      ) : grade ? (
                        <span
                          className={cn(
                            "flex items-center gap-1 text-xs font-semibold",
                            gradeText[grade],
                          )}
                        >
                          <Medal className="h-4 w-4" />
                          {gradeLabel[grade]}
                        </span>
                      ) : null}
                    </button>
                    {open && (
                      <div className="space-y-3 border-t border-border p-3">
                        <p className="text-sm leading-relaxed">{ch.brief}</p>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setHelpOpenId(helpOpenId === ch.id ? null : ch.id)}
                          aria-expanded={helpOpenId === ch.id}
                        >
                          <CircleHelp /> {helpOpenId === ch.id ? "Hide pass guide" : "Exact pass guide"}
                        </Button>
                        {helpOpenId === ch.id && (
                          <section className="space-y-3 rounded-md border border-primary/35 bg-primary/5 p-3">
                            <div>
                              <h3 className="font-display text-lg font-semibold">Verified build and tune</h3>
                              <p className="text-xs leading-relaxed text-muted-foreground">
                                This exact setup passes the contract in the game's solution tests. Other builds can pass too; parts marked stock stay as they are.
                              </p>
                            </div>
                            <ol className="list-inside list-decimal space-y-1 text-xs text-muted-foreground">
                              <li>Fit the listed components in the Workshop; keep stock components unchanged.</li>
                              <li>Set the calibration values and gear ratios below.</li>
                              <li>Run the Dyno (or complete a track test) with this build and tune.</li>
                              <li>Return here and submit the measured run for grading.</li>
                            </ol>
                            <div>
                              <h4 className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Complete component list</h4>
                              <ul className="grid gap-x-4 gap-y-1 sm:grid-cols-2">
                                {SLOT_ORDER.map((slot) => {
                                  const partId = solution.build[slot] ?? STOCK_BUILD[slot];
                                  const part = getPart(slot, partId);
                                  const isStock = partId === STOCK_BUILD[slot];
                                  return (
                                    <li key={slot} className="flex items-baseline justify-between gap-2 text-xs">
                                      <span className="text-muted-foreground">{SLOT_LABEL[slot]}</span>
                                      <span className="text-right font-medium">
                                        {part.name}
                                        <span className="ml-1 font-mono text-[10px] text-muted-foreground">
                                          {isStock ? "· stock" : `· ${fmtCredits(part.price)}`}
                                        </span>
                                      </span>
                                    </li>
                                  );
                                })}
                              </ul>
                            </div>
                            <div className="rounded border border-border bg-background/60 p-2.5">
                              <h4 className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Exact tune settings</h4>
                              <dl className="grid grid-cols-2 gap-x-4 gap-y-1 font-mono text-xs tabular sm:grid-cols-3">
                                <div><dt className="text-muted-foreground">Boost</dt><dd>{solution.tune.boostTarget.toFixed(2)} bar</dd></div>
                                <div><dt className="text-muted-foreground">Lambda</dt><dd>{solution.tune.lambdaTarget.toFixed(2)} λ</dd></div>
                                <div><dt className="text-muted-foreground">Timing</dt><dd>{solution.tune.timingOffset}°</dd></div>
                                <div><dt className="text-muted-foreground">Rev limit</dt><dd>{solution.tune.revLimit.toLocaleString("en-US")} rpm</dd></div>
                                <div><dt className="text-muted-foreground">Final drive</dt><dd>{solution.tune.finalDrive.toFixed(2)}</dd></div>
                                <div className="col-span-2 sm:col-span-1"><dt className="text-muted-foreground">Gear ratios</dt><dd>{solution.tune.gearRatios.map((ratio) => ratio.toFixed(2)).join(" · ")}</dd></div>
                              </dl>
                            </div>
                          </section>
                        )}
                        <div>
                          <div className="mb-1.5 flex items-center justify-between text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                            <span>Requirements</span>
                            <span>{ev ? "Last test run" : "Not measured"}</span>
                          </div>
                          <ul className="space-y-1">
                            {(
                              ev?.checks ??
                              describeRequirements(ch).map((r) => ({
                                ...r,
                                actual: "",
                                pass: false,
                              }))
                            ).map((c) => (
                              <li
                                key={c.label}
                                className="flex items-center justify-between gap-2 font-mono text-xs tabular"
                              >
                                <span className="flex items-center gap-1.5">
                                  {ev ? (
                                    c.pass ? (
                                      <Check className="h-3.5 w-3.5 text-success" />
                                    ) : (
                                      <X className="h-3.5 w-3.5 text-destructive" />
                                    )
                                  ) : (
                                    <span className="h-3.5 w-3.5" />
                                  )}
                                  <span className="font-sans">{c.label}</span>
                                </span>
                                <span>
                                  <span className="text-muted-foreground">{c.target}</span>
                                  {ev && (
                                    <span
                                      className={cn(
                                        "ml-2",
                                        c.pass ? "text-foreground" : "text-destructive",
                                      )}
                                    >
                                      {c.actual}
                                    </span>
                                  )}
                                </span>
                              </li>
                            ))}
                          </ul>
                        </div>
                        {ch.style && (
                          <div className="rounded-md border border-dashed border-primary/40 bg-primary/5 p-2.5">
                            <div className="mb-1 flex items-center justify-between gap-2">
                              <span className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-primary">
                                <Paintbrush className="h-3 w-3" /> Client style brief
                              </span>
                              <span className="font-mono text-[11px]">
                                {stylePaid ? "Bonus paid" : `+${fmtCredits(ch.style.bonus)} bonus`}
                              </span>
                            </div>
                            <p className="text-xs">{ch.style.summary}</p>
                            {styleChecks.length > 0 && (
                              <ul className="mt-1.5 space-y-0.5">
                                {styleChecks.map((c) => (
                                  <li
                                    key={c.label}
                                    className="flex items-center justify-between gap-2 font-mono text-[11px]"
                                  >
                                    <span className="flex items-center gap-1.5 font-sans">
                                      {c.pass ? (
                                        <Check className="h-3 w-3 text-success" />
                                      ) : (
                                        <X className="h-3 w-3 text-muted-foreground" />
                                      )}
                                      {c.label}
                                    </span>
                                    <span className="text-muted-foreground">{c.target}</span>
                                  </li>
                                ))}
                              </ul>
                            )}
                            <div className="mt-1.5 flex items-center justify-between gap-2">
                              <span className="text-[10px] text-muted-foreground">
                                Optional. The look never affects the grade.
                              </span>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-6 px-2 text-[11px]"
                                onClick={() => setTab("paint")}
                              >
                                Paint Shop
                              </Button>
                            </div>
                          </div>
                        )}
                        <div className="grid grid-cols-3 gap-2 text-center">
                          {(["bronze", "silver", "gold"] as Grade[]).map((g) => (
                            <div
                              key={g}
                              className={cn(
                                "rounded border border-border px-2 py-1.5",
                                grade === g && "border-current",
                                gradeText[g],
                              )}
                            >
                              <div className="text-[10px] font-semibold uppercase tracking-wider">
                                {gradeLabel[g]}
                              </div>
                              <div className="font-mono text-[11px] text-foreground">
                                {g === "bronze"
                                  ? "Meet brief"
                                  : `${ch.metric.label.replace("Peak power", "")} ${ch.metric.lowerIsBetter ? "≤" : "≥"} ${g === "silver" ? ch.metric.silver : ch.metric.gold} ${ch.metric.unit}`.trim()}
                              </div>
                              <div className="font-mono text-[10px] text-muted-foreground">
                                {fmtCredits(ch.reward[g])}
                              </div>
                            </div>
                          ))}
                        </div>
                        <div className="flex gap-2">
                          <Button
                            className="flex-1"
                            onClick={() => onSubmit(ch.id)}
                            disabled={!fresh}
                          >
                            <Send /> Submit for grading
                          </Button>
                          <Button
                            variant="outline"
                            onClick={() => setTab(fresh ? "workshop" : "dyno")}
                          >
                            {fresh ? "Modify build" : "Go to dyno"}
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
          </section>
        );
      })}
    </div>
  );
}
