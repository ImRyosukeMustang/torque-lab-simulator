import { Coins, RotateCcw, Gauge, Wrench, Trophy, Paintbrush, Settings2, Volume2, VolumeX } from "lucide-react";
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
import { configKey } from "../sim/economy";
import { buildCost } from "../sim/parts";
import { useGame, type Quality, type Tab } from "../store";
import { fmtCredits } from "./format";

const TABS: { id: Tab; label: string; icon: typeof Wrench }[] = [
  { id: "workshop", label: "Workshop", icon: Wrench },
  { id: "dyno", label: "Dyno Lab", icon: Gauge },
  { id: "paint", label: "Paint Shop", icon: Paintbrush },
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

  return (
    <header className="flex h-14 shrink-0 items-center gap-4 border-b border-border bg-sidebar px-4">
      <div className="flex items-baseline gap-2">
        <span className="font-display text-xl font-bold tracking-[0.2em]">AUTOMECH</span>
        <span className="hidden font-mono text-[10px] text-muted-foreground sm:inline">PROTOTYPE 0.2</span>
      </div>
      <nav className="flex items-center gap-1">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            disabled={dynoRunning && id !== "dyno"}
            title={dynoRunning && id !== "dyno" ? "Finish or abort the dyno run first" : label}
            className={cn(
              "flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40",
              tab === id ? "bg-accent text-foreground" : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Icon className={cn("h-4 w-4", tab === id && "text-primary")} />
            <span className="hidden md:inline">{label}</span>
          </button>
        ))}
      </nav>
      <div className="ml-auto flex items-center gap-4 font-mono text-xs tabular">
        <div className="hidden flex-col items-end leading-tight lg:flex">
          <span className="text-[9px] uppercase tracking-widest text-muted-foreground">Build cost</span>
          <span>{fmtCredits(buildCost(game.build))}</span>
        </div>
        <div className="hidden flex-col items-end leading-tight lg:flex">
          <span className="text-[9px] uppercase tracking-widest text-muted-foreground">Reliability</span>
          <span>{fresh ? `${lastResult.reliability}%` : "—"}</span>
        </div>
        <div className="flex items-center gap-1.5 rounded-md border border-primary/40 bg-primary/10 px-2.5 py-1 text-sm text-primary" aria-label="Credits">
          <Coins className="h-4 w-4" />
          {fmtCredits(game.credits)}
        </div>
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
              <AlertDialogDescription>This erases your credits, parts and challenge grades saved in this browser.</AlertDialogDescription>
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


const QUALITY_LABEL: Record<Quality, string> = { high: "High", medium: "Medium", low: "Low" };

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
            <span className="text-sm font-medium">Engine sound</span>
            <Switch checked={settings.sound} onCheckedChange={(sound) => setSettings({ sound })} aria-label="Engine sound" />
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium">Volume</span>
              <span className="font-mono text-xs text-muted-foreground">{Math.round(settings.volume * 100)}%</span>
            </div>
            <Slider value={[settings.volume]} min={0} max={1} step={0.05} disabled={!settings.sound} onValueChange={([v]) => v !== undefined && setSettings({ volume: v })} aria-label="Volume" />
          </div>
          <div className="space-y-2">
            <span className="text-sm font-medium">Graphics quality</span>
            <div className="grid grid-cols-3 gap-1">
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
            <p className="text-[11px] leading-snug text-muted-foreground">High adds glow and soft-light effects. Use Low on older laptops and phones.</p>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
