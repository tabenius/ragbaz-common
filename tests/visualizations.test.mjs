import test from 'node:test';
import assert from 'node:assert/strict';
import { parseVisualization, visualizationHTML } from '../src/content/visualizations.js';
import { renderDocument } from '../src/content/markdoc-ragbaz.js';
const parse = (format, data) => parseVisualization(format, JSON.stringify(data), { alt: 'Authored observations, not verified statistics' });
test('visualization interchange preserves source text and never executes diagram languages', () => {
  for (const [format, source] of [['mermaid', 'graph TD\n A-->B'], ['plantuml', '@startuml\nAlice -> Bob\n@enduml']]) {
    const value = parseVisualization(format, source, { alt: 'A relationship' });
    assert.equal(value.source, source); assert.equal(value.rendering, 'source-only');
    assert.match(visualizationHTML(value), /graphical adapter not installed/);
  }
});
test('inline graph and chart profiles produce exact tabular fallbacks', () => {
  const graph = parse('cytoscape', { nodes: [{ id: 'edge:0', label: '<script>no</script>' }], edges: [{ source: 'edge:0', target: 'edge:0' }] });
  const html = visualizationHTML(graph); assert(!html.includes('<script>')); assert(html.includes('&lt;script&gt;'));
  assert.deepEqual(parse('chartjs', { type: 'bar', data: { labels: ['A'], datasets: [{ label: 'Count', data: [3] }] } }).fallback.rows, [['A', 3]]);
  assert.deepEqual(parse('plotly', { data: [{ name: 'Count', type: 'bar', x: ['A'], y: [3] }] }).fallback.rows, [['Count', 'A', 3]]);
  assert.deepEqual(parse('vega-lite', { mark: 'point', data: { values: [{ label: 'A', count: 3 }] }, encoding: { x: { field: 'label', type: 'nominal' }, y: { field: 'count', type: 'quantitative' } } }).fallback.rows, [['A', 3]]);
});
test('visualization profiles refuse external resources, expressions, callbacks and malformed data', () => {
  for (const data of [{ type: 'bar', data: { url: 'https://example.test' } }, { type: 'bar', plugins: [], data: {} }, { type: 'bar', data: { labels: ['A'], datasets: [{ label: 'Bad', data: [1, 2] }] } }]) assert.throws(() => parse('chartjs', data), /refused/);
  assert.throws(() => parse('cytoscape', { nodes: [], edges: [{ source: 'missing', target: 'missing' }] }), /endpoint/);
  assert.throws(() => parseVisualization('chartjs', '{"__proto__":{}}', { alt: 'Chart' }), /unsupported field/);
  for (const [format, source] of [['mermaid', '%%{init: {}}%%\ngraph TD'], ['plantuml', '!include https://example.test/private']]) assert.throws(() => parseVisualization(format, source, { alt: 'Chart' }), /unsupported/);
  assert.throws(() => parseVisualization('javascript', 'alert(1)', { alt: 'Chart' }), /unknown format/);
  assert.throws(() => parseVisualization('mermaid', 'graph TD'), /text required/);
  assert.throws(() => parseVisualization('mermaid', 'graph TD', { alt: '   ' }), /text required/);
  assert.throws(() => parse('chartjs', { type: 'bar', data: { labels: ['A'], datasets: [{ label: 'Count', data: [9007199254740992] }] } }), /JSON-safe/);
  assert.throws(() => parseVisualization('mermaid', 'x'.repeat(100001), { alt: 'Chart' }), /100 KB/);
});
test('forged projection objects cannot inject HTML or suppress revalidation', () => {
  const value = parseVisualization('mermaid', 'graph TD', { alt: '<img src=x onerror=alert(1)>' });
  assert(!visualizationHTML({ ...value, fallback: { rows: ['<script>'] } }).includes('<img'));
  assert.throws(() => visualizationHTML({ ...value, format: 'unknown' }), /unknown format/);
});
test('Markdoc visualization fences are opt-in and descriptions/refusals stay explicit', async () => {
  const source = '# Chart\n\n```chartjs\n{"type":"bar","data":{"labels":["<script>"],"datasets":[{"label":"Count","data":[3]}]}}\n```\n';
  const ordinary = await renderDocument(source);
  assert(ordinary.clean); assert(!ordinary.html.includes('<figure')); assert.equal(ordinary.visualizations, undefined);
  const enabled = await renderDocument(source, { visualizations: { descriptions: { 1: 'Counts by category' } } });
  assert(enabled.clean); assert(enabled.html.includes('<figure')); assert(enabled.html.includes('<table>')); assert(!enabled.html.includes('<script>')); assert.equal(enabled.visualizations.length, 1);
  const refused = await renderDocument(source, { visualizations: {} });
  assert(!refused.clean); assert.match(refused.html, /Visualization refused/); assert.equal(refused.visualizations.length, 0);
});
