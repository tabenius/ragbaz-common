# Engineering evidence presentation: consumer contract (proposal)

Status: documentation only. No CAD-specific renderer is implemented here.

`ragbaz-common` must remain a dependency-light, product-neutral reader. Engineering evidence belongs to the product host; this library only renders validated, bounded, inert data. A host may import a **public, redacted projection** of `ragbaz.cad-evidence/0.1` (see tabenius/cad/docs/architecture/EVIDENCE-INTEROPERABILITY.md) without pulling KiCad, Nostoi, or WeftMark into common.

## Host-to-renderer boundary

- Accept a host-prevalidated projection: candidate identifier, opaque digest references, check status and coverage, review status, stale/unknown markers, and a description. Do not accept raw netlist/PCB, credentials, user-provided URLs, HTML or executable scripts as renderer instructions.
- Preserve provenance as **display data**. A visible digest is not a verified signature. Neither renderer nor Markdoc determines release readiness.
- Render explicit `passed`, `failed`, `stale`, `unavailable`, `pending-review`, and `unknown` states. Never silently coerce absent/unknown values to passed.
- Supply a complete accessible exact table and static SVG baseline; interactive host adapters, if enabled, are additive. Print and offline views must not depend on JavaScript or network calls.
- Escape all authored labels; cap cardinality, depth, string length and full payload. Apply existing visualization size limits and strict render diagnostics.
- If evidence contains a reference, the host resolves it under an explicit allowlist, not the document. Missing/unresolvable references remain visibly unavailable.
- Separate human-signed approval (verified by an external trusted verifier) from Nostoi chain verification and KiCad ERC/DRC results. Present their status independently.
- Do not introduce product coupling, upstream network fetching or release-decision logic into `src/`.

## Candidate presentation

A report has (1) project/snapshot metadata and saved/live synchronization scope; (2) checks bound to exact source revision and KiCad/tool versions; (3) audit-chain verification state and external head continuity; (4) reviewer identity/authorization verification as supplied by host; (5) a clearly marked host-generated release decision with reasons. All statuses must be printable as text, not just colour.

## Acceptance tests for a later implementation

1. Valid bounded synthetic fixture renders offline with no network requests.
2. Hostile Markdown/HTML/SVG-like labels are displayed as text and never executed.
3. Missing check, changed source hash, broken audit, missing reviewer, and unsupported schema are distinct visible refusals.
4. Static table provides all information shown by any interactive graphic, including screen reader access.
5. No caller-controlled source can toggle release-ready or add an arbitrary fetch.
6. HTML and report hash and renderer version remain reproducible when inputs and pinned assets are fixed.

Adopt only through a separate, independently reviewed change to the existing visualizations API; this document does not enable a new visualization type.