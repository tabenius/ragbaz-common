// Host-owned interactive adapters for the restricted visualization profiles.
// Authored data is parsed and validated again before either library sees it.
import {
  BarController, BarElement, CategoryScale, Chart, Legend, LineController,
  LineElement, LinearScale, PointElement, Tooltip,
} from 'chart.js';
import cytoscape from 'cytoscape';
import { parseVisualization } from '../../src/content/visualizations.js';
import { mountThreeScene } from '../../src/content/three-adapter.js';

Chart.register(BarController, BarElement, CategoryScale, Legend, LineController, LineElement, LinearScale, PointElement, Tooltip);

const COLORS = Object.freeze(['#2f6f8f', '#b5651d', '#4f7d3a', '#8a4f8f', '#8c2f2f', '#5a5a8c', '#7a5c2e', '#2f7a6f']);
const charts = new WeakMap();
const graphs = new WeakMap();
const observers = new WeakMap();
const geometryViews = new WeakMap();
let geometryLibraries = null;
/** Host-owned libraries only; never resolve script URLs from authored documents. */
export function configureGeometryAdapter(THREE, OrbitControls) {
  geometryLibraries = THREE && OrbitControls ? { THREE, OrbitControls } : null;
}

function chart(host, record) {
  const spec = record.data;
  const canvas = document.createElement('canvas');
  canvas.setAttribute('aria-hidden', 'true');
  host.replaceChildren(canvas);
  const bar = spec.type === 'bar';
  const datasets = spec.data.datasets.map((series, index) => {
    const color = COLORS[index % COLORS.length];
    return {
      label: series.label,
      data: series.data,
      backgroundColor: bar ? color : `${color}33`,
      borderColor: color,
      borderWidth: bar ? 0 : 2,
      borderRadius: bar ? 2 : 0,
      pointBackgroundColor: color,
      pointBorderColor: '#ffffff',
      pointRadius: bar ? 0 : 3,
      pointHoverRadius: bar ? 0 : 5,
      tension: 0,
      fill: false,
    };
  });
  const instance = new Chart(canvas, {
    type: spec.type,
    data: { labels: spec.data.labels, datasets },
    options: {
      animation: false,
      responsive: true,
      maintainAspectRatio: false,
      color: '#333333',
      interaction: { mode: 'index', intersect: false },
      layout: { padding: { top: 8, right: 12, bottom: 4, left: 4 } },
      plugins: {
        legend: {
          display: datasets.length > 1,
          labels: { color: '#333333', boxWidth: 12, boxHeight: 12, usePointStyle: false },
        },
        tooltip: { enabled: true },
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: { color: '#333333', autoSkip: true, maxRotation: 0, maxTicksLimit: 12 },
          border: { color: '#888888' },
        },
        y: {
          beginAtZero: bar,
          grid: { color: '#dddddd' },
          ticks: { color: '#444444' },
          border: { color: '#888888' },
        },
      },
    },
  });
  return instance;
}

function graph(host, record) {
  const nodes = record.data.nodes;
  const edges = record.data.edges;
  if (!nodes.length) {
    host.textContent = 'No nodes in this graph.';
    return null;
  }
  const ids = new Map(nodes.map((node, index) => [node.id, `n${index}`]));
  const elements = [
    ...nodes.map((node, index) => ({ data: { id: `n${index}`, label: node.label, color: COLORS[index % COLORS.length] } })),
    ...edges.map((edge, index) => ({ data: { id: `e${index}`, source: ids.get(edge.source), target: ids.get(edge.target), label: edge.label || '' } })),
  ];
  const instance = cytoscape({
    container: host,
    elements,
    style: [
      {
        selector: 'node',
        style: {
          'background-color': 'data(color)',
          label: 'data(label)',
          color: '#222222',
          'font-family': 'system-ui, sans-serif',
          'font-size': '11px',
          'text-valign': 'bottom',
          'text-halign': 'center',
          'text-margin-y': 6,
          'text-wrap': 'ellipsis',
          'text-max-width': '110px',
          width: 28,
          height: 28,
          'border-width': 2,
          'border-color': '#ffffff',
        },
      },
      {
        selector: 'edge',
        style: {
          width: 1.5,
          'line-color': '#888888',
          'target-arrow-color': '#888888',
          'target-arrow-shape': 'triangle',
          'arrow-scale': 0.8,
          'curve-style': 'bezier',
          label: 'data(label)',
          color: '#555555',
          'font-family': 'system-ui, sans-serif',
          'font-size': '9px',
          'text-background-color': '#ffffff',
          'text-background-opacity': 0.85,
          'text-background-padding': '2px',
          'text-rotation': 'autorotate',
        },
      },
    ],
    layout: { name: 'breadthfirst', directed: true, padding: 24, spacingFactor: 1.2, animate: false },
    minZoom: 0.2,
    maxZoom: 3,
    wheelSensitivity: 0.2,
    boxSelectionEnabled: false,
    autounselectify: true,
    userPanningEnabled: true,
    userZoomingEnabled: true,
  });
  instance.resize();
  if (typeof ResizeObserver === 'function') {
    const observer = new ResizeObserver(() => instance.resize());
    observer.observe(host);
    observers.set(host, observer);
  }
  return instance;
}

/** Destroy library instances before their rendered subtree is replaced. */
export function disposeVisualizations(root) {
  for (const host of root.querySelectorAll('.visualization-interactive')) {
    observers.get(host)?.disconnect(); observers.delete(host);
    geometryViews.get(host)?.(); geometryViews.delete(host);
    const chartInstance = charts.get(host);
    if (chartInstance) { chartInstance.destroy(); charts.delete(host); }
    const graphInstance = graphs.get(host);
    if (graphInstance) { graphInstance.destroy(); graphs.delete(host); }
    const figure = host.closest('figure.visualization');
    if (figure) delete figure.dataset.adapter;
  }
}

/** Mount installed adapters only after the static SVG and exact table exist. */
export function mountVisualizations(root) {
  for (const figure of root.querySelectorAll('figure.visualization')) {
    if (figure.dataset.adapter) continue;
    const template = figure.querySelector(':scope > template[data-visualization="spec"]');
    const host = figure.querySelector(':scope > .visualization-interactive');
    if (!template || !host) continue;
    const format = template.dataset.format;
    let record;
    try {
      record = parseVisualization(format, template.content.textContent, { alt: figure.querySelector('figcaption')?.textContent || '' });
    } catch {
      figure.dataset.adapter = 'failed';
      continue;
    }
    figure.dataset.adapter = 'mounting';
    try {
      if (format === 'chartjs') charts.set(host, chart(host, record));
      else if (format === 'cytoscape') graphs.set(host, graph(host, record));
      else if ((format === 'three-scene' || format === 'cad-model') && geometryLibraries) {
        geometryViews.set(host, mountThreeScene(host, record.data, geometryLibraries.THREE, geometryLibraries.OrbitControls));
      }
      else throw new Error('Unsupported adapter');
      figure.dataset.adapter = 'ready';
    } catch {
      delete figure.dataset.adapter;
      observers.get(host)?.disconnect(); observers.delete(host);
      const chartInstance = charts.get(host); if (chartInstance) { chartInstance.destroy(); charts.delete(host); }
      const graphInstance = graphs.get(host); if (graphInstance) { graphInstance.destroy(); graphs.delete(host); }
      geometryViews.get(host)?.(); geometryViews.delete(host);
      host.replaceChildren();
      host.setAttribute('aria-hidden', 'true');
      if (!figure.querySelector('.visualization-adapter-note')) {
        const note = document.createElement('p');
        note.className = 'visualization-adapter-note';
        note.textContent = `Interactive ${format} unavailable; the static fallback remains.`;
        figure.querySelector('figcaption')?.after(note);
      }
    }
  }
}
