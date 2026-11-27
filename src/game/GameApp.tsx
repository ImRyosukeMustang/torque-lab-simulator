import { Play } from "lucide-react";
import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { getAudioContext } from "./audioCore";
import { getGamePlatform } from "./platform";
import { trackGameLoaded, trackSessionLength, trackTutorialAbandoned } from "./telemetry";
import { RaceScreen } from "./race/RaceScreen";
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

const GameCanvas = lazy(() =>
  import("./scene/GameCanvas").then((module) => ({ default: module.GameCanvas })),
);

/** One click before anything plays: unlocks Web Audio inside the portal's cross-origin iframe. */
function StartSplash({ onStart, loading = false }: { onStart: () => void; loading?: boolean }) {
  const tutorial = useGame((s) => s.game.tutorial !== "done");
  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-background/85 p-6 backdrop-blur">
      <div className="max-w-md animate-pop-in space-y-5 text-center">
        <div className="font-display text-5xl font-bold tracking-[0.2em]">AUTOMECH</div>
        <p className="text-sm text-muted-foreground">
          {loading
            ? "Loading the workshop scene…"
            : tutorial
              ? "Build the engine. Tune it. Beat your rival on the drag strip."
              : "Welcome back to the workshop."}
        </p>
        <Button variant="race" size="lg" className="h-14 px-10 text-xl" onClick={onStart} disabled={loading} autoFocus>
          <Play /> {loading ? "Loading…" : tutorial ? "Start" : "Continue"}
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
  const [platformReady, setPlatformReady] = useState(false);
  const [sceneReady, setSceneReady] = useState(false);
  const startupAt = useRef(
    performance.getEntriesByType("navigation")[0]?.startTime ?? performance.now(),
  );
  const appReadyAt = useRef<number | null>(null);
  const loadedEventSent = useRef(false);
  const sessionHasStarted = useRef(false);
  const gameHasStarted = useRef(false);
  const sessionActiveFrom = useRef<number | null>(null);
  const sessionElapsedMs = useRef(0);

  useEffect(() => {
    let alive = true;
    const platform = getGamePlatform();
    void (async () => {
      await platform.initialize();
      if (!alive) return;
      await load();
      if (!alive) return;
      await platform.ready();
      appReadyAt.current = performance.now();
      setPlatformReady(true);
    })().catch((error: unknown) => {
      if (!alive) return;
      console.error("Game platform initialization failed:", error);
      toast.error("Game could not start", {
        description:
          error instanceof Error ? error.message : "The platform integration failed to initialize.",
      });
    });
    return () => {
      alive = false;
    };
  }, [load]);

  useEffect(() => {
    if (!loaded || !platformReady || !sceneReady || loadedEventSent.current) return;
    const appReady = appReadyAt.current;
    if (appReady === null) return;
    loadedEventSent.current = true;
    trackGameLoaded({
      startupMs: Math.round(appReady - startupAt.current),
      sceneReadyMs: Math.round(performance.now() - startupAt.current),
      firstContentfulPaintMs:
        performance.getEntriesByName("first-contentful-paint")[0]?.startTime ?? null,
      platform: getGamePlatform().id,
      quality: useGame.getState().settings.quality,
      deviceMemoryGb:
        "deviceMemory" in navigator && typeof navigator.deviceMemory === "number"
          ? navigator.deviceMemory
          : null,
      cpuCores: navigator.hardwareConcurrency || null,
    });
  }, [loaded, platformReady, sceneReady]);

  useEffect(() => {
    const onVisibilityChange = () => {
      const now = performance.now();
      if (document.hidden) {
        if (sessionActiveFrom.current !== null) {
          sessionElapsedMs.current += now - sessionActiveFrom.current;
          sessionActiveFrom.current = null;
        }
      } else if (sessionHasStarted.current && sessionActiveFrom.current === null) {
        sessionActiveFrom.current = now;
      }
    };
    const onPageHide = () => {
      const now = performance.now();
      if (sessionActiveFrom.current !== null) {
        sessionElapsedMs.current += now - sessionActiveFrom.current;
        sessionActiveFrom.current = null;
      }
      if (!sessionHasStarted.current) return;
      const game = useGame.getState().game;
      trackSessionLength({ game, durationMs: sessionElapsedMs.current });
      trackTutorialAbandoned(game, "session_end");
      sessionElapsedMs.current = 0;
      sessionHasStarted.current = false;
    };
    const onPageShow = (event: PageTransitionEvent) => {
      if (event.persisted && gameHasStarted.current) {
        sessionHasStarted.current = true;
        sessionActiveFrom.current = performance.now();
      }
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("pagehide", onPageHide);
    window.addEventListener("pageshow", onPageShow);
    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("pagehide", onPageHide);
      window.removeEventListener("pageshow", onPageShow);
    };
  }, []);

  useEffect(() => {
    if (!loaded) return;
    const platform = getGamePlatform();
    if (started && !document.hidden) platform.gameplayStart();
    const unsubscribe = platform.subscribe((event) => {
      if (event === "pause") {
        platform.gameplayStop();
      } else {
        if (started && !document.hidden) platform.gameplayStart();
      }
    });
    return () => {
      unsubscribe();
      platform.gameplayStop();
    };
  }, [loaded, started]);
  useEffect(() => installGlobalClickSound(), []);

  const panel = tab === "workshop" ? <WorkshopPanel /> : tab === "dyno" ? <DynoPanel /> : tab === "drivetrain" ? <DrivetrainPanel /> : tab === "paint" ? <PaintPanel /> : tab === "race" ? <RacePanel /> : <CareerPanel />;

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-background text-foreground">
      <TopBar />
      <main className="relative flex min-h-0 flex-1 flex-col lg:flex-row">
        <div className="relative h-[42vh] shrink-0 bg-viewport lg:h-auto lg:flex-1">
          <Suspense fallback={<div className="absolute inset-0 bg-viewport" aria-label="Loading workshop scene" />}>
            <GameCanvas onSceneReady={() => setSceneReady(true)} />
          </Suspense>
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
      {loaded && (!started || !sceneReady) && (
        <StartSplash
          loading={started}
          onStart={() => {
            if (started) return;
            getAudioContext();
            sessionHasStarted.current = true;
            gameHasStarted.current = true;
            sessionActiveFrom.current = document.hidden ? null : performance.now();
            sessionElapsedMs.current = 0;
            setStarted(true);
          }}
        />
      )}
      <Toaster position="top-center" theme="dark" />
    </div>
  );
}
