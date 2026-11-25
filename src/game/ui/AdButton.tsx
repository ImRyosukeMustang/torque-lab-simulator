import { Clapperboard, Loader2 } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { Button, type ButtonProps } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { adsAvailable, showRewardedAd } from "../crazygames";
import { setMasterMuted } from "../audioCore";

const DEMO_AD_S = 5;

/**
 * Rewarded-ad button. On CrazyGames it plays a real rewarded ad and pays only when it finishes;
 * elsewhere (preview, other hosts) a short demo break stands in so the reward flow still works.
 */
export function AdButton({ onReward, children, disabled, ...props }: { onReward: () => void; children: ReactNode; disabled?: boolean } & Omit<ButtonProps, "onClick">) {
  const [busy, setBusy] = useState(false);
  const [demo, setDemo] = useState<number | null>(null);
  const timer = useRef(0);
  useEffect(() => () => window.clearInterval(timer.current), []);

  if (!adsAvailable()) return null;
  const run = async () => {
    if (busy) return;
    setBusy(true);
    if (adsAvailable()) {
      const r = await showRewardedAd();
      setBusy(false);
      if (r === "ok") onReward();
      else toast.error("No ad right now", { description: "No reward this time. Try again in a minute." });
      return;
    }
    // Demo break outside the portal.
    setMasterMuted(true);
    const start = performance.now();
    setDemo(0);
    timer.current = window.setInterval(() => {
      const s = (performance.now() - start) / 1000;
      if (s >= DEMO_AD_S) {
        window.clearInterval(timer.current);
        setDemo(null);
        setBusy(false);
        setMasterMuted(false);
        onReward();
      } else setDemo(s);
    }, 100);
  };

  return (
    <>
      <Button {...props} disabled={disabled || busy} onClick={() => void run()}>
        {busy ? <Loader2 className="animate-spin" /> : <Clapperboard />}
        {children}
      </Button>
      <Dialog open={demo !== null}>
        <DialogContent className="sm:max-w-sm [&>button]:hidden" onEscapeKeyDown={(e) => e.preventDefault()} onPointerDownOutside={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle className="font-display text-2xl">Sponsor break</DialogTitle>
            <DialogDescription>Demo ad. On CrazyGames a short video ad plays here, then your reward is paid.</DialogDescription>
          </DialogHeader>
          <Progress value={((demo ?? 0) / DEMO_AD_S) * 100} />
          <p className="text-center font-mono text-xs text-muted-foreground">{Math.max(0, Math.ceil(DEMO_AD_S - (demo ?? 0)))} s</p>
        </DialogContent>
      </Dialog>
    </>
  );
}
