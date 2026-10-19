"use client";

import { useMemo } from "react";
import * as THREE from "three";

// Placeholder surgical guide, used until public/models/guide.glb exists.
// Built like a real tooth-supported guide: a horseshoe arch whose cross-section is an inverted U
// (occlusal slab + buccal and lingual walls that sit over the teeth), with hollow metal sleeves
// through the slab at the planned implant sites.

/** Ellipse radii (x = half-width, y = front-to-back) of the arch outline, in scene units. */
const OUTER = { a: 2.3, b: 1.95 };
const INNER = { a: 1.45, b: 1.1 };
const WALL = 0.12;
const SPAN = 0.66 * Math.PI; // the arch runs from -SPAN to +SPAN (front teeth at 0)
/** Implant sites along the arch (angle), slightly asymmetric like a real case. */
const SLEEVE_SITES = [-0.47 * Math.PI, -0.2 * Math.PI, 0.09 * Math.PI, 0.41 * Math.PI];
const SLEEVE = { inner: 0.12, outer: 0.19, collar: 0.235, below: 0.3, above: 0.34 };

const point = (r: { a: number; b: number }, t: number) =>
  new THREE.Vector2(Math.sin(t) * r.a, Math.cos(t) * r.b);
const mid = { a: (OUTER.a + INNER.a) / 2, b: (OUTER.b + INNER.b) / 2 };

/** Closed horseshoe band between two ellipses, with rounded ends. */
function band(
  outer: { a: number; b: number },
  inner: { a: number; b: number },
  holes: THREE.Path[] = [],
) {
  const N = 96;
  const shape = new THREE.Shape();
  const cap = (from: THREE.Vector2, to: THREE.Vector2, t: number, dir: 1 | -1) => {
    const tangent = new THREE.Vector2(Math.cos(t) * outer.a, -Math.sin(t) * outer.b)
      .normalize()
      .multiplyScalar(dir * from.distanceTo(to) * 0.65);
    const control = from.clone().add(to).multiplyScalar(0.5).add(tangent);
    shape.quadraticCurveTo(control.x, control.y, to.x, to.y);
  };

  const start = point(outer, -SPAN);
  shape.moveTo(start.x, start.y);
  for (let i = 1; i <= N; i++) {
    const p = point(outer, -SPAN + (2 * SPAN * i) / N);
    shape.lineTo(p.x, p.y);
  }
  cap(point(outer, SPAN), point(inner, SPAN), SPAN, 1);
  for (let i = N - 1; i >= 0; i--) {
    const p = point(inner, -SPAN + (2 * SPAN * i) / N);
    shape.lineTo(p.x, p.y);
  }
  cap(point(inner, -SPAN), start, -SPAN, -1);
  shape.holes.push(...holes);
  return shape;
}

function extrude(shape: THREE.Shape, depth: number, bevel: number) {
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: true,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: 5,
    curveSegments: 48,
  });
  // Shape plane (XY) → horizontal (XZ), front of the arch towards the camera, extruding downwards.
  geometry.rotateX(Math.PI / 2);
  geometry.computeVertexNormals();
  return geometry;
}

function sleeveGeometry() {
  const { inner, outer, collar, below, above } = SLEEVE;
  const profile = [
    new THREE.Vector2(inner, -below),
    new THREE.Vector2(outer, -below),
    new THREE.Vector2(outer, above - 0.1),
    new THREE.Vector2(collar, above - 0.1),
    new THREE.Vector2(collar, above),
    new THREE.Vector2(inner, above),
    new THREE.Vector2(inner, -below),
  ];
  return new THREE.LatheGeometry(profile, 48);
}

export function useGuideMaterials() {
  return useMemo(
    () => ({
      resin: new THREE.MeshPhysicalMaterial({
        color: "#eef5fc",
        transmission: 0.92,
        thickness: 0.35,
        roughness: 0.16,
        ior: 1.48,
        clearcoat: 1,
        clearcoatRoughness: 0.12,
        attenuationColor: new THREE.Color("#a9cbef"),
        attenuationDistance: 3.2,
      }),
      metal: new THREE.MeshStandardMaterial({ color: "#d3d9e0", metalness: 1, roughness: 0.22 }),
    }),
    [],
  );
}

export function ProceduralGuide({
  resin,
  metal,
}: {
  resin: THREE.Material;
  metal: THREE.Material;
}) {
  const parts = useMemo(() => {
    const sites = SLEEVE_SITES.map((t) => point(mid, t));
    const holes = sites.map((p) =>
      new THREE.Path().absarc(p.x, p.y, SLEEVE.outer, 0, Math.PI * 2, true),
    );
    return {
      slab: extrude(band(OUTER, INNER, holes), 0.22, 0.07),
      buccal: extrude(band(OUTER, { a: OUTER.a - WALL, b: OUTER.b - WALL }), 0.7, 0.04),
      lingual: extrude(band({ a: INNER.a + WALL, b: INNER.b + WALL }, INNER), 0.55, 0.04),
      sleeve: sleeveGeometry(),
      sites,
    };
  }, []);

  return (
    // Centre the model: ~1.3 units tall (y), arch spans z ≈ -0.95…1.95.
    <group position={[0, 0.35, -0.5]}>
      <mesh geometry={parts.slab} material={resin} castShadow />
      <mesh geometry={parts.buccal} material={resin} castShadow />
      <mesh geometry={parts.lingual} material={resin} castShadow />
      {parts.sites.map((p, i) => (
        <mesh
          key={i}
          geometry={parts.sleeve}
          material={metal}
          position={[p.x, 0, p.y]}
          castShadow
        />
      ))}
    </group>
  );
}
