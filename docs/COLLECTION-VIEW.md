# One internal collection-view contract

`schemas/collection-view.schema.json` is the shared data contract for concrete,
aggregate and virtual views, independent of transport, deployment, storage
model or renderer. This is our internal **village** model; that vocabulary is
not prescribed as a user-facing label. Dash is currently Cloudflare-specific;
the contract is not. v-baz and future host/device views should consume this
same schema rather than invent separate factory/artifact graphs.

A source has an owner-issued stable ID and a display name. Display names,
URLs, filesystem paths and content hashes are not substitutes for identity.
Every factory and artifact retains `source_id`; references are structural
`{source_id, id}` pairs. A sink must not flatten, deduplicate or retarget
entries merely because their names, local IDs, repository origins or bytes
match. Source IDs must be unique within a view; scoped local IDs must be
unique within their source; all references must resolve before rendering.

For example a laptop can synchronize independently to a phone, USB stick and
hosted service. A sink aggregating several upstream laptops retains each
upstream source's ID/name and each revision. A transport endpoint may change
without changing source identity. Republishing a view must preserve upstream
references rather than replacing their source with the sink's identity.

Sources report `stores`, `produces` and `computes` independently. `null` means
unknown, not false. A forwarding-only junction can be represented without
claiming storage or compute. If it later gains even small local automation,
that reported capability changes; the model does not require a large model
or a particular substrate. Empty artifact lists prove neither a lack of storage
nor a lack of production. Decorative smoke is not capability/health evidence.

The contract does not grant access, verify signatures, discover files, fetch
URLs, or decide ownership. Each authenticated source adapter enforces its own
policy and verifies bindings/attestations with its owning cryptographic tools.
An attestation can connect someone to a friend's artifact without transferring
ownership or private-content permission. Repository identity continues to be
owned by its repository authority/Frog; this contract adds no Git-key scheme.

Keep provider adapters (Cloudflare, device, disk, RBQ peer/sink and others)
outside this package. Keep view components independent of those adapters.
Consumers may vendor a checksummed, pinned **schema artifact**, but must not
fork its semantics or copy authentication/rendering implementations. Adoption
in a product is explicit; this initial contract does not claim that v-baz,
device peers or a global identity graph are already connected.

Artifacts may be addressed as [signed gifts](GIFTS.md), including trivial text
and human-in-the-loop invitations. Delivery streams, including email adapters,
preserve source identity and original signatures rather than creating a second
artifact/identity model in each transport.
