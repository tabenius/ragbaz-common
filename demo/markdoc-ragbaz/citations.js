import { escapeHTML, safeLink, discoverSourceProvider } from '../../src/content/markdoc-ragbaz.js';

const text = value => typeof value === 'string' ? value.slice(0, 1200) : '';

export function manuscriptState(document = {}) {
  const m = document.manuscript || {};
  const date = value => {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return '';
    const d = new Date(`${value}T00:00:00Z`);
    return Number.isFinite(d.valueOf()) && d.toISOString().slice(0, 10) === value
      ? new Intl.DateTimeFormat('en-US', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' }).format(d) : '';
  };
  const received = date(m.received);
  const published = m.review === 'complete' && m.signals?.human === true && m.signals?.assistant === true ? date(m.published) : '';
  return { received, published, label: [received && `Draft received ${received}`, published ? `Published ${published}` : 'Publication pending'].filter(Boolean).join(' · ') };
}

export function decorateManuscript(root, document, openRevisions) {
  const doc = root.ownerDocument, heading = root.querySelector('h1');
  if (!heading) return;
  const authors = Array.isArray(document.authors) ? document.authors.filter(a => a && typeof a.name === 'string').slice(0, 32) : [];
  const front = doc.createElement('div'); front.className = 'manuscript-front';
  if (authors.length) {
    const details = doc.createElement('details'); details.className = 'manuscript-authors';
    const summary = doc.createElement('summary'); summary.textContent = text(document.authorSummary) || authors.map(a => text(a.name)).join(', ');
    details.append(summary);
    const list = doc.createElement('ul');
    for (const author of authors) {
      const li = doc.createElement('li'); const name = doc.createElement('strong'); name.textContent = text(author.name); li.append(name);
      if (author.role) li.append(doc.createTextNode(` — ${text(author.role)}`)); list.append(li);
    }
    details.append(list); front.append(details);
  }
  if (document.manuscript) {
    const stamp = doc.createElement('button'); stamp.type = 'button'; stamp.className = 'manuscript-dates';
    stamp.textContent = manuscriptState(document).label; stamp.setAttribute('aria-label', `${stamp.textContent}. View manuscript revisions`);
    stamp.addEventListener('click', openRevisions); front.append(stamp);
  }
  heading.after(front);
}

export function citationKey(value) {
  try {
    const u = new URL(value);
    if (!safeLink(value) || u.protocol !== 'https:') return null;
    u.hash = '';
    if (u.hostname === 'github.com') {
      const parts = u.pathname.split('/');
      parts[1] = parts[1]?.toLowerCase(); parts[2] = parts[2]?.toLowerCase();
      u.pathname = parts.join('/');
    }
    return u.href;
  } catch { return null; }
}

function sourceReference(url) {
  const discovered = discoverSourceProvider(url);
  if (discovered) return discovered;
  const key = citationKey(url);
  const m = key && /^https:\/\/github\.com\/([^/]+)\/([^/]+)\/commit\/([a-f0-9]{40})$/i.exec(key);
  return m ? { provider: 'github', pinned: { owner: m[1], repo: m[2], commit: m[3], path: '' } } : null;
}

/** First-mention introductions are authored editorial notes, never fetched or
 * inferred from project names. Keep meaningful name links in the prose. */
export function decorateEntities(root, entities, sources) {
  if (!Array.isArray(entities)) return;
  const doc = root.ownerDocument;
  const definitions = entities.slice(0, 80).filter(e => e && typeof e.name === 'string' && e.name && typeof e.description === 'string');
  const seen = new Set();
  const walker = doc.createTreeWalker(root, 4); // SHOW_TEXT, including ordinary paragraphs.
  const nodes = [];
  while (walker.nextNode()) nodes.push(walker.currentNode);
  for (const node of nodes) {
    if (node.parentElement.closest('a,button,pre,code,h1,h2,h3,h4,.block-label,svg,figcaption')) continue;
    const value = node.textContent, hits = [];
    for (const entity of definitions) {
      if (seen.has(entity.name)) continue;
      const names = [entity.name, ...(Array.isArray(entity.aliases) ? entity.aliases.filter(a => typeof a === 'string' && a) : [])];
      let hit;
      for (const name of names) {
        let start = value.indexOf(name);
        while (start >= 0) {
          if (!/[\p{L}\p{N}_]/u.test(value[start - 1] || ' ') && !/[\p{L}\p{N}_]/u.test(value[start + name.length] || ' ')) {
            if (!hit || start < hit.start) hit = { start, end: start + name.length, entity }; break;
          }
          start = value.indexOf(name, start + name.length);
        }
      }
      if (hit) hits.push(hit);
    }
    hits.sort((a, b) => a.start - b.start || b.end - a.end);
    if (!hits.length) continue;
    const fragment = doc.createDocumentFragment(); let offset = 0;
    for (const hit of hits) {
      if (hit.start < offset || seen.has(hit.entity.name)) continue;
      fragment.append(doc.createTextNode(value.slice(offset, hit.start)));
      const source = sources.find(s => s.id === hit.entity.source);
      const url = safeLink(source?.url || hit.entity.url);
      const name = doc.createElement(url ? 'a' : 'span');
      if (url) { name.href = url; name.rel = 'noreferrer noopener'; }
      name.textContent = value.slice(hit.start, hit.end);
      name.dataset.entity = hit.entity.name;
      name._entityDefinition = { ...hit.entity, url, sourceRef: source?.id };
      fragment.append(name); offset = hit.end; seen.add(hit.entity.name);
    }
    fragment.append(doc.createTextNode(value.slice(offset))); node.replaceWith(fragment);
  }
}

/** Authored bibliography data plus explicitly derived repository identity.
 * Never invent authors, dates, a publication venue or verification status. */
export function bibliographyData(source, label = '') {
  const b = source.bibliography && typeof source.bibliography === 'object' ? source.bibliography : {};
  const discovered = sourceReference(source.url);
  const p = discovered?.pinned;
  const authors = Array.isArray(b.authors) ? b.authors.filter(a => typeof a === 'string').slice(0, 12).map(text).join('; ') : text(b.author);
  const origin = discovered?.provider === 'github' ? `${p.owner}/${p.repo}` : discovered?.provider === 'arxiv' ? 'arXiv' : '';
  const year = /^(?:[12]\d{3}|n\.d\.)$/.test(b.year || '') ? String(b.year) : '';
  return {
    title: text(b.title) || text(source.title) || text(label) || 'Untitled source',
    authors: authors || origin,
    year,
    venue: text(b.venue) || (discovered?.provider === 'github' ? 'GitHub' : origin),
    version: text(b.version) || (discovered?.provider === 'github' ? `Commit ${p.commit.slice(0, 7)}…${p.commit.slice(-3)}` : discovered?.provider === 'arxiv' && p.version ? `Version ${p.version}` : ''),
    locator: text(b.locator) || (discovered?.provider === 'github' ? p.path : discovered?.provider === 'arxiv' ? p.id : ''),
    url: safeLink(source.url),
    description: text(b.description),
    commitURL: discovered?.provider === 'github' ? `https://github.com/${p.owner}/${p.repo}/commit/${p.commit}` : '',
    // Presence is a declaration, not proof of authenticity or currentness.
    coverage: source.sha256 || source.integrity?.digest ? 'Content digest recorded' : p ? 'Revision reference only' : 'Authored reference',
  };
}

export function bibliographyHTML(entry) {
  if (entry.entity) {
    return `<div class="bib-byline">An introduction</div><cite class="bib-title">${escapeHTML(entry.source.title)}</cite>`
      + `<p class="bib-description">${escapeHTML(entry.source.description)}</p><div class="bib-actions">`
      + (['weftmark', 'nostoi'].includes(entry.source.figure) ? `<a href="#figure-${entry.source.figure}">See illustrated introduction</a>` : '')
      + (entry.source.sourceRef ? `<button type="button" data-source="${escapeHTML(entry.source.sourceRef)}">Read documentation</button>` : '')
      + (safeLink(entry.source.url) ? `<a href="${escapeHTML(safeLink(entry.source.url))}" target="_blank" rel="noreferrer noopener">Documentation ↗</a>` : '') + '</div>'
      + (Array.isArray(entry.source.provenance) ? `<details class="bib-provenance"><summary>Inspection provenance</summary>${entry.source.provenance.slice(0, 12).map(p => `<p>${escapeHTML(text(p?.label))}<br><code>${escapeHTML(text(p?.value))}</code></p>`).join('')}</details>` : '');
  }
  const b = bibliographyData(entry.source);
  return `<div class="bib-byline">${escapeHTML(b.authors)}${b.year ? ` <span>(${escapeHTML(b.year)})</span>` : ''}</div>`
    + `<cite class="bib-title">${escapeHTML(b.title)}</cite>`
    + (b.description ? `<p class="bib-description">${escapeHTML(b.description)}</p>` : '')
    + `<div class="bib-publication">${escapeHTML(b.venue)}${b.version ? ' · ' : ''}${b.commitURL ? `<a href="${escapeHTML(b.commitURL)}" target="_blank" rel="noreferrer noopener">${escapeHTML(b.version)}</a>` : escapeHTML(b.version)}</div>`
    + (b.locator ? `<div class="bib-locator">${escapeHTML(b.locator)}</div>` : '')
    + `<div class="bib-coverage">${escapeHTML(b.coverage)} · not a freshness or authorship assertion</div>`
    + `<div class="bib-actions">${entry.declared ? `<button type="button" data-source="${escapeHTML(entry.id)}">Read source</button>` : ''}`
    + (b.url ? `<a href="${escapeHTML(b.url)}" target="_blank" rel="noreferrer noopener">Original ↗</a>` : '') + '</div>';
}

/** Presentation-only enhancement of safe renderer output. Source bytes and
 * immutable references are not rewritten. Hovering never fetches a source. */
export function decorateCitations(root, sources, excludeIds = []) {
  const doc = root.ownerDocument;
  const declared = new Map(sources.map(s => [s.id, s]));
  const urls = new Map(sources.map(s => [citationKey(s.url), s]).filter(([key]) => key));
  const entries = [], byKey = new Map(), byId = new Map();
  for (const node of [...root.querySelectorAll('[data-source], [data-entity], a[href]')]) {
    if (node.closest('pre, code')) continue;
    const entity = node._entityDefinition;
    let source = entity ? { ...entity, id: `entity-${entity.name}`, title: entity.name } : declared.get(node.dataset.source);
    const key = citationKey(node.getAttribute('href'));
    if (!source && key) source = urls.get(key);
    if (source && excludeIds.includes(source.id)) continue;
    const known = Boolean(source);
    if (!source) {
      const discovered = key && sourceReference(node.getAttribute('href'));
      if (!discovered) continue; // Ordinary navigation remains an ordinary link.
      const filename = discovered.pinned.path?.split('/').at(-1);
      source = { id: `linked-reference-${entries.length + 1}`, url: node.getAttribute('href'), title: [node.textContent.trim(), filename].filter(Boolean).join(' — ') };
    }
    const identity = entity ? `entity:${entity.name}` : citationKey(source.url) || `id:${source.id}`;
    let entry = byKey.get(identity);
    if (!entry) {
      entry = { number: entries.length + 1, id: source.id, source, declared: known && !entity, entity: Boolean(entity) };
      entries.push(entry); byKey.set(identity, entry); byId.set(entry.id, entry);
    }
    const sup = doc.createElement('sup'); sup.className = 'citation';
    const button = doc.createElement('button');
    button.type = 'button'; button.className = 'citation-mark'; button.dataset.citation = entry.id;
    button.textContent = String(entry.number);
    button.setAttribute('aria-label', `Reference ${entry.number}: ${bibliographyData(entry.source).title}`);
    button.setAttribute('aria-controls', 'citation-card');
    button.setAttribute('aria-expanded', 'false');
    sup.append(button);
    if (node.matches('a[href], [data-entity]')) node.after(sup);
    else {
      const before = node.previousSibling;
      if (before?.nodeType === 3) {
        // A reference belongs to its preceding glyph, not to a word-space.
        // Consecutive references retain a thin separator so 4 + 2 is not 42.
        const consecutive = !before.textContent.trim() && before.previousSibling?.nodeType === 1 && before.previousSibling.matches('.citation');
        before.textContent = consecutive ? '\u2009' : before.textContent.replace(/\s+$/u, '');
      }
      node.replaceWith(sup);
    }
  }
  if (entries.length) {
    const section = doc.createElement('section'); section.className = 'bibliography';
    const existing = [...root.querySelectorAll('h2')].find(h => /^(references|bibliography)/i.test(h.textContent));
    if (!existing) {
      const title = doc.createElement('h2'); title.id = 'reader-bibliography'; title.textContent = entries.some(e => e.entity) ? 'Notes and references' : 'References'; section.append(title);
    }
    section.setAttribute('aria-label', 'Bibliography');
    const list = doc.createElement('ol');
    for (const entry of entries) {
      const li = doc.createElement('li'); li.id = `reference-${entry.number}`; li.value = entry.number;
      li.innerHTML = bibliographyHTML(entry); list.append(li);
    }
    section.append(list); root.append(section);
  }
  return { entries, byId };
}
