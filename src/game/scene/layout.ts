// 3D layout constants (car space: car faces +X, origin at floor centre).
import type { SlotId } from "../sim/types";

export const SCENE_COLORS = {
  paint: "#b8461e",
  trim: "#15171a",
  rubber: "#1b1c1e",
  rim: "#9ea3a8",
  glass: "#10161c",
  steel: "#8d9297",
  castIron: "#3a3c3f",
  aluminium: "#b9bdc1",
  blackPlastic: "#1e2023",
  hose: "#2a2c2f",
  caliper: "#c58a1c",
  highlight: "#f0a028",
  floor: "#4a4c4f",
  wall: "#24272b",
};

export type Vec3 = [number, number, number];

/** Where the camera looks for each component, and from where. */
export const SLOT_FOCUS: Record<SlotId, { target: Vec3; camera: Vec3 }> = {
  intake: { target: [1.55, 0.66, -0.42], camera: [2.6, 1.7, -1.6] },
  camshaft: { target: [1.02, 0.84, 0], camera: [1.9, 2.0, 0.9] },
  turbo: { target: [1.05, 0.6, 0.4], camera: [1.9, 1.5, 1.7] },
  intercooler: { target: [1.95, 0.52, 0], camera: [3.6, 1.0, 0.9] },
  injectors: { target: [1.02, 0.86, -0.14], camera: [1.6, 1.9, -1.1] },
  exhaust: { target: [1.0, 0.55, 0.32], camera: [1.5, 1.6, 1.6] },
  ecu: { target: [0.76, 0.58, -0.5], camera: [1.6, 1.5, -1.5] },
};

export const VIEWS = {
  exterior: { target: [0, 0.6, 0] as Vec3, camera: [5.4, 2.1, 5.0] as Vec3 },
  bay: { target: [1.22, 0.62, 0] as Vec3, camera: [3.3, 2.5, 1.9] as Vec3 },
  dyno: { target: [0.4, 0.6, 0] as Vec3, camera: [3.9, 2.0, 3.6] as Vec3 },
};

export const WHEEL = { radius: 0.33, frontX: 1.33, rearX: -1.33, z: 0.8 };
