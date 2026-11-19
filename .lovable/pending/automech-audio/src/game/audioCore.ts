let context: AudioContext | null = null;
let master: GainNode | null = null;
let noise: AudioBuffer | null = null;
/** Lazy, gesture-resumed, shared engine/UI context. No browser access during SSR. */
export function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  try {
    if (!context || context.state === 'closed') {
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return null;
      context = new Ctor(); master = null; noise = null;
    }
    if (context.state === 'suspended') void context.resume().catch(() => {});
    return context;
  } catch { return null; }
}
export function getMasterBus(): GainNode | null {
  const ctx = getAudioContext();
  if (!ctx) return null;
  if (!master) {
    master = ctx.createGain(); master.gain.value = 0.8;
    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -8; limiter.knee.value = 5; limiter.ratio.value = 16;
    limiter.attack.value = 0.002; limiter.release.value = 0.12;
    master.connect(limiter).connect(ctx.destination);
  }
  return master;
}
export function getNoiseBuffer(): AudioBuffer | null {
  const ctx = getAudioContext();
  if (!ctx) return null;
  if (!noise) {
    noise = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const data = noise.getChannelData(0); let seed = 0x4155544f;
    for (let i = 0; i < data.length; i++) {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      data[i] = seed / 2147483648 - 1;
    }
  }
  return noise;
}
