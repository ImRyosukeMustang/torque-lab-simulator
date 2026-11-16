import { CameraControls, ContactShadows, Environment, Lightformer } from "@react-three/drei";
import { Canvas, useFrame } from "@react-three/fiber";
import { useEffect, useRef } from "react";
import * as THREE from "three";
import { useGame } from "../store";
import { Coupe } from "./Coupe";
import { EngineBay } from "./EngineBay";
import { SLOT_FOCUS, VIEWS } from "./layout";
import { Workshop } from "./Workshop";

function CameraRig() {
  const ref = useRef<CameraControls>(null);
  const view = useGame((s) => s.view);
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const v = view in VIEWS ? VIEWS[view as keyof typeof VIEWS] : SLOT_FOCUS[view as keyof typeof SLOT_FOCUS];
    void c.setLookAt(...v.camera, ...v.target, true);
  }, [view]);
  return (
    <CameraControls
      ref={ref}
      makeDefault
      minDistance={0.6}
      maxDistance={11}
      maxPolarAngle={Math.PI * 0.49}
      smoothTime={0.35}
      dollySpeed={0.6}
    />
  );
}

function ReadySignal({ onReady }: { onReady: () => void }) {
  const frames = useRef(0);
  useFrame(() => {
    frames.current += 1;
    if (frames.current === 3) onReady();
  });
  return null;
}

export function GameCanvas() {
  const wrap = useRef<HTMLDivElement>(null);
  return (
    <div ref={wrap} className="absolute inset-0">
      <Canvas
        shadows
        dpr={[1, 2]}
        camera={{ position: VIEWS.exterior.camera, fov: 38, near: 0.05, far: 80 }}
        gl={{ antialias: true }}
        onCreated={({ gl }) => {
          gl.toneMapping = THREE.ACESFilmicToneMapping;
          gl.toneMappingExposure = 1.05;
        }}
        onPointerMissed={() => useGame.getState().setHovered(null)}
      >
        <color attach="background" args={["#1a1c1f"]} />
        <fog attach="fog" args={["#1a1c1f", 12, 26]} />
        <hemisphereLight args={["#dfe6ee", "#3a342c", 0.55]} />
        <directionalLight
          position={[4, 7, 3]}
          intensity={2.2}
          castShadow
          shadow-mapSize={[2048, 2048]}
          shadow-camera-left={-5}
          shadow-camera-right={5}
          shadow-camera-top={5}
          shadow-camera-bottom={-5}
          shadow-bias={-0.0004}
        />
        <spotLight position={[1.8, 3.2, 0.6]} angle={0.55} penumbra={0.8} intensity={14} distance={8} color="#fff1dc" />
        <pointLight position={[-4, 2.5, 4]} intensity={6} distance={12} color="#9fb4cc" />
        <Environment resolution={256}>
          <Lightformer intensity={3} position={[0, 6, 0]} rotation-x={Math.PI / 2} scale={[12, 3, 1]} />
          <Lightformer intensity={1.6} position={[0, 3, -8]} scale={[16, 2, 1]} />
          <Lightformer intensity={1.2} color="#bcd0e6" position={[-8, 2, 2]} rotation-y={Math.PI / 2} scale={[14, 1.5, 1]} />
          <Lightformer intensity={1.2} color="#f2d6b0" position={[8, 2, -2]} rotation-y={-Math.PI / 2} scale={[14, 1.5, 1]} />
        </Environment>
        <Workshop />
        <ContactShadows position={[0, 0.006, 0]} scale={7} blur={2.4} opacity={0.65} far={1.2} frames={1} />
        <Coupe>
          <EngineBay />
        </Coupe>
        <CameraRig />
        <ReadySignal onReady={() => wrap.current?.setAttribute("data-scene-ready", "true")} />
      </Canvas>
    </div>
  );
}
