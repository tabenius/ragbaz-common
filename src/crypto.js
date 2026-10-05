// WebCrypto helpers. Available in Workers and Node 18+.
//
// No secret is logged. Session tokens, recovery codes and email codes are only
// ever persisted as digests.
//
// Extracted from Mouseion src/identity/crypto.js; behaviour unchanged.
// See PROVENANCE.md.

const B64URL_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
// Recovery-code alphabet: no 0/O/1/I/L, so a code stays readable when transcribed.
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
// Email-code alphabet: digits only, because it is read aloud and typed on a phone.
const DIGITS = '0123456789';

export function randomBytes(n) {
  const bytes = new Uint8Array(n);
  crypto.getRandomValues(bytes);
  return bytes;
}

export function toBase64url(bytes) {
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i];
    const b = i + 1 < bytes.length ? bytes[i + 1] : 0;
    const c = i + 2 < bytes.length ? bytes[i + 2] : 0;
    out += B64URL_ALPHABET[a >> 2];
    out += B64URL_ALPHABET[((a & 3) << 4) | (b >> 4)];
    if (i + 1 < bytes.length) out += B64URL_ALPHABET[((b & 15) << 2) | (c >> 6)];
    if (i + 2 < bytes.length) out += B64URL_ALPHABET[c & 63];
  }
  return out;
}

/**
 * Decode a base64url string back to bytes.
 *
 * Throws a labelled error for malformed input rather than letting atob raise
 * InvalidCharacterError from several frames away. A caller comparing a presented
 * secret against a stored digest must be able to treat bad input as a mismatch
 * rather than as a crash.
 */
export function fromBase64url(str) {
  const raw = String(str ?? '');
  if (!/^[A-Za-z0-9_-]*$/.test(raw)) throw new Error('invalid_base64url');
  const s = raw.replace(/-/g, '+').replace(/_/g, '/');
  const pad = s.length % 4 ? '='.repeat(4 - (s.length % 4)) : '';
  try {
    const bin = atob(s + pad);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return bytes;
  } catch {
    throw new Error('invalid_base64url');
  }
}

/** The 32 raw bytes a keyed operation needs, with a labelled failure. */
export function secretKeyBytes(keyB64url, label = 'hash_key') {
  let raw;
  try { raw = fromBase64url(keyB64url ?? ''); }
  catch { throw new Error(`${label}_must_be_32_bytes`); }
  if (raw.length !== 32) throw new Error(`${label}_must_be_32_bytes`);
  return raw;
}

/** A random id with a caller-supplied prefix, e.g. randomId('acc') -> "acc_3f9a…". */
export function randomId(prefix) {
  return `${prefix}_${toBase64url(randomBytes(16))}`;
}

/** An opaque numeric code drawn from `alphabet`, with no modulo bias. */
export function randomCode(length, alphabet = DIGITS) {
  const size = alphabet.length;
  if (!Number.isInteger(length) || length < 1 || size < 2) throw new Error('invalid_code_parameters');
  // Reject rather than bias: a code space skewed by 1 in 256 is a real weakness
  // when the code is a login factor.
  const limit = Math.floor(256 / size) * size;
  const out = [];
  while (out.length < length) {
    for (const byte of randomBytes(length * 2)) {
      if (byte >= limit) continue;
      out.push(alphabet[byte % size]);
      if (out.length === length) break;
    }
  }
  return out.join('');
}

/** A fresh opaque WebAuthn userHandle (32 bytes). Never derived from a handle. */
export function newUserHandle() {
  const bytes = randomBytes(32);
  return { bytes, b64url: toBase64url(bytes) };
}

export async function sha256Base64url(input) {
  const data = typeof input === 'string' ? new TextEncoder().encode(input) : input;
  const digest = await crypto.subtle.digest('SHA-256', data);
  return toBase64url(new Uint8Array(digest));
}

/**
 * Keyed one-way hash for identifiers that would otherwise be correlatable if an
 * attacker already knows or guesses the source. The key must be a private
 * 32-byte base64url secret. Used for email addresses and rate-limit keys.
 */
export async function keyedHashBase64url(input, keyB64url) {
  const raw = secretKeyBytes(keyB64url, 'hash_key');
  const key = await crypto.subtle.importKey('raw', raw, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(String(input ?? '')));
  return toBase64url(new Uint8Array(signature));
}

/** A new opaque token: the raw value goes to its owner, only the hash is stored. */
export async function newOpaqueToken() {
  const token = toBase64url(randomBytes(32));
  return { token, hash: await sha256Base64url(token) };
}

function formatRecoveryCode() {
  const raw = randomBytes(12);
  let out = '';
  for (let i = 0; i < 12; i++) {
    if (i > 0 && i % 4 === 0) out += '-';
    out += CODE_ALPHABET[raw[i] % CODE_ALPHABET.length];
  }
  return out;
}

/** `{ plain, hash }` pairs. `plain` is shown once; only `hash` is persisted. */
export async function generateRecoveryCodes(count = 10) {
  const codes = [];
  for (let i = 0; i < count; i++) {
    const plain = formatRecoveryCode();
    codes.push({ plain, hash: await sha256Base64url(plain) });
  }
  return codes;
}

export function timingSafeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return mismatch === 0;
}

async function aesKey(keyB64url) {
  const raw = secretKeyBytes(keyB64url, 'encryption_key');
  return crypto.subtle.importKey('raw', raw, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
}

/** Encrypt a small application secret with a 32-byte base64url AES-GCM key. */
export async function encryptSecret(value, keyB64url) {
  const iv = randomBytes(12);
  const key = await aesKey(keyB64url);
  const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(String(value ?? '')));
  return `v1.${toBase64url(iv)}.${toBase64url(new Uint8Array(encrypted))}`;
}

export async function decryptSecret(envelope, keyB64url) {
  const [version, ivText, cipherText] = String(envelope || '').split('.');
  if (version !== 'v1' || !ivText || !cipherText) throw new Error('bad_secret_envelope');
  const key = await aesKey(keyB64url);
  const plain = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: fromBase64url(ivText) }, key, fromBase64url(cipherText),
  );
  return new TextDecoder().decode(plain);
}
