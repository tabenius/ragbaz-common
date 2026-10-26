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
// Frozen after the deliberate 2026-10-26 Chart.js/Cytoscape.js adapter addition.
// Earlier extraction equivalence was checked against 0fdff6e before the SVG work.
const expected = {
  'markdoc-ragbaz-sci-tufte': '6feeace2d2781024a0d6706c9cb988d188529df1220c8c153ca94a9ae9b27ea6',
  heartfulness: '64234b4310aa91e681c25caef4fd9819e2c012e4b9b2ad61f08e4a2b8c26f4b8',
  'aether-prima-materia': '9922a09ac3b3ad1ea05227839e949177adcec6c3e69618f92cf5cc6514f7dd35',
  'aether-sun-and-moon': 'f67c0e83dfa26a03203f3e4e523ecdf3736d66bb5859a938d7423111969d2264',
  'aether-blackening': 'ebeb38d9bf109c62e8127ea16ee472ce00443ff5c5ee9854739c97d683b57b0a',
};
const base = JSON.parse(await readFile(new URL('../demo/markdoc-ragbaz/registry.json', import.meta.url), 'utf8'));

test('prepared renderer matches frozen outputs and browser-bundled execution in all five themes', async () => {
  const assets = await prepareStandaloneAssets();
  const bundle = await build({ entryPoints: [new URL('../demo/markdoc-ragbaz/standalone.js', import.meta.url).pathname], bundle: true, write: false, metafile: true, format: 'esm', platform: 'browser', target: ['es2022'], minify: true, legalComments: 'inline' });
  assert(!Object.keys(bundle.metafile.inputs).some(path => /node_modules\/(?:@esbuild|esbuild)\//.test(path)));
  const workerModule = await import('data:text/javascript;base64,' + Buffer.from(bundle.outputFiles[0].text).toString('base64'));
  for (const [id, hash] of Object.entries(expected)) {
    const config = { ...base, metaDocument: { id, version: 1 }, policy: { ...base.policy, origins: [] } };
    const options = { sourceBytes: new TextEncoder().encode(fixture), config, assets };
    const result = await buildStandaloneBytes(options), portable = await workerModule.buildStandaloneBytes(options);
    assert.equal(createHash('sha256').update(result.html).digest('hex'), hash);
    assert.equal(portable.html, result.html);
    assert.equal(result.payload.source, fixture);
    assert(!result.html.includes('<script>window.INJECTED=true</script>'));
    assert(!config.dialects?.['injected-registry']);
  }
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
