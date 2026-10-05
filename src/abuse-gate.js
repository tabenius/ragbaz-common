// Abuse gate: bounded bodies, route circuit breakers, per-ticket attempt ceilings.
//
// Extracted from Mouseion src/identity/auth-gated.js. The intent is preserved
// exactly; the route set, limits and table prefix are now configuration.
//
// The invariant that must survive every edit: bucket keys are a hash of a route
// name only. They never derive from a handle, credential, account, pseudonym, IP
// or user agent. Caller-controlled input in a bucket key means an attacker can
// grow bucket cardinality until the rate limiter is useless.

import { readBoundedBody, REQUEST_BODY_TOO_LARGE } from './request-bounds.js';
import { sha256Base64url } from './crypto.js';

export const MAX_JSON_BYTES = 256 * 1024;
export const MAX_VERIFY_ATTEMPTS = 5;
export const WINDOW_MS = 60_000;

/**
 * Default limits. Deliberately high: these are circuit breakers against floods,
 * not per-person accounting. A limit low enough to notice one person retrying
 * would start recording that they are a person, which this design refuses to do
 * merely to survive NAT and privacy relays.
 */
export const DEFAULT_LIMITS = Object.freeze({
  'register/available': 900,
  'register/options': 300,
  'register/verify': 600,
  'login/options': 600,
  'login/verify': 1200,
  'logout': 600,
  'stepup/options': 600,
  'stepup/verify': 1200,
  // Recovery is where a guess is worth something, so it gets the tightest
  // breaker. The real defence is the code's entropy and single use; the low
  // ceiling stops a flood turning every attempt into a database write.
  recover: 120,
  'email/start': 120,
  'email/verify': 600,
  // The temporary grant creates an account, so it is metered like registration
  // rather than like a read. This key must match a route in the caller's table.
  'temporary': 300,
});

/**
 * Routes whose GET is still an oracle. `register/available` answers "does this
 * handle exist", and walking it enumerates the pseudonym list — the one thing a
 * pseudonymous platform cannot leak. It is the only GET with a breaker.
 */
export const RATE_LIMITED_GETS = Object.freeze(['register/available']);

function error(status, code, headers = {}) {
  return new Response(JSON.stringify({ error: code }), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff', ...headers },
  });
}

/**
 * Consume one token from a fixed-window, route-level breaker.
 *
 * Exactly one row per protected scope; crossing a minute boundary resets that
 * row rather than inserting a new one, so cardinality is bounded by the number
 * of limits, not by request volume.
 */
export async function takeRateToken(db, { table, scope, limit, nowMs = Date.now() }) {
  if (!limit || !Number.isInteger(limit) || limit < 1) return false;
  const windowStart = Math.floor(nowMs / WINDOW_MS) * WINDOW_MS;
  const bucketKey = await sha256Base64url(`route:${scope}`);
  const result = await db.prepare(
    `INSERT INTO ${table} (bucket_key, window_start, count)
     VALUES (?1, ?2, 1)
     ON CONFLICT(bucket_key) DO UPDATE SET
       window_start = excluded.window_start,
       count = CASE WHEN ${table}.window_start = excluded.window_start
                    THEN ${table}.count + 1 ELSE 1 END
     WHERE ${table}.window_start <> excluded.window_start OR ${table}.count < ?3`,
  ).bind(bucketKey, windowStart, limit).run();
  return Number(result?.meta?.changes || 0) === 1;
}

/** Cap verification attempts for the lifetime of a ticket, not a throttle. */
export async function consumeVerificationAttempt(db, { challenges, ticket, purpose, max = MAX_VERIFY_ATTEMPTS, now = new Date().toISOString() }) {
  if (!ticket) return { allowed: true, reason: 'missing_ticket' };
  const result = await db.prepare(
    `UPDATE ${challenges} SET verify_attempts = verify_attempts + 1
      WHERE id = ?1 AND purpose = ?2 AND expires_at > ?3 AND verify_attempts < ?4`,
  ).bind(ticket, purpose, now, max).run();
  if (Number(result?.meta?.changes || 0) === 1) return { allowed: true };
  const row = await db.prepare(`SELECT verify_attempts, expires_at FROM ${challenges} WHERE id = ?1 AND purpose = ?2`).bind(ticket, purpose).first();
  if (row && row.expires_at > now && Number(row.verify_attempts || 0) >= max) {
    return { allowed: false, reason: 'verification_attempts_exhausted' };
  }
  // Unknown or expired tickets are left to the caller so the canonical response
  // stays unknown_ticket/expired rather than leaking state through this guard.
  return { allowed: true, reason: 'not_active' };
}

/**
 * Gate one request.
 *
 * Returns a rewritten Request to continue with, a Response to refuse with, or
 * the original request when the path is not gated.
 */
export async function gateRequest(request, {
  env, prefix = '/auth', origin, db, tables, limits = DEFAULT_LIMITS,
  jsonRoutes = new Set(Object.keys(DEFAULT_LIMITS).filter(key => !key.endsWith('/available'))),
  maxBytes = MAX_JSON_BYTES,
  challengePurposes = { 'register/verify': 'register', 'login/verify': 'authenticate', 'stepup/verify': 'authenticate' },
}) {
  const parts = new URL(request.url).pathname.split('/').filter(Boolean);
  if (parts[0] !== prefix.replace(/^\//, '')) return request;
  const sub = parts.slice(1).join('/');

  if (request.method === 'POST' && request.headers.get('origin') !== origin) return error(403, 'bad_origin');

  let forwarded = request;
  let body = null;
  if (request.method === 'POST' && jsonRoutes.has(sub)) {
    let bytes;
    try { bytes = await readBoundedBody(request, maxBytes); }
    catch (e) {
      if (String(e?.message) === REQUEST_BODY_TOO_LARGE) return error(413, 'body_too_large');
      throw e;
    }
    forwarded = new Request(request, { body: bytes });
    try { body = JSON.parse(new TextDecoder().decode(bytes)); } catch { body = null; }
  }

  const limit = limits[sub];
  const breakerApplies = limit && (request.method === 'POST' || (request.method === 'GET' && RATE_LIMITED_GETS.includes(sub)));
  if (breakerApplies && db) {
    const allowed = await takeRateToken(db, { table: tables.buckets, scope: sub, limit });
    if (!allowed) return error(429, 'rate_limited', { 'retry-after': '60' });
  }

  // Pruning only runs behind an issuance breaker, so a rejected flood cannot
  // force repeated cleanup writes.
  if (request.method === 'POST' && db && /^(?:register|login|stepup|email)\/options$|^email\/start$/.test(sub)) {
    await db.prepare(`DELETE FROM ${tables.challenges} WHERE expires_at <= ?1`).bind(new Date().toISOString()).run();
  }

  const purpose = challengePurposes[sub];
  if (request.method === 'POST' && purpose && body?.ticket && body?.response) {
    const attempt = await consumeVerificationAttempt(db, {
      challenges: tables.challenges, ticket: body.ticket, purpose,
    });
    // A lifetime ceiling, not a temporary throttle: do not advertise Retry-After,
    // because the caller must start a fresh ceremony.
    if (!attempt.allowed) return error(429, 'verification_attempts_exhausted');
  }

  return forwarded;
}
