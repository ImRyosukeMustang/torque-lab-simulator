import { useEffect } from "react";
import { Toaster } from "@/components/ui/sonner";
import { cn } from "@/lib/utils";
import { GameCanvas } from "./scene/GameCanvas";
import { useGame } from "./store";
import { CareerPanel } from "./ui/CareerPanel";
import { DynoPanel } from "./ui/DynoPanel";
import { TopBar } from "./ui/TopBar";
import { ViewportOverlay } from "./ui/ViewportOverlay";
import { WorkshopPanel } from "./ui/WorkshopPanel";

export function GameApp() {
  const tab = useGame((s) => s.tab);
  const loaded = useGame((s) => s.loaded);
  const load = useGame((s) => s.load);
  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-background text-foreground">
      <TopBar />
      <main className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <div className="relative h-[42vh] shrink-0 bg-viewport lg:h-auto lg:flex-1">
          <GameCanvas />
          <ViewportOverlay />
        </div>
        <aside
          className={cn(
            "min-h-0 flex-1 overflow-y-auto border-t border-border bg-sidebar lg:flex-none lg:border-l lg:border-t-0",
            tab === "dyno" ? "lg:w-[min(720px,52vw)]" : "lg:w-[420px]",
          )}
        >
          {loaded && (tab === "workshop" ? <WorkshopPanel /> : tab === "dyno" ? <DynoPanel /> : <CareerPanel />)}
        </aside>
      </main>
      <Toaster position="bottom-left" />
    </div>
  );
}
