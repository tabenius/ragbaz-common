---
schema: ragbaz.document/1
document:
  visualizations:
    descriptions:
      1: A dimensioned torus on a square base, with a static inventory and exact dimensions.
      2: A simple CAD assembly of three primitives, with dimensions preserved without WebGL.
---

# Three-dimensional geometry and CAD views

This page is a candidate example for Pieces. Both examples are declarative data, not executable JavaScript. The static SVG inventory and exact dimension table remain available when WebGL is unavailable or interactive rendering is disabled.

## Scene view: torus on a base

Use the interactive Three.js view to orbit, pan and zoom when the host explicitly enables trusted geometry interactivity. The same objects are described below the canvas for offline and accessible reading.

```three-scene
{
  "version": "ragbaz.geometry/1",
  "profile": "three-scene",
  "units": "mm",
  "objects": [
    {"id":"ring","type":"torus","size":[30,8],"position":[0,12,0],"color":"#5e9bb5"},
    {"id":"base","type":"box","size":[80,4,80],"position":[0,-6,0],"color":"#e5a96b"}
  ]
}
```

## CAD view: primitive assembly

This view uses the `cad-model` profile. It is a dimensioned assembly preview, **not** a solid-modeling kernel: no booleans, constraints, STEP export or manufacturing tolerances are implied.

```cad-model
{
  "version": "ragbaz.geometry/1",
  "profile": "cad-model",
  "units": "mm",
  "objects": [
    {"id":"platform","type":"box","size":[100,8,60],"position":[0,-8,0],"color":"#e5a96b"},
    {"id":"boss","type":"cylinder","size":[12,24],"position":[-20,8,0],"color":"#5e9bb5"},
    {"id":"ball","type":"sphere","size":[11],"position":[24,12,0],"color":"#91b7a0"}
  ]
}
```

## Reader expectations

The page should render with no external script or stylesheet requests when packaged by the standalone RAGBAZ Markdoc reader. Geometry interactivity is opt-in; static inventory, exact dimensions and the original declarative specification are the default. Pieces must explicitly integrate the reader and enable trusted `three-scene` and `cad-model` adapters before claiming the live site supports interactive views.
