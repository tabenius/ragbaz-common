// @ts-check
/** Keyboard contracts shared by React widgets and plain HTML/JS surfaces. */
/** Native web behavior is documented, never replaced with terminal Tab semantics. */
export const WEB_BINDINGS = [
  { keys: ['Tab', 'Shift+Tab'], action: 'focus', scope: 'native', description: 'Move between controls' },
  { keys: ['Enter', 'Space'], action: 'activate', scope: 'native', description: 'Activate a button or disclosure (Enter follows a link)' },
  { keys: ['Escape'], action: 'close', scope: 'native', description: 'Close a dialog; return from task inspection' },
  { keys: ['ArrowRight', 'l'], action: 'next', scope: 'tabs', description: 'Next workspace tab' },
  { keys: ['ArrowLeft', 'h'], action: 'previous', scope: 'tabs', description: 'Previous workspace tab' },
  { keys: ['Home', '0'], action: 'first', scope: 'tabs', description: 'First workspace tab' },
  { keys: ['End', '$'], action: 'last', scope: 'tabs', description: 'Last workspace tab' },
  { keys: ['ArrowDown', 'j'], action: 'record-down', scope: 'records', description: 'Record below (within the current column)' },
  { keys: ['ArrowUp', 'k'], action: 'record-up', scope: 'records', description: 'Record above (within the current column)' },
  { keys: ['ArrowRight', 'l'], action: 'record-right', scope: 'records', description: 'Record to the right' },
  { keys: ['ArrowLeft', 'h'], action: 'record-left', scope: 'records', description: 'Record to the left' },
  { keys: ['Home', '0'], action: 'record-first', scope: 'records', description: 'First record control' },
  { keys: ['End', '$'], action: 'record-last', scope: 'records', description: 'Last record control' },
  { keys: ['/'], action: 'search', scope: 'shortcut', description: 'Focus search in the current view' },
  { keys: ['r'], action: 'refresh', scope: 'shortcut', description: 'Refresh the displayed source' },
  { keys: ['?'], action: 'help', scope: 'shortcut', description: 'Open keyboard help' },
];

/** @param {string} key @param {'tabs' | 'shortcut' | 'records'} scope */
export function resolveWebKey(key, scope) {
  return WEB_BINDINGS.find(binding => binding.scope === scope && (/** @type {readonly string[]} */ (binding.keys)).includes(key))?.action;
}
/** @param {string} key @param {number} index @param {number} count @param {boolean} [vim] */
export function webTabIndex(key, index, count, vim = false) {
  if (count < 1) return null;
  if (key.length === 1 && !vim) return null;
  switch (resolveWebKey(key, 'tabs')) {
    case 'next': return (index + 1) % count;
    case 'previous': return (index + count - 1) % count;
    case 'first': return 0;
    case 'last': return count - 1;
    default: return null;
  }
}
/** @param {string} key @param {number} index @param {number} count @param {boolean} [vim] */
export function webRecordIndex(key, index, count, vim = false) {
  if (key.length === 1 && !vim) return null;
  switch (resolveWebKey(key, 'records')) {
    case 'record-down': case 'record-right': return count ? Math.min(index + 1, count - 1) : -1;
    case 'record-up': case 'record-left': return count ? Math.max(0, index - 1) : -1;
    case 'record-first': return count ? 0 : -1;
    case 'record-last': return count - 1;
    default: return null;
  }
}
/** Geometry stays view-derived, so columns and responsive reflow need no model transform. */
/** @param {string} key @param {number} index @param {{left: number, top: number, width: number, height: number}[]} boxes @param {boolean} [vim] */
export function spatialRecordIndex(key, index, boxes, vim = false) {
  const linear = webRecordIndex(key, index, boxes.length, vim);
  if (linear === null || linear < 0 || !boxes[index]) return linear;
  const action = resolveWebKey(key, 'records');
  if (action === 'record-first' || action === 'record-last') return linear;
  const box = boxes[index];
  /** @param {{left: number, top: number, width: number, height: number}} value */
  const center = value => ({ x: value.left + value.width / 2, y: value.top + value.height / 2 });
  const from = center(box);
  const candidates = boxes.map((target, targetIndex) => ({ target, targetIndex })).filter(({ target, targetIndex }) => {
    if (targetIndex === index) return false;
    const sameColumn = target.left < box.left + box.width && target.left + target.width > box.left;
    const sameRow = target.top < box.top + box.height && target.top + target.height > box.top;
    if (action === 'record-down') return sameColumn && target.top >= box.top + box.height - 1;
    if (action === 'record-up') return sameColumn && target.top + target.height <= box.top + 1;
    if (action === 'record-right') return sameRow && target.left >= box.left + box.width - 1;
    if (action === 'record-left') return sameRow && target.left + target.width <= box.left + 1;
    return false;
  });
  candidates.sort((a, b) => { const ac = center(a.target), bc = center(b.target); return Math.hypot(ac.x - from.x, ac.y - from.y) - Math.hypot(bc.x - from.x, bc.y - from.y); });
  return candidates[0]?.targetIndex ?? index;
}
/** @param {EventTarget | null} target */
export function isEditingTarget(target) {
  return target instanceof Element && Boolean(target.closest('input, textarea, select, [contenteditable]:not([contenteditable="false"]), [role="textbox"]'));
}
