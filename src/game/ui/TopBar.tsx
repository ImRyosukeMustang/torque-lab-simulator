import { Coins, Cog, RotateCcw, Gauge, Wrench, Trophy, Paintbrush, Settings2, Volume2, VolumeX, Flag, Lock, Maximize, Minimize } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { engineAudio } from "../audio";
import { AD_REWARD, configKey } from "../sim/economy";
import { buildCost } from "../sim/parts";
import { TUTORIAL_LOCKED_TABS, useGame, type Quality, type Tab } from "../store";
import { getGamePlatform } from "../platform";
import type { Units } from "../units";
import { AdButton } from "./AdButton";
import { fmtCredits } from "./format";

/** Minimum gap between "free credits" ads, so the offer stays a treat rather than a grind. */
const AD_COOLDOWN_MS = 3 * 60 * 1000;
let lastAdAt = -Infinity;

const TABS: { id: Tab; label: string; icon: typeof Wrench }[] = [
  { id: "workshop", label: "Workshop", icon: Wrench },
  { id: "dyno", label: "Dyno Lab", icon: Gauge },
  { id: "drivetrain", label: "Drivetrain", icon: Cog },
  { id: "paint", label: "Paint & Body", icon: Paintbrush },
  { id: "race", label: "Drag Strip", icon: Flag },
  { id: "career", label: "Career", icon: Trophy },
];

export function TopBar() {
  const game = useGame((s) => s.game);
  const tab = useGame((s) => s.tab);
  const setTab = useGame((s) => s.setTab);
  const resetSave = useGame((s) => s.resetSave);
  const lastResult = useGame((s) => s.lastResult);
  const dynoRunning = useGame((s) => s.dynoRunning);
  const fresh = lastResult && game.lastRunKey === configKey(game.build, game.tune);
  const tutorial = game.tutorial !== "done";
  const grantCredits = useGame((s) => s.grantCredits);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 5000);
    return () => window.clearInterval(id);
  }, []);
  const adReady = now - lastAdAt >= AD_COOLDOWN_MS;

  return (
    <header className="flex h-14 shrink-0 items-center gap-2 overflow-x-auto border-b border-border bg-sidebar px-2 sm:gap-4 sm:px-4">
      <div className="flex items-baseline gap-2">
        <span className="font-display text-xl font-bold tracking-[0.2em]">AUTOMECH</span>
        <span className="hidden font-mono text-[10px] text-muted-foreground xl:inline">0.6</span>
      </div>
      <nav className="flex items-center gap-1">
        {TABS.map(({ id, label, icon: Icon }) => {
          const locked = tutorial && TUTORIAL_LOCKED_TABS.includes(id);
          return (
          <button
            key={id}
            onClick={() => (locked ? toast("Beat your Street Rival first", { description: "Win the first drag race to open the full workshop." }) : setTab(id))}
            disabled={dynoRunning && id !== tab}
            aria-disabled={locked || undefined}
            data-sound={locked ? "none" : undefined}
            title={dynoRunning && id !== tab ? "Finish or abort the test run first" : locked ? `${label}: beat your Street Rival first` : label}
            className={cn(
              "flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40",
              tab === id ? "bg-accent text-foreground" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {locked ? <Lock className="h-4 w-4 opacity-60" /> : <Icon className={cn("h-4 w-4", tab === id && "text-primary", id === "race" && tutorial && "text-primary")} />}
            <span className={cn("hidden lg:inline", locked && "opacity-60")}>{label}</span>
          </button>
          );
        })}
      </nav>
      <div className="ml-auto flex items-center gap-2 font-mono text-xs tabular sm:gap-3">
        <div className="hidden flex-col items-end leading-tight 2xl:flex">
          <span className="text-[9px] uppercase tracking-widest text-muted-foreground">Build cost</span>
          <span>{fmtCredits(buildCost(game.build))}</span>
        </div>
        <div className="hidden flex-col items-end leading-tight 2xl:flex">
          <span className="text-[9px] uppercase tracking-widest text-muted-foreground">Reliability</span>
          <span>{fresh ? `${lastResult.reliability}%` : "—"}</span>
        </div>
        <div className="flex items-center gap-1.5 rounded-md border border-primary/40 bg-primary/10 px-2.5 py-1 text-sm text-primary" aria-label="Credits">
          <Coins className="h-4 w-4" />
          {fmtCredits(game.credits)}
        </div>
        <AdButton
          variant="reward"
          size="sm"
          disabled={!adReady}
          title={adReady ? `Watch a short ad for ${fmtCredits(AD_REWARD)}` : "Next bonus in a few minutes"}
          onReward={() => {
            lastAdAt = Date.now();
            setNow(Date.now());
            grantCredits(AD_REWARD);
            toast.success(`+${fmtCredits(AD_REWARD)}`, { description: "Thanks for watching. Spend it in the workshop." });
          }}
        >
          <span className="hidden sm:inline">+{AD_REWARD.toLocaleString("en-US")}</span>
        </AdButton>
        <FullscreenButton />
        <SettingsMenu />
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="ghost" size="icon" aria-label="Reset save">
              <RotateCcw />
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Start a new career?</AlertDialogTitle>
              <AlertDialogDescription>This erases your credits, parts, race wins and contract grades saved in this browser.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={resetSave}>Reset save</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </header>
  );
}


const QUALITY_LABEL: Record<Quality, string> = { ultra: "Ultra", high: "High", medium: "Medium", low: "Low" };
const UNITS_LABEL: Record<Units, string> = { metric: "Metric (km/h, Nm, °C)", imperial: "US (mph, lb-ft, °F)" };

function FullscreenButton() {
  const [full, setFull] = useState(false);
  useEffect(() => {
    const on = () => setFull(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", on);
    return () => document.removeEventListener("fullscreenchange", on);
  }, []);
  const supported = typeof document !== "undefined" && Boolean(document.documentElement.requestFullscreen);
  if (!supported || getGamePlatform().id !== "browser") return null;
  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label={full ? "Exit fullscreen" : "Fullscreen"}
      onClick={() => {
        if (document.fullscreenElement) void document.exitFullscreen().catch(() => {});
        else void document.documentElement.requestFullscreen().catch(() => toast.error("Fullscreen is blocked here", { description: "Your browser or the page embedding the game does not allow it." }));
      }}
    >
      {full ? <Minimize /> : <Maximize />}
    </Button>
  );
}

function SettingsMenu() {
  const settings = useGame((s) => s.settings);
  const save = useGame((s) => s.setSettings);
  const setSettings = (next: Parameters<typeof save>[0]) => {
    if (next.sound === false) engineAudio.kill(); // silence a pull already in progress
    save(next);
  };
  return (
    <div className="flex items-center">
      <Button variant="ghost" size="icon" aria-label={settings.sound ? "Mute engine sound" : "Unmute engine sound"} onClick={() => setSettings({ sound: !settings.sound })}>
        {settings.sound ? <Volume2 /> : <VolumeX />}
      </Button>
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="ghost" size="icon" aria-label="Settings">
            <Settings2 />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-64 space-y-4 font-sans">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Sound</span>
            <Switch checked={settings.sound} onCheckedChange={(sound) => setSettings({ sound })} aria-label="Sound" />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Workshop sound effects</span>
            <Switch checked={settings.uiSound} disabled={!settings.sound} onCheckedChange={(uiSound) => setSettings({ uiSound })} aria-label="Workshop sound effects" />
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium">Volume</span>
              <span className="font-mono text-xs text-muted-foreground">{Math.round(settings.volume * 100)}%</span>
            </div>
            <Slider value={[settings.volume]} min={0} max={1} step={0.05} disabled={!settings.sound} onValueChange={([v]) => v !== undefined && setSettings({ volume: v })} aria-label="Volume" />
          </div>
          <div className="space-y-2">
            <span className="text-sm font-medium">Units</span>
            <div className="grid grid-cols-1 gap-1">
              {(Object.keys(UNITS_LABEL) as Units[]).map((u) => (
                <button
                  key={u}
                  type="button"
                  aria-pressed={settings.units === u}
                  onClick={() => setSettings({ units: u })}
                  className={cn(
                    "rounded-md border px-2 py-1 text-left text-xs font-medium",
                    settings.units === u ? "border-primary/60 bg-primary/15 text-foreground" : "border-border text-muted-foreground hover:text-foreground",
                  )}
                >
                  {UNITS_LABEL[u]}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <span className="text-sm font-medium">Graphics quality</span>
            <div className="grid grid-cols-4 gap-1">
              {(Object.keys(QUALITY_LABEL) as Quality[]).map((q) => (
                <button
                  key={q}
                  type="button"
                  aria-pressed={settings.quality === q}
                  onClick={() => setSettings({ quality: q })}
                  className={cn(
                    "rounded-md border px-2 py-1 text-xs font-medium",
                    settings.quality === q ? "border-primary/60 bg-primary/15 text-foreground" : "border-border text-muted-foreground hover:text-foreground",
                  )}
                >
                  {QUALITY_LABEL[q]}
                </button>
              ))}
            </div>
            <p className="text-[11px] leading-snug text-muted-foreground">Ultra adds a mirror-polished floor, contact shadows and full-resolution rendering. High keeps the glow and ambient occlusion. Resolution drops automatically if the frame rate falls. Use Low on older laptops and phones.</p>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
