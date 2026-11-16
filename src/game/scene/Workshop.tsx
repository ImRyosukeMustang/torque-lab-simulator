import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { dynoLive } from "../dynoLive";
import { SCENE_COLORS as C, WHEEL } from "./layout";

// Seeded PRNG so the generated textures are identical every load.
function rng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

function concreteTexture() {
  const size = 1024;
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const g = c.getContext("2d")!;
  const r = rng(7);
  g.fillStyle = "#5a5c5f";
  g.fillRect(0, 0, size, size);
  for (let i = 0; i < 26000; i++) {
    const v = 70 + r() * 50;
    g.fillStyle = `rgba(${v},${v + 1},${v + 3},${0.08 + r() * 0.12})`;
    const s = 1 + r() * 3;
    g.fillRect(r() * size, r() * size, s, s);
  }
  for (let i = 0; i < 18; i++) {
    g.fillStyle = `rgba(30,30,32,${0.05 + r() * 0.06})`;
    g.beginPath();
    g.ellipse(r() * size, r() * size, 30 + r() * 120, 20 + r() * 80, r() * 3, 0, Math.PI * 2);
    g.fill();
  }
  g.strokeStyle = "rgba(25,26,28,0.55)";
  g.lineWidth = 3;
  for (let i = 0; i <= 4; i++) {
    g.beginPath();
    g.moveTo((i * size) / 4, 0);
    g.lineTo((i * size) / 4, size);
    g.moveTo(0, (i * size) / 4);
    g.lineTo(size, (i * size) / 4);
    g.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(5, 5);
  t.anisotropy = 8;
  return t;
}

function panelTexture() {
  const c = document.createElement("canvas");
  c.width = 512;
  c.height = 256;
  const g = c.getContext("2d")!;
  const r = rng(3);
  g.fillStyle = "#2a2d31";
  g.fillRect(0, 0, 512, 256);
  for (let i = 0; i < 4000; i++) {
    const v = 36 + r() * 14;
    g.fillStyle = `rgba(${v},${v + 2},${v + 5},0.3)`;
    g.fillRect(r() * 512, r() * 256, 2, 2);
  }
  g.strokeStyle = "#1b1d20";
  g.lineWidth = 4;
  for (let x = 0; x <= 512; x += 128) {
    g.beginPath();
    g.moveTo(x, 0);
    g.lineTo(x, 256);
    g.stroke();
  }
  g.fillStyle = "#3b3f44";
  g.fillRect(0, 180, 512, 6);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(6, 1);
  return t;
}

function DynoRollers() {
  const rollers = useRef<THREE.Group[]>([]);
  useFrame((_, delta) => {
    if (!dynoLive.running) return;
    const w = ((dynoLive.rpm / 3.9) * Math.PI * 2) / 60;
    // Rollers counter-rotate relative to the wheel, scaled by radius ratio.
    rollers.current.forEach((r) => r && (r.rotation.z += w * (WHEEL.radius / 0.16) * Math.min(delta, 0.05)));
  });
  return (
    <group position={[WHEEL.rearX, 0, 0]}>
      {/* pit plate */}
      <mesh position={[0, 0.004, 0]} receiveShadow>
        <boxGeometry args={[1.1, 0.008, 2.3]} />
        <meshStandardMaterial color="#1d1f22" metalness={0.6} roughness={0.5} />
      </mesh>
      {/* hazard frame */}
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * 0.58, 0.006, 0]}>
          <boxGeometry args={[0.06, 0.01, 2.36]} />
          <meshStandardMaterial color="#c08a1a" roughness={0.7} />
        </mesh>
      ))}
      {[-0.21, 0.21].map((x, i) => (
        <group key={x} position={[x, 0.02, 0]} ref={(el) => { if (el) rollers.current[i] = el; }}>
          <mesh rotation-x={Math.PI / 2} receiveShadow>
            <cylinderGeometry args={[0.16, 0.16, 2.1, 36]} />
            <meshStandardMaterial color="#7a7f85" metalness={0.85} roughness={0.35} />
          </mesh>
          {[-0.8, 0, 0.8].map((z) => (
            <mesh key={z} position-z={z} rotation-x={Math.PI / 2}>
              <cylinderGeometry args={[0.162, 0.162, 0.02, 36]} />
              <meshStandardMaterial color="#2a2c2f" roughness={0.6} />
            </mesh>
          ))}
        </group>
      ))}
    </group>
  );
}

function Cabinet({ position, rotation = 0 }: { position: [number, number, number]; rotation?: number }) {
  return (
    <group position={position} rotation-y={rotation}>
      <mesh position-y={0.5} castShadow receiveShadow>
        <boxGeometry args={[1.4, 1, 0.6]} />
        <meshStandardMaterial color="#34383d" metalness={0.5} roughness={0.5} />
      </mesh>
      {[0.2, 0.4, 0.6, 0.8].map((y) => (
        <mesh key={y} position={[0, y, 0.305]}>
          <boxGeometry args={[1.2, 0.012, 0.01]} />
          <meshStandardMaterial color={C.highlight} metalness={0.4} roughness={0.4} />
        </mesh>
      ))}
      <mesh position-y={1.02}>
        <boxGeometry args={[1.44, 0.04, 0.64]} />
        <meshStandardMaterial color="#5a4a3a" roughness={0.7} />
      </mesh>
    </group>
  );
}

export function Workshop() {
  const floor = useMemo(concreteTexture, []);
  const wall = useMemo(panelTexture, []);
  return (
    <group>
      <mesh rotation-x={-Math.PI / 2} receiveShadow>
        <planeGeometry args={[24, 24]} />
        <meshStandardMaterial map={floor} roughness={0.82} metalness={0.05} />
      </mesh>
      {/* bay markings */}
      {[
        [0, 2.2, 6.4, 0.07],
        [0, -2.2, 6.4, 0.07],
      ].map(([x, z, w, d], i) => (
        <mesh key={i} position={[x, 0.003, z]} rotation-x={-Math.PI / 2}>
          <planeGeometry args={[w, d]} />
          <meshStandardMaterial color="#c08a1a" roughness={0.8} />
        </mesh>
      ))}
      <mesh position={[0, 3, -7]} receiveShadow>
        <boxGeometry args={[24, 6, 0.2]} />
        <meshStandardMaterial map={wall} roughness={0.75} />
      </mesh>
      <mesh position={[-8, 3, 0]} rotation-y={Math.PI / 2} receiveShadow>
        <boxGeometry args={[24, 6, 0.2]} />
        <meshStandardMaterial map={wall} roughness={0.75} />
      </mesh>
      {/* ceiling light strips */}
      {[-2, 0, 2].map((z) => (
        <mesh key={z} position={[0, 5, z]}>
          <boxGeometry args={[7, 0.06, 0.25]} />
          <meshStandardMaterial color="#ffffff" emissive="#fff4e2" emissiveIntensity={2.5} />
        </mesh>
      ))}
      <Cabinet position={[-3.4, 0, -6.4]} />
      <Cabinet position={[-1.8, 0, -6.4]} />
      <Cabinet position={[-7.4, 0, -3]} rotation={Math.PI / 2} />
      <DynoRollers />
    </group>
  );
}
