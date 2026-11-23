// Regenerate schemas/gift-signature.v1.vectors.json deterministically.
//
//   node scripts/gift-signature-vectors.mjs > schemas/gift-signature.v1.vectors.json
//
// Keys are the public RFC 8032 section 7.1 test keys: never use them for real
// gifts. Ed25519 signatures are deterministic, so the output is reproducible.
import { canonicalJson, signGift } from '../src/gift-signature.js';
import { fromBase64url, toBase64url } from '../src/crypto.js';

const fromHex = (h) => Uint8Array.from(h.match(/../g), (b) => parseInt(b, 16));
const PKCS8_ED25519 = fromHex('302e020100300506032b657004220420');

async function key(seedHex, publicHex) {
  const pkcs8 = new Uint8Array([...PKCS8_ED25519, ...fromHex(seedHex)]);
  const privateKey = await crypto.subtle.importKey('pkcs8', pkcs8, { name: 'Ed25519' }, false, ['sign']);
  return { privateKey, public: { format: 'ed25519', value: toBase64url(fromHex(publicHex)) } };
}

const sender = await key(
  '9d61b19deffd5a60ba844af492ec2cc44449c5697b326919703bac031cae7f60',
  'd75a980182b10ab7d54bfed3c964073a0ee172f3daa62325af021a68f707511a');
const recipient = await key(
  '4ccd089b28ff96da9db6c346ec114e0f5b8a319f35aba624da8cf6ed4fb8a6fb',
  '3d4017c3e843895a92b70aa74d1b7ebc9c982ccf2ec4968cc0cd55f12af4660c');
const stranger = await key(
  'c5aa8df43f9f837bedb7442f31dcb7b166d38535076f094b85ce3a2e0b4458f7',
  'fc51cd8e6218a1a38da47ed00230f0580816ed13ba3303ac5deb911548908025');

const NOW = 1795000000; // 2026-11-18T09:46:40Z
const base = {
  id: 'gift-01',
  subject: 'Räksmörgås — a first gift ✓',
  sender_public_key: sender.public,
  recipient_public_keys: [recipient.public],
  artifact: { text: 'Line one\nLine two\t"quoted"\u0001 and ☃' },
  issued_at: '2026-11-18T09:00:00Z',
  expires_at: '2026-12-18T09:00:00Z',
};
const refGift = {
  ...base,
  id: 'gift-02',
  subject: 'Review requested',
  artifact: { ref: { source_id: 'laptop', id: 'pieces/manuscript-7' }, sha256: 'a'.repeat(64) },
  invitation: { kind: 'decision', context_ref: 'hold:baz0/42', choices: ['approve', 'deny'] },
  delivery_policy: { allowed_transports: ['rbq', 'app'], email_content: 'notification_only' },
};

const signedText = await signGift(base, sender.privateKey);
const signedRef = await signGift(refGift, sender.privateKey);
const withSig = (gift, value) => ({ ...gift, signature: { ...gift.signature, value } });
const sigBytes = fromBase64url(signedText.signature.value);

// S + L (the group order) verifies under lax implementations; both strict
// verifiers must refuse it.
const L = fromHex('edd3f55c1a631258d69cf7a2def9de1400000000000000000000000000000010');
const highS = sigBytes.slice();
let carry = 0;
for (let i = 0; i < 32; i++) {
  const sum = highS[32 + i] + L[i] + carry;
  highS[32 + i] = sum & 0xff;
  carry = sum >> 8;
}
// The same bytes with non-zero padding bits in the last base64url character.
const last = signedText.signature.value.at(-1);
const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
const paddedAlias = signedText.signature.value.slice(0, -1) + alphabet[alphabet.indexOf(last) | 1];

const reordered = Object.fromEntries(Object.entries(signedText).reverse());
const smallOrder = { format: 'ed25519', value: toBase64url(fromHex('0100000000000000000000000000000000000000000000000000000000000000')) };

const cases = [
  { name: 'valid text gift', gift: signedText, recipient: recipient.public, expect: 'ok' },
  { name: 'valid reference gift with invitation and delivery policy', gift: signedRef, recipient: recipient.public, expect: 'ok' },
  { name: 'valid without a recipient check', gift: signedText, expect: 'ok' },
  { name: 'member order does not matter', gift: reordered, recipient: recipient.public, expect: 'ok' },
  { name: 'tampered subject', gift: { ...signedText, subject: 'Something else' }, expect: 'bad_signature' },
  { name: 'tampered recipient list', gift: { ...signedText, recipient_public_keys: [recipient.public, stranger.public] }, expect: 'bad_signature' },
  { name: 'tampered expiry', gift: { ...signedText, expires_at: '2026-12-19T09:00:00Z' }, expect: 'bad_signature' },
  { name: 'tampered invitation choice', gift: { ...signedRef, invitation: { ...signedRef.invitation, choices: ['approve'] } }, expect: 'bad_signature' },
  { name: 'signature by another key', gift: { ...signedText, sender_public_key: stranger.public }, expect: 'bad_signature' },
  { name: 'not a listed recipient', gift: signedText, recipient: stranger.public, expect: 'not_a_recipient' },
  { name: 'expired', gift: signedText, now: 1797584400, expect: 'expired' },
  { name: 'not yet valid', gift: signedText, now: 1794990000, expect: 'not_yet_valid' },
  { name: 'unsupported signature format', gift: { ...signedText, signature: { format: 'ed25519-jcs-v2', value: signedText.signature.value } }, expect: 'unsupported_format' },
  { name: 'non-canonical S (S + L)', gift: withSig(signedText, toBase64url(highS)), expect: 'bad_signature' },
  { name: 'base64url alias with padding bits set', gift: withSig(signedText, paddedAlias), expect: 'bad_signature' },
  { name: 'small-order sender key', gift: { ...signedText, sender_public_key: smallOrder }, expect: 'invalid_key' },
  { name: 'unknown member added after signing', gift: { ...signedText, note: 'x' }, expect: 'malformed' },
  { name: 'missing expires_at', gift: (({ expires_at: _e, ...rest }) => rest)(signedText), expect: 'malformed' },
  { name: 'duplicate recipient', gift: { ...signedText, recipient_public_keys: [recipient.public, recipient.public] }, expect: 'malformed' },
  { name: 'impossible date', gift: { ...signedText, issued_at: '2026-02-30T09:00:00Z' }, expect: 'malformed' },
  { name: 'fractional seconds are not the canonical time form', gift: { ...signedText, issued_at: '2026-11-18T09:00:00.000Z' }, expect: 'malformed' },
].map((c) => ({ ...c, now: c.now ?? NOW }));

const canonical = [
  { name: 'member order by UTF-16 code units', input: { b: 1, a: 2, '€': 3, '\u{1F600}': 4, 'ä': 5 }, expect: '{"a":2,"b":1,"ä":5,"€":3,"\u{1F600}":4}' },
  { name: 'string escapes', input: { s: '"\\\b\f\n\r\t\u0001\u001f/ <>' }, expect: '{"s":"\\"\\\\\\b\\f\\n\\r\\t\\u0001\\u001f/ <>"}' },
  { name: 'nested arrays keep order', input: [3, [2, 1], { z: null, y: true, x: false }], expect: '[3,[2,1],{"x":false,"y":true,"z":null}]' },
  { name: 'integers and negative zero', input: { n: [-0, 0, -1, 9007199254740991] }, expect: '{"n":[0,0,-1,9007199254740991]}' },
];
for (const c of canonical) if (canonicalJson(c.input) !== c.expect) throw new Error(`canonical vector ${c.name} disagrees`);

process.stdout.write(`${JSON.stringify({
  schema: 'ragbaz.gift-signature.vectors.v1',
  format: 'ed25519-jcs-v1',
  note: 'Keys are the public RFC 8032 section 7.1 test keys. Never use them for real gifts. Regenerate with scripts/gift-signature-vectors.mjs.',
  canonical,
  rejected_canonical: [
    { name: 'fraction', input_json: '{"n":1.5}' },
    { name: 'unsafe integer', input_json: '{"n":9007199254740993}' },
    { name: 'exponent', input_json: '{"n":1e400}' },
  ],
  cases,
}, null, 2)}\n`);
