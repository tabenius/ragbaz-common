// Gift signatures, format `ed25519-jcs-v1`: a detached Ed25519 signature over
// the RFC 8785 (JCS) canonical JSON of the gift envelope without its
// `signature` member, prefixed by a format-specific domain separator.
// Specification: docs/GIFT-SIGNATURE.md. Shared vectors:
// schemas/gift-signature.v1.vectors.json (the Rust verifier in rebsync checks
// the same file).
//
// Verification answers one question: did the holder of `sender_public_key`
// sign exactly this envelope, now valid, for this recipient? It does not say
// who that key belongs to, whether the sender may send it, or that the gift
// was accepted. Those are identity bindings and owning-service policy.

import { fromBase64url, toBase64url } from './crypto.js';

export const FORMAT = 'ed25519-jcs-v1';
export const KEY_FORMAT = 'ed25519';
export const DOMAIN = 'ragbaz.gift.ed25519-jcs-v1\n';
/** Accepted clock skew for `issued_at` in the future, in seconds. */
export const MAX_SKEW_SECONDS = 300;
/** Longest accepted validity window, in seconds (400 days). */
export const MAX_LIFETIME_SECONDS = 400 * 24 * 3600;
/** Largest canonical payload accepted, in bytes. */
export const MAX_CANONICAL_BYTES = 256 * 1024;
const MAX_DEPTH = 32;

const ENVELOPE_KEYS = new Set([
  'id', 'subject', 'sender_public_key', 'recipient_public_keys', 'artifact',
  'signature', 'invitation', 'delivery_policy', 'issued_at', 'expires_at',
]);
const REQUIRED_KEYS = ['id', 'subject', 'sender_public_key', 'recipient_public_keys', 'artifact', 'signature', 'issued_at', 'expires_at'];
const TIME = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})Z$/;

// Canonical encodings of the eight small-order points. A key or signature R
// equal to one of these is refused, as libsodium and ed25519-dalek's
// verify_strict do, so every verifier accepts exactly the same signatures.
const SMALL_ORDER = new Set([
  '0100000000000000000000000000000000000000000000000000000000000000',
  'ecffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff7f',
  '0000000000000000000000000000000000000000000000000000000000000000',
  '0000000000000000000000000000000000000000000000000000000000000080',
  '26e8958fc2b227b045c3f489f2ef98f0d5dfac05d3c63339b13802886d53fc05',
  '26e8958fc2b227b045c3f489f2ef98f0d5dfac05d3c63339b13802886d53fc85',
  'c7176a703d4dd84fba3c0b760d10670f2a2053fa2c39ccc64ec7fd7792ac037a',
  'c7176a703d4dd84fba3c0b760d10670f2a2053fa2c39ccc64ec7fd7792ac03fa',
]);

const hex = (bytes) => [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
const isPlainObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v)
  && Object.getPrototypeOf(v) === Object.prototype;

/**
 * RFC 8785 canonical JSON. Integers must be safe (|n| <= 2^53 - 1); other
 * numbers, lone surrogates, non-plain objects and depth beyond 32 throw.
 */
export function canonicalJson(value, depth = 0) {
  if (depth > MAX_DEPTH) throw new Error('canonical_json_too_deep');
  if (value === null || value === true || value === false) return String(value);
  if (typeof value === 'number') {
    if (!Number.isSafeInteger(value)) throw new Error('canonical_json_unsupported_number');
    return String(value); // -0 serialises as "0", as JCS requires
  }
  if (typeof value === 'string') {
    if (!value.isWellFormed()) throw new Error('canonical_json_lone_surrogate');
    // ECMAScript JSON.stringify string escaping is exactly JCS's.
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) return `[${value.map((v) => canonicalJson(v, depth + 1)).join(',')}]`;
  if (isPlainObject(value)) {
    // Default sort compares UTF-16 code units, which is JCS's key order.
    const keys = Object.keys(value).sort();
    return `{${keys.map((k) => {
      if (!k.isWellFormed()) throw new Error('canonical_json_lone_surrogate');
      return `${JSON.stringify(k)}:${canonicalJson(value[k], depth + 1)}`;
    }).join(',')}}`;
  }
  throw new Error('canonical_json_unsupported_value');
}

/** The exact bytes an `ed25519-jcs-v1` signature covers. */
export function signingBytes(envelope) {
  if (!isPlainObject(envelope)) throw new Error('gift_not_an_object');
  const { signature: _ignored, ...unsigned } = envelope;
  const bytes = new TextEncoder().encode(DOMAIN + canonicalJson(unsigned));
  if (bytes.length > MAX_CANONICAL_BYTES) throw new Error('gift_too_large');
  return bytes;
}

/** Strict, canonical unpadded base64url of exactly `length` bytes, or null. */
function decodeExact(text, length) {
  if (typeof text !== 'string' || text.length !== Math.ceil((length * 4) / 3)) return null;
  let bytes;
  try { bytes = fromBase64url(text); } catch { return null; }
  // Re-encoding rejects non-zero padding bits (a second spelling of the same bytes).
  return bytes.length === length && toBase64url(bytes) === text ? bytes : null;
}

/** True when a 32-byte point encoding is canonical (y < p) and not small-order. */
function strongPoint(bytes) {
  if (SMALL_ORDER.has(hex(bytes))) return false;
  // y is the low 255 bits, little-endian; p = 2^255 - 19.
  const y = bytes.slice();
  y[31] &= 0x7f;
  if (y[31] !== 0x7f) return true;
  for (let i = 30; i >= 1; i--) if (y[i] !== 0xff) return true;
  return y[0] < 0xed;
}

function publicKey(value) {
  if (!isPlainObject(value) || Object.keys(value).sort().join() !== 'format,value') return null;
  if (value.format !== KEY_FORMAT) return null;
  const bytes = decodeExact(value.value, 32);
  return bytes && strongPoint(bytes) ? bytes : null;
}

function seconds(text) {
  const m = typeof text === 'string' && TIME.exec(text);
  if (!m) return null;
  const ms = Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]);
  // Round-trip rejects impossible dates such as 2026-02-30.
  return new Date(ms).toISOString().replace('.000Z', 'Z') === text ? ms / 1000 : null;
}

/**
 * Verify a gift envelope. Returns `{ ok: true }` or `{ ok: false, reason }`
 * with a stable reason code. `now` is unix seconds; `recipient`, when given,
 * is the verifying party's `{ format, value }` key and must be listed.
 */
export async function verifyGift(envelope, { now = Math.floor(Date.now() / 1000), recipient } = {}) {
  const fail = (reason) => ({ ok: false, reason });
  if (!isPlainObject(envelope)) return fail('malformed');
  if (Object.keys(envelope).some((k) => !ENVELOPE_KEYS.has(k))) return fail('malformed');
  if (REQUIRED_KEYS.some((k) => !(k in envelope))) return fail('malformed');
  const { signature } = envelope;
  if (!isPlainObject(signature) || Object.keys(signature).sort().join() !== 'format,value') return fail('malformed');
  if (signature.format !== FORMAT) return fail('unsupported_format');
  const sender = publicKey(envelope.sender_public_key);
  if (!sender) return fail('invalid_key');
  const recipients = envelope.recipient_public_keys;
  if (!Array.isArray(recipients) || recipients.length < 1 || recipients.length > 100) return fail('malformed');
  const listed = new Set();
  for (const key of recipients) {
    const bytes = publicKey(key);
    if (!bytes) return fail('invalid_key');
    listed.add(hex(bytes));
  }
  if (listed.size !== recipients.length) return fail('malformed');
  const issued = seconds(envelope.issued_at);
  const expires = seconds(envelope.expires_at);
  if (issued === null || expires === null || expires <= issued || expires - issued > MAX_LIFETIME_SECONDS) return fail('malformed');
  if (issued > now + MAX_SKEW_SECONDS) return fail('not_yet_valid');
  if (expires <= now) return fail('expired');
  if (recipient !== undefined) {
    const bytes = publicKey(recipient);
    if (!bytes || !listed.has(hex(bytes))) return fail('not_a_recipient');
  }
  const sig = decodeExact(signature.value, 64);
  if (!sig) return fail('bad_signature');
  // Refuse a small-order or non-canonical R, as the strict Rust verifier does.
  if (!strongPoint(sig.slice(0, 32))) return fail('bad_signature');
  let message;
  try { message = signingBytes(envelope); } catch { return fail('malformed'); }
  const key = await crypto.subtle.importKey('raw', sender, { name: 'Ed25519' }, false, ['verify']);
  const valid = await crypto.subtle.verify({ name: 'Ed25519' }, key, sig, message);
  return valid ? { ok: true } : fail('bad_signature');
}

/**
 * Sign an unsigned envelope with an Ed25519 private CryptoKey. Returns a new
 * envelope with `signature` set. The caller supplies `sender_public_key`,
 * `issued_at` and `expires_at`; this function signs exactly what it is given.
 */
export async function signGift(unsigned, privateKey) {
  if (!isPlainObject(unsigned) || 'signature' in unsigned) throw new Error('gift_must_be_unsigned');
  const sig = new Uint8Array(await crypto.subtle.sign({ name: 'Ed25519' }, privateKey, signingBytes(unsigned)));
  return { ...unsigned, signature: { format: FORMAT, value: toBase64url(sig) } };
}
