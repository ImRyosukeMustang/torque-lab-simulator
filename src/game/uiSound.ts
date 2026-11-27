import { getAudioContext, getMasterBus, getNoiseBuffer } from './audioCore';
import type { SlotId } from './sim/types';
type Grade = 'bronze' | 'silver' | 'gold';
interface Hit { at: number; hz: number; duration: number; level: number; noise?: boolean; end?: number }
let enabled = true, volume = 0.65, bus: GainNode | null = null, busContext: AudioContext | null = null;
let clickAt = -Infinity, sprayAt = -Infinity;
const unit = (v: number) => Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : 0;
function play(hits: Hit[]): void {
  if (!enabled || !volume) return;
  const ctx = getAudioContext(), master = getMasterBus(); if (!ctx || !master) return;
  if (!bus || busContext !== ctx) { bus = ctx.createGain(); bus.gain.value = volume; bus.connect(master); busContext = ctx; }
  for (const h of hits) {
    const at = ctx.currentTime + h.at, g = ctx.createGain(), f = ctx.createBiquadFilter();
    f.type = 'bandpass'; f.Q.value = h.noise ? 0.7 : 2;
    f.frequency.setValueAtTime(h.hz, at); f.frequency.setTargetAtTime(h.end ?? h.hz * 0.6, at, h.duration * 0.3);
    g.gain.value = 0; g.gain.setTargetAtTime(h.level, at, 0.003);
    g.gain.setTargetAtTime(0, at + Math.min(0.025, h.duration * 0.25), h.duration * 0.16);
    const src = h.noise ? ctx.createBufferSource() : ctx.createOscillator();
    if ('buffer' in src) src.buffer = getNoiseBuffer();
    else { src.type = 'triangle'; src.frequency.setValueAtTime(h.hz, at); src.frequency.setTargetAtTime(h.end ?? h.hz * 0.8, at, h.duration * 0.5); }
    src.connect(f).connect(g).connect(bus);
    src.onended = () => { src.disconnect(); f.disconnect(); g.disconnect(); };
    src.start(at); src.stop(at + h.duration + 0.035);
  }
}
function hit(at: number, hz: number, duration = 0.08, level = 0.12, noise = true, end = hz * 0.65): Hit {
  return { at, hz, duration, level, noise, end };
}
function chime(notes: number[]): void { play(notes.map((hz, i) => hit(i * 0.085, hz, 0.17, 0.065, false, hz))); }
const ratchet = (at: number, count = 4): Hit[] => Array.from({ length: count }, (_, i) => hit(at + i * 0.035, 1900 + i * 90, 0.035, 0.09));
const clamp = (at: number): Hit[] => [hit(at, 2800, 0.04, 0.11), hit(at + 0.08, 1800, 0.06, 0.1)];
/** Short material-specific arrangements, not random cosmetic variation. */
function installation(slot: SlotId): Hit[] {
  switch (slot) {
    case 'engine': return [...ratchet(0, 6), hit(0.3, 150, 0.28, 0.24), hit(0.32, 520, 0.22, 0.14, false)];
    case 'intake': return [hit(0, 2400, 0.04), hit(0.1, 2100, 0.04), ...clamp(0.22)];
    case 'camshaft': return [...ratchet(0), hit(0.32, 1100, 0.18, 0.19, false)];
    case 'turbo': return [...ratchet(0, 6), hit(0.33, 420, 0.22, 0.24), hit(0.34, 870, 0.2, 0.1, false)];
    case 'intercooler': return [hit(0, 670, 0.19, 0.21), ...clamp(0.23), ...clamp(0.43)];
    case 'injectors': return [0, 0.1, 0.2, 0.3].map(t => hit(t, 3300, 0.055, 0.11));
    case 'fuel': return [0, 0.11, 0.24, 0.4].map((t, i) => hit(t, 260 + i % 2 * 180, 0.16, 0.18, true, 170));
    case 'exhaust': return [hit(0, 240, 0.24, 0.25), hit(0.01, 730, 0.21, 0.15, false), ...ratchet(0.3, 6)];
    case 'internals': return [hit(0, 130, 0.2, 0.25), ...ratchet(0.25, 7)];
    case 'cooling': return [hit(0, 600, 0.25, 0.18, true, 260), ...clamp(0.31)];
    case 'ecu': return [hit(0, 3600, 0.04, 0.12), hit(0.14, 1100, 0.1, 0.07, false, 1100), hit(0.28, 1650, 0.1, 0.07, false, 1650)];
    case 'gearbox': return [hit(0, 95, 0.27, 0.25), hit(0.02, 540, 0.2, 0.16, false), ...ratchet(0.3, 7)];
    case 'clutch': return [...ratchet(0, 6), hit(0.3, 980, 0.27, 0.14, false, 520)];
    case 'differential': return [hit(0, 170, 0.23, 0.24), hit(0.01, 860, 0.21, 0.13, false), ...ratchet(0.28, 5)];
    case 'drivetrain': return [0, 0.2, 0.43].flatMap((t, i) => [hit(t, 150 + i * 70, 0.19, 0.23), hit(t + 0.01, 760 + i * 120, 0.17, 0.1, false)]);
    case 'aero': return [hit(0, 520, 0.12, 0.16), ...[0.15, 0.27, 0.39, 0.51].map(t => hit(t, 2600, 0.03, 0.1))];
    case 'wing': return [...ratchet(0, 5), hit(0.25, 700, 0.18, 0.18), hit(0.27, 1500, 0.14, 0.08, false)];
    case 'body': return [hit(0, 300, 0.2, 0.2), ...[0.24, 0.32, 0.4, 0.48, 0.56, 0.64].map(t => hit(t, 3100, 0.025, 0.1)), ...ratchet(0.7, 5)];
  }
}
export const uiSound = {
  configure(opts: { enabled: boolean; volume: number }): void {
    enabled = opts.enabled; volume = unit(opts.volume);
    if (bus && busContext) bus.gain.setTargetAtTime(enabled ? volume : 0, busContext.currentTime, 0.015);
  },
  click(): void {
    if (!enabled || !volume) return;
    const now = Date.now(); if (now - clickAt < 40) return; clickAt = now;
    play([hit(0, 2200, 0.035, 0.08)]);
  },
  tab(): void { play([hit(0, 1100, 0.055, 0.075)]); },
  select(): void { play([hit(0, 1180, 0.035, 0.065, false, 1180), hit(0.045, 1760, 0.045, 0.055, false, 1760)]); },
  toggle(on: boolean): void { play([hit(0, on ? 1700 : 1000, 0.06, 0.075, false)]); },
  buy(): void { chime([880, 1320]); },
  sell(): void { chime([1100, 730]); },
  deny(): void { play([hit(0, 110, 0.16, 0.08, false, 85), hit(0.06, 125, 0.1, 0.06, false, 100)]); },
  install(slot: SlotId): void { play(installation(slot)); },
  remove(): void { play([...ratchet(0), hit(0.19, 530, 0.13, 0.15)]); },
  spray(): void {
    if (!enabled || !volume) return;
    const now = Date.now(); if (now - sprayAt < 120) return; sprayAt = now;
    play([hit(0, 4200, 0.11, 0.11, true, 3500)]);
  },
  hood(open: boolean): void {
    play(open ? [hit(0, 180, 0.08, 0.2), hit(0.06, 740, 0.32, 0.085, true, 1100)]
      : [hit(0, 900, 0.25, 0.07, true, 450), hit(0.27, 130, 0.13, 0.24)]);
  },
  gradeAward(grade: Grade): void { chime(grade === 'gold' ? [523, 659, 784, 1047, 1319, 1568] : grade === 'silver' ? [523, 659, 784, 1047] : [440, 554, 659]); },
  shiftClunk(): void { play([hit(0, 260, 0.065, 0.18), hit(0.018, 1200, 0.045, 0.1)]); },
};
const roots = new WeakMap<Document, { refs: number; listener: (event: PointerEvent) => void }>();
/** Reference-counted installation: at most one capture listener per Document. */
export function installGlobalClickSound(root?: Document): () => void {
  const doc = root ?? (typeof document === 'undefined' ? undefined : document);
  if (!doc) return () => {};
  let entry = roots.get(doc);
  if (!entry) {
    const listener = (event: PointerEvent) => {
      if (event.button !== 0) return;
      const target = event.composedPath().find((n): n is Element => !!n && typeof (n as Element).closest === 'function');
      if (!target || target.closest('[data-sound="none"], [disabled], [aria-disabled="true"], [inert]')) return;
      const control = target.closest('button, [role="button"], [role="tab"], [role="switch"], [role="slider"]');
      if (!control || control.matches(':disabled') || control.closest('[data-sound="none"], [aria-disabled="true"], [inert]')) return;
      if (control.getAttribute("data-sound") === "select") uiSound.select();
      else uiSound.click();
    };
    entry = { refs: 0, listener }; roots.set(doc, entry); doc.addEventListener('pointerdown', listener, true);
  }
  entry.refs++; let active = true;
  return () => {
    if (!active) return; active = false;
    if (--entry.refs === 0) { doc.removeEventListener('pointerdown', entry.listener, true); roots.delete(doc); }
  };
}
