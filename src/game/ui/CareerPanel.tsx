import { Check, Lock, Medal, X, Send } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { CHALLENGES, describeRequirements, evaluateChallenge, isChallengeUnlocked, type Grade } from "../sim/challenges";
import { configKey } from "../sim/economy";
import { useGame } from "../store";
import { fmtCredits } from "./format";

const gradeText: Record<Grade, string> = { bronze: "text-grade-bronze", silver: "text-grade-silver", gold: "text-grade-gold" };
const gradeLabel: Record<Grade, string> = { bronze: "Bronze", silver: "Silver", gold: "Gold" };

export function CareerPanel() {
  const game = useGame((s) => s.game);
  const lastResult = useGame((s) => s.lastResult);
  const submit = useGame((s) => s.submit);
  const setTab = useGame((s) => s.setTab);
  const firstOpen = CHALLENGES.find((c) => !game.progress[c.id]) ?? CHALLENGES[0];
  const [openId, setOpenId] = useState(firstOpen?.id ?? "c1");
  const fresh = Boolean(lastResult && game.lastRunKey === configKey(game.build, game.tune));
  const completed = Object.keys(game.progress).length;

  const onSubmit = (id: string) => {
    const out = submit(id);
    if (out.refused === "no-run" || out.refused === "stale-run") {
      toast.error("Run the dyno first", { description: "Challenges are graded on a dyno run of the current build." });
      return;
    }
    if (!out.evaluation) return;
    if (!out.evaluation.grade) {
      toast.error("Requirements not met", { description: out.evaluation.checks.filter((c) => !c.pass).map((c) => `${c.label}: ${c.actual} (needs ${c.target})`).join(" · ") });
      return;
    }
    toast.success(`${gradeLabel[out.evaluation.grade]} grade`, {
      description: out.reward > 0 ? `Contract paid ${fmtCredits(out.reward)}.` : "No extra payment: you already hold this grade or better.",
    });
  };

  return (
    <div className="space-y-4 p-4">
      <div>
        <h2 className="font-display text-2xl font-semibold leading-none">Career · Foundation Engineering</h2>
        <p className="mt-1 text-xs text-muted-foreground">{completed} of {CHALLENGES.length} contracts complete. Bronze meets the brief; Silver and Gold reward a better result.</p>
      </div>
      {CHALLENGES.map((ch) => {
        const unlocked = isChallengeUnlocked(ch, game.progress);
        const grade = game.progress[ch.id];
        const open = openId === ch.id && unlocked;
        const ev = fresh && lastResult ? evaluateChallenge(ch, game.build, lastResult) : null;
        return (
          <div key={ch.id} className={cn("rounded-md border bg-card", open ? "border-primary/50" : "border-border", !unlocked && "opacity-60")}>
            <button disabled={!unlocked} onClick={() => setOpenId(ch.id)} className="flex w-full items-center gap-3 p-3 text-left">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded border border-border font-mono text-sm">{ch.level}</span>
              <div className="min-w-0 flex-1">
                <div className="font-display text-lg font-semibold leading-tight">{ch.title}</div>
                <div className="text-[11px] text-muted-foreground">{ch.skills.join(" · ")}</div>
              </div>
              {!unlocked ? <Lock className="h-4 w-4 text-muted-foreground" /> : grade ? (
                <span className={cn("flex items-center gap-1 text-xs font-semibold", gradeText[grade])}><Medal className="h-4 w-4" />{gradeLabel[grade]}</span>
              ) : null}
            </button>
            {open && (
              <div className="space-y-3 border-t border-border p-3">
                <p className="text-sm leading-relaxed">{ch.brief}</p>
                <div>
                  <div className="mb-1.5 flex items-center justify-between text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                    <span>Requirements</span>
                    <span>{ev ? "Last dyno run" : "Not measured"}</span>
                  </div>
                  <ul className="space-y-1">
                    {(ev?.checks ?? describeRequirements(ch).map((r) => ({ ...r, actual: "", pass: false }))).map((c) => (
                      <li key={c.label} className="flex items-center justify-between gap-2 font-mono text-xs tabular">
                        <span className="flex items-center gap-1.5">
                          {ev ? c.pass ? <Check className="h-3.5 w-3.5 text-success" /> : <X className="h-3.5 w-3.5 text-destructive" /> : <span className="h-3.5 w-3.5" />}
                          <span className="font-sans">{c.label}</span>
                        </span>
                        <span>
                          <span className="text-muted-foreground">{c.target}</span>
                          {ev && <span className={cn("ml-2", c.pass ? "text-foreground" : "text-destructive")}>{c.actual}</span>}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="grid grid-cols-3 gap-2 text-center">
                  {(["bronze", "silver", "gold"] as Grade[]).map((g) => (
                    <div key={g} className={cn("rounded border border-border px-2 py-1.5", grade === g && "border-current", gradeText[g])}>
                      <div className="text-[10px] font-semibold uppercase tracking-wider">{gradeLabel[g]}</div>
                      <div className="font-mono text-[11px] text-foreground">{g === "bronze" ? "Meet brief" : `${ch.metric.label.replace("Peak power", "")} ≥ ${g === "silver" ? ch.metric.silver : ch.metric.gold} ${ch.metric.unit}`.trim()}</div>
                      <div className="font-mono text-[10px] text-muted-foreground">{fmtCredits(ch.reward[g])}</div>
                    </div>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Button className="flex-1" onClick={() => onSubmit(ch.id)} disabled={!fresh}>
                    <Send /> Submit for grading
                  </Button>
                  <Button variant="outline" onClick={() => setTab(fresh ? "workshop" : "dyno")}>
                    {fresh ? "Modify build" : "Go to dyno"}
                  </Button>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
