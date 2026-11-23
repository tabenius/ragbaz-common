// Evidence map: grades are inferred from each declared source's design and are
// navigational aids, not appraisals. Nothing here fetches or rewrites sources.
import { bibliographyData } from './citations.js';

const FILTER_KEY = 'ragbaz.sci.grades';
const label = entry => {
  const b = bibliographyData(entry.source);
  const lead = (b.authors || '').split(/[;,]/)[0].trim();
  return [lead, b.year].filter(Boolean).join(' ') || b.title;
};
const bucket = entry => entry.grade?.grade || (entry.grade?.state === 'context' ? 'context' : 'ungraded');

/** Sections each citation sits in, keyed by heading id, in document order. */
function sectionOf(node, headings) {
  let current = null;
  for (const heading of headings) {
    if (heading.compareDocumentPosition(node) & Node.DOCUMENT_POSITION_FOLLOWING) current = heading; else break;
  }
  return current;
}

export function setupEvidence({ status = () => {}, closeOthers = () => {} } = {}) {
  const $ = id => document.getElementById(id);
  const panel = $('evidence-panel'), list = $('evidence-list'), filters = $('evidence-filters'), toggle = $('show-grades');
  let state = { groups: [], order: [], filter: 'all', cursor: -1, citations: null };
  let gradesOn = true;
  try { gradesOn = localStorage.getItem(FILTER_KEY) !== 'off'; } catch { /* session-only */ }
  const applyGrades = () => { document.body.dataset.grades = gradesOn ? 'on' : 'off'; toggle.checked = gradesOn; };
  toggle.addEventListener('change', () => { gradesOn = toggle.checked; try { localStorage.setItem(FILTER_KEY, gradesOn ? 'on' : 'off'); } catch { /* ignore */ } applyGrades(); });
  applyGrades();

  function matching() {
    return state.order.filter(button => button.isConnected && (state.filter === 'all' || button.dataset.grade === state.filter || (state.filter === 'ungraded' && !button.dataset.grade)));
  }
  function highlight(entry) {
    document.querySelectorAll('.citation-current').forEach(n => n.classList.remove('citation-current'));
    entry?.occurrences.forEach(button => button.classList.add('citation-current'));
  }
  function jumpTo(button, message) {
    if (!button) return;
    close(false);
    button.scrollIntoView({ block: 'center', behavior: 'instant' });
    button.focus({ preventScroll: true });
    status(message);
  }
  function step(direction) {
    const targets = matching();
    if (!targets.length) { status(state.filter === 'all' ? 'No graded citations in this document.' : `No citations with filter ${state.filter}.`); return; }
    const active = document.activeElement?.closest?.('.citation-mark');
    let index = targets.indexOf(active);
    if (index < 0) {
      const y = innerHeight / 3;
      index = direction > 0 ? targets.findIndex(b => b.getBoundingClientRect().top > y) : targets.findLastIndex(b => b.getBoundingClientRect().top < y);
      if (index < 0) index = direction > 0 ? 0 : targets.length - 1;
    } else index = (index + direction + targets.length) % targets.length;
    const button = targets[index];
    jumpTo(button, `${state.filter === 'all' ? 'Citation' : `Grade ${state.filter} citation`} ${index + 1} of ${targets.length}.`);
  }
  function setFilter(value) {
    state.filter = value;
    filters.querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.filter === value)));
    list.querySelectorAll('[data-group]').forEach(g => { g.hidden = value !== 'all' && g.dataset.group !== value; });
    status(value === 'all' ? 'Showing all evidence.' : `Filter: ${value}. n / Shift+N step through these citations.`);
  }
  function items() { return [...list.querySelectorAll('.evidence-item')].filter(i => !i.closest('[hidden]')); }
  function open() {
    closeOthers();
    panel.hidden = false;
    (items()[Math.max(0, state.cursor)] || filters.querySelector('button'))?.focus({ preventScroll: true });
  }
  function close(restore = true) {
    if (panel.hidden) return;
    panel.hidden = true;
    if (restore) document.getElementById('paper').focus({ preventScroll: true });
  }
  $('close-evidence').addEventListener('click', () => close());
  panel.addEventListener('keydown', e => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const all = items(), index = all.indexOf(document.activeElement);
    const move = to => { e.preventDefault(); state.cursor = Math.max(0, Math.min(all.length - 1, to)); all[state.cursor]?.focus({ preventScroll: false }); };
    if (['ArrowDown', 'j'].includes(e.key)) move(index + 1);
    else if (['ArrowUp', 'k'].includes(e.key)) move(index - 1);
    else if (e.key === 'Home') move(0);
    else if (e.key === 'End') move(all.length - 1);
    else if (['ArrowRight', 'l', 'ArrowLeft', 'h'].includes(e.key) && !e.target.closest('.evidence-filters')) {
      // h/l move between grade groups, mirroring the reader's horizontal keys.
      e.preventDefault();
      const groups = [...list.querySelectorAll('[data-group]:not([hidden])')];
      const current = groups.indexOf(document.activeElement?.closest('[data-group]'));
      const next = groups[Math.max(0, Math.min(groups.length - 1, current + (['ArrowRight', 'l'].includes(e.key) ? 1 : -1)))];
      next?.querySelector('.evidence-item')?.focus();
    } else if (['[', ']'].includes(e.key)) {
      e.preventDefault();
      const buttons = [...filters.querySelectorAll('button')];
      const i = buttons.findIndex(b => b.getAttribute('aria-pressed') === 'true');
      const next = buttons[(i + (e.key === ']' ? 1 : -1) + buttons.length) % buttons.length];
      setFilter(next.dataset.filter);
    } else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(); }
  });

  function update(citations, root) {
    state = { ...state, citations, order: [], cursor: -1 };
    const entries = citations.entries.filter(e => !e.entity && !e.note && e.occurrences);
    state.order = [...root.querySelectorAll('.citation-mark')].filter(b => entries.some(e => e.occurrences.includes(b)));
    const headings = [...root.querySelectorAll('h1[id],h2[id],h3[id]')];
    const scale = citations.scale.scale;
    const groups = [...scale.map(level => ({ id: level.grade, title: `Grade ${level.grade}`, description: level.label })),
      { id: 'context', title: 'Context', description: 'Law, standards, reports and methods — informative, not graded' },
      { id: 'ungraded', title: 'Ungraded', description: 'No study design declared' }];
    const counts = Object.fromEntries(groups.map(g => [g.id, 0]));
    entries.forEach(e => { counts[bucket(e)] += 1; });
    filters.replaceChildren(...[{ id: 'all', title: 'All' }, ...groups.filter(g => counts[g.id])].map(g => {
      const b = document.createElement('button'); b.type = 'button'; b.dataset.filter = g.id;
      b.textContent = g.id === 'all' ? `All · ${entries.length}` : `${g.id === 'context' || g.id === 'ungraded' ? g.title : g.id} · ${counts[g.id]}`;
      b.setAttribute('aria-pressed', 'false'); b.addEventListener('click', () => setFilter(g.id));
      return b;
    }));
    list.replaceChildren(...groups.filter(g => counts[g.id]).map(g => {
      const section = document.createElement('section'); section.dataset.group = g.id;
      const h = document.createElement('h3'); h.textContent = `${g.title} · ${counts[g.id]}`;
      const p = document.createElement('p'); p.className = 'evidence-group-label'; p.textContent = g.description;
      section.append(h, p);
      for (const entry of entries.filter(e => bucket(e) === g.id)) {
        const b = bibliographyData(entry.source);
        const item = document.createElement('button'); item.type = 'button'; item.className = 'evidence-item';
        const sections = [...new Set(entry.occurrences.map(o => sectionOf(o, headings)?.textContent.trim()).filter(Boolean))];
        const main = document.createElement('span'); main.className = 'evidence-title'; main.textContent = `[${entry.number}] ${label(entry)}`;
        const meta = document.createElement('span'); meta.className = 'evidence-meta';
        meta.textContent = [b.design.replace(/-/g, ' '), b.k && `k ${b.k}`, b.n && `n ${b.n}`, `${entry.occurrences.length}×`].filter(Boolean).join(' · ');
        const where = document.createElement('span'); where.className = 'evidence-sections'; where.textContent = sections.join(' · ');
        item.append(main, meta, where);
        item.setAttribute('aria-label', `${b.title}. ${g.title}. Cited ${entry.occurrences.length} times. Enter jumps to the next citation.`);
        let visit = 0;
        item.addEventListener('click', () => {
          highlight(entry);
          const target = entry.occurrences[visit % entry.occurrences.length];
          visit += 1;
          jumpTo(target, `Reference ${entry.number}, citation ${((visit - 1) % entry.occurrences.length) + 1} of ${entry.occurrences.length}.`);
        });
        section.append(item);
      }
      return section;
    }));
    // Contents entries show which grades each section cites.
    const toc = document.getElementById('toc');
    headings.forEach((heading, i) => {
      const next = headings[i + 1];
      const grades = new Set(state.order.filter(b => (heading.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING) && (!next || (next.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_PRECEDING))).map(b => b.dataset.grade).filter(g => g && g !== 'context'));
      const link = toc?.querySelector(`a[href="#${CSS.escape(heading.id)}"]`);
      if (!link || !grades.size) return;
      const span = document.createElement('span'); span.className = 'toc-grades'; span.setAttribute('aria-label', `cites grades ${[...grades].sort().join(', ')}`);
      span.textContent = [...grades].sort().join(' ');
      link.append(span);
    });
    $('open-evidence').disabled = !entries.length;
    setFilter('all');
    appendSummary(root, groups, entries);
  }

  /** In-document evidence index, printed with the paper. */
  function appendSummary(root, groups, entries) {
    const graded = entries.filter(e => e.grade?.grade);
    if (!graded.length) return;
    const section = document.createElement('section'); section.className = 'evidence-summary'; section.setAttribute('aria-label', 'Evidence by grade');
    const h = document.createElement('h2'); h.id = 'reader-evidence'; h.textContent = 'Evidence by grade';
    const p = document.createElement('p'); p.className = 'evidence-caveat';
    p.textContent = 'Grades are inferred from each source\'s declared study design. They classify the kind of evidence, not its quality.';
    section.append(h, p);
    for (const g of groups) {
      const members = entries.filter(e => bucket(e) === g.id);
      if (!members.length) continue;
      const h3 = document.createElement('h3'); h3.textContent = `${g.title} — ${g.description}`;
      const ul = document.createElement('ul');
      for (const entry of members) {
        const li = document.createElement('li'); const a = document.createElement('a');
        a.href = `#reference-${entry.number}`; a.textContent = `[${entry.number}] ${bibliographyData(entry.source).title}`;
        li.append(a); ul.append(li);
      }
      section.append(h3, ul);
    }
    root.append(section);
    const toc = document.getElementById('toc');
    if (toc && !toc.querySelector('a[href="#reader-evidence"]')) {
      const link = document.createElement('a'); link.dataset.level = '2'; link.href = '#reader-evidence'; link.textContent = 'Evidence by grade';
      toc.append(link);
    }
  }

  return { update, open, close, toggle: () => (panel.hidden ? open() : close()), step, isOpen: () => !panel.hidden };
}
