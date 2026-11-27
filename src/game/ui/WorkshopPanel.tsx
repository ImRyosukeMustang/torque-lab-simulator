import { Lock, Check, ShoppingCart, Wrench, ArrowRight } from "lucide-react";
import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { CHALLENGES } from "../sim/challenges";
import { purchaseBlock, SELL_RATE, visiblePartsForSlot } from "../sim/economy";
import { BODY_SLOTS, DRIVETRAIN_SLOTS, ENGINE_SLOTS, getPart, SLOT_HELP, SLOT_LABEL } from "../sim/parts";
import { researchProjectForPart } from "../sim/research";
import { useGame } from "../store";
import { localizeText } from "../units";
import { fmtCredits, partSpecs } from "./format";
import { StreetRivalCard } from "./RacePanel";
import { TunePanel } from "./TunePanel";

function ActiveContract() {
  const progress = useGame((s) => s.game.progress);
  const setTab = useGame((s) => s.setTab);
  const units = useGame((s) => s.settings.units);
  const next = CHALLENGES.find((c) => !progress[c.id]);
  if (!next) return null;
  return (
    <button onClick={() => setTab("career")} className="group w-full rounded-md border border-primary/40 bg-primary/10 p-3 text-left transition-colors hover:bg-primary/15">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-primary">Active contract · Level {next.level}</span>
        <ArrowRight className="h-3.5 w-3.5 text-primary transition-transform group-hover:translate-x-0.5" />
      </div>
      <div className="mt-1 font-display text-lg font-semibold leading-tight">{next.title}</div>
      <div className="mt-1 font-mono text-[11px] text-muted-foreground">
        {[
          next.constraints.minPeakHp && `≥ ${next.constraints.minPeakHp} hp`,
          next.constraints.minTorqueAt && `≥ ${next.constraints.minTorqueAt.nm} Nm @ ${next.constraints.minTorqueAt.rpm}`,
          next.constraints.maxZeroTo100S && `0-100 ≤ ${next.constraints.maxZeroTo100S} s`,
          next.constraints.minTopSpeedKmh && `≥ ${next.constraints.minTopSpeedKmh} km/h`,
          next.constraints.maxQuarterMileS && `¼ mile ≤ ${next.constraints.maxQuarterMileS} s`,
          next.constraints.layout && next.constraints.layout.toUpperCase(),
          `rel ≥ ${next.constraints.minReliability}%`,
          `≤ ${fmtCredits(next.constraints.maxBudget)}`,
        ]
          .filter(Boolean)
          .map((x) => localizeText(String(x), units))
          .join("  ·  ")}
      </div>
    </button>
  );
}

export function WorkshopPanel() {
  const game = useGame((s) => s.game);
  const selected = useGame((s) => s.selectedSlot);
  const selectSlot = useGame((s) => s.selectSlot);
  const setHovered = useGame((s) => s.setHovered);
  const buy = useGame((s) => s.buy);
  const setTab = useGame((s) => s.setTab);
  const sell = useGame((s) => s.sell);
  const install = useGame((s) => s.install);
  const optionsRef = useRef<HTMLElement>(null);
  const previousSelected = useRef(selected);
  const unlockTitle = (id?: string) => CHALLENGES.find((c) => c.id === id);
  const units = useGame((s) => s.settings.units);
  const groups = [
    ["Engine", ENGINE_SLOTS],
    ["Drivetrain", DRIVETRAIN_SLOTS],
    ["Body & aero", BODY_SLOTS],
  ] as const;

  useEffect(() => {
    if (previousSelected.current !== selected) {
      optionsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      previousSelected.current = selected;
    }
  }, [selected]);

  return (
    <div className="space-y-4 p-4">
      <section className="space-y-2 rounded-xl border border-border bg-card/70 p-3">
        <h2 className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Select a system</h2>
        {groups.map(([title, slots]) => (
          <div key={title} className="space-y-1">
            <h3 className="text-[9px] font-semibold uppercase tracking-[0.16em] text-muted-foreground/75">{title}</h3>
            <div className="flex flex-wrap gap-1">
            {slots.map((slot) => {
              const part = getPart(slot, game.build[slot]);
              const active = slot === selected;
              return (
                <button
                  key={slot}
                  type="button"
                  onClick={() => selectSlot(slot)}
                  onMouseEnter={() => setHovered(slot)}
                  onMouseLeave={() => setHovered(null)}
                  data-sound="select"
                  title={`${SLOT_LABEL[slot]} · ${part.name}`}
                  aria-pressed={active}
                  className={cn(
                    "rounded-md border px-2.5 py-1.5 text-left text-[11px] font-medium transition-colors",
                    active
                      ? "border-primary/60 bg-primary/10 text-foreground"
                      : "border-border/70 bg-background/50 text-muted-foreground hover:border-primary/40 hover:text-foreground",
                  )}
                >
                  {SLOT_LABEL[slot]}
                </button>
              );
            })}
            </div>
          </div>
        ))}
      </section>

      <section ref={optionsRef} className="scroll-mt-2 space-y-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="h-5 w-1 rounded-full bg-primary" />
            <h2 className="font-display text-2xl font-semibold leading-none">{SLOT_LABEL[selected]}</h2>
          </div>
          <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{SLOT_HELP[selected]}</p>
        </div>
        {visiblePartsForSlot(game, selected).map((p) => {
          const installed = game.build[selected] === p.id;
          const block = purchaseBlock(game, p.id);
          const owned = block === "owned";
          const unlock = unlockTitle(p.unlockAfter);
          const researchProject = researchProjectForPart(p.id);
          return (
            <article key={p.id} className={cn("rounded-xl border bg-gradient-to-br from-card to-card/70 p-3 shadow-sm", installed ? "border-primary/60 ring-1 ring-primary/15" : "border-border")}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-display text-base font-semibold leading-tight">{p.name}</div>
                  <p className="mt-0.5 text-xs text-muted-foreground">{p.description}</p>
                  {unlock && (
                    <span className="mt-2 inline-flex rounded-full border border-success/30 bg-success/10 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-success">
                      Contract unlock · {unlock.title}
                    </span>
                  )}
                  {researchProject && (
                    <span className="mt-2 inline-flex rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-primary">
                      Research · {researchProject.name}
                    </span>
                  )}
                </div>
                <span className="shrink-0 font-mono text-xs tabular text-muted-foreground">{p.price ? fmtCredits(p.price) : "Stock"}</span>
              </div>
              <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1">
                {partSpecs(p, getPart("engine", game.build.engine).cylinders).map(([k, v]) => (
                  <div key={k} className="flex justify-between gap-2 text-[11px]">
                    <dt className="text-muted-foreground">{k}</dt>
                    <dd className="font-mono tabular">{localizeText(v, units)}</dd>
                  </div>
                ))}
              </dl>
              <div className="mt-3 flex items-center gap-2">
                {installed ? (
                  <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary">
                    <Check className="h-3.5 w-3.5" /> Installed
                  </span>
                ) : owned ? (
                  <>
                    <Button size="sm" onClick={() => install(p.id)}>
                      <Wrench /> Install
                    </Button>
                    {p.price > 0 && (
                      <Button size="sm" variant="ghost" onClick={() => sell(p.id)}>
                        Sell {fmtCredits(p.price * SELL_RATE)}
                      </Button>
                    )}
                  </>
                ) : block === "locked" ? (
                  <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Lock className="h-3.5 w-3.5" /> Complete Level {unlock?.level} “{unlock?.title}”
                  </span>
                ) : block === "research" ? (
                  <Button size="sm" variant="outline" onClick={() => setTab("career")}>
                    <Lock /> Research blueprint{researchProject ? ` · ${researchProject.cost} RP` : ""}
                  </Button>
                ) : (
                  <Button size="sm" variant="outline" disabled={block === "credits"} onClick={() => buy(p.id)}>
                    <ShoppingCart /> {block === "credits" ? "Not enough credits" : `Buy ${fmtCredits(p.price)}`}
                  </Button>
                )}
              </div>
            </article>
          );
        })}
        {selected === "ecu" && (
          <div className="rounded-md border border-border bg-card p-3">
            <h4 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Calibration</h4>
            <TunePanel />
          </div>
        )}
      </section>

      {game.tutorial !== "done" ? <StreetRivalCard /> : <ActiveContract />}
    </div>
  );
}
