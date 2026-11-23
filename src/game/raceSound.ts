// Drag strip sound effects over the shared audio context: tree beeps, tyre screech, results stings.
import { getAudioContext, getMasterBus, getNoiseBuffer } from "./audioCore";

let enabled = true;
let volume = 0.7;
let screech: { src: AudioBufferSourceNode; gain: GainNode; filter: BiquadFilterNode; ctx: AudioContext } | null = null;

function tone(at: number, hz: number, dur: number, level: number, type: OscillatorType = "square", endHz = hz) {
  const ctx = getAudioContext();
  const bus = getMasterBus();
  if (!ctx || !bus || !enabled || !volume) return;
  const t = ctx.currentTime + at;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(hz, t);
  if (endHz !== hz) o.frequency.exponentialRampToValueAtTime(endHz, t + dur);
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(level * volume, t + 0.008);
  g.gain.setTargetAtTime(0, t + dur * 0.6, dur * 0.25);
  o.connect(g).connect(bus);
  o.start(t);
  o.stop(t + dur + 0.2);
  o.onended = () => {
    o.disconnect();
    g.disconnect();
  };
}

export const raceSound = {
  configure(opts: { enabled: boolean; volume: number }) {
    enabled = opts.enabled;
    volume = Math.max(0, Math.min(1, opts.volume));
    if (!enabled) this.screech(0);
  },
  stage() {
    tone(0, 660, 0.06, 0.05, "sine");
  },
  amber() {
    tone(0, 880, 0.12, 0.08, "square");
  },
  green() {
    tone(0, 1320, 0.32, 0.1, "square");
  },
  redLight() {
    tone(0, 180, 0.6, 0.12, "sawtooth", 120);
  },
  perfectShift() {
    tone(0, 1568, 0.09, 0.05, "sine");
    tone(0.07, 2093, 0.12, 0.05, "sine");
  },
  denied() {
    tone(0, 140, 0.12, 0.07, "square", 110);
  },
  win() {
    [523, 659, 784, 1047, 1319].forEach((hz, i) => tone(i * 0.1, hz, 0.22, 0.07, "triangle"));
  },
  lose() {
    [392, 330, 262].forEach((hz, i) => tone(i * 0.16, hz, 0.3, 0.07, "triangle"));
  },
  cash() {
    [1760, 2349, 2794].forEach((hz, i) => tone(i * 0.06, hz, 0.1, 0.05, "sine"));
  },
  /** Continuous tyre squeal; level 0..1. */
  screech(level: number) {
    const ctx = getAudioContext();
    const bus = getMasterBus();
    if (!ctx || !bus) return;
    const want = enabled ? Math.max(0, Math.min(1, level)) : 0;
    if (!screech && want <= 0.01) return;
    if (!screech) {
      const src = ctx.createBufferSource();
      src.buffer = getNoiseBuffer();
      src.loop = true;
      const filter = ctx.createBiquadFilter();
      filter.type = "bandpass";
      filter.frequency.value = 1500;
      filter.Q.value = 6;
      const gain = ctx.createGain();
      gain.gain.value = 0;
      src.connect(filter).connect(gain).connect(bus);
      src.start();
      screech = { src, gain, filter, ctx };
    }
    const t = screech.ctx.currentTime;
    screech.gain.gain.setTargetAtTime(want * 0.22 * volume, t, 0.04);
    screech.filter.frequency.setTargetAtTime(1300 + want * 700 + Math.sin(t * 13) * 90, t, 0.05);
  },
  stopAll() {
    if (screech) {
      const s = screech;
      s.gain.gain.setTargetAtTime(0, s.ctx.currentTime, 0.03);
      window.setTimeout(() => {
        try {
          s.src.stop();
        } catch {
          /* already stopped */
        }
        s.src.disconnect();
        s.gain.disconnect();
      }, 200);
      screech = null;
    }
  },
};
