import { cn } from "@/lib/utils";

export type TreeState = { prestage: boolean; stage: boolean; ambers: number; green: boolean; red: boolean };

function Bulb({ on, kind, size = "lg" }: { on: boolean; kind: "amber" | "green" | "red"; size?: "sm" | "lg" }) {
  return <span className={cn("block rounded-full bg-tree-off", size === "sm" ? "h-2.5 w-2.5" : "h-6 w-6 sm:h-7 sm:w-7", on && `tree-lit-${kind}`)} />;
}

/** Drag-strip Christmas tree: pre-stage and stage bulbs, three ambers, green and red, for both lanes. */
export function ChristmasTree({ you, rival }: { you: TreeState; rival: TreeState }) {
  const col = (t: TreeState) => (
    <div className="flex flex-col items-center gap-1.5">
      <div className="flex gap-1">
        <Bulb on={t.prestage} kind="amber" size="sm" />
        <Bulb on={t.prestage} kind="amber" size="sm" />
      </div>
      <div className="flex gap-1">
        <Bulb on={t.stage} kind="amber" size="sm" />
        <Bulb on={t.stage} kind="amber" size="sm" />
      </div>
      {[1, 2, 3].map((i) => (
        <Bulb key={i} on={t.ambers >= i && !t.green} kind="amber" />
      ))}
      <Bulb on={t.green} kind="green" />
      <Bulb on={t.red} kind="red" />
    </div>
  );
  return (
    <div className="flex gap-3 rounded-xl border border-border bg-background/75 px-3 py-2.5 backdrop-blur" aria-label="Start lights">
      <div className="flex flex-col items-center gap-1">
        <span className="text-[9px] font-semibold uppercase tracking-widest text-primary">You</span>
        {col(you)}
      </div>
      <div className="w-1 rounded bg-border" />
      <div className="flex flex-col items-center gap-1">
        <span className="text-[9px] font-semibold uppercase tracking-widest text-ghost">Rival</span>
        {col(rival)}
      </div>
    </div>
  );
}
