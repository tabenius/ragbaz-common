#!/usr/bin/env node
import { readFile, writeFile, mkdir, realpath, stat } from 'node:fs/promises';
import { resolve, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import { LIMITS, fetchResource, verifyResourceBytes, sha256 } from '../src/content/markdoc-ragbaz.js';
import { buildStandaloneBytes } from '../demo/markdoc-ragbaz/standalone.js';
export { buildStandaloneBytes } from '../demo/markdoc-ragbaz/standalone.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const bytes = async path => {
  const data = await readFile(path);
  if (data.length > LIMITS.bytes) throw new Error(`File exceeds byte limit: ${path}`);
  return data;
};
const canonicalPath = async path => {
  try { return await realpath(path); }
  catch (error) {
    if (error.code !== 'ENOENT') throw error;
    return resolve(await canonicalPath(dirname(path)), basename(path));
  }
};

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
  const versions = {
    '@markdoc/markdoc': '0.5.10', '@kurkle/color': '0.3.4', 'chart.js': '4.6.1',
    cytoscape: '3.34.4', yaml: '2.9.1', three: '0.180.0',
  };
  const licenseFiles = { 'chart.js': 'LICENSE.md', '@kurkle/color': 'LICENSE.md', cytoscape: 'LICENSE' };
  for (const name of packages) {
    if (!Object.hasOwn(versions, name)) throw new Error(`Unreviewed bundled license: ${name}`);
    const pkg = JSON.parse(await readText(`node_modules/${name}/package.json`));
    if (pkg.version !== versions[name]) throw new Error(`Unreviewed bundled license version: ${name}`);
    const licensePath = licenseFiles[name] || 'LICENSE';
    const text = await readText(`node_modules/${name}/${licensePath}`).catch(() => { throw new Error(`Required bundled LICENSE unavailable: ${name}`); });
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

/** Build-time only. License/inventory gates stay here, never in a request handler. */
export async function prepareStandaloneAssets() {
  const bundle = await build({ entryPoints: [resolve(root, 'demo/markdoc-ragbaz/browser.js')], bundle: true, write: false, metafile: true, format: 'iife', platform: 'browser', target: ['es2022'], minify: true, legalComments: 'inline', tsconfigRaw: {} });
  const notices = await collectBundleNotices(bundle.metafile);
  const credits = notices.map(n => `${n.name}\n\n${n.text}`).join('\n\n────────────────────────────────────────\n\n');
  return { schema: 'ragbaz.standalone-assets/1', runtime: bundle.outputFiles[0].text, credits,
    skeleton: await readFile(resolve(root, 'demo/markdoc-ragbaz/skeleton.html'), 'utf8'),
    baseStyles: await readFile(resolve(root, 'demo/markdoc-ragbaz/styles.css'), 'utf8'),
    heartfulnessStyles: await readFile(resolve(root, 'demo/markdoc-ragbaz/heartfulness.css'), 'utf8'),
    aetherStyles: await readFile(resolve(root, 'demo/markdoc-ragbaz/aether.css'), 'utf8') };
}

/** No network by default. Local snapshots mapping: { sourceId: "local/path.md" }. */
export async function buildStandalone({ input, output, config: configPath, snapshots: mappingPath, fetchSources = false, preparedAssets, strict = false, report: reportPath } = {}) {
  if (!input) throw new Error('An input Markdown path is required');
  configPath ||= resolve(root, 'demo/markdoc-ragbaz/registry.json');
  // Refuse accidental replacement of source/config or aliasing report and HTML.
  // Compare both canonical paths and existing inodes (symlinks and hard links).
  const paths = await Promise.all([input, configPath, mappingPath, output, reportPath].map(async path => {
    if (!path) return null;
    const absolute = resolve(path);
    const canonical = await canonicalPath(absolute);
    const info = await stat(absolute).catch(error => { if (error.code !== 'ENOENT') throw error; return null; });
    return { canonical, info };
  }));
  for (const index of [3, 4]) {
    if (!paths[index]) continue;
    for (let other = 0; other < index; other++) {
      const a = paths[index], b = paths[other];
      if (b && (a.canonical === b.canonical || (a.info && b.info && a.info.dev === b.info.dev && a.info.ino === b.info.ino))) throw Error('Build output paths must not overwrite inputs or each other');
    }
  }
  const sourceBytes = await bytes(input);
  const config = JSON.parse(await readFile(configPath, 'utf8'));
  const mapping = mappingPath ? JSON.parse(await readFile(mappingPath, 'utf8')) : {};
  const fetcher = fetchSources ? globalThis.fetch : () => { throw new Error('Build network disabled (use --fetch-sources explicitly)'); };
  const loadSnapshot = mappingPath || fetchSources ? async entry => {
    if (Object.prototype.hasOwnProperty.call(mapping, entry.id)) {
      const data = await bytes(resolve(dirname(mappingPath), mapping[entry.id]));
      return { ...(await verifyResourceBytes(data, entry, { purpose: 'inert-inspector' })), url: entry.url || null };
    }
    if (fetchSources && entry.url) return fetchResource(entry.url, { policy: config.policy, pinned: true, digest: entry.sha256, integrity: entry.integrity, purpose: 'inert-inspector' });
  } : undefined;
  const built = await buildStandaloneBytes({ sourceBytes, config, assets: preparedAssets || await prepareStandaloneAssets(), fetcher, loadSnapshot });
  const htmlBytes = new TextEncoder().encode(built.html);
  const report = {
    schema: 'ragbaz.build-report/1',
    clean: built.result.clean,
    diagnostics: built.result.diagnostics,
    sourceSHA256: built.payload.sha256,
    renderSHA256: built.payload.renderSHA256,
    runtimeSHA256: built.payload.runtimeSHA256,
    html: { sha256: await sha256(htmlBytes), bytes: htmlBytes.length },
    headings: built.result.headings,
    usedDialects: built.result.usedDialects,
  };
  if (reportPath) { await mkdir(dirname(resolve(reportPath)), { recursive: true }); await writeFile(reportPath, JSON.stringify(report, null, 2) + '\n'); }
  if (strict && !report.clean) {
    const error = new Error(`Strict build refused: ${report.diagnostics.join('; ')}`);
    error.name = 'BuildValidationError';
    error.report = report;
    throw error;
  }
  if (output) { await mkdir(dirname(resolve(output)), { recursive: true }); await writeFile(output, built.html); }
  return { ...built, report };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2); const options = {};
  for (let i = 0; i < args.length; i++) {
    const key = { '--input': 'input', '--output': 'output', '--config': 'config', '--snapshots': 'snapshots', '--report': 'report' }[args[i]];
    if (key) { if (!args[i + 1] || args[i + 1].startsWith('--')) throw new Error(`Missing value for ${args[i]}`); options[key] = args[++i]; }
    else if (args[i] === '--fetch-sources') options.fetchSources = true;
    else if (args[i] === '--strict') options.strict = true;
    else throw new Error(`Unknown argument: ${args[i]}`);
  }
  options.input ??= 'reports/Fleet ledger witness architecture.md';
  options.output ??= options.input.replace(/\.(?:md|markdown)$/i, '') + '.html';
  const { result } = await buildStandalone(options);
  console.log(`Built ${options.output}; ${result.diagnostics.length} diagnostic(s).`);
}
