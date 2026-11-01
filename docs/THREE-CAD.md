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
provide STEP/BREP, topology, Boolean solids, parametric constraints or precision CAD interchange.
The static SVG is a dimensioned inventory, not a geometric projection. Hosts
must explicitly opt into the interactive adapter. The existing Markdoc visualization registry now recognizes `three-scene` and `cad-model` fenced JSON, producing a static SVG inventory, exact dimensions table, and inert source. The standalone reader now has a host-injected adapter integration, but the default standalone bundle does not ship Three.js or OrbitControls, and the reader's default configuration does not enable geometry interactivity. A host must explicitly configure both libraries and opt in to the desired formats.

Security: bounded objects and numeric dimensions, unique identifiers,
restricted primitive types and colors. No URLs, textures, shader source,
scripts or external assets are accepted. Hosts should enforce additional
GPU/memory budgets and a strict CSP.

Mesh-based Wavefront OBJ export is available through `@ragbaz/common/content/geometry-obj` as `exportSceneOBJ(document, THREE)`. The host must provide Three.js. OBJ is a triangulated interchange format, not a precision CAD model; units are written as a comment, and importing applications must respect them. STEP, STL, glTF, BREP and parametric feature history remain unimplemented.

## Rendering and deployment status

The default reader remains offline-safe with static SVG inventory, exact dimensions and inert source. The interactive adapter is exported by `demo/markdoc-ragbaz/visualization-adapters.js` as `configureGeometryAdapter(THREE, OrbitControls)`; this accepts host-owned library objects, never URLs from document data. Hosts must include reviewed, locally bundled compatible Three.js and OrbitControls code, then explicitly configure `visualizations.interactive` to include `three-scene` and/or `cad-model`. The default `registry.json` does neither, so merely writing a geometry fence does not activate WebGL. Always call `disposeVisualizations(root)` before replacing a rendered subtree.

The OBJ exporter triangulates the validated primitives, applies object transforms, and limits the combined generated vertex count to 1,000,000. Its units comment is informational; Wavefront OBJ has no normative physical-unit metadata. Exported OBJ must not be represented as STEP, BREP or a watertight solid model.

## Remaining acceptance gates

- Run the complete Node test suite and dedicated geometry tests on Node 22, including the standalone build's license-inventory gate.
- Bundle and review a pinned Three.js dependency and OrbitControls, including licenses, then exercise WebGL and context-loss/disposal behavior in a browser with networking disabled.
- Verify no-WebGL, keyboard, screen-reader and reduced-motion behavior; retain the exact table and SVG fallback.
- Design a separate reviewed precision-CAD kernel contract before claiming STEP/BREP, Booleans, assemblies or parametric history.
