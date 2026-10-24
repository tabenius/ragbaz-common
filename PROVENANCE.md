# Provenance

Where each piece came from, and what changed. Recorded so a future reader can
tell a deliberate divergence from an accident.

## Lineage

```
survivors.se / bereaved.dad (Elias.Venn)
  └─ src/identity/            passkeys, pseudonyms, recovery codes, abuse gate
       └─ Mouseion/src/identity/   adopted, without TOTP
            └─ ragbaz-common/src/  extracted, parameterised, extended
```

Mouseion's own documentation records the first step: identity "follows
Elias.Venn. Passkeys only (no passwords, no TOTP)", with migrations 0001, 0003,
0008 and 0009 of that project as the source. `tabenius/Elias.Venn` is not present
on this host; Mouseion is the reachable ancestor.

## File by file

### `src/crypto.js` — from Mouseion `src/identity/crypto.js`, unchanged in behaviour

WebCrypto helpers. No product coupling existed; none was introduced. `randomId`
prefixes are now supplied by callers rather than being product-specific.

### `src/handles.js` — from Mouseion `src/identity/handles.js`

The handle grammar is unchanged. Mouseion kept its reserved list in SQL
(`reserved_handles` seeded with `admin`, `p`, `zine` route names and so on).
Here the grammar is code and the reserved list is configuration, because the
gifts platform needs different names and a shared package cannot know either
product's routes.

### `src/webauthn.js` — from Mouseion `src/identity/webauthn.js`

Two changes:

- Mouseion imported `PRIMARY_ORIGIN` from its own `src/origins.js`. That
  coupling is replaced by an explicit `origin` parameter. Falling back to a
  caller-supplied origin silently would be a security bug: a misconfigured
  deployment would verify assertions against the wrong relying party.
- `rpName` is configuration, not the constant `'Mouseion'`.

Everything else — `attestationType: 'none'`, discoverable + user-verifying
credentials, `excludeCredentials`, 300 s timeouts, `requireUserVerification` —
is deliberately preserved. These are the choices that make the flow phishing
resistant.

### `src/sessions.js` — from Mouseion `src/identity/auth.js` (session half)

Preserved: opaque random tokens, only SHA-256 digests stored, `HttpOnly`,
`SameSite=Lax`, `Secure` when the origin is HTTPS, deterministic
oldest-pseudonym resolution, and the rule that an account's status gates the
session.

Added:

- **Temporary sessions.** Short-lived, explicitly scoped grants for a person who
  has not verified anything yet. They carry a `scope` list, expire quickly, and
  cannot perform account-level actions. This is what lets an anonymous visitor
  draft a gift without becoming an account.
- **Cookie name and TTL as configuration**, because several deployments share
  origins' cousins and must not collide.

### `src/abuse-gate.js` — from Mouseion `src/identity/auth-gated.js`

Preserved exactly in intent: bounded bodies before parsing, route-level circuit
breakers keyed by `sha256(route)` only, a lifetime per-ticket verification
ceiling, and challenge pruning that only runs behind an issuance breaker.

Changes: the route set and limits are configuration; the table prefix is
configuration. The comment explaining *why* `register/available` is rate limited
(an enumeration oracle) is preserved because the reasoning matters more than the
number.

### `src/turnstile.js` — new

Mouseion has no Turnstile. Its `auth-gated.js` relies on circuit breakers alone,
and the template documents Turnstile CSP origins for other consumers without
implementing verification. This module posts to Cloudflare's siteverify endpoint
server-side, and fails closed when a secret is configured but the call cannot be
completed. There is no client-side-only path: a token without a server check is
not a check.

### `src/email-code.js` — new

Mouseion has no email verification; its only mail path is inbound encrypted
curator correspondence. The gifts platform needs to know that a person controls
an address without demanding a real name, so this implements the standard
shape: a short numeric code, stored only as a hash, single use, attempt capped,
and rate limited. It never publishes the address.

### `src/identity.js` — new facade

No precedent; it is the composition point the earlier code lacked. Mouseion wires
`handleAuth()` into its own router with its own table names. That is correct
there and unusable elsewhere, so `createIdentity()` returns a configured handler
that returns `null` for paths it does not own.

### `schema.sql` — from Mouseion `migrations/0001_identity.sql`, restructured

Preserved: the account/pseudonym split, opaque `webauthn_user_handle`, hashed
sessions, append-only `audit_events` triggers, and the absence of a TOTP table.

Added: `tablePrefix` is applied by the product's migration, email bindings,
temporary-session scopes, and verification-attempt counters. Reserved handles are
seeded by configuration rather than by a hard-coded list.

Deliberately **not** carried over: Mouseion's `real_names` table. Binding a real
name to an account is that product's editorial model and its invariant 4 forbids
mixing it with pseudonyms. A shared package must not ship a table that invites
the mistake.

## Known divergence

Mouseion remains on its in-repo copy until someone performs the migration in
that repository. Until then there are two implementations of these rules, which
`AGENTS.md` invariant 2 treats as a tracked debt. `ADOPTION.md` describes the
removal. Do not let that state persist silently: if Mouseion changes an identity
rule, decide deliberately whether this package follows.

## Changelog

### 2026-10-24 — opt-in visualization profiles and library direction

Add bounded, non-executable visualization profiles, exposed separately and through
opt-in Markdoc fences. Mermaid/PlantUML remain source-only; Cytoscape, Chart.js,
Vega-Lite and Plotly use restricted inline-data profiles with exact table fallbacks.
No graphical library execution, external rendering endpoint or publication service
is introduced. Existing default fence behavior remains literal. Frozen standalone
hashes change deliberately because the browser runtime includes the new validator.
Record a staged, non-binding multi-human/agent online/mesh publication architecture.

### 2026-10-24 — Fragment integration hardening

Integrate the original Fragment draft alongside the preserved Markdoc renderer
history. Capability observations no longer inherit JavaScript properties; unknown
evaluation targets now fail closed in both JS and Rust (an intentional refusal
change). Namespace studio graph IDs independently of authored node IDs and retain
the current model when local imports contain invalid UTF-8. Upgrade Playwright
and the locked fast-uri dependency after npm audit findings. Fragment remains an
isolated draft package, not a publication service or an authorization system.

### 2026-10-22 — active-document checks and lossless local-file loading

Add a quiet, opt-in Document checks drawer section and inert inspection of current
Markdown. Show active rendering diagnostics and a source content digest distinct
from the embedded render tuple. Clear inspection state after refused rendering.
Local file loading now decodes bounded ArrayBuffer bytes as fatal UTF-8, retaining
BOM and line endings for hashing; invalid UTF-8 preserves the current document.
No new remote origins, authored execution or automatic fetches are enabled.
Refresh frozen standalone output hashes for these deliberate UI/runtime changes.

### 2026-10-22 — strict generator checks and deterministic integrity reports

Add opt-in `strict`/`--strict` to the Node standalone build adapter, refusing
renderer diagnostics before replacing HTML. Preserve lenient visible-refusal
rendering by default and leave portable renderer bytes unchanged. Optional
`report`/`--report` emits a versioned deterministic JSON report binding candidate
HTML bytes to source, render and runtime hashes. Strict diagnostic failures still
emit the rejected candidate's report; hard parse/transport failures do not.
Refuse colliding input/output paths, including existing symlink/hard-link aliases.
These checks are generation diagnostics, not manuscript or security approval.

### 2026-10-21 — host network policy for packaged reading surfaces

Add an optional trusted `policy` seam to `buildMetaDocument`, preserving its
existing default. Local-only hosts can select an empty remote-origin list without
editing generated HTML or forking the renderer/packager. This option is supplied
by the build host, not by manuscript metadata or request input.

### 2026-10-21 — portable prepared-assets standalone assembly

Move standalone rendering/assembly from the Node filesystem script into
`demo/markdoc-ragbaz/standalone.js`, with bounded byte input, host configuration,
prepared assets and explicit trusted loader seams. Keep esbuild, file reads and
license/source-map inventory gates in `prepareStandaloneAssets()` at build time.
The CLI delegates to the extracted implementation. No product route, credentials
or storage policy is introduced. Freeze five pre-extraction HTML hashes and test
both direct and browser-bundled portable execution against them. This enables
consumers to omit esbuild's Go executable from their runtime without disabling
the license gate or forking standalone assembly.

### 2026-10-21 — manuscript-only printing

Add print-only layout resets for the five existing presentations: single-column,
untransformed flow even from a later paper spread, white paper, page margins and
widow/orphan hints. Suppress open source-inspection panes and raw manuscript,
reader chrome and botanical overlays; retain manuscript references and useful
ornament. Do not mutate stored screen preferences or introduce host-specific CSS.
Heartfulness uses a smaller print title without a second page-margin inset.

### 2026-10-15 — Git release review

Review the renderer, browser controls, templates and packaging before committing
the publication surface independently of research manuscripts. Replace host-only
test paths with isolated portable directories, require Chromium coverage in CI,
and associate the typography selector with its loading/privacy status for assistive
technology. CI builds only the neutral package; private manuscript artifacts and
research notes are not included in the release commit. The Worker repository pins
the exact renderer commit separately; tests and deployment are not independent
security-review or publication approval.

Further refusal-path review found that contract inspection dereferenced the
current document after a render refusal had cleared it. Make that access optional
and regression-test the embedded contract after refused replacement prose; also
exercise font selection with storage denied. A refused manuscript must not make
the host's offline contract unavailable.

Hosted CI subsequently exposed Chrome startup and fixed-sleep navigation races.
Serialize the offline test files, disable unnecessary browser startup services,
wait for actual reader/bootstrap completion, and bound cleanup to the inspected
PID of the browser started by that test. CI has a finite job timeout. These are
test-harness reliability fixes, not retries that suppress application assertions.

### 2026-10-15 — Aether and curated font alternatives

Add three original symbolic presentation variants, Prima materia, Sun and moon,
Blackening, with new specimen prose and accessible host-owned SVG plates. They
are not recovered correspondence, historical facsimiles or scientific evidence.
Installed template IDs and variant CSS remain bound into the render tuple;
family navigation does not forward manuscript URL parameters. The plate can be
hidden independently of document content.

At the user's request, host-enabled meta builds offer a finite curated Google
Fonts alternative. System fonts remain the no-request offline default. Only
fonts.googleapis.com styles and fonts.gstatic.com font files are enabled in the
host CSP, and only the installed family URLs are requested by the reader. The
font allowlist selection is included in the surface tuple; live Google font
bytes are not hash-pinned or part of the offline snapshot. Explicit selection
contacts Google and can change line layout. Failed requests fall back visibly;
this does not relax manuscript image, executable import or origin policy.

### 2026-10-15 — Heartfulness first proof

Add Heartfulness as a second installed meta-template, with original host-owned
rose/corner SVGs, optional section flourishes, independently switchable static
paper grain and a late-Victorian British storybook-inspired typographic treatment.
This is contemporary interpretation, not a facsimile or brand affiliation.
The existing builder gains an optional allowlisted `template` selector (default
unchanged) and CLI `--template`; the render tuple binds selected host configuration
and variant CSS bytes. No authored import/SVG permission or origin policy changes.
Manuscript Markdown remains separate from host decoration; loaded content receives
the same optional presentation. Static companions are byte-manifested. Local proof,
not production deployment, independent review or manuscript publication.

### 2026-10-15 — sci reader appearance and polish

Add a host-owned System/Light/Dark appearance preference, with storage-denied
fallback and early application before painting. System changes follow the OS;
no document metadata controls the preference. Extend subdued cyan/orange figure
tokens to trusted inline SVGs, source inspection and reader panels. Polish the
neutral opening and expose appearance directly in document tools. Print uses
light paper without mutating preferences. No deployment or review approval.

### 2026-10-15 — content-neutral sci/Tufte meta-document

Add the named markdoc-ragbaz-sci-tufte package builder, neutral source, starter
and companion asset manifest. A host-opt-in document URL parameter reuses the
existing credential-free bounded resource loader and strict optional SHA-256
verification; it cannot add origins or execute document-supplied code. Parameter
failures are visible and do not substitute the witness paper. Normal embedded
documents do not interpret this parameter. The render tuple now binds the host
meta-document/contract-source settings; buildStandalone additionally returns the
already-built runtime, styles and license texts as an assets field for packaging.
Deployment belongs to the new, independent meta.ragbaz repository; the renderer
is consumed there, not copied. This change is not publication or release approval.

### 2026-10-15 — A4-based, flow-first spread proportions

Use nominal A4 sheet proportions and a narrower text measure with generous
proportional horizontal margins. Fill the binding and outer screen margins with
the paper surface; remove the inset-book shadow and synthetic vertical frame
padding. Screen columns remain best-effort pagination, not fixed A4 print breaks;
printing requests A4 and retains the complete document. Tighten superscript
spacing by removing preceding word-space and button padding while preserving thin
separation between consecutive notes and an invisible pointer target. Source bytes
and evidence identities are not rewritten by these presentation enhancements.

### 2026-10-15 — keyboard flow/paper navigation

Add actual Fullscreen API entry/exit, flow versus responsive paper-spread views,
standard document navigation and an opt-in shortcut legend. A shared binding table
documents keys in both menu and legend. Lowercase `l` belongs to the legend;
`Shift+L` provides next-spread navigation instead of claiming full Vim equivalence.
Typing, focused controls, inspection, modals and browser modifiers remain outside
reading shortcuts. Mode changes retain the containing passage; CSS columns are
responsive screen pagination, not canonical print page numbers. Print restores the
entire continuous document. No source, publication or verification authority changes.

### 2026-10-15 — reader context and illustrated project introductions

Rewrite the witness abstract/background for readers outside the commissioning
session: WeftMark implements a SQLite-backed data model, not SQLite itself.
Keep exact identifiers in links and classified notes instead of anonymous inline
hex. Meaningful authored links now retain their text, rather than being replaced
by a bare citation number. First-mention editorial notes introduce named systems;
source cards explain destinations and distinguish Git commits from content digests.
WeftMark and Nostoi receive numbered, captioned project cards with original
host-owned inline SVG diagrams. This does not enable authored SVG or remote images,
change cached source bytes, claim a deployed witness, or complete publication review.

### 2026-10-15 — scientific reading presentation and editorial metadata

Remove the contract-reading preamble and top divider; open the pinned contract
from the subtle bar label instead. Move the tools icon/drawer right, expose
auto-hiding contents with a reduced-motion-aware ornamental left-edge handle,
and use deduplicated numeric citations with hover/focus margin or tooltip atoms
and an end bibliography. These are browser presentation enhancements, not
source-byte transformations or new verification claims. Ordinary links remain
undecorated until hover/focus. Repository metadata never invents personal authors.
Expandable human/model credits and date stamps now expose authored revision
history. Publication requires explicitly recorded human and assistant review
signals; passing tests never publishes. The current paper remains unpublished.

### 2026-10-15 — quiet reading room (presentation change)

Move the loader, provenance strip, contents and software notices into an accessible
native-dialog hamburger drawer. The single fixed icon bar auto-hides while reading
and remains reachable from the top edge, keyboard focus and upward scrolling.
Focused controls/open dialogs stay visible; reduced motion removes transitions.
Drag-and-drop changes meaning: it is now disabled until explicitly enabled in
the drawer. File/URL loading, digest enforcement, source inspection and trust
boundaries are otherwise unchanged. No document-selected execution is added.
The prior prototype was recovered byte-for-byte from OpenCode's snapshot into a
persistent `/srv` worktree; unrelated original-checkout widgets were not copied.

### 2026-10-15 — local reader links its rendering contract

The fleet witness paper now declares the exact local `docs/MARKDOC-RAGBAZ.md`
bytes as a SHA-256-pinned source, exposed through the existing source inspector
and its shared Markdoc renderer. Its deployment-relative `/markdoc-ragbaz.md`
URL is served alongside the paper; the standalone build also embeds the contract
snapshot for offline reading. This is an unpublished local contract, not a
newly asserted release or a production witness. No renderer policy was relaxed.

### 2026-10-15 — correct GitHub path-revision ordering

Post-review hardening uses null-prototype tag/spec maps and own-property lookup:
undeclared `constructor` and `toString` tags now produce the same visible refusal
as other unknown tags. Live public-provider smoke checks exercised a matching
WeftMark feature-branch reference, an older Nostoi path commit (unknown, not
current), and arXiv v1 versus observed v7. GitHub's real response abbreviates its
HTML permalink; identity validation therefore uses its full-SHA API `url` field.
These are client observations, not trusted timestamps or supersession proofs.

A different latest-path commit is no longer labelled newer merely because its
SHA differs from the document pin. A bounded GitHub compare request validates
both endpoint identities, ancestry status, merge base and ahead/behind counts.
An ancestor reports unknown: the tracked ref may be behind file changes in the
pin, and byte equality has not been established. Only a positive descendant
reports latest; divergence and empty path history also report unknown. Branch and
tag queries use qualified refs to avoid same-name ambiguity. Contradictory
or malformed comparisons refuse with error. Responses carry explicit relationship
and separate hashed query/comparison evidence, without mutating pins or asserting
supersession. Documentation also makes arXiv's possible browser CORS unavailability
explicit; no proxy or live request was added.

Correction verification: `npm test` passed 91/91, zero failures or skips,
including ancestor/diverged/descendant/equal/empty and wrong-identity fixtures.
Headless Chromium passed 23 offline checks, including unknown ancestor display
and stale comparison-result isolation. These checks use fixtures; live provider
smokes are separate observations, not signature or supersession verification.

### 2026-10-15 — integrity policy and opt-in provider observations

Additive source/asset integrity descriptors preserve the SHA-256 alias and reject
contradictory digests. The new explicit inert-inspector capability may show
mismatched Markdown as labelled text only, or use a host-supplied cache after
rehashing against the expected digest; trusted surfaces still refuse. This
explicitly qualifies the earlier blanket mismatch-refusal description: only
inert source inspection can degrade, never runtime, dialect or theme trust.

The same generic module now derives pinned GitHub identities and checks commits
for a specific path/ref, with default-branch discovery and explicit tag/release
modes; arXiv checks parse a bounded structural Atom subset in Node/browser.
Endpoints are fixed, requests are click-only, bounded and credential-free, and
refuse redirects. Dated client-clock observations, original revisions and
authored supersession/related claims stay separate. No source mutation, API
live-check, new dependency, signing service, deployment or production readiness
is claimed. Exact schema, parser limits and API semantics are documented in
`docs/MARKDOC-RAGBAZ.md`; independent review remains required.

Verification for this addition: `npm test` passed 89/89 with zero failed or
skipped; the headless offline reader passed 22 checks. All provider evidence in
these tests is fixture data, not current upstream observations. No report or
package dependency changes were made by this addition.

### 2026-10-15 — additive markdoc-ragbaz document surface

`src/content/markdoc-ragbaz.js` is an original generic implementation using the
official `@markdoc/markdoc` 0.5.10 AST/validation/transform pipeline, reusing
`src/content/markdoc.js` tokenizer defaults and raw-HTML-escaping policy. It does
not reuse the legacy unrestricted custom-attribute forwarding. Existing content
API behavior is unchanged; the new export has a deliberately stricter data-only
contract, visible unsupported-tag refusals, safe HTML serialization, pinned host
registry resolution, typed themes and bounded transport helpers.

The builder and `demo/markdoc-ragbaz/` paper reader are new, separate adapters;
they do not extract or copy the original checkout's unpublished React widgets,
MDX components, product CSS or generated library assets. Document-surface
research informed the architecture but is not evidence of deployed fleet
behavior. The standalone runtime bundles pinned Markdoc and YAML; esbuild is a
pinned build-only dependency. Models remain read-only authored examples. No
production witness, migration, adoption or deployment is claimed.

`docs/MARKDOC-RAGBAZ.md` specifies the new public contract and remaining limits;
`tasks/markdoc-ragbaz-witness.weft.yml` uses source-intent `weft-task-v0`, with the
full research/paper/surface scope in `review`, not done. Runtime claims and
measured outcomes remain outside the sourceplan. No existing semantic contract
was changed.

### 2026-10-15 — distribution notices and compatibility clarification

Standalone output now preserves full software notices in escaped inert credits,
with esbuild inline legal comments retained as an additional measure, not the
license source. Installed `@markdoc/markdoc/LICENSE` is MIT;
`yaml/LICENSE` is **ISC**, not MIT. Inspection of Markdoc's distributed source
map identified vendored markdown-it, entities, uc.micro, mdurl, linkify-it and
punycode, plus a PEG.js-generated parser. Full notices were inspected from npm
tarballs: markdown-it 12.3.2, entities 2.1.0, uc.micro 1.0.6, mdurl 1.0.1,
linkify-it 3.0.3, punycode 2.3.1 and pegjs 0.11.0-master.b7b87ea. Markdoc patches
markdown-it; these notice sources do not assert byte-identical unmodified
versions. mdurl's Joyent/Node notice and entities' BSD terms are included.
The builder verifies the reviewed bundle inventory and refuses missing notices
or unreviewed dependency changes. Normal builds and tests need no notice fetch.
No common LICENSE or package license declaration exists in this checkout;
credits explicitly do not grant a common/paper redistribution license by
association with permissive dependencies.

The Fragment draft at `0d9114a6014721bfba52e4d2b54d33dc373b7ee5` was inspected
read-only. Documentation distinguishes local `ragbaz.surface/1` and
`ragbaz.render/1` renderer contracts from a proposed versioned Fragment transport
and Markdoc content mapping. No Fragment integration, merge or fleet-wide
artifact authority is claimed. Independent security and human review remain
required before release; no production witness deployment is authorized.

Correction verification: `npm test` passed 77/77, zero failures or skips,
including full-credit inclusion, missing-license/unreviewed-inventory refusals,
absolute external snapshot mappings and the headless offline reader. The actual
WeftMark source-plan validator accepted the revised task file as one task. These
are measured outcomes in documentation, not assertions stored in source intent.
## 2026-10-07 — Fragment 0.1 draft (additive)

`packages/fragment/` is new work from the user's artifact-protocol brief, not an
extraction from another product. It contains Rust/JS protocol implementations,
a shared JSON Schema, theme registry, keyboard/completion widgets, and a sample
A4 studio. The identity public contract and consumers are unchanged. The new
protocol is explicitly a draft; its boundaries and tests are documented in the
package. Third-party bundled dependencies retain their notices.

## 2026-10-08 — Cooperation protocol 0.1

At the user's direction, AGENTS.md now serves as the cooperation contract and
entry point for mutual expressions between the user and participating agents.
It adds participant attribution, scoped authority, evidence-aware records,
explicit acknowledgement and ownership transfer, disagreement/correction handling,
and concurrent-write guidance. Existing engineering invariants and keyboard
preferences are preserved. Frog remains the preferred task/lock mechanism; its
absence must be recorded, with branch-isolated work and no claim of a held lock.
The YAML envelope and coordination paths are conventions; no transport, terminal
attachment, autonomous polling, or executable Glither integration is implied.
