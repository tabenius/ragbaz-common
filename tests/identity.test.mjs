import test from 'node:test';
import assert from 'node:assert/strict';
import { createIdentity } from '../src/identity.js';
import { SqliteD1, loadSchema } from './support.mjs';
import { randomBytes } from '../src/crypto.js';

const ORIGIN = 'https://gifts.ragbaz.cc';
const KEY = Buffer.from(Array.from({ length: 32 }, (_, i) => (i * 31 + 7) % 256)).toString('base64url');
const HASH_KEY = Buffer.from(randomBytes(32)).toString('base64url');

async function harness(options = {}) {
  const DB = new SqliteD1(await loadSchema('gift'));
  const sent = [];
  const identity = createIdentity({
    origin: ORIGIN, rpName: 'RAGBAZ Gifts', cookie: 'gifts_session', tablePrefix: 'gift',
    reservedHandles: ['admin', 'root', 'auth', 'api'],
    emailSender: { send: message => { sent.push(message); } },
    ...options,
  });
  const env = { DB, IDENTITY_HASH_KEY: HASH_KEY };
  const call = (path, { method = 'POST', body, cookie, origin = ORIGIN } = {}) => identity.handle(new Request(
    ORIGIN + path, {
      method,
      headers: {
        origin,
        ...(body !== undefined ? { 'content-type': 'application/json' } : {}),
        ...(cookie ? { cookie } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    },
  ), env);
  const get = (path, options) => call(path, { ...options, method: 'GET' });
  return { DB, identity, env, call, get, sent };
}

const cookieFrom = response => {
  const header = response.headers.get('set-cookie');
  assert.ok(header, 'expected a session cookie');
  return header.split(';')[0];
};

// ---- schema guarantees ------------------------------------------------------

test('the schema refuses a temporary session with no scope', async () => {
  const { DB } = await harness();
  await DB.prepare(`INSERT INTO gift_accounts (id) VALUES ('acc_1')`).run();
  await assert.rejects(() => DB.prepare(
    `INSERT INTO gift_sessions (id, account_id, temporary, scopes_json, expires_at) VALUES ('h','acc_1',1,'[]','2030')`,
  ).run(), /temporary_session_needs_scope/);
  // The same row with a scope is accepted, so the trigger is not simply broken.
  await DB.prepare(
    `INSERT INTO gift_sessions (id, account_id, temporary, scopes_json, expires_at) VALUES ('h','acc_1',1,'["draft"]','2030')`,
  ).run();
  // A full session must not carry scopes: that would be a grant waiting to happen.
  await assert.rejects(() => DB.prepare(
    `INSERT INTO gift_sessions (id, account_id, temporary, scopes_json, expires_at) VALUES ('h2','acc_1',0,'["upload"]','2030')`,
  ).run(), /CHECK constraint failed/);
});

test('verification cannot be downgraded by rewriting the column', async () => {
  const { DB } = await harness();
  // 'passkey' and 'both' both require an opaque user handle (see the next test).
  await DB.prepare(`INSERT INTO gift_accounts (id, verification, webauthn_user_handle) VALUES ('acc_1','both','uh_1')`).run();
  await assert.rejects(() => DB.prepare(`UPDATE gift_accounts SET verification = 'anonymous' WHERE id='acc_1'`).run(),
    /verification_is_monotonic/);
  await assert.rejects(() => DB.prepare(`UPDATE gift_accounts SET verification = 'email' WHERE id='acc_1'`).run(),
    /verification_is_monotonic/);
  await assert.rejects(() => DB.prepare(`UPDATE gift_accounts SET verification = 'passkey' WHERE id='acc_1'`).run(),
    /verification_is_monotonic/);
  // An unrelated column is untouched by the guard.
  await DB.prepare(`UPDATE gift_accounts SET status = 'suspended' WHERE id='acc_1'`).run();
  await DB.prepare(`INSERT INTO gift_accounts (id, verification) VALUES ('acc_2','anonymous')`).run();
  await DB.prepare(`UPDATE gift_accounts SET verification = 'email' WHERE id='acc_2'`).run();
  await assert.rejects(() => DB.prepare(`UPDATE gift_accounts SET verification = 'anonymous' WHERE id='acc_2'`).run(),
    /verification_is_monotonic/);
});

test('a passkey-verified account cannot exist without a user handle', async () => {
  const { DB } = await harness();
  await assert.rejects(() => DB.prepare(`INSERT INTO gift_accounts (id, verification) VALUES ('acc_1','passkey')`).run(),
    /CHECK constraint failed/);
  await DB.prepare(`INSERT INTO gift_accounts (id, verification, webauthn_user_handle) VALUES ('acc_1','passkey','uh_1')`).run();
});

test('an account may hold only one unverified email binding at a time', async () => {
  const { DB } = await harness();
  await DB.prepare(`INSERT INTO gift_accounts (id) VALUES ('acc_1')`).run();
  await DB.prepare(`INSERT INTO gift_email_bindings (id, account_id, email_hash, verified_at) VALUES ('emb_1','acc_1','h1','now')`).run();
  await assert.rejects(() => DB.prepare(
    `INSERT INTO gift_email_bindings (id, account_id, email_hash, verified_at) VALUES ('emb_2','acc_1','h2','now')`,
  ).run(), /account_already_has_verified_email/);
  // Revoking first makes room, which is how an address change works.
  await DB.prepare(`UPDATE gift_email_bindings SET revoked_at='now' WHERE id='emb_1'`).run();
  await DB.prepare(`INSERT INTO gift_email_bindings (id, account_id, email_hash, verified_at) VALUES ('emb_2','acc_1','h2','now')`).run();
});

test('the audit log is append-only', async () => {
  const { identity, env } = await harness();
  await identity._internal.audit(env, { action: 'test.record', accountId: null });
  await assert.rejects(() => env.DB.prepare(`UPDATE gift_audit_events SET action='changed'`).run(), /append-only/);
  await assert.rejects(() => env.DB.prepare(`DELETE FROM gift_audit_events`).run(), /append-only/);
});

// ---- temporary sessions -----------------------------------------------------

test('a temporary session grants explicit scopes and never leaks internals', async () => {
  const { call, get, identity, DB } = await harness();
  const started = await call('/auth/temporary', { body: { scopes: ['draft', 'upload'] } });
  assert.equal(started.status, 202);
  const payload = await started.json();
  assert.equal(payload.temporary, true);
  assert.deepEqual(payload.scopes, ['draft', 'upload']);
  assert.equal(payload.verification, 'anonymous');
  assert.ok(payload.handle, 'a temporary account still receives a public handle');

  const cookie = cookieFrom(started);
  const session = await get('/auth/session', { cookie });
  const view = await session.json();
  assert.equal(view.authenticated, true);
  assert.equal(view.temporary, true);
  assert.deepEqual(view.scopes, ['draft', 'upload']);
  assert.equal(view.verification, 'anonymous');
  const serialized = JSON.stringify(view);
  assert.ok(!serialized.includes('acc_'), 'internal account id must not appear');
  assert.ok(!serialized.includes('psd_'), 'internal pseudonym id must not appear');

  const row = await DB.prepare(`SELECT id FROM gift_sessions WHERE temporary = 1`).first();
  assert.ok(row, 'the session row exists and is keyed by digest, not token');
  const [name, value] = cookie.split('=');
  assert.notEqual(value, row.id, 'the cookie carries the token; the table stores its digest');
  assert.equal(identity.sessions.hasScope(await identity.sessions.resolve(
    new Request(ORIGIN + '/auth/session', { headers: { cookie } }), { DB }), 'upload'), true);
  assert.equal(identity.sessions.hasScope(await identity.sessions.resolve(
    new Request(ORIGIN + '/auth/session', { headers: { cookie } }), { DB }), 'correspond'), false);
});

test('a temporary session with no scopes is refused', async () => {
  const { call } = await harness();
  assert.equal((await call('/auth/temporary', { body: { scopes: [] } })).status, 400);
  assert.equal((await call('/auth/temporary', { body: {} })).status, 400);
});

test('turnstile can gate the temporary-session start and fails closed', async () => {
  const withCaptcha = await harness({ turnstile: { secretKey: 'secret' } });
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => Response.json({ success: true });
  try {
    const ok = await withCaptcha.call('/auth/temporary', { body: { scopes: ['draft'], turnstile_token: 'tok' } });
    assert.equal(ok.status, 202);
    const refused = await withCaptcha.call('/auth/temporary', { body: { scopes: ['draft'] } });
    assert.equal(refused.status, 400, 'a missing token must not create a session');
    assert.equal((await refused.json()).error, 'human_verification_failed');
  } finally { globalThis.fetch = originalFetch; }

  const failing = await harness({ turnstile: { secretKey: 'secret' } });
  globalThis.fetch = async () => { throw new Error('cloudflare down'); };
  try {
    // Cannot check the human: must not read as "no check needed".
    assert.equal((await failing.call('/auth/temporary', { body: { scopes: ['draft'], turnstile_token: 't' } })).status, 503);
  } finally { globalThis.fetch = originalFetch; }
});

test('without a turnstile secret the start is ungated, and that is a product choice', async () => {
  const { call } = await harness();
  assert.equal((await call('/auth/temporary', { body: { scopes: ['draft'] } })).status, 202);
});

// ---- email verification -----------------------------------------------------

async function startEmail(h, email = 'person@example.org') {
  const started = await h.call('/auth/email/start', { body: { email } });
  assert.equal(started.status, 202);
  const row = await h.DB.prepare(
    `SELECT id, code_hash FROM gift_email_challenges ORDER BY created_at DESC, id DESC LIMIT 1`).first();
  // The plaintext code left the application only through the sender.
  const sent = h.sent.at(-1);
  assert.equal(sent.to, email);
  const code = sent.text.match(/code for .* is (\d{6})/)[1];
  assert.ok(!JSON.stringify(await started.clone().json()).includes(email), 'the response must not echo the address');
  return { row, code };
}

test('a verified address is proved and the address itself is never stored', async () => {
  const h = await harness();
  const { row, code } = await startEmail(h);
  // Scan every table an address could hide in. UNION needs matching shapes, so
  // project one column rather than SELECT *.
  const stored = JSON.stringify(h.DB.raw.prepare(
    `SELECT email_hash FROM gift_email_bindings
     UNION ALL SELECT email_hash FROM gift_email_challenges`).all());
  assert.ok(!stored.includes('person@example.org'), 'no plaintext address in the database');

  const wrong = await h.call('/auth/email/verify', { body: { challenge_id: row.id, code: code === '000000' ? '111111' : '000000' } });
  assert.equal(wrong.status, 400);
  assert.equal((await wrong.json()).error, 'invalid_code');

  const verified = await h.call('/auth/email/verify', { body: { challenge_id: row.id, code } });
  assert.equal(verified.status, 200);
  const view = await verified.json();
  assert.equal(view.verification, 'email');
  assert.ok(!JSON.stringify(view).includes('person@example.org'));
  assert.ok(!JSON.stringify(view).includes('acc_'));
  assert.equal((await h.DB.prepare(`SELECT COUNT(*) c FROM gift_email_challenges WHERE id=?1`).bind(row.id).first()).c, 0);
});

test('an email code is single use', async () => {
  const h = await harness();
  const { row, code } = await startEmail(h);
  assert.equal((await h.call('/auth/email/verify', { body: { challenge_id: row.id, code } })).status, 200);
  const replay = await h.call('/auth/email/verify', { body: { challenge_id: row.id, code } });
  assert.equal(replay.status, 400);
  assert.equal((await replay.json()).error, 'unknown_challenge');
});

test('an email code has a lifetime attempt ceiling, not just a rate limit', async () => {
  const h = await harness();
  const { row } = await startEmail(h);
  let last;
  for (let attempt = 0; attempt < 6; attempt++) {
    last = await h.call('/auth/email/verify', { body: { challenge_id: row.id, code: '999999' } });
    if (last.status === 429) break;
  }
  assert.equal(last.status, 429);
  assert.equal((await last.json()).error, 'verification_attempts_exhausted');
  assert.equal((await h.DB.prepare(`SELECT COUNT(*) c FROM gift_email_challenges WHERE id=?1`).bind(row.id).first()).c, 0);
});

test('an expired email code is refused and consumed', async () => {
  const h = await harness();
  const { row } = await startEmail(h);
  await h.DB.prepare(`UPDATE gift_email_challenges SET expires_at = '2000-01-01T00:00:00.000Z' WHERE id = ?1`).bind(row.id).run();
  const expired = await h.call('/auth/email/verify', { body: { challenge_id: row.id, code: '123456' } });
  assert.equal(expired.status, 400);
  assert.equal((await expired.json()).error, 'expired');
});

test('a malformed address is refused without creating an account', async () => {
  const h = await harness();
  for (const email of ['', 'nope', 'a@b', 'a b@c.org']) {
    const response = await h.call('/auth/email/start', { body: { email } });
    assert.equal(response.status, 400, email);
    assert.equal((await response.json()).error, 'invalid_email');
  }
  assert.equal((await h.DB.prepare(`SELECT COUNT(*) c FROM gift_accounts`).first()).c, 0);
  assert.equal((await h.DB.prepare(`SELECT COUNT(*) c FROM gift_audit_events`).first()).c, 0);
});

test('verification without a hash key is a configuration failure, not a bypass', async () => {
  const DB = new SqliteD1(await loadSchema('gift'));
  const identity = createIdentity({
    origin: ORIGIN, rpName: 'x', cookie: 'gifts_session', tablePrefix: 'gift',
  });
  const response = await identity.handle(new Request(ORIGIN + '/auth/email/start', {
    method: 'POST', headers: { origin: ORIGIN, 'content-type': 'application/json' },
    body: JSON.stringify({ email: 'a@b.org' }),
  }), { DB });
  assert.equal(response.status, 503);
});

// ---- handles and enumeration ------------------------------------------------

test('handle availability does not distinguish reserved from taken', async () => {
  const h = await harness();
  await h.DB.prepare(`INSERT INTO gift_accounts (id) VALUES ('acc_1')`).run();
  await h.DB.prepare(`INSERT INTO gift_pseudonyms (id, account_id, handle, display_name) VALUES ('psd_1','acc_1','taken','Taken')`).run();

  const reserved = await (await h.get('/auth/available?handle=admin')).json();
  const taken = await (await h.get('/auth/available?handle=taken')).json();
  const free = await (await h.get('/auth/available?handle=freehandle')).json();
  assert.equal(reserved.available, false);
  assert.equal(taken.available, false);
  assert.equal(free.available, true);
  assert.equal(reserved.reason, taken.reason, 'the two unavailable reasons must be identical');

  // A malformed handle is refused. 'double-dot' is reported precisely because it
  // reveals nothing about the namespace: only format says anything about the input.
  for (const [bad, reason] of [['ab', 'format'], ['.x', 'format'], ['has space', 'format'], ['has@at', 'format'], ['has..dots', 'unavailable']]) {
    const response = await (await h.get(`/auth/available?handle=${encodeURIComponent(bad)}`)).json();
    assert.equal(response.available, false, bad);
    assert.equal(response.reason, reason, bad);
  }
});

// ---- routing, origin and method discipline ---------------------------------

test('writes from another origin are refused', async () => {
  const h = await harness();
  for (const path of ['/auth/temporary', '/auth/email/start', '/auth/logout', '/auth/login/options']) {
    const response = await h.call(path, { body: { scopes: ['draft'] }, origin: 'https://evil.test' });
    assert.equal(response.status, 403, path);
    assert.equal((await response.json()).error, 'bad_origin');
  }
});

test('paths outside /auth are left to the product router', async () => {
  const h = await harness();
  for (const path of ['/', '/gifts/', '/auth', '/api/v1/things']) {
    assert.equal(await h.identity.handle(new Request(ORIGIN + path), h.env), null, path);
  }
});

test('unknown auth routes and wrong methods stay distinct', async () => {
  const h = await harness();
  assert.equal((await h.call('/auth/nonsense', { body: {} })).status, 404);
  const wrongMethod = await h.call('/auth/session', { body: {} });
  assert.equal(wrongMethod.status, 405);
  assert.equal(wrongMethod.headers.get('allow'), 'GET');
});

test('an oversized body is refused before any parsing', async () => {
  const h = await harness({ maxJsonBytes: 64 });
  const response = await h.call('/auth/temporary', { body: { scopes: ['draft'], padding: 'x'.repeat(400) } });
  assert.equal(response.status, 413);
  assert.equal((await response.json()).error, 'body_too_large');
});

test('a flood on one route trips that route only', async () => {
  const h = await harness({ limits: { temporary: 1, 'email/start': 50 } });
  assert.equal((await h.call('/auth/temporary', { body: { scopes: ['draft'] } })).status, 202);
  const limited = await h.call('/auth/temporary', { body: { scopes: ['draft'] } });
  assert.equal(limited.status, 429);
  assert.equal((await limited.json()).error, 'rate_limited');
  // A different route is unaffected, and no identity row was created for it.
  assert.equal((await h.call('/auth/email/start', { body: { email: 'a@b.org' } })).status, 202);
});

test('rate-limit bucket keys are a hash of the route, never of caller input', async () => {
  const h = await harness({ limits: { 'email/start': 2 } });
  await h.call('/auth/email/start', { body: { email: 'a@one.org' } });
  await h.call('/auth/email/start', { body: { email: 'b@two.org' } });
  await h.call('/auth/email/start', { body: { email: 'c@three.org' } });
  const buckets = (await h.DB.prepare(`SELECT bucket_key FROM gift_auth_rate_buckets`).all()).results;
  assert.equal(buckets.length, 1, 'three different addresses, one bucket row');
  for (const bucket of buckets) assert.ok(!bucket.bucket_key.includes('@'), 'no caller input in the key');
});

test('every refusal carries no-store and no cookies are dropped on error', async () => {
  const h = await harness();
  const responses = [
    await h.call('/auth/nonsense', { body: {} }),
    await h.call('/auth/temporary', { body: { scopes: [] } }),
    await h.call('/auth/temporary', { body: { scopes: ['draft'] }, origin: 'https://evil.test' }),
  ];
  for (const response of responses) {
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
  }
});

test('missing database infrastructure is 503, not a crash', async () => {
  const identity = createIdentity({ origin: ORIGIN, rpName: 'x', cookie: 'c', tablePrefix: 'gift' });
  const response = await identity.handle(new Request(ORIGIN + '/auth/session'), {});
  assert.equal(response.status, 503);
  assert.equal((await response.json()).error, 'identity_unavailable');
});

test('two deployments can share one database without colliding', async () => {
  const shared = new SqliteD1(await loadSchema('gift'));
  const other = await loadSchema('other');
  assert.ok(other.includes('other_accounts'));
  assert.ok(!other.includes('gift_accounts'), 'a prefix migration must not mention another prefix');
  const second = new SqliteD1(other);
  const a = createIdentity({ origin: ORIGIN, rpName: 'a', cookie: 'a_session', tablePrefix: 'gift' });
  const b = createIdentity({ origin: ORIGIN, rpName: 'b', cookie: 'b_session', tablePrefix: 'other' });
  await a.handle(new Request(ORIGIN + '/auth/temporary', {
    method: 'POST', headers: { origin: ORIGIN, 'content-type': 'application/json' },
    body: JSON.stringify({ scopes: ['draft'] }),
  }), { DB: shared, IDENTITY_HASH_KEY: HASH_KEY });
  assert.equal((await shared.prepare(`SELECT COUNT(*) c FROM gift_accounts`).first()).c, 1);
  assert.equal((await second.prepare(`SELECT COUNT(*) c FROM other_accounts`).first()).c, 0);
});
