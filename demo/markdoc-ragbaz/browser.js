import { BUILTIN_REGISTRY, LIMITS, escapeHTML, renderDocument, fetchResource, safeLink, verifyResourceBytes, discoverSourceProvider, checkSourceRevision, sha256 } from '../../src/content/markdoc-ragbaz.js';
import { bibliographyHTML, decorateCitations, decorateEntities, decorateManuscript, manuscriptState } from './citations.js';
import { decorateFigures } from './figures.js';
import { setupReadingNavigation } from './navigation.js';
import { documentParameter } from './loading.js';
import { setupAppearance } from './appearance.js';
import { decorateHeartfulness, setupHeartfulness } from './heartfulness.js';
import { setupAether } from './aether.js';
import { setupThemeFonts } from './fonts.js';
import { disposeVisualizations, mountVisualizations } from './visualization-adapters.js';
import { readingCopy } from './reading-copy.js';

setupAppearance();

const payload = JSON.parse(document.getElementById('payload').textContent);
const $ = id => document.getElementById(id);
const config = payload.config;
setupHeartfulness(config.metaDocument?.id === 'heartfulness');
setupAether(config.metaDocument?.id);
setupThemeFonts(config);
const registry = { dialects: { ...BUILTIN_REGISTRY.dialects, ...config.dialects }, themes: { ...BUILTIN_REGISTRY.themes, ...config.themes } };
const policy = { ...config.policy, baseURL: location.protocol === 'file:' ? undefined : location.href };
let current;
let displayBusy = false;
Object.defineProperty(window, 'ragbazReadingCopy', { value: options => {
  if (displayBusy || !current || current.diagnostics.length || config.metaDocument && current.embedded) throw Error('Load and successfully preview your manuscript before exporting a reading copy.');
  return readingCopy(document, options);
} });
$('download-reading-copy').addEventListener('click', () => {
  try {
    const copy = window.ragbazReadingCopy();
    const url = URL.createObjectURL(new Blob([copy.html], { type: 'text/html;charset=utf-8' }));
    const a = document.createElement('a'); a.href = url; a.download = 'reading-copy.html'; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  } catch (error) { $('notice').textContent = error.message; }
});
let generation = 0;
let previewGeneration = 0;
let pendingSource;
const options = { registry, defaults: config.defaults, policy, visualizations: config.visualizations };
const bar = $('reading-bar');
const drawer = $('reader-drawer');
const tocPanel = $('toc-panel');
const tocHandle = $('toc-handle');
const citationCard = $('citation-card');
let citations = { entries: [], byId: new Map() };
let contractSource;
let activeCitation;
let citationPinned = false;
let citationTimer;
let tocTimer;
let tocPinned = false;
function closeContents(restoreFocus = false) {
  clearTimeout(tocTimer); tocPinned = false; tocPanel.hidden = true;
  tocHandle.setAttribute('aria-expanded', 'false');
  if (restoreFocus) tocHandle.focus({ preventScroll: true });
}
function showContents(pin = false) {
  clearTimeout(tocTimer); tocPinned ||= pin; tocPanel.hidden = false;
  tocHandle.classList.remove('toc-intro'); tocHandle.setAttribute('aria-expanded', 'true');
}
function delayContentsClose() {
  clearTimeout(tocTimer);
  if (!tocPinned && !tocPanel.contains(document.activeElement)) tocTimer = setTimeout(() => closeContents(), 550);
}
tocHandle.addEventListener('pointerenter', () => showContents());
tocHandle.addEventListener('pointerleave', delayContentsClose);
tocHandle.addEventListener('click', () => { if (!tocPanel.hidden && tocPinned) closeContents(); else showContents(true); });
tocPanel.addEventListener('pointerenter', () => clearTimeout(tocTimer));
tocPanel.addEventListener('pointerleave', delayContentsClose);
tocPanel.addEventListener('focusin', () => clearTimeout(tocTimer));
tocPanel.addEventListener('focusout', delayContentsClose);
$('close-toc').addEventListener('click', () => closeContents(true));
tocHandle.classList.add('toc-intro');
setTimeout(() => tocHandle.classList.remove('toc-intro'), 6500);
function hideCitation(restoreFocus = false) {
  clearTimeout(citationTimer); citationCard.hidden = true; citationPinned = false;
  activeCitation?.setAttribute('aria-expanded', 'false');
  if (restoreFocus && activeCitation?.isConnected) activeCitation.focus({ preventScroll: true });
  activeCitation = undefined;
}
function positionCitation() {
  if (citationCard.hidden || !activeCitation?.isConnected) return;
  const rect = activeCitation.getBoundingClientRect();
  const card = citationCard.getBoundingClientRect();
  const margin = document.body.dataset.citationMode === 'margin';
  const paper = $('paper').getBoundingClientRect();
  const left = margin ? paper.right + 28 : rect.left + rect.width / 2 - card.width / 2;
  let top = margin ? rect.top - 8 : rect.bottom + 12;
  if (!margin && top + card.height > innerHeight - 16) top = rect.top - card.height - 12;
  citationCard.style.left = `${Math.max(16, Math.min(left, innerWidth - card.width - 16))}px`;
  citationCard.style.top = `${Math.max(60, Math.min(top, innerHeight - card.height - 16))}px`;
}
function citationMode() {
  const choice = $('citation-mode').value;
  document.body.dataset.citationMode = innerWidth >= 1024 && choice !== 'wide' && document.body.dataset.readingMode !== 'paper' ? 'margin' : 'wide';
  positionCitation();
}
function showCitation(mark, pin = false) {
  const entry = citations.byId.get(mark.dataset.citation);
  if (!entry) return;
  clearTimeout(citationTimer);
  if (activeCitation !== mark) {
    activeCitation?.setAttribute('aria-expanded', 'false');
    citationPinned = false; activeCitation = mark;
    $('citation-number').textContent = `Reference ${entry.number}`;
    $('citation-body').innerHTML = bibliographyHTML(entry);
  }
  citationPinned ||= pin; citationCard.hidden = false;
  activeCitation.setAttribute('aria-expanded', 'true'); positionCitation();
}
function delayCitationClose() {
  clearTimeout(citationTimer);
  if (!citationPinned) citationTimer = setTimeout(() => {
    if (!citationCard.contains(document.activeElement) && document.activeElement !== activeCitation) hideCitation();
  }, 180);
}
$('citation-mode').addEventListener('change', citationMode);
citationCard.addEventListener('pointerenter', () => clearTimeout(citationTimer));
citationCard.addEventListener('pointerleave', delayCitationClose);
citationCard.addEventListener('focusin', () => clearTimeout(citationTimer));
citationCard.addEventListener('focusout', delayCitationClose);
$('close-citation').addEventListener('click', () => hideCitation(true));
citationCard.addEventListener('click', e => {
  if (e.target.closest('a[href^="#figure-"]')) hideCitation();
  const source = e.target.closest('[data-source]');
  if (source) { hideCitation(); void inspect(source.dataset.source); }
});
document.addEventListener('pointerdown', e => {
  if (!tocPanel.contains(e.target) && !tocHandle.contains(e.target)) closeContents();
  if (!citationCard.contains(e.target) && !e.target.closest('[data-citation]')) hideCitation();
});
document.addEventListener('keydown', e => {
  if (e.key !== 'Escape' || drawer.open) return;
  if (!citationCard.hidden) { e.preventDefault(); hideCitation(true); }
  else if (!tocPanel.hidden) { e.preventDefault(); closeContents(tocPanel.contains(document.activeElement)); }
});
window.addEventListener('resize', citationMode, { passive: true });
window.addEventListener('scroll', positionCitation, { passive: true });
citationMode();
let hideTimer;
let overBar = false;
let previousScroll = window.scrollY;
function hideBar() {
  if (!drawer.open && !overBar && !bar.contains(document.activeElement)) bar.classList.add('toolbar-hidden');
}
function revealBar() {
  bar.classList.remove('toolbar-hidden');
  clearTimeout(hideTimer);
  if (!drawer.open) hideTimer = setTimeout(hideBar, 1800);
}
function closeDrawer() {
  drawer.close();
  $('reader-menu').setAttribute('aria-expanded', 'false');
  revealBar();
  $('reader-menu').focus({ preventScroll: true });
}
$('reader-menu').addEventListener('click', () => {
  closeContents(); hideCitation();
  revealBar();
  drawer.showModal();
  $('reader-menu').setAttribute('aria-expanded', 'true');
});
$('close-drawer').addEventListener('click', closeDrawer);
drawer.addEventListener('cancel', e => { e.preventDefault(); closeDrawer(); });
drawer.addEventListener('click', e => {
  if (e.target !== drawer) return;
  const rect = drawer.getBoundingClientRect();
  if (e.clientX < rect.left || e.clientX > rect.right || e.clientY < rect.top || e.clientY > rect.bottom) closeDrawer();
});
$('reveal-tools').addEventListener('click', revealBar);
$('reveal-tools').addEventListener('focus', revealBar);
bar.addEventListener('focusin', revealBar);
bar.addEventListener('pointerenter', () => { overBar = true; revealBar(); clearTimeout(hideTimer); });
bar.addEventListener('pointerleave', () => { overBar = false; revealBar(); });
bar.addEventListener('focusout', revealBar);
document.addEventListener('pointermove', e => { if (e.clientY <= 18) revealBar(); }, { passive: true });
window.addEventListener('scroll', () => {
  const y = window.scrollY;
  if (y < previousScroll) revealBar(); else hideBar();
  previousScroll = y;
}, { passive: true });
$('open-file').addEventListener('click', () => $('file').click());
$('toc').addEventListener('click', e => {
  if (!e.target.closest('a')) return;
  closeContents();
  $('paper').focus({ preventScroll: true });
});
$('open-contents').addEventListener('click', () => {
  closeDrawer(); showContents(true);
  $('toc').querySelector('a')?.focus({ preventScroll: true });
});
$('contract-link').addEventListener('click', () => { if (contractSource) { hideCitation(); closeContents(); void inspect(contractSource.id, contractSource); } });
revealBar();
const readingNavigation = setupReadingNavigation({ onModeChange: citationMode, closeOverlays: () => { hideCitation(); closeContents(); }, closeMenu: closeDrawer });
// Only embedded snapshots whose bytes match the requested digest can be used.
// The generic verifier rehashes this untrusted cache before returning anything.
const verifiedCache = { async get(digest) {
  const snapshot = Object.values(payload.snapshots || {}).find(s => s.sha256 === digest && s.state !== 'unverified');
  return snapshot ? new TextEncoder().encode(snapshot.text) : undefined;
} };

function updateDocumentChecks() {
  $('inspect-document').disabled = !current;
  $('document-check-status').textContent = current
    ? `${current.clean ? 'No rendering diagnostics' : 'Partial / refused markup'} · ${current.headings.length} headings · ${current.usedDialects.join(', ') || 'No dialect tags used'}`
    : 'No rendered document. Select a valid Markdown file or restore the embedded document.';
  $('document-digest').textContent = current ? `Current Markdown SHA-256: ${current.sourceSHA256}` : '';
  $('document-diagnostics').replaceChildren(...(current?.diagnostics || []).map(message => {
    const item = document.createElement('li'); item.textContent = message; return item;
  }));
}
$('inspect-document').addEventListener('click', () => {
  if (!current) return;
  ++previewGeneration; pendingSource = undefined;
  closeDrawer(); hideCitation(); closeContents();
  $('inspector').hidden = false;
  $('source-title').textContent = 'Current Markdown';
  $('source-provenance').textContent = `Inert source text · SHA-256 ${current.sourceSHA256} · not authorship or approval`;
  $('source-link').hidden = true; $('load-source').hidden = true; $('check-updates').hidden = true;
  $('source-revision').textContent = ''; $('source-updates').textContent = '';
  $('source-preview').classList.remove('inert-unverified');
  const code = document.createElement('pre'); code.textContent = current.source;
  $('source-preview').replaceChildren(code);
  $('source-raw').textContent = current.source;
  $('close-inspector').focus({ preventScroll: true });
});

async function display(source, provenance, embedded = false) {
  const turn = ++generation;
  displayBusy = true;
  ++previewGeneration;
  hideCitation(); closeContents();
  $('inspector').hidden = true;
  try {
    const [result, sourceSHA256] = await Promise.all([renderDocument(source, options), sha256(new TextEncoder().encode(source))]);
    if (turn !== generation) return;
    current = { ...result, source, embedded, sourceSHA256 };
    updateDocumentChecks();
    document.body.classList.toggle('meta-empty', Boolean(config.metaDocument && embedded));
    disposeVisualizations($('paper'));
    $('paper').innerHTML = result.html;
    mountVisualizations($('paper'));
    if (config.metaDocument?.id === 'heartfulness') decorateHeartfulness($('paper'));
    readingNavigation.reset();
    $('asset-details').replaceChildren(...$('paper').querySelectorAll(':scope > .asset-provenance, :scope > p.unavailable'));
    if (embedded && !contractSource) {
      contractSource = result.manifest.sources.find(s => s.id === (config.contractSource || 'rendering-contract'));
      $('contract-link').disabled = !contractSource;
    }
    decorateFigures($('paper'), result.manifest.document?.figures);
    decorateEntities($('paper'), result.manifest.document?.entities, result.manifest.sources);
    citations = decorateCitations($('paper'), result.manifest.sources, [config.contractSource || 'rendering-contract']);
    const manuscript = result.manifest.document || {};
    const revisions = $('revision-list'); revisions.replaceChildren();
    const state = document.createElement('p'); state.textContent = manuscriptState(manuscript).label; revisions.append(state);
    for (const rev of (Array.isArray(manuscript.revisions) ? manuscript.revisions.slice(0, 100) : [])) {
      const item = document.createElement('p');
      item.textContent = [rev.date, rev.version, rev.description].filter(v => typeof v === 'string').join(' · ');
      revisions.append(item);
    }
    decorateManuscript($('paper'), manuscript, () => {
      closeContents(); hideCitation(); revealBar();
      drawer.showModal(); $('reader-menu').setAttribute('aria-expanded', 'true');
      $('revision-history').open = true;
      $('revision-history').querySelector('summary').focus({ preventScroll: true });
      $('revision-history').scrollIntoView({ block: 'nearest' });
    });
    document.documentElement.removeAttribute('style');
    if (result.theme) document.documentElement.setAttribute('style', result.theme);
    $('toc').innerHTML = [...$('paper').querySelectorAll('h1[id],h2[id],h3[id]')].map(h => `<a data-level="${h.tagName.slice(1)}" href="#${h.id}">${escapeHTML(h.textContent)}</a>`).join('');
    $('notice').textContent = `${provenance} · ${config.implementation} / ${config.skeleton}${result.diagnostics.length ? ' · Partial / refused: ' + result.diagnostics.join('; ') : ''}`;
    document.title = result.manifest.document.title || result.manifest.title || result.headings[0]?.text || 'Document';
    if (drawer.open && !result.diagnostics.length) {
      closeDrawer();
      $('paper').focus({ preventScroll: true });
    }
  } catch (e) {
    if (turn !== generation) return;
    current = undefined;
    updateDocumentChecks();
    disposeVisualizations($('paper'));
    $('paper').textContent = `Document refused: ${e.message}`;
    $('asset-details').replaceChildren();
    $('toc').textContent = '';
    $('notice').textContent = 'Refused; no fallback document substituted.';
  } finally {
    if (turn === generation) displayBusy = false;
  }
}

function readFile(file) {
  if (!file || file.size > LIMITS.bytes || !/\.(md|markdown)$/i.test(file.name)) {
    $('notice').textContent = 'Select a .md/.markdown file below 1 MB.'; return;
  }
  const reader = new FileReader();
  const turn = ++generation;
  reader.onerror = () => { if (turn === generation) $('notice').textContent = 'FileReader could not read the selected file.'; };
  reader.onload = () => {
    if (turn !== generation) return;
    try {
      const source = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(reader.result);
      void display(source, `Locally selected / unpublished: ${file.name}. Relative resources unavailable: select a source separately or use an embedded snapshot.`);
    } catch {
      $('notice').textContent = 'File refused: invalid UTF-8. Current document unchanged; save the Markdown as UTF-8 and try again.';
    }
  };
  reader.readAsArrayBuffer(file);
}

$('file').addEventListener('change', e => readFile(e.target.files[0]));
document.addEventListener('dragover', e => { e.preventDefault(); if ($('enable-drop').checked) document.body.classList.add('dragging'); });
document.addEventListener('dragleave', () => document.body.classList.remove('dragging'));
document.addEventListener('drop', e => { e.preventDefault(); document.body.classList.remove('dragging'); if ($('enable-drop').checked) readFile(e.dataTransfer.files[0]); });
$('original').addEventListener('click', () => display(payload.source, `Embedded snapshot · SHA-256 ${payload.sha256} · renderer ${payload.runtimeSHA256}`, true));
async function loadDocumentURL(url, digest, initial = false) {
  const turn = ++generation;
  $('notice').textContent = 'Loading explicit URL…';
  try {
    const resource = await fetchResource(url, { policy, digest });
    if (turn === generation) {
      await display(resource.text, `Explicit URL load: ${resource.url} · SHA-256 ${resource.sha256} · ${digest ? 'requested digest matched; not authorship' : 'unverified publisher'}`);
    }
  } catch (error) {
    if (turn !== generation) return;
    const message = `Document unavailable/refused: ${error.message}. CORS failures require a permitted server or local file; no proxy is used.`;
    $('notice').textContent = message;
    if (initial) { current = undefined; updateDocumentChecks(); $('paper').textContent = message; document.title = 'Document unavailable — markdoc-ragbaz-sci-tufte'; }
  }
}
$('url-form').addEventListener('submit', e => {
  e.preventDefault(); void loadDocumentURL($('url').value);
});

async function preview(text, provenance, turn) {
  const result = await renderDocument(text, options);
  if (turn !== previewGeneration) return;
  $('source-provenance').textContent = `${provenance}${result.diagnostics.length ? ' · Partial / refused: ' + result.diagnostics.join('; ') : ''}`;
  $('source-raw').textContent = text;
  $('source-preview').innerHTML = result.html;
}

async function previewResource(loaded, provenance, turn) {
  if (turn !== previewGeneration) return;
  if (loaded.state === 'unverified') {
    $('source-preview').classList.add('inert-unverified');
    $('source-provenance').textContent = `UNVERIFIED — SHA-256 mismatch. Expected ${loaded.expectedSHA256}; received ${loaded.sha256}. ${provenance}. Inert text only; trusted source/main document unchanged.`;
    $('source-preview').textContent = loaded.text;
    $('source-raw').textContent = loaded.text;
    return;
  }
  await preview(loaded.text, `${provenance} · ${loaded.state === 'verified-cache' ? 'Matching verified cache used; received bytes rejected · ' : ''}SHA-256 ${loaded.sha256} · ${loaded.integrity}`, turn);
}

async function inspect(id, explicitSource) {
  const source = explicitSource || current?.manifest.sources.find(s => s.id === id);
  if (!source) return;
  const turn = ++previewGeneration;
  pendingSource = { ...source, turn };
  $('inspector').hidden = false;
  $('source-title').textContent = source.title || source.id;
  $('source-preview').textContent = '';
  $('source-preview').classList.remove('inert-unverified');
  $('source-raw').textContent = '';
  const provider = discoverSourceProvider(source.url);
  $('check-updates').hidden = !provider;
  $('check-updates').disabled = false;
  $('source-revision').textContent = `Immutable original: ${source.url || 'no URL'}\n${provider ? JSON.stringify(provider) : 'Freshness unknown: unsupported provider.'}\nDeclared tracking: ${JSON.stringify(source.revision?.tracking || (provider?.provider === 'github' ? 'discover default branch on click' : provider ? 'latest' : null))}\nDeclarative relations (unverified authored assertions, not provider facts): ${JSON.stringify(source.relations || [])}`;
  $('source-updates').textContent = 'Not checked. No background update requests.';
  const link = safeLink(source.url);
  $('source-link').hidden = !link;
  if (link) $('source-link').href = link;
  $('load-source').hidden = true;
  const snapshot = (current?.embedded || source === contractSource) && payload.snapshots?.[id];
  if (snapshot) {
    try {
      const bytes = new TextEncoder().encode(snapshot.text);
      await verifyResourceBytes(bytes, { sha256: snapshot.sha256 });
      const checked = await verifyResourceBytes(bytes, source, { purpose: 'inert-inspector', verifiedCache });
      await previewResource(checked, `Embedded source snapshot · ${snapshot.url || 'external local mapping'}`, turn);
    }
    catch (e) { if (turn === previewGeneration) $('source-provenance').textContent = `Snapshot refused: ${e.message}`; }
  } else {
    $('source-provenance').textContent = source.url ? 'Not loaded. Explicit source load requires an allowed origin and a content digest or immutable revision. Relative resources are unavailable in file mode; no demo is substituted.' : 'Source unavailable: no URL or embedded snapshot. Open a local .md file explicitly.';
    $('load-source').hidden = !source.url;
  }
}

$('paper').addEventListener('pointerover', e => { const mark = e.target.closest('[data-citation]'); if (mark) showCitation(mark); });
$('paper').addEventListener('pointerout', e => { if (e.target.closest('[data-citation]')) delayCitationClose(); });
$('paper').addEventListener('focusin', e => { const mark = e.target.closest('[data-citation]'); if (mark) showCitation(mark); });
$('paper').addEventListener('focusout', e => { if (e.target.closest('[data-citation]')) delayCitationClose(); });
$('paper').addEventListener('click', e => {
  const mark = e.target.closest('[data-citation]');
  if (mark) { if (activeCitation === mark && citationPinned) hideCitation(); else showCitation(mark, true); return; }
  const tag = e.target.closest('[data-source]'); if (tag) { hideCitation(); void inspect(tag.dataset.source); }
});
$('paper').addEventListener('keydown', e => { if (['Enter', ' '].includes(e.key) && e.target.matches('[data-source]')) { e.preventDefault(); void inspect(e.target.dataset.source); } });
$('close-inspector').addEventListener('click', () => { ++previewGeneration; $('inspector').hidden = true; });
$('check-updates').addEventListener('click', async () => {
  const source = pendingSource;
  if (!source || source.turn !== previewGeneration) return;
  $('check-updates').disabled = true;
  $('source-updates').textContent = 'Checking provider on explicit request… original is unchanged.';
  const observation = await checkSourceRevision(source);
  if (source.turn !== previewGeneration) return;
  $('source-updates').textContent = JSON.stringify(observation, null, 2);
  $('check-updates').disabled = false;
});
$('load-source').addEventListener('click', async () => {
  const source = pendingSource;
  if (!source || source.turn !== previewGeneration) return;
  $('load-source').hidden = true;
  $('source-provenance').textContent = 'Loading explicit pinned source…';
  try {
    const loaded = await fetchResource(source.url, { policy, pinned: true, digest: source.sha256, integrity: source.integrity, purpose: 'inert-inspector', verifiedCache });
    if (source.turn === previewGeneration) await previewResource(loaded, loaded.url, source.turn);
  } catch (e) { if (source.turn === previewGeneration) $('source-provenance').textContent = `Source unavailable/refused: ${e.message}. Check allowed hosts, digest, pinning and CORS. No proxy or fallback source used.`; }
});

async function start() {
  await display(payload.source, `Embedded snapshot · SHA-256 ${payload.sha256} · renderer ${payload.runtimeSHA256}`, true);
  if (!config.metaDocument) return;
  $('original').querySelector('span').textContent = 'Empty template';
  try {
    const requested = documentParameter(location.href, true);
    if (requested) { $('url').value = requested.url; await loadDocumentURL(requested.url, requested.digest, true); }
  } catch (error) { $('paper').textContent = `Document parameter refused: ${error.message}`; $('notice').textContent = error.message; }
}
void start();
