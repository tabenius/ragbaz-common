import test from 'node:test';
import assert from 'node:assert/strict';
import { bibliographyData, bibliographyHTML, citationKey, manuscriptState } from '../demo/markdoc-ragbaz/citations.js';

test('bibliography derives revision identity without inventing author, date or verification', () => {
  const b = bibliographyData({ title: 'Contract', url: `https://github.com/Owner/Repo/blob/${'a'.repeat(40)}/docs/contract.md` });
  assert.equal(b.authors, 'Owner/Repo'); assert.equal(b.year, '');
  assert.equal(b.locator, 'docs/contract.md');
  assert.equal(b.coverage, 'Revision reference only');
  assert.equal(b.version, `Commit ${'a'.repeat(7)}…aaa`);
  assert.equal(citationKey('javascript:alert(1)'), null);
  assert.equal(citationKey('https://github.com/Owner/Repo/blob/main/a#x'), 'https://github.com/owner/repo/blob/main/a');
});

test('bibliographic atoms escape authored fields and reject executable links', () => {
  const html = bibliographyHTML({ id: '"><script>', declared: true, source: { title: '<script>bad</script>', url: 'javascript:alert(1)', bibliography: { authors: ['<img>'], year: '2026' } } });
  assert(!html.includes('<script>')); assert(!html.includes('<img>'));
  assert(!html.includes('href="javascript:')); assert(html.includes('&lt;script&gt;'));
});

test('publication requires explicit paired review signals and a real date', () => {
  const manuscript = { received: '2026-10-15', published: '2026-10-21', review: 'complete' };
  assert.equal(manuscriptState({ manuscript }).published, '');
  manuscript.signals = { human: true, assistant: true };
  assert.equal(manuscriptState({ manuscript }).published, 'October 21, 2026');
  manuscript.signals.human = false;
  assert(manuscriptState({ manuscript }).label.endsWith('Publication pending'));
  manuscript.received = '2026-02-31';
  assert.equal(manuscriptState({ manuscript }).received, '');
});

test('GitHub commit provenance is classified, abbreviated and linked, not called a content digest', () => {
  const url = `https://github.com/owner/repo/commit/${'f'.repeat(40)}`;
  const b = bibliographyData({ title: 'Storage adapter', url });
  assert.equal(b.version, 'Commit fffffff…fff'); assert.equal(b.commitURL, url);
  assert.equal(b.coverage, 'Revision reference only');
  const html = bibliographyHTML({ id: 'adapter', source: { title: 'Storage adapter', url, bibliography: { description: 'Records stored through SQLite.' } } });
  assert(html.includes('Records stored through SQLite.')); assert(html.includes(`href="${url}"`));
});

test('editorial introduction notes escape descriptions and classified provenance', () => {
  const html = bibliographyHTML({ entity: true, source: { title: 'Project', description: '<img onerror=bad>', url: 'javascript:bad', provenance: [{ label: 'Git commit', value: '<script>bad' }] } });
  assert(html.includes('&lt;img')); assert(!html.includes('<img'));
  assert(html.includes('Git commit')); assert(!html.includes('<script>')); assert(!html.includes('javascript:'));
});
