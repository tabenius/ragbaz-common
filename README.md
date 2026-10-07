# ragbaz-common

Shared, dependency-light components for RAGBAZ Cloudflare Workers. One
implementation, several products: the museum, the gifts/artifacts worker, and
future sites should not each grow their own login, pseudonym rules or abuse
gate.

Read `AGENTS.md` first, then `PROVENANCE.md` for what was extracted from where.

## Why this exists

Mouseion (and before it Elias.Venn / survivors.se) already solved the hard parts
of pseudonymous identity: passkey-only authentication, opaque WebAuthn user
handles, session tokens stored only as SHA-256 hashes, recovery codes, and a
route-level abuse gate whose bucket keys never derive from caller input. That
code is a proven design, but it lives inside one product and assumes one schema.

This package keeps those decisions and removes the coupling. It also adds the
capabilities the gifts platform needs and Mouseion deliberately does not have:
anonymous accounts verified by email, Cloudflare Turnstile for human
verification, and short-lived temporary sessions.

## What is here

| Module | Purpose |
|---|---|
| `crypto.js` | WebCrypto helpers: base64url, random ids, SHA-256/HMAC, session tokens, recovery codes, AES-GCM secrets |
| `handles.js` | Pseudonym handle rules, with per-deployment reserved names |
| `webauthn.js` | Registration/authentication ceremonies via `@simplewebauthn/server` |
| `turnstile.js` | Server-side Turnstile verification with explicit fail-closed policy |
| `email-code.js` | Email verification codes: hashed at rest, single use, attempt-capped |
| `sessions.js` | Session minting, cookie policy, resolution, temporary-session grants |
| `abuse-gate.js` | Bounded bodies, route-level circuit breakers, per-ticket attempt ceilings |
| `identity.js` | `createIdentity(config)` — the facade a product wires into its Worker |
| `schema.sql` | The database a product applies to its own D1 database |

Every module is parameterised. Nothing in `src/` imports a product's config,
reads a hard-coded origin, or assumes a table prefix.

## Using it

```js
import { createIdentity } from './vendor/ragbaz-common/src/identity.js';

const identity = createIdentity({
  origin: 'https://gifts.ragbaz.cc',
  rpName: 'RAGBAZ Gifts',
  cookie: 'gifts_session',
  tablePrefix: 'gift',
  env: { DB: env.IDENTITY_DB, IDENTITY_HASH_KEY: env.IDENTITY_HASH_KEY },
  turnstile: env.TURNSTILE_SECRET_KEY ? { secretKey: env.TURNSTILE_SECRET_KEY } : null,
  emailSender: { send: (message) => env.MAIL.send(message) },
});

export default {
  fetch: (request, env, ctx) => identity.handle(request, env, ctx),
};
```

`identity.handle()` routes `/auth/*` and returns `null` for everything else, so
it composes with an existing router instead of replacing it. Apply
`schema.sql` to the database named by `env.DB`.

## Design commitments

These are inherited from Elias.Venn and are deliberate, not oversights:

- **Passkeys only for the passkey path.** No passwords, no TOTP. A shared secret
  typed into the same page is a downgrade when the first factor is already
  phishing-resistant hardware.
- **Security identity is separate from public identity.** Login binds to a random
  internal account id. The public handle lives on a pseudonym and is the only
  thing that appears publicly. A deployment may map accounts to pseudonyms; a
  public view must never join them.
- **Anonymous accounts are first class.** An account may have no public identity
  at all. "Unpublished" is a normal state, not an error state.
- **Email is a verification channel, not a public identity.** Verified addresses
  stay in the account's private record. They are never published, never used as
  a handle, and never exposed to another account.
- **Turnstile is additive and optional per deployment.** When configured, it is
  checked server-side and fails closed. It never replaces rate limiting.
- **Refusals stay distinct.** 400, 401, 403, 409, 413, 429 and 503 mean different
  things and must not collapse into a generic error.

## Checks

```sh
npm ci
npm test
```

The suite runs against real SQLite, not mocks. It covers ceremony replay,
handle enumeration, scope escalation attempts, email code reuse, temporary-session
expiry, Turnstile refusal paths, and the guarantee that no public projection can
leak an email address or an internal account id.

## Adoption status

| Product | State |
|---|---|
| Gifts/artifacts Worker (`ragbaz-cf-template/extensions/artifacts`) | consumes this package |
| Mouseion | still on its in-repo `src/identity/`; migration documented in `ADOPTION.md`, not yet performed |
| ragbaz-cf-template core | untouched; this package is additive |

Do not silently refactor a product to use this package. Read `ADOPTION.md`, then
do it as a reviewed change in that product's repository with its own task.

## Fragment artifact protocol (0.1 draft)

[packages/fragment](packages/fragment/README.md) adds an independently built Rust
and JavaScript artifact library: readable YAML/JSON, a shared schema, capability
constraints, exact themes, templates, keyboard/completion widgets, and an offline
A4 HTML preview. Its dependencies are isolated from the Worker identity package.
The sample renderer is in `packages/fragment/examples/`; no product page rendering
was added to the shared identity `src/`.

```sh
cd packages/fragment
npm ci
npm run build
# Open dist/fragment-preview.html
```

## Cooperation across sessions

[AGENTS.md](AGENTS.md) defines the shared cooperation protocol for the user and
participating agents: identity, authority, task ownership, attributable expressions,
evidence, disagreements, acknowledgements and handoffs. Task records use unique
paths under `coordination/`; Git and PRs provide asynchronous exchange. This is a
versioned convention, not a running messaging service or terminal connection.
