// Runtime-neutral standalone assembly. Host-owned, prebuilt assets are prepared
// once by the Node build adapter; no filesystem, subprocess or esbuild is used here.
import { BUILTIN_REGISTRY, LIMITS, escapeHTML, renderDocument, sha256, identifierResolvers } from '../../src/content/markdoc-ragbaz.js';
import { AETHER_VARIANTS } from './aether.js';
import { themeFontStyles } from './fonts.js';
const jsonScript = value => JSON.stringify(value).replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
const canonical = value => JSON.stringify(value, (_, v) => v && !Array.isArray(v) && typeof v === 'object' ? Object.fromEntries(Object.keys(v).sort().map(k => [k, v[k]])) : v);

/** assets/fetcher/loadSnapshot are trusted host seams, never authored inputs. */
export async function buildStandaloneBytes({ sourceBytes, config: inputConfig, assets, fetcher = () => { throw Error('Build network disabled'); }, loadSnapshot } = {}) {
  if (!(sourceBytes instanceof Uint8Array) || sourceBytes.length > LIMITS.bytes) throw Error('Document byte limit exceeded');
  const source = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(sourceBytes);
  const config = structuredClone(inputConfig);
  if (config?.version !== 'ragbaz.surface/1' || config.skeleton !== 'paper/1' || config.implementation !== 'markdoc-ragbaz/1') throw Error('Unsupported surface tuple (installed: paper/1 + markdoc-ragbaz/1)');
  if (config.metaDocument && (!['markdoc-ragbaz-sci-tufte', 'heartfulness', ...Object.keys(AETHER_VARIANTS)].includes(config.metaDocument.id) || config.metaDocument.version !== 1)) throw Error('Unsupported meta-document host configuration');
  if (config.fontAlternatives && (config.fontAlternatives !== 'google-curated/1' || !config.metaDocument)) throw Error('Unsupported host font alternatives');
  if (assets?.schema !== 'ragbaz.standalone-assets/1' || ['runtime','skeleton','baseStyles','heartfulnessStyles','aetherStyles','credits'].some(key => typeof assets[key] !== 'string' || new TextEncoder().encode(assets[key]).length > 4 * LIMITS.bytes)) throw Error('Invalid prepared standalone assets');
  // Host publication furniture is validated here so every build path agrees.
  if (config.supportDirectory !== undefined) {
    const d = config.supportDirectory;
    if (!d || typeof d !== 'object' || typeof d.label !== 'string' || !d.label.trim() || d.label.length > 80 || !d.topics || typeof d.topics !== 'object' || Array.isArray(d.topics)
      || Object.entries(d.topics).some(([topic, url]) => !/^[a-z][a-z0-9-]{1,40}$/.test(topic) || typeof url !== 'string' || !url.startsWith('https://') || url.length > 500)) throw Error('Invalid host support directory');
  }
  if (config.identifierResolvers !== undefined) identifierResolvers(config.identifierResolvers);
  if (config.colophon !== undefined && (!config.colophon || typeof config.colophon.url !== 'string' || !/^https:\/\/[^\s]{1,200}$/.test(config.colophon.url) || new TextEncoder().encode(config.colophon.url).length > 200)) throw Error('Colophon URL must be HTTPS and at most 200 bytes');
  if (config.logo !== undefined) {
    const l = config.logo;
    if (!l || !['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'].includes(l.mime) || typeof l.data !== 'string' || l.data.length > 2_000_000 || !/^[A-Za-z0-9+/]+={0,2}$/.test(l.data) || typeof l.alt !== 'string' || !l.alt.trim()) throw Error('Invalid host logo');
    const raw = Uint8Array.from(atob(l.data), c => c.charCodeAt(0));
    if (await sha256(raw) !== l.sha256) throw Error('Host logo digest mismatch');
  }
  const connect = (config.policy?.origins || []).map(origin => {
    const url = new URL(origin);
    if (url.protocol !== 'https:' || url.origin !== origin || url.username || url.password) throw Error('Host policy requires exact HTTPS origins');
    return url.origin;
  }).concat(['https://api.github.com', 'https://export.arxiv.org']).join(' ');
  const registry = { dialects: { ...BUILTIN_REGISTRY.dialects, ...config.dialects }, themes: { ...BUILTIN_REGISTRY.themes, ...config.themes } };
  const result = await renderDocument(source, { registry, defaults: config.defaults, policy: config.policy, fetcher, visualizations: config.visualizations, supportDirectory: config.supportDirectory, identifierResolvers: config.identifierResolvers });
  config.dialects = { ...config.dialects, ...result.resolvedRegistry.dialects };
  config.themes = { ...config.themes, ...result.resolvedRegistry.themes };
  const snapshots = {};
  if (loadSnapshot && result.manifest.sources.length > LIMITS.resources) throw Error('Source snapshot budget exceeded');
  let total = 0;
  for (const entry of result.manifest.sources) {
    const loaded = loadSnapshot ? await loadSnapshot(entry) : undefined;
    if (loaded) {
      total += new TextEncoder().encode(loaded.text).length;
      if (total > 4 * LIMITS.bytes) throw Error('Aggregate snapshot budget exceeded');
      snapshots[entry.id] = loaded;
    }
  }
  const { runtime, skeleton, credits } = assets;
  let styles = assets.baseStyles;
  if (config.metaDocument?.id === 'heartfulness') styles += '\n' + assets.heartfulnessStyles;
  if (AETHER_VARIANTS[config.metaDocument?.id]) styles += '\n' + assets.aetherStyles;
  if (config.fontAlternatives === 'google-curated/1') styles += themeFontStyles(config.metaDocument.id);
  const digest = await sha256(sourceBytes), hashText = text => sha256(new TextEncoder().encode(text));
  const runtimeSHA256 = await hashText(runtime);
  const tuple = { schema: 'ragbaz.render/1', sourceSHA256: digest, skeleton: { id: config.skeleton, sha256: await hashText(skeleton) }, implementation: { id: config.implementation, sha256: runtimeSHA256, markdoc: '0.5.10' }, stylesSHA256: await hashText(styles), assets: result.manifest.assets, settings: result.manifest.settings, defaults: config.defaults || {}, policy: config.policy || {}, visualizations: config.visualizations || null, registry: { dialects: config.dialects, themes: config.themes }, snapshots: Object.fromEntries(Object.entries(snapshots).map(([id, s]) => [id, s.sha256])) };
  tuple.noticesSHA256 = await hashText(credits);
  // Publication furniture participates in render identity only when configured,
  // so tuples of builds without it are unchanged.
  if (config.logo) tuple.logoSHA256 = config.logo.sha256;
  if (config.colophon) tuple.colophon = config.colophon;
  if (config.supportDirectory) tuple.supportDirectory = config.supportDirectory;
  if (config.identifierResolvers) tuple.identifierResolvers = config.identifierResolvers;
  tuple.surface = { metaDocument: config.metaDocument || null, contractSource: config.contractSource || 'rendering-contract', fontAlternatives: config.fontAlternatives || null };
  const payload = { source, sha256: digest, runtimeSHA256, renderSHA256: await hashText(canonical(tuple)), tuple, config, snapshots };
  const values = {
    TEMPLATE: config.metaDocument?.id || 'markdoc-ragbaz-sci-tufte',
    FONTSTYLE: config.fontAlternatives ? ' https://fonts.googleapis.com' : '',
    FONTS: config.fontAlternatives ? 'https://fonts.gstatic.com' : "'none'",
    IMG: config.logo ? 'data:' : "'none'",
    TITLE: escapeHTML(result.manifest.document.title || result.manifest.title || result.headings[0]?.text || 'Document'),
    CONNECT: escapeHTML(connect), STYLES: styles, CREDITS: escapeHTML(credits),
    TOC: result.headings.map(h => `<a data-level="${h.level}" href="#${h.id}">${escapeHTML(h.text)}</a>`).join(''),
    PAPER: result.html,
    PROVENANCE: escapeHTML(`Embedded snapshot · SHA-256 ${digest} · ${config.implementation} / ${config.skeleton}${result.diagnostics.length ? ' · Partial / refused: ' + result.diagnostics.join('; ') : ''}`),
    PAYLOAD: jsonScript(payload), RUNTIME: runtime.replace(/<\/script/gi, '<\\/script'),
  };
  return { html: skeleton.replace(/@@([A-Z]+)@@/g, (_, key) => values[key]), result, payload, assets: { runtime, styles, credits } };
}
