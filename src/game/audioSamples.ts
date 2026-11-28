import inlineTurboUrl from "./assets/audio/inline-turbo.mp3?url";
import v6FullThrottleUrl from "./assets/audio/v6-full-throttle.mp3?url";
import vEngineCollectionUrl from "./assets/audio/v-engine-collection.mp3?url";
import type { EngineSampleId } from "./soundProfile";

const SAMPLE_URLS: Record<EngineSampleId, string> = {
  "inline-turbo": inlineTurboUrl,
  "v6-full-throttle": v6FullThrottleUrl,
  "v-engine-collection": vEngineCollectionUrl,
};

const buffers = new WeakMap<AudioContext, Map<EngineSampleId, Promise<AudioBuffer>>>();

export function loadEngineSample(ctx: AudioContext, id: EngineSampleId): Promise<AudioBuffer> {
  let contextBuffers = buffers.get(ctx);
  if (!contextBuffers) {
    contextBuffers = new Map();
    buffers.set(ctx, contextBuffers);
  }

  const cached = contextBuffers.get(id);
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
    .catch((error: unknown) => {
      contextBuffers.delete(id);
      throw error;
    });

  contextBuffers.set(id, pending);
  return pending;
}
