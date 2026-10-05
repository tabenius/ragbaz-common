// createIdentity(config) — the composition point.
//
// No precedent: Mouseion wires handleAuth() into its own router with its own
// table names, which is right there and unusable elsewhere. This returns a
// configured handler that returns null for paths it does not own, so a product
// keeps its own routing, pages and policy.
//
// The three account kinds this supports, and what each one proves:
//
//   passkey   a phishing-resistant hardware credential (Mouseion/Elias.Venn)
//   email     control of an address, stored only as a keyed digest
//   anonymous nothing yet; may hold a short-lived, scope-limited session
//
// Verification is about account security. It is never publication permission:
// products record that separately, per field, with their own evidence.

import { problem, json } from './request-bounds.js';
import { gateRequest, DEFAULT_LIMITS } from './abuse-gate.js';
import { normalizeHandle, validateHandle, suggestHandle } from './handles.js';
import {
  randomId, newUserHandle, newOpaqueToken, sha256Base64url, fromBase64url,
  generateRecoveryCodes,
} from './crypto.js';
import {
  buildRegistrationOptions, checkRegistrationResponse,
  buildAuthenticationOptions, checkAuthenticationResponse, rpConfig,
} from './webauthn.js';
import { verifyTurnstile } from './turnstile.js';
import {
  normalizeEmail, emailBinding, issueEmailCode, verifyEmailCode, verificationMessage,
} from './email-code.js';
import {
  mintSession, resolveSession, hasScope, isElevated, publicSession,
  sessionCookieHeader, clearedSessionCookieHeader,
  SESSION_TTL_MS, TEMPORARY_SESSION_TTL_MS, STEP_UP_TTL_MS,
} from './sessions.js';

const CHALLENGE_TTL_MS = 5 * 60 * 1000;
const MAX_DISPLAY_NAME = 80;
const VERIFICATION_RANK = { anonymous: 0, email: 1, passkey: 2, both: 3 };
const combined = (a, b) => (a === b ? a : (VERIFICATION_RANK[a] >= VERIFICATION_RANK[b] ? a : b));

const REQUIRED_CONFIG = ['origin', 'rpName', 'cookie', 'tablePrefix'];

export function createIdentity(config) {
  for (const key of REQUIRED_CONFIG) {
    if (typeof config[key] !== 'string' || !config[key]) throw new Error(`identity config requires ${key}`);
  }
  const { origin, rpName, cookie, tablePrefix } = config;
  const prefix = `${tablePrefix}_`;
  const reserved = config.reservedHandles ?? [];
  const profileBase = config.profileBase ?? '/p/';
  const rp = rpConfig({ origin, rpName });
  const tables = {
    accounts: `${prefix}accounts`, pseudonyms: `${prefix}pseudonyms`,
    sessions: `${prefix}sessions`, passkeys: `${prefix}passkeys`,
    challenges: `${prefix}webauthn_challenges`, buckets: `${prefix}auth_rate_buckets`,
    audit: `${prefix}audit_events`, recovery: `${prefix}recovery_codes`,
    emailBindings: `${prefix}email_bindings`, emailChallenges: `${prefix}email_challenges`,
  };

  const now = () => new Date().toISOString();
  const later = (ms, from = Date.now()) => new Date(from + ms).toISOString();
  const fail = (status, error, headers) => problem(status, error, headers);
  const sameOrigin = request => request.headers.get('origin') === origin;

  /**
   * resolveSession() wants the session/accounts/pseudonyms table names under
   * their own keys. Building the mapping once here keeps that translation out of
   * every call site, where it was previously wrong in all six.
   */
  const sessionOptions = () => ({
    table: tables.sessions, accounts: tables.accounts, pseudonyms: tables.pseudonyms, cookie,
  });

  function requireHashKey(env) {
    if (!env.IDENTITY_HASH_KEY) throw new Error('identity_hash_key_missing');
    return env.IDENTITY_HASH_KEY;
  }

  async function audit(env, { action, accountId = null, pseudonymId = null, detail = '{}', sessionId = null, passkeyId = null }) {
    await env.DB.prepare(
      `INSERT INTO ${tables.audit} (id, account_id, pseudonym_id, action, detail, passkey_id, session_id, created_at)
       VALUES (?1,?2,?3,?4,?5,?6,?7,?8)`,
    ).bind(randomId('aud'), accountId, pseudonymId, action, detail, passkeyId, sessionId, now()).run();
  }

  /** Create the anonymous account every other path builds on. */
  async function createAccount(env, { verification = 'anonymous', webauthnUserHandle = null } = {}) {
    const id = randomId('acc');
    const at = now();
    await env.DB.prepare(
      `INSERT INTO ${tables.accounts} (id, webauthn_user_handle, status, verification, created_at, updated_at)
       VALUES (?1,?2,'active',?3,?4,?4)`,
    ).bind(id, webauthnUserHandle, verification, at).run();
    return id;
  }

  /**
   * Claim a public handle. Uniqueness is the database's job; the deterministic
   * suggestion means an anonymous account can have a stable pseudonym later
   * without storing one up front.
   */
  async function claimHandle(env, accountId, rawHandle) {
    const handle = normalizeHandle(rawHandle);
    const check = validateHandle(handle, reserved);
    if (!check.ok) return { ok: false, reason: check.reason };
    const taken = await env.DB.prepare(`SELECT 1 FROM ${tables.pseudonyms} WHERE handle = ?1`).bind(handle).first();
    if (taken) return { ok: false, reason: 'taken' };
    const id = randomId('psd');
    const displayName = cleanDisplayName(handle, handle);
    await env.DB.prepare(
      `INSERT INTO ${tables.pseudonyms} (id, account_id, handle, display_name, created_at) VALUES (?1,?2,?3,?4,?5)`,
    ).bind(id, accountId, handle, displayName, now()).run();
    return { ok: true, pseudonymId: id, handle, displayName, profileUrl: `${profileBase}${handle}` };
  }

  function cleanDisplayName(input, fallback) {
    const name = String(input ?? '').trim().replace(/\s+/g, ' ');
    return (name || fallback).slice(0, MAX_DISPLAY_NAME);
  }

  /**
   * GET /auth/available?handle=...
   *
   * An enumeration oracle, which is why the abuse gate rate limits this GET.
   * The answer stays the same shape for reserved and taken names so a caller
   * cannot distinguish "we reserve this" from "someone has this".
   */
  async function handleAvailable(request, env) {
    const handle = normalizeHandle(new URL(request.url).searchParams.get('handle') || '');
    const check = validateHandle(handle, reserved);
    if (!check.ok) return json({ available: false, handle, reason: check.reason === 'format' ? 'format' : 'unavailable' });
    const taken = await env.DB.prepare(`SELECT 1 FROM ${tables.pseudonyms} WHERE handle = ?1`).bind(handle).first();
    return json({ available: !taken, handle, ...(taken ? { reason: 'unavailable' } : {}) });
  }

  // ---- passkey registration -------------------------------------------------

  async function handleRegisterOptions(request, env) {
    const body = await readJson(request);
    if (!body) return fail(400, 'bad_request');
    const wantsHandle = typeof body.handle === 'string' && body.handle.trim();
    let handle;
    if (wantsHandle) {
      const availability = await handleAvailable(request, env);
      const parsed = availability ? JSON.parse(await availability.text()) : { available: false, reason: 'format' };
      if (!parsed.available) return fail(409, 'handle_unavailable');
      handle = parsed.handle;
    } else {
      // An anonymous passkey account still needs a stable public identity, so
      // mint a deterministic suggestion rather than leaving the account handle-less.
      handle = suggestHandle(randomId('seed'));
    }
    const userHandle = newUserHandle();
    const options = await buildRegistrationOptions(rp, {
      handle, displayName: cleanDisplayName(body.displayName, handle), userHandleBytes: userHandle.bytes,
    });
    const ticket = randomId('reg');
    await env.DB.prepare(
      `INSERT INTO ${tables.challenges} (id, purpose, challenge, handle, display_name, user_handle, expires_at)
       VALUES (?1,'register',?2,?3,?4,?5,?6)`,
    ).bind(ticket, options.challenge, handle, cleanDisplayName(body.displayName, handle), userHandle.b64url, later(CHALLENGE_TTL_MS)).run();
    return json({ ticket, options });
  }

  /**
   * Verify a registration and create the account, pseudonym, passkey, recovery
   * codes and session in one batch.
   *
   * Every insert is conditioned on the verified challenge still existing, so a
   * replay that loses the race produces no account and no session.
   */
  async function handleRegisterVerify(request, env) {
    const body = await readJson(request);
    if (!body?.ticket || !body?.response) return fail(400, 'bad_request');
    const challenge = await env.DB.prepare(
      `SELECT id, challenge, handle, display_name, user_handle, expires_at
         FROM ${tables.challenges} WHERE id = ?1 AND purpose = 'register'`,
    ).bind(body.ticket).first();
    if (!challenge) return fail(400, 'unknown_ticket');
    if (challenge.expires_at <= now()) {
      await env.DB.prepare(`DELETE FROM ${tables.challenges} WHERE id = ?1`).bind(challenge.id).run();
      return fail(400, 'expired');
    }

    let verification;
    try {
      verification = await checkRegistrationResponse(rp, {
        response: body.response, expectedChallenge: challenge.challenge,
      });
    } catch {
      return fail(400, 'verification_failed');
    }
    if (!verification.verified || !verification.registrationInfo) return fail(400, 'not_verified');

    const accountId = randomId('acc'), pseudonymId = randomId('psd'), passkeyId = randomId('pk');
    const credential = verification.registrationInfo.credential;
    const at = now();
    const recoveryCodes = await generateRecoveryCodes(10);
    const session = await newOpaqueToken();
    const guard = `EXISTS (SELECT 1 FROM ${tables.challenges} WHERE id = ?N AND purpose = 'register')`;
    const bind = (statement, ...values) => env.DB.prepare(statement.replace(/\?N/g, '?'));

    await env.DB.batch([
      bind(`INSERT INTO ${tables.accounts} (id, webauthn_user_handle, status, verification, created_at, updated_at)
            SELECT ?1,?2,'active','passkey',?3,?3 WHERE ${guard}`, accountId, challenge.user_handle, at, challenge.id),
      bind(`INSERT INTO ${tables.pseudonyms} (id, account_id, handle, display_name, created_at)
            SELECT ?1,?2,?3,?4,?5 WHERE EXISTS (SELECT 1 FROM ${tables.accounts} WHERE id = ?2)
              AND ${guard}`, pseudonymId, accountId, challenge.handle, challenge.display_name, at, challenge.id),
      bind(`INSERT INTO ${tables.passkeys} (id, account_id, credential_id, public_key, sign_count, transports, aaguid, created_at)
            SELECT ?1,?2,?3,?4,?5,?6,?7,?8 WHERE EXISTS (SELECT 1 FROM ${tables.accounts} WHERE id = ?2)
              AND ${guard}`, passkeyId, accountId, credential.id, buffer(credential.publicKey).toString('base64url'),
        credential.counter ?? 0, JSON.stringify(body.response?.response?.transports ?? []),
        verification.registrationInfo.aaguid ?? null, at, challenge.id),
      ...recoveryCodes.map(code => bind(
        `INSERT INTO ${tables.recovery} (id, account_id, code_hash, created_at)
         SELECT ?1,?2,?3,?4 WHERE EXISTS (SELECT 1 FROM ${tables.accounts} WHERE id = ?2) AND ${guard}`,
        randomId('rc'), accountId, code.hash, at, challenge.id)),
      bind(`INSERT INTO ${tables.sessions} (id, account_id, temporary, scopes_json, user_agent, created_at, last_seen_at, expires_at)
            SELECT ?1,?2,0,'[]',?3,?4,?4,?5 WHERE EXISTS (SELECT 1 FROM ${tables.accounts} WHERE id = ?2)
              AND ${guard}`, session.hash, accountId, (request.headers.get('user-agent') || '').slice(0, 300), at, later(SESSION_TTL_MS), challenge.id),
      bind(`INSERT INTO ${tables.audit} (id, account_id, pseudonym_id, action, detail, passkey_id, session_id, created_at)
            SELECT ?1,?2,?3,'account.registered','{}',?4,?5,?6 WHERE EXISTS (SELECT 1 FROM ${tables.sessions} WHERE id = ?5)
              AND ${guard}`, randomId('aud'), accountId, pseudonymId, passkeyId, session.hash, at, challenge.id),
      env.DB.prepare(`DELETE FROM ${tables.challenges} WHERE id = ?1`).bind(challenge.id),
    ]);

    const stored = await env.DB.prepare(`SELECT 1 FROM ${tables.sessions} WHERE id = ?1`).bind(session.hash).first();
    if (!stored) return fail(409, 'ceremony_consumed');

    return json({
      ok: true, handle: challenge.handle, displayName: challenge.display_name,
      profileUrl: `${profileBase}${challenge.handle}`, verification: 'passkey',
      recoveryCodes: recoveryCodes.map(code => code.plain),
    }, 200, { 'set-cookie': sessionCookieHeader({ cookie, token: session.token, origin }) });
  }

  // ---- passkey login --------------------------------------------------------

  async function handleLoginOptions(request, env) {
    const options = await buildAuthenticationOptions(rp);
    const ticket = randomId('log');
    await env.DB.prepare(
      `INSERT INTO ${tables.challenges} (id, purpose, challenge, expires_at) VALUES (?1,'authenticate',?2,?3)`,
    ).bind(ticket, options.challenge, later(CHALLENGE_TTL_MS)).run();
    return json({ ticket, options });
  }

  async function handleLoginVerify(request, env) {
    const body = await readJson(request);
    if (!body?.ticket || !body?.response?.id) return fail(400, 'bad_request');
    const challenge = await env.DB.prepare(
      `SELECT id, challenge, expires_at FROM ${tables.challenges} WHERE id = ?1 AND purpose = 'authenticate'`,
    ).bind(body.ticket).first();
    const failLogin = () => {
      if (challenge) env.DB.prepare(`DELETE FROM ${tables.challenges} WHERE id = ?1`).bind(challenge.id).run();
      return fail(401, 'authentication_failed');
    };
    if (!challenge) return fail(400, 'unknown_ticket');
    if (challenge.expires_at <= now()) return failLogin();

    const passkey = await env.DB.prepare(
      `SELECT id, account_id, public_key, sign_count FROM ${tables.passkeys}
        WHERE credential_id = ?1 AND revoked_at IS NULL`,
    ).bind(body.response.id).first();
    if (!passkey) return failLogin();

    let verification;
    try {
      verification = await checkAuthenticationResponse(rp, {
        response: body.response, expectedChallenge: challenge.challenge,
        credential: { id: body.response.id, publicKey: fromBase64urlStored(passkey.public_key), counter: passkey.sign_count },
      });
    } catch { return failLogin(); }
    if (!verification.verified) return failLogin();

    const session = await newOpaqueToken();
    const at = now();
    const guard = `EXISTS (SELECT 1 FROM ${tables.challenges} WHERE id = ?N AND purpose = 'authenticate')`;
    const bind = (statement, ...values) => env.DB.prepare(statement.replace(/\?N/g, '?'));
    await env.DB.batch([
      bind(`UPDATE ${tables.passkeys} SET sign_count = ?1, last_used_at = ?2 WHERE id = ?3 AND ${guard}`,
        verification.authenticationInfo?.newCounter ?? passkey.sign_count, at, passkey.id, challenge.id),
      bind(`INSERT INTO ${tables.sessions} (id, account_id, temporary, scopes_json, user_agent, created_at, last_seen_at, expires_at)
            SELECT ?1,?2,0,'[]',?3,?4,?4,?5 WHERE ${guard}`,
        session.hash, passkey.account_id, (request.headers.get('user-agent') || '').slice(0, 300), at, later(SESSION_TTL_MS), challenge.id),
      env.DB.prepare(`DELETE FROM ${tables.challenges} WHERE id = ?1`).bind(challenge.id),
    ]);

    const stored = await env.DB.prepare(`SELECT 1 FROM ${tables.sessions} WHERE id = ?1`).bind(session.hash).first();
    if (!stored) return fail(409, 'ceremony_consumed');
    const account = await accountView(env, passkey.account_id);
    if (!account) return failLogin();
    return json({ ok: true, ...account }, 200, { 'set-cookie': sessionCookieHeader({ cookie, token: session.token, origin }) });
  }

  // ---- email verification ---------------------------------------------------

  /**
   * POST /auth/email/start
   *
   * Issues a code for an address. With no session this creates the anonymous
   * account first, so verifying an address is a real account transition rather
   * than a token floating in the mail.
   */
  async function handleEmailStart(request, env) {
    const body = await readJson(request);
    let email;
    try { email = normalizeEmail(body?.email); } catch { return fail(400, 'invalid_email'); }
    const hashKey = requireHashKey(env);
    const session = await resolveSession(env.DB, request, sessionOptions());
    const accountId = session?.accountId ?? await createAccount(env);
    const { emailHash } = await emailBinding(email, hashKey);
    const existing = await env.DB.prepare(
      `SELECT id FROM ${tables.emailBindings} WHERE account_id = ?1 AND revoked_at IS NULL`,
    ).bind(accountId).first();
    // Do not reveal that this account already has a verified address; the caller
    // is authenticated to the account, so a 409 here is informative to them only.
    if (existing) return fail(409, 'email_already_verified');
    const issue = await issueEmailCode({ email, hashKey });
    await env.DB.prepare(
      `INSERT INTO ${tables.emailChallenges} (id, account_id, email_hash, code_hash, created_at, expires_at)
       VALUES (?1,?2,?3,?4,?5,?6)`,
    ).bind(randomId('emc'), accountId, issue.emailHash, issue.codeHash, issue.createdAt, issue.expiresAt).run();
    if (config.emailSender?.send) {
      await config.emailSender.send({
        to: email,
        ...verificationMessage({
          code: issue.code, appName: rpName,
          purpose: config.emailPurpose ?? 'verify your email address',
        }),
      });
    }
    await audit(env, { action: 'account.email_started', accountId, detail: JSON.stringify({ emailHash }) });
    return json({ ok: true, expiresAt: issue.expiresAt }, 202);
  }

  async function handleEmailVerify(request, env) {
    const body = await readJson(request);
    if (!body?.challenge_id || !body?.code) return fail(400, 'bad_request');
    const hashKey = requireHashKey(env);
    const row = await env.DB.prepare(
      `SELECT id, account_id, email_hash, code_hash, verify_attempts, expires_at
         FROM ${tables.emailChallenges} WHERE id = ?1`,
    ).bind(body.challenge_id).first();
    if (!row) return fail(400, 'unknown_challenge');
    if (row.expires_at <= now()) {
      await env.DB.prepare(`DELETE FROM ${tables.emailChallenges} WHERE id = ?1`).bind(row.id).run();
      return fail(400, 'expired');
    }
    if (Number(row.verify_attempts) >= 5) {
      await env.DB.prepare(`DELETE FROM ${tables.emailChallenges} WHERE id = ?1`).bind(row.id).run();
      return fail(429, 'verification_attempts_exhausted');
    }
    await env.DB.prepare(`UPDATE ${tables.emailChallenges} SET verify_attempts = verify_attempts + 1 WHERE id = ?1`).bind(row.id).run();
    if (!(await verifyEmailCode(body.code, row.code_hash, hashKey))) return fail(400, 'invalid_code');

    const at = now();
    // Bind and consume in one batch, so a replay of the same code finds nothing.
    await env.DB.batch([
      env.DB.prepare(
        `INSERT INTO ${tables.emailBindings} (id, account_id, email_hash, verified_at, created_at)
         SELECT ?1,?2,?3,?4,?4 WHERE EXISTS (SELECT 1 FROM ${tables.emailChallenges} WHERE id = ?5)`,
      ).bind(randomId('emb'), row.account_id, row.email_hash, at, row.id),
      env.DB.prepare(`DELETE FROM ${tables.emailChallenges} WHERE id = ?1`).bind(row.id),
      env.DB.prepare(
        `UPDATE ${tables.accounts} SET verification = ?, updated_at = ? WHERE id = ?
           AND verification IN ('anonymous','email')`,
      ).bind('email', at, row.account_id),
      env.DB.prepare(
        `INSERT INTO ${tables.audit} (id, account_id, action, detail, created_at) VALUES (?1,?2,'account.email_verified','{}',?3)`,
      ).bind(randomId('aud'), row.account_id, at),
    ]);
    const account = await accountView(env, row.account_id);
    return json({ ok: true, ...account });
  }

  // ---- temporary sessions ---------------------------------------------------

  /**
   * POST /auth/temporary
   *
   * A short-lived, scope-limited grant. This is what lets someone start a draft
   * before deciding who they are. It cannot reach anything account-level: the
   * scope list is an allowlist checked by the product, and the session expires in
   * an hour.
   */
  async function handleTemporaryStart(request, env) {
    const body = await readJson(request);
    const scopes = Array.isArray(body?.scopes) ? body.scopes.filter(s => typeof s === 'string') : [];
    if (!scopes.length) return fail(400, 'scopes_required');
    if (config.turnstile?.secretKey) {
      const result = await verifyTurnstile({
        secretKey: config.turnstile.secretKey,
        token: body?.turnstile_token,
        remoteip: request.headers.get('cf-connecting-ip') || undefined,
      });
      if (!result.ok) return fail(result.reason === 'invalid_token' || result.reason === 'missing_token' ? 400 : 503, 'human_verification_failed');
    }
    const session = await resolveSession(env.DB, request, sessionOptions());
    const accountId = session?.accountId ?? await createAccount(env);
    let handle = null;
    if (!session?.handle) {
      const claimed = await claimHandle(env, accountId, suggestHandle(accountId));
      handle = claimed.ok ? claimed.handle : null;
    }
    const minted = await mintSession(env.DB, {
      table: tables.sessions, accountId, temporary: true, scopes,
      userAgent: request.headers.get('user-agent') || '',
    });
    await audit(env, { action: 'session.temporary_started', accountId, detail: JSON.stringify({ scopes: minted.scopes }) });
    return json({
      ok: true, temporary: true, scopes: minted.scopes, expiresAt: minted.expiresAt,
      handle, profileUrl: handle ? `${profileBase}${handle}` : null,
      verification: 'anonymous',
    }, 202, {
      'set-cookie': sessionCookieHeader({ cookie, token: minted.token, origin, ttlMs: TEMPORARY_SESSION_TTL_MS }),
    });
  }

  // ---- step-up, logout, session --------------------------------------------

  async function handleStepupOptions(request, env) {
    const session = await resolveSession(env.DB, request, sessionOptions());
    if (!session) return fail(401, 'authentication_required');
    const options = await buildAuthenticationOptions(rp);
    const ticket = randomId('sup');
    await env.DB.prepare(
      `INSERT INTO ${tables.challenges} (id, purpose, challenge, account_id, expires_at) VALUES (?1,'authenticate',?2,?3,?4)`,
    ).bind(ticket, options.challenge, session.accountId, later(CHALLENGE_TTL_MS)).run();
    return json({ ticket, options });
  }

  async function handleStepupVerify(request, env) {
    const session = await resolveSession(env.DB, request, sessionOptions());
    if (!session) return fail(401, 'authentication_required');
    const body = await readJson(request);
    if (!body?.ticket || !body?.response?.id) return fail(400, 'bad_request');
    const challenge = await env.DB.prepare(
      `SELECT id, challenge, account_id, expires_at FROM ${tables.challenges} WHERE id = ?1 AND purpose = 'authenticate'`,
    ).bind(body.ticket).first();
    if (!challenge) return fail(400, 'unknown_ticket');
    if (challenge.expires_at <= now() || challenge.account_id !== session.accountId) {
      await env.DB.prepare(`DELETE FROM ${tables.challenges} WHERE id = ?1`).bind(challenge.id).run();
      return fail(401, 'stepup_failed');
    }
    const passkey = await env.DB.prepare(
      `SELECT id, public_key, sign_count FROM ${tables.passkeys} WHERE credential_id = ?1 AND account_id = ?2 AND revoked_at IS NULL`,
    ).bind(body.response.id, session.accountId).first();
    if (!passkey) return fail(401, 'stepup_failed');
    let verification;
    try {
      verification = await checkAuthenticationResponse(rp, {
        response: body.response, expectedChallenge: challenge.challenge,
        credential: { id: body.response.id, publicKey: fromBase64urlStored(passkey.public_key), counter: passkey.sign_count },
      });
    } catch { return fail(401, 'stepup_failed'); }
    if (!verification.verified) return fail(401, 'stepup_failed');

    const sessionId = await sha256Base64url(
      (request.headers.get('cookie') || '').match(new RegExp(`${cookie}=([^;]+)`))?.[1] ?? '',
    );
    const elevatedUntil = later(STEP_UP_TTL_MS);
    await env.DB.batch([
      env.DB.prepare(`UPDATE ${tables.passkeys} SET sign_count = ?1, last_used_at = ?2 WHERE id = ?3`)
        .bind(verification.authenticationInfo?.newCounter ?? passkey.sign_count, now(), passkey.id),
      env.DB.prepare(`UPDATE ${tables.sessions} SET elevated_until = ?1 WHERE id = ?2`).bind(elevatedUntil, sessionId),
      env.DB.prepare(`INSERT INTO ${tables.audit} (id, account_id, action, detail, passkey_id, session_id, created_at) VALUES (?1,?2,'account.stepup','{}',?3,?4,?5)`)
        .bind(randomId('aud'), session.accountId, passkey.id, sessionId, now()),
      env.DB.prepare(`DELETE FROM ${tables.challenges} WHERE id = ?1`).bind(challenge.id),
    ]);
    return json({ ok: true, elevatedUntil });
  }

  async function handleLogout(request, env) {
    const token = (request.headers.get('cookie') || '').match(new RegExp(`${cookie}=([^;]+)`))?.[1];
    if (token) {
      await env.DB.prepare(`DELETE FROM ${tables.sessions} WHERE id = ?1`).bind(await sha256Base64url(decodeURIComponent(token))).run();
    }
    return json({ ok: true }, 200, { 'set-cookie': clearedSessionCookieHeader({ cookie, origin }) });
  }

  /** GET /auth/session — the public view of the current session. */
  async function handleSession(request, env) {
    const session = await resolveSession(env.DB, request, sessionOptions());
    if (!session) return json(publicSession(null, { profileBase }));
    const account = await env.DB.prepare(`SELECT verification FROM ${tables.accounts} WHERE id = ?1`).bind(session.accountId).first();
    return json(publicSession(session, { verification: account?.verification ?? 'anonymous', profileBase }));
  }

  /** An allowlist. Never spreads an account row. */
  async function accountView(env, accountId) {
    const row = await env.DB.prepare(
      `SELECT a.verification, p.handle, p.display_name FROM ${tables.accounts} a
         LEFT JOIN ${tables.pseudonyms} p ON p.id = (
           SELECT p2.id FROM ${tables.pseudonyms} p2 WHERE p2.account_id = a.id
            ORDER BY p2.created_at ASC, p2.id ASC LIMIT 1)
        WHERE a.id = ?1 AND a.status = 'active'`,
    ).bind(accountId).first();
    if (!row) return null;
    return {
      verification: row.verification,
      handle: row.handle ?? null,
      displayName: row.display_name ?? null,
      profileUrl: row.handle ? `${profileBase}${row.handle}` : null,
    };
  }

  async function readJson(request) {
    try { return await request.json(); } catch { return null; }
  }

  const ROUTES = {
    'available': { get: handleAvailable, post: null },
    'register/options': { post: handleRegisterOptions },
    'register/verify': { post: handleRegisterVerify },
    'login/options': { post: handleLoginOptions },
    'login/verify': { post: handleLoginVerify },
    'logout': { post: handleLogout },
    'session': { get: handleSession },
    'stepup/options': { post: handleStepupOptions },
    'stepup/verify': { post: handleStepupVerify },
    'email/start': { post: handleEmailStart },
    'email/verify': { post: handleEmailVerify },
    'temporary': { post: handleTemporaryStart },
  };

  /**
   * Route /auth/*. Returns null when the path is not an auth path, so a product
   * keeps its own router. Never returns a redirect.
   *
   * The bare prefix is also null: a product usually renders its own sign-in page
   * there, and this package has no opinion about what one looks like.
   */
  async function handle(request, env = {}, ctx) {
    const prefix = config.prefix ?? '/auth';
    const url = new URL(request.url);
    const root = prefix.replace(/\/+$/, '');
    if (!url.pathname.startsWith(`${root}/`)) return null;
    if (!env.DB?.prepare) return problem(503, 'identity_unavailable');
    if (!sameOrigin(request) && !['GET', 'HEAD'].includes(request.method)) return problem(403, 'bad_origin');

    const sub = url.pathname.slice(root.length + 1).replace(/\/+$/, '');
    const gated = await gateRequest(request, {
      env, prefix: root, origin, db: env.DB, tables, limits: config.limits ?? DEFAULT_LIMITS,
      jsonRoutes: new Set(Object.keys(ROUTES).filter(key => key !== 'available' && key !== 'session')),
      maxBytes: config.maxJsonBytes,
    });
    if (gated instanceof Response) return gated;

    const route = ROUTES[sub];
    if (!route) return problem(404, 'not_found');
    const method = ['GET', 'HEAD'].includes(request.method) ? 'get' : 'post';
    const handler = route[method];
    if (!handler) {
      const allowed = Object.entries(route).filter(([, fn]) => fn).map(([key]) => key.toUpperCase()).join(', ');
      return new Response(null, { status: 405, headers: { allow: allowed || 'GET', 'cache-control': 'no-store' } });
    }
    try {
      return await handler(gated ?? request, env, ctx);
    } catch (error) {
      // A missing secret or an unexpected fault must read as unavailable, never as
      // a stack trace in a response body. The cause is the operator's to inspect
      // in their own logs.
      console.error('identity route failed', sub, error?.message);
      return problem(503, 'identity_unavailable');
    }
  }

  return {
    handle,
    tables,
    config: { origin, rpName, cookie, tablePrefix, prefix: config.prefix ?? '/auth' },
    rp,
    // Composed capabilities a product may reuse directly.
    sessions: {
      resolve: (request, env) => resolveSession(env.DB, request, sessionOptions()),
      mint: (env, options) => mintSession(env.DB, { table: tables.sessions, ...options }),
      hasScope, isElevated, public: publicSession, cookie: sessionCookieHeader, clearCookie: clearedSessionCookieHeader,
    },
    handles: { normalize: normalizeHandle, validate: (handle) => validateHandle(handle, reserved), claim: (env, accountId, handle) => claimHandle(env, accountId, handle), suggest: suggestHandle },
    account: accountView,
    _internal: { createAccount, claimHandle, audit, requireHashKey },
  };
}

// Decode a stored base64url public key back to bytes for the verifier.
function fromBase64urlStored(value) {
  return fromBase64url(value);
}

export { combined as combineVerification, TEMPORARY_SESSION_TTL_MS, SESSION_TTL_MS };
