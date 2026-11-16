import { AlertTriangle, CircleAlert, Info, Play, Square, SlidersHorizontal, CheckCircle2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import { dynoLive } from "../dynoLive";
import { configKey } from "../sim/economy";
import { lastPoint, LIMITS, sampleCurve, simulate } from "../sim/engine";
import type { CurvePoint, SimResult } from "../sim/types";
import { useGame } from "../store";
import { TunePanel } from "./TunePanel";

const SWEEP_SECONDS = 7;
const RPM_FROM = 1500;

interface ChartRow {
  rpm: number;
  hp?: number;
  nm?: number;
  baseHp?: number;
  baseNm?: number;
  boost?: number;
  afr?: number;
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
        row.afr = Math.round(p.afr * 10) / 10;
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

function Readout({ label, value, unit, tone }: { label: string; value: string; unit: string; tone?: "warn" | "crit" | undefined }) {
  return (
    <div className="rounded-md border border-border bg-card px-3 py-2">
      <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">{label}</div>
      <div className={cn("font-mono text-xl font-medium tabular leading-tight", tone === "crit" ? "text-destructive" : tone === "warn" ? "text-warning" : "text-foreground")}>
        {value}
        <span className="ml-1 text-xs text-muted-foreground">{unit}</span>
      </div>
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
  const [running, setRunning] = useState(false);
  const [rpm, setRpm] = useState(0);
  const [live, setLive] = useState<{ result: SimResult; upTo: number } | null>(null);
  const raf = useRef(0);

  const fresh = game.lastRunKey === configKey(game.build, game.tune) && lastResult;
  const shown: SimResult | null = live?.result ?? (fresh ? lastResult : null);
  const upTo = live ? live.upTo : Infinity;
  const maxRpm = Math.max(8200, game.tune.revLimit);

  useEffect(
    () => () => {
      cancelAnimationFrame(raf.current);
      dynoLive.running = false;
    },
    [],
  );

  const start = () => {
    const result = simulate(game.build, game.tune);
    const end = lastPoint(result.curve).rpm;
    const t0 = performance.now();
    let lastUi = 0;
    setRunning(true);
    dynoLive.running = true;
    const tick = (now: number) => {
      const t = Math.min(1, (now - t0) / 1000 / SWEEP_SECONDS);
      const r = RPM_FROM + (end - RPM_FROM) * t;
      const p = sampleCurve(result.curve, r);
      dynoLive.rpm = r;
      dynoLive.egtC = p.egtC;
      dynoLive.boostBar = p.boostBar;
      dynoLive.load = Math.min(1, p.bmepBar / 20);
      if (now - lastUi > 60 || t >= 1) {
        lastUi = now;
        setRpm(r);
        setLive({ result, upTo: r });
      }
      if (t < 1) {
        raf.current = requestAnimationFrame(tick);
      } else {
        // Hold briefly at the limiter, then coast down.
        window.setTimeout(() => {
          dynoLive.running = false;
          setRunning(false);
          setLive(null);
          completeDynoRun();
        }, 350);
      }
    };
    raf.current = requestAnimationFrame(tick);
  };

  const stop = () => {
    cancelAnimationFrame(raf.current);
    dynoLive.running = false;
    setRunning(false);
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

      <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
        {cur ? (
          <>
            <Readout label="RPM" value={Math.round(cur.rpm).toLocaleString("en-US")} unit="" />
            <Readout label="Power" value={cur.powerHp.toFixed(0)} unit="hp" />
            <Readout label="Torque" value={cur.torqueNm.toFixed(0)} unit="Nm" />
            <Readout label="Boost" value={cur.boostBar.toFixed(2)} unit="bar" />
            <Readout label="AFR" value={cur.afr.toFixed(1)} unit=":1" tone={cur.afr > 13.2 && cur.boostBar > 0.2 ? "crit" : undefined} />
            <Readout label="EGT" value={cur.egtC.toFixed(0)} unit="°C" tone={cur.egtC > LIMITS.egtCriticalC ? "crit" : cur.egtC > LIMITS.egtSafeC ? "warn" : undefined} />
          </>
        ) : shown ? (
          <>
            <Readout label="Peak power" value={shown.peakPowerHp.toFixed(0)} unit={`hp @${shown.peakPowerRpm}`} />
            <Readout label="Peak torque" value={shown.peakTorqueNm.toFixed(0)} unit={`Nm @${shown.peakTorqueRpm}`} />
            <Readout label="Peak boost" value={shown.peakBoostBar.toFixed(2)} unit="bar" />
            <Readout label="AFR range" value={shown.minAfr === shown.maxAfr ? `${shown.minAfr}` : `${shown.minAfr}–${shown.maxAfr}`} unit=":1" />
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
        <MiniChart rows={rows} dataKey="afr" color="var(--chart-5)" domain={[10, 15]} unit="" limit={13} maxRpm={maxRpm} label="AFR · :1" />
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
          <div className="mb-3 grid grid-cols-3 gap-2 font-mono text-xs tabular">
            <div><span className="text-muted-foreground">Thermal load </span>{Math.round(shown.thermalLoad * 100)}%</div>
            <div><span className="text-muted-foreground">Build cost </span>{shown.buildCost.toLocaleString("en-US")} cr</div>
            <div><span className="text-muted-foreground">Rev limit </span>{lastPoint(shown.curve).rpm}</div>
          </div>
          <ul className="space-y-1.5">
            {shown.diagnostics.map((d) => {
              const Icon = d.code === "OK" ? CheckCircle2 : sevIcon[d.severity];
              return (
                <li key={d.code} className="flex gap-2 text-xs leading-snug">
                  <Icon className={cn("mt-px h-3.5 w-3.5 shrink-0", d.code === "OK" ? "text-success" : sevColor[d.severity])} />
                  <span>{d.message}</span>
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
