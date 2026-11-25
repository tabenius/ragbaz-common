import type { AdminNodeData } from './node-types';

export const WIDGET_KINDS = {
  process: { label: 'Runtime observation', glyph: '◉', category: 'Execution', description: 'What a runtime reports; not a promise that a service is currently reachable.' },
  task: { label: 'Task intent', glyph: '☷', category: 'Planning', description: 'What needs doing, by whom, and which prerequisites block it.' },
  changeset: { label: 'Change Set', glyph: '◇', category: 'Work', description: 'A scoped change bound to Git lineage; distinct from task intent.' },
  evidence: { label: 'Evidence receipt', glyph: '▤', category: 'Proof', description: 'A result bound to a revision. Passed, failed, unavailable and stale stay distinct.' },
  review: { label: 'Readiness review', glyph: '◎', category: 'Judgment', description: 'A recorded evaluation; readiness is not approval to deploy.' },
  handoff: { label: 'Handoff', glyph: '↗', category: 'Continuity', description: 'The next action, receiver and unresolved work, preserved for continuation.' },
  container: { label: 'Workspace context', glyph: '▦', category: 'Context', description: 'Groups related information and supplies an inherited presentation view.' },
  oversight: { label: 'Human decision hold', glyph: '⏸', category: 'Governance', description: 'An Ephor-gated action awaiting a human. Decision and delivery are separate.' },
} as const;

export function widgetState(data: AdminNodeData): string {
  if ('state' in data) return data.state;
  if ('status' in data) return data.status;
  if ('outcome' in data) return data.outcome;
  return data.type === 'handoff' ? 'continuation recorded' : 'context';
}

export { stateTone } from './dom.js';

export function snapshotState(data: AdminNodeData, now: number): 'demo' | 'unknown' | 'stale' | 'captured' {
  const snapshot = data.snapshot;
  if (snapshot?.stale) return 'stale';
  if (data.demo) return 'demo';
  const captured = Date.parse(snapshot?.observedAt ?? '');
  if (!Number.isFinite(captured)) return 'unknown';
  if (snapshot?.stale || captured > now + 5000 || (snapshot?.staleAfterSeconds !== undefined && now - captured > snapshot.staleAfterSeconds * 1000)) return 'stale';
  return 'captured';
}

/** Safe navigation only; credentials, script URLs and protocol-relative URLs refused. */
export function safeInspectionHref(value?: string): string | undefined {
  if (!value || /[\u0000-\u0020\\]/.test(value) || value.startsWith('//')) return undefined;
  if (value.startsWith('/') || value.startsWith('?') || value.startsWith('#')) return value;
  try {
    const url = new URL(value);
    return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password ? url.href : undefined;
  } catch { return undefined; }
}
