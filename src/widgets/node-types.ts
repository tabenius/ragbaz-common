/**
 * React Flow Node Types for Admin UI Widgets
 * 
 * Provides typed node definitions with ViewConfig integration,
 * nested sub-flow support, and MarkDoc rendering capability.
 */

import type { ViewConfig } from './view-config';

/** Position handle types for React Flow */
export type HandlePosition = 'top' | 'bottom' | 'left' | 'right';

/** Base node data that all admin nodes share */
export interface WidgetReferenceLink {
  kind: 'pull-request' | 'merge-request' | 'issue' | 'commit' | 'review' | 'other';
  href: string;
  label: string;
  /** Display name only: GitHub, GitLab, Forgejo, an internal review surface, etc. */
  surface?: string;
  /** Reported remote state; never inferred from local widget state. */
  state?: 'draft' | 'open' | 'merged' | 'closed' | 'unknown';
}

export interface BaseNodeData {
  /** Source-owned navigation targets; no forge API calls or mutations. */
  links?: WidgetReferenceLink[];
  /** Source capture time is distinct from when the underlying entity changed. */
  snapshot?: {
    observedAt?: string;
    updatedAt?: string;
    statusObservedAt?: string;
    staleAfterSeconds?: number;
    source: string;
    revision?: string;
    stale?: boolean;
  };
  /** Supplied by the authority; never inferred from a board lane. */
  lifecycle?: { phase: 'ongoing' | 'waiting' | 'finished' | 'unknown'; canReopen?: boolean };
  inspectHref?: string;
  attention?: string[];
  position?: { x: number; y: number };
  /** Unique identifier for this node instance */
  id: string;
  /** Human-readable label */
  label: string;
  /** Optional description shown in verbose mode */
  description?: string;
  /** View configuration for this node and its children */
  viewConfig?: Partial<ViewConfig>;
  /** Whether this node is in demo mode (using mock data) */
  demo?: boolean;
  /** Custom CSS classes */
  className?: string;
}

/** Process node — represents a running service/agent/worker */
export interface ProcessNodeData extends BaseNodeData {
  type: 'process';
  /** Process status */
  status: 'starting' | 'running' | 'degraded' | 'stopped' | 'unknown';
  /** Transport protocol info */
  transport?: {
    protocol: 'http' | 'grpc' | 'acp' | 'mcp' | 'custom';
    endpoint?: string;
    healthPath?: string;
  };
  /** Schema references */
  schemas?: string[];
  /** Security posture */
  security?: {
    auth: 'none' | 'mtls' | 'oauth' | 'webauthn' | 'custom';
    encryption: boolean;
    attestation?: boolean;
  };
  /** Git/version info */
  git?: {
    repo?: string;
    commit?: string;
    branch?: string;
    dirty?: boolean;
  };
  /** Observability endpoints */
  observability?: {
    metrics?: string;
    traces?: string;
    logs?: string;
  };
  /** Child processes (for nested sub-flows) */
  children?: AdminNodeData[];
}

/** Change Set node — represents a WeftMark change set */
export interface ChangeSetNodeData extends BaseNodeData {
  type: 'changeset';
  state: 'planned' | 'active' | 'evidence' | 'review' | 'ready' | 'merged' | 'archived' | 'closed' | 'abandoned' | 'unknown';
  goal: string;
  scopes: string[];
  baseSha: string;
  headSha?: string;
  evidenceCount?: number;
  reviewOutcome?: 'ready' | 'stale' | 'blocked';
  claimHolder?: string;
}

/** Task node — represents a Frog/WeftMark task */
export interface TaskNodeData extends BaseNodeData {
  type: 'task';
  state: 'idea' | 'todo' | 'blocked' | 'in-progress' | 'in_progress' | 'tested' | 'released' | 'done' | 'abandoned' | 'unknown';
  priority: 'low' | 'normal' | 'high' | 'critical';
  assignee?: string;
  assigneeKind?: 'person' | 'agent' | 'unknown';
  dependsOn?: string[];
  changeSetId?: string;
}

/** Evidence node — represents a proof/artifact */
export interface EvidenceNodeData extends BaseNodeData {
  type: 'evidence';
  kind: 'test' | 'build' | 'security' | 'deploy' | 'docs' | 'lint' | 'custom';
  state: 'pending' | 'running' | 'passed' | 'failed' | 'unavailable' | 'stale';
  producer: string;
  command?: string;
  outcome?: 'pass' | 'fail' | 'unavailable';
  boundToSha?: string;
}

/** Review node — represents a readiness decision */
export interface ReviewNodeData extends BaseNodeData {
  type: 'review';
  outcome: 'ready' | 'stale' | 'blocked';
  author: string;
  authorKind?: 'person' | 'agent' | 'unknown';
  requiredEvidence: string[];
  optionalEvidence?: string[];
  unresolved?: string[];
  nextAction?: string;
  nextActor?: string;
}

/** Handoff node — represents a continuity record */
export interface HandoffNodeData extends BaseNodeData {
  type: 'handoff';
  task: string;
  nextAction: string;
  createdBy: string;
  receiver?: string;
  knownFailures?: string[];
  supersedes?: string;
}

/** Container node — groups other nodes (sub-flow) */
export interface ContainerNodeData extends BaseNodeData {
  type: 'container';
  /** Child nodes in this container */
  children: AdminNodeData[];
  /** Whether the container is collapsed */
  collapsed?: boolean;
  /** Container variant */
  variant?: 'rebekah' | 'weftmark' | 'frog' | 'generic';
}

/** Ephor hold and its delivery status remain separate from a readiness review. */
export interface OversightNodeData extends BaseNodeData {
  type: 'oversight';
  action: string;
  risk: 'low' | 'medium' | 'high' | 'unknown';
  state: 'pending' | 'approved' | 'denied' | 'expired';
  deadline?: string;
  delivery?: 'queued' | 'sent' | 'applied' | 'failed' | 'expired';
  rationale?: string;
}

/** Union of all node data types */
export type AdminNodeData = 
  | ProcessNodeData 
  | ChangeSetNodeData 
  | TaskNodeData 
  | EvidenceNodeData 
  | ReviewNodeData 
  | HandoffNodeData 
  | ContainerNodeData
  | OversightNodeData;

/** Type guard for container nodes */
export function isContainerNode(data: AdminNodeData): data is ContainerNodeData {
  return data.type === 'container';
}

/** Type guard for process nodes */
export function isProcessNode(data: AdminNodeData): data is ProcessNodeData {
  return data.type === 'process';
}

/** Get the appropriate React Flow node type string */
export function getNodeType(data: AdminNodeData): string {
  return `admin-${data.type}`;
}

/** Default mock data for demo mode */
export const MOCK_PROCESS_NODE: ProcessNodeData = {
  id: 'mock-process-1',
  type: 'process',
  label: 'Rebekah Gateway',
  description: 'Authenticated local agent runtime and gateway',
  status: 'running',
  demo: true,
  transport: { protocol: 'acp', endpoint: 'stdio://rebekah', healthPath: '/health' },
  schemas: ['rebekah.runtime/v1', 'rebekah.gateway/v1'],
  security: { auth: 'mtls', encryption: true, attestation: true },
  git: { repo: 'tabenius/rebekah', commit: 'a1b2c3d', branch: 'main', dirty: false },
  observability: { metrics: ':9090/metrics', traces: ':4317', logs: ':9091' },
};

export const MOCK_CHANGESET_NODE: ChangeSetNodeData = {
  id: 'mock-cs-1',
  type: 'changeset',
  label: 'feat: Add evidence freshness tracking',
  state: 'review',
  goal: 'Bind evidence results to exact Git HEAD; detect stale passes',
  scopes: ['file:src/evidence/**', 'contract:evidence-policy/v1'],
  baseSha: 'a1b2c3d4e5f6',
  headSha: 'f6e5d4c3b2a1',
  evidenceCount: 3,
  reviewOutcome: 'ready',
  claimHolder: 'alice@ragbaz.cc',
  demo: true,
};

export const MOCK_CONTAINER_NODE: ContainerNodeData = {
  id: 'mock-container-1',
  type: 'container',
  label: 'Rebekah Runtime',
  description: 'OCI runtime with supervised services and authenticated gateway',
  variant: 'rebekah',
  demo: true,
  children: [
    MOCK_PROCESS_NODE,
    { ...MOCK_PROCESS_NODE, id: 'mock-process-2', label: 'OpenCode Session', transport: { protocol: 'acp', endpoint: 'stdio://opencode' } },
    { ...MOCK_PROCESS_NODE, id: 'mock-process-3', label: 'Sylvae Runner', transport: { protocol: 'grpc', endpoint: 'localhost:50051' } },
  ],
};
