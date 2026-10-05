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
