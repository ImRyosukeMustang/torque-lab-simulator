import { Flag, RotateCcw, Square, Timer, Gauge, AlertTriangle, CircleAlert, Info } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";
import { engineAudio } from "../audio";
import { dynoLive } from "../dynoLive";
import { createActiveClock, getGamePlatform, type ActiveClock } from "../platform";
import { trLabel } from "../sim/challenges";
import { tractiveForceCurves, VEHICLE } from "../sim/drivetrain";
import { configKey } from "../sim/economy";
import { simulate } from "../sim/engine";
import { DRIVETRAIN_SLOTS, gearRatioLimits, getPart } from "../sim/parts";
import type { AccelSample, SimResult } from "../sim/types";
import { soundProfile } from "../soundProfile";
import { useGame } from "../store";

/** Track-test playback runs faster than real time so a full pull takes a few seconds. */
const PLAYBACK_SPEED = 2.5;
const GEAR_COLORS = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)", "var(--primary)", "var(--muted-foreground)"];
const axis = { stroke: "var(--muted-foreground)", fontSize: 10, fontFamily: "var(--font-mono)" };
const tooltipStyle = { background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 6, fontSize: 11, fontFamily: "var(--font-mono)" };
const sevIcon = { info: Info, warning: AlertTriangle, critical: CircleAlert };
const sevColor = { info: "text-muted-foreground", warning: "text-warning", critical: "text-destructive" };

function Stat({ label, value, unit, sub }: { label: string; value: string; unit?: string; sub?: string | undefined }) {
  return (
    <div className="rounded-md border border-border bg-card px-3 py-2">
      <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">{label}</div>
      <div className="font-mono text-xl font-medium tabular leading-tight">
        {value}
        {unit && <span className="ml-1 text-xs text-muted-foreground">{unit}</span>}
      </div>
      {sub && <div className="mt-0.5 font-mono text-[10px] text-muted-foreground">{sub}</div>}
    </div>
  );
}

function Chart({ title, children, height = "h-48" }: { title: string; children: React.ReactElement; height?: string }) {
  return (
    <div className="rounded-md border border-border bg-card p-3">
      <div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">{title}</div>
      <div className={height}>
        <ResponsiveContainer width="100%" height="100%">
          {children}
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export function DrivetrainPanel() {
  const game = useGame((s) => s.game);
  const lastResult = useGame((s) => s.lastResult);
  const updateTune = useGame((s) => s.updateTune);
  const completeDynoRun = useGame((s) => s.completeDynoRun);
  const setDynoRunning = useGame((s) => s.setDynoRunning);
  const [live, setLive] = useState<{ sample: AccelSample; upTo: number } | null>(null);
  const raf = useRef(0);
  const clock = useRef<ActiveClock | null>(null);

  const { build, tune } = game;
  const box = getPart("gearbox", build.gearbox);
  const diff = getPart("differential", build.differential);
  const layout = getPart("drivetrain", build.drivetrain);
  const clutch = getPart("clutch", build.clutch);
  const fresh = Boolean(lastResult && game.lastRunKey === configKey(build, tune));
  const shown: SimResult | null = fresh ? lastResult : null;
  const running = live !== null;

  useEffect(
    () => () => {
      cancelAnimationFrame(raf.current);
      clock.current?.dispose();
      clock.current = null;
      dynoLive.running = false;
      engineAudio.kill();
      useGame.getState().setDynoRunning(false);
    },
    [],
  );

  // Gearing-only figures are pure geometry, so they update live as ratios change.
  const speedRows = useMemo(() => {
    const rows: Record<string, number>[] = [];
    for (let rpm = 0; rpm <= tune.revLimit; rpm += 250) {
      const row: Record<string, number> = { rpm };
      tune.gearRatios.forEach((r, i) => {
        row[`g${i + 1}`] = Math.round(((rpm * 2 * Math.PI * VEHICLE.tyreRadiusM) / 60 / (r * tune.finalDrive)) * 3.6);
      });
      rows.push(row);
    }
    return rows;
  }, [tune.gearRatios, tune.finalDrive, tune.revLimit]);

  const forceRows = useMemo(() => (shown ? tractiveForceCurves(build, tune, shown.curve) : []), [shown, build, tune]);
  const traceRows = shown ? shown.vehicle.trace.filter((s) => !live || s.t <= live.upTo).map((s) => ({ t: s.t, kmh: s.kmh })) : [];

  const runTest = () => {
    cancelAnimationFrame(raf.current);
    const result = simulate(build, tune);
    const trace = result.vehicle.trace;
    if (trace.length === 0) return;
    clock.current?.dispose();
    const activeClock = createActiveClock(getGamePlatform());
    clock.current = activeClock;
    const { sound, volume } = useGame.getState().settings;
    if (sound) engineAudio.start({ volume, profile: soundProfile(build) });
    setDynoRunning(true);
    dynoLive.running = true;
    const t0 = activeClock.now();
    let gear = 1;
    let idx = 0;
    let lastUi = 0;
    const end = trace[trace.length - 1]!.t;
    const tick = (now: number) => {
      const t = Math.min(end, ((activeClock.now() - t0) / 1000) * PLAYBACK_SPEED);
      while (idx < trace.length - 1 && trace[idx + 1]!.t <= t) idx++;
      const s = trace[idx]!;
      if (s.gear !== gear) {
        gear = s.gear;
        engineAudio.shift();
      }
      dynoLive.rpm = s.rpm;
      dynoLive.load = 1;
      engineAudio.update(s.rpm, 1, Math.min(result.peakBoostBar, (s.rpm / 6000) * result.peakBoostBar));
      if (now - lastUi > 60 || t >= end) {
        lastUi = now;
        setLive({ sample: s, upTo: t });
      }
      if (t < end) {
        raf.current = requestAnimationFrame(tick);
      } else {
        engineAudio.stop();
        dynoLive.running = false;
        setDynoRunning(false);
        setLive(null);
        completeDynoRun();
        activeClock.dispose();
        if (clock.current === activeClock) clock.current = null;
      }
    };
    raf.current = requestAnimationFrame(tick);
  };

  const abort = () => {
    cancelAnimationFrame(raf.current);
    clock.current?.dispose();
    clock.current = null;
    engineAudio.kill();
    dynoLive.running = false;
    setDynoRunning(false);
    setLive(null);
  };

  const setRatio = (i: number, v: number) => {
    const next = [...tune.gearRatios];
    next[i] = Math.round(v * 100) / 100;
    updateTune({ gearRatios: next });
  };

  const v = shown?.vehicle;
  const drivetrainDiag = shown?.diagnostics.filter((d) => d.slot && DRIVETRAIN_SLOTS.includes(d.slot)) ?? [];
  const fdFixed = diff.finalDriveRange[0] === diff.finalDriveRange[1];

  return (
    <div className="space-y-4 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-2xl font-semibold leading-none">Drivetrain & Track</h2>
          <p className="mt-1 text-xs text-muted-foreground">Gear the car, then run a standing-start test. Results feed contract grading like a dyno run.</p>
        </div>
        {running ? (
          <Button variant="secondary" onClick={abort}>
            <Square /> Abort
          </Button>
        ) : (
          <Button size="lg" onClick={runTest} className="font-display text-base tracking-wide">
            <Flag /> Run track test
          </Button>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2 font-mono text-xs tabular sm:grid-cols-4">
        <Stat label="Gearbox" value={trLabel(box.transmission)} sub={`${box.ratios.length} gears · ${Math.round(box.shiftTimeS * 1000)} ms`} />
        <Stat label="Layout" value={layout.layout.toUpperCase()} sub={`${Math.round(layout.frontTorqueShare * 100)}% front torque`} />
        <Stat label="Differential" value={{ open: "Open", "clutch-lsd": "Clutch LSD", "helical-lsd": "Helical LSD" }[diff.diffType]} sub={`final drive ${tune.finalDrive.toFixed(2)}`} />
        <Stat label="Clutch" value={box.integratedClutch ? "Built-in" : `${clutch.capacityNm}`} unit={box.integratedClutch ? "" : "Nm"} sub={box.integratedClutch ? (box.transmission === "automatic" ? "torque converter" : "wet clutches") : `launch ${clutch.launchRpm} rpm`} />
      </div>

      {live ? (
        <div className="grid grid-cols-3 gap-2">
          <Stat label="Speed" value={live.sample.kmh.toFixed(0)} unit="km/h" />
          <Stat label="Gear" value={`${live.sample.gear}`} sub={live.sample.wheelspin ? "wheelspin" : undefined} />
          <Stat label="RPM" value={live.sample.rpm.toLocaleString("en-US")} sub={`${live.upTo.toFixed(1)} s`} />
        </div>
      ) : v ? (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Stat label="0-100 km/h" value={v.zeroTo100S?.toFixed(2) ?? "—"} unit="s" />
          <Stat label="0-200 km/h" value={v.zeroTo200S?.toFixed(2) ?? "—"} unit="s" />
          <Stat label="Quarter mile" value={v.quarterMileS?.toFixed(2) ?? "—"} unit="s" sub={v.quarterMileKmh ? `trap ${v.quarterMileKmh} km/h` : undefined} />
          <Stat label="Top speed" value={`${v.topSpeedKmh}`} unit="km/h" sub={`gear ${v.topSpeedGear} · ${v.topSpeedLimit === "drag" ? "drag-limited" : "rev-limited"}`} />
          <Stat label="Mass" value={`${v.massKg}`} unit="kg" sub={`${Math.round(v.frontWeight * 100)}% front`} />
          <Stat label="Driveline efficiency" value={`${(v.drivetrainEfficiency * 100).toFixed(1)}`} unit="%" />
          <Stat label="Wheel power" value={`${shown?.wheelPowerHp.toFixed(0)}`} unit="whp" />
          <Stat label="Wheelspin until" value={v.tractionLimitedToKmh ? `${v.tractionLimitedToKmh}` : "none"} unit={v.tractionLimitedToKmh ? "km/h" : ""} />
        </div>
      ) : (
        <div className="rounded-md border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
          {game.lastRunKey ? "The configuration has changed since the last test. Run the track test (or the dyno) to measure it." : "No measurements yet. Run the track test to time this build."}
        </div>
      )}

      <section className="space-y-3 rounded-md border border-border bg-card p-3">
        <div className="flex items-center justify-between">
          <h3 className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Gear ratios</h3>
          <Button
            size="sm"
            variant="ghost"
            disabled={running || (!box.adjustable && fdFixed)}
            onClick={() => updateTune({ gearRatios: [...box.ratios], finalDrive: diff.finalDrive })}
          >
            <RotateCcw /> Defaults
          </Button>
        </div>
        {!box.adjustable && <p className="text-[11px] text-muted-foreground">The {box.name} has fixed ratios. A close-ratio manual, dual-clutch or sequential box can be re-cut.</p>}
        <div className="space-y-2.5">
          {tune.gearRatios.map((r, i) => {
            const [lo, hi] = gearRatioLimits(box.ratios[i] ?? r);
            const kmh = Math.round(((tune.revLimit * 2 * Math.PI * VEHICLE.tyreRadiusM) / 60 / (r * tune.finalDrive)) * 3.6);
            return (
              <div key={i} className="grid grid-cols-[3rem_1fr_7.5rem] items-center gap-3">
                <span className="font-mono text-xs" style={{ color: GEAR_COLORS[i] }}>
                  Gear {i + 1}
                </span>
                <Slider value={[r]} min={lo} max={hi} step={0.01} disabled={running || !box.adjustable} onValueChange={([x]) => x !== undefined && setRatio(i, x)} aria-label={`Gear ${i + 1} ratio`} />
                <span className="text-right font-mono text-xs tabular">
                  {r.toFixed(2)} <span className="text-muted-foreground">· {kmh} km/h</span>
                </span>
              </div>
            );
          })}
          <div className="grid grid-cols-[3rem_1fr_7.5rem] items-center gap-3 border-t border-border pt-2.5">
            <span className="font-mono text-xs">Final</span>
            <Slider
              value={[tune.finalDrive]}
              min={diff.finalDriveRange[0]}
              max={diff.finalDriveRange[1]}
              step={0.01}
              disabled={running || fdFixed}
              onValueChange={([x]) => x !== undefined && updateTune({ finalDrive: Math.round(x * 100) / 100 })}
              aria-label="Final drive ratio"
            />
            <span className="text-right font-mono text-xs tabular">{tune.finalDrive.toFixed(2)}</span>
          </div>
          {fdFixed && <p className="text-[11px] text-muted-foreground">The open differential has one ratio. A limited-slip differential offers 3.20–4.60.</p>}
        </div>
      </section>

      <Chart title="Road speed vs engine speed, per gear">
        <LineChart data={speedRows} margin={{ top: 6, right: 6, bottom: 0, left: -12 }}>
          <CartesianGrid stroke="var(--border)" strokeDasharray="2 4" />
          <XAxis dataKey="rpm" type="number" domain={[0, tune.revLimit]} tick={axis} tickCount={6} />
          <YAxis tick={axis} unit="" />
          <Tooltip contentStyle={tooltipStyle} labelFormatter={(x) => `${x} rpm`} />
          {tune.gearRatios.map((_, i) => (
            <Line key={i} dataKey={`g${i + 1}`} name={`Gear ${i + 1} km/h`} stroke={GEAR_COLORS[i]} strokeWidth={2} dot={false} isAnimationActive={false} />
          ))}
        </LineChart>
      </Chart>

      {shown && (
        <>
          <Chart title="Drive force at the tyres per gear vs road load (N)" height="h-56">
            <LineChart data={forceRows} margin={{ top: 6, right: 6, bottom: 0, left: -4 }}>
              <CartesianGrid stroke="var(--border)" strokeDasharray="2 4" />
              <XAxis dataKey="kmh" type="number" tick={axis} tickCount={7} unit="" />
              <YAxis tick={axis} />
              <Tooltip contentStyle={tooltipStyle} labelFormatter={(x) => `${x} km/h`} />
              {tune.gearRatios.map((_, i) => (
                <Line key={i} dataKey={`g${i + 1}`} name={`Gear ${i + 1}`} stroke={GEAR_COLORS[i]} strokeWidth={2} dot={false} isAnimationActive={false} connectNulls={false} />
              ))}
              <Line dataKey="load" name="Drag + rolling" stroke="var(--destructive)" strokeDasharray="5 4" strokeWidth={1.5} dot={false} isAnimationActive={false} />
            </LineChart>
          </Chart>
          <Chart title="Standing start: speed vs time (km/h)">
            <LineChart data={traceRows} margin={{ top: 6, right: 6, bottom: 0, left: -12 }}>
              <CartesianGrid stroke="var(--border)" strokeDasharray="2 4" />
              <XAxis dataKey="t" type="number" domain={[0, "dataMax"]} tick={axis} tickCount={8} unit="s" />
              <YAxis tick={axis} domain={[0, "auto"]} />
              <Tooltip contentStyle={tooltipStyle} labelFormatter={(x) => `${x} s`} />
              <Line dataKey="kmh" name="km/h" stroke="var(--chart-1)" strokeWidth={2.5} dot={false} isAnimationActive={false} />
            </LineChart>
          </Chart>
          <section className="rounded-md border border-border bg-card p-3">
            <h3 className="mb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Per-gear figures</h3>
            <table className="w-full font-mono text-xs tabular">
              <thead className="text-muted-foreground">
                <tr className="text-left">
                  <th className="font-normal">Gear</th>
                  <th className="font-normal">Ratio</th>
                  <th className="font-normal">Overall</th>
                  <th className="font-normal">km/h /1000</th>
                  <th className="font-normal">Max km/h</th>
                  <th className="font-normal">Wheel Nm</th>
                  <th className="font-normal">RPM after shift</th>
                </tr>
              </thead>
              <tbody>
                {shown.vehicle.gears.map((g) => (
                  <tr key={g.gear}>
                    <td style={{ color: GEAR_COLORS[g.gear - 1] }}>{g.gear}</td>
                    <td>{g.ratio.toFixed(2)}</td>
                    <td>{g.overall.toFixed(2)}</td>
                    <td>{g.kmhPer1000}</td>
                    <td>{g.maxKmh}</td>
                    <td>{g.peakWheelTorqueNm.toLocaleString("en-US")}</td>
                    <td>{g.rpmAfterShift || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
          {drivetrainDiag.length > 0 && (
            <ul className="space-y-1.5">
              {drivetrainDiag.map((d) => {
                const Icon = sevIcon[d.severity];
                return (
                  <li key={d.code} className="flex gap-2 rounded-md border border-border bg-card p-2 text-xs leading-snug">
                    <Icon className={cn("mt-px h-3.5 w-3.5 shrink-0", sevColor[d.severity])} />
                    <div className="space-y-1">
                      <p className="font-medium">{d.message}</p>
                      {d.cause && <p className="text-muted-foreground">{d.cause}</p>}
                      {d.fixes?.map((f) => (
                        <p key={f}>
                          <span className="text-primary">→ </span>
                          {f}
                        </p>
                      ))}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}
      <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
        <Timer className="h-3 w-3" /> Track test plays back {PLAYBACK_SPEED}× faster than real time. <Gauge className="ml-1 h-3 w-3" /> Tyres: μ {VEHICLE.tyreMu}, {VEHICLE.tyreRadiusM * 1000} mm radius.
      </p>
    </div>
  );
}
