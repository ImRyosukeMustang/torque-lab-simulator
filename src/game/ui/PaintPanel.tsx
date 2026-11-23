import { Check, RotateCcw } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";
import {
  CALIPER_COLORS,
  DEFAULT_COSMETICS,
  FINISH_LABEL,
  PAINT_PRESETS,
  RIM_COLORS,
  RIM_LABEL,
  STRIPE_LABEL,
  type PaintFinish,
  type RimStyle,
  type StripeStyle,
} from "../sim/cosmetics";
import { BODY_SLOTS, getPart, SLOT_LABEL } from "../sim/parts";
import { useGame } from "../store";
import { ChevronRight } from "lucide-react";

function Section({ title, value, children }: { title: string; value?: string; children: ReactNode }) {
  return (
    <section className="space-y-2.5 rounded-md border border-border bg-card p-3">
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">{title}</h3>
        {value && <span className="truncate text-xs text-foreground">{value}</span>}
      </div>
      {children}
    </section>
  );
}

function Swatches({ options, value, onPick, size = "md" }: { options: { name: string; hex: string }[]; value: string; onPick: (hex: string) => void; size?: "md" | "sm" }) {
  return (
    <div className={cn("grid gap-1.5", size === "md" ? "grid-cols-6" : "grid-cols-6 sm:grid-cols-8")}>
      {options.map((o) => {
        const active = o.hex.toLowerCase() === value.toLowerCase();
        return (
          <button
            key={o.hex}
            type="button"
            title={o.name}
            aria-label={o.name}
            aria-pressed={active}
            onClick={() => onPick(o.hex)}
            className={cn(
              "relative aspect-square rounded-md border transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              active ? "border-primary ring-2 ring-primary/60" : "border-border",
            )}
            // Swatches must show the literal paint colour, so this is the one place a raw colour is correct.
            style={{ background: o.hex }}
          >
            {active && <Check className="absolute inset-0 m-auto h-3.5 w-3.5 text-foreground mix-blend-difference" />}
          </button>
        );
      })}
    </div>
  );
}

function Choice<T extends string>({ options, value, onPick, cols = 3 }: { options: Record<T, string>; value: T; onPick: (v: T) => void; cols?: 2 | 3 | 4 | 5 }) {
  const colClass = { 2: "grid-cols-2", 3: "grid-cols-3", 4: "grid-cols-2 sm:grid-cols-4", 5: "grid-cols-3 sm:grid-cols-5" }[cols];
  return (
    <div className={cn("grid gap-1.5", colClass)}>
      {(Object.keys(options) as T[]).map((k) => (
        <button
          key={k}
          type="button"
          aria-pressed={value === k}
          onClick={() => onPick(k)}
          className={cn(
            "rounded-md border px-2 py-1.5 text-xs font-medium transition-colors",
            value === k ? "border-primary/60 bg-primary/15 text-foreground" : "border-border bg-background/40 text-muted-foreground hover:text-foreground",
          )}
        >
          {options[k]}
        </button>
      ))}
    </div>
  );
}

const nameOf = (list: { name: string; hex: string }[], hex: string) => list.find((o) => o.hex.toLowerCase() === hex.toLowerCase())?.name ?? hex.toUpperCase();

export function PaintPanel() {
  const look = useGame((s) => s.game.cosmetics);
  const update = useGame((s) => s.updateCosmetics);
  const setView = useGame((s) => s.setView);
  const build = useGame((s) => s.game.build);
  const selectSlot = useGame((s) => s.selectSlot);

  return (
    <div className="space-y-3 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-2xl font-semibold leading-none">Paint Shop</h2>
          <p className="mt-1 text-xs text-muted-foreground">Paint is free and never changes the numbers. Body kits are real parts: they change drag, downforce, grip and weight.</p>
        </div>
        <Button variant="ghost" size="sm" onClick={() => update({ ...DEFAULT_COSMETICS })}>
          <RotateCcw /> Factory
        </Button>
      </div>

      <Section title="Body kit" value="Aero, wings, wide body">
        <div className="grid grid-cols-1 gap-1">
          {BODY_SLOTS.map((slot) => (
            <button
              key={slot}
              type="button"
              onClick={() => selectSlot(slot)}
              className="flex items-center justify-between gap-2 rounded-md border border-border bg-background/40 px-3 py-2 text-left hover:border-primary/50"
            >
              <span className="text-sm font-medium">{SLOT_LABEL[slot]}</span>
              <span className="flex items-center gap-1 truncate text-xs text-muted-foreground">
                {getPart(slot, build[slot]).name} <ChevronRight className="h-3.5 w-3.5" />
              </span>
            </button>
          ))}
        </div>
      </Section>

      <Section title="Body colour" value={nameOf(PAINT_PRESETS, look.paint)}>
        <Swatches options={PAINT_PRESETS} value={look.paint} onPick={(paint) => update({ paint })} />
        <label className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
          Custom colour
          <input
            type="color"
            value={look.paint}
            onChange={(e) => update({ paint: e.target.value })}
            className="h-7 w-12 cursor-pointer rounded border border-border bg-transparent"
            aria-label="Custom body colour"
          />
        </label>
      </Section>

      <Section title="Finish" value={FINISH_LABEL[look.finish]}>
        <Choice<PaintFinish> options={FINISH_LABEL} value={look.finish} onPick={(finish) => update({ finish })} cols={5} />
      </Section>

      <Section title="Wheels" value={`${RIM_LABEL[look.rimStyle]} · ${nameOf(RIM_COLORS, look.rimColor)}`}>
        <Choice<RimStyle>
          options={RIM_LABEL}
          value={look.rimStyle}
          onPick={(rimStyle) => {
            update({ rimStyle });
            setView("paint");
          }}
          cols={4}
        />
        <Swatches options={RIM_COLORS} value={look.rimColor} onPick={(rimColor) => update({ rimColor })} size="sm" />
      </Section>

      <Section title="Brake calipers" value={nameOf(CALIPER_COLORS, look.caliper)}>
        <Swatches options={CALIPER_COLORS} value={look.caliper} onPick={(caliper) => update({ caliper })} size="sm" />
      </Section>

      <Section title="Stripes" value={look.stripe === "none" ? "None" : `${STRIPE_LABEL[look.stripe]} · ${nameOf(PAINT_PRESETS, look.stripeColor)}`}>
        <Choice<StripeStyle> options={STRIPE_LABEL} value={look.stripe} onPick={(stripe) => update({ stripe })} cols={4} />
        {look.stripe !== "none" && <Swatches options={PAINT_PRESETS} value={look.stripeColor} onPick={(stripeColor) => update({ stripeColor })} size="sm" />}
      </Section>

      <Section title="Window tint" value={`${Math.round(look.tint * 100)}%`}>
        <Slider value={[look.tint]} min={0} max={1} step={0.05} onValueChange={([v]) => v !== undefined && update({ tint: v })} aria-label="Window tint" />
        <div className="flex justify-between text-[10px] text-muted-foreground">
          <span>Clear</span>
          <span>Limo</span>
        </div>
      </Section>
    </div>
  );
}
