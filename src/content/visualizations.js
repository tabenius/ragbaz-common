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
  return { format, alt, source, data, fallback, rendering: 'static-svg' };
}

const escape = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const COLORS = Object.freeze(['#2f6f8f', '#b5651d', '#4f7d3a', '#8a4f8f', '#8c2f2f', '#5a5a8c', '#7a5c2e', '#2f7a6f']);
const el = (name, attributes = {}, children = []) => ({ name, attributes, children });
const number = value => Number(value.toFixed(2)).toString();
const truncate = (value, length) => { const oneLine = String(value).replace(/\s+/g, ' ').trim(); return oneLine.length > length ? `${oneLine.slice(0, length - 1)}…` : oneLine; };
function stableId(value) {
  let hash = 2166136261;
  for (const character of value) { hash ^= character.codePointAt(0); hash = Math.imul(hash, 16777619); }
  return `viz-${(hash >>> 0).toString(16).padStart(8, '0')}`;
}

function chartModel(value) {
  if (value.format === 'chartjs') {
    const data = value.data;
    return { kind: data.type === 'line' ? 'line' : 'bar', categories: data.data.labels, series: data.data.datasets.map(s => ({ label: s.label, values: s.data })) };
  }
  if (value.format === 'vega-lite') {
    const data = value.data;
    const categories = value.fallback.rows.map(row => String(row[0]));
    return { kind: data.mark === 'bar' ? 'bar' : data.mark === 'line' ? 'line' : 'point', categories, series: [{ label: value.fallback.columns[1], values: value.fallback.rows.map(row => row[1]) }] };
  }
  if (value.format === 'plotly') {
    const traces = value.data.data;
    const categories = [];
    for (const trace of traces) for (const x of trace.x) if (!categories.includes(x)) categories.push(x);
    const kind = traces.some(t => t.type === 'scatter' && (!t.mode || t.mode === 'markers')) ? 'point' : traces.some(t => t.type === 'scatter') ? 'line' : 'bar';
    const series = traces.map(trace => ({ label: trace.name, values: categories.map(category => { const index = trace.x.indexOf(category); return index < 0 ? null : trace.y[index]; }) }));
    return { kind, categories, series };
  }
  return null;
}

function chartTree(value, id) {
  const model = chartModel(value);
  if (!model) return null;
  const width = 720, height = 400, left = 64, top = 74, plotWidth = 600, plotHeight = 254;
  const numeric = model.series.flatMap(series => series.values).filter(value => typeof value === 'number' && Number.isFinite(value));
  let minimum = Math.min(...numeric), maximum = Math.max(...numeric);
  if (model.kind === 'bar') { minimum = Math.min(0, minimum); maximum = Math.max(0, maximum); }
  if (minimum === maximum) { minimum -= 1; maximum += 1; }
  const span = maximum - minimum, pad = span * 0.08; minimum -= pad; maximum += pad;
  const y = value => top + plotHeight - ((value - minimum) / (maximum - minimum)) * plotHeight;
  const baseline = y(model.kind === 'bar' ? 0 : minimum);
  const count = model.categories.length;
  const x = index => left + (count === 1 ? plotWidth / 2 : (index / (count - 1)) * plotWidth);
  const group = plotWidth / count;
  const children = [
    el('title', { id: `${id}-title` }, [value.alt]),
    el('desc', { id: `${id}-desc` }, [`Static SVG from ${value.format} data. Exact values remain in the adjacent table.`]),
    el('rect', { x: number(left), y: number(top), width: number(plotWidth), height: number(plotHeight), fill: '#ffffff', stroke: '#888888' }),
  ];
  for (let tick = 0; tick <= 4; tick++) {
    const tickValue = minimum + ((maximum - minimum) * tick) / 4;
    const tickY = y(tickValue);
    children.push(el('line', { x1: number(left), y1: number(tickY), x2: number(left + plotWidth), y2: number(tickY), stroke: '#dddddd', 'stroke-width': '1' }));
    children.push(el('text', { x: number(left - 8), y: number(tickY + 4), fill: '#444444', 'font-size': '11', 'text-anchor': 'end', 'font-family': 'system-ui,sans-serif' }, [number(tickValue)]));
  }
  children.push(el('line', { x1: number(left), y1: number(baseline), x2: number(left + plotWidth), y2: number(baseline), stroke: '#666666', 'stroke-width': '1' }));
  const step = Math.max(1, Math.ceil(count / 12));
  model.categories.forEach((category, index) => {
    if (index % step && index !== count - 1) return;
    children.push(el('text', { x: number(x(index)), y: number(top + plotHeight + 18), fill: '#333333', 'font-size': '11', 'text-anchor': 'middle', 'font-family': 'system-ui,sans-serif' }, [truncate(category, 12)]));
  });
  if (model.kind === 'bar') {
    const barWidth = Math.max(1.5, (group * 0.72) / model.series.length);
    model.series.forEach((series, seriesIndex) => series.values.forEach((entry, index) => {
      if (typeof entry !== 'number') return;
      const entryY = y(entry);
      children.push(el('rect', {
        x: number(left + index * group + group * 0.14 + seriesIndex * barWidth),
        y: number(Math.min(entryY, baseline)), width: number(barWidth),
        height: number(Math.max(0.6, Math.abs(baseline - entryY))), fill: COLORS[seriesIndex % COLORS.length],
      }));
    }));
  } else {
    model.series.forEach((series, seriesIndex) => {
      if (model.kind === 'line') {
        const points = series.values.map((entry, index) => typeof entry === 'number' ? `${number(x(index))},${number(y(entry))}` : null).filter(Boolean).join(' ');
        if (points) children.push(el('polyline', { points, fill: 'none', stroke: COLORS[seriesIndex % COLORS.length], 'stroke-width': '2.5', 'stroke-linejoin': 'round' }));
      }
      series.values.forEach((entry, index) => { if (typeof entry === 'number') children.push(el('circle', { cx: number(x(index)), cy: number(y(entry)), r: '4', fill: COLORS[seriesIndex % COLORS.length], stroke: '#ffffff', 'stroke-width': '1' })); });
    });
  }
  const legend = model.series.map((series, index) => ({ text: truncate(series.label, 22), color: COLORS[index % COLORS.length] }));
  const legendWidth = Math.max(...legend.map(item => item.text.length)) * 6.5 + 30;
  const perRow = Math.max(1, Math.floor(680 / legendWidth));
  legend.forEach((item, index) => {
    const row = Math.floor(index / perRow), column = index % perRow;
    const itemX = left + (column * 680) / perRow, itemY = 30 + row * 20;
    children.push(el('rect', { x: number(itemX), y: number(itemY - 9), width: '10', height: '10', fill: item.color }));
    children.push(el('text', { x: number(itemX + 15), y: number(itemY), fill: '#333333', 'font-size': '11', 'font-family': 'system-ui,sans-serif' }, [item.text]));
  });
  return el('svg', { viewBox: `0 0 ${width} ${height}`, width: String(width), height: String(height), role: 'img', 'aria-labelledby': `${id}-title ${id}-desc`, class: 'visualization-graphic' }, children);
}

function graphTree(value, id) {
  const width = 720, height = 480, centerX = 360, centerY = 252, radius = 178;
  const nodes = value.data.nodes;
  const position = new Map(nodes.map((node, index) => [node.id, {
    x: nodes.length === 1 ? centerX : centerX + radius * Math.cos((2 * Math.PI * index) / nodes.length),
    y: nodes.length === 1 ? centerY : centerY + radius * Math.sin((2 * Math.PI * index) / nodes.length),
  }]));
  const children = [
    el('title', { id: `${id}-title` }, [value.alt]),
    el('desc', { id: `${id}-desc` }, [`Static circular layout from ${value.format} data. Relationship values remain in the adjacent table.`]),
    el('defs', {}, [el('marker', { id: `${id}-arrow`, markerWidth: '8', markerHeight: '8', refX: '7', refY: '4', orient: 'auto', markerUnits: 'strokeWidth' }, [el('path', { d: 'M0,0 L8,4 L0,8 Z', fill: '#666666' })])]),
  ];
  const showEdgeLabels = value.data.edges.length <= 20;
  for (const edge of value.data.edges) {
    const from = position.get(edge.source), to = position.get(edge.target);
    if (!from || !to || (from === to)) continue;
    children.push(el('line', { x1: number(from.x), y1: number(from.y), x2: number(to.x), y2: number(to.y), stroke: '#888888', 'stroke-width': '1.5', 'marker-end': `url(#${id}-arrow)` }));
    if (showEdgeLabels && edge.label) children.push(el('text', { x: number((from.x + to.x) / 2), y: number((from.y + to.y) / 2 - 4), fill: '#555555', 'font-size': '9', 'text-anchor': 'middle', 'font-family': 'system-ui,sans-serif' }, [truncate(edge.label, 18)]));
  }
  nodes.forEach((node, index) => {
    const point = position.get(node.id);
    children.push(el('circle', { cx: number(point.x), cy: number(point.y), r: '20', fill: COLORS[index % COLORS.length], stroke: '#ffffff', 'stroke-width': '2' }));
    children.push(el('text', { x: number(point.x), y: number(point.y + 34), fill: '#222222', 'font-size': '11', 'text-anchor': 'middle', 'font-family': 'system-ui,sans-serif' }, [truncate(node.label, 20)]));
  });
  return el('svg', { viewBox: `0 0 ${width} ${height}`, width: String(width), height: String(height), role: 'img', 'aria-labelledby': `${id}-title ${id}-desc`, class: 'visualization-graphic' }, children);
}

/** Deterministic, script-free graphic tree, or null for source-only formats. */
export function visualizationGraphic(record) {
  const value = parseVisualization(record.format, record.source, { alt: record.alt });
  if (!value.data) return null;
  const id = stableId(`${value.format}\0${value.alt}\0${value.source}`);
  return value.format === 'cytoscape' ? graphTree(value, id) : chartTree(value, id);
}

const SVG_ATTRIBUTES = Object.freeze({
  svg: ['viewBox', 'width', 'height', 'role', 'aria-labelledby', 'class'],
  g: ['class'], title: ['id'], desc: ['id'], defs: [],
  marker: ['id', 'markerWidth', 'markerHeight', 'refX', 'refY', 'orient', 'markerUnits'],
  path: ['d', 'fill'], rect: ['x', 'y', 'width', 'height', 'rx', 'fill', 'stroke'],
  line: ['x1', 'y1', 'x2', 'y2', 'stroke', 'stroke-width', 'marker-end'],
  circle: ['cx', 'cy', 'r', 'fill', 'stroke', 'stroke-width'],
  polyline: ['points', 'fill', 'stroke', 'stroke-width', 'stroke-linejoin'],
  text: ['x', 'y', 'fill', 'font-size', 'text-anchor', 'font-family'],
});
const numeric = /^-?\d{1,6}(?:\.\d{1,3})?$/;
const numericList = /^-?\d{1,6}(?:\.\d{1,3})?,-?\d{1,6}(?:\.\d{1,3})?(?: -?\d{1,6}(?:\.\d{1,3})?,-?\d{1,6}(?:\.\d{1,3})?)*$/;
const identifier = /^[A-Za-z][A-Za-z0-9_-]{0,80}$/;
const color = /^(?:#[0-9a-f]{6}|none)$/i;
export function isSafeSVGAttribute(name, key, value) {
  if (!SVG_ATTRIBUTES[name]?.includes(key)) return false;
  const text = String(value);
  if (['x', 'y', 'x1', 'y1', 'x2', 'y2', 'cx', 'cy', 'width', 'height', 'r', 'rx', 'refX', 'refY', 'markerWidth', 'markerHeight', 'font-size', 'stroke-width'].includes(key)) return numeric.test(text);
  if (['fill', 'stroke'].includes(key)) return color.test(text);
  if (key === 'points') return numericList.test(text);
  if (key === 'd') return /^[A-Za-z0-9 .,-]{1,400}$/.test(text);
  if (key === 'viewBox') return /^0 0 \d{1,4} \d{1,4}$/.test(text);
  if (key === 'role') return text === 'img';
  if (key === 'aria-labelledby') return text.split(' ').every(part => identifier.test(part));
  if (key === 'class') return /^[a-z -]{1,60}$/.test(text);
  if (key === 'id') return identifier.test(text);
  if (key === 'text-anchor') return ['start', 'middle', 'end'].includes(text);
  if (key === 'font-family') return /^[A-Za-z0-9 ,'-]{1,80}$/.test(text);
  if (key === 'stroke-linejoin') return ['round', 'miter', 'bevel'].includes(text);
  if (key === 'orient') return text === 'auto';
  if (key === 'markerUnits') return text === 'strokeWidth';
  if (key === 'marker-end') return /^url\(#[A-Za-z][A-Za-z0-9_-]{0,80}\)$/.test(text);
  return false;
}
/** Serialize only generated SVG trees with an attribute allowlist. */
export function serializeVisualizationGraphic(tree) {
  if (!tree || typeof tree !== 'object' || !SVG_ATTRIBUTES[tree.name]) fail('unsafe graphic tree');
  let attributes = '';
  for (const [key, value] of Object.entries(tree.attributes || {})) {
    if (!isSafeSVGAttribute(tree.name, key, value)) fail(`unsafe graphic attribute ${tree.name}.${key}`);
    attributes += ` ${key}="${escape(value)}"`;
  }
  return `<${tree.name}${attributes}>${(tree.children || []).map(child => typeof child === 'string' ? escape(child) : serializeVisualizationGraphic(child)).join('')}</${tree.name}>`;
}

/** Accessible HTML projection; source and data are always text, never markup. */
export function visualizationHTML(record) {
  // Revalidate rather than trusting callers to pass an authentic parser result.
  const value = parseVisualization(record.format, record.source, { alt: record.alt });
  const { columns, rows } = value.fallback;
  const graphic = visualizationGraphic(value);
  const table = value.data ? `<table><thead><tr>${columns.map(c => `<th scope="col">${escape(c)}</th>`).join('')}</tr></thead><tbody>${rows.map(row => `<tr>${row.map(cell => `<td>${escape(cell)}</td>`).join('')}</tr>`).join('')}</tbody></table>` : '';
  const projection = graphic ? serializeVisualizationGraphic(graphic) : '';
  return `<figure class="visualization"><figcaption>${escape(value.alt)}</figcaption>${projection}<p>${escape(value.format)} · ${graphic ? 'static SVG baseline' : 'source-only'}; library adapter not installed.${value.data ? ' Exact values remain in the table.' : ' Source is shown verbatim.'}</p>${table}<details open><summary>Inspect visualization source</summary><pre><code>${escape(value.source)}</code></pre></details></figure>`;
}
