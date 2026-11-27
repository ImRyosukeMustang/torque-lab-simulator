import { Car, Cpu, KeyRound, MousePointer2, PanelTopOpen, PanelTopClose } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { engineAudio } from "../audio";
import { describeSound, soundProfile } from "../soundProfile";
import { cn } from "@/lib/utils";
import { SLOT_LABEL, SLOT_ORDER } from "../sim/parts";
import { useGame } from "../store";

export function ViewportOverlay() {
  const view = useGame((s) => s.view);
  const hood = useGame((s) => s.hoodOpen);
  const hovered = useGame((s) => s.hoveredSlot);
  const setView = useGame((s) => s.setView);
  const setHood = useGame((s) => s.setHoodOpen);
  const selectSlot = useGame((s) => s.selectSlot);
  const build = useGame((s) => s.game.build);
  const settings = useGame((s) => s.settings);
  const dynoRunning = useGame((s) => s.dynoRunning);
  const [revving, setRevving] = useState(false);
  const cancelRev = useRef<(() => void) | null>(null);
  const timer = useRef(0);
  useEffect(
    () => () => {
      cancelRev.current?.();
      window.clearTimeout(timer.current);
    },
    [],
  );
  const startEngine = () => {
    cancelRev.current?.();
    window.clearTimeout(timer.current);
    cancelRev.current = engineAudio.revDemo({ volume: settings.volume, profile: soundProfile(build) });
    setRevving(true);
    timer.current = window.setTimeout(() => setRevving(false), 3800);
  };
  const traits = describeSound(soundProfile(build));

  const chip = (active: boolean) =>
    cn(
      "pointer-events-auto flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-medium backdrop-blur transition-colors",
      active ? "border-primary/60 bg-primary/20 text-foreground" : "border-border bg-background/70 text-muted-foreground hover:text-foreground",
    );

  return (
    <div className="pointer-events-none absolute inset-0 flex flex-col justify-between p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-wrap gap-1.5">
          <button className={chip(view === "exterior")} onClick={() => setView("exterior")}>
            <Car className="h-3.5 w-3.5" /> Exterior
          </button>
          <button className={chip(view === "bay")} onClick={() => setView("bay")}>
            <Cpu className="h-3.5 w-3.5" /> Engine bay
          </button>
          <button
            className={chip(revving)}
            onClick={startEngine}
            disabled={dynoRunning || !settings.sound}
            title={settings.sound ? `Listen to this build: ${traits.join(", ") || "stock sound"}` : "Sound is muted"}
          >
            <KeyRound className="h-3.5 w-3.5" /> {revving ? "Revving…" : "Start engine"}
          </button>
          <button className={chip(hood)} onClick={() => setHood(!hood)}>
            {hood ? <PanelTopClose className="h-3.5 w-3.5" /> : <PanelTopOpen className="h-3.5 w-3.5" />} {hood ? "Close bonnet" : "Open bonnet"}
          </button>
        </div>
        {hovered && (
          <div className="rounded-md border border-primary/50 bg-background/80 px-3 py-1.5 text-xs backdrop-blur">
            <span className="font-semibold">{SLOT_LABEL[hovered]}</span>
            <span className="text-muted-foreground"> · click to inspect</span>
          </div>
        )}
      </div>
      <div className="flex items-end justify-between gap-2">
        <div className="flex max-w-[min(74vw,850px)] shrink-0 gap-1.5 overflow-x-auto whitespace-nowrap pb-1">
          {SLOT_ORDER.map((s) => (
            <button
              key={s}
              className={cn(chip(view === s), "shrink-0")}
              onClick={() => selectSlot(s)}
              title={`Focus ${SLOT_LABEL[s]} and open its upgrade options`}
              aria-pressed={view === s}
            >
              {SLOT_LABEL[s]}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1.5 rounded-md bg-background/60 px-2 py-1 font-mono text-[10px] text-muted-foreground backdrop-blur">
          <MousePointer2 className="h-3 w-3" /> Drag rotate · Right-drag pan · Scroll zoom
        </div>
      </div>
    </div>
  );
}
