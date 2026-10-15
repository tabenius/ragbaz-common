// One binding table supplies both the menu/help text and keyboard dispatch.
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
const keyLabel = key => ({ ArrowLeft: '←', ArrowRight: '→', ArrowUp: '↑', ArrowDown: '↓', Escape: 'Esc', L: 'Shift+L', PageUp: 'PgUp', PageDown: 'PgDn' })[key] || key;

export function setupReadingNavigation({ onModeChange = () => {}, closeOverlays = () => {}, closeMenu = () => {} } = {}) {
  const $ = id => document.getElementById(id);
  const layout = document.querySelector('.reading-layout'), paper = $('paper');
  const legend = $('shortcut-legend');
  let mode = 'flow', spread = 0, resizeFrame, rememberedNode;
  const columns = () => innerWidth >= 1024 ? 2 : 1;
  const stride = () => paper.clientWidth + (parseFloat(getComputedStyle(paper).columnGap) || 0);
  const lastSpread = () => mode !== 'paper' ? 0 : Math.max(0, Math.floor((paper.scrollWidth - 1) / stride()));
  const anchor = () => [...paper.querySelectorAll('h1,h2,h3,p,figure,li,pre,table')].find(node =>
    [...node.getClientRects()].some(r => r.bottom > 90 && r.top < innerHeight && r.left < innerWidth - 30 && r.right > 30));
  function status(message) { $('navigation-status').textContent = message; }
  function update() {
    $('flow-mode').setAttribute('aria-pressed', String(mode === 'flow'));
    $('paper-mode').setAttribute('aria-pressed', String(mode === 'paper'));
    document.querySelectorAll('[data-fullscreen]').forEach(button => {
      button.setAttribute('aria-pressed', String(Boolean(document.fullscreenElement)));
    });
    $('legend-toggle').setAttribute('aria-pressed', String(!legend.hidden));
    $('spread-controls').hidden = mode !== 'paper';
    $('spread-position').textContent = columns() === 1 ? String(spread + 1) : `${spread * columns() + 1}–${(spread + 1) * columns()}`;
    $('previous-spread').disabled = spread === 0;
    $('next-spread').disabled = spread >= lastSpread();
  }
  function turn(index) {
    spread = Math.max(0, Math.min(index, lastSpread()));
    paper.style.transform = `translateX(${-spread * stride()}px)`;
    layout.scrollLeft = 0;
    hideFloating(); update();
    rememberedNode = anchor();
    status(`Paper view. Pages ${$('spread-position').textContent}.`);
  }
  function hideFloating() { closeOverlays(); }
  function goTo(node) {
    if (!node) return;
    if (mode === 'paper') {
      const rect = node.getClientRects()[0] || node.getBoundingClientRect();
      turn(Math.floor((rect.left - paper.getBoundingClientRect().left) / stride()));
    } else node.scrollIntoView({ block: 'start', behavior: 'instant' });
  }
  function setMode(next) {
    if (next === mode) return;
    const remembered = anchor(); hideFloating();
    mode = next; document.body.dataset.readingMode = mode;
    spread = 0; layout.scrollLeft = 0; paper.style.transform = '';
    if (mode === 'paper') window.scrollTo({ top: 0, behavior: 'instant' });
    onModeChange();
    goTo(remembered); update();
    status(mode === 'paper' ? `Paper view. ${columns()} page${columns() === 1 ? '' : 's'} per screen.` : 'Flow view. Vertical reading.');
  }
  async function fullscreen() {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else if (document.documentElement.requestFullscreen) await document.documentElement.requestFullscreen();
      else status('Fullscreen is unavailable in this browser.');
    } catch { status('Fullscreen was not permitted by this browser. You can keep reading normally.'); }
    update();
  }
  function toggleLegend() { legend.hidden = !legend.hidden; update(); }
  function dispatch(action) {
    if (action === 'fullscreen') return void fullscreen();
    if (action === 'legend') return toggleLegend();
    if (action === 'escape') {
      if (document.fullscreenElement) void fullscreen();
      else if (!legend.hidden) { legend.hidden = true; update(); }
      return;
    }
    if (action === 'flow' || action === 'paper') return setMode(action);
    if (action === 'next' || action === 'previous') {
      if (mode !== 'paper') setMode('paper');
      else turn(spread + (action === 'next' ? 1 : -1));
      return;
    }
    if (action === 'up' || action === 'down') {
      setMode('flow'); window.scrollBy({ top: action === 'up' ? -80 : 80, behavior: 'instant' }); return;
    }
    if (mode === 'paper') {
      turn(action === 'home' ? 0 : action === 'end' ? lastSpread() : spread + (action === 'page-up' ? -1 : 1));
    } else {
      if (action === 'home' || action === 'end') window.scrollTo({ top: action === 'home' ? 0 : document.documentElement.scrollHeight, behavior: 'instant' });
      else window.scrollBy({ top: (action === 'page-up' ? -1 : 1) * Math.max(100, innerHeight - 100), behavior: 'instant' });
    }
  }
  for (const id of ['menu-shortcuts', 'legend-shortcuts']) {
    const list = $(id);
    for (const binding of READING_BINDINGS) {
      const row = document.createElement('div'); row.className = 'shortcut-row';
      const name = document.createElement('span'); name.textContent = binding.label;
      const keys = document.createElement('span');
      for (const key of binding.keys) { const kbd = document.createElement('kbd'); kbd.textContent = keyLabel(key); keys.append(kbd); }
      row.append(name, keys); list.append(row);
    }
  }
  document.querySelectorAll('[data-reader-action]').forEach(button => button.addEventListener('click', () => {
    const action = button.dataset.readerAction;
    if (button.closest('dialog')) { closeMenu(); paper.focus({ preventScroll: true }); }
    dispatch(action);
  }));
  $('close-legend').addEventListener('click', () => { legend.hidden = true; update(); });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && document.fullscreenElement) {
      e.preventDefault(); e.stopPropagation(); void fullscreen();
    }
  }, true);
  document.addEventListener('keydown', e => {
    if (e.defaultPrevented || e.isComposing || e.ctrlKey || e.metaKey || e.altKey) return;
    const binding = READING_BINDINGS.find(b => b.keys.includes(e.key));
    if (!binding) return;
    // Browser/OS Escape remains available even when a modal or field has focus.
    if (e.key === 'Escape' && document.fullscreenElement) { e.preventDefault(); dispatch('escape'); return; }
    if (e.key === 'Escape' && !legend.hidden && !document.querySelector('dialog[open]')) { e.preventDefault(); dispatch('escape'); return; }
    if (e.target.closest('input,textarea,select,button,a,summary,[contenteditable]:not([contenteditable="false"]),[role=textbox]') || document.querySelector('dialog[open]') || !$('inspector').hidden) return;
    e.preventDefault(); dispatch(binding.action);
  });
  // TOC and figure jumps must address the current spread, not scroll the book
  // into a half-page horizontal position. Never change source URLs or IDs.
  document.addEventListener('click', e => {
    const link = e.target.closest('a[href^="#"]');
    if (!link || mode !== 'paper') return;
    const node = document.getElementById(link.getAttribute('href').slice(1));
    if (!node || !paper.contains(node)) return;
    e.preventDefault(); goTo(node);
  });
  document.addEventListener('focusin', e => {
    if (mode === 'paper' && e.target !== paper && paper.contains(e.target)) goTo(e.target);
  });
  function reflow() {
    cancelAnimationFrame(resizeFrame);
    resizeFrame = requestAnimationFrame(() => { if (mode === 'paper') { if (rememberedNode?.isConnected) goTo(rememberedNode); else turn(spread); } else update(); });
  }
  window.addEventListener('resize', reflow);
  document.addEventListener('reader-typography-change', reflow);
  document.fonts?.addEventListener('loadingdone', reflow);
  document.addEventListener('fullscreenchange', () => { update(); status(document.fullscreenElement ? 'Fullscreen on. Escape to leave.' : 'Fullscreen off.'); });
  document.addEventListener('wheel', e => {
    if (mode === 'paper' && e.deltaY && !e.ctrlKey && !e.target.closest('aside,dialog,pre,table,.project-illustration')) setMode('flow');
  }, { passive: true });
  document.body.dataset.readingMode = mode; update();
  return { reset() { setMode('flow'); spread = 0; update(); }, setMode, dispatch };
}
