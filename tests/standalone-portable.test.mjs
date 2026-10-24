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
// Frozen after the deliberate 2026-10-22 document-checks UI/runtime change.
// Earlier extraction equivalence was checked against 0fdff6e before that change.
const expected = {
  'markdoc-ragbaz-sci-tufte': 'd81936a146d4812026a4d65e8f737e13fec55640fdadd3ce55db6cae23c5d3d0',
  heartfulness: 'dd2713ddc8f4d9ac782db463c2fc089ceb292272731f5dbf6052ce7e22760e64',
  'aether-prima-materia': 'f9f4705c4b9a328d4215b3177cffb4346770df25ad5f29f403438c4a5141985e',
  'aether-sun-and-moon': 'a46f63aa5943db74bfcfb48838c38583c5e2931f678b9a991b2789a566501f07',
  'aether-blackening': '243fbd30f3c12534b14ace61479b5cc40577d1905dab0e72c64ae3e542a45d6b',
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
