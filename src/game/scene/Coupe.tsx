import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { dynoLive } from "../dynoLive";
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
  const g = new THREE.LatheGeometry(pts, 48);
  g.rotateX(Math.PI / 2);
  return g;
}

function Wheel({ position, side, spinRef }: { position: [number, number, number]; side: 1 | -1; spinRef?: React.RefObject<THREE.Group | null> | undefined }) {
  const tire = useMemo(tireGeometry, []);
  return (
    <group position={position}>
      {/* brake */}
      <mesh rotation-x={Math.PI / 2} position-z={-side * 0.03} castShadow>
        <cylinderGeometry args={[0.2, 0.2, 0.025, 40]} />
        <meshStandardMaterial color={C.steel} metalness={0.9} roughness={0.35} />
      </mesh>
      <mesh position={[0.12, 0.12, -side * 0.01]} rotation-z={Math.PI / 4}>
        <boxGeometry args={[0.13, 0.06, 0.07]} />
        <meshStandardMaterial color={C.caliper} metalness={0.3} roughness={0.45} />
      </mesh>
      <group ref={spinRef ?? null}>
        <mesh geometry={tire} castShadow receiveShadow>
          <meshStandardMaterial color={C.rubber} roughness={0.92} />
        </mesh>
        <mesh rotation-x={Math.PI / 2}>
          <cylinderGeometry args={[0.236, 0.236, 0.2, 40, 1, true]} />
          <meshStandardMaterial color={C.trim} metalness={0.6} roughness={0.5} side={THREE.DoubleSide} />
        </mesh>
        {Array.from({ length: 5 }, (_, i) => (
          <mesh key={i} rotation-z={(i / 5) * Math.PI * 2} position-z={side * 0.085}>
            <boxGeometry args={[0.045, 0.43, 0.035]} />
            <meshStandardMaterial color={C.rim} metalness={0.85} roughness={0.28} />
          </mesh>
        ))}
        <mesh rotation-x={Math.PI / 2} position-z={side * 0.09}>
          <torusGeometry args={[0.225, 0.014, 10, 48]} />
          <meshStandardMaterial color={C.rim} metalness={0.85} roughness={0.28} />
        </mesh>
        <mesh rotation-x={Math.PI / 2} position-z={side * 0.095}>
          <cylinderGeometry args={[0.045, 0.045, 0.03, 20]} />
          <meshStandardMaterial color={C.trim} metalness={0.7} roughness={0.35} />
        </mesh>
      </group>
    </group>
  );
}

function ExhaustTips() {
  const exhaust = useGame((s) => s.game.build.exhaust);
  const part = getPart("exhaust", exhaust);
  const count = part.id === "exh-stock" ? 1 : 2;
  const r = part.id === "exh-3in" ? 0.05 : part.id === "exh-catback" ? 0.04 : 0.032;
  const zs = count === 1 ? [0.55] : [0.45, 0.6];
  return (
    <group>
      {zs.map((z) => (
        <mesh key={z} position={[-2.2, 0.27, z]} rotation-z={Math.PI / 2} castShadow>
          <cylinderGeometry args={[r, r, 0.16, 24, 1, true]} />
          <meshStandardMaterial color={C.steel} metalness={0.95} roughness={0.22} side={THREE.DoubleSide} />
        </mesh>
      ))}
    </group>
  );
}

export function Coupe({ children }: { children?: React.ReactNode }) {
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
  const paint = useMemo(
    () => new THREE.MeshPhysicalMaterial({ color: C.paint, metalness: 0.35, roughness: 0.32, clearcoat: 1, clearcoatRoughness: 0.08 }),
    [],
  );

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
      <mesh geometry={geo.glass} castShadow>
        <meshPhysicalMaterial color={C.glass} metalness={0.2} roughness={0.05} clearcoat={1} />
      </mesh>
      {/* hood, hinged at the cowl */}
      <group ref={hood} position={[0.66, 0.98, 0]}>
        <mesh geometry={geo.hood} material={paint} castShadow />
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
          <meshStandardMaterial color={C.trim} metalness={0.4} roughness={0.5} />
        </mesh>
      ))}
      {/* lights */}
      {[-1, 1].map((s) => (
        <group key={s}>
          <mesh position={[2.12, 0.69, s * 0.64]} rotation-y={s * -0.25}>
            <boxGeometry args={[0.12, 0.045, 0.3]} />
            <meshStandardMaterial color="#e8eef2" emissive="#dfe8ee" emissiveIntensity={0.6} roughness={0.1} />
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
        <meshStandardMaterial color="#5a0d0a" emissive="#c21a10" emissiveIntensity={1.1} roughness={0.2} />
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
      <Wheel position={[WHEEL.frontX, WHEEL.radius, WHEEL.z]} side={1} />
      <Wheel position={[WHEEL.frontX, WHEEL.radius, -WHEEL.z]} side={-1} />
      <Wheel position={[WHEEL.rearX, WHEEL.radius, WHEEL.z]} side={1} spinRef={rearL} />
      <Wheel position={[WHEEL.rearX, WHEEL.radius, -WHEEL.z]} side={-1} spinRef={rearR} />
      {children}
    </group>
  );
}
