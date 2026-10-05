# AGENTS.md: working in ragbaz-common

Read `README.md` and `PROVENANCE.md` before changing anything. This package is
consumed by other repositories, so a change here is a change to more than one
product.

## Scope

`src/` holds the shared implementation. `tests/` must run without a network
connection and without a real D1 binding. Do not add product-specific policy,
routes, page rendering or secrets to `src/`; put those in the consuming product.

## Invariants

1. **No product coupling.** Nothing in `src/` may import from a product repo,
   hard-code an origin, a cookie name, a table prefix or a database name. All of
   those are configuration.
2. **Extraction is a move, not a copy.** When logic arrives from a product, that
   product must stop owning it. Two copies of an authentication rule will drift
   into two different security postures. `PROVENANCE.md` records the origin;
   `ADOPTION.md` records the removal.
3. **Cryptographic verification is delegated.** WebAuthn attestation parsing and
   signature checks go through `@simplewebauthn/server`. Do not hand-roll them.
   This package is an adapter around a reviewed library, not a replacement.
4. **Secrets stay hashed at rest.** Session tokens, recovery codes and email
   verification codes are stored only as SHA-256 (or keyed HMAC) digests. Plain
   text exists only in the response that hands the value to its owner.
5. **Bucket keys never derive from caller input.** Abuse-gate keys are hashes of
   a route name only. Never key a rate limit on a handle, account id, IP, user
   agent or credential, or attacker-chosen values will grow bucket cardinality.
6. **Refusals stay distinct and minimal.** 400 malformed, 401 unauthenticated,
   403 forbidden, 409 conflict, 413 too large, 429 limited, 503 unavailable. An
   error response must not reveal whether a private resource exists.
7. **Public projections are explicit allowlists.** Any function that renders
   public identity data must construct its output from named fields. Never
   spread a database row into a response.
8. **Email verification is not consent to publish.** Verified addresses enable
   account recovery and abuse resistance only. Product-level publication
   permission is a separate, separately recorded decision.
9. **Same-origin writes.** Every state-changing route requires `Origin` to match
   the configured origin, checked in this package rather than at each call site.
10. **Schema changes are additive and migrations are immutable after deploy.**
    Never edit an applied migration. `schema.sql` is a fresh-install baseline;
    products that already deployed Mouseion's tables keep their own migration
    history and add columns separately.

## Checks

```sh
npm ci
npm test
```

Tests must use real SQLite so triggers, foreign keys and check constraints are
actually exercised. A test that would pass against a stub is not testing the
invariant. New refusal behaviour needs a refusal test.

## Coordination

Use `ragbaz-frog` for tasks and locks, like the other RAGBAZ repositories.

```bash
frog repo discover --root .
frog task create --repo ragbaz-common --slug rc-<name> --title "…" --why "…" --what "…"
frog task claim <slug> --agent <agent> --file src/foo.js
```

Never commit secrets. Never widen a task silently. A change that alters a public
contract must update `README.md` and, when it changes meaning rather than adding,
say so explicitly in the changelog section of `PROVENANCE.md`.
