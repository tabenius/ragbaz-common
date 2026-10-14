// Offline tests for the content layer. No network, no Worker runtime.

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  DIRECTLY_RENDERABLE,
  FORMAT,
  applyContentLinks,
  classifySource,
  contentLinkHeader,
  defineTags,
  describeEntry,
  diagnose,
  markdownVariantPath,
  renderLlmsTxt,
  renderMarkdoc,
  validateManifest,
} from '../src/content/index.js';

const TAGS = { callout: 'aside', note: 'span' };

test('renders plain CommonMark without a build step', () => {
  const { html, clean } = renderMarkdoc('# Title\n\nSome *text*.', { tags: TAGS });
  assert.match(html, /<h1>Title<\/h1>/);
  assert.match(html, /<em>text<\/em>/);
  assert.equal(clean, true);
});

test('escapes raw HTML rather than passing it through', () => {
  const { html } = renderMarkdoc('a <script>alert(1)</script> b', { tags: TAGS });
  assert.ok(!html.includes('<script>'));
  assert.match(html, /&lt;script&gt;/);
});

test('renders a registered tag to its declared element', () => {
  const { html, clean } = renderMarkdoc('{% callout type="warn" %}\nbody\n{% /callout %}', { tags: TAGS });
  assert.match(html, /<aside/);
  assert.match(html, /body/);
  assert.equal(clean, true);
});

test('nests tags', () => {
  const { html } = renderMarkdoc('{% note %}\n{% callout %}\nin\n{% /callout %}\n{% /note %}', { tags: TAGS });
  assert.match(html, /<span[^>]*><aside[^>]*>/);
});

test('an unregistered tag is dropped, and diagnosed rather than hidden', () => {
  const result = renderMarkdoc('{% mystery %}\n\nbody', { tags: TAGS });
  assert.ok(!result.html.includes('mystery'), 'unregistered tag must not reach the output');
  assert.deepEqual(result.diagnostics.unregisteredTags, ['mystery']);
  assert.equal(result.clean, false);
});

test('setext headings are reported, because Markdoc mangles them silently', () => {
  const found = diagnose('Title\n=====\n\nbody', TAGS);
  assert.equal(found.setextHeadings, 1);
  const result = renderMarkdoc('Title\n=====\n\nbody', { tags: TAGS });
  assert.equal(result.clean, false);
});

test('a thematic break is not mistaken for a setext heading', () => {
  assert.equal(diagnose('body\n\n---\n\nmore', TAGS).setextHeadings, 0);
});

test('ESM imports are detected, which is how MDX is recognised', () => {
  assert.equal(diagnose("import X from 'y';\n\nbody", TAGS).esmImports, 1);
});

test('defineTags emits both the tag and the node schema', () => {
  const config = defineTags({ callout: 'aside' });
  assert.equal(typeof config.tags.callout.transform, 'function');
  assert.equal(config.nodes.aside.render, 'aside');
});

test('defineTags forwards declared attributes', () => {
  const config = defineTags({ callout: { element: 'aside', attributes: { role: () => 'note' } } });
  const node = { attributes: {}, children: [] };
  const [tag] = config.tags.callout.transform(node, { tags: {}, nodes: {}, variables: {} });
  assert.equal(tag.attributes.role, 'note');
});

test('classifies each authoring format the fleet actually uses', () => {
  const plain = classifySource('# Hi\n\ntext', { registeredTags: TAGS });
  assert.equal(plain.format, FORMAT.MARKDOC);
  assert.equal(plain.renderable, true);

  const tagged = classifySource('{% callout %}\nx\n{% /callout %}', { registeredTags: TAGS });
  assert.equal(tagged.format, FORMAT.MARKDOC_TAGGED);
  assert.ok(DIRECTLY_RENDERABLE.includes(tagged.format));

  const mdx = classifySource("import Widget from './w';\n\n<Widget />\n", {});
  assert.equal(mdx.format, FORMAT.MDX);
  assert.equal(mdx.renderable, false);
  assert.match(mdx.hint, /not Markdoc-compatible/);

  const html = classifySource('<!doctype html><html></html>');
  assert.equal(html.format, FORMAT.HTML);

  const setext = classifySource('Title\n=====\n\nbody', { registeredTags: TAGS });
  assert.equal(setext.format, FORMAT.SETEXT);
  assert.equal(setext.renderable, false);
  assert.match(setext.hint, /# Title/);
});

test('every format hint tells the agent what to do', () => {
  const cases = [
    ['plain', '# Hi', TAGS],
    ['mdx', "import X from 'y';", {}],
    ['html', '<!doctype html>', {}],
    ['setext', 'T\n=', TAGS],
  ];
  for (const [, source, tags] of cases) {
    const hint = classifySource(source, { registeredTags: tags }).hint;
    assert.ok(hint.length > 20, `hint too short: ${hint}`);
  }
});

test('llms.txt follows the v2 section order', () => {
  const text = renderLlmsTxt({
    name: 'Example',
    summary: 'A short summary.',
    details: ['More detail.'],
    sections: { Docs: { entries: [{ title: 'Start', url: '/docs/start.md', note: 'Markdoc-compatible.' }] } },
  });
  const lines = text.split('\n');
  assert.equal(lines[0], '# Example');
  assert.equal(lines[2], '> A short summary.');
  assert.ok(text.includes('## Docs'));
  assert.ok(text.includes('## Docs\n\n- [Start](/docs/start.md): Markdoc-compatible.'));
  assert.ok(text.indexOf('# Example') < text.indexOf('## Docs'));
});

test('llms.txt rejects a manifest with no name', () => {
  assert.ok(validateManifest({}).some((p) => /name is required/.test(p)));
  assert.throws(() => renderLlmsTxt({}), /manifest is invalid/);
});

test('llms.txt rejects headings in the prose block', () => {
  assert.ok(validateManifest({ name: 'X', details: ['## sneaky'] }).some((p) => /only H2/.test(p)));
});

test('llms.txt refuses a note containing a newline', () => {
  const text = renderLlmsTxt({
    name: 'X',
    sections: { Docs: { entries: [{ title: 'A', url: '/a', note: 'one\ntwo' }] } },
  });
  assert.ok(text.includes('- [A](/a): one two'));
  assert.ok(!/- \[A\]\(\/a\): one\n/.test(text));
});

test('a title cannot break out of the link syntax', () => {
  const text = renderLlmsTxt({
    name: 'X',
    sections: { Docs: { entries: [{ title: 'evil](http://x.test)', url: '/a' }] } },
  });
  assert.ok(text.includes('- [evil\\]\\(http://x.test\\)](/a)'));
});

test('an empty section is omitted rather than emitted headingless', () => {
  const text = renderLlmsTxt({ name: 'X', sections: { Docs: { entries: [] } } });
  assert.ok(!text.includes('## Docs'));
});

test('markdown twin paths follow the v2 naming rule', () => {
  assert.equal(markdownVariantPath('/docs/page.html'), '/docs/page.html.md');
  assert.equal(markdownVariantPath('/docs/page.html', { replace: true }), '/docs/page.md');
  assert.equal(markdownVariantPath('/docs/'), '/docs/index.html.md');
  assert.equal(markdownVariantPath('/docs/', { replace: true }), '/docs/index.md');
  assert.equal(markdownVariantPath('/docs/start'), '/docs/start.md');
});

test('query and fragment are dropped from the twin path', () => {
  assert.equal(markdownVariantPath('/docs/page.html?q=1#x'), '/docs/page.html.md');
});

test('the Link header carries both relations', () => {
  const header = contentLinkHeader({ pathname: '/docs/page.html', llmsPath: '/docs/llms.txt' });
  assert.ok(header.includes('</docs/page.html.md>; rel="alternate"; type="text/markdown"'));
  assert.ok(header.includes('</docs/llms.txt>; rel="describedby"'));
});

test('a page with no Markdown twin omits only the alternate', () => {
  const header = contentLinkHeader({ pathname: '/search', markdown: false });
  assert.ok(!header.includes('alternate'));
  assert.ok(header.includes('describedby'));
});

test('an origin is prefixed without doubling the slash', () => {
  const header = contentLinkHeader({ pathname: '/a.html', origin: 'https://ragbaz.cc' });
  assert.ok(header.includes('<https://ragbaz.cc/a.html.md>'));
});

test('applyContentLinks writes to an existing Headers object', () => {
  const headers = new Headers();
  applyContentLinks(headers, { pathname: '/a.html' });
  assert.ok(headers.get('Link').includes('rel="alternate"'));
});

test('describeEntry combines format and product context into one note', () => {
  const entry = describeEntry(
    { title: 'Model', url: '/docs/model', format: FORMAT.MARKDOC },
    { context: 'Requires a Workers plan upgrade.' },
  );
  assert.equal(entry.renderable, true);
  assert.match(entry.note, /Requires a Workers plan upgrade\./);
});

test('an empty document is renderable, not an error', () => {
  assert.equal(classifySource('   ').format, FORMAT.EMPTY);
  assert.equal(renderMarkdoc('').html, '<article></article>');
});

test('null and undefined sources do not throw', () => {
  assert.doesNotThrow(() => renderMarkdoc(null, { tags: TAGS }));
  assert.doesNotThrow(() => diagnose(undefined, TAGS));
});
