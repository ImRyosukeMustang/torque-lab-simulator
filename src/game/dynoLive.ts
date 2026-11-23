// Live dyno telemetry shared between the dyno panel and the 3D scene.
// Mutable on purpose: the scene reads it every frame without React re-renders.
export const dynoLive = {
  running: false,
  rpm: 0,
  /** 0..1 throttle/load, used for engine shake. */
  load: 0,
  egtC: 25,
  boostBar: 0,
  /** 0..1 burst intensity for exhaust flames (rev limiter / lift-off). */
  pop: 0,
  /** Longitudinal acceleration (m/s²): pitches the body back on launch. */
  accel: 0,
  /** 0..1 tyre spin intensity: tyre smoke. */
  spin: 0,
  /** 0..1 camera shake impulse from hard shifts, decays in the scene. */
  shake: 0,
  /** Rev limit of the current run, for the shift light. */
  revLimit: 7000,
};
