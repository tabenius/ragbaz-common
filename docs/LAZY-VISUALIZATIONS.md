# Optional lazy visualization adapter for ESM hosts

Use `demo/markdoc-ragbaz/lazy-visualizations.js` in an **external development or production ESM host** that owns a normal code-split module build. The portable standalone Markdoc renderer deliberately keeps its frozen single HTML runtime and should not import separate scripts from an authored document.

```js
import {createLazyVisualizationHost} from './lazy-visualizations.js';
const host=createLazyVisualizationHost();
await host.mount(document.querySelector('#paper'));
// Before replacing the manuscript subtree:
await host.dispose(document.querySelector('#paper'));
```

The adapter is not requested for prose-only pages, and the same importer promise is reused for subsequent visualization mounts. Generation cancellation prevents asynchronous stale mounts after document replacement. The host must call `dispose` and await it before replacing a manuscript containing active renderers.

For an ESM code-split host, the dynamic import can become an asynchronously loaded chunk; this does **not** split Chart.js, Cytoscape and Three.js into independent chunks. Further library-level splitting needs separate, content-addressed assets and explicit offline, CSP, licensing and reproducibility validation before replacing the canonical single-file distribution.

No document-supplied module URLs are accepted. The loader is a host integration convenience, not a security boundary or a promise of improved performance without bundle measurements.
