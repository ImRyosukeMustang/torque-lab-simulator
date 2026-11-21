// Turns the coupe's side-profile extrusions into a curved body. Every panel goes through the
// same car-space deformation, so separate pieces (fenders, nose, bonnet, stripes) still meet.
import * as THREE from "three";

const smoothstep = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/** Half-width scale at a point of the side profile (1 = full extrusion width). */
export function widthScale(x: number, y: number): number {
  const nose = 0.11 * smoothstep(1.45, 2.25, x) ** 1.4;
  const tail = 0.08 * smoothstep(1.35, 2.25, -x) ** 1.4;
  // Tumblehome: the glasshouse leans inward toward the roof.
  const tumble = 0.17 * smoothstep(0.96, 1.42, y);
  // Barrel side: the flank bulges at the shoulder and tucks in at the sill.
  const barrel = 0.035 * ((y - 0.72) / 0.5) ** 2;
  return 1 - nose - tail - tumble - barrel;
}

/** Downward crown of top surfaces toward the edges (metres at the outer edge). */
export function crownDrop(y: number, zNorm: number): number {
  return 0.045 * zNorm * zNorm * smoothstep(0.7, 0.95, y);
}

/** Deform a geometry built in car space (offset = where its mesh origin sits in car space). */
export function sculptBody(g: THREE.BufferGeometry, offset: [number, number, number] = [0, 0, 0], halfWidth = 0.87) {
  const p = g.getAttribute("position") as THREE.BufferAttribute;
  const [ox, oy, oz] = offset;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i) + ox, y = p.getY(i) + oy, z = p.getZ(i) + oz;
    const zn = Math.min(1, Math.abs(z) / halfWidth);
    const nz = z * widthScale(x, y);
    const ny = y - crownDrop(y, zn);
    p.setXYZ(i, x - ox, ny - oy, nz - oz);
  }
  p.needsUpdate = true;
  smoothNormals(g);
  return g;
}

/** Area-weighted normals shared by every vertex at the same position, keeping UVs intact
 * (ExtrudeGeometry is unindexed, so its default normals are flat per face). */
export function smoothNormals(g: THREE.BufferGeometry, creaseCos = 0.2) {
  const p = g.getAttribute("position") as THREE.BufferAttribute;
  const n = p.count;
  const face = new Float32Array(n * 3);
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  for (let i = 0; i < n; i += 3) {
    a.fromBufferAttribute(p, i); b.fromBufferAttribute(p, i + 1); c.fromBufferAttribute(p, i + 2);
    b.sub(a); c.sub(a); b.cross(c); // length = 2 × area
    for (let k = 0; k < 3; k++) face.set([b.x, b.y, b.z], (i + k) * 3);
  }
  const key = (i: number) => `${Math.round(p.getX(i) * 1e4)},${Math.round(p.getY(i) * 1e4)},${Math.round(p.getZ(i) * 1e4)}`;
  const groups = new Map<string, number[]>();
  for (let i = 0; i < n; i++) {
    const k = key(i);
    const list = groups.get(k);
    if (list) list.push(i); else groups.set(k, [i]);
  }
  const out = new Float32Array(n * 3);
  const own = new THREE.Vector3(), other = new THREE.Vector3(), sum = new THREE.Vector3();
  for (const list of groups.values()) {
    for (const i of list) {
      own.fromArray(face, i * 3).normalize();
      sum.set(0, 0, 0);
      // Only blend faces within the crease angle, so genuinely sharp edges stay crisp.
      for (const j of list) {
        other.fromArray(face, j * 3);
        if (own.dot(other.clone().normalize()) >= creaseCos) sum.add(other);
      }
      sum.normalize();
      out.set([sum.x, sum.y, sum.z], i * 3);
    }
  }
  g.setAttribute("normal", new THREE.BufferAttribute(out, 3));
}
