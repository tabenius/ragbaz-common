import assert from 'node:assert/strict';
import { test } from 'node:test';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { canonicalJson, signGift, signingBytes, verifyGift, DOMAIN } from '../src/gift-signature.js';

const vectorsPath = new URL('../schemas/gift-signature.v1.vectors.json', import.meta.url);
const vectors = JSON.parse(readFileSync(vectorsPath, 'utf8'));

test('vectors are reproducible from the generator', () => {
  const generated = execFileSync(process.execPath, [new URL('../scripts/gift-signature-vectors.mjs', import.meta.url).pathname]);
  assert.equal(generated.toString(), readFileSync(vectorsPath, 'utf8'));
});

test('canonical JSON matches every vector', () => {
  for (const c of vectors.canonical) assert.equal(canonicalJson(c.input), c.expect, c.name);
});

test('values outside the canonical subset are refused', () => {
  for (const c of vectors.rejected_canonical) {
    assert.throws(() => canonicalJson(JSON.parse(c.input_json)), /canonical_json/, c.name);
  }
  assert.throws(() => canonicalJson({ s: '\ud800' }), /lone_surrogate/);
  assert.throws(() => canonicalJson({ d: new Date(0) }), /unsupported_value/);
  assert.throws(() => canonicalJson({ u: undefined }), /unsupported_value/);
  let deep = 0;
  for (let i = 0; i < 40; i++) deep = [deep];
  assert.throws(() => canonicalJson(deep), /too_deep/);
});

test('every signature vector verifies to its expected outcome', async () => {
  for (const c of vectors.cases) {
    const result = await verifyGift(c.gift, { now: c.now, recipient: c.recipient });
    assert.equal(result.ok ? 'ok' : result.reason, c.expect, c.name);
  }
});

test('the signature covers the domain separator, not just the JSON', async () => {
  const valid = vectors.cases.find((c) => c.expect === 'ok').gift;
  const bytes = new TextDecoder().decode(signingBytes(valid));
  assert.ok(bytes.startsWith(DOMAIN));
  assert.ok(!bytes.includes('"signature"'));
});

test('a freshly generated key signs and verifies; signing refuses a signed envelope', async () => {
  const pair = await crypto.subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
  const raw = new Uint8Array(await crypto.subtle.exportKey('raw', pair.publicKey));
  const { toBase64url } = await import('../src/crypto.js');
  const key = { format: 'ed25519', value: toBase64url(raw) };
  const now = Math.floor(Date.now() / 1000);
  const iso = (s) => new Date(s * 1000).toISOString().replace('.000Z', 'Z');
  const gift = await signGift({
    id: 'g', subject: 's', sender_public_key: key, recipient_public_keys: [key],
    artifact: { text: 't' }, issued_at: iso(now), expires_at: iso(now + 3600),
  }, pair.privateKey);
  assert.deepEqual(await verifyGift(gift, { recipient: key }), { ok: true });
  await assert.rejects(signGift(gift, pair.privateKey), /must_be_unsigned/);
});
