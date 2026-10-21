# ragbaz-common

Shared, dependency-light components for RAGBAZ Cloudflare Workers. One
implementation, several products: the museum, the gifts/artifacts worker, and
future sites should not each grow their own login, pseudonym rules or abuse
gate.

Read `AGENTS.md` first, then `PROVENANCE.md` for what was extracted from where.

## Why this exists

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

`@ragbaz/common/content/markdoc-ragbaz` adds an official-AST, data-only document
renderer with versioned YAML/JSON metadata, lazy declarative dialect/theme
registries, visible refusals and safe source previews. Existing content APIs
are unchanged. Product paper layout and browser adapters live outside `src/`.

```sh
npm ci
npm run markdoc-ragbaz -- --input paper.md --output paper.html
```

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
labels and classified revision details live in reference cards. Named host-owned
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
