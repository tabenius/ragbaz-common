/** Data-only visualization interchange. No imports, I/O or library execution. */
export const VISUALIZATION_FORMATS = Object.freeze(['mermaid', 'plantuml', 'cytoscape', 'chartjs', 'vega-lite', 'plotly']);
const forbidden = new Set(['__proto__', 'prototype', 'constructor']);
const encoder = new TextEncoder();
const fail = message => { throw new Error(`Visualization refused: ${message}`); };
function inspect(value, depth = 0, budget = { count: 0 }) {
  if (depth > 32 || ++budget.count > 20000) fail('structure budget exceeded');
  if (value === null || typeof value === 'boolean') return;
  if (typeof value === 'number') { if (!Number.isFinite(value) || (Number.isInteger(value) && !Number.isSafeInteger(value))) fail('finite JSON-safe number required'); return; }
  if (typeof value === 'string') { if (value.length > 20000) fail('string budget exceeded'); return; }
  if (!value || typeof value !== 'object') fail('JSON data required');
  if (!Array.isArray(value) && Object.getPrototypeOf(value) !== Object.prototype) fail('plain objects required');
  for (const [key, child] of Object.entries(value)) {
    // No callbacks, computed expressions, external sources or HTML tooltips.
    if (forbidden.has(key) || /^(url|href|src|image|images|expression|expr|signal|signals|on|events|plugins|formatter|formatters|callback|callbacks|transform|transforms)$/i.test(key)) fail(`unsupported field ${key}`);
    inspect(child, depth + 1, budget);
  }
}
function keys(object, allowed) {
  if (!object || typeof object !== 'object' || Array.isArray(object)) fail('object required');
  if (Object.keys(object).some(key => !allowed.includes(key))) fail('unsupported specification field');
}
function text(value) { if (typeof value !== 'string' || !value.trim().length || value.length > 500) fail('bounded nonempty text required'); return value; }
function values(value) { if (!Array.isArray(value) || value.length > 1000 || value.some(v => typeof v !== 'number' || !Number.isFinite(v))) fail('at most 1000 finite numeric values required'); return value; }
function labels(value) { if (!Array.isArray(value) || !value.length || value.length > 1000) fail('1–1000 labels required'); return value.map(text); }

/** Restricted profiles, not general-purpose library configurations. */
export function parseVisualization(format, source, { alt } = {}) {
  if (!VISUALIZATION_FORMATS.includes(format)) fail('unknown format');
  text(alt);
  if (typeof source !== 'string' || encoder.encode(source).length > 100000) fail('source exceeds 100 KB');
  if (!source.trim()) fail('empty source');
  if (format === 'mermaid' || format === 'plantuml') {
    // These languages remain inert until a separately reviewed local renderer is installed.
    // Explicitly refuse renderer directives/includes even in the source-only profile.
    if (format === 'mermaid' && (/%%\s*\{/.test(source) || /^\s*(?:click|style|classDef|linkStyle)\b/im.test(source))) fail('Mermaid directives/actions/styles are unsupported');
    if (format === 'plantuml' && (/^\s*!/m.test(source) || /\[\[|<img\b|<iframe\b/i.test(source))) fail('PlantUML preprocessing, links and embedded resources are unsupported');
    return { format, alt, source, data: null, fallback: { columns: ['Source'], rows: [[source]] }, rendering: 'source-only' };
  }
  let data;
  try { data = JSON.parse(source); } catch { fail('invalid JSON'); }
  inspect(data);
  let fallback;
  if (format === 'cytoscape') {
    keys(data, ['nodes', 'edges']);
    if (!Array.isArray(data.nodes) || data.nodes.length > 300 || !Array.isArray(data.edges) || data.edges.length > 1000) fail('graph budget exceeded');
    const ids = new Set();
    for (const node of data.nodes) { keys(node, ['id', 'label']); text(node.id); text(node.label); if (ids.has(node.id)) fail('duplicate node'); ids.add(node.id); }
    for (const edge of data.edges) { keys(edge, ['source', 'target', 'label']); if (!ids.has(edge.source) || !ids.has(edge.target)) fail('missing endpoint'); if (edge.label !== undefined) text(edge.label); }
    fallback = { columns: ['Kind', 'ID / source', 'Label / target'], rows: [...data.nodes.map(n => ['node', n.id, n.label]), ...data.edges.map(e => ['edge', e.source, e.target + (e.label ? ` · ${e.label}` : '')])] };
  } else if (format === 'chartjs') {
    keys(data, ['type', 'data']);
    if (!['bar', 'line'].includes(data.type)) fail('unsupported chart type');
    keys(data.data, ['labels', 'datasets']); const names = labels(data.data.labels);
    if (!Array.isArray(data.data.datasets) || !data.data.datasets.length || data.data.datasets.length > 20) fail('1–20 datasets required');
    const series = data.data.datasets.map(s => { keys(s, ['label', 'data']); text(s.label); values(s.data); if (s.data.length !== names.length) fail('series length mismatch'); return s; });
    fallback = { columns: ['Label', ...series.map(s => s.label)], rows: names.map((name, i) => [name, ...series.map(s => s.data[i])]) };
  } else if (format === 'plotly') {
    keys(data, ['data']);
    if (!Array.isArray(data.data) || !data.data.length || data.data.length > 20) fail('1–20 traces required');
    const rows = [];
    for (const trace of data.data) { keys(trace, ['name', 'type', 'mode', 'x', 'y']); text(trace.name); if (!['bar', 'scatter'].includes(trace.type) || (trace.mode !== undefined && !['lines', 'markers', 'lines+markers'].includes(trace.mode))) fail('unsupported trace'); const x = labels(trace.x); values(trace.y); if (x.length !== trace.y.length) fail('trace length mismatch'); x.forEach((v, i) => rows.push([trace.name, v, trace.y[i]])); }
    fallback = { columns: ['Series', 'X', 'Y'], rows };
  } else {
    keys(data, ['mark', 'data', 'encoding']);
    if (!['bar', 'line', 'point'].includes(data.mark)) fail('unsupported Vega-Lite mark');
    keys(data.data, ['values']); keys(data.encoding, ['x', 'y']);
    for (const axis of ['x', 'y']) { keys(data.encoding[axis], ['field', 'type']); text(data.encoding[axis].field); if (!['nominal', 'ordinal', 'quantitative'].includes(data.encoding[axis].type)) fail('unsupported encoding'); }
    if (!Array.isArray(data.data.values) || !data.data.values.length || data.data.values.length > 1000) fail('1–1000 inline rows required');
    const columns = ['x', 'y'].map(axis => data.encoding[axis].field);
    const rows = data.data.values.map(row => { keys(row, columns); return ['x', 'y'].map((axis, i) => { const value = row[columns[i]]; if (data.encoding[axis].type === 'quantitative') { values([value]); return value; } return text(value); }); });
    fallback = { columns, rows };
  }
  return { format, alt, source, data, fallback, rendering: 'table-only' };
}

const escape = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
/** Accessible HTML projection; source and data are always text, never markup. */
export function visualizationHTML(record) {
  // Revalidate rather than trusting callers to pass an authentic parser result.
  const value = parseVisualization(record.format, record.source, { alt: record.alt });
  const { columns, rows } = value.fallback;
  const table = value.data ? `<table><thead><tr>${columns.map(c => `<th scope="col">${escape(c)}</th>`).join('')}</tr></thead><tbody>${rows.map(row => `<tr>${row.map(cell => `<td>${escape(cell)}</td>`).join('')}</tr>`).join('')}</tbody></table>` : '';
  return `<figure class="visualization"><figcaption>${escape(value.alt)}</figcaption><p>${escape(value.format)} · ${value.rendering}; graphical adapter not installed.</p>${table}<details open><summary>Inspect visualization source</summary><pre><code>${escape(value.source)}</code></pre></details></figure>`;
}
