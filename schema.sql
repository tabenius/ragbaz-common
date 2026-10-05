-- ragbaz-common: identity baseline for a fresh database.
--
-- Derived from Mouseion migrations/0001_identity.sql (itself adopted from
-- Elias.Venn 0001/0003/0008/0009, minus TOTP). See PROVENANCE.md.
--
-- Products apply this to their own D1 database with their own table prefix.
-- Fresh install only: a product that already deployed an equivalent schema
-- keeps its migration history and alters forward instead.
--
-- The account/pseudonym split is the point. Login binds to a random internal
-- account id; the public handle lives on a pseudonym and is the only identity
-- that may appear publicly. Email exists only as a keyed digest on the account.

PRAGMA foreign_keys = ON;

-- A table-prefixed migration is produced from this by substituting the marker
-- below. Run scripts/prefix-migration.mjs with the prefix you intend to use.
-- See scripts/prefix-migration.mjs.

CREATE TABLE {P}accounts (
  id                   TEXT PRIMARY KEY,
  webauthn_user_handle TEXT UNIQUE,          -- opaque, never public, nullable for email-only accounts
  status               TEXT NOT NULL DEFAULT 'active'
                         CHECK (status IN ('active', 'suspended', 'deleted')),
  -- How much this account has proved. Escalation is one-way within a status.
  verification         TEXT NOT NULL DEFAULT 'anonymous'
                         CHECK (verification IN ('anonymous', 'email', 'passkey', 'both')),
  created_at           TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at           TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  -- A real name is never stored here. Public identity lives on a pseudonym.
  -- Any account claiming a passkey must actually carry the opaque user handle
  -- that identifies the credential; without it, login could never resolve an
  -- account and the row would be a permanently unreachable account.
  CHECK (verification IN ('anonymous', 'email') OR webauthn_user_handle IS NOT NULL)
);

CREATE TABLE {P}pseudonyms (
  id           TEXT PRIMARY KEY,
  account_id   TEXT NOT NULL REFERENCES {P}accounts (id) ON DELETE CASCADE,
  handle       TEXT NOT NULL UNIQUE,          -- normalized; the public segment
  display_name TEXT NOT NULL,
  bio          TEXT,
  created_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX idx_{P}pseudonyms_account ON {P}pseudonyms (account_id);

-- Verified email addresses, stored only as keyed HMAC digests. There is no
-- plaintext column, by design: a database dump cannot become a mailing list.
CREATE TABLE {P}email_bindings (
  id          TEXT PRIMARY KEY,
  account_id  TEXT NOT NULL REFERENCES {P}accounts (id) ON DELETE CASCADE,
  email_hash  TEXT NOT NULL UNIQUE,           -- HMAC(normalized address)
  verified_at TEXT NOT NULL,
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  revoked_at  TEXT
);
CREATE INDEX idx_{P}email_account ON {P}email_bindings (account_id) WHERE revoked_at IS NULL;

-- In-flight verification codes. code_hash is keyed; plaintext is never stored.
CREATE TABLE {P}email_challenges (
  id               TEXT PRIMARY KEY,
  account_id       TEXT REFERENCES {P}accounts (id) ON DELETE CASCADE,
  email_hash       TEXT NOT NULL,
  code_hash        TEXT NOT NULL,
  verify_attempts  INTEGER NOT NULL DEFAULT 0 CHECK (verify_attempts >= 0),
  created_at       TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  expires_at       TEXT NOT NULL
);
CREATE INDEX idx_{P}email_challenges_expiry ON {P}email_challenges (expires_at);

CREATE TABLE {P}passkeys (
  id            TEXT PRIMARY KEY,
  account_id    TEXT NOT NULL REFERENCES {P}accounts (id) ON DELETE CASCADE,
  credential_id TEXT NOT NULL UNIQUE,
  public_key    TEXT NOT NULL,
  sign_count    INTEGER NOT NULL DEFAULT 0,
  transports    TEXT,
  aaguid        TEXT,
  nickname      TEXT,
  created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  last_used_at  TEXT,
  revoked_at    TEXT
);
CREATE INDEX idx_{P}passkeys_account ON {P}passkeys (account_id);
CREATE INDEX idx_{P}passkeys_account_active ON {P}passkeys (account_id) WHERE revoked_at IS NULL;

CREATE TABLE {P}recovery_codes (
  id         TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES {P}accounts (id) ON DELETE CASCADE,
  code_hash  TEXT NOT NULL,
  used_at    TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX idx_{P}recovery_account ON {P}recovery_codes (account_id);

-- id is the SHA-256 of the opaque token; the token itself is never stored.
-- temporary = 1 means a short-lived, scope-limited grant for someone who has
-- not verified anything. Its scopes are an explicit allowlist, never "everything".
CREATE TABLE {P}sessions (
  id             TEXT PRIMARY KEY,
  account_id     TEXT NOT NULL REFERENCES {P}accounts (id) ON DELETE CASCADE,
  temporary      INTEGER NOT NULL DEFAULT 0 CHECK (temporary IN (0, 1)),
  scopes_json    TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(scopes_json)),
  user_agent     TEXT,
  ip_hash        TEXT,
  elevated_until TEXT,
  created_at     TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  last_seen_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  expires_at     TEXT NOT NULL,
  CHECK (temporary = 1 OR scopes_json = '[]')
);
CREATE INDEX idx_{P}sessions_account ON {P}sessions (account_id);
CREATE INDEX idx_{P}sessions_expires ON {P}sessions (expires_at);

CREATE TABLE {P}webauthn_challenges (
  id              TEXT PRIMARY KEY,
  purpose         TEXT NOT NULL CHECK (purpose IN ('register', 'authenticate')),
  challenge       TEXT NOT NULL,
  handle          TEXT,
  display_name    TEXT,
  user_handle     TEXT,
  account_id      TEXT REFERENCES {P}accounts (id) ON DELETE CASCADE,
  verify_attempts INTEGER NOT NULL DEFAULT 0 CHECK (verify_attempts >= 0),
  created_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  expires_at      TEXT NOT NULL
);
CREATE INDEX idx_{P}webauthn_expiry ON {P}webauthn_challenges (expires_at);
CREATE INDEX idx_{P}webauthn_purpose ON {P}webauthn_challenges (purpose, expires_at);

-- Route-level circuit breakers. Keys are a hash of a route name only: never a
-- handle, credential, account, IP or user agent.
CREATE TABLE {P}auth_rate_buckets (
  bucket_key   TEXT PRIMARY KEY,
  window_start INTEGER NOT NULL,
  count        INTEGER NOT NULL DEFAULT 1 CHECK (count >= 0)
);

-- Internal security log. Never public. A product's content history is its own
-- concern, not this table's.
CREATE TABLE {P}audit_events (
  id           TEXT PRIMARY KEY,
  account_id   TEXT REFERENCES {P}accounts (id) ON DELETE SET NULL,
  pseudonym_id TEXT REFERENCES {P}pseudonyms (id) ON DELETE SET NULL,
  action       TEXT NOT NULL,
  detail       TEXT,
  ip_hash      TEXT,
  passkey_id   TEXT,
  session_id   TEXT,
  created_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX idx_{P}audit_account ON {P}audit_events (account_id, created_at);

CREATE TRIGGER {P}audit_events_append_only_u BEFORE UPDATE ON {P}audit_events
BEGIN SELECT RAISE(ABORT, 'audit_events is append-only'); END;
CREATE TRIGGER {P}audit_events_append_only_d BEFORE DELETE ON {P}audit_events
BEGIN SELECT RAISE(ABORT, 'audit_events is append-only'); END;

-- Guards that encode the design decisions, so a careless INSERT cannot undo them.
-- 1. A temporary session must declare at least one scope.
CREATE TRIGGER {P}temporary_session_needs_scope
BEFORE INSERT ON {P}sessions WHEN NEW.temporary = 1
 AND json_array_length(NEW.scopes_json) = 0
BEGIN SELECT RAISE(ABORT, 'temporary_session_needs_scope'); END;

-- 2. Verification is monotonic. Downgrading an account must go through status,
--    not by rewriting the verification column.
CREATE TRIGGER {P}verification_never_downgrades
BEFORE UPDATE OF verification ON {P}accounts
 WHEN CASE NEW.verification
        WHEN 'anonymous' THEN 0 WHEN 'email' THEN 1
        WHEN 'passkey'   THEN 2 WHEN 'both'     THEN 3
      END < CASE OLD.verification
        WHEN 'anonymous' THEN 0 WHEN 'email' THEN 1
        WHEN 'passkey'   THEN 2 WHEN 'both'     THEN 3
      END
BEGIN SELECT RAISE(ABORT, 'verification_is_monotonic'); END;

-- 3. Only one unverified email binding per account, so "verified" is unambiguous.
CREATE TRIGGER {P}single_verified_email
BEFORE INSERT ON {P}email_bindings
WHEN NEW.revoked_at IS NULL AND EXISTS (
  SELECT 1 FROM {P}email_bindings
   WHERE account_id = NEW.account_id AND revoked_at IS NULL
)
BEGIN SELECT RAISE(ABORT, 'account_already_has_verified_email'); END;
