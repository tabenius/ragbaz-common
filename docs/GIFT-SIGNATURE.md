# Gift signatures: `ed25519-jcs-v1`

A gift envelope (the `gift` definition in
[`schemas/collection-view.schema.json`](../schemas/collection-view.schema.json))
is signed with a **detached Ed25519 signature over its RFC 8785 canonical
JSON**. Implementations: [`src/gift-signature.js`](../src/gift-signature.js)
(Workers and Node, WebCrypto) and `rebsync_core::gift` (Rust). Both must pass
[`schemas/gift-signature.v1.vectors.json`](../schemas/gift-signature.v1.vectors.json),
which is generated deterministically by `scripts/gift-signature-vectors.mjs`.

## Keys and encodings

- `sender_public_key` and each entry of `recipient_public_keys` is
  `{"format": "ed25519", "value": B64}` where `B64` is the 32-byte RFC 8032
  public key in unpadded base64url (43 characters).
- `signature` is `{"format": "ed25519-jcs-v1", "value": B64}` with the 64-byte
  signature in unpadded base64url (86 characters).
- Base64url must be canonical: no padding, no whitespace, and unused bits in
  the last character are zero. Another spelling of the same bytes is refused.

## What is signed

```
message = UTF-8("ragbaz.gift.ed25519-jcs-v1\n") || JCS(envelope without "signature")
signature = Ed25519-Sign(sender private key, message)
```

`JCS` is RFC 8785, restricted to the subset gifts need: `null`, booleans,
safe integers (|n| ≤ 2^53 − 1), strings without lone surrogates, arrays and
objects, at most 32 levels deep. Members are sorted by UTF-16 code units.
Fractions, exponents, unsafe integers and lone surrogates are refused rather
than normalised. The canonical message is at most 256 KiB.

The domain separator binds the format and version, so these bytes cannot be
replayed as another protocol's or another version's message. Every other
envelope member is signed: `id`, `subject`, sender and recipient keys, the
artifact (its `sha256` for a reference, or the exact inline `text`), the
`invitation` with its choices, the `delivery_policy`, `issued_at` and
`expires_at`. Adding, removing or changing any of them invalidates the
signature; member order does not.

## Verification

A verifier returns success or one stable reason code, checked in this order:

1. **`malformed`**: not an object; an unknown top-level member; a missing
   `id`, `subject`, `sender_public_key`, `recipient_public_keys`, `artifact`,
   `signature`, `issued_at` or `expires_at`; a duplicate or empty recipient
   list (at most 100); times that are not `YYYY-MM-DDTHH:MM:SSZ` real dates,
   or `expires_at` not after `issued_at`, or a lifetime over 400 days.
2. **`unsupported_format`**: `signature.format` is not `ed25519-jcs-v1`.
3. **`invalid_key`**: a sender or recipient key with another format, a
   non-canonical encoding (y ≥ p), or one of the eight small-order points.
4. **`not_yet_valid`**: `issued_at` more than 300 seconds in the future.
5. **`expired`**: `expires_at` at or before now.
6. **`not_a_recipient`**: the verifying party named its own key and it is not
   listed.
7. **`bad_signature`**: a non-canonical signature encoding, a small-order or
   non-canonical R, S ≥ L, or a failing Ed25519 check.

This is strict verification in the sense of ed25519-dalek's `verify_strict`;
the JavaScript implementation adds the R and key checks WebCrypto does not do,
so both accept exactly the same signatures.

## What verification does not establish

A valid signature says that the holder of `sender_public_key` signed exactly
this envelope, now within its validity window, for the listed recipients. It
does **not** say who holds that key, that the sender may send it, that the
recipient key belongs to an account, that the gift was accepted, or that an
invitation's answer is authorised. Those need verified owner-issued key
bindings and the owning service's current policy (see [GIFTS.md](GIFTS.md)).

Replay within the validity window is the recipient's concern: an inbox keeps
gift IDs per recipient (as Dash's arrival stream does with
`(account_id, event_id)`) and ignores a repeated ID. Preserve the exact signed
envelope through sinks and replicas; forwarding must not re-sign it as the
forwarder.

## Changing the format

A new canonical form, algorithm or required member is a new
`signature.format` with its own domain separator and vectors, never a silent
change to `ed25519-jcs-v1`. Verifiers refuse formats they do not know.
