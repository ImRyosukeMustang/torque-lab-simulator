import { Lock, Check, ShoppingCart, Wrench, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { CHALLENGES } from "../sim/challenges";
import { purchaseBlock, SELL_RATE } from "../sim/economy";
import { BODY_SLOTS, DRIVETRAIN_SLOTS, ENGINE_SLOTS, getPart, partsForSlot, SLOT_HELP, SLOT_LABEL } from "../sim/parts";
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
  const sell = useGame((s) => s.sell);
  const install = useGame((s) => s.install);
  const unlockTitle = (id?: string) => CHALLENGES.find((c) => c.id === id);
  const units = useGame((s) => s.settings.units);

  return (
    <div className="space-y-5 p-4">
      {game.tutorial !== "done" ? <StreetRivalCard /> : <ActiveContract />}

      {([["Engine systems", ENGINE_SLOTS], ["Drivetrain", DRIVETRAIN_SLOTS], ["Bodywork & aero", BODY_SLOTS]] as const).map(([title, slots]) => (
        <section key={title}>
          <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">{title}</h2>
          <div className="grid grid-cols-1 gap-1">
            {slots.map((slot) => {
              const part = getPart(slot, game.build[slot]);
              const active = slot === selected;
              return (
                <button
                  key={slot}
                  onClick={() => selectSlot(slot)}
                  onMouseEnter={() => setHovered(slot)}
                  onMouseLeave={() => setHovered(null)}
                  className={cn(
                    "flex items-center justify-between rounded-md border px-3 py-2 text-left transition-colors",
                    active ? "border-primary/60 bg-accent" : "border-transparent hover:bg-muted",
                  )}
                >
                  <span className="text-sm font-medium">{SLOT_LABEL[slot]}</span>
                  <span className={cn("truncate pl-3 text-xs", part.price === 0 ? "text-muted-foreground" : "text-primary")}>{part.name}</span>
                </button>
              );
            })}
          </div>
        </section>
      ))}

      <section className="space-y-3">
        <div>
          <h3 className="font-display text-xl font-semibold">{SLOT_LABEL[selected]}</h3>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{SLOT_HELP[selected]}</p>
        </div>
        {partsForSlot(selected).map((p) => {
          const installed = game.build[selected] === p.id;
          const block = purchaseBlock(game, p.id);
          const owned = block === "owned";
          const unlock = unlockTitle(p.unlockAfter);
          return (
            <div key={p.id} className={cn("rounded-md border bg-card p-3", installed ? "border-primary/60" : "border-border")}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-semibold leading-tight">{p.name}</div>
                  <p className="mt-0.5 text-xs text-muted-foreground">{p.description}</p>
                </div>
                <span className="shrink-0 font-mono text-xs tabular text-muted-foreground">{p.price ? fmtCredits(p.price) : "Stock"}</span>
              </div>
              <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1">
                {partSpecs(p).map(([k, v]) => (
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
                ) : (
                  <Button size="sm" variant="outline" disabled={block === "credits"} onClick={() => buy(p.id)}>
                    <ShoppingCart /> {block === "credits" ? "Not enough credits" : `Buy ${fmtCredits(p.price)}`}
                  </Button>
                )}
              </div>
            </div>
          );
        })}
        {selected === "ecu" && (
          <div className="rounded-md border border-border bg-card p-3">
            <h4 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Calibration</h4>
            <TunePanel />
          </div>
        )}
      </section>
    </div>
  );
}
