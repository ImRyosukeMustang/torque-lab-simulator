import { Coins, RotateCcw, Gauge, Wrench, Trophy } from "lucide-react";
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
import { cn } from "@/lib/utils";
import { configKey } from "../sim/economy";
import { buildCost } from "../sim/parts";
import { useGame, type Tab } from "../store";
import { fmtCredits } from "./format";

const TABS: { id: Tab; label: string; icon: typeof Wrench }[] = [
  { id: "workshop", label: "Workshop", icon: Wrench },
  { id: "dyno", label: "Dyno Lab", icon: Gauge },
  { id: "career", label: "Career", icon: Trophy },
];

export function TopBar() {
  const game = useGame((s) => s.game);
  const tab = useGame((s) => s.tab);
  const setTab = useGame((s) => s.setTab);
  const resetSave = useGame((s) => s.resetSave);
  const lastResult = useGame((s) => s.lastResult);
  const fresh = lastResult && game.lastRunKey === configKey(game.build, game.tune);

  return (
    <header className="flex h-14 shrink-0 items-center gap-4 border-b border-border bg-sidebar px-4">
      <div className="flex items-baseline gap-2">
        <span className="font-display text-xl font-bold tracking-[0.2em]">AUTOMECH</span>
        <span className="hidden font-mono text-[10px] text-muted-foreground sm:inline">PROTOTYPE 0.1</span>
      </div>
      <nav className="flex items-center gap-1">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={cn(
              "flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
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
