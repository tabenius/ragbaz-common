// Sessions: full accounts and short-lived temporary grants.
//
// The account half is extracted from Mouseion src/identity/auth.js. Preserved
// exactly: opaque random tokens, only SHA-256 digests stored, HttpOnly +
// SameSite=Lax, Secure when the origin is HTTPS, oldest-pseudonym resolution,
// and account status gating the session.
//
// Added: temporary sessions. These let someone draft something before they have
// verified anything. A temporary session carries an explicit scope list, expires
// quickly, and cannot reach account-level routes. Granting more scope is a
// deliberate act, never a side effect of using the site.
//
// See PROVENANCE.md.

import { newOpaqueToken, sha256Base64url } from './crypto.js';

export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
export const TEMPORARY_SESSION_TTL_MS = 60 * 60 * 1000;
export const STEP_UP_TTL_MS = 10 * 60 * 1000;

/** Scopes a temporary session may hold. Anything absent is refused. */
export const TEMPORARY_SCOPES = Object.freeze(['draft', 'upload', 'correspond']);

export function sessionCookieHeader({ cookie, token, origin, ttlMs = SESSION_TTL_MS }) {
  const secure = new URL(origin).protocol === 'https:' ? ' Secure;' : '';
  return `${cookie}=${token}; Path=/; HttpOnly;${secure} SameSite=Lax; Max-Age=${Math.floor(ttlMs / 1000)}`;
}

export function clearedSessionCookieHeader({ cookie, origin }) {
  const secure = new URL(origin).protocol === 'https:' ? ' Secure;' : '';
  return `${cookie}=; Path=/; HttpOnly;${secure} SameSite=Lax; Max-Age=0`;
}

/** The raw token from the request cookie, or null. */
export function readSessionToken(request, cookie) {
  const header = request.headers.get('cookie') || '';
  const escaped = cookie.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = header.match(new RegExp(`(?:^|;\\s*)${escaped}=([^;]+)`));
  return match ? decodeURIComponent(match[1]) : null;
}

/** Insert a session row and return the token to hand its owner. */
export async function mintSession(db, {
  table, accountId, temporary = false, scopes = [], userAgent = '', now = new Date().toISOString(),
}) {
  const { token, hash } = await newOpaqueToken();
  const granted = temporary ? [...new Set(scopes)].filter(scope => TEMPORARY_SCOPES.includes(scope)) : [];
  if (temporary && !granted.length) throw new Error('temporary_session_needs_scope');
  const ttl = temporary ? TEMPORARY_SESSION_TTL_MS : SESSION_TTL_MS;
  await db.prepare(
    `INSERT INTO ${table} (id, account_id, temporary, scopes_json, user_agent, created_at, last_seen_at, expires_at)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?6, ?7)`,
  ).bind(hash, accountId, temporary ? 1 : 0, JSON.stringify(granted), String(userAgent || '').slice(0, 300), now,
    new Date(Date.parse(now) + ttl).toISOString()).run();
  return { token, hash, expiresAt: new Date(Date.parse(now) + ttl).toISOString(), scopes: granted };
}

/**
 * Resolve a session to its account and oldest pseudonym, or null.
 *
 * The returned object is an allowlist, built field by field. A database row is
 * never spread into a response: this is where an email digest or an internal id
 * would otherwise leak.
 */
export async function resolveSession(db, request, { table, accounts, pseudonyms, cookie, now = new Date().toISOString() }) {
  const token = readSessionToken(request, cookie);
  if (!token) return null;
  const id = await sha256Base64url(token);
  const row = await db.prepare(
    `SELECT s.account_id, s.temporary, s.scopes_json, s.elevated_until, s.expires_at, a.status,
            p.id AS pseudonym_id, p.handle, p.display_name
       FROM ${table} s
       JOIN ${accounts} a ON a.id = s.account_id
       LEFT JOIN ${pseudonyms} p ON p.id = (
         SELECT p2.id FROM ${pseudonyms} p2
          WHERE p2.account_id = s.account_id
          ORDER BY p2.created_at ASC, p2.id ASC
          LIMIT 1)
      WHERE s.id = ?1`,
  ).bind(id).first();
  if (!row || row.status !== 'active' || row.expires_at <= now) return null;
  let scopes = [];
  try { scopes = JSON.parse(row.scopes_json || '[]'); } catch { scopes = []; }
  return {
    accountId: row.account_id,
    pseudonymId: row.pseudonym_id ?? null,
    handle: row.handle ?? null,
    displayName: row.display_name ?? null,
    temporary: Boolean(row.temporary),
    scopes,
    elevatedUntil: row.elevated_until ?? null,
    expiresAt: row.expires_at,
  };
}

/** True when the session holds every requested scope. */
export function hasScope(session, scope) {
  if (!session) return false;
  if (!session.temporary) return true;
  return session.scopes.includes(scope);
}

/** True when a fresh factor check happened inside the step-up window. */
export function isElevated(session, now = new Date().toISOString()) {
  return Boolean(session?.elevatedUntil && session.elevatedUntil > now);
}

/**
 * The public view of a session. Deliberately thin: an id, a handle, whether the
 * person has verified anything, and what they may currently do. No account id,
 * no email state, no internal ids.
 */
export function publicSession(session, { verification = 'unknown', profileBase = '/p/' } = {}) {
  if (!session) return { authenticated: false, temporary: false, scopes: [], verification };
  return {
    authenticated: true,
    temporary: session.temporary,
    scopes: session.scopes,
    verification,
    handle: session.handle,
    displayName: session.displayName,
    profileUrl: session.handle ? `${profileBase}${session.handle}` : null,
    elevatedUntil: session.elevatedUntil,
  };
}
