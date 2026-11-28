import { getAudioContext, getMasterBus, getNoiseBuffer } from './audioCore';
import type { SoundProfile } from './soundProfile';
import { loadEngineSample } from "./audioSamples";
export interface StartOptions { volume: number; profile: SoundProfile }
type Source = OscillatorNode | AudioBufferSourceNode;
interface Voice {
  ctx: AudioContext; profile: SoundProfile; out: GainNode; torque: GainNode;
  engine: GainNode; filter: BiquadFilterNode; harmonics: OscillatorNode[];
  sample: GainNode; sampleFilter: BiquadFilterNode; sampleSource: AudioBufferSourceNode | null;
  sampleBaseRpm: number;
  intake: GainNode; intakeFilter: BiquadFilterNode; rasp: GainNode;
  whistle: OscillatorNode; whistleGain: GainNode; gear: OscillatorNode; gearGain: GainNode;
  raspGate: GainNode; firing: OscillatorNode; tick: GainNode; tickOsc: OscillatorNode; fan: GainNode; fanFilter: BiquadFilterNode;
  wind: GainNode; windFilter: BiquadFilterNode; tyres: GainNode; tyreFilter: BiquadFilterNode;
  sources: Set<Source>; nodes: AudioNode[]; stopping: boolean; cutUntil: number;
}
const clamp = (v: number, lo = 0, hi = 1) => Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : lo;
const target = (p: AudioParam, v: number, at: number, tau = 0.025) => p.setTargetAtTime(v, at, tau);
export const engineSamplePlaybackRate = (rpm: number, baseRpm: number) =>
  clamp(rpm / Math.max(1, baseRpm), 0.12, 2.6);
const firingHarmonics = [
  { order: 1, level: 0.26 },
  { order: 2, level: 0.13 },
  { order: 3, level: 0.07 },
  { order: 4, level: 0.04 },
  { order: 6, level: 0.02 },
  { order: 8, level: 0.01 },
] as const;
class EngineAudio {
  private voice: Voice | null = null;
  private frame: number | null = null;
  private lastBoost = 0;
  private lastRpm = 850;
  private volume = 0.7;
  level = 0;
  start(opts: StartOptions): void {
    this.kill();
    const ctx = getAudioContext(), bus = getMasterBus();
    if (!ctx || !bus) return;
    this.volume = clamp(opts.volume); this.lastBoost = 0; this.lastRpm = opts.profile.idleRpm;
    const nodes: AudioNode[] = [], sources = new Set<Source>();
    const gain = (value: number) => { const g = ctx.createGain(); g.gain.value = value; nodes.push(g); return g; };
    const filter = (type: BiquadFilterType, hz: number) => { const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = hz; nodes.push(f); return f; };
    const osc = (type: OscillatorType, hz: number, dest: AudioNode) => {
      const o = ctx.createOscillator(); o.type = type; o.frequency.value = hz; o.connect(dest); sources.add(o); o.start(); return o;
    };
    const out = gain(0); out.connect(bus); target(out.gain, this.volume * 0.55, ctx.currentTime, 0.04);
    const torque = gain(1); torque.connect(out);
    const engine = gain(0), low = filter('lowpass', 800);
    const shape = ctx.createWaveShaper(); nodes.push(shape);
    const curve = new Float32Array(512), drive = 1 + opts.profile.rasp * 7 + opts.profile.attack * 2;
    for (let i = 0; i < curve.length; i++) { const x = i / 255.5 - 1; curve[i] = (1 + drive) * x / (1 + drive * Math.abs(x)); }
    shape.curve = curve; shape.connect(low).connect(engine).connect(torque);
    const sample = gain(0), sampleFilter = filter('lowpass', 1800);
    sampleFilter.Q.value = 0.55;
    sampleFilter.connect(sample).connect(torque);
    const harmonics = firingHarmonics.map(({ order, level }, i) => {
      const g = gain(level); g.connect(shape);
      return osc(i === 0 ? 'sawtooth' : 'sine', (opts.profile.idleRpm / 30) * opts.profile.firingFrequencyFactor * order, g);
    });
    const intake = gain(0), intakeFilter = filter('bandpass', opts.profile.intakeHz);
    const rasp = gain(0), raspFilter = filter('bandpass', 3200);
    const fan = gain(0), fanFilter = filter('bandpass', opts.profile.fanHz);
    const wind = gain(0), windFilter = filter('lowpass', 900);
    const tyres = gain(0), tyreFilter = filter('bandpass', 900);
    const noise = ctx.createBufferSource(); noise.buffer = getNoiseBuffer(); noise.loop = true; sources.add(noise);
    noise.connect(intakeFilter).connect(intake).connect(torque);
    noise.connect(raspFilter).connect(rasp).connect(torque);
    noise.connect(fanFilter).connect(fan).connect(out); noise.start();
    noise.connect(windFilter).connect(wind).connect(out);
    noise.connect(tyreFilter).connect(tyres).connect(out);
    // Audio-rate firing gate for rasp and injector/piston ticks, without per-frame source creation.
    const gate = gain(0); gate.connect(rasp.gain); const firing = osc('sine', (opts.profile.idleRpm / 30) * opts.profile.firingFrequencyFactor, gate);
    const whistleGain = gain(0); whistleGain.connect(torque); const whistle = osc('sine', 3000, whistleGain);
    const gearGain = gain(0); gearGain.connect(torque); const gear = osc('sine', 200, gearGain);
    const tick = gain(0); tick.connect(torque); const tickOsc = osc('square', (opts.profile.idleRpm / 30) * opts.profile.firingFrequencyFactor, tick);
    const voice: Voice = { ctx, profile: opts.profile, out, torque, engine, filter: low, harmonics, sample, sampleFilter, sampleSource: null,
      sampleBaseRpm: opts.profile.sampleBaseRpm, intake, intakeFilter, rasp,
      whistle, whistleGain, gear, gearGain, raspGate: gate, firing, tick, tickOsc, fan, fanFilter,
      wind, windFilter, tyres, tyreFilter, sources, nodes, stopping: false, cutUntil: 0 };
    this.voice = voice;
    void loadEngineSample(ctx, opts.profile.engineSample).then((buffer) => {
      if (this.voice !== voice || voice.stopping) return;
      const source = ctx.createBufferSource();
      source.buffer = buffer.buffer;
      source.loop = true;
      voice.sampleBaseRpm = buffer.sourceRpm;
      source.playbackRate.value = engineSamplePlaybackRate(this.lastRpm, voice.sampleBaseRpm);
      source.connect(sampleFilter);
      source.start();
      voice.sampleSource = source;
      sources.add(source);
      source.onended = () => {
        source.disconnect();
        sources.delete(source);
      };
    }).catch((error: unknown) => {
      console.error("Unable to load the selected engine recording; continuing with the live engine voice.", error);
    });
    this.update(opts.profile.idleRpm, 0.08, 0);
  }
  update(rpm: number, load: number, boost: number, speedKmh = 0): void {
    const v = this.voice; if (!v || v.stopping) return;
    rpm = clamp(rpm, 150, 14000); load = clamp(load); boost = clamp(boost, 0, 5); speedKmh = clamp(speedKmh, 0, 400);
    this.lastRpm = rpm; this.lastBoost = boost;
    const p = v.profile, t = v.ctx.currentTime;
    const depth = p.lopeDepth * clamp((3500 - rpm) / 2600);
    // Incommensurate cam harmonics produce repeatable uneven cycles, never random jitter.
    const phase = t * rpm / 120 * Math.PI * 2;
    const lope = Math.sin(phase) * 0.65 + Math.sin(phase * 0.487 + 1.7) * 0.35;
    const firingHz = (rpm / 30) * p.firingFrequencyFactor;
    v.harmonics.forEach((o, i) =>
      target(o.frequency, firingHz * firingHarmonics[i]!.order * (1 + depth * lope * 0.035), t),
    );
    const rpmSampleBlend = clamp((rpm - 700) / 2500);
    const sampleMix = (0.3 + rpmSampleBlend * 0.7) * (0.45 + load * 0.55);
    target(v.engine.gain, (0.28 + load * 0.36) * p.exhaustLevel * (0.75 + p.engineScale * 0.5) * (1 + depth * lope * 0.7) * (1 - sampleMix * 0.55), t);
    target(v.sample.gain, p.sampleLevel * sampleMix * 0.42, t, 0.07);
    target(v.sampleFilter.frequency, clamp(650 + rpm * 0.9 + load * 1800, 900, 9000), t, 0.06);
    if (v.sampleSource) target(v.sampleSource.playbackRate, engineSamplePlaybackRate(rpm, v.sampleBaseRpm), t, 0.025);
    target(v.filter.frequency, (380 + rpm * (0.18 + p.brightness * 0.24) + load * 700) * (1 - p.turboMuffling), t);
    target(v.intakeFilter.frequency, p.intakeHz + rpm * 0.018, t);
    target(v.intake.gain, p.intakeLevel * (0.012 + load * 0.13) + p.pipeWhoosh * load * 0.055, t);
    target(v.rasp.gain, p.rasp * load * (0.035 + p.popSharpness * 0.01), t);
    target(v.raspGate.gain, p.rasp * load * 0.025, t); target(v.firing.frequency, firingHz, t);
    target(v.whistle.frequency, clamp(p.whistleHz * (0.65 + boost * 0.3 + rpm / 18000), 2000, 9000), t, 0.08);
    target(v.whistleGain.gain, p.whistleLevel * boost * 0.12 * (1 + p.flutter * Math.sin(t * 39) * 0.35), t, 0.06);
    target(v.gear.frequency, rpm / 60 * p.gearPitchFactor, t);
    target(v.gearGain.gain, p.gearWhine * (0.015 + load * 0.06) + p.diffChatter * load * 0.008, t);
    target(v.tickOsc.frequency, firingHz, t);
    target(v.tick.gain, (p.injectorTick * 0.013 + p.pistonSlap * 0.018) * clamp((2400 - rpm) / 1500), t);
    target(v.fanFilter.frequency, p.fanHz + rpm * 0.01, t);
    target(v.fan.gain, p.fanLevel * (0.006 + load * 0.012), t);
    const speedMix = clamp(speedKmh / 320);
    target(v.windFilter.frequency, 450 + speedKmh * 15, t);
    target(v.wind.gain, p.windNoise * speedMix ** 1.6 * 0.08, t);
    target(v.tyreFilter.frequency, 700 + speedKmh * 9, t);
    target(v.tyres.gain, p.tyreRoar * speedMix * (0.006 + load * 0.012), t);
    if (t >= v.cutUntil) target(v.torque.gain, 1, t);
    this.level = this.volume * (0.28 + load * 0.36) * p.exhaustLevel;
  }
  private burst(v: Voice, at: number, hz: number, duration: number, level: number, endHz = hz * 0.45): void {
    const src = v.ctx.createBufferSource(); src.buffer = getNoiseBuffer();
    const f = v.ctx.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 0.7;
    f.frequency.setValueAtTime(hz, at); target(f.frequency, endHz, at, duration * 0.4);
    const g = v.ctx.createGain(); g.gain.value = 0; target(g.gain, level, at, 0.003); target(g.gain, 0, at + 0.012, duration * 0.18);
    src.connect(f).connect(g).connect(v.out); v.sources.add(src);
    src.onended = () => { src.disconnect(); f.disconnect(); g.disconnect(); v.sources.delete(src); };
    src.start(at); src.stop(at + duration + 0.04);
  }
  private bov(v: Voice, at: number): void {
    if (v.profile.turbo && this.lastBoost > 0.3) this.burst(v, at, v.profile.bovHz, v.profile.bovDurationS, v.profile.bovLevel * 0.22);
  }
  limiter(durationS: number): void {
    const v = this.voice; if (!v || v.stopping) return;
    const p = v.profile, t = v.ctx.currentTime, duration = clamp(durationS, 0, 3);
    v.torque.gain.cancelScheduledValues(t); v.cutUntil = t + duration;
    for (let d = 0; d < duration; d += 0.09) {
      target(v.torque.gain, 0.6 * (1 - p.limiterHardness), t + d, 0.004);
      target(v.torque.gain, 1, t + d + 0.045, 0.008);
      if (p.limiterHardness > 0.6 && d % 0.18 < 0.095) this.burst(v, t + d, 600 + p.popSharpness * 2600, 0.085, p.crackle * p.popSharpness * 0.3);
    }
    target(v.torque.gain, 1, v.cutUntil);
  }
  shift(): void {
    const v = this.voice; if (!v || v.stopping) return;
    const t = v.ctx.currentTime, p = v.profile;
    v.torque.gain.cancelScheduledValues(t); v.cutUntil = t + p.shiftTimeS;
    target(v.torque.gain, Math.max(0.06, p.shiftRetained), t, p.transmission === 'automatic' ? 0.045 : 0.006);
    target(v.torque.gain, 1, v.cutUntil, 0.035);
    target(v.gear.frequency, this.lastRpm / 60 * p.gearPitchFactor * 0.65, t, 0.01);
    this.bov(v, t);
    this.burst(v, t, p.transmission === 'dct' ? 650 : 1700, p.transmission === 'dct' ? 0.13 : 0.055,
      p.transmission === 'automatic' ? 0.012 : 0.04 + p.clutchClack * 0.06 + p.diffChatter * 0.02);
    if (p.transmission === 'dct') this.burst(v, t + 0.045, 1100, 0.09, 0.06 + p.crackle * 0.1);
  }
  stop(): void {
    this.cancelFrame(); const v = this.voice; if (!v || v.stopping) return;
    this.bov(v, v.ctx.currentTime);
    if (v.profile.crackle > 0.1) this.burst(v, v.ctx.currentTime + 0.08, 800 + v.profile.popSharpness * 2000, 0.13, v.profile.crackle * 0.09);
    v.harmonics.forEach((o, i) =>
      target(o.frequency, (v.profile.idleRpm / 30) * v.profile.firingFrequencyFactor * firingHarmonics[i]!.order, v.ctx.currentTime, 0.13),
    );
    target(v.whistleGain.gain, 0, v.ctx.currentTime, 0.07);
    target(v.fan.gain, v.profile.fanLevel * 0.025, v.ctx.currentTime, 0.05);
    this.retire(v, 0.65); this.voice = null; this.level = 0;
  }
  private retire(v: Voice, seconds: number): void {
    if (v.stopping) return; v.stopping = true;
    const t = v.ctx.currentTime; v.out.gain.cancelScheduledValues(t);
    target(v.out.gain, 0, t + (seconds > 0.1 ? 0.25 : 0), seconds > 0.1 ? 0.07 : 0.008);
    const sources = [...v.sources]; let left = sources.length;
    const done = () => { if (--left === 0) { v.nodes.forEach(n => n.disconnect()); v.out.disconnect(); } };
    for (const src of sources) {
      const previous = src.onended;
      src.onended = (event) => { previous?.call(src, event); src.disconnect(); done(); };
      try { src.stop(t + seconds); } catch { done(); }
    }
  }
  private cancelFrame(): void { if (this.frame !== null && typeof cancelAnimationFrame !== 'undefined') cancelAnimationFrame(this.frame); this.frame = null; }
  kill(): void { this.cancelFrame(); if (this.voice) this.retire(this.voice, 0.045); this.voice = null; this.level = 0; }
  setVolume(v: number): void {
    this.volume = clamp(v); const voice = this.voice;
    if (voice) target(voice.out.gain, this.volume * 0.55, voice.ctx.currentTime, 0.04);
    if (!this.volume) this.level = 0;
  }
  revDemo(opts: StartOptions): () => void {
    this.start(opts); const v = this.voice;
    if (!v || typeof requestAnimationFrame === 'undefined') { this.kill(); return () => {}; }
    const start = v.ctx.currentTime; let previous = 0;
    this.burst(v, start, 450, 0.36, 0.1);
    const step = () => {
      if (this.voice !== v) return;
      const s = v.ctx.currentTime - start;
      if (s > 3.5) { this.stop(); return; }
      let rpm = s < 0.4 ? 200 + s * ((v.profile.idleRpm - 200) / 0.4) : v.profile.idleRpm, load = 0.07;
      if (s > 1.55 && s < 2.25) { const x = (s - 1.55) / 0.7; rpm += Math.sin(x * Math.PI) * 4600; load = Math.sin(x * Math.PI) * 0.9; }
      if (s > 2.35 && s < 3.1) { const x = (s - 2.35) / 0.75; rpm += Math.sin(x * Math.PI) * 5100; load = Math.sin(x * Math.PI) * 0.95; }
      if ((previous < 1.96 && s >= 1.96) || (previous < 2.78 && s >= 2.78)) {
        this.bov(v, v.ctx.currentTime);
        if (v.profile.crackle) this.burst(v, v.ctx.currentTime + 0.04, 900 + v.profile.popSharpness * 2000, 0.1, v.profile.crackle * 0.13);
      }
      this.update(rpm, load, v.profile.turbo ? load * 1.1 : 0); previous = s;
      this.frame = requestAnimationFrame(step);
    };
    this.frame = requestAnimationFrame(step);
    return () => { if (this.voice === v) this.kill(); };
  }
}
export const engineAudio = new EngineAudio();
