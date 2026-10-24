"use client";

import { Bounds, OrbitControls, useBounds } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import { useEffect, type RefObject } from "react";
import type * as THREE from "three";

// The case viewer's 3D scene (client only; loaded lazily by case-viewer.tsx). Orbit with one finger
// or the left mouse button, zoom with a pinch or the wheel, pan with two fingers or the right
// button. "Fit" frames what is visible; "reset" returns to the front view and frames it.

export type ViewerControls = { fit: () => void; reset: () => void };

export default function ViewerCanvas({
  objects,
  controlsRef,
}: {
  objects: { key: string; object: THREE.Object3D }[];
  controlsRef: RefObject<ViewerControls | null>;
}) {
  return (
    <Canvas
      dpr={[1, 2]}
      camera={{ position: [0, 0, 120], fov: 35, near: 0.1, far: 20000 }}
      gl={{ antialias: true }}
      className="touch-none"
      data-viewer-canvas=""
    >
      <color attach="background" args={["#f4f6f8"]} />
      <hemisphereLight args={["#ffffff", "#b8c2cc", 0.9]} />
      <directionalLight position={[80, 120, 160]} intensity={1.1} />
      <directionalLight position={[-120, -60, -100]} intensity={0.45} />
      <Bounds fit clip observe margin={1.25} maxDuration={0.4}>
        {objects.map(({ key, object }) => (
          <primitive key={key} object={object} />
        ))}
        <BoundsControls controlsRef={controlsRef} count={objects.length} />
      </Bounds>
      <OrbitControls makeDefault enableDamping dampingFactor={0.12} />
    </Canvas>
  );
}

function BoundsControls({
  controlsRef,
  count,
}: {
  controlsRef: RefObject<ViewerControls | null>;
  count: number;
}) {
  const bounds = useBounds();
  useEffect(() => {
    controlsRef.current = {
      fit: () => bounds.refresh().clip().fit(),
      reset: () => {
        const { center, distance } = bounds.refresh().getSize();
        bounds
          .moveTo([center.x, center.y, center.z + distance])
          .lookAt({ target: center, up: [0, 1, 0] })
          .clip();
      },
    };
    return () => {
      controlsRef.current = null;
    };
  }, [bounds, controlsRef]);
  // A layer was shown or hidden: frame the new set.
  useEffect(() => {
    if (count > 0) bounds.refresh().clip().fit();
  }, [bounds, count]);
  return null;
}
