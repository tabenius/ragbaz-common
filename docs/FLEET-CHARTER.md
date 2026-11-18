# RAGBAZ fleet charter: open, federated, preservable

Status: proposed fleet-wide architecture, 2026-11-18. This is guidance, not an implemented protocol, deployed service, independently audited security guarantee, or demand that existing producers change formats.

## The Alexandria requirement

A library should survive the loss, shutdown, censorship, compromise, or withdrawal of any one machine, operator, account, DNS name or service. An independently held copy should remain inspectable and recoverable without contacting RAGBAZ. Distinct custodians may disagree about meaning and publication policy while comparing the same bytes and evidence. This is a design objective, not a guarantee against the destruction of every copy or recovery key.

**RAGBAZ concentrates on connecting and preserving artifacts.** A centralized museum, dashboard, registry, or Cloudflare account must never become a prerequisite for local preservation or independent recovery. Offline operation is normal, not a degraded afterthought. Federation and opportunistic peer/mesh exchange are the target topology; they do not require simultaneous connectivity or agreement on one global authority.

## Standing priorities

1. **Open standards first (P0 architectural constraint).** Reuse documented protocols, media types, schemas and existing reference implementations. Explain the gap before proposing an extension. Ship portable export, documented conformance tests and round-trip fixtures. Do not invent a universal format to replace well-established ones.
2. **Recoverability before discoverability.** First demonstrate owner-exported local snapshots surviving an independently tested phone and/or encrypted S3 recovery. Search, registries, networking automations and public federation cannot gate this milestone.
3. **Local agency and custodial independence.** Each node chooses storage, keys, peers, retention, audience and publication. No mandatory RAGBAZ account or privileged coordinator.
4. **Originals before projections.** Retain original bytes, native manifests and provenance; report lossy transformations. An HTML rendering, model conversation export or OCI envelope is not equivalent to the editable source, the application environment, or its permissions.
5. **Integrity, authenticity, evidence and authorization are separate.** A SHA-256 match demonstrates byte identity, not authorship or correctness. Signatures, delegation, evidence, interpretation and consent are independent claims. Import never implicitly publishes, executes or authorizes content.
6. **Explicit replication and privacy.** Peer discovery alone confers no access. Sensitive content must not be uploaded in plaintext by default; inventories and metadata can be sensitive. Pruning, revocation and deletion do not imply remote erasure.
7. **Independent implementations by design.** Keep libraries small, documented, testable, interoperable and usable outside our fleet. Contributors should not need private infrastructure, vendor credentials or permission to implement the interfaces.
8. **Honest operational evidence.** Distinguish published, transferred, verified and independently restored. A plan, green unit test, or remote object listing is not a completed recovery drill.

## Separation of concerns and ownership

- **Rebeqah / rebsync / rbq:** storage layers, immutable manifests, content-addressed chunks, placement, peer transport, verification, recovery and restic/S3 adapters. It owns the first milestone; no general-purpose replacement folder sync.
- **Mneme / Hypomnema:** owner-created and owner-validated history snapshots and compact evacuation handoffs.
- **Frog and Agenda:** native formats, consistent export and owner validation.
- **Pieces and ragbaz-common:** authoring, shared portable description/rendering libraries; never treat rendering as source-preserving export.
- **Mouseion / Nostoi / WeftMark:** library curation, publication decisions, evidence, provenance, attestations and institutional federation. Museum publication cannot be inferred from ingest.
- **dl.ragbaz.cc:** release distribution and optional OCI packaging, not the canonical store of every private artifact.
- **Dash:** optional operator/control surface, never essential to independent recovery.
- **Cloudflare R2, S3, local filesystems and removable storage:** interchangeable storage destinations to the extent their tested capabilities permit; encryption and access policy are explicitly configured.

A shared descriptor may record stable identity, revisions, native format, digest, dependencies and provenance links, but it is not an imposed universal document schema. Reuse OCI/ORAS where packaging adds value; established Git, S3, restic, SPDX/CycloneDX, in-toto/SLSA, W3C PROV, MCP/A2A and standard media types only where their particular semantics apply. No single protocol covers the full lifecycle.

## Architectural non-goals

- Reimplementing Syncthing, Git, restic, object encryption or the S3 protocol.
- Making OCI mandatory for Markdown, history handoffs or small private drafts.
- Always-on global catalogs, mandatory account services, automatic public replication, or universal auto-merge.
- Interpreting a copied plaintext object as a secure off-machine backup.
- Promising unstoppable publication, guaranteed erasure, or censorship immunity.

## Project and contribution rule

A new fleet-wide extension needs: (a) documented existing alternatives, (b) a narrow interoperability gap, (c) a native-format-preserving escape path, (d) threat/privacy analysis, (e) conformance fixtures, (f) a second independent implementation or feasible implementation guide, and (g) a migration/retirement path when an open standard fills the gap.

## Funding and public-interest case

The grant-sized first public deliverable is a **provider-independent, independently recoverable artifact exchange and preservation library**: a proven laptop–phone–laptop exchange, encrypted S3 recovery, reference fixtures, owner adapters, threat model, and clean-room implementation documentation. Public-interest sponsorship may support security review, reproducible tests, accessibility, independent maintainers and interoperability work; sponsorship must not impose exclusive hosted endpoints, incompatible licenses or private-only protocol features.

See [the implementation roadmap](DISTRIBUTED-LIBRARY-ROADMAP.md) and [the artifact-library design](ARTIFACT-LIBRARY-DIRECTION.md).
