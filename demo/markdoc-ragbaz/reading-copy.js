// Static reading copies: installed presentation + visible manuscript, not a DOM
// dump of the authoring application. No runtime, source cache or host authority.
const HTML = new Set('article main section header footer div span p h1 h2 h3 h4 h5 h6 ul ol li dl dt dd blockquote pre code em strong b i u s small sup sub a hr br table thead tbody tfoot tr th td caption figure figcaption details summary time'.split(' '));
const SVG = new Set('svg g path circle ellipse rect line polyline polygon text tspan defs filter feturbulence fecolormatrix clippath title desc style'.split(' '));
const ATTRS = new Set('id class title lang role aria-label aria-hidden datetime colspan rowspan scope start reversed open viewbox xmlns width height x y x1 x2 y1 y2 cx cy r rx ry d points transform fill stroke stroke-width stroke-dasharray stroke-linecap stroke-linejoin opacity fill-opacity stroke-opacity text-anchor dominant-baseline font-size font-family filter type basefrequency numoctaves stitchtiles seed values result in clip-path'.split(' '));
const DROP = new Set('script iframe object embed form input textarea select option link meta base audio video source img foreignobject animate animatetransform set'.split(' '));
const escape = value => String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function css(value) {
  // Installed CSS has no remote dependencies. Local SVG filter references are OK.
  if (/@import|expression\s*\(|<\/style|javascript:|\\/i.test(value)) throw Error('This presentation contains unsupported CSS; use Markdown or Print instead.');
  for (const match of value.matchAll(/url\s*\(([^)]*)\)/gi)) if (!/^\s*['"]?#[a-z0-9_-]+['"]?\s*$/i.test(match[1])) throw Error('External presentation assets cannot be included in an offline reading copy.');
  return value;
}

function link(value) {
  if (/^#[a-zA-Z0-9_-]+$/.test(value)) return value;
  try { const url = new URL(value); return ['https:', 'http:', 'mailto:'].includes(url.protocol) && !url.username && !url.password ? url.href : null; } catch { return null; }
}

export function readingCopy(doc, { title = doc.title } = {}) {
  const paper = doc.getElementById('paper'), sheet = doc.getElementById('reader-styles');
  const template = doc.documentElement.dataset.template;
  if (!paper || !sheet || !['markdoc-ragbaz-sci-tufte', 'heartfulness', 'aether-prima-materia', 'aether-sun-and-moon', 'aether-blackening'].includes(template)) throw Error('No installed reading presentation is available.');
  if (typeof title !== 'string' || !title.trim() || title.length > 300) throw Error('Give the reading copy a title of at most 300 characters.');
  let nodes = 0;
  const serialize = (node, depth = 0) => {
    if (++nodes > 30000 || depth > 80) throw Error('This reading copy is too complex. Download the Markdown instead.');
    if (node.nodeType === 3) return escape(node.textContent);
    if (node.nodeType !== 1) return '';
    const tag = node.localName.toLowerCase(), svg = node.namespaceURI === 'http://www.w3.org/2000/svg';
    if (DROP.has(tag) || node.hidden || node.classList.contains('bib-actions')) return '';
    if (tag === 'style') return svg ? `<style>${css(node.textContent)}</style>` : '';
    const content = () => [...node.childNodes].map(child => serialize(child, depth + 1)).join('');
    if (!(svg ? SVG : HTML).has(tag)) return tag === 'button' ? `<span>${content()}</span>` : content();
    const attrs = [];
    for (const attr of node.attributes) {
      const name = attr.name.toLowerCase();
      if (name === 'href' && !svg) { const href = link(attr.value); if (href) attrs.push(`href="${escape(href)}" rel="noreferrer noopener"`); }
      else if (ATTRS.has(name)) {
        if ((name === 'filter' || name === 'clip-path' || name === 'fill' || name === 'stroke') && /url\s*\(/i.test(attr.value) && !/^url\(#[a-z0-9_-]+\)$/i.test(attr.value)) continue;
        attrs.push(`${attr.name}="${escape(attr.value)}"`);
      }
    }
    const name = svg ? node.localName : tag;
    if (tag === 'details' && !node.hasAttribute('open')) attrs.push('open');
    return `<${name}${attrs.length ? ' ' + attrs.join(' ') : ''}>${['br', 'hr'].includes(tag) ? '' : content() + `</${name}>`}`;
  };
  const rootAttrs = [`lang="${escape(/^[a-z-]{2,20}$/i.test(doc.documentElement.lang) ? doc.documentElement.lang : 'en')}"`, `data-template="${template}"`, 'data-fonts="system"'];
  for (const [key, allowed] of Object.entries({ appearance: ['light', 'dark'], heartOrnaments: ['plain', 'quiet', 'bloom'], heartTexture: ['smooth', 'grain'], aetherPlates: ['on', 'off'] })) {
    const value = doc.documentElement.dataset[key];
    if (allowed.includes(value)) rootAttrs.push(`data-${key.replace(/[A-Z]/g, char => '-' + char.toLowerCase())}="${value}"`);
  }
  const rootStyle = doc.documentElement.getAttribute('style');
  if (rootStyle) rootAttrs.push(`style="${escape(css(rootStyle))}"`);
  const ornaments = [...doc.querySelector('.reading-layout').children].filter(node => node.classList.contains('heart-frame') || node.classList.contains('aether-front')).map(node => serialize(node)).join('');
  const grain = doc.querySelector('body > .heart-grain');
  const notices = doc.querySelector('#software-credits pre')?.textContent || '';
  const staticCSS = 'html body.reading-copy .reading-layout{display:block!important}html[data-template="markdoc-ragbaz-sci-tufte"] body.reading-copy .reading-layout{max-width:86ch;margin:2rem auto;padding:0 5vw}.reading-copy-notices{max-width:86ch;margin:3rem auto;padding:0 5vw;font:12px/1.6 system-ui}.reading-copy-notices pre{white-space:pre-wrap;overflow-wrap:anywhere}';
  const html = `<!doctype html>\n<html ${rootAttrs.join(' ')}><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="referrer" content="no-referrer"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'"><title>${escape(title)}</title><style>${css(sheet.textContent)}\n${staticCSS}</style></head><body class="reading-copy" data-reading-mode="flow">${grain ? serialize(grain) : ''}<div class="reading-layout">${ornaments}${serialize(paper)}</div><details class="reading-copy-notices"><summary>About this reading copy and software licenses</summary><p>Static reading copy; not an attestation or proof of authorship. Original editing authority and source-inspection caches are not included. System fonts are used; wrapping may differ between devices. Text and links already written in the manuscript remain.</p><pre>${escape(notices)}</pre></details></body></html>\n`;
  if (new TextEncoder().encode(html).length > 2 * 1024 * 1024) throw Error('Reading copy exceeds 2 MiB. Download Markdown or Print instead.');
  return { schema: 'ragbaz.reading-copy/v1', template, html };
}
