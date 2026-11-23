import React from 'react';
import { stateTone } from './presentation';

export type WidgetIconName = 'process' | 'task' | 'changeset' | 'evidence' | 'review' | 'handoff' | 'container' | 'oversight' | 'pull-request' | 'merge-request' | 'issue' | 'commit' | 'other' | 'external' | 'inspect' | 'check' | 'close' | 'clock' | 'merge' | 'draft' | 'unknown' | 'person' | 'agent' | 'persona';
const paths: Record<WidgetIconName, React.ReactNode> = {
  person: <><circle cx="12" cy="7" r="4" /><path d="M4 21v-2a8 8 0 0 1 16 0v2" /></>,
  agent: <><rect x="4" y="7" width="16" height="14" rx="3" /><path d="M12 3v4M2 12h2m16 0h2M8 16h8" /><circle cx="8" cy="12" r="1" /><circle cx="16" cy="12" r="1" /></>,
  persona: <><circle cx="12" cy="12" r="10" /><circle cx="12" cy="9" r="3" /><path d="M6 19a6 6 0 0 1 12 0" /></>,
  process: <><rect x="3" y="4" width="18" height="13" rx="2" /><path d="m7 8 3 3-3 3m6 0h4M8 21h8m-4-4v4" /></>,
  task: <><rect x="5" y="4" width="15" height="17" rx="2" /><path d="M9 3h7v4H9zm0 9h7m-7 5h7M2 12h1m-1 5h1" /></>,
  changeset: <><path d="m12 2 9 10-9 10L3 12Z" /><path d="M8 12h8m-4-4v8" /></>,
  evidence: <><path d="M5 3h10l4 4v14H5Zm10 0v5h4M8 12h8m-8 4h3" /><path d="m13 17 2 2 4-4" /></>,
  review: <><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z" /><circle cx="12" cy="12" r="3" /></>,
  handoff: <><path d="M3 7h12m-4-4 4 4-4 4M21 17H9m4-4-4 4 4 4" /></>,
  container: <><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M3 9h18M9 9v12" /></>,
  oversight: <><path d="m12 2 8 4v6c0 5-8 10-8 10S4 17 4 12V6Z" /><path d="M9 8v7m6-7v7" /></>,
  'pull-request': <><circle cx="6" cy="5" r="2" /><circle cx="6" cy="19" r="2" /><circle cx="18" cy="19" r="2" /><path d="M6 7v10m12 0V9a4 4 0 0 0-4-4h-2m3-3-3 3 3 3" /></>,
  'merge-request': <><circle cx="6" cy="5" r="2" /><circle cx="6" cy="19" r="2" /><circle cx="18" cy="5" r="2" /><path d="M6 7v10m12-10c0 6-12 3-12 9" /></>,
  issue: <><circle cx="12" cy="12" r="9" /><path d="M12 7v6m0 4h.01" /></>,
  commit: <><path d="M2 12h6m8 0h6" /><circle cx="12" cy="12" r="4" /></>,
  other: <><path d="m10 14 4-4m-6 5-1 1a4 4 0 0 1-6-6l4-4a4 4 0 0 1 6 0m2 3 1-1a4 4 0 0 1 6 6l-4 4a4 4 0 0 1-6 0" /></>,
  external: <><path d="M14 3h7v7m0-7L10 14M10 3H3v18h18v-7" /></>,
  inspect: <><circle cx="10" cy="10" r="7" /><path d="m15 15 6 6" /></>,
  check: <path d="m4 12 5 5L20 6" />,
  close: <path d="m5 5 14 14M19 5 5 19" />,
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 6v6l4 2" /></>,
  merge: <><circle cx="6" cy="5" r="2" /><circle cx="18" cy="19" r="2" /><path d="M6 7c0 8 12 2 12 10M18 3v14" /></>,
  draft: <><path d="m4 16 12-12 4 4L8 20H4Z" /><path d="m13 7 4 4" /></>,
  unknown: <><circle cx="12" cy="12" r="9" /><path d="M9 8a3 3 0 0 1 6 0c0 2-3 2-3 5m0 4h.01" /></>,
};

export function WidgetIcon({ name, className = '' }: { name: WidgetIconName; className?: string }) {
  return <svg className={`ragbaz-icon ${className}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">{paths[name]}</svg>;
}

export function ActorLabel({ name, kind = 'unknown' }: { name: string; kind?: 'person' | 'agent' | 'unknown' }) {
  return <span className="ragbaz-actor"><span className="ragbaz-avatar" title={kind === 'unknown' ? 'Persona type not supplied' : `Reported ${kind}`}><WidgetIcon name={kind === 'unknown' ? 'persona' : kind} /></span><span>{name}</span>{kind !== 'unknown' && <span className="ragbaz-actor-kind">{kind}</span>}</span>;
}

function statusIcon(state: string): WidgetIconName {
  if (state === 'merged') return 'merge';
  if (state === 'draft' || state === 'planned' || state === 'idea') return 'draft';
  if (['closed', 'failed', 'denied', 'abandoned', 'blocked', 'stopped'].includes(state)) return 'close';
  if (['passed', 'ready', 'approved', 'applied', 'done', 'released', 'finished'].includes(state)) return 'check';
  if (['unknown', 'unavailable'].includes(state)) return 'unknown';
  return 'clock';
}

/** State tokens are distinct from prose. A source label prevents authority conflation. */
export function StatusPill({ state, label, source, category = 'state' }: { state: string; label?: string; source?: string; category?: 'state' | 'risk' | 'priority' }) {
  const tone = category === 'risk' ? ({ low: 'success', medium: 'warning', high: 'danger', critical: 'danger', unknown: 'neutral' }[state] ?? 'neutral')
    : category === 'priority' ? ({ low: 'neutral', normal: 'neutral', high: 'warning', critical: 'danger', p0: 'danger', p1: 'warning', p2: 'active', p3: 'neutral' }[state] ?? 'neutral')
    : state === 'merged' ? 'merged' : state === 'draft' ? 'neutral' : state === 'closed' ? 'closed' : state === 'open' ? 'success' : state === 'ongoing' ? 'active' : stateTone(state);
  return <span className="ragbaz-status-pill" data-tone={tone} data-state={state} data-category={category} aria-label={source ? `${source}: ${label ?? state}` : undefined}>
    <WidgetIcon name={category === 'risk' || category === 'priority' ? (state === 'unknown' ? 'unknown' : 'issue') : statusIcon(state)} /><span>{label ?? state.replaceAll('_', ' ')}</span>
  </span>;
}
