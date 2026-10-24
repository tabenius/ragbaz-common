# Artifact publication and sharing library — design direction

Status: proposal, not an implemented service, protocol standard or deployment.
Goal: one inspectable library usable by many humans and agents, online and during
disconnection, with optional mesh exchange. Fragment describes an artifact;
Markdoc renders one content type. Neither owns account policy, publication rights
or a network's global truth. Product routes/policy belong in a consuming repo.

## Separate the objects and decisions

- **Blob:** immutable bytes addressed by a cryptographic digest; media type, size
  and availability are explicit. Hash equality is not authorship or permission.
- **Revision:** immutable manifest referencing content, datasets, diagrams,
  dependencies, licenses, provenance, parent revisions and rendering identities.
  Dependency graphs are bounded and cycle-checked; attachments start quarantined.
- **Identity:** human, agent or organization principals. Every action records both
  the actor and any delegating principal. Agents have independent credentials,
  bounded scopes, expiry and revocation; a display name is not a credential.
- **Workspace:** access-controlled drafts, comments, reviews and proposed patches.
  Authored disclosures and labels are not access control. Invitations and grants
  are separate, explicit and auditable; verified email never authorizes publication.
- **Release:** an immutable revision plus explicit publication decision, required
  reviews, applicable license and audience. Source availability, rendering success,
  agent acceptance and human approval are separate states.
- **Collection:** mutable curation referencing releases, with independent authority
  and history. Discovery indexes are derived; search results disclose no private
  resource existence to unauthorized users.

## Collaboration without impersonated agreement

Use proposals and immutable attributed operations for comments, reviews, patches
and decisions. An agent may suggest a revision; it cannot accept for a human or
publish merely because content says "approved". Bind approval to the exact revision
and policy version; edits invalidate or require renewed approval. Keep dissent and
superseding decisions, including rejected changes. Show conflicts rather than
silently accepting last-writer-wins publication or permission decisions.

For concurrent text drafts, evaluate a CRDT such as Yjs or Automerge in a product
prototype. Do not use a CRDT merge as authorization. Structured Fragment changes
are validated after merge; unresolved conflicts cannot produce a final release.
Use idempotent operation IDs, parent references and optimistic version checks.
Treat imported artifact prose, prompts and agent output as untrusted data, never
as executable instructions or a source of delegated authority.

## Online and mesh transport

Start with one authoritative workspace service, immutable object storage and
capability-checked metadata APIs; add portable export/import bundles before peer
discovery. A bundle contains a versioned manifest, bounded content graph, hashes,
provenance and optional signatures. Verify bytes and signer authority separately.

Mesh peers exchange inventory summaries and explicitly requested blobs; authorize
before advertising or transferring private identifiers. Authenticate peers and
validate grants against local trust roots, audience, expiry and revocation state.
Use encrypted private bundles with explicit recipient/key distribution. Public
content and private content must not share an enumerable unauthenticated index.
Do not equate network proximity, a signature or possession of a hash with access.

Offline edits may queue; publication and grant changes require an authoritative
decision, or a deliberately configured local trust realm. Disconnected peers must
show stale/unknown revocation knowledge. Revocation prevents future authorized
access; it cannot retrieve copied plaintext or guarantee deletion at hostile peers.
Tombstones and retention rules express intent, not impossible erasure promises.

## Massive multi-user boundaries

Partition workspace metadata and independently scale blob delivery, rendering,
search and synchronization. Apply bounded body sizes, attachment/dependency
budgets, concurrency limits, backpressure and per-workspace storage/work quotas.
Preserve the shared abuse-gate invariant: route-hash bucket keys, never
attacker-chosen identity/IP/handle buckets. Persistent product quota accounting is
separate from that circuit breaker. No global peer census or unbounded fan-out.

Rendering is a job over immutable inputs, with isolation, a recorded toolchain,
timeouts and output digests. Graphical libraries execute as host-owned dependencies,
not authored JS. Avoid leaking draft text in logs, error messages, diagnostics,
build reports or public caches. Audit publish/grant/revoke/import operations while
minimizing personal data. Test membership changes against cached search and assets.

## Suggested staged implementation

1. **Local library:** Fragment + Markdoc + explicit assets, validate/export/import,
   accessible diagram/table fallbacks, reproducible rendering, offline browsing.
2. **Small private workspace:** product-owned identity, scoped agent delegation,
   invitation/review/release policy, object storage and append-only audit history.
3. **Multi-user collaboration:** conflict-aware editing, exact-revision review,
   search ACLs, quotas, revocation and abuse tests with real persistence.
4. **Federation/mesh pilot:** authenticated bundle exchange between two independent
   trust realms, interrupted transfers, replay protection and stale-state UI.
5. **Scale only from evidence:** load tests, measured storage/rendering costs,
   incident recovery, moderation/appeals, tenant isolation and availability targets.

Unresolved product choices: public versus invitation-first launch; pseudonymous
attribution versus legal authorship; who can delegate publication; licensing and
moderation; server authority versus federated realms; key recovery and offline
revocation tolerances. Do not settle these by silently choosing infrastructure.
