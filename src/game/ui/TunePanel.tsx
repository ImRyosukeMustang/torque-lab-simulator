import { Slider } from "@/components/ui/slider";
import { getPart } from "../sim/parts";
import { useGame } from "../store";

function Row({ label, value, unit, min, max, step, onChange, disabled, hint, display }: { label: string; value: number; unit: string; min: number; max: number; step: number; onChange: (v: number) => void; disabled?: boolean | undefined; hint?: string; display?: string }) {
  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between">
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</span>
        <span className="font-mono text-sm tabular text-foreground">
          {display ?? (
            <>
              {value > 0 && unit === "°" ? "+" : ""}
              {value}
              {unit}
            </>
          )}
        </span>
      </div>
      <Slider value={[value]} min={min} max={max} step={step} disabled={Boolean(disabled)} onValueChange={([v]) => v !== undefined && onChange(v)} aria-label={label} />
      {hint && <p className="text-[11px] leading-snug text-muted-foreground">{hint}</p>}
    </div>
  );
}

export function TunePanel({ disabled }: { disabled?: boolean }) {
  const { build, tune } = useGame((s) => s.game);
  const update = useGame((s) => s.updateTune);
  const ecu = getPart("ecu", build.ecu);
  const turbo = getPart("turbo", build.turbo).maximumFlow > 0;
  const locked = ecu.timingRange === 0;
  const fuel = getPart("fuel", build.fuel);
  const afr = (tune.lambdaTarget * fuel.stoichAfr).toFixed(1);
  return (
    <div className="space-y-4">
      {locked && (
        <p className="rounded-md border border-border bg-muted px-3 py-2 text-xs text-muted-foreground">
          The OEM ECU runs a locked map. Fit a piggyback or standalone ECU to tune fuel, ignition and rev limit.
        </p>
      )}
      <Row
        label="Boost target"
        value={tune.boostTarget}
        unit=" bar"
        min={0}
        max={ecu.maxBoostTarget}
        step={0.05}
        disabled={disabled || !turbo}
        onChange={(v) => update({ boostTarget: Math.round(v * 100) / 100 })}
        hint={turbo ? "Wastegate setpoint. The turbo only reaches it once it has spooled." : "No turbocharger fitted."}
      />
      <Row
        label="Lambda target (WOT)"
        value={tune.lambdaTarget}
        unit=""
        display={`λ ${tune.lambdaTarget.toFixed(2)} · ${afr}:1`}
        min={ecu.lambdaRange[0]}
        max={ecu.lambdaRange[1]}
        step={0.01}
        disabled={disabled || locked}
        onChange={(v) => update({ lambdaTarget: Math.round(v * 100) / 100 })}
        hint={`λ 1.00 is chemically correct for any fuel (${fuel.stoichAfr}:1 on ${fuel.name}). Richer (lower) cools combustion and resists knock; best power is near λ 0.87.`}
      />
      <Row label="Ignition advance" value={tune.timingOffset} unit="°" min={-ecu.timingRange} max={ecu.timingRange} step={0.5} disabled={disabled || locked} onChange={(v) => update({ timingOffset: v })} hint="More advance improves efficiency and lowers EGT, but eats knock margin." />
      <Row label="Rev limit" value={tune.revLimit} unit=" rpm" min={ecu.revLimitRange[0]} max={ecu.revLimitRange[1]} step={100} disabled={disabled || ecu.revLimitRange[0] === ecu.revLimitRange[1]} onChange={(v) => update({ revLimit: v })} />
    </div>
  );
}
