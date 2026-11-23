import React, { useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { AdminWidget } from '../src/widgets/node-components';
import { WidgetCanvas, mockWidgetData } from '../src/widgets/markdoc-integration';
import { ViewConfigProvider, type DetailLevel, type AspectKey } from '../src/widgets/view-config';
import { type AdminNodeData } from '../src/widgets/node-types';
import { WidgetInspectionProvider, type InspectionMode } from '../src/widgets/inspection';
import { WidgetExample } from '../src/widgets/example';
import { WIDGET_KINDS } from '../src/widgets/presentation';
import { StatusPill, ActorLabel } from '../src/widgets/visual-language';
import { WidgetReferenceLinks } from '../src/widgets/reference-links';
import '../src/widgets/widgets.css';
import './styles.css';

const aspects: AspectKey[] = ['transport', 'schemas', 'security', 'git', 'observability', 'evidence', 'review', 'handoff'];
const sourceRecords: AdminNodeData[] = [
  { id: 'runtime', type: 'container', label: 'Engineering workspace', description: 'A read-only view of work, execution and continuity.', variant: 'generic', demo: true, children: [] },
  { id: 'agent', type: 'process', label: 'Bounded coding worker', description: 'Illustrative runtime observation, not a live process.', status: 'running', demo: true,
    transport: { protocol: 'acp', endpoint: 'stdio://demo-worker' }, schemas: ['runtime-observation/v1'], security: { auth: 'mtls', encryption: true, attestation: false },
    git: { repo: 'demo/repository', branch: 'feature', commit: 'demo-head', dirty: false }, observability: { logs: 'Demo run log', metrics: 'Demo timing summary' } },
  { id: 'task', type: 'task', label: 'Make evidence freshness inspectable', description: 'Task intent is distinct from work authority.', state: 'in-progress', priority: 'high', assignee: 'Demo operator', changeSetId: 'change', dependsOn: [] , demo: true },
  { id: 'change', type: 'changeset', label: 'Evidence freshness change', goal: 'Explain why an old passing receipt is stale after a new commit.', state: 'review', scopes: ['file:src/evidence/**'], baseSha: 'demo-base', headSha: 'demo-head', evidenceCount: 1, reviewOutcome: 'ready', demo: true },
  { id: 'proof', type: 'evidence', label: 'Freshness regression tests', kind: 'test', state: 'passed', producer: 'demo-runner', outcome: 'pass', boundToSha: 'demo-head', command: 'pytest tests/test_freshness.py', demo: true },
   { id: 'review', type: 'review', label: 'Local readiness review', outcome: 'ready', author: 'Demo author (not independent)', authorKind: 'person', requiredEvidence: ['test'], unresolved: ['Production deployment not assessed'], nextAction: 'Ask for independent review', demo: true },
  { id: 'handoff', type: 'handoff', label: 'Continue with independent review', task: 'Evidence freshness inspection', nextAction: 'Review the tests against the stated scope', createdBy: 'Demo operator', receiver: 'Demo reviewer', knownFailures: ['No production assurance'], demo: true },
  { id: 'hold', type: 'oversight', label: 'Deployment held for human judgment', action: 'Deploy evidence freshness change', risk: 'high', state: 'pending', deadline: '2026-10-14T18:00:00Z', rationale: 'Readiness does not authorize deployment.', delivery: 'queued', attention: ['Queued does not mean applied', 'Demo only — no approval can be submitted'], demo: true },
];
const records: AdminNodeData[] = sourceRecords.map(record => ({ ...record,
  snapshot: { source: record.type === 'task' ? 'Frog demo' : record.type === 'process' ? 'Rebekah demo' : record.type === 'oversight' ? 'Ephor / Dash demo' : 'WeftMark demo', observedAt: '2026-10-14T09:30:00Z', updatedAt: '2026-10-14T09:25:00Z', revision: 'demo-head' },
  lifecycle: { phase: record.type === 'process' || record.type === 'task' ? 'ongoing' : record.type === 'evidence' ? 'finished' : 'waiting', canReopen: record.type === 'evidence' ? false : undefined },
  inspectHref: `?inspect=${encodeURIComponent(record.id)}`,
  links: record.type === 'changeset' || record.type === 'review' ? [
    { kind: 'pull-request' as const, href: 'https://github.com/example/widget-demo/pull/42', label: '#42 · Evidence freshness', surface: 'GitHub', state: 'open' as const },
    { kind: 'merge-request' as const, href: 'https://gitlab.example.invalid/workspace/widget-demo/-/merge_requests/42', label: '!42 · Alternate review surface', surface: 'Self-hosted GitLab', state: 'draft' as const },
  ] : undefined,
}));
const complete = [{ ...records[0], children: [records[2], records[3], records[4], records[5], records[1], records[7], records[6]] } as AdminNodeData];
const lifecycleRecords: AdminNodeData[] = [
  { ...records[2], id: 'ongoing', label: 'Ongoing task — waiting on a dependency', attention: ['Dependency not yet done'], inspectHref: '?inspect=ongoing' },
  { ...records[2], id: 'finished', label: 'Finished task — may be reopened', state: 'done', lifecycle: { phase: 'finished', canReopen: true }, inspectHref: '?inspect=finished' } as AdminNodeData,
  { ...records[2], id: 'old', label: 'Older capture — current state uncertain', snapshot: { ...records[2].snapshot!, observedAt: '2026-10-12T09:30:00Z', stale: true }, attention: ['Refresh in source before acting'], inspectHref: '?inspect=old' },
];
const isolated: AdminNodeData = { ...records[1], id: 'isolated', label: 'Worker with explicit view', inspectHref: '?inspect=isolated', viewConfig: { detail: 'verbose', aspects: ['transport', 'security'] } };
const runtimeExample: AdminNodeData = { ...mockWidgetData('rebekah').nodes[0], id: 'runtime-example-record', viewConfig: undefined, inspectHref: '?inspect=runtime-example-record', children: [records[1], isolated] } as AdminNodeData;
const edges = [['task', 'change', 'implements'], ['agent', 'change', 'executes'], ['change', 'proof', 'produces'], ['proof', 'review', 'informs'], ['review', 'hold', 'not approval'], ['hold', 'handoff', 'continue']].map(([source, target, label]) => ({ id: `${source}-${target}`, source, target, label, type: 'smoothstep' }));

function detailView(data: AdminNodeData) {
  return <ViewConfigProvider config={{ detail: 'verbose', aspects }}><AdminWidget data={{ ...data, viewConfig: { detail: 'verbose', aspects } }} inspect={false} /></ViewConfigProvider>;
}

function Demo() {
  const [detail, setDetail] = useState<DetailLevel>('normal');
  const [enabled, setEnabled] = useState<AspectKey[]>(aspects);
  const [mode, setMode] = useState<InspectionMode>(() => {
    try { return localStorage.getItem('ragbaz.widgets.inspection') === 'tab' ? 'tab' : 'modal'; } catch { return 'modal'; }
  });
  useEffect(() => { try { localStorage.setItem('ragbaz.widgets.inspection', mode); } catch { /* Storage optional. */ } }, [mode]);
  const config = { detail, aspects: enabled };
  const selectedId = new URLSearchParams(window.location.search).get('inspect');
  if (selectedId) {
    const selected = [...complete, ...records.slice(1), ...lifecycleRecords, isolated, runtimeExample].find(record => record.id === selectedId);
    return <main><a href="/">← Widget gallery</a><WidgetExample id="inspection" heading={selected ? `Inspect: ${selected.label}` : 'Record not found'} description="Read-only demonstration of a dedicated record page. This snapshot is not live.">{selected ? detailView(selected) : <p role="alert">No demo record matches this identifier.</p>}</WidgetExample></main>;
  }
  return <ViewConfigProvider config={config}><WidgetInspectionProvider mode={mode} renderDetail={detailView}><main>
    <header><p className="eyebrow">RAGBAZ / shared administrative UI</p><h1>Understand the work, not just the status.</h1>
      <p>Planning, execution, proof, judgment and continuity — distinct information, connected without conflating authority.</p>
      <p className="demo-banner" role="status">DEMO MODE — every record is illustrative mock data. No services are contacted and no authority is granted.</p>
    </header>
    <nav aria-label="Demo sections"><a href="#catalog">Widget catalog</a><a href="#runtime-example">Runtime example</a><a href="#review-example">Review example</a><a href="#all-example">All widgets together</a></nav>
    <section className="controls" aria-label="View configuration">
      <label>Detail <select aria-label="Detail" value={detail} onChange={e => setDetail(e.target.value as DetailLevel)}><option>terse</option><option>normal</option><option>verbose</option></select></label>
      <label>Inspect records <select value={mode} onChange={e => setMode(e.target.value as InspectionMode)}><option value="modal">Modal on top</option><option value="tab">New browser tab</option></select></label>
      <fieldset><legend>Visible aspects (inherited unless overridden)</legend>{aspects.map(aspect => <label key={aspect}><input type="checkbox" checked={enabled.includes(aspect)} onChange={() => setEnabled(current => current.includes(aspect) ? current.filter(item => item !== aspect) : [...current, aspect])} />{aspect}</label>)}</fieldset>
    </section>
    <WidgetExample id="visual-vocabulary" heading="Visual vocabulary: tokens, risk and personas" description="Colored pills are coded values, not prose. Icons identify entities and actors. Remote PR state, local readiness, risk and priority remain separate concepts." note="All actors, URLs and reported states here are illustrative; no remote record is verified.">
      <h3>Remote PR / MR state</h3><div className="ragbaz-token-row">{['draft', 'open', 'merged', 'closed', 'unknown'].map(state => <StatusPill key={state} state={state} source="Reported remote state" />)}</div>
      <h3>Local work and review</h3><div className="ragbaz-token-row">{['in_progress', 'ready', 'blocked', 'passed', 'failed', 'stale'].map(state => <StatusPill key={state} state={state} source="Local state" />)}</div>
      <h3>Risk</h3><div className="ragbaz-token-row">{['low', 'medium', 'high', 'unknown'].map(state => <StatusPill key={state} state={state} category="risk" label={`Risk: ${state}`} source="Reported risk" />)}</div>
      <h3>Priority</h3><div className="ragbaz-token-row">{['low', 'normal', 'high', 'critical'].map(state => <StatusPill key={state} state={state} category="priority" label={`${state} priority`} />)}</div>
      <h3>Authors and assignees</h3><div className="ragbaz-token-row"><ActorLabel name="Demo reviewer" kind="person" /><ActorLabel name="Demo coding worker" kind="agent" /><ActorLabel name="Unspecified persona" /></div>
      <h3>Graphical navigation</h3><div className="catalog"><WidgetReferenceLinks demo links={['draft', 'open', 'merged', 'closed'].map((state, index) => ({ kind: 'pull-request', surface: 'GitHub', label: `#${42 + index} · ${state} example`, href: `https://github.com/example/widget-demo/pull/${42 + index}`, state: state as 'draft' | 'open' | 'merged' | 'closed' }))} /><WidgetReferenceLinks demo links={[{ kind: 'issue', surface: 'Forgejo', label: '#12 · Follow-up', href: 'https://forge.example.invalid/workspace/demo/issues/12' }, { kind: 'commit', surface: 'GitLab', label: 'a1b2c3d · Captured revision', href: 'https://gitlab.example.invalid/workspace/demo/-/commit/a1b2c3d' }]} /></div>
    </WidgetExample>
    <div id="catalog"><h2>Information vocabulary</h2><p>Type labels, distinct symbols and accent bands identify the kind of information. Status is a separate badge; color is never the only cue.</p>
      <div className="catalog">{records.map(data => <WidgetExample key={data.id} id={`example-${data.id}`} heading={WIDGET_KINDS[data.type].label} description={WIDGET_KINDS[data.type].description} note={`${WIDGET_KINDS[data.type].category} · inspect for a full read-only view`}><AdminWidget data={data} /></WidgetExample>)}</div>
    </div>
    <WidgetExample id="runtime-example" heading="Rebekah: runtime and inherited views" description="The container inherits your view. Its worker forces a verbose security/transport view; siblings continue inheriting." note="Reported security settings are not verified attestations.">
      <AdminWidget data={runtimeExample} />
    </WidgetExample>
    <WidgetExample id="review-example" heading="WeftMark → Ephor → Dash: evidence and human judgment" description="A passing check is not an independent review or deployment approval. A queued decision is not yet applied." note="Inspection is actionable navigation. Approval, mutation and reopening require the source product's authorized workflow."><div className="catalog">{[records[4], records[5], records[7], records[6]].map(data => <AdminWidget key={data.id} data={data} />)}</div></WidgetExample>
    <WidgetExample id="lifecycle-example" heading="Frog: ongoing, finished and reopenable work" description="Lifecycle describes the source task, not the freshness of a captured model. Completion and reopening capability are supplied independently.">
      <div className="catalog">{lifecycleRecords.map(data => <AdminWidget key={data.id} data={data} />)}</div>
    </WidgetExample>
    <WidgetExample id="all-example" heading="All eight widgets in one connected workflow" description="A bounded workspace groups task intent → change → evidence → review on the first row. Runtime, human oversight and handoff sit below. Arrows name relationships; they are not grants of authority." note="Pan and zoom using the canvas controls. Long card bodies scroll; Inspect opens the full record. No editing or new connections.">
      <WidgetCanvas nodes={complete} edges={edges} viewConfig={config} demo height="760px" />
      <details><summary>Accessible linear view of the complete workflow</summary><AdminWidget data={complete[0]} /></details>
    </WidgetExample>
    <footer>Prototype widgets · mocked state is not operational evidence · React Flow 11</footer>
  </main></WidgetInspectionProvider></ViewConfigProvider>;
}
createRoot(document.getElementById('root')!).render(<Demo />);
