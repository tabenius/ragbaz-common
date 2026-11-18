import test from 'node:test';
import assert from 'node:assert/strict';
import { renderDocument } from '../src/content/markdoc-ragbaz.js';

const doc = (body, sources = []) => `---\nschema: ragbaz.document/1\ndocument: {title: T}\ndialects: [paper@1, report@1]\nsources: ${JSON.stringify(sources)}\n---\n\n${body}\n`;

test('status tags render known kinds and refuse others', async () => {
  const ok = await renderDocument(doc('Ready {% status kind="built" /%} and {% status kind="planned" title="next year" /%}.'));
  assert.equal(ok.clean, true, ok.diagnostics.join('; '));
  assert.match(ok.html, /<span class="status-tag built">built<\/span>/);
  assert.match(ok.html, /<span class="status-tag planned">next year<\/span>/);
  const bad = await renderDocument(doc('{% status kind="shipped" /%}'));
  assert.equal(bad.clean, false);
  assert.match(bad.diagnostics.join(' '), /Unsupported status kind/);
});

test('headline numbers and fact/guess timelines', async () => {
  const r = await renderDocument(doc([
    '{% stats %}', '{% stat value="8.04%" title="Jan 2024" %}Closed ahead{% /stat %}', '{% stat value="1.70%" title="Feb 2025" /%}', '{% /stats %}',
    '{% timeline %}', '{% event when="2024" kind="fact" %}Happened.{% /event %}', '{% event when="2030" kind="guess" %}Maybe.{% /event %}', '{% /timeline %}',
  ].join('\n\n')));
  assert.equal(r.clean, true, r.diagnostics.join('; '));
  assert.match(r.html, /<div class="stats"><div class="stat"><span class="stat-value">8\.04%<\/span><span class="stat-label">Jan 2024<\/span>/);
  assert.match(r.html, /<div class="event fact"><div class="event-head"><span class="event-when">2024<\/span><span class="event-kind fact">fact<\/span>/);
  assert.match(r.html, /<div class="event guess">/);
  const bad = await renderDocument(doc('{% timeline %}{% event when="2030" kind="maybe" %}x{% /event %}{% /timeline %}'));
  assert.match(bad.diagnostics.join(' '), /Unsupported event kind/);
});

test('product notes carry name, status and a declared source', async () => {
  const sources = [{ id: 'repo', title: 'Repo', url: 'https://github.com/tabenius/sylvae' }];
  const r = await renderDocument(doc('{% product name="Sylvae" status="built" ref="repo" title="RAGBAZ can help" %}Runs skills.{% /product %}', sources));
  assert.equal(r.clean, true, r.diagnostics.join('; '));
  assert.match(r.html, /<aside class="semantic product"><div class="product-head"><strong class="block-label">RAGBAZ can help<\/strong><span class="product-name">Sylvae<\/span><span class="status-tag built">built<\/span><span class="source-reference" data-source="repo"/);
  assert.match((await renderDocument(doc('{% product name="X" ref="missing" %}y{% /product %}'))).diagnostics.join(' '), /Unknown source/);
});

test('heading anchors: stable ids, other annotations still refused', async () => {
  const r = await renderDocument(doc('## Around the model {% #around %}\n\n## Plain'));
  assert.match(r.html, /<h2 id="around">Around the model<\/h2>/);
  assert.match(r.html, /<h2 id="section-2">Plain<\/h2>/);
  await assert.rejects(() => renderDocument(doc('## Bad {% #Bad_ID %}')), /heading anchors/);
  await assert.rejects(() => renderDocument(doc('Paragraph {% .class %}')), /annotations refused/);
  assert.match((await renderDocument(doc('## A {% #same %}\n\n## B {% #same %}'))).diagnostics.join(' '), /Duplicate heading anchor/);
});

test('table cells carry their column label for stacked small screens', async () => {
  const r = await renderDocument(doc('| Layer | Open |\n| --- | --- |\n| Sandbox | Containers |'));
  assert.match(r.html, /<td data-label="Layer">Sandbox<\/td><td data-label="Open">Containers<\/td>/);
});

test('host linkTarget opens external links in the top window, not anchors', async () => {
  const body = '[ext](https://ragbaz.cc/) and [here](#x)';
  const top = await renderDocument(doc(body), { linkTarget: '_top' });
  assert.match(top.html, /href="https:\/\/ragbaz\.cc\/" rel="noreferrer noopener" target="_top"/);
  assert.match(top.html, /href="#x" rel="noreferrer noopener">/);
  assert.doesNotMatch((await renderDocument(doc(body))).html, /target=/);
});

test('source publication and retrieval dates are validated', async () => {
  const good = await renderDocument(doc('x', [{ id: 's', title: 'S', url: 'https://example.org/', published: '2024-11-27', retrieved: '2026-11-18' }, { id: 't', title: 'T', url: 'https://example.org/t', published: 'n.d.' }]));
  assert.equal(good.manifest.sources[0].published, '2024-11-27');
  await assert.rejects(() => renderDocument(doc('x', [{ id: 's', title: 'S', url: 'https://example.org/', retrieved: '18 Nov 2026' }])), /retrieved must be/);
  await assert.rejects(() => renderDocument(doc('x', [{ id: 's', title: 'S', url: 'https://example.org/', published: '2024-13' }])), /published must be/);
});
