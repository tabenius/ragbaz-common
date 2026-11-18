# Distributed library roadmap — Rebeqah first

Status: actionable fleet roadmap, 2026-11-18. **Milestone 1 remains the first completion gate: sync existing Rebeqah local storage layers to an Android phone and/or encrypted S3, then prove independent restore.** This plan does not claim those demonstrations have occurred.

## Current implementation baseline (verify against HEAD before work)

`tabenius/rebsync` describes:
- Owner-exported `mneme`, `frog`, `agenda` layers and Git bundle layer, published as verified content-addressed chunks and immutable manifests in a local filesystem store.
- Manual `rbq peer push/pull` with the Rebeqah Android app (`rbq-peer/0`) using an explicit peer connection. Copies are additive; chunks precede manifests. Existing HTTP peer transport lacks TLS and must be confined to a trusted connection or authorized loopback tunnel.
- `rbq storage fsck`, owner validators and restore-to-new-destination operations.
- Encrypted restic backup supporting an explicitly configured S3-compatible repository including R2.
- A filesystem `ObjectStorage` adapter; native S3/R2 layer-object storage, auto-scheduling, robust discovery and network-independent identity remain future work.
- Hypomnema integration is in progress and must not be presented as built/tested/merged until demonstrated. Check whether a candidate branch is opt-in rather than silently replicated to peers.

The object store may contain plaintext. **Do not copy sensitive layers straight into an unencrypted online S3 bucket.** Encrypted restic backup and native S3 object replication are different feature tracks.

## Milestone 1 — local → phone and/or S3 → independent restore (P0)

Two separable acceptance tracks. Deliver the first working route without blocking on the other. Target both.

### M1.0 — reproducible baseline

- Record exact source revisions, platform, Android app revision, toolchain and owner-validator versions.
- Run `cargo test --workspace` in rebsync; build `rbq` from a clean checkout.
- In a disposable root, publish one synthetic owner-generated sample for each available layer: Git, Mneme, Frog and Agenda; Hypomnema only after its feature branch is validated.
- Run `rbq storage fsck`, owner-specific verify and restore-to-new-destination, including injected missing chunks, modified bytes, symlink traversal and duplicate/replayed manifests.
- Explicitly mark unsupported and environment-blocked integration tests. Preserve evidence reports, without tokens or private payloads.

Exit: local recovery and all mandatory gates green on a clean run.

### M1.A — laptop A → Android → laptop B

- Use the current `rbq peer` contract and Android Rebeqah storage, not an unrelated generic file sync.
- Exchange explicit layer inventories and missing immutable objects, with chunk-by-chunk SHA-256 and owner-manifest verification. Require manifests to be advertised as recoverable only after all referenced chunks exist and validate.
- Manual first: trusted local Wi-Fi, then authorized ADB loopback forwarding, then hotspot/USB tethering. Do not assume pairing, mDNS, Bluetooth or ChromeOS Phone Hub prove peer identity.
- Constrain HTTP to a trusted local link or explicit tunnel; make authenticated encrypted transport, token hygiene and replay resistance a gate before exposure on untrusted networks.
- Enforce Android free-space budgets, app-private persistence, bounded data, restart after process death, interrupted/resumed transfer and token-scoped peer access.
- Disconnect laptop A and Internet; restart the phone app. From laptop B pull Git and at least one non-Git layer, verify, restore to new paths, and compare native owner-validation results.
- Repeat with a new revision and with both peers disconnected long enough to require a later exchange; check no destructive last-writer-wins merging.

Exit: a verified owner-level recovery on laptop B with laptop A and Cloudflare unavailable.

### M1.B — laptop A → encrypted S3/R2 → laptop B

**Track 1 (existing feature; do first):**
- Configure restic with a dedicated private S3-compatible repository, least-privilege credentials, separately stored password and independently held recovery instructions. Do not check any credentials into Git.
- Create a backup, enumerate snapshots, run restic checks, and execute an actual restore on laptop B with laptop A offline.
- Verify restored Rebeqah snapshot exports with `rbq storage fsck` and owner validators as appropriate; explicitly check coverage (ignored/uncommitted files, Git LFS, live DB and external datasets are not automatically protected by every snapshot type).
- Simulate interrupted uploads and verify recovery; repeat with a different S3-compatible service if feasible.

**Track 2 (new development; after Track 1):**
- Implement a native S3-compatible `ObjectStorage` adapter behind a capability-checked storage interface. Establish create-if-absent semantics, read/list/head/range, integrity, bounds, retry/idempotency and multipart behavior on both R2 and a second backend.
- Do not confuse ETag, object size or list visibility with content verification. Publish chunks first, durable verified manifests last. Refuse unsupported atomicity assumptions.
- Design encryption-before-upload and key recovery independently, with audited primitives where possible; opt in to plaintext only via explicit policy and risk disclosure.

Exit: remotely encrypted, independently restorable data without a RAGBAZ hosted control plane.

### M1.C — operator semantics and documentation

Report separate states: **local published**, **remote transferred**, **remote verified**, **owner-level recoverable**. A report must identify destination and observation timestamp; claims are not permanent guarantees. Keep per-layer and per-peer selection opt-in, with placement, size/retention budgets and privacy classification. Never treat failure or unknown as success. Add a concise operator runbook for Chromebook/Crostini, Android, Linux and R2.

### M1 work order and acceptance evidence

1. Baseline test and review, issue/PR audit; fix regressions.
2. Android end-to-end recovery drill and reconnect behavior.
3. Encrypted restic S3 end-to-end recovery drill, independently of phone.
4. Hypomnema integration, format-owner verification and private-by-default layer policy.
5. Transport/authentication hardening.
6. Native S3 object-store adapter and portability tests.

Publish an artifact-free synthetic test report with commands, exact revisions, hashes, observed outcomes, environment, limitations and blockers. Do not merge or deploy a security-sensitive implementation on documentation alone.

## Milestone 2 — multi-device continuity (P1)

Introduce stable device identities, explicit peer enrollment, per-layer placement policies, disconnected inventory exchange, delayed transfers and conflict reporting. Combine immutable objects safely; defer mutable reconciliation to Git, Pieces or other actual owners. Never overwrite another node's working state or delete missing remote objects by inference.

Exit: two independent laptops exchange diverged histories via phone or detachable media; each can operate and validate locally without a service.

## Milestone 3 — portable artifact collections (P1/P2)

Produce native exports + preserved bytes for Pieces Markdown/Markdoc, Mouseion scrolls, CAD, evidence, software releases and agent handoffs. Implement small optional descriptors with digest, media type, revision and provenance links. Quarantine untrusted imports, preserve opaque types safely, and require explicit publication approval. OCI/ORAS is optional when packaging and registry discovery are useful; don't repackage everything.

Exit: two different consuming apps independently open/validate a fixture without interpreting projected HTML as native authoring source.

## Milestone 4 — federation (P2)

Independent custodial domains, authenticated peer exchange, explicit signed claims, trust policy, publication consent, portable references and decentralized catalogues. Metadata visibility must follow grants; do not equate verification, signature or trust decision. No global service required for exchange or restore.

Exit: two independently administered implementations exchange a public artifact and a separately consented private artifact; permission/privacy tests pass.

## Milestone 5 — intermittently connected mesh (P2/P3)

Transport-independent inventories, resumable requests, removable media, LAN, tunnels, optional relays and store-and-forward. Discovery must not leak private inventory. Quotas, anti-replay protection, transfer budgets and bounded graph traversal are compulsory. Do not mandate a single mesh stack.

Exit: interruption, delayed encounter and loss of a relay do not corrupt inventories or prevent eventual authorized transfer.

## Milestone 6 — historical integrity and anti-rollback (P3)

Replicas under independent custody, separately witnessed checkpoints, attestations and reproducible exports. Distinguish byte identity, signer validation, authentic authority, evidence sufficiency and interpretive disagreement. Include key rotation and compromise recovery, restore drills, encrypted private replicas and explicit retention policy; don't promise hostile-peer erasure or impossible censorship resistance.

Exit: silent unauthorized replacement and rollback are detectable from independently retained commitments.

## Milestone 7 — ecosystem and sponsorship (P3)

Publish small protocol-neutral libraries, test vectors, independent sample nodes, interoperability suites, a security/maintenance policy, contribution documentation and a sponsor prospectus. Seek public-interest funding for verified interoperability and independent maintenance rather than an exclusive hosted monolith. New inventions require a demonstrated gap against open standards and a sunset/migration path.

## Project ownership and dependencies

| Project | Responsibility | Cannot gate M1 |
|---|---|---|
| Rebeqah / rebsync | Owner-exported snapshot storage, peer sync, restic, later native S3 | Main owner of M1 |
| Mneme / Hypomnema | History and emergency handoff validators | Entire M1 cannot wait on handoff adapter |
| Frog / Agenda | Consistent native exports and validation | Feature-complete UI |
| Pieces / ragbaz-common | Editors, reusable portable descriptions and rendering | Unified new document schema |
| Mouseion / Nostoi / WeftMark | Curation, publication, evidence, attestation | Museum release or federation server |
| dl.ragbaz.cc | Optional OCI and release distribution | Package registry deployment |
| Dash | Optional visibility and operations | Cloud control plane |
| Cloudflare / S3 | Optional replaceable off-machine storage | A mandatory Worker or domain |

## Cross-cutting acceptance and non-goals

- Respect existing owner formats; do not run code from imported artifacts.
- Validate untrusted paths, manifests, digests, graph depth and size; never infer authorization from possession of a hash.
- Test actual recovery, not merely upload success; preserve false/unknown states.
- Verify keys and passwords can be recovered independently; ensure secret material never appears in logs, reports or Git.
- Keep private artifacts out of public indexes, automatically shared peers and public storage by default.
- Separate backups, replicas, synchronization, working copies, publication and attestation: they have different guarantees.
- Do not replace Git, restic, Syncthing or established standards with a speculative universal protocol.

See [fleet charter](FLEET-CHARTER.md) and [artifact-library direction](ARTIFACT-LIBRARY-DIRECTION.md).
