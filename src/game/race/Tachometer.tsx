import { cn } from "@/lib/utils";

/** Analogue tachometer with redline, launch window, ideal shift tick and a shift-light bar. */
export function Tachometer({
  rpm,
  revLimit,
  shiftRpm,
  launchWindow,
  launched,
  gear,
  speed,
  speedUnit,
}: {
  rpm: number;
  revLimit: number;
  shiftRpm: number | null;
  launchWindow: [number, number] | null;
  launched: boolean;
  gear: number;
  speed: string;
  speedUnit: string;
}) {
  const max = Math.ceil((revLimit + 600) / 1000) * 1000;
  const A0 = -225;
  const A1 = 45;
  const ang = (r: number) => A0 + (Math.max(0, Math.min(max, r)) / max) * (A1 - A0);
  const pt = (a: number, rad: number) => [100 + Math.cos((a * Math.PI) / 180) * rad, 100 + Math.sin((a * Math.PI) / 180) * rad] as const;
  const arc = (from: number, to: number, rad: number) => {
    const [x0, y0] = pt(ang(from), rad);
    const [x1, y1] = pt(ang(to), rad);
    const large = ang(to) - ang(from) > 180 ? 1 : 0;
    return `M ${x0} ${y0} A ${rad} ${rad} 0 ${large} 1 ${x1} ${y1}`;
  };
  // Shift lights: 5 LEDs filling over the last 1,500 rpm before the ideal shift point, flashing at it.
  const target = launched ? shiftRpm ?? revLimit : null;
  const leds = target ? Math.max(0, Math.min(5, Math.floor(((rpm - (target - 1500)) / 1500) * 5))) : 0;
  const flash = target !== null && rpm >= target - 80;
  const [nx, ny] = pt(ang(rpm), 72);
  const ticks = Array.from({ length: max / 1000 + 1 }, (_, i) => i * 1000);
  return (
    <div className="relative w-[200px] select-none sm:w-[230px]" aria-label={`${Math.round(rpm)} rpm, gear ${gear}`}>
      <div className="mb-1 flex justify-center gap-1.5">
        {Array.from({ length: 5 }, (_, i) => (
          <span
            key={i}
            className={cn(
              "h-2.5 w-6 rounded-sm bg-tree-off",
              i < leds && (i < 3 ? "tree-lit-green" : i < 4 ? "tree-lit-amber" : "tree-lit-red"),
              flash && "tree-lit-red animate-shift-flash",
            )}
          />
        ))}
      </div>
      <svg viewBox="0 0 200 200" className="w-full drop-shadow-lg">
        <circle cx="100" cy="100" r="96" className="fill-background/80 stroke-border" strokeWidth="2" />
        {launchWindow && !launched && <path d={arc(launchWindow[0], launchWindow[1], 84)} className="stroke-tree-green" strokeWidth="9" fill="none" opacity="0.85" />}
        <path d={arc(revLimit, max, 84)} className="stroke-redline" strokeWidth="9" fill="none" />
        {ticks.map((r) => {
          const [x0, y0] = pt(ang(r), 88);
          const [x1, y1] = pt(ang(r), 76);
          const [tx, ty] = pt(ang(r), 62);
          return (
            <g key={r}>
              <line x1={x0} y1={y0} x2={x1} y2={y1} className="stroke-foreground" strokeWidth="2" />
              <text x={tx} y={ty + 4} textAnchor="middle" className="fill-muted-foreground font-mono" fontSize="11">
                {r / 1000}
              </text>
            </g>
          );
        })}
        {target !== null &&
          (() => {
            const [x0, y0] = pt(ang(target), 92);
            const [x1, y1] = pt(ang(target), 70);
            return <line x1={x0} y1={y0} x2={x1} y2={y1} className="stroke-primary" strokeWidth="3" />;
          })()}
        <line x1="100" y1="100" x2={nx} y2={ny} className="stroke-primary" strokeWidth="3.5" strokeLinecap="round" />
        <circle cx="100" cy="100" r="7" className="fill-primary" />
        <text x="100" y="138" textAnchor="middle" className="fill-foreground font-display" fontSize="34" fontWeight="700">
          {gear}
        </text>
        <text x="100" y="160" textAnchor="middle" className="fill-foreground font-mono" fontSize="15">
          {speed}
        </text>
        <text x="100" y="174" textAnchor="middle" className="fill-muted-foreground font-mono" fontSize="9">
          {speedUnit} · x1000 rpm
        </text>
      </svg>
    </div>
  );
}
