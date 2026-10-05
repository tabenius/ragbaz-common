// Cloudflare Turnstile verification.
//
// New in this package. Mouseion has no Turnstile: its auth gate relies on route
// circuit breakers alone, and the website template documents Turnstile CSP
// origins for other consumers without implementing verification.
//
// Two rules matter here. First, verification is server-side only — a token the
// browser obtained is not a check until this code has called Cloudflare. Second,
// when a deployment configures a secret, failure is closed. A secret that cannot
// be checked must not read as "no check needed".
//
// Turnstile is additive. It never replaces rate limiting, and it is not an
// identity proof: it says a browser looked human to Cloudflare, nothing more.

export const VERIFY_ENDPOINT = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';
export const DEFAULT_TIMEOUT_MS = 5000;

/** Turnstile's documented response codes, mapped to stable local error names. */
const HOSTNAME_MISMATCH = 'hostname-mismatch';
const INVALID_INPUT = 'invalid-input-response';

export async function verifyTurnstile({
  secretKey,
  token,
  remoteip,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  fetchImpl = fetch,
}) {
  if (!secretKey) return { ok: false, reason: 'not_configured', failClosed: true };
  if (typeof token !== 'string' || !token.trim() || token.length > 2048) {
    return { ok: false, reason: 'missing_token', failClosed: true };
  }
  const form = new FormData();
  form.set('secret', secretKey);
  form.set('response', token);
  if (typeof remoteip === 'string' && remoteip) form.set('remoteip', remoteip);
  try {
    const response = await fetchImpl(VERIFY_ENDPOINT, {
      method: 'POST', body: form, signal: AbortSignal.timeout(timeoutMs),
    });
    if (!response.ok) return { ok: false, reason: 'upstream_unavailable', failClosed: true };
    const result = await response.json();
    if (result?.success === true) return { ok: true, hostname: result.hostname ?? null };
    const codes = Array.isArray(result?.['error-codes']) ? result['error-codes'] : [];
    if (codes.includes(INVALID_INPUT)) return { ok: false, reason: 'invalid_token', failClosed: true };
    if (codes.includes(HOSTNAME_MISMATCH)) return { ok: false, reason: 'hostname_mismatch', failClosed: true };
    return { ok: false, reason: codes[0] || 'rejected', failClosed: true };
  } catch {
    return { ok: false, reason: 'upstream_unavailable', failClosed: true };
  }
}

/**
 * Gate helper for a request. Returns a Response when the request must be
 * refused, or null to continue.
 *
 * `getToken` extracts the token from the request body; it is supplied by the
 * caller because where the token lives is a route decision.
 */
export async function gateTurnstile({ secretKey, request, remoteip, getToken, ...options }) {
  if (!secretKey) return null;
  const token = await getToken(request);
  const result = await verifyTurnstile({ secretKey, token, remoteip, ...options });
  if (result.ok) return null;
  const status = result.reason === 'invalid_token' || result.reason === 'missing_token' ? 400 : 503;
  return { status, error: 'human_verification_failed', detail: result.reason };
}
