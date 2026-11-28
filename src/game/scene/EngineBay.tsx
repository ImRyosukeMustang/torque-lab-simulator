import type { ThreeEvent } from "@react-three/fiber";
import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { dynoLive } from "../dynoLive";
import { getPart } from "../sim/parts";
import type { SlotId } from "../sim/types";
import { useGame } from "../store";
import { SCENE_COLORS as C } from "./layout";

const HIGHLIGHT = new THREE.Color(C.highlight);

/** Groups one component's meshes; hover/click selects the slot and focuses the camera. */
function SlotGroup({ slot, children }: { slot: SlotId; children: React.ReactNode }) {
  const ref = useRef<THREE.Group>(null);
  const hovered = useGame((s) => s.hoveredSlot === slot);
  const selected = useGame((s) => s.tab === "workshop" && s.selectedSlot === slot && s.view !== "exterior");
  useEffect(() => {
    const intensity = hovered ? 0.45 : selected ? 0.2 : 0;
    ref.current?.traverse((o) => {
      const m = (o as THREE.Mesh).material as THREE.MeshStandardMaterial | undefined;
      if (!m || !("emissive" in m) || m.userData['heat']) return;
      m.emissive.copy(HIGHLIGHT);
      m.emissiveIntensity = intensity;
    });
  });
  const over = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    useGame.getState().setHovered(slot);
    document.body.style.cursor = "pointer";
  };
  const out = () => {
    if (useGame.getState().hoveredSlot === slot) useGame.getState().setHovered(null);
    document.body.style.cursor = "";
  };
  // A swapped part can unmount while hovered: clear the hover and cursor with it.
  useEffect(
    () => () => {
      if (useGame.getState().hoveredSlot === slot) useGame.getState().setHovered(null);
      document.body.style.cursor = "";
    },
    [slot],
  );
  const click = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    if (e.delta > 4) return; // a drag, not a click
    useGame.getState().selectSlot(slot);
  };
  return (
    <group ref={ref} onPointerOver={over} onPointerOut={out} onClick={click}>
      {children}
    </group>
  );
}

function Tube({ points, radius, color, metal = 0.6, rough = 0.4, heat = false }: { points: [number, number, number][]; radius: number; color: string; metal?: number; rough?: number; heat?: boolean }) {
  const geo = useMemo(() => {
    const curve = new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p)));
    return new THREE.TubeGeometry(curve, 40, radius, 12, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(points), radius]);
  return (
    <mesh geometry={geo} castShadow>
      <meshStandardMaterial color={color} metalness={metal} roughness={rough} userData={{ heat }} />
    </mesh>
  );
}

/** Exhaust-side metal that glows with exhaust gas temperature during a dyno run. */
function useHeatGlow(group: React.RefObject<THREE.Group | null>) {
  const glow = useMemo(() => new THREE.Color(), []);
  useFrame((_, delta) => {
    const g = group.current;
    if (!g) return;
    const egt = dynoLive.running ? dynoLive.egtC : 25;
    const t = THREE.MathUtils.clamp((egt - 520) / 430, 0, 1);
    glow.setRGB(0.55 + 0.45 * t, 0.06 + 0.32 * t * t, 0.01);
    g.traverse((o) => {
      const m = (o as THREE.Mesh).material as THREE.MeshStandardMaterial | undefined;
      if (!m || !m.userData?.['heat']) return;
      m.emissive.copy(glow);
      const target = t * t * 2.2;
      m.emissiveIntensity += (target - m.emissiveIntensity) * (1 - Math.exp(-3 * Math.min(delta, 0.05)));
    });
  });
}

function portPositions(cylinders: number) {
  const count = Math.max(1, cylinders);
  return Array.from({ length: count }, (_, i) =>
    count === 1 ? 1.03 : 0.82 + (i / (count - 1)) * 0.42,
  );
}

const INTERNALS_BADGE: Record<string, string> = { "int-hicomp": "#2f6fb0", "int-forged": "#d07a1a", "int-race": "#b3221a" };

function Internals() {
  const id = useGame((s) => s.game.build.internals);
  const cylinders = getPart("engine", useGame((s) => s.game.build.engine)).cylinders;
  const forged = id !== "int-stock";
  const badge = INTERNALS_BADGE[id];
  const ribX = portPositions(cylinders);
  return (
    <SlotGroup slot="internals">
      {/* block */}
      <mesh position={[1.03, 0.52, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.58, 0.32, 0.34]} />
        <meshStandardMaterial color={C.castIron} metalness={0.5} roughness={0.7} />
      </mesh>
      {/* block ribs */}
      {ribX.map((x) => (
        <mesh key={x} position={[x, 0.5, 0.172]}>
          <boxGeometry args={[0.018, 0.26, 0.012]} />
          <meshStandardMaterial color={C.castIron} metalness={0.5} roughness={0.75} />
        </mesh>
      ))}
      {/* sump: pressed steel on stock, finned baffled aluminium with forged internals */}
      <mesh position={[1.03, 0.36, 0]} castShadow>
        <boxGeometry args={[0.5, 0.1, 0.28]} />
        <meshStandardMaterial color={forged ? C.aluminium : C.castIron} metalness={forged ? 0.8 : 0.5} roughness={forged ? 0.35 : 0.75} />
      </mesh>
      {forged &&
        [-0.1, -0.05, 0, 0.05, 0.1].map((z) => (
          <mesh key={z} position={[1.03, 0.31, z]}>
            <boxGeometry args={[0.46, 0.02, 0.008]} />
            <meshStandardMaterial color={C.aluminium} metalness={0.8} roughness={0.35} />
          </mesh>
        ))}
      {badge && (
        <mesh position={[0.9, 0.43, 0.172]}>
          <boxGeometry args={[0.12, 0.05, 0.006]} />
          <meshStandardMaterial color={badge} metalness={0.4} roughness={0.4} />
        </mesh>
      )}
    </SlotGroup>
  );
}

function EngineCore() {
  const cam = useGame((s) => s.game.build.camshaft);
  const enginePart = getPart("engine", useGame((s) => s.game.build.engine));
  const rows = enginePart.cylinders >= 6 ? 2 : 1;
  const cylindersPerRow = enginePart.cylinders / rows;
  const positions = portPositions(cylindersPerRow);
  const coverColor = cam === "cam-race" ? "#8e1e14" : cam === "cam-vvt" ? "#24476e" : cam === "cam-street" ? C.aluminium : C.blackPlastic;
  return (
    <group>
      <Internals />
      <mesh position={[1.03, 0.72, 0]} castShadow>
        <boxGeometry args={[0.6, 0.1, 0.36]} />
        <meshStandardMaterial color={C.aluminium} metalness={0.7} roughness={0.45} />
      </mesh>
      {/* timing cover and pulleys */}
      <mesh position={[1.34, 0.6, 0]} castShadow>
        <boxGeometry args={[0.05, 0.42, 0.3]} />
        <meshStandardMaterial color={C.blackPlastic} roughness={0.6} />
      </mesh>
      {([[0.42, 0], [0.62, 0.07], [0.62, -0.07]] as const).map(([y, z], i) => (
        <mesh key={i} position={[1.38, y, z]} rotation-z={Math.PI / 2}>
          <cylinderGeometry args={[i === 0 ? 0.075 : 0.05, i === 0 ? 0.075 : 0.05, 0.035, 28]} />
          <meshStandardMaterial color={C.steel} metalness={0.85} roughness={0.35} />
        </mesh>
      ))}
      <SlotGroup slot="camshaft">
        {Array.from({ length: rows }, (_, row) => {
          const z = rows === 1 ? 0 : row === 0 ? -0.115 : 0.115;
          const bankDepth = rows === 1 ? 0.3 : 0.17;
          return (
            <group key={row} position-z={z} rotation-y={rows === 1 ? 0 : row === 0 ? -0.18 : 0.18}>
              <mesh position={[1.03, 0.81, 0]} castShadow>
                <boxGeometry args={[0.62, 0.08, bankDepth]} />
                <meshStandardMaterial color={coverColor} metalness={cam === "cam-street" ? 0.7 : 0.2} roughness={cam === "cam-race" || cam === "cam-vvt" ? 0.85 : 0.4} />
              </mesh>
              {[-1, 1].map((side) => (
                <mesh key={side} position={[1.03, 0.855, side * bankDepth * 0.34]}>
                  <boxGeometry args={[0.58, 0.012, 0.014]} />
                  <meshStandardMaterial color={C.aluminium} metalness={0.8} roughness={0.3} />
                </mesh>
              ))}
              {positions.map((x) => (
                <group key={x}>
                  <mesh position={[x, 0.875, 0.02]} castShadow>
                    <cylinderGeometry args={[0.022, 0.022, 0.07, 14]} />
                    <meshStandardMaterial color={C.blackPlastic} roughness={0.5} />
                  </mesh>
                  <mesh position={[x, 0.876, -0.035]} castShadow>
                    <boxGeometry args={[0.045, 0.035, 0.052]} />
                    <meshStandardMaterial color="#202327" metalness={0.25} roughness={0.62} />
                  </mesh>
                  <mesh position={[x, 0.897, -0.035]}>
                    <boxGeometry args={[0.012, 0.004, 0.04]} />
                    <meshStandardMaterial color={C.highlight} metalness={0.6} roughness={0.3} />
                  </mesh>
                </group>
              ))}
            </group>
          );
        })}
        {portPositions(enginePart.cylinders).map((x) => (
          <Tube key={x} points={[[x, 0.9, -0.05], [x, 0.92, -0.14], [x + 0.025, 0.89, -0.22]]} radius={0.006} color="#25282c" metal={0.15} rough={0.75} />
        ))}
        <mesh position={[0.86, 0.865, -0.09]}>
          <cylinderGeometry args={[0.025, 0.025, 0.03, 18]} />
          <meshStandardMaterial color={C.highlight} roughness={0.5} />
        </mesh>
      </SlotGroup>
    </group>
  );
}

function IntakeSystem({ turbo }: { turbo: boolean }) {
  const intake = useGame((s) => s.game.build.intake);
  const cylinders = getPart("engine", useGame((s) => s.game.build.engine)).cylinders;
  const ports = portPositions(cylinders);
  const hf = intake === "intake-hf";
  const pipeR = hf ? 0.042 : 0.034;
  const filterPos: [number, number, number] = [1.66, 0.6, -0.47];
  const toThrottle: [number, number, number][] = [[1.66, 0.6, -0.4], [1.6, 0.72, -0.34], [1.48, 0.78, -0.32], [1.42, 0.78, -0.32]];
  const toTurbo: [number, number, number][] = [[1.62, 0.6, -0.36], [1.54, 0.8, -0.14], [1.48, 0.82, 0.2], [1.36, 0.74, 0.43], [1.26, 0.72, 0.44]];
  return (
    <SlotGroup slot="intake">
      {intake === "intake-stock" ? (
        <mesh position={[1.64, 0.6, -0.47]} castShadow>
          <boxGeometry args={[0.28, 0.18, 0.2]} />
          <meshStandardMaterial color={C.blackPlastic} roughness={0.65} />
        </mesh>
      ) : (
        <group position={filterPos}>
          <mesh rotation-x={-Math.PI / 2} position-z={-0.02} castShadow>
            <cylinderGeometry args={[hf ? 0.06 : 0.05, hf ? 0.09 : 0.075, hf ? 0.22 : 0.17, 28]} />
            <meshStandardMaterial color={hf ? "#2c3540" : "#6b2420"} roughness={0.9} />
          </mesh>
          {/* heat shield */}
          <mesh position={[0, 0, -0.08]}>
            <boxGeometry args={[0.24, 0.24, 0.01]} />
            <meshStandardMaterial color={C.aluminium} metalness={0.8} roughness={0.35} />
          </mesh>
        </group>
      )}
      <Tube points={turbo ? toTurbo : toThrottle} radius={pipeR} color={hf ? C.aluminium : C.hose} metal={hf ? 0.8 : 0.1} rough={hf ? 0.3 : 0.8} />
      {/* plenum, runners, throttle body */}
      <mesh position={[1.04, 0.79, -0.31]} rotation-z={Math.PI / 2} castShadow>
        <cylinderGeometry args={[0.065, 0.065, 0.62, 24]} />
        <meshStandardMaterial color={C.aluminium} metalness={0.75} roughness={0.38} />
      </mesh>
      {ports.map((x) => (
        <Tube key={x} points={[[x, 0.79, -0.27], [x, 0.78, -0.22], [x, 0.73, -0.18]]} radius={0.024} color={C.aluminium} metal={0.75} rough={0.38} />
      ))}
      <mesh position={[1.39, 0.79, -0.31]} rotation-z={Math.PI / 2} castShadow>
        <cylinderGeometry args={[hf ? 0.052 : 0.042, hf ? 0.052 : 0.042, 0.07, 24]} />
        <meshStandardMaterial color={C.steel} metalness={0.85} roughness={0.3} />
      </mesh>
    </SlotGroup>
  );
}

const FUEL_LOOK: Record<string, { cap: string; line: string }> = {
  "fuel-95": { cap: C.blackPlastic, line: C.hose },
  "fuel-98": { cap: "#2f6fb0", line: C.hose },
  "fuel-race": { cap: "#b3221a", line: "#8c8f93" },
  "fuel-e85": { cap: "#d8a915", line: "#8c8f93" },
};

function FuelSupply() {
  const fuel = useGame((s) => s.game.build.fuel);
  const look = FUEL_LOOK[fuel] ?? FUEL_LOOK["fuel-95"]!;
  const braided = fuel === "fuel-race" || fuel === "fuel-e85";
  return (
    <SlotGroup slot="fuel">
      {/* filter canister and pressure regulator */}
      <mesh position={[0.68, 0.66, -0.3]} castShadow>
        <cylinderGeometry args={[0.035, 0.035, 0.1, 20]} />
        <meshStandardMaterial color={braided ? C.aluminium : C.steel} metalness={0.8} roughness={0.35} />
      </mesh>
      <mesh position={[0.68, 0.72, -0.3]}>
        <cylinderGeometry args={[0.026, 0.03, 0.025, 20]} />
        <meshStandardMaterial color={look.cap} metalness={0.4} roughness={0.4} />
      </mesh>
      {fuel === "fuel-e85" && (
        <mesh position={[0.68, 0.6, -0.2]} castShadow>
          <boxGeometry args={[0.05, 0.04, 0.06]} />
          <meshStandardMaterial color="#1b1c1e" roughness={0.5} />
        </mesh>
      )}
      <Tube points={[[0.68, 0.72, -0.3], [0.7, 0.8, -0.22], [0.74, 0.86, -0.15]]} radius={braided ? 0.01 : 0.007} color={look.line} metal={braided ? 0.8 : 0.1} rough={braided ? 0.45 : 0.8} />
      <Tube points={[[0.68, 0.61, -0.3], [0.64, 0.5, -0.25], [0.64, 0.32, -0.2]]} radius={braided ? 0.01 : 0.007} color={look.line} metal={braided ? 0.8 : 0.1} rough={braided ? 0.45 : 0.8} />
    </SlotGroup>
  );
}

function FuelSystem() {
  const inj = useGame((s) => s.game.build.injectors);
  const cylinders = getPart("engine", useGame((s) => s.game.build.engine)).cylinders;
  const ports = portPositions(cylinders);
  const color = { "inj-stock": "#5d6166", "inj-440": "#2f6fb0", "inj-750": "#c99a1d", "inj-1000": "#a3291c", "inj-1300": "#2f7a3e" }[inj] ?? "#5d6166";
  return (
    <SlotGroup slot="injectors">
      <mesh position={[1.03, 0.86, -0.15]} rotation-z={Math.PI / 2} castShadow>
        <cylinderGeometry args={[0.014, 0.014, 0.58, 12]} />
        <meshStandardMaterial color={inj === "inj-stock" ? C.steel : "#b03a26"} metalness={0.8} roughness={0.3} />
      </mesh>
      {ports.map((x) => (
        <mesh key={x} position={[x, 0.82, -0.16]} rotation-x={0.35} castShadow>
          <cylinderGeometry args={[0.012, 0.009, 0.07, 12]} />
          <meshStandardMaterial color={color} metalness={0.4} roughness={0.45} />
        </mesh>
      ))}
      <Tube points={[[0.74, 0.86, -0.15], [0.68, 0.8, -0.2], [0.66, 0.6, -0.28]]} radius={0.007} color={C.hose} metal={0.1} rough={0.8} />
    </SlotGroup>
  );
}

function ExhaustAndTurbo({ turbo }: { turbo: string }) {
  const exhaust = useGame((s) => s.game.build.exhaust);
  const cylinders = getPart("engine", useGame((s) => s.game.build.engine)).cylinders;
  const ports = portPositions(cylinders);
  const heatRef = useRef<THREE.Group>(null);
  const wheel = useRef<THREE.Mesh>(null);
  useHeatGlow(heatRef);
  useFrame((_, delta) => {
    if (wheel.current && dynoLive.running) wheel.current.rotation.x += dynoLive.boostBar * 60 * Math.min(delta, 0.05);
  });
  const hasTurbo = turbo !== "turbo-none";
  const scale = turbo === "turbo-t25" ? 1.05 : turbo === "turbo-t30" ? 1.18 : turbo === "turbo-t35" ? 1.3 : 1.6;
  const tubular = exhaust === "exh-header";
  const primaryR = tubular ? 0.024 : exhaust === "exh-3in" ? 0.021 : 0.018;
  const collector: [number, number, number] = hasTurbo ? [1.02, 0.62, 0.38] : [1.02, 0.52, 0.36];
  const downR = tubular ? 0.046 : exhaust === "exh-3in" ? 0.04 : exhaust === "exh-catback" ? 0.033 : 0.03;
  const pipeColor = tubular ? "#7a6a80" : C.steel;

  return (
    <group ref={heatRef}>
      <SlotGroup slot="exhaust">
        {ports.map((x) => (
          <Tube key={x} points={tubular ? [[x, 0.66, 0.17], [x, 0.66, 0.24], [x + (collector[0] - x) * 0.3, 0.6, 0.31], [(x + collector[0]) / 2, 0.55, 0.35], collector] : [[x, 0.66, 0.17], [x, 0.64, 0.27], [(x + collector[0]) / 2, 0.57, 0.34], collector]} radius={primaryR} color={pipeColor} metal={0.85} rough={0.3} heat />
        ))}
        <Tube
          points={hasTurbo ? [[0.95, 0.72, 0.45], [0.82, 0.66, 0.47], [0.74, 0.42, 0.4], [0.7, 0.26, 0.2]] : [collector, [0.94, 0.42, 0.36], [0.8, 0.3, 0.3], [0.68, 0.24, 0.2]]}
          radius={downR}
          color={pipeColor}
          metal={0.85}
          rough={0.4}
          heat
        />
      </SlotGroup>
      {hasTurbo && (
        <SlotGroup slot="turbo">
          <group position={[1.03, 0.72, 0.44]} scale={scale}>
            {/* turbine housing */}
            <mesh rotation-y={Math.PI / 2} castShadow>
              <torusGeometry args={[0.06, 0.035, 16, 32]} />
              <meshStandardMaterial color={C.castIron} metalness={0.7} roughness={0.55} userData={{ heat: true }} />
            </mesh>
            {/* centre section */}
            <mesh position-x={0.07} rotation-z={Math.PI / 2}>
              <cylinderGeometry args={[0.035, 0.035, 0.06, 20]} />
              <meshStandardMaterial color={C.steel} metalness={0.8} roughness={0.4} />
            </mesh>
            {/* compressor housing */}
            <mesh position-x={0.13} rotation-y={Math.PI / 2} castShadow>
              <torusGeometry args={[0.062, 0.04, 16, 32]} />
              <meshStandardMaterial color={C.aluminium} metalness={0.8} roughness={0.3} />
            </mesh>
            <mesh ref={wheel} position-x={0.17} rotation-z={Math.PI / 2}>
              <cylinderGeometry args={[0.045, 0.03, 0.03, 8]} />
              <meshStandardMaterial color={C.steel} metalness={0.9} roughness={0.25} />
            </mesh>
          </group>
        </SlotGroup>
      )}
    </group>
  );
}

function Intercooler({ turbo }: { turbo: boolean }) {
  const ic = useGame((s) => s.game.build.intercooler);
  if (!turbo && ic === "ic-none") return null;
  const big = ic === "ic-large";
  const w = big ? 1.18 : 0.88;
  const h = big ? 0.17 : 0.14;
  const fins = Math.round(w / 0.04);
  if (ic === "ic-w2a") {
    // Chargecooler sits in the intake tract next to the plenum, fed by a small front heat exchanger.
    return (
      <SlotGroup slot="intercooler">
        <group position={[1.46, 0.8, 0.12]}>
          <mesh castShadow>
            <boxGeometry args={[0.14, 0.1, 0.24]} />
            <meshStandardMaterial color={C.aluminium} metalness={0.85} roughness={0.3} />
          </mesh>
          {[-0.08, 0, 0.08].map((z) => (
            <mesh key={z} position={[0, 0.055, z]}>
              <boxGeometry args={[0.13, 0.012, 0.02]} />
              <meshStandardMaterial color="#6b7177" metalness={0.8} roughness={0.4} />
            </mesh>
          ))}
        </group>
        <mesh position={[1.98, 0.5, 0]} castShadow>
          <boxGeometry args={[0.04, 0.12, 0.7]} />
          <meshStandardMaterial color="#2e3236" metalness={0.7} roughness={0.5} />
        </mesh>
        <Tube points={[[1.18, 0.8, 0.46], [1.38, 0.82, 0.3], [1.46, 0.8, 0.24]]} radius={0.03} color={C.aluminium} metal={0.85} rough={0.3} />
        <Tube points={[[1.46, 0.8, 0.0], [1.46, 0.8, -0.2], [1.42, 0.79, -0.31]]} radius={0.03} color={C.aluminium} metal={0.85} rough={0.3} />
        <Tube points={[[1.5, 0.76, 0.2], [1.75, 0.5, 0.3], [1.96, 0.5, 0.3]]} radius={0.01} color="#2a5fa8" metal={0.1} rough={0.6} />
        <Tube points={[[1.5, 0.76, 0.04], [1.75, 0.46, -0.1], [1.96, 0.46, -0.3]]} radius={0.01} color="#2a5fa8" metal={0.1} rough={0.6} />
      </SlotGroup>
    );
  }
  return (
    <SlotGroup slot="intercooler">
      {ic !== "ic-none" ? (
        <group position={[1.98, 0.53, 0]}>
          <mesh castShadow>
            <boxGeometry args={[0.06, h, w]} />
            <meshStandardMaterial color="#3d4247" metalness={0.75} roughness={0.5} />
          </mesh>
          {Array.from({ length: fins }, (_, i) => (
            <mesh key={i} position={[0.032, 0, -w / 2 + (i + 0.5) * (w / fins)]}>
              <boxGeometry args={[0.004, h * 0.92, 0.006]} />
              <meshStandardMaterial color="#6b7177" metalness={0.8} roughness={0.4} />
            </mesh>
          ))}
          {[-1, 1].map((s) => (
            <mesh key={s} position={[0, 0, s * (w / 2 + 0.03)]}>
              <boxGeometry args={[0.08, h + 0.03, 0.06]} />
              <meshStandardMaterial color={C.aluminium} metalness={0.85} roughness={0.3} />
            </mesh>
          ))}
          <Tube points={[[-0.02, 0.02, w / 2 + 0.03], [-0.3, 0.12, 0.6], [-0.7, 0.12, 0.5], [-0.8, 0.27, 0.46]]} radius={0.032} color={C.aluminium} metal={0.85} rough={0.3} />
          <Tube points={[[-0.02, 0.02, -w / 2 - 0.03], [-0.3, 0.18, -0.58], [-0.5, 0.26, -0.36], [-0.57, 0.26, -0.31]]} radius={0.032} color={C.aluminium} metal={0.85} rough={0.3} />
        </group>
      ) : (
        <Tube points={[[1.18, 0.8, 0.46], [1.5, 0.84, 0.3], [1.55, 0.8, -0.1], [1.45, 0.79, -0.31], [1.42, 0.79, -0.31]]} radius={0.03} color={C.hose} metal={0.1} rough={0.8} />
      )}
    </SlotGroup>
  );
}

function Ecu() {
  const ecu = useGame((s) => s.game.build.ecu);
  const led = useRef<THREE.MeshStandardMaterial>(null);
  useFrame(({ clock }) => {
    if (led.current) led.current.emissiveIntensity = dynoLive.running ? 1.5 + Math.sin(clock.elapsedTime * 20) : 0.6;
  });
  return (
    <SlotGroup slot="ecu">
      <mesh position={[0.76, 0.58, -0.5]} castShadow>
        <boxGeometry args={[0.16, 0.05, 0.2]} />
        <meshStandardMaterial color={ecu === "ecu-standalone" ? "#1a1c1f" : C.aluminium} metalness={0.7} roughness={0.4} />
      </mesh>
      {ecu === "ecu-piggy" && (
        <mesh position={[0.76, 0.625, -0.5]}>
          <boxGeometry args={[0.1, 0.04, 0.12]} />
          <meshStandardMaterial color="#2f6fb0" roughness={0.5} />
        </mesh>
      )}
      <mesh position={[0.76, 0.61, -0.4]}>
        <boxGeometry args={[0.02, 0.01, 0.02]} />
        <meshStandardMaterial ref={led} color="#1a3a12" emissive={ecu === "ecu-standalone" ? "#f0a028" : "#3fd04a"} emissiveIntensity={0.6} userData={{ heat: true }} />
      </mesh>
      <Tube points={[[0.84, 0.58, -0.46], [0.9, 0.66, -0.34], [0.86, 0.74, -0.2]]} radius={0.01} color={C.blackPlastic} metal={0.1} rough={0.8} />
    </SlotGroup>
  );
}

function Cooling() {
  const id = useGame((s) => s.game.build.cooling);
  const alu = id !== "cool-stock";
  const thick = id === "cool-race" ? 0.075 : 0.05;
  const fans = alu ? [-0.24, 0.24] : [0];
  return (
    <SlotGroup slot="cooling">
      <mesh position={[1.82, 0.55, 0]} castShadow>
        <boxGeometry args={[thick, 0.36, 1.06]} />
        <meshStandardMaterial color={alu ? "#9aa0a6" : "#26292c"} metalness={alu ? 0.8 : 0.5} roughness={alu ? 0.35 : 0.6} />
      </mesh>
      {/* end tanks */}
      {[-1, 1].map((s) => (
        <mesh key={s} position={[1.82, 0.55, s * 0.55]}>
          <boxGeometry args={[thick + 0.02, 0.38, 0.05]} />
          <meshStandardMaterial color={alu ? C.aluminium : C.blackPlastic} metalness={alu ? 0.85 : 0.1} roughness={alu ? 0.3 : 0.6} />
        </mesh>
      ))}
      {fans.map((z) => (
        <group key={z} position={[1.77, 0.55, z]}>
          <mesh rotation-z={Math.PI / 2}>
            <cylinderGeometry args={[alu ? 0.14 : 0.15, alu ? 0.14 : 0.15, 0.03, 32]} />
            <meshStandardMaterial color={C.blackPlastic} roughness={0.7} />
          </mesh>
          <mesh position-x={-0.02} rotation-z={Math.PI / 2}>
            <cylinderGeometry args={[0.035, 0.035, 0.03, 16]} />
            <meshStandardMaterial color={C.steel} metalness={0.8} roughness={0.4} />
          </mesh>
        </group>
      ))}
      {id === "cool-race" && (
        <group>
          {/* oil cooler with braided lines */}
          <mesh position={[1.95, 0.33, -0.3]} castShadow>
            <boxGeometry args={[0.04, 0.09, 0.32]} />
            <meshStandardMaterial color="#2e3236" metalness={0.7} roughness={0.5} />
          </mesh>
          <Tube points={[[1.93, 0.34, -0.14], [1.6, 0.3, -0.1], [1.3, 0.34, -0.05]]} radius={0.011} color="#8c8f93" metal={0.8} rough={0.45} />
          <Tube points={[[1.93, 0.32, -0.46], [1.6, 0.28, -0.3], [1.3, 0.33, -0.12]]} radius={0.011} color="#8c8f93" metal={0.8} rough={0.45} />
        </group>
      )}
      <Tube points={[[1.79, 0.7, 0.4], [1.6, 0.76, 0.3], [1.36, 0.72, 0.12]]} radius={0.022} color={alu ? "#2a5fa8" : C.hose} metal={0.1} rough={0.7} />
    </SlotGroup>
  );
}

function BayDetails() {
  return (
    <group>
      {/* strut towers */}
      {[-1, 1].map((s) => (
        <mesh key={s} position={[1.33, 0.66, s * 0.56]} castShadow>
          <cylinderGeometry args={[0.085, 0.1, 0.42, 24]} />
          <meshStandardMaterial color="#9a3a17" metalness={0.35} roughness={0.4} />
        </mesh>
      ))}
      <Cooling />
      {/* battery */}
      <mesh position={[0.82, 0.44, 0.48]} castShadow>
        <boxGeometry args={[0.22, 0.18, 0.15]} />
        <meshStandardMaterial color={C.blackPlastic} roughness={0.6} />
      </mesh>
      {/* coolant reservoir */}
      <mesh position={[1.62, 0.58, 0.45]} castShadow>
        <boxGeometry args={[0.12, 0.12, 0.1]} />
        <meshPhysicalMaterial color="#d6d3c8" roughness={0.3} transmission={0.2} />
      </mesh>
      {/* brake booster */}
      <mesh position={[0.68, 0.72, 0.38]} rotation-z={Math.PI / 2} castShadow>
        <cylinderGeometry args={[0.1, 0.1, 0.06, 28]} />
        <meshStandardMaterial color="#202326" metalness={0.6} roughness={0.4} />
      </mesh>
      <Tube points={[[1.31, 0.84, -0.5], [1.24, 0.89, 0], [1.31, 0.84, 0.5]]} radius={0.022} color={C.aluminium} metal={0.86} rough={0.28} />
      {[-1, 1].map((s) => (
        <group key={s}>
          <mesh position={[0.75, 0.545, s * 0.48]} castShadow>
            <cylinderGeometry args={[0.026, 0.026, 0.02, 16]} />
            <meshStandardMaterial color={s === 1 ? "#b3221a" : C.steel} metalness={0.78} roughness={0.32} />
          </mesh>
          <mesh position={[1.62, 0.65, s * 0.43]}>
            <cylinderGeometry args={[0.032, 0.032, 0.022, 20]} />
            <meshStandardMaterial color={C.highlight} metalness={0.45} roughness={0.38} />
          </mesh>
        </group>
      ))}
      <mesh position={[1.06, 0.91, 0.28]} rotation-x={Math.PI / 2} castShadow>
        <cylinderGeometry args={[0.045, 0.045, 0.025, 24]} />
        <meshStandardMaterial color={C.highlight} metalness={0.7} roughness={0.28} />
      </mesh>
      <mesh position={[1.81, 0.77, -0.36]} rotation-z={Math.PI / 2}>
        <cylinderGeometry args={[0.035, 0.035, 0.025, 20]} />
        <meshStandardMaterial color={C.steel} metalness={0.82} roughness={0.3} />
      </mesh>
      <Tube points={[[0.8, 0.48, 0.48], [0.96, 0.57, 0.38], [1.08, 0.6, 0.2], [1.16, 0.6, 0.12]]} radius={0.009} color="#b3221a" metal={0.1} rough={0.8} />
      <Tube points={[[0.83, 0.44, 0.48], [0.92, 0.5, 0.35], [0.98, 0.52, 0.1], [1.02, 0.52, -0.06]]} radius={0.008} color="#16181b" metal={0.1} rough={0.9} />
      {([[0.89, 0.42, 0.53], [1.16, 0.42, 0.53], [0.89, 0.42, 0.43], [1.16, 0.42, 0.43]] as const).map(([x, y, z]) => (
        <mesh key={`${x}-${y}-${z}`} position={[x, y, z]} castShadow>
          <cylinderGeometry args={[0.008, 0.008, 0.012, 8]} />
          <meshStandardMaterial color={C.steel} metalness={0.9} roughness={0.25} />
        </mesh>
      ))}
    </group>
  );
}

export function EngineBay() {
  const turbo = useGame((s) => s.game.build.turbo);
  const engine = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    const g = engine.current;
    if (!g) return;
    if (dynoLive.running) {
      const t = clock.elapsedTime;
      const amp = 0.0012 + 0.0016 * dynoLive.load;
      g.position.y = Math.sin(t * (dynoLive.rpm / 60) * 2) * amp;
      g.rotation.x = Math.sin(t * 37) * amp * 1.5;
    } else {
      g.position.y = 0;
      g.rotation.x = 0;
    }
  });
  return (
    <group>
      <group ref={engine}>
        <EngineCore />
        <IntakeSystem turbo={turbo !== "turbo-none"} />
        <FuelSystem />
        <FuelSupply />
        <ExhaustAndTurbo turbo={turbo} />
        <Ecu />
      </group>
      <Intercooler turbo={turbo !== "turbo-none"} />
      <BayDetails />
    </group>
  );
}
