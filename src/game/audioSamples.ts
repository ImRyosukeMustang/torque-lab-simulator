import inlineTurboUrl from "./assets/audio/inline-turbo.mp3?url";
import v6FullThrottleUrl from "./assets/audio/v6-full-throttle.mp3?url";
import vEngineCollectionUrl from "./assets/audio/v-engine-collection.mp3?url";
import type { EngineSampleId } from "./soundProfile";

const SAMPLE_URLS: Record<EngineSampleId, string> = {
  "inline-turbo": inlineTurboUrl,
  "v6-full-throttle": v6FullThrottleUrl,
  "v-engine-collection": vEngineCollectionUrl,
};

const SAMPLE_CYLINDERS: Record<EngineSampleId, number> = {
  "inline-turbo": 4,
  "v6-full-throttle": 6,
  "v-engine-collection": 8,
};

const FALLBACK_RPM: Record<EngineSampleId, number> = {
  "inline-turbo": 5500,
  "v6-full-throttle": 6500,
  "v-engine-collection": 6000,
};

export interface EngineLoopRegion {
  startFrame: number;
  endFrame: number;
  sourceRpm: number;
}

export function findEngineLoopRegion(
  channels: readonly Float32Array[],
  sampleRate: number,
  cylinders: number,
  fallbackRpm: number,
): EngineLoopRegion {
  const frameCount = Math.min(...channels.map((channel) => channel.length));
  if (channels.length === 0 || !Number.isFinite(frameCount) || frameCount < 1 || cylinders <= 0) {
    return fallbackLoop(0, sampleRate, fallbackRpm);
  }
  const downsample = Math.max(1, Math.round(sampleRate / 8000));
  const analysisRate = sampleRate / downsample;
  const primaryChannel = channels.reduce((selected, channel) => {
    let selectedEnergy = 0, candidateEnergy = 0;
    const sampleCount = Math.floor(frameCount / downsample);
    for (let i = 0; i < sampleCount; i++) {
      const selectedSample = selected[i * downsample] ?? 0;
      const candidateSample = channel[i * downsample] ?? 0;
      selectedEnergy += selectedSample * selectedSample;
      candidateEnergy += candidateSample * candidateSample;
    }
    return candidateEnergy > selectedEnergy ? channel : selected;
  });
  const analysis = new Float32Array(Math.floor(frameCount / downsample));
  for (let i = 0; i < analysis.length; i++) {
    let sum = 0;
    for (let j = 0; j < downsample; j++) sum += primaryChannel[i * downsample + j] ?? 0;
    analysis[i] = sum / downsample;
  }

  const windowSize = Math.min(1024, analysis.length);
  const minWindow = Math.min(512, analysis.length);
  if (windowSize < minWindow) {
    return fallbackLoop(frameCount, sampleRate, fallbackRpm);
  }

  const minLag = Math.max(2, Math.floor((analysisRate * 120) / (cylinders * 9000)));
  const maxLag = Math.min(Math.floor(windowSize / 4), Math.ceil((analysisRate * 120) / (cylinders * 1200)));
  const step = Math.max(1, Math.floor(windowSize / 2));
  const candidates: { start: number; rpm: number; rms: number; quality: number }[] = [];

  for (let start = 0; start + windowSize <= analysis.length; start += step) {
    let mean = 0;
    for (let i = 0; i < windowSize; i++) mean += analysis[start + i]!;
    mean /= windowSize;

    let energy = 0;
    for (let i = 0; i < windowSize; i++) {
      const sample = analysis[start + i]! - mean;
      energy += sample * sample;
    }
    const rms = Math.sqrt(energy / windowSize);
    if (rms < 1e-4) continue;

    const correlations: { lag: number; value: number }[] = [];
    let bestCorrelation = -1;
    for (let lag = minLag; lag <= maxLag; lag++) {
      let cross = 0, left = 0, right = 0;
      for (let i = 0; i < windowSize - lag; i++) {
        const a = analysis[start + i]! - mean;
        const b = analysis[start + i + lag]! - mean;
        cross += a * b;
        left += a * a;
        right += b * b;
      }
      const value = cross / Math.sqrt(left * right || 1);
      correlations.push({ lag, value });
      bestCorrelation = Math.max(bestCorrelation, value);
    }

    if (bestCorrelation < 0.2) continue;
    let selected: { lag: number; distance: number } | null = null;
    for (let i = 1; i < correlations.length - 1; i++) {
      const candidate = correlations[i]!;
      if (candidate.value < bestCorrelation * 0.88 || candidate.value < correlations[i - 1]!.value || candidate.value < correlations[i + 1]!.value) continue;
      const left = correlations[i - 1]!.value;
      const right = correlations[i + 1]!.value;
      const curvature = left - 2 * candidate.value + right;
      const offset = curvature === 0 ? 0 : Math.max(-0.5, Math.min(0.5, 0.5 * (left - right) / curvature));
      const lag = candidate.lag + offset;
      const rpm = (analysisRate / lag) * (120 / cylinders);
      const distance = Math.abs(Math.log(rpm / fallbackRpm));
      if (!selected || distance < selected.distance) selected = { lag, distance };
    }
    if (selected) {
      candidates.push({ start, rpm: (analysisRate / selected.lag) * (120 / cylinders), rms, quality: bestCorrelation });
    }
  }

  if (candidates.length === 0) return fallbackLoop(frameCount, sampleRate, fallbackRpm);
  const maxRms = Math.max(...candidates.map((candidate) => candidate.rms));
  const best = candidates.reduce((chosen, candidate) => {
    const score = candidate.quality * (candidate.rms / maxRms) / (1 + Math.abs(Math.log(candidate.rpm / fallbackRpm)) * 1.6);
    const chosenScore = chosen.quality * (chosen.rms / maxRms) / (1 + Math.abs(Math.log(chosen.rpm / fallbackRpm)) * 1.6);
    return score > chosenScore ? candidate : chosen;
  });
  return {
    startFrame: best.start * downsample,
    endFrame: Math.min(frameCount, (best.start + windowSize) * downsample),
    sourceRpm: Math.round(best.rpm),
  };
}

function fallbackLoop(frameCount: number, sampleRate: number, fallbackRpm: number): EngineLoopRegion {
  const length = Math.min(frameCount, Math.max(1, Math.round(sampleRate * 0.25)));
  const startFrame = Math.max(0, Math.floor((frameCount - length) / 2));
  return { startFrame, endFrame: startFrame + length, sourceRpm: fallbackRpm };
}

function makeLoopBuffer(ctx: AudioContext, source: AudioBuffer, region: EngineLoopRegion): AudioBuffer {
  const length = region.endFrame - region.startFrame;
  const loop = ctx.createBuffer(source.numberOfChannels, length, source.sampleRate);
  const fadeFrames = Math.min(Math.round(source.sampleRate * 0.012), Math.floor(length / 4));
  for (let channel = 0; channel < source.numberOfChannels; channel++) {
    const input = source.getChannelData(channel);
    const output = loop.getChannelData(channel);
    output.set(input.subarray(region.startFrame, region.endFrame));
    for (let i = 0; i < fadeFrames; i++) {
      const t = i / Math.max(1, fadeFrames - 1);
      const tail = output[length - fadeFrames + i]!;
      const head = output[i]!;
      output[length - fadeFrames + i] = tail * Math.cos(t * Math.PI / 2) + head * Math.sin(t * Math.PI / 2);
    }
  }
  return loop;
}

export interface LoadedEngineSample {
  buffer: AudioBuffer;
  sourceRpm: number;
}

const loadedSamples = new WeakMap<AudioContext, Map<EngineSampleId, Promise<LoadedEngineSample>>>();

export function loadEngineSample(ctx: AudioContext, id: EngineSampleId): Promise<LoadedEngineSample> {
  let contextLoaded = loadedSamples.get(ctx);
  if (!contextLoaded) {
    contextLoaded = new Map();
    loadedSamples.set(ctx, contextLoaded);
  }

  const cached = contextLoaded.get(id);
  if (cached) return cached;

  const url = SAMPLE_URLS[id];
  if (!url) throw new Error(`Unknown engine recording: ${id}`);

  const pending = fetch(url)
    .then((response) => {
      if (!response.ok)
        throw new Error(`Engine recording request failed (${response.status}): ${id}`);
      return response.arrayBuffer();
    })
    .then((data) => ctx.decodeAudioData(data))
    .then((source) => {
      const region = findEngineLoopRegion(
        Array.from({ length: source.numberOfChannels }, (_, channel) => source.getChannelData(channel)),
        source.sampleRate,
        SAMPLE_CYLINDERS[id],
        FALLBACK_RPM[id],
      );
      return { buffer: makeLoopBuffer(ctx, source, region), sourceRpm: region.sourceRpm };
    })
    .catch((error: unknown) => {
      contextLoaded.delete(id);
      throw error;
    });

  contextLoaded.set(id, pending);
  return pending;
}
