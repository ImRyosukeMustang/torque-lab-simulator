import { MeshReflectorMaterial } from "@react-three/drei";
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
  g.fillStyle = "#47494c";
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

/** Linear roughness map for the polished floor: worn traffic lanes are rougher than the edges. */
function floorRoughness() {
  const size = 512;
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const g = c.getContext("2d")!;
  const r = rng(11);
  g.fillStyle = "rgb(150,150,150)";
  g.fillRect(0, 0, size, size);
  for (let i = 0; i < 9000; i++) {
    const v = 110 + r() * 120;
    g.fillStyle = `rgba(${v},${v},${v},0.35)`;
    g.fillRect(r() * size, r() * size, 1 + r() * 4, 1 + r() * 4);
  }
  for (let i = 0; i < 40; i++) {
    g.strokeStyle = `rgba(220,220,220,${0.05 + r() * 0.1})`;
    g.lineWidth = 2 + r() * 10;
    g.beginPath();
    g.moveTo(r() * size, r() * size);
    g.bezierCurveTo(r() * size, r() * size, r() * size, r() * size, r() * size, r() * size);
    g.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(5, 5);
  return t;
}

function signTexture() {
  const c = document.createElement("canvas");
  c.width = 1024;
  c.height = 192;
  const g = c.getContext("2d")!;
  g.fillStyle = "#111214";
  g.fillRect(0, 0, 1024, 192);
  g.strokeStyle = "#f0a028";
  g.lineWidth = 6;
  g.strokeRect(10, 10, 1004, 172);
  g.fillStyle = "#f6b443";
  g.font = "700 104px 'Barlow Condensed', 'Arial Narrow', sans-serif";
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.fillText("A U T O M E C H", 512, 86);
  g.fillStyle = "#8c929a";
  g.font = "600 30px 'Barlow', Arial, sans-serif";
  g.fillText("PERFORMANCE ENGINEERING · DYNO LAB", 512, 158);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

function posterTexture() {
  const c = document.createElement("canvas");
  c.width = 512;
  c.height = 384;
  const g = c.getContext("2d")!;
  g.fillStyle = "#18212a";
  g.fillRect(0, 0, 512, 384);
  g.fillStyle = "#e9a52d";
  g.fillRect(0, 0, 512, 18);
  g.fillRect(0, 366, 512, 18);
  g.strokeStyle = "rgba(142,177,190,0.2)";
  g.lineWidth = 1;
  for (let x = 24; x < 512; x += 32) {
    g.beginPath();
    g.moveTo(x, 20);
    g.lineTo(x, 364);
    g.stroke();
  }
  for (let y = 32; y < 384; y += 32) {
    g.beginPath();
    g.moveTo(20, y);
    g.lineTo(492, y);
    g.stroke();
  }
  g.strokeStyle = "#f4b443";
  g.lineWidth = 8;
  g.beginPath();
  g.arc(256, 150, 68, 0.2, Math.PI * 1.9);
  g.stroke();
  g.fillStyle = "#f4b443";
  g.font = "700 36px 'Barlow Condensed', 'Arial Narrow', sans-serif";
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.fillText("BOOST / BUILD / REPEAT", 256, 272);
  g.fillStyle = "#d8e0e5";
  g.font = "600 19px 'Barlow', Arial, sans-serif";
  g.fillText("AUTOMECH PERFORMANCE LAB", 256, 322);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function pegboardTexture() {
  const c = document.createElement("canvas");
  c.width = 1024;
  c.height = 512;
  const g = c.getContext("2d")!;
  const r = rng(5);
  g.fillStyle = "#3d4248";
  g.fillRect(0, 0, 1024, 512);
  g.fillStyle = "#23272b";
  for (let y = 16; y < 512; y += 32) for (let x = 16; x < 1024; x += 32) {
    g.beginPath();
    g.arc(x, y, 4, 0, Math.PI * 2);
    g.fill();
  }
  // Tool silhouettes: spanners, screwdrivers and a torque wrench.
  g.fillStyle = "#9aa0a7";
  for (let i = 0; i < 12; i++) {
    const x = 60 + i * 80, h = 140 + r() * 120;
    g.fillRect(x - 6, 60, 12, h);
    g.beginPath();
    g.arc(x, 60, 18, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = "#23272b";
    g.fillRect(x - 6, 42, 12, 18);
    g.fillStyle = "#9aa0a7";
  }
  for (let i = 0; i < 9; i++) {
    const x = 80 + i * 105;
    g.fillStyle = i % 3 === 0 ? "#b3221a" : i % 3 === 1 ? "#c58a1c" : "#2758a8";
    g.fillRect(x - 12, 330, 24, 70);
    g.fillStyle = "#c8cdd2";
    g.fillRect(x - 3, 400, 6, 80);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function doorTexture() {
  const c = document.createElement("canvas");
  c.width = 256;
  c.height = 512;
  const g = c.getContext("2d")!;
  for (let y = 0; y < 512; y += 16) {
    const grad = g.createLinearGradient(0, y, 0, y + 16);
    grad.addColorStop(0, "#5d636a");
    grad.addColorStop(0.5, "#4a4f55");
    grad.addColorStop(1, "#2c3034");
    g.fillStyle = grad;
    g.fillRect(0, y, 256, 16);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function Tyre({ position, rotation = [0, 0, 0] }: { position: [number, number, number]; rotation?: [number, number, number] }) {
  return (
    <group position={position} rotation={rotation}>
      <mesh rotation-x={Math.PI / 2} castShadow receiveShadow>
        <torusGeometry args={[0.27, 0.11, 14, 32]} />
        <meshStandardMaterial color={C.rubber} roughness={0.92} />
      </mesh>
      <mesh rotation-x={Math.PI / 2}>
        <cylinderGeometry args={[0.2, 0.2, 0.16, 24, 1, true]} />
        <meshStandardMaterial color="#0e0f10" roughness={1} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}

function TyreStack({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      {[0, 1, 2, 3].map((i) => (
        <Tyre key={i} position={[0, 0.11 + i * 0.225, 0]} rotation={[Math.PI / 2, 0, i * 0.4]} />
      ))}
    </group>
  );
}

function TwoPostLift({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      {[-1.45, 1.45].map((z) => (
        <group key={z} position-z={z}>
          <mesh position-y={1.9} castShadow receiveShadow>
            <boxGeometry args={[0.28, 3.8, 0.34]} />
            <meshStandardMaterial color="#b07a14" metalness={0.3} roughness={0.45} />
          </mesh>
          <mesh position={[0, 0.02, 0]} receiveShadow>
            <boxGeometry args={[0.6, 0.04, 0.6]} />
            <meshStandardMaterial color="#2a2d31" metalness={0.6} roughness={0.5} />
          </mesh>
          {[-1, 1].map((s) => (
            <mesh key={s} position={[s * 0.45, 0.5, z > 0 ? -0.25 : 0.25]} rotation-y={s * 0.5}>
              <boxGeometry args={[0.9, 0.08, 0.12]} />
              <meshStandardMaterial color="#3b3f44" metalness={0.7} roughness={0.4} />
            </mesh>
          ))}
        </group>
      ))}
      <mesh position-y={3.85}>
        <boxGeometry args={[0.18, 0.18, 3.2]} />
        <meshStandardMaterial color="#b07a14" metalness={0.3} roughness={0.45} />
      </mesh>
    </group>
  );
}

function Workbench({ position, rotation = 0 }: { position: [number, number, number]; rotation?: number }) {
  return (
    <group position={position} rotation-y={rotation}>
      <mesh position-y={0.92} castShadow receiveShadow>
        <boxGeometry args={[2.2, 0.08, 0.8]} />
        <meshStandardMaterial color="#6b5238" roughness={0.75} />
      </mesh>
      {[-1, 1].map((x) =>
        [-1, 1].map((z) => (
          <mesh key={`${x}${z}`} position={[x * 1.02, 0.45, z * 0.34]} castShadow>
            <boxGeometry args={[0.06, 0.9, 0.06]} />
            <meshStandardMaterial color="#2b2e32" metalness={0.6} roughness={0.5} />
          </mesh>
        )),
      )}
      <mesh position={[0.7, 1.04, 0]} castShadow>
        <boxGeometry args={[0.24, 0.16, 0.2]} />
        <meshStandardMaterial color="#2758a8" metalness={0.4} roughness={0.4} />
      </mesh>
      {/* a spare cylinder head on the bench */}
      <mesh position={[-0.4, 1.02, 0]} castShadow>
        <boxGeometry args={[0.7, 0.12, 0.24]} />
        <meshStandardMaterial color={C.aluminium} metalness={0.85} roughness={0.35} />
      </mesh>
    </group>
  );
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

function OilDrum({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      <mesh position-y={0.46} castShadow receiveShadow>
        <cylinderGeometry args={[0.38, 0.38, 0.9, 28]} />
        <meshStandardMaterial color="#a44b25" metalness={0.35} roughness={0.56} />
      </mesh>
      {[0.2, 0.72].map((y) => (
        <mesh key={y} position-y={y}>
          <torusGeometry args={[0.385, 0.025, 8, 32]} />
          <meshStandardMaterial color="#d5d0c4" metalness={0.75} roughness={0.32} />
        </mesh>
      ))}
      <mesh position-y={0.92}>
        <cylinderGeometry args={[0.36, 0.36, 0.025, 28]} />
        <meshStandardMaterial color="#6e3722" metalness={0.5} roughness={0.45} />
      </mesh>
      <mesh position={[0, 0.49, 0.386]}>
        <planeGeometry args={[0.42, 0.24]} />
        <meshBasicMaterial color="#e9a52d" />
      </mesh>
    </group>
  );
}

function ToolCart({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      {[-0.38, 0.38].flatMap((x) => [-0.22, 0.22].map((z) => (
        <mesh key={`${x}-${z}`} position={[x, 0.09, z]} rotation-x={Math.PI / 2}>
          <cylinderGeometry args={[0.075, 0.075, 0.06, 14]} />
          <meshStandardMaterial color="#17191c" roughness={0.9} />
        </mesh>
      )))}
      <mesh position-y={0.52} castShadow receiveShadow>
        <boxGeometry args={[0.96, 0.78, 0.58]} />
        <meshStandardMaterial color="#b3422d" metalness={0.28} roughness={0.5} />
      </mesh>
      {[0.34, 0.56, 0.78].map((y) => (
        <group key={y} position={[0, y, 0.3]}>
          <mesh>
            <boxGeometry args={[0.82, 0.16, 0.025]} />
            <meshStandardMaterial color="#33383e" metalness={0.5} roughness={0.4} />
          </mesh>
          <mesh position-y={0.01} position-z={0.02}>
            <boxGeometry args={[0.16, 0.025, 0.025]} />
            <meshStandardMaterial color="#d0a14a" metalness={0.65} roughness={0.35} />
          </mesh>
        </group>
      ))}
      <mesh position={[0, 0.96, 0]} castShadow>
        <boxGeometry args={[1.06, 0.08, 0.66]} />
        <meshStandardMaterial color="#262a2e" metalness={0.65} roughness={0.34} />
      </mesh>
      {[-0.42, 0.42].map((x) => (
        <mesh key={x} position={[x, 1.1, -0.22]}>
          <cylinderGeometry args={[0.025, 0.025, 0.3, 10]} />
          <meshStandardMaterial color="#8b9094" metalness={0.8} roughness={0.3} />
        </mesh>
      ))}
      <mesh position={[0, 1.24, -0.22]}>
        <boxGeometry args={[0.88, 0.04, 0.04]} />
        <meshStandardMaterial color="#8b9094" metalness={0.8} roughness={0.3} />
      </mesh>
    </group>
  );
}

function FireExtinguisher() {
  return (
    <group position={[-7.55, 0, 0.1]}>
      <mesh position-y={0.48} castShadow>
        <cylinderGeometry args={[0.13, 0.15, 0.78, 20]} />
        <meshStandardMaterial color="#b3221a" metalness={0.25} roughness={0.38} />
      </mesh>
      <mesh position-y={0.9}>
        <boxGeometry args={[0.18, 0.08, 0.16]} />
        <meshStandardMaterial color="#25282c" metalness={0.55} roughness={0.4} />
      </mesh>
      <mesh position={[0.08, 0.84, 0]}>
        <torusGeometry args={[0.09, 0.012, 8, 16, Math.PI]} />
        <meshStandardMaterial color="#bfc4c8" metalness={0.8} roughness={0.3} />
      </mesh>
      <mesh position={[-0.151, 0.49, 0]}>
        <boxGeometry args={[0.008, 0.38, 0.055]} />
        <meshBasicMaterial color="#f0a028" />
      </mesh>
    </group>
  );
}

function HoseReel() {
  return (
    <group position={[-7.72, 1.65, -1.35]}>
      <mesh rotation-z={Math.PI / 2} castShadow>
        <cylinderGeometry args={[0.24, 0.24, 0.1, 24]} />
        <meshStandardMaterial color="#d39a2e" metalness={0.55} roughness={0.4} />
      </mesh>
      <mesh rotation-y={Math.PI / 2}>
        <torusGeometry args={[0.19, 0.025, 8, 28]} />
        <meshStandardMaterial color="#25282c" roughness={0.8} />
      </mesh>
      <mesh position={[0.13, -0.22, 0.06]} rotation-z={-0.7}>
        <boxGeometry args={[0.035, 0.42, 0.035]} />
        <meshStandardMaterial color="#282b2f" roughness={0.75} />
      </mesh>
    </group>
  );
}

function OilBottles() {
  return (
    <group position={[-7.2, 1.02, -0.92]}>
      {[-0.22, 0, 0.22].map((x, i) => (
        <group key={x} position-x={x}>
          <mesh position-y={0.11} castShadow>
            <boxGeometry args={[0.13, 0.22, 0.12]} />
            <meshStandardMaterial color={i === 1 ? "#b3221a" : "#c58a1c"} roughness={0.5} />
          </mesh>
          <mesh position={[0, 0.25, 0]}>
            <cylinderGeometry args={[0.035, 0.035, 0.06, 10]} />
            <meshStandardMaterial color="#202226" roughness={0.7} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

export function Workshop({ reflect = 0, decorations = true, showcase = false }: { reflect?: number; decorations?: boolean; showcase?: boolean }) {
  const floor = useMemo(concreteTexture, []);
  const rough = useMemo(floorRoughness, []);
  const wall = useMemo(panelTexture, []);
  const sign = useMemo(signTexture, []);
  const poster = useMemo(posterTexture, []);
  const peg = useMemo(pegboardTexture, []);
  const door = useMemo(doorTexture, []);
  return (
    <group>
      <mesh rotation-x={-Math.PI / 2} receiveShadow>
        <planeGeometry args={[24, 24]} />
        {reflect > 0 ? (
          // Sealed epoxy workshop floor: blurred reflections broken up by the roughness map.
          <MeshReflectorMaterial
            map={floor}
            roughnessMap={rough}
            resolution={reflect}
            blur={[400, 120]}
            mixBlur={1.2}
            mixStrength={1.6}
            mixContrast={1.1}
            mirror={0}
            depthScale={0.8}
            minDepthThreshold={0.3}
            maxDepthThreshold={1.3}
            roughness={0.7}
            metalness={0.15}
            color="#8a8d91"
          />
        ) : (
          <meshStandardMaterial map={floor} roughnessMap={rough} roughness={0.82} metalness={0.05} />
        )}
      </mesh>
      {/* bay markings */}
      {([
        [0, 2.2, 6.4, 0.07],
        [0, -2.2, 6.4, 0.07],
      ] as const).map(([x, z, w, d], i) => (
        <mesh key={i} position={[x, 0.003, z]} rotation-x={-Math.PI / 2}>
          <planeGeometry args={[w, d]} />
          <meshStandardMaterial color="#8a6418" roughness={0.9} />
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
      {/* ceiling and roof beams */}
      <mesh position={[0, 6, 0]} rotation-x={Math.PI / 2}>
        <planeGeometry args={[24, 24]} />
        <meshStandardMaterial color="#17191c" roughness={0.9} side={THREE.DoubleSide} />
      </mesh>
      {[-5, -2.5, 0, 2.5, 5].map((z) => (
        <mesh key={z} position={[0, 5.7, z]}>
          <boxGeometry args={[24, 0.35, 0.18]} />
          <meshStandardMaterial color="#2a2e33" metalness={0.6} roughness={0.5} />
        </mesh>
      ))}
      {/* light housings */}
      {[-2, 0, 2].map((z) => (
        <mesh key={`h${z}`} position={[0, 5.08, z]}>
          <boxGeometry args={[7.2, 0.1, 0.34]} />
          <meshStandardMaterial color="#2b2e32" metalness={0.5} roughness={0.5} />
        </mesh>
      ))}
      {/* back wall: sign, pegboard, roller door */}
      <mesh position={[0.6, 4.1, -6.88]}>
        <planeGeometry args={[5.2, 0.975]} />
        <meshStandardMaterial map={sign} emissiveMap={sign} emissive="#ffffff" emissiveIntensity={1.4} roughness={0.6} toneMapped={false} />
      </mesh>
      {[-6.2, 8.25].map((x) => (
        <group key={x} position={[x, 3.25, -6.86]}>
          <mesh position-z={-0.03}>
            <boxGeometry args={[2.2, 1.72, 0.08]} />
            <meshStandardMaterial color="#252a30" metalness={0.65} roughness={0.4} />
          </mesh>
          <mesh position-z={0.02}>
            <planeGeometry args={[2.04, 1.56]} />
            <meshStandardMaterial map={poster} roughness={0.85} />
          </mesh>
        </group>
      ))}
      <mesh position={[-2.6, 2.1, -6.88]}>
        <planeGeometry args={[2.8, 1.4]} />
        <meshStandardMaterial map={peg} roughness={0.7} metalness={0.2} />
      </mesh>
      <mesh position={[4.6, 2.2, -6.88]}>
        <planeGeometry args={[3.6, 4.4]} />
        <meshStandardMaterial map={door} roughness={0.55} metalness={0.6} />
      </mesh>
      <mesh position={[4.6, 4.5, -6.85]}>
        <boxGeometry args={[3.9, 0.3, 0.12]} />
        <meshStandardMaterial color="#2a2e33" metalness={0.6} roughness={0.5} />
      </mesh>
      {/* wall-mounted lamp washing the back wall */}
      <mesh position={[0.6, 4.75, -6.75]}>
        <boxGeometry args={[5.4, 0.05, 0.12]} />
        <meshStandardMaterial color="#fff" emissive="#ffe6bf" emissiveIntensity={3} toneMapped={false} />
      </mesh>
      <TyreStack position={[-6.9, 0, 1.2]} />
      <TyreStack position={[-6.9, 0, 2.0]} />
      <Tyre position={[-6.3, 0.11, 1.6]} rotation={[Math.PI / 2, 0, 0]} />
      <TwoPostLift position={[5.6, 0, -3.6]} />
      <Workbench position={[-7.3, 0, -1.2]} rotation={Math.PI / 2} />
      <Cabinet position={[-3.4, 0, -6.4]} />
      <Cabinet position={[-1.8, 0, -6.4]} />
      <Cabinet position={[-7.4, 0, -3]} rotation={Math.PI / 2} />
      <OilDrum position={[-6.6, 0, -4.7]} />
      <OilDrum position={[-5.7, 0, -4.7]} />
      <ToolCart position={[6.9, 0, 1.6]} />
      <DynoRollers />
      {decorations && (
        <>
          <FireExtinguisher />
          <HoseReel />
        </>
      )}
      {showcase && <OilBottles />}
    </group>
  );
}
