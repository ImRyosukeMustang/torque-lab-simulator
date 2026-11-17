// Synthesised inline-4 sound for dyno pulls. Pitch follows RPM continuously, which a
// recorded loop cannot do cleanly, so the engine is built from oscillators and noise.
// One AudioContext, created on the first user gesture (the Run button).

interface StartOptions {
  volume: number;
  /** 0 (restrictive OEM exhaust) .. 1 (open tubular system). */
  exhaustOpen: number;
  turbo: boolean;
}

class EngineAudio {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private voice: {
    oscs: OscillatorNode[];
    gains: GainNode[];
    filter: BiquadFilterNode;
    shaper: WaveShaperNode;
    engine: GainNode;
    roar: GainNode;
    roarFilter: BiquadFilterNode;
    noise: AudioBufferSourceNode;
    whistle: OscillatorNode;
    whistleGain: GainNode;
  } | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  private opts: StartOptions = { volume: 0.7, exhaustOpen: 0, turbo: false };
  /** Peak level of the last update, for headless checks. */
  level = 0;

  private ensure(): AudioContext | null {
    if (typeof window === "undefined") return null;
    if (!this.ctx) {
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return null;
      this.ctx = new Ctor();
      const comp = this.ctx.createDynamicsCompressor();
      comp.threshold.value = -10;
      comp.knee.value = 6;
      comp.ratio.value = 8;
      comp.attack.value = 0.003;
      comp.release.value = 0.2;
      this.master = this.ctx.createGain();
      this.master.gain.value = 0;
      this.master.connect(comp).connect(this.ctx.destination);
      const len = this.ctx.sampleRate * 2;
      this.noiseBuffer = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = this.noiseBuffer.getChannelData(0);
      let seed = 12345;
      for (let i = 0; i < len; i++) {
        seed = (seed * 1664525 + 1013904223) % 4294967296;
        d[i] = (seed / 4294967296) * 2 - 1;
      }
    }
    if (this.ctx.state === "suspended") void this.ctx.resume();
    return this.ctx;
  }

  private noiseSource(ctx: AudioContext, loop: boolean) {
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    src.loop = loop;
    return src;
  }

  start(opts: StartOptions) {
    const ctx = this.ensure();
    if (!ctx || !this.master) return;
    this.kill();
    this.opts = opts;
    const now = ctx.currentTime;
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.Q.value = 1.4;
    const shaper = ctx.createWaveShaper();
    const curve = new Float32Array(1024);
    const k = 3 + opts.exhaustOpen * 6;
    for (let i = 0; i < curve.length; i++) {
      const x = (i / (curve.length - 1)) * 2 - 1;
      curve[i] = ((1 + k) * x) / (1 + k * Math.abs(x));
    }
    shaper.curve = curve;
    const engine = ctx.createGain();
    engine.gain.value = 0;
    const mix = ctx.createGain();
    mix.gain.value = 0.5;
    mix.connect(shaper).connect(filter).connect(engine).connect(this.master);

    // Firing order harmonics of an inline-4: 2nd crank order dominant, 1st and 4th colour it.
    const specs: [OscillatorType, number, number, number][] = [
      ["sawtooth", 1, 0.42, 0],
      ["square", 0.5, 0.16, 0],
      ["sawtooth", 2, 0.12, 8],
      ["triangle", 0.25, 0.22, 0],
    ];
    const oscs: OscillatorNode[] = [];
    const gains: GainNode[] = [];
    for (const [type, , g, detune] of specs) {
      const o = ctx.createOscillator();
      o.type = type;
      o.detune.value = detune;
      const gn = ctx.createGain();
      gn.gain.value = g;
      o.connect(gn).connect(mix);
      o.start(now);
      oscs.push(o);
      gains.push(gn);
    }
    const noise = this.noiseSource(ctx, true);
    const roarFilter = ctx.createBiquadFilter();
    roarFilter.type = "bandpass";
    roarFilter.Q.value = 0.8;
    const roar = ctx.createGain();
    roar.gain.value = 0;
    noise.connect(roarFilter).connect(roar).connect(this.master);
    noise.start(now);
    const whistle = ctx.createOscillator();
    whistle.type = "sine";
    const whistleGain = ctx.createGain();
    whistleGain.gain.value = 0;
    whistle.connect(whistleGain).connect(this.master);
    whistle.start(now);
    this.voice = { oscs, gains, filter, shaper, engine, roar, roarFilter, noise, whistle, whistleGain };
    this.master.gain.setTargetAtTime(opts.volume * 0.55, now, 0.05);
    engine.gain.setTargetAtTime(0.5, now, 0.08);
  }

  update(rpm: number, load: number, boost: number) {
    const ctx = this.ctx;
    const v = this.voice;
    if (!ctx || !v) return;
    const now = ctx.currentTime;
    const f2 = rpm / 30; // firing frequency (2nd order) for 4 cylinders
    const ratios = [1, 0.5, 2, 0.25];
    v.oscs.forEach((o, i) => o.frequency.setTargetAtTime(f2 * ratios[i]!, now, 0.02));
    const open = this.opts.exhaustOpen;
    v.filter.frequency.setTargetAtTime(260 + rpm * (0.28 + open * 0.22) + load * 900, now, 0.03);
    v.engine.gain.setTargetAtTime(0.32 + 0.38 * load + 0.15 * open, now, 0.04);
    v.roarFilter.frequency.setTargetAtTime(500 + rpm * 0.25, now, 0.05);
    v.roar.gain.setTargetAtTime(0.02 + 0.07 * load, now, 0.05);
    if (this.opts.turbo) {
      v.whistle.frequency.setTargetAtTime(1600 + boost * 4200 + rpm * 0.1, now, 0.08);
      v.whistleGain.gain.setTargetAtTime(Math.min(0.035, boost * 0.025), now, 0.1);
    }
    this.level = 0.32 + 0.38 * load;
  }

  /** Fuel-cut stutter and pops while bouncing off the rev limiter. */
  limiter(duration: number, pops: boolean) {
    const ctx = this.ctx;
    const v = this.voice;
    if (!ctx || !v || !this.master) return;
    const now = ctx.currentTime;
    const g = v.engine.gain;
    g.cancelScheduledValues(now);
    const step = 0.07;
    for (let t = 0; t < duration; t += step) {
      g.setValueAtTime(0.75, now + t);
      g.setValueAtTime(0.22, now + t + step * 0.5);
    }
    if (pops) for (let i = 0; i < 4; i++) this.pop(now + 0.05 + i * (duration / 4));
  }

  private pop(at: number) {
    const ctx = this.ctx;
    if (!ctx || !this.master) return;
    const src = this.noiseSource(ctx, false);
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 1400;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, at);
    g.gain.linearRampToValueAtTime(0.6, at + 0.004);
    g.gain.exponentialRampToValueAtTime(0.001, at + 0.09);
    src.connect(lp).connect(g).connect(this.master);
    src.start(at, Math.random() * 1.5, 0.1);
  }

  /** Coast down to idle and fade out. */
  stop(blowOff: boolean) {
    const ctx = this.ctx;
    const v = this.voice;
    if (!ctx || !v || !this.master) return;
    const now = ctx.currentTime;
    const ratios = [1, 0.5, 2, 0.25];
    v.engine.gain.cancelScheduledValues(now);
    v.engine.gain.setTargetAtTime(0.3, now, 0.05);
    v.oscs.forEach((o, i) => {
      o.frequency.cancelScheduledValues(now);
      o.frequency.setTargetAtTime((900 / 30) * ratios[i]!, now, 0.35);
    });
    v.filter.frequency.setTargetAtTime(380, now, 0.3);
    v.roar.gain.setTargetAtTime(0.008, now, 0.15);
    v.whistleGain.gain.setTargetAtTime(0, now, 0.25);
    v.whistle.frequency.setTargetAtTime(900, now, 0.5);
    if (blowOff) {
      const src = this.noiseSource(ctx, false);
      const hp = ctx.createBiquadFilter();
      hp.type = "bandpass";
      hp.frequency.setValueAtTime(3200, now);
      hp.frequency.exponentialRampToValueAtTime(900, now + 0.5);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.35, now);
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.55);
      src.connect(hp).connect(g).connect(this.master);
      src.start(now, 0, 0.6);
    }
    this.master.gain.setTargetAtTime(0, now + 1.4, 0.25);
    const voice = v;
    window.setTimeout(() => {
      if (this.voice === voice) this.kill();
    }, 2800);
    this.level = 0;
  }

  setVolume(volume: number) {
    this.opts.volume = volume;
    if (this.ctx && this.master && this.voice) this.master.gain.setTargetAtTime(volume * 0.55, this.ctx.currentTime, 0.05);
  }

  /** Stop immediately (abort, unmount, mute). */
  kill() {
    const v = this.voice;
    this.voice = null;
    this.level = 0;
    if (!v || !this.ctx) return;
    const now = this.ctx.currentTime;
    for (const o of [...v.oscs, v.whistle]) {
      try {
        o.stop(now + 0.05);
      } catch {
        /* already stopped */
      }
    }
    try {
      v.noise.stop(now + 0.05);
    } catch {
      /* already stopped */
    }
    v.engine.gain.setTargetAtTime(0, now, 0.01);
  }
}

export const engineAudio = new EngineAudio();
