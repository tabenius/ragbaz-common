---
schema: ragbaz.document/1
document:
  visualizations:
    descriptions:
      1: Garage cell, 6 by 4.5 metres, with a 1.25 metre square water-table plasma cutter on a stand.
      2: Workshop, 10 by 7 metres, with a 1.5 by 3 metre water table, plasma source, compressor and extraction.
      3: Production hall, 16 by 10 metres, with a 2 by 6 metre table, overhead runway, pipe bench and hydroculture rack.
---

# CAM workshop study: a CNC plasma cutter

A simulated CAM workshop around one project: building and running a CNC plasma
cutter. Each alternative starts from the room's convex hull (a box room is its
own hull), places a square water pan on a stand ready for the gantry
mechatronics, and routes power, air, fume extraction and waste water. The
drawings are declarative `ragbaz.geometry/1` `cad-model` documents: primitives
with exact dimensions in metres, not a precision CAD kernel. Figures are
planning assumptions, not engineering, electrical or environmental approval.

Plasma cuts electrically conductive material only: steel, stainless and
aluminium. Plastics and pressure pipes in PE or PVC need a router, saw or
laser; plasma makes the steel parts around them (flanges, supports, brackets).

## Alternative A: Garage cell — retail goods

```cad-model
{"version":"ragbaz.geometry/1","profile":"cad-model","units":"m","objects":[{"id":"floor","type":"box","size":[6,0.1,4.5],"position":[3,-0.05,2.25],"color":"#8f8a80"},{"id":"wall-back","type":"box","size":[6,2.7,0.15],"position":[3,1.35,-0.075],"color":"#c9c3b8"},{"id":"wall-left","type":"box","size":[0.15,2.7,4.5],"position":[-0.075,1.35,2.25],"color":"#c9c3b8"},{"id":"drain-channel","type":"box","size":[1.24,0.02,0.15],"position":[3.2,0.01,3.525],"color":"#2c3e50"},{"id":"floor-drain","type":"cylinder","size":[0.075,0.03],"position":[3.92,0.015,3.525],"color":"#2c3e50"},{"id":"pan-drain-valve","type":"cylinder","size":[0.03,0.64],"position":[3.82,0.37,3.175],"color":"#2c3e50"},{"id":"leg-0a","type":"box","size":[0.08,0.69,0.08],"position":[2.475,0.345,1.775],"color":"#3d4b55"},{"id":"leg-0b","type":"box","size":[0.08,0.69,0.08],"position":[2.475,0.345,3.225],"color":"#3d4b55"},{"id":"leg-1a","type":"box","size":[0.08,0.69,0.08],"position":[3.2,0.345,1.775],"color":"#3d4b55"},{"id":"leg-1b","type":"box","size":[0.08,0.69,0.08],"position":[3.2,0.345,3.225],"color":"#3d4b55"},{"id":"leg-2a","type":"box","size":[0.08,0.69,0.08],"position":[3.925,0.345,1.775],"color":"#3d4b55"},{"id":"leg-2b","type":"box","size":[0.08,0.69,0.08],"position":[3.925,0.345,3.225],"color":"#3d4b55"},{"id":"stand-frame","type":"box","size":[1.55,0.08,1.55],"position":[3.2,0.65,2.5],"color":"#3d4b55"},{"id":"water-pan","type":"box","size":[1.55,0.16,1.55],"position":[3.2,0.77,2.5],"color":"#5f6b73"},{"id":"water-surface","type":"box","size":[1.51,0.01,1.51],"position":[3.2,0.82,2.5],"color":"#3f7fb3"},{"id":"slat-0","type":"box","size":[0.006,0.1,1.25],"position":[2.575,0.87,2.5],"color":"#a7b0b6"},{"id":"slat-1","type":"box","size":[0.006,0.1,1.25],"position":[2.675,0.87,2.5],"color":"#a7b0b6"},{"id":"slat-2","type":"box","size":[0.006,0.1,1.25],"position":[2.775,0.87,2.5],"color":"#a7b0b6"},{"id":"slat-3","type":"box","size":[0.006,0.1,1.25],"position":[2.875,0.87,2.5],"color":"#a7b0b6"},{"id":"slat-4","type":"box","size":[0.006,0.1,1.25],"position":[2.975,0.87,2.5],"color":"#a7b0b6"},{"id":"slat-5","type":"box","size":[0.006,0.1,1.25],"position":[3.075,0.87,2.5],"color":"#a7b0b6"},{"id":"slat-6","type":"box","size":[0.006,0.1,1.25],"position":[3.175,0.87,2.5],"color":"#a7b0b6"},{"id":"slat-7","type":"box","size":[0.006,0.1,1.25],"position":[3.275,0.87,2.5],"color":"#a7b0b6"},{"id":"slat-8","type":"box","size":[0.006,0.1,1.25],"position":[3.375,0.87,2.5],"color":"#a7b0b6"},{"id":"slat-9","type":"box","size":[0.006,0.1,1.25],"position":[3.475,0.87,2.5],"color":"#a7b0b6"},{"id":"slat-10","type":"box","size":[0.006,0.1,1.25],"position":[3.575,0.87,2.5],"color":"#a7b0b6"},{"id":"slat-11","type":"box","size":[0.006,0.1,1.25],"position":[3.675,0.87,2.5],"color":"#a7b0b6"},{"id":"slat-12","type":"box","size":[0.006,0.1,1.25],"position":[3.775,0.87,2.5],"color":"#a7b0b6"},{"id":"rail-a","type":"box","size":[1.85,0.1,0.1],"position":[3.2,0.97,1.645],"color":"#e5a96b"},{"id":"rail-b","type":"box","size":[1.85,0.1,0.1],"position":[3.2,0.97,3.355],"color":"#e5a96b"},{"id":"gantry-bridge","type":"box","size":[0.18,0.22,1.91],"position":[2.888,1.27,2.5],"color":"#e5a96b"},{"id":"gantry-end-a","type":"box","size":[0.22,0.3,0.12],"position":[2.888,1.12,1.645],"color":"#e5a96b"},{"id":"gantry-end-b","type":"box","size":[0.22,0.3,0.12],"position":[2.888,1.12,3.355],"color":"#e5a96b"},{"id":"z-carriage","type":"box","size":[0.16,0.3,0.14],"position":[3.058,1.22,2.708],"color":"#3d4b55"},{"id":"plasma-torch","type":"cylinder","size":[0.025,0.28],"position":[3.058,0.99,2.708],"color":"#d0d4d8"},{"id":"electrical-cabinet","type":"box","size":[0.6,1.2,0.3],"position":[0.5,1.1,0.15],"color":"#7a8a96"},{"id":"plasma-source","type":"box","size":[0.5,0.45,0.25],"position":[1.4,0.225,0.45],"color":"#c0392b"},{"id":"compressor-tank","type":"cylinder","size":[0.2,0.9],"position":[2.3,0.25,0.45],"color":"#5e9bb5","rotation":[0,0,1.5707963267948966]},{"id":"air-dryer","type":"box","size":[0.4,0.6,0.35],"position":[3,0.3,0.45],"color":"#5e9bb5"},{"id":"cord-supply","type":"cylinder","size":[0.012,0.9],"position":[0.95,0.012,0.45],"color":"#c0392b","rotation":[0,0,1.5707963267948966]},{"id":"cord-torch","type":"cylinder","size":[0.012,2.728],"position":[2.3,0.012,1.475],"color":"#c0392b","rotation":[1.5707963267948966,0,-0.7205541358442417]},{"id":"cable-ramp","type":"box","size":[0.6,0.04,0.25],"position":[2.3,0.02,1.475],"color":"#7a8a96"},{"id":"extraction-duct","type":"cylinder","size":[0.1,2.3],"position":[4.375,1.15,2.5],"color":"#9aa5ad"},{"id":"extraction-fan","type":"box","size":[0.5,0.5,0.5],"position":[4.375,2.3,2.5],"color":"#9aa5ad"},{"id":"control-desk","type":"box","size":[1,0.75,0.6],"position":[1.625,0.375,3.775],"color":"#9c7a54"},{"id":"finishing-bench","type":"box","size":[2,0.9,0.8],"position":[4.7,0.45,3.9],"color":"#9c7a54"},{"id":"material-rack","type":"box","size":[1.4,1.6,0.6],"position":[5,0.8,0.4],"color":"#6d6d6d"}]}
```

| Need | Planning value |
| --- | --- |
| Convex hull (room) | 6,0 × 4,5 m floor, 2,7 m free height: 27 m², 73 m³ |
| Cutting area | 1,25 × 1,25 m |
| Water pan | 1,55 × 1,55 m, rim 0,85 m above the floor, about 240 l at 100 mm |
| Plasma source | 45 A air plasma, clean cut about 12 mm mild steel, severance 16 mm |
| Electrical supply | 230 V 1-phase 32 A or 400 V 3-phase 16 A; about 7 kVA with the compressor and extraction |
| Compressed air | about 170 l/min at 6 bar, dried and oil-free |
| Fume extraction | about 1 406 m³/h, ducted outside through a spark trap |
| Waste water | pan drain valve to a channel and a trapped floor drain with an oil and metal-sludge separator; about 180 kg sludge a year at one shift |

## Alternative B: Workshop — industrial jobbing

```cad-model
{"version":"ragbaz.geometry/1","profile":"cad-model","units":"m","objects":[{"id":"floor","type":"box","size":[10,0.1,7],"position":[5,-0.05,3.5],"color":"#8f8a80"},{"id":"wall-back","type":"box","size":[10,3.6,0.15],"position":[5,1.8,-0.075],"color":"#c9c3b8"},{"id":"wall-left","type":"box","size":[0.15,3.6,7],"position":[-0.075,1.8,3.5],"color":"#c9c3b8"},{"id":"drain-channel","type":"box","size":[1.44,0.02,0.15],"position":[5.6,0.01,5.7],"color":"#2c3e50"},{"id":"floor-drain","type":"cylinder","size":[0.075,0.03],"position":[6.42,0.015,5.7],"color":"#2c3e50"},{"id":"pan-drain-valve","type":"cylinder","size":[0.03,0.69],"position":[6.32,0.395,5.35],"color":"#2c3e50"},{"id":"leg-0a","type":"box","size":[0.08,0.74,0.08],"position":[4.75,0.37,2.2],"color":"#3d4b55"},{"id":"leg-0b","type":"box","size":[0.08,0.74,0.08],"position":[4.75,0.37,5.4],"color":"#3d4b55"},{"id":"leg-1a","type":"box","size":[0.08,0.74,0.08],"position":[5.6,0.37,2.2],"color":"#3d4b55"},{"id":"leg-1b","type":"box","size":[0.08,0.74,0.08],"position":[5.6,0.37,5.4],"color":"#3d4b55"},{"id":"leg-2a","type":"box","size":[0.08,0.74,0.08],"position":[6.45,0.37,2.2],"color":"#3d4b55"},{"id":"leg-2b","type":"box","size":[0.08,0.74,0.08],"position":[6.45,0.37,5.4],"color":"#3d4b55"},{"id":"stand-frame","type":"box","size":[1.8,0.08,3.3],"position":[5.6,0.7,3.8],"color":"#3d4b55"},{"id":"water-pan","type":"box","size":[1.8,0.16,3.3],"position":[5.6,0.82,3.8],"color":"#5f6b73"},{"id":"water-surface","type":"box","size":[1.76,0.01,3.26],"position":[5.6,0.87,3.8],"color":"#3f7fb3"},{"id":"slat-0","type":"box","size":[0.006,0.1,3],"position":[4.85,0.92,3.8],"color":"#a7b0b6"},{"id":"slat-1","type":"box","size":[0.006,0.1,3],"position":[4.95,0.92,3.8],"color":"#a7b0b6"},{"id":"slat-2","type":"box","size":[0.006,0.1,3],"position":[5.05,0.92,3.8],"color":"#a7b0b6"},{"id":"slat-3","type":"box","size":[0.006,0.1,3],"position":[5.15,0.92,3.8],"color":"#a7b0b6"},{"id":"slat-4","type":"box","size":[0.006,0.1,3],"position":[5.25,0.92,3.8],"color":"#a7b0b6"},{"id":"slat-5","type":"box","size":[0.006,0.1,3],"position":[5.35,0.92,3.8],"color":"#a7b0b6"},{"id":"slat-6","type":"box","size":[0.006,0.1,3],"position":[5.45,0.92,3.8],"color":"#a7b0b6"},{"id":"slat-7","type":"box","size":[0.006,0.1,3],"position":[5.55,0.92,3.8],"color":"#a7b0b6"},{"id":"slat-8","type":"box","size":[0.006,0.1,3],"position":[5.65,0.92,3.8],"color":"#a7b0b6"},{"id":"slat-9","type":"box","size":[0.006,0.1,3],"position":[5.75,0.92,3.8],"color":"#a7b0b6"},{"id":"slat-10","type":"box","size":[0.006,0.1,3],"position":[5.85,0.92,3.8],"color":"#a7b0b6"},{"id":"slat-11","type":"box","size":[0.006,0.1,3],"position":[5.95,0.92,3.8],"color":"#a7b0b6"},{"id":"slat-12","type":"box","size":[0.006,0.1,3],"position":[6.05,0.92,3.8],"color":"#a7b0b6"},{"id":"slat-13","type":"box","size":[0.006,0.1,3],"position":[6.15,0.92,3.8],"color":"#a7b0b6"},{"id":"slat-14","type":"box","size":[0.006,0.1,3],"position":[6.25,0.92,3.8],"color":"#a7b0b6"},{"id":"rail-a","type":"box","size":[2.1,0.1,0.1],"position":[5.6,1.02,2.07],"color":"#e5a96b"},{"id":"rail-b","type":"box","size":[2.1,0.1,0.1],"position":[5.6,1.02,5.53],"color":"#e5a96b"},{"id":"gantry-bridge","type":"box","size":[0.18,0.22,3.66],"position":[5.225,1.32,3.8],"color":"#e5a96b"},{"id":"gantry-end-a","type":"box","size":[0.22,0.3,0.12],"position":[5.225,1.17,2.07],"color":"#e5a96b"},{"id":"gantry-end-b","type":"box","size":[0.22,0.3,0.12],"position":[5.225,1.17,5.53],"color":"#e5a96b"},{"id":"z-carriage","type":"box","size":[0.16,0.3,0.14],"position":[5.395,1.27,4.3],"color":"#3d4b55"},{"id":"plasma-torch","type":"cylinder","size":[0.025,0.28],"position":[5.395,1.04,4.3],"color":"#d0d4d8"},{"id":"electrical-cabinet","type":"box","size":[0.6,1.2,0.3],"position":[0.5,1.1,0.15],"color":"#7a8a96"},{"id":"plasma-source","type":"box","size":[0.7,0.75,0.35],"position":[1.4,0.375,0.45],"color":"#c0392b"},{"id":"compressor-tank","type":"cylinder","size":[0.28,1.4],"position":[2.3,0.33,0.45],"color":"#5e9bb5","rotation":[0,0,1.5707963267948966]},{"id":"air-dryer","type":"box","size":[0.4,0.6,0.35],"position":[3,0.3,0.45],"color":"#5e9bb5"},{"id":"cord-supply","type":"cylinder","size":[0.012,0.9],"position":[0.95,0.012,0.45],"color":"#c0392b","rotation":[0,0,1.5707963267948966]},{"id":"cord-torch","type":"cylinder","size":[0.012,5.372],"position":[3.5,0.012,2.125],"color":"#c0392b","rotation":[1.5707963267948966,0,-0.8975088719198778]},{"id":"cable-ramp","type":"box","size":[0.6,0.04,0.25],"position":[3.5,0.02,2.125],"color":"#7a8a96"},{"id":"extraction-duct","type":"cylinder","size":[0.16,3.2],"position":[6.9,1.6,3.8],"color":"#9aa5ad"},{"id":"extraction-fan","type":"box","size":[0.5,0.5,0.5],"position":[6.9,3.2,3.8],"color":"#9aa5ad"},{"id":"control-desk","type":"box","size":[1,0.75,0.6],"position":[3.9,0.375,5.95],"color":"#9c7a54"},{"id":"finishing-bench","type":"box","size":[2,0.9,0.8],"position":[8.7,0.45,6.4],"color":"#9c7a54"},{"id":"material-rack","type":"box","size":[2.6,2,0.6],"position":[8.4,1,0.4],"color":"#6d6d6d"}]}
```

| Need | Planning value |
| --- | --- |
| Convex hull (room) | 10,0 × 7,0 m floor, 3,6 m free height: 70 m², 252 m³ |
| Cutting area | 1,50 × 3,00 m |
| Water pan | 1,80 × 3,30 m, rim 0,90 m above the floor, about 594 l at 100 mm |
| Plasma source | 85 A air plasma, clean cut about 20 mm mild steel, severance 32 mm |
| Electrical supply | 400 V 3-phase 25 A; about 16 kVA with the compressor and extraction |
| Compressed air | about 190 l/min at 6 bar, dried and oil-free |
| Fume extraction | about 4 050 m³/h, ducted outside through a spark trap |
| Waste water | pan drain valve to a channel and a trapped floor drain with an oil and metal-sludge separator; about 340 kg sludge a year at one shift |

## Alternative C: Production hall — pipe, flange and hydroculture parts

```cad-model
{"version":"ragbaz.geometry/1","profile":"cad-model","units":"m","objects":[{"id":"floor","type":"box","size":[16,0.1,10],"position":[8,-0.05,5],"color":"#8f8a80"},{"id":"wall-back","type":"box","size":[16,5,0.15],"position":[8,2.5,-0.075],"color":"#c9c3b8"},{"id":"wall-left","type":"box","size":[0.15,5,10],"position":[-0.075,2.5,5],"color":"#c9c3b8"},{"id":"drain-channel","type":"box","size":[1.84,0.02,0.15],"position":[8.5,0.01,8.6],"color":"#2c3e50"},{"id":"floor-drain","type":"cylinder","size":[0.075,0.03],"position":[9.52,0.015,8.6],"color":"#2c3e50"},{"id":"pan-drain-valve","type":"cylinder","size":[0.03,0.69],"position":[9.42,0.395,8.25],"color":"#2c3e50"},{"id":"leg-0a","type":"box","size":[0.08,0.74,0.08],"position":[7.4,0.37,2.1],"color":"#3d4b55"},{"id":"leg-0b","type":"box","size":[0.08,0.74,0.08],"position":[7.4,0.37,8.3],"color":"#3d4b55"},{"id":"leg-1a","type":"box","size":[0.08,0.74,0.08],"position":[8.5,0.37,2.1],"color":"#3d4b55"},{"id":"leg-1b","type":"box","size":[0.08,0.74,0.08],"position":[8.5,0.37,8.3],"color":"#3d4b55"},{"id":"leg-2a","type":"box","size":[0.08,0.74,0.08],"position":[9.6,0.37,2.1],"color":"#3d4b55"},{"id":"leg-2b","type":"box","size":[0.08,0.74,0.08],"position":[9.6,0.37,8.3],"color":"#3d4b55"},{"id":"stand-frame","type":"box","size":[2.3,0.08,6.3],"position":[8.5,0.7,5.2],"color":"#3d4b55"},{"id":"water-pan","type":"box","size":[2.3,0.16,6.3],"position":[8.5,0.82,5.2],"color":"#5f6b73"},{"id":"water-surface","type":"box","size":[2.26,0.01,6.26],"position":[8.5,0.87,5.2],"color":"#3f7fb3"},{"id":"slat-0","type":"box","size":[0.006,0.1,6],"position":[7.5,0.92,5.2],"color":"#a7b0b6"},{"id":"slat-1","type":"box","size":[0.006,0.1,6],"position":[7.6,0.92,5.2],"color":"#a7b0b6"},{"id":"slat-2","type":"box","size":[0.006,0.1,6],"position":[7.7,0.92,5.2],"color":"#a7b0b6"},{"id":"slat-3","type":"box","size":[0.006,0.1,6],"position":[7.8,0.92,5.2],"color":"#a7b0b6"},{"id":"slat-4","type":"box","size":[0.006,0.1,6],"position":[7.9,0.92,5.2],"color":"#a7b0b6"},{"id":"slat-5","type":"box","size":[0.006,0.1,6],"position":[8,0.92,5.2],"color":"#a7b0b6"},{"id":"slat-6","type":"box","size":[0.006,0.1,6],"position":[8.1,0.92,5.2],"color":"#a7b0b6"},{"id":"slat-7","type":"box","size":[0.006,0.1,6],"position":[8.2,0.92,5.2],"color":"#a7b0b6"},{"id":"slat-8","type":"box","size":[0.006,0.1,6],"position":[8.3,0.92,5.2],"color":"#a7b0b6"},{"id":"slat-9","type":"box","size":[0.006,0.1,6],"position":[8.4,0.92,5.2],"color":"#a7b0b6"},{"id":"slat-10","type":"box","size":[0.006,0.1,6],"position":[8.5,0.92,5.2],"color":"#a7b0b6"},{"id":"slat-11","type":"box","size":[0.006,0.1,6],"position":[8.6,0.92,5.2],"color":"#a7b0b6"},{"id":"slat-12","type":"box","size":[0.006,0.1,6],"position":[8.7,0.92,5.2],"color":"#a7b0b6"},{"id":"slat-13","type":"box","size":[0.006,0.1,6],"position":[8.8,0.92,5.2],"color":"#a7b0b6"},{"id":"slat-14","type":"box","size":[0.006,0.1,6],"position":[8.9,0.92,5.2],"color":"#a7b0b6"},{"id":"slat-15","type":"box","size":[0.006,0.1,6],"position":[9,0.92,5.2],"color":"#a7b0b6"},{"id":"slat-16","type":"box","size":[0.006,0.1,6],"position":[9.1,0.92,5.2],"color":"#a7b0b6"},{"id":"slat-17","type":"box","size":[0.006,0.1,6],"position":[9.2,0.92,5.2],"color":"#a7b0b6"},{"id":"slat-18","type":"box","size":[0.006,0.1,6],"position":[9.3,0.92,5.2],"color":"#a7b0b6"},{"id":"slat-19","type":"box","size":[0.006,0.1,6],"position":[9.4,0.92,5.2],"color":"#a7b0b6"},{"id":"rail-a","type":"box","size":[2.6,0.1,0.1],"position":[8.5,1.02,1.97],"color":"#e5a96b"},{"id":"rail-b","type":"box","size":[2.6,0.1,0.1],"position":[8.5,1.02,8.43],"color":"#e5a96b"},{"id":"gantry-bridge","type":"box","size":[0.18,0.22,6.66],"position":[8,1.32,5.2],"color":"#e5a96b"},{"id":"gantry-end-a","type":"box","size":[0.22,0.3,0.12],"position":[8,1.17,1.97],"color":"#e5a96b"},{"id":"gantry-end-b","type":"box","size":[0.22,0.3,0.12],"position":[8,1.17,8.43],"color":"#e5a96b"},{"id":"z-carriage","type":"box","size":[0.16,0.3,0.14],"position":[8.17,1.27,6.2],"color":"#3d4b55"},{"id":"plasma-torch","type":"cylinder","size":[0.025,0.28],"position":[8.17,1.04,6.2],"color":"#d0d4d8"},{"id":"electrical-cabinet","type":"box","size":[0.6,1.2,0.3],"position":[0.5,1.1,0.15],"color":"#7a8a96"},{"id":"plasma-source","type":"box","size":[0.8,1,0.45],"position":[1.4,0.5,0.45],"color":"#c0392b"},{"id":"compressor-tank","type":"cylinder","size":[0.35,1.8],"position":[2.3,0.4,0.45],"color":"#5e9bb5","rotation":[0,0,1.5707963267948966]},{"id":"air-dryer","type":"box","size":[0.4,0.6,0.35],"position":[3,0.3,0.45],"color":"#5e9bb5"},{"id":"cord-supply","type":"cylinder","size":[0.012,0.9],"position":[0.95,0.012,0.45],"color":"#c0392b","rotation":[0,0,1.5707963267948966]},{"id":"cord-torch","type":"cylinder","size":[0.012,8.542],"position":[4.95,0.012,2.825],"color":"#c0392b","rotation":[1.5707963267948966,0,-0.9811703480500062]},{"id":"cable-ramp","type":"box","size":[0.6,0.04,0.25],"position":[4.95,0.02,2.825],"color":"#7a8a96"},{"id":"extraction-duct","type":"cylinder","size":[0.22,4.6],"position":[10.05,2.3,5.2],"color":"#9aa5ad"},{"id":"extraction-fan","type":"box","size":[0.5,0.5,0.5],"position":[10.05,4.6,5.2],"color":"#9aa5ad"},{"id":"control-desk","type":"box","size":[1,0.75,0.6],"position":[6.55,0.375,8.85],"color":"#9c7a54"},{"id":"finishing-bench","type":"box","size":[2,0.9,0.8],"position":[14.7,0.45,9.4],"color":"#9c7a54"},{"id":"material-rack","type":"box","size":[4,2.4,0.6],"position":[13.7,1.2,0.4],"color":"#6d6d6d"},{"id":"crane-runway-a","type":"box","size":[15,0.25,0.2],"position":[8,4.4,1],"color":"#e5a96b"},{"id":"crane-runway-b","type":"box","size":[15,0.25,0.2],"position":[8,4.4,9],"color":"#e5a96b"},{"id":"crane-bridge","type":"box","size":[0.3,0.35,8],"position":[6.85,4.55,5],"color":"#e5a96b"},{"id":"pipe-bench","type":"box","size":[4,0.9,1],"position":[13.4,0.45,5],"color":"#9c7a54"},{"id":"pressure-pipe","type":"cylinder","size":[0.08,3.6],"position":[13.4,1,5],"color":"#5e9bb5","rotation":[0,0,1.5707963267948966]},{"id":"hydroculture-rack","type":"box","size":[2,2,0.6],"position":[14.6,1,7.8],"color":"#3d4b55"},{"id":"hydroculture-plants","type":"box","size":[1.9,0.25,0.5],"position":[14.6,1.6,7.8],"color":"#4f8a3c"}]}
```

| Need | Planning value |
| --- | --- |
| Convex hull (room) | 16,0 × 10,0 m floor, 5,0 m free height: 160 m², 800 m³ |
| Cutting area | 2,00 × 6,00 m |
| Water pan | 2,30 × 6,30 m, rim 0,90 m above the floor, about 1 449 l at 100 mm |
| Plasma source | 125 A air plasma, clean cut about 32 mm mild steel, severance 50 mm |
| Electrical supply | 400 V 3-phase 63 A; about 26 kVA with the compressor and extraction |
| Compressed air | about 265 l/min at 6 bar, dried and oil-free |
| Fume extraction | about 10 800 m³/h, ducted outside through a spark trap |
| Waste water | pan drain valve to a channel and a trapped floor drain with an oil and metal-sludge separator; about 500 kg sludge a year at one shift |

## Comparing the alternatives

| | A Garage cell | B Workshop | C Production hall |
| --- | --- | --- | --- |
| Audience | Retail and summer-house goods | Industrial jobbing and repair | Domain parts for pipe, plastics and hydroculture lines |
| Typical work | House numbers, signs, fire pits, garden and boat fittings | Brackets, base plates, machine guards, batches for local industry | Flanges, pipe supports, rack frames, crane-handled plate |
| Build (DIY gantry, used source) | about 35 000–60 000 SEK | about 90 000–160 000 SEK | about 300 000–600 000 SEK |
| Space cost | own garage | rented unit | industrial lease |
| Supply upgrade | often none | 25 A three-phase outlet | 63 A feed, permit for drainage |

## Breaking even fast: 10 000 SEK within 6 months

A complete cutter costs more than 10 000 SEK. The fast path is to recover the
first 10 000 SEK of spend, and to fund the build in stages, with products that
need almost no inventory and sell to people within a short drive of Aröd on
Tjörn and its restaurant-dense harbours.

| Product | Material per piece | Price | Pieces to reach 10 000 SEK margin |
| --- | --- | --- | --- |
| House numbers and name plates, corten or black steel | about 60 SEK | 450–700 SEK | 20–25 |
| Restaurant menu holders, table-number stands, shelf brackets | about 40 SEK | 250–400 SEK | 35–45 |
| Fire pits and grill grates for terraces | about 400 SEK | 1 800–2 500 SEK | 7–8 |
| Hydroculture herb-wall frames for restaurant kitchens | about 350 SEK | 1 500–2 200 SEK | 8–10 |
| Pipe supports and flange blanks for local installers | about 80 SEK | 250–500 SEK in batches | 40–60 |

Start by outsourcing the first cuts (local laser and plasma job shops cut from
DXF), sell the designs, then move the work in-house once orders repeat. Six
months covers one summer season, when the harbours' restaurants and summer
houses buy. Prices are assumptions to test with real quotes, not market data.

## Ecology and economy

- Water-table cutting traps most fumes and dross; the sludge is metal waste for
  recycling, never the drain.
- Steel parts that replace petroleum-based ones (plastic brackets, single-use
  displays) last longer and are recyclable at end of life.
- Hydroculture racks and pressure-pipe parts serve local food growing and water
  infrastructure, where a small shop can be a fast, nearby supplier.
