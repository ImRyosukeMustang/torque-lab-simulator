export const PHOTO_FINISH_WINDOW_S = 0.1;

type FeedbackTone = "good" | "bad" | "info";

export function launchFeedback(
  actualRpm: number,
  idealRpm: number,
  window: [number, number],
): { text: string; tone: FeedbackTone } {
  const actual = Math.round(actualRpm).toLocaleString("en-US");
  const ideal = Math.round(idealRpm).toLocaleString("en-US");
  if (actualRpm >= window[0] && actualRpm <= window[1]) {
    return { text: `GREAT LAUNCH · ${actual} RPM`, tone: "good" };
  }
  const direction = actualRpm < idealRpm ? "LOW" : "HIGH";
  return { text: `${actual} RPM · ${direction} · TARGET ${ideal}`, tone: "info" };
}

export function photoFinishMargin(
  totalS: number | null,
  rivalTotalS: number | null,
): number | null {
  if (totalS === null || rivalTotalS === null) return null;
  const margin = Math.abs(totalS - rivalTotalS);
  return margin <= PHOTO_FINISH_WINDOW_S ? margin : null;
}

export function raceLossTip(input: {
  launchRpm: number | null;
  idealLaunchRpm: number;
  reactionS: number | null;
  sixtyFtS: number | null;
  rivalSixtyFtS: number | null;
}): string {
  const { launchRpm, idealLaunchRpm, reactionS, sixtyFtS, rivalSixtyFtS } = input;
  if (launchRpm !== null && Math.abs(launchRpm - idealLaunchRpm) >= 250) {
    const below = launchRpm < idealLaunchRpm;
    const offset = Math.round(Math.abs(launchRpm - idealLaunchRpm)).toLocaleString("en-US");
    const actual = Math.round(launchRpm).toLocaleString("en-US");
    const ideal = Math.round(idealLaunchRpm).toLocaleString("en-US");
    return `Your launch was ${actual} rpm, ${offset} rpm ${below ? "below" : "above"} this car's ${ideal} rpm ideal. Try holding ${ideal} rpm before green.`;
  }
  if (reactionS !== null && reactionS >= 0.3) {
    return `Your reaction was ${reactionS.toFixed(3)} s. Launch as soon as the green light appears, without jumping the start.`;
  }
  if (sixtyFtS !== null && rivalSixtyFtS !== null && sixtyFtS > rivalSixtyFtS + 0.02) {
    return `You gave up ${(sixtyFtS - rivalSixtyFtS).toFixed(3)} s in the first 60 ft. Work on your launch rpm and throttle control.`;
  }
  return "Your launch was close to ideal. Try shifting nearer the green shift point to find the time you need.";
}
