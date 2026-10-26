# Markdoc visualization profiles — data-only baseline

Status: data-only ingestion, exact tables, and a deterministic script-free SVG
baseline are implemented. **No third-party graphical library adapters are installed
by this increment.** Mermaid and PlantUML remain inert source. Normal fences and
existing readers remain opt-in/unmodified in behavior. The runtime bundle changes
because it now carries the profile validator and static renderer.

```js
import { renderDocument } from '@ragbaz/common/content/markdoc-ragbaz';
const result = await renderDocument(markdown, {
  visualizations: { descriptions: { 1: 'Measured counts by category' } },
});
```

Descriptions are required, indexed from 1 in visualization-fence traversal order.
They are literal accessibility descriptions, not assertions of statistical validity.
The result adds `visualizations`, containing parsed records, original source,
format, description, rendering state and fallback rows. Missing descriptions and
invalid profiles become ordinary visible renderer diagnostics. Other fences remain
literal code. No instruction embedded in source changes host policy.

| Fence language | Accepted first profile | Current output |
|---|---|---|
| `mermaid` | Source, no init/actions/style directives | Description and inert source |
| `plantuml` | Source, no preprocessor/includes, explicit links or embedded resources | Description and inert source |
| `cytoscape` | JSON `{nodes:[{id,label}],edges:[{source,target,label?}]}` | Static circular SVG, exact nodes/relationships table and source |
| `chartjs` | JSON bar/line; inline labels and labelled numeric datasets | Static SVG bars/lines, exact values table and source |
| `vega-lite` | JSON bar/line/point; inline values, x/y field/type encodings | Static SVG marks, exact values table and source |
| `plotly` | JSON bar/scatter; named traces with categorical x and numeric y | Static SVG bars/lines/points, exact values table and source |

The SVG baseline uses fixed geometry, a fixed colour palette, inline shapes and text,
and no fonts, images, scripts, external URLs or animation. It is a deterministic
fallback graphic, not a rendering by Cytoscape.js, Chart.js, Vega-Lite or Plotly.
Its allowlisted attributes are rechecked during serialization and Markdoc rendering.
Long labels are truncated in the graphic but remain complete in the exact table.

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

## Next: library-backed adapters and authored fallbacks

1. Ship pinned, separately licensed host adapters for Cytoscape.js and Chart.js;
   adapt the validated profiles to library APIs, namespace graph IDs, turn off
   animation by default, and retain the static SVG and exact tables for print,
   offline use and nonvisual access.
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
5. Record source/spec, renderer, library version, font and output hashes; make
   library unavailability visible without erasing the static SVG, source or tables.
   Require explicit author-provided static fallbacks for final publication when
   graphics carry meaning absent from the text. Sandbox failures fail closed, not
   to eval.

Tests needed before a library-backed release: real library execution in offline
Chromium, forbidden network probes, malicious SVG/HTML, parser bombs, cancellation,
stale-render races, keyboard access, reduced motion, all-template print and
deterministic build output. CLI/package activation and a graphical editor are
deliberately not claimed here.
