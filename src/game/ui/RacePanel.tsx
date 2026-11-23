import { Check, Flag, Gauge, Lock, Medal, Timer, Trophy, Wrench } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { configKey } from "../sim/economy";
import { getPart } from "../sim/parts";
import { isRaceUnlocked, makeRaceCar, purseFor, RACE_DISTANCE_LABEL, RACE_EVENTS, RIVALS, rivalGhost, rivalPower, type RaceDistance } from "../sim/race";
import { useGame } from "../store";
import { pressure } from "../units";
import { fmtCredits } from "./format";

const DISTANCES: RaceDistance[] = ["quarter", "half", "mile"];

/** Street Rival intro: the 30-second hook before the full workshop opens. */
export function StreetRivalCard() {
  const game = useGame((s) => s.game);
  const selectSlot = useGame((s) => s.selectSlot);
  const startRace = useGame((s) => s.startRace);
  const skip = useGame((s) => s.skipTutorial);
  const units = useGame((s) => s.settings.units);
  const turbo = getPart("turbo", game.build.turbo).maximumFlow > 0;
  const boostSet = turbo && game.tune.boostTarget >= 0.4;
  const steps = [
    { done: turbo, label: "Bolt on the AT-25 turbo", action: !turbo ? <Button size="sm" variant="outline" onClick={() => selectSlot("turbo")}><Wrench /> Turbo parts</Button> : null },
    { done: boostSet, label: `Set boost (${pressure(game.tune.boostTarget, units)})`, action: turbo && !boostSet ? <Button size="sm" variant="outline" onClick={() => selectSlot("ecu")}>ECU</Button> : null },
    { done: false, label: "Beat Kai over the quarter mile", action: <Button size="sm" variant="race" onClick={() => startRace({ eventId: "r1", rivalId: "kai", distance: "quarter" })}><Flag /> Race</Button> },
  ];
  return (
    <section className="space-y-3 rounded-lg border border-primary/50 bg-primary/10 p-4 shadow-glow">
      <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-primary">Street Rival</div>
      <h2 className="font-display text-2xl font-bold leading-tight">Your rival's car makes 220 hp.</h2>
      <p className="text-sm text-muted-foreground">Bolt on a turbo, set boost, beat him on the strip. Win and the full workshop opens up.</p>
      <ol className="space-y-2">
        {steps.map((st, i) => (
          <li key={st.label} className="flex items-center justify-between gap-2 rounded-md border border-border bg-card/70 px-3 py-2">
            <span className="flex items-center gap-2 text-sm">
              <span className={cn("flex h-5 w-5 items-center justify-center rounded-full border text-[10px] font-semibold", st.done ? "border-success bg-success/20 text-success" : "border-border text-muted-foreground")}>
                {st.done ? <Check className="h-3 w-3" /> : i + 1}
              </span>
              {st.label}
            </span>
            {st.action}
          </li>
        ))}
      </ol>
      <button className="text-[11px] text-muted-foreground underline-offset-2 hover:text-foreground hover:underline" onClick={skip}>
        I know my way around: skip the intro
      </button>
    </section>
  );
}

export function RacePanel() {
  const game = useGame((s) => s.game);
  const startRace = useGame((s) => s.startRace);
  const settings = useGame((s) => s.settings);
  const setSettings = useGame((s) => s.setSettings);
  const key = configKey(game.build, game.tune);
  // Launch window and shift points for the current build (recomputed only when the build changes).
  const car = useMemo(() => makeRaceCar(game.build, game.tune), [key]); // eslint-disable-line react-hooks/exhaustive-deps
  const unlockedRivals = RIVALS.filter((r) => RACE_EVENTS.some((e) => e.rival === r.id && isRaceUnlocked(e.id, game.raceWins)));
  const [freeRival, setFreeRival] = useState(unlockedRivals[unlockedRivals.length - 1]?.id ?? "kai");
  const [freeDist, setFreeDist] = useState<RaceDistance>("quarter");
  const powers = useMemo(() => Object.fromEntries(RIVALS.map((r) => [r.id, rivalPower(r.id)])), []);
  const wins = Object.values(game.raceWins).filter((n) => n > 0).length;

  return (
    <div className="space-y-4 p-4">
      <div>
        <h2 className="font-display text-2xl font-semibold leading-none">Drag Strip</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Heads-up races against rival ghosts. Rev into the green zone, launch on the green light, shift yourself. {wins} of {RACE_EVENTS.length} events won.
        </p>
      </div>
      {game.tutorial !== "done" && <StreetRivalCard />}

      <section className="grid grid-cols-3 gap-2 font-mono text-xs tabular">
        <div className="rounded-md border border-border bg-card px-3 py-2">
          <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Launch</div>
          <div className="text-base">{car.idealLaunchRpm.toLocaleString("en-US")}</div>
          <div className="text-[10px] text-muted-foreground">rpm ideal</div>
        </div>
        <div className="col-span-2 rounded-md border border-border bg-card px-3 py-2">
          <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Shift points</div>
          <div className="truncate text-base">{car.shiftRpm.map((r) => (r / 1000).toFixed(1)).join(" · ") || "—"}</div>
          <div className="text-[10px] text-muted-foreground">x1000 rpm, gear 1 up</div>
        </div>
      </section>

      <section className="space-y-2">
        <h3 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Career ladder</h3>
        {RACE_EVENTS.map((ev, i) => {
          const open = isRaceUnlocked(ev.id, game.raceWins);
          const rival = RIVALS.find((r) => r.id === ev.rival)!;
          const won = game.raceWins[ev.id] ?? 0;
          const best = game.raceBest[ev.id];
          const ghost = open ? rivalGhost(ev.rival, ev.distance) : null;
          return (
            <div key={ev.id} className={cn("rounded-md border bg-card p-3", won ? "border-tree-green/40" : open ? "border-primary/40" : "border-border opacity-60")}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[11px] text-muted-foreground">{i + 1}</span>
                    <span className="font-display text-lg font-semibold leading-tight">{ev.title}</span>
                    {won > 0 && <Medal className="h-4 w-4 text-tree-green" aria-label="Won" />}
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    vs <span className="text-ghost">{rival.name}</span> · {rival.car} ({Math.round(powers[rival.id] ?? 0)} hp) · {RACE_DISTANCE_LABEL[ev.distance]}
                  </div>
                  <div className="mt-1 flex flex-wrap gap-x-3 font-mono text-[11px] tabular text-muted-foreground">
                    {ghost?.totalS && (
                      <span>
                        <Timer className="mr-0.5 inline h-3 w-3" /> rival {ghost.totalS.toFixed(2)} s
                      </span>
                    )}
                    {best !== undefined && <span className="text-foreground">best {best.toFixed(2)} s</span>}
                  </div>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1.5">
                  <span className="font-mono text-xs text-primary">{fmtCredits(purseFor(ev, won))}</span>
                  {open ? (
                    <Button size="sm" variant={won ? "outline" : "race"} onClick={() => startRace({ eventId: ev.id, rivalId: ev.rival, distance: ev.distance })}>
                      <Flag /> {won ? "Rematch" : "Race"}
                    </Button>
                  ) : (
                    <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                      <Lock className="h-3 w-3" /> Win #{i}
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
        <p className="text-[11px] text-muted-foreground">The full purse is paid on your first win. Rematches pay 10%.</p>
      </section>

      <section className="space-y-3 rounded-md border border-border bg-card p-3">
        <h3 className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          <Gauge className="h-3.5 w-3.5" /> Free run
        </h3>
        <p className="text-[11px] text-muted-foreground">Practise against any rival you've reached, at any distance. No purse, but your best times are saved.</p>
        <div className="grid grid-cols-3 gap-1.5">
          {unlockedRivals.map((r) => (
            <button key={r.id} type="button" aria-pressed={freeRival === r.id} onClick={() => setFreeRival(r.id)} className={cn("rounded-md border px-2 py-1.5 text-xs font-medium", freeRival === r.id ? "border-ghost/60 bg-ghost/15 text-foreground" : "border-border text-muted-foreground hover:text-foreground")}>
              {r.name}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-3 gap-1.5">
          {DISTANCES.map((d) => (
            <button key={d} type="button" aria-pressed={freeDist === d} onClick={() => setFreeDist(d)} className={cn("rounded-md border px-2 py-1.5 text-xs font-medium", freeDist === d ? "border-primary/60 bg-primary/15 text-foreground" : "border-border text-muted-foreground hover:text-foreground")}>
              {RACE_DISTANCE_LABEL[d]}
            </button>
          ))}
        </div>
        <div className="flex items-center justify-between">
          <span className="font-mono text-[11px] text-muted-foreground">
            best {game.raceBest[`free:${freeRival}:${freeDist}`]?.toFixed(2) ?? "—"} s
          </span>
          <Button size="sm" onClick={() => startRace({ eventId: null, rivalId: freeRival, distance: freeDist })}>
            <Trophy /> Free run
          </Button>
        </div>
      </section>

      <section className="space-y-2 rounded-md border border-border bg-card p-3 text-xs">
        <h3 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Driving</h3>
        <ul className="space-y-1 text-muted-foreground">
          <li><span className="text-foreground">Gas:</span> hold W or ↑ (or the GAS pedal). Tap it to feather wheelspin.</li>
          <li><span className="text-foreground">Launch / shift up:</span> Space or →. Leaving before green is a red light.</li>
          <li><span className="text-foreground">Shift down:</span> Shift or ←.</li>
          <li>Rev into the <span className="text-tree-green">green arc</span> before launch. Too low bogs, too high spins the tyres.</li>
          <li>Shift when the lights flash. Early shifts drop out of the power band, late ones bounce off the limiter.</li>
        </ul>
        <label className="flex items-center justify-between gap-2 pt-1">
          <span className="text-sm">Auto-shift assist</span>
          <Switch checked={settings.autoShift} onCheckedChange={(autoShift) => setSettings({ autoShift })} aria-label="Auto-shift assist" />
        </label>
      </section>
    </div>
  );
}
