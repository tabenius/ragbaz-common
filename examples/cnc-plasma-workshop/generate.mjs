// Generate the CNC plasma workshop study: three workshop alternatives as
// ragbaz.geometry/1 `cad-model` documents, plus their infrastructure tables,
// assembled into one Pieces/Markdoc document.
//
//   node examples/cnc-plasma-workshop/generate.mjs
//
// Units are metres, Y is up, the floor is y = 0 and the room's origin corner
// is at x = 0, z = 0. Every dimension below is a planning assumption for a
// simulation, not an engineering drawing or a safety approval.
import { writeFile } from 'node:fs/promises';
import { validateGeometryDocument } from '../../src/content/geometry3d.js';

const C = {
  wall: '#c9c3b8', floor: '#8f8a80', steel: '#5f6b73', frame: '#3d4b55', water: '#3f7fb3',
  slat: '#a7b0b6', gantry: '#e5a96b', torch: '#d0d4d8', power: '#c0392b', cabinet: '#7a8a96',
  drain: '#2c3e50', air: '#5e9bb5', duct: '#9aa5ad', bench: '#9c7a54', rack: '#6d6d6d', plant: '#4f8a3c',
};
const r = n => Math.round(n * 1000) / 1000;
const box = (id, [w, h, d], [x, y, z], color, rotation) => ({ id, type: 'box', size: [r(w), r(h), r(d)], position: [r(x), r(y), r(z)], color, ...(rotation ? { rotation } : {}) });
// Cylinders follow the Y axis; a quarter turn about Z lays one along X.
const cyl = (id, radius, length, [x, y, z], color, rotation) => ({ id, type: 'cylinder', size: [r(radius), r(length)], position: [r(x), r(y), r(z)], color, ...(rotation ? { rotation } : {}) });
const ALONG_X = [0, 0, Math.PI / 2];
const ALONG_Z = [Math.PI / 2, 0, 0];

/**
 * One workshop. `room` is the convex hull [length x, height y, depth z]; the
 * cutting table's usable area is `cut` [x, z]; the water pan sits on a stand
 * with its rim at `rim` metres above the floor.
 */
function workshop(a) {
  const [L, H, D] = a.room;
  const [cx, cz] = a.cut;
  const pan = [cx + 0.3, 0.16, cz + 0.3]; // pan is larger than the cut area
  const tableX = a.tableAt[0], tableZ = a.tableAt[1]; // pan centre on the floor plan
  const standTop = a.rim - pan[1];
  const o = [];
  // Hull: floor slab and two walls, left open on the viewer's sides.
  o.push(box('floor', [L, 0.1, D], [L / 2, -0.05, D / 2], C.floor));
  o.push(box('wall-back', [L, H, 0.15], [L / 2, H / 2, -0.075], C.wall));
  o.push(box('wall-left', [0.15, H, D], [-0.075, H / 2, D / 2], C.wall));
  // Floor drainage: a channel under the table to a trapped floor drain.
  o.push(box('drain-channel', [pan[0] * 0.8, 0.02, 0.15], [tableX, 0.01, tableZ + pan[2] / 2 + 0.25], C.drain));
  o.push(cyl('floor-drain', 0.075, 0.03, [tableX + pan[0] * 0.4 + 0.1, 0.015, tableZ + pan[2] / 2 + 0.25], C.drain));
  o.push(cyl('pan-drain-valve', 0.03, standTop - 0.05, [tableX + pan[0] * 0.4, (standTop - 0.05) / 2 + 0.05, tableZ + pan[2] / 2 - 0.1], C.drain));
  // Stand: legs every ~1.5 m along each long side, a perimeter frame on top.
  const legs = Math.max(2, Math.ceil(pan[0] / 1.5) + 1);
  for (let i = 0; i < legs; i++) {
    const x = tableX - pan[0] / 2 + 0.05 + i * (pan[0] - 0.1) / (legs - 1);
    for (const [side, z] of [['a', tableZ - pan[2] / 2 + 0.05], ['b', tableZ + pan[2] / 2 - 0.05]]) {
      o.push(box(`leg-${i}${side}`, [0.08, standTop, 0.08], [x, standTop / 2, z], C.frame));
    }
  }
  o.push(box('stand-frame', [pan[0], 0.08, pan[2]], [tableX, standTop - 0.04, tableZ], C.frame));
  // The water pan, its water surface and the replaceable slats.
  o.push(box('water-pan', pan, [tableX, standTop + pan[1] / 2, tableZ], C.steel));
  o.push(box('water-surface', [pan[0] - 0.04, 0.01, pan[2] - 0.04], [tableX, a.rim - 0.03, tableZ], C.water));
  const slats = Math.round(cx / 0.1);
  for (let i = 0; i < Math.min(slats, 30); i += Math.max(1, Math.floor(slats / 12))) {
    o.push(box(`slat-${i}`, [0.006, 0.1, cz], [tableX - cx / 2 + i * 0.1, a.rim + 0.02, tableZ], C.slat));
  }
  // Gantry: two Y rails along X, a bridge, a Z carriage and the torch.
  const railY = a.rim + 0.12;
  for (const [side, z] of [['a', tableZ - pan[2] / 2 - 0.08], ['b', tableZ + pan[2] / 2 + 0.08]]) {
    o.push(box(`rail-${side}`, [pan[0] + 0.3, 0.1, 0.1], [tableX, railY, z], C.gantry));
  }
  const bridgeX = tableX - cx / 4;
  o.push(box('gantry-bridge', [0.18, 0.22, pan[2] + 0.36], [bridgeX, railY + 0.3, tableZ], C.gantry));
  for (const [side, z] of [['a', tableZ - pan[2] / 2 - 0.08], ['b', tableZ + pan[2] / 2 + 0.08]]) {
    o.push(box(`gantry-end-${side}`, [0.22, 0.3, 0.12], [bridgeX, railY + 0.15, z], C.gantry));
  }
  o.push(box('z-carriage', [0.16, 0.3, 0.14], [bridgeX + 0.17, railY + 0.25, tableZ + cz / 6], C.frame));
  o.push(cyl('plasma-torch', 0.025, 0.28, [bridgeX + 0.17, railY + 0.02, tableZ + cz / 6], C.torch));
  // Services along the back wall: supply, plasma source, compressor, dryer.
  const svcZ = 0.45;
  o.push(box('electrical-cabinet', [0.6, 1.2, 0.3], [0.5, 1.1, 0.15], C.cabinet));
  o.push(box('plasma-source', a.source, [1.4, a.source[1] / 2, svcZ], C.power));
  o.push(cyl('compressor-tank', a.compressor[0], a.compressor[1], [2.3, a.compressor[0] + 0.05, svcZ], C.air, ALONG_X));
  o.push(box('air-dryer', [0.4, 0.6, 0.35], [3.0, 0.3, svcZ], C.air));
  // Power cords on the floor: cabinet → plasma source → gantry drag chain.
  const sourceToTable = Math.hypot(tableX - 1.4, tableZ - svcZ);
  o.push(cyl('cord-supply', 0.012, 0.9, [0.95, 0.012, svcZ], C.power, ALONG_X));
  o.push(cyl('cord-torch', 0.012, sourceToTable, [(1.4 + tableX) / 2, 0.012, (svcZ + tableZ) / 2], C.power,
    [Math.PI / 2, 0, Math.atan2(tableZ - svcZ, tableX - 1.4) - Math.PI / 2]));
  o.push(box('cable-ramp', [0.6, 0.04, 0.25], [(1.4 + tableX) / 2, 0.02, (svcZ + tableZ) / 2], C.cabinet));
  // Fume extraction from under the table to the outside wall.
  o.push(cyl('extraction-duct', a.duct, H - 0.4, [tableX + pan[0] / 2 + 0.4, (H - 0.4) / 2, tableZ], C.duct));
  o.push(box('extraction-fan', [0.5, 0.5, 0.5], [tableX + pan[0] / 2 + 0.4, H - 0.4, tableZ], C.duct));
  // Control desk, finishing bench and material storage.
  o.push(box('control-desk', [1.0, 0.75, 0.6], [tableX - pan[0] / 2 - 0.8, 0.375, tableZ + pan[2] / 2 + 0.5], C.bench));
  o.push(box('finishing-bench', [2.0, 0.9, 0.8], [L - 1.3, 0.45, D - 0.6], C.bench));
  o.push(box('material-rack', [a.rack[0], a.rack[1], 0.6], [L - a.rack[0] / 2 - 0.3, a.rack[1] / 2, 0.4], C.rack));
  o.push(...(a.extra?.({ L, H, D, tableX, tableZ, pan, box, cyl, C }) ?? []));
  return { version: 'ragbaz.geometry/1', profile: 'cad-model', units: 'm', objects: o };
}

const alternatives = [
  {
    key: 'A', title: 'Garage cell — retail goods',
    room: [6.0, 2.7, 4.5], cut: [1.25, 1.25], tableAt: [3.2, 2.5], rim: 0.85,
    source: [0.5, 0.45, 0.25], compressor: [0.2, 0.9], duct: 0.1, rack: [1.4, 1.6],
    plasma: { amps: 45, pierceMm: 12, cutMm: 16, supply: '230 V 1-phase 32 A or 400 V 3-phase 16 A', air: 170, kva: 7 },
  },
  {
    key: 'B', title: 'Workshop — industrial jobbing',
    room: [10.0, 3.6, 7.0], cut: [1.5, 3.0], tableAt: [5.6, 3.8], rim: 0.9,
    source: [0.7, 0.75, 0.35], compressor: [0.28, 1.4], duct: 0.16, rack: [2.6, 2.0],
    plasma: { amps: 85, pierceMm: 20, cutMm: 32, supply: '400 V 3-phase 25 A', air: 190, kva: 16 },
  },
  {
    key: 'C', title: 'Production hall — pipe, flange and hydroculture parts',
    room: [16.0, 5.0, 10.0], cut: [2.0, 6.0], tableAt: [8.5, 5.2], rim: 0.9,
    source: [0.8, 1.0, 0.45], compressor: [0.35, 1.8], duct: 0.22, rack: [4.0, 2.4],
    plasma: { amps: 125, pierceMm: 32, cutMm: 50, supply: '400 V 3-phase 63 A', air: 265, kva: 26 },
    // An overhead runway for plate handling and an assembly line for pipe
    // supports and hydroculture racks.
    extra: ({ L, H, D, tableX, tableZ, pan, box, cyl, C }) => [
      box('crane-runway-a', [L - 1, 0.25, 0.2], [L / 2, H - 0.6, 1.0], C.gantry),
      box('crane-runway-b', [L - 1, 0.25, 0.2], [L / 2, H - 0.6, D - 1.0], C.gantry),
      box('crane-bridge', [0.3, 0.35, D - 2.0], [tableX - pan[0] / 2 - 0.5, H - 0.45, D / 2], C.gantry),
      box('pipe-bench', [4.0, 0.9, 1.0], [L - 2.6, 0.45, D / 2], C.bench),
      cyl('pressure-pipe', 0.08, 3.6, [L - 2.6, 1.0, D / 2], C.air, [0, 0, Math.PI / 2]),
      box('hydroculture-rack', [2.0, 2.0, 0.6], [L - 1.4, 1.0, D - 2.2], C.frame),
      box('hydroculture-plants', [1.9, 0.25, 0.5], [L - 1.4, 1.6, D - 2.2], C.plant),
    ],
  },
];

const fmt = (n, d = 1) => n.toLocaleString('sv-SE', { minimumFractionDigits: d, maximumFractionDigits: d });
function infrastructure(a) {
  const [L, H, D] = a.room;
  const pan = [a.cut[0] + 0.3, a.cut[1] + 0.3];
  const waterL = pan[0] * pan[1] * 0.1 * 1000; // ~100 mm water depth
  const sludgeKgYear = Math.round(a.plasma.amps * 4); // planning figure, see claims
  return { L, H, D, floor: L * D, volume: L * H * D, pan, waterL, sludgeKgYear,
    extraction: Math.round(a.cut[0] * a.cut[1] * 900), // m³/h downdraft at ~0.25 m/s
  };
}

const sections = alternatives.map(a => {
  const doc = workshop(a);
  validateGeometryDocument(doc);
  const i = infrastructure(a);
  return `## Alternative ${a.key}: ${a.title}

\`\`\`cad-model
${JSON.stringify(doc)}
\`\`\`

| Need | Planning value |
| --- | --- |
| Convex hull (room) | ${fmt(i.L)} × ${fmt(i.D)} m floor, ${fmt(i.H)} m free height: ${fmt(i.floor, 0)} m², ${fmt(i.volume, 0)} m³ |
| Cutting area | ${fmt(a.cut[0], 2)} × ${fmt(a.cut[1], 2)} m |
| Water pan | ${fmt(i.pan[0], 2)} × ${fmt(i.pan[1], 2)} m, rim ${fmt(a.rim, 2)} m above the floor, about ${fmt(i.waterL, 0)} l at 100 mm |
| Plasma source | ${a.plasma.amps} A air plasma, clean cut about ${a.plasma.pierceMm} mm mild steel, severance ${a.plasma.cutMm} mm |
| Electrical supply | ${a.plasma.supply}; about ${a.plasma.kva} kVA with the compressor and extraction |
| Compressed air | about ${a.plasma.air} l/min at 6 bar, dried and oil-free |
| Fume extraction | about ${fmt(i.extraction, 0)} m³/h, ducted outside through a spark trap |
| Waste water | pan drain valve to a channel and a trapped floor drain with an oil and metal-sludge separator; about ${i.sludgeKgYear} kg sludge a year at one shift |
`;
}).join('\n');

const document = `---
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
drawings are declarative \`ragbaz.geometry/1\` \`cad-model\` documents: primitives
with exact dimensions in metres, not a precision CAD kernel. Figures are
planning assumptions, not engineering, electrical or environmental approval.

Plasma cuts electrically conductive material only: steel, stainless and
aluminium. Plastics and pressure pipes in PE or PVC need a router, saw or
laser; plasma makes the steel parts around them (flanges, supports, brackets).

${sections}
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
`;

await writeFile(new URL('./cnc-plasma-workshop.md', import.meta.url), document);
console.log(`Wrote cnc-plasma-workshop.md with ${alternatives.length} validated alternatives.`);
