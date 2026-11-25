import { Clapperboard, Loader2 } from "lucide-react";
import { useState, type ReactNode } from "react";
import { toast } from "sonner";
import { Button, type ButtonProps } from "@/components/ui/button";
import { getGamePlatform } from "../platform";

/**
 * The button is only shown when the active portal can play a real rewarded ad.
 */
export function AdButton({ onReward, children, disabled, ...props }: { onReward: () => void; children: ReactNode; disabled?: boolean } & Omit<ButtonProps, "onClick">) {
  const [busy, setBusy] = useState(false);
  const platform = getGamePlatform();

  if (!platform.canShowRewarded()) return null;
  const run = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const watched = await platform.showRewarded();
      if (watched) onReward();
      else toast.error("No ad right now", { description: "No reward this time. Try again in a minute." });
    } catch (error) {
      console.error("Rewarded ad failed:", error);
      toast.error("No ad right now", { description: "No reward this time. Try again in a minute." });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Button {...props} disabled={disabled || busy} onClick={() => void run()}>
      {busy ? <Loader2 className="animate-spin" /> : <Clapperboard />}
      {children}
    </Button>
  );
}
