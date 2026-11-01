---
schema: ragbaz.document/1
document:
  visualizations:
    descriptions:
      1: A dimensioned torus and a rectangular base in millimetres.
---

# A torus in RAGBAZ

The scene is a declarative geometry document. Its exact dimensions remain
available in the table and source when WebGL is unavailable.

```three-scene
{
  "version": "ragbaz.geometry/1",
  "profile": "three-scene",
  "units": "mm",
  "objects": [
    {"id":"ring","type":"torus","size":[3,0.8],"color":"#5e9bb5","position":[0,1,0]},
    {"id":"base","type":"box","size":[8,0.4,8],"color":"#e5a96b","position":[0,-1,0]}
  ]
}
```
