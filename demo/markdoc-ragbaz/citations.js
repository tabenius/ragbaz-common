import { escapeHTML, safeLink, discoverSourceProvider, evidenceGrade, evidenceScale, publicationIdentifiers, identifierResolvers } from '../../src/content/markdoc-ragbaz.js';

const text = value => typeof value === 'string' ? value.slice(0, 1200) : '';
const count = value => Number.isSafeInteger(value) && value > 0 ? value.toLocaleString('en-US') : '';
const isoDate = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : '';

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

export function decorateManuscript(root, document, openRevisions, resolvers = {}) {
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
  // Declared identifiers only; unassigned or malformed values display as an em dash.
  let checked = {};
  try { checked = identifierResolvers(resolvers); } catch { /* host config is validated at build; refuse links otherwise */ }
  const ids = publicationIdentifiers(document, checked).entries;
  if (ids.length) {
    const list = doc.createElement('dl'); list.className = 'publication-identifiers';
    for (const entry of ids) {
      const term = doc.createElement('dt'); term.textContent = entry.label;
      const value = doc.createElement('dd'); value.dataset.state = entry.state;
      if (entry.href) { const a = doc.createElement('a'); a.href = entry.href; a.rel = 'noreferrer noopener'; a.target = '_blank'; a.textContent = entry.value; value.append(a); }
      else value.textContent = entry.value;
      if (entry.state !== 'declared') value.title = entry.state === 'refused' ? 'Malformed value refused; not yet assigned' : 'Not yet assigned';
      list.append(term, value);
    }
    front.append(list);
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
    if (node.parentElement.closest('a,button,pre,code,h1,h2,h3,h4,.block-label,svg,figcaption,.content-advisory')) continue;
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
    type: /^[a-z-]{2,30}$/.test(b.type || '') ? b.type : '',
    doi: typeof b.doi === 'string' && /^10\.\d{4,9}\/\S{1,250}$/.test(b.doi) ? b.doi : '',
    pmid: typeof b.pmid === 'string' && /^\d{1,9}$/.test(b.pmid) ? b.pmid : '',
    isbn: text(b.isbn).slice(0, 20),
    design: /^[a-z][a-z0-9-]{1,40}$/.test(b.design || '') ? b.design : '',
    n: count(b.n), k: count(b.k),
    language: /^[a-z]{2,3}(?:-[A-Za-z0-9]{2,8})?$/.test(b.language || '') ? b.language : '',
    checked: b.checked && typeof b.checked === 'object' && text(b.checked.via) && isoDate(b.checked.date) ? { via: text(b.checked.via).slice(0, 60), date: b.checked.date } : null,
  };
}

function evidenceHTML(entry, b) {
  const g = entry.grade;
  const parts = [];
  if (g?.grade) parts.push(`<span class="grade-badge" data-grade="${escapeHTML(g.grade)}">Grade ${escapeHTML(g.grade)}</span> ${escapeHTML(g.label)}`);
  else if (g?.state === 'context') parts.push('<span class="grade-badge" data-grade="context">Context</span> not graded');
  const detail = [b.design && b.design.replace(/-/g, ' '), b.k && `k = ${b.k}`, b.n && `n = ${b.n}`].filter(Boolean).join(' · ');
  if (!parts.length && !detail) return '';
  return `<div class="bib-evidence">${parts.join('')}${detail ? `<span class="bib-design">${escapeHTML(detail)}</span>` : ''}${g?.grade ? '<span class="bib-caveat">Inferred from the declared design; an authored classification, not a quality appraisal.</span>' : ''}</div>`;
}

export function bibliographyHTML(entry) {
  if (entry.note) {
    // Note content is the renderer's own escaped output, captured before decoration.
    return `<div class="bib-byline">Author's note</div><div class="bib-note">${entry.source.html}</div>`;
  }
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
    + evidenceHTML(entry, b)
    + ((b.doi || b.pmid || b.isbn || b.type || b.language) ? `<div class="bib-identifiers">${[b.type && escapeHTML(b.type), b.doi && `DOI ${escapeHTML(b.doi)}`, b.pmid && `PMID ${escapeHTML(b.pmid)}`, b.isbn && `ISBN ${escapeHTML(b.isbn)}`, b.language && `lang ${escapeHTML(b.language)}`].filter(Boolean).join(' · ')}</div>` : '')
    + (b.checked ? `<div class="bib-checked">Metadata checked via ${escapeHTML(b.checked.via)} on ${escapeHTML(b.checked.date)} · not content verification</div>` : '')
    + `<div class="bib-coverage">${escapeHTML(b.coverage)} · not a freshness or authorship assertion</div>`
    + `<div class="bib-actions">${entry.declared ? `<button type="button" data-source="${escapeHTML(entry.id)}">Read source</button>` : ''}`
    + (b.url ? `<a href="${escapeHTML(b.url)}" target="_blank" rel="noreferrer noopener">Original ↗</a>` : '') + '</div>';
}

/** Presentation-only enhancement of safe renderer output. Source bytes and
 * immutable references are not rewritten. Hovering never fetches a source. */
export function decorateCitations(root, sources, excludeIds = [], document = {}) {
  const doc = root.ownerDocument;
  let scaled;
  try { scaled = evidenceScale(document); } catch { scaled = evidenceScale(); }
  let noteCount = 0;
  const declared = new Map(sources.map(s => [s.id, s]));
  const urls = new Map(sources.map(s => [citationKey(s.url), s]).filter(([key]) => key));
  const entries = [], byKey = new Map(), byId = new Map();
  for (const node of [...root.querySelectorAll('[data-source], [data-entity], a[href], .author-note')]) {
    if (node.closest('pre, code') || !node.isConnected || node.parentElement?.closest('.author-note')) continue;
    if (node.matches('.author-note')) {
      const id = `note:${++noteCount}`; // ':' is outside declared source ids [\w.-]
      const entry = { number: entries.length + 1, id, source: { id, title: "Author's note", html: node.innerHTML }, declared: false, note: true };
      entries.push(entry); byId.set(id, entry);
      const sup = doc.createElement('sup'); sup.className = 'citation note-citation';
      const button = doc.createElement('button');
      button.type = 'button'; button.className = 'citation-mark'; button.dataset.citation = id;
      button.textContent = String(entry.number);
      button.setAttribute('aria-label', `Note ${entry.number}: ${node.textContent.trim().slice(0, 160)}`);
      button.setAttribute('aria-controls', 'citation-card'); button.setAttribute('aria-expanded', 'false');
      sup.append(button);
      const before = node.previousSibling;
      if (before?.nodeType === 3) before.textContent = before.textContent.replace(/\s+$/u, '');
      node.replaceWith(sup);
      continue;
    }
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
      entry = { number: entries.length + 1, id: source.id, source, declared: known && !entity, entity: Boolean(entity), grade: known && !entity ? evidenceGrade(source, scaled) : null, occurrences: [] };
      entries.push(entry); byKey.set(identity, entry); byId.set(entry.id, entry);
    }
    const sup = doc.createElement('sup'); sup.className = 'citation';
    const button = doc.createElement('button');
    button.type = 'button'; button.className = 'citation-mark'; button.dataset.citation = entry.id;
    button.textContent = String(entry.number);
    if (entry.grade?.grade) button.dataset.grade = entry.grade.grade;
    else if (entry.grade?.state === 'context') button.dataset.grade = 'context';
    entry.occurrences?.push(button);
    button.setAttribute('aria-label', `Reference ${entry.number}${entry.grade?.grade ? `, evidence grade ${entry.grade.grade}` : ''}: ${bibliographyData(entry.source).title}`);
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
      const title = doc.createElement('h2'); title.id = 'reader-bibliography'; title.textContent = entries.some(e => e.entity || e.note) ? 'Notes and references' : 'References'; section.append(title);
    }
    section.setAttribute('aria-label', 'Bibliography');
    const list = doc.createElement('ol');
    for (const entry of entries) {
      const li = doc.createElement('li'); li.id = `reference-${entry.number}`; li.value = entry.number;
      if (entry.grade?.grade) li.dataset.grade = entry.grade.grade;
      li.innerHTML = bibliographyHTML(entry); list.append(li);
    }
    section.append(list); root.append(section);
  }
  return { entries, byId, scale: scaled };
}
