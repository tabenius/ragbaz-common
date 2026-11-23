# ragbaz-common

Shared, dependency-light components for RAGBAZ Cloudflare Workers. One
implementation, several products: the museum, the gifts/artifacts worker, and
future sites should not each grow their own login, pseudonym rules or abuse
gate.

Read `AGENTS.md` first, then `PROVENANCE.md` for what was extracted from where.

## Why this exists

Fragment is an isolated draft under [`packages/fragment`](packages/fragment/README.md).
Its JS/Rust capability evaluators refuse unknown targets; the offline studio
namespaces graph IDs and refuses invalid UTF-8 imports without replacing the model.
Build and validate it separately from this package's identity and Markdoc runtime.

Mouseion (and before it Elias.Venn / survivors.se) already solved the hard parts
of pseudonymous identity: passkey-only authentication, opaque WebAuthn user
handles, session tokens stored only as SHA-256 hashes, recovery codes, and a
route-level abuse gate whose bucket keys never derive from caller input. That
code is a proven design, but it lives inside one product and assumes one schema.

This package keeps those decisions and removes the coupling. It also adds the
capabilities the gifts platform needs and Mouseion deliberately does not have:
anonymous accounts verified by email, Cloudflare Turnstile for human
verification, and short-lived temporary sessions.

## What is here

Schemas shared across RAGBAZ projects live in [`schemas/`](schemas/README.md), starting with the
`ragbaz.component.json` manifest schema (0.2.0).

The transport-neutral [collection-view contract](docs/COLLECTION-VIEW.md)
keeps source IDs/names, factories, artifacts and optional storage/production/
compute capabilities distinct across concrete, aggregate and virtual views.
It is our internal village model, not mandatory UI vocabulary or a new
authorization/identity system.

Optional [gift projections](docs/GIFTS.md) carry sender signatures, recipient
public keys and text or artifact references, including HITL invitations. Email,
Telegram and Discord are planned stream-delivery adapters, not implemented
transports or additional approval authority.


| Module | Purpose |
|---|---|
| `crypto.js` | WebCrypto helpers: base64url, random ids, SHA-256/HMAC, session tokens, recovery codes, AES-GCM secrets |
| `handles.js` | Pseudonym handle rules, with per-deployment reserved names |
| `webauthn.js` | Registration/authentication ceremonies via `@simplewebauthn/server` |
| `turnstile.js` | Server-side Turnstile verification with explicit fail-closed policy |
| `email-code.js` | Email verification codes: hashed at rest, single use, attempt-capped |
| `sessions.js` | Session minting, cookie policy, resolution, temporary-session grants |
| `abuse-gate.js` | Bounded bodies, route-level circuit breakers, per-ticket attempt ceilings |
| `identity.js` | `createIdentity(config)` — the facade a product wires into its Worker |
| `schema.sql` | The database a product applies to its own D1 database |

Every module is parameterised. Nothing in `src/` imports a product's config,
reads a hard-coded origin, or assumes a table prefix.

### Reusable Markdoc document surface

Opt-in [visualization profiles](docs/VISUALIZATIONS.md) accept Mermaid/PlantUML
source and restricted Cytoscape/Chart.js/Vega-Lite/Plotly JSON. The standalone
reader now bundles pinned Chart.js and Cytoscape.js adapters for its data profiles,
while the Markdoc core remains library-free. Every visualization still emits a
script-free static SVG, an exact table and its source before a host-owned adapter
may mount; print keeps the static SVG. Vega-Lite and Plotly remain static, and
Mermaid/PlantUML remain inert source. The separate
`@ragbaz/common/content/visualizations` API exposes the bounded parser, SVG
projection and escaped HTML. No remote renderer or authored JavaScript is enabled.
See the [publication-library direction](docs/ARTIFACT-LIBRARY-DIRECTION.md) for the
proposed multi-human/agent and online/mesh architecture; no sharing service exists yet.

`@ragbaz/common/content/markdoc-ragbaz` adds an official-AST, data-only document
renderer with versioned YAML/JSON metadata, lazy declarative dialect/theme
registries, visible refusals and safe source previews. Existing content APIs
are unchanged. Product paper layout and browser adapters live outside `src/`.
The installed meta-document builder gives each no-document template an ordinary
link to its matching Pieces writing entrance; loading a source replaces it.

```sh
npm ci
npm run markdoc-ragbaz -- --input paper.md --output paper.html
```

For plan-generation checks, add `--strict --report build-report.json`. Strict mode
fails on renderer diagnostics (for example a missing source or unsupported tag)
before writing HTML, retaining any existing output. Without it, the existing
partial rendering with visible refusals remains available. The Node
`buildStandalone()` adapter accepts the same `strict` and `report` options.
The deterministic `ragbaz.build-report/1` JSON records clean/diagnostic status,
headings, used dialects, source/render/runtime hashes and exact UTF-8 HTML size/hash.
On a strict diagnostic failure the report describes the **rejected candidate**,
not the retained HTML file; the thrown `BuildValidationError` also carries it as
`error.report`. Parse/transport failures remain errors and do not produce a new
report; always check the process exit status rather than trusting an old report.
Reports contain authored heading/diagnostic text; they are build artifacts, not
an assurance of correctness, independent review or permission to publish.
Output/report paths may not alias the source, supplied config/mapping or each
other (including existing symlinks and hard links).

Document tools → **Document checks** shows diagnostics and the active Markdown's
SHA-256, independently of the embedded package's render identity. **Inspect
current Markdown** displays inert source text without fetching linked resources.
Local files must be valid UTF-8; invalid bytes leave the current document intact.
Digests preserve UTF-8 BOM and CRLF bytes rather than silently normalizing them.

The single HTML embeds its runtime, styles and source; open it directly offline
or serve the same built bytes through local HTTP/Worker assets. No source
network fetching occurs during ordinary builds. See
[`docs/MARKDOC-RAGBAZ.md`](docs/MARKDOC-RAGBAZ.md) for exact tag attributes,
frontmatter, host configuration, optional snapshots, transport limits and APIs.
This is a document reader, not production witness logic or runtime attestation.

Standalone assembly is also available through the runtime-neutral `./standalone`
export (`buildStandaloneBytes`). The Node script's `prepareStandaloneAssets()`
performs esbuild bundling and the existing license gates **at build time**, returning
`ragbaz.standalone-assets/1`. A trusted host can freeze/package those assets and run
the same assembly in Node, a browser or Workers without filesystem/subprocess/
esbuild imports. Source is bounded UTF-8 bytes; config/assets/loaders are host-owned,
never taken from document/request JSON. Network and snapshot loaders remain explicit
trusted seams. The filesystem CLI is an adapter around this same implementation,
not a second renderer; all five existing outputs remain byte-identical.
`buildMetaDocument({policy})` also accepts a trusted build-host network policy;
for example `{origins:[]}` prevents authored replacement documents from fetching
remote registry resources in a local-only editor. Defaults remain unchanged.
The reading room defaults to the paper alone: an auto-hiding hamburger bar opens
the opt-in document tools, contents, integrity/version details and credits. File
drop is disabled until enabled there; keyboard focus and touch can reveal the bar.
The hamburger is on the right; a separate ornamental left-edge handle reveals
contents. Numbered citations show bibliography cards in the margin (laptop+) or
as tooltips. Expandable truthful author credits and manuscript dates link to
editorial revisions; publication requires explicit paired review signals.
First-mention entity notes explain project roles; meaningful links keep their
labels and classified revision details live in reference cards. Explicit
`DOI:`, `PMID:`, `PMCID:` and `arXiv:` identifiers in prose become ordinary
resolver links without fetching or asserting that the work exists. Named host-owned
SVG plates introduce WeftMark and Nostoi without enabling document-supplied SVG.
Reading shortcuts and equivalent menu actions support real fullscreen (`f`, Esc),
vertical flow (up/down, `k`/`j`), paper spreads (left/right, `h`/`Shift+L`),
Home/End/PageUp/PageDown and a toggleable legend (`l`). Typing and browser shortcuts
are not intercepted; desktop paper mode shows two pages, narrow screens one.
Its nominal sheets are A4 with narrower text measures, generous paper-colored
horizontal margins and no artificial vertical frame bands. Print requests A4.

`npm run markdoc-ragbaz-sci-tufte` builds a separate, content-neutral meta-document
package under `dist-meta/markdoc-ragbaz-sci-tufte/`. An optional `?document=` loads
permitted Markdown; `&sha256=` pins its exact bytes. The opening surface embeds
only its rendering contract, not the fleet witness manuscript or its authors.
It includes starter Markdown, inspected runtime/CSS/SVG assets, licenses and a
byte manifest. The independent `meta.ragbaz` repository owns the Worker/domain
deployment; common owns the renderer and builder, not the product route policy.

Document tools include **Appearance: System / Light / Dark**. System follows the
OS; explicit choices persist when browser storage permits, otherwise apply for
the session. Dark appearance includes source inspection, citations and trusted
SVG figures. Printing always uses light paper without changing the preference.

Print CSS resets horizontal spreads to continuous, single-column manuscript flow
with page margins and paragraph widows/orphans. Reading controls, open source
inspectors, raw Markdown and paper-grain/frame overlays are never printed; the
manuscript and bibliography remain. Link targets are not automatically appended
to prose. The browser owns paper size, headers/footers, pagination and Save as PDF;
use the host's print-piece action to avoid printing its editing workspace.

**Download static reading copy (.html)** exports the loaded manuscript with its
installed presentation and original ornaments. It is a script-free, self-contained
reading copy, not an editable reader bundle, source archive or attestation. Source
inspectors, runtime payloads, authoring authority and remote font links are omitted;
system fonts may wrap differently on another device. Manuscript names and links
remain. Print CSS is included. Export refuses neutral specimens, failed/partial
renders, external CSS dependencies and copies over 2 MiB.

Trusted same-origin hosts can call `window.ragbazReadingCopy({title?})` after a
successful load. It returns `{schema: 'ragbaz.reading-copy/v1', template, html}`
without downloading, uploading or changing storage. The host owns download and
publication consent. This DOM adapter is not an arbitrary-HTML sanitizer or proof
that someone else's exported HTML matches its claimed source/template.

The second installed template, **Heartfulness**, is a contemporary botanical
keepsake: pale yellow paper grain, bookish italic titles and original climbing
rose frames. Build it with `npm run markdoc-ragbaz-sci-tufte -- --template heartfulness`.
Its independent `/heartfulness/` package uses the same bounded document parameter,
source inspector and reader controls. Document tools add Plain / A little / Full
bloom and a separate grain toggle. Decoration is host-owned, not authored code;
the sci template does not acquire its styles or controls. Name and design remain
experimental; route/deployment ownership stays in meta.ragbaz.

CI runs the full offline suite with Chromium required (not silently skipped), and
builds the neutral publication package. Reader test files create portable isolated
temporary directories; set `RAGBAZ_TEST_TMP` to keep artifacts under a chosen root.

**Aether** adds three installed IDs: `aether-prima-materia`, `aether-sun-and-moon`,
and `aether-blackening`, packaged beneath `/aether/<variant>/`. These newly authored
symbolic studies share safe document loading, optional original SVG plates and
family navigation without forwarding document parameters. The host-curated
Typography option offers Google Fonts alongside offline system fonts; remote
loading is opt-in and limited to the installed theme pairing, not authored URLs.


Sources/assets may declare SHA-256 mismatch policy; relaxed handling is confined
to inert source inspection. Click-only GitHub path-revision and arXiv version
checks report separate dated observations without changing pinned references or
promoting authored supersession claims. See the linked contract for limits.
GitHub SHA inequality alone is not freshness: bounded ancestry comparison
distinguishes unchanged ancestor history, newer descendants and divergence.
This prototype is not production-ready or independently security-reviewed.

## Using it

```js
import { createIdentity } from './vendor/ragbaz-common/src/identity.js';

const identity = createIdentity({
  origin: 'https://gifts.ragbaz.cc',
  rpName: 'RAGBAZ Gifts',
  cookie: 'gifts_session',
  tablePrefix: 'gift',
  env: { DB: env.IDENTITY_DB, IDENTITY_HASH_KEY: env.IDENTITY_HASH_KEY },
  turnstile: env.TURNSTILE_SECRET_KEY ? { secretKey: env.TURNSTILE_SECRET_KEY } : null,
  emailSender: { send: (message) => env.MAIL.send(message) },
});

export default {
  fetch: (request, env, ctx) => identity.handle(request, env, ctx),
};
```

`identity.handle()` routes `/auth/*` and returns `null` for everything else, so
it composes with an existing router instead of replacing it. Apply
`schema.sql` to the database named by `env.DB`.

## Design commitments

These are inherited from Elias.Venn and are deliberate, not oversights:

- **Passkeys only for the passkey path.** No passwords, no TOTP. A shared secret
  typed into the same page is a downgrade when the first factor is already
  phishing-resistant hardware.
- **Security identity is separate from public identity.** Login binds to a random
  internal account id. The public handle lives on a pseudonym and is the only
  thing that appears publicly. A deployment may map accounts to pseudonyms; a
  public view must never join them.
- **Anonymous accounts are first class.** An account may have no public identity
  at all. "Unpublished" is a normal state, not an error state.
- **Email is a verification channel, not a public identity.** Verified addresses
  stay in the account's private record. They are never published, never used as
  a handle, and never exposed to another account.
- **Turnstile is additive and optional per deployment.** When configured, it is
  checked server-side and fails closed. It never replaces rate limiting.
- **Refusals stay distinct.** 400, 401, 403, 409, 413, 429 and 503 mean different
  things and must not collapse into a generic error.

## Checks

### Administrative widgets (opt-in)

`@ragbaz/common/widgets` is a TypeScript/React entry point for bundlers. Hosts
provide React, React DOM and React Flow 11; server-side identity modules do not
import them. `AdminWidget` renders standalone read-only cards; `WidgetCanvas`
adds a React Flow canvas with real parent/child nodes. Review and handoff cards
are supported alongside process, task, evidence and Change Set cards.

Wrap cards in `ViewConfigProvider` to select `detail` and visible `aspects`.
Node overrides replace only supplied fields; omitted fields inherit. For graph
nodes, `toFlowNodes` resolves inheritance explicitly because React Flow parentage
does not create React context ancestry. `inherited` describes view provenance,
not authority. Security configuration and reported attestations are not verified
security evidence.

Mock factories mark their records with `demo: true`. Containers propagate that
flag to descendants. A missing `WidgetNode` dataset displays a visibly marked
demo; an explicitly empty dataset stays empty and malformed JSON displays an
error, not simulated live success. The current Markdoc adapter is React-oriented;
registration with the shared static HTML Markdoc renderer is not yet implemented.
Dash now adopts the lighter presentation primitives, not the full graph cards.

Run `npm run demo` for the widget gallery (loopback-only Vite server).
`npm run demo:build` generates `dist-demo/` for static hosting. The gallery
includes all eight cards (including a human oversight hold), a runtime/inheritance example, an evidence-to-handoff
example, and a complete nested workflow using every widget type. Detail and
aspect controls update all inherited views; a linear alternative accompanies
the graph for keyboard and screen-reader use. All data is mock data.

Import `@ragbaz/common/widgets/styles.css` in the host application. Type labels,
symbols and accent bands distinguish planning, execution, proof, judgment and
continuity without relying on color alone. Graph cards have fixed bounding boxes
with scrollable bodies; container bounds are calculated recursively from their
children. Automatic layout currently owns positioning (manual `position` hints
are not applied).

Supply `snapshot.source`, `observedAt`, `updatedAt` and optionally
`statusObservedAt`, `revision`, `stale` and `staleAfterSeconds`. Capture time is
not entity update time; omitted timestamps say unknown. Staleness updates every
15 seconds, but does not fetch or refresh the source. Lifecycle `phase` and
`canReopen` are explicitly source-supplied; reopening capability is informational,
not a fake mutation button. Demonstration timestamps are fixed and labelled.

`WidgetInspectionProvider` accepts `mode="modal"` or `mode="tab"`, a host-owned
`renderDetail(record)` and optional `resolveHref(record)`. Tab mode requires a
safe `inspectHref` or resolved URL; absent links say unavailable. Modal mode uses
a native dialog (Escape, focus containment and return), with optional new-tab
navigation. The host owns routing and authorization. The demo persists its mode
preference locally and supplies read-only `?inspect=<id>` pages.

`WidgetExample` consistently frames a heading, description, example stage and
optional note. The gallery draws on Frog's read-only board projection, Dash's
decision-delivery UI, Rebekah's pushed observations and WeftMark's separation of
task intent, Change Sets, receipts and reviews. Oversight records keep decision
state separate from queued/sent/applied delivery. No product has been migrated
to the full administrative cards yet; Dash consumes the presentation primitives
while preserving its existing authorized controls. Common connects no write API.

All widget records may supply `links` for PRs, MRs, issues, commits, reviews or
other surfaces. These remain visible in terse views and full inspection, and
always open a new tab independently of the inspection preference. For example:

```ts
links: [{ kind: 'pull-request', surface: 'GitHub', label: '#42 · Evidence freshness',
  href: 'https://github.com/your-org/your-repo/pull/42', state: 'open' }]
```

The host supplies URLs and labels: GitHub, GitLab, Forgejo and internal surfaces
are not special-cased. Unsafe URLs are non-clickable. Optional state is labelled
as reported remote state; linking does not verify, synchronize or mutate a PR,
and remote merge state never replaces the local Change Set or review outcome.
Gallery URLs are illustrative placeholders, not verified remote records.

`StatusPill` and `WidgetIcon` provide a shared graphical vocabulary: coded values
use icon-and-color pills, not plain prose. PR states distinguish neutral draft,
green open, purple merged and red closed. Risk has an independent low/medium/high
scale (green/amber/red); priority high is amber and critical red. Labels and icons
remain visible so color is not the sole signal. Source labels distinguish local
record state from reported remote state. Reference navigation uses entity icons,
a surface/type caption, a literal title and an external-navigation icon.

`ActorLabel` adds a persona icon; `authorKind` on reviews and `assigneeKind` on tasks
may explicitly report `person`, `agent` or `unknown`. Missing actor kinds use a
generic persona, never inferred human identity. These are presentation hints,
not identity verification. The demo includes a visual-vocabulary example.

### Lightweight Dash adoption

Use `@ragbaz/common/widgets/primitives` with `widgets/primitives.css` when a host
already has specialized product cards. This entry has no graph runtime, mock
records or per-card timer. It adds `EvidenceSummary` (current receipts, not pass
rate), host-content `InspectionDialog`, `KeyboardLegend`, shared native/Vim
keyboard resolvers and steady visual/optional audio navigation feedback. React
Flow is an optional peer for these primitives, but remains required for canvases.
Dash's generated package delivery is documented in its `vendor/README.md` and
`docs/WIDGET-DESIGN-REVIEW.md`; do not fork the widget source in product repos.

`TerminalCommand` renders a literal command in a `<code>` element with an
icon-only `CopyButton` (`copyText` underneath). Commands are presentation data:
nothing executes, validates or parses them, and the copied value is exactly the
displayed string. Hosts supply an accessible `label` so the button says what it
copies. Dash uses this for native Frog record commands and RBQ examples.

`relativeDayLabel(date, now, zone, compact)` derives today/yesterday/tomorrow,
nearby weekday or distant date at render time. Models keep raw instants. Dash
supplies a single display clock and its account/alternate display zones; shared
standalone cards currently use UTC and their existing view timer. ISO UTC tooltips
remain exact. The web binding table drives legend/dispatch, suppresses printable
Vim shortcuts unless opted in, and supports spatial record movement without
stealing browser Tab or editable-field keys.

```sh
npm ci
npm test
```

The suite runs against real SQLite, not mocks. It covers ceremony replay,
handle enumeration, scope escalation attempts, email code reuse, temporary-session
expiry, Turnstile refusal paths, and the guarantee that no public projection can
leak an email address or an internal account id.

## Adoption status

| Product | State |
|---|---|
| Gifts/artifacts Worker (`ragbaz-cf-template/extensions/artifacts`) | consumes this package |
| Mouseion | still on its in-repo `src/identity/`; migration documented in `ADOPTION.md`, not yet performed |
| ragbaz-cf-template core | untouched; this package is additive |

Do not silently refactor a product to use this package. Read `ADOPTION.md`, then
do it as a reviewed change in that product's repository with its own task.

## Fragment artifact protocol (0.1 draft)

[packages/fragment](packages/fragment/README.md) adds an independently built Rust
and JavaScript artifact library: readable YAML/JSON, a shared schema, capability
constraints, exact themes, templates, keyboard/completion widgets, and an offline
A4 HTML preview. Its dependencies are isolated from the Worker identity package.
The sample renderer is in `packages/fragment/examples/`; no product page rendering
was added to the shared identity `src/`.

```sh
cd packages/fragment
npm ci
npm run build
# Open dist/fragment-preview.html
```

## Cooperation across sessions

[AGENTS.md](AGENTS.md) defines the shared cooperation protocol for the user and
participating agents: identity, authority, task ownership, attributable expressions,
evidence, disagreements, acknowledgements and handoffs. Task records use unique
paths under `coordination/`; Git and PRs provide asynchronous exchange. This is a
versioned convention, not a running messaging service or terminal connection.

## License

Copyright (C) 2026 Tobias Abenius.

ragbaz-common is free software: you can redistribute it and/or modify it under
the terms of the GNU General Public License as published by the Free Software
Foundation, either version 3 of the License, or (at your option) any later
version. It is distributed in the hope that it will be useful, but WITHOUT ANY
WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A
PARTICULAR PURPOSE. See [`LICENSE`](LICENSE) for the full text.

SPDX: `GPL-3.0-or-later`. Third-party components keep their own licenses; see
`PROVENANCE.md` and `packages/fragment/THIRD_PARTY_NOTICES.md`. Documents
rendered with the reader are not covered by this license.
