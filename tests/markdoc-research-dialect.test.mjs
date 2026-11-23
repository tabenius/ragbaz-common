import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import jsQR from 'jsqr';
import { renderDocument, cidFromSHA256, publicationIdentifiers, identifierResolvers, evidenceGrade, evidenceScale, linkScientificIdentifiers, contentAdvisory, validISBN, validISSN, validORCID, EVIDENCE_SCALE, sha256 } from '../src/content/markdoc-ragbaz.js';
import { parseVisualization, visualizationGraphic, serializeVisualizationGraphic } from '../src/content/visualizations.js';
import { qrMatrix } from '../demo/markdoc-ragbaz/qr.js';
import { hostLogo } from '../demo/markdoc-ragbaz/publication.js';
import { buildStandaloneBytes } from '../demo/markdoc-ragbaz/standalone.js';
import { prepareStandaloneAssets, hostLogoDescriptor } from '../scripts/build-markdoc-ragbaz.mjs';
import { temporaryDirectory } from './helpers/temp.mjs';

const resolvers = JSON.parse(await readFile(new URL('../demo/markdoc-ragbaz/registry.json', import.meta.url), 'utf8')).identifierResolvers;
const support = { label: 'Find A Helpline', topics: { 'intimate-partner-violence': 'https://findahelpline.com/topics/abuse-domestic-violence' } };
const doc = body => `---\ndialects: [paper@1, models@1, text@1, support@1]\n---\n${body}\n`;

test('notes, language spans and new callout kinds render through the safe tree', async () => {
  const r = await renderDocument(doc('A claim{% note %}With **detail** and DOI:10.1000/x.{% /note %} in {% lang code="sv" %}psykiskt våld{% /lang %}.\n\n{% callout kind="contested" title="T" %}x{% /callout %}\n\n{% callout kind="correction" title="C" %}y{% /callout %}'));
  assert.deepEqual(r.diagnostics, []);
  assert.match(r.html, /<span class="author-note">With <strong>detail<\/strong> and <a href="https:\/\/doi.org\/10.1000\/x"/);
  assert.match(r.html, /<span class="lang" lang="sv">psykiskt våld<\/span>/);
  assert.match(r.html, /contested \(authored claim\)/);
  assert.match(r.html, /class="semantic callout correction"/);
  assert.doesNotMatch(r.html, /correction \(authored claim\)/);
  const bad = await renderDocument(doc('{% lang code="sv\\" onclick=x" %}x{% /lang %}\n\n{% callout kind="gossip" %}x{% /callout %}'));
  assert(bad.diagnostics.includes('Language span requires a BCP 47 code'));
  assert(bad.diagnostics.includes('Unsupported callout kind'));
  assert.doesNotMatch(bad.html, /<[^>]*\sonclick=/); // the refusal shows escaped source text only
});

test('support links come only from the host directory and refuse visibly otherwise', async () => {
  const source = doc('{% support topic="intimate-partner-violence" /%}');
  const ok = await renderDocument(source, { supportDirectory: support });
  assert.deepEqual(ok.diagnostics, []);
  assert.match(ok.html, /href="https:\/\/findahelpline.com\/topics\/abuse-domestic-violence" rel="noreferrer noopener">Find A Helpline ↗/);
  for (const options of [{}, { supportDirectory: { label: 'X', topics: { 'intimate-partner-violence': 'javascript:alert(1)' } } }, { supportDirectory: support, unrelated: true }]) {
    const r = await renderDocument(options.unrelated ? doc('{% support topic="other-topic" /%}') : source, options);
    assert.equal(r.clean, false); assert.match(r.html, /class="refusal"/); assert.doesNotMatch(r.html, /javascript:/);
  }
});

test('records views project tabular model data and refuse malformed rows', async () => {
  const head = '---\ndialects: [models@1]\nmodels:\n  - {id: m, title: M, data: {columns: [a, b], rows: [[1, "x"], [null, true]]}}\nviews:\n  - {id: v, model: m, kind: records}\n---\n{% view ref="v" /%}\n';
  const r = await renderDocument(head);
  assert.deepEqual(r.diagnostics, []);
  assert.match(r.html, /<th>a<\/th><th>b<\/th>.*<td>1<\/td><td>x<\/td>.*<td>—<\/td><td>true<\/td>/s);
  const bad = await renderDocument(head.replace('[null, true]', '[1]'));
  assert(bad.diagnostics.includes('Records view requires at most 300 rows matching the columns'));
});

test('publication identifiers display an em dash until real values exist', () => {
  const { entries, diagnostics } = publicationIdentifiers({ identifiers: { issn: '—', uuid: '', ipfs: null, isbn: '978-0-306-40615-7', doi: 'not a doi', handle: 'x' } }, resolvers);
  assert.deepEqual(entries.map(e => [e.key, e.value, e.state]), [['issn', '—', 'unassigned'], ['isbn', '978-0-306-40615-7', 'declared'], ['doi', '—', 'refused'], ['uuid', '—', 'unassigned'], ['ipfs', '—', 'unassigned']]);
  assert.equal(entries[1].href, 'https://openlibrary.org/isbn/9780306406157');
  assert.deepEqual(diagnostics, ['Unsupported publication identifier: handle', 'Malformed DOI refused; shown as unassigned']);
  assert.equal(publicationIdentifiers({ identifiers: { issn: '0317-8471' } }, resolvers).entries[0].href, 'https://portal.issn.org/resource/ISSN/0317-8471');
  assert.equal(publicationIdentifiers({ identifiers: { issn: '0317-8471' } }).entries[0].href, null, 'no host resolver, no link');
  // Placeholder words are not DOIs: a DOI needs the 10.<registrant>/<suffix> shape.
  for (const doi of ['unassigned', 'TBD', '10.1/x', '10.1234']) assert.equal(publicationIdentifiers({ identifiers: { doi } }, resolvers).entries[0].state, 'refused', doi);
  assert.equal(publicationIdentifiers({ identifiers: { doi: '10.1038/s41583-018-0072-6' } }, resolvers).entries[0].href, 'https://doi.org/10.1038/s41583-018-0072-6');
  assert.equal(publicationIdentifiers({ identifiers: { issn: '0317-8472' } }).entries[0].state, 'refused');
  assert.equal(publicationIdentifiers({ identifiers: { uuid: 'b01d9e28-e582-49dd-a9a7-db841d58030e' } }).entries[0].state, 'declared');
});

test('checksummed and register identifiers link; invalid ones stay text', () => {
  assert(validISBN('0-306-40615-2') && validISBN('978-0-306-40615-7') && !validISBN('978-0-306-40615-8'));
  assert(validISSN('2049-3630') && !validISSN('2049-3631'));
  assert(validORCID('0000-0002-1825-0097') && !validORCID('0000-0002-1825-0098'));
  const prose = 'ISBN:978-0-306-40615-8 ISSN:2049-3630, ORCID:0000-0002-1825-0097 OSF:abc12 URN:NBN:se:uu:diva-1 URN:nbn:de:0001-2 SFS 2026:123 prop. 2025/26:138 bet. 2025/26:JuU39 CRD42019123456.';
  // Resolver origins are host configuration: without it these stay plain text.
  assert.doesNotMatch(linkScientificIdentifiers(prose), /<a /);
  const html = linkScientificIdentifiers(prose, identifierResolvers(resolvers));
  assert.doesNotMatch(html, /data-identifier="isbn"/);
  for (const kind of ['issn', 'orcid', 'osf', 'sfs', 'riksdag', 'prospero']) assert.match(html, new RegExp(`data-identifier="${kind}"`));
  assert.match(html, /href="https:\/\/urn.kb.se\/resolve\?urn=urn:nbn:se:uu:diva-1"/);
  assert.match(html, /href="https:\/\/nbn-resolving.org\/urn:nbn:de:0001-2"/);
  assert.match(html, /href="https:\/\/rkrattsbaser.gov.se\/sfst\?bet=2026:123"/);
  assert.match(html, /CRD42019123456<\/a>\.$/);
  assert.match(html, /href="https:\/\/www.riksdagen.se\/sv\/sok\/\?q=prop.%202025\/26:138"/);
  for (const bad of [{ isbn: 'http://x/{value}' }, { isbn: 'https://x/' }, { gopher: 'https://x/{value}' }, { isbn: 'https://x/{value}/{value}' }]) assert.throws(() => identifierResolvers(bad));
});

test('renderer takes resolvers from host options only and diagnoses invalid ones', async () => {
  const body = '# T\n\nSee ISSN:2049-3630.\n';
  assert.doesNotMatch((await renderDocument(body)).html, /identifier-link/);
  assert.match((await renderDocument(body, { identifierResolvers: resolvers })).html, /data-identifier="issn"/);
  const bad = await renderDocument(body, { identifierResolvers: { issn: 'javascript:{value}' } });
  assert(bad.diagnostics.some(d => d.includes('HTTPS template')));
  assert.doesNotMatch(bad.html, /javascript:/);
});

test('evidence grades are inferred from declared designs, never guessed', async () => {
  const scaled = evidenceScale();
  assert.equal(scaled.scale, EVIDENCE_SCALE);
  assert.deepEqual(evidenceGrade({ bibliography: { design: 'meta-analysis' } }), { state: 'inferred', grade: 'A', label: EVIDENCE_SCALE[0].label, design: 'meta-analysis' });
  assert.equal(evidenceGrade({ bibliography: { design: 'statute' } }).state, 'context');
  assert.equal(evidenceGrade({ bibliography: { design: 'method' } }).state, 'context');
  assert.equal(evidenceGrade({ title: 'no design' }).state, 'ungraded');
  assert.equal(evidenceGrade({ bibliography: { design: 'vibes' } }).state, 'unknown-design');
  const custom = { evidence: { scale: [{ grade: 'I', label: 'Trials', designs: ['rct'] }, { grade: 'II', label: 'Other', designs: ['cohort', 'meta-analysis'] }] } };
  assert.equal(evidenceGrade({ bibliography: { design: 'meta-analysis' } }, evidenceScale(custom)).grade, 'II');
  assert.throws(() => evidenceScale({ evidence: { scale: [{ grade: 'A', label: 'x', designs: ['statute'] }] } }), /context/);
  assert.throws(() => evidenceScale({ evidence: { scale: [{ grade: 'A', label: 'x', designs: ['rct'] }, { grade: 'B', label: 'y', designs: ['rct'] }] } }), /unique/);
  const r = await renderDocument('---\nsources:\n  - {id: a, title: A, bibliography: {design: vibes}}\n---\n# X');
  assert(r.diagnostics.includes('Unknown evidence design for source a: vibes'));
  const bad = await renderDocument('---\ndocument: {evidence: {scale: []}}\n---\n# X');
  assert(bad.diagnostics.some(d => d.startsWith('Evidence scale refused')));
});

test('content advisory is validated and rendered before the paper', async () => {
  assert.deepEqual(contentAdvisory({ advisory: { topics: ['trauma', 'trauma'] } }), { topics: ['trauma'] });
  assert.throws(() => contentAdvisory({ advisory: { topics: ['<b>'] } }));
  assert.throws(() => contentAdvisory({ advisory: { topics: ['trauma'], html: 'x' } }));
  const r = await renderDocument('---\ndocument: {advisory: {topics: [intimate-partner-violence]}}\n---\n# T');
  assert.match(r.html, /^<aside class="semantic callout advisory content-advisory">.*discusses intimate partner violence\./);
});

test('derived content CID is a pure re-encoding of SHA-256', async () => {
  assert.equal(cidFromSHA256(await sha256(new Uint8Array())), 'bafkreihdwdcefgh4dqkjv67uzcmw7ojee6xedzdetojuzjevtenxquvyku');
  assert.throws(() => cidFromSHA256('xyz'));
});

test('forest profile accepts authored intervals and refuses inconsistent ones', () => {
  const source = JSON.stringify({ scale: 'OR', studies: [{ label: 'A', estimate: 1.3, lower: 1.1, upper: 1.6, weight: 2 }, { label: 'B', estimate: 0.9, lower: 0.7, upper: 1.2 }], pooled: { label: 'Pooled', estimate: 1.1, lower: 0.95, upper: 1.3 } });
  const record = parseVisualization('forest', source, { alt: 'Forest' });
  assert.equal(record.data.null, 1);
  assert.equal(record.fallback.rows.length, 3);
  const svg = serializeVisualizationGraphic(visualizationGraphic(record, { id: 'viz-1' }));
  assert.match(svg, /logarithmic axis/); assert.match(svg, /<path d="M/);
  for (const bad of [{ scale: 'r', studies: [{ label: 'x', estimate: 0.5, lower: 0.6, upper: 0.7 }] }, { scale: 'OR', studies: [{ label: 'x', estimate: 1, lower: 0, upper: 2 }] }, { scale: 'beta', studies: [] }, { scale: 'r', studies: [{ label: 'x', estimate: 0, lower: 0, upper: 0, url: 'https://x' }] }]) {
    assert.throws(() => parseVisualization('forest', JSON.stringify(bad), { alt: 'x' }), /Visualization refused/);
  }
});

test('QR colophon encoder round-trips through an independent decoder', () => {
  for (const text of ['https://ragbaz.xyz/', 'https://example.org/' + 'a'.repeat(120), 'å'.repeat(90), 'z'.repeat(213)]) {
    const m = qrMatrix(text), scale = 3, quiet = 4, n = (m.length + 2 * quiet) * scale;
    const pixels = new Uint8ClampedArray(n * n * 4).fill(255);
    m.forEach((row, y) => row.forEach((dark, x) => { if (dark) for (let dy = 0; dy < scale; dy++) for (let dx = 0; dx < scale; dx++) { const i = (((y + quiet) * scale + dy) * n + (x + quiet) * scale + dx) * 4; pixels[i] = pixels[i + 1] = pixels[i + 2] = 0; } }));
    assert.equal(jsQR(pixels, n, n)?.data, text);
  }
  assert.throws(() => qrMatrix('x'.repeat(214)), /213 bytes/);
});

test('host publication furniture is validated at build and only widens CSP for an embedded logo', async () => {
  const assets = await prepareStandaloneAssets();
  const base = JSON.parse(await readFile(new URL('../demo/markdoc-ragbaz/registry.json', import.meta.url), 'utf8'));
  const sourceBytes = new TextEncoder().encode('# Furniture\n');
  const plain = await buildStandaloneBytes({ sourceBytes, config: base, assets });
  assert.match(plain.html, /img-src 'none'/);
  assert.equal(plain.payload.tuple.logoSHA256, undefined);
  const dir = await temporaryDirectory('markdoc-logo-');
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');
  await writeFile(join(dir, 'logo.png'), png); await writeFile(join(dir, 'logo.txt'), 'not an image');
  const logo = await hostLogoDescriptor(join(dir, 'logo.png'), 'Wordmark');
  assert.equal(logo.mime, 'image/png');
  await assert.rejects(hostLogoDescriptor(join(dir, 'logo.txt'), 'x'), /PNG, JPEG, WebP or SVG/);
  await assert.rejects(hostLogoDescriptor(join(dir, 'logo.png'), ''), /logo-alt/);
  const furnished = await buildStandaloneBytes({ sourceBytes, config: { ...base, logo, colophon: { url: 'https://ragbaz.xyz/record' } }, assets });
  assert.match(furnished.html, /img-src data:;/);
  assert.equal(furnished.payload.tuple.logoSHA256, logo.sha256);
  assert(hostLogo({ logo }));
  await assert.rejects(buildStandaloneBytes({ sourceBytes, config: { ...base, logo: { ...logo, sha256: '0'.repeat(64) } }, assets }), /digest mismatch/);
  await assert.rejects(buildStandaloneBytes({ sourceBytes, config: { ...base, colophon: { url: 'http://insecure.example' } }, assets }), /HTTPS/);
  await assert.rejects(buildStandaloneBytes({ sourceBytes, config: { ...base, supportDirectory: { label: 'x', topics: { ok: 'javascript:alert(1)' } } }, assets }), /support directory/);
});
