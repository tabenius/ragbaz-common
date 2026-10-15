#!/usr/bin/env node
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import { BUILTIN_REGISTRY, LIMITS, escapeHTML, renderDocument, fetchResource, sha256, verifyResourceBytes } from '../src/content/markdoc-ragbaz.js';
import { AETHER_VARIANTS } from '../demo/markdoc-ragbaz/aether.js';
import { themeFontStyles } from '../demo/markdoc-ragbaz/fonts.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const bytes = async path => {
  const data = await readFile(path);
  if (data.length > LIMITS.bytes) throw new Error(`File exceeds byte limit: ${path}`);
  return data;
};
const jsonScript = value => JSON.stringify(value).replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
const canonical = value => JSON.stringify(value, (_, v) => v && !Array.isArray(v) && typeof v === 'object' ? Object.fromEntries(Object.keys(v).sort().map(k => [k, v[k]])) : v);

// Full texts inspected from npm tarball LICENSE files, not inferred from SPDX
// labels or esbuild comments. Markdoc vendors these packages inside dist/.
const puzrinMIT = `Copyright (c) 2014 Vitaly Puzrin, Alex Kocharin.

Permission is hereby granted, free of charge, to any person
obtaining a copy of this software and associated documentation
files (the "Software"), to deal in the Software without
restriction, including without limitation the rights to use,
copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the
Software is furnished to do so, subject to the following
conditions:

The above copyright notice and this permission notice shall be
included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES
OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT
HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY,
WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR
OTHER DEALINGS IN THE SOFTWARE.
`;
const bynensMIT = `Copyright Mathias Bynens <https://mathiasbynens.be/>

Permission is hereby granted, free of charge, to any person obtaining
a copy of this software and associated documentation files (the
"Software"), to deal in the Software without restriction, including
without limitation the rights to use, copy, modify, merge, publish,
distribute, sublicense, and/or sell copies of the Software, and to
permit persons to whom the Software is furnished to do so, subject to
the following conditions:

The above copyright notice and this permission notice shall be
included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE
LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION
OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION
WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
`;
const vendoredNotices = {
  'markdown-it': puzrinMIT,
  'linkify-it': puzrinMIT.replace('2014 Vitaly Puzrin, Alex Kocharin.', '2015 Vitaly Puzrin.'),
  'uc.micro': bynensMIT,
  punycode: bynensMIT,
  entities: `Copyright (c) Felix Böhm
All rights reserved.

Redistribution and use in source and binary forms, with or without modification, are permitted provided that the following conditions are met:

Redistributions of source code must retain the above copyright notice, this list of conditions and the following disclaimer.

Redistributions in binary form must reproduce the above copyright notice, this list of conditions and the following disclaimer in the documentation and/or other materials provided with the distribution.

THIS IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS,
EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
`,
  mdurl: puzrinMIT.replace('2014', '2015') + `
--------------------------------------------------------------------------------

.parse() is based on Joyent's node.js \`url\` code:

Copyright Joyent, Inc. and other Node contributors. All rights reserved.
Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to
deal in the Software without restriction, including without limitation the
rights to use, copy, modify, merge, publish, distribute, sublicense, and/or
sell copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS
IN THE SOFTWARE.
`,
};
const pegNotice = `MIT License

Copyright (c) 2010-2016 David Majda
Copyright (c) 2017+ Futago-za Ryuu

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
`;

/** Fail closed when bundle inputs or Markdoc's vendored inventory change.
 * readText is a trusted test seam, never a document-supplied loader. */
export async function collectBundleNotices(metafile, { readText = path => readFile(resolve(root, path), 'utf8') } = {}) {
  const packageName = path => {
    const parts = path.split('node_modules/').at(-1).split('/');
    return parts[0].startsWith('@') ? parts.slice(0, 2).join('/') : parts[0];
  };
  const packages = [...new Set(Object.keys(metafile.inputs).filter(p => p.includes('node_modules/')).map(packageName))].sort();
  const notices = [];
  for (const name of packages) {
    if (!['@markdoc/markdoc', 'yaml'].includes(name)) throw new Error(`Unreviewed bundled license: ${name}`);
    const pkg = JSON.parse(await readText(`node_modules/${name}/package.json`));
    if (pkg.version !== ({ '@markdoc/markdoc': '0.5.10', yaml: '2.9.1' })[name]) throw new Error(`Unreviewed bundled license version: ${name}`);
    const text = await readText(`node_modules/${name}/LICENSE`).catch(() => { throw new Error(`Required bundled LICENSE unavailable: ${name}`); });
    if (!text.includes('Permission') || !text.includes('SOFTWARE')) throw new Error(`Incomplete bundled LICENSE: ${name}`);
    notices.push({ name: `${name} ${pkg.version} (${pkg.license})`, text });
    if (name === '@markdoc/markdoc') {
      const map = JSON.parse(await readText('node_modules/@markdoc/markdoc/dist/index.mjs.map'));
      const vendored = [...new Set(map.sources.filter(p => p.includes('node_modules/')).map(packageName))].sort();
      if (JSON.stringify(vendored) !== JSON.stringify(Object.keys(vendoredNotices).sort())) throw new Error('Unreviewed Markdoc vendored license inventory');
      for (const dependency of vendored) notices.push({ name: `${dependency} (vendored in Markdoc)`, text: vendoredNotices[dependency] });
      const grammar = map.sources.findIndex(p => p.endsWith('/grammar/tag.js'));
      if (!map.sourcesContent[grammar]?.startsWith('// Generated by PEG.js v0.11.0-master.b7b87ea')) throw new Error('Unreviewed generated parser notice');
      notices.push({ name: 'PEG.js 0.11.0-master.b7b87ea (generated parser)', text: pegNotice });
    }
  }
  const common = JSON.parse(await readText('package.json'));
  const local = [];
  for (const path of ['LICENSE', 'LICENSE.md', 'LICENSE.txt', 'COPYING', 'NOTICE']) {
    try { local.push({ name: `${common.name} — ${path}`, text: await readText(path) }); }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
  if (!local.length && common.license && common.license !== 'UNLICENSED') throw new Error('Declared common license text unavailable');
  notices.push(...local);
  if (!local.length) notices.push({ name: common.name, text: 'No repository/package redistribution license is declared. Upstream dependency licenses do not license ragbaz-common or the authored document; obtain the respective owners’ permission for redistribution.' });
  return notices;
}

/** No network by default. Local snapshots mapping: { sourceId: "local/path.md" }. */
export async function buildStandalone({ input, output, config: configPath, snapshots: mappingPath, fetchSources = false } = {}) {
  if (!input) throw new Error('An input Markdown path is required');
  const sourceBytes = await bytes(input);
  const source = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(sourceBytes);
  const config = JSON.parse(await readFile(configPath || resolve(root, 'demo/markdoc-ragbaz/registry.json'), 'utf8'));
  if (config.version !== 'ragbaz.surface/1' || config.skeleton !== 'paper/1' || config.implementation !== 'markdoc-ragbaz/1') throw new Error('Unsupported surface tuple (installed: paper/1 + markdoc-ragbaz/1)');
  if (config.metaDocument && (!['markdoc-ragbaz-sci-tufte', 'heartfulness', ...Object.keys(AETHER_VARIANTS)].includes(config.metaDocument.id) || config.metaDocument.version !== 1)) throw new Error('Unsupported meta-document host configuration');
  if (config.fontAlternatives && (config.fontAlternatives !== 'google-curated/1' || !config.metaDocument)) throw new Error('Unsupported host font alternatives');
  const connect = (config.policy?.origins || []).map(origin => {
    const url = new URL(origin);
    if (url.protocol !== 'https:' || url.origin !== origin || url.username || url.password) throw new Error('Host policy requires exact HTTPS origins');
    return url.origin;
  }).concat(['https://api.github.com', 'https://export.arxiv.org']).join(' ');
  const registry = { dialects: { ...BUILTIN_REGISTRY.dialects, ...config.dialects }, themes: { ...BUILTIN_REGISTRY.themes, ...config.themes } };
  // Remote registries also require explicit build network authorization.
  const fetcher = fetchSources ? globalThis.fetch : () => { throw new Error('Build network disabled (use --fetch-sources explicitly)'); };
  const result = await renderDocument(source, { registry, defaults: config.defaults, policy: config.policy, fetcher });
  // Freeze every required remote declarative resource into the standalone file.
  // Opening the embedded document must not depend on a network/cache hit.
  config.dialects = { ...config.dialects, ...result.resolvedRegistry.dialects };
  config.themes = { ...config.themes, ...result.resolvedRegistry.themes };
  const snapshots = {};
  const mapping = mappingPath ? JSON.parse(await readFile(mappingPath, 'utf8')) : {};
  if (result.manifest.sources.length > LIMITS.resources && (mappingPath || fetchSources)) throw new Error('Source snapshot budget exceeded');
  let total = 0;
  for (const entry of result.manifest.sources) {
    let loaded;
    if (Object.prototype.hasOwnProperty.call(mapping, entry.id)) {
      const data = await bytes(resolve(dirname(mappingPath), mapping[entry.id]));
      loaded = { ...(await verifyResourceBytes(data, entry, { purpose: 'inert-inspector' })), url: entry.url || null };
    } else if (fetchSources && entry.url) {
      loaded = await fetchResource(entry.url, { policy: config.policy, pinned: true, digest: entry.sha256, integrity: entry.integrity, purpose: 'inert-inspector' });
    }
    if (loaded) {
      total += new TextEncoder().encode(loaded.text).length;
      if (total > 4 * LIMITS.bytes) throw new Error('Aggregate snapshot budget exceeded');
      snapshots[entry.id] = loaded;
    }
  }
  const bundle = await build({ entryPoints: [resolve(root, 'demo/markdoc-ragbaz/browser.js')], bundle: true, write: false, metafile: true, format: 'iife', platform: 'browser', target: ['es2022'], minify: true, legalComments: 'inline' });
  const notices = await collectBundleNotices(bundle.metafile);
  const credits = notices.map(n => `${n.name}\n\n${n.text}`).join('\n\n────────────────────────────────────────\n\n');
  const runtime = bundle.outputFiles[0].text;
  const digest = await sha256(sourceBytes);
  const runtimeSHA256 = await sha256(new TextEncoder().encode(runtime));
  const skeleton = await readFile(resolve(root, 'demo/markdoc-ragbaz/skeleton.html'), 'utf8');
  let styles = await readFile(resolve(root, 'demo/markdoc-ragbaz/styles.css'), 'utf8');
  if (config.metaDocument?.id === 'heartfulness') styles += '\n' + await readFile(resolve(root, 'demo/markdoc-ragbaz/heartfulness.css'), 'utf8');
  if (AETHER_VARIANTS[config.metaDocument?.id]) styles += '\n' + await readFile(resolve(root, 'demo/markdoc-ragbaz/aether.css'), 'utf8');
  if (config.fontAlternatives === 'google-curated/1') styles += themeFontStyles(config.metaDocument.id);
  const hashText = text => sha256(new TextEncoder().encode(text));
  const tuple = { schema: 'ragbaz.render/1', sourceSHA256: digest, skeleton: { id: config.skeleton, sha256: await hashText(skeleton) }, implementation: { id: config.implementation, sha256: runtimeSHA256, markdoc: '0.5.10' }, stylesSHA256: await hashText(styles), assets: result.manifest.assets, settings: result.manifest.settings, defaults: config.defaults || {}, policy: config.policy || {}, registry: { dialects: config.dialects, themes: config.themes }, snapshots: Object.fromEntries(Object.entries(snapshots).map(([id, s]) => [id, s.sha256])) };
  tuple.noticesSHA256 = await hashText(credits);
  tuple.surface = { metaDocument: config.metaDocument || null, contractSource: config.contractSource || 'rendering-contract', fontAlternatives: config.fontAlternatives || null };
  const payload = { source, sha256: digest, runtimeSHA256, renderSHA256: await hashText(canonical(tuple)), tuple, config, snapshots };
  const values = {
    TEMPLATE: config.metaDocument?.id || 'markdoc-ragbaz-sci-tufte',
    FONTSTYLE: config.fontAlternatives ? ' https://fonts.googleapis.com' : '',
    FONTS: config.fontAlternatives ? 'https://fonts.gstatic.com' : "'none'",
    TITLE: escapeHTML(result.manifest.document.title || result.manifest.title || result.headings[0]?.text || 'Document'),
    CONNECT: escapeHTML(connect),
    STYLES: styles,
    CREDITS: escapeHTML(credits),
    TOC: result.headings.map(h => `<a data-level="${h.level}" href="#${h.id}">${escapeHTML(h.text)}</a>`).join(''),
    PAPER: result.html,
    PROVENANCE: escapeHTML(`Embedded snapshot · SHA-256 ${digest} · ${config.implementation} / ${config.skeleton}${result.diagnostics.length ? ' · Partial / refused: ' + result.diagnostics.join('; ') : ''}`),
    PAYLOAD: jsonScript(payload),
    RUNTIME: runtime.replace(/<\/script/gi, '<\\/script'),
  };
  const html = skeleton.replace(/@@([A-Z]+)@@/g, (_, key) => values[key]);
  if (output) { await mkdir(dirname(resolve(output)), { recursive: true }); await writeFile(output, html); }
  return { html, result, payload, assets: { runtime, styles, credits } };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2); const options = {};
  for (let i = 0; i < args.length; i++) {
    const key = { '--input': 'input', '--output': 'output', '--config': 'config', '--snapshots': 'snapshots' }[args[i]];
    if (key) { if (!args[i + 1]) throw new Error(`Missing value for ${args[i]}`); options[key] = args[++i]; }
    else if (args[i] === '--fetch-sources') options.fetchSources = true;
    else throw new Error(`Unknown argument: ${args[i]}`);
  }
  options.input ??= 'reports/Fleet ledger witness architecture.md';
  options.output ??= options.input.replace(/\.(?:md|markdown)$/i, '') + '.html';
  const { result } = await buildStandalone(options);
  console.log(`Built ${options.output}; ${result.diagnostics.length} diagnostic(s).`);
}
