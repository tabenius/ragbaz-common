// Host-owned publication furniture: an embedded logo (title page in colour, a
// greyscale running header in print) and a QR colophon for the canonical URL.
// Documents can neither supply these bytes nor choose the URL.
import { safeLink } from '../../src/content/markdoc-ragbaz.js';
import { qrSVG } from './qr.js';

const LOGO_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml']);

/** Validated host logo descriptor or null. */
export function hostLogo(config) {
  const logo = config?.logo;
  if (!logo) return null;
  if (typeof logo !== 'object' || !LOGO_TYPES.has(logo.mime) || typeof logo.data !== 'string' || !/^[A-Za-z0-9+/]+={0,2}$/.test(logo.data) || logo.data.length > 2_000_000
    || typeof logo.alt !== 'string' || !logo.alt.trim() || logo.alt.length > 200 || !/^[0-9a-f]{64}$/.test(logo.sha256 || '')) return null;
  return { src: `data:${logo.mime};base64,${logo.data}`, alt: logo.alt, sha256: logo.sha256 };
}

export function decoratePublication(root, config) {
  const doc = root.ownerDocument;
  root.querySelectorAll(':scope > .publication-logo').forEach(n => n.remove());
  doc.getElementById('running-logo-style')?.remove();
  const logo = hostLogo(config);
  if (logo) {
    const title = doc.createElement('img'); title.className = 'publication-logo'; title.src = logo.src; title.alt = logo.alt; title.decoding = 'sync';
    root.prepend(title);
    // Printed pages after the first carry a greyscale copy at about a quarter of the
    // title size in the top-left page margin box (CSS @page margin boxes).
    title.decode().then(() => {
      if (!title.isConnected || !title.naturalWidth) return;
      const width = 180, height = Math.round(width * title.naturalHeight / title.naturalWidth);
      const canvas = doc.createElement('canvas'); canvas.width = width; canvas.height = height;
      const context = canvas.getContext('2d'); context.filter = 'grayscale(1)'; context.drawImage(title, 0, 0, width, height);
      const style = doc.createElement('style'); style.id = 'running-logo-style';
      style.textContent = `@page{@top-left{content:image-set(url("${canvas.toDataURL('image/png')}") 3x);vertical-align:middle}}@page:first{@top-left{content:none}}`;
      doc.head.append(style);
    }).catch(() => { /* The title logo still renders; only the running copy is omitted. */ });
  }
  const url = safeLink(config?.colophon?.url || '');
  const front = root.querySelector('.manuscript-front') || root.querySelector('h1');
  if (url && url.startsWith('https:') && front) {
    try {
      const figure = doc.createElement('figure'); figure.className = 'colophon-qr';
      figure.append(qrSVG(doc, url, { label: `QR code for ${url}` }));
      const caption = doc.createElement('figcaption');
      const a = doc.createElement('a'); a.href = url; a.rel = 'noreferrer noopener'; a.target = '_blank'; a.textContent = url;
      caption.append('Canonical record: ', a);
      figure.append(caption);
      front.after(figure);
    } catch { /* Over-long URLs simply omit the code; the link remains in host provenance. */ }
  }
}
