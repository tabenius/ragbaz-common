import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { AdminWidget } from '../src/widgets/node-components';
import { toFlowNodes } from '../src/widgets/graph';
import { MOCK_CONTAINER_NODE } from '../src/widgets/node-types';
import { ViewConfigProvider } from '../src/widgets/view-config';
import { WidgetInspectionProvider } from '../src/widgets/inspection';
import { safeInspectionHref, snapshotState } from '../src/widgets/presentation';
import { WidgetExample } from '../src/widgets/example';
import { StatusPill, ActorLabel } from '../src/widgets/visual-language';
import { WEB_BINDINGS, webTabIndex, webRecordIndex, spatialRecordIndex, KeyboardLegend, EvidenceSummary, relativeDayLabel, TerminalCommand, copyText } from '../src/widgets/primitives';

test('plain widgets render without a graph store and mark inherited mock data', () => {
  const html = renderToStaticMarkup(<AdminWidget data={MOCK_CONTAINER_NODE} />);
  assert.equal((html.match(/DEMO — mock data/g) ?? []).length, 4);
  assert.ok(html.includes('inherited view'));
});

test('view overrides apply to the card itself and descendants', () => {
  const html = renderToStaticMarkup(<ViewConfigProvider config={{ detail: 'terse' }}>
    <AdminWidget data={{ ...MOCK_CONTAINER_NODE, viewConfig: { detail: 'verbose', aspects: ['git'] } }} />
  </ViewConfigProvider>);
  assert.ok(html.includes('a1b2c3d'));
  assert.ok(!html.includes('<dt>Transport</dt>'));
  assert.ok(html.includes('data-detail="verbose"'));
});

test('flow nodes use real parentage, unique ids, and resolved inherited config', () => {
  const nodes = toFlowNodes([{ ...MOCK_CONTAINER_NODE, viewConfig: { detail: 'verbose', aspects: ['git'] } }]);
  assert.equal(nodes.length, 4);
  assert.equal(nodes[1].parentNode, nodes[0].id);
  assert.equal(nodes[1].extent, 'parent');
  assert.equal(nodes[1].data.viewConfig?.detail, 'verbose');
  assert.equal(nodes[1].data.viewConfig?.inherited, true);
  assert.ok(nodes.every(node => node.data.demo));
  assert.throws(() => toFlowNodes([MOCK_CONTAINER_NODE, MOCK_CONTAINER_NODE]), /unique/);
});

test('empty data is not converted into demo and labels are escaped', () => {
  assert.deepEqual(toFlowNodes([]), []);
  const html = renderToStaticMarkup(<AdminWidget data={{ id: 'x', type: 'task', label: '<script>bad</script>', state: 'idea', priority: 'normal' }} />);
  assert.ok(!html.includes('<script>'));
  assert.ok(!html.includes('DEMO'));
});

test('layout bounds enclose descendants and siblings never overlap', () => {
  const deep = { ...MOCK_CONTAINER_NODE, id: 'outer', children: [MOCK_CONTAINER_NODE, { ...MOCK_CONTAINER_NODE.children[0], id: 'sibling' }] };
  const nodes = toFlowNodes([deep]);
  for (const node of nodes.filter(node => node.parentNode)) {
    const parent = nodes.find(item => item.id === node.parentNode)!;
    assert.ok(node.position.x >= 0 && node.position.y >= 0);
    assert.ok(node.position.x + Number(node.style!.width) <= Number(parent.style!.width));
    assert.ok(node.position.y + Number(node.style!.height) <= Number(parent.style!.height));
    for (const sibling of nodes.filter(item => item.parentNode === node.parentNode && item.id !== node.id)) {
      assert.ok(node.position.x + Number(node.style!.width) <= sibling.position.x || sibling.position.x + Number(sibling.style!.width) <= node.position.x || node.position.y + Number(node.style!.height) <= sibling.position.y || sibling.position.y + Number(sibling.style!.height) <= node.position.y);
    }
  }
});

test('snapshot freshness and source lifecycle are independent', () => {
  const data = { ...MOCK_CONTAINER_NODE.children[0], demo: false, snapshot: { source: 'source', observedAt: '2026-10-14T09:30:00Z', staleAfterSeconds: 30 } };
  const now = Date.parse('2026-10-14T09:30:15Z');
  assert.equal(snapshotState(data, now), 'captured');
  assert.equal(snapshotState(data, now + 60000), 'stale');
  assert.equal(snapshotState({ ...data, snapshot: undefined }, now), 'unknown');
  assert.equal(snapshotState({ ...data, snapshot: { source: 'source', observedAt: 'not-a-date' } }, now), 'unknown');
  assert.equal(snapshotState({ ...data, demo: true }, now), 'demo');
  const html = renderToStaticMarkup(<AdminWidget data={{ ...data, snapshot: { ...data.snapshot, observedAt: new Date().toISOString() }, lifecycle: { phase: 'finished', canReopen: true } }} />);
  assert.ok(html.includes('Snapshot (not live)'));
  assert.ok(html.includes('Reopen available in source'));
  assert.ok(html.includes('Updated unknown'));
});

test('inspection uses modal or safe tab navigation, not fake mutation', () => {
  const data = { ...MOCK_CONTAINER_NODE.children[0], inspectHref: '/tasks/one' };
  const modal = renderToStaticMarkup(<WidgetInspectionProvider renderDetail={() => null}><AdminWidget data={data} /></WidgetInspectionProvider>);
  assert.ok(modal.includes('aria-haspopup="dialog"'));
  const tab = renderToStaticMarkup(<WidgetInspectionProvider mode="tab" renderDetail={() => null}><AdminWidget data={data} /></WidgetInspectionProvider>);
  assert.ok(tab.includes('target="_blank"'));
  assert.ok(tab.includes('rel="noopener noreferrer"'));
  for (const href of ['javascript:alert(1)', '//evil.test', '/\\evil.test', 'https://user:pass@example.com', 'data:text/html,hi']) assert.equal(safeInspectionHref(href), undefined);
  assert.equal(safeInspectionHref('?inspect=one'), '?inspect=one');
  const missing = renderToStaticMarkup(<WidgetInspectionProvider mode="tab" renderDetail={() => null}><AdminWidget data={{ ...data, inspectHref: undefined }} /></WidgetInspectionProvider>);
  assert.ok(missing.includes('Inspection link not supplied'));
});

test('oversight separates human decision from delivery', () => {
  const html = renderToStaticMarkup(<AdminWidget data={{ id: 'hold', type: 'oversight', label: 'Hold', action: 'Deploy', risk: 'high', state: 'approved', delivery: 'queued', viewConfig: { detail: 'normal' } }} />);
  assert.ok(html.includes('Human decision hold'));
  assert.ok(html.includes('aria-label="Decision: approved"'));
  assert.ok(html.includes('aria-label="Delivery: queued"'));
  assert.ok(html.includes('aria-label="Reported risk: Risk: high"'));
});

test('examples have a heading, description and labelled stage', () => {
  const html = renderToStaticMarkup(<WidgetExample id="sample" heading="Task example" description="Intent, not authority"><p>Example</p></WidgetExample>);
  assert.ok(html.includes('aria-labelledby="sample-heading"'));
  assert.ok(html.includes('Intent, not authority'));
  assert.ok(html.includes('aria-label="Example: Task example"'));
});

test('PR and other source links work in terse inspection without implying local state', () => {
  const html = renderToStaticMarkup(<AdminWidget inspect={false} data={{
    id: 'review', type: 'review', label: 'Local review', outcome: 'blocked', author: 'Reviewer', requiredEvidence: [],
    viewConfig: { detail: 'terse' }, links: [
      { kind: 'pull-request', surface: 'GitHub', label: '#42', href: 'https://github.com/org/repo/pull/42', state: 'merged' },
      { kind: 'merge-request', surface: 'Internal GitLab', label: '!7', href: 'https://forge.example.org/project/-/merge_requests/7' },
      { kind: 'review', label: '<script>bad</script>', href: 'javascript:alert(1)' },
    ],
  }} />);
  assert.ok(html.includes('href="https://github.com/org/repo/pull/42"'));
  assert.ok(html.includes('href="https://forge.example.org/project/-/merge_requests/7"'));
  assert.equal((html.match(/target="_blank"/g) ?? []).length, 2);
  assert.equal((html.match(/rel="noopener noreferrer"/g) ?? []).length, 2);
  assert.ok(html.includes('aria-label="Reported remote state: merged"'));
  assert.ok(html.includes('>blocked</span>'));
  assert.ok(html.includes('unsafe or invalid link'));
  assert.ok(!html.includes('href="javascript:'));
  assert.ok(!html.includes('<script>'));
});

test('coded states use icon pills with distinct remote and risk semantics', () => {
  for (const [state, tone] of [['draft', 'neutral'], ['open', 'success'], ['merged', 'merged'], ['closed', 'closed'], ['unknown', 'neutral']]) {
    const html = renderToStaticMarkup(<StatusPill state={state} source="Remote PR" />);
    assert.ok(html.includes(`data-tone="${tone}"`));
    assert.ok(html.includes(`aria-label="Remote PR: ${state}"`));
    assert.ok(html.includes('<svg'));
    assert.ok(html.includes('aria-hidden="true"'));
  }
  for (const [state, tone] of [['low', 'success'], ['medium', 'warning'], ['high', 'danger'], ['unknown', 'neutral']]) {
    const html = renderToStaticMarkup(<StatusPill state={state} category="risk" />);
    assert.ok(html.includes(`data-tone="${tone}"`));
    assert.ok(html.includes('data-category="risk"'));
  }
  assert.ok(renderToStaticMarkup(<StatusPill state="high" category="priority" />).includes('data-tone="warning"'));
});

test('personas have icons without assuming that unspecified authors are human', () => {
  const person = renderToStaticMarkup(<ActorLabel name="Reviewer" kind="person" />);
  const agent = renderToStaticMarkup(<ActorLabel name="Worker" kind="agent" />);
  const unknown = renderToStaticMarkup(<ActorLabel name="Unspecified" />);
  assert.ok(person.includes('Reported person') && person.includes('>person</span>'));
  assert.ok(agent.includes('Reported agent') && agent.includes('>agent</span>'));
  assert.ok(unknown.includes('Persona type not supplied'));
  assert.ok(!unknown.includes('>person</span>'));
});

test('keyboard table drives both web navigation and legend, with Vim opt in', () => {
  assert.equal(webTabIndex('l', 0, 3), null);
  assert.equal(webTabIndex('l', 0, 3, true), 1);
  assert.equal(webTabIndex('h', 0, 3, true), 2);
  assert.equal(webTabIndex('0', 2, 3, true), 0);
  assert.equal(webTabIndex('$', 0, 3, true), 2);
  assert.equal(webTabIndex('ArrowRight', 2, 3), 0);
  assert.equal(webRecordIndex('j', 0, 3), null);
  assert.equal(webRecordIndex('j', 0, 3, true), 1);
  assert.equal(webRecordIndex('k', 0, 3, true), 0);
  assert.equal(webRecordIndex('$', 0, 3, true), 2);
  assert.equal(webRecordIndex('ArrowDown', 2, 3), 2);
  assert.equal(webRecordIndex('0', 0, 0, true), -1);
  const boxes = [{ left: 0, top: 0, width: 100, height: 80 }, { left: 120, top: 0, width: 100, height: 80 }, { left: 0, top: 100, width: 100, height: 80 }];
  assert.equal(spatialRecordIndex('j', 0, boxes, true), 2);
  assert.equal(spatialRecordIndex('l', 0, boxes, true), 1);
  assert.equal(spatialRecordIndex('j', 1, boxes, true), 1, 'Missing cell is a boundary, not a diagonal jump');
  assert.equal(spatialRecordIndex('k', 2, boxes, true), 0);
  const html = renderToStaticMarkup(<KeyboardLegend />);
  for (const binding of WEB_BINDINGS) for (const key of binding.keys) assert.ok(html.includes(`<kbd>${key}</kbd>`));
  assert.ok(html.includes('opt in using View settings'));
});

test('current evidence is not a pass rate and unknown counts do not become zero', () => {
  const known = renderToStaticMarkup(<EvidenceSummary current={2} total={3} />);
  assert.ok(known.includes('not a pass rate'));
  assert.ok(known.includes('<meter'));
  const missing = renderToStaticMarkup(<EvidenceSummary current={null} total={3} />);
  assert.ok(missing.includes('— / 3'));
  assert.ok(!missing.includes('<meter'));
  assert.ok(!renderToStaticMarkup(<EvidenceSummary current={4} total={3} />).includes('<meter'));
});

test('friendly dates use calendar boundaries, compact weekdays and distant exact dates', () => {
  const now = new Date('2026-10-15T00:01:00Z');
  const date = new Date('2026-10-14T23:58:00Z');
  assert.equal(relativeDayLabel(date, now), 'yesterday');
  assert.equal(relativeDayLabel(date, now, 'America/New_York'), 'today');
  assert.equal(relativeDayLabel(new Date('2026-10-16T12:00:00Z'), now), 'tomorrow');
  assert.equal(relativeDayLabel(new Date('2026-10-12T12:00:00Z'), now), 'last Monday');
  assert.equal(relativeDayLabel(new Date('2026-10-12T12:00:00Z'), now, 'UTC', true), 'last Mon');
  assert.equal(relativeDayLabel(new Date('2026-09-12T12:00:00Z'), now), '2026-09-12');
  assert.equal(relativeDayLabel(new Date('2026-10-25T00:30:00Z'), new Date('2026-10-25T23:30:00Z'), 'Europe/Stockholm'), 'yesterday', 'DST-short/long days do not use elapsed-day arithmetic');
});

test('terminal commands stay literal code with an accessible copy button', () => {
  const inline = renderToStaticMarkup(<TerminalCommand command="frog --json task info FRG-42" label="Frog native record command" inline />);
  assert.ok(inline.includes('<code class="ragbaz-command-text">frog --json task info FRG-42</code>'));
  assert.ok(inline.includes('aria-label="Copy Frog native record command"'));
  assert.ok(inline.includes('aria-hidden="true"'));
  assert.ok(!inline.includes('onclick'));

  const block = renderToStaticMarkup(<TerminalCommand command="rbq repository --endpoint URL --token-file PRIVATE_FILE describe" label="RBQ command" description="Copy into your terminal." />);
  assert.ok(block.includes('<pre><code class="ragbaz-command-text">rbq repository --endpoint URL --token-file PRIVATE_FILE describe</code></pre>'));
  assert.ok(block.includes('Copy into your terminal.'));
  assert.ok(block.includes('aria-label="Copy RBQ command"'));
  assert.ok(!block.includes('<script>'));
});

test('copyText writes the exact value without executing or logging it', async () => {
  const written: string[] = [];
  assert.deepEqual(await copyText('frog --json task info FRG-42', { writeText: async (value) => { written.push(value); } }), { ok: true });
  assert.deepEqual(written, ['frog --json task info FRG-42']);
  assert.deepEqual(await copyText('anything', null), { ok: false, reason: 'unavailable' });
  assert.deepEqual(await copyText('anything', { writeText: async () => { throw new Error('denied'); } }), { ok: false, reason: 'denied' });
});
