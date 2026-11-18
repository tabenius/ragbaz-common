import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { build } from 'esbuild';
import { prepareStandaloneAssets } from '../scripts/build-markdoc-ragbaz.mjs';
import { buildStandaloneBytes } from '../demo/markdoc-ragbaz/standalone.js';
import { buildMetaDocument } from '../scripts/build-markdoc-ragbaz-sci-tufte.mjs';

const fixture = '# Portable fixture\n\nExact **åäö** words.\n\n| A | B |\n|---|---|\n| 1 | 2 |\n\n<script>window.INJECTED=true</script>\n';
// Frozen after the deliberate 2026-10-26 Chart.js/Cytoscape.js adapter and
// scientific-identifier links and reading-copy reconciliation. Earlier equivalence was
// checked against 0fdff6e before the SVG work.
const expected = {
  'markdoc-ragbaz-sci-tufte': 'c3e269594d2e81516ffd7659cab9edb52eece6e4f30b8028f0a15ff7ae3152bf',
  heartfulness: '9fd4e17edf94ca0bbbc3a46a009ea880c9fbb25f57196ed821852e7105ca8c75',
  'aether-prima-materia': 'f22cc5372a365126dd0661414b235096d5d4ec40320d77bf503decc5b06c022b',
  'aether-sun-and-moon': 'a0d5c4c85600dd009c32f32fa3e7f3f016900e110ce89d2862c651ec17fc7874',
  'aether-blackening': 'dad4b6bc5d266e0c9fde1c580d57f4f75d14d5aa5edb1449320d36c7b54a7510',
};
const base = JSON.parse(await readFile(new URL('../demo/markdoc-ragbaz/registry.json', import.meta.url), 'utf8'));

test('prepared renderer matches frozen outputs and browser-bundled execution in all five themes', async () => {
  const assets = await prepareStandaloneAssets();
  const bundle = await build({ entryPoints: [new URL('../demo/markdoc-ragbaz/standalone.js', import.meta.url).pathname], bundle: true, write: false, metafile: true, format: 'esm', platform: 'browser', target: ['es2022'], minify: true, legalComments: 'inline' });
  assert(!Object.keys(bundle.metafile.inputs).some(path => /node_modules\/(?:@esbuild|esbuild)\//.test(path)));
  const workerModule = await import('data:text/javascript;base64,' + Buffer.from(bundle.outputFiles[0].text).toString('base64'));
  const mismatches = [];
  for (const [id, hash] of Object.entries(expected)) {
    const config = { ...base, metaDocument: { id, version: 1 }, policy: { ...base.policy, origins: [] } };
    const options = { sourceBytes: new TextEncoder().encode(fixture), config, assets };
    const result = await buildStandaloneBytes(options), portable = await workerModule.buildStandaloneBytes(options);
    const actualHash = createHash('sha256').update(result.html).digest('hex');
    if (actualHash !== hash) mismatches.push({ id, expected: hash, actual: actualHash });
    assert.equal(portable.html, result.html);
    assert.equal(result.payload.source, fixture);
    assert(!result.html.includes('<script>window.INJECTED=true</script>'));
    assert(!config.dialects?.['injected-registry']);
  }
  assert.deepEqual(mismatches, [], 'Frozen portable snapshots changed; review each template before accepting');
});
test('portable boundary refuses malformed bytes, host tuples and unprepared assets', async () => {
  const assets = await prepareStandaloneAssets();
  const options = { sourceBytes: new TextEncoder().encode('# Safe'), config: base, assets };
  await assert.rejects(buildStandaloneBytes({ ...options, sourceBytes: new Uint8Array([255]) }));
  await assert.rejects(buildStandaloneBytes({ ...options, sourceBytes: new Uint8Array(1_000_001) }), /byte limit/);
  await assert.rejects(buildStandaloneBytes({ ...options, assets: {} }), /prepared/);
  await assert.rejects(buildStandaloneBytes({ ...options, config: { ...base, skeleton: 'authored-code' } }), /surface tuple/);
  await assert.rejects(buildStandaloneBytes({ ...options, config: { ...base, policy: { origins: ['http://evil.example'] } } }), /HTTPS origins/);
});
test('packaged surfaces accept only explicit trusted host network policy without changing defaults', async t => {
  const directory = await mkdtemp(join(process.env.RAGBAZ_TEST_TMP || tmpdir(), 'portable-meta-policy-'));
  t.after(() => rm(directory, {recursive:true}));
  const policy = {origins:[],timeout:8000};
  const built = await buildMetaDocument({output:directory,template:'heartfulness',policy});
  assert.deepEqual(built.built.payload.config.policy,policy);
  assert.deepEqual(base.policy.origins,['https://raw.githubusercontent.com']);
  await assert.rejects(buildMetaDocument({output:directory,policy:{origins:['http://evil.example']}}),/HTTPS origins/);
});
