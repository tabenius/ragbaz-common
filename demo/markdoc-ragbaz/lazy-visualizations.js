/** Opt-in lazy visualization host for ESM applications.
 * Production standalone renderer retains its frozen single-file bundle.
 * No document-provided module URLs or remote dependency loader is permitted.
 */
const VALID = new Set(['chartjs','cytoscape','three-scene','cad-model']);
export function visualizationFormats(root) {
  if (!root?.querySelectorAll) return [];
  const found = new Set();
  for (const t of root.querySelectorAll('figure.visualization template[data-visualization="spec"]')) {
    if (VALID.has(t.dataset.format)) found.add(t.dataset.format);
  }
  return [...found];
}
export function createLazyVisualizationHost({load = () => import('./visualization-adapters.js')} = {}) {
  let modulePromise;
  let generation = 0;
  const resolveModule = () => modulePromise ||= Promise.resolve().then(load);
  return {
    async mount(root) {
      const turn = ++generation;
      if (!visualizationFormats(root).length) return false;
      const adapter = await resolveModule();
      if (turn !== generation || !root?.isConnected) return false;
      adapter.mountVisualizations(root);
      return true;
    },
    async dispose(root) {
      ++generation;
      if (modulePromise) (await modulePromise).disposeVisualizations(root);
    },
    async configureGeometry(THREE, OrbitControls) {
      const adapter = await resolveModule();
      adapter.configureGeometryAdapter(THREE, OrbitControls);
    },
  };
}
