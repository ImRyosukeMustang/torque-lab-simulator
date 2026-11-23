import { Play } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Toaster } from "@/components/ui/sonner";
import { cn } from "@/lib/utils";
import { getAudioContext } from "./audioCore";
import { initCrazyGames, loadingStop } from "./crazygames";
import { RaceScreen } from "./race/RaceScreen";
import { GameCanvas } from "./scene/GameCanvas";
import { installGlobalClickSound } from "./uiSound";
import { useGame } from "./store";
import { CareerPanel } from "./ui/CareerPanel";
import { DrivetrainPanel } from "./ui/DrivetrainPanel";
import { DynoPanel } from "./ui/DynoPanel";
import { PaintPanel } from "./ui/PaintPanel";
import { RacePanel } from "./ui/RacePanel";
import { TopBar } from "./ui/TopBar";
import { ViewportOverlay } from "./ui/ViewportOverlay";
import { WorkshopPanel } from "./ui/WorkshopPanel";

/** One click before anything plays: unlocks Web Audio inside the portal's cross-origin iframe. */
function StartSplash({ onStart }: { onStart: () => void }) {
  const tutorial = useGame((s) => s.game.tutorial !== "done");
  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-background/85 p-6 backdrop-blur">
      <div className="max-w-md animate-pop-in space-y-5 text-center">
        <div className="font-display text-5xl font-bold tracking-[0.2em]">AUTOMECH</div>
        <p className="text-sm text-muted-foreground">
          {tutorial ? "Build the engine. Tune it. Beat your rival on the drag strip." : "Welcome back to the workshop."}
        </p>
        <Button variant="race" size="lg" className="h-14 px-10 text-xl" onClick={onStart} autoFocus>
          <Play /> {tutorial ? "Start" : "Continue"}
        </Button>
      </div>
    </div>
  );
}

export function GameApp() {
  const tab = useGame((s) => s.tab);
  const loaded = useGame((s) => s.loaded);
  const load = useGame((s) => s.load);
  const race = useGame((s) => s.race);
  const [started, setStarted] = useState(false);
  useEffect(() => {
    // Load the save after the portal SDK is ready, so its cloud save wins when present.
    let alive = true;
    void initCrazyGames().then(() => {
      if (!alive) return;
      load();
      loadingStop();
    });
    return () => {
      alive = false;
    };
  }, [load]);
  useEffect(() => installGlobalClickSound(), []);

  const panel = tab === "workshop" ? <WorkshopPanel /> : tab === "dyno" ? <DynoPanel /> : tab === "drivetrain" ? <DrivetrainPanel /> : tab === "paint" ? <PaintPanel /> : tab === "race" ? <RacePanel /> : <CareerPanel />;

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-background text-foreground">
      <TopBar />
      <main className="relative flex min-h-0 flex-1 flex-col lg:flex-row">
        <div className="relative h-[42vh] shrink-0 bg-viewport lg:h-auto lg:flex-1">
          <GameCanvas />
          <ViewportOverlay />
        </div>
        <aside
          className={cn(
            "min-h-0 flex-1 overflow-y-auto border-t border-border bg-sidebar lg:flex-none lg:border-l lg:border-t-0",
            tab === "dyno" || tab === "drivetrain" ? "lg:w-[min(720px,52vw)]" : "lg:w-[420px]",
          )}
        >
          {loaded && panel}
        </aside>
        {race && <RaceScreen cfg={race} />}
      </main>
      {loaded && !started && (
        <StartSplash
          onStart={() => {
            getAudioContext();
            setStarted(true);
          }}
        />
      )}
      <Toaster position="top-center" theme="dark" />
    </div>
  );
}
