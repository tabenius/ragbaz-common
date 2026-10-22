import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdtemp, rm, symlink, link, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { buildStandalone, prepareStandaloneAssets } from '../scripts/build-markdoc-ragbaz.mjs';

const preparedAssets = await prepareStandaloneAssets();
const script = new URL('../scripts/build-markdoc-ragbaz.mjs', import.meta.url);
const clean = '# Plan\n\n{% callout title="Boundary" %}\nA proposed design, not an observation.\n{% /callout %}\n';
const refused = '# Plan\n\n{% source ref="missing" /%}\n';
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
async function fixture(t, source = clean) {
  const directory = await mkdtemp(join(process.env.RAGBAZ_TEST_TMP || tmpdir(), 'markdoc-generator-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const input = join(directory, 'plan.md'), output = join(directory, 'plan.html'), report = join(directory, 'build.json');
  await writeFile(input, source);
  return { input, output, report, preparedAssets };
}

test('strict generation writes deterministic reports bound to exact UTF-8 output bytes', async t => {
  const options = await fixture(t, clean + '\nÅäö — plan.\n');
  const first = await buildStandalone({ ...options, strict: true });
  const reportBytes = await readFile(options.report, 'utf8');
  const report = JSON.parse(reportBytes), html = await readFile(options.output);
  assert.equal(report.schema, 'ragbaz.build-report/1');
  assert.equal(report.clean, true);
  assert.deepEqual(report.diagnostics, []);
  assert.equal(report.sourceSHA256, hash(await readFile(options.input)));
  assert.equal(report.html.sha256, hash(html));
  assert.equal(report.html.bytes, html.length);
  assert.equal(report.renderSHA256, first.payload.renderSHA256);
  assert.equal(report.runtimeSHA256, first.payload.runtimeSHA256);
  assert.equal(report.headings[0].text, 'Plan');
  assert(report.usedDialects.includes('paper@1'));
  await buildStandalone({ ...options, strict: true });
  assert.equal(await readFile(options.report, 'utf8'), reportBytes);
  assert.equal(await readFile(options.output, 'utf8'), first.html);
});

test('strict refusal preserves existing HTML but writes diagnostics for CI inspection', async t => {
  const options = await fixture(t, refused);
  await writeFile(options.output, 'previous good artifact');
  await assert.rejects(buildStandalone({ ...options, strict: true }), error => {
    assert.equal(error.name, 'BuildValidationError');
    assert.equal(error.report.clean, false);
    assert.match(error.message, /Unknown source/);
    return true;
  });
  assert.equal(await readFile(options.output, 'utf8'), 'previous good artifact');
  assert.equal(JSON.parse(await readFile(options.report, 'utf8')).clean, false);
});

test('strict refusal creates no new HTML, and lenient rendering keeps visible refusal behavior', async t => {
  const options = await fixture(t, refused);
  await assert.rejects(buildStandalone({ ...options, strict: true }), /Strict build refused/);
  await assert.rejects(readFile(options.output), { code: 'ENOENT' });
  const built = await buildStandalone(options);
  assert.equal(built.report.clean, false);
  assert.match(built.result.html, /class="refusal"/);
  assert.equal(await readFile(options.output, 'utf8'), built.html);
});

test('invalid metadata remains a hard error, not a successful diagnostic report', async t => {
  const options = await fixture(t, '---\nschema: ragbaz.document/999\n---\n# Plan');
  await assert.rejects(buildStandalone(options), /schema/);
  await assert.rejects(readFile(options.output), { code: 'ENOENT' });
  await assert.rejects(readFile(options.report), { code: 'ENOENT' });
});

test('output path guards preserve source, config, mapping and distinct report bytes', async t => {
  const options = await fixture(t);
  const config = join(options.input, '..', 'config.json');
  await writeFile(config, '{}');
  for (const overrides of [
    { output: options.input }, { report: options.input }, { report: options.output },
    { config, output: config }, { config, report: config },
    { snapshots: config, report: config },
  ]) await assert.rejects(buildStandalone({ ...options, ...overrides }), /must not overwrite/);
  assert.equal(await readFile(options.input, 'utf8'), clean);
  assert.equal(await readFile(config, 'utf8'), '{}');
});

test('output path guards also refuse existing symlink and hard-link aliases', async t => {
  const options = await fixture(t);
  for (const [name, create] of [['symbolic', symlink], ['hard', link]]) {
    const alias = join(options.input, '..', name);
    await create(options.input, alias);
    await assert.rejects(buildStandalone({ ...options, report: alias }), /must not overwrite/);
    await assert.rejects(buildStandalone({ ...options, output: alias }), /must not overwrite/);
  }
  assert.equal(await readFile(options.input, 'utf8'), clean);
});

test('CLI strict/report flags return nonzero on refused plans without replacing HTML', async t => {
  const options = await fixture(t, refused);
  await writeFile(options.output, 'retained');
  const args = [script.pathname, '--input', options.input, '--output', options.output, '--strict', '--report', options.report];
  const failed = spawnSync(process.execPath, args, { encoding: 'utf8', timeout: 15000 });
  assert.equal(failed.status, 1, failed.stderr);
  assert.match(failed.stderr, /Strict build refused/);
  assert.equal(await readFile(options.output, 'utf8'), 'retained');
  assert.equal(JSON.parse(await readFile(options.report, 'utf8')).clean, false);
  await writeFile(options.input, clean);
  const passed = spawnSync(process.execPath, args, { encoding: 'utf8', timeout: 15000 });
  assert.equal(passed.status, 0, passed.stderr);
  assert.match(passed.stdout, /0 diagnostic/);
  assert.equal(JSON.parse(await readFile(options.report, 'utf8')).clean, true);
});

test('new output/report files cannot alias through a symlinked parent directory', async t => {
  const options = await fixture(t);
  const real = join(options.input, '..', 'real'), alias = join(options.input, '..', 'alias');
  await mkdir(real); await symlink(real, alias);
  await assert.rejects(buildStandalone({ ...options, output: join(real, 'new', 'out'), report: join(alias, 'new', 'out') }), /must not overwrite/);
  await assert.rejects(readFile(join(real, 'new', 'out')), { code: 'ENOENT' });
});

test('CLI rejects a missing option value rather than consuming another flag', () => {
  const result = spawnSync(process.execPath, [script.pathname, '--report', '--strict'], { encoding: 'utf8', timeout: 15000 });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Missing value for --report/);
});
