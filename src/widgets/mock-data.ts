/**
 * Mock Data Utilities for Admin UI Widgets
 * 
 * Provides realistic mock data for demo mode, documentation examples,
 * and MarkDoc rendering fallbacks.
 */

import { AdminNodeData } from './node-types';
import { WidgetEdge } from './markdoc-integration';
import { mockWidgetData, createDemoWidgetMarkdoc } from './markdoc-integration';

/**
 * Create a mock Rebekah runtime workflow
 * Shows: Gateway → OpenCode → Sylvae with full observability
 */
export function createMockRebekahRuntime(): { nodes: AdminNodeData[]; edges: WidgetEdge[] } {
  return mockWidgetData('rebekah');
}

/**
 * Create a mock WeftMark session workflow
 * Shows: ChangeSet → Evidence → Review → Handoff
 */
export function createMockWeftmarkSession(): { nodes: AdminNodeData[]; edges: WidgetEdge[] } {
  return mockWidgetData('weftmark');
}

/**
 * Create a mock Frog projection workflow
 * Shows: Kanban tasks with dependencies
 */
export function createMockFrogProjection(): { nodes: AdminNodeData[]; edges: WidgetEdge[] } {
  return mockWidgetData('frog');
}

/**
 * Create a generic workflow for documentation
 */
export function createMockWorkflow(): { nodes: AdminNodeData[]; edges: WidgetEdge[] } {
  return mockWidgetData('generic');
}

/**
 * Generate a complete MarkDoc AST for embedding in documentation
 */
export function generateDocWidget(
  scenario: 'rebekah' | 'weftmark' | 'frog' | 'generic' = 'generic',
  options: {
    detail?: 'terse' | 'normal' | 'verbose';
    aspects?: string[];
    title?: string;
    description?: string;
  } = {}
) {
  const { detail = 'normal', aspects = [], title, description } = options;
  const widgetAst = createDemoWidgetMarkdoc(scenario);
  
  // Update viewConfig with provided options
  if (widgetAst.attributes) {
    const viewConfig = JSON.parse(widgetAst.attributes.viewConfig || '{}');
    widgetAst.attributes.viewConfig = JSON.stringify({
      ...viewConfig,
      detail,
      aspects: aspects.length > 0 ? aspects : viewConfig.aspects,
    });
  }
  
  return {
    type: 'container',
    tag: 'WidgetDoc',
    attributes: {
      scenario,
      title: title || `Admin Widget — ${scenario.charAt(0).toUpperCase() + scenario.slice(1)}`,
      description: description || `Interactive ${scenario} workflow visualization`,
    },
    children: [
      widgetAst,
    ],
  };
}

/**
 * Create a simple process chain for demo purposes
 */
export function createProcessChain(
  processes: Array<{ id: string; label: string; status: string; protocol: string }>
): { nodes: AdminNodeData[]; edges: WidgetEdge[] } {
  const nodes: AdminNodeData[] = processes.map((p, i) => ({
    id: p.id,
    type: 'process',
    label: p.label,
    status: p.status as any,
    demo: true,
    transport: { protocol: p.protocol as any, endpoint: `demo://${p.id}` },
    security: { auth: 'mtls', encryption: true },
    observability: { metrics: ':9090/metrics' },
    position: { x: i * 250, y: 100 },
  }));
  
  const edges: WidgetEdge[] = processes.slice(0, -1).map((p, i) => ({
    id: `edge-${i}`,
    source: p.id,
    target: processes[i + 1].id,
    type: 'smoothstep',
  }));
  
  return { nodes, edges };
}

/**
 * Create a change set lifecycle demo
 */
export function createChangeSetLifecycle(): { nodes: AdminNodeData[]; edges: WidgetEdge[] } {
  const states = ['planned', 'active', 'evidence', 'review', 'ready', 'merged'] as const;
  
  const nodes: AdminNodeData[] = states.map((state, i) => ({
    id: `cs-${state}`,
    type: 'changeset',
    label: `Change Set: ${state}`,
    state,
    goal: `Demo goal for ${state} state`,
    scopes: ['file:demo/**'],
    baseSha: 'a1b2c3d4',
    headSha: state !== 'planned' ? 'f6e5d4c3' : undefined,
    evidenceCount: state === 'evidence' || state === 'review' || state === 'ready' ? 3 : 
                   state === 'merged' ? 5 : 0,
    reviewOutcome: state === 'review' || state === 'ready' ? 'ready' : undefined,
    demo: true,
    position: { x: i * 220, y: 100 },
  }));
  
  const edges: WidgetEdge[] = states.slice(0, -1).map((state, i) => ({
    id: `edge-${state}`,
    source: `cs-${state}`,
    target: `cs-${states[i + 1]}`,
    type: 'smoothstep',
    label: '→',
  }));
  
  return { nodes, edges };
}

/**
 * Create a task dependency graph
 */
export function createTaskGraph(): { nodes: AdminNodeData[]; edges: WidgetEdge[] } {
  const tasks = [
    { id: 'task-1', label: 'Design API', state: 'released' as const, priority: 'high' as const, dependsOn: [] },
    { id: 'task-2', label: 'Implement Core', state: 'tested' as const, priority: 'high' as const, dependsOn: ['task-1'] },
    { id: 'task-3', label: 'Write Tests', state: 'in-progress' as const, priority: 'normal' as const, dependsOn: ['task-1'] },
    { id: 'task-4', label: 'Documentation', state: 'idea' as const, priority: 'low' as const, dependsOn: ['task-2', 'task-3'] },
    { id: 'task-5', label: 'Deploy', state: 'blocked' as const, priority: 'critical' as const, dependsOn: ['task-2', 'task-4'] },
  ];
  
  const nodes: AdminNodeData[] = tasks.map((t, i) => ({
    id: t.id,
    type: 'task',
    label: t.label,
    state: t.state,
    priority: t.priority,
    dependsOn: t.dependsOn,
    demo: true,
    position: { x: (i % 3) * 250, y: Math.floor(i / 3) * 200 + 100 },
  }));
  
  const edges: WidgetEdge[] = [];
  tasks.forEach(t => {
    t.dependsOn.forEach(dep => {
      edges.push({
        id: `edge-${dep}-${t.id}`,
        source: dep,
        target: t.id,
        type: 'smoothstep',
        label: 'depends on',
      });
    });
  });
  
  return { nodes, edges };
}

/**
 * Create an evidence chain for a change set
 */
export function createEvidenceChain(): { nodes: AdminNodeData[]; edges: WidgetEdge[] } {
  const evidences = [
    { id: 'ev-1', label: 'Unit Tests', kind: 'test' as const, state: 'passed' as const, outcome: 'pass' as const },
    { id: 'ev-2', label: 'Security Audit', kind: 'security' as const, state: 'passed' as const, outcome: 'pass' as const },
    { id: 'ev-3', label: 'Build', kind: 'build' as const, state: 'passed' as const, outcome: 'pass' as const },
    { id: 'ev-4', label: 'Deploy Staging', kind: 'deploy' as const, state: 'running' as const, outcome: 'pass' as const },
    { id: 'ev-5', label: 'Integration Tests', kind: 'test' as const, state: 'pending' as const },
  ];
  
  const nodes: AdminNodeData[] = [
    {
      id: 'cs-main',
      type: 'changeset',
      label: 'feat: Complete feature',
      state: 'evidence',
      goal: 'Implement complete feature with full evidence chain',
      scopes: ['file:src/**', 'contract:api/v1'],
      baseSha: 'a1b2c3d4',
      headSha: 'f6e5d4c3',
      evidenceCount: 5,
      demo: true,
      position: { x: 100, y: 100 },
    },
    ...evidences.map((e, i) => ({
      id: e.id,
      type: 'evidence' as const,
      label: e.label,
      kind: e.kind,
      state: e.state,
      outcome: e.outcome,
      producer: 'ci-system',
      command: `run-${e.kind}`,
      boundToSha: 'f6e5d4c3',
      demo: true,
      position: { x: 400, y: 50 + i * 80 },
    })),
  ];
  
  const edges: WidgetEdge[] = evidences.map((e, i) => ({
    id: `edge-${e.id}`,
    source: 'cs-main',
    target: e.id,
    type: 'smoothstep',
  }));
  
  return { nodes, edges };
}

/**
 * Get all available demo scenarios
 */
export const DEMO_SCENARIOS = [
  { id: 'rebekah', name: 'Rebekah Runtime', description: 'OCI runtime with gateway, OpenCode, Sylvae' },
  { id: 'weftmark', name: 'WeftMark Session', description: 'Change sets, evidence, review, handoff' },
  { id: 'frog', name: 'Frog Projection', description: 'Kanban tasks with dependencies' },
  { id: 'generic', name: 'Generic System', description: 'API service, worker, evidence' },
  { id: 'process-chain', name: 'Process Chain', description: 'Linear process pipeline' },
  { id: 'changeset-lifecycle', name: 'Change Set Lifecycle', description: 'All change set states' },
  { id: 'task-graph', name: 'Task Graph', description: 'Tasks with dependencies' },
  { id: 'evidence-chain', name: 'Evidence Chain', description: 'Evidence bound to a change set' },
] as const;

/**
 * Create demo data by scenario ID
 */
export function createDemoById(id: string): { nodes: AdminNodeData[]; edges: WidgetEdge[] } {
  switch (id) {
    case 'rebekah':
      return createMockRebekahRuntime();
    case 'weftmark':
      return createMockWeftmarkSession();
    case 'frog':
      return createMockFrogProjection();
    case 'generic':
      return createMockWorkflow();
    case 'process-chain':
      return createProcessChain([
        { id: 'ingress', label: 'Ingress', status: 'running', protocol: 'http' },
        { id: 'auth', label: 'Auth Service', status: 'running', protocol: 'grpc' },
        { id: 'api', label: 'API Gateway', status: 'running', protocol: 'http' },
        { id: 'worker', label: 'Background Worker', status: 'running', protocol: 'grpc' },
      ]);
    case 'changeset-lifecycle':
      return createChangeSetLifecycle();
    case 'task-graph':
      return createTaskGraph();
    case 'evidence-chain':
      return createEvidenceChain();
    default:
      return createMockWorkflow();
  }
}
