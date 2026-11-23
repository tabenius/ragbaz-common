/**
 * MarkDoc Integration for Admin UI Widgets
 * 
 * Allows rendering React Flow node graphs as MarkDoc tags in documentation.
 * Falls back to mock data with clear demo mode indicators.
 */

import React from 'react';
import ReactFlow, { Background, BackgroundVariant, Controls, MiniMap, ConnectionMode } from 'reactflow';
import 'reactflow/dist/style.css';
import { AdminNodeData } from './node-types';
import { adminNodeTypes } from './node-components';
import { ViewConfig, DEFAULT_VIEW_CONFIG, ViewConfigProvider } from './view-config';
import { toFlowNodes } from './graph';

/** MarkDoc tag name for widget embedding */
export const WIDGET_TAG = 'AdminWidget';

/** Valid attributes for the MarkDoc tag */
export const WIDGET_ATTRIBUTES = {
  /** JSON string of nodes array */
  nodes: { type: String, required: false },
  /** JSON string of edges array */
  edges: { type: 'string', required: false },
  /** ViewConfig as JSON */
  viewConfig: { type: 'string', required: false },
  /** Demo mode flag */
  demo: { type: 'boolean', required: false },
  /** Width of the canvas */
  width: { type: 'string', required: false },
  /** Height of the canvas */
  height: { type: 'string', required: false },
  /** Show minimap */
  minimap: { type: 'boolean', required: false },
  /** Show controls */
  controls: { type: 'boolean', required: false },
  /** Show background */
  background: { type: 'boolean', required: false },
};

/** Edge data structure for React Flow */
export interface WidgetEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string;
  targetHandle?: string;
  type?: string;
  label?: string;
  data?: Record<string, unknown>;
}

/** Widget canvas props */
export interface WidgetCanvasProps {
  nodes: AdminNodeData[];
  edges: WidgetEdge[];
  viewConfig?: Partial<ViewConfig>;
  demo?: boolean;
  width?: string;
  height?: string;
  showMinimap?: boolean;
  showControls?: boolean;
  showBackground?: boolean;
}

/** React component for rendering a widget canvas */
export function WidgetCanvas({
  nodes,
  edges,
  viewConfig = {},
  demo = false,
  width = '100%',
  height = '400px',
  showMinimap = true,
  showControls = true,
  showBackground = true,
}: WidgetCanvasProps) {
  const effectiveConfig = { ...DEFAULT_VIEW_CONFIG, ...viewConfig };
  
  return (
    <ViewConfigProvider config={effectiveConfig}>
      <div style={{ width, height, position: 'relative' }} className="rounded-lg border bg-card">
        <ReactFlow
          nodes={toFlowNodes(nodes, effectiveConfig, demo)}
          edges={edges}
          nodeTypes={adminNodeTypes}
           nodeOrigin={[0, 0]}
           minZoom={0.15}
          fitView={true}
          nodesDraggable={false}
          nodesConnectable={false}
          edgesUpdatable={false}
          connectionMode={ConnectionMode.Loose}
           defaultEdgeOptions={{ type: 'smoothstep', style: { stroke: '#425c76', strokeWidth: 2 }, markerEnd: { type: 'arrowclosed' as import('reactflow').MarkerType } }}
        >
          {showBackground && <Background variant={BackgroundVariant.Dots} gap={16} size={1} />}
           {showControls && <Controls showInteractive={false} />}
           {showMinimap && <MiniMap pannable zoomable nodeColor={({ data }) => ({ task: '#235cb1', process: '#0c766e', changeset: '#6e4e9c', evidence: '#4c681e', review: '#8a4a15', handoff: '#176777', oversight: '#943751', container: '#c4cecf' }[data.type as AdminNodeData['type']])} />}
        </ReactFlow>
        {(demo || nodes.some(node => node.demo)) && (
           <div style={{ position: 'absolute', top: 8, right: 8, padding: 6, background: '#fff6d7', color: '#785100', fontSize: 11, pointerEvents: 'none' }}>
            Demo Mode — Mock Data
          </div>
        )}
      </div>
    </ViewConfigProvider>
  );
}

/** MarkDoc-compatible component (receives attributes as props) */
export function WidgetNode({
  nodes: nodesAttr,
  edges: edgesAttr,
  viewConfig: viewConfigAttr,
  demo = 'false',
  width = '100%',
  height = '400px',
  minimap = 'true',
  controls = 'true',
  background = 'true',
}: Record<string, string>) {
  let nodes: AdminNodeData[] = [];
  let edges: WidgetEdge[] = [];
  let viewConfig: Partial<ViewConfig> = {};
  if (nodesAttr === undefined) {
    const mock = mockWidgetData('generic');
    return <WidgetCanvas {...mock} demo width={width} height={height} />;
  }
  
  try {
    nodes = JSON.parse(nodesAttr || '[]');
  } catch {
    return <p role="alert">Invalid widget nodes JSON; no data displayed.</p>;
  }
  
  try {
    edges = JSON.parse(edgesAttr || '[]');
  } catch {
    return <p role="alert">Invalid widget edges JSON; no data displayed.</p>;
  }
  
  try {
    viewConfig = JSON.parse(viewConfigAttr || '{}');
  } catch {
    return <p role="alert">Invalid widget view configuration; no data displayed.</p>;
  }
  
  return (
    <WidgetCanvas
      nodes={nodes}
      edges={edges}
      viewConfig={viewConfig}
      demo={demo === 'true'}
      width={width}
      height={height}
      showMinimap={minimap === 'true'}
      showControls={controls === 'true'}
      showBackground={background === 'true'}
    />
  );
}

/** Render widget to MarkDoc AST (for static generation) */
export function renderWidgetToMarkdoc(
  nodes: AdminNodeData[],
  edges: WidgetEdge[],
  viewConfig: Partial<ViewConfig> = {},
  demo = false
): any {
  return {
    type: 'tag',
    tag: WIDGET_TAG,
    attributes: {
      nodes: JSON.stringify(nodes),
      edges: JSON.stringify(edges),
      viewConfig: JSON.stringify(viewConfig),
      demo: String(demo),
      width: '100%',
      height: '400px',
      minimap: 'true',
      controls: 'true',
      background: 'true',
    },
    children: [],
  };
}

/** Generate mock widget data for documentation examples */
export function mockWidgetData(scenario: 'rebekah' | 'weftmark' | 'frog' | 'generic' = 'generic') {
  const baseNodes: AdminNodeData[] = [];
  const baseEdges: WidgetEdge[] = [];
  
  switch (scenario) {
    case 'rebekah': {
      const container: AdminNodeData = {
        id: 'rebekah-runtime',
        type: 'container',
        label: 'Rebekah Runtime',
        description: 'OCI runtime with supervised services and authenticated gateway',
        variant: 'rebekah',
        demo: true,
        viewConfig: { detail: 'normal', aspects: ['transport', 'security', 'observability'] },
        children: [
          {
            id: 'gateway',
            type: 'process',
            label: 'Gateway',
            description: 'Authenticated gateway with mTLS',
            status: 'running',
            demo: true,
            transport: { protocol: 'acp', endpoint: 'stdio://gateway', healthPath: '/health' },
            security: { auth: 'mtls', encryption: true, attestation: true },
            observability: { metrics: ':9090/metrics', traces: ':4317', logs: ':9091' },
          },
          {
            id: 'opencode',
            type: 'process',
            label: 'OpenCode Session',
            description: 'Agent session host',
            status: 'running',
            demo: true,
            transport: { protocol: 'acp', endpoint: 'stdio://opencode' },
            security: { auth: 'mtls', encryption: true },
          },
          {
            id: 'sylvae',
            type: 'process',
            label: 'Sylvae Runner',
            description: 'Portable skill executor',
            status: 'running',
            demo: true,
            transport: { protocol: 'grpc', endpoint: 'localhost:50051' },
            security: { auth: 'mtls', encryption: true },
            observability: { metrics: ':9091/metrics' },
          },
        ],
      };
      baseNodes.push(container);
      break;
    }
    case 'weftmark': {
      const container: AdminNodeData = {
        id: 'weftmark-session',
        type: 'container',
        label: 'WeftMark Session',
        description: 'Change sets, evidence, review, and handoff',
        variant: 'weftmark',
        demo: true,
        viewConfig: { detail: 'normal', aspects: ['evidence', 'review', 'handoff', 'git'] },
        children: [
          {
            id: 'cs-1',
            type: 'changeset',
            label: 'feat: Evidence freshness tracking',
            state: 'review',
            goal: 'Bind evidence results to exact Git HEAD; detect stale passes',
            scopes: ['file:src/evidence/**', 'contract:evidence-policy/v1'],
            baseSha: 'a1b2c3d4',
            headSha: 'f6e5d4c3',
            evidenceCount: 3,
            reviewOutcome: 'ready',
            demo: true,
          },
          {
            id: 'ev-1',
            type: 'evidence',
            label: 'Unit tests',
            kind: 'test',
            state: 'passed',
            outcome: 'pass',
            producer: 'weftmark-cli',
            command: 'pytest tests/evidence -v',
            boundToSha: 'f6e5d4c3',
            demo: true,
          },
          {
            id: 'ev-2',
            type: 'evidence',
            label: 'Security scan',
            kind: 'security',
            state: 'passed',
            outcome: 'pass',
            producer: 'sylvae:run/abc123',
            command: 'cargo audit',
            boundToSha: 'f6e5d4c3',
            demo: true,
          },
          {
            id: 'review-1',
            type: 'review',
            label: 'Readiness review',
            outcome: 'ready',
            author: 'alice@ragbaz.cc',
            requiredEvidence: ['test', 'security'],
            nextAction: 'Merge and deploy',
            nextActor: 'CI/CD',
            demo: true,
          },
        ],
      };
      baseNodes.push(container);
      
      baseEdges.push(
        { id: 'e1', source: 'weftmark-session', target: 'cs-1', type: 'smoothstep' },
        { id: 'e2', source: 'cs-1', target: 'ev-1', type: 'smoothstep' },
        { id: 'e3', source: 'cs-1', target: 'ev-2', type: 'smoothstep' },
        { id: 'e4', source: 'cs-1', target: 'review-1', type: 'smoothstep' },
      );
      break;
    }
    case 'frog': {
      const container: AdminNodeData = {
        id: 'frog-projection',
        type: 'container',
        label: 'Frog Projection',
        description: 'Kanban board with task intent and dependency tracking',
        variant: 'frog',
        demo: true,
        viewConfig: { detail: 'verbose', aspects: ['transport', 'schemas', 'git', 'observability'] },
        children: [
          {
            id: 'task-1',
            type: 'task',
            label: 'Implement kanban projection',
            state: 'in-progress',
            priority: 'high',
            assignee: 'alice',
            dependsOn: [],
            demo: true,
          },
          {
            id: 'task-2',
            type: 'task',
            label: 'Add dependency tree pane',
            state: 'idea',
            priority: 'normal',
            assignee: 'bob',
            dependsOn: ['task-1'],
            demo: true,
          },
          {
            id: 'task-3',
            type: 'task',
            label: 'Write projection contract tests',
            state: 'tested',
            priority: 'high',
            assignee: 'alice',
            dependsOn: ['task-1'],
            demo: true,
          },
        ],
      };
      baseNodes.push(container);
      
      baseEdges.push(
        { id: 'e1', source: 'frog-projection', target: 'task-1', type: 'smoothstep' },
        { id: 'e2', source: 'frog-projection', target: 'task-2', type: 'smoothstep' },
        { id: 'e3', source: 'frog-projection', target: 'task-3', type: 'smoothstep' },
        { id: 'e4', source: 'task-1', target: 'task-2', type: 'smoothstep', label: 'blocks' },
        { id: 'e5', source: 'task-1', target: 'task-3', type: 'smoothstep', label: 'blocks' },
      );
      break;
    }
    default: {
      const container: AdminNodeData = {
        id: 'generic-system',
        type: 'container',
        label: 'Generic System',
        description: 'Example system with process, evidence, and review nodes',
        variant: 'generic',
        demo: true,
        viewConfig: { detail: 'normal', aspects: ['transport', 'security', 'observability'] },
        children: [
          {
            id: 'api',
            type: 'process',
            label: 'API Service',
            status: 'running',
            demo: true,
            transport: { protocol: 'http', endpoint: 'https://api.example.com', healthPath: '/health' },
            security: { auth: 'oauth', encryption: true },
          },
          {
            id: 'worker',
            type: 'process',
            label: 'Background Worker',
            status: 'running',
            demo: true,
            transport: { protocol: 'grpc', endpoint: 'localhost:50051' },
            security: { auth: 'mtls', encryption: true },
          },
          {
            id: 'evidence',
            type: 'evidence',
            label: 'Integration tests',
            kind: 'test',
            state: 'passed',
            outcome: 'pass',
            producer: 'ci-system',
            demo: true,
          },
        ],
      };
      baseNodes.push(container);
    }
  }
  
  return { nodes: baseNodes, edges: baseEdges };
}

/** Create a MarkDoc AST for a demo widget */
export function createDemoWidgetMarkdoc(scenario: 'rebekah' | 'weftmark' | 'frog' | 'generic' = 'generic') {
  const { nodes, edges } = mockWidgetData(scenario);
  return renderWidgetToMarkdoc(nodes, edges, { detail: 'normal' }, true);
}
