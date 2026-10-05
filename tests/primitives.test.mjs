import test from 'node:test';
import assert from 'node:assert/strict';
import { randomCode, randomId, sha256Base64url, keyedHashBase64url, newOpaqueToken, timingSafeEqual, encryptSecret, decryptSecret, generateRecoveryCodes, randomBytes } from '../src/crypto.js';
import { normalizeHandle, validateHandle, suggestHandle } from '../src/handles.js';
import { readBoundedBody, REQUEST_BODY_TOO_LARGE } from '../src/request-bounds.js';
import { verifyTurnstile } from '../src/turnstile.js';
import { normalizeEmail, emailBinding, issueEmailCode, verifyEmailCode, verificationMessage } from '../src/email-code.js';
import { sessionCookieHeader, readSessionToken, hasScope, publicSession, TEMPORARY_SCOPES } from '../src/sessions.js';

// A deterministic 32-byte key keeps failures reproducible.
const KEY_B64URL = Buffer.from(Array.from({ length: 32 }, (_, i) => (i * 7 + 11) % 256)).toString('base64url');

test('codes and ids are random, prefixed and free of modulo bias', () => {
  assert.match(randomId('acc'), /^acc_[A-Za-z0-9_-]{22}$/);
  // Ten digits: 500 draws must collide by the birthday bound (p ~ 25%), so
  // assert near-uniqueness rather than exact uniqueness, and separately assert
  // uniform symbol coverage so a biased generator cannot hide in the noise.
  const seen = new Set();
  for (let i = 0; i < 500; i++) seen.add(randomCode(6));
  assert.ok(seen.size > 450, `expected near-unique codes, got ${seen.size}/500`);
  assert.ok([...seen].every(code => /^[0-9]{6}$/.test(code)));
  const counts = new Map();
  for (let i = 0; i < 4000; i++) {
    const code = randomCode(6);
    for (const digit of code) counts.set(digit, (counts.get(digit) ?? 0) + 1);
  }
  assert.equal(counts.size, 10, 'every digit must be reachable');
  const frequencies = [...counts.values()];
  // 4000 codes x 6 digits = 24,000 symbols over 10 digits: 2,400 expected each.
  // A modulo-biased generator starves the high symbols by construction
  // (250 would map to 250/6 of the range), so these bounds catch it.
  const total = 24000;
  const expected = total / 10;
  assert.ok(Math.max(...frequencies) < expected * 1.2, `biased: ${Math.max(...frequencies)}`);
  assert.ok(Math.min(...frequencies) > expected * 0.8, `biased: ${Math.min(...frequencies)}`);
});

test('hashes separate domains and compare in constant time', async () => {
  const a = await sha256Base64url('x');
  assert.notEqual(a, await keyedHashBase64url('x', KEY_B64URL));
  assert.ok(timingSafeEqual('abc', 'abc'));
  assert.ok(!timingSafeEqual('abc', 'abd'));
  assert.ok(!timingSafeEqual('abc', 'ab'));
  assert.ok(!timingSafeEqual('abc', 123));
  await assert.rejects(() => keyedHashBase64url('x', 'not-a-32-byte-key'), /32_bytes/);
});

test('opaque tokens are returned raw and stored only as digests', async () => {
  const { token, hash } = await newOpaqueToken();
  assert.ok(token.length >= 40);
  assert.equal(hash, await sha256Base64url(token));
  assert.notEqual(token, hash);
});

test('recovery codes are readable and hashed at rest', async () => {
  const codes = await generateRecoveryCodes(10);
  assert.equal(codes.length, 10);
  for (const code of codes) {
    assert.match(code.plain, /^[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}$/);
    assert.equal(code.hash, await sha256Base64url(code.plain));
    assert.ok(!/[01OIL]/.test(code.plain), 'ambiguous characters must be excluded');
  }
});

test('secrets round-trip through AES-GCM and reject a wrong key', async () => {
  const envelope = await encryptSecret('hunter2', KEY_B64URL);
  assert.match(envelope, /^v1\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
  assert.equal(await decryptSecret(envelope, KEY_B64URL), 'hunter2');
  await assert.rejects(() => decryptSecret(envelope, randomBytes(32).toString('base64url')));
  await assert.rejects(() => decryptSecret('v2.a.b', KEY_B64URL), /bad_secret_envelope/);
});

test('handle grammar is preserved and reserved names are configuration', () => {
  assert.equal(normalizeHandle('  Elias.Venn '), 'elias.venn');
  assert.ok(validateHandle('elias.venn').ok);
  assert.ok(validateHandle('a'.repeat(64)).ok);
  assert.ok(!validateHandle('ab').ok, 'too short');
  assert.ok(!validateHandle('.leading').ok);
  assert.ok(!validateHandle('has..dot').ok);
  assert.ok(!validateHandle('has space').ok);
  assert.ok(!validateHandle('has@at').ok);
  assert.equal(validateHandle('admin', ['admin']).reason, 'reserved');
  const suggestion = suggestHandle('acc_abcdefghijklmnop');
  assert.match(suggestion, /^anon-[a-z0-9]+$/);
  assert.equal(suggestion, suggestHandle('acc_abcdefghijklmnop'), 'suggestions are deterministic');
});

test('bounded bodies refuse on the streamed total, not the declared header', async () => {
  const honest = new Request('https://x.test', { method: 'POST', body: 'abc' });
  assert.equal((await readBoundedBody(honest, 10)).length, 3);
  const lying = new Request('https://x.test', { method: 'POST', body: 'x'.repeat(50), headers: { 'content-length': '1' } });
  await assert.rejects(() => readBoundedBody(lying, 10), error => error.message === REQUEST_BODY_TOO_LARGE);
  const declared = new Request('https://x.test', { method: 'POST', body: 'x', headers: { 'content-length': '9999' } });
  await assert.rejects(() => readBoundedBody(declared, 10));
});

test('turnstile fails closed and never trusts a client-only token', async () => {
  assert.deepEqual(await verifyTurnstile({ secretKey: null, token: 'anything' }),
    { ok: false, reason: 'not_configured', failClosed: true });
  assert.equal((await verifyTurnstile({ secretKey: 'k', token: '' })).reason, 'missing_token');
  assert.equal((await verifyTurnstile({ secretKey: 'k', token: 'x'.repeat(3000) })).reason, 'missing_token');
  const ok = await verifyTurnstile({
    secretKey: 'k', token: 't', fetchImpl: async () => Response.json({ success: true, hostname: 'a.test' }),
  });
  assert.deepEqual(ok, { ok: true, hostname: 'a.test' });
  assert.equal((await verifyTurnstile({
    secretKey: 'k', token: 't', fetchImpl: async () => Response.json({ success: false, 'error-codes': ['invalid-input-response'] }),
  })).reason, 'invalid_token');
  assert.equal((await verifyTurnstile({
    secretKey: 'k', token: 't', fetchImpl: async () => Response.json({ success: false, 'error-codes': ['hostname-mismatch'] }),
  })).reason, 'hostname_mismatch');
  assert.equal((await verifyTurnstile({
    secretKey: 'k', token: 't', fetchImpl: async () => { throw new Error('network'); },
  })).reason, 'upstream_unavailable');
  assert.equal((await verifyTurnstile({
    secretKey: 'k', token: 't', fetchImpl: async () => new Response(null, { status: 500 }),
  })).reason, 'upstream_unavailable');
});

test('email codes are keyed, single-shape, and never reveal the address', async () => {
  assert.equal(normalizeEmail('  Person@Example.ORG '), 'person@example.org');
  for (const bad of ['', 'no-at', 'a@b', 'a b@c.d', `${'x'.repeat(250)}@e.org`]) {
    assert.throws(() => normalizeEmail(bad), /email_too_long|invalid_email/);
  }
  const issue = await issueEmailCode({ email: 'person@example.org', hashKey: KEY_B64URL });
  assert.match(issue.code, /^[0-9]{6}$/);
  assert.ok(!JSON.stringify(issue).includes('person@example.org'));
  const wrongCode = issue.code === '000000' ? '111111' : '000000';
  assert.ok(!(await verifyEmailCode(wrongCode, issue.codeHash, KEY_B64URL)));
  assert.ok(await verifyEmailCode(issue.code, issue.codeHash, KEY_B64URL));
  const otherKey = Buffer.from(Array.from({ length: 32 }, (_, i) => (i * 13 + 5) % 256)).toString('base64url');
  assert.ok(!(await verifyEmailCode(issue.code, issue.codeHash, otherKey)));
  for (const wrong of ['', 'abcdef', '12345', '1234567', '12345678901']) {
    assert.ok(!(await verifyEmailCode(wrong, issue.codeHash, KEY_B64URL)), 'malformed codes must not verify');
  }
  const message = verificationMessage({ code: '123456', appName: 'Test' });
  assert.ok(message.text.includes('123456'));
  assert.match(message.subject, /^123456 - /);
});

test('email bindings are domain-separated so a code digest is not an address digest', async () => {
  const one = await emailBinding('a@b.org', KEY_B64URL);
  const two = await emailBinding('a@c.org', KEY_B64URL);
  assert.notEqual(one.emailHash, two.emailHash);
  assert.ok(!one.emailHash.includes('@'));
});

test('cookies are HttpOnly, SameSite=Lax and Secure only over HTTPS', () => {
  const secure = sessionCookieHeader({ cookie: 'gifts_session', token: 't', origin: 'https://a.test' });
  assert.ok(secure.startsWith('gifts_session=t;'));
  assert.ok(secure.includes('HttpOnly'));
  assert.ok(secure.includes('SameSite=Lax'));
  assert.ok(secure.includes('Secure'));
  assert.ok(!sessionCookieHeader({ cookie: 'c', token: 't', origin: 'http://localhost:8787' }).includes('Secure'));
  const request = new Request('https://a.test', { headers: { cookie: 'other=1; gifts_session=tok; another=2' } });
  assert.equal(readSessionToken(request, 'gifts_session'), 'tok');
  assert.equal(readSessionToken(request, 'absent'), null);
});

test('scope checks treat a full session as unrestricted and temporary as explicit', () => {
  assert.ok(hasScope({ temporary: false }, 'anything'));
  assert.ok(!hasScope(null, 'draft'));
  for (const scope of TEMPORARY_SCOPES) assert.ok(hasScope({ temporary: true, scopes: [scope] }, scope));
  assert.ok(!hasScope({ temporary: true, scopes: ['draft'] }, 'upload'), 'no implicit escalation');
});

test('the public session view is an allowlist with no internal identifiers', () => {
  const view = publicSession({
    accountId: 'acc_secret', pseudonymId: 'psd_secret', handle: 'elias.venn',
    displayName: 'Elias', temporary: true, scopes: ['draft'],
    elevatedUntil: null, expiresAt: 'later',
  }, { verification: 'anonymous' });
  assert.deepEqual(Object.keys(view).sort(),
    ['authenticated', 'displayName', 'elevatedUntil', 'handle', 'profileUrl', 'scopes', 'temporary', 'verification']);
  assert.ok(!JSON.stringify(view).includes('acc_secret'));
  assert.ok(!JSON.stringify(view).includes('psd_secret'));
  assert.equal(view.profileUrl, '/p/elias.venn');
  assert.deepEqual(publicSession(null, { verification: 'anonymous' }),
    { authenticated: false, temporary: false, scopes: [], verification: 'anonymous' });
});
