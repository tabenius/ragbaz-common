# Gifts and delivery streams (contract direction)

A gift is an owner-signed envelope addressed to a list of recipient public
keys, around an artifact. A subject/title and text are sufficient for a trivial
artifact. A request to answer, approve, deny or review can be a gift carrying an
invitation context. The additive `gift` projection in the collection schema
describes these fields; it does **not** invent a cryptographic signing format,
implement delivery, or mean the RBQ gift layer already exists.

The owner signing protocol must bind the envelope version, gift ID, sender,
recipient-key list, artifact bytes/digest or exact inline text, subject,
invitation context/choices, expiry/replay information and any delivery policy.
Do not hand-roll canonicalization or signature verification in each consumer:
use the reviewed owner/Nostoi/keystore mechanisms and preserve exact signed
bytes. An envelope may be cryptographically valid but come from an untrusted
or unauthorized sender. Shape validation is not signature verification.

Recipient public keys are not email addresses, account ownership, passkey
bindings, signing authority or private-content grants by themselves. Resolve
those through verified owner-issued bindings and current authorization. Gifts
and their recipient lists can be private; they are not a public social graph.
Acceptance/ownership transfer and read receipts must be explicit policy, not
an automatic consequence of delivery or viewing. Never export a private key
as a side effect of navigating a keystore artifact.

The same source-scoped model can be navigated through private agent tools.
Artifact/provenance reads are a separate opt-in from storage append or any
future action/signing grant. Return bounded structured data and explicit
unavailable states, never arbitrary filesystem/URL execution or hidden access
to private keys. Untrusted gift contents do not become tool instructions.

## RBQ gift layer

The intended `gift` layer is additive and immutable. Publish verified content
before signed manifests; preserve upstream source IDs/names and exact signed
envelopes through sinks and replicas. Delivery or forwarding must not replace
the sender with the sink's identity. Unknown formats, failed verification,
unsupported migrations or invalid recipient bindings must remain explicit
blockers, not be accepted by adding a string to the layer registry. No such
layer is advertised or accepted by the existing RBQ peer protocol yet.

## Human-in-the-loop invitations

Receiving a decision invitation does not grant the right to decide. Keep the
original hold/action ID, instance, policy and expiry attached. Answers,
approvals and denials still go through the owning service's current role and
capability checks, recent-sign-in/passkey requirements and metadata-only audit.
Forwarding a gift is not permission delegation. Agent navigation tools are
read-only unless separately authorized; untrusted gift text is never executed
as commands or treated as higher-priority instructions. A response can itself
be a separately authenticated/signed gift, not a mutation of the old envelope.

## Email as a delivery adapter

An explicitly subscribed stream may be proxied to email. Require a verified,
consented mapping from recipient key to delivery address; never guess one from
names or fingerprints. Retain the original gift ID, sender, signature and
source reference. Use an outbox and stable gift/recipient/transport idempotency
keys; do not claim exactly-once SMTP delivery. Respect expiry, revocation and
unsubscribe independently of the original immutable record.

Default to a notification pointing to an authenticated viewer, not silent
forwarding of private text, key lists or capability-bearing URLs. Inline
content requires explicit signed/authorized delivery policy; email is not
end-to-end encrypted by default. Render authored text through safe email
templates, not raw executable HTML. No new subscription or email is created
by adding this contract.

Replies may submit a response for validation or route to the authenticated
decision flow. A reply from an email address alone is not a valid user-key
signature or passkey step-up. A bridge signature identifies the bridge, not the
original user. GET links and email scanners must never approve or deny actions.

## Telegram and Discord

These are delivery adapters for the same subscribed gift stream, not separate
gift/identity systems. Bind the recipient key to an explicitly authorized chat,
channel or account; public channel delivery needs separate consent for that
audience. Preserve the original signature and source, keep bot/webhook secrets
outside artifacts/MCP reads, use bounded attachments and stable delivery IDs,
and respect revocation/unsubscribe. A chat sender, bot button or webhook is not
by itself a user-key signature, ownership transfer or HITL approval authority.
Inbound responses must pass the same owning-service validation as email/app
responses. No bot, webhook or subscription is provisioned by this schema.
