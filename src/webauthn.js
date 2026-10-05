// WebAuthn ceremony helpers.
//
// Extracted from Mouseion src/identity/webauthn.js. Two changes: the origin is
// an explicit parameter instead of an import from the product's origins module,
// and rpName is configuration. Every other choice is preserved deliberately —
// see PROVENANCE.md.
//
// The cryptographic verification is delegated to @simplewebauthn/server. That
// is the point of this file: adapt config and data model, never reimplement.

import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
} from '@simplewebauthn/server';

export const CEREMONY_TIMEOUT_MS = 300000;

/** Relying Party config. Throws rather than falling back to a guessed origin. */
export function rpConfig({ origin, rpName }) {
  const url = new URL(origin);
  if (url.protocol !== 'https:' && url.hostname !== 'localhost') {
    throw new Error('rp_origin_must_be_https_or_localhost');
  }
  if (!rpName) throw new Error('rp_name_required');
  return { origin: url.origin, rpID: url.hostname, rpName };
}

/**
 * Registration options for a brand-new account.
 * `userHandleBytes` is the opaque WebAuthn userHandle; it is never derived from
 * the public handle. Discoverable and user-verifying credentials are required.
 */
export async function buildRegistrationOptions(config, { handle, displayName, userHandleBytes, excludeCredentials = [] }) {
  const { rpID, rpName } = rpConfig(config);
  return generateRegistrationOptions({
    rpName,
    rpID,
    userID: userHandleBytes,
    userName: handle,
    userDisplayName: displayName,
    attestationType: 'none',
    excludeCredentials,
    authenticatorSelection: { residentKey: 'required', requireResidentKey: true, userVerification: 'required' },
    timeout: CEREMONY_TIMEOUT_MS,
  });
}

/** Verify a registration response against the stored challenge. */
export async function checkRegistrationResponse(config, { response, expectedChallenge }) {
  const { origin, rpID } = rpConfig(config);
  return verifyRegistrationResponse({
    response, expectedChallenge, expectedOrigin: origin, expectedRPID: rpID, requireUserVerification: true,
  });
}

/**
 * Authentication options for usernameless login: no allowCredentials, so the
 * authenticator offers its own resident keys.
 */
export async function buildAuthenticationOptions(config) {
  const { rpID } = rpConfig(config);
  return generateAuthenticationOptions({ rpID, userVerification: 'required', timeout: CEREMONY_TIMEOUT_MS });
}

/** Verify an assertion. `credential` is { id, publicKey: Uint8Array, counter }. */
export async function checkAuthenticationResponse(config, { response, expectedChallenge, credential }) {
  const { origin, rpID } = rpConfig(config);
  return verifyAuthenticationResponse({
    response, expectedChallenge, expectedOrigin: origin, expectedRPID: rpID, credential, requireUserVerification: true,
  });
}
