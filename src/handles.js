// Pseudonym handle rules.
//
// Extracted from Mouseion src/identity/handles.js. The grammar is unchanged;
// reserved names moved from a hard-coded SQL seed to configuration, because a
// shared package cannot know each product's routes.
//
// See PROVENANCE.md.

const HANDLE_RE = /^[a-z0-9][a-z0-9._+-]{1,62}[a-z0-9]$/;

/** Normalize user input into a candidate handle. Does not validate. */
export function normalizeHandle(input) {
  return String(input ?? '').trim().toLowerCase();
}

/**
 * Validate a normalized handle.
 * Returns { ok: true } or { ok: false, reason } with reason one of
 * format | double-dot | reserved. Reservation is checked here because the
 * caller supplies the list; collision checking is the caller's job (it needs
 * the database).
 */
export function validateHandle(handle, reserved = []) {
  if (typeof handle !== 'string' || !HANDLE_RE.test(handle)) return { ok: false, reason: 'format' };
  if (handle.includes('..')) return { ok: false, reason: 'double-dot' };
  if (reserved.includes(handle)) return { ok: false, reason: 'reserved' };
  return { ok: true };
}

export function isValidHandle(handle, reserved = []) {
  return validateHandle(handle, reserved).ok;
}

/**
 * Decide whether a free handle should be suggested to someone who did not pick
 * one. Deterministic given the account id, so a later page can show the same
 * suggestion without storing it.
 */
export function suggestHandle(accountId, suffix = '') {
  const base = String(accountId ?? '').replace(/[^a-zA-Z0-9]/g, '').toLowerCase().slice(-12);
  const candidate = `anon-${base}${suffix}`;
  return HANDLE_RE.test(candidate) ? candidate : `anon-${randomSuffix()}`;
}

function randomSuffix() {
  const alphabet = 'abcdefghjkmnpqrstuvwxyz23456789';
  let out = '';
  for (const byte of crypto.getRandomValues(new Uint8Array(8))) out += alphabet[byte % alphabet.length];
  return out;
}
