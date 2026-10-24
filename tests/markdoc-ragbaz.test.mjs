import test from 'node:test';
import assert from 'node:assert/strict';
import { BUILTIN_REGISTRY, LIMITS, parseDocument, renderDocument, themeCSS, githubRawURL, resourceURL, fetchResource, sha256, integrityDescriptor, verifyResourceBytes, discoverSourceProvider, checkSourceRevision, parseArxivAtom } from '../src/content/markdoc-ragbaz.js';
import { renderMarkdoc } from '../src/content/markdoc.js';

const preamble = data => `---\n${JSON.stringify(data)}\n---\n`;
const commit = 'a'.repeat(40);
const raw = `https://raw.githubusercontent.com/owner/repo/${commit}/a%20b.md`;
const policy = { origins: ['https://raw.githubusercontent.com', 'https://sources.example'] };

test('official AST renders Markdown tables, fences and exact report block attributes', async () => {
  const result = await renderDocument(preamble({ schema: 'ragbaz.document/1', document: { title: 'Paper' }, sources: [{ id: 's', title: 'Evidence', url: raw }], models: [{ id: 'm', data: { proposed: true } }], views: [{ id: 'v', model: 'm', kind: 'table' }] }) + `# Paper

| A | B |
| - | - |
| a | b |

{% callout kind="warning" title="Boundary" %}
Authored, not observed.
{% /callout %}

{% example title="Example" %}
Example content.
{% /example %}

{% aside title="Margin" %}
Aside content.
{% /aside %}

{% source ref="s" /%}

{% model ref="m" /%}

{% view ref="v" /%}

\`\`\`md
{% bogus /%}
\`\`\`
`);
  assert.equal(result.clean, true, result.diagnostics.join(';'));
  assert.match(result.html, /<table>/);
  assert.match(result.html, /Boundary · warning/);
  assert.match(result.html, /Example content/);
  assert.match(result.html, /data-source="s"/);
  assert.match(result.html, /not a runtime observation/);
  assert.match(result.html, /<pre><code/);
  assert.deepEqual(result.usedDialects, ['paper@1', 'plan@1', 'models@1']);
  assert.equal(result.headings[0].text, 'Paper');
  assert.equal(result.manifest.document.title, 'Paper');
});

test('legacy API stays unchanged', () => {
  assert.equal(renderMarkdoc('# Title').html, '<article><h1>Title</h1></article>');
});

test('YAML and JSON mapping preambles; versions, aliases, constructors, duplicates and budgets refused', () => {
  assert.equal(parseDocument('---\nschema: ragbaz.document/1\ndocument:\n  title: A paper\n---\n# Hello').manifest.document.title, 'A paper');
  for (const front of ['schema: ragbaz.document/2', '- array', 'a: !!js/function x', 'a: &a [1]\nb: *a', 'a: 1\na: 2', '__proto__: bad', 'settings:\n  style: bad', 'assets:\n - id: t\n   role: theme\n   url: https://evil.example/t.json']) {
    assert.throws(() => parseDocument(`---\n${front}\n---\n# Test`));
  }
  assert.throws(() => parseDocument('a'.repeat(LIMITS.bytes + 1)), /byte limit/);
  assert.throws(() => parseDocument(preamble({ models: [{ id: 'a' }, { id: 'a' }] })), /duplicate/);
  assert.throws(() => parseDocument(preamble({ models: [{ id: 'a', data: JSON.parse('['.repeat(52) + '1' + ']'.repeat(52)) }] })), /nesting/);
});

test('unknown, incompatible and malformed tags are visible inert refusals retaining original children', async () => {
  for (const [source, expected] of [
    ['{% mystery %}\nKeep these words\n{% /mystery %}', /Keep these words/],
    ['{% callout style="url(evil)" %}\nKeep\n{% /callout %}', /Invalid attributes/],
    ['{% callout onclick="evil" %}\nKeep\n{% /callout %}', /Invalid attributes/],
    ['{% callout %}\nNo closing', /No closing/],
    [preamble({ dialects: ['paper@2'] }) + '{% aside title="X" %}\nKeep\n{% /aside %}', /Unsupported tag/],
    ['{% source ref="missing" /%}', /Unknown source/],
    ['{% view ref="missing" /%}', /Unsupported or missing view/],
    ['{% partial file="https://evil.example/x" /%}', /Unsupported tag/],
    ['{% constructor %}\nKeep\n{% /constructor %}', /Unsupported tag: constructor/],
    ['{% toString %}\nKeep\n{% /toString %}', /Unsupported tag: toString/],
  ]) {
    const r = await renderDocument(source);
    assert.equal(r.clean, false);
    assert.match(r.html, expected);
    assert.match(r.html, /class="refusal"/);
    assert.doesNotMatch(r.html, /<[^>]+\sonclick=/);
  }
  await assert.rejects(() => renderDocument('{% $secret %}'), /Executable expressions/);
  await assert.rejects(() => renderDocument('{% callout title=$secret %}\nx\n{% /callout %}'), /Executable expressions/);
});

test('raw HTML, annotations, executable URLs and images cannot execute or cause network requests', async () => {
  const r = await renderDocument(`<script>window.evil=1</script>\n\n<img src="https://evil.example/tracker" onerror="evil()">\n\n[good](https://sources.example/read)\n\n[bad](data:text/html,evil)\n\n![track](https://evil.example/tracker)\n\n[relative](./private.md)`);
  assert.doesNotMatch(r.html, /<(script|img|iframe)\b/i);
  assert.doesNotMatch(r.html, /href="(?:data:|javascript:|\.\/)/);
  assert.doesNotMatch(r.html, /<[^>]+\sonclick=/);
  assert.match(r.html, /&lt;script&gt;/);
  assert.match(r.html, /Image unavailable/);
  assert.match(r.html, /href="https:\/\/sources.example\/read"/);
  await assert.rejects(() => renderDocument('[annotated](https://sources.example) {% onclick="evil()" %}'), /annotations refused/);
  await assert.rejects(() => renderDocument('Hidden {% .reader-tools %}'), /annotations refused/);
});

test('themes permit typed semantic tokens only', async () => {
  assert.equal(themeCSS({ paper: '#fafafa', 'text-size': 20, measure: 72 }), '--paper:#fafafa;--text-size:20px;--measure:72ch');
  for (const tokens of [{ paper: 'url(https://evil)' }, { paper: '#000000;display:none' }, { selector: 'body' }, { measure: 9999 }, { ink: '@import x' }, { font: 'remote' }]) assert.throws(() => themeCSS(tokens));
  const r = await renderDocument(preamble({ settings: { theme: 'imaginary@1' } }) + '# Paper');
  assert.match(r.diagnostics.join(';'), /Unsupported themes/);
  assert.equal(r.theme, '');
});

test('declarative remote registry loads only used pinned family, refuses scripts/templates/cycles', async () => {
  const data = { version: '1', tags: { custom: { element: 'aside', attrs: ['title'] } } };
  const json = JSON.stringify(data);
  let calls = 0;
  const registry = { dialects: { custom: { version: '1', tags: { custom: {} }, url: 'https://sources.example/custom.json', sha256: await sha256(new TextEncoder().encode(json)) } } };
  const fetcher = async () => { calls++; return new Response(json, { headers: { 'content-type': 'application/json' } }); };
  const opts = { registry, policy, fetcher };
  await renderDocument(preamble({ dialects: ['custom@1'] }) + '# No tag', opts);
  assert.equal(calls, 0);
  const result = await renderDocument(preamble({ dialects: ['custom@1'] }) + '{% custom title="Safe" %}\nBody\n{% /custom %}', opts);
  assert.equal(calls, 1); assert.match(result.html, /<aside/); assert.equal(result.clean, true);
  for (const bad of [ { version: '1', tags: { custom: { element: 'script', attrs: [] } } }, { version: '1', tags: data.tags, script: 'evil()' }, { version: '1', tags: data.tags, dependencies: ['custom@1'] } ]) {
    const r = await renderDocument(preamble({ dialects: ['custom@1'] }) + '{% custom /%}', { registry: { dialects: { custom: bad } } });
    assert.equal(r.clean, false); assert.match(r.html, /Unsupported tag/); assert.doesNotMatch(r.html, /<script/);
  }
});

test('GitHub full-SHA blob conversion preserves escaped paths; branch, ambiguous path and credentials refused', () => {
  assert.equal(githubRawURL(`https://github.com/owner/repo/blob/${commit}/a%20b.md#L1`), raw);
  for (const input of [`https://github.com/o/r/blob/main/a.md`, `https://u:p@github.com/o/r/blob/${commit}/a.md`, `https://github.com/o/r/blob/${commit}/a%2fb.md`, `https://github.com/o/r/blob/${commit}/../a.md`, `https://github.com/o/r/blob/${commit}/a.md?raw=1`]) assert.throws(() => githubRawURL(input));
  assert.equal(resourceURL(raw, policy, { pinned: true }), raw);
  assert.throws(() => resourceURL('https://sources.example/main.md', policy, { pinned: true }), /digest/);
  for (const input of ['file:///tmp/a.md', 'http://sources.example/a.md', 'https://evil.example/a.md', 'https://127.0.0.1/a.md', 'https://169.254.169.254/a.md', 'https://localhost/a.md']) assert.throws(() => resourceURL(input, policy));
  assert.throws(() => resourceURL('./sibling.md', { baseURL: 'file:///tmp/reader.html' }));
  assert.equal(resourceURL('./source.md', { baseURL: 'http://localhost:8788/index.html' }), 'http://localhost:8788/source.md');
});

test('bounded fetching refuses redirects, media mismatch, oversize, timeout and digest mismatch', async () => {
  const text = '# Snapshot';
  const digest = await sha256(new TextEncoder().encode(text));
  const fetcher = async (_url, init) => { assert.equal(init.redirect, 'error'); assert.equal(init.credentials, 'omit'); return new Response(text, { headers: { 'content-type': 'text/markdown' } }); };
  assert.equal((await fetchResource('https://sources.example/x.md', { policy, digest, fetcher })).text, text);
  await assert.rejects(() => fetchResource('https://sources.example/x.md', { policy, digest: 'b'.repeat(64), fetcher }), /mismatch/);
  await assert.rejects(() => fetchResource(raw, { policy, fetcher: async () => new Response('x', { headers: { 'content-type': 'text/html' } }) }), /media type/);
  await assert.rejects(() => fetchResource(raw, { policy, maxBytes: 2, fetcher }), /byte limit/);
  await assert.rejects(() => fetchResource(raw, { policy, fetcher: async () => ({ ok: true, redirected: true }) }), /redirect/);
  await assert.rejects(() => fetchResource(raw, { policy: { ...policy, timeout: 5 }, fetcher: async (_url, { signal }) => new Promise((_, reject) => signal.addEventListener('abort', () => reject(new Error('timeout')))) }), /timeout/);
  await assert.rejects(() => fetchResource('https://sources.example/private/x.md', { policy: { ...policy, prefixes: ['https://sources.example/public/'] }, fetcher }), /path not allowed/);
});

const encoded = value => new TextEncoder().encode(value);
const jsonResponse = value => new Response(JSON.stringify(value), { headers: { 'content-type': 'application/json' } });
const comparisonFixture = (status, candidate = 'b'.repeat(40)) => ({
  base_commit: { sha: commit },
  merge_base_commit: { sha: status === 'ahead' ? commit : status === 'behind' ? candidate : 'c'.repeat(40) },
  url: `https://api.github.com/repos/owner/repo/compare/${commit}...${candidate}`,
  permalink_url: `https://github.com/owner/repo/compare/owner:${commit.slice(0, 7)}...owner:${candidate.slice(0, 7)}`,
  status, ahead_by: status === 'behind' ? 0 : 2, behind_by: status === 'ahead' ? 0 : 3,
});
const atom = (id = '2401.12345v3') => `<?xml version="1.0" encoding="UTF-8"?>\n<feed xmlns="http://www.w3.org/2005/Atom" xmlns:opensearch="http://a9.com/-/spec/opensearch/1.1/"><opensearch:totalResults>1</opensearch:totalResults><entry><id>http://arxiv.org/abs/${id}</id><title>Text &amp; entities &#x41;</title><author><name>A</name></author></entry></feed>`;

test('integrity descriptors preserve alias, reject contradictions and validate sources/assets', async () => {
  const digest = await sha256(encoded('trusted'));
  const integrity = { algorithm: 'sha256', digest, onMismatch: 'warn-preview' };
  assert.equal(integrityDescriptor({ sha256: digest.toUpperCase(), integrity }).digest, digest);
  for (const entry of [{ sha256: 'bad' }, { sha256: 'b'.repeat(64), integrity }, { integrity: { ...integrity, algorithm: 'md5' } }, { integrity: { ...integrity, onMismatch: 'ignore' } }]) {
    assert.throws(() => parseDocument(preamble({ sources: [{ id: 's', ...entry }] })), /integrity|SHA-256/);
    assert.throws(() => parseDocument(preamble({ assets: [{ id: 's', role: 'source', ...entry }] })), /integrity|SHA-256/);
  }
  assert.equal(parseDocument(preamble({ sources: [{ id: 's', integrity }] })).manifest.sources[0].integrity.onMismatch, 'warn-preview');
});

test('mismatch policy only permits inert inspection; matching cache is rehashed and never implicit', async () => {
  const bytes = encoded('trusted'); const digest = await sha256(bytes);
  const entry = { integrity: { algorithm: 'sha256', digest, onMismatch: 'warn-preview' } };
  await assert.rejects(() => verifyResourceBytes(encoded('<script>bad</script>'), entry), /mismatch/);
  const warning = await verifyResourceBytes(encoded('<script>bad</script>'), entry, { purpose: 'inert-inspector' });
  assert.equal(warning.state, 'unverified'); assert.equal(warning.expectedSHA256, digest);
  entry.integrity.onMismatch = 'use-verified-cache';
  await assert.rejects(() => verifyResourceBytes(encoded('bad'), entry, { purpose: 'inert-inspector' }), /cache unavailable/);
  await assert.rejects(() => verifyResourceBytes(encoded('bad'), entry, { purpose: 'inert-inspector', verifiedCache: { get: () => encoded('tampered') } }), /cache unavailable/);
  const cached = await verifyResourceBytes(encoded('bad'), entry, { purpose: 'inert-inspector', verifiedCache: { get: key => { assert.equal(key, digest); return bytes; } } });
  assert.equal(cached.state, 'verified-cache'); assert.equal(cached.text, 'trusted');
  await assert.rejects(() => verifyResourceBytes(encoded('bad'), entry, { verifiedCache: { get: () => bytes } }), /mismatch/);
});

test('remote dialect/theme trust ceiling refuses relaxed policies even if bytes match', async () => {
  const data = JSON.stringify({ version: '1', tokens: { ink: '#000000' } });
  const result = await renderDocument(preamble({ settings: { theme: 'remote@1' } }) + '# Original', { registry: { themes: { remote: { version: '1', url: 'https://sources.example/theme.json', integrity: { algorithm: 'sha256', digest: await sha256(encoded(data)), onMismatch: 'warn-preview' } } } }, policy, fetcher: () => { throw new Error('must not fetch'); } });
  assert.equal(result.theme, ''); assert.match(result.diagnostics.join(), /strictly digest pinned/);
});

test('provider discovery is pure, derives existing pinned GitHub sources and refuses spoofing', async () => {
  const identity = discoverSourceProvider(`https://github.com/owner/repo/blob/${commit}/a%20b.md#L2`);
  assert.deepEqual(identity, { provider: 'github', pinned: { owner: 'owner', repo: 'repo', commit, path: 'a b.md' } });
  assert.deepEqual(discoverSourceProvider(raw), identity);
  assert.deepEqual(discoverSourceProvider('https://arxiv.org/pdf/hep-th/9901001v2.pdf'), { provider: 'arxiv', pinned: { id: 'hep-th/9901001', version: 2 } });
  for (const url of [`https://github.com.evil.test/o/r/blob/${commit}/a.md`, `https://u@github.com/o/r/blob/${commit}/a.md`, `https://github.com/o/r/blob/main/a.md`, `https://raw.githubusercontent.com/o/r/${commit}/a%2Fb`, 'https://arxiv.org.evil.test/abs/2401.12345v1', 'https://export.arxiv.org/abs/2401.12345v1']) assert.equal(discoverSourceProvider(url), null);
  let calls = 0;
  const unknown = await checkSourceRevision({ url: 'https://unknown.test/a' }, { fetcher: () => { calls++; } });
  assert.equal(unknown.status, 'unknown'); assert.equal(calls, 0);
});

test('GitHub checks exact path on named branch with escaped sha/ref; no repo-wide latest or mutation', async () => {
  const url = `https://github.com/owner/repo/blob/${commit}/docs/a%20b%26c%23d.md`;
  const derived = discoverSourceProvider(url);
  const source = { url, revision: { ...derived, tracking: { mode: 'branch', ref: 'topic/docs&review#1' } } };
  const before = JSON.stringify(source); let calls = 0;
  const result = await checkSourceRevision(source, { now: () => new Date('2026-10-15T12:00:00Z'), fetcher: async (input, init) => {
    calls++; const u = new URL(input);
    assert.equal(init.credentials, 'omit'); assert.equal(init.redirect, 'error'); assert.equal(init.headers, undefined);
    if (u.pathname.includes('/compare/')) {
      assert.equal(u.pathname, `/repos/owner/repo/compare/${commit}...${'b'.repeat(40)}`);
      assert.equal(u.searchParams.get('per_page'), '1');
      return jsonResponse(comparisonFixture('ahead'));
    }
    assert.equal(u.origin, 'https://api.github.com'); assert.equal(u.pathname, '/repos/owner/repo/commits');
    assert.equal(u.searchParams.get('path'), 'docs/a b&c#d.md'); assert.equal(u.searchParams.get('sha'), 'refs/heads/topic/docs&review#1'); assert.equal(u.searchParams.get('per_page'), '1');
    assert.equal(init.credentials, 'omit'); assert.equal(init.redirect, 'error'); assert.equal(init.headers, undefined);
    return jsonResponse([{ sha: 'b'.repeat(40) }]);
  } });
  assert.equal(calls, 2); assert.equal(result.status, 'latest'); assert.equal(result.observedAt, '2026-10-15T12:00:00.000Z');
  assert.equal(JSON.stringify(source), before); assert.equal(result.original.pinned.commit, commit); assert.equal(result.evidence.length, 2);
  assert.equal(result.relationship.kind, 'descendant');
  assert.match(result.evidence[0].url, /path=/); assert.match(result.evidence[1].role, /ancestry/);
  assert.match(result.effectiveURL, /compare/); assert.match(result.timestampAuthority, /not trusted/);
});

test('GitHub ancestry distinguishes ancestor, diverged, descendant, equal and empty path observations', async () => {
  const source = { url: raw, revision: { ...discoverSourceProvider(raw), tracking: { mode: 'branch', ref: 'main' } } };
  for (const [providerStatus, status, kind] of [['behind', 'unknown', 'ancestor'], ['diverged', 'unknown', 'diverged'], ['ahead', 'latest', 'descendant']]) {
    const result = await checkSourceRevision(source, { fetcher: async url => url.includes('/compare/') ? jsonResponse(comparisonFixture(providerStatus)) : jsonResponse([{ sha: 'b'.repeat(40) }]) });
    assert.equal(result.status, status); assert.equal(result.relationship.kind, kind);
    assert.equal(result.relationship.base, commit); assert.equal(result.relationship.candidate, 'b'.repeat(40));
    assert.equal(result.evidence.length, 2); assert.match(result.reason, /Original preserved/);
    if (kind === 'ancestor') assert.match(result.reason, /current\/unchanged is not established/);
  }
  let calls = 0;
  const equal = await checkSourceRevision(source, { fetcher: async () => { calls++; return jsonResponse([{ sha: commit }]); } });
  assert.equal(equal.status, 'current'); assert.equal(equal.relationship.kind, 'equal'); assert.equal(calls, 1);
  const empty = await checkSourceRevision(source, { fetcher: async () => jsonResponse([]) });
  assert.equal(empty.status, 'unknown'); assert.equal(empty.relationship.kind, 'no-path-commit'); assert.equal(empty.latest, undefined);
});

test('GitHub comparison refuses wrong identities and contradictory status/count/ancestry', async () => {
  const source = { url: raw, revision: { ...discoverSourceProvider(raw), tracking: { mode: 'tag', ref: 'v1.0.0' } } };
  const valid = comparisonFixture('ahead');
  for (const comparison of [
    null, [], {},
    { ...valid, base_commit: { sha: 'd'.repeat(40) } },
    { ...valid, url: valid.url.replace('b'.repeat(40), 'd'.repeat(40)) },
    { ...valid, url: valid.url.replace('api.github.com', 'api.github.com.evil.test') },
    { ...valid, url: valid.url.replace('owner/repo', 'other/repo') },
    { ...valid, status: 'identical', ahead_by: 0 },
    { ...valid, status: 'behind' },
    { ...valid, ahead_by: -1 },
    { ...valid, behind_by: 1 },
    { ...valid, merge_base_commit: { sha: 'c'.repeat(40) } },
    { ...valid, merge_base_commit: undefined },
  ]) {
    const result = await checkSourceRevision(source, { fetcher: async url => url.includes('/compare/') ? jsonResponse(comparison) : jsonResponse([{ sha: 'b'.repeat(40) }]) });
    assert.equal(result.status, 'error'); assert.equal(result.latest, undefined); assert.match(result.reason, /comparison/);
  }
});

test('GitHub default branch discovery and explicit tag/release tracking; response refusals', async () => {
  const source = { url: raw };
  const seen = [];
  const current = await checkSourceRevision(source, { fetcher: async url => { seen.push(new URL(url)); return url.includes('?') ? jsonResponse([{ sha: commit }]) : jsonResponse({ default_branch: 'trunk' }); } });
  assert.equal(current.status, 'current'); assert.equal(seen[1].searchParams.get('sha'), 'refs/heads/trunk');
  const revision = { ...discoverSourceProvider(raw), tracking: { mode: 'release', semver: true } };
  const release = await checkSourceRevision({ ...source, revision }, { fetcher: async url => {
    if (url.endsWith('/latest')) return jsonResponse({ tag_name: 'v1.2.3', draft: false, prerelease: false });
    assert.equal(new URL(url).searchParams.get('sha'), 'refs/tags/v1.2.3');
    return jsonResponse([{ sha: commit }]);
  } });
  assert.equal(release.latest.ref, 'v1.2.3');
  revision.tracking = { mode: 'tag', ref: 'v1.2.3' };
  assert.equal((await checkSourceRevision({ ...source, revision }, { fetcher: async url => {
    assert.equal(new URL(url).searchParams.get('sha'), 'refs/tags/v1.2.3');
    return jsonResponse([{ sha: commit }]);
  } })).status, 'current');
  for (const response of [jsonResponse({ default_branch: 123 }), new Response('limited', { status: 429, headers: { 'content-type': 'application/json' } }), jsonResponse({ message: 'API rate limit' })]) {
    const result = await checkSourceRevision(source, { fetcher: async () => response });
    assert.equal(result.status, 'error'); assert.match(result.reason, /rate-limited/);
  }
  const spoof = { ...revision, provider: 'arxiv' };
  await assert.rejects(async () => parseDocument(preamble({ sources: [{ id: 's', url: raw, revision: spoof }] })), /identity/);
});

test('arXiv Atom structural parser handles namespaces/escapes and refuses DTD/entities, malformed or spoofed feeds', () => {
  assert.equal(parseArxivAtom(atom()).version, 3);
  assert.equal(parseArxivAtom(atom('1706.03762v7')).url, 'https://arxiv.org/abs/1706.03762v7');
  assert.equal(parseArxivAtom(atom().replace('<feed ', '<a:feed ').replace('</feed>', '</a:feed>').replace('xmlns="http://www.w3.org/2005/Atom"', 'xmlns="http://www.w3.org/2005/Atom" xmlns:a="http://www.w3.org/2005/Atom"')).version, 3);
  for (const xml of [atom().replace('<feed ', '<!DOCTYPE feed [<!ENTITY x SYSTEM "file:///secret">]><feed '), atom().replace('Text &amp;', 'Text &external;'), atom().replace('</entry>', '</wrong>'), atom().replace('http://www.w3.org/2005/Atom', 'https://evil.test'), atom().replace('<id>', '<id><id>').replace('</id>', '</id></id>'), atom().replace('</feed>', '<entry><id>http://arxiv.org/abs/2401.12345v3</id></entry></feed>'), '<feed xmlns="http://www.w3.org/2005/Atom"/>']) assert.throws(() => parseArxivAtom(xml));
});

test('arXiv latest check preserves pinned vN, validates ID, and exposes unversioned unknown', async () => {
  const source = { url: 'https://arxiv.org/pdf/2401.12345v1.pdf' };
  const fetcher = async (url, init) => {
    const u = new URL(url); assert.equal(u.origin, 'https://export.arxiv.org'); assert.equal(u.searchParams.get('id_list'), '2401.12345');
    assert.equal(init.credentials, 'omit'); return new Response(atom(), { headers: { 'content-type': 'application/atom+xml' } });
  };
  const latest = await checkSourceRevision(source, { fetcher });
  assert.equal(latest.status, 'latest'); assert.equal(latest.original.pinned.version, 1); assert.equal(latest.latest.version, 3);
  assert.equal((await checkSourceRevision({ url: 'https://arxiv.org/abs/2401.12345v3' }, { fetcher })).status, 'current');
  assert.equal((await checkSourceRevision({ url: 'https://arxiv.org/abs/2401.12345' }, { fetcher })).status, 'unknown');
  assert.equal((await checkSourceRevision(source, { fetcher: async () => new Response(atom('2402.12345v3'), { headers: { 'content-type': 'application/atom+xml' } }) })).status, 'error');
  assert.equal((await checkSourceRevision(source, { fetcher: async () => { throw new TypeError('CORS/offline'); } })).status, 'error');
});

test('provider transport refuses redirected, oversized, malformed and timed-out observations', async () => {
  const source = { url: raw, revision: { ...discoverSourceProvider(raw), tracking: { mode: 'branch', ref: 'main' } } };
  for (const fetcher of [
    async () => ({ ok: true, status: 200, redirected: true, url: 'https://evil.test/' }),
    async () => new Response('x'.repeat(256001), { headers: { 'content-type': 'application/json' } }),
    async () => jsonResponse([{ sha: 'not-a-commit' }]),
    async () => new Response('not json', { headers: { 'content-type': 'application/json' } }),
    async (_url, { signal }) => new Promise((_, reject) => signal.addEventListener('abort', () => reject(new Error('timeout')))),
  ]) {
    const result = await checkSourceRevision(source, { fetcher, timeout: 5 });
    assert.equal(result.status, 'error'); assert.equal(result.latest, undefined);
    assert.equal(new URL(result.effectiveURL).origin, 'https://api.github.com');
  }
});

test('BOM-bearing snapshots remain byte-verifiable and expected digest stays strict on fetch', async () => {
  const bytes = encoded('\ufeff# Snapshot'); const digest = await sha256(bytes);
  const checked = await verifyResourceBytes(bytes, { sha256: digest });
  assert.equal(await sha256(encoded(checked.text)), digest);
  const integrity = { algorithm: 'sha256', digest, onMismatch: 'warn-preview' };
  const fetcher = async () => new Response('mismatched', { headers: { 'content-type': 'text/markdown' } });
  await assert.rejects(() => fetchResource(raw, { policy, integrity, fetcher }), /mismatch/);
  assert.equal((await fetchResource(raw, { policy, integrity, purpose: 'inert-inspector', fetcher })).state, 'unverified');
});

test('supersession relations require provenance and stay authored data, never provider verification', async () => {
  const relation = { kind: 'supersededBy', url: 'https://arxiv.org/abs/2401.12345v3', evidence: { provenance: 'Author declaration, reviewed manually', url: 'https://sources.example/notice' } };
  const doc = preamble({ sources: [{ id: 's', url: raw, relations: [relation] }] }) + '{% source ref="s" /%}';
  let calls = 0;
  const result = await renderDocument(doc, { fetcher: () => { calls++; throw new Error('no automatic network'); } });
  assert.equal(calls, 0); assert.deepEqual(result.manifest.sources[0].relations, [relation]);
  assert.throws(() => parseDocument(preamble({ sources: [{ id: 's', relations: [{ kind: 'supersedes', url: relation.url }] }] })), /provenance/);
});
