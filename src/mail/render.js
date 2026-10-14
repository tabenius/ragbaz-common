// Markdoc -> plain text rendering for email.
//
// Provides a toPlainText-like function that properly handles Markdoc tags
// rather than stripping HTML tags (which was the defect toPlainText had: it
// ran consecutive list items together and silently omitted whole trailing blocks).

import Markdoc from '@markdoc/markdoc';

/** Tokenizer flags that change meaning rather than merely allowing more. */
export const TOKENIZER_DEFAULTS = {
  allowComments: false,
  allowIndentation: false,
  allowAnnotations: true,
};

/** Tag allowlist (same as the main Markdoc layer). */
const TAG_NAME = /\{%\s*\/?\s*([A-Za-z][\w-]*)/g;

export function diagnose(source, registered = {}) {
  const text = String(source || '');

  const unregistered = new Set();
  for (const match of text.matchAll(TAG_NAME)) {
    const name = match[1];
    if (!Object.prototype.hasOwnProperty.call(registered, name)) unregistered.add(name);
  }

  // A setext heading is an ATX-looking line followed by a run of `=` under it.
  let setextHeadings = 0;
  const lines = text.split('\n');
  for (let i = 1; i < lines.length; i += 1) {
    const above = lines[i - 1].trim();
    const rule = lines[i].trim();
    if (above && /^(={2,}|-{2,})$/.test(rule) && !/^[-*+]{3,}$/.test(rule)) setextHeadings += 1;
  }

  const htmlBlocks = (text.match(/^\s*<([A-Za-z][\w-]*)\b/gm) || []).length;
  const esmImports = (text.match(/^\s*(import|export)\s.*\bfrom\b/gm) || []).length;

  return {
    unregisteredTags: [...unregistered].sort(),
    setextHeadings,
    htmlBlocks,
    esmImports,
  };
}

/** Render Markdoc source to HTML (from the main layer). */
export function renderMarkdoc(source, options = {}) {
  const text = String(source == null ? '' : source);
  const { tags = {}, variables = {}, tokenizer: tokenizerOverrides } = options;

  const config = defineTags(tags, variables);
  const tokenizerOptions = { ...TOKENIZER_DEFAULTS, ...(tokenizerOverrides || {}) };
  const diagnostics = diagnose(text, config.tags);

  const ast = Markdoc.parse(new Markdoc.Tokenizer(tokenizerOptions).tokenize(text));
  const tree = Markdoc.transform(Markdoc.resolve(ast, config), config);
  const html = Markdoc.renderers.html(tree);

  return {
    html,
    diagnostics,
    clean: !diagnostics.unregisteredTags.length && !diagnostics.setextHeadings && !diagnostics.htmlBlocks && !diagnostics.esmImports,
  };
}

/** Plain-text renderer for Markdoc email source.
 *
 * Unlike `toPlainText` from @react-email/render, this properly handles
 * Markdoc tags so the two parts (HTML and text) agree about what the
 * message says. The text part is the one always delivered.
 *
 * @param {string} source Markdoc source
 * @param {Record<string, string|object>} [options.tags] tag allowlist
 * @param {Record<string, unknown>} [options.variables] variables
 * @returns {string} plain text version
 */
export function toPlainText(source, options = {}) {
  const { tags = {}, variables = {} } = options;
  const config = defineTags(tags, variables);
  const diagnostics = diagnose(source, config.tags);
  const ast = Markdoc.parse(new Markdoc.Tokenizer({ ...TOKENIZER_DEFAULTS, ...{ tags: config.tags, variables: config.variables } }).tokenize(String(source ?? '')));
  const tree = Markdoc.transform(Markdoc.resolve(ast, config), config);

  function toText(node) {
    if (!node || typeof node !== 'object') return '';
    if (Array.isArray(node)) return node.map(toText).join('');

    const content = (node.children || []).map(toText).join('');
    const attrs = node.attributes || {};

    switch (node.type) {
      case 'text':
        return String(attrs.content ?? '');
      case 'strong':
        return content;
      case 'link': {
        const href = String(attrs.href || '');
        return href ? `${content} <${href}>` : content;
      }
      case 'hr':
        return '--------';
      case 'list':
        return (node.children || []).map(toText).filter(Boolean).join('\n');
      case 'item':
        return `- ${content.trim()}`;
      case 'fence':
        return content.trim();
      case 'tag': {
        if (!Object.prototype.hasOwnProperty.call(config.tags, node.tag)) return '';
        if (node.tag === 'rule') return '--------';
        if (node.tag === 'item') return `- ${content.trim()}`;
        return content;
      }
      default:
        return content;
    }
  }

  function isItemBlock(node) {
    const inline = node?.children?.[0];
    const tag = inline?.children?.[0];
    return node?.type === 'paragraph' && inline?.type === 'inline' && tag?.type === 'tag' && tag.tag === 'item';
  }

  function toPlainTextHelper(node) {
    if (!node) return '';
    const children = node?.children || [];
    const blocks = [];
    let run = [];

    const flush = () => {
      if (run.length) blocks.push(run.join('\n'));
      run = [];
    };

    for (const child of children) {
      const text = toText(child).trim();
      if (!text) continue;
      if (isItemBlock(child)) run.push(text);
      else {
        flush();
        blocks.push(text);
      }
    }
    flush();

    return `${blocks.join('\n\n')}\n`;
  }

  return toPlainTextHelper(tree);
};

/** Render Markdoc source to a { html, text } object.
 *
 * This provides both the React Email HTML output and a plain text version
 * that agrees with the HTML about what the message says.
 *
 * @param {string} source Markdoc source
 * @param {Record<string, string|object>} [options.tags] tag allowlist
 * @param {Record<string, unknown>} [options.variables] variables
 * @returns {{html: string, text: string, diagnostics: object}}
 */
export function renderEmail(source, options = {}) {
  const { html, diagnostics, clean } = renderMarkdoc(source, options);
  const text = toPlainText(source, options);

  return { html, text, diagnostics, clean };
};

/** Tag allowlist for mail templates. */
export const TAGS = Object.freeze({
  heading: { transform: (n, c) => ({ element: 'h1', children: c }) },
  lede: { transform: (n, c) => ({ element: 'p', style: 'lede', children: c }) },
  note: { transform: (n, c) => ({ element: 'p', style: 'note', children: c }) },
  item: { transform: (n, c) => ({ element: 'li', style: 'item', children: c }) },
  action: {
    transform: (n, c) => ({
      element: 'a',
      href: String(n.attributes.href || ''),
      style: 'link',
      children: c,
    }),
  },
  rule: { selfClosing: true, transform: () => ({ element: 'hr' }) },
});

/** Node schemas for mail. */
export const NODES = Object.freeze({
  document: { render: 'article', transform: (n, c) => c },
  heading: {
    render: 'h1',
    children: ['inline'],
    transform: (n, c) => ({ element: 'h1', children: c }),
  },
  paragraph: { render: 'p', children: ['inline'], transform: (n, c) => ({ element: 'p', children: c }) },
  list: { render: 'ul', children: ['item'], transform: (n, c) => ({ element: 'ul', children: c }) },
  item: {
    render: 'li',
    transform: (n, c) => [({ element: 'span', style: 'item', children: ['— ', ...c] })],
  },
  blockquote: {
    render: 'blockquote',
    transform: (n, c) => ({ element: 'blockquote', style: 'borderLeft: 3px solid #ded5c2; paddingLeft: 14px; margin: 0 0 16px', children: c }),
  },
  hr: { transform: () => ({ element: 'hr' }) },
  fence: {
    render: 'pre',
    transform: (n, c) => ({ element: 'pre', style: 'font-family: DejaVu Sans Mono, monospace; font-size: 13px; background: #a39a8b; color: #2b2822; padding: 12px; border-radius: 2px; margin: 0 0 16px', children: c }),
  },
  image: { render: 'img', transform: (n) => ({ element: 'img', style: 'note', attributes: { alt: String(n.attributes.alt || '') } }) },
  table: { render: 'table', transform: (n, c) => ({ element: 'table', children: c }) },
  thead: { transform: (n, c) => c },
  tbody: { transform: (n, c) => c },
  tr: { render: 'section', transform: (n, c) => ({ element: 'section', children: c }) },
  th: { render: 'th', transform: (n, c) => ({ element: 'th', style: { fontWeight: '700' }, children: c }) },
  td: { render: 'td', transform: (n, c) => ({ element: 'td', style: 'item', children: c }) },

  // Inline nodes.
  inline: { transform: (n, c) => c },
  text: { transform: (n) => [String(n.attributes.content ?? '')] },
  strong: { transform: (n, c) => ({ element: 'strong', style: { fontWeight: '700' }, children: c }) },
  em: { transform: (n, c) => ({ element: 'em', children: c }) },
  s: { transform: (n, c) => ({ element: 's', children: c }) },
  link: { render: 'a', transform: (n, c) => ({ element: 'a', href: String(n.attributes.href || ''), style: 'link', children: c }) },
  code: { render: 'code', transform: (n, c) => ({ element: 'span', style: { fontFamily: '"DejaVu Sans Mono", monospace'}, children: c }) },
  hardbreak: { transform: () => '\n' },
  softbreak: { transform: () => ' ' },
  // Dropped, not rendered: an unclosed tag or a parser error must not reach
  // a recipient as visible garbage. Both are reported by diagnostics instead.
  comment: { transform: () => [] },
  error: { transform: () => [] },
});
