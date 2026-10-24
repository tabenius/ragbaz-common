// Data-only document surface. Existing renderMarkdoc consumers are unaffected.
import Markdoc from '@markdoc/markdoc';
import { parseDocument as parseYAML } from 'yaml';
import { TOKENIZER_DEFAULTS } from './markdoc.js';

export const CONTRACT = 'ragbaz.document/1';
export const LIMITS = Object.freeze({ bytes: 1_000_000, nodes: 20000, depth: 48, resources: 24, timeout: 8000 });
const own = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
export const escapeHTML = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const descriptor = (tags) => ({ version: '1', tags });
export const BUILTIN_REGISTRY = Object.freeze({
  dialects: {
    paper: descriptor({ callout: { element: 'aside', attrs: ['kind', 'title'] }, aside: { element: 'aside', attrs: ['title'] }, source: { element: 'span', attrs: ['ref'], selfClosing: true }, figure: { element: 'figure', attrs: ['title'] } }),
    plan: descriptor({ example: { element: 'section', attrs: ['title'] }, milestone: { element: 'section', attrs: ['title', 'status'] }, decision: { element: 'section', attrs: ['title', 'status'] } }),
    models: descriptor({ model: { element: 'section', attrs: ['ref'], selfClosing: true }, view: { element: 'section', attrs: ['ref'], selfClosing: true } }),
  },
  themes: { paper: { version: '1', tokens: {} } },
});
const ELEMENTS = new Set(['article', 'section', 'aside', 'figure', 'figcaption', 'div', 'span', 'p', 'strong', 'em', 'blockquote', 'ul', 'ol', 'li', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'pre', 'code', 'table', 'thead', 'tbody', 'tr', 'th', 'td', 'a', 'hr', 'br', 's']);
const CUSTOM_ELEMENTS = new Set(['aside', 'section', 'figure', 'div', 'span', 'blockquote']);
const BAD_KEYS = new Set(['__proto__', 'prototype', 'constructor']);
const PROVIDER_QUERY = Symbol('host-owned provider query');

function checkData(value, depth = 0, seen = new Set()) {
  if (depth > LIMITS.depth) throw new Error('Data nesting limit exceeded');
  if (typeof value === 'number' && !Number.isFinite(value)) throw new Error('Finite data numbers required');
  if (value === null || ['string', 'number', 'boolean'].includes(typeof value)) return;
  if (typeof value !== 'object' || seen.has(value)) throw new Error('Non-data or cyclic value refused');
  seen.add(value);
  if (!Array.isArray(value) && Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null) throw new Error('Plain data required');
  for (const [k, v] of Object.entries(value)) {
    if (BAD_KEYS.has(k) || ['script', 'javascript', 'imports', 'style', 'css', 'eval'].includes(k)) throw new Error(`Unsafe data key: ${k}`);
    checkData(v, depth + 1, seen);
  }
  seen.delete(value);
}

function list(value, name) {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > 300) throw new Error(`${name} must be a bounded array`);
  const ids = new Set();
  for (const item of value) {
    if (!item || typeof item !== 'object' || typeof item.id !== 'string' || !/^[\w.-]{1,100}$/.test(item.id) || BAD_KEYS.has(item.id) || ids.has(item.id)) throw new Error(`Invalid or duplicate ${name} id`);
    ids.add(item.id);
  }
  return value;
}

/** AST frontmatter only; no frontmatter regex or executable YAML constructors. */
export function parseDocument(source, defaults = {}) {
  const text = String(source ?? '');
  if (new TextEncoder().encode(text).length > LIMITS.bytes) throw new Error('Document byte limit exceeded');
  const ast = Markdoc.parse(new Markdoc.Tokenizer(TOKENIZER_DEFAULTS).tokenize(text));
  const raw = ast.attributes.frontmatter;
  let metadata = {};
  if (raw) {
    // Core scalar types, but never custom tags or aliases.
    const parsed = parseYAML(raw, { schema: 'core', strict: true, uniqueKeys: true });
    if (parsed.errors.length || parsed.warnings.length) throw new Error(`Frontmatter refused: ${[...parsed.errors, ...parsed.warnings].map(e => e.message).join('; ')}`);
    metadata = parsed.toJS({ maxAliasCount: 0 });
    if (!metadata || Array.isArray(metadata) || typeof metadata !== 'object') throw new Error('Frontmatter must be a mapping');
  }
  checkData(metadata);
  checkData(defaults);
  const manifest = { ...defaults, ...metadata };
  if (manifest.schema !== undefined && manifest.schema !== CONTRACT) throw new Error(`Unsupported document schema: ${manifest.schema}`);
  manifest.schema = CONTRACT;
  for (const key of ['document', 'settings']) {
    manifest[key] = manifest[key] ?? {};
    if (!manifest[key] || Array.isArray(manifest[key]) || typeof manifest[key] !== 'object') throw new Error(`${key} must be a mapping`);
  }
  for (const key of ['assets', 'sources', 'models', 'views']) manifest[key] = list(manifest[key], key);
  for (const entry of [...manifest.assets, ...manifest.sources]) {
    integrityDescriptor(entry);
    if (entry.revision !== undefined) validateRevision(entry);
    if (entry.relations !== undefined) {
      if (!Array.isArray(entry.relations) || entry.relations.length > 24) throw new Error('Bounded source relations required');
      for (const relation of entry.relations) {
        if (!relation || !['supersedes', 'supersededBy', 'related'].includes(relation.kind) || !safeLink(relation.url) || typeof relation.evidence !== 'object' || !relation.evidence || typeof relation.evidence.provenance !== 'string' || !relation.evidence.provenance.trim() || (relation.evidence.url !== undefined && !safeLink(relation.evidence.url))) throw new Error('Relation requires kind, URL and evidence provenance');
      }
    }
  }
  for (const asset of manifest.assets) {
    if (!['logo', 'repository', 'theme', 'figure', 'source', 'dataset'].includes(asset.role)) throw new Error('Unsupported asset role');
    if (asset.role === 'theme' && (asset.url || !asset.ref)) throw new Error('Theme assets require a host registry ref, not a URL');
    if (asset.role === 'theme' && integrityDescriptor(asset).onMismatch !== 'refuse') throw new Error('Theme integrity must remain strict');
    if (asset.role === 'logo' && typeof asset.alt !== 'string') throw new Error('Logo requires alt text');
  }
  manifest.dialects ??= ['paper@1', 'plan@1', 'models@1'];
  if (!Array.isArray(manifest.dialects) || manifest.dialects.length > LIMITS.resources || manifest.dialects.some(x => typeof x !== 'string' || !/^[\w-]+@\d+$/.test(x))) throw new Error('dialects must contain versioned registry IDs, e.g. paper@1');
  let count = 0;
  const tags = new Set();
  function walk(node, depth = 0) {
    if (++count > LIMITS.nodes || depth > LIMITS.depth) throw new Error('AST budget exceeded');
    // Markdoc 0.5 parses tag children inside fences; a reading surface must not
    // invoke those examples. Preserve the official fence's original content.
    if (node.type === 'fence') node.children = [];
    if (node.type === 'tag') tags.add(node.tag);
    for (const child of node.children || []) walk(child, depth + 1);
  }
  walk(ast);
  return { ast, manifest, tags: [...tags], source: text };
}

export function safeLink(value) {
  if (typeof value !== 'string' || /[\u0000-\u0020\u007f\\]/.test(value)) return null;
  if (value.startsWith('#')) return value;
  try {
    const u = new URL(value);
    return ['https:', 'mailto:'].includes(u.protocol) && !u.username && !u.password ? u.href : null;
  } catch { return null; }
}

/** Only semantic, typed tokens. No URLs, declarations, selectors or free CSS. */
export function themeCSS(tokens = {}) {
  checkData(tokens);
  const rules = [];
  for (const [key, value] of Object.entries(tokens)) {
    const color = ['paper', 'ink', 'muted', 'accent', 'rule', 'warning'].includes(key);
    const spacing = ['measure', 'text-size'].includes(key);
    if (!(color && typeof value === 'string' && /^#[\da-f]{6}$/i.test(value)) && !(spacing && typeof value === 'number' && value >= (key === 'measure' ? 45 : 16) && value <= (key === 'measure' ? 85 : 24))) throw new Error(`Unsafe or unknown theme token: ${key}`);
    rules.push(`--${key}:${value}${spacing ? key === 'measure' ? 'ch' : 'px' : ''}`);
  }
  return rules.join(';');
}

export async function sha256(bytes) {
  return [...new Uint8Array(await globalThis.crypto.subtle.digest('SHA-256', bytes))].map(x => x.toString(16).padStart(2, '0')).join('');
}

/** Digest aliases agree; declarative policy never authorizes executable content. */
export function integrityDescriptor(entry = {}) {
  const value = entry.integrity;
  if (value !== undefined && (!value || Array.isArray(value) || typeof value !== 'object' || Object.keys(value).some(k => !['algorithm', 'digest', 'onMismatch'].includes(k)) || value.algorithm !== 'sha256' || !/^[a-f0-9]{64}$/i.test(value.digest || '') || !['refuse', 'warn-preview', 'use-verified-cache'].includes(value.onMismatch ?? 'refuse'))) throw new Error('Invalid integrity descriptor');
  if (entry.sha256 !== undefined && (typeof entry.sha256 !== 'string' || !/^[a-f0-9]{64}$/i.test(entry.sha256))) throw new Error('Invalid SHA-256 alias');
  if (entry.sha256 && value && entry.sha256.toLowerCase() !== value.digest.toLowerCase()) throw new Error('Contradictory integrity digests');
  return { algorithm: 'sha256', digest: (value?.digest || entry.sha256)?.toLowerCase(), onMismatch: value?.onMismatch || 'refuse' };
}

/** Only an explicit inert inspector may receive mismatched bytes. Cache is host
 * supplied, digest-keyed, and rehashed on every use; a cache label is not trust. */
export async function verifyResourceBytes(bytes, entry = {}, { purpose = 'trusted', verifiedCache } = {}) {
  if (!(bytes instanceof Uint8Array) || bytes.byteLength > LIMITS.bytes) throw new Error('Resource byte limit exceeded');
  const expected = integrityDescriptor(entry);
  const actual = await sha256(bytes);
  let state = expected.digest ? 'matched' : 'unpinned';
  if (expected.digest && actual !== expected.digest) {
    if (purpose === 'inert-inspector' && expected.onMismatch === 'warn-preview') state = 'unverified';
    else if (purpose === 'inert-inspector' && expected.onMismatch === 'use-verified-cache') {
      const cached = await verifiedCache?.get(expected.digest);
      if (!(cached instanceof Uint8Array) || cached.byteLength > LIMITS.bytes || await sha256(cached) !== expected.digest) throw new Error('Resource SHA-256 mismatch; matching verified cache unavailable');
      return { ...(await verifyResourceBytes(cached, { sha256: expected.digest })), state: 'verified-cache', expectedSHA256: expected.digest, receivedSHA256: actual };
    } else throw new Error('Resource SHA-256 mismatch');
  }
  return { text: new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes), sha256: actual, expectedSHA256: expected.digest, state, integrity: state === 'unverified' ? 'UNVERIFIED mismatch — inert text only' : expected.digest ? 'digest matched (not authorship verification)' : 'revision pinned or externally mapped; digest recorded' };
}

/** A display fragment is stripped; escaped path segments are preserved. */
export function githubRawURL(input) {
  const original = String(input);
  if (/[\\\u0000-\u0020]/.test(original) || /%(?:2f|5c|2e|25)/i.test(original) || /(?:^|\/)\.{1,2}(?:\/|$)/.test(original)) throw new Error('Ambiguous source path refused');
  const u = new URL(original);
  if (u.protocol !== 'https:' || u.hostname !== 'github.com' || u.port || u.username || u.password || u.search) throw new Error('Expected HTTPS GitHub blob URL');
  const m = u.pathname.match(/^\/([\w.-]+)\/([\w.-]+)\/blob\/([a-f0-9]{40})\/(.+)$/i);
  if (!m) throw new Error('Source must use a full 40-hex commit and a file path');
  return `https://raw.githubusercontent.com/${m[1]}/${m[2]}/${m[3]}/${m[4]}`;
}

export function resourceURL(input, policy = {}, { pinned = false, digest } = {}) {
  if (typeof input !== 'string' || /[\\\u0000-\u0020]/.test(input) || /%(?:2f|5c|2e|25)/i.test(policy[PROVIDER_QUERY] ? new URL(input).pathname : input)) throw new Error('Ambiguous resource URL refused');
  let u = new URL(input, policy.baseURL);
  if (u.hostname === 'github.com') u = new URL(githubRawURL(input));
  const origins = policy.origins || [];
  const same = policy.baseURL && new URL(policy.baseURL).origin === u.origin && ['http:', 'https:'].includes(u.protocol);
  if (!same && (/^(?:localhost|.*\.localhost|.*\.local|\[.*\])$/i.test(u.hostname) || /^\d+\.\d+\.\d+\.\d+$/.test(u.hostname))) throw new Error('Private/literal resource host refused');
  if (u.username || u.password || (u.search && !policy[PROVIDER_QUERY]) || u.hash || (!same && (u.protocol !== 'https:' || !origins.includes(u.origin)))) throw new Error('Resource origin not allowed');
  if (policy.prefixes?.length && !policy.prefixes.some(p => u.href.startsWith(p))) throw new Error('Resource path not allowed');
  if (pinned && !/^[a-f0-9]{64}$/i.test(digest || '') && !(u.hostname === 'raw.githubusercontent.com' && /^\/[^/]+\/[^/]+\/[a-f0-9]{40}\/.+/i.test(u.pathname))) throw new Error('Source requires a content digest or immutable GitHub revision');
  return u.href;
}

/** No redirects, cookies, proxy, implicit fetches, or document-expanded policies. */
export async function fetchResource(input, { policy = {}, digest, integrity, purpose = 'trusted', verifiedCache, pinned = false, fetcher = globalThis.fetch, media = ['text/plain', 'text/markdown'], maxBytes = LIMITS.bytes } = {}) {
  const expected = integrityDescriptor({ sha256: digest, integrity });
  digest = expected.digest;
  maxBytes = Math.min(maxBytes, LIMITS.bytes);
  const url = resourceURL(input, policy, { pinned, digest });
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), Math.min(policy.timeout || LIMITS.timeout, LIMITS.timeout));
  try {
    const response = await fetcher(url, { signal: controller.signal, redirect: 'error', credentials: 'omit', referrerPolicy: 'no-referrer' });
    if (!response.ok || response.redirected || (response.url && response.url !== url)) throw new Error(`Resource response/redirect refused (HTTP ${response.status ?? 'unknown'})`);
    if (!media.includes((response.headers.get('content-type') || '').split(';')[0].trim())) throw new Error('Resource media type refused');
    if (Number(response.headers.get('content-length')) > maxBytes) throw new Error('Resource byte limit exceeded');
    const chunks = []; let length = 0;
    const reader = response.body.getReader();
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        length += value.length;
        if (length > maxBytes) throw new Error('Resource byte limit exceeded');
        chunks.push(value);
      }
    } finally { await reader.cancel(); }
    const bytes = new Uint8Array(length); let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
    return { ...(await verifyResourceBytes(bytes, { sha256: digest, integrity }, { purpose, verifiedCache })), url };
  } finally { clearTimeout(timeout); }
}

/** Discovery is pure: unsupported or spoofed hosts never acquire a provider. */
export function discoverSourceProvider(input) {
  try {
    if (typeof input !== 'string' || /[\\\u0000-\u0020]/.test(input)) return null;
    const u = new URL(input);
    if (u.protocol !== 'https:' || u.port || u.username || u.password || u.search) return null;
    if (u.hostname === 'github.com' || u.hostname === 'raw.githubusercontent.com') {
      const raw = new URL(u.hostname === 'github.com' ? githubRawURL(input) : input);
      // Apply the same ambiguity rules to raw URLs as to blob URLs.
      if (/%(?:2f|5c|2e|25)/i.test(input) || /(?:^|\/)\.{1,2}(?:\/|$)/.test(input)) return null;
      const m = raw.pathname.match(/^\/([\w.-]+)\/([\w.-]+)\/([a-f0-9]{40})\/(.+)$/i);
      if (!m || ['.', '..'].includes(m[1]) || ['.', '..'].includes(m[2])) return null;
      return { provider: 'github', pinned: { owner: m[1], repo: m[2], commit: m[3].toLowerCase(), path: decodeURIComponent(m[4]) } };
    }
    if (u.hostname === 'arxiv.org') {
      const m = u.pathname.match(/^\/(?:abs|pdf)\/((?:\d{4}\.\d{4,5}|[a-z][a-z.-]*(?:\.[A-Z]{2})?\/\d{7}))(v[1-9]\d{0,4})?(?:\.pdf)?$/);
      if (m) return { provider: 'arxiv', pinned: { id: m[1], version: m[2] ? Number(m[2].slice(1)) : null } };
    }
  } catch { /* unsupported or ambiguous identity */ }
  return null;
}

function validateRevision(entry) {
  const revision = entry.revision;
  const derived = discoverSourceProvider(entry.url);
  if (!revision || !derived || revision.provider !== derived.provider || !revision.pinned || JSON.stringify(Object.keys(revision.pinned).sort()) !== JSON.stringify(Object.keys(derived.pinned).sort()) || Object.keys(derived.pinned).some(k => revision.pinned[k] !== derived.pinned[k])) throw new Error('Revision pinned identity must match source URL');
  const tracking = revision.tracking;
  if (tracking !== undefined) {
    if (!tracking || (revision.provider === 'github' ? !['branch', 'tag', 'release'].includes(tracking.mode) : tracking.mode !== 'latest')) throw new Error('Unsupported provider tracking mode');
    if (revision.provider === 'github' && tracking.mode !== 'release' && (typeof tracking.ref !== 'string' || !tracking.ref || tracking.ref.length > 200 || /[\u0000-\u0020\u007f]/.test(tracking.ref))) throw new Error('Named tracking ref required');
    if (tracking.mode === 'release' && (tracking.ref !== undefined || tracking.semver !== undefined && typeof tracking.semver !== 'boolean')) throw new Error('Release tracking uses latest published release; optional semver boolean');
  }
  return revision;
}

// Small structural XML subset, not an XML substring extractor. It consumes the
// complete input with a balanced element stack and namespace scopes. Unsupported
// XML constructs fail closed. No DTD, entity declarations, CDATA, external
// entities, processing instructions (except initial XML declaration), recovery,
// or network resolution. Limits apply before parsing and to every node/depth.
export function parseArxivAtom(xml) {
  if (typeof xml !== 'string' || new TextEncoder().encode(xml).length > LIMITS.bytes) throw new Error('Atom byte limit exceeded');
  let i = 0; let nodes = 0;
  const name = () => {
    const m = /^[A-Za-z_][A-Za-z0-9_.:-]*/.exec(xml.slice(i));
    if (!m || !/^[A-Za-z_][A-Za-z0-9_.-]*(?::[A-Za-z_][A-Za-z0-9_.-]*)?$/.test(m[0])) throw new Error('Invalid XML name');
    i += m[0].length; return m[0];
  };
  const space = () => { while (/\s/.test(xml[i] || '') && i < xml.length) i++; };
  const decode = text => {
    let result = '';
    for (let p = 0; p < text.length; p++) {
      const c = text.charCodeAt(p);
      if (c < 32 && ![9, 10, 13].includes(c)) throw new Error('Invalid XML character');
      if (text[p] !== '&') { result += text[p]; continue; }
      const end = text.indexOf(';', p + 1);
      if (end < 0 || end - p > 12) throw new Error('XML entity refused');
      const entity = text.slice(p + 1, end);
      const builtin = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };
      if (own(builtin, entity)) result += builtin[entity];
      else {
        if (!/^#(?:[0-9]+|x[0-9a-fA-F]+)$/.test(entity)) throw new Error('XML entity refused');
        const point = entity[1] === 'x' ? parseInt(entity.slice(2), 16) : Number(entity.slice(1));
        if (!(point === 9 || point === 10 || point === 13 || point >= 32 && point <= 0x10ffff && !(point >= 0xd800 && point <= 0xdfff) && point !== 0xfffe && point !== 0xffff)) throw new Error('Invalid XML character');
        result += String.fromCodePoint(point);
      }
      p = end;
    }
    return result;
  };
  const root = { children: [], text: '', ns: Object.assign(Object.create(null), { xml: 'http://www.w3.org/XML/1998/namespace' }) }; const stack = [root];
  if (xml.charCodeAt(0) === 0xfeff) i++;
  if (xml.startsWith('<?xml ', i)) {
    const end = xml.indexOf('?>', i);
    if (end < 0 || end - i > 200 || !/^<\?xml\s+version=['"]1\.0['"](?:\s+encoding=['"]UTF-8['"])?(?:\s+standalone=['"](?:yes|no)['"])?\s*\?>$/i.test(xml.slice(i, end + 2))) throw new Error('XML declaration refused');
    i = end + 2;
  }
  while (i < xml.length) {
    const parent = stack.at(-1);
    if (xml[i] !== '<') {
      const end = xml.indexOf('<', i); const next = end < 0 ? xml.length : end;
      const text = xml.slice(i, next);
      if (text.includes(']]>')) throw new Error('Invalid XML text');
      parent.text += decode(text); i = next; continue;
    }
    if (xml.startsWith('<!--', i)) {
      const end = xml.indexOf('-->', i + 4);
      if (end < 0 || xml.slice(i + 4, end).includes('--')) throw new Error('Invalid XML comment');
      i = end + 3; continue;
    }
    if (xml.startsWith('<!', i) || xml.startsWith('<?', i)) throw new Error('XML DTD/entity/unsupported construct refused');
    i++;
    if (xml[i] === '/') {
      i++; const closing = name(); space();
      if (xml[i++] !== '>' || stack.length === 1 || stack.pop().name !== closing) throw new Error('Unbalanced XML');
      continue;
    }
    const tag = name(); const attrs = Object.create(null); const ns = Object.assign(Object.create(null), parent.ns);
    while (true) {
      const before = i; space();
      if (xml[i] === '>' || xml[i] === '/') break;
      if (before === i) throw new Error('XML attribute separator required');
      const key = name(); space();
      if (own(attrs, key) || xml[i++] !== '=') throw new Error('XML attribute refused');
      space(); const quote = xml[i++];
      if (quote !== '"' && quote !== "'") throw new Error('Quoted XML attribute required');
      const end = xml.indexOf(quote, i);
      if (end < 0 || xml.slice(i, end).includes('<')) throw new Error('XML attribute refused');
      attrs[key] = decode(xml.slice(i, end)); i = end + 1;
      if (key === 'xmlns') ns[''] = attrs[key];
      else if (key.startsWith('xmlns:')) ns[key.slice(6)] = attrs[key];
    }
    const empty = xml[i] === '/'; if (empty) i++;
    if (xml[i++] !== '>' || ++nodes > LIMITS.nodes || stack.length > LIMITS.depth) throw new Error('XML structure/budget refused');
    const parts = tag.split(':'); const prefix = parts.length === 2 ? parts[0] : '';
    if (prefix && !ns[prefix]) throw new Error('Unbound XML namespace');
    const node = { name: tag, local: parts.at(-1), uri: ns[prefix] || '', ns, text: '', children: [] };
    parent.children.push(node); if (!empty) stack.push(node);
  }
  if (stack.length !== 1 || root.children.length !== 1 || root.text.trim()) throw new Error('Invalid XML document');
  const atom = 'http://www.w3.org/2005/Atom'; const feed = root.children[0];
  if (feed.local !== 'feed' || feed.uri !== atom) throw new Error('Expected Atom feed');
  const entries = feed.children.filter(n => n.local === 'entry' && n.uri === atom);
  if (entries.length !== 1) throw new Error('Expected exactly one arXiv entry');
  const ids = entries[0].children.filter(n => n.local === 'id' && n.uri === atom);
  if (ids.length !== 1 || ids[0].children.length) throw new Error('Expected scalar arXiv ID');
  const id = ids[0].text.trim().replace(/^http:\/\/arxiv\.org\//, 'https://arxiv.org/');
  const discovered = discoverSourceProvider(id);
  if (discovered?.provider !== 'arxiv' || !discovered.pinned.version) throw new Error('Expected versioned arXiv identity');
  return { ...discovered.pinned, url: id };
}

/** Explicit caller action only. Fixed endpoints, no document-selected proxy or
 * auth. API responses are bounded observations, not trusted timestamps/facts. */
export async function checkSourceRevision(source, { fetcher = globalThis.fetch, now = () => new Date(), timeout = LIMITS.timeout } = {}) {
  const observedAt = now().toISOString();
  const original = discoverSourceProvider(source?.url);
  const evidence = [];
  let attemptedURL;
  const base = { observedAt, timestampAuthority: 'client-clock (not trusted)', original, evidence, evidenceRole: 'provider-observation; not authorship or supersession verification' };
  if (!original) return { ...base, status: 'unknown', reason: 'Unsupported source provider' };
  const request = async (url, media, role) => {
    attemptedURL = url;
    const result = await fetchResource(url, { fetcher, policy: { origins: ['https://api.github.com', 'https://export.arxiv.org'], timeout, [PROVIDER_QUERY]: true }, media, maxBytes: 256000 });
    evidence.push({ url: result.url, sha256: result.sha256, role });
    return result.text;
  };
  try {
    if (source.revision !== undefined) validateRevision(source);
    let latest; let tracking; let relationship; let githubStatus; let githubReason;
    if (original.provider === 'github') {
      const p = original.pinned;
      const repo = `https://api.github.com/repos/${encodeURIComponent(p.owner)}/${encodeURIComponent(p.repo)}`;
      tracking = source.revision?.tracking;
      if (!tracking) {
        const info = JSON.parse(await request(repo, ['application/json'], 'repository default branch discovery'));
        if (typeof info.default_branch !== 'string' || !info.default_branch || info.default_branch.length > 200) throw new Error('GitHub default branch response shape refused');
        tracking = { mode: 'branch', ref: info.default_branch };
      }
      let ref = tracking.ref;
      if (tracking.mode === 'release') {
        const release = JSON.parse(await request(repo + '/releases/latest', ['application/json'], 'latest published release metadata'));
        if (typeof release.tag_name !== 'string' || !release.tag_name || release.tag_name.length > 200 || release.draft !== false || release.prerelease !== false || tracking.semver && !/^v?(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/.test(release.tag_name)) throw new Error('GitHub release response/semver refused');
        ref = release.tag_name;
      }
      // URLSearchParams escapes slash, spaces, ampersand and hash in path/ref.
      // Disambiguate a branch and tag with the same name.
      const qualifiedRef = `refs/${tracking.mode === 'branch' ? 'heads' : 'tags'}/${ref}`;
      const query = new URLSearchParams({ path: p.path, sha: qualifiedRef, per_page: '1' });
      const commits = JSON.parse(await request(repo + '/commits?' + query, ['application/json'], 'latest commit affecting the specific path at tracking ref'));
      if (!Array.isArray(commits) || commits.length > 1) throw new Error('GitHub path commit response shape refused');
      if (!commits.length) return { ...base, status: 'unknown', tracking, relationship: { kind: 'no-path-commit' }, effectiveURL: attemptedURL, reason: 'No commit returned for this path/ref; no current or newer revision established. Original preserved.' };
      if (typeof commits[0]?.sha !== 'string' || !/^[a-f0-9]{40}$/i.test(commits[0].sha)) throw new Error('GitHub path commit response shape refused');
      latest = { ...p, commit: commits[0].sha.toLowerCase(), ref };
      if (latest.commit === p.commit) {
        relationship = { kind: 'equal', base: p.commit, candidate: latest.commit };
        githubStatus = 'current';
        githubReason = 'Latest path commit equals the pinned revision; original preserved. Not a supersession assertion.';
      } else {
        const pair = `${p.commit}...${latest.commit}`;
        const comparison = JSON.parse(await request(`${repo}/compare/${pair}?per_page=1`, ['application/json'], 'ancestry comparison: pinned base versus path-commit candidate'));
        // GitHub's permalink_url may abbreviate and owner-qualify the SHAs.
        // Validate its API URL containing both full identities instead.
        const expectedComparisonURL = `${repo}/compare/${pair}`;
        const sha = value => typeof value === 'string' && /^[a-f0-9]{40}$/i.test(value) ? value.toLowerCase() : null;
        const mergeBase = sha(comparison?.merge_base_commit?.sha);
        const ahead = comparison?.ahead_by; const behind = comparison?.behind_by;
        if (sha(comparison?.base_commit?.sha) !== p.commit || typeof comparison?.url !== 'string' || comparison.url.toLowerCase() !== expectedComparisonURL.toLowerCase() || !mergeBase || !Number.isSafeInteger(ahead) || ahead < 0 || !Number.isSafeInteger(behind) || behind < 0) throw new Error('GitHub comparison identity/count response refused');
        const kind = comparison.status === 'ahead' && ahead > 0 && behind === 0 && mergeBase === p.commit ? 'descendant'
          : comparison.status === 'behind' && behind > 0 && ahead === 0 && mergeBase === latest.commit ? 'ancestor'
          : comparison.status === 'diverged' && ahead > 0 && behind > 0 && mergeBase !== p.commit && mergeBase !== latest.commit ? 'diverged' : null;
        if (!kind) throw new Error('GitHub comparison status/count/ancestry response refused');
        relationship = { kind, base: p.commit, candidate: latest.commit, mergeBase, providerStatus: comparison.status, aheadBy: ahead, behindBy: behind };
        githubStatus = kind === 'descendant' ? 'latest' : 'unknown';
        githubReason = kind === 'descendant' ? 'Latest path commit is a positively compared descendant of the pinned revision; newer path history observed, not proof of changed bytes or supersession. Original preserved.'
          : kind === 'ancestor' ? 'Latest path commit is an ancestor of the pinned revision; the tracked ref may be behind changes present in the pin. Byte equality has not been checked, so current/unchanged is not established. Original preserved.'
          : 'Pinned revision and latest path commit have diverged history; no newer/current relationship established. Original preserved; no supersession inferred.';
      }
    } else {
      tracking = { mode: 'latest' };
      const url = 'https://export.arxiv.org/api/query?' + new URLSearchParams({ id_list: original.pinned.id, max_results: '1' });
      latest = parseArxivAtom(await request(url, ['application/atom+xml', 'application/xml', 'text/xml'], 'arXiv latest version Atom entry'));
      if (latest.id !== original.pinned.id) throw new Error('arXiv response identity mismatch');
    }
    const pinned = original.pinned;
    const status = original.provider === 'github' ? githubStatus : !pinned.version ? 'unknown' : latest.version === pinned.version ? 'current' : latest.version > pinned.version ? 'latest' : 'unknown';
    return { ...base, status, tracking, latest, ...(relationship ? { relationship } : {}), effectiveURL: evidence.at(-1)?.url, reason: githubReason || (status === 'latest' ? 'Higher arXiv version observed; original preserved (not a supersession assertion)' : status === 'unknown' ? 'No comparable pinned version or provider returned an older version' : 'Pinned revision matches observation') };
  } catch (error) {
    return { ...base, status: 'error', effectiveURL: attemptedURL, reason: `${error.message}. Provider unavailable, rate-limited, CORS/offline, or response refused; no fallback.` };
  }
}

async function registryEntry(kind, ref, registry, options, stack = []) {
  if (stack.includes(ref) || stack.length >= 8) throw new Error('Registry dependency cycle/budget exceeded');
  const [id, version] = ref.split('@');
  const resolved = options.resolvedRegistry[kind];
  if (resolved[id]?.version === version) return resolved[id];
  if (Object.keys(options.resolvedRegistry.dialects).length + Object.keys(options.resolvedRegistry.themes).length >= LIMITS.resources) throw new Error('Registry resource budget exceeded');
  const entry = registry[kind]?.[id];
  if (!entry || entry.version !== version) throw new Error(`Unsupported ${kind} registry entry: ${ref}`);
  const expected = integrityDescriptor(entry);
  if (expected.onMismatch !== 'refuse') throw new Error('Registry resources must be strictly digest pinned');
  let data = entry;
  if (entry.url) {
    if (!expected.digest || expected.onMismatch !== 'refuse') throw new Error('Registry resources must be strictly digest pinned');
    const loaded = await fetchResource(entry.url, { ...options, digest: expected.digest, purpose: 'trusted', pinned: true, media: ['application/json'] });
    data = JSON.parse(loaded.text);
    if (data.version !== version) throw new Error('Registry data version mismatch');
  }
  checkData(data);
  for (const dependency of data.dependencies || []) await registryEntry(kind, dependency, registry, options, [...stack, ref]);
  resolved[id] = data;
  return data;
}

/** Lazy, host-owned declarative registry. Only used families are resolved. */
export async function renderDocument(source, options = {}) {
  const parsed = parseDocument(source, options.defaults);
  const { ast, manifest } = parsed;
  const registry = options.registry || BUILTIN_REGISTRY;
  const diagnostics = [];
  const resolvedRegistry = { dialects: {}, themes: {} };
  const registryOptions = { ...options, resolvedRegistry };
  const specs = Object.create(null);
  const used = [];
  for (const ref of manifest.dialects) {
    const id = ref.split('@')[0];
    const advertised = registry.dialects?.[id];
    if (!advertised || advertised.version !== ref.split('@')[1]) diagnostics.push(`Unsupported dialect declaration: ${ref}`);
    // A remote family must advertise its tag names in host configuration.
    const names = Object.keys(advertised?.tags || {});
    if (!names.some(name => parsed.tags.includes(name))) continue;
    try {
      const family = await registryEntry('dialects', ref, registry, registryOptions);
      for (const [name, spec] of Object.entries(family.tags || {})) {
        if (!CUSTOM_ELEMENTS.has(spec.element) || !Array.isArray(spec.attrs) || spec.attrs.some(a => !['title', 'kind', 'status', 'ref'].includes(a)) || own(specs, name)) throw new Error('Unsafe or conflicting declarative template');
      }
      Object.assign(specs, family.tags); used.push(ref);
    } catch (e) { diagnostics.push(e.message); }
  }
  let theme = '';
  const themeRef = manifest.assets.find(a => a.role === 'theme')?.ref || manifest.settings.theme;
  if (themeRef) {
    try { theme = themeCSS((await registryEntry('themes', themeRef, registry, registryOptions)).tokens); }
    catch (e) { diagnostics.push(e.message); }
  }
  const refuse = (node, message) => {
    diagnostics.push(message);
    const line = node.lines?.[0] ?? node.location?.start?.line;
    const end = node.lines?.at(-1) ?? node.location?.end?.line;
    const excerpt = Number.isInteger(line) ? parsed.source.split('\n').slice(line, (end ?? line) + 1).join('\n') : node.tag || node.type;
    return new Markdoc.Tag('aside', { class: 'refusal' }, [new Markdoc.Tag('strong', {}, [message]), new Markdoc.Tag('pre', {}, [excerpt])]);
  };
  const tags = Object.create(null);
  for (const name of parsed.tags) {
    const spec = own(specs, name) ? specs[name] : undefined;
    tags[name] = {
      selfClosing: spec?.selfClosing || false,
      attributes: Object.fromEntries((spec?.attrs || []).map(key => [key, { type: String }])),
      transform(node, config) {
        if (!spec) return refuse(node, `Unsupported tag: ${name}`);
        if ((node.errors || []).length || Object.keys(node.attributes).some(k => !spec.attrs.includes(k)) || Object.values(node.attributes).some(v => typeof v !== 'string')) return refuse(node, `Invalid attributes: ${name}`);
        const a = node.attributes;
        if (a.kind && !['warning', 'note', 'info', 'proposal', 'observed', 'verified'].includes(a.kind)) return refuse(node, 'Unsupported callout kind');
        if (a.status && !['proposal', 'observed', 'verified'].includes(a.status)) return refuse(node, 'Unsupported status');
        if (name === 'source') {
          const entry = manifest.sources.find(s => s.id === a.ref);
          if (!entry) return refuse(node, `Unknown source: ${a.ref}`);
          return new Markdoc.Tag('span', { class: 'source-reference', 'data-source': entry.id }, [`[Source: ${entry.title || entry.id}]`]);
        }
        if (name === 'model' || name === 'view') {
          const entry = manifest[name === 'model' ? 'models' : 'views'].find(s => s.id === a.ref);
          const model = name === 'model' ? entry : manifest.models.find(m => m.id === entry?.model);
          if (!entry || !model || (name === 'view' && !['table', 'json'].includes(entry.kind))) return refuse(node, `Unsupported or missing ${name}: ${a.ref}`);
          const rows = Object.entries(model.data || model);
          if (rows.length > 300) return refuse(node, 'Model row budget exceeded');
          const projection = name === 'view' && entry.kind === 'table'
            ? new Markdoc.Tag('table', {}, [new Markdoc.Tag('thead', {}, [new Markdoc.Tag('tr', {}, [new Markdoc.Tag('th', {}, ['Field']), new Markdoc.Tag('th', {}, ['Authored value'])])]), new Markdoc.Tag('tbody', {}, rows.map(([key, value]) => new Markdoc.Tag('tr', {}, [new Markdoc.Tag('td', {}, [key]), new Markdoc.Tag('td', {}, [typeof value === 'string' ? value : JSON.stringify(value)])])))])
            : new Markdoc.Tag('pre', {}, [JSON.stringify(model, null, 2)]);
          return new Markdoc.Tag('section', { class: 'model' }, [new Markdoc.Tag('strong', {}, [`${entry.title || entry.id} — read-only authored model (not a runtime observation)`]), projection]);
        }
        return new Markdoc.Tag(spec.element, { class: `semantic ${name}${a.kind ? ` ${a.kind}` : ''}` }, [new Markdoc.Tag('strong', { class: 'block-label' }, [`${a.title || name}${a.kind ? ` · ${a.kind}${['proposal', 'observed', 'verified'].includes(a.kind) ? ' (authored claim)' : ''}` : ''}${a.status ? ` · ${a.status} (authored claim)` : ''}`]), ...node.transformChildren(config)]);
      },
    };
  }
  // Escape/raw-HTML policy and tokenizer defaults are shared with markdoc.js.
  // Unlike legacy defineTags, attributes are never blindly forwarded.
  const config = { tags, variables: {}, nodes: {
    fence: { ...Markdoc.nodes.fence, transform(node) { return new Markdoc.Tag('pre', {}, [new Markdoc.Tag('code', {}, [node.attributes.content || ''])]); } },
    image: { transform(node) { diagnostics.push('Image inert: explicit asset loading required'); return new Markdoc.Tag('span', { class: 'unavailable' }, [`[Image unavailable: ${node.attributes.alt || 'image'}]`]); } },
  } };
  const validation = Markdoc.validate(ast, config);
  for (const item of validation) diagnostics.push(`${item.error.id}: ${item.error.message}`);
  // Built-in executable constructs (if/for/partial) are not part of this grammar.
  for (const node of ast.walk()) {
    if (node.type === 'tag' && !own(tags, node.tag)) throw new Error('Unregistered AST tag');
    if (node.type !== 'tag' && node.annotations?.length) throw new Error('Author HTML annotations refused; use declared semantic tags');
    if (node.type === 'variable' || node.type === 'function') throw new Error('Executable expressions refused');
    if (Object.getPrototypeOf(node.attributes) !== Object.prototype || Object.keys(node.attributes).some(k => BAD_KEYS.has(k))) throw new Error('Unsafe AST attribute map');
    try { checkData(Object.values(node.attributes)); } catch { throw new Error('Executable expressions or unsafe AST attributes refused'); }
  }
  const tree = Markdoc.transform(ast, config);
  const headings = [];
  function render(value) {
    if (value == null) return '';
    if (Array.isArray(value)) return value.map(render).join('');
    if (typeof value !== 'object') return escapeHTML(value);
    const name = value.name;
    if (!ELEMENTS.has(name)) { diagnostics.push(`HTML element refused: ${name}`); return `<span class="refusal">Unsupported element: ${escapeHTML(name)}</span>`; }
    const a = value.attributes || {};
    let attrs = '';
    if (name === 'a') {
      const href = safeLink(a.href);
      if (href) attrs += ` href="${escapeHTML(href)}" rel="noreferrer noopener"`;
      else diagnostics.push('Unsafe or relative link made inert');
    }
    if (typeof a.class === 'string' && /^[a-z -]{1,150}$/.test(a.class)) attrs += ` class="${a.class}"`;
    if (typeof a['data-source'] === 'string') attrs += ` data-source="${escapeHTML(a['data-source'])}" tabindex="0" role="button" aria-label="Inspect source ${escapeHTML(a['data-source'])}"`;
    if (/^h[1-6]$/.test(name)) {
      const id = `section-${headings.length + 1}`;
      const plain = (v) => Array.isArray(v) ? v.map(plain).join('') : typeof v === 'object' && v ? plain(v.children) : String(v ?? '');
      headings.push({ id, level: Number(name[1]), text: plain(value.children) });
      attrs += ` id="${id}"`;
    }
    return `<${name}${attrs}>${render(value.children)}</${name}>`;
  }
  const assetNotes = manifest.assets.filter(a => a.role === 'logo' || a.role === 'repository').map(a => a.role === 'repository'
    ? `<p class="asset-provenance">Repository: ${safeLink(a.url) ? `<a href="${escapeHTML(safeLink(a.url))}" rel="noreferrer noopener">${escapeHTML(a.title || a.id)}</a>` : escapeHTML(a.id) + ' (unavailable URL)'}</p>`
    : `<p class="unavailable">Logo asset unavailable without explicit embedding: ${escapeHTML(a.id)} · ${escapeHTML(a.alt)}</p>`).join('');
  const html = assetNotes + render(tree);
  return { html, manifest, headings, diagnostics: [...new Set(diagnostics)], clean: diagnostics.length === 0, usedDialects: used, theme, tree, resolvedRegistry };
}
