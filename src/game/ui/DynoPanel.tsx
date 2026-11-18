import { AlertTriangle, CircleAlert, Info, Play, Square, SlidersHorizontal, CheckCircle2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import { engineAudio } from "../audio";
import { dynoLive } from "../dynoLive";
import { configKey } from "../sim/economy";
import { lastPoint, LIMITS, sampleCurve, simulate } from "../sim/engine";
import { getPart } from "../sim/parts";
import type { CurvePoint, SimResult } from "../sim/types";
import { useGame } from "../store";
import { TunePanel } from "./TunePanel";

const SWEEP_SECONDS = 7;
const LIMITER_HOLD_MS = 600;
const COAST_SECONDS = 1.6;
const RPM_FROM = 1500;

interface ChartRow {
  rpm: number;
  hp?: number;
  nm?: number;
  baseHp?: number;
  baseNm?: number;
  boost?: number;
  lambda?: number;
  egt?: number;
}

function buildRows(curve: CurvePoint[], upTo: number, baseline: SimResult | null): ChartRow[] {
  const rpms = new Set<number>();
  curve.forEach((p) => rpms.add(p.rpm));
  baseline?.curve.forEach((p) => rpms.add(p.rpm));
  if (upTo < lastPoint(curve).rpm) rpms.add(Math.round(upTo));
  return [...rpms]
    .sort((a, b) => a - b)
    .map((rpm) => {
      const row: ChartRow = { rpm };
      if (rpm <= upTo && rpm <= lastPoint(curve).rpm) {
        const p = sampleCurve(curve, rpm);
        row.hp = Math.round(p.powerHp * 10) / 10;
        row.nm = Math.round(p.torqueNm);
        row.boost = Math.round(p.boostBar * 100) / 100;
        row.lambda = Math.round(p.lambda * 100) / 100;
        row.egt = Math.round(p.egtC);
      }
      if (baseline && rpm <= lastPoint(baseline.curve).rpm) {
        const b = sampleCurve(baseline.curve, rpm);
        row.baseHp = Math.round(b.powerHp * 10) / 10;
        row.baseNm = Math.round(b.torqueNm);
      }
      return row;
    });
}

function Readout({ label, value, unit, tone, sub }: { label: string; value: string; unit: string; tone?: "warn" | "crit" | undefined; sub?: string | undefined }) {
  return (
    <div className="rounded-md border border-border bg-card px-3 py-2">
      <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">{label}</div>
      <div className={cn("font-mono text-xl font-medium tabular leading-tight", tone === "crit" ? "text-destructive" : tone === "warn" ? "text-warning" : "text-foreground")}>
        {value}
        <span className="ml-1 text-xs text-muted-foreground">{unit}</span>
      </div>
      {sub && <div className="mt-0.5 font-mono text-[10px] text-muted-foreground">{sub}</div>}
    </div>
  );
}

const axis = { stroke: "var(--muted-foreground)", fontSize: 10, fontFamily: "var(--font-mono)" };
const tooltipStyle = { background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 6, fontSize: 11, fontFamily: "var(--font-mono)" };

function MiniChart({ rows, dataKey, color, domain, unit, limit, maxRpm, label }: { rows: ChartRow[]; dataKey: keyof ChartRow; color: string; domain: [number | string, number | string]; unit: string; limit?: number; maxRpm: number; label: string }) {
  return (
    <div className="rounded-md border border-border bg-card p-2">
      <div className="px-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">{label}</div>
      <div className="h-24">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={rows} margin={{ top: 6, right: 6, bottom: 0, left: -18 }}>
            <CartesianGrid stroke="var(--border)" strokeDasharray="2 4" />
            <XAxis dataKey="rpm" type="number" domain={[RPM_FROM, maxRpm]} tick={axis} tickCount={4} />
            <YAxis tick={axis} domain={domain} tickCount={4} unit={unit} />
            {limit !== undefined && <ReferenceLine y={limit} stroke="var(--destructive)" strokeDasharray="4 3" />}
            <Line dataKey={dataKey} stroke={color} strokeWidth={2} dot={false} isAnimationActive={false} connectNulls={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

const sevIcon = { info: Info, warning: AlertTriangle, critical: CircleAlert };
const sevColor = { info: "text-muted-foreground", warning: "text-warning", critical: "text-destructive" };

export function DynoPanel() {
  const game = useGame((s) => s.game);
  const lastResult = useGame((s) => s.lastResult);
  const baseline = useGame((s) => s.baseline);
  const completeDynoRun = useGame((s) => s.completeDynoRun);
  const setDynoRunning = useGame((s) => s.setDynoRunning);
  const [running, setRunning] = useState(false);
  const [rpm, setRpm] = useState(0);
  const [live, setLive] = useState<{ result: SimResult; upTo: number } | null>(null);
  const raf = useRef(0);
  const holdTimer = useRef(0);

  const fresh = game.lastRunKey === configKey(game.build, game.tune) && lastResult;
  const shown: SimResult | null = live?.result ?? (fresh ? lastResult : null);
  const upTo = live ? live.upTo : Infinity;
  const maxRpm = Math.max(8200, game.tune.revLimit);

  useEffect(
    () => () => {
      cancelAnimationFrame(raf.current);
      window.clearTimeout(holdTimer.current);
      dynoLive.running = false;
      dynoLive.pop = 0;
      engineAudio.kill();
      useGame.getState().setDynoRunning(false);
    },
    [],
  );

  /** Let the rollers and the sound wind down after a pull (visual only). */
  const coast = (fromRpm: number) => {
    const t0 = performance.now();
    const idle = 900;
    const step = (now: number) => {
      const t = Math.min(1, (now - t0) / 1000 / COAST_SECONDS);
      const e = 1 - (1 - t) * (1 - t);
      dynoLive.rpm = fromRpm + (idle - fromRpm) * e;
      dynoLive.load = 0.05;
      dynoLive.boostBar *= 0.9;
      dynoLive.egtC += (450 - dynoLive.egtC) * 0.03;
      if (t < 1) raf.current = requestAnimationFrame(step);
      else dynoLive.running = false;
    };
    raf.current = requestAnimationFrame(step);
  };

  const start = () => {
    cancelAnimationFrame(raf.current);
    window.clearTimeout(holdTimer.current);
    const result = simulate(game.build, game.tune);
    const end = lastPoint(result.curve).rpm;
    const exhaust = getPart("exhaust", game.build.exhaust);
    const hasTurbo = getPart("turbo", game.build.turbo).maximumFlow > 0;
    const { sound, volume } = useGame.getState().settings;
    if (sound) engineAudio.start({ volume, exhaustOpen: Math.min(1, Math.max(0, (exhaust.flowCapacity - 0.17) / 0.33)), turbo: hasTurbo });
    const t0 = performance.now();
    let lastUi = 0;
    setRunning(true);
    setDynoRunning(true);
    dynoLive.running = true;
    dynoLive.pop = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - t0) / 1000 / SWEEP_SECONDS);
      const r = RPM_FROM + (end - RPM_FROM) * t;
      const p = sampleCurve(result.curve, r);
      dynoLive.rpm = r;
      dynoLive.egtC = p.egtC;
      dynoLive.boostBar = p.boostBar;
      dynoLive.load = Math.min(1, p.bmepBar / 20);
      engineAudio.update(r, dynoLive.load, p.boostBar);
      if (now - lastUi > 60 || t >= 1) {
        lastUi = now;
        setRpm(r);
        setLive({ result, upTo: r });
      }
      if (t < 1) {
        raf.current = requestAnimationFrame(tick);
      } else {
        // Bounce off the limiter, then lift and coast down.
        const pops = exhaust.id !== "exh-stock";
        dynoLive.pop = pops ? 1 : 0.15;
        engineAudio.limiter(LIMITER_HOLD_MS / 1000, pops);
        holdTimer.current = window.setTimeout(() => {
          dynoLive.pop = 0;
          engineAudio.stop(hasTurbo && result.peakBoostBar > 0.3);
          setRunning(false);
          setDynoRunning(false);
          setLive(null);
          completeDynoRun();
          coast(end);
        }, LIMITER_HOLD_MS);
      }
    };
    raf.current = requestAnimationFrame(tick);
  };

  const stop = () => {
    // Aborting never records a run, even during the limiter hold.
    cancelAnimationFrame(raf.current);
    window.clearTimeout(holdTimer.current);
    dynoLive.running = false;
    dynoLive.pop = 0;
    engineAudio.stop(false);
    setRunning(false);
    setDynoRunning(false);
    setLive(null);
  };

  const cur = shown ? (running ? sampleCurve(shown.curve, rpm) : null) : null;
  const rows = shown ? buildRows(shown.curve, upTo, running ? baseline ?? (fresh ? null : lastResult) : baseline) : [];

  return (
    <div className="space-y-4 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-2xl font-semibold leading-none">Dyno Lab</h2>
          <p className="mt-1 text-xs text-muted-foreground">Wide-open-throttle sweep, {RPM_FROM.toLocaleString("en-US")} rpm to the rev limit. Results feed directly into challenge grading.</p>
        </div>
        {running ? (
          <Button variant="secondary" onClick={stop}>
            <Square /> Abort
          </Button>
        ) : (
          <Button size="lg" onClick={start} className="font-display text-base tracking-wide">
            <Play /> Run dyno
          </Button>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-6">
        {cur ? (
          <>
            <Readout label="RPM" value={Math.round(cur.rpm).toLocaleString("en-US")} unit="" />
            <Readout label="Power" value={cur.powerHp.toFixed(0)} unit="hp" />
            <Readout label="Torque" value={cur.torqueNm.toFixed(0)} unit="Nm" />
            <Readout label="Boost" value={cur.boostBar.toFixed(2)} unit="bar" sub={cur.compressorEff > 0 ? `compressor η ${Math.round(cur.compressorEff * 100)}%` : undefined} />
            <Readout label="Lambda" value={cur.lambda.toFixed(2)} unit="λ" sub={`${cur.afr.toFixed(1)}:1 AFR`} tone={cur.lambda > LIMITS.lambdaLeanBoost && cur.boostBar > 0.2 ? "crit" : undefined} />
            <Readout label="EGT" value={cur.egtC.toFixed(0)} unit="°C" tone={cur.egtC > LIMITS.egtCriticalC ? "crit" : cur.egtC > LIMITS.egtSafeC ? "warn" : undefined} />
          </>
        ) : shown ? (
          <>
            <Readout label="Peak power" value={shown.peakPowerHp.toFixed(0)} unit={`hp @${shown.peakPowerRpm}`} sub={`≈ ${shown.wheelPowerHp.toFixed(0)} whp at the rollers`} />
            <Readout label="Peak torque" value={shown.peakTorqueNm.toFixed(0)} unit={`Nm @${shown.peakTorqueRpm}`} />
            <Readout label="Peak boost" value={shown.peakBoostBar.toFixed(2)} unit="bar" />
            <Readout label="Lambda range" value={shown.minLambda === shown.maxLambda ? shown.minLambda.toFixed(2) : `${shown.minLambda.toFixed(2)}–${shown.maxLambda.toFixed(2)}`} unit="λ" tone={shown.maxLambda > LIMITS.lambdaLeanBoost && shown.peakBoostBar > 0.2 ? "crit" : undefined} />
            <Readout label="Peak EGT" value={`${shown.peakEgtC}`} unit="°C" tone={shown.peakEgtC > LIMITS.egtCriticalC ? "crit" : shown.peakEgtC > LIMITS.egtSafeC ? "warn" : undefined} />
            <Readout label="Reliability" value={shown.reliability.toFixed(0)} unit="%" tone={shown.reliability < 60 ? "crit" : shown.reliability < 85 ? "warn" : undefined} />
          </>
        ) : (
          <div className="col-span-full rounded-md border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
            {game.lastRunKey ? "The configuration has changed since the last run. Run the dyno to measure the new build." : "No measurements yet. Run the dyno to measure this build."}
          </div>
        )}
      </div>

      <div className="rounded-md border border-border bg-card p-3">
        <div className="mb-1 flex items-center justify-between">
          <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Power & torque</span>
          <div className="flex items-center gap-3 text-[11px]">
            <span className="flex items-center gap-1.5"><span className="h-0.5 w-4 bg-chart-1" />Power hp</span>
            <span className="flex items-center gap-1.5"><span className="h-0.5 w-4 bg-chart-2" />Torque Nm</span>
            {baseline && <span className="flex items-center gap-1.5 text-muted-foreground"><span className="h-0.5 w-4 border-t border-dashed border-muted-foreground" />Previous</span>}
          </div>
        </div>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={rows} margin={{ top: 8, right: 4, bottom: 0, left: -12 }}>
              <CartesianGrid stroke="var(--border)" strokeDasharray="2 4" />
              <XAxis dataKey="rpm" type="number" domain={[RPM_FROM, maxRpm]} tick={axis} tickCount={8} />
              <YAxis yAxisId="hp" tick={axis} domain={[0, "auto"]} />
              <YAxis yAxisId="nm" orientation="right" tick={axis} domain={[0, "auto"]} />
              <Tooltip contentStyle={tooltipStyle} labelFormatter={(v) => `${v} rpm`} />
              <Line yAxisId="hp" dataKey="baseHp" name="Prev hp" stroke="var(--chart-1)" strokeOpacity={0.4} strokeDasharray="5 4" dot={false} isAnimationActive={false} />
              <Line yAxisId="nm" dataKey="baseNm" name="Prev Nm" stroke="var(--chart-2)" strokeOpacity={0.4} strokeDasharray="5 4" dot={false} isAnimationActive={false} />
              <Line yAxisId="hp" dataKey="hp" name="Power hp" stroke="var(--chart-1)" strokeWidth={2.5} dot={false} isAnimationActive={false} />
              <Line yAxisId="nm" dataKey="nm" name="Torque Nm" stroke="var(--chart-2)" strokeWidth={2.5} dot={false} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        <MiniChart rows={rows} dataKey="boost" color="var(--chart-3)" domain={[0, "auto"]} unit="" maxRpm={maxRpm} label="Boost · bar" />
        <MiniChart rows={rows} dataKey="lambda" color="var(--chart-5)" domain={[0.7, 1.05]} unit="" limit={LIMITS.lambdaLeanBoost} maxRpm={maxRpm} label="Lambda · λ" />
        <MiniChart rows={rows} dataKey="egt" color="var(--chart-4)" domain={[500, 1050]} unit="" limit={LIMITS.egtSafeC} maxRpm={maxRpm} label="EGT · °C" />
      </div>

      {shown && !running && (
        <section className="rounded-md border border-border bg-card p-3">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Test report</h3>
            {baseline && (
              <span className="font-mono text-xs tabular">
                vs previous: <Delta value={shown.peakPowerHp - baseline.peakPowerHp} unit="hp" /> · <Delta value={shown.reliability - baseline.reliability} unit="% rel" />
              </span>
            )}
          </div>
          <div className="mb-3 grid grid-cols-2 gap-x-3 gap-y-1.5 font-mono text-xs tabular sm:grid-cols-3">
            <div><span className="text-muted-foreground">Thermal load </span>{Math.round(shown.thermalLoad * 100)}%</div>
            <div><span className="text-muted-foreground">Build cost </span>{shown.buildCost.toLocaleString("en-US")} cr</div>
            <div><span className="text-muted-foreground">Rev limit </span>{lastPoint(shown.curve).rpm}</div>
            <div><span className="text-muted-foreground">Wheel power </span>≈ {shown.wheelPowerHp} whp</div>
            <div><span className="text-muted-foreground">Fuel </span>{getPart("fuel", game.build.fuel).name}</div>
            <div><span className="text-muted-foreground">Compression </span>{getPart("internals", game.build.internals).compression}:1</div>
            {(() => {
              const pk = shown.curve.reduce((a, b) => (b.powerHp > a.powerHp ? b : a));
              const hot = Math.max(...shown.curve.map((p) => p.chargeTempC));
              return (
                <>
                  <div><span className="text-muted-foreground">Max charge temp </span>{Math.round(hot)}°C</div>
                  {pk.compressorEff > 0 && (
                    <>
                      <div><span className="text-muted-foreground">Compressor @ peak </span>PR {pk.pressureRatio.toFixed(2)} · η {Math.round(pk.compressorEff * 100)}%</div>
                      <div><span className="text-muted-foreground">Intercooler @ peak </span>{pk.icEffectiveness > 0 ? `ε ${Math.round(pk.icEffectiveness * 100)}%` : "none"}</div>
                    </>
                  )}
                  <div><span className="text-muted-foreground">Fuel flow @ peak </span>{pk.fuelFlowGs.toFixed(1)} g/s</div>
                </>
              );
            })()}
          </div>
          <ul className="space-y-1.5">
            {shown.diagnostics.map((d) => {
              const Icon = d.code === "OK" ? CheckCircle2 : sevIcon[d.severity];
              return (
                <li key={d.code} className="flex gap-2 rounded-md border border-border/60 bg-background/40 p-2 text-xs leading-snug">
                  <Icon className={cn("mt-px h-3.5 w-3.5 shrink-0", d.code === "OK" ? "text-success" : sevColor[d.severity])} />
                  <div className="min-w-0 space-y-1">
                    <p className="font-medium text-foreground">{d.message}</p>
                    {d.cause && d.code !== "OK" && (
                      <p className="text-muted-foreground">
                        <span className="font-semibold uppercase tracking-wider text-[10px] text-muted-foreground/80">Why · </span>
                        {d.cause}
                      </p>
                    )}
                    {d.fixes && d.fixes.length > 0 && (
                      <ul className="space-y-0.5">
                        {d.fixes.map((f) => (
                          <li key={f} className="flex gap-1.5 text-foreground/90">
                            <span className="text-primary">→</span>
                            {f}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <Collapsible defaultOpen>
        <CollapsibleTrigger className="flex w-full items-center gap-2 rounded-md border border-border bg-card px-3 py-2 text-left text-sm font-semibold hover:bg-muted">
          <SlidersHorizontal className="h-4 w-4 text-primary" /> ECU calibration
        </CollapsibleTrigger>
        <CollapsibleContent className="rounded-b-md border border-t-0 border-border bg-card p-3">
          <TunePanel disabled={running} />
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}

function Delta({ value, unit }: { value: number; unit: string }) {
  const v = Math.round(value * 10) / 10;
  return <span className={v > 0 ? "text-success" : v < 0 ? "text-destructive" : "text-muted-foreground"}>{v > 0 ? "+" : ""}{v} {unit}</span>;
}
