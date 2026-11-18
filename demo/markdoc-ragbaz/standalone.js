// Runtime-neutral standalone assembly. Host-owned, prebuilt assets are prepared
// once by the Node build adapter; no filesystem, subprocess or esbuild is used here.
import { BUILTIN_REGISTRY, LIMITS, escapeHTML, renderDocument, sha256 } from '../../src/content/markdoc-ragbaz.js';
import { AETHER_VARIANTS } from './aether.js';
import { themeFontStyles } from './fonts.js';
const RTL_LANGUAGES = new Set(['ar', 'he', 'fa', 'ur', 'ps', 'sd', 'ug', 'yi', 'dv', 'ckb']);
// Mirrors the reading column for right-to-left documents; reader chrome stays as is.
const RTL_STYLES = `
/* rtl: document.direction */
html[dir=rtl] #paper{text-align:start}html[dir=rtl] blockquote{border-left:0;border-right:2px solid var(--accent);padding-left:0;padding-right:1.2rem}html[dir=rtl] .semantic{border-left:0;border-right:3px solid var(--accent)}html[dir=rtl] .semantic.warning{border-right-color:var(--warning)}html[dir=rtl] .semantic.aside{border-right:1px solid var(--rule);margin-right:0;max-width:100%}html[dir=rtl] .semantic.product{border-right-color:#3f86d6}html[dir=rtl] th,html[dir=rtl] td{text-align:right}html[dir=rtl] th:first-child,html[dir=rtl] td:first-child{padding-left:.8rem;padding-right:0}html[dir=rtl] .timeline{padding-left:0;padding-right:1.1em;border-left:0;border-right:2px solid var(--rule)}html[dir=rtl] .event{padding-left:0;padding-right:.7em}html[dir=rtl] .event::before{left:auto;right:calc(-1.1em - 6px)}html[dir=rtl] .bibliography ol{padding-left:0;padding-right:2em}html[dir=rtl] .citation{margin-left:0;margin-right:.1em}html[dir=rtl] ul,html[dir=rtl] ol{padding-left:0;padding-right:1.6em}html[dir=rtl] #toc a[data-level='3']{padding-left:0;padding-right:.8rem}html[dir=rtl] pre,html[dir=rtl] code{direction:ltr;unicode-bidi:isolate}
`;
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
  const connect = (config.policy?.origins || []).map(origin => {
    const url = new URL(origin);
    if (url.protocol !== 'https:' || url.origin !== origin || url.username || url.password) throw Error('Host policy requires exact HTTPS origins');
    return url.origin;
  }).concat(['https://api.github.com', 'https://export.arxiv.org']).join(' ');
  const registry = { dialects: { ...BUILTIN_REGISTRY.dialects, ...config.dialects }, themes: { ...BUILTIN_REGISTRY.themes, ...config.themes } };
  if (config.linkTarget !== undefined && config.linkTarget !== '_top') throw Error('Unsupported host linkTarget (only _top)');
  const result = await renderDocument(source, { registry, defaults: config.defaults, policy: config.policy, fetcher, visualizations: config.visualizations, linkTarget: config.linkTarget });
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
  // document.language / document.direction set the root element; absent, the output stays byte-identical (en, ltr).
  const { language, direction } = result.manifest.document || {};
  let root = null;
  if (language !== undefined || direction !== undefined) {
    if (language !== undefined && (typeof language !== 'string' || !/^[a-z]{2,3}(-[A-Za-z0-9]{2,8})*$/.test(language))) throw Error('document.language must be a BCP 47 tag such as "sv" or "zh-Hans"');
    if (direction !== undefined && !['ltr', 'rtl'].includes(direction)) throw Error('document.direction must be "ltr" or "rtl"');
    const lang = language || 'en';
    root = { lang, dir: direction || (RTL_LANGUAGES.has(lang.split('-')[0]) ? 'rtl' : 'ltr') };
  }
  let styles = assets.baseStyles;
  if (config.metaDocument?.id === 'heartfulness') styles += '\n' + assets.heartfulnessStyles;
  if (AETHER_VARIANTS[config.metaDocument?.id]) styles += '\n' + assets.aetherStyles;
  if (config.fontAlternatives === 'google-curated/1') styles += themeFontStyles(config.metaDocument.id);
  if (root?.dir === 'rtl') styles += RTL_STYLES;
  const digest = await sha256(sourceBytes), hashText = text => sha256(new TextEncoder().encode(text));
  const runtimeSHA256 = await hashText(runtime);
  const tuple = { schema: 'ragbaz.render/1', sourceSHA256: digest, skeleton: { id: config.skeleton, sha256: await hashText(skeleton) }, implementation: { id: config.implementation, sha256: runtimeSHA256, markdoc: '0.5.10' }, stylesSHA256: await hashText(styles), assets: result.manifest.assets, settings: result.manifest.settings, defaults: config.defaults || {}, policy: config.policy || {}, visualizations: config.visualizations || null, registry: { dialects: config.dialects, themes: config.themes }, snapshots: Object.fromEntries(Object.entries(snapshots).map(([id, s]) => [id, s.sha256])) };
  tuple.noticesSHA256 = await hashText(credits);
  tuple.surface = { metaDocument: config.metaDocument || null, contractSource: config.contractSource || 'rendering-contract', fontAlternatives: config.fontAlternatives || null };
  const payload = { source, sha256: digest, runtimeSHA256, renderSHA256: await hashText(canonical(tuple)), tuple, config, snapshots };
  const values = {
    TEMPLATE: config.metaDocument?.id || 'markdoc-ragbaz-sci-tufte',
    FONTSTYLE: config.fontAlternatives ? ' https://fonts.googleapis.com' : '',
    FONTS: config.fontAlternatives ? 'https://fonts.gstatic.com' : "'none'",
    TITLE: escapeHTML(result.manifest.document.title || result.manifest.title || result.headings[0]?.text || 'Document'),
    CONNECT: escapeHTML(connect), STYLES: styles, CREDITS: escapeHTML(credits),
    TOC: result.headings.map(h => `<a data-level="${h.level}" href="#${h.id}">${escapeHTML(h.text)}</a>`).join(''),
    PAPER: result.html,
    PROVENANCE: escapeHTML(`Embedded snapshot · SHA-256 ${digest} · ${config.implementation} / ${config.skeleton}${result.diagnostics.length ? ' · Partial / refused: ' + result.diagnostics.join('; ') : ''}`),
    PAYLOAD: jsonScript(payload), RUNTIME: runtime.replace(/<\/script/gi, '<\\/script'),
  };
  let html = skeleton.replace(/@@([A-Z]+)@@/g, (_, key) => values[key]);
  if (root) html = html.replace('<html lang="en"', `<html lang="${root.lang}"${root.dir === 'rtl' ? ' dir="rtl"' : ''}`);
  return { html, result, payload, assets: { runtime, styles, credits } };
}
