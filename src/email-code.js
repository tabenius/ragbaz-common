// Email verification codes.
//
// New in this package. Mouseion has no email verification — its only mail path is
// inbound encrypted curator correspondence — and Elias.Venn never had one
// either, because its account model is passkey-only by decision.
//
// The gifts platform needs something different: proof that a person controls an
// address, without asking for a legal name and without publishing that address.
// That is the whole scope of this module.
//
// Properties that matter:
//   * the code is stored only as a keyed digest;
//   * it is single use, and consuming it deletes the row in the same batch;
//   * verification attempts are capped per issued code, not merely rate limited;
//   * the address is stored as a keyed HMAC digest, so the database alone cannot
//     be dumped into a mailing list;
//   * verification proves control of an address. It is not consent to publish
//     anything, and never becomes a handle.

import { keyedHashBase64url, randomCode, timingSafeEqual } from './crypto.js';

export const EMAIL_CODE_TTL_MS = 15 * 60 * 1000;
export const MAX_CODE_ATTEMPTS = 5;
export const EMAIL_CODE_LENGTH = 6;

// Domain separators keep the two digests from being interchangeable, and stop a
// digest of a code from ever being usable as an address digest.
const CODE_DOMAIN = 'emailcode:';
const ADDRESS_DOMAIN = 'email:';

/**
 * Normalise an address. The plaintext is touched only here and in the outbound
 * message; the database only ever receives a digest.
 */
export function normalizeEmail(input) {
  const email = String(input ?? '').trim().toLowerCase();
  if (email.length > 254) throw new Error('email_too_long');
  // Deliberately conservative: one @, no whitespace, a dotted domain. This is a
  // typo filter, not an RFC 5322 parser.
  if (!/^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/.test(email)) throw new Error('invalid_email');
  return email;
}

export async function emailBinding(email, hashKey) {
  return { emailHash: await keyedHashBase64url(ADDRESS_DOMAIN + normalizeEmail(email), hashKey) };
}

/**
 * Issue a code for an address.
 *
 * Timestamps are ISO UTC strings, matching every other time this package stores.
 * A millisecond number here would silently defeat the expiry comparison against
 * a TEXT column, which is exactly the bug this shape exists to prevent.
 */
export async function issueEmailCode({ email, hashKey, now = Date.now(), length = EMAIL_CODE_LENGTH }) {
  const { emailHash } = await emailBinding(email, hashKey);
  const code = randomCode(length);
  return {
    emailHash,
    code,
    // Keyed as well as hashed: an attacker holding both the database and the
    // plaintext address should not be able to brute-force a six-digit code.
    codeHash: await keyedHashBase64url(CODE_DOMAIN + code, hashKey),
    createdAt: new Date(now).toISOString(),
    expiresAt: new Date(now + EMAIL_CODE_TTL_MS).toISOString(),
  };
}

/** Constant-time comparison of a presented code against its stored digest. */
export async function verifyEmailCode(code, storedHash, hashKey) {
  if (typeof code !== 'string' || !/^[0-9]{4,10}$/.test(code.trim())) return false;
  return timingSafeEqual(await keyedHashBase64url(CODE_DOMAIN + code.trim(), hashKey), storedHash);
}

/**
 * The message a product sends. Kept here so "this is a verification code and
 * nothing else" is one reviewed string rather than one per product.
 */
export function verificationMessage({ code, ttlMinutes = 15, appName = 'this service', purpose = 'verify your email address' }) {
  return {
    subject: `${code} - ${purpose}`,
    text: [
      `Your verification code for ${appName} is ${code}.`,
      '',
      `It is valid for ${ttlMinutes} minutes and can be used once.`,
      'If you did not request this code, you can ignore this message; nothing has changed.',
      'Verifying an address does not publish your name or make anything public.',
    ].join('\n'),
  };
}
