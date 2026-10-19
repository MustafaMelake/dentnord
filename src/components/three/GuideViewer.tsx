"use client";

import {
  Bounds,
  Center,
  ContactShadows,
  Environment,
  Float,
  Lightformer,
  OrbitControls,
  useGLTF,
} from "@react-three/drei";
import { Canvas, useFrame } from "@react-three/fiber";
import { Component, Suspense, useEffect, useMemo, useRef, type ReactNode } from "react";
import * as THREE from "three";

import { ProceduralGuide, useGuideMaterials } from "./procedural-guide";

// The interactive surgical guide. Client only: load it through <GuideViewerLazy>, never directly.
// - Model: `modelUrl` (public/models/guide.glb, Draco decoders self-hosted in public/draco/)
//   or the procedural placeholder when there is no file or it fails to load.
// - Studio lighting is built from Lightformers (no HDR download from a third-party CDN).
// - Drag to orbit, zoom/pan off, slow auto-rotate, subtle tilt toward the cursor, gentle float.
// - `active=false` stops the render loop (off-screen).

/** The real file's own materials are replaced by the resin look. Set true to keep them. */
const KEEP_GLB_MATERIALS = false;
const MODEL_SIZE = 4.6;

export type GuideViewerProps = {
  modelUrl: string | null;
  active: boolean;
  onReady?: () => void;
};

export default function GuideViewer({ modelUrl, active, onReady }: GuideViewerProps) {
  return (
    <Canvas
      dpr={[1, 1.5]}
      frameloop={active ? "always" : "never"}
      shadows={false}
      camera={{ position: [0, 4.3, 8.6], fov: 30 }}
      gl={{ alpha: true, antialias: true, powerPreference: "high-performance" }}
      // OrbitControls sets an inline `touch-action: none`; forcing pan-y lets phones scroll the page
      // past the card with vertical swipes while horizontal drags still rotate the model.
      className="touch-pan-y!"
    >
      <Suspense fallback={null}>
        <Scene modelUrl={modelUrl} />
        <Ready onReady={onReady} />
      </Suspense>
      <OrbitControls
        makeDefault
        enableZoom={false}
        enablePan={false}
        enableDamping
        autoRotate
        autoRotateSpeed={0.7}
        minPolarAngle={Math.PI * 0.18}
        maxPolarAngle={Math.PI * 0.46}
      />
    </Canvas>
  );
}

function Scene({ modelUrl }: { modelUrl: string | null }) {
  const { resin, metal } = useGuideMaterials();
  const procedural = <ProceduralGuide resin={resin} metal={metal} />;

  return (
    <>
      <ambientLight intensity={0.35} />
      <directionalLight position={[3, 6, 4]} intensity={1.4} />
      <Environment resolution={256} frames={1}>
        <group rotation={[-Math.PI / 3, 0, 1]}>
          <Lightformer
            form="circle"
            intensity={4}
            rotation-x={Math.PI / 2}
            position={[0, 5, -9]}
            scale={2}
          />
          <Lightformer
            form="circle"
            intensity={2}
            rotation-y={Math.PI / 2}
            position={[-5, 1, -1]}
            scale={2}
          />
          <Lightformer
            form="circle"
            intensity={2}
            rotation-y={Math.PI / 2}
            position={[-5, -1, -1]}
            scale={2}
          />
          <Lightformer
            form="circle"
            intensity={2}
            rotation-y={-Math.PI / 2}
            position={[10, 1, 0]}
            scale={8}
          />
          <Lightformer
            form="ring"
            color="#8fb4dd"
            intensity={3}
            rotation-y={Math.PI / 2}
            position={[-0.1, -1, -5]}
            scale={10}
          />
        </group>
      </Environment>

      {/* Bounds frames the model for any canvas aspect ratio (square on phones, wide on desktop). */}
      <Bounds fit clip observe margin={1.25} maxDuration={0}>
        <Tilt>
          <Float
            speed={1.4}
            rotationIntensity={0.12}
            floatIntensity={0.35}
            floatingRange={[-0.08, 0.08]}
          >
            {modelUrl ? (
              <ModelBoundary fallback={procedural}>
                <GltfGuide url={modelUrl} resin={resin} />
              </ModelBoundary>
            ) : (
              procedural
            )}
          </Float>
        </Tilt>
      </Bounds>

      <ContactShadows
        position={[0, -1.15, 0]}
        opacity={0.35}
        scale={9}
        blur={2.6}
        far={3}
        resolution={512}
        color="#061423"
      />
    </>
  );
}

/** Eases the model toward the cursor (in addition to OrbitControls). */
function Tilt({ children }: { children: ReactNode }) {
  const ref = useRef<THREE.Group>(null);
  useFrame((state, dt) => {
    const g = ref.current;
    if (!g) return;
    g.rotation.x = THREE.MathUtils.damp(g.rotation.x, -state.pointer.y * 0.12, 3, dt);
    g.rotation.z = THREE.MathUtils.damp(g.rotation.z, state.pointer.x * 0.08, 3, dt);
  });
  return <group ref={ref}>{children}</group>;
}

function GltfGuide({ url, resin }: { url: string; resin: THREE.Material }) {
  const { scene } = useGLTF(url, "/draco/");
  const object = useMemo(() => {
    const root = scene.clone(true);
    if (!KEEP_GLB_MATERIALS) {
      root.traverse((o) => {
        if ((o as THREE.Mesh).isMesh) (o as THREE.Mesh).material = resin;
      });
    }
    // Normalise size so any export (mm, m, …) fits the frame.
    const size = new THREE.Box3().setFromObject(root).getSize(new THREE.Vector3());
    root.scale.setScalar(MODEL_SIZE / Math.max(size.x, size.y, size.z, 1e-6));
    return root;
  }, [scene, resin]);

  return (
    <Center>
      <primitive object={object} />
    </Center>
  );
}

/** Falls back to the procedural guide if the GLB fails to load or parse. */
class ModelBoundary extends Component<
  { fallback: ReactNode; children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

/** Mounted inside Suspense after the scene: fires once everything has loaded. */
function Ready({ onReady }: { onReady?: () => void }) {
  useEffect(() => {
    onReady?.();
  }, [onReady]);
  return null;
}
