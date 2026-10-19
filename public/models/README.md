# 3D guide model

The home page 3D card shows `public/models/guide.glb` when that file exists (checked at build
time). Until then it renders a procedural placeholder guide (`src/components/three/procedural-guide.tsx`).

## Converting the doctor's STL to an optimised Draco GLB

glTF-Transform only reads glTF/GLB, so convert in two steps.

**1. STL → GLB** (pick one; neither needs installing permanently)

```bash
# Option A: Blender (headless). Replace the paths.
blender -b --python-expr "import bpy; bpy.ops.wm.read_factory_settings(use_empty=True); bpy.ops.wm.stl_import(filepath='guide.stl'); bpy.ops.export_scene.gltf(filepath='guide-raw.glb', export_format='GLB')"

# Option B: Assimp CLI
assimp export guide.stl guide-raw.glb -f glb2
```

**2. Optimise + Draco-compress** with [`@gltf-transform/cli`](https://gltf-transform.dev/cli) (run via npx):

```bash
npx @gltf-transform/cli@4 optimize guide-raw.glb public/models/guide.glb \
  --compress draco --simplify true --simplify-ratio 0.5 --simplify-error 0.0005
```

Scanned/printed STLs are often several million triangles. Aim for **< 2 MB** and
**< 300k triangles**; lower `--simplify-ratio` if the file is still large. Check the result at
<https://gltf-viewer.donmccurdy.com/>.

## Notes

- **Scale and orientation:** the viewer centres the model and scales it to fit, so any unit
  (mm/m) works. Export with the occlusal side up (+Y) and the front teeth toward +Z.
- **Materials:** the viewer replaces every mesh's material with the translucent resin look
  (`KEEP_GLB_MATERIALS = false` in `src/components/three/GuideViewer.tsx`). If the file has its own
  separate sleeve meshes and materials, set it to `true`.
- **Draco decoders** are self-hosted in `public/draco/` (copied from
  `node_modules/three/examples/jsm/libs/draco/gltf/`), so visitors never fetch from Google's CDN.
  Re-copy them after a major `three` upgrade.
- Then rebuild (`pnpm build`); the page picks the file up automatically.
