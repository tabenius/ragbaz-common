import React, { useEffect, useState, type ReactNode } from 'react';
import { Handle, Position, type NodeProps } from 'reactflow';
import { type AdminNodeData } from './node-types';
import { ViewConfigProvider, useViewConfig, useDerivedViewConfig } from './view-config';
import { WIDGET_KINDS, widgetState, snapshotState } from './presentation';
import { WidgetInspectAction } from './inspection';
import { WidgetReferenceLinks } from './reference-links';
import { WidgetIcon, StatusPill, ActorLabel } from './visual-language';
import { relativeDayLabel } from './date-labels';

/** Plain, read-only card: safe to render without a React Flow store. */
export function AdminWidget({ data, inspect = true, graph = false }: { data: AdminNodeData; inspect?: boolean; graph?: boolean }) {
  const config = useDerivedViewConfig(data.viewConfig);
  return <ViewConfigProvider config={config}>
    <WidgetBody data={data} inspect={inspect} graph={graph} />
  </ViewConfigProvider>;
}

function WidgetBody({ data, inspect, graph }: { data: AdminNodeData; inspect: boolean; graph: boolean }) {
  const config = useViewConfig();
  const [now, setNow] = useState(Date.now);
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 15000); return () => clearInterval(timer); }, []);
  const kind = WIDGET_KINDS[data.type];
  const state = widgetState(data);
  const freshness = snapshotState(data, now);
  const fields: [string, ReactNode][] = [];
  const show = (aspect: typeof config.aspects[number]) => config.aspects.includes(aspect);
  if (data.type === 'process') {
    fields.push(['Status', data.status]);
    if (show('transport') && data.transport) fields.push(['Transport', `${data.transport.protocol} ${data.transport.endpoint ?? ''}`]);
    if (show('schemas')) fields.push(['Schemas', data.schemas?.join(', ') ?? 'Not supplied']);
    if (show('security') && data.security) fields.push(['Security', `${data.security.auth}; encryption ${data.security.encryption ? 'configured' : 'not configured'}; attestation ${data.security.attestation ? 'reported (not verified)' : 'not supplied'}`]);
    if (show('git') && data.git) fields.push(['Git', `${data.git.repo ?? ''} ${data.git.commit ?? ''} ${data.git.dirty ? '(dirty)' : ''}`]);
    if (show('observability') && data.observability) fields.push(['Observability', Object.entries(data.observability).map(([key, value]) => `${key}: ${value}`).join('; ')]);
  } else if (data.type === 'changeset') {
    fields.push(['State', data.state], ['Goal', data.goal]);
    if (show('git')) fields.push(['Git', `${data.baseSha} → ${data.headSha ?? 'unknown'}`]);
    if (show('evidence')) fields.push(['Evidence', data.evidenceCount ?? 'Not supplied']);
    if (show('review')) fields.push(['Review', data.reviewOutcome ?? 'Not supplied']);
    if (config.detail === 'verbose') fields.push(['Scopes', data.scopes.join(', ')]);
  } else if (data.type === 'task') {
    fields.push(['State', data.state], ['Priority', data.priority], ['Assignee', data.assignee ? <ActorLabel name={data.assignee} kind={data.assigneeKind} /> : 'Unassigned']);
    if (config.detail === 'verbose') fields.push(['Dependencies', data.dependsOn?.join(', ') || 'None']);
  } else if (data.type === 'evidence') {
    fields.push(['State', data.state], ['Kind', data.kind]);
    if (show('evidence')) fields.push(['Producer', data.producer], ['Outcome', data.outcome ?? 'Not supplied']);
    if (show('git')) fields.push(['Bound revision', data.boundToSha ?? 'Not supplied']);
    if (config.detail === 'verbose' && data.command) fields.push(['Command', data.command]);
  } else if (data.type === 'review') {
    fields.push(['Outcome', data.outcome]);
    if (show('review')) fields.push(['Author (reported)', <ActorLabel name={data.author} kind={data.authorKind} />], ['Required evidence', data.requiredEvidence.join(', ')], ['Unresolved', data.unresolved?.join(', ') || 'None reported']);
    if (data.nextAction) fields.push(['Next action', data.nextAction]);
    if (data.nextActor) fields.push(['Next actor', data.nextActor]);
  } else if (data.type === 'handoff' && show('handoff')) {
    fields.push(['Task', data.task], ['Next action', data.nextAction], ['Receiver', data.receiver ?? 'Not supplied']);
    fields.push(['Known failures', data.knownFailures?.join(', ') || 'None reported']);
  } else if (data.type === 'oversight') {
    fields.push(['Held action', data.action], ['Risk', data.risk], ['Decision', data.state], ['Delivery', data.delivery ?? 'No decision queued']);
    if (data.deadline) fields.push(['Deadline', <Timestamp value={data.deadline} now={now} />]);
    if (data.rationale) fields.push(['Rationale', data.rationale]);
  }
  return <section className={`ragbaz-widget ${graph ? 'ragbaz-widget-graph' : ''} ${data.className ?? ''}`} data-detail={config.detail} data-kind={data.type}>
    <header className="ragbaz-widget-header">
      <div className="ragbaz-kind"><WidgetIcon name={data.type} /> {kind.label}</div>
      <strong className="ragbaz-title">{data.label}</strong>
      <div className="ragbaz-badges"><StatusPill state={state} source="Local record state" />
        {data.type === 'task' && <StatusPill state={data.priority} category="priority" label={`${data.priority} priority`} source="Task priority" />}
        {data.type === 'oversight' && <StatusPill state={data.risk} category="risk" label={`Risk: ${data.risk}`} source="Reported risk" />}
        {data.type === 'oversight' && data.delivery && <StatusPill state={data.delivery} label={`Delivery: ${data.delivery}`} source="Decision delivery" />}
        {data.demo && <span className="ragbaz-demo">DEMO — mock data</span>}
      </div>
    </header>
    <div className="ragbaz-widget-content nowheel nodrag">
    <div className="ragbaz-lifecycle">{data.lifecycle ? <StatusPill state={data.lifecycle.phase} source="Lifecycle" /> : 'Lifecycle not supplied'}{data.lifecycle?.canReopen === true && <span> · Reopen available in source</span>}{data.lifecycle?.canReopen === false && <span> · Not reopenable</span>}</div>
    {data.attention?.length ? <ul className="ragbaz-attention" aria-label="Needs attention">{data.attention.map((flag, index) => <li key={`${flag}-${index}`}>! {flag.replaceAll('_', ' ')}</li>)}</ul> : null}
    {data.type === 'oversight' && data.deadline && Date.parse(data.deadline) < now && data.state === 'pending' && <p className="ragbaz-attention">Deadline passed in this snapshot. Refresh in the source; this does not establish its current decision.</p>}
    {config.detail !== 'terse' && data.description && <p className="ragbaz-description">{data.description}</p>}
    <dl>{fields.slice(0, config.detail === 'terse' ? 1 : undefined).map(([label, value]) =>
      <React.Fragment key={label}><dt>{label}</dt><dd style={{ overflowWrap: 'anywhere' }}>{typeof value === 'string' && ['Status', 'State', 'Outcome', 'Review', 'Decision', 'Delivery', 'Risk', 'Priority'].includes(label) && value !== 'Not supplied' && value !== 'No decision queued' ? <StatusPill state={value} source={label} category={label === 'Risk' ? 'risk' : label === 'Priority' ? 'priority' : 'state'} /> : value}</dd></React.Fragment>)}</dl>
    {data.type === 'container' && !data.collapsed && data.children.map(child =>
      <AdminWidget key={child.id} inspect={inspect} data={{ ...child, demo: data.demo || child.demo }} />)}
    {data.type === 'container' && data.collapsed && <p>{data.children.length} nodes (collapsed)</p>}
    </div>
    <footer className="ragbaz-widget-footer">
      <div className="ragbaz-snapshot" data-freshness={freshness}>
        <span>{data.snapshot?.source ?? 'Source not supplied'} · {freshness === 'demo' ? 'Illustration' : freshness === 'stale' ? 'STALE snapshot' : freshness === 'unknown' ? 'Capture time unknown' : 'Snapshot (not live)'}</span>
        <span>Captured <Timestamp value={data.snapshot?.observedAt} now={now} /></span>
        <span>Updated <Timestamp value={data.snapshot?.updatedAt} now={now} /></span>
        {config.detail === 'verbose' && <span>Status observed <Timestamp value={data.snapshot?.statusObservedAt} now={now} />{data.snapshot?.revision && ` · revision ${data.snapshot.revision}`}</span>}
      </div>
      <small>{config.detail} · {config.inherited ? 'inherited view' : 'local view'}</small>
      {inspect && <WidgetInspectAction data={data} />}
      <WidgetReferenceLinks links={data.links} demo={data.demo} />
    </footer>
  </section>;
}

function Timestamp({ value, now }: { value?: string; now: number }) {
  const timestamp = Date.parse(value ?? '');
  if (!Number.isFinite(timestamp)) return <>unknown</>;
  const date = new Date(timestamp);
  const iso = date.toISOString();
  const text = `${relativeDayLabel(date, new Date(now), 'UTC', true)} ${iso.slice(11, 16)} UTC`;
  return <time dateTime={iso} title={iso}>{text}</time>;
}

function FlowNode({ data, selected }: NodeProps<AdminNodeData>) {
  return <div className={`ragbaz-flow-node ${data.type === 'container' ? 'ragbaz-flow-group' : ''}`} aria-selected={selected}>
    <AdminWidget graph data={data.type === 'container' && !data.collapsed ? { ...data, children: [] } : data} />
    <Handle type="target" position={Position.Left} />
    <Handle type="source" position={Position.Right} />
  </div>;
}
export const ProcessNode = FlowNode;
export const ChangeSetNode = FlowNode;
export const TaskNode = FlowNode;
export const EvidenceNode = FlowNode;
export const ContainerNode = FlowNode;
export const ReviewNode = FlowNode;
export const HandoffNode = FlowNode;
export const OversightNode = FlowNode;
export const adminNodeTypes = Object.fromEntries(
  ['process', 'changeset', 'task', 'evidence', 'container', 'review', 'handoff', 'oversight'].map(type => [`admin-${type}`, FlowNode])
);
export function renderNodeComponent(data: AdminNodeData) { return <AdminWidget data={data} />; }
export function getReactFlowType(data: AdminNodeData): string { return `admin-${data.type}`; }
