// @ts-check
/**
 * Reading-specific keyboard contract for Markdoc/RAGBAZ document readers.
 * Kept separate from the web widget bindings: `l` opens the reading legend and
 * `Shift+L` advances a paper spread, while the web contract uses letters only
 * behind an explicit Vim opt-in.
 */
export const READING_BINDINGS = Object.freeze([
  { keys: ['f'], label: 'Toggle fullscreen', action: 'fullscreen' },
  { keys: ['Escape'], label: 'Leave fullscreen / dismiss open controls', action: 'escape' },
  { keys: ['ArrowLeft', 'h'], label: 'Paper view · previous spread', action: 'previous' },
  { keys: ['ArrowRight', 'L'], label: 'Paper view · next spread', action: 'next' },
  { keys: ['ArrowUp', 'k'], label: 'Flow view · scroll up', action: 'up' },
  { keys: ['ArrowDown', 'j'], label: 'Flow view · scroll down', action: 'down' },
  { keys: ['Home'], label: 'Beginning of document', action: 'home' },
  { keys: ['End'], label: 'End of document', action: 'end' },
  { keys: ['PageUp'], label: 'Previous screen / spread', action: 'page-up' },
  { keys: ['PageDown'], label: 'Next screen / spread', action: 'page-down' },
  { keys: ['l'], label: 'Toggle shortcut legend', action: 'legend' },
]);

const KEY_LABELS = Object.freeze({
  ArrowLeft: '←',
  ArrowRight: '→',
  ArrowUp: '↑',
  ArrowDown: '↓',
  Escape: 'Esc',
  L: 'Shift+L',
  PageUp: 'PgUp',
  PageDown: 'PgDn',
});

/** @param {string} key */
export function readingKeyLabel(key) {
  return KEY_LABELS[/** @type {keyof typeof KEY_LABELS} */ (key)] || key;
}

/** @param {string} key */
export function resolveReadingAction(key) {
  return READING_BINDINGS.find(binding => binding.keys.includes(key))?.action;
}
