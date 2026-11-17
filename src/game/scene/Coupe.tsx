import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { dynoLive } from "../dynoLive";
import type { Cosmetics, PaintFinish, RimStyle } from "../sim/cosmetics";
import { getPart } from "../sim/parts";
import { useGame } from "../store";
import { SCENE_COLORS as C, WHEEL } from "./layout";

const ARCH_A = Math.PI + 0.283;
const ARCH_B = -0.283;

function extrude(shape: THREE.Shape, depth: number, bevel: number, zCenter = 0) {
  const g = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: true,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: 4,
    curveSegments: 32,
  });
  g.translate(0, 0, -depth / 2 + zCenter);
  g.computeVertexNormals();
  return g;
}

function rearBodyShape() {
  const s = new THREE.Shape();
  s.moveTo(-2.1, 0.22);
  s.lineTo(-1.708, 0.22);
  s.absarc(WHEEL.rearX, 0.33, 0.4, ARCH_A, ARCH_B, true);
  s.lineTo(0.57, 0.22);
  s.lineTo(0.57, 0.97);
  s.lineTo(-1.55, 0.99);
  s.quadraticCurveTo(-2.05, 1.0, -2.19, 0.9);
  s.lineTo(-2.22, 0.62);
  s.quadraticCurveTo(-2.24, 0.36, -2.1, 0.22);
  return s;
}

function fenderShape() {
  const s = new THREE.Shape();
  s.moveTo(0.66, 0.22);
  s.lineTo(0.952, 0.22);
  s.absarc(WHEEL.frontX, 0.33, 0.4, ARCH_A, ARCH_B, true);
  s.lineTo(2.06, 0.22);
  s.quadraticCurveTo(2.19, 0.26, 2.2, 0.4);
  s.lineTo(2.22, 0.55);
  s.quadraticCurveTo(2.21, 0.7, 2.14, 0.74);
  s.quadraticCurveTo(2.05, 0.79, 1.92, 0.8);
  s.quadraticCurveTo(1.3, 0.94, 0.66, 0.98);
  return s;
}

function upperNoseShape() {
  const s = new THREE.Shape();
  s.moveTo(1.9, 0.62);
  s.lineTo(2.21, 0.62);
  s.quadraticCurveTo(2.21, 0.7, 2.14, 0.74);
  s.quadraticCurveTo(2.05, 0.79, 1.92, 0.8);
  s.lineTo(1.9, 0.8);
  return s;
}

function valanceShape() {
  const s = new THREE.Shape();
  s.moveTo(1.86, 0.22);
  s.lineTo(2.06, 0.22);
  s.quadraticCurveTo(2.19, 0.26, 2.2, 0.4);
  s.lineTo(2.205, 0.44);
  s.lineTo(1.86, 0.44);
  return s;
}

function hoodShape() {
  // Drawn relative to the hinge at (0.66, 0.98).
  const s = new THREE.Shape();
  s.moveTo(0, 0.012);
  s.quadraticCurveTo(0.64, -0.028, 1.25, -0.168);
  s.lineTo(1.25, -0.196);
  s.quadraticCurveTo(0.64, -0.058, 0, -0.018);
  return s;
}

function greenhouseShape() {
  const s = new THREE.Shape();
  s.moveTo(0.52, 0.96);
  s.quadraticCurveTo(0.22, 1.2, -0.08, 1.29);
  s.quadraticCurveTo(-0.52, 1.33, -0.98, 1.29);
  s.quadraticCurveTo(-1.45, 1.16, -1.78, 0.99);
  s.lineTo(-1.78, 0.95);
  s.lineTo(0.52, 0.95);
  return s;
}

function roofShape() {
  const s = new THREE.Shape();
  s.moveTo(-0.02, 1.352);
  s.quadraticCurveTo(-0.52, 1.395, -1.02, 1.35);
  s.lineTo(-1.02, 1.325);
  s.quadraticCurveTo(-0.52, 1.37, -0.02, 1.327);
  return s;
}

function tireGeometry() {
  const pts = [
    [0.235, -0.12], [0.3, -0.124], [0.322, -0.112], [0.332, -0.085], [0.334, 0], [0.332, 0.085], [0.322, 0.112], [0.3, 0.124], [0.235, 0.12],
  ].map(([r, y]) => new THREE.Vector2(r, y));
  const g = new THREE.LatheGeometry(pts, 64);
  g.rotateX(Math.PI / 2);
  return g;
}

/** Seeded speckle normal map for metallic flake. */
function flakeTexture() {
  const size = 256;
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const g = c.getContext("2d")!;
  const img = g.createImageData(size, size);
  let seed = 99;
  const r = () => ((seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296);
  for (let i = 0; i < size * size; i++) {
    img.data[i * 4] = 128 + (r() - 0.5) * 120;
    img.data[i * 4 + 1] = 128 + (r() - 0.5) * 120;
    img.data[i * 4 + 2] = 255;
    img.data[i * 4 + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(10, 10);
  return t;
}

function plateTexture(text: string) {
  const c = document.createElement("canvas");
  c.width = 512;
  c.height = 112;
  const g = c.getContext("2d")!;
  g.fillStyle = "#e9e7df";
  g.fillRect(0, 0, 512, 112);
  g.strokeStyle = "#1a1b1d";
  g.lineWidth = 6;
  g.strokeRect(6, 6, 500, 100);
  g.fillStyle = "#1a1b1d";
  g.font = "bold 72px monospace";
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.fillText(text, 256, 60);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

const FINISH: Record<PaintFinish, { metalness: number; roughness: number; clearcoat: number; clearcoatRoughness: number; iridescence: number; flakes: number }> = {
  gloss: { metalness: 0.05, roughness: 0.24, clearcoat: 1, clearcoatRoughness: 0.03, iridescence: 0, flakes: 0 },
  metallic: { metalness: 0.6, roughness: 0.36, clearcoat: 1, clearcoatRoughness: 0.05, iridescence: 0, flakes: 0.22 },
  pearl: { metalness: 0.35, roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.04, iridescence: 0.8, flakes: 0.12 },
  satin: { metalness: 0.3, roughness: 0.5, clearcoat: 0.35, clearcoatRoughness: 0.45, iridescence: 0, flakes: 0.08 },
  matte: { metalness: 0.08, roughness: 0.82, clearcoat: 0, clearcoatRoughness: 1, iridescence: 0, flakes: 0 },
};

/** Applies the paint choice to a shared physical material. */
export function applyPaint(mat: THREE.MeshPhysicalMaterial, flakes: THREE.Texture, color: string, finish: PaintFinish) {
  const f = FINISH[finish];
  mat.color.set(color);
  mat.metalness = f.metalness;
  mat.roughness = f.roughness;
  mat.clearcoat = f.clearcoat;
  mat.clearcoatRoughness = f.clearcoatRoughness;
  mat.iridescence = f.iridescence;
  mat.iridescenceIOR = 1.4;
  mat.iridescenceThicknessRange = [180, 520];
  const wantMap = f.flakes > 0;
  if (wantMap !== Boolean(mat.normalMap)) {
    mat.normalMap = wantMap ? flakes : null;
    mat.needsUpdate = true;
  }
  mat.normalScale.set(f.flakes, f.flakes);
}

function Spokes({ style, side, mat }: { style: RimStyle; side: 1 | -1; mat: THREE.Material }) {
  if (style === "mesh") {
    return (
      <group>
        {Array.from({ length: 10 }, (_, i) => (
          <mesh key={i} rotation-z={(i / 10) * Math.PI * 2 + (i % 2 ? 0.12 : -0.12)} position-z={side * 0.085} material={mat}>
            <boxGeometry args={[0.016, 0.42, 0.02]} />
          </mesh>
        ))}
        <mesh position-z={side * 0.086} material={mat}>
          <torusGeometry args={[0.12, 0.01, 8, 40]} />
        </mesh>
      </group>
    );
  }
  if (style === "dish") {
    return (
      <group>
        {Array.from({ length: 6 }, (_, i) => (
          <mesh key={i} rotation-z={(i / 6) * Math.PI * 2} position-z={side * 0.05} material={mat}>
            <boxGeometry args={[0.04, 0.36, 0.03]} />
          </mesh>
        ))}
        {/* polished lip */}
        <mesh position-z={side * 0.095} rotation-x={Math.PI / 2}>
          <cylinderGeometry args={[0.232, 0.2, 0.05, 48, 1, true]} />
          <meshStandardMaterial color="#d9dcdf" metalness={1} roughness={0.12} side={THREE.DoubleSide} />
        </mesh>
      </group>
    );
  }
  if (style === "turbine") {
    return (
      <group>
        {Array.from({ length: 14 }, (_, i) => (
          <group key={i} rotation-z={(i / 14) * Math.PI * 2}>
            <mesh position={[0, 0.135, side * 0.08]} rotation-y={side * 0.55} material={mat}>
              <boxGeometry args={[0.03, 0.17, 0.012]} />
            </mesh>
          </group>
        ))}
        <mesh position-z={side * 0.083} rotation-x={Math.PI / 2} material={mat}>
          <cylinderGeometry args={[0.06, 0.06, 0.02, 24]} />
        </mesh>
      </group>
    );
  }
  return (
    <group>
      {Array.from({ length: 5 }, (_, i) => (
        <mesh key={i} rotation-z={(i / 5) * Math.PI * 2} position-z={side * 0.085} material={mat}>
          <boxGeometry args={[0.045, 0.43, 0.035]} />
        </mesh>
      ))}
    </group>
  );
}

function Wheel({ position, side, spinRef, look }: { position: [number, number, number]; side: 1 | -1; spinRef?: React.RefObject<THREE.Group | null> | undefined; look: Cosmetics }) {
  const tire = useMemo(tireGeometry, []);
  const rimMat = useMemo(() => new THREE.MeshStandardMaterial({ metalness: 0.85, roughness: 0.28 }), []);
  useEffect(() => {
    rimMat.color.set(look.rimColor);
  }, [rimMat, look.rimColor]);
  return (
    <group position={position}>
      {/* brake disc with hat */}
      <mesh rotation-x={Math.PI / 2} position-z={-side * 0.03} castShadow>
        <cylinderGeometry args={[0.2, 0.2, 0.025, 48]} />
        <meshStandardMaterial color={C.steel} metalness={0.9} roughness={0.38} />
      </mesh>
      <mesh rotation-x={Math.PI / 2} position-z={-side * 0.015}>
        <cylinderGeometry args={[0.09, 0.09, 0.03, 32]} />
        <meshStandardMaterial color="#5a5e63" metalness={0.8} roughness={0.5} />
      </mesh>
      <mesh position={[0.12, 0.12, -side * 0.01]} rotation-z={Math.PI / 4}>
        <boxGeometry args={[0.13, 0.06, 0.07]} />
        <meshStandardMaterial color={look.caliper} metalness={0.3} roughness={0.4} />
      </mesh>
      <group ref={spinRef ?? null}>
        <mesh geometry={tire} castShadow receiveShadow>
          <meshStandardMaterial color={C.rubber} roughness={0.9} />
        </mesh>
        <mesh rotation-x={Math.PI / 2}>
          <cylinderGeometry args={[0.236, 0.236, 0.2, 48, 1, true]} />
          <meshStandardMaterial color={C.trim} metalness={0.6} roughness={0.5} side={THREE.DoubleSide} />
        </mesh>
        {/* dark barrel face behind the spokes */}
        <mesh rotation-x={Math.PI / 2} position-z={side * 0.02}>
          <cylinderGeometry args={[0.226, 0.226, 0.01, 48]} />
          <meshStandardMaterial color="#1a1b1e" metalness={0.4} roughness={0.7} />
        </mesh>
        <Spokes style={look.rimStyle} side={side} mat={rimMat} />
        <mesh position-z={side * 0.09} material={rimMat}>
          <torusGeometry args={[0.225, 0.014, 10, 56]} />
        </mesh>
        <mesh rotation-x={Math.PI / 2} position-z={side * 0.095}>
          <cylinderGeometry args={[0.045, 0.045, 0.03, 20]} />
          <meshStandardMaterial color={C.trim} metalness={0.7} roughness={0.35} />
        </mesh>
        {Array.from({ length: 5 }, (_, i) => (
          <mesh key={i} position={[Math.cos((i / 5) * Math.PI * 2) * 0.065, Math.sin((i / 5) * Math.PI * 2) * 0.065, side * 0.1]} rotation-x={Math.PI / 2}>
            <cylinderGeometry args={[0.009, 0.009, 0.02, 8]} />
            <meshStandardMaterial color="#c9ccd0" metalness={1} roughness={0.2} />
          </mesh>
        ))}
      </group>
    </group>
  );
}

function tipSpec(exhaust: string) {
  switch (exhaust) {
    case "exh-header":
      return { zs: [0.42, 0.62], r: 0.055, color: "#6f5a7c" }; // heat-tinted titanium
    case "exh-3in":
      return { zs: [0.45, 0.6], r: 0.05, color: C.steel };
    case "exh-catback":
      return { zs: [0.45, 0.6], r: 0.04, color: C.steel };
    default:
      return { zs: [0.55], r: 0.032, color: C.steel };
  }
}

function ExhaustTips() {
  const exhaust = useGame((s) => s.game.build.exhaust);
  const { zs, r, color } = tipSpec(getPart("exhaust", exhaust).id);
  const flames = useRef<THREE.Group>(null);
  const flameMat = useMemo(
    () => new THREE.MeshBasicMaterial({ color: new THREE.Color(3.2, 1.3, 0.35), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }),
    [],
  );
  const coreMat = useMemo(
    () => new THREE.MeshBasicMaterial({ color: new THREE.Color(2.4, 2.2, 3.2), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }),
    [],
  );
  useFrame(({ clock }) => {
    const g = flames.current;
    if (!g) return;
    const p = dynoLive.pop;
    // Flicker is purely visual; the simulation stays deterministic.
    const flick = p > 0 ? Math.max(0, Math.sin(clock.elapsedTime * 47) * 0.5 + Math.sin(clock.elapsedTime * 83) * 0.5) : 0;
    const a = p * flick;
    flameMat.opacity = a * 0.85;
    coreMat.opacity = a * 0.7;
    g.visible = a > 0.02;
    g.scale.set(0.6 + a * 0.8, 1, 1);
  });
  return (
    <group>
      {zs.map((z) => (
        <group key={z} position={[-2.2, 0.27, z]}>
          <mesh rotation-z={Math.PI / 2} castShadow>
            <cylinderGeometry args={[r, r, 0.16, 28, 1, true]} />
            <meshStandardMaterial color={color} metalness={0.95} roughness={0.2} side={THREE.DoubleSide} />
          </mesh>
          <mesh rotation-z={Math.PI / 2} position-x={0.02}>
            <cylinderGeometry args={[r * 0.82, r * 0.82, 0.12, 20]} />
            <meshStandardMaterial color="#0c0c0d" roughness={1} />
          </mesh>
        </group>
      ))}
      <group ref={flames} visible={false}>
        {zs.map((z) => (
          <group key={z} position={[-2.36, 0.27, z]}>
            <mesh rotation-z={Math.PI / 2} position-x={-0.06} material={flameMat}>
              <coneGeometry args={[r * 1.1, 0.26, 16, 1, true]} />
            </mesh>
            <mesh rotation-z={Math.PI / 2} position-x={-0.02} material={coreMat}>
              <coneGeometry args={[r * 0.6, 0.13, 12, 1, true]} />
            </mesh>
          </group>
        ))}
      </group>
    </group>
  );
}

/** Thin decal-style stripe surfaces that sit on the body via polygon offset. */
function useStripeMaterial(color: string) {
  const mat = useMemo(
    () => new THREE.MeshPhysicalMaterial({ roughness: 0.3, metalness: 0.1, clearcoat: 1, clearcoatRoughness: 0.05, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4 }),
    [],
  );
  useEffect(() => {
    mat.color.set(color);
  }, [mat, color]);
  return mat;
}

function deckShape() {
  // Follows the boot lid curve from the rear screen to the tail.
  const curve = new THREE.QuadraticBezierCurve(new THREE.Vector2(-1.55, 0.99), new THREE.Vector2(-2.05, 1.0), new THREE.Vector2(-2.19, 0.9));
  const pts = curve.getPoints(24).filter((p) => p.x <= -1.76);
  const s = new THREE.Shape();
  pts.forEach((p, i) => (i === 0 ? s.moveTo(p.x, p.y) : s.lineTo(p.x, p.y)));
  for (let i = pts.length - 1; i >= 0; i--) s.lineTo(pts[i]!.x, pts[i]!.y - 0.03);
  return s;
}

function Stripes({ look, hoodGeo }: { look: Cosmetics; hoodGeo: { lanes: [number, number][]; build: (depth: number, z: number) => { nose: THREE.BufferGeometry; roof: THREE.BufferGeometry; deck: THREE.BufferGeometry } } }) {
  const mat = useStripeMaterial(look.stripeColor);
  const parts = useMemo(() => hoodGeo.lanes.map(([w, z]) => hoodGeo.build(w, z)), [hoodGeo]);
  useEffect(() => () => parts.forEach((p) => Object.values(p).forEach((g) => g.dispose())), [parts]);
  return (
    <group>
      {parts.map((p, i) => (
        <group key={i}>
          <mesh geometry={p.nose} material={mat} />
          <mesh geometry={p.roof} material={mat} />
          <mesh geometry={p.deck} material={mat} />
        </group>
      ))}
    </group>
  );
}

function stripeLanes(style: Cosmetics["stripe"]): [number, number][] {
  if (style === "twin") return [[0.15, -0.17], [0.15, 0.17]];
  if (style === "center") return [[0.34, 0]];
  return [];
}

function SideFlash({ color }: { color: string }) {
  const mat = useStripeMaterial(color);
  return (
    <group>
      {[-1, 1].map((s) => (
        <group key={s}>
          <mesh position={[-0.15, 0.822, s * 0.9215]} rotation-y={s === 1 ? 0 : Math.PI} material={mat}>
            <planeGeometry args={[3.9, 0.035]} />
          </mesh>
          <mesh position={[-0.6, 0.79, s * 0.9215]} rotation-y={s === 1 ? 0 : Math.PI} material={mat}>
            <planeGeometry args={[2.9, 0.012]} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

function BodyDetails() {
  const plateRear = useMemo(() => plateTexture("AM 20 X"), []);
  const plateFront = useMemo(() => plateTexture("AUTOMECH"), []);
  useEffect(
    () => () => {
      plateRear.dispose();
      plateFront.dispose();
    },
    [plateRear, plateFront],
  );
  const seam = useMemo(() => new THREE.MeshStandardMaterial({ color: "#060607", roughness: 0.9, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -6 }), []);
  return (
    <group>
      {[-1, 1].map((s) => (
        <group key={s} rotation-y={s === 1 ? 0 : Math.PI} position-z={0}>
          {/* door shut lines on the side face */}
          <mesh position={[0.5, 0.6, 0.9218]} material={seam}>
            <planeGeometry args={[0.006, 0.66]} />
          </mesh>
          <mesh position={[-0.66, 0.62, 0.9218]} material={seam}>
            <planeGeometry args={[0.006, 0.64]} />
          </mesh>
          {/* door handle */}
          <mesh position={[-0.48, 0.84, 0.93]}>
            <boxGeometry args={[0.14, 0.025, 0.02]} />
            <meshStandardMaterial color={C.trim} metalness={0.6} roughness={0.3} />
          </mesh>
        </group>
      ))}
      {/* number plates */}
      <mesh position={[-2.243, 0.5, 0]} rotation-y={-Math.PI / 2}>
        <planeGeometry args={[0.52, 0.114]} />
        <meshStandardMaterial map={plateRear} roughness={0.5} />
      </mesh>
      <mesh position={[2.215, 0.33, 0]} rotation-y={Math.PI / 2}>
        <planeGeometry args={[0.52, 0.114]} />
        <meshStandardMaterial map={plateFront} roughness={0.5} />
      </mesh>
      {/* fuel filler flap */}
      <mesh position={[-1.25, 0.86, -0.9218]} rotation-y={Math.PI} material={seam}>
        <circleGeometry args={[0.07, 24]} />
      </mesh>
    </group>
  );
}

function HoodVents() {
  const cooling = useGame((s) => s.game.build.cooling);
  if (cooling !== "cool-race") return null;
  return (
    <group>
      {[-0.32, 0.32].map((z) => (
        <group key={z} position={[0.86, -0.08, z]} rotation-z={-0.13}>
          {[0, 1, 2, 3].map((i) => (
            <mesh key={i} position={[i * 0.06, 0.012, 0]}>
              <boxGeometry args={[0.025, 0.012, 0.3]} />
              <meshStandardMaterial color={C.trim} roughness={0.7} />
            </mesh>
          ))}
        </group>
      ))}
    </group>
  );
}

export function Coupe({ children }: { children?: React.ReactNode }) {
  const look = useGame((s) => s.game.cosmetics);
  const geo = useMemo(
    () => ({
      rear: extrude(rearBodyShape(), 1.74, 0.05),
      fender: extrude(fenderShape(), 0.2, 0.04),
      nose: extrude(upperNoseShape(), 1.22, 0.03),
      valance: extrude(valanceShape(), 1.22, 0.03),
      hood: extrude(hoodShape(), 1.24, 0.012),
      glass: extrude(greenhouseShape(), 1.34, 0.06),
      roof: extrude(roofShape(), 1.16, 0.03),
    }),
    [],
  );
  const flakes = useMemo(flakeTexture, []);
  const paint = useMemo(() => new THREE.MeshPhysicalMaterial({ color: C.paint }), []);
  useEffect(() => {
    applyPaint(paint, flakes, look.paint, look.finish);
  }, [paint, flakes, look.paint, look.finish]);
  const glassMat = useMemo(() => new THREE.MeshPhysicalMaterial({ metalness: 0.3, roughness: 0.04, clearcoat: 1, clearcoatRoughness: 0.02 }), []);
  useEffect(() => {
    glassMat.color.copy(new THREE.Color("#3a4a56").lerp(new THREE.Color("#050608"), look.tint));
  }, [glassMat, look.tint]);

  // Stripe geometry: the same body profiles extruded narrower so they sit flush on the panels.
  const stripeGeo = useMemo(
    () => ({
      lanes: stripeLanes(look.stripe),
      build: (w: number, z: number) => ({
        nose: extrude(upperNoseShape(), w, 0.03, z),
        roof: extrude(roofShape(), w, 0.03, z),
        deck: (() => {
          const g = extrude(deckShape(), w, 0.05, z);
          g.translate(0, 0.002, 0);
          return g;
        })(),
      }),
    }),
    [look.stripe],
  );
  const stripeMat = useStripeMaterial(look.stripeColor);
  const hoodStripes = useMemo(() => stripeGeo.lanes.map(([w, z]) => extrude(hoodShape(), w, 0.012, z)), [stripeGeo]);
  useEffect(() => () => hoodStripes.forEach((g) => g.dispose()), [hoodStripes]);

  const hood = useRef<THREE.Group>(null);
  const rearL = useRef<THREE.Group>(null);
  const rearR = useRef<THREE.Group>(null);
  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05);
    const open = useGame.getState().hoodOpen;
    if (hood.current) {
      const target = open ? 1.05 : 0;
      hood.current.rotation.z += (target - hood.current.rotation.z) * (1 - Math.exp(-6 * dt));
    }
    if (dynoLive.running) {
      // Drive wheels turn at engine speed through a 1.0 test gear and 3.9 final drive.
      const w = ((dynoLive.rpm / 3.9) * Math.PI * 2) / 60;
      if (rearL.current) rearL.current.rotation.z -= w * dt;
      if (rearR.current) rearR.current.rotation.z -= w * dt;
    }
  });

  return (
    <group>
      <mesh geometry={geo.rear} material={paint} castShadow receiveShadow />
      <mesh geometry={geo.fender} material={paint} position-z={0.78} castShadow receiveShadow />
      <mesh geometry={geo.fender} material={paint} position-z={-0.78} castShadow receiveShadow />
      <mesh geometry={geo.nose} material={paint} castShadow />
      <mesh geometry={geo.valance} material={paint} castShadow />
      <mesh geometry={geo.roof} material={paint} castShadow />
      <mesh geometry={geo.glass} material={glassMat} castShadow />
      {stripeGeo.lanes.length > 0 && <Stripes look={look} hoodGeo={stripeGeo} />}
      {look.stripe === "side" && <SideFlash color={look.stripeColor} />}
      <BodyDetails />
      {/* hood, hinged at the cowl */}
      <group ref={hood} position={[0.66, 0.98, 0]}>
        <mesh geometry={geo.hood} material={paint} castShadow />
        {hoodStripes.map((g, i) => (
          <mesh key={i} geometry={g} material={stripeMat} />
        ))}
        <HoodVents />
      </group>
      {/* bay floor and firewall trim */}
      <mesh position={[1.25, 0.3, 0]} receiveShadow>
        <boxGeometry args={[1.25, 0.03, 1.28]} />
        <meshStandardMaterial color={C.trim} roughness={0.8} />
      </mesh>
      <mesh position={[0.6, 0.65, 0]}>
        <boxGeometry args={[0.04, 0.65, 1.28]} />
        <meshStandardMaterial color={C.trim} roughness={0.75} />
      </mesh>
      {/* grille */}
      {[0.48, 0.53, 0.58].map((y) => (
        <mesh key={y} position={[2.17, y, 0]}>
          <boxGeometry args={[0.02, 0.012, 1.24]} />
          <meshStandardMaterial color={C.trim} metalness={0} roughness={0.8} />
        </mesh>
      ))}
      {/* lights */}
      {[-1, 1].map((s) => (
        <group key={s}>
          <mesh position={[2.185, 0.675, s * 0.56]} rotation-y={s * -0.18}>
            <boxGeometry args={[0.06, 0.045, 0.34]} />
            <meshStandardMaterial color="#e8eef2" emissive="#dfe8ee" emissiveIntensity={1.4} roughness={0.1} />
          </mesh>
          {/* fog lamps */}
          <mesh position={[2.2, 0.36, s * 0.48]} rotation-z={Math.PI / 2}>
            <cylinderGeometry args={[0.035, 0.035, 0.02, 20]} />
            <meshStandardMaterial color="#f2efe6" emissive="#f4e8cc" emissiveIntensity={0.8} roughness={0.15} />
          </mesh>
          {/* mirrors */}
          <mesh position={[0.3, 1.02, s * 0.97]} castShadow>
            <boxGeometry args={[0.14, 0.08, 0.1]} />
            <primitive object={paint} attach="material" />
          </mesh>
          {/* side skirt */}
          <mesh position={[0, 0.21, s * 0.9]}>
            <boxGeometry args={[1.85, 0.06, 0.06]} />
            <meshStandardMaterial color={C.trim} roughness={0.6} />
          </mesh>
          {/* B pillar */}
          <mesh position={[-0.55, 1.14, s * 0.72]} rotation-x={s * 0.22}>
            <boxGeometry args={[0.07, 0.32, 0.02]} />
            <meshStandardMaterial color={C.trim} roughness={0.4} />
          </mesh>
        </group>
      ))}
      <mesh position={[-2.21, 0.8, 0]}>
        <boxGeometry args={[0.04, 0.05, 1.55]} />
        <meshStandardMaterial color="#5a0d0a" emissive="#c21a10" emissiveIntensity={2.2} roughness={0.2} />
      </mesh>
      {/* ducktail spoiler */}
      <mesh position={[-2.02, 1.03, 0]} rotation-z={0.18} castShadow>
        <boxGeometry args={[0.3, 0.025, 1.6]} />
        <primitive object={paint} attach="material" />
      </mesh>
      {/* diffuser */}
      <mesh position={[-2.05, 0.24, 0]}>
        <boxGeometry args={[0.3, 0.05, 1.3]} />
        <meshStandardMaterial color={C.trim} roughness={0.7} />
      </mesh>
      {[-0.4, -0.15, 0.15, 0.4].map((z) => (
        <mesh key={z} position={[-2.08, 0.27, z]}>
          <boxGeometry args={[0.26, 0.08, 0.015]} />
          <meshStandardMaterial color={C.trim} roughness={0.7} />
        </mesh>
      ))}
      <ExhaustTips />
      <Wheel position={[WHEEL.frontX, WHEEL.radius, WHEEL.z]} side={1} look={look} />
      <Wheel position={[WHEEL.frontX, WHEEL.radius, -WHEEL.z]} side={-1} look={look} />
      <Wheel position={[WHEEL.rearX, WHEEL.radius, WHEEL.z]} side={1} spinRef={rearL} look={look} />
      <Wheel position={[WHEEL.rearX, WHEEL.radius, -WHEEL.z]} side={-1} spinRef={rearR} look={look} />
      {children}
    </group>
  );
}
