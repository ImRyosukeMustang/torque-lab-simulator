// Live dyno telemetry shared between the dyno panel and the 3D scene.
// Mutable on purpose: the scene reads it every frame without React re-renders.
export const dynoLive = {
  running: false,
  rpm: 0,
  /** 0..1 throttle/load, used for engine shake. */
  load: 0,
  egtC: 25,
  boostBar: 0,
};
