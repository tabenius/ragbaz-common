// The mail Dash sends, as Markdoc.
//
// Every message here used to be a string concatenation at its call site. That
// had two costs worth naming: a caller that forgot `subject` shipped an
// unreadable message, and user-supplied text (an interest request's `message`,
// an action summary) was interpolated into the body with no escaping. Here it is
// escaped by construction, because React escapes and the text walker emits the
// parsed value rather than the raw line.
//
// Callers pass { to, data } and get { subject, preview, source } back.

/** The small print under every RAGBAZ message. */
const FOOTER = 'Sent by RAGBAZ. This is a service message; no reply is read.';

// Markdoc separates blocks with a blank line, so the block list is joined with
// one. Joining with a single newline would collapse the whole message into a
// single paragraph, which is exactly what an earlier version of this file did by
// filtering the empty strings out before joining.
const doc = (...blocks) => blocks.filter((b) => b !== null && b !== undefined && b !== '').join('\n\n');

// Each item is its own paragraph. Two `{% item %}` tags on consecutive lines are
// one inline run to Markdoc, and they render as one run-on line in the text part.
const bullet = (items) => items.map((line) => `{% item %}${line}{% /item %}`).join('\n\n');

/**
 * @param {string} name
 * @param {(data: object) => {subject: string, preview?: string, source: string}} build
 */
function template(name, build) {
  return { name, footer: FOOTER, build };
}

/** Template specifications. Each template defines subject, preview, and source (Markdoc). */
export const TEMPLATES = Object.freeze({
  pilotReady: template('pilotReady', ({ serviceName, instanceName, email, origin }) => {
    return {
      subject: `Your ${serviceName} pilot is ready`,
      preview: `Sign in to Dash to get started with ${serviceName}.`,
      source: [
        `{% heading %}Your ${serviceName} pilot is ready{% /heading %}`,
        '',
        `{% lede %}You now have a ${serviceName} pilot on RAGBAZ${instanceName ? `, with a first instance called ${instanceName}` : ''}.{% /lede %}`,
        '',
        `Sign in at ${origin} with this email address (${email}) to get started.`,
        '',
        `{% action href="${origin}" %}Sign in to Dash{% /action %}`,
      ].join('\n'),
    };
  }),

  interestReceived: template('interestReceived', ({ kind, serviceName, accountEmail, message, requestId }) => {
    return {
      subject: `${kind === 'pilot' ? 'Pilot request' : 'Interest'}: ${serviceName} — ${accountEmail}`,
      preview: `${accountEmail} ${kind === 'pilot' ? 'asked for a pilot of' : 'showed interest in'} ${serviceName}.`,
      source: doc(
        `{% heading %}${kind === 'pilot' ? 'Pilot request' : 'Interest'}: ${serviceName}{% /heading %}`,
        `{% lede %}${accountEmail} ${kind === 'pilot' ? 'asked for a pilot of' : 'showed interest in'} ${serviceName} on Dash.{% /lede %}`,
        message ? `They wrote:\n\n> ${String(message).replace(/\n/g, '\n> ')}` : 'They left no message.',
        `Request #${requestId}.`,
      ),
    };
  }),

  instanceInvite: template('instanceInvite', ({ accountEmail, inviteeEmail, instanceName, serviceName, role, origin }) => {
    return {
      subject: `You're invited to ${instanceName} (${serviceName}) on RAGBAZ`,
      preview: `${accountEmail} added you to ${instanceName} as ${role}.`,
      source: [
        `{% heading %}You're invited to ${instanceName}{% /heading %}`,
        '',
        `{% lede %}${accountEmail} added you to ${instanceName}, a ${serviceName} instance, as ${role}.{% /lede %}`,
        '',
        `Sign in at ${origin} with this email address (${inviteeEmail}) to see it. If you don't have a RAGBAZ account yet, signing in creates one.`,
        '',
        `{% action href="${origin}" %}Sign in to Dash{% /action %}`,
      ].join('\n'),
    };
  }),

  devLogin: template('devLogin', ({ link }) => {
    return {
      subject: 'Sign in to RAGBAZ (local dev)',
      preview: 'A sign-in link for your local RAGBAZ.',
      source: [
        '{% heading %}Sign in to your local RAGBAZ{% /heading %}',
        '',
        '{% lede %}Use this link to sign in, or to create your account.{% /lede %}',
        '',
        `{% action href="${link}" %}Open RAGBAZ{% /action %}`,
        '',
        `{% note %}It only signs this browser in on your local RAGBAZ. Local dev has no ragbaz.cc session, and passkeys stay on dash.ragbaz.cc.{% /note %}`,
      ].join('\n'),
    };
  }),

  actionHeld: template('actionHeld', ({ count, name, lines, extra, link }) => {
    return {
      subject: `${count === 1 ? 'An agent action awaits' : `${count} agent actions await`} your decision on ${name}`,
      preview: `Ephor is holding ${count === 1 ? 'an action' : 'actions'} on ${name}.`,
      source: doc(
        `{% heading %}${count === 1 ? 'An agent action awaits' : `${count} agent actions await`} your decision on ${name}{% /heading %}`,
        `{% lede %}Ephor on ${name} is holding ${count === 1 ? 'an action' : 'actions'} for a human decision:{% /lede %}`,
        bullet(lines),
        extra ? `…and ${extra} more.` : '',
        `{% action href="${link}" %}Approve, deny, defer or escalate{% /action %}`,
        `{% note %}A hold is denied when its deadline passes without a decision.{% /note %}`,
      ).join('\n'),
    };
  }),
});

/**
 * Build a message from a template name.
 *
 * @param {string} name
 * @param {object} data
 * @returns {{name: string, subject: string, preview: string, source: string, footer: string}}
 */
export function buildMessage(name, data = {}) {
  const spec = TEMPLATES[name];
  if (!spec) throw new Error(`unknown mail template: ${name}`);
  const built = spec.build(data);
  return { name, footer: spec.footer, subject: built.subject, preview: built.preview || built.subject, source: built.source };
}
