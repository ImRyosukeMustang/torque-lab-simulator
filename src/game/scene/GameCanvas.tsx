import { CameraControls, ContactShadows, Environment, Lightformer, PerformanceMonitor } from "@react-three/drei";
import { Canvas, useFrame } from "@react-three/fiber";
import { Bloom, EffectComposer, N8AO, SMAA, ToneMapping, Vignette } from "@react-three/postprocessing";
import { ToneMappingMode } from "postprocessing";
import { useEffect, useRef, useState } from "react";
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

/** Per-tier render budget. `reflect` is the floor reflection resolution (0 = matte floor). */
export const QUALITY = {
  ultra: { maxDpr: 2, shadowMap: 4096, env: 512, contact: true, post: true, ao: true, smaa: true, reflect: 1024 },
  high: { maxDpr: 1.75, shadowMap: 2048, env: 256, contact: true, post: true, ao: true, smaa: false, reflect: 512 },
  medium: { maxDpr: 1.5, shadowMap: 1024, env: 128, contact: true, post: false, ao: false, smaa: false, reflect: 0 },
  low: { maxDpr: 1, shadowMap: 512, env: 64, contact: false, post: false, ao: false, smaa: false, reflect: 0 },
};

export function GameCanvas() {
  const wrap = useRef<HTMLDivElement>(null);
  const quality = useGame((s) => s.settings.quality);
  const q = QUALITY[quality];
  // Adaptive resolution: start at the tier's cap and step down while the frame rate stays low.
  const [dpr, setDpr] = useState(() => Math.min(q.maxDpr, typeof window === "undefined" ? 1 : window.devicePixelRatio || 1));
  useEffect(() => setDpr(Math.min(q.maxDpr, window.devicePixelRatio || 1)), [q.maxDpr]);
  return (
    <div ref={wrap} className="absolute inset-0">
      <Canvas
        // Remount on quality change so shadow maps and the render pipeline are rebuilt cleanly.
        key={quality}
        shadows={quality === "low" ? false : "percentage"}
        dpr={dpr}
        camera={{ position: VIEWS.exterior.camera, fov: 38, near: 0.05, far: 80 }}
        gl={{ antialias: !q.post }}
        onCreated={({ gl }) => {
          // With post-processing, tone mapping runs last in the effect chain (after bloom) instead.
          gl.toneMapping = q.post ? THREE.NoToneMapping : THREE.ACESFilmicToneMapping;
          gl.toneMappingExposure = 1.05;
        }}
        onPointerMissed={() => useGame.getState().setHovered(null)}
      >
        <PerformanceMonitor
          onDecline={() => setDpr((d) => Math.max(1, Math.round((d - 0.25) * 100) / 100))}
          onIncline={() => setDpr((d) => Math.min(q.maxDpr, window.devicePixelRatio || 1, Math.round((d + 0.25) * 100) / 100))}
          flipflops={4}
        />
        <color attach="background" args={["#1a1c1f"]} />
        <fog attach="fog" args={["#1a1c1f", 12, 26]} />
        <hemisphereLight args={["#dfe6ee", "#3a342c", 0.38]} />
        <directionalLight
          position={[4, 7, 3]}
          intensity={1.7}
          castShadow
          shadow-mapSize={[q.shadowMap, q.shadowMap]}
          shadow-camera-left={-5}
          shadow-camera-right={5}
          shadow-camera-top={5}
          shadow-camera-bottom={-5}
          shadow-bias={-0.0004}
          shadow-normalBias={0.02}
        />
        <spotLight position={[1.8, 3.2, 0.6]} angle={0.55} penumbra={0.8} intensity={14} distance={8} color="#fff1dc" />
        <pointLight position={[-4, 2.5, 4]} intensity={6} distance={12} color="#9fb4cc" />
        <Environment resolution={q.env}>
          <Lightformer intensity={3} position={[0, 6, 0]} rotation-x={Math.PI / 2} scale={[12, 3, 1]} />
          <Lightformer intensity={1.6} position={[0, 3, -8]} scale={[16, 2, 1]} />
          <Lightformer intensity={1.2} color="#bcd0e6" position={[-8, 2, 2]} rotation-y={Math.PI / 2} scale={[14, 1.5, 1]} />
          <Lightformer intensity={1.2} color="#f2d6b0" position={[8, 2, -2]} rotation-y={-Math.PI / 2} scale={[14, 1.5, 1]} />
          {/* Ceiling strip reflections: the long highlights that run along a car's flanks in a studio. */}
          {[-2, 0, 2].map((z) => (
            <Lightformer key={z} form="rect" intensity={4} position={[0, 5, z]} rotation-x={Math.PI / 2} scale={[7, 0.3, 1]} />
          ))}
          <Lightformer form="ring" intensity={1.4} color="#ffe8c8" position={[6, 4, 6]} scale={3} />
        </Environment>
        <Workshop reflect={q.reflect} />
        {q.contact && <ContactShadows position={[0, 0.006, 0]} scale={7} blur={2.4} opacity={0.65} far={1.2} frames={1} />}
        <Coupe>
          <EngineBay />
        </Coupe>
        <CameraRig />
        {q.post && (
          <EffectComposer multisampling={q.smaa ? 0 : 4} frameBufferType={THREE.HalfFloatType}>
            {q.ao ? <N8AO aoRadius={0.35} distanceFalloff={0.6} intensity={2.2} quality={quality === "ultra" ? "high" : "medium"} halfRes={quality !== "ultra"} /> : <></>}
            <Bloom mipmapBlur luminanceThreshold={1} luminanceSmoothing={0.2} intensity={0.55} />
            <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
            <Vignette offset={0.3} darkness={0.45} />
            {q.smaa ? <SMAA /> : <></>}
          </EffectComposer>
        )}
        <ReadySignal onReady={() => wrap.current?.setAttribute("data-scene-ready", "true")} />
      </Canvas>
    </div>
  );
}
