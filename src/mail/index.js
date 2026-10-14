// Public entry point for the shared mail layer.
//
// Exports the mail templates, buildMessage function, and rendering utilities
// that other RAGBAZ projects can import and use.
//
// Each project keeps its own `sendMail` wrapper with env bindings
// (RESEND_API_KEY, RESEND_FROM), but the templates/rendering can be shared.
export { buildMessage, TEMPLATES } from './templates.js';
export { toPlainText, renderEmail } from './render.js';
export { TAGS, NODES } from './render.js';
