# markdoc-ragbaz-sci-tufte

A content-neutral sci publication surface. The template is not a manuscript,
author, review decision, evidence source or publication authority.

## Open a document

Default mount: `/markdoc-ragbaz-sci-tufte/` (the slashless path should redirect
while preserving query parameters).

- No parameter: a neutral opening surface that links to the matching Pieces
  writing entrance (`?view=write&theme=markdoc-ragbaz-sci-tufte`); no witness
  manuscript is embedded.
- `?document=starter.md`: load the bundled starter through the hosting origin.
- `?document=<URL-encoded Markdown URL>`: load an explicit permitted URL.
- Add `&sha256=<64 hex digits>` to require those exact document bytes.
- Open local Markdown using the menu for offline use; sibling `file:` fetches
  are not assumed to work. The rendering contract is embedded for offline reading.

Same-origin HTTP(S) documents and the host's installed HTTPS allowlist are
permitted. The default external origin is `https://raw.githubusercontent.com`;
full-SHA GitHub blob links are structurally converted to raw URLs. CORS and
size/content-type/redirect rules apply. No query parameter can add an origin,
pass credentials, install code or create a server-side fetch proxy. An explicit
document parameter requests one client-side load; opening without it does not.
Errors are visible in the document area; no unrelated paper silently replaces
the requested document. External text remains untrusted document data.

## Companion assets

`starter.md`, the pinned `markdoc-ragbaz.md` rendering contract, `surface.json`,
`template.md`, `snapshots.json`, `manifest.json`, full `LICENSES.txt`, and
`assets/{reader.js,reader.css,weftmark.svg,nostoi.svg}` are useful inspection or
reuse assets. The standalone HTML already embeds its runtime/styles/contract;
these files do not need to execute separately. SVGs are host-authored examples,
not part of a loaded paper unless that paper explicitly selects their named plates.
No arbitrary authored SVG is enabled. Manifest hashes cover shipped file bytes,
not review approval, authorship or reproducibility of the whole deployment.

## Build and hosting

From the repository root: `npm run markdoc-ragbaz-sci-tufte` produces
`dist-meta/markdoc-ragbaz-sci-tufte/`. Serve `dist-meta` as the site root, not the
source checkout. A static host may serve the directory directly; the generic
Worker is an asset delegate, not a Markdown proxy.

The separate `meta.ragbaz` repository owns the Worker and Wrangler configuration;
it consumes this package rather than copying the renderer. Its configuration
proposes only the named URL-prefix route.
Before deployment, identify the account/zone owner, existing route or access
policy and the published-asset license. Do not replace the domain's other routes,
remove access controls, deploy an unreviewed contract as a fleet standard or
infer release approval from a successful build. No deployment runs during build.

`sci-tufte` describes the requested restrained, margin-aware layout; it does not
claim affiliation with or verbatim reproduction of another designer's work.
