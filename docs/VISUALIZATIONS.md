# Markdoc visualization profiles — data, static SVG and installed adapters

Status: data-only ingestion, exact tables, a deterministic script-free SVG
baseline, and host-owned Chart.js/Cytoscape.js adapters are implemented. The
standalone reader bundles pinned Chart.js 4.6.1 and Cytoscape.js 3.34.4 for
`chartjs` and `cytoscape` fences when the host enables
`visualizations.interactive`. The Markdoc core in `src/` still imports neither
library; Vega-Lite and Plotly remain static, and Mermaid/PlantUML remain inert
source. Existing consumers that do not set `visualizations` keep literal fences.

```js
import { renderDocument } from '@ragbaz/common/content/markdoc-ragbaz';
const result = await renderDocument(markdown, {
  visualizations: {
    descriptions: { 1: 'Measured counts by category' },
    interactive: ['chartjs', 'cytoscape'],
  },
});
```

Descriptions are required, indexed from 1 in visualization-fence traversal order.
They may also be authored in the document preamble, which is how the reader gets a
description for an ordinary Markdown file:

```yaml
---
document:
  visualizations:
    descriptions:
      1: Measured counts by category
---
```

Host-supplied descriptions override document-supplied ones. Descriptions are
literal accessibility descriptions, not assertions of statistical validity. The
result adds `visualizations`, containing parsed records, original source, format,
description, rendering state and fallback rows. Missing descriptions and invalid
profiles become ordinary visible renderer diagnostics. Other fences remain literal
code. No instruction embedded in source changes host policy. Markdoc assigns a
document-unique SVG id per visualization fence; callers projecting several records
with `visualizationHTML` should pass a unique `id` option.

When an adapter is enabled, the renderer additionally emits an empty
`.visualization-interactive` host and an inert `<template>` containing the
original validated profile JSON. The reader re-parses that JSON before mounting;
the template is not executable and its text is escaped. If parsing or mounting
fails, the static SVG remains visible. Adapter canvases are hidden in print and
the static SVG is shown instead.

| Fence language | Accepted first profile | Current output |
|---|---|---|
| `mermaid` | Source, no init/actions/style directives | Description and inert source |
| `plantuml` | Source, no preprocessor/includes, explicit links or embedded resources | Description and inert source |
| `cytoscape` | JSON `{nodes:[{id,label}],edges:[{source,target,label?}]}` | Interactive Cytoscape.js canvas in the reader; static circular SVG, exact nodes/relationships table and source |
| `chartjs` | JSON bar/line; inline labels and labelled numeric datasets | Interactive Chart.js canvas in the reader; static SVG bars/lines, exact values table and source |
| `vega-lite` | JSON bar/line/point; inline values, x/y field/type encodings | Static SVG marks, exact values table and source |
| `plotly` | JSON bar/scatter; named traces with categorical x and numeric y | Static SVG bars/lines/points, exact values table and source |

The SVG baseline uses fixed geometry, a fixed colour palette, inline shapes and text,
and no fonts, images, scripts, external URLs or animation. It is a deterministic
fallback graphic, not a rendering by Cytoscape.js, Chart.js, Vega-Lite or Plotly.
Its allowlisted attributes are rechecked during serialization and Markdoc rendering.
Long labels are truncated in the graphic but remain complete in the exact table.

The installed adapters are deliberately narrower than the libraries' public APIs:

- Chart.js is limited to the already-validated bar/line data, with animation off,
  fixed colours and layout, no authored callbacks/plugins, and no HTML tooltips.
- Cytoscape.js maps node/edge ids to host-generated namespaced ids, uses a fixed
  style, a deterministic breadth-first layout, animation off, and no external
  images, stylesheets or network layout.
- Both adapters read only the re-parsed profile JSON. They do not receive raw
  Markdoc, URLs, callbacks or arbitrary library options.
- Adapter code and pinned licenses are part of the standalone bundle inventory;
  the core package export does not load either library.

Mermaid and PlantUML syntax is not compiled or verified in this increment; a clean
source-only profile is not proof that a future graphical renderer will accept it.

These intentionally restricted profiles are **not** arbitrary library configuration
compatibility. The graph profile is an interchange representation, not Cytoscape's
native `elements` configuration. Unsupported options fail rather than silently
changing interpretation. Source: at most 100 KB; depth 32; total values 20,000;
graphs: 300 nodes/1,000 edges; charts: 20 series/1,000 points per series.
Only JSON data is accepted: no callbacks, expressions, transforms, plugins,
network-backed data, remote images or runtime imports. HTML projection escapes
all text and revalidates forged records. Neither fallback projection nor a clean
build proves statistical methodology, provenance or publication approval.

## Implemented checks and remaining work

The Chart.js/Cytoscape.js increment is covered by offline Chromium tests for real
library execution, zero resource requests, no global library leakage, hostile
labels that remain text, exact tables/source, print fallback to static SVG, and
the existing parser/refusal tests. Adapter mount points are escaped and re-parsed;
graph ids are namespaced. Bundle license notices pin both libraries and their
transitive colour helper. Frozen standalone hashes change deliberately because the
reader bundle and render tuple now include the adapters and visualization config.

Remaining before calling this a complete graphics stack:

1. Add keyboard-oriented chart inspection beyond the exact table, and an automated
   reduced-motion check for both adapters. Canvas output is not byte-hashed; record
   library versions and input digests instead of claiming deterministic pixels.
2. Add Mermaid in a disposable worker or sandboxed opaque-origin frame, with
   strict configuration, disabled links, no network, bounded CPU/memory/output,
   timeouts and sanitized static output. Never insert unchecked returned SVG.
3. Render PlantUML locally in a build service with preprocessing/includes disabled
   and OS-level resource/network isolation. Never send private source to a public
   PlantUML endpoint by default. Pin renderer version, fonts and input digest.
4. Add Vega-Lite and Plotly adapters using only the reviewed profiles. Keep Vega
   expressions/transforms, Plotly callbacks and all external data disabled unless a
   later explicitly versioned profile can safely support them. Consider D3 and
   Observable Plot host adapters later; their general APIs are executable JS, not
   safe document inputs.
5. Make adapter unavailability visible without erasing the static SVG, source or
   tables, and require explicit author-provided static fallbacks for final
   publication when graphics carry meaning absent from the text. Fail closed, never
   to eval.

CLI/package activation and a graphical editor are deliberately not claimed here.
