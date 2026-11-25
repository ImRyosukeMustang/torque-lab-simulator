import { ArrowBigDown, ArrowBigUp, Flag, Footprints, RotateCcw, Trophy, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { engineAudio } from "../audio";
import { createActiveClock, getGamePlatform } from "../platform";
import { raceSound } from "../raceSound";
import { sampleCurve, simulate } from "../sim/engine";
import { getPart } from "../sim/parts";
import {
  ghostAt,
  isRaceUnlocked,
  launch,
  makeRaceCar,
  newCarState,
  RACE_DISTANCE_LABEL,
  RACE_DISTANCE_M,
  RACE_DT,
  RACE_EVENTS,
  RIVALS,
  rivalGhost,
  rivalBuild,
  rivalRating,
  shiftDown,
  shiftUp,
  stepCar,
  TYRE_RADIUS_M,
  wantsUpshift,
  type ShiftQuality,
} from "../sim/race";
import { soundProfile } from "../soundProfile";
import { useGame, type RaceConfig } from "../store";
import { AdButton } from "../ui/AdButton";
import { fmtCredits } from "../ui/format";
import { speed, speedUnit, speedValue } from "../units";
import { ChristmasTree, type TreeState } from "./ChristmasTree";
import { drawRace, newRaceView, type Kit } from "./drawRace";
import { Tachometer } from "./Tachometer";

interface Hud {
  t: number;
  rpm: number;
  gear: number;
  kmh: number;
  x: number;
  rivalX: number;
  launched: boolean;
  tree: TreeState;
  rivalTree: TreeState;
  message: { text: string; tone: "good" | "bad" | "info"; key: number } | null;
}

interface ResultInfo {
  won: boolean;
  foul: boolean;
  dnf: boolean;
  rt: number | null;
  sixty: number | null;
  et: number | null;
  total: number | null;
  trap: number | null;
  rivalTotal: number | null;
  rivalEt: number | null;
  rivalTrap: number | null;
  purse: number;
  firstWin: boolean;
}

const GAS_KEYS = new Set(["ArrowUp", "KeyW"]);
const UP_KEYS = new Set(["Space", "ArrowRight", "KeyE"]);
const DOWN_KEYS = new Set(["ShiftLeft", "ShiftRight", "ArrowLeft", "KeyQ"]);
const OFF: TreeState = { prestage: false, stage: false, ambers: 0, green: false, red: false };
const fmtS = (v: number | null) => (v === null ? "—" : `${v.toFixed(3)} s`);

function kitOf(build: Record<string, string>): Kit {
  return {
    aero: getPart("aero", build["aero"] ?? "aero-stock").style,
    wing: getPart("wing", build["wing"] ?? "wing-ducktail").style,
    body: getPart("body", build["body"] ?? "body-stock").style,
  };
}

export function RaceScreen({ cfg }: { cfg: RaceConfig }) {
  const exitRace = useGame((s) => s.exitRace);
  const startRace = useGame((s) => s.startRace);
  const grantCredits = useGame((s) => s.grantCredits);
  const units = useGame((s) => s.settings.units);
  const canvas = useRef<HTMLCanvasElement>(null);
  const input = useRef({ gas: false, up: 0, down: 0 });
  const [runKey, setRunKey] = useState(0);
  const [hud, setHud] = useState<Hud | null>(null);
  const [result, setResult] = useState<ResultInfo | null>(null);
  const [doubled, setDoubled] = useState(false);
  const [gasDown, setGasDown] = useState(false);
  const rival = RIVALS.find((r) => r.id === cfg.rivalId)!;
  const event = cfg.eventId ? RACE_EVENTS.find((e) => e.id === cfg.eventId) ?? null : null;
  const carInfo = useRef<{ revLimit: number; shiftRpm: number[]; launchWindow: [number, number] } | null>(null);

  useEffect(() => {
    const el = canvas.current;
    if (!el) return;
    const ctx = el.getContext("2d");
    if (!ctx) return;
    const store = useGame.getState();
    const { game, settings } = store;
    const sim = simulate(game.build, game.tune);
    const car = makeRaceCar(game.build, game.tune, sim, { rimStyle: game.cosmetics.rimStyle });
    carInfo.current = { revLimit: car.revLimit, shiftRpm: car.shiftRpm, launchWindow: car.launchWindow };
    const ghost = rivalGhost(cfg.rivalId, cfg.distance);
    const dist = RACE_DISTANCE_M[cfg.distance];
    const s = newCarState();
    const treeDelay = 0.7 + Math.random() * 1.1;
    const startT = -(2.6 + treeDelay);
    s.t = startT;
    const view = newRaceView();
    const look = game.cosmetics;
    const kit = kitOf(game.build);
    const rivalKit = kitOf(rivalBuild(rival).build as unknown as Record<string, string>);
    const rivalTag = `${rival.name.toUpperCase()} · ${rivalRating(rival.id)}`;
    const GLOSS = { matte: 0, satin: 0.3, gloss: 0.6, metallic: 0.8, pearl: 1 } as const;
    let wheel = 0;
    let rivalWheel = 0;
    let thr = 0;
    let acc = 0;
    const platform = getGamePlatform();
    const clock = createActiveClock(platform);
    let last = clock.now();
    let lastHud = 0;
    let lastLimiter = false;
    let lastAmbers = 0;
    let staged = false;
    let green = false;
    let ended = false;
    let foul = false;
    let msg: Hud["message"] = { text: "Hold GAS to rev · LAUNCH on green", tone: "info", key: 0 };
    let msgUntil = Infinity;
    let raf = 0;
    input.current = { gas: false, up: 0, down: 0 };
    setResult(null);
    setDoubled(false);
    if (settings.sound) engineAudio.start({ volume: settings.volume, profile: soundProfile(game.build) });
    const say = (text: string, tone: "good" | "bad" | "info", forS = 1.1) => {
      msg = { text, tone, key: performance.now() };
      msgUntil = s.t + forS;
    };
    const onShift = (q: ShiftQuality) => {
      if (q === "denied") return raceSound.denied();
      engineAudio.shift();
      view.shake = Math.max(view.shake, q === "late" ? 1 : 0.6);
      if (q === "perfect") {
        raceSound.perfectShift();
        say("PERFECT SHIFT", "good", 0.8);
      } else if (q === "early") say("EARLY SHIFT", "info", 0.7);
      else if (q === "late") say("LATE: ON THE LIMITER", "bad", 0.8);
    };

    const finish = (dnf: boolean) => {
      if (ended) return;
      ended = true;
      engineAudio.stop();
      raceSound.screech(0);
      const playerTotal = foul || dnf ? null : s.finishT;
      const rivalTotal = ghost.totalS;
      const won = !foul && !dnf && playerTotal !== null && (rivalTotal === null || playerTotal < rivalTotal);
      const out = useGame.getState().finishRace(cfg, { won, totalS: playerTotal, foul });
      if (won) {
        raceSound.win();
        getGamePlatform().happytime();
      } else raceSound.lose();
      setResult({
        won,
        foul,
        dnf,
        rt: s.launchT,
        sixty: s.sixtyFt,
        et: s.finishT !== null && s.launchT !== null ? s.finishT - s.launchT : null,
        total: playerTotal,
        trap: s.trapKmh,
        rivalTotal,
        rivalEt: ghost.elapsedS,
        rivalTrap: ghost.trapKmh,
        purse: out?.purse ?? 0,
        firstWin: out?.firstWin ?? false,
      });
    };

    const frame = (now: number) => {
      const clockNow = clock.now();
      const dt = Math.min(0.05, (clockNow - last) / 1000);
      last = clockNow;
      const inp = input.current;
      // Inputs
      while (inp.up > 0) {
        inp.up--;
        if (ended) break;
        if (!s.launched) {
          const ok = launch(s, car);
          if (!ok) {
            foul = true;
            raceSound.redLight();
            say("RED LIGHT: JUMPED THE START", "bad", 5);
            finish(false);
          } else {
            const rt = s.t;
            say(rt < 0.3 ? `GREAT LAUNCH · RT ${rt.toFixed(3)}` : `RT ${rt.toFixed(3)}`, rt < 0.3 ? "good" : "info", 1.2);
          }
        } else if (s.finishT === null) onShift(shiftUp(car, s));
      }
      while (inp.down > 0) {
        inp.down--;
        if (!ended && s.launched && s.finishT === null) onShift(shiftDown(car, s));
      }
      if (!ended && s.launched && s.finishT === null && useGame.getState().settings.autoShift && s.shiftLeft <= 0) {
        if (wantsUpshift(car, s)) onShift(shiftUp(car, s));
      }
      // Throttle ramps so taps can feather wheelspin.
      const want = inp.gas && (s.finishT === null || !s.launched) && !ended ? 1 : 0;
      thr += (want - thr) * Math.min(1, dt / (want > thr ? 0.12 : 0.08));
      // Physics
      if (!ended || s.finishT !== null) {
        acc += dt;
        while (acc >= RACE_DT) {
          stepCar(car, s, s.finishT !== null ? 0 : thr, dist);
          acc -= RACE_DT;
        }
      }
      if (!s.limiter && lastLimiter === false) {
        /* no-op */
      }
      if (s.limiter && !lastLimiter) engineAudio.limiter(0.1);
      lastLimiter = s.limiter;
      // Tree
      if (!staged && s.t > startT + 0.4) {
        staged = true;
        raceSound.stage();
      }
      const ambers = s.t >= -0.5 ? 3 : s.t >= -1 ? 2 : s.t >= -1.5 ? 1 : 0;
      if (ambers > lastAmbers && !green) raceSound.amber();
      lastAmbers = ambers;
      if (!green && s.t >= 0 && !foul) {
        green = true;
        raceSound.green();
        if (!s.launched) say("GO!", "good", 0.6);
      }
      const g = ghostAt(ghost, s.t);
      const done = s.finishT !== null;
      const rivalDone = ghost.totalS !== null && s.t >= ghost.totalS;
      if (!ended && done && (rivalDone || s.t > s.finishT! + 2.5)) finish(false);
      if (!ended && !done && rivalDone && s.t > ghost.totalS! + 12) finish(true);
      if (!ended && s.t > 95) finish(true);

      wheel += (s.v / TYRE_RADIUS_M) * dt * (s.spinning ? 1.6 : 1);
      rivalWheel += ((g.kmh / 3.6) / TYRE_RADIUS_M) * dt;
      const rect = el.getBoundingClientRect();
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      if (el.width !== Math.round(rect.width * dpr) || el.height !== Math.round(rect.height * dpr)) {
        el.width = Math.round(rect.width * dpr);
        el.height = Math.round(rect.height * dpr);
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      drawRace(ctx, rect.width, rect.height, view, {
        t: s.t,
        dt,
        distance: dist,
        units: useGame.getState().settings.units,
        player: { x: s.x, kmh: s.v * 3.6, accel: s.a, spin: s.spin, pop: s.pop, wheelAngle: wheel, paint: look.paint, rim: look.rimColor, tint: look.tint, kit, ghost: false, rimStyle: look.rimStyle, caliper: look.caliper, stripe: look.stripe, stripeColor: look.stripeColor, ...(look.underglow ? { underglowColor: look.underglowColor } : {}), gloss: GLOSS[look.finish] },
        rival: { x: g.x, kmh: g.kmh, accel: 0, spin: g.spin, pop: g.pop, wheelAngle: rivalWheel, paint: rival.paint, rim: "#9ea3a8", tint: 0.6, kit: rivalKit, ghost: true, label: rivalTag },
      });
      // Sound
      if (!ended) {
        const boost = sampleCurve(sim.curve, s.rpm).boostBar * thr * (s.launched ? 1 : 0.35);
        engineAudio.update(s.rpm, s.launched ? thr : thr * 0.5, boost);
        raceSound.screech(s.spin);
      }
      if (s.t > msgUntil) msg = null;
      if (now - lastHud > 33) {
        lastHud = now;
        const lit = (t: number): TreeState => ({ prestage: t > startT + 0.2, stage: t > startT + 0.4, ambers, green: s.t >= 0 && !foul, red: foul });
        setHud({
          t: s.t,
          rpm: s.rpm,
          gear: s.gear + 1,
          kmh: s.v * 3.6,
          x: s.x,
          rivalX: g.x,
          launched: s.launched,
          tree: lit(s.t),
          rivalTree: { ...lit(s.t), red: false },
          message: msg,
        });
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    const unsubscribe = platform.subscribe((event) => {
      if (event === "pause") {
        input.current = { gas: false, up: 0, down: 0 };
        setGasDown(false);
      }
    });

    const isTyping = (e: KeyboardEvent) => e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement;
    const down = (e: KeyboardEvent) => {
      if (isTyping(e)) return;
      if (GAS_KEYS.has(e.code)) {
        input.current.gas = true;
        setGasDown(true);
        e.preventDefault();
      } else if (UP_KEYS.has(e.code)) {
        if (!e.repeat) input.current.up++;
        e.preventDefault();
      } else if (DOWN_KEYS.has(e.code)) {
        if (!e.repeat) input.current.down++;
        e.preventDefault();
      }
    };
    const up = (e: KeyboardEvent) => {
      if (GAS_KEYS.has(e.code)) {
        input.current.gas = false;
        setGasDown(false);
      }
    };
    const blur = () => {
      input.current.gas = false;
      setGasDown(false);
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", blur);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", blur);
      unsubscribe();
      clock.dispose();
      engineAudio.kill();
      raceSound.stopAll();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runKey, cfg.eventId, cfg.rivalId, cfg.distance]);

  // Q quits (portals reserve Esc for leaving fullscreen); Enter rematches from the results card.
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (e.code === "KeyQ") exitRace();
      if (e.code === "Enter" && result) setRunKey((x) => x + 1);
    };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [exitRace, result]);

  const info = carInfo.current;
  const dist = RACE_DISTANCE_M[cfg.distance];
  const nextEvent = event ? RACE_EVENTS[RACE_EVENTS.findIndex((e) => e.id === event.id) + 1] : undefined;
  const wins = useGame((s) => s.game.raceWins);
  const nextOpen = nextEvent && isRaceUnlocked(nextEvent.id, wins);
  const press = (k: "up" | "down") => (e: React.PointerEvent) => {
    e.preventDefault();
    input.current[k]++;
  };
  const gas = (on: boolean) => (e: React.PointerEvent) => {
    e.preventDefault();
    input.current.gas = on;
    setGasDown(on);
  };

  return (
    <div className="absolute inset-0 z-40 overflow-hidden bg-viewport" data-sound="none">
      <canvas ref={canvas} className="absolute inset-0 h-full w-full" aria-label="Drag strip, side view" />
      {hud && (
        <>
          <div className="pointer-events-none absolute left-3 top-3">
            <ChristmasTree you={hud.tree} rival={hud.rivalTree} />
          </div>
          <div className="pointer-events-none absolute left-1/2 top-3 w-[min(520px,52vw)] -translate-x-1/2 space-y-1">
            <div className="flex items-baseline justify-between font-mono text-[11px] text-muted-foreground">
              <span className="font-display text-sm font-semibold uppercase tracking-widest text-foreground">{event?.title ?? "Free run"}</span>
              <span>
                {RACE_DISTANCE_LABEL[cfg.distance]} · {hud.t > 0 ? `${hud.t.toFixed(2)} s` : "staging"}
              </span>
            </div>
            <div className="relative h-2.5 rounded-full bg-background/70">
              <span className="absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-background bg-ghost" style={{ left: `${Math.min(100, (hud.rivalX / dist) * 100)}%` }} />
              <span className="absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-background bg-primary" style={{ left: `${Math.min(100, (hud.x / dist) * 100)}%` }} />
            </div>
            <div className="flex justify-between text-[10px] uppercase tracking-widest">
              <span className="text-primary">You</span>
              <span className="text-ghost">
                {rival.name} · {rival.car} · rating {rivalRating(rival.id)}
              </span>
            </div>
          </div>
          <Button variant="secondary" size="sm" className="absolute right-3 top-3 z-10" onClick={exitRace} aria-label="Quit race">
            <X /> Quit
          </Button>
          {hud.message && (
            <div key={hud.message.key} className="pointer-events-none absolute left-1/2 top-[22%] -translate-x-1/2 animate-pop-in text-center">
              <span className={cn("font-display text-3xl font-bold uppercase tracking-wider drop-shadow-lg sm:text-5xl", hud.message.tone === "good" ? "text-tree-green" : hud.message.tone === "bad" ? "text-destructive" : "text-foreground")}>
                {hud.message.text}
              </span>
            </div>
          )}
          <div className="pointer-events-none absolute bottom-2 left-1/2 -translate-x-1/2">
            <Tachometer
              rpm={hud.rpm}
              revLimit={info?.revLimit ?? 7000}
              shiftRpm={info?.shiftRpm[hud.gear - 1] ?? null}
              launchWindow={info?.launchWindow ?? null}
              launched={hud.launched}
              gear={hud.gear}
              speed={Math.round(speedValue(hud.kmh, units)).toString()}
              speedUnit={speedUnit(units)}
            />
          </div>
          {!result && (
            <>
              <div className="absolute bottom-4 left-3 flex flex-col gap-2 sm:left-5">
                <Button variant="pedal" size="pedal" onPointerDown={press("up")} aria-label={hud.launched ? "Shift up" : "Launch"}>
                  <ArrowBigUp className="!size-6" /> {hud.launched ? "Up" : "Launch"}
                </Button>
                <Button variant="pedal" size="pedal" onPointerDown={press("down")} aria-label="Shift down" disabled={!hud.launched}>
                  <ArrowBigDown className="!size-6" /> Down
                </Button>
              </div>
              <div className="absolute bottom-4 right-3 sm:right-5">
                <Button
                  variant="pedal"
                  size="pedal"
                  className="h-40 w-28 sm:h-44 sm:w-32"
                  data-pressed={gasDown}
                  onPointerDown={gas(true)}
                  onPointerUp={gas(false)}
                  onPointerLeave={gas(false)}
                  onPointerCancel={gas(false)}
                  onContextMenu={(e) => e.preventDefault()}
                  aria-label="Gas pedal"
                >
                  <Footprints className="!size-6" /> Gas
                </Button>
              </div>
              <p className="pointer-events-none absolute bottom-3 left-1/2 hidden -translate-x-1/2 translate-y-full font-mono text-[10px] text-muted-foreground lg:block" />
              <div className="pointer-events-none absolute right-36 top-16 hidden rounded-md border border-border bg-background/70 px-3 py-2 font-mono text-[11px] leading-relaxed text-muted-foreground backdrop-blur lg:block">
                <div><kbd className="text-foreground">W / ↑</kbd> gas (hold)</div>
                <div><kbd className="text-foreground">Space / →</kbd> launch · shift up</div>
                <div><kbd className="text-foreground">Shift / ←</kbd> shift down</div>
                <div><kbd className="text-foreground">Q</kbd> quit</div>
              </div>
            </>
          )}
        </>
      )}
      {result && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-background/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md animate-pop-in space-y-4 rounded-xl border border-border bg-card p-5 shadow-2xl">
            <div className="text-center">
              <div className={cn("font-display text-5xl font-bold uppercase tracking-wider", result.won ? "text-tree-green" : "text-destructive")}>
                {result.foul ? "Red light" : result.dnf ? "Did not finish" : result.won ? "You win" : "You lose"}
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                {result.foul
                  ? "You left before the green. Wait for the green bulb, then launch."
                  : result.won && result.rivalTotal !== null && result.total !== null
                    ? `Beat ${rival.name} by ${(result.rivalTotal - result.total).toFixed(3)} s`
                    : result.total !== null && result.rivalTotal !== null
                      ? `${rival.name} won by ${(result.total - result.rivalTotal).toFixed(3)} s`
                      : `${rival.name} took the win.`}
              </p>
            </div>
            <table className="w-full font-mono text-xs tabular">
              <thead className="text-[10px] uppercase tracking-widest text-muted-foreground">
                <tr>
                  <th className="text-left font-normal" />
                  <th className="text-right font-normal text-primary">You</th>
                  <th className="text-right font-normal text-ghost">{rival.name}</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Reaction</td>
                  <td className="text-right">{fmtS(result.rt)}</td>
                  <td className="text-right">{fmtS(rival.skill.reactionS)}</td>
                </tr>
                <tr>
                  <td>60 ft</td>
                  <td className="text-right">{fmtS(result.sixty)}</td>
                  <td className="text-right">{fmtS(rivalGhost(cfg.rivalId, cfg.distance).sixtyFtS)}</td>
                </tr>
                <tr>
                  <td>Elapsed time</td>
                  <td className="text-right">{fmtS(result.et)}</td>
                  <td className="text-right">{fmtS(result.rivalEt)}</td>
                </tr>
                <tr>
                  <td>Trap speed</td>
                  <td className="text-right">{result.trap ? speed(result.trap, units) : "—"}</td>
                  <td className="text-right">{result.rivalTrap ? speed(result.rivalTrap, units) : "—"}</td>
                </tr>
                <tr className="font-semibold">
                  <td>Total from green</td>
                  <td className="text-right">{fmtS(result.total)}</td>
                  <td className="text-right">{fmtS(result.rivalTotal)}</td>
                </tr>
              </tbody>
            </table>
            {result.purse > 0 && (
              <div className="flex items-center justify-between gap-3 rounded-md border border-primary/40 bg-primary/10 p-3">
                <div>
                  <div className="text-[10px] font-semibold uppercase tracking-widest text-primary">{result.firstWin ? "Purse" : "Rematch purse"}</div>
                  <div className="font-mono text-lg">{fmtCredits(result.purse * (doubled ? 2 : 1))}</div>
                </div>
                <AdButton
                  variant="reward"
                  size="sm"
                  disabled={doubled}
                  onReward={() => {
                    grantCredits(result.purse);
                    setDoubled(true);
                  }}
                >
                  {doubled ? "Doubled" : "Double purse"}
                </AdButton>
              </div>
            )}
            {event && result.won && result.firstWin && event.id === "r1" && (
              <p className="rounded-md border border-tree-green/40 bg-tree-green/10 p-2.5 text-center text-sm">
                <Trophy className="mr-1 inline h-4 w-4 text-tree-green" /> Full workshop unlocked: Dyno Lab, Drivetrain and 50 Career contracts.
              </p>
            )}
            <div className="flex flex-wrap gap-2">
              <Button className="flex-1" variant="outline" onClick={() => setRunKey((k) => k + 1)}>
                <RotateCcw /> Rematch
              </Button>
              {result.won && nextEvent && nextOpen ? (
                <Button className="flex-1" variant="race" onClick={() => startRace({ eventId: nextEvent.id, rivalId: nextEvent.rival, distance: nextEvent.distance })}>
                  <Flag /> Next: {nextEvent.title}
                </Button>
              ) : null}
              <Button className="flex-1" variant="secondary" onClick={exitRace}>
                Garage
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
