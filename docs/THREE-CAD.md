# Three.js and CAD visualization contract (experimental)

The core remains dependency-free, Worker-safe and declarative. Import
`@ragbaz/common/content/geometry3d` to validate `ragbaz.geometry/1`
documents, generate an SVG inventory and read exact dimensions.

```json
{
  "version": "ragbaz.geometry/1",
  "profile": "three-scene",
  "units": "mm",
  "objects": [
    {"id":"torus","type":"torus","size":[3,0.8],"color":"#5e9bb5"},
    {"id":"base","type":"box","size":[5,0.4,5],"position":[0,-2,0]}
  ]
}
```

The optional `@ragbaz/common/content/three-adapter` export accepts
`mountThreeScene(element, document, THREE, OrbitControls)`. The host supplies
pinned, locally bundled Three.js and OrbitControls; no remote code or authored
JavaScript is evaluated. The return value disposes the scene and GPU resources.
Do not load this adapter in a Worker. Use `geometrySvg` for no-script fallback.

**Scope:** this is an initial primitive-scene contract, not a CAD kernel.
The `cad-model` profile preserves dimensions and units but does not yet
provide STEP/BREP, topology, Boolean solids, parametric constraints or import/export.
The static SVG is a dimensioned inventory, not a geometric projection. Hosts
must explicitly opt into the interactive adapter. The existing Markdoc visualization registry now recognizes `three-scene` and `cad-model` fenced JSON, producing a static SVG inventory, exact dimensions table, and inert source. Interactive Three.js mounting is still a host opt-in and is not wired into the standalone reader.

Security: bounded objects and numeric dimensions, unique identifiers,
restricted primitive types and colors. No URLs, textures, shader source,
scripts or external assets are accepted. Hosts should enforce additional
GPU/memory budgets and a strict CSP.

Mesh-based Wavefront OBJ export is available through `@ragbaz/common/content/geometry-obj` as `exportSceneOBJ(document, THREE)`. The host must provide Three.js. OBJ is a triangulated interchange format, not a precision CAD model; units are written as a comment, and importing applications must respect them. STEP, STL, glTF, BREP and parametric feature history remain unimplemented.
