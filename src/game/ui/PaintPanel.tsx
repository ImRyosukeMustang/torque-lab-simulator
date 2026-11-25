import { Check, RotateCcw, Sparkles } from "lucide-react";
import type { ReactNode } from "react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
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
  UNDERGLOW_COLORS,
  type PaintFinish,
  type RimStyle,
  type StripeStyle,
} from "../sim/cosmetics";
import { aeroLoads, bodyworkSpec } from "../sim/drivetrain";
import { BODY_SLOTS, getPart, SLOT_LABEL, STOCK_BUILD } from "../sim/parts";
import { useGame } from "../store";
import { KMH_PER_MPH, speedUnit } from "../units";
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
  const units = useGame((s) => s.settings.units);
  const forceFactor = units === "imperial" ? 0.2248089431 : 1;
  const forceUnit = units === "imperial" ? "lbf" : "N";
  const speedMarks = units === "imperial" ? [0, 30, 60, 90, 120, 150, 180] : [0, 50, 100, 150, 200, 250, 300];
  const referenceSpeed = units === "imperial" ? 120 : 200;
  const referenceKmh = units === "imperial" ? referenceSpeed * KMH_PER_MPH : referenceSpeed;
  const bodywork = bodyworkSpec(build);
  const stockBodywork = bodyworkSpec(STOCK_BUILD);
  const referenceLoads = aeroLoads(build, referenceKmh);
  const windRows = speedMarks.map((speed) => {
    const speedKmh = units === "imperial" ? speed * KMH_PER_MPH : speed;
    const fittedLoads = aeroLoads(build, speedKmh);
    const factoryLoads = aeroLoads(STOCK_BUILD, speedKmh);
    return {
      speed,
      drag: fittedLoads.dragN * forceFactor,
      downforce: fittedLoads.downforceN * forceFactor,
      stockDrag: factoryLoads.dragN * forceFactor,
    };
  });
  const displayForce = (newtons: number) => (newtons * forceFactor).toLocaleString("en-US", { maximumFractionDigits: 0 });

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

      <Section title="Wind tunnel" value={`${(bodywork.dragCdA * (units === "imperial" ? 10.7639104 : 1)).toFixed(2)} ${units === "imperial" ? "ft²" : "m²"} CdA`}>
        <p className="text-[11px] leading-relaxed text-muted-foreground">
          Aero forces rise with speed squared. Downforce adds tyre load; drag increases road load. Dashed line is factory drag.
        </p>
        <div className="h-44" role="img" aria-label={`Wind tunnel chart showing drag and downforce in ${forceUnit} across road speed`}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={windRows} margin={{ top: 6, right: 8, bottom: 0, left: -12 }}>
              <CartesianGrid stroke="var(--border)" strokeDasharray="2 4" />
              <XAxis dataKey="speed" type="number" domain={[0, "dataMax"]} tick={{ stroke: "var(--muted-foreground)", fontSize: 10 }} tickCount={7} unit="" />
              <YAxis tick={{ stroke: "var(--muted-foreground)", fontSize: 10 }} tickFormatter={(value: number) => `${Math.round(value)} ${forceUnit}`} />
              <Tooltip
                contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 6, fontSize: 11 }}
                labelFormatter={(value) => `${value} ${speedUnit(units)}`}
                formatter={(value: number, name: string) => [`${Math.round(value)} ${forceUnit}`, name]}
              />
              <Line dataKey="drag" name="Drag" stroke="var(--destructive)" strokeWidth={2} dot={false} isAnimationActive={false} />
              <Line dataKey="stockDrag" name="Factory drag" stroke="var(--muted-foreground)" strokeDasharray="5 4" strokeWidth={1.5} dot={false} isAnimationActive={false} />
              <Line dataKey="downforce" name="Downforce" stroke="var(--chart-1)" strokeWidth={2} dot={false} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          <div className="rounded border border-border bg-background/40 px-2.5 py-2">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Drag @ {referenceSpeed} {speedUnit(units)}</div>
            <div className="font-mono text-sm tabular">{displayForce(referenceLoads.dragN)} {forceUnit}</div>
            <div className="text-[10px] text-muted-foreground">Factory: {displayForce(aeroLoads(STOCK_BUILD, referenceKmh).dragN)} {forceUnit}</div>
          </div>
          <div className="rounded border border-border bg-background/40 px-2.5 py-2">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Downforce @ {referenceSpeed} {speedUnit(units)}</div>
            <div className="font-mono text-sm tabular">{displayForce(referenceLoads.downforceN)} {forceUnit}</div>
            <div className="text-[10px] text-muted-foreground">Front balance: {bodywork.downforceArea ? `${Math.round(bodywork.downforceFront * 100)}%` : "—"}</div>
          </div>
          <div className="col-span-2 rounded border border-border bg-background/40 px-2.5 py-2 sm:col-span-1">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Factory CdA</div>
            <div className="font-mono text-sm tabular">{(stockBodywork.dragCdA * (units === "imperial" ? 10.7639104 : 1)).toFixed(2)} {units === "imperial" ? "ft²" : "m²"}</div>
          </div>
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

      <Section title="Underglow" value={look.underglow ? nameOf(UNDERGLOW_COLORS, look.underglowColor) : "Off"}>
        <button
          type="button"
          aria-pressed={look.underglow}
          onClick={() => update({ underglow: !look.underglow })}
          className={cn(
            "flex w-full items-center justify-between rounded-md border px-3 py-2 text-sm transition-colors",
            look.underglow ? "border-primary/60 bg-primary/15 text-foreground" : "border-border bg-background/40 text-muted-foreground hover:text-foreground",
          )}
        >
          <span className="flex items-center gap-2"><Sparkles className="h-4 w-4" /> {look.underglow ? "Glow enabled" : "Add a light kit"}</span>
          <span className="text-[10px] uppercase tracking-wider">{look.underglow ? "On" : "Off"}</span>
        </button>
        {look.underglow && <Swatches options={UNDERGLOW_COLORS} value={look.underglowColor} onPick={(underglowColor) => update({ underglowColor })} size="sm" />}
        <p className="text-[10px] leading-relaxed text-muted-foreground">A visual-only lighting option. It never changes power, grip, or race results.</p>
      </Section>
    </div>
  );
}
