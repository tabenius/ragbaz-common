import type { Node } from 'reactflow';
import type { AdminNodeData } from './node-types';
import { DEFAULT_VIEW_CONFIG, type ViewConfig } from './view-config';

const CARD_WIDTH = 340;
const CARD_HEIGHT = 460;
const GAP_X = 96;
const GAP_Y = 72;
const GROUP_HEADER = 300;
const PADDING = 32;
interface Layout { record: AdminNodeData; width: number; height: number; children: Layout[]; columns: number; cellWidth: number; cellHeight: number }

/** Size parents from children before positioning them; bounded card bodies scroll. */
function measure(record: AdminNodeData): Layout {
  const children = record.type === 'container' && !record.collapsed ? record.children.map(measure) : [];
  const columns = Math.min(4, children.length);
  const cellWidth = Math.max(CARD_WIDTH, ...children.map(child => child.width));
  const cellHeight = Math.max(CARD_HEIGHT, ...children.map(child => child.height));
  return { record, children, columns, cellWidth, cellHeight,
    width: children.length ? PADDING * 2 + columns * cellWidth + (columns - 1) * GAP_X : CARD_WIDTH,
    height: children.length ? GROUP_HEADER + Math.ceil(children.length / columns) * cellHeight + (Math.ceil(children.length / columns) - 1) * GAP_Y + PADDING : CARD_HEIGHT,
  };
}

/** React Flow parentage is not React DOM ancestry: resolve inheritance explicitly. */
export function toFlowNodes(records: AdminNodeData[], root: ViewConfig = DEFAULT_VIEW_CONFIG, demo = false): Node<AdminNodeData>[] {
  const result: Node<AdminNodeData>[] = [];
  const seen = new Set<string>();
  function visit(layout: Layout, position: { x: number; y: number }, parentConfig: ViewConfig, parentNode?: string, parentDemo = demo) {
    const record = layout.record;
    if (!record.id || seen.has(record.id)) throw new Error('Widget node ids must be non-empty and unique');
    seen.add(record.id);
    const config: ViewConfig = {
      detail: record.viewConfig?.detail ?? parentConfig.detail,
      aspects: record.viewConfig?.aspects ?? parentConfig.aspects,
      inherited: record.viewConfig?.detail === undefined && record.viewConfig?.aspects === undefined,
    };
    const isDemo = parentDemo || Boolean(record.demo);
    result.push({ id: record.id, type: `admin-${record.type}`, parentNode,
      extent: parentNode ? 'parent' : undefined, position,
      data: { ...record, viewConfig: config, demo: isDemo },
      style: { width: layout.width, height: layout.height },
    });
    layout.children.forEach((child, index) => visit(child, {
      x: PADDING + (index % layout.columns) * (layout.cellWidth + GAP_X),
      y: GROUP_HEADER + Math.floor(index / layout.columns) * (layout.cellHeight + GAP_Y),
    }, config, record.id, isDemo));
  }
  let x = 0;
  records.map(measure).forEach(layout => { visit(layout, { x, y: 0 }, root); x += layout.width + GAP_X; });
  return result;
}
