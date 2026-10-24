"use client";

import * as THREE from "three";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { OBJLoader } from "three/examples/jsm/loaders/OBJLoader.js";
import { PLYLoader } from "three/examples/jsm/loaders/PLYLoader.js";
import { STLLoader } from "three/examples/jsm/loaders/STLLoader.js";

import { extensionOf } from "@/lib/case-files";

// Loads one case file for the 3D viewer: asks our API for a 5-minute signed GET (same access rules
// as downloads), fetches the bytes straight from R2 with progress, and parses them with the
// three.js example loaders (STL, PLY, OBJ, GLB). The bucket's CORS rule must allow GET.

export class ModelLoadError extends Error {
  constructor(readonly code: "access" | "network" | "format") {
    super(code);
  }
}

async function fetchWithProgress(
  url: string,
  total: number,
  onProgress: (p: number) => void,
  signal: AbortSignal,
) {
  const res = await fetch(url, { signal }).catch((e: unknown) => {
    if ((e as Error).name === "AbortError") throw e;
    throw new ModelLoadError("network");
  });
  if (!res.ok || !res.body) throw new ModelLoadError(res.status === 403 ? "access" : "network");
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let received = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    received += value.length;
    onProgress(total > 0 ? Math.min(received / total, 1) : 0);
  }
  const out = new Uint8Array(received);
  let offset = 0;
  for (const c of chunks) {
    out.set(c, offset);
    offset += c.length;
  }
  return out.buffer;
}

let draco: DRACOLoader | null = null;

/** Parses the bytes into an object whose meshes the viewer can recolour. */
export async function parseModel(fileName: string, buffer: ArrayBuffer): Promise<THREE.Object3D> {
  const ext = extensionOf(fileName);
  try {
    if (ext === ".stl" || ext === ".ply") {
      const geometry =
        ext === ".stl" ? new STLLoader().parse(buffer) : new PLYLoader().parse(buffer);
      if (!geometry.getAttribute("normal")) geometry.computeVertexNormals();
      // Vertex colours from a scanner would fight the layer colour: the layer colour wins.
      geometry.deleteAttribute("color");
      return new THREE.Mesh(geometry);
    }
    if (ext === ".obj") return new OBJLoader().parse(new TextDecoder().decode(buffer));
    if (ext === ".glb") {
      const loader = new GLTFLoader();
      draco ??= new DRACOLoader().setDecoderPath("/draco/");
      loader.setDRACOLoader(draco);
      const gltf = await loader.parseAsync(buffer, "");
      return gltf.scene;
    }
  } catch {
    throw new ModelLoadError("format");
  }
  throw new ModelLoadError("format");
}

export async function loadCaseModel(
  file: { fileId: string; name: string; sizeBytes: number },
  onProgress: (p: number) => void,
  signal: AbortSignal,
) {
  const meta = await fetch(`/api/uploads/files/${encodeURIComponent(file.fileId)}/view`, {
    signal,
  });
  if (!meta.ok)
    throw new ModelLoadError(meta.status === 404 || meta.status === 403 ? "access" : "network");
  const { url } = (await meta.json()) as { url: string };
  const buffer = await fetchWithProgress(url, file.sizeBytes, onProgress, signal);
  return parseModel(file.name, buffer);
}

/** Gives every mesh in the object one material (the layer's colour and opacity). */
export function applyLayerMaterial(object: THREE.Object3D, color: string, opacity: number) {
  object.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) return;
    const material =
      child.material instanceof THREE.MeshStandardMaterial && child.userData.layerMaterial
        ? child.material
        : new THREE.MeshStandardMaterial({
            roughness: 0.55,
            metalness: 0.05,
            side: THREE.DoubleSide,
          });
    material.color.set(color);
    material.opacity = opacity;
    material.transparent = opacity < 1;
    material.depthWrite = opacity >= 1;
    child.material = material;
    child.userData.layerMaterial = true;
  });
}
