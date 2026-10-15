import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, rm } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { documentParameter } from '../demo/markdoc-ragbaz/loading.js';
import { buildMetaDocument, META_MOUNT } from '../scripts/build-markdoc-ragbaz-sci-tufte.mjs';
import { AETHER_VARIANTS } from '../demo/markdoc-ragbaz/aether.js';
import { temporaryDirectory } from './helpers/temp.mjs';

test('document parameter is opt-in; document and digest are data, not host policy', () => {
  const url = 'https://meta.example/template?document=starter.md&sha256=' + 'A'.repeat(64);
  assert.equal(documentParameter(url), null);
  assert.deepEqual(documentParameter(url, true), { url: 'starter.md', digest: 'a'.repeat(64) });
  assert.equal(documentParameter('file:///template.html', true), null);
});

test('empty, duplicated, overlong and malformed digest parameters are refused', () => {
  for (const query of ['document=', 'sha256=' + 'a'.repeat(64), 'document=a&document=b', 'document=a&sha256=x', 'document=a&sha256=' + 'a'.repeat(64) + '&sha256=' + 'b'.repeat(64), 'document=' + 'x'.repeat(8193), 'document=a%00b']) {
    assert.throws(() => documentParameter('https://meta.example/?' + query, true));
  }
});

test('meta package is content-neutral, offline-complete and byte-manifested', async () => {
  const output = await temporaryDirectory('markdoc-meta-build-');
  try {
    const { directory, built, manifest } = await buildMetaDocument({ output });
    assert.equal(manifest.mount, META_MOUNT);
    assert(!built.payload.source.includes('Independent witnesses'));
    assert(!built.payload.source.includes('Tobias Abenius'));
    assert.deepEqual(Object.keys(built.payload.snapshots), ['rendering-contract']);
    assert.equal(built.payload.tuple.surface.metaDocument.id, 'markdoc-ragbaz-sci-tufte');
    assert.equal(built.payload.tuple.surface.fontAlternatives, 'google-curated/1');
    assert.match(built.html, /style-src 'unsafe-inline' https:\/\/fonts.googleapis.com/);
    assert.match(built.html, /font-src https:\/\/fonts.gstatic.com/);
    assert(!built.html.includes('<link'), 'no remote font request is embedded by default');
    assert(!built.assets.styles.includes('data-template=heartfulness'), 'sci keeps its own presentation');
    for (const [file, entry] of Object.entries(manifest.files)) {
      const bytes = await readFile(join(directory, file));
      assert.equal(createHash('sha256').update(bytes).digest('hex'), entry.sha256, file);
      assert.equal(bytes.length, entry.bytes, file);
    }
    assert.equal(manifest.files['assets/reader.js'].sha256, built.payload.runtimeSHA256);
    assert.match(await readFile(join(directory, 'assets/weftmark.svg'), 'utf8'), /<svg.*role="img"/);
    assert.match(await readFile(join(directory, 'LICENSES.txt'), 'utf8'), /Permission is hereby granted/);
  } finally { await rm(output, { recursive: true, force: true }); }
});

test('Heartfulness is an installed independent presentation with original manifested botanicals', async () => {
  const output = await temporaryDirectory('heartfulness-build-test-');
  try {
    const { directory, manifest, built } = await buildMetaDocument({ output, template: 'heartfulness' });
    assert.equal(manifest.id, 'heartfulness'); assert.equal(manifest.mount, '/heartfulness');
    assert.equal(built.payload.tuple.surface.metaDocument.id, 'heartfulness');
    assert.match(built.html, /data-template="heartfulness"/);
    assert.match(built.payload.source, /# Heartfulness/);
    assert.match(built.payload.source, /A place to begin/);
    assert(!built.payload.source.includes('/markdoc-ragbaz-sci-tufte/'));
    assert(!built.payload.source.includes('Tobias Abenius'));
    assert.deepEqual(Object.keys(built.payload.snapshots), ['rendering-contract']);
    for (const [file, entry] of Object.entries(manifest.files)) {
      const bytes = await readFile(join(directory, file));
      assert.equal(createHash('sha256').update(bytes).digest('hex'), entry.sha256, file);
      assert.equal(bytes.length, entry.bytes, file);
    }
    for (const name of ['climbing-rose', 'rose-divider']) {
      const svg = await readFile(join(directory, `assets/${name}.svg`), 'utf8');
      assert.match(svg, /<svg.*role="img"/); assert(!/<script|href=|<foreignObject/i.test(svg));
    }
    assert.match(built.assets.styles, /heart-paper|heart-grain/);
    await assert.rejects(buildMetaDocument({ output, template: '../untrusted' }), /Unsupported installed/);
  } finally { await rm(output, { recursive: true, force: true }); }
});

test('Aether variants have distinct specimens, tuple identities and manifested original plates', async () => {
  const output = await temporaryDirectory('aether-build-test-');
  try {
    const identities = new Set();
    for (const [template, variant] of Object.entries(AETHER_VARIANTS)) {
      const { built, manifest, directory } = await buildMetaDocument({ output, template });
      assert.equal(manifest.mount, '/aether/' + variant.slug);
      assert.equal(built.payload.tuple.surface.metaDocument.id, template);
      assert.match(built.payload.source, new RegExp('# ' + variant.title));
      assert(!built.payload.source.includes('Tobias Abenius'));
      assert.deepEqual(Object.keys(built.payload.snapshots), ['rendering-contract']);
      identities.add(built.payload.renderSHA256);
      for (const [file, entry] of Object.entries(manifest.files)) {
        const bytes = await readFile(join(directory, file));
        assert.equal(createHash('sha256').update(bytes).digest('hex'), entry.sha256, file);
        assert.equal(bytes.length, entry.bytes, file);
      }
      const svg = await readFile(join(directory, 'assets/symbolic-plate.svg'), 'utf8');
      assert.match(svg, /role="img" aria-label=/); assert.match(svg, /Original contemporary symbolic/);
      assert(!/<script|href=|<foreignObject/i.test(svg));
      assert(built.assets.styles.includes('data-template^=aether-'));
      assert(!built.assets.styles.includes('data-template=heartfulness'));
    }
    assert.equal(identities.size, 3);
  } finally { await rm(output, { recursive: true, force: true }); }
});
