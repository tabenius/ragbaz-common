# Fragment 0.1 — RAGBAZ artifact protocol and widgets

A draft protocol with a working Rust core, JavaScript core and widgets, and an
A4 HTML studio. A fragment can be an unfinished template or a bound document.
It carries intent, metadata, rendering constraints, exact theme tokens, content,
and relationships. The concrete sample document is deliberately secondary.

## Open and build

Open `dist/fragment-preview.html` directly in a browser; it has no runtime CDN,
font, API, or other network dependency. The source archive includes that build.
In a repository checkout, build it first:

```sh
npm ci
npm run build
npm test
cargo test
cargo build
npm run test:parity
npx playwright install chromium --only-shell
npm run test:browser
```

Dependencies are locked in `package-lock.json` and `Cargo.lock`. Tests operate
offline after installation; browser checks explicitly disable networking.

## What is implemented

- YAML ↔ JSON conversion with one shared JSON Schema; semantic AST with JSON pointers.
- Rust and JS validation: timestamp/timezone offset, duplicate IDs, dangling graph
  references, impossible color/orientation requirements, quiz correctness, bindings.
- Target-specific capability reports: ready, degraded, blocked; unknown is explicit.
- Named theme resolution with deterministic fallback and inspectable exact tokens.
- Reusable keyboard profile and accessible prefix completion with optional async API.
- Self-contained A4 preview: theme browser, stylesheet controls, editable model,
  import/export, HTML export, bindings, static print fallbacks, Cytoscape reverse side.
- Rust MiniJinja adapter for richer trusted author templates; portable interpolation
  is a smaller deliberately defined subset shared by JS and Rust.

## Libraries and CLI

```js
import {parse, assertValid, evaluate, exportModel} from '@ragbaz/fragment';
const fragment = assertValid(parse(yamlText));
const report = evaluate(fragment, {interaction: false, storage: false}, 'print');
const json = exportModel(fragment, 'json');
```

```rust
use ragbaz_fragment::{parse, validate, evaluate};
use serde_json::json;
let model = parse(source)?;
let errors = validate(&model);
// Do not evaluate or render until errors.is_empty().
let report = evaluate(&model, &json!({"interaction": false}), "print");
```

```sh
cargo run -- validate examples/draft.yaml
cargo run -- json examples/draft.yaml > draft.json
cargo run -- yaml examples/draft.json > draft.yaml
cargo run -- ast examples/draft.yaml > draft.ast.json
cargo run -- evaluate examples/draft.yaml environment.json print
cargo run -- bind examples/draft.yaml bindings.json
cargo run -- template examples/draft.yaml examples/summary.jinja
node scripts/cli.mjs json examples/draft.yaml
node scripts/cli.mjs evaluate examples/draft.yaml environment.json print
```

`bind` replaces the bindings map; it does not replace the source strings. This
preserves template intent. Rendering resolves `{{ name }}` at the text-node boundary.
Raw HTML is never accepted as a block. Library callers should also escape output
for their chosen target; `bindText`/`bind_text` returns data, not safe HTML.

## Keyboard convention — the user's standing preference

Always provide arrow keys **and h/j/k/l** for spatial/list navigation. Preserve
normal text editing while an input is focused. Escape exits a completion input,
then returns to navigation. L toggles the legend outside panels; lowercase l is
right while navigating a panel. P opens CSS print controls. T opens themes.
I opens the inspector. + / - zoom. Tab flips only on the focused artifact canvas;
Shift+Tab leaves the canvas; all controls retain ordinary Tab order.

The exported `keyboardProfile` takes actions and navigation callbacks; it has no
product routes or policy. The demo page renderer lives in `examples/`, not `src/`.

## Completion API adapter

```js
import {createCombobox, prefixApiProvider} from '@ragbaz/fragment/widgets';
const widget = createCombobox({
  input, list,
  provider: prefixApiProvider('/api/options'),
  onSelect: ({id}) => console.log(id),
  onError: error => showError(error.message),
});
// GET /api/options?prefix=gruv
// response: [{"id":"gruvbox-dark", "label":"Gruvbox dark"}]
// Call widget.destroy() when unmounting.
```

Providers receive an AbortSignal. Stale results cannot replace newer results;
requests are aborted as the prefix changes. No endpoint is contacted merely
because imported metadata mentions one. Hosts choose their authentication,
CORS policy, debouncing and endpoint. The built-in adapter omits credentials.

## Boundaries of this draft

The HTML is a preview and authoring tool, not access control. Disclosure marks do
not enforce an NDA or encrypt a file. A blocked screen report permits inspection,
clearly marked preview-only; a production renderer must refuse final delivery.
Both the Print button and browser-print stylesheet refuse unmet print requirements.
User-edited local HTML cannot be made tamper-proof.

A4 is expressed in physical CSS units, but long content flows to additional pages.
There is no automatic content fitting or constraint solver. Printer hardware,
headers, background settings and browser pagination can override author intent.
The printable reverse side is an exact relationship list, not a raster canvas.

The YAML/JSON round trip preserves values, not comments, ordering or whitespace.
AST is a semantic tree, not a source-preserving concrete syntax tree. The code
sample has basic line-based syntax coloring, not a language parser. Theme tokens
cover syntax, semantic information roles, figures and forms; advanced component
layout recipes and data-backed figure renderers remain future extensions.

No automatic LLM calls or patch execution occur. `additional` entries retain intent,
status and proposed operations for a host's explicit compile/review/validate cycle.
Rust/JS support matching tested cases, not a claim of total parser equivalence.

See [PROTOCOL.md](docs/PROTOCOL.md), [schema.json](schema.json), and the
[example](examples/draft.yaml) for the exact contract.
